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
  if (req.method !== "GET") return response({ ok: false, message: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Server configuration unavailable.");

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db
      .from("access_settings")
      .select("value,updated_at")
      .eq("key", "LHI_GLOBAL_BLOCK")
      .maybeSingle();
    if (error) throw error;

    const active = String(data?.value || "NONAKTIF").toUpperCase() === "AKTIF";
    return response({
      ok: true,
      blocked: active,
      mode: active ? "AKTIF" : "NONAKTIF",
      updated_at: data?.updated_at || null,
      message: active
        ? "MODE FORM BLOK APLIKASI AKTIF. Seluruh petugas sementara tidak dapat masuk. Hanya KA IPSRS yang dapat mengakses prosedur pengelolaan blokir."
        : "",
    });
  } catch (_error) {
    // Fail closed: when the public status cannot be verified, the frontend must not
    // assume that login is allowed. Do not expose database/server error details.
    return response({
      ok: false,
      blocked: true,
      mode: "TIDAK_DAPAT_DIVERIFIKASI",
      message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara. Silakan hubungi KA IPSRS.",
    }, 503);
  }
});
