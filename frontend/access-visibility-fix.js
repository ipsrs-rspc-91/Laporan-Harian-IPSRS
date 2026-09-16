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
    // ======================================================================
    // FIX RACE CONDITION NAVIGASI
    // ======================================================================
    // page-dashboard dan page-laporan dipasang ke DOM secara deferred oleh
    // index.html. Karena goPage() dipanggil langsung dari onclick menu, user
    // dapat menekan menu sebelum fragment selesai di-mount.
    //
    // PENTING: jangan memanggil originalGoPage() sebelum Promise halaman
    // selesai. originalGoPage() sendiri langsung mencari #page-* dan, untuk
    // Laporan, resetLaporanSubTabCache() -> goLaporanSubTab() yang langsung
    // mencari elemen sub-tab. Jika DOM belum siap, inilah sumber race.
    function waitForPageReady(pageName){
      return new Promise(function(resolve, reject){
        var started = Date.now();
        var timeoutMs = 15000;

        function check(){
          var ready = window.__ipsrsPageReady;
          var promise = ready && ready[pageName];

          // index.html membuat Promise readiness setelah seluruh JS utama
          // selesai dimuat. Jika nilainya belum tersedia sesaat setelah login,
          // tunggu sebentar dan cek kembali.
          if (promise && typeof promise.then === 'function') {
            Promise.resolve(promise).then(resolve, reject);
            return;
          }

          // Fallback: jika promise tidak tersedia tetapi elemen sudah benar-
          // benar ter-mount, navigasi tetap boleh dilanjutkan.
          var el = document.getElementById('page-' + pageName);
          if (el && (pageName === 'input' || el.innerHTML.trim() !== '')) {
            resolve(true);
            return;
          }

          if (Date.now() - started >= timeoutMs) {
            reject(new Error('Timeout menunggu halaman ' + pageName + ' selesai dimuat.'));
            return;
          }

          setTimeout(check, 25);
        }

        check();
      });
    }

    window.goPage = function(name){
      // Input sudah mounted sejak awal, sehingga tidak perlu ditahan.
      if (name !== 'dashboard' && name !== 'laporan') {
        return originalGoPage(name);
      }

      return waitForPageReady(name)
        .then(function(){
          // Fragment SUDAH ada di DOM pada titik ini. Baru sekarang jalankan
          // navigasi asli agar loadDashboard()/resetLaporanSubTabCache() aman.
          return originalGoPage(name);
        })
        .catch(function(err){
          console.error('Halaman ' + name + ' belum berhasil dimuat:', err);
          // Jangan memanggil originalGoPage() saat readiness gagal karena itu
          // justru dapat mengulangi error DOM/null yang sedang kita cegah.
          return false;
        });
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
