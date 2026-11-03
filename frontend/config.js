// Supabase public configuration. Publishable keys are browser-safe when RLS/auth is enforced.
// Cloudflare branch/deployment previews must never send test interactions to production Supabase.
(function configureIpsrsBackend_(){
  const host=String(window.location.hostname||'').toLowerCase();
  const isCloudflarePreview=host.endsWith('.rspc.workers.dev') &&
    host!=='laporan-harian-ipsrs.rspc.workers.dev';

  if(isCloudflarePreview){
    window.IPSRS_SUPABASE_URL='';
    window.IPSRS_SUPABASE_PUBLISHABLE_KEY='';
    window.IPSRS_SUPABASE_API_URL='';
    window.IPSRS_PREVIEW_BACKEND_DISABLED=true;
    return;
  }

  window.IPSRS_PREVIEW_BACKEND_DISABLED=false;
  window.IPSRS_SUPABASE_URL = 'https://tcrmlhfsroyhaxdfwyll.supabase.co';
  window.IPSRS_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TtDuzNo7h_668fq_7x4Sog_ZvYcFgmq';
  window.IPSRS_SUPABASE_API_URL = window.IPSRS_SUPABASE_URL + '/functions/v1/ipsrs-api';
  window.IPSRS_SUPABASE_EMAIL_DOMAIN = '@auth.ipsrs.local';
})();
