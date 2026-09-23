/* Sinkronisasi tampilan tombol edit dengan aturan hak akses backend. */
(function(){
  const originalCanEditReport = window.canEditReport;
  let adminEditActive = false;
  let hasEditPermission = false;
  let loadedForToken = '';

  async function loadPolicy(){
    const s = typeof getSession === 'function' ? getSession() : null;
    if(!s || !s.token){ loadedForToken=''; return; }
    if(s.role !== 'ADMINISTRASI') return;
    if(loadedForToken === s.token) return;
    loadedForToken = s.token;
    try{
      const r=await authRun('apiGetAccessControl');
      if(r && r.ok){ adminEditActive=r.administrasi_edit==='AKTIF'; hasEditPermission=!!r.has_edit_permission; }
    }catch(e){ /* Backend tetap menjadi otoritas keamanan. */ }
  }

  window.canEditReport = function(report){
    const s = typeof getSession === 'function' ? getSession() : null;
    if(!s || !report) return false;
    if(s.role === 'KA_IPSRS') return true;
    if(String(report.StaffID||'') === String(s.staff_id||'')) return true;
    if(String(report.Role||'') === 'KA_IPSRS') return false;
    return hasEditPermission;
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
