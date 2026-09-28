/**
 * laporan-fast-v2.js
 * FINAL INTEGRATION v20260917-REPORT-FIX1
 *
 * Prinsip:
 * 1) Laporan Saya -> 1 request server dengan staff_id user login.
 * 2) Daftar Laporan -> 1 request server dengan staff filter yang dipilih.
 * 3) Tidak ada prefetch tab lain.
 * 4) Read cache sangat pendek (3 detik) untuk klik berulang; cache dibersihkan setelah create/edit.
 * 5) Hanya request yang SEDANG berjalan yang dideduplikasi.
 * 6) Filter status/kategori/area/bidang/pencarian tetap client-side.
 * 7) Laporan Saya memakai renderer utama app.js dan tombol Edit tetap tersedia.
 * 8) Daftar Laporan mengikuti CanEdit dari backend; tombol Edit tampil hanya
 *    untuk laporan yang memang dapat diedit oleh user.
 * 9) Kebijakan read-only dipasang setelah renderer utama tersedia, sehingga
 *    tidak bergantung pada timing mount Page_Laporan.html.
 *
 * Jangan load bersamaan dengan:
 * - laporan-edit-direction-fix.js
 * - laporan-loading-state.js
 * - daftar-laporan-fix.js
 * - laporan-fast.js lama
 */
(function(){
  'use strict';

  if(window.__IPSRS_LAPORAN_FAST_V2_FIX1) return;
  window.__IPSRS_LAPORAN_FAST_V2_FIX1 = true;

  const inflight = new Map();
  const responseCache = new Map();
  const RESPONSE_CACHE_TTL = 3000;
  let requestSerial = 0;
  let rendererWrapped = false;

  function mode(){
    // Gunakan state navigasi utama sebagai sumber kebenaran.
    // DOM .active dapat tertinggal pada SPA saat berpindah menu.
    if(typeof getActiveLaporanMode_==='function'){
      const current=getActiveLaporanMode_();
      if(current==='daftar' || current==='saya') return current;
    }
    const active=document.querySelector('.sub-tab.active');
    return active && active.dataset && active.dataset.subtab === 'daftar' ? 'daftar' : 'saya';
  }

  function bulan(){
    const el=document.getElementById('FilterBulan');
    return el ? String(el.value||'') : '';
  }

  function adminStaff(){
    try{
      if(typeof adminSelectedStaffId !== 'undefined' && adminSelectedStaffId){
        return String(adminSelectedStaffId).trim();
      }
    }catch(e){}
    return '';
  }

  function clearSayaStaffFilter(){
    try{
      if(typeof adminSelectedStaffId !== 'undefined') adminSelectedStaffId='';
    }catch(e){}
    const sel=document.getElementById('adminStaffSelect');
    if(sel) sel.value='';
  }

  function requestKey(month,staff,viewMode){
    return String(month||'')+'|'+String(staff||'')+'|'+String(viewMode||'daftar');
  }

  function requestReports(month,staff,viewMode,forceRefresh){
    const key=requestKey(month,staff,viewMode);

    // Force refresh hanya dipakai oleh tombol "Muat Ulang".
    // Cache normal tetap aktif untuk navigasi/menu agar performa tidak turun.
    if(forceRefresh) responseCache.delete(key);

    const cached=responseCache.get(key);
    if(!forceRefresh && cached && (Date.now()-cached.at)<RESPONSE_CACHE_TTL) return Promise.resolve(cached.value);
    if(inflight.has(key)) return inflight.get(key);

    const p=authRun('apiGetReports',month||'',staff||'','',viewMode||'daftar')
      .then(function(value){ responseCache.set(key,{at:Date.now(),value:value}); return value; })
      .finally(function(){ inflight.delete(key); });
    inflight.set(key,p);
    return p;
  }

  async function loadReportsUltra(forceRefresh){
    const m=mode();
    const mySerial=++requestSerial;
    const requestSeq=(Number(window.__IPSRS_LAPORAN_REQUEST_SEQ)||0)+1;
    window.__IPSRS_LAPORAN_REQUEST_SEQ=requestSeq;
    const b=bulan();
    let staff='';

    // Begitu mode berubah, kosongkan dataset bersama agar data Daftar (mis. 309)
    // tidak sempat ditampilkan sebagai Laporan Saya selama request berjalan.
    rawData=[];
    if(m==='saya') clearSayaStaffFilter();

    const dashboardDrilldown = window.__IPSRS_DASHBOARD_UNFINISHED_DRILLDOWN === true;
    const daftarUnfinishedDrilldown = window.__IPSRS_DAFTAR_UNFINISHED_DRILLDOWN === true;
    const sayaUnfinishedDrilldown = window.__IPSRS_SAYA_UNFINISHED_DRILLDOWN === true;

    if(m==='saya'){
      // Drill-down Dashboard perlu melihat data yang sama dengan KPI Dashboard,
      // bukan hanya laporan pemilik akun. Tetap di mode "saya" supaya renderer
      // Edit yang sudah ada tidak berubah dan backend tetap menjadi pengaman.
      if(!dashboardDrilldown && typeof CURRENT_SESSION !== 'undefined' && CURRENT_SESSION){
        staff=String(CURRENT_SESSION.staff_id||'').trim();
      }
    }else{
      // Drill-down Dashboard -> Belum Selesai harus memakai Daftar Laporan
      // tanpa filter petugas, sehingga seluruh laporan yang boleh dilihat user
      // ikut diperiksa. Hak akses tetap ditentukan backend apiGetReports().
      staff=dashboardDrilldown ? '' : adminStaff();
    }

    setMsg('msgReport','Memuat data...');

    try{
      const json=await requestReports(b,staff,m==='saya'?'saya':'daftar',forceRefresh===true);
      if(mySerial!==requestSerial ||
         requestSeq!==Number(window.__IPSRS_LAPORAN_REQUEST_SEQ) ||
         mode()!==m) return false;

      if(!json || !json.ok){
        rawData=[];
        if(typeof renderReportTable==='function') renderReportTable([]);
        setMsg('msgReport',(json&&json.msg)||'Gagal memuat data.',true);
        return false;
      }

      rawData=Array.isArray(json.data)?json.data:[];
      if(dashboardDrilldown || daftarUnfinishedDrilldown || sayaUnfinishedDrilldown){
        const statusEl=document.getElementById('FilterStatus');
        if(statusEl) statusEl.value='__BELUM_SELESAI__';
      }

      // Drill-down Dashboard -> Spare Part Baru / Unit Baru:
      // marker kategori harus diterapkan DI SINI, setelah dataset selesai
      // dimuat. Sebelumnya app.js sudah memiliki logika ini, tetapi
      // laporan-fast-v2 menimpa loadReportsBySelectedMonth(), sehingga
      // marker tidak pernah diterapkan dan daftar kembali menampilkan semua
      // laporan. Ini adalah sumber regresi "klik Spare Part Baru tetapi semua
      // data tampil".
      const dashboardCategoryTarget =
        (typeof getDashboardCategoryTarget_ === 'function')
          ? getDashboardCategoryTarget_()
          : '';
      if(dashboardCategoryTarget === 'spare'){
        const kategoriEl=document.getElementById('FilterKategori');
        if(kategoriEl) kategoriEl.value='__DASH_SPARE_PART__';
      }else if(dashboardCategoryTarget === 'unit'){
        const kategoriEl=document.getElementById('FilterKategori');
        if(kategoriEl) kategoriEl.value='__DASH_UNIT_BARU__';
      }

      // applyFilters() menghitung hasil filter sekaligus menampilkan
      // "Data tampil: X dari Y". Jangan timpa lagi dengan rawData.length,
      // karena rawData adalah seluruh dataset (mis. 13), bukan hasil pencarian.
      applyFilters();

      // Marker hanya berlaku untuk satu navigasi dari Dashboard. Setelah
      // filter benar-benar diterapkan, hapus marker agar klik/menu Laporan
      // berikutnya kembali ke perilaku normal.
      if(dashboardCategoryTarget && typeof clearDashboardCategoryTarget_ === 'function'){
        clearDashboardCategoryTarget_();
      }

      if(dashboardDrilldown) window.__IPSRS_DASHBOARD_UNFINISHED_DRILLDOWN=false;
      if(daftarUnfinishedDrilldown) window.__IPSRS_DAFTAR_UNFINISHED_DRILLDOWN=false;
      if(sayaUnfinishedDrilldown) window.__IPSRS_SAYA_UNFINISHED_DRILLDOWN=false;
      return true;
    }catch(err){
      if(mySerial!==requestSerial || mode()!==m) return false;
      setMsg('msgReport','Error: '+(err&&err.message?err.message:err),true);
      console.error('[LAPORAN_ULTRA]',err);
      return false;
    }
  }

  window.loadReportsBySelectedMonth=loadReportsUltra;

  // Public helper untuk tombol "Muat Ulang".
  // Tidak mengubah perilaku pemanggilan biasa dari filter/menu.
  window.forceReloadLaporan=function(){
    return loadReportsUltra(true);
  };

  const originalApply=window.applyFilters;
  if(typeof originalApply==='function'){
    window.applyFilters=function(){
      if(mode()!=='saya') return originalApply.apply(this,arguments);

      let previous='';
      try{
        if(typeof adminSelectedStaffId !== 'undefined'){
          previous=adminSelectedStaffId;
          adminSelectedStaffId='';
        }
        return originalApply.apply(this,arguments);
      }finally{
        try{
          if(typeof adminSelectedStaffId !== 'undefined') adminSelectedStaffId=previous;
        }catch(e){}
      }
    };
  }

  // -------------------------------------------------------------------
  // DAFTAR LAPORAN — OTORISASI MENGIKUTI BACKEND
  // Backend Supabase adalah sumber kebenaran. Jangan lagi memaksa
  // Daftar Laporan menjadi read-only hanya karena role bukan KA IPSRS.
  //
  // CanEdit=true  -> tombol Edit boleh ditampilkan.
  // CanEdit=false -> tombol Edit disembunyikan.
  // Laporan KA IPSRS untuk non-KA sudah disaring oleh backend.
  // -------------------------------------------------------------------
  function installRendererPolicy(){
    if(rendererWrapped || typeof window.renderReportTable!=='function') return;

    const originalRenderReportTable=window.renderReportTable;
    window.renderReportTable=function(viewData){
      originalRenderReportTable.apply(this,arguments);

      if(mode()!=='daftar') return;

      // Defense-in-depth: renderer Daftar Laporan juga membuang
      // laporan KA IPSRS untuk seluruh petugas non-KA. Backend tetap
      // menjadi sumber otorisasi utama.
      const sess=(typeof getSession==='function') ? getSession() : null;
      const isKa=String(sess?.role||'').toUpperCase()==='KA_IPSRS';
      const rows=(Array.isArray(viewData)?viewData:[]).filter(function(row){
        if(isKa) return true;
        return String(row?.Role||row?.role_snapshot||'').toUpperCase()!=='KA_IPSRS'
          && String(row?.StaffID||row?.staff_id||'').trim()!=='KAIPSRS';
      });
      const tbody=document.getElementById('reportTableBody');
      if(tbody){
        Array.from(tbody.querySelectorAll('tr')).forEach(function(tr,index){
          const row=rows[index];
          const canEdit=!!(row && row.CanEdit===true);
          const actionCell=tr.querySelector('.report-action');
          if(actionCell){
            actionCell.style.display=canEdit?'':'none';
            if(!canEdit){
              actionCell.innerHTML='';
              actionCell.removeAttribute('onclick');
            }
          }
        });
      }
    };

    rendererWrapped=true;
  }

  installRendererPolicy();

  const rendererObserver=new MutationObserver(function(){
    installRendererPolicy();
    if(rendererWrapped) rendererObserver.disconnect();
  });
  rendererObserver.observe(document.body,{childList:true,subtree:true});


  function clearReportCache(fnName,args){
    if(!fnName){ responseCache.clear(); return; }
    if(fnName!=='apiGetReports') return;
    if(!Array.isArray(args) || args.length<2){ responseCache.clear(); return; }
    responseCache.delete(requestKey(args[0],args[1],args[3]||'daftar'));
  }

  window.__ipsrsClearLaporanApiCache=clearReportCache;
  window.__invalidateLaporanFastCache=clearReportCache;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      ensureAllMonth();
      installRendererPolicy();
    },{once:true});
  }else{
    ensureAllMonth();
    installRendererPolicy();
  }

  console.info('[LAPORAN_ULTRA] v20260917-REPORT-FIX1 active');
})();