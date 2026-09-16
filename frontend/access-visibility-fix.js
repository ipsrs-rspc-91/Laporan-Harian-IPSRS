/* PATCH: akses laporan & dashboard untuk seluruh petugas yang sudah login.
 * Tidak mengubah aturan keamanan backend; hanya memastikan state/filter frontend
 * tidak mengunci petugas pada laporan sendiri dan Dashboard/Laporan tidak
 * dipanggil sebelum fragment halamannya selesai dimount.
 *
 * FIX (16-09-2026): sebelumnya proteksi "tunggu fragment selesai dimuat"
 * hanya diterapkan untuk name === 'dashboard'. Menu "Laporan" TIDAK
 * mendapat proteksi yang sama, padahal pages/Page_Laporan.html juga
 * dimuat secara deferred/async (lihat index.html -> deferredMounts).
 * Akibatnya, kalau petugas klik menu "Laporan" sebelum fragment itu
 * selesai di-fetch & disisipkan ke DOM, goLaporanSubTab() mencoba
 * mengakses elemen (#subtab-daftar, #FilterBulan, dst) yang belum ada
 * -> error JS diam-diam -> halaman Laporan tampak kosong (baik laporan
 * sendiri maupun laporan petugas lain, karena keduanya ada di section
 * page-laporan yang sama). Ini juga yang membuat Dashboard kadang
 * ikut gagal tampil kalau navigasi terjadi sangat cepat setelah login.
 * Perbaikan di bawah menggeneralisasi mekanisme tunggu itu untuk kedua
 * halaman (dashboard & laporan), plus jaga-jaga defensif di
 * goLaporanSubTab supaya tidak pernah throw walau elemen belum siap.
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

  // FIX: elemen sub-tab halaman Laporan (#subtab-daftar dkk) hanya ada
  // setelah fragment pages/Page_Laporan.html selesai dimount. Kalau
  // dipanggil lebih awal (mis. dari setTimeout sinkronisasi di bawah,
  // atau dari goPage sebelum proteksi mount aktif), jangan biarkan throw
  // -- cukup diamkan, nanti dipanggil ulang otomatis setelah mount siap
  // (lihat wrapper window.goPage di bawah).
  function laporanDomReady(){
    return !!document.getElementById('subtab-daftar');
  }

  if (typeof originalGoLaporanSubTab === 'function' && typeof originalSelectAdminStaff === 'function') {
    window.goLaporanSubTab = function(name){
      if (!laporanDomReady()) {
        // Halaman Laporan belum selesai dimount -- jangan diproses dulu,
        // daripada error karena elemen belum ada.
        return;
      }

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

  // FIX UTAMA: tunggu fragment halaman selesai dimount SEBELUM goPage()
  // aslinya dijalankan -- sebelumnya ini hanya berlaku untuk 'dashboard',
  // sekarang berlaku juga untuk 'laporan' (lihat catatan di atas).
  const PAGE_READY_KEYS = { dashboard: 'dashboard', laporan: 'laporan' };

  if (typeof originalGoPage === 'function') {
    window.goPage = function(name){
      const readyKey = PAGE_READY_KEYS[name];
      const readyPromise = readyKey && window.__ipsrsPageReady ? window.__ipsrsPageReady[readyKey] : null;

      if (readyPromise) {
        return Promise.resolve(readyPromise)
          .then(function(){ return originalGoPage(name); })
          .catch(function(err){
            console.error('Halaman "' + name + '" belum berhasil dimuat:', err);
            return false;
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
