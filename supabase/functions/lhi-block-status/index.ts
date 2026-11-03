import { createClient } from "npm:@supabase/supabase-js@2.116.0";

function corsFor(origin: string | null) {
  const allowed = new Set(
    String(Deno.env.get("LHI_ALLOWED_ORIGINS") || "")
      .split(",").map((value) => value.trim()).filter(Boolean),
  );
  if (!origin || !allowed.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get("origin"));
  if (!cors) return new Response("Forbidden origin.", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return response({ ok: false, message: "Method not allowed." }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return response({ ok: false, blocked: true, message: "Status blokir belum dapat diverifikasi. Login ditahan." }, 503, cors);
    }

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await db
      .from("access_settings")
      .select("value")
      .eq("key", "LHI_GLOBAL_BLOCK")
      .maybeSingle();

    // Fail closed: if the global lock cannot be read, the frontend must not
    // fall through to the normal login screen.
    if (error || !data) {
      return response({
        ok: false,
        blocked: true,
        message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara.",
      }, 503, cors);
    }

    const lockState = String(data.value || "").toUpperCase();
    if (lockState !== "AKTIF" && lockState !== "NONAKTIF") {
      return response({
        ok: false,
        blocked: true,
        message: "Status blokir aplikasi tidak valid. Login ditahan sementara.",
      }, 503, cors);
    }
    const blocked = lockState === "AKTIF";
    let graceIncident: { incident_id: number; deadline_at: string } | null = null;
    if (!blocked) {
      const { data: grace, error: graceError } = await db
        .from("lhi_discipline_incidents")
        .select("incident_id,deadline_at")
        .eq("status", "GRACE")
        .order("incident_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (graceError) {
        return response({
          ok: false,
          blocked: true,
          message: "Status masa pemulihan belum dapat diverifikasi. Login ditahan sementara.",
        }, 503, cors);
      }
      graceIncident = grace || null;
    }
    return response({
      ok: true,
      blocked,
      grace_active: Boolean(graceIncident),
      grace_deadline_at: graceIncident?.deadline_at || null,
      message: blocked
        ? "Mode Blok Aplikasi aktif. Login normal ditutup. KA IPSRS harus melalui prosedur Reset."
        : (graceIncident
          ? "Masa pemulihan LHI sedang berlangsung. KA IPSRS dapat melanjutkan sesi pemulihan terbatas."
          : "Mode Blok Aplikasi tidak aktif."),
      noncompliant_staff: [],
    }, 200, cors);
  } catch {
    return response({
      ok: false,
      blocked: true,
      message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara.",
    }, 503, cors);
  }
});
