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

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get("origin"));
  if (!cors) return new Response("Forbidden origin.", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ ok: false, message: "Method not allowed." }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return response({ ok: false, message: "Recovery service unavailable." }, 503, cors);
    }

    const authHeader = req.headers.get("authorization") || "";
    const capability = authHeader.match(/^Bearer\s+([A-Za-z0-9_-]{32,256})$/)?.[1] || "";
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (!capability || !["apiRecoveryStatus", "apiStartLhiGrace"].includes(action)) {
      return response({ ok: false, message: "Aksi pemulihan tidak diizinkan." }, 403, cors);
    }

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const tokenHash = await sha256(capability);
    const { data: validation, error: validationError } = await db.rpc(
      "validate_lhi_recovery_session",
      {
        p_session_token_hash: tokenHash,
        p_action: action,
      },
    );

    if (validationError || !validation?.ok) {
      return response({ ok: false, message: "Sesi pemulihan tidak valid, kedaluwarsa, atau tidak berwenang." }, 403, cors);
    }

    if (action === "apiRecoveryStatus") {
      return response({
        ok: true,
        action,
        incident_id: validation.incident_id,
        incident_status: validation.incident_status,
        started_at: validation.started_at,
        deadline_at: validation.deadline_at,
        staff_name: validation.staff_name,
      }, 200, cors);
    }

    // The RPC revalidates the capability in-transaction and is idempotent.
    const { data: result, error: resetError } = await db.rpc("open_lhi_global_grace_v2", {
      p_recovery_session_token_hash: tokenHash,
    });

    if (resetError || !result?.ok) {
      return response({
        ok: false,
        message: "Reset gagal diproses. Blokir global tetap dipertahankan.",
      }, 409, cors);
    }

    return response({
      ok: true,
      action,
      incident_id: result.incident_id,
      status: result.status,
      already_open: result.already_open,
      started_at: result.started_at,
      deadline_at: result.deadline_at,
      snapshot_total: result.snapshot_total,
      individual_access_unblocked: result.individual_access_unblocked,
    }, 200, cors);
  } catch {
    return response({ ok: false, message: "Permintaan pemulihan gagal diproses." }, 503, cors);
  }
});
