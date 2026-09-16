/* Laporan Loading State v20260916-2
 * Standard modal loading spinner for all Laporan sub-tabs.
 * - Laporan Saya
 * - Monitoring Harian
 * - Rekap Bulanan
 * - Daftar Laporan
 *
 * Overlay is centered on the viewport and slightly blurs the page behind it.
 * Does not call GAS directly and does not change backend logic.
 */
(function(){
  'use strict';

  var STYLE_ID='ipsrs-laporan-loading-style-v2';
  var OVERLAY_ID='ipsrsLaporanLoadingOverlay';
  var activeName='';
  var safetyTimer=null;

  function el(id){ return document.getElementById(id); }

  function escapeHtml(v){
    return String(v==null?'':v)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function installStyle(){
    if(el(STYLE_ID)) return;
    var s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=''
      + '#'+OVERLAY_ID+'{position:fixed!important;inset:0!important;z-index:99999!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:20px!important;box-sizing:border-box!important;background:rgba(15,23,42,.20)!important;backdrop-filter:blur(3px)!important;-webkit-backdrop-filter:blur(3px)!important;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-box{width:min(430px,calc(100vw - 40px));box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px 28px 26px;border:1px solid rgba(226,232,240,.95);border-radius:16px;background:rgba(255,255,255,.98);box-shadow:0 18px 55px rgba(15,23,42,.22);text-align:center;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-spinner{width:52px;height:52px;border:5px solid #dbe4ee;border-top-color:#0f6f8c;border-right-color:#0f6f8c;border-radius:50%;animation:ipsrsLaporanSpin .78s linear infinite;box-sizing:border-box;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-title{font-size:18px;font-weight:800;color:#16324a;line-height:1.3;margin-top:2px;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-detail{font-size:13px;color:#64748b;line-height:1.5;max-width:330px;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-error{border-color:#fecaca;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-error .ipsrs-loading-title{color:#b91c1c;}\n'
      + '@keyframes ipsrsLaporanSpin{to{transform:rotate(360deg);}}\n'
      + '@media(max-width:600px){#'+OVERLAY_ID+'{padding:16px}#'+OVERLAY_ID+' .ipsrs-loading-box{width:min(360px,calc(100vw - 32px));padding:24px 20px 22px}#'+OVERLAY_ID+' .ipsrs-loading-spinner{width:46px;height:46px}#'+OVERLAY_ID+' .ipsrs-loading-title{font-size:16px}#'+OVERLAY_ID+' .ipsrs-loading-detail{font-size:12px}}';
    document.head.appendChild(s);
  }

  var labels={
    saya:['Memuat Laporan Saya','Mohon tunggu, sistem sedang mengambil data laporan Anda.'],
    monitoring:['Memuat Monitoring Harian','Mohon tunggu, sistem sedang mengambil data monitoring.'],
    rekap:['Memuat Rekap Bulanan','Mohon tunggu, sistem sedang mengambil rekap laporan.'],
    daftar:['Memuat Daftar Laporan','Mohon tunggu, sistem sedang mengambil daftar laporan.']
  };

  function getOverlay(){ return el(OVERLAY_ID); }

  function show(name){
    if(!labels[name]) return;
    installStyle();
    activeName=name;
    var old=getOverlay();
    if(old) old.remove();
    var o=document.createElement('div');
    o.id=OVERLAY_ID;
    o.setAttribute('role','status');
    o.setAttribute('aria-live','polite');
    o.innerHTML='<div class="ipsrs-loading-box">'
      +'<div class="ipsrs-loading-spinner" aria-hidden="true"></div>'
      +'<div class="ipsrs-loading-title">'+escapeHtml(labels[name][0])+'</div>'
      +'<div class="ipsrs-loading-detail">'+escapeHtml(labels[name][1])+'</div>'
      +'</div>';
    document.body.appendChild(o);

    if(safetyTimer) clearTimeout(safetyTimer);
    safetyTimer=setTimeout(function(){
      if(getOverlay()) clear();
    },30000);
  }

  function clear(){
    var o=getOverlay();
    if(o) o.remove();
    if(safetyTimer){ clearTimeout(safetyTimer); safetyTimer=null; }
    activeName='';
  }

  function showError(name,message){
    installStyle();
    var old=getOverlay();
    if(old) old.remove();
    var o=document.createElement('div');
    o.id=OVERLAY_ID;
    o.setAttribute('role','alert');
    o.innerHTML='<div class="ipsrs-loading-box ipsrs-loading-error">'
      +'<div class="ipsrs-loading-title">Gagal memuat data</div>'
      +'<div class="ipsrs-loading-detail">'+escapeHtml(message||'Silakan coba lagi.')+'</div>'
      +'</div>';
    document.body.appendChild(o);
    if(safetyTimer) clearTimeout(safetyTimer);
    safetyTimer=setTimeout(clear,3500);
  }

  function currentReportTab(){
    var b=document.querySelector('.sub-tab.active[data-subtab="saya"],.sub-tab.active[data-subtab="daftar"]');
    if(b) return b.getAttribute('data-subtab');
    var p=document.querySelector('.sub-tab[data-subtab="saya"].active,.sub-tab[data-subtab="daftar"].active');
    if(p) return p.getAttribute('data-subtab');
    return 'saya';
  }

  function wrapLoader(fnName,resolveName){
    var fn=window[fnName];
    if(typeof fn!=='function') return false;
    if(fn.__ipsrsLoadingWrappedV2) return true;

    function wrapped(){
      var name=(typeof resolveName==='function') ? resolveName() : resolveName;
      show(name);
      try{
        var result=fn.apply(this,arguments);
        if(result && typeof result.then==='function'){
          return result.then(function(v){
            clear();
            return v;
          },function(err){
            showError(name,err&&err.message?err.message:'Server tidak dapat dihubungi.');
            throw err;
          });
        }
        clear();
        return result;
      }catch(err){
        showError(name,err&&err.message?err.message:'Terjadi kesalahan.');
        throw err;
      }
    }
    wrapped.__ipsrsLoadingWrappedV2=true;
    window[fnName]=wrapped;
    return true;
  }

  function install(){
    installStyle();

    /* Reports loader is shared by Laporan Saya and Daftar Laporan. */
    wrapLoader('loadReportsBySelectedMonth',currentReportTab);
    wrapLoader('loadStaffMonitoring','monitoring');
    wrapLoader('loadMonthlyRecap','rekap');

    document.addEventListener('click',function(e){
      var b=e.target && e.target.closest ? e.target.closest('.sub-tab') : null;
      if(!b) return;
      var name=b.getAttribute('data-subtab');
      if(labels[name]) show(name);
    },true);

    var originalGo=window.goLaporanSubTab;
    if(typeof originalGo==='function'&&!originalGo.__ipsrsLoadingGoV2){
      var wrappedGo=function(name){
        if(labels[name]) show(name);
        try{
          var result=originalGo.apply(this,arguments);
          if(result && typeof result.then==='function'){
            return result.then(function(v){clear();return v;},function(err){showError(name,err&&err.message?err.message:'Terjadi kesalahan.');throw err;});
          }
          return result;
        }catch(err){
          showError(name,err&&err.message?err.message:'Terjadi kesalahan.');
          throw err;
        }
      };
      wrappedGo.__ipsrsLoadingGoV2=true;
      window.goLaporanSubTab=wrappedGo;
    }

    window.__ipsrsShowLaporanLoading=show;
    window.__ipsrsClearLaporanLoading=clear;
    window.__ipsrsLaporanLoadingError=showError;
  }

  function boot(){
    install();
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      wrapLoader('loadReportsBySelectedMonth',currentReportTab);
      wrapLoader('loadStaffMonitoring','monitoring');
      wrapLoader('loadMonthlyRecap','rekap');
      if(tries>=30) clearInterval(timer);
    },500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
