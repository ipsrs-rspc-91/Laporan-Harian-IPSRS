/* Sinkronisasi tampilan tombol edit dengan aturan hak akses backend. */
(function(){
  const originalCanEditReport = window.canEditReport;
  let adminEditActive = false;
  let loadedForToken = '';

  async function loadPolicy(){
    const s = typeof getSession === 'function' ? getSession() : null;
    if(!s || !s.token){ loadedForToken=''; return; }
    if(s.role !== 'ADMINISTRASI') return;
    if(loadedForToken === s.token) return;
    loadedForToken = s.token;
    try{
      const r = await (async function(){
        const url = (typeof getApiUrl==='function'?getApiUrl():(window.IPSRS_API_URL||'')).trim();
        const response = await fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'apiGetAccessControl',data:{token:s.token}})});
        return JSON.parse(await response.text());
      })();
      if(r && r.ok) adminEditActive = r.administrasi_edit === 'AKTIF';
    }catch(e){ /* Backend tetap menjadi otoritas keamanan. */ }
  }

  window.canEditReport = function(report){
    const s = typeof getSession === 'function' ? getSession() : null;
    if(!s || !report) return false;
    if(s.role === 'KA_IPSRS') return true;
    if(String(report.StaffID||'') === String(s.staff_id||'')) return true;
    if(s.role === 'ADMINISTRASI'){
      if(String(report.Role||'') === 'KA_IPSRS') return false;
      return adminEditActive;
    }
    return typeof originalCanEditReport === 'function' ? originalCanEditReport(report) : false;
  };

  function refresh(){
    loadPolicy().then(function(){
      /* Re-render modal bila fungsi aplikasi tersedia dan sedang terbuka. */
      if(typeof renderReportDetail === 'function' && window.CURRENT_REPORT_ID){
        try{ renderReportDetail(window.CURRENT_REPORT_ID); }catch(e){}
      }
    });
  }
  setInterval(refresh,5000);
  setTimeout(refresh,1000);
})();
