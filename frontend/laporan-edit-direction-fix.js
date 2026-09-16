/* Laporan Edit Direction Fix v20260916-3
 * Laporan Saya  : memiliki tombol Edit.
 * Daftar Laporan: read-only, tanpa tombol Edit.
 * Header         : satu baris pada desktop dan HP, tanpa tombol Keluar turun.
 */
(function(){
  'use strict';

  /* ================================================================
   * RESPONSIVE HEADER FIX
   * Jangan biarkan topbar melakukan wrap. Pada layar sempit elemen
   * dipadatkan agar tetap satu baris; jika sangat sempit, header dapat
   * digeser horizontal, tetapi TIDAK ada elemen yang turun ke baris 2.
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
        /* Baris Laporan Saya sudah memiliki onclick asli yang membawa objek report. */
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

  function refresh(){
    installResponsiveHeaderFix();
    addSayaEditColumn();
    makeDaftarReadOnly();
    installDaftarReadOnlyGuard();
  }

  function wrapNavigation(){
    if(typeof window.goLaporanSubTab !== 'function' || window.__ipsrsEditDirectionWrapped) return;
    var original = window.goLaporanSubTab;
    window.goLaporanSubTab = function(name){
      var result = original.apply(this, arguments);
      setTimeout(refresh, 0);
      setTimeout(refresh, 150);
      setTimeout(refresh, 500);
      setTimeout(refresh, 1200);
      return result;
    };
    window.__ipsrsEditDirectionWrapped = true;
  }

  installResponsiveHeaderFix();

  var obs = new MutationObserver(function(){
    wrapNavigation();
    refresh();
  });
  obs.observe(document.body, {childList:true, subtree:true});

  if(document.readyState !== 'loading') wrapNavigation();
  else document.addEventListener('DOMContentLoaded', wrapNavigation);
  setTimeout(wrapNavigation, 0);
  setTimeout(refresh, 500);
})();
