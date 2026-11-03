import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const encoder = new TextEncoder();

function corsFor(origin: string | null) {
  const allowed = new Set(
    String(Deno.env.get("LHI_ALLOWED_ORIGINS") || "")
      .split(",").map((value) => value.trim()).filter(Boolean),
  );
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

function constantTimeHexEqual(left: string, right: string) {
  const a = String(left || "").toLowerCase();
  const b = String(right || "").toLowerCase();
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0 && /^[0-9a-f]{64}$/.test(a) && /^[0-9a-f]{64}$/.test(b);
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function clientAddress(req: Request) {
  // Only trust the edge-overwritten Cloudflare client IP header.
  // x-forwarded-for is client-influenceable on some proxy paths and must not
  // be used as the rate-limit identity.
  return String(req.headers.get("cf-connecting-ip") || "").trim();
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get("origin"));
  if (!cors) return new Response("Forbidden origin.", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ ok: false, valid: false, message: "Method not allowed." }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rateSalt = Deno.env.get("LHI_RATE_LIMIT_SALT");
    if (!url || !serviceKey || !rateSalt || rateSalt.length < 32) {
      return response({ ok: false, valid: false, message: "Reset belum dapat diverifikasi oleh server." }, 503, cors);
    }

    const address = clientAddress(req);
    if (!address) return response({ ok: false, valid: false, message: "Reset belum dapat diverifikasi oleh server." }, 503, cors);

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Rate limit is recorded atomically before code verification, including
    // malformed and incorrect attempts. Raw IP and reset code are never stored.
    const ipHash = await sha256(rateSalt + ":" + address);
    const { data: rate, error: rateError } = await db.rpc("register_lhi_reset_attempt", {
      p_ip_hash: ipHash,
    });
    if (rateError || !rate?.allowed) {
      return response({ ok: false, valid: false, message: "Terlalu banyak percobaan Reset. Silakan coba kembali setelah 15 menit." }, 429, cors);
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return response({ ok: true, valid: false, message: "Kode reset tidak benar." }, 400, cors);
    }

    const { data: setting, error: settingError } = await db
      .from("access_settings").select("value").eq("key", "LHI_RESET_CODE_HASH").maybeSingle();
    if (settingError || !setting || !/^[0-9a-f]{64}$/i.test(String(setting.value || ""))) {
      return response({ ok: false, valid: false, message: "Reset belum dapat diverifikasi oleh server." }, 503, cors);
    }

    const candidate = await sha256(code);
    if (!constantTimeHexEqual(candidate, String(setting.value))) {
      return response({ ok: true, valid: false, message: "Kode reset tidak benar." }, 400, cors);
    }

    const challenge = randomToken(32);
    const nonceHash = await sha256(challenge);
    const { data: issued, error: issueError } = await db.rpc("create_lhi_recovery_challenge", {
      p_nonce_hash: nonceHash,
      p_ip_hash: ipHash,
    });

    if (issueError || !issued?.ok) {
      return response({ ok: false, valid: false, message: "Mode Blok Aplikasi atau insiden pemulihan tidak siap. Akses tetap diblokir." }, 409, cors);
    }

    return response({
      ok: true,
      valid: true,
      challenge,
      expires_at: issued.expires_at,
      message: "Kode Reset diterima. Silakan login dengan akun KA IPSRS.",
    }, 200, cors);
  } catch {
    return response({ ok: false, valid: false, message: "Reset belum dapat diverifikasi oleh server." }, 503, cors);
  }
});
