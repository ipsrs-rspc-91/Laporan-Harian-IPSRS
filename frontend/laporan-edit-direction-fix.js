/* Laporan Edit Direction Fix v20260916-1
 * Laporan Saya  : memiliki tombol Edit.
 * Daftar Laporan: read-only, tanpa tombol Edit.
 */
(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }
  function safe(v){ return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v); }

  function addSayaEditColumn(){
    var table = el('subtab-saya') && el('subtab-saya').querySelector('table.data-table');
    if(!table) return;
    var head = table.querySelector('thead tr');
    var body = el('laporanSayaTableBody');
    if(!head || !body) return;

    if(!head.querySelector('.laporan-saya-action-head')){
      var th = document.createElement('th');
      th.className = 'laporan-saya-action-head';
      th.textContent = 'Aksi';
      head.appendChild(th);
    }

    Array.prototype.forEach.call(body.querySelectorAll('tr'), function(tr){
      var old = tr.querySelector('.laporan-saya-action');
      if(old) return;
      var id = tr.__ipsrsReportId || '';
      var cells = tr.children;
      if(!id && cells.length){
        /* ID tidak tampil di tabel; ambil berdasarkan urutan dari data cache. */
        var rows = window.__IPSRS_REPORTS || {};
        for(var key in rows){
          if(rows[key] && rows[key].Tanggal != null &&
             rows[key].Ruang != null &&
             String(rows[key].Tanggal) === String(cells[0].innerText || '') &&
             String(rows[key].Ruang) === String(cells[2].innerText || '')){
            id = key;
            break;
          }
        }
      }
      var td = document.createElement('td');
      td.className = 'laporan-saya-action';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = '✏️ Edit';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var report = id && window.__IPSRS_REPORTS ? window.__IPSRS_REPORTS[String(id)] : null;
        if(report && typeof openEditModalForReport === 'function') openEditModalForReport(report);
        else if(typeof tr._ipsrsReport === 'object' && typeof openEditModalForReport === 'function') openEditModalForReport(tr._ipsrsReport);
      });
      td.appendChild(btn);
      tr.appendChild(td);
    });
  }

  function patchSayaRows(){
    var body = el('laporanSayaTableBody');
    if(!body) return;
    var rows = Array.isArray(window.__ipsrsMyData) ? window.__ipsrsMyData : null;
    if(rows){
      Array.prototype.forEach.call(body.querySelectorAll('tr'), function(tr, i){
        if(rows[i]){
          tr._ipsrsReport = rows[i];
          if(rows[i].ID != null) tr.__ipsrsReportId = String(rows[i].ID);
        }
      });
    }
    addSayaEditColumn();
  }

  function makeDaftarReadOnly(){
    var panel = el('subtab-daftar');
    if(!panel) return;
    var table = panel.querySelector('table.data-table');
    if(table){
      var head = table.querySelector('thead tr');
      if(head){
        var last = head.lastElementChild;
        if(last && String(last.textContent || '').trim().toLowerCase() === 'aksi') last.style.display = 'none';
      }
      Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(tr){
        var last = tr.lastElementChild;
        if(last) last.style.display = 'none';
        tr.style.cursor = 'default';
      });
    }
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
    patchSayaRows();
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
