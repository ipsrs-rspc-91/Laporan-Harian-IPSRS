/* Daftar Laporan Fix v20260916-1
 * Tujuan:
 * - Daftar Laporan benar-benar memuat seluruh laporan yang boleh dilihat.
 * - Default Daftar Laporan = Semua Bulan, bukan hanya bulan berjalan.
 * - Tetap menyediakan filter bulan bila user ingin mempersempit hasil.
 * - Tidak mengubah backend/GAS.
 * - Menampilkan status loading/error yang jelas.
 */
(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }

  function ensureAllMonthOption(){
    var sel=el('FilterBulan');
    if(!sel) return false;
    if(!Array.prototype.some.call(sel.options,function(o){return o.value==='';})){
      var opt=document.createElement('option');
      opt.value='';
      opt.textContent='Semua Bulan';
      sel.insertBefore(opt,sel.firstChild);
    }
    return true;
  }

  function showLoading(){
    var body=el('reportTableBody'), cards=el('reportCardList');
    if(body) body.innerHTML='<tr><td colspan="13" class="smallnote">Memuat daftar laporan dari server…</td></tr>';
    if(cards) cards.innerHTML='<div class="smallnote">Memuat daftar laporan dari server…</div>';
    var total=el('lapTotal'), selesai=el('lapSelesai'), belum=el('lapBelum');
    if(total) total.textContent='…';
    if(selesai) selesai.textContent='…';
    if(belum) belum.textContent='…';
    var msg=el('msgReport');
    if(msg) msg.textContent='Mengambil daftar laporan dari server…';
    if(window.__ipsrsShowLaporanLoading) window.__ipsrsShowLaporanLoading('daftar');
  }

  async function loadDaftarLaporan(){
    if(typeof authRun!=='function'){
      console.error('[ERR-UI-DAFTAR-001] authRun belum tersedia.');
      return;
    }
    ensureAllMonthOption();
    showLoading();
    try{
      var bulan=(el('FilterBulan')||{}).value || '';
      var json=await authRun('apiGetReports',bulan,'','','');
      if(!json || json.ok!==true){
        var msg=(json&&json.msg)?json.msg:'Server tidak mengembalikan data laporan.';
        if(el('msgReport')) el('msgReport').textContent='Gagal memuat Daftar Laporan: '+msg;
        if(el('reportTableBody')) el('reportTableBody').innerHTML='<tr><td colspan="13" class="smallnote">Gagal memuat daftar laporan.</td></tr>';
        if(el('reportCardList')) el('reportCardList').innerHTML='<div class="smallnote">Gagal memuat daftar laporan.</div>';
        console.error('[ERR-UI-DAFTAR-002]',msg);
        return;
      }

      var rows=Array.isArray(json.data)?json.data:[];
      if(typeof rawData!=='undefined') rawData=rows;
      if(rows.length===0){
        if(typeof applyFilters==='function') applyFilters();
        if(el('msgReport')) el('msgReport').textContent='Tidak ada laporan untuk filter yang dipilih.';
        console.warn('[ERR-UI-DAFTAR-003] Server mengembalikan 0 laporan. bulan=',bulan||'SEMUA');
      }else if(typeof applyFilters==='function'){
        applyFilters();
      }else if(typeof renderReportTable==='function'){
        renderReportTable(rows);
      }
    }catch(err){
      var text=err&&err.message?err.message:String(err);
      if(el('msgReport')) el('msgReport').textContent='Error memuat Daftar Laporan: '+text;
      if(el('reportTableBody')) el('reportTableBody').innerHTML='<tr><td colspan="13" class="smallnote">Terjadi kesalahan saat mengambil data laporan.</td></tr>';
      if(el('reportCardList')) el('reportCardList').innerHTML='<div class="smallnote">Terjadi kesalahan saat mengambil data laporan.</div>';
      console.error('[ERR-UI-DAFTAR-004] loadDaftarLaporan()',err);
    }finally{
      if(window.__ipsrsClearLaporanLoading) window.__ipsrsClearLaporanLoading('daftar');
    }
  }

  function install(){
    if(!el('page-laporan')) return false;
    ensureAllMonthOption();

    /* Daftar Laporan memakai loader khusus. */
    window.loadReportsBySelectedMonth=loadDaftarLaporan;

    /* Pastikan setiap klik Daftar Laporan memakai loader khusus ini. */
    var oldGo=window.goLaporanSubTab;
    if(typeof oldGo==='function'&&!oldGo.__ipsrsDaftarFixWrapped){
      var wrapped=function(name){
        if(name==='daftar'){
          document.querySelectorAll('.sub-tab-panel').forEach(function(p){p.classList.add('hidden');});
          var panel=el('subtab-daftar');
          if(!panel) return false;
          panel.classList.remove('hidden');
          document.querySelectorAll('.sub-tab').forEach(function(b){b.classList.toggle('active',b.dataset.subtab==='daftar');});
          var admin=el('adminStaffPanel');
          if(admin) admin.classList.remove('hidden');
          loadDaftarLaporan();
          return true;
        }
        return oldGo.apply(this,arguments);
      };
      wrapped.__ipsrsDaftarFixWrapped=true;
      window.goLaporanSubTab=wrapped;
    }
    return true;
  }

  var tries=0;
  function boot(){
    if(install()) return;
    if(++tries<40) setTimeout(boot,250);
    else console.error('[ERR-UI-DAFTAR-005] Panel Laporan tidak ditemukan setelah menunggu.');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
