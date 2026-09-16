/*
 * Dashboard Loading v2
 * PATCH ONLY.
 * Menunggu Page_Dashboard benar-benar ter-mount sebelum goPage/loadDashboard
 * dijalankan. Setelah itu indikator menunggu request statistik selesai.
 */
(function(){
  'use strict';

  let loadingActive = false;
  let pendingRequests = 0;
  let requestStarted = false;
  let hideTimer = null;
  let navigationBusy = false;

  function ensureOverlay(){
    let overlay = document.getElementById('dashboardLoadingOverlay');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'dashboardLoadingOverlay';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.innerHTML = '<div class="dashboard-loading-card"><div class="dashboard-loading-spinner" aria-hidden="true"></div><div class="dashboard-loading-title">Memuat Dashboard</div><div class="dashboard-loading-text" id="dashboardLoadingText">Menyiapkan dashboard...</div></div>';

    const style = document.createElement('style');
    style.id = 'dashboardLoadingStyle';
    style.textContent = '#dashboardLoadingOverlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(255,255,255,.72);backdrop-filter:blur(2px)}#dashboardLoadingOverlay.show{display:flex}.dashboard-loading-card{min-width:250px;max-width:360px;padding:24px 28px;border:1px solid var(--border,#dbe3e8);border-radius:16px;background:#fff;box-shadow:0 10px 35px rgba(0,0,0,.12);text-align:center}.dashboard-loading-spinner{width:38px;height:38px;margin:0 auto 14px;border:4px solid #dbe7ea;border-top-color:#0f6172;border-radius:50%;animation:dashboardLoadingSpin .8s linear infinite}.dashboard-loading-title{font-size:16px;font-weight:800;color:#17323a}.dashboard-loading-text{margin-top:6px;font-size:12px;color:#64747a}@keyframes dashboardLoadingSpin{to{transform:rotate(360deg)}}@media(max-width:700px){.dashboard-loading-card{min-width:230px;padding:21px 22px}}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    return overlay;
  }

  function setText(text){
    const el = document.getElementById('dashboardLoadingText');
    if(el) el.textContent = text;
  }

  function showLoading(text){
    loadingActive = true;
    requestStarted = false;
    pendingRequests = 0;
    navigationBusy = true;
    if(hideTimer) clearTimeout(hideTimer);
    setText(text || 'Menyiapkan dashboard...');
    ensureOverlay().classList.add('show');
  }

  function hideLoading(){
    loadingActive = false;
    navigationBusy = false;
    if(hideTimer) clearTimeout(hideTimer);
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if(overlay) overlay.classList.remove('show');
  }

  function dashboardDomReady(){
    return !!(
      document.getElementById('DashBulan') &&
      document.getElementById('DashStaff') &&
      document.getElementById('statPetugasAktif') &&
      document.getElementById('statTotal')
    );
  }

  function waitForDashboardDom(deadline, done){
    if(dashboardDomReady()){
      done(true);
      return;
    }
    if(Date.now() >= deadline){
      done(false);
      return;
    }
    setTimeout(function(){ waitForDashboardDom(deadline, done); }, 40);
  }

  function waitForRequests(deadline){
    if(!loadingActive) return;
    if(requestStarted && pendingRequests === 0){
      // Beri satu frame tambahan agar hasil render KPI/chart benar-benar masuk DOM.
      hideTimer = setTimeout(hideLoading, 220);
      return;
    }
    if(Date.now() >= deadline){
      setText('Dashboard membutuhkan waktu lebih lama dari biasanya.');
      hideTimer = setTimeout(hideLoading, 700);
      return;
    }
    setTimeout(function(){ waitForRequests(deadline); }, 50);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    let isDashboardRequest = false;
    try{
      const body = init && init.body;
      if(typeof body === 'string'){
        const payload = JSON.parse(body);
        isDashboardRequest = !!(payload && (
          payload.action === 'apiDashboardStats' ||
          payload.action === 'apiGetStaffMonitoring'
        ));
      }
    }catch(e){}

    if(isDashboardRequest){
      requestStarted = true;
      pendingRequests++;
      if(loadingActive) setText('Sedang mengambil data statistik...');
    }

    const request = nativeFetch(input, init);
    if(isDashboardRequest){
      request.finally(function(){
        pendingRequests = Math.max(0, pendingRequests - 1);
      });
    }
    return request;
  };

  const originalGoPage = window.goPage;
  if(typeof originalGoPage !== 'function') return;

  window.goPage = function(name){
    if(name !== 'dashboard'){
      hideLoading();
      return originalGoPage(name);
    }

    // Cegah klik berulang saat Dashboard sedang diproses.
    if(navigationBusy) return;

    showLoading('Menyiapkan dashboard...');
    const deadline = Date.now() + 15000;

    // PENTING: jangan panggil originalGoPage sebelum Page_Dashboard selesai
    // dimuat. originalGoPage sendiri akan memanggil loadDashboard().
    waitForDashboardDom(deadline, function(ready){
      if(!ready){
        setText('Dashboard gagal disiapkan. Silakan coba lagi.');
        setTimeout(hideLoading, 1200);
        return;
      }

      setText('Sedang mengambil data statistik...');
      try{
        originalGoPage(name);
      }catch(err){
        console.error('Dashboard navigation error:', err);
        setText('Gagal memuat Dashboard.');
        setTimeout(hideLoading, 1200);
        return;
      }

      waitForRequests(deadline);
    });
  };
})();
