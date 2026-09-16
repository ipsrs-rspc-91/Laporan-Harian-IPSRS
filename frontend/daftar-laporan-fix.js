/* Daftar Laporan compatibility fix v20260916-2
 * IMPORTANT:
 * - Jangan mengganti loadReportsBySelectedMonth secara global.
 * - Laporan Saya dan Daftar Laporan memakai loader utama app.js.
 * - Daftar hanya mengatur mode/tab dan menambahkan opsi Semua Bulan.
 * - Laporan Saya selalu membersihkan filter Petugas yang mungkin tersisa dari Daftar.
 * - Tidak mengubah backend/GAS.
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

  function clearSayaStaffFilter(){
    /* adminSelectedStaffId adalah global lexical binding dari app.js.
       Reset di sini supaya filter petugas Daftar tidak terbawa ke Laporan Saya. */
    try{ adminSelectedStaffId=''; }catch(e){
      console.warn('[ERR-UI-DAFTAR-006] Gagal mereset filter petugas:',e);
    }
    var sel=el('adminStaffSelect');
    if(sel) sel.value='';
    var pill=el('adminStaffActivePill');
    if(pill) pill.classList.add('hidden');
  }

  function install(){
    if(!el('page-laporan')) return false;
    ensureAllMonthOption();

    var oldGo=window.goLaporanSubTab;
    if(typeof oldGo!=='function') return false;
    if(oldGo.__ipsrsDaftarCompatibilityFix) return true;

    var wrapped=function(name){
      if(name==='saya'){
        clearSayaStaffFilter();
        return oldGo.apply(this,arguments);
      }

      if(name==='daftar'){
        ensureAllMonthOption();
        /* Biarkan goLaporanSubTab utama mengatur _laporanMode='daftar'
           dan memanggil loader utama app.js. Jangan bypass loader. */
        var result=oldGo.apply(this,arguments);
        setTimeout(function(){ ensureAllMonthOption(); },0);
        return result;
      }

      return oldGo.apply(this,arguments);
    };

    wrapped.__ipsrsDaftarCompatibilityFix=true;
    window.goLaporanSubTab=wrapped;
    return true;
  }

  var tries=0;
  function boot(){
    if(install()) return;
    if(++tries<40) setTimeout(boot,250);
    else console.error('[ERR-UI-DAFTAR-007] Panel Laporan tidak ditemukan setelah menunggu.');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
