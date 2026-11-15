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
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw = ""; for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
};

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (!headers) return new Response("Forbidden origin.", { status:403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ ok:false, message:"Method not allowed." },405,headers);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const bearer = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
    const body = await req.json().catch(() => ({}));
    const challenge = String(body?.challenge || "").trim();
    if (!url || !serviceKey || !publicKey || !bearer || !/^[A-Za-z0-9_-]{40,50}$/.test(challenge))
      return json({ ok:false, message:"Autentikasi pemulihan tidak valid." },401,headers);

    const authClient = createClient(url, publicKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
    const { data:userData, error:userError } = await authClient.auth.getUser(bearer);
    if (userError || !userData?.user?.id) return json({ ok:false, message:"Sesi login tidak valid." },401,headers);

    const capability = randomToken();
    const db = createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
    const { data, error } = await db.rpc("consume_lhi_recovery_challenge", {
      p_nonce_hash: await sha256(challenge),
      p_auth_user_id: userData.user.id,
      p_session_token_hash: await sha256(capability)
    });
    if (error || !data?.ok) return json({ ok:false, message:"Akun tidak berhak menggunakan pemulihan. Hanya KA IPSRS yang dapat melanjutkan." },403,headers);
    return json({ ok:true, recovery_capability:capability, expires_at:data.expires_at,
      staff_name:data.staff_name, role:data.role },200,headers);
  } catch {
    return json({ ok:false, message:"Layanan autentikasi pemulihan sedang tidak tersedia." },503,headers);
  }
});
