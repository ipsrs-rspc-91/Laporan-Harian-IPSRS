/**
 * laporan-fast-v2.js
 * ULTRA PATH halaman Laporan IPSRS.
 *
 * Prinsip:
 * 1) Laporan Saya -> 1 request server dengan staff_id user login.
 * 2) Daftar Laporan -> 1 request server dengan staff filter yang dipilih.
 * 3) Tidak ada prefetch tab lain.
 * 4) Tidak ada cache TTL yang bisa menampilkan data basi.
 * 5) Hanya request yang SEDANG berjalan yang dideduplikasi.
 * 6) Filter status/kategori/area/bidang/pencarian tetap client-side.
 * 7) Filter staff tidak lagi dipakai untuk Laporan Saya.
 *
 * GANTI laporan-fast.js lama dengan file ini.
 * Jangan load bersamaan dengan:
 * - laporan-edit-direction-fix.js
 * - laporan-loading-state.js
 * - daftar-laporan-fix.js
 * - laporan-fast.js lama
 */
(function(){
  'use strict';

  const inflight = new Map();
  let requestSerial = 0;

  function mode(){
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

  function requestKey(month,staff){ return String(month||'')+'|'+String(staff||''); }

  function requestReports(month,staff){
    const key=requestKey(month,staff);
    if(inflight.has(key)) return inflight.get(key);

    const p=authRun('apiGetReports',month||'',staff||'','','')
      .finally(function(){ inflight.delete(key); });
    inflight.set(key,p);
    return p;
  }

  async function loadReportsUltra(){
    const mySerial=++requestSerial;
    const m=mode();
    const b=bulan();
    let staff='';

    if(m==='saya'){
      if(typeof CURRENT_SESSION !== 'undefined' && CURRENT_SESSION){
        staff=String(CURRENT_SESSION.staff_id||'').trim();
      }
      clearSayaStaffFilter();
    }else{
      staff=adminStaff();
    }

    setMsg('msgReport','Memuat data...');

    try{
      const json=await requestReports(b,staff);
      // Jangan render response lama jika user sudah pindah tab/bulan/filter.
      if(mySerial!==requestSerial) return;
      if(!json || !json.ok){
        rawData=[];
        if(typeof renderReportTable==='function') renderReportTable([]);
        setMsg('msgReport',(json&&json.msg)||'Gagal memuat data.',true);
        return;
      }
      rawData=Array.isArray(json.data)?json.data:[];
      applyFilters();
      setMsg('msgReport','Data tampil: '+rawData.length);
    }catch(err){
      if(mySerial!==requestSerial) return;
      setMsg('msgReport','Error: '+(err&&err.message?err.message:err),true);
      console.error('[LAPORAN_ULTRA]',err);
    }
  }

  // Server-side loader menjadi sumber utama.
  window.loadReportsBySelectedMonth=loadReportsUltra;

  // Bungkus filter hanya untuk memastikan staff filter TIDAK pernah memotong Saya.
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
        try{ if(typeof adminSelectedStaffId !== 'undefined') adminSelectedStaffId=previous; }catch(e){}
      }
    };
  }

  // Tambahkan Semua Bulan tanpa duplikasi.
  function ensureAllMonth(){
    const sel=document.getElementById('FilterBulan');
    if(!sel) return;
    if(!Array.from(sel.options).some(o=>o.value==='')){
      const o=document.createElement('option');
      o.value=''; o.textContent='Semua Bulan';
      sel.insertBefore(o,sel.firstChild);
    }
  }

  // Jangan biarkan filter staf lama terbawa saat masuk Laporan Saya.
  const originalGo=window.goLaporanSubTab;
  if(typeof originalGo==='function'){
    window.goLaporanSubTab=function(name){
      if(name==='saya') clearSayaStaffFilter();
      return originalGo.apply(this,arguments);
    };
  }

  // Daftar Laporan tetap read-only di UI.
  document.addEventListener('click',function(ev){
    if(mode()!=='daftar') return;
    const btn=ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if(!btn) return;
    const t=String(btn.textContent||'').toLowerCase();
    if(t.indexOf('edit')!==-1 || t.indexOf('✏')!==-1){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    }
  },true);

  // Request baru selalu mengambil data terbaru setelah save/edit.
  window.__invalidateLaporanFastCache=function(){ /* kompatibilitas; tidak ada TTL cache */ };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ensureAllMonth,{once:true});
  else ensureAllMonth();

  console.info('[LAPORAN_ULTRA] active');
})();
