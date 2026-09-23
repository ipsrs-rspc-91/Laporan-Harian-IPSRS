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

  var STYLE_ID='ipsrs-laporan-loading-style-v3';
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
      + '#'+OVERLAY_ID+' .ipsrs-loading-box{width:min(330px,calc(100vw - 40px));box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px 20px 17px;border:1px solid rgba(226,232,240,.95);border-radius:16px;background:rgba(255,255,255,.98);box-shadow:0 18px 55px rgba(15,23,42,.22);text-align:center;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-spinner{width:50px;height:50px;display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:2px;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-lightning{font-size:44px;line-height:1;display:inline-block;position:relative;z-index:4;color:#f5b400;text-shadow:0 0 4px rgba(245,180,0,.35);animation:ipsrsLightningFlash .62s ease-in-out infinite;}\n'      + '#'+OVERLAY_ID+' .ipsrs-electric-arc{position:absolute;width:60px;height:60px;border:4px solid transparent;border-top-color:#0f6f8c;border-right-color:#38bdf8;border-radius:50%;animation:ipsrsArcSpin .9s linear infinite;}\n'      + '#'+OVERLAY_ID+' .ipsrs-electric-arc2{position:absolute;width:64px;height:64px;border:3px dashed rgba(56,189,248,.8);border-radius:50%;animation:ipsrsArcSpinReverse .75s linear infinite;}\n'      + '#'+OVERLAY_ID+' .ipsrs-electric-arc3{position:absolute;width:68px;height:68px;border:2px solid transparent;border-left-color:rgba(245,180,0,.75);border-bottom-color:rgba(245,180,0,.35);border-radius:50%;animation:ipsrsArcSpin 1.35s linear infinite;}\n'      + '#'+OVERLAY_ID+' .ipsrs-charge-ring{position:absolute;inset:1px;border:4px solid rgba(15,111,140,.12);border-top-color:#0f6f8c;border-right-color:#38bdf8;border-radius:50%;animation:ipsrsChargeSpin 1.05s linear infinite;}\n'      + '#'+OVERLAY_ID+' .ipsrs-neon-bolt{font-size:48px;filter:drop-shadow(0 0 5px rgba(56,189,248,.85)) drop-shadow(0 0 13px rgba(15,111,140,.55));animation:ipsrsNeonPulse .72s ease-in-out infinite;}\n'      + '#'+OVERLAY_ID+' .ipsrs-loading-model-2 .ipsrs-lightning{color:#38bdf8;text-shadow:0 0 6px rgba(56,189,248,.9),0 0 15px rgba(15,111,140,.55);}\n'      + '#'+OVERLAY_ID+' .ipsrs-loading-model-3 .ipsrs-lightning{color:#0f6f8c;}\n'      + '#'+OVERLAY_ID+' .ipsrs-loading-model-4 .ipsrs-lightning{color:#7dd3fc;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-lightning-ring{position:absolute;inset:3px;border:2px solid rgba(15,111,140,.22);border-radius:50%;animation:ipsrsLightningRing 1.15s ease-out infinite;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-lightning-ring2{position:absolute;inset:8px;border:1px dashed rgba(15,111,140,.18);border-radius:50%;animation:ipsrsLightningRing2 1.15s ease-out infinite .18s;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-title{font-size:16px;font-weight:800;color:#16324a;line-height:1.3;margin-top:2px;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-detail{font-size:12px;color:#64748b;line-height:1.5;max-width:280px;}\n'
  + '#'+OVERLAY_ID+' .ipsrs-loading-timer{font-size:13px;font-weight:800;color:#0f6f8c;letter-spacing:.5px;min-width:78px;margin-top:2px;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-error{border-color:#fecaca;}\n'
      + '#'+OVERLAY_ID+' .ipsrs-loading-error .ipsrs-loading-title{color:#b91c1c;}\n'
      + '@keyframes ipsrsLightningFlash{0%,100%{transform:scale(1) rotate(-3deg);opacity:.72;}18%{transform:scale(1.15) rotate(3deg);opacity:1;}34%{transform:scale(.92) rotate(-2deg);opacity:.78;}52%{transform:scale(1.10) rotate(2deg);opacity:1;}72%{transform:scale(.97) rotate(-1deg);opacity:.88;}}\n'
  + '@keyframes ipsrsLightningRing{0%{transform:scale(.62);opacity:.65;}100%{transform:scale(1.22);opacity:0;}}\n'
  + '@keyframes ipsrsLightningRing2{0%{transform:scale(.72) rotate(0deg);opacity:.55;}100%{transform:scale(1.16) rotate(90deg);opacity:0;}}\n'      + '@keyframes ipsrsArcSpin{to{transform:rotate(360deg);}}\n'      + '@keyframes ipsrsArcSpinReverse{to{transform:rotate(-360deg);}}\n'      + '@keyframes ipsrsChargeSpin{to{transform:rotate(360deg);}}\n'      + '@keyframes ipsrsNeonPulse{0%,100%{transform:scale(.92) rotate(-4deg);opacity:.72;}50%{transform:scale(1.12) rotate(4deg);opacity:1;}}\n'
      + '@media(max-width:600px){#ipsrsLaporanLoadingOverlay{padding:16px}#ipsrsLaporanLoadingOverlay .ipsrs-loading-box{width:min(300px,calc(100vw - 32px));padding:16px 16px 15px}#ipsrsLaporanLoadingOverlay .ipsrs-loading-spinner{width:52px;height:52px}#ipsrsLaporanLoadingOverlay .ipsrs-lightning{font-size:38px}#ipsrsLaporanLoadingOverlay .ipsrs-loading-title{font-size:15px}#ipsrsLaporanLoadingOverlay .ipsrs-loading-detail{font-size:11px}}';
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
      var seconds=(Date.now()-loadingStartedAt)/1000;
      timerEl.textContent=seconds.toFixed(1).replace('.',',')+' detik';
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
    var modelClass=name==='saya'?'ipsrs-loading-model-1':(name==='monitoring'?'ipsrs-loading-model-2':(name==='rekap'?'ipsrs-loading-model-3':'ipsrs-loading-model-4'));
    var visual=name==='saya'
      ?'<div class="ipsrs-loading-spinner" aria-hidden="true"><div class="ipsrs-lightning-ring"></div><div class="ipsrs-lightning-ring2"></div><div class="ipsrs-lightning">⚡</div></div>'
      :(name==='monitoring'
        ?'<div class="ipsrs-loading-spinner" aria-hidden="true"><div class="ipsrs-electric-arc"></div><div class="ipsrs-electric-arc2"></div><div class="ipsrs-electric-arc3"></div><div class="ipsrs-lightning">⚡</div></div>'
        :(name==='rekap'
          ?'<div class="ipsrs-loading-spinner" aria-hidden="true"><div class="ipsrs-charge-ring"></div><div class="ipsrs-lightning">⚡</div></div>'
          :'<div class="ipsrs-loading-spinner" aria-hidden="true"><div class="ipsrs-neon-bolt">⚡</div></div>'));
    o.innerHTML='<div class="ipsrs-loading-box '+modelClass+'">'+visual
      +'<div class="ipsrs-loading-timer" id="ipsrsLoadingTimer">0,0 detik</div>'
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

    // Loading hanya ditampilkan ketika loader benar-benar melakukan request.
    // Jangan tampilkan overlay hanya karena tab diklik: setelah optimasi navigasi,
    // tab yang sudah pernah dimuat tidak melakukan request lagi. Jika overlay
    // ditampilkan pada kondisi itu, tidak ada Promise loader yang memanggil clear()
    // dan overlay dapat menutupi layar sampai safety timeout 30 detik.
    // wrapLoader() di atas tetap menjadi satu-satunya sumber show/clear yang valid.

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
