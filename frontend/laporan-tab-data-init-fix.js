/* Laporan tab data-init fix v20260916-1
 * Tujuan:
 * - Memastikan kontrol Bulan/Filter pada sub-tab Laporan tersedia setelah
 *   Page_Laporan dimuat secara dinamis.
 * - Memastikan Rekap Bulanan dan Daftar Laporan benar-benar memuat data saat
 *   tab dibuka, bukan hanya mengganti panel.
 * - Tidak mengubah GAS/backend/database.
 * - Laporan Saya tetap didelegasikan ke navigation fix yang sudah ada.
 */
(function(){
  'use strict';

  var previousGo = window.goLaporanSubTab;
  var initialized = false;

  function el(id){ return document.getElementById(id); }

  function errorText(err){
    return err && err.message ? err.message : String(err || 'Error tidak diketahui');
  }

  function ensureMonthOptions(){
    var ids = ['DashBulan','FilterBulan','MonBulan','RekapBulan','MyFilterBulan'];
    var now = new Date();
    var opts = [];
    for(var i=0;i<12;i++){
      var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      opts.push({
        val: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'),
        label: d.toLocaleDateString('id-ID',{month:'long',year:'numeric'})
      });
    }
    ids.forEach(function(id){
      var sel=el(id);
      if(!sel) return;
      if(sel.options.length===0){
        opts.forEach(function(o){
          var op=document.createElement('option');
          op.value=o.val; op.innerText=o.label;
          sel.appendChild(op);
        });
      }
      if(!sel.value && opts.length) sel.value=opts[0].val;
    });
  }

  function ensureFilterOptions(){
    var bidang=el('FilterBidang');
    if(bidang && bidang.options.length<=1 && Array.isArray(window.BIDANG_LIST)){
      window.BIDANG_LIST.forEach(function(v){
        var o=document.createElement('option'); o.value=v; o.innerText=v; bidang.appendChild(o);
      });
    }
    var shift=el('FilterShift');
    if(shift && shift.options.length<=1 && Array.isArray(window.SHIFT_LIST)){
      window.SHIFT_LIST.forEach(function(v){
        var o=document.createElement('option'); o.value=v; o.innerText=v; shift.appendChild(o);
      });
    }
    var monBidang=el('MonFilterBidang');
    if(monBidang && monBidang.options.length<=1 && Array.isArray(window.BIDANG_LIST)){
      window.BIDANG_LIST.forEach(function(v){
        var o=document.createElement('option'); o.value=v; o.innerText=v; monBidang.appendChild(o);
      });
    }
    var monShift=el('MonFilterShift');
    if(monShift && monShift.options.length<=1 && Array.isArray(window.SHIFT_LIST)){
      window.SHIFT_LIST.forEach(function(v){
        var o=document.createElement('option'); o.value=v; o.innerText=v; monShift.appendChild(o);
      });
    }
  }

  function ensureLaporanControls(){
    if(!el('page-laporan')) return false;
    ensureMonthOptions();
    ensureFilterOptions();
    if(typeof window.buildMonthOptions==='function'){
      /* buildMonthOptions() hanya dijalankan setelah Page_Laporan tersedia.
       * Jalankan sekali; ini memperbaiki kasus selector dibuat setelah
       * afterAuthReady() selesai. */
      if(!initialized){
        try{ window.buildMonthOptions(); }catch(e){ /* fallback di atas tetap ada */ }
      }
    }
    initialized=true;
    return true;
  }

  function showOnly(name){
    document.querySelectorAll('.sub-tab-panel').forEach(function(p){
      p.classList.add('hidden');
    });
    var panel=el('subtab-'+name);
    if(!panel) return false;
    panel.classList.remove('hidden');
    document.querySelectorAll('.sub-tab').forEach(function(b){
      b.classList.toggle('active', b.dataset.subtab===name);
      b.type='button';
    });
    return true;
  }

  function loadData(name){
    try{
      if(name==='monitoring' && typeof window.loadStaffMonitoring==='function'){
        window.loadStaffMonitoring();
      }else if(name==='rekap' && typeof window.loadMonthlyRecap==='function'){
        window.loadMonthlyRecap();
      }else if(name==='daftar' && typeof window.loadReportsBySelectedMonth==='function'){
        if(typeof window.loadAdminStaffListIfNeeded==='function') window.loadAdminStaffListIfNeeded();
        window.loadReportsBySelectedMonth();
      }
    }catch(e){
      console.error('[ERR-UI-LAPORAN-TAB-001] laporan-tab-data-init-fix.js::loadData()',e);
    }
  }

  window.goLaporanSubTab=function(name){
    if(!ensureLaporanControls()){
      /* Page_Laporan mungkin baru selesai di-inject. Beri DOM satu tick. */
      setTimeout(function(){ window.goLaporanSubTab(name); },50);
      return false;
    }

    /* Laporan Saya tetap menggunakan implementasi sebelumnya karena di sana
       terdapat filter pribadi + tombol Edit. */
    if(name==='saya'){
      if(typeof previousGo==='function') return previousGo(name);
      return false;
    }

    if(name!=='monitoring' && name!=='rekap' && name!=='daftar') return false;
    if(!showOnly(name)) return false;

    var admin=el('adminStaffPanel');
    if(admin) admin.classList.toggle('hidden',name!=='daftar');

    /* Jalankan setelah panel terlihat agar fungsi renderer mendapatkan semua
       elemen DOM yang benar-benar sudah tersedia. */
    setTimeout(function(){
      ensureLaporanControls();
      loadData(name);
    },0);
    return true;
  };

  function watchPage(){
    if(el('page-laporan')){
      ensureLaporanControls();
      var active=document.querySelector('.sub-tab.active');
      var name=active ? active.dataset.subtab : null;
      if(name==='rekap' || name==='daftar' || name==='monitoring'){
        /* Bila halaman pertama kali di-render dengan panel lama aktif, paksa
           routing melalui fungsi baru sekali. */
        window.goLaporanSubTab(name);
      }
    }
  }

  var obs=new MutationObserver(function(){
    if(el('page-laporan')) ensureLaporanControls();
  });
  obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(watchPage,0);
  setTimeout(watchPage,150);
})();
