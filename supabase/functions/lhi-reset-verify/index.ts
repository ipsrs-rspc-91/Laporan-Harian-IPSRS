import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, valid: false, message: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Server configuration unavailable.");

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) return response({ ok: false, valid: false, message: "Kode reset tidak benar." }, 400);

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const now = Date.now();
    const { data: throttle, error: throttleError } = await db
      .from("access_settings").select("updated_at").eq("key", "LHI_RESET_LAST_ATTEMPT").maybeSingle();
    if (throttleError) throw throttleError;
    const last = throttle?.updated_at ? new Date(throttle.updated_at).getTime() : 0;
    if (last && now - last < 2500) return response({ ok: false, valid: false, message: "Tunggu beberapa detik sebelum mencoba kembali." }, 429);

    const { error: throttleWriteError } = await db.from("access_settings").upsert({
      key: "LHI_RESET_LAST_ATTEMPT", value: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
      updated_by_staff_id: "SYSTEM", updated_by_name: "SYSTEM",
    }, { onConflict: "key" });
    if (throttleWriteError) throw throttleWriteError;

    const { data: setting, error } = await db
      .from("access_settings").select("value").eq("key", "LHI_RESET_CODE_HASH").maybeSingle();
    if (error) throw error;
    if (!setting?.value) throw new Error("Reset code is not configured.");

    const candidate = await sha256(code);
    const expected = String(setting.value).toLowerCase();
    let diff = candidate.length ^ expected.length;
    for (let i = 0; i < Math.max(candidate.length, expected.length); i++) {
      diff |= (candidate.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
    }
    if (diff !== 0) return response({ ok: true, valid: false, message: "Kode reset tidak benar." });

    const { data: blockSetting, error: blockError } = await db
      .from("access_settings").select("value").eq("key", "LHI_GLOBAL_BLOCK").maybeSingle();
    if (blockError) throw blockError;
    if (String(blockSetting?.value || "").toUpperCase() !== "AKTIF") {
      return response({ ok: false, valid: false, message: "Mode Blok Aplikasi tidak sedang aktif. Reset tidak diperlukan." }, 409);
    }

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: issued, error: issueError } = await db.rpc("issue_lhi_recovery_token", {
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });
    if (issueError || issued !== true) throw issueError || new Error("Recovery token issuance failed.");

    return response({
      ok: true,
      valid: true,
      recovery_token: token,
      expires_at: expiresAt,
      message: "Kode reset diterima. Silakan login menggunakan akun KA IPSRS.",
    });
  } catch {
    return response({ ok: false, valid: false, message: "Reset belum dapat diverifikasi oleh server." }, 503);
  }
});