/* Laporan Loading State v20260916-1
 * Visual loading overlay for every Laporan sub-tab.
 * Does not call GAS directly and does not change backend logic.
 */
(function(){
  'use strict';

  var STYLE_ID='ipsrs-laporan-loading-style-v1';
  var OVERLAY_CLASS='ipsrs-loading-overlay';
  var active={};
  var hideTimers={};

  function el(id){return document.getElementById(id);}

  function installStyle(){
    if(el(STYLE_ID))return;
    var s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=''
      + '.ipsrs-loading-host{position:relative!important;min-height:120px!important;}\n'
      + '.ipsrs-loading-overlay{position:absolute!important;inset:0!important;z-index:50!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(255,255,255,.88)!important;backdrop-filter:blur(1.5px)!important;border-radius:14px!important;}\n'
      + '.ipsrs-loading-box{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 24px;border-radius:14px;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.12);min-width:190px;text-align:center;}\n'
      + '.ipsrs-loading-spinner{width:30px;height:30px;border:3px solid #dbe4ee;border-top-color:#2563eb;border-radius:50%;animation:ipsrsLoadingSpin .8s linear infinite;}\n'
      + '.ipsrs-loading-title{font-size:14px;font-weight:800;color:#1f2937;}\n'
      + '.ipsrs-loading-detail{font-size:11px;color:#64748b;line-height:1.4;}\n'
      + '.ipsrs-loading-error{border:1px solid #fecaca;background:#fff7f7;}\n'
      + '.ipsrs-loading-error .ipsrs-loading-title{color:#b91c1c;}\n'
      + '@keyframes ipsrsLoadingSpin{to{transform:rotate(360deg);}}\n'
      + '@media(max-width:600px){.ipsrs-loading-box{min-width:165px;padding:15px 18px}.ipsrs-loading-detail{font-size:10px;}}';
    document.head.appendChild(s);
  }

  function panel(name){return el('subtab-'+name);}

  function clear(name){
    var p=panel(name);if(!p)return;
    if(hideTimers[name]){clearTimeout(hideTimers[name]);delete hideTimers[name];}
    var o=p.querySelector('.'+OVERLAY_CLASS);if(o)o.remove();
    p.classList.remove('ipsrs-loading-host');
    active[name]=false;
  }

  function show(name,title,detail){
    var p=panel(name);if(!p)return;
    installStyle();
    active[name]=true;
    p.classList.add('ipsrs-loading-host');
    var old=p.querySelector('.'+OVERLAY_CLASS);if(old)old.remove();
    var o=document.createElement('div');o.className=OVERLAY_CLASS; o.setAttribute('aria-live','polite');
    o.innerHTML='<div class="ipsrs-loading-box"><div class="ipsrs-loading-spinner" aria-hidden="true"></div><div class="ipsrs-loading-title">'+title+'</div><div class="ipsrs-loading-detail">'+detail+'</div></div>';
    p.appendChild(o);
  }

  function showError(name,message){
    var p=panel(name);if(!p)return;
    installStyle();
    p.classList.add('ipsrs-loading-host');
    var old=p.querySelector('.'+OVERLAY_CLASS);if(old)old.remove();
    var o=document.createElement('div');o.className=OVERLAY_CLASS;o.setAttribute('role','alert');
    o.innerHTML='<div class="ipsrs-loading-box ipsrs-loading-error"><div class="ipsrs-loading-title">Gagal memuat data</div><div class="ipsrs-loading-detail">'+String(message||'Silakan coba lagi.')+'</div></div>';
    p.appendChild(o);
    setTimeout(function(){clear(name);},5000);
  }

  var labels={
    saya:['Memuat Laporan Saya','Mengambil laporan Anda dari server…'],
    monitoring:['Memuat Monitoring Harian','Mengambil data monitoring dari server…'],
    rekap:['Memuat Rekap Bulanan','Mengambil rekap dari server…'],
    daftar:['Memuat Daftar Laporan','Mengambil daftar laporan dari server…']
  };

  function showFor(name){
    if(!labels[name])return;
    show(name,labels[name][0],labels[name][1]);
  }

  function watchPanel(name){
    var p=panel(name);if(!p||p.__ipsrsLoadingObserver)return;
    p.__ipsrsLoadingObserver=true;
    var observer=new MutationObserver(function(){
      if(!active[name])return;
      if(hideTimers[name])clearTimeout(hideTimers[name]);
      hideTimers[name]=setTimeout(function(){
        if(active[name])clear(name);
      },350);
    });
    observer.observe(p,{childList:true,subtree:true,characterData:true});
  }

  function wrapLoader(fnName,name){
    if(typeof window[fnName]!=='function'||window[fnName].__ipsrsLoadingWrapped)return;
    var original=window[fnName];
    function wrapped(){
      showFor(name);
      try{
        var result=original.apply(this,arguments);
        if(result&&typeof result.then==='function'){
          return result.then(function(v){clear(name);return v;},function(err){showError(name,err&&err.message?err.message:'Server tidak dapat dihubungi.');throw err;});
        }
        return result;
      }catch(err){
        showError(name,err&&err.message?err.message:'Terjadi kesalahan.');
        throw err;
      }
    }
    wrapped.__ipsrsLoadingWrapped=true;
    window[fnName]=wrapped;
  }

  function install(){
    installStyle();
    ['saya','monitoring','rekap','daftar'].forEach(watchPanel);

    wrapLoader('loadStaffMonitoring','monitoring');
    wrapLoader('loadMonthlyRecap','rekap');
    wrapLoader('loadReportsBySelectedMonth','daftar');

    document.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('.sub-tab');
      if(!b)return;
      var name=b.getAttribute('data-subtab');
      if(labels[name])showFor(name);
    },true);

    var originalGo=window.goLaporanSubTab;
    if(typeof originalGo==='function'&&!originalGo.__ipsrsLoadingWrapped){
      var wrappedGo=function(name){
        showFor(name);
        var result=originalGo.apply(this,arguments);
        setTimeout(function(){watchPanel(name);},0);
        return result;
      };
      wrappedGo.__ipsrsLoadingWrapped=true;
      window.goLaporanSubTab=wrappedGo;
    }

    window.__ipsrsShowLaporanLoading=showFor;
    window.__ipsrsClearLaporanLoading=clear;
    window.__ipsrsLaporanLoadingError=showError;
  }

  function boot(){
    install();
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      ['saya','monitoring','rekap','daftar'].forEach(watchPanel);
      wrapLoader('loadStaffMonitoring','monitoring');
      wrapLoader('loadMonthlyRecap','rekap');
      wrapLoader('loadReportsBySelectedMonth','daftar');
      if(tries>=20)clearInterval(timer);
    },500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
