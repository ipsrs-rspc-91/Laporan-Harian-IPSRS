/**
 * access-visibility-fix.js
 * FINAL INTEGRATION v20260917-REPORT-FIX1
 *
 * Tujuan:
 * 1. Tidak lagi membuat renderer Laporan Saya kedua.
 * 2. Laporan Saya memakai renderer utama app.js sehingga tombol Edit
 *    yang sudah disediakan renderer utama tetap tampil.
 * 3. Daftar Laporan tetap dikendalikan oleh laporan-fast-v2.js sebagai
 *    read-only.
 * 4. Monitoring hanya menampilkan STAFF dengan status "Aktif".
 *    Backend tetap mengirim master lengkap; penyaringan ini hanya untuk UI.
 * 5. Setelah Page Laporan selesai dimount dan user sudah login, tab awal
 *    dipastikan kembali ke "Laporan Saya".
 *
 * Backend GAS tetap menjadi otoritas keamanan dan tidak disentuh oleh file ini.
 */
(function(){
  'use strict';

  if(window.__IPSRS_ACCESS_VISIBILITY_FIX_V2) return;
  window.__IPSRS_ACCESS_VISIBILITY_FIX_V2 = true;

  var initializedToken = '';
  var originalAuthRun = window.authRun;

  // -------------------------------------------------------------------
  // MONITORING: hanya SDM Aktif yang boleh masuk ke daftar kartu UI.
  // -------------------------------------------------------------------
  if(typeof originalAuthRun === 'function'){
    window.authRun = async function(fnName){
      var args = Array.prototype.slice.call(arguments,1);
      var result = await originalAuthRun.apply(this,[fnName].concat(args));

      if(fnName === 'apiGetStaffMonitoring' && result && result.ok === true){
        result.data = Array.isArray(result.data)
          ? result.data.filter(function(staff){
              return String(staff && staff.status || 'Aktif') === 'Aktif';
            })
          : [];
      }

      return result;
    };
  }

  function pageLaporanReady(){
    var page = document.getElementById('page-laporan');
    if(!page) return false;

    // Jangan menginisialisasi tab Laporan ketika user baru selesai login
    // dan masih berada di Form Input. Inisialisasi hanya saat halaman
    // Laporan benar-benar sedang aktif/dibuka.
    return page.classList.contains('active');
  }

  function sessionToken(){
    try{
      if(typeof getSession === 'function'){
        var s = getSession();
        return s && s.token ? String(s.token) : '';
      }
    }catch(e){}

    try{
      if(typeof CURRENT_SESSION !== 'undefined' && CURRENT_SESSION && CURRENT_SESSION.token){
        return String(CURRENT_SESSION.token);
      }
    }catch(e){}

    return '';
  }

  function ensureLaporanDefault(){
    var token = sessionToken();
    if(!token || !pageLaporanReady()) return;
    if(initializedToken === token) return;
    if(typeof window.goLaporanSubTab !== 'function') return;

    try{
      window.goLaporanSubTab('saya');
      initializedToken = token;
    }catch(err){
      console.warn('[ACCESS_VISIBILITY_FIX]',err);
    }
  }

  function bindTabTypes(){
    document.querySelectorAll('.sub-tab').forEach(function(btn){
      btn.type = 'button';
    });
  }

  var observer = new MutationObserver(function(){
    if(pageLaporanReady()) bindTabTypes();
    ensureLaporanDefault();
  });

  observer.observe(document.body,{childList:true,subtree:true});

  if(document.readyState !== 'loading'){
    bindTabTypes();
    ensureLaporanDefault();
  }else{
    document.addEventListener('DOMContentLoaded',function(){
      bindTabTypes();
      ensureLaporanDefault();
    },{once:true});
  }

  // Page Laporan dimount sebelum login selesai. Polling ringan ini hanya
  // menunggu token pertama; setelah token ditemukan tidak ada polling berat
  // dan tidak ada request server tambahan selain yang dipicu goLaporanSubTab.
  var bootTimer = setInterval(function(){
    ensureLaporanDefault();
    if(initializedToken) clearInterval(bootTimer);
  },750);

  console.info('[ACCESS_VISIBILITY_FIX] v20260917-REPORT-FIX1 active');
})();
