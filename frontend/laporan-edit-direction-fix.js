/* Laporan UI + Navigation + Performance Fix v20260916-7
 * - Laporan Saya : Edit.
 * - Daftar Laporan : read-only.
 * - Header : one row desktop/mobile.
 * - Summary : proportional cards.
 * - Laporan tabs : shared API cache + background prefetch.
 * - Loading : show explicit loading state instead of misleading zero values.
 */
(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }

  /* ============================================================
     RESPONSIVE HEADER
     ============================================================ */
  function installResponsiveHeaderFix(){
    if(el('ipsrs-responsive-header-fix')) return;
    var style=document.createElement('style');
    style.id='ipsrs-responsive-header-fix';
    style.textContent=''
      + 'html,body{overflow-x:hidden;}\n'
      + '.topbar{flex-wrap:nowrap !important;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;white-space:nowrap;}\n'
      + '.topbar::-webkit-scrollbar{display:none;}\n'
      + '.topbar-brand,.topbar-nav,.topbar-user{flex-shrink:0 !important;}\n'
      + '.topbar-user{display:flex !important;align-items:center;flex-wrap:nowrap !important;}\n'
      + '.user-chip,.logout-direct{flex-shrink:0 !important;white-space:nowrap;}\n'
      + '@media(max-width:700px){'
      + '.topbar{gap:4px!important;padding:6px 8px!important;}'
      + '.topbar-brand{margin-right:0!important;padding:3px 2px!important;}'
      + '.topbar-brand .logo-box{width:36px!important;height:36px!important;border-radius:10px!important;}'
      + '.topbar-brand-text{display:none!important;}'
      + '.topbar-nav{gap:0!important;}'
      + '.topbar-nav .nav-item{padding:7px 8px!important;gap:4px!important;font-size:11px!important;border-radius:9px!important;}'
      + '.topbar-nav .nav-item .icon{width:17px!important;height:17px!important;}'
      + '.topbar-user{margin-left:2px!important;gap:4px!important;}'
      + '.topbar-user .user-chip{padding:5px 6px!important;gap:4px!important;font-size:10px!important;}'
      + '.topbar-user .u-name{display:none!important;}'
      + '.logout-direct{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;border-radius:9px!important;}'
      + '.logout-direct span{display:none!important;}'
      + '.logout-direct svg{width:18px!important;height:18px!important;}'
      + '}\n'
      + '@media(max-width:360px){.topbar-nav .nav-item{padding-left:6px!important;padding-right:6px!important;font-size:10px!important;}.logout-direct{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;}}\n'
      + '#subtab-saya > .card:first-child > div:first-child{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:24px!important;width:100%!important;box-sizing:border-box!important;}\n'
      + '#subtab-saya > .card:first-child > div:first-child > div:first-child{flex:1 1 auto!important;min-width:220px!important;}\n'
      + '#subtab-saya .laporan-summary{display:grid!important;grid-template-columns:repeat(3,180px)!important;gap:12px!important;flex:0 0 564px!important;width:564px!important;min-width:564px!important;max-width:none!important;}\n'
      + '#subtab-saya .laporan-summary .stat-card{width:180px!important;min-width:180px!important;height:76px!important;min-height:76px!important;box-sizing:border-box!important;padding:12px 16px!important;margin:0!important;}\n'
      + '#subtab-saya .laporan-summary .s-value{font-size:24px!important;line-height:1.05!important;}\n'
      + '#subtab-saya .laporan-summary .s-label{font-size:12px!important;white-space:nowrap!important;}\n'
      + '@media(max-width:900px){#subtab-saya > .card:first-child > div:first-child{gap:14px!important;}#subtab-saya .laporan-summary{grid-template-columns:repeat(3,145px)!important;flex-basis:454px!important;width:454px!important;min-width:454px!important;}#subtab-saya .laporan-summary .stat-card{width:145px!important;min-width:145px!important;}}\n'
      + '@media(max-width:700px){#subtab-saya > .card:first-child > div:first-child{gap:10px!important;}#subtab-saya > .card:first-child > div:first-child > div:first-child{min-width:130px!important;}#subtab-saya .laporan-summary{grid-template-columns:repeat(3,112px)!important;flex-basis:344px!important;width:344px!important;min-width:344px!important;gap:4px!important;}#subtab-saya .laporan-summary .stat-card{width:112px!important;min-width:112px!important;height:68px!important;min-height:68px!important;padding:9px 10px!important;}#subtab-saya .laporan-summary .s-value{font-size:22px!important;}#subtab-saya .laporan-summary .s-label{font-size:11px!important;}}\n'
      + '@media(max-width:480px){#subtab-saya > .card:first-child{overflow-x:auto!important;}#subtab-saya > .card:first-child > div:first-child{min-width:500px!important;}}\n'
      + '.ipsrs-tab-loading{opacity:.72;pointer-events:none;}\n'
      + '.ipsrs-loading-value{font-weight:700;letter-spacing:2px;animation:ipsrsPulse 1.1s ease-in-out infinite;}\n'
      + '@keyframes ipsrsPulse{0%,100%{opacity:.35}50%{opacity:1}}\n';
    document.head.appendChild(style);
  }

  /* ============================================================
     EDIT / READ ONLY
     ============================================================ */
  function addSayaEditColumn(){
    var panel=el('subtab-saya');
    var table=panel&&panel.querySelector('table.data-table');
    var head=table&&table.querySelector('thead tr');
    var body=el('laporanSayaTableBody');
    if(!table||!head||!body) return;
    if(!head.querySelector('.laporan-saya-action-head')){
      var th=document.createElement('th');
      th.className='laporan-saya-action-head';
      th.textContent='Aksi';
      head.appendChild(th);
    }
    Array.prototype.forEach.call(body.querySelectorAll('tr'),function(tr){
      if(tr.querySelector('.laporan-saya-action')) return;
      var td=document.createElement('td');
      td.className='laporan-saya-action';
      var btn=document.createElement('button');
      btn.type='button';btn.className='btn';btn.textContent='✏️ Edit';
      btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();tr.click();});
      td.appendChild(btn);tr.appendChild(td);
    });
  }

  function makeDaftarReadOnly(){
    var panel=el('subtab-daftar');
    if(!panel) return;
    var table=panel.querySelector('table.data-table');
    if(table){
      var head=table.querySelector('thead tr');
      if(head){var h=head.lastElementChild;if(h&&String(h.textContent||'').trim().toLowerCase()==='aksi')h.style.display='none';}
      Array.prototype.forEach.call(table.querySelectorAll('tbody tr'),function(tr){
        var last=tr.lastElementChild;if(last)last.style.display='none';tr.style.cursor='default';
      });
    }
    Array.prototype.forEach.call(panel.querySelectorAll('.card-list .rcard'),function(card){card.style.cursor='default';card.onclick=null;});
  }

  function installDaftarReadOnlyGuard(){
    var panel=el('subtab-daftar');
    if(!panel||panel.__ipsrsReadonlyGuard)return;
    panel.__ipsrsReadonlyGuard=true;
    panel.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('tbody tr')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}
    },true);
  }

  /* ============================================================
     MONTH / FILTER CONTROLS
     ============================================================ */
  var dataInitDone=false;
  function ensureMonthOptions(){
    var ids=['DashBulan','FilterBulan','MonBulan','RekapBulan','MyFilterBulan'];
    var now=new Date(),opts=[];
    for(var i=0;i<12;i++){
      var d=new Date(now.getFullYear(),now.getMonth()-i,1);
      opts.push({val:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('id-ID',{month:'long',year:'numeric'})});
    }
    ids.forEach(function(id){
      var sel=el(id);if(!sel)return;
      if(sel.options.length===0)opts.forEach(function(o){var op=document.createElement('option');op.value=o.val;op.innerText=o.label;sel.appendChild(op);});
      if(!sel.value)sel.value=opts[0].val;
    });
  }
  function ensureBasicFilterOptions(){
    var bidang=window.BIDANG_LIST||['ME','Sipil','Workshop','Elektromedik','Kesling'];
    var shift=window.SHIFT_LIST||['Pagi','Siang','Malam'];
    [['FilterBidang',bidang],['MonFilterBidang',bidang],['FilterShift',shift],['MonFilterShift',shift]].forEach(function(pair){
      var sel=el(pair[0]);if(!sel||sel.options.length>1)return;
      pair[1].forEach(function(v){var o=document.createElement('option');o.value=v;o.innerText=v;sel.appendChild(o);});
    });
  }
  function ensureLaporanControls(){
    if(!el('page-laporan'))return false;
    ensureMonthOptions();ensureBasicFilterOptions();
    if(!dataInitDone&&typeof window.buildMonthOptions==='function'){
      try{window.buildMonthOptions();}catch(e){console.error('[ERR-UI-LAPORAN-INIT-001] laporan-edit-direction-fix.js::buildMonthOptions()',e);}
    }
    dataInitDone=true;return true;
  }

  /* ============================================================
     API CACHE + PREFETCH
     Tujuan: tiga tab tidak memanggil GAS berulang kali saat berpindah.
     Request pertama boleh tetap menunggu server, tetapi Monitoring/Rekap/
     Daftar berikutnya memakai hasil yang sudah sedang berjalan/tersimpan.
     ============================================================ */
  var CACHE_TTL=30000;
  var apiCache={};
  function installApiReadCache(){
    if(window.__ipsrsApiReadCacheInstalled||typeof window.gsRun!=='function')return;
    var original=window.gsRun;
    window.gsRun=function(fnName){
      var args=Array.prototype.slice.call(arguments,1);
      var cacheable=['apiGetReports','apiGetStaffMonitoring','apiGetMonthlyRecap','apiListStaff'].indexOf(fnName)>-1;
      if(!cacheable)return original.apply(this,arguments);
      var key=fnName+'|'+JSON.stringify(args.slice(1));
      var now=Date.now(),entry=apiCache[key];
      if(entry){
        if(entry.promise)return entry.promise;
        if(now-entry.time<CACHE_TTL)return Promise.resolve(entry.value);
        delete apiCache[key];
      }
      var promise=original.apply(this,arguments).then(function(json){
        apiCache[key]={time:Date.now(),value:json};
        return json;
      }).catch(function(err){delete apiCache[key];throw err;});
      apiCache[key]={time:now,promise:promise};
      return promise;
    };
    window.__ipsrsApiReadCacheInstalled=true;
    window.__ipsrsClearLaporanApiCache=function(){apiCache={};};
  }

  function isManagement(){
    try{
      var role=(typeof CURRENT_SESSION!=='undefined'&&CURRENT_SESSION)?CURRENT_SESSION.role:'';
      return ['KA_IPSRS','ADMINISTRASI','KASIE'].indexOf(role)>-1;
    }catch(e){return false;}
  }

  // P0 PERFORMANCE FIX v20260921:
  // Jangan melakukan prefetch beberapa API saat halaman Laporan baru tersedia.
  // Prefetch sebelumnya menembakkan hingga 4 request backend sekaligus.
  // Semua request tersebut mengakses GAS/Spreadsheet walaupun user belum
  // membuka tab yang membutuhkan datanya. Cache tetap dipertahankan agar
  // request yang benar-benar dibutuhkan dapat dibagi antar pemanggil.
  // Data sekarang dimuat LAZY hanya ketika tab dibuka.
  function prefetchLaporanData(){
    // Compatibility shim: beberapa script lama mungkin masih memanggil nama ini.
    return false;
  }

  function setLoading(name,on){
    var panel=el('subtab-'+name);if(!panel)return;
    panel.classList.toggle('ipsrs-tab-loading',!!on);
    if(!on)return;
    if(name==='saya'){
      ['laporanSayaTotal','laporanSayaSelesai','laporanSayaBelum'].forEach(function(id){var x=el(id);if(x)x.innerText='…';});
    }else if(name==='monitoring'){
      var g=el('monSummaryGrid');if(g)g.innerHTML='<div class="stat-card"><div class="s-value ipsrs-loading-value">…</div><div class="s-label">Memuat monitoring</div></div>';
      var c=el('monStaffGrid');if(c)c.innerHTML='<div class="smallnote">Mengambil data monitoring dari server…</div>';
    }else if(name==='rekap'){
      var rg=el('rekapSummaryGrid');if(rg)rg.innerHTML='<div class="stat-card"><div class="s-value ipsrs-loading-value">…</div><div class="s-label">Memuat rekap</div></div>';
      var rb=el('rekapStaffBody');if(rb)rb.innerHTML='<tr><td colspan="6" class="smallnote">Mengambil rekap dari server…</td></tr>';
    }else if(name==='daftar'){
      var db=el('reportTableBody');if(db)db.innerHTML='<tr><td colspan="14" class="smallnote">Mengambil daftar laporan dari server…</td></tr>';
      var dc=el('reportCardList');if(dc)dc.innerHTML='<div class="smallnote">Mengambil daftar laporan dari server…</div>';
    }
  }

  /* ============================================================
     TAB NAVIGATION
     ============================================================ */
  function showOnly(name){
    document.querySelectorAll('.sub-tab-panel').forEach(function(p){p.classList.add('hidden');});
    var panel=el('subtab-'+name);if(!panel)return false;
    panel.classList.remove('hidden');
    document.querySelectorAll('.sub-tab').forEach(function(b){b.classList.toggle('active',b.dataset.subtab===name);b.type='button';});
    return true;
  }

  function loadLaporanData(name){
    setLoading(name,true);
    try{
      if(name==='monitoring'&&typeof window.loadStaffMonitoring==='function')window.loadStaffMonitoring();
      else if(name==='rekap'&&typeof window.loadMonthlyRecap==='function')window.loadMonthlyRecap();
      else if(name==='daftar'&&typeof window.loadReportsBySelectedMonth==='function'){
        if(typeof window.loadAdminStaffListIfNeeded==='function')window.loadAdminStaffListIfNeeded();
        window.loadReportsBySelectedMonth();
      }
    }catch(e){console.error('[ERR-UI-LAPORAN-TAB-001] laporan-edit-direction-fix.js::loadLaporanData()',e);}
  }

  function refresh(){
    installResponsiveHeaderFix();
    installApiReadCache();
    ensureLaporanControls();
    addSayaEditColumn();
    makeDaftarReadOnly();
    installDaftarReadOnlyGuard();
  }

  var previousGo=window.goLaporanSubTab;
  window.goLaporanSubTab=function(name){
    if(!ensureLaporanControls()){
      setTimeout(function(){window.goLaporanSubTab(name);},50);return false;
    }
    if(name==='saya'){
      setLoading('saya',true);
      if(typeof previousGo==='function'){
        var result=previousGo(name);
        setTimeout(refresh,0);setTimeout(refresh,150);setTimeout(refresh,500);
        return result;
      }
      return false;
    }
    if(['monitoring','rekap','daftar'].indexOf(name)<0)return false;
    if(!showOnly(name))return false;
    var admin=el('adminStaffPanel');if(admin)admin.classList.toggle('hidden',name!=='daftar');
    setTimeout(function(){refresh();loadLaporanData(name);},0);
    return true;
  };

  // P0: inisialisasi Laporan harus ringan. Tidak ada prefetch backend di sini.
  // Request dilakukan lazy oleh goLaporanSubTab() ketika tab benar-benar dibuka.
  function startWhenLaporanReady(){
    if(!el('page-laporan')){setTimeout(startWhenLaporanReady,100);return;}
    refresh();
  }

  installResponsiveHeaderFix();
  installApiReadCache();
  var obs=new MutationObserver(function(){
    if(el('page-laporan')){refresh();}
  });
  obs.observe(document.body,{childList:true,subtree:true});
  if(document.readyState!=='loading')startWhenLaporanReady();
  else document.addEventListener('DOMContentLoaded',startWhenLaporanReady);
  // Tidak ada delayed prefetch. Hindari request backend tanpa aksi user.
})();
