/* Laporan Loading State v20260920-1
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
  var loadingTimer=null;
  var loadingStartedAt=0;

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
      + '#'+OVERLAY_ID+' .ipsrs-loading-spinner{width:68px;height:68px;display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:2px;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-lightning{font-size:54px;line-height:1;display:inline-block;position:relative;z-index:2;color:#f5b400;text-shadow:0 0 4px rgba(245,180,0,.35);animation:ipsrsLightningFlash .62s ease-in-out infinite;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-lightning-ring{position:absolute;inset:4px;border:2px solid rgba(15,111,140,.22);border-radius:50%;animation:ipsrsLightningRing 1.15s ease-out infinite;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-lightning-ring2{position:absolute;inset:10px;border:1px dashed rgba(15,111,140,.18);border-radius:50%;animation:ipsrsLightningRing2 1.15s ease-out infinite .18s;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-title{font-size:18px;font-weight:800;color:#16324a;line-height:1.3;margin-top:2px;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-detail{font-size:13px;color:#64748b;line-height:1.5;max-width:330px;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-loading-timer{font-size:14px;font-weight:800;color:#0f6f8c;letter-spacing:.5px;min-width:78px;margin-top:2px;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-error{border-color:#fecaca;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-error .ipsrs-loading-title{color:#b91c1c;}\n'
      + '@keyframes ipsrsLightningFlash{0%,100%{transform:scale(1) rotate(-3deg);opacity:.72;}18%{transform:scale(1.15) rotate(3deg);opacity:1;}34%{transform:scale(.92) rotate(-2deg);opacity:.78;}52%{transform:scale(1.10) rotate(2deg);opacity:1;}72%{transform:scale(.97) rotate(-1deg);opacity:.88;}}\n'
  + '@keyframes ipsrsLightningRing{0%{transform:scale(.62);opacity:.65;}100%{transform:scale(1.22);opacity:0;}}\n'
  + '@keyframes ipsrsLightningRing2{0%{transform:scale(.72) rotate(0deg);opacity:.55;}100%{transform:scale(1.16) rotate(90deg);opacity:0;}}\n'
      + '@media(max-width:600px){#'+OVERLAY_ID+'{padding:16px}#'+OVERLAY_ID+' .ipsrs-loading-box{width:min(360px,calc(100vw - 32px));padding:24px 20px 22px}#'+OVERLAY_ID+' .ipsrs-loading-spinner{width:58px;height:58px}#'+OVERLAY_ID+' .ipsrs-lightning{font-size:46px}#'+OVERLAY_ID+' .ipsrs-loading-title{font-size:16px}#'+OVERLAY_ID+' .ipsrs-loading-detail{font-size:12px}}';
    document.head.appendChild(s);
  }

  var labels={
    saya:['Memuat Laporan Saya','Mohon tunggu, sistem sedang mengambil data laporan Anda.'],
    monitoring:['Memuat Monitoring Harian','Mohon tunggu, sistem sedang mengambil data monitoring.'],
    rekap:['Memuat Rekap Bulanan','Mohon tunggu, sistem sedang mengambil rekap laporan.'],
    daftar:['Memuat Daftar Laporan','Mohon tunggu, sistem sedang mengambil daftar laporan.']
  };

  function getOverlay(){ return el(OVERLAY_ID); }

  function startTimer(){
    loadingStartedAt=Date.now();
    if(loadingTimer) clearInterval(loadingTimer);
    loadingTimer=setInterval(function(){
      var timerEl=el('ipsrsLoadingTimer');
      if(!timerEl) return;
      var seconds=Math.floor((Date.now()-loadingStartedAt)/1000);
      timerEl.textContent=String(seconds).padStart(2,'0')+' detik';
    },250);
  }

  function stopTimer(){
    if(loadingTimer){
      clearInterval(loadingTimer);
      loadingTimer=null;
    }
    loadingStartedAt=0;
  }


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
      +'<div class="ipsrs-loading-spinner" aria-hidden="true">'
      +'<div class="ipsrs-lightning-ring"></div>'
      +'<div class="ipsrs-lightning-ring2"></div>'
      +'<div class="ipsrs-lightning">⚡</div>'
      +'</div>'
      +'<div class="ipsrs-loading-timer" id="ipsrsLoadingTimer">00 detik</div>'
      +'<div class="ipsrs-loading-title">'+escapeHtml(labels[name][0])+'</div>'
      +'<div class="ipsrs-loading-detail">'+escapeHtml(labels[name][1])+'</div>'
      +'</div>';
    document.body.appendChild(o);
    startTimer();

    if(safetyTimer) clearTimeout(safetyTimer);
    safetyTimer=setTimeout(function(){
      if(getOverlay()) clear();
    },30000);
  }

  function clear(){
    var o=getOverlay();
    if(o) o.remove();
    if(safetyTimer){ clearTimeout(safetyTimer); safetyTimer=null; }
    stopTimer();
    activeName='';
  }

  function showError(name,message){
    installStyle();
    stopTimer();
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
