/* PATCH: akses laporan & dashboard untuk seluruh petugas yang sudah login.
 * Tidak mengubah aturan keamanan backend; hanya memastikan state/filter frontend
 * tidak mengunci petugas pada laporan sendiri dan Dashboard tidak dipanggil
 * sebelum fragment Dashboard selesai dimount.
 */
(function(){
  const originalGoLaporanSubTab = window.goLaporanSubTab;
  const originalSelectAdminStaff = window.selectAdminStaff;
  const originalGoPage = window.goPage;
  const originalApplyFilters = window.applyFilters;
  const originalCanEditReport = window.canEditReport;

  // FIX UTAMA: StaffID dari Google Sheets dapat berupa number, sedangkan
  // StaffID dari session/filter frontend berupa string. Normalisasi di satu
  // titik agar laporan milik petugas tidak hilang hanya karena beda tipe data.
  function sameStaffId(a, b){
    if(a === null || a === undefined || b === null || b === undefined) return false;
    return String(a).trim() === String(b).trim();
  }

  if(typeof originalApplyFilters === 'function'){
    window.applyFilters = function(){
      const wanted = (typeof adminSelectedStaffId !== 'undefined' && adminSelectedStaffId !== null)
        ? String(adminSelectedStaffId).trim()
        : '';

      if(wanted && Array.isArray(rawData)){
        const match = rawData.find(function(row){
          return row && sameStaffId(row.StaffID, wanted);
        });

        if(match){
          const previous = adminSelectedStaffId;
          // originalApplyFilters() menggunakan strict comparison.
          // Untuk sementara gunakan representasi StaffID yang sama persis
          // dengan data laporan, lalu kembalikan state UI semula.
          adminSelectedStaffId = match.StaffID;
          try{
            return originalApplyFilters();
          }finally{
            adminSelectedStaffId = previous;
          }
        }
      }

      return originalApplyFilters();
    };
  }

  if(typeof originalCanEditReport === 'function'){
    window.canEditReport = function(report){
      if(!CURRENT_SESSION || !report) return false;
      if(CURRENT_SESSION.role === 'KA_IPSRS' || CURRENT_SESSION.role === 'ADMINISTRASI') return true;
      return sameStaffId(report.StaffID, CURRENT_SESSION.staff_id);
    };
  }

  if (typeof originalGoLaporanSubTab === 'function' && typeof originalSelectAdminStaff === 'function') {
    window.goLaporanSubTab = function(name){
      const session = typeof getSession === 'function' ? getSession() : null;

      // Laporan Saya = paksa filter ke petugas yang sedang login.
      if (name === 'saya' && session && session.staff_id) {
        originalSelectAdminStaff(session.staff_id);
      }

      // Daftar Laporan = hapus filter petugas agar laporan tim dapat tampil.
      // Backend tetap menjadi otoritas visibilitas melalui canViewReport_().
      if (name === 'daftar') {
        originalSelectAdminStaff('');
      }

      return originalGoLaporanSubTab(name);
    };
  }

  if (typeof originalGoPage === 'function') {
    window.goPage = function(name){
      if (name === 'dashboard' && window.__ipsrsPageReady && window.__ipsrsPageReady.dashboard) {
        // Dashboard fragment dimuat secara deferred. Tunggu mount selesai
        // sebelum goPage/loadDashboard dijalankan agar tidak pernah mendapat
        // "page-dashboard" kosong atau null.
        return Promise.resolve(window.__ipsrsPageReady.dashboard)
          .then(function(){ return originalGoPage(name); })
          .catch(function(err){
            console.error('Dashboard belum berhasil dimuat:', err);
            return originalGoPage(name);
          });
      }
      return originalGoPage(name);
    };
  }

  // Jika user sudah berada di Laporan ketika patch dimuat, sinkronkan state
  // awal ke Laporan Saya tanpa mengganggu login/session.
  setTimeout(function(){
    try{
      const session = typeof getSession === 'function' ? getSession() : null;
      const laporanPage = document.getElementById('page-laporan');
      if (session && laporanPage && laporanPage.classList.contains('active') && typeof window.goLaporanSubTab === 'function') {
        window.goLaporanSubTab('saya');
      }
    }catch(e){}
  }, 0);
})();
