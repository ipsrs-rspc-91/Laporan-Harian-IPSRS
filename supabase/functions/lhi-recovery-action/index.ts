import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const enc = new TextEncoder();
const cors = (origin: string | null) => {
  const allowed = new Set(String(Deno.env.get("LHI_ALLOWED_ORIGINS") || "").split(",").map(x => x.trim()).filter(Boolean));
  if (!origin || (allowed.size && !allowed.has(origin))) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "600", Vary: "Origin" };
};
const json = (body: unknown, status: number, headers: Record<string,string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type":"application/json",
    "Cache-Control":"no-store, max-age=0", Pragma:"no-cache" } });
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))]
  .map(b => b.toString(16).padStart(2,"0")).join("");

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (!headers) return new Response("Forbidden origin.", { status:403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ ok:false, message:"Method not allowed." },405,headers);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const capability = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    if (!url || !serviceKey || !capability || !["apiRecoveryStatus","apiStartLhiGrace"].includes(action))
      return json({ ok:false, message:"Sesi pemulihan tidak valid atau tindakan tidak diizinkan." },401,headers);
    const db = createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
    const tokenHash = await sha256(capability);
    const { data:auth, error:authError } = await db.rpc("validate_lhi_recovery_session", {
      p_session_token_hash:tokenHash, p_action:action
    });
    if (authError || !auth?.ok || auth.role !== "KA_IPSRS")
      return json({ ok:false, message:"Sesi pemulihan tidak valid atau telah kedaluwarsa." },401,headers);

    if (action === "apiRecoveryStatus") {
      const { data, error } = await db.rpc("get_lhi_grace_status_v2");
      if (error || !data) return json({ ok:false, message:"Snapshot kewajiban belum dapat dibaca." },503,headers);
      if (Number(data.incident_id) !== Number(auth.incident_id))
        return json({ ok:false, message:"Insiden pemulihan tidak cocok dengan sesi." },409,headers);
      return json({ ok:true, ...data },200,headers);
    }

    const { data, error } = await db.rpc("open_lhi_global_grace_v2", {
      p_recovery_session_token_hash:tokenHash
    });
    if (error || !data?.ok)
      return json({ ok:false, message:"Pemulihan gagal. Blokir tetap berlaku dan masa tenggang tidak dimulai.", reason:data?.reason || "RECOVERY_FAILED" },409,headers);
    return json({ ok:true, ...data },200,headers);
  } catch {
    return json({ ok:false, message:"Layanan pemulihan sedang tidak tersedia." },503,headers);
  }
});
