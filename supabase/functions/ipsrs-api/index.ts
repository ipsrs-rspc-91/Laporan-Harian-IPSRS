// BUILD-METADATA: 20261001-KATEGORI-SCROLL4 | rollback baseline 20261002-KATEGORI-SCROLL
import { withSupabase } from "npm:@supabase/server@1.8.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.116.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
// Stage 1 CORS preflight: pass the same cache header to withSupabase, which answers OPTIONS before this handler.
const cors={...corsHeaders,"Access-Control-Max-Age":"600"};
function out(b:any,s=200){return new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}})}
function range(month:string){const m=/^\d{4}-\d{2}$/.test(String(month||""))?month:new Date().toISOString().slice(0,7);const [y,mo]=m.split("-").map(Number);return{month:m,start:m+"-01",end:new Date(Date.UTC(y,mo,0)).toISOString().slice(0,10)}}
function label(r:string){return({KA_IPSRS:"KA IPSRS",ADMINISTRASI:"Administrasi IPSRS",KASIE:"Kasie",STAF:"Staf",PETUGAS_SHIFT:"Petugas Shift"} as any)[r]||r}
const SPARE_PART_NEW_CATEGORIES=new Set(["PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART BARU","PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART BARU","PERBAIKAN DENGAN PENGGANTIAN SPARE PART BARU"]);
const UNIT_NEW_CATEGORIES=new Set(["PENGGANTIAN ATAU PEMASANGAN UNIT /ALAT BARU (PERBAIKAN ATAU PASANG BARU)"]);
function materialUnitKind(p:any){
 const k=normalizeCategory(p?.SparePartUnitKind);
 return k==="UNIT"?"UNIT":k==="SPARE PART / MATERIAL"?"SPARE PART / MATERIAL":"";
}
function materialUnitStatus(p:any){
 const s=normalizeCategory(p?.SparePartUnitStatus);
 const allowed=new Set([
   "BARU",
   "KANIBAL",
   "DARI UNIT / RUANGAN LAIN",
   "LAINNYA"
 ]);
 return allowed.has(s) ? s : "";
}
// Canonical replacement categories. Historical aliases remain valid for old reports.
const MATERIAL_UNIT_REQUIRED_CATEGORIES=new Set([
 "PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT",
 "PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT",
 "PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL / UNIT",
 "PENGGANTIAN ATAU PEMASANGAN UNIT / ALAT",
 "PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART / MATERIAL",
 "PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART / MATERIAL",
 "PERBAIKAN DENGAN PENGGANTIAN SPARE PART / MATERIAL"
]);
function normalizeCategory(v:any){return String(v||"").trim().replace(/\s+/g," ").toUpperCase()}
function categoryKind(v:any){const n=normalizeCategory(v);return{spare:SPARE_PART_NEW_CATEGORIES.has(n),unit:UNIT_NEW_CATEGORIES.has(n)}}
function isNewCategory(v:any){
 const n=normalizeCategory(v);
 const k=categoryKind(n);
 return MATERIAL_UNIT_REQUIRED_CATEGORIES.has(n)||k.spare||k.unit;
}
// PERF 20260923: read paths use short-lived cache + selective payloads; date index added in Supabase migration.
const reportCache=new Map<string,{at:number,value:any}>(); const CACHE_TTL=5000;
const accessSettingCache=new Map<string,{at:number,value:string}>();
const editPermissionCache=new Map<string,{at:number,value:boolean}>();
const reportOwnerRoleCache=new Map<string,{at:number,value:string}>();
const PERMISSION_CACHE_TTL=15000;
const OWNER_ROLE_CACHE_TTL=15000;
function cacheGet(k:string){const x=reportCache.get(k);return x&&Date.now()-x.at<CACHE_TTL?x.value:null}
function cacheSet(k:string,v:any){reportCache.set(k,{at:Date.now(),value:v});return v}
function cacheClear(){reportCache.clear();accessSettingCache.clear();editPermissionCache.clear();reportOwnerRoleCache.clear()}
async function reportOwnerRole(db:any,staffId:string){
 const k=String(staffId||"").trim();
 if(!k)return "";
 const hit=reportOwnerRoleCache.get(k);
 if(hit&&Date.now()-hit.at<OWNER_ROLE_CACHE_TTL)return hit.value;
 const {data,error}=await db.from("staff").select("role,status").eq("staff_id",k).maybeSingle();
 if(error)throw error;
 const value=String(data?.status==="Aktif"?data?.role||"": "").toUpperCase();
 reportOwnerRoleCache.set(k,{at:Date.now(),value});
 return value;
}
function map(r:any,canEdit=false){return{CanEdit:!!canEdit,ID:r.report_id,report_id:r.report_id,StaffID:r.staff_id,Petugas:r.nama_snapshot||r.pelapor||r.created_by_name||r.staff_id,Nama:r.nama_snapshot||r.created_by_name||r.staff_id,Bidang:r.bidang_snapshot||"",Role:r.role_snapshot||"",RoleLabel:label(r.role_snapshot||""),Tanggal:r.tanggal,Pelapor:r.pelapor,Pukul:r.pukul,NoLK:r.nolk,Ruang:r.ruang,MasalahKegiatan:r.masalah_kegiatan,Tindakan:r.tindakan,Status:r.status,Keterangan:r.keterangan,Kategori:r.kategori,AreaKerja:r.area_kerja,Item:r.item,SparePartUnitKind:r.spare_part_unit_kind,SparePartUnitStatus:r.spare_part_unit_status,SparePartUnit:r.spare_part_unit,Type:r.type,Jumlah:r.jumlah,UnitStatus:r.unit_status||(r.spare_part_unit_kind==="UNIT"?r.spare_part_unit_status:null),UnitName:r.unit_name||(r.spare_part_unit_kind==="UNIT"?r.spare_part_unit:null),UnitType:r.unit_type||(r.spare_part_unit_kind==="UNIT"?r.type:null),UnitJumlah:r.unit_jumlah??(r.spare_part_unit_kind==="UNIT"?r.jumlah:null),SparePartMaterialStatus:r.spare_part_material_status||(r.spare_part_unit_kind==="SPARE PART / MATERIAL"?r.spare_part_unit_status:null),SparePartMaterial:r.spare_part_material||(r.spare_part_unit_kind==="SPARE PART / MATERIAL"?r.spare_part_unit:null),SparePartMaterialType:r.spare_part_material_type||(r.spare_part_unit_kind==="SPARE PART / MATERIAL"?r.type:null),SparePartMaterialJumlah:r.spare_part_material_jumlah??(r.spare_part_unit_kind==="SPARE PART / MATERIAL"?r.jumlah:null),created_at:r.created_at,updated_at:r.updated_at,created_by_username:r.created_by_username,created_by_staff_id:r.created_by_staff_id,created_by_name:r.created_by_name,created_by_role:r.created_by_role,updated_by_staff_id:r.updated_by_staff_id,updated_by_name:r.updated_by_name,updated_by_role:r.updated_by_role,version:r.version}}
const REPORT_EDITABLE_FIELDS=["Tanggal","Pelapor","Pukul","NoLK","Ruang","MasalahKegiatan","Tindakan","Status","Keterangan","Kategori","AreaKerja","Item","SparePartUnitKind","SparePartUnitStatus","SparePartUnit","Type","Jumlah","UnitStatus","UnitName","UnitType","UnitJumlah","SparePartMaterialStatus","SparePartMaterial","SparePartMaterialType","SparePartMaterialJumlah","JadwalKerja","RencanaKegiatan","TargetPekerjaan","RealisasiPekerjaan","HasilPencapaian","StatusPencapaian","Kendala","TindakLanjut","WaktuMulai","WaktuSelesai"];
async function accessSetting(db:any,key:string,def="NONAKTIF"){
 const k=String(key||"");
 const hit=accessSettingCache.get(k);
 if(hit&&Date.now()-hit.at<PERMISSION_CACHE_TTL)return hit.value;
 const {data,error}=await db.from("access_settings").select("value").eq("key",k).maybeSingle();
 if(error)throw error;
 const value=String(data?.value||def).toUpperCase();
 accessSettingCache.set(k,{at:Date.now(),value});
 return value;
}
function effectivePayload(old:any,p:any){const e:any={Tanggal:old.tanggal,Pelapor:old.pelapor,Pukul:old.pukul,NoLK:old.nolk,Ruang:old.ruang,MasalahKegiatan:old.masalah_kegiatan,Tindakan:old.tindakan,Status:old.status,Keterangan:old.keterangan,Kategori:old.kategori,AreaKerja:old.area_kerja,Item:old.item,SparePartUnitKind:old.spare_part_unit_kind,SparePartUnitStatus:old.spare_part_unit_status,SparePartUnit:old.spare_part_unit,Type:old.type,Jumlah:old.jumlah,UnitStatus:old.unit_status||(old.spare_part_unit_kind==="UNIT"?old.spare_part_unit_status:""),UnitName:old.unit_name||(old.spare_part_unit_kind==="UNIT"?old.spare_part_unit:""),UnitType:old.unit_type||(old.spare_part_unit_kind==="UNIT"?old.type:""),UnitJumlah:old.unit_jumlah??(old.spare_part_unit_kind==="UNIT"?old.jumlah:null),SparePartMaterialStatus:old.spare_part_material_status||(old.spare_part_unit_kind==="SPARE PART / MATERIAL"?old.spare_part_unit_status:""),SparePartMaterial:old.spare_part_material||(old.spare_part_unit_kind==="SPARE PART / MATERIAL"?old.spare_part_unit:""),SparePartMaterialType:old.spare_part_material_type||(old.spare_part_unit_kind==="SPARE PART / MATERIAL"?old.type:""),SparePartMaterialJumlah:old.spare_part_material_jumlah??(old.spare_part_unit_kind==="SPARE PART / MATERIAL"?old.jumlah:null),JadwalKerja:old.jadwal_kerja,RencanaKegiatan:old.rencana_kegiatan,TargetPekerjaan:old.target_pekerjaan,RealisasiPekerjaan:old.realisasi_pekerjaan,HasilPencapaian:old.hasil_pencapaian,StatusPencapaian:old.status_pencapaian,Kendala:old.kendala,TindakLanjut:old.tindak_lanjut,WaktuMulai:old.waktu_mulai,WaktuSelesai:old.waktu_selesai};for(const k of REPORT_EDITABLE_FIELDS)if(Object.prototype.hasOwnProperty.call(p,k))e[k]=p[k];return e;}
function validateReportPayload(p:any){for(const k of ["Kategori","AreaKerja","Item"])if(String(p[k]||"")==="__ADD_NEW__")return k+" belum boleh menggunakan penanda tambah baru.";const miss=["Tanggal","Item"].filter(k=>!String(p[k]??"").trim());if(!String(p.MasalahKegiatan??"").trim()&&!String(p.RealisasiPekerjaan??"").trim())miss.push("MasalahKegiatan atau RealisasiPekerjaan");if(miss.length)return miss[0]+" wajib diisi.";const unitComplete=!!(String(p.UnitStatus??"").trim()&&String(p.UnitName??"").trim()&&String(p.UnitType??"").trim()&&String(p.UnitJumlah??"").trim());
 const spareComplete=!!(String(p.SparePartMaterialStatus??"").trim()&&String(p.SparePartMaterial??"").trim()&&String(p.SparePartMaterialType??"").trim()&&String(p.SparePartMaterialJumlah??"").trim());
 const unitPartial=!!(String(p.UnitStatus??"").trim()||String(p.UnitName??"").trim()||String(p.UnitType??"").trim()||String(p.UnitJumlah??"").trim());
 const sparePartial=!!(String(p.SparePartMaterialStatus??"").trim()||String(p.SparePartMaterial??"").trim()||String(p.SparePartMaterialType??"").trim()||String(p.SparePartMaterialJumlah??"").trim());
 const legacyKind=materialUnitKind(p);
 const legacyComplete=!!(legacyKind&&String(p.SparePartUnitStatus??"").trim()&&String(p.SparePartUnit??"").trim()&&String(p.Type??"").trim()&&String(p.Jumlah??"").trim());
 const anySide=unitComplete||spareComplete||legacyComplete;
 if(unitPartial&&!unitComplete)return"Data UNIT belum lengkap.";
 if(sparePartial&&!spareComplete)return"Data SPARE PART / MATERIAL belum lengkap.";
 if(isNewCategory(p.Kategori)&&!anySide)return"Data SPARE PART / MATERIAL / UNIT wajib diisi untuk laporan baru.";
 if(!anySide&&legacyKind)return"Data SPARE PART / MATERIAL / UNIT belum lengkap.";
 return null;}
async function canViewReport(db:any,s:any,r:any){
 if(!r)return false;
 if(!s||!s.staff_id)return false;
 if(s.role==="KA_IPSRS")return true;
 if(r.staff_id===s.staff_id)return true;
 if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS")return false;
 if((await reportOwnerRole(db,r.staff_id))==="KA_IPSRS")return false;
 return (await accessSetting(db,"LAPORAN_TIM","NONAKTIF"))==="AKTIF";
}
async function canEditReport(db:any,s:any,r:any){
 if(!r)return{ok:false,reason:"Laporan tidak ditemukan."};
 if(s.role==="KA_IPSRS")return{ok:true};
 if(r.staff_id===s.staff_id)return{ok:true};
 if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS")return{ok:false,reason:"Laporan KA IPSRS hanya dapat diedit oleh KA IPSRS."};
 if((await reportOwnerRole(db,r.staff_id))==="KA_IPSRS")return{ok:false,reason:"Laporan KA IPSRS hanya dapat diedit oleh KA IPSRS."};
 if(s.role==="ADMINISTRASI"){
   if((await accessSetting(db,"ADMINISTRASI_EDIT","NONAKTIF"))==="AKTIF")return{ok:true};
   return{ok:false,reason:"Administrasi tidak memiliki izin edit laporan staf lain saat ADMINISTRASI_EDIT NONAKTIF."};
 }
 const {data,error}=await db.from("edit_permissions")
   .select("permission_id")
   .eq("granted_to_staff_id",s.staff_id)
   .eq("target_staff_id",r.staff_id)
   .eq("is_active",true)
   .limit(1)
   .maybeSingle();
 if(error)throw error;
 return data?{ok:true}:{ok:false,reason:"Anda tidak memiliki hak untuk mengedit laporan ini."};
}
async function bulkOwnerRoles(db:any,rows:any[]){
 const ids=[...new Set((rows||[]).map((r:any)=>String(r.staff_id||'').trim()).filter(Boolean))];
 const m=new Map<string,string>();
 if(!ids.length)return m;
 const {data,error}=await db.from("staff").select("staff_id,role,status").in("staff_id",ids);
 if(error)throw error;
 for(const x of data||[])if(String(x.status||'').toLowerCase()==='aktif')m.set(String(x.staff_id),String(x.role||'').toUpperCase());
 return m;
}
async function reportPolicyBatch(db:any,s:any,rows:any[]){
 const ownOnly=(rows||[]).every((r:any)=>r.staff_id===s.staff_id);
 const ownerRoles=(s.role==="KA_IPSRS"||ownOnly)?new Map<string,string>():await bulkOwnerRoles(db,rows);
 const teamAccess=s.role==="KA_IPSRS"||ownOnly||await accessSetting(db,"LAPORAN_TIM","NONAKTIF")==="AKTIF";
 let adminEdit=false;
 const permissionTargets=new Set<string>();
 if(s.role==="ADMINISTRASI")adminEdit=await accessSetting(db,"ADMINISTRASI_EDIT","NONAKTIF")==="AKTIF";
 else if(s.role!=="KA_IPSRS"){
   const {data,error}=await db.from("edit_permissions").select("target_staff_id").eq("granted_to_staff_id",s.staff_id).eq("is_active",true);
   if(error)throw error;
   for(const p of data||[])permissionTargets.add(String(p.target_staff_id||''));
 }
 const visible=new Set<string>(),editable=new Set<string>();
 for(const r of rows||[]){
   const id=String(r.report_id||'');
   const ownerId=String(r.staff_id||'');
   const own=r.staff_id===s.staff_id;
   const ownerIsKa=String(r.role_snapshot||'').toUpperCase()==="KA_IPSRS"||ownerRoles.get(ownerId)==="KA_IPSRS";
   if(s.role==="KA_IPSRS"||(own&&!ownerIsKa)||(!ownerIsKa&&teamAccess))visible.add(id);
   if(s.role==="KA_IPSRS"||(own&&!ownerIsKa)||(adminEdit&&!ownerIsKa)||(!ownerIsKa&&permissionTargets.has(ownerId)))editable.add(id);
 }
 return{visible,editable};
}
function dbp(p:any){const n=(v:any)=>v===""||v==null?null:Number(v);const unitComplete=!!(p.UnitStatus&&p.UnitName&&p.UnitType&&String(p.UnitJumlah??"").trim());const spareComplete=!!(p.SparePartMaterialStatus&&p.SparePartMaterial&&p.SparePartMaterialType&&String(p.SparePartMaterialJumlah??"").trim());const legacyKind=unitComplete&&!spareComplete?"UNIT":spareComplete&&!unitComplete?"SPARE PART / MATERIAL":"";const legacy=legacyKind==="UNIT"?{status:p.UnitStatus,name:p.UnitName,type:p.UnitType,qty:p.UnitJumlah}:legacyKind==="SPARE PART / MATERIAL"?{status:p.SparePartMaterialStatus,name:p.SparePartMaterial,type:p.SparePartMaterialType,qty:p.SparePartMaterialJumlah}:null;return{tanggal:p.Tanggal||null,pelapor:p.Pelapor||null,pukul:p.Pukul||null,nolk:p.NoLK||null,ruang:p.Ruang||null,masalah_kegiatan:p.MasalahKegiatan||null,tindakan:p.Tindakan||null,status:p.Status||null,keterangan:p.Keterangan||null,kategori:p.Kategori||null,area_kerja:p.AreaKerja||null,item:p.Item||null,spare_part_unit_kind:legacyKind||null,spare_part_unit_status:legacy?.status||null,spare_part_unit:legacy?.name||null,type:legacy?.type||null,jumlah:n(legacy?.qty),unit_status:unitComplete?p.UnitStatus:null,unit_name:unitComplete?p.UnitName:null,unit_type:unitComplete?p.UnitType:null,unit_jumlah:n(unitComplete?p.UnitJumlah:null),spare_part_material_status:spareComplete?p.SparePartMaterialStatus:null,spare_part_material:spareComplete?p.SparePartMaterial:null,spare_part_material_type:spareComplete?p.SparePartMaterialType:null,spare_part_material_jumlah:n(spareComplete?p.SparePartMaterialJumlah:null),jadwal_kerja:p.JadwalKerja||null,rencana_kegiatan:p.RencanaKegiatan||null,target_pekerjaan:p.TargetPekerjaan||null,realisasi_pekerjaan:p.RealisasiPekerjaan||null,hasil_pencapaian:p.HasilPencapaian||null,status_pencapaian:p.StatusPencapaian||null,kendala:p.Kendala||null,tindak_lanjut:p.TindakLanjut||null,waktu_mulai:p.WaktuMulai||null,waktu_selesai:p.WaktuSelesai||null}}
async function staff(ctx:any,req?:Request){
 let uid=ctx.userClaims?.sub;
 let email=String(ctx.userClaims?.email||"").toLowerCase();
 if(!uid&&req){
   const h=req.headers.get("authorization")||"";
   const m=h.match(/^Bearer\s+(.+)$/i);
   if(m){
     const g=await ctx.supabaseAdmin.auth.getUser(m[1]);
     if(!g.error&&g.data?.user){uid=g.data.user.id;email=String(g.data.user.email||"").toLowerCase();}
   }
 }
 if(!uid)throw Error("Sesi tidak valid.");
 let {data,error}=await ctx.supabaseAdmin.from("staff").select("staff_id,nama,jabatan,role,bidang,status,auth_user_id,last_login_at,last_seen_at,last_login_device,lhi_manual_unblock_until").eq("auth_user_id",uid).maybeSingle();
 if(error)throw error;
 if(!data){
   const email=String(ctx.userClaims?.email||"").toLowerCase();
   const local=email.split("@")[0];
   const staffId=local==="kaipsrs"?"KAIPSRS":local;
   const r=await ctx.supabaseAdmin.from("staff").select("staff_id,nama,jabatan,role,bidang,status,auth_user_id,last_login_at,last_seen_at,last_login_device").eq("staff_id",staffId).maybeSingle();
   if(r.error)throw r.error;
   data=r.data;
   if(data)await ctx.supabaseAdmin.from("staff").update({auth_user_id:uid}).eq("staff_id",data.staff_id);
 }
 if(!data)throw Error("Akun Supabase belum terhubung ke data petugas.");

 // LHI DISCIPLINE GATE:
 // Setiap petugas aktif yang tidak mempunyai satu pun LHI pada masing-masing
 // dari 7 hari kalender terakhir akan otomatis diblokir. Perhitungan memakai
 // tanggal Asia/Jakarta dan laporan yang belum dihapus.
 const manualUnblockUntil=data.lhi_manual_unblock_until?new Date(data.lhi_manual_unblock_until).getTime():0;
 const manualUnblockActive=manualUnblockUntil>0&&manualUnblockUntil>Date.now();
 if((String(data.status).toLowerCase()==="aktif"||String(data.status).toUpperCase()==="DIBLOKIR_LHI_7_HARI")&&!manualUnblockActive){
   const todayStr=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());
   const today=new Date(todayStr+"T00:00:00Z");
   const dates:string[]=[];
   for(let i=1;i<=7;i++){
     const d=new Date(today);
     d.setUTCDate(d.getUTCDate()-i);
     dates.push(d.toISOString().slice(0,10));
   }
   const start=dates[dates.length-1], end=dates[0];
   const {data:lhis,error:lhiError}=await ctx.supabaseAdmin
     .from("reports")
     .select("tanggal")
     .eq("staff_id",data.staff_id)
     .is("deleted_at",null)
     .gte("tanggal",start)
     .lte("tanggal",end);
   if(lhiError)throw lhiError;
   const filled=new Set((lhis||[]).map((r:any)=>String(r.tanggal||"").slice(0,10)));
   const missed=dates.filter(x=>!filled.has(x));
   if(missed.length===7){
     const previousStatus=data.status;
     const {error:blockError}=await ctx.supabaseAdmin
       .from("staff")
       .update({status:"DIBLOKIR_LHI_7_HARI"})
       .eq("staff_id",data.staff_id)
       .eq("status","Aktif");
     if(blockError)throw blockError;
     await ctx.supabaseAdmin.from("audit_log").insert({
       username:"SYSTEM",
       staff_id:data.staff_id,
       action:"BLOCK_LOGIN_LHI_7_HARI",
       report_id:null,
       keterangan:"Akun diblokir otomatis karena tidak mengisi LHI selama 7 hari kalender terakhir.",
       field_changed:"status",
       old_value:previousStatus,
       new_value:"DIBLOKIR_LHI_7_HARI"
     });
     data.status="DIBLOKIR_LHI_7_HARI";
   }
 }
 if(String(data.status).toUpperCase()==="DIBLOKIR_LHI_7_HARI"&&!manualUnblockActive){
   throw Error("Anda tidak disiplin mengisi laporan selama 7 hari.");
 }
 if(String(data.status).toLowerCase()!=="aktif")throw Error("Akun petugas tidak aktif.");
 return data
}
async function audit(db:any,s:any,a:string,id:string,k:string,v:any={}){
 const row={username:s.staff_id,staff_id:s.staff_id,action:a,report_id:id,keterangan:k,field_changed:v.field_changed||null,old_value:v.old_value??null,new_value:v.new_value??null,version_before:v.version_before??null,version_after:v.version_after??null};
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const {error}=await db.from("audit_log").insert(row);
   if(!error)return true;
   if(attempt===2)console.error("[AUDIT_LOG_FAILED]",{action:a,report_id:id,staff_id:s.staff_id,error:String(error.message||error)});
  }catch(e){
   if(attempt===2)console.error("[AUDIT_LOG_EXCEPTION]",{action:a,report_id:id,staff_id:s.staff_id,error:String(e)});
  }
  if(attempt===1)await new Promise(resolve=>setTimeout(resolve,150));
 }
 return false;
}
async function act(ctx:any,a:string,d:any,req?:Request){const db=ctx.supabaseAdmin,s=await staff(ctx,req);
if(a==="apiWhoAmI"){await db.from("staff").update({last_seen_at:new Date().toISOString()}).eq("staff_id",s.staff_id);return{ok:true,token:d.token||"",username:s.staff_id,staff_id:s.staff_id,nama:s.nama,role:s.role,bidang:s.bidang,status:s.status,role_label:label(s.role)};}
if(a==="apiGetSystemInfo"){
 if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat melihat informasi sistem."};
 const {error}=await db.from("staff").select("staff_id").eq("staff_id",s.staff_id).maybeSingle();
 if(error)throw error;
 return{ok:true,data:{
   system_version:"20261001-KATEGORI-SCROLL4",
   frontend_build:"20261001-KATEGORI-SCROLL4",
   api_version:"ipsrs-api v81",
   database_migration:"20260928092227",
   environment:"PRODUCTION",
   git_commit:"628ca81681620769821fe6491ba2aac32d53310d",
   service_worker:"lhi-shell-v20261001-kategori-scroll4",
   api_status:"ONLINE",
   database_status:"CONNECTED",
   last_deployment:"2026-10-02"
 }};
}
if(a==="apiRecordLogin"){
 const now=new Date().toISOString();
 const ua=String(req?.headers.get("user-agent")||"").trim().slice(0,500);
 const platform=String(req?.headers.get("sec-ch-ua-platform")||"").replace(/^"|"$/g,"").trim();
 const device=[platform,ua].filter(Boolean).join(" | ").slice(0,500)||"Perangkat tidak diketahui";
 const {error}=await db.from("staff").update({last_login_at:now,last_seen_at:now,last_login_device:device}).eq("staff_id",s.staff_id);
 if(error)throw error;
 await audit(db,s,"LOGIN",null,"Login berhasil",{new_value:device});
 return{ok:true,last_login_at:now};
}
if(a==="apiHeartbeat"){
 const now=new Date().toISOString();
 const {error}=await db.from("staff").update({last_seen_at:now}).eq("staff_id",s.staff_id);
 if(error)throw error;
 return{ok:true,last_seen_at:now};
}
if(a==="apiGetOnlineUsers"){
 if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat melihat status online dan login terakhir."};
 const {data,error}=await db.from("staff").select("staff_id,nama,jabatan,role,bidang,status,last_login_at,last_seen_at,last_login_device").eq("status","Aktif").order("nama");
 if(error)throw error;
 const now=Date.now(), threshold=3*60*1000;
 return{ok:true,server_time:new Date(now).toISOString(),online_threshold_seconds:180,data:(data||[]).map((x:any)=>{
   const seen=x.last_seen_at?Date.parse(x.last_seen_at):NaN;
   const online=Number.isFinite(seen)&&(now-seen)<=threshold;
   return{staff_id:x.staff_id,nama:x.nama,jabatan:x.jabatan||"",role:x.role,bidang:x.bidang||"",role_label:label(x.role),online,last_seen_at:x.last_seen_at||null,last_login_at:x.last_login_at||null,last_login_device:x.last_login_device||null};
 }).sort((a:any,b:any)=>{const onlineDiff=Number(b.online)-Number(a.online);if(onlineDiff)return onlineDiff;const aLogin=a.last_login_at?Date.parse(a.last_login_at):NaN;const bLogin=b.last_login_at?Date.parse(b.last_login_at):NaN;if(Number.isFinite(aLogin)||Number.isFinite(bLogin)){if(!Number.isFinite(aLogin))return 1;if(!Number.isFinite(bLogin))return -1;if(bLogin!==aLogin)return bLogin-aLogin;}return String(a.nama||"").localeCompare(String(b.nama||""),"id")})};
}
if(a==="apiLogout"){await db.from("staff").update({last_seen_at:new Date(Date.now()-4*60*1000).toISOString()}).eq("staff_id",s.staff_id);return{ok:true};}
if(a==="apiListStaff"){const {data,error}=await db.from("staff_dropdown").select("staff_id,nama,jabatan,role,bidang,status");if(error)throw error;return{ok:true,data:(data||[]).map((x:any)=>({...x,role_label:label(x.role)}))}}
if(a==="apiGetDisciplineWarning"){const {data,error}=await db.from("staff").select("staff_id,nama").eq("status","DIBLOKIR_LHI_7_HARI").order("nama");if(error)throw error;return{ok:true,data:(data||[]).map((x:any)=>({staff_id:x.staff_id,nama:x.nama}))}}
if(a==="apiGetReports"){const mode=String(d.viewMode||"daftar").toLowerCase()==="saya"?"saya":"daftar",z=range(d.bulan),ck=`reports:${mode}:${z.month}:${d.staffIdFilter||""}:${d.bidangFilter||""}:${s.staff_id}`,hit=cacheGet(ck);if(hit)return hit;let q=db.from("reports").select("report_id,staff_id,nama_snapshot,bidang_snapshot,role_snapshot,tanggal,pelapor,pukul,nolk,ruang,masalah_kegiatan,tindakan,status,keterangan,kategori,area_kerja,item,spare_part_unit_kind,spare_part_unit_status,spare_part_unit,type,jumlah,unit_status,unit_name,unit_type,unit_jumlah,spare_part_material_status,spare_part_material,spare_part_material_type,spare_part_material_jumlah,created_at,updated_at,created_by_username,created_by_staff_id,created_by_name,created_by_role,updated_by_staff_id,updated_by_name,updated_by_role,version").is("deleted_at",null).gte("tanggal",z.start).lte("tanggal",z.end).order("tanggal",{ascending:false}).order("pukul",{ascending:false});if(mode==="saya"){q=q.eq("staff_id",s.staff_id);}else if(d.staffIdFilter){q=q.eq("staff_id",d.staffIdFilter);}if(d.bidangFilter)q=q.eq("bidang_snapshot",d.bidangFilter);const {data,error}=await q;if(error)throw error;const rows=data||[];const policy=await reportPolicyBatch(db,s,rows);const visible=[];for(const r of rows){if(policy.visible.has(String(r.report_id)))visible.push(map(r,policy.editable.has(String(r.report_id))));}return cacheSet(ck,{ok:true,data:visible})}
if(a==="apiGetOverdueReports"){const cutoff=String(d.cutoffDate||"").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))return{ok:false,msg:"Tanggal batas pengingat tidak valid."};const fields="report_id,staff_id,nama_snapshot,bidang_snapshot,role_snapshot,tanggal,pelapor,pukul,nolk,ruang,masalah_kegiatan,tindakan,status,keterangan,kategori,area_kerja,item,spare_part_unit_kind,spare_part_unit_status,spare_part_unit,type,jumlah,unit_status,unit_name,unit_type,unit_jumlah,spare_part_material_status,spare_part_material,spare_part_material_type,spare_part_material_jumlah,created_at,updated_at,created_by_username,created_by_staff_id,created_by_name,created_by_role,updated_by_staff_id,updated_by_name,updated_by_role,version";const {data,error}=await db.from("reports").select(fields).is("deleted_at",null).lte("tanggal",cutoff).order("tanggal",{ascending:false}).order("pukul",{ascending:false}).limit(5000);if(error)throw error;const rows=data||[];const policy=await reportPolicyBatch(db,s,rows);const visible=[];for(const r of rows){if(policy.visible.has(String(r.report_id)))visible.push(map(r,policy.editable.has(String(r.report_id))));}return{ok:true,data:visible,cutoffDate:cutoff}}
if(a==="apiGetReportById"){const {data,error}=await db.from("reports").select("*").eq("report_id",d.reportId).is("deleted_at",null).maybeSingle();if(error)throw error;if(!data)return{ok:false,msg:"Laporan tidak ditemukan."};if(!(await canViewReport(db,s,data)))return{ok:false,msg:"Anda tidak memiliki akses untuk melihat laporan ini."};const ce=await canEditReport(db,s,data);return{ok:true,data:map(data,ce.ok)}}
if(a==="apiCreateReport"){const p=d.payload||{};const validation=validateReportPayload(p);if(validation)return{ok:false,msg:validation};const id=`RPT${Date.now()}-${crypto.randomUUID().replaceAll("-","").slice(0,6).toUpperCase()}`;const row={...dbp(p),report_id:id,staff_id:s.staff_id,nama_snapshot:s.nama,bidang_snapshot:s.bidang,role_snapshot:s.role,created_by_username:s.staff_id,created_by_staff_id:s.staff_id,created_by_name:s.nama,created_by_role:s.role,version:1};const {data,error}=await db.from("reports").insert(row).select("*").single();if(error)throw error;await audit(db,s,"CREATE_REPORT",id,"Membuat laporan baru",{version_after:1});cacheClear();await db.from("staff").update({last_seen_at:new Date().toISOString()}).eq("staff_id",s.staff_id);return{ok:true,report_id:id,data:map(data,true)}}
if(a==="apiUpdateReport"){const {data:old,error:e}=await db.from("reports").select("*").is("deleted_at",null).eq("report_id",d.reportId).maybeSingle();if(e)throw e;if(!old)return{ok:false,msg:"Laporan tidak ditemukan."};const permission=await canEditReport(db,s,old);if(!permission.ok){await audit(db,s,"UPDATE_REPORT_DENIED",d.reportId,permission.reason||"Edit ditolak");return{ok:false,msg:permission.reason}}const effective=effectivePayload(old,d.payload||{});const validation=validateReportPayload(effective);if(validation)return{ok:false,msg:validation};const patch=dbp(effective),v=(old.version||1)+1;const {data:u,error}=await db.from("reports").update({...patch,updated_by_staff_id:s.staff_id,updated_by_name:s.nama,updated_by_role:s.role,version:v}).eq("report_id",d.reportId).select("*").single();if(error)throw error;await db.from("report_history").insert({report_id:d.reportId,edited_by_username:s.staff_id,edited_by_staff_id:s.staff_id,data_before_json:map(old),data_after_json:map(u)});await audit(db,s,"UPDATE_REPORT",d.reportId,old.staff_id===s.staff_id?"Mengubah laporan":`Diedit oleh ${s.role} (${s.nama}), pemilik: ${old.nama_snapshot||old.staff_id}`,{version_before:old.version||1,version_after:v});cacheClear();return{ok:true,msg:"Laporan berhasil diperbarui.",data:map(u,true)}}
if(a==="apiDeleteReport"){
 const reportId=String(d.reportId||"").trim();
 const reason=String(d.reason||"").trim();
 if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat menghapus laporan."};
 if(!reportId)return{ok:false,msg:"ID laporan wajib diisi."};
 if(reason.length<5)return{ok:false,msg:"Alasan penghapusan wajib diisi (minimal 5 karakter)."};
 if(reason.length>500)return{ok:false,msg:"Alasan penghapusan maksimal 500 karakter."};
 const {data:old,error:e}=await db.from("reports").select("*").eq("report_id",reportId).is("deleted_at",null).maybeSingle();
 if(e)throw e;
 if(!old)return{ok:false,msg:"Laporan tidak ditemukan atau sudah dihapus."};
 const {data:deleted,error:de}=await db.from("reports").update({deleted_at:new Date().toISOString(),deleted_by_staff_id:s.staff_id,deleted_by_name:s.nama,delete_reason:reason,updated_at:new Date().toISOString(),updated_by_staff_id:s.staff_id,updated_by_name:s.nama,updated_by_role:s.role,version:(old.version||1)+1}).eq("report_id",reportId).is("deleted_at",null).select("*").single();
 if(de)throw de;
 await audit(db,s,"DELETE_REPORT",reportId,reason,{version_before:old.version||1,version_after:deleted.version||((old.version||1)+1),old_value:old.delete_reason||"",new_value:reason});
 cacheClear();
 return{ok:true,msg:"Laporan berhasil dihapus dan disimpan sebagai arsip.",report_id:reportId};
}
if(a==="apiGetReportHistory"){const {data:rr,error:re}=await db.from("reports").select("*").is("deleted_at",null).eq("report_id",d.reportId).maybeSingle();if(re)throw re;if(s.role!=="KA_IPSRS"&&s.role!=="ADMINISTRASI")return{ok:false,msg:"Hanya KA IPSRS atau Administrasi yang dapat melihat riwayat perubahan."};if(!rr)return{ok:false,msg:"Laporan tidak ditemukan."};if(!(await canViewReport(db,s,rr)))return{ok:false,msg:"Anda tidak memiliki akses untuk melihat riwayat laporan ini."};const {data,error}=await db.from("report_history").select("*").eq("report_id",d.reportId).order("edited_at",{ascending:false});if(error)throw error;return{ok:true,data:(data||[]).map((h:any)=>({edited_at:h.edited_at,edited_by_username:h.edited_by_username||"-",edited_by_staff_id:h.edited_by_staff_id||"-",before:h.data_before_json||{},after:h.data_after_json||{}}))}}
if(a==="apiGetAuditLog"){
 if(s.role!=="KA_IPSRS"&&s.role!=="ADMINISTRASI")return{ok:false,msg:"Anda tidak memiliki akses audit log."};
 if(d.reportId){
  const {data:rr,error:re}=await db.from("reports").select("report_id,staff_id,role_snapshot,deleted_at").eq("report_id",d.reportId).maybeSingle();
  if(re)throw re;if(!rr)return{ok:false,msg:"Laporan tidak ditemukan."};
  if(!(await canViewReport(db,s,rr)))return{ok:false,msg:"Anda tidak memiliki akses audit log laporan ini."};
  const {data,error}=await db.from("audit_log").select("*").eq("report_id",d.reportId).order("timestamp",{ascending:false});
  if(error)throw error;return{ok:true,data:data||[]};
 }
 let q=db.from("audit_log").select("*").order("timestamp",{ascending:false});
 const {data:logs,error}=await q;if(error)throw error;
 if(s.role==="KA_IPSRS")return{ok:true,data:logs||[]};
 // Administrasi must not receive audit entries belonging to KA IPSRS reports.
 // Edge Function uses service-role DB access, so enforce the privacy rule here
 // instead of relying only on Postgres RLS.
 const ids=[...new Set((logs||[]).map((x:any)=>String(x.report_id||"").trim()).filter(Boolean))];
 const kaIds=new Set<string>();
 if(ids.length){
  const {data:kaRows,error:ke}=await db.from("reports").select("report_id,staff_id,role_snapshot").in("report_id",ids);
  if(ke)throw ke;
  for(const r of kaRows||[])if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS"||String(r.staff_id||"")==="KAIPSRS"||(await reportOwnerRole(db,r.staff_id))==="KA_IPSRS")kaIds.add(String(r.report_id));
 }
 return{ok:true,data:(logs||[]).filter((x:any)=>!x.report_id||!kaIds.has(String(x.report_id)))};
}
if(a==="apiGetStaffMonitoring"){const z=range(d.bulan),ck=`monitor:${s.staff_id}:${z.month}:${d.tanggal||""}:${d.staffIdFilter||""}`,hit=cacheGet(ck);if(hit)return hit;const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());let tanggal=String(d.tanggal||today);if(!tanggal.startsWith(z.month))tanggal=z.month===today.slice(0,7)?today:z.start;let requiredDays=0;if(z.month<today.slice(0,7))requiredDays=Math.floor((Date.parse(z.end)-Date.parse(z.start))/86400000)+1;else if(z.month===today.slice(0,7))requiredDays=Math.floor((Date.parse(today)-Date.parse(z.start))/86400000)+1;let staffQ=db.from("staff").select("staff_id,nama,jabatan,role,bidang,status").eq("status","Aktif").order("nama");if(d.staffIdFilter)staffQ=staffQ.eq("staff_id",d.staffIdFilter);const {data:ss,error:se}=await staffQ;if(se)throw se;let reportQ=db.from("reports").select("staff_id,tanggal").is("deleted_at",null).gte("tanggal",z.start).lte("tanggal",z.end);if(d.staffIdFilter)reportQ=reportQ.eq("staff_id",d.staffIdFilter);const {data:rawReports,error:re}=await reportQ;if(re)throw re;const by:any={},todayCount:any={},total:any={};for(const r of rawReports||[]){(by[r.staff_id]??=new Set()).add(r.tanggal);total[r.staff_id]=(total[r.staff_id]||0)+1;if(r.tanggal===tanggal)todayCount[r.staff_id]=(todayCount[r.staff_id]||0)+1}const result={ok:true,bulan:z.month,tanggal,bulan_berjalan:z.month===today.slice(0,7),hari_wajib_terhitung:requiredDays,data:(ss||[]).map((x:any)=>{const set=by[x.staff_id]||new Set(),done=[...set].filter((day:any)=>day>=z.start&&day<=z.end&&(z.month<today.slice(0,7)||day<=today)).length;let statusHari="BELUM_ISI";if(tanggal>today)statusHari="BELUM_TERJADI";else if(todayCount[x.staff_id])statusHari="SUDAH_ISI";return{staff_id:x.staff_id,nama:x.nama,jabatan:x.jabatan||"",role:x.role,role_label:label(x.role),bidang:x.bidang||"",status:x.status||"Aktif",status_hari_ini:statusHari,laporan_hari_ini:todayCount[x.staff_id]||0,sudah_isi_hari_bulan_ini:done,belum_isi_hari_bulan_ini:Math.max(0,requiredDays-done),total_transaksi_bulan_ini:total[x.staff_id]||0}})};return cacheSet(ck,result)}
if(a==="apiGetStaffDailyStatus"){const z=range(d.bulan),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());const {data:raw,error}=await db.from("reports").select("*").is("deleted_at",null).eq("staff_id",d.staffId).gte("tanggal",z.start).lte("tanggal",z.end).order("tanggal");if(error)throw error;const rr:any[]=[];for(const r of raw||[]){if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS"||String(r.staff_id||"")==="KAIPSRS")continue;if(await canViewReport(db,s,r))rr.push(r);}const n=Math.floor((Date.parse(z.end)-Date.parse(z.start))/86400000)+1,cal=[];for(let i=0;i<n;i++){const day=new Date(Date.parse(z.start)+i*86400000).toISOString().slice(0,10),c=(rr||[]).filter((r:any)=>r.tanggal===day).length;cal.push({tanggal:day,status:c?"SUDAH_ISI":day>today?"BELUM_TERJADI":"BELUM_ISI",jumlah:c})}return{ok:true,kalender:cal,laporan:await Promise.all((rr||[]).map(async(r:any)=>map(r,(await canEditReport(db,s,r)).ok)))}}
if(a==="apiGetMonthlyRecap"){const z=range(d.bulan),ck=`monthly:${s.staff_id}:${z.month}:${d.staffIdFilter||""}`,hit=cacheGet(ck);if(hit)return hit;const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date()),eff=z.month===today.slice(0,7)?today:z.end;let staffQ=db.from("staff").select("staff_id,nama,jabatan,role,bidang,status").eq("status","Aktif").order("staff_id");if(d.staffIdFilter)staffQ=staffQ.eq("staff_id",d.staffIdFilter);const {data:ss,error:se}=await staffQ;if(se)throw se;let reportQ=db.from("reports").select("staff_id,tanggal").is("deleted_at",null).gte("tanggal",z.start).lte("tanggal",eff);if(d.staffIdFilter)reportQ=reportQ.eq("staff_id",d.staffIdFilter);const {data:rawReports,error:re}=await reportQ;if(re)throw re;const visibleReports=rawReports||[];const req=Math.floor((Date.parse(eff)-Date.parse(z.start))/86400000)+1,sets:any={},tx:any={};for(const x of ss||[])sets[x.staff_id]=new Set();for(const r of visibleReports){(sets[r.staff_id]??=new Set()).add(r.tanggal);tx[r.staff_id]=(tx[r.staff_id]||0)+1}const bm:any={},per=(ss||[]).map((x:any)=>{const n=(sets[x.staff_id]||new Set()).size,k=x.bidang||"-";(bm[k]??={bidang:k,jumlah_staf:0,hari_isi:0,total_transaksi:0});bm[k].jumlah_staf++;bm[k].hari_isi+=n;bm[k].total_transaksi+=tx[x.staff_id]||0;return{...x,role_label:label(x.role),sudah_isi_hari_bulan_ini:n,belum_isi_hari_bulan_ini:Math.max(0,req-n),total_transaksi_bulan_ini:tx[x.staff_id]||0}}),tot=per.reduce((a:number,x:any)=>a+x.sudah_isi_hari_bulan_ini,0),required=(ss||[]).length*req;return cacheSet(ck,{ok:true,bulan:z.month,per_staff:per,per_bidang:Object.values(bm).sort((a:any,b:any)=>String(a.bidang).localeCompare(String(b.bidang))),ringkasan:{total_staff:(ss||[]).length,total_hari_wajib:required,total_staff_days_wajib:required,total_staff_days_sudah_isi:tot,total_staff_days_belum_isi:Math.max(0,required-tot),persentase_kepatuhan:required?Math.round((tot/required)*1000)/10:0,total_transaksi:(visibleReports||[]).length}})}
if(a==="apiDashboardStats"){
 const z=range(d.bulan),ck=`dash:v2:${z.month}:${d.staffIdFilter||""}:${d.bidangFilter||""}:${s.staff_id}`,hit=cacheGet(ck);if(hit)return hit;
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date());
 const dashboardTanggal=z.month===today.slice(0,7)?today:z.start;
 let staffQ=db.from("staff").select("staff_id,nama,role,bidang,status").eq("status","Aktif").order("nama");if(d.staffIdFilter)staffQ=staffQ.eq("staff_id",d.staffIdFilter);if(d.bidangFilter)staffQ=staffQ.eq("bidang",d.bidangFilter);const {data:activeStaff,error:staffErr}=await staffQ;if(staffErr)throw staffErr;
 let q=db.from("reports").select("report_id,staff_id,nama_snapshot,bidang_snapshot,role_snapshot,tanggal,pukul,ruang,masalah_kegiatan,tindakan,status,keterangan,kategori,area_kerja,item,spare_part_unit_kind,spare_part_unit_status,spare_part_unit,type,jumlah,status_pencapaian,created_at").is("deleted_at",null).gte("tanggal",z.start).lte("tanggal",z.end);
 if(d.staffIdFilter)q=q.eq("staff_id",d.staffIdFilter);
 if(d.bidangFilter)q=q.eq("bidang_snapshot",d.bidangFilter);
 const {data:rawReports,error}=await q;if(error)throw error;
 // PERF P1: aggregate/KPI calculations do not need report-level visibility checks.
 // Only the small "recent" detail payload needs reportPolicyBatch. This avoids
 // loading owner roles / edit permissions for every report in the selected month.
 const aggregateReports=rawReports||[];
 const recentCandidates=aggregateReports.slice().sort((a:any,b:any)=>{
   const d=String(b.tanggal||"").localeCompare(String(a.tanggal||""));
   if(d)return d;
   const p=String(b.pukul||"").localeCompare(String(a.pukul||""));
   if(p)return p;
   return String(b.created_at||"").localeCompare(String(a.created_at||""));
 }).slice(0,12);
 let rr:any[]=[];
 let dashboardPolicy:any={visible:new Set<string>(),editable:new Set<string>()};
 if(recentCandidates.length){
   // Detail "Laporan Terbaru" bersifat tambahan. Kegagalan policy/detail
   // tidak boleh menggagalkan KPI utama Dashboard yang berasal dari aggregateReports.
   try{
     dashboardPolicy=await reportPolicyBatch(db,s,recentCandidates);
     rr=recentCandidates.filter((r:any)=>dashboardPolicy.visible.has(String(r.report_id)));
   }catch(policyErr){
     console.error("[DASHBOARD_RECENT_POLICY_FAILED]",String(policyErr?.message||policyErr));
     rr=[];
   }
 }
 // KA IPSRS remains included in KPI/aggregate statistics. Its report details
 // are still excluded from the recent payload for non-KA users below.
 const staffCountReports=aggregateReports.map((r:any)=>({staff_id:r.staff_id,tanggal:r.tanggal}));
 const total=aggregateReports.length,sel=aggregateReports.filter((r:any)=>r.status==="Selesai").length,bel=total-sel,cat:any={},ar:any={},sm:any={},pc:any={};for(const st of activeStaff||[])sm[st.staff_id]={staff_id:st.staff_id,nama:st.nama,role:st.role,bidang:st.bidang||"",value:0};let spare=0,unit=0;
 const newPartGroups:any={};const newUnitGroups:any={};let spareQty=0,unitQty=0;
 const qtyValue=(v:any)=>{const n=Number(String(v??"").trim().replace(/,/g,"."));return Number.isFinite(n)&&n>0?n:0};
 const addNewGroup=(bucket:any,nameValue:any,typeValue:any,qtyValueRaw:any)=>{
   const name=String(nameValue||"").trim()||"Tidak diisi";
   const type=String(typeValue||"").trim()||"-";
   const key=(name+"||"+type).toLocaleLowerCase("id");
   if(!bucket[key])bucket[key]={nama:name,type,jumlah:0,laporan:0};
   bucket[key].jumlah+=qtyValue(qtyValueRaw);
   bucket[key].laporan++;
 };
 for(const r of aggregateReports){
   if(r.kategori)cat[r.kategori]=(cat[r.kategori]||0)+1;
   const kind=normalizeCategory(r.spare_part_unit_kind);
   const status=normalizeCategory(r.spare_part_unit_status);
   const legacy=categoryKind(r.kategori);

   // SPMU v15: aggregate UNIT and SPARE PART / MATERIAL independently.
   // Dual-side reports may contain both sides, so do not force them through
   // the single legacy kind/name/type/jumlah fields.
   const unitStatus=normalizeCategory(r.unit_status);
   const spareStatus=normalizeCategory(r.spare_part_material_status);
   const unitIsNew=unitStatus==="BARU" || (!r.unit_status && kind==="UNIT" && status==="BARU") || (!r.unit_status && !kind && legacy.unit);
   const spareIsNew=spareStatus==="BARU" || (!r.spare_part_material_status && kind==="SPARE PART / MATERIAL" && status==="BARU") || (!r.spare_part_material_status && !kind && legacy.spare);

   if(spareIsNew){
     spare++;
     const q=qtyValue(r.spare_part_material_jumlah ?? (kind==="SPARE PART / MATERIAL" ? r.jumlah : legacy.spare ? r.jumlah : null));
     spareQty+=q;
     addNewGroup(newPartGroups,
       r.spare_part_material || (kind==="SPARE PART / MATERIAL" ? r.spare_part_unit : legacy.spare ? r.spare_part_unit : r.item),
       r.spare_part_material_type || (kind==="SPARE PART / MATERIAL" ? r.type : legacy.spare ? r.type : ""),
       r.spare_part_material_jumlah ?? (kind==="SPARE PART / MATERIAL" ? r.jumlah : legacy.spare ? r.jumlah : null)
     );
   }
   if(unitIsNew){
     unit++;
     // Unit adalah barang utuh; kuantitas unit harus berupa bilangan bulat.
     // Data lama yang tersimpan sebagai pecahan dinormalisasi saat agregasi dashboard.
     const q=Math.round(qtyValue(r.unit_jumlah ?? (kind==="UNIT" ? r.jumlah : legacy.unit ? r.jumlah : null)));
     unitQty+=q;
     addNewGroup(newUnitGroups,
       r.unit_name || (kind==="UNIT" ? r.spare_part_unit : legacy.unit ? r.spare_part_unit : r.item),
       r.unit_type || (kind==="UNIT" ? r.type : legacy.unit ? r.type : ""),
       q
     );
   }
   if(r.area_kerja)ar[r.area_kerja]=(ar[r.area_kerja]||0)+1;
   const p=r.status_pencapaian||r.status||"Belum Diisi";pc[p]=(pc[p]||0)+1
 }
 // Petugas Teraktif tetap menghitung KA IPSRS, tanpa membaca/menampilkan isi laporannya.
 for(const r of staffCountReports){const k=r.staff_id;if(sm[k])sm[k].value++;}
 const isKaIpsrs=String(s?.role||"").toUpperCase()==="KA_IPSRS" || String(s?.staff_id||"")==="KAIPSRS";
 const recentSource=isKaIpsrs ? (rr||[]) : (rr||[]).filter((r:any)=>String(r.role_snapshot||"").toUpperCase()!=="KA_IPSRS" && String(r.staff_id||"")!=="KAIPSRS");const recent=recentSource.slice().sort((a:any,b:any)=>{const d=String(b.tanggal||"").localeCompare(String(a.tanggal||""));if(d)return d;const p=String(b.pukul||"").localeCompare(String(a.pukul||""));if(p)return p;return String(b.created_at||"").localeCompare(String(a.created_at||""));}).slice(0,6).map((r:any)=>map(r,dashboardPolicy.editable.has(String(r.report_id))));
 const todayCount:any={};for(const r of staffCountReports)if(r.tanggal===dashboardTanggal)todayCount[r.staff_id]=(todayCount[r.staff_id]||0)+1;
 const monitoringToday=(activeStaff||[]).map((x:any)=>({staff_id:x.staff_id,nama:x.nama,jabatan:x.jabatan||"",role:x.role,role_label:label(x.role),bidang:x.bidang||"",status:x.status||"Aktif",status_hari_ini:todayCount[x.staff_id]?"SUDAH_ISI":"BELUM_ISI",laporan_hari_ini:todayCount[x.staff_id]||0}));
 const sortCount=(a:any,b:any)=>Number(b.value||0)-Number(a.value||0)||String(a.label||"").localeCompare(String(b.label||""),"id");const kategori=Object.entries(cat).map(([label,value])=>({label,value})).sort(sortCount);const area=Object.entries(ar).map(([label,value])=>({label,value})).sort(sortCount);const staff=Object.values(sm).sort((a:any,b:any)=>Number(b.value||0)-Number(a.value||0)||String(a.nama||a.staff_id||"").localeCompare(String(b.nama||b.staff_id||""),"id"));const sparePartStats=Object.values(newPartGroups).sort((a:any,b:any)=>Number(b.jumlah||0)-Number(a.jumlah||0)||Number(b.laporan||0)-Number(a.laporan||0)).slice(0,20);const unitBaruStats=Object.values(newUnitGroups).sort((a:any,b:any)=>Number(b.jumlah||0)-Number(a.jumlah||0)||Number(b.laporan||0)-Number(a.laporan||0)).slice(0,20);return cacheSet(ck,{ok:true,data:{total,selesai:sel,belum:bel,persen:total?Math.round(sel/total*100):0,kategori,area,staff,recent,pencapaian:pc,spare_part_baru:spare,unit_baru:unit,spare_part_total_quantity:spareQty,unit_baru_total_quantity:unitQty,spare_part_stats:sparePartStats,unit_baru_stats:unitBaruStats,monitoring_today:{tanggal:dashboardTanggal,data:monitoringToday}}})
}
if(a==="apiGetStaffReports"){const z=range(d.bulan),{data,error}=await db.from("reports").select("*").is("deleted_at",null).eq("staff_id",d.staffId).gte("tanggal",z.start).lte("tanggal",z.end);if(error)throw error;const visible:any[]=[];for(const r of data||[]){if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS"||String(r.staff_id||"")==="KAIPSRS")continue;if(await canViewReport(db,s,r))visible.push(r);}return{ok:true,data:await Promise.all(visible.map(async(r:any)=>map(r,(await canEditReport(db,s,r)).ok)))}}
if(a==="apiGetStaffPerformance"){const z=range(d.bulan),{data,error}=await db.from("reports").select("staff_id,role_snapshot,status").is("deleted_at",null).eq("staff_id",d.staffId).gte("tanggal",z.start).lte("tanggal",z.end);if(error)throw error;const rr:any[]=[];for(const r of data||[]){if(String(r.role_snapshot||"").toUpperCase()==="KA_IPSRS"||String(r.staff_id||"")==="KAIPSRS")continue;if(await canViewReport(db,s,r))rr.push(r);}const n=rr.length,sx=rr.filter((r:any)=>r.status==="Selesai").length;return{ok:true,data:{staff_id:d.staffId,total:n,selesai:sx,belum:n-sx,persentase:n?Math.round(sx/n*100):0}}}
if(a==="apiGetMasterData"){
 const {data,error}=await db.from("master_data").select("id,data_type,parent_id,name,sort_order,is_active").eq("is_active",true).order("sort_order").order("id");
 if(error)throw error;
 const rows=data||[], byId:any={};for(const x of rows)byId[String(x.id)]=x;
 const areas:any[]=[],items:any={},categories:any[]=[],displayNameById:any={};
 for(const x of rows){const type=String(x.data_type||"").toUpperCase(),name=String(x.name||"").trim();if(!name)continue;
  if(type==="AREA"){displayNameById[String(x.id)]=name;areas.push({id:x.id,name,sort_order:x.sort_order,parent_id:null});}
  else if(type==="SUBAREA"){const parent=byId[String(x.parent_id)];if(parent&&parent.data_type==="AREA"){const display=String(parent.name)+" / "+name;displayNameById[String(x.id)]=display;areas.push({id:x.id,name:display,sort_order:x.sort_order,parent_id:x.parent_id,sub_area:name});}}
  else if(type==="KATEGORI")categories.push({id:x.id,name,sort_order:x.sort_order});
 }
 for(const x of rows){if(String(x.data_type||"").toUpperCase()!=="ITEM")continue;const parent=displayNameById[String(x.parent_id)];if(parent)(items[parent]??=[]).push(String(x.name||"").trim());}
 areas.sort((a:any,b:any)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),"id"));
 categories.sort((a:any,b:any)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),"id"));
 return{ok:true,data:{areas,items,kategori:categories}};
}
if(a==="apiGetKategoriKustom"){const {data,error}=await db.from("master_data").select("name").eq("data_type","KATEGORI").gte("id",695).eq("is_active",true).order("id");if(error)throw error;return{ok:true,kategori:(data||[]).map((x:any)=>x.name).sort((a:any,b:any)=>String(a).localeCompare(String(b),"id"))}}
if(a==="apiGetAreaKerjaKustom"){const {data,error}=await db.from("master_data").select("name").eq("data_type","AREA").gte("id",700).eq("is_active",true).order("id");if(error)throw error;return{ok:true,area:(data||[]).map((x:any)=>x.name).sort((a:any,b:any)=>String(a).localeCompare(String(b),"id"))}}
if(a==="apiGetItemKustom"){const {data,error}=await db.from("master_data").select("name,parent_id").eq("data_type","ITEM").gte("id",707).eq("is_active",true).order("id");if(error)throw error;const {data:aa,error:ae}=await db.from("master_data").select("id,name").eq("data_type","AREA");if(ae)throw ae;const nm:any={};for(const x of aa||[])nm[x.id]=x.name;const items:any={};for(const x of data||[]){const area=nm[x.parent_id];if(area)(items[area]??=[]).push(x.name)}return{ok:true,items}}
if(a==="apiTambahKategori"){return{ok:false,msg:"Kategori baku sudah dikunci. Penambahan kategori baru tidak diizinkan."}}
if(a==="apiTambahAreaKerja"){if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat menambah area kerja."};const n=String(d.nama||"").trim();if(!n)return{ok:false,msg:"Nama area kerja wajib diisi."};if(n.length>120)return{ok:false,msg:"Nama area kerja maksimal 120 karakter."};const norm=(v:any)=>String(v||"").trim().toLocaleLowerCase("id");const staticList=Array.isArray(d.staticList)?d.staticList:[];if(staticList.some((x:any)=>norm(x)===norm(n)))return{ok:false,msg:"Area kerja sudah ada."};const {data:dup}=await db.from("master_data").select("id").eq("data_type","AREA").ilike("name",n).limit(1);if((dup||[]).length)return{ok:false,msg:"Area kerja sudah ada."};const {data,error}=await db.from("master_data").insert({data_type:"AREA",name:n,sort_order:999,is_active:true,created_by:ctx.userClaims.sub}).select("name").single();if(error)throw error;return{ok:true,area:data.name}}
if(a==="apiTambahItem"){
 const ar=String(d.area||"").trim(),n=String(d.nama||"").trim(),allowSimilar=d.allowSimilar===true;
 if(!ar||!n)return{ok:false,msg:"Area dan nama item wajib diisi."};
 if(n.length>120)return{ok:false,msg:"Nama item maksimal 120 karakter."};
 const normalizeItem=(v:any)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("id").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
 const norm=normalizeItem(n);if(!norm)return{ok:false,msg:"Nama item tidak valid."};
 const {data:a1,error:ae}=await db.from("master_data").select("id,name,is_active").eq("data_type","AREA").ilike("name",ar).maybeSingle();
 if(ae)throw ae;if(!a1||!a1.is_active)return{ok:false,msg:"Area kerja tidak ditemukan atau tidak aktif."};
 const {data:rows,error:re}=await db.from("master_data").select("id,name,is_active").eq("data_type","ITEM").eq("parent_id",a1.id).eq("is_active",true).order("name").limit(2000);
 if(re)throw re;
 const existingItemsForArea=Array.isArray(d.existingItemsForArea)?d.existingItemsForArea.filter((x:any)=>typeof x==="string").slice(0,2000):[];
 const combined:any[]=[...(rows||[])];const known=new Set(combined.map((x:any)=>normalizeItem(x.name)));
 for(const name of existingItemsForArea){const nn=normalizeItem(name);if(nn&&!known.has(nn)){combined.push({name,is_active:true});known.add(nn);}}
 const levenshtein=(x:string,y:string)=>{if(x===y)return 0;if(!x.length)return y.length;if(!y.length)return x.length;let prev=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const cur=[i];for(let j=1;j<=y.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));prev=cur;}return prev[y.length];};
 const tokenScore=(x:string,y:string)=>{const X=new Set(x.split(" ").filter(Boolean)),Y=new Set(y.split(" ").filter(Boolean));if(!X.size||!Y.size)return 0;let overlap=0;for(const t of X)if(Y.has(t))overlap++;return overlap/(X.size+Y.size-overlap)};
 const scored=combined.map((r:any)=>{const rn=normalizeItem(r.name);const lev=1-levenshtein(norm,rn)/Math.max(norm.length,rn.length,1);const tok=tokenScore(norm,rn);return{name:r.name,score:Math.max(lev,tok),normalized:rn};});
 const exact=scored.find((x:any)=>x.normalized===norm);
 if(exact)return{ok:false,msg:"Nama item sama dengan data yang sudah ada. Gunakan item yang tersedia: "+exact.name,candidates:[{name:exact.name,score:1}],exact:true};
 const candidates=scored.filter((x:any)=>x.score>=0.58&&(x.normalized.includes(norm)||norm.includes(x.normalized)||tokenScore(norm,x.normalized)>=0.5||x.score>=0.68)).sort((x:any,y:any)=>y.score-x.score).slice(0,5).map((x:any)=>({name:x.name,score:Number(x.score.toFixed(2))}));
 if(candidates.length&&!allowSimilar)return{ok:false,needs_choice:true,msg:"Ditemukan item yang mirip. Periksa kandidat terlebih dahulu.",candidates};
 const {data,error}=await db.from("master_data").insert({data_type:"ITEM",parent_id:a1.id,name:n,sort_order:999,is_active:true,created_by:ctx.userClaims.sub}).select("id,name").single();
 if(error){if(String(error.code||"")==="23505"||/duplicate|sudah ada|already exists/i.test(String(error.message||"")))return{ok:false,msg:"Item sama sudah ditambahkan oleh pengguna lain. Muat ulang daftar item dan pilih data yang sudah ada."};throw error;}
 // Use the trusted staff record resolved from the authenticated session, not a client-supplied name.
 const {error:reviewError}=await db.from("master_item_review_queue").update({submitted_by_staff_id:s.staff_id,submitted_by_name:s.nama,submitted_by_role:s.role,updated_at:new Date().toISOString()}).eq("master_data_id",data.id);
 if(reviewError)throw reviewError;
 return{ok:true,item:data.name}
}
if(a==="apiManageMasterData"){
 if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat mengelola master data."};
 const op=String(d.operation||"LIST").toUpperCase(),now=new Date().toISOString();
 const validTypes=["KATEGORI","AREA","SUBAREA","ITEM"];
 if(op==="LIST"){
  const {data,error}=await db.from("master_data").select("id,data_type,parent_id,name,sort_order,is_active,created_at,updated_at").order("data_type").order("sort_order").order("name");
  if(error)throw error;const rows=data||[],byId:any={};for(const r of rows)byId[String(r.id)]=r;
  return{ok:true,data:rows.map((r:any)=>({...r,parent_name:r.parent_id?String(byId[String(r.parent_id)]?.name||""):"",parent_type:r.parent_id?String(byId[String(r.parent_id)]?.data_type||""):""}))};
 }
 if(op==="CREATE"){
  const type=String(d.data_type||"").toUpperCase(),name=String(d.name||"").trim(),parentId=d.parent_id==null||d.parent_id===""?null:Number(d.parent_id);
  if(!validTypes.includes(type))return{ok:false,msg:"Jenis master data tidak valid."};
  if(!name||name.length>120)return{ok:false,msg:"Nama wajib diisi (maksimal 120 karakter)."};
  if(["KATEGORI","AREA"].includes(type)&&parentId!==null)return{ok:false,msg:"Kategori dan Area Kerja utama tidak boleh memiliki induk."};
  if(["SUBAREA","ITEM"].includes(type)&&(!Number.isInteger(parentId)||parentId<1))return{ok:false,msg:type==="SUBAREA"?"Pilih Area Kerja induk.":"Pilih Area Kerja atau Sub Area Kerja induk."};
  if(type==="SUBAREA"||type==="ITEM"){
   const {data:p,error:pe}=await db.from("master_data").select("id,name,is_active,data_type").eq("id",parentId).maybeSingle();if(pe)throw pe;
   const validParent=type==="SUBAREA"?p?.data_type==="AREA":(p?.data_type==="AREA"||p?.data_type==="SUBAREA");
   if(!p||!p.is_active||!validParent)return{ok:false,msg:"Data induk tidak ditemukan, tidak aktif, atau jenisnya tidak sesuai."};
  }
  let q=db.from("master_data").select("id,name").eq("data_type",type).ilike("name",name);
  q=["KATEGORI","AREA"].includes(type)?q.is("parent_id",null):q.eq("parent_id",parentId);
  const {data:dups,error:de}=await q.limit(1);if(de)throw de;if((dups||[]).length)return{ok:false,msg:"Nama sudah digunakan pada kelompok tersebut."};
  const {data:created,error}=await db.from("master_data").insert({data_type:type,parent_id:["SUBAREA","ITEM"].includes(type)?parentId:null,name,sort_order:Number.isInteger(Number(d.sort_order))?Math.max(0,Math.min(9999,Number(d.sort_order))):999,is_active:true,created_by:ctx.userClaims.sub,updated_by:ctx.userClaims.sub}).select("id,data_type,parent_id,name,sort_order,is_active").single();if(error)throw error;
  await audit(db,s,"MASTER_DATA_CREATE",null,"Menambah master data",{new_value:JSON.stringify(created)});
  return{ok:true,data:created,msg:"Master data berhasil ditambahkan."};
 }
 if(op==="UPDATE"){
  const id=Number(d.id),name=String(d.name||"").trim(),sortOrder=Number(d.sort_order),requestedParent=d.parent_id==null||d.parent_id===""?null:Number(d.parent_id);
  if(!Number.isInteger(id)||id<1)return{ok:false,msg:"ID master data tidak valid."};
  if(!name||name.length>120)return{ok:false,msg:"Nama wajib diisi (maksimal 120 karakter)."};
  const {data:old,error:oe}=await db.from("master_data").select("id,data_type,parent_id,name,sort_order,is_active").eq("id",id).maybeSingle();if(oe)throw oe;if(!old)return{ok:false,msg:"Master data tidak ditemukan."};
  const type=String(old.data_type||"").toUpperCase();if(!validTypes.includes(type))return{ok:false,msg:"Jenis master data tidak didukung."};
  let targetParent:any=null;
  if(type==="SUBAREA"||type==="ITEM"){
   targetParent=requestedParent||old.parent_id;
   const {data:p,error:pe}=await db.from("master_data").select("id,data_type,is_active").eq("id",targetParent).maybeSingle();if(pe)throw pe;
   const validParent=type==="SUBAREA"?p?.data_type==="AREA":(p?.data_type==="AREA"||p?.data_type==="SUBAREA");
   if(!p||!p.is_active||!validParent)return{ok:false,msg:"Data induk tujuan tidak aktif atau jenisnya tidak sesuai."};
  }
  let q=db.from("master_data").select("id").eq("data_type",type).ilike("name",name).neq("id",id);
  q=["KATEGORI","AREA"].includes(type)?q.is("parent_id",null):q.eq("parent_id",targetParent);
  const {data:dups,error:de}=await q.limit(1);if(de)throw de;if((dups||[]).length)return{ok:false,msg:"Nama sudah digunakan pada kelompok tersebut."};
  const patch:any={name,updated_at:now,updated_by:ctx.userClaims.sub};if(type==="SUBAREA"||type==="ITEM")patch.parent_id=targetParent;if(Number.isInteger(sortOrder)&&sortOrder>=0&&sortOrder<=9999)patch.sort_order=sortOrder;
  const {data:updated,error:ue}=await db.from("master_data").update(patch).eq("id",id).select("id,data_type,parent_id,name,sort_order,is_active").single();if(ue)throw ue;
  if(type==="ITEM"){const {data:parent,error:pe}=await db.from("master_data").select("name").eq("id",updated.parent_id).maybeSingle();if(pe)throw pe;await db.from("master_item_review_queue").update({item_name:updated.name,area_name:parent?.name||"",updated_at:now}).eq("master_data_id",id);}
  await audit(db,s,"MASTER_DATA_UPDATE",null,"Mengubah master data",{old_value:JSON.stringify(old),new_value:JSON.stringify(updated)});
  return{ok:true,data:updated,msg:"Perubahan master data berhasil disimpan."};
 }
 if(op==="SET_ACTIVE"||op==="DELETE"){
  const id=Number(d.id);if(!Number.isInteger(id)||id<1)return{ok:false,msg:"ID master data tidak valid."};
  const active=op==="DELETE"?false:d.is_active===true;
  const {data:old,error:oe}=await db.from("master_data").select("id,data_type,parent_id,name,is_active").eq("id",id).maybeSingle();if(oe)throw oe;if(!old)return{ok:false,msg:"Master data tidak ditemukan."};
  const type=String(old.data_type||"").toUpperCase();
  if(!active&&["AREA","SUBAREA"].includes(type)){
   const childTypes=type==="AREA"?["SUBAREA","ITEM"]:["ITEM"];
   for(const childType of childTypes){
    let q=db.from("master_data").select("id,data_type,parent_id,name,is_active").eq("data_type",childType).eq("parent_id",id).eq("is_active",true);
    const {data:children,error:ce}=await q;if(ce)throw ce;
    for(const child of children||[]){
     const {error:childError}=await db.from("master_data").update({is_active:false,updated_at:now,updated_by:ctx.userClaims.sub}).eq("id",child.id);if(childError)throw childError;
     await audit(db,s,"MASTER_DATA_DEACTIVATE",null,"Nonaktif otomatis karena induk dihapus",{old_value:JSON.stringify(child),new_value:JSON.stringify({...child,is_active:false})});
     if(childType==="SUBAREA"){
      const {data:grand,error:ge}=await db.from("master_data").select("id,data_type,parent_id,name,is_active").eq("data_type","ITEM").eq("parent_id",child.id).eq("is_active",true);if(ge)throw ge;
      for(const item of grand||[]){const {error:ie}=await db.from("master_data").update({is_active:false,updated_at:now,updated_by:ctx.userClaims.sub}).eq("id",item.id);if(ie)throw ie;await audit(db,s,"MASTER_DATA_DEACTIVATE",null,"Nonaktif otomatis karena sub area dihapus",{old_value:JSON.stringify(item),new_value:JSON.stringify({...item,is_active:false})});}
     }
    }
   }
  }
  const {data:updated,error:ue}=await db.from("master_data").update({is_active:active,updated_at:now,updated_by:ctx.userClaims.sub}).eq("id",id).select("id,data_type,parent_id,name,is_active").single();if(ue)throw ue;
  await audit(db,s,active?"MASTER_DATA_REACTIVATE":"MASTER_DATA_DEACTIVATE",null,active?"Mengaktifkan kembali master data":"Menghapus (menonaktifkan) master data; data laporan lama dipertahankan",{old_value:JSON.stringify(old),new_value:JSON.stringify(updated)});
  return{ok:true,data:updated,msg:active?"Master data diaktifkan kembali.":"Data dinonaktifkan. Riwayat laporan lama tetap dipertahankan."};
 }
 return{ok:false,msg:"Operasi master data tidak dikenal."};
}
if(a==="apiListMasterItemReviews"){
 if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat memeriksa item baru."};
 const status=String(d.status||"MENUNGGU").toUpperCase();
 const allowed=["MENUNGGU","SESUAI","PERLU_KOREKSI","DITOLAK","SEMUA"];
 if(!allowed.includes(status))return{ok:false,msg:"Filter status tidak valid."};
 let q=db.from("master_item_review_queue").select("*").order("submitted_at",{ascending:false}).limit(300);
 if(status!=="SEMUA")q=q.eq("status",status);
 const {data,error}=await q;
 if(error)throw error;
 return{ok:true,data:data||[]};
}
if(a==="apiReviewMasterItem"){
 if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat memeriksa item baru."};
 const id=Number(d.reviewId),status=String(d.status||"").toUpperCase(),note=String(d.note||"").trim(),corrected=String(d.correctedName||"").trim();
 if(!Number.isInteger(id)||id<1)return{ok:false,msg:"ID pemeriksaan tidak valid."};
 if(!["SESUAI","PERLU_KOREKSI","DITOLAK"].includes(status))return{ok:false,msg:"Status pemeriksaan tidak valid."};
 if(status==="PERLU_KOREKSI"&&!corrected&&!note)return{ok:false,msg:"Isi nama koreksi atau catatan untuk item ini."};
 const {data:row,error:re}=await db.from("master_item_review_queue").select("review_id,master_data_id,item_name,status").eq("review_id",id).maybeSingle();
 if(re)throw re;
 if(!row)return{ok:false,msg:"Item pemeriksaan tidak ditemukan."};
 if(corrected){
   if(corrected.length>120)return{ok:false,msg:"Nama item maksimal 120 karakter."};
   const {data:masterRow,error:me}=await db.from("master_data").select("parent_id").eq("id",row.master_data_id).eq("data_type","ITEM").maybeSingle();if(me)throw me;if(!masterRow)return{ok:false,msg:"Item master data sudah tidak ditemukan."};const {data:dups,error:de}=await db.from("master_data").select("id").eq("data_type","ITEM").eq("parent_id",masterRow.parent_id).ilike("name",corrected).neq("id",row.master_data_id).limit(1);
   if(de)throw de;
   if((dups||[]).length)return{ok:false,msg:"Nama koreksi sudah digunakan pada area tersebut."};
   const {error:ue}=await db.from("master_data").update({name:corrected,updated_at:new Date().toISOString(),updated_by:ctx.userClaims.sub}).eq("id",row.master_data_id).eq("data_type","ITEM");
   if(ue)throw ue;
 }
 if(status==="DITOLAK"){
   const {error:de}=await db.from("master_data").update({is_active:false,updated_at:new Date().toISOString(),updated_by:ctx.userClaims.sub}).eq("id",row.master_data_id).eq("data_type","ITEM");
   if(de)throw de;
 }
 const {data:updated,error:qe}=await db.from("master_item_review_queue").update({item_name:corrected||row.item_name,status,checked_by_staff_id:s.staff_id,checked_by_name:s.nama,checked_at:new Date().toISOString(),review_note:note||null,updated_at:new Date().toISOString()}).eq("review_id",id).select("*").single();
 if(qe)throw qe;
 await audit(db,s,"REVIEW_MASTER_ITEM",null,"Pemeriksaan item master data",{field_changed:"status",old_value:row.status,new_value:status});
 return{ok:true,data:updated};
}
if(a==="apiGetAccessControl"){if(s.role!=="KA_IPSRS"&&s.role!=="ADMINISTRASI")return{ok:false,msg:"Tidak memiliki akses pengaturan."};const {data,error}=await db.from("access_settings").select("key,value");if(error)throw error;const o:any={};for(const x of data||[])o[String(x.key).toLowerCase()]=x.value;const {data:ep,error:ee}=await db.from("edit_permissions").select("permission_id").eq("granted_to_staff_id",s.staff_id).eq("is_active",true).limit(1).maybeSingle();if(ee)throw ee;return{ok:true,laporan_tim:o.laporan_tim||"AKTIF",administrasi_edit:o.administrasi_edit||"NONAKTIF",has_edit_permission:!!ep}}
if(a==="apiListEditPermissions"){if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat melihat izin edit."};const {data,error}=await db.from("edit_permissions").select("*").order("created_at",{ascending:false});if(error)throw error;return{ok:true,data:data||[]}}
if(a==="apiSetAccessSetting"){if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat mengubah pengaturan."};const key=String(d.key||"").trim(),value=String(d.value||"").trim();if(!["LAPORAN_TIM","ADMINISTRASI_EDIT"].includes(key)||!["AKTIF","NONAKTIF"].includes(value))return{ok:false,msg:"Pengaturan tidak valid."};const {error}=await db.from("access_settings").upsert({key,value,updated_at:new Date().toISOString(),updated_by_staff_id:s.staff_id,updated_by_name:s.nama},{onConflict:"key"});if(error)throw error;return{ok:true}}
if(a==="apiSetEditPermission"){if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat mengubah izin."};const g=String(d.grantedToStaffId||"").trim(),t=String(d.targetStaffId||"").trim(),active=!!d.isActive;if(!g||!t||g===t)return{ok:false,msg:"Pemberi dan target harus berbeda."};const {data:target}=await db.from("staff").select("staff_id,nama,role").eq("staff_id",t).maybeSingle();if(!target)return{ok:false,msg:"Target petugas tidak ditemukan."};if(target.role==="KA_IPSRS")return{ok:false,msg:"Laporan KA IPSRS tidak dapat diberi izin edit."};const {data:grant}=await db.from("staff").select("staff_id,nama").eq("staff_id",g).maybeSingle();if(!grant)return{ok:false,msg:"Pemberi izin tidak ditemukan."};const {data:existing,error:existingError}=await db.from("edit_permissions").select("permission_id").eq("granted_to_staff_id",g).eq("target_staff_id",t).limit(1).maybeSingle();if(existingError)throw existingError;const now=new Date().toISOString();if(existing?.permission_id){const {error}=await db.from("edit_permissions").update({granted_to_staff_name:grant.nama,target_staff_name:target.nama,is_active:active,granted_by_staff_id:s.staff_id,granted_by_name:s.nama,updated_at:now}).eq("permission_id",existing.permission_id);if(error)throw error;}else{const permission_id="PERM-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();const {error}=await db.from("edit_permissions").insert({permission_id,granted_to_staff_id:g,granted_to_staff_name:grant.nama,target_staff_id:t,target_staff_name:target.nama,is_active:active,granted_by_staff_id:s.staff_id,granted_by_name:s.nama,created_at:now,updated_at:now});if(error)throw error;}return{ok:true}}
if(a==="apiAdminUnblockLhi"){if(s.role!=="KA_IPSRS")return{ok:false,msg:"Hanya KA IPSRS yang dapat mengaktifkan kembali petugas yang diblokir LHI."};const target=String(d.staffId||"").trim();if(!target)return{ok:false,msg:"Staff wajib dipilih."};const days=Math.max(1,Math.min(30,Number(d.days||7)));const until=new Date(Date.now()+days*86400000).toISOString();const {data:ts,error:te}=await db.from("staff").select("staff_id,nama,role,bidang,status,lhi_manual_unblock_until").eq("staff_id",target).maybeSingle();if(te)throw te;if(!ts)return{ok:false,msg:"Petugas tidak ditemukan."};if(ts.role==="KA_IPSRS")return{ok:false,msg:"KA IPSRS tidak perlu diaktifkan melalui mekanisme ini."};const {error:ue}=await db.from("staff").update({status:"Aktif",lhi_manual_unblock_until:until}).eq("staff_id",target);if(ue)throw ue;await audit(db,s,"ADMIN_UNBLOCK_LHI_7_HARI",null,"KA IPSRS mengaktifkan kembali petugas setelah blokir disiplin LHI.",{field_changed:"status,lhi_manual_unblock_until",old_value:ts.status,new_value:"Aktif sampai "+until});return{ok:true,msg:"Petugas berhasil diaktifkan kembali.",data:{staff_id:target,nama:ts.nama,status:"Aktif",lhi_manual_unblock_until:until}}}
if(a==="apiAdminResetPassword"){if(s.role!=="KA_IPSRS"&&s.role!=="ADMINISTRASI")return{ok:false,msg:"Tidak memiliki hak reset password."};const target=String(d.staffId||"").trim(),newp=String(d.newPassword||"");if(!target||newp.length<6)return{ok:false,msg:"Staff dan password baru wajib diisi; minimal 6 karakter."};const {data:ts,error:te}=await db.from("staff").select("staff_id,auth_user_id,role").eq("staff_id",target).maybeSingle();if(te)throw te;if(!ts?.auth_user_id)return{ok:false,msg:"Akun Auth target belum terhubung."};if(s.role==="ADMINISTRASI"&&ts.role==="KA_IPSRS")return{ok:false,msg:"Administrasi tidak dapat reset password KA IPSRS."};const {error}=await db.auth.admin.updateUserById(ts.auth_user_id,{password:newp});if(error)throw error;await audit(db,s,"ADMIN_RESET_PASSWORD",null,"Reset password petugas",{new_value:target});return{ok:true,msg:"Password petugas berhasil direset."}}if(a==="apiChangePassword"){const authUid=String(s.auth_user_id||ctx.userClaims?.sub||"").trim();if(!authUid)return{ok:false,msg:"Akun Auth tidak ditemukan."};const oldp=String(d.oldPassword||""),newp=String(d.newPassword||"");if(newp.length<6)return{ok:false,msg:"Password baru minimal 6 karakter."};const {data:u,error:ue}=await db.auth.admin.getUserById(authUid);if(ue||!u?.user?.email)return{ok:false,msg:"Akun Auth tidak ditemukan."};const pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}")["default"];const ac=createClient(Deno.env.get("SUPABASE_URL")!,pub,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const {error:oe}=await ac.auth.signInWithPassword({email:u.user.email,password:oldp});if(oe)return{ok:false,msg:"Password lama salah."};const {error}=await db.auth.admin.updateUserById(authUid,{password:newp});if(error)throw error;return{ok:true,msg:"Password berhasil diganti."}}
await db.from("staff").update({last_seen_at:new Date().toISOString()}).eq("staff_id",s.staff_id);return{ok:false,msg:"Action API tidak dikenal: "+a}}
export default{fetch:withSupabase({auth:"user",cors:{headers:cors}},async(req,ctx)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{const b=await req.json();return out(await act(ctx,b.action,b.data||{},req))}catch(e:any){console.error(e);return out({ok:false,msg:e?.message||"Terjadi kesalahan server."},400)}})};