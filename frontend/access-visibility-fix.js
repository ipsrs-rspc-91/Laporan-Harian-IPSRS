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

  // FIX UTAMA: backend menggunakan staff_id. Beberapa bagian frontend lama
  // masih membaca StaffID. Normalisasi keduanya di satu titik agar data laporan
  // tidak hilang hanya karena perbedaan nama field atau tipe data.
  function getStaffId(row){
    if(!row) return '';
    const value = row.staff_id !== undefined && row.staff_id !== null
      ? row.staff_id
      : row.StaffID;
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function sameStaffId(a, b){
    if(a === null || a === undefined || b === null || b === undefined) return false;
    return String(a).trim() === String(b).trim();
  }

  if(typeof originalApplyFilters === 'function'){
    window.applyFilters = function(){
      const wanted = (typeof adminSelectedStaffId !== 'undefined' && adminSelectedStaffId !== null)
        ? String(adminSelectedStaffId).trim()
        : '';

      // app.js versi lama menggunakan r.StaffID saat filtering, sedangkan
      // response backend yang benar menggunakan r.staff_id. Tambahkan alias
      // sementara agar fungsi filter lama tetap kompatibel tanpa mengubah
      // kontrak data backend.
      if(Array.isArray(rawData)){
        rawData.forEach(function(row){
          if(row && (row.StaffID === undefined || row.StaffID === null || row.StaffID === '')){
            row.StaffID = getStaffId(row);
          }
        });
      }

      if(wanted && Array.isArray(rawData)){
        const match = rawData.find(function(row){
          return row && sameStaffId(getStaffId(row), wanted);
        });

        if(match){
          const previous = adminSelectedStaffId;
          // originalApplyFilters() menggunakan strict comparison.
          // Gunakan representasi StaffID yang sudah dinormalisasi.
          adminSelectedStaffId = getStaffId(match);
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
      return sameStaffId(getStaffId(report), CURRENT_SESSION.staff_id);
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
