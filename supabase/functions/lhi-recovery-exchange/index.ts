import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const encoder = new TextEncoder();

function allowedOrigins() {
  return new Set(
    String(Deno.env.get("LHI_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function corsFor(origin: string | null) {
  const allowed = allowedOrigins();
  if (!origin || !allowed.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function response(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
    },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get("origin"));
  if (!cors) return new Response("Forbidden origin.", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ ok: false, message: "Method not allowed." }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rateSalt = Deno.env.get("LHI_RATE_LIMIT_SALT");
    const clientIp = String(req.headers.get("cf-connecting-ip") || "").trim();
    if (!url || !serviceKey || !rateSalt || rateSalt.length < 32 || !clientIp) return response({ ok: false, message: "Recovery service unavailable." }, 503, cors);

    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
    const body = await req.json().catch(() => ({}));
    const challenge = String(body?.challenge || "").trim();

    if (!bearer || challenge.length < 32 || challenge.length > 256) {
      return response({ ok: false, message: "Autentikasi atau challenge tidak valid." }, 401, cors);
    }

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Verify the Supabase access token with Auth; never decode the JWT locally
    // and never trust staff_id or role values supplied by the browser.
    const { data: authData, error: authError } = await db.auth.getUser(bearer);
    if (authError || !authData?.user?.id) {
      return response({ ok: false, message: "Autentikasi KA IPSRS tidak valid." }, 401, cors);
    }

    const ipHash = await sha256(rateSalt + ":" + clientIp);
    const nonceHash = await sha256(challenge);
    const capability = randomToken(32);
    const capabilityHash = await sha256(capability);

    const { data, error } = await db.rpc("consume_lhi_recovery_challenge", {
      p_nonce_hash: nonceHash,
      p_auth_user_id: authData.user.id,
      p_session_token_hash: capabilityHash,
      p_ip_hash: ipHash,
    });

    if (error || !data?.ok) {
      // Deliberately avoid disclosing whether the challenge, incident, role,
      // or employment status caused the rejection.
      return response({ ok: false, message: "Sesi pemulihan tidak dapat diterbitkan. Periksa akun KA IPSRS dan ulangi prosedur Reset." }, 403, cors);
    }

    return response({
      ok: true,
      recovery_capability: capability,
      expires_at: data.expires_at,
      staff_name: data.staff_name,
      role: data.role,
      incident_id: data.incident_id,
    }, 200, cors);
  } catch {
    return response({ ok: false, message: "Sesi pemulihan tidak dapat diterbitkan oleh server." }, 503, cors);
  }
});
