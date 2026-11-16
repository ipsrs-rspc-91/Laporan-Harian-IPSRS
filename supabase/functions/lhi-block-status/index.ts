import { createClient } from "npm:@supabase/supabase-js@2.116.0";

function corsFor(origin: string | null) {
  const allowed = new Set(
    String(Deno.env.get("LHI_ALLOWED_ORIGINS") || "")
      .split(",").map((value) => value.trim()).filter(Boolean),
  );
  if (!origin || (allowed.size > 0 && !allowed.has(origin))) return null;
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

    const { data: setting, error: settingError } = await db
      .from("access_settings")
      .select("value")
      .eq("key", "LHI_GLOBAL_BLOCK")
      .maybeSingle();

    if (settingError || !setting) {
      return response({
        ok: false, blocked: true,
        message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara.",
      }, 503, cors);
    }

    const lockState = String(setting.value || "").toUpperCase();
    if (lockState !== "AKTIF" && lockState !== "NONAKTIF") {
      return response({
        ok: false, blocked: true,
        message: "Status blokir aplikasi tidak valid. Login ditahan sementara.",
      }, 503, cors);
    }

    const blocked = lockState === "AKTIF";
    if (!blocked) {
      return response({ ok: true, blocked: false, noncompliant_staff: [] }, 200, cors);
    }

    const { data: incident, error: incidentError } = await db
      .from("lhi_discipline_incidents")
      .select("incident_id,status,started_at")
      .in("status", ["LOCKED", "EXPIRED", "GRACE"])
      .order("incident_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (incidentError) {
      return response({
        ok: false, blocked: true,
        message: "Data insiden blokir belum dapat diverifikasi. Login ditahan sementara.",
      }, 503, cors);
    }

    let noncompliant_staff: Array<{
      staff_id: string;
      nama: string;
      jabatan: string;
      kewajiban_belum_selesai: number;
    }> = [];

    if (incident) {
      const { data: obligations, error: obligationError } = await db
        .from("lhi_discipline_obligations")
        .select("staff_id,snapshot_name,snapshot_role,snapshot_missed_days,completed_at,excluded_at")
        .eq("incident_id", incident.incident_id);

      if (obligationError) {
        return response({
          ok: false, blocked: true,
          message: "Snapshot petugas pemicu belum dapat diverifikasi. Login ditahan sementara.",
        }, 503, cors);
      }

      const pending = (obligations || []).filter((item) =>
        !item.completed_at && !item.excluded_at
      );
      const ids = [...new Set(pending.map((item) => String(item.staff_id)))];
      const { data: staff, error: staffError } = ids.length
        ? await db.from("staff")
          .select("staff_id,nama,jabatan,status")
          .in("staff_id", ids)
          .eq("status", "Aktif")
        : { data: [], error: null };

      if (staffError) {
        return response({
          ok: false, blocked: true,
          message: "Data petugas pemicu belum dapat diverifikasi. Login ditahan sementara.",
        }, 503, cors);
      }

      const activeById = new Map((staff || []).map((item) => [String(item.staff_id), item]));
      noncompliant_staff = pending.reduce((result, item) => {
        const active = activeById.get(String(item.staff_id));
        if (!active || result.some((entry) => entry.staff_id === String(item.staff_id))) return result;
        result.push({
          staff_id: String(item.staff_id),
          nama: String(item.snapshot_name || active.nama || "Petugas terkait"),
          jabatan: String(active.jabatan || item.snapshot_role || ""),
          kewajiban_belum_selesai: Math.max(0, Number(item.snapshot_missed_days) || 0),
        });
        return result;
      }, [] as typeof noncompliant_staff);
    }

    return response({
      ok: true,
      blocked: true,
      message: "Mode Blok Aplikasi LHI aktif. Login normal ditutup sampai KA IPSRS menyelesaikan prosedur pemulihan.",
      incident_id: incident?.incident_id || null,
      noncompliant_staff,
    }, 200, cors);
  } catch {
    return response({
      ok: false,
      blocked: true,
      message: "Status blokir aplikasi belum dapat diverifikasi. Login ditahan sementara.",
    }, 503, cors);
  }
});
