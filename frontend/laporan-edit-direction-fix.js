/* Laporan Edit Direction + Navigation/Data Init Fix v20260916-5
 * Laporan Saya  : memiliki tombol Edit.
 * Daftar Laporan: read-only, tanpa tombol Edit.
 * Header         : satu baris pada desktop dan HP, tanpa tombol Keluar turun.
 * Rekap/Daftar   : memastikan kontrol bulan siap setelah Page_Laporan dimuat.
 * Summary        : kartu Total/Selesai/Belum dibuat proporsional seperti summary utama.
 */
(function(){
  'use strict';

  /* ================================================================
   * RESPONSIVE HEADER + LAPORAN SAYA SUMMARY FIX
   * ================================================================ */
  function installResponsiveHeaderFix(){
    if(document.getElementById('ipsrs-responsive-header-fix')) return;
    var style = document.createElement('style');
    style.id = 'ipsrs-responsive-header-fix';
    style.textContent = '\n'
      + 'html,body{overflow-x:hidden;}\n'
      + '.topbar{flex-wrap:nowrap !important; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; white-space:nowrap;}\n'
      + '.topbar::-webkit-scrollbar{display:none;}\n'
      + '.topbar-brand,.topbar-nav,.topbar-user{flex-shrink:0 !important;}\n'
      + '.topbar-brand{min-width:0;}\n'
      + '.topbar-nav{flex-shrink:0 !important;}\n'
      + '.topbar-user{display:flex !important; align-items:center; flex-wrap:nowrap !important;}\n'
      + '.user-chip,.logout-direct{flex-shrink:0 !important; white-space:nowrap;}\n'
      + '@media (max-width:700px){\n'
      + '  .topbar{gap:4px !important; padding:6px 8px !important;}\n'
      + '  .topbar-brand{margin-right:0 !important; padding:3px 2px !important;}\n'
      + '  .topbar-brand .logo-box{width:36px !important; height:36px !important; border-radius:10px !important;}\n'
      + '  .topbar-brand-text{display:none !important;}\n'
      + '  .topbar-nav{gap:0 !important;}\n'
      + '  .topbar-nav .nav-item{padding:7px 8px !important; gap:4px !important; font-size:11px !important; border-radius:9px !important;}\n'
      + '  .topbar-nav .nav-item .icon{width:17px !important; height:17px !important;}\n'
      + '  .topbar-user{margin-left:2px !important; gap:4px !important;}\n'
      + '  .topbar-user .user-chip{padding:5px 6px !important; gap:4px !important; font-size:10px !important;}\n'
      + '  .topbar-user .u-avatar{max-width:48px !important; min-width:24px !important; width:auto !important; height:24px !important; font-size:9px !important; padding:0 5px !important;}\n'
      + '  .topbar-user .u-name{display:none !important;}\n'
      + '  .topbar-user .icon-sm{width:13px !important; height:13px !important;}\n'
      + '  .logout-direct{min-width:38px !important; width:38px !important; height:38px !important; min-height:38px !important; padding:0 !important; border-radius:9px !important;}\n'
      + '  .logout-direct span{display:none !important;}\n'
      + '  .logout-direct svg{width:18px !important; height:18px !important;}\n'
      + '}\n'
      + '@media (max-width:360px){\n'
      + '  .topbar{padding-left:5px !important; padding-right:5px !important;}\n'
      + '  .topbar-nav .nav-item{padding-left:6px !important; padding-right:6px !important; font-size:10px !important;}\n'
      + '  .topbar-nav .nav-item .icon{width:16px !important; height:16px !important;}\n'
      + '  .logout-direct{width:36px !important; min-width:36px !important; height:36px !important; min-height:36px !important;}\n'
      + '}\n'
      + '\n'
      + '/* ============================================================\n'
      + '   LAPORAN SAYA: summary cards dibuat sama-sama lebar dan rapi.\n'
      + '   Struktur Page_Laporan: .card > div(header) > .laporan-summary.\n'
      + '   Sebelumnya selector memakai #panel-laporan-saya yang tidak ada.\n'
      + '   ============================================================ */\n'
      + '#subtab-saya .laporan-summary{\n'
      + '  display:grid !important;\n'
      + '  grid-template-columns:repeat(3,minmax(150px,1fr)) !important;\n'
      + '  gap:12px !important;\n'
      + '  flex:1 1 auto !important;\n'
      + '  width:100% !important;\n'
      + '  min-width:0 !important;\n'
      + '  max-width:520px !important;\n'
      + '  overflow:visible !important;\n'
      + '}\n'
      + '#subtab-saya .laporan-summary .stat-card{\n'
      + '  width:auto !important;\n'
      + '  min-width:0 !important;\n'
      + '  min-height:76px !important;\n'
      + '  box-sizing:border-box !important;\n'
      + '  padding:12px 16px !important;\n'
      + '}\n'
      + '#subtab-saya .laporan-summary .s-value{font-size:24px !important; line-height:1.05 !important;}\n'
      + '#subtab-saya .laporan-summary .s-label{font-size:12px !important; white-space:nowrap !important;}\n'
      + '#subtab-saya > .card:first-child > div:first-child{\n'
      + '  display:flex !important;\n'
      + '  align-items:center !important;\n'
      + '  gap:24px !important;\n'
      + '}\n'
      + '#subtab-saya > .card:first-child > div:first-child > div:first-child{\n'
      + '  flex:0 1 auto !important;\n      min-width:170px !important;\n      }\n'
      + '@media (max-width:900px){\n'
      + '  #subtab-saya .laporan-summary{max-width:480px !important; grid-template-columns:repeat(3,minmax(130px,1fr)) !important;}\n'
      + '}\n'
      + '@media (max-width:700px){\n'
      + '  #subtab-saya > .card:first-child > div:first-child{gap:12px !important; align-items:stretch !important;}\n'
      + '  #subtab-saya > .card:first-child > div:first-child > div:first-child{min-width:115px !important;}\n'
      + '  #subtab-saya .laporan-summary{\n'
      + '    max-width:none !important;\n'
      + '    width:max-content !important;\n'
      + '    grid-template-columns:repeat(3,120px) !important;\n'
      + '    flex:0 0 auto !important;\n'
      + '    overflow:visible !important;\n'
      + '  }\n'
      + '  #subtab-saya .laporan-summary .stat-card{min-width:120px !important; min-height:68px !important; padding:10px 12px !important;}\n'
      + '}\n';
    document.head.appendChild(style);
  }

  function el(id){ return document.getElementById(id); }

  function addSayaEditColumn(){
    var panel = el('subtab-saya');
    if(!panel) return;
    var table = panel.querySelector('table.data-table');
    var head = table && table.querySelector('thead tr');
    var body = el('laporanSayaTableBody');
    if(!table || !head || !body) return;

    if(!head.querySelector('.laporan-saya-action-head')){
      var th = document.createElement('th');
      th.className = 'laporan-saya-action-head';
      th.textContent = 'Aksi';
      head.appendChild(th);
    }

    Array.prototype.forEach.call(body.querySelectorAll('tr'), function(tr){
      if(tr.querySelector('.laporan-saya-action')) return;
      var td = document.createElement('td');
      td.className = 'laporan-saya-action';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = '✏️ Edit';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        tr.click();
      });
      td.appendChild(btn);
      tr.appendChild(td);
    });
  }

  function makeDaftarReadOnly(){
    var panel = el('subtab-daftar');
    if(!panel) return;
    var table = panel.querySelector('table.data-table');
    if(table){
      var head = table.querySelector('thead tr');
      if(head){
        var lastHead = head.lastElementChild;
        if(lastHead && String(lastHead.textContent || '').trim().toLowerCase() === 'aksi') lastHead.style.display = 'none';
      }
      Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(tr){
        var last = tr.lastElementChild;
        if(last) last.style.display = 'none';
        tr.style.cursor = 'default';
      });
    }
    var cards = panel.querySelectorAll('.card-list .rcard');
    Array.prototype.forEach.call(cards, function(card){
      card.style.cursor = 'default';
      card.onclick = null;
    });
  }

  function installDaftarReadOnlyGuard(){
    var panel = el('subtab-daftar');
    if(!panel || panel.__ipsrsReadonlyGuard) return;
    panel.__ipsrsReadonlyGuard = true;
    panel.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('tbody tr')){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  var dataInitDone = false;

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
          op.value=o.val;
          op.innerText=o.label;
          sel.appendChild(op);
        });
      }
      if(!sel.value && opts.length) sel.value=opts[0].val;
    });
  }

  function ensureBasicFilterOptions(){
    var bidangList = window.BIDANG_LIST || ['ME','Sipil','Workshop','Elektromedik','Kesling'];
    var shiftList = window.SHIFT_LIST || ['Pagi','Siang','Malam'];
    [['FilterBidang',bidangList],['MonFilterBidang',bidangList]].forEach(function(pair){
      var sel=el(pair[0]);
      if(!sel || sel.options.length>1) return;
      pair[1].forEach(function(v){ var o=document.createElement('option'); o.value=v; o.innerText=v; sel.appendChild(o); });
    });
    [['FilterShift',shiftList],['MonFilterShift',shiftList]].forEach(function(pair){
      var sel=el(pair[0]);
      if(!sel || sel.options.length>1) return;
      pair[1].forEach(function(v){ var o=document.createElement('option'); o.value=v; o.innerText=v; sel.appendChild(o); });
    });
  }

  function ensureLaporanControls(){
    if(!el('page-laporan')) return false;
    ensureMonthOptions();
    ensureBasicFilterOptions();
    if(!dataInitDone && typeof window.buildMonthOptions === 'function'){
      try{ window.buildMonthOptions(); }catch(e){
        console.error('[ERR-UI-LAPORAN-INIT-001] laporan-edit-direction-fix.js::buildMonthOptions()',e);
      }
    }
    dataInitDone=true;
    return true;
  }

  function showOnly(name){
    document.querySelectorAll('.sub-tab-panel').forEach(function(p){ p.classList.add('hidden'); });
    var panel=el('subtab-'+name);
    if(!panel) return false;
    panel.classList.remove('hidden');
    document.querySelectorAll('.sub-tab').forEach(function(b){
      b.classList.toggle('active',b.dataset.subtab===name);
      b.type='button';
    });
    return true;
  }

  function loadLaporanData(name){
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
      console.error('[ERR-UI-LAPORAN-TAB-001] laporan-edit-direction-fix.js::loadLaporanData()',e);
    }
  }

  function refresh(){
    installResponsiveHeaderFix();
    ensureLaporanControls();
    addSayaEditColumn();
    makeDaftarReadOnly();
  }

  var previousGo = window.goLaporanSubTab;
  window.goLaporanSubTab = function(name){
    if(!ensureLaporanControls()){
      setTimeout(function(){ window.goLaporanSubTab(name); },50);
      return false;
    }

    if(name==='saya'){
      if(typeof previousGo==='function'){
        var resultSaya = previousGo(name);
        setTimeout(refresh,0);
        setTimeout(refresh,150);
        setTimeout(refresh,500);
        return resultSaya;
      }
      return false;
    }

    if(name!=='monitoring' && name!=='rekap' && name!=='daftar') return false;
    if(!showOnly(name)) return false;

    var admin=el('adminStaffPanel');
    if(admin) admin.classList.toggle('hidden',name!=='daftar');

    setTimeout(function(){ refresh(); loadLaporanData(name); },0);
    return true;
  };

  installResponsiveHeaderFix();

  var obs = new MutationObserver(function(){ refresh(); });
  obs.observe(document.body, {childList:true, subtree:true});

  if(document.readyState !== 'loading') refresh();
  else document.addEventListener('DOMContentLoaded', refresh);
  setTimeout(refresh,0);
  setTimeout(refresh,150);
  setTimeout(refresh,500);
  setTimeout(refresh,1200);
})();
