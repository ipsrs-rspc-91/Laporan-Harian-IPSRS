/* Laporan Edit Direction Fix v20260916-2
 * Laporan Saya  : memiliki tombol Edit.
 * Daftar Laporan: read-only, tanpa tombol Edit.
 */
(function(){
  'use strict';

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
