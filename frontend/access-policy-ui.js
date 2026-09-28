/* Sinkronisasi tampilan tombol edit dengan aturan hak akses backend. */
(function(){
  const originalCanEditReport = window.canEditReport;
  let adminEditActive = false;
  let hasEditPermission = false;
  let loadedForToken = '';

  // PERF STAGE 15: hak edit per laporan sudah dikirim backend
  // melalui CanEdit. Tidak perlu request apiGetAccessControl tambahan
  // hanya untuk memutuskan tampilan tombol Edit.
  window.canEditReport = function(report){
    const s = typeof getSession === 'function' ? getSession() : null;
    if(!s || !report) return false;
    if(s.role === 'KA_IPSRS') return true;
    if(String(report.StaffID||'') === String(s.staff_id||'')) return true;
    if(String(report.Role||'') === 'KA_IPSRS') return false;
    // Backend mengirim CanEdit sebagai sumber kebenaran UI per laporan.
    // ADMINISTRASI_EDIT hanya memicu reload policy; frontend tidak boleh
    // memberikan hak edit sendiri jika backend mengirim CanEdit=false.
    return report.CanEdit === true;
  };

  // Tidak ada request/polling policy tambahan.
})();
