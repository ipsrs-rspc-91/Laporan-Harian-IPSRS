import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = (origin: string | null) => {
  const allowed = new Set(String(Deno.env.get("LHI_ALLOWED_ORIGINS") || "").split(",").map(x => x.trim()).filter(Boolean));
  if (!origin || (allowed.size && !allowed.has(origin))) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers":"apikey, content-type",
    "Access-Control-Allow-Methods":"GET, OPTIONS", "Access-Control-Max-Age":"600", Vary:"Origin" };
};
const json = (body: unknown, status: number, headers: Record<string,string>) =>
  new Response(JSON.stringify(body), { status, headers:{...headers,"Content-Type":"application/json",
    "Cache-Control":"no-store, max-age=0",Pragma:"no-cache"} });

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (!headers) return new Response("Forbidden origin.", { status:403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") return json({ok:false,message:"Method not allowed."},405,headers);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !key) return json({ok:false,message:"Status blokir belum dapat diverifikasi."},503,headers);
    const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data:setting,error:settingError}=await db.from("access_settings").select("value").eq("key","LHI_GLOBAL_BLOCK").maybeSingle();
    if(settingError || !setting) return json({ok:false,message:"Status blokir belum dapat diverifikasi."},503,headers);
    const lockValue=String(setting.value||"").toUpperCase();
    if(!["AKTIF","NONAKTIF"].includes(lockValue))
      return json({ok:false,message:"Status blokir tidak valid. Akses normal ditahan sampai status server dapat dipastikan."},503,headers);
    const blocked=lockValue==="AKTIF";
    if(!blocked) return json({ok:true,blocked:false},200,headers);
    const {data:incident,error:incidentError}=await db.from("lhi_discipline_incidents")
      .select("incident_id,status,started_at").in("status",["LOCKED","EXPIRED","GRACE"])
      .order("incident_id",{ascending:false}).limit(1).maybeSingle();
    if(incidentError) return json({ok:false,message:"Data insiden blokir belum dapat diverifikasi."},503,headers);
    let noncompliant_staff: Record<string,unknown>[] = [];
    if(incident){
      const {data:obligations,error:obligationError}=await db.from("lhi_discipline_obligations")
        .select("staff_id,snapshot_name,snapshot_role,snapshot_missed_days")
        .eq("incident_id",incident.incident_id);
      if(obligationError) return json({ok:false,message:"Snapshot petugas pemicu belum dapat diverifikasi."},503,headers);
      // Only obligations still pending for currently active employees are shown as triggers.
      // Compliant or excluded members must not be named as the reason for a reactivated lock.
      const pending=(obligations||[]).filter((x:any)=>!x.completed_at&&!x.excluded_at);
      const ids=[...new Set(pending.map((x:any)=>String(x.staff_id)))];
      const {data:staff,error:staffError}=ids.length
        ? await db.from("staff").select("staff_id,jabatan,nama,status").in("staff_id",ids).eq("status","Aktif")
        : {data:[],error:null};
      if(staffError) return json({ok:false,message:"Data petugas pemicu belum dapat diverifikasi."},503,headers);
      const byId=new Map((staff||[]).map((x:any)=>[String(x.staff_id),x]));
      noncompliant_staff=pending.reduce((out:any[],x:any)=>{
        const s=byId.get(String(x.staff_id)) as any;
        if(!s || out.some(y=>y.staff_id===x.staff_id)) return out;
        out.push({staff_id:x.staff_id,nama:x.snapshot_name||s.nama||"Petugas terkait",
          jabatan:s.jabatan||x.snapshot_role||"",kewajiban_belum_selesai:Number(x.snapshot_missed_days)||10});
        return out;
      },[]);
    }
    return json({ok:true,blocked:true,message:"Mode Blok Aplikasi LHI aktif karena terdapat petugas aktif yang mencapai hari ke-10 tanpa LHI sah.",
      incident_id:incident?.incident_id||null,noncompliant_staff},200,headers);
  } catch {
    return json({ok:false,message:"Status blokir belum dapat diverifikasi. Login ditahan sementara."},503,headers);
  }
});
