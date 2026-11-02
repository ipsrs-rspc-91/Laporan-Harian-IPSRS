import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "600",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return response({ ok: false, blocked: true, message: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Server configuration unavailable.");

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: setting, error } = await db
      .from("access_settings")
      .select("value,updated_at")
      .eq("key", "LHI_GLOBAL_BLOCK")
      .maybeSingle();

    if (error) throw error;
    const mode = String(setting?.value || "").toUpperCase();
    if (!setting || (mode !== "AKTIF" && mode !== "NONAKTIF")) {
      return response({
        ok: false,
        blocked: true,
        mode: "TIDAK_DAPAT_DIVERIFIKASI",
        message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara.",
      }, 503);
    }

    // Public pre-login endpoint returns only the global lock state.
    // Staff names, roles, and individual obligation details must never be exposed here.
    const blocked = mode === "AKTIF";
    return response({
      ok: true,
      blocked,
      mode,
      message: blocked
        ? "Mode Blok Aplikasi LHI sedang aktif. Akses operasional ditutup sementara."
        : "Mode Blok Aplikasi LHI tidak aktif.",
      updated_at: setting.updated_at || null,
    });
  } catch {
    return response({
      ok: false,
      blocked: true,
      mode: "TIDAK_DAPAT_DIVERIFIKASI",
      message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara.",
    }, 503);
  }
});
