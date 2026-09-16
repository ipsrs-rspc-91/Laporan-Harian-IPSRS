/* PATCH: akses laporan & dashboard untuk seluruh petugas yang sudah login.
 * Tidak mengubah aturan keamanan backend; hanya memastikan state/filter frontend
 * tidak mengunci petugas pada laporan sendiri dan Dashboard tidak dipanggil
 * sebelum fragment Dashboard selesai dimount.
 */
(function(){
  const originalGoLaporanSubTab = window.goLaporanSubTab;
  const originalSelectAdminStaff = window.selectAdminStaff;
  const originalGoPage = window.goPage;

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
