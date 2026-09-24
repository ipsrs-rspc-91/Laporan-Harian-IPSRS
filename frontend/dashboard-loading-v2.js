/*
 * Dashboard Loading v2
 * PATCH ONLY.
 * Menjamin Page_Dashboard siap lalu langsung meneruskan navigasi.
 * Chart.js dimuat paralel oleh index.html sehingga tidak lagi menjadi
 * gerbang sebelum request Dashboard dimulai.
 * Tidak mengubah logika data Dashboard.
 */
(function(){
  'use strict';

  let loadingActive = false;
  let pendingRequests = 0;
  let requestStarted = false;
  let requestFailed = false;
  let hideTimer = null;
  let navigationBusy = false;
  let activeLoadSeq = 0;
  let dashboardTimerInterval = null;
  let dashboardTimerStartedAt = 0;

  function ensureOverlay(){
    let overlay = document.getElementById('dashboardLoadingOverlay');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'dashboardLoadingOverlay';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.innerHTML = '<div class="dashboard-loading-card"><div class="dashboard-loading-spinner" aria-hidden="true"></div><div class="dashboard-loading-title">Memuat Dashboard</div><div class="dashboard-loading-text" id="dashboardLoadingText">Menyiapkan dashboard...</div><div class="dashboard-loading-duration" id="dashboardLoadingDuration" style="display:none" aria-hidden="true">⏱ 0,0 detik</div></div>';

    const style = document.createElement('style');
    style.id = 'dashboardLoadingStyle';
    style.textContent = '#dashboardLoadingOverlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(255,255,255,.72);backdrop-filter:blur(2px)}#dashboardLoadingOverlay.show{display:flex}.dashboard-loading-card{min-width:250px;max-width:360px;padding:24px 28px;border:1px solid var(--border,#dbe3e8);border-radius:16px;background:#fff;box-shadow:0 10px 35px rgba(0,0,0,.12);text-align:center}.dashboard-loading-spinner{width:38px;height:38px;margin:0 auto 14px;border:4px solid #dbe7ea;border-top-color:#0f6172;border-radius:50%;animation:dashboardLoadingSpin .8s linear infinite}.dashboard-loading-title{font-size:16px;font-weight:800;color:#17323a}.dashboard-loading-text{margin-top:6px;font-size:12px;color:#64747a}.dashboard-loading-duration{margin-top:10px;font-size:13px;font-weight:800;color:#0f6172;letter-spacing:.1px}@keyframes dashboardLoadingSpin{to{transform:rotate(360deg)}}@media(max-width:700px){.dashboard-loading-card{min-width:230px;padding:21px 22px}}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    return overlay;
  }

  function setText(text){
    const el = document.getElementById('dashboardLoadingText');
    if(el) el.textContent = text;
  }

  function stopDashboardTimer_(){
    if(dashboardTimerInterval){
      clearInterval(dashboardTimerInterval);
      dashboardTimerInterval = null;
    }
  }

  function startDashboardTimer_(){
    stopDashboardTimer_();
    const el = document.getElementById('dashboardLoadingDuration');
    if(!el) return;
    el.style.display = 'block';
    el.setAttribute('aria-hidden','false');
    dashboardTimerStartedAt = performance.now();
    el.textContent = '⏱ 0,0 detik';
    dashboardTimerInterval = setInterval(function(){
      const seconds = (performance.now() - dashboardTimerStartedAt) / 1000;
      el.textContent = '⏱ ' + seconds.toFixed(1).replace('.',',') + ' detik';
    }, 100);
  }

  function showLoading(text, seq){
    loadingActive = true;
    navigationBusy = true;
    activeLoadSeq = seq == null ? activeLoadSeq : seq;
    if(hideTimer) clearTimeout(hideTimer);
    setText(text || 'Menyiapkan dashboard...');
    ensureOverlay().classList.add('show');
    startDashboardTimer_();
  }

  function hideLoading(){
    stopDashboardTimer_();
    loadingActive = false;
    navigationBusy = false;
    if(hideTimer) clearTimeout(hideTimer);
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if(overlay) overlay.classList.remove('show');
  }

  function showError(text, seq){
    if(seq != null && seq !== activeLoadSeq) return;
    stopDashboardTimer_();
    loadingActive = false;
    navigationBusy = false;
    if(hideTimer) clearTimeout(hideTimer);
    setText(text || 'Gagal memuat Dashboard.');
    ensureOverlay().classList.add('show');
    hideTimer = setTimeout(hideLoading, 1800);
  }

  function dashboardDomReady(){
    return !!(
      document.getElementById('DashBulan') &&
      document.getElementById('DashStaff') &&
      document.getElementById('statPetugasAktif') &&
      document.getElementById('statTotal')
    );
  }

  function waitForDashboardMount(deadline){
    const ready = window.__ipsrsPageReady && window.__ipsrsPageReady.dashboard;
    if(ready && typeof ready.then === 'function'){
      return Promise.race([
        ready.then(function(){ return true; }).catch(function(err){
          console.error('Dashboard page mount error:', err);
          return false;
        }),
        new Promise(function(resolve){
          const remain = Math.max(0, deadline - Date.now());
          setTimeout(function(){ resolve(false); }, remain);
        })
      ]).then(function(result){
        return result === true && dashboardDomReady();
      });
    }
    return new Promise(function(resolve){
      function check(){
        if(dashboardDomReady()) return resolve(true);
        if(Date.now() >= deadline) return resolve(false);
        setTimeout(check, 40);
      }
      check();
    });
  }

  window.__ipsrsDashboardLoadingStart = function(seq){
    showLoading('Sedang mengambil data statistik...', seq);
  };

  window.__ipsrsDashboardLoadingDone = function(seq, ok){
    if(seq !== activeLoadSeq) return;
    if(ok) hideLoading();
    else showError('Dashboard gagal mengambil data. Silakan coba lagi.', seq);
  };

  const originalGoPage = window.goPage;
  if(typeof originalGoPage !== 'function') return;

  window.goPage = function(name, preserveInputMode){
    if(name !== 'dashboard'){
      hideLoading();
      return originalGoPage(name, preserveInputMode);
    }

    if(navigationBusy) return;

    showLoading('Menyiapkan dashboard...');
    const deadline = Date.now() + 10000;

    waitForDashboardMount(deadline).then(function(pageReady){
      if(!pageReady){
        showError('Dashboard gagal disiapkan. Silakan coba lagi.');
        return false;
      }

      // Chart.js tidak lagi ditunggu di sini. Ia sudah dimuat paralel sejak
      // startup; navigasi Dashboard langsung memulai loadDashboard/API.
      setText('Sedang mengambil data statistik...');
      try{
        originalGoPage(name, preserveInputMode);
      }catch(err){
        console.error('Dashboard navigation error:', err);
        showError('Gagal memuat Dashboard.');
        return false;
      }
      return true;
    }).catch(function(err){
      console.error('Dashboard loading error:', err);
      showError('Gagal memuat Dashboard.');
    });
  };
})();