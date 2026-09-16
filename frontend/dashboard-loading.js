/*
 * Dashboard Loading Indicator
 * PATCH ONLY: tidak mengubah logika dashboard/API.
 * Menampilkan indikator proses ketika user berpindah ke Dashboard,
 * lalu otomatis hilang setelah request statistik Dashboard selesai.
 */
(function(){
  'use strict';

  let dashboardPending = 0;
  let dashboardRequestStarted = false;
  let dashboardLoadingActive = false;
  let hideTimer = null;

  function ensureOverlay(){
    let overlay = document.getElementById('dashboardLoadingOverlay');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'dashboardLoadingOverlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="dashboard-loading-card">
        <div class="dashboard-loading-spinner" aria-hidden="true"></div>
        <div class="dashboard-loading-title">Memuat Dashboard</div>
        <div class="dashboard-loading-text">Sedang mengambil data statistik...</div>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'dashboardLoadingStyle';
    style.textContent = `
      #dashboardLoadingOverlay{
        position:fixed;
        inset:0;
        z-index:99990;
        display:none;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(255,255,255,.72);
        backdrop-filter:blur(2px);
      }
      #dashboardLoadingOverlay.show{display:flex;}
      .dashboard-loading-card{
        min-width:250px;
        max-width:360px;
        padding:24px 28px;
        border:1px solid var(--border,#dbe3e8);
        border-radius:16px;
        background:#fff;
        box-shadow:0 10px 35px rgba(0,0,0,.12);
        text-align:center;
      }
      .dashboard-loading-spinner{
        width:38px;
        height:38px;
        margin:0 auto 14px;
        border:4px solid #dbe7ea;
        border-top-color:#0f6172;
        border-radius:50%;
        animation:dashboardLoadingSpin .8s linear infinite;
      }
      .dashboard-loading-title{
        font-size:16px;
        font-weight:800;
        color:#17323a;
      }
      .dashboard-loading-text{
        margin-top:6px;
        font-size:12px;
        color:#64747a;
      }
      @keyframes dashboardLoadingSpin{to{transform:rotate(360deg)}}
      @media(max-width:700px){
        .dashboard-loading-card{min-width:230px;padding:21px 22px;}
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
    return overlay;
  }

  function showDashboardLoading(){
    dashboardLoadingActive = true;
    dashboardRequestStarted = false;
    dashboardPending = 0;
    if(hideTimer) clearTimeout(hideTimer);
    ensureOverlay().classList.add('show');
  }

  function hideDashboardLoading(){
    dashboardLoadingActive = false;
    if(hideTimer) clearTimeout(hideTimer);
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if(overlay) overlay.classList.remove('show');
  }

  function waitForDashboardRequests(deadline){
    if(!dashboardLoadingActive) return;
    if(dashboardRequestStarted && dashboardPending === 0){
      hideTimer = setTimeout(hideDashboardLoading, 180);
      return;
    }
    if(Date.now() >= deadline){
      hideDashboardLoading();
      return;
    }
    setTimeout(function(){ waitForDashboardRequests(deadline); }, 50);
  }

  // Tangkap hanya request API yang memang dipakai Dashboard.
  // Request halaman lain tidak ikut mempengaruhi indikator.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    let isDashboardRequest = false;
    try{
      const body = init && init.body;
      if(typeof body === 'string'){
        const payload = JSON.parse(body);
        isDashboardRequest = payload &&
          (payload.action === 'apiDashboardStats' || payload.action === 'apiGetStaffMonitoring');
      }
    }catch(e){}

    if(isDashboardRequest){
      dashboardRequestStarted = true;
      dashboardPending++;
    }

    const request = nativeFetch(input, init);

    if(isDashboardRequest){
      request.finally(function(){
        dashboardPending = Math.max(0, dashboardPending - 1);
        if(dashboardLoadingActive && dashboardRequestStarted && dashboardPending === 0){
          hideTimer = setTimeout(hideDashboardLoading, 180);
        }
      });
    }

    return request;
  };

  // Bungkus navigasi yang sudah ada. Logika goPage asli tetap dijalankan.
  const originalGoPage = window.goPage;
  if(typeof originalGoPage === 'function'){
    window.goPage = function(name){
      if(name === 'dashboard'){
        showDashboardLoading();
        originalGoPage(name);
        waitForDashboardRequests(Date.now() + 15000);
        return;
      }

      hideDashboardLoading();
      return originalGoPage(name);
    };
  }
})();
