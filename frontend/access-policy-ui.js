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
      if(r && r.ok){
      adminEditActive=r.administrasi_edit==='AKTIF';
      hasEditPermission=!!r.has_edit_permission;
    }
    }catch(e){ /* Backend tetap menjadi otoritas keamanan. */ }
  }

  window.canEditReport = function(report){
    const s = typeof getSession === 'function' ? getSession() : null;
    if(!s || !report) return false;
    if(s.role === 'KA_IPSRS') return true;
    if(String(report.StaffID||'') === String(s.staff_id||'')) return true;
    if(String(report.Role||'') === 'KA_IPSRS') return false;
    // Administrasi: setting edit dibaca langsung dari backend melalui
    // apiGetAccessControl. Ini hanya fallback UI untuk memastikan tombol
    // tetap muncul setelah setting AKTIF; backend apiUpdateReport tetap
    // melakukan otorisasi final dan tetap melarang laporan KA IPSRS.
    if(s.role === 'ADMINISTRASI' && adminEditActive === true) return true;

    // Backend mengirim CanEdit sebagai sumber kebenaran UI per laporan.
    // Untuk role selain Administrasi, jangan menebak izin dari frontend.
    return report.CanEdit === true;
  };

  function refresh(){
    loadPolicy().then(function(){
      // Setting edit adalah hasil dari backend. Setelah selesai dimuat,
      // render ulang Daftar Laporan agar tombol Edit langsung muncul tanpa
      // menunggu navigasi ulang.
      try{
        const page=document.getElementById('page-laporan');
        if(s.role === 'ADMINISTRASI' &&
           adminEditActive === true &&
           page &&
           page.classList.contains('active') &&
           typeof rawData !== 'undefined' &&
           typeof renderReportTable === 'function'){
          renderReportTable(Array.isArray(rawData) ? rawData : []);
        }
      }catch(e){}

      /* Re-render modal bila fungsi aplikasi tersedia dan sedang terbuka. */
      if(typeof renderReportDetail === 'function' && window.CURRENT_REPORT_ID){
        try{ renderReportDetail(window.CURRENT_REPORT_ID); }catch(e){}
      }
    });
  }
  // Hak akses dibaca saat sesi/token berubah dan saat UI pertama kali siap.
  // Polling 5 detik tidak diperlukan karena otoritas edit tetap berada di backend
  // dan justru menyebabkan kerja browser berulang saat pengguna membuka detail.
  setTimeout(refresh,1000);
})();
