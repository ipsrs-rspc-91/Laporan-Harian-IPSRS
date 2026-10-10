import { withSupabase } from "npm:@supabase/server@1.8.0";

const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
const authEmail=(u:string)=>u.toLowerCase().replace(/[^a-z0-9._-]/g,"-")+"@auth.ipsrs.local";

const CANONICAL_ALIAS: Record<string,string> = { "herry": "KAIPSRS" };
const LEGACY_USERNAME: Record<string,string> = { "KAIPSRS": "kaipsrs" };

export default {
 fetch: withSupabase({auth:"none"}, async(req,ctx)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:C});
  if(req.method!=="POST") return out({ok:false,msg:"Method tidak diizinkan."},405);
  try{
   const b=await req.json();
   const rawUsername=String(b?.username||"").trim();
   const password=String(b?.password||"");
   const legacyUrl=String(b?.legacy_url||"").trim();
   if(!rawUsername||!password||!legacyUrl) return out({ok:false,msg:"Data login tidak lengkap."},400);
   const u=new URL(legacyUrl);
   if(u.protocol!=="https:"||u.hostname!=="script.google.com"||!u.pathname.startsWith("/macros/s/")||!u.pathname.endsWith("/exec")) return out({ok:false,msg:"Backend legacy tidak diizinkan."},400);

   const aliasResolved = CANONICAL_ALIAS[rawUsername.toLowerCase()] || rawUsername;
   const candidateId = aliasResolved.toUpperCase();

   const {data:staff,error:se}=await ctx.supabaseAdmin.from("staff").select("staff_id,status,auth_user_id").eq("staff_id",candidateId).maybeSingle();
   if(se) throw se;
   if(!staff) return out({ok:false,msg:"Username tidak ditemukan."},404);
   if(String(staff.status||"").toLowerCase()!=="aktif") return out({ok:false,msg:"Petugas tidak aktif."},403);

   const canonicalId = staff.staff_id;
   const legacyUsername = LEGACY_USERNAME[canonicalId] || canonicalId;

   const lr=await fetch(legacyUrl,{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"apiLogin",data:{username:legacyUsername,password}})});
   const txt=await lr.text();
   let legacy:any; try{legacy=JSON.parse(txt)}catch(_e){return out({ok:false,msg:"Backend lama tidak memberikan respons JSON."},502)}
   if(!legacy?.ok) return out({ok:false,msg:legacy?.msg||"Username atau password salah."},401);

   const email=authEmail(canonicalId);
   const users=await ctx.supabaseAdmin.auth.admin.listUsers({page:1,perPage:1000});
   if(users.error) throw users.error;
   const found=users.data.users.find((x:any)=>String(x.email||"").toLowerCase()===email);
   let user:any;
   if(found){
     const x=await ctx.supabaseAdmin.auth.admin.updateUserById(found.id,{password,email_confirm:true,user_metadata:{...(found.user_metadata||{}),staff_id:canonicalId,username:canonicalId}});
     if(x.error) throw x.error;
     user=x.data.user;
   }else{
     const x=await ctx.supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{staff_id:canonicalId,username:canonicalId}});
     if(x.error) throw x.error;
     user=x.data.user;
   }
   return out({ok:true,staff_id:canonicalId,user_id:user.id});
  }catch(e:any){return out({ok:false,msg:e?.message||"Gagal migrasi akun Auth."},500)}
 })
};