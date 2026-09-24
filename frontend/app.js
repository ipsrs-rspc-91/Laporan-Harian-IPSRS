// Frontend migration of JS_Core.html — behavior preserved; transport changed to HTTP API.
// ============================================================
  // SESSION (token disimpan di sessionStorage HANYA untuk menjaga
  // login antar aksi di tab yang sama -- data tetap 100% di server)
  // ============================================================
  // MODE MAINTENANCE SEMENTARA: seluruh akses login dinonaktifkan.
  // Ubah ke false setelah maintenance selesai.
  const IPSRS_MAINTENANCE_MODE = false;
  const IPSRS_MAINTENANCE_TEST_ROLE = 'KA_IPSRS';
  const SESSION_KEY = 'ipsrs_session_v1';
  // "Ingat saya": preferensi + username disimpan di localStorage.
  // Password disimpan hanya melalui Password Manager browser/perangkat.
  // Supabase session TIDAK dipersistenkan oleh fitur "Ingat Saya".
  // Pengguna tetap harus menekan tombol MASUK setelah halaman login tampil.
  const REMEMBER_KEY = 'ipsrs_remember_v2';
  const REMEMBER_LEGACY_KEY = 'ipsrs_remember_v1';
  const BIDANG_LIST = ['ME', 'Sipil', 'Workshop', 'Elektromedik', 'Kesling', 'Shift'];
  // CATATAN (P1 §3.6): SHIFT_LIST dihapus. Konsep "Shift" sudah dihapus total
  // dari backend (lihat komentar "TAHAP 2: Tidak ada lagi shiftFilter" di
  // Reports.js/Api_Core.js/Api_Staff.js) -- filter Shift di UI tidak pernah
  // mempengaruhi hasil query, murni dekorasi kosong yang membingungkan
  // pengguna. PETUGAS_SHIFT di bawah ini tetap ada karena itu nama ROLE, bukan
  // konsep shift kerja yang sudah dihapus.
  const ROLE_LABELS_CLIENT = {
    KA_IPSRS: 'KA IPSRS',
    ADMINISTRASI: 'Administrasi IPSRS',
    KASIE: 'Kasie',
    STAF: 'Staf',
    PETUGAS_SHIFT: 'Petugas Shift'
  };
  function isTrialSessionAllowed_(session){ return !!session && !!session.staff_id; }
  function showTrialMaintenance_(msgEl){ if(msgEl){} }
  let CURRENT_SESSION = null;
  let IPSRS_HEARTBEAT_TIMER = null;
  let IPSRS_ONLINE_REFRESH_TIMER = null;
  // Petugas Online: simpan snapshot terakhir agar refresh berkala tidak merender ulang
  // DOM bila data yang terlihat belum berubah. Ini mencegah flicker dan mengurangi kerja browser.
  let IPSRS_ONLINE_LAST_SNAPSHOT = '';
  let IPSRS_ONLINE_REQUEST_ACTIVE = false;
  let ADMIN_STAFF_LIST = [];
  let adminSelectedStaffId = '';
  let _adminStaffListLoaded = false;
  let _adminStaffListLoading = null;
  let rawData = [];
  // Drill-down Dashboard -> Laporan. Hanya sebagai sinyal navigasi sementara;
  // tidak mengubah hak akses/Edit yang sudah ada.
  window.__IPSRS_DASHBOARD_UNFINISHED_DRILLDOWN = false;
  // Target tab khusus drill-down Dashboard -> Belum Selesai.
  // Nilai normal tetap "saya"; hanya drill-down ini yang diarahkan ke Daftar Laporan.
  window.__IPSRS_DASHBOARD_UNFINISHED_TARGET = '';
  // Drill-down dari kartu "Belum" pada Daftar Laporan.
  window.__IPSRS_DAFTAR_UNFINISHED_DRILLDOWN = false;
  // Drill-down dari kartu "Belum" saat berada di Laporan Saya.
  // Tetap terbatas pada staff_id user yang sedang login.
  window.__IPSRS_SAYA_UNFINISHED_DRILLDOWN = false;
  // Penanda navigasi internal agar drill-down Dashboard tidak di-reset
  // sebelum loader sempat menerapkan filter "Belum Selesai".
  window.__IPSRS_LAPORAN_INTERNAL_NAV = false;
  let statusChartInstance = null;
  let _historyLoadedForReportId = null;
  // Nilai placeholder untuk option "+ Tambah ... Baru" di dalam <select>
  // Kategori/Area Kerja/Item (lihat bagian "KATEGORI / AREA / ITEM" di bawah).
  // HARUS SAMA PERSIS dengan ADD_NEW_MARKER di Config.gs (backend).
  const ADD_NEW_VALUE = '__ADD_NEW__';
  // Item kustom yang dibuat lewat "+ Tambah Item Baru", dikelompokkan per
  // Area Kerja -- bentuknya sama seperti ITEMS_BY_AREA (StaticData.html).
  // Dimuat sekali per sesi login lewat loadItemKustomAll().
  let CUSTOM_ITEMS_BY_AREA = {};

  function getSession(){
    try{ const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
    catch(e){ return null; }
  }
  function setSession(s){
    CURRENT_SESSION = s;
    try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }catch(e){}
  }
  function clearSession(){
    CURRENT_SESSION = null;
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  }

  // ============================================================
  // ============================================================
  // "INGAT SAYA" -- username + password via Password Manager browser
  // ============================================================
  function isRememberMeEnabled_(){
    try{
      const raw=localStorage.getItem(REMEMBER_KEY) || localStorage.getItem(REMEMBER_LEGACY_KEY);
      if(!raw) return false;
      const payload=JSON.parse(raw);
      // Kompatibilitas: username lama dianggap Remember Me aktif.
      return payload && payload.enabled !== false;
    }catch(e){ return false; }
  }
  function saveRememberedCredentials(username){
    try{
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({
        u:btoa(unescape(encodeURIComponent(String(username||'')))),
        enabled:true
      }));
    }catch(e){}
  }
  function clearRememberedCredentials(){
    try{
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(REMEMBER_LEGACY_KEY);
    }catch(e){}
    // Hapus juga password tersimpan lokal yang dienkripsi oleh modul login.
    try{
      if(typeof window.clearRememberedPassword_==='function') window.clearRememberedPassword_();
    }catch(e){}
  }
  function loadRememberedCredentials(){
    try{
      let raw=localStorage.getItem(REMEMBER_KEY);
      if(!raw){
        raw=localStorage.getItem(REMEMBER_LEGACY_KEY);
        if(raw) localStorage.setItem(REMEMBER_KEY,raw);
      }
      if(!raw) return;
      const payload=JSON.parse(raw);
      const username=decodeURIComponent(escape(atob(payload.u||'')));
      const uEl=document.getElementById('loginUsername');
      const rEl=document.getElementById('loginRemember');
      if(uEl) uEl.value=username;
      if(rEl) rEl.checked=(payload.enabled!==false);
    }catch(e){ clearRememberedCredentials(); }
  }

  function escapeHtml(str){
    return (str===undefined||str===null?'':String(str))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  // Empty state seragam -- dipakai di semua tabel/kartu yang datanya kosong,
  // supaya tampilannya konsisten di seluruh halaman (bukan teks polos beda-beda).
  function emptyStateHtml(text){
    return '<div class="empty-state">'
      + '<svg class="es-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"></path></svg>'
      + '<div class="es-text">' + text + '</div>'
      + '</div>';
  }

  function setMsg(id, text, isErr){
    const el = document.getElementById(id);
    if(!el) return;
    el.innerText = text || '';
    el.className = text ? (isErr ? 'msg-err' : 'msg-ok') : '';
  }

  // Modal konfirmasi "Data telah disimpan" -- dipakai supaya klik tombol
  // Simpan Laporan selalu memberi reaksi yang jelas (bukan cuma teks kecil
  // di bawah tombol yang gampang tak disadari, terutama di HP).
  function openSaveSuccessModal(msg){
    const sub = document.getElementById('saveSuccessModalSub');
    if(sub) sub.innerText = msg || 'Laporan berhasil disimpan.';
    document.getElementById('saveSuccessModalBg').classList.add('show');
  }
  function closeSaveSuccessModal(){
    document.getElementById('saveSuccessModalBg').classList.remove('show');
  }

  // ============================================================
  // SUPABASE API WRAPPER
  // ============================================================
  function getSupabaseClient_(){
    if(!window.IPSRS_SUPABASE_CLIENT){
      if(!window.supabase || !window.IPSRS_SUPABASE_URL || !window.IPSRS_SUPABASE_PUBLISHABLE_KEY){
        throw new Error('Supabase client belum siap.');
      }
      window.IPSRS_SUPABASE_CLIENT = window.supabase.createClient(
        window.IPSRS_SUPABASE_URL,
        window.IPSRS_SUPABASE_PUBLISHABLE_KEY,
        {
          auth:{
            // Jangan kaitkan Remember Me dengan persisted Supabase session.
            // Remember Me hanya mengatur kredensial pada Password Manager browser.
            persistSession:false,
            autoRefreshToken:true,
            detectSessionInUrl:false
          }
        }
      );
    }
    return window.IPSRS_SUPABASE_CLIENT;
  }

  function resetSupabaseClient_(){
    window.IPSRS_SUPABASE_CLIENT=null;
    window.__IPSRS_AUTH_STATE_SUBSCRIPTION=null;
  }

  // Sinkronkan token Supabase yang di-refresh otomatis ke session aplikasi.
  // Sebelumnya gsRun() membaca token lama dari sessionStorage terus-menerus,
  // sehingga setelah access token berganti, API mulai menerima HTTP 401.
  function syncSupabaseSessionToApp_(session){
    if(!session || !session.access_token) return;
    const current=getSession();
    if(!current) return;
    const next=Object.assign({},current,{
      token:session.access_token,
      refresh_token:session.refresh_token || current.refresh_token
    });
    CURRENT_SESSION=next;
    try{ sessionStorage.setItem(SESSION_KEY,JSON.stringify(next)); }catch(e){}
  }

  function bindSupabaseAuthState_(){
    const client=window.IPSRS_SUPABASE_CLIENT;
    if(!client || window.__IPSRS_AUTH_STATE_SUBSCRIPTION) return;
    const sub=client.auth.onAuthStateChange((event,session)=>{
      if(session && (event==='SIGNED_IN' || event==='TOKEN_REFRESHED' || event==='INITIAL_SESSION')){
        // Callback harus ringan; jangan melakukan request Supabase lain di sini.
        syncSupabaseSessionToApp_(session);
      }
    });
    window.__IPSRS_AUTH_STATE_SUBSCRIPTION=sub && sub.data ? sub.data.subscription : null;
  }

  function jwtExpMs_(token){
    try{
      const p=String(token||'').split('.')[1];
      if(!p) return 0;
      const s=atob(p.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-(p.length%4))%4));
      const j=JSON.parse(s);
      return Number(j.exp||0)*1000;
    }catch(_e){ return 0; }
  }

  async function getFreshSupabaseAccessToken_(){
    const current=getSession();
    const token=current && current.token ? current.token : '';
    const exp=jwtExpMs_(token);

    // Jalur normal dibuat murah: jangan memanggil getSession() untuk setiap
    // request. Access token Supabase biasanya berlaku cukup lama.
    // Refresh hanya jika token kosong atau akan kedaluwarsa <= 60 detik.
    if(token && exp && (exp-Date.now())>60000){
      return token;
    }

    const client=getSupabaseClient_();
    bindSupabaseAuthState_();

    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    if(data && data.session && data.session.access_token){
      syncSupabaseSessionToApp_(data.session);
      return data.session.access_token;
    }

    // Recovery untuk lifecycle PWA/tab jika session client belum termuat.
    if(current && current.token && current.refresh_token){
      const r=await client.auth.setSession({
        access_token:current.token,
        refresh_token:current.refresh_token
      });
      if(r.error || !r.data || !r.data.session) throw (r.error || new Error('Sesi Supabase tidak dapat dipulihkan.'));
      syncSupabaseSessionToApp_(r.data.session);
      return r.data.session.access_token;
    }

    throw new Error('Sesi Supabase tidak ditemukan.');
  }

  function getApiUrl(){ return window.IPSRS_SUPABASE_API_URL || ''; }
  // Login username -> Supabase Auth email.
  // Beberapa akun lama memakai username/email-localpart yang berbeda dari
  // staff_id, sementara petugas biasanya memasukkan nama singkat (mis. "Rusdi").
  // Mapping ini menjaga akun/password lama tetap berlaku tanpa mereset password.
  const IPSRS_AUTH_LOGIN_ALIASES = Object.freeze({
    'herry':'herry',
    'herry hidayat':'herry',
    'kaipsrs':'herry',
    'rohim':'rohim',
    'abdul rohim':'rohim',
    'staf-workshop-01':'rohim',
    'agung':'agung',
    'agung prayitno':'agung',
    'kasie-elektromedik':'agung',
    'heri':'heri',
    'heri septiawan':'heri',
    'staf-workshop-02':'heri',
    'kabul':'kabul',
    'kabul wardoyo':'kabul',
    'shift-02':'kabul',
    'mardiyono':'mardiyono',
    'staf-pendamping-01':'mardiyono',
    'raihan':'raihan',
    'muhammad raihan rasyid':'raihan',
    'staf-kesling-01':'raihan',
    'sobur':'sobur',
    'muhammad sobur':'sobur',
    'staf-sipil-02':'sobur',
    'lamid':'lamid',
    'pantiarso':'lamid',
    'kasie-me':'lamid',
    'kartolo':'kartolo',
    'rahmat kartolo':'kartolo',
    'shift-01':'kartolo',
    'riko':'riko',
    'riko ferdyan':'riko',
    'adm01':'riko',
    'kasie_kesling':'kasie_kesling',
    'rusdi':'kasie_kesling',
    'kasie-kesling':'kasie_kesling',
    'samsuri':'samsuri',
    'shift-04':'samsuri',
    'selo':'selo',
    'selo setiyawan':'selo',
    'shift-08':'selo',
    'setu':'setu',
    'shift-03':'setu',
    'sule':'sule',
    'sulaiman':'sule',
    'staf-me-01':'sule',
    'sunandar':'sunandar',
    'shift-05':'sunandar',
    'surono':'surono',
    'shift-06':'surono',
    'yadi':'yadi',
    'suryadih':'yadi',
    'staf-sipil-01':'yadi',
    'suro':'suro',
    'suryanto':'suro',
    'staf-workshop-03':'suro',
    'teguh':'teguh',
    'teguh iman wahyudi':'teguh',
    'staf-elektromedik-01':'teguh',
    'wawan':'wawan',
    'wawan marwan':'wawan',
    'shift-07':'wawan',
    'yosep':'yosep',
    'yosep kurniawan galang narpathie':'yosep',
    'staf-pendamping-02':'yosep'
  });

  function staffAuthEmail_(staffId){
    const raw=String(staffId||'').trim().toLowerCase();
    const authUser=IPSRS_AUTH_LOGIN_ALIASES[raw] || raw;
    return authUser.replace(/[^a-z0-9._-]/g,'-') + (window.IPSRS_SUPABASE_EMAIL_DOMAIN || '@auth.ipsrs.local');
  }

  async function gsRun(fnName,...args){
    let token=await getFreshSupabaseAccessToken_();

    const payload={};
    switch(fnName){
      case 'apiLogout':
      case 'apiWhoAmI':
      case 'apiRecordLogin':
      case 'apiHeartbeat':
      case 'apiGetOnlineUsers':
      case 'apiListStaff':
      case 'apiGetKategoriKustom':
      case 'apiGetAreaKerjaKustom':
      case 'apiGetAccessControl':
      case 'apiListEditPermissions':
        payload.token=token; break;
      case 'apiChangePassword':
        payload.token=token; payload.oldPassword=args[0]||''; payload.newPassword=args[1]||''; break;
      case 'apiGetReportHistory':
        payload.token=token; payload.reportId=args[0]||''; break;
      case 'apiGetReportById':
        payload.token=token; payload.reportId=args[0]||''; break;
      case 'apiCreateReport':
        payload.token=token; payload.payload=args[0]||{}; break;
      case 'apiGetReports':
        payload.token=token; payload.bulan=args[0]||''; payload.staffIdFilter=args[1]||null; payload.bidangFilter=args[2]||null; payload.viewMode=args[3]||'daftar'; break;
      case 'apiUpdateReport':
        payload.token=token; payload.reportId=args[0]||''; payload.payload=args[1]||{}; break;
      case 'apiDashboardStats':
        payload.token=token; payload.bulan=args[0]||''; payload.staffIdFilter=args[1]||null; payload.bidangFilter=args[2]||null; break;
      case 'apiGetStaffMonitoring':
        payload.token=token; payload.bulan=args[0]||''; payload.tanggal=args[1]||''; payload.staffIdFilter=args[2]||null; break;
      case 'apiGetStaffDailyStatus':
        payload.token=token; payload.staffId=args[0]||''; payload.bulan=args[1]||''; break;
      case 'apiGetMonthlyRecap':
        payload.token=token; payload.bulan=args[0]||''; break;
      case 'apiGetAuditLog':
        payload.token=token; payload.reportId=args[0]||''; break;
      case 'apiGetStaffReports':
        payload.token=token; payload.staffId=args[0]||''; payload.bulan=args[1]||''; break;
      case 'apiGetStaffPerformance':
        payload.token=token; payload.staffId=args[0]||''; payload.bulan=args[1]||''; break;
      case 'apiTambahKategori':
        payload.token=token; payload.nama=args[0]||''; payload.staticList=Array.isArray(args[1])?args[1]:[]; break;
      case 'apiTambahAreaKerja':
        payload.token=token; payload.nama=args[0]||''; payload.staticList=Array.isArray(args[1])?args[1]:[]; break;
      case 'apiGetItemKustom':
        payload.token=token; payload.area=args[0]||''; payload.nama=args[1]||''; payload.existingItemsForArea=Array.isArray(args[2])?args[2]:[]; break;
      case 'apiTambahItem':
        payload.token=token; payload.area=args[0]||''; payload.nama=args[1]||''; payload.existingItemsForArea=Array.isArray(args[2])?args[2]:[]; break;
      case 'apiSetAccessSetting':
        payload.token=token; payload.key=args[0]||''; payload.value=args[1]||''; break;
      case 'apiSetEditPermission':
        payload.token=token; payload.grantedToStaffId=args[0]||''; payload.targetStaffId=args[1]||''; payload.isActive=args[2]; break;
      default: throw new Error('Action API tidak dikenal: '+fnName);
    }

    const request_=async(t)=>{
      return fetch(window.IPSRS_SUPABASE_API_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':window.IPSRS_SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+t},
        body:JSON.stringify({action:fnName,data:payload})
      });
    };

    let response=await request_(token);

    // Jika gateway masih menolak token lama karena refresh baru saja terjadi,
    // ambil session terbaru sekali lalu ulangi request. verify_jwt tetap aktif.
    if(response.status===401){
      const client=getSupabaseClient_();
      const refreshed=await client.auth.refreshSession();
      if(!refreshed.error && refreshed.data && refreshed.data.session){
        syncSupabaseSessionToApp_(refreshed.data.session);
        token=refreshed.data.session.access_token;
        response=await request_(token);
      }
    }

    const text=await response.text();
    let json;
    try{ json=JSON.parse(text); }catch(e){ throw new Error('Respons Supabase bukan JSON yang valid. HTTP '+response.status); }
    if(!response.ok && (!json || json.ok!==false)) throw new Error('HTTP '+response.status);
    return json;
  }

  function resetLaporanUnfinishedState(){
    // Kembali ke keadaan normal: semua laporan, tanpa filter drill-down.
    window.__IPSRS_DASHBOARD_UNFINISHED_DRILLDOWN = false;
    window.__IPSRS_DASHBOARD_UNFINISHED_TARGET = '';
    window.__IPSRS_DAFTAR_UNFINISHED_DRILLDOWN = false;
    window.__IPSRS_SAYA_UNFINISHED_DRILLDOWN = false;
    const statusEl = document.getElementById('FilterStatus');
    if(statusEl) statusEl.value = '';
  }

  async function authRun(fnName, ...args){
    const s = getSession();
    if(!s){
      resetLaporanUnfinishedState();
      showLoginScreen('Sesi tidak ditemukan, silakan login kembali.');
      throw new Error('Belum login');
    }
    const json = await gsRun(fnName, ...args);
    if(json && json.ok === false && /sesi tidak valid/i.test(json.msg||'')){
      clearSession();
      resetLaporanUnfinishedState();
      showLoginScreen('Sesi berakhir, silakan login kembali.');
    }
    return json;
  }

  // ============================================================
  // LOGIN / LOGOUT / PASSWORD
  // ============================================================
  function showLoginScreen(msg){
    // Saat logout, sesi habis, atau koneksi tidak tersedia, jangan bawa
    // filter drill-down "Belum Selesai" ke sesi/layar berikutnya.
    resetLaporanUnfinishedState();
    const authLoading = document.getElementById('authLoading');
    if(authLoading) authLoading.classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
    if(msg) document.getElementById('loginMsg').innerText = msg;
  }
  function hideLoginScreen(){
    const authLoading = document.getElementById('authLoading');
    if(authLoading) authLoading.classList.add('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
  }

  async function performLogin(username,password,remember,msgEl,autoMode){
    if(!username || !password){
      if(msgEl) msgEl.innerText='Username dan password wajib diisi.';
      return false;
    }
    if(msgEl) msgEl.innerText=autoMode?'Masuk otomatis...':'Memeriksa...';
    // Jangan menyimpan username sebelum autentikasi berhasil.
    // Jika Remember Me tidak aktif, hapus preferensi aplikasi sekarang.
    if(!remember) clearRememberedCredentials();
    resetSupabaseClient_();

    const client=getSupabaseClient_();
    const email=staffAuthEmail_(username);
    try{
      const signIn=await client.auth.signInWithPassword({email,password});
      if(signIn.error) throw signIn.error;
      const session=signIn.data.session;
      if(!session) throw new Error('Sesi Supabase tidak terbentuk.');
      const who=await fetch(window.IPSRS_SUPABASE_API_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':window.IPSRS_SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({action:'apiWhoAmI',data:{token:session.access_token}})
      });
      const whoJson=await who.json().catch(()=>null);
      if(!who.ok || !whoJson || !whoJson.ok) throw new Error((whoJson&&whoJson.msg)||'Akun belum terhubung ke data petugas.');
      // Maintenance gate: hanya role KA_IPSRS yang boleh masuk ke aplikasi.
      // Pemeriksaan dilakukan terhadap identitas Supabase yang sudah terverifikasi,
      // bukan terhadap backend GAS lama.
      if(IPSRS_MAINTENANCE_MODE && String(whoJson.role||'')!==IPSRS_MAINTENANCE_TEST_ROLE){
        await client.auth.signOut().catch(()=>{});
        if(msgEl) msgEl.innerText='Sistem sedang maintenance.';
        if(autoMode) clearRememberedCredentials();
        return false;
      }
      setSession(Object.assign({},whoJson,{token:session.access_token,refresh_token:session.refresh_token}));
      // Simpan preferensi Remember Me hanya setelah password benar dan identitas
      // berhasil diverifikasi. Kredensial disimpan oleh modul login sebagai ciphertext
      // lokal dan, bila didukung browser, juga oleh Password Manager.
      if(remember) saveRememberedCredentials(username);
      if(remember && typeof window.storeBrowserCredential_==='function'){
        await window.storeBrowserCredential_(username,password,true);
      }
      // Catat login di background. WhoAmI sudah memvalidasi sesi/identitas;
      // pencatatan audit tidak boleh menahan pengguna masuk ke aplikasi.
      // Kegagalan audit tidak mengubah hasil login yang sudah berhasil.
      Promise.resolve().then(()=>authRun('apiRecordLogin')).catch(()=>{});

      if(msgEl) msgEl.innerText='';
      // Password dipertahankan di field login agar tetap terisi setelah logout.
      applyIdentityToUI();
      await afterAuthReady();
      hideLoginScreen();
      goPage('input');
      return true;
    }catch(err){
      if(msgEl) msgEl.innerText='Error: '+(err&&err.message?err.message:err);
      return false;
    }
  }

  // HARD GUARD LOGIN: submit form tidak cukup untuk memulai autentikasi.
  // Password Manager/browser dapat mengisi kredensial dan pada kondisi tertentu
  // memicu submit tanpa klik tombol Masuk. Flag ini hanya diaktifkan oleh
  // handler klik tombol Masuk yang terlihat di UI.
  window.__IPSRS_LOGIN_BUTTON_CLICKED = false;

  async function doLogin(event){
    if(event && typeof event.preventDefault==='function') event.preventDefault();

    const buttonClicked = window.__IPSRS_LOGIN_BUTTON_CLICKED === true;
    window.__IPSRS_LOGIN_BUTTON_CLICKED = false;

    if(!buttonClicked || !event || event.type !== 'submit' || event.isTrusted !== true){
      const msgEl=document.getElementById('loginMsg');
      if(msgEl) msgEl.innerText='Silakan tekan tombol MASUK untuk login.';
      return false;
    }

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('loginRemember').checked;
    const msgEl = document.getElementById('loginMsg');
    await performLogin(username, password, remember, msgEl, false);
    return false;
  }

  function doLogout(){
    const client=getSupabaseClient_();
    try{ gsRun('apiLogout').catch(function(){}); }catch(_e){}
    stopIpsrsHeartbeat_();
    if(IPSRS_ONLINE_REFRESH_TIMER){ clearInterval(IPSRS_ONLINE_REFRESH_TIMER); IPSRS_ONLINE_REFRESH_TIMER=null; }
    clearSession();
    resetLaporanUnfinishedState();
    closeUserMenu();
    showLoginScreen('Anda sudah keluar. Silakan login kembali.');
    // Logout hanya mengakhiri sesi. Password manager browser tidak dipanggil
    // untuk login otomatis.
    client.auth.signOut({scope:'local'}).catch(function(){}).finally(function(){
      resetSupabaseClient_();
    });
  }

  function openPwModal(){
    document.getElementById('pwModalBg').classList.add('show');
    document.getElementById('pwOld').value = '';
    document.getElementById('pwNew').value = '';
    setMsg('pwMsg','');
  }
  function closePwModal(){ document.getElementById('pwModalBg').classList.remove('show'); }

  async function doChangePassword(){
    const oldPassword = document.getElementById('pwOld').value;
    const newPassword = document.getElementById('pwNew').value;
    if(!oldPassword || !newPassword){ setMsg('pwMsg','Password lama & baru wajib diisi.', true); return; }
    setMsg('pwMsg','Menyimpan...');
    try{
      const json = await authRun('apiChangePassword', oldPassword, newPassword);
      if(json && json.ok){
        if(typeof window.storeBrowserCredential_==='function' && isRememberMeEnabled_()){
          const loginUsername=document.getElementById('loginUsername');
          window.storeBrowserCredential_(loginUsername && loginUsername.value ? loginUsername.value.trim() : (CURRENT_SESSION && CURRENT_SESSION.staff_id ? CURRENT_SESSION.staff_id : ''), newPassword, true);
        }
        setMsg('pwMsg','Password berhasil diganti.');
        setTimeout(closePwModal, 900);
      }
      else setMsg('pwMsg', (json && json.msg) ? json.msg : 'Gagal mengganti password.', true);
    }catch(err){ setMsg('pwMsg', 'Error: ' + (err && err.message ? err.message : err), true); }
  }

  // ============================================================
  // IDENTITY / SIDEBAR / NAVIGASI
  // ============================================================
  function roleContextLabel(session){
    const roleLabel = ROLE_LABELS_CLIENT[session.role] || session.role;
    if(session.role === 'KASIE' || session.role === 'STAF') return roleLabel + ' \u00b7 ' + (session.bidang||'-');
    // (P1 §3.6) session.shift tidak pernah ada di backend (SESSIONS tanpa
    // kolom shift, lihat Config.js/Auth.js) -- untuk PETUGAS_SHIFT tampilkan
    // Bidang saja, sama seperti KASIE/STAF, alih-alih field shift yang selalu
    // kosong.
    if(session.role === 'PETUGAS_SHIFT') return roleLabel + ' \u00b7 ' + (session.bidang||'-');
    return roleLabel;
  }

  function applyIdentityToUI(){
    if(!CURRENT_SESSION) return;
    const nama = CURRENT_SESSION.nama || CURRENT_SESSION.username;
    const meta = (CURRENT_SESSION.staff_id||'-') + ' \u2022 ' + roleContextLabel(CURRENT_SESSION);
    document.getElementById('sbIdentityNama').innerText = nama;
    document.getElementById('sbIdentityNamaMenu').innerText = nama;
    document.getElementById('sbIdentityMeta').innerText = meta;
    document.getElementById('mobileIdentityChip').innerText = CURRENT_SESSION.staff_id || nama;
    document.getElementById('inputIdentityPill').innerText = nama + ' \u00b7 ' + roleContextLabel(CURRENT_SESSION);
    document.querySelectorAll('.readonlyPetugas').forEach(el => { el.value = nama; });

    // Prinsip baru: SEMUA peran bisa melihat semua laporan & panel filter petugas.
    document.getElementById('adminStaffPanel').classList.remove('hidden');
    document.getElementById('dashStaffFilterWrap').classList.remove('hidden');
    document.getElementById('dashStaffCard').classList.remove('hidden');

    // Default Daftar Laporan = semua petugas.
    // Pengguna tetap dapat memilih petugas tertentu melalui dropdown.
    adminSelectedStaffId = '';
    const pill = document.getElementById('adminStaffActivePill');
    if(pill) pill.innerText = 'Menampilkan: Semua Petugas';

    const onlineNav=document.getElementById('nav-online-users');
    if(onlineNav) onlineNav.classList.toggle('hidden', CURRENT_SESSION.role !== 'KA_IPSRS');
  }

  function canEditReport(report){
    if(!CURRENT_SESSION || !report) return false;

    // Frontend hanya menentukan apakah UI menampilkan kontrol EDIT.
    // Otorisasi final tetap di backend (apiGetReportById / apiUpdateReport).
    if(CURRENT_SESSION.role === 'KA_IPSRS') return true;

    const ownerId = String(
      report.StaffID ??
      report.staff_id ??
      report.StaffIDSnapshot ??
      report.staff_id_snapshot ??
      ''
    ).trim();

    if(ownerId && ownerId === String(CURRENT_SESSION.staff_id||'').trim()) return true;

    // ADMINISTRASI_EDIT adalah setting server-side. Jika backend mengirim
    // CanEdit=true, gunakan nilai tersebut agar UI tidak berbeda dengan server.
    if(report.CanEdit === true || report.canEdit === true) return true;

    // Delegated permission juga diputuskan server. Jangan menebak dari role.
    return false;
  }

  function toggleUserMenu(){
    const menu = document.getElementById('userMenu');
    const backdrop = document.getElementById('userMenuBackdrop');
    const show = !menu.classList.contains('show');
    menu.classList.toggle('show', show);
    backdrop.classList.toggle('show', show);
  }
  function closeUserMenu(){
    document.getElementById('userMenu').classList.remove('show');
    document.getElementById('userMenuBackdrop').classList.remove('show');
  }

  const PAGE_TITLES = { dashboard:'Dashboard', input:'Input Laporan', laporan:'Laporan', online:'Aktivitas Petugas' };

  function stopIpsrsHeartbeat_(){
    if(IPSRS_HEARTBEAT_TIMER){ clearInterval(IPSRS_HEARTBEAT_TIMER); IPSRS_HEARTBEAT_TIMER=null; }
  }

  function startIpsrsHeartbeat_(){
    stopIpsrsHeartbeat_();
    if(!CURRENT_SESSION) return;
    const beat=()=>{ if(CURRENT_SESSION) authRun('apiHeartbeat').catch(()=>{}); };
    beat();
    IPSRS_HEARTBEAT_TIMER=setInterval(beat,60000);
  }

  function formatLoginDateTime_(value){
    if(!value) return 'Belum pernah login';
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }

  function formatLastSeen_(value){
    if(!value) return '-';
    const d=new Date(value), now=Date.now(), sec=Math.max(0,Math.floor((now-d.getTime())/1000));
    if(sec<60) return sec+' detik lalu';
    const min=Math.floor(sec/60);
    if(min<60) return min+' menit lalu';
    return formatLoginDateTime_(value);
  }

  async function loadOnlineUsers(){
    if(!CURRENT_SESSION || CURRENT_SESSION.role!=='KA_IPSRS') return;
    const box=document.getElementById('onlineUsersList');
    const meta=document.getElementById('onlineUsersMeta');
    if(!box) return;
    // Jangan menumpuk request bila refresh sebelumnya belum selesai.
    if(IPSRS_ONLINE_REQUEST_ACTIVE) return;
    IPSRS_ONLINE_REQUEST_ACTIVE=true;
    try{
      const j=await authRun('apiGetOnlineUsers');
      if(!j || !j.ok) throw new Error((j&&j.msg)||'Gagal memuat status petugas.');
      const rows=Array.isArray(j.data)?j.data:[];
      const onlineCount=rows.filter(x=>x.online).length;
      if(meta) meta.innerText=onlineCount+' online dari '+rows.length+' petugas aktif · diperbarui '+formatLoginDateTime_(j.server_time);

      // Snapshot hanya memakai data yang menentukan tampilan kartu. Jika sama,
      // pertahankan DOM lama sehingga kartu tidak berkedip setiap 30 detik.
      const snapshot=JSON.stringify(rows.map(x=>({
        staff_id:x.staff_id||'', nama:x.nama||'', role:x.role||'', role_label:x.role_label||'',
        bidang:x.bidang||'', online:!!x.online, last_login_at:x.last_login_at||'',
        last_seen_at:x.last_seen_at||'', last_login_device:x.last_login_device||''
      })));
      if(snapshot===IPSRS_ONLINE_LAST_SNAPSHOT) return;
      IPSRS_ONLINE_LAST_SNAPSHOT=snapshot;

      if(!rows.length){
        box.innerHTML=emptyStateHtml('Belum ada petugas aktif.');
        return;
      }
      box.innerHTML=rows.map(x=>{
        const status=x.online?'ONLINE':'OFFLINE';
        const device=x.last_login_device?escapeHtml(x.last_login_device):'-';
        return '<div class="online-user-card">'
          +'<div class="online-user-main"><div class="online-dot '+(x.online?'is-online':'')+'"></div><div><div class="online-name">'+escapeHtml(x.nama)+'</div><div class="online-meta">'+escapeHtml(x.staff_id)+' · '+escapeHtml(x.role_label||x.role)+(x.bidang?' · '+escapeHtml(x.bidang):'')+'</div></div></div>'
          +'<div class="online-status '+(x.online?'is-online':'')+'">'+status+'</div>'
          +'<div class="online-details"><div><b>Login terakhir</b><br>'+formatLoginDateTime_(x.last_login_at)+'</div><div><b>Aktivitas terakhir</b><br>'+formatLastSeen_(x.last_seen_at)+'</div><div><b>Perangkat / browser</b><br><span class="device-text" title="'+device+'">'+device+'</span></div></div>'
          +'</div>';
      }).join('');
    }catch(e){
      // Jangan menghapus daftar terakhir yang masih valid hanya karena satu
      // request refresh gagal. Tampilkan error tanpa mengganti kartu yang ada.
      if(meta) meta.innerText='Gagal memperbarui status petugas. Data terakhir tetap ditampilkan.';
    }finally{
      IPSRS_ONLINE_REQUEST_ACTIVE=false;
    }
  }

  function openDashboardUnfinishedReports(){
    // Dashboard -> Laporan -> Daftar Laporan:
    // tampilkan seluruh laporan dalam scope hak akses user, lalu filter
    // status "Belum Selesai". Laporan Saya tetap khusus laporan user login.
    window.__IPSRS_DASHBOARD_UNFINISHED_DRILLDOWN = true;
    window.__IPSRS_DASHBOARD_UNFINISHED_TARGET = 'daftar';
    goPage('laporan');
  }

  function goPage(name, preserveInputMode){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === name));
    closeUserMenu();

    // Klik menu Form Input biasa selalu membuka mode CREATE baru.
    // Edit memanggil goPage('input', true) agar data laporan tetap terisi.
    if(name === 'input' && !preserveInputMode) startCreateReportForm(true);
    if(name !== 'dashboard'){
      // Batalkan secara logis request Dashboard yang masih berjalan agar
      // response lama tidak menulis kembali ke DOM setelah pindah halaman.
      window.__ipsrsDashboardLoadSeq = (window.__ipsrsDashboardLoadSeq || 0) + 1;
    }
    if(name === 'dashboard'){
      // Setiap kembali ke Dashboard, filter petugas Dashboard selalu kembali
      // ke "Semua Petugas". Bulan Dashboard tetap dipertahankan.
      const dashStaff = document.getElementById('DashStaff');
      if(dashStaff) dashStaff.value = '';

      // Filter dari seluruh halaman Laporan juga dibersihkan saat user pindah
      // ke Dashboard. Tidak menyentuh pilihan periode (bulan/tanggal).
      resetLaporanFilterControls_();

      // Muat daftar petugas secara lazy saat Dashboard pertama kali dibuka.
      // Tidak menambah beban login; request hanya dijalankan sekali per sesi.
      loadAdminStaffListIfNeeded();
      // Dashboard tetap boleh mulai memuat KPI tanpa menunggu dropdown selesai.
      // Keduanya berjalan paralel agar perpindahan halaman tetap cepat.
      resetLaporanUnfinishedState();
      const statusFilter = document.getElementById('FilterStatus');
      if(statusFilter && statusFilter.value === '__BELUM_SELESAI__') statusFilter.value = '';
      loadDashboard();
    }
    if(name === 'laporan'){
      // Jangan reload API setiap kali user kembali ke menu Laporan.
      // Data yang sudah dirender dipertahankan agar perpindahan menu konsisten cepat.
      if(!_laporanPageInitialized || _laporanNeedsRefresh){
        resetLaporanSubTabCache();
        _laporanPageInitialized = true;
      }
    }
    if(name === 'online'){
      if(!CURRENT_SESSION || CURRENT_SESSION.role!=='KA_IPSRS') return;
      // Refresh pertama: hanya load data; fungsi sendiri menjaga DOM agar tidak flicker.
      loadOnlineUsers();
      if(IPSRS_ONLINE_REFRESH_TIMER) clearInterval(IPSRS_ONLINE_REFRESH_TIMER);
      IPSRS_ONLINE_REFRESH_TIMER=setInterval(()=>{ if(CURRENT_SESSION && CURRENT_SESSION.role==='KA_IPSRS' && document.getElementById('page-online')?.classList.contains('active')) loadOnlineUsers(); },30000);
    }else if(IPSRS_ONLINE_REFRESH_TIMER){
      clearInterval(IPSRS_ONLINE_REFRESH_TIMER);
      IPSRS_ONLINE_REFRESH_TIMER=null;
    }
  }

  // ============================================================
  // BULAN (dipakai di Dashboard & Laporan)
  // ============================================================
  /**
   * Tanggal hari ini dalam format YYYY-MM-DD berdasarkan waktu LOKAL device
   * (bukan UTC). PENTING: jangan pakai new Date().toISOString().slice(0,10) --
   * itu bug: toISOString() mengonversi ke UTC dulu, jadi untuk petugas shift
   * yang membuka form dini hari WIB (00:00-06:59), tanggalnya ikut mundur
   * jadi "kemarin" (karena WIB = UTC+7, kemarin belum lewat tengah malam UTC).
   * Akibatnya laporan yang baru dibuat tidak terhitung "hari ini" di monitoring.
   */
  function todayLocalISO(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  /** Format 'YYYY-MM-DD' -> 'DD/MM/YYYY' untuk ditampilkan ke user. */
  function formatTanggalDisplay(value){
    if(value === undefined || value === null || value === '') return '';

    const text = String(value).trim();

    // Google Apps Script dapat mengirim nilai Date dari Sheets sebagai ISO UTC.
    // Contoh: 2026-09-18T17:00:00.000Z sebenarnya adalah 19/09/2026
    // pukul 00:00 WIB. Jangan mengambil YYYY-MM-DD mentah karena itu tanggal UTC.
    const isoDateTimeMatch = text.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/);
    if(isoDateTimeMatch){
      const d = new Date(text);
      if(!Number.isNaN(d.getTime())){
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).formatToParts(d);
        const get = type => parts.find(p => p.type === type)?.value || '';
        return get('day') + '/' + get('month') + '/' + get('year');
      }
    }

    // Nilai date-only dari backend: YYYY-MM-DD.
    const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(isoDateMatch){
      return isoDateMatch[3] + '/' + isoDateMatch[2] + '/' + isoDateMatch[1];
    }

    // Fallback untuk tanggal yang sudah berbentuk DD/MM/YYYY.
    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(slashMatch){
      return slashMatch[1].padStart(2,'0') + '/' + slashMatch[2].padStart(2,'0') + '/' + slashMatch[3];
    }

    return text;
  }

  function buildMonthOptions(){
    const now = new Date();
    const opts = [];
    for(let i=0; i<12; i++){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      const label = d.toLocaleDateString('id-ID', { month:'long', year:'numeric' });
      opts.push({val, label});
    }
    ['DashBulan','FilterBulan','MonBulan','RekapBulan'].forEach(id => {
      const sel = document.getElementById(id);
      if(!sel) return;
      sel.innerHTML = '';
      opts.forEach(o => {
        const el = document.createElement('option');
        el.value = o.val; el.innerText = o.label;
        sel.appendChild(el);
      });
      sel.value = opts[0].val;
    });
    document.getElementById('Tanggal').value = todayLocalISO();
    const monTanggal = document.getElementById('MonTanggal');
    if(monTanggal) monTanggal.value = todayLocalISO();
  }

  // ============================================================
  // KATEGORI / AREA / ITEM (data asli dari aplikasi lama, lihat StaticData.html)
  //
  // Kategori, Area Kerja, dan Item TETAP <select> HTML NATIVE (bukan custom
  // dropdown/combobox). Option "+ Tambah ... Baru" ditaruh sebagai <option>
  // PALING BAWAH di dalam select yang sama (Kategori, AreaKerja, Item) --
  // BUKAN tombol di luar select. Select FilterKategori/FilterArea (dipakai
  // untuk MEMFILTER daftar laporan, bukan mengisi laporan baru) TIDAK diberi
  // option tambah -- fungsinya cuma menampilkan pilihan yang sudah ada.
  // ============================================================
  function populateStaticSelects(){
    const kategoriTargets = ['Kategori','FilterKategori'];
    kategoriTargets.forEach(id => {
      const sel = document.getElementById(id);
      STATIC_KATEGORI.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k; opt.innerText = k;
        sel.appendChild(opt);
      });
    });
    const areaTargets = ['AreaKerja','FilterArea'];
    areaTargets.forEach(id => {
      const sel = document.getElementById(id);
      STATIC_AREA.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.innerText = a;
        sel.appendChild(opt);
      });
    });

    const bidangSel = document.getElementById('FilterBidang');
    BIDANG_LIST.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b; opt.innerText = b;
      bidangSel.appendChild(opt);
    });
    // Dropdown "Shift" dihapus dari HTML (P1 §3.6); tidak ada lagi elemen
    // #FilterShift untuk diisi di sini.

    const monBidangSel = document.getElementById('MonFilterBidang');
    BIDANG_LIST.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b; opt.innerText = b;
      monBidangSel.appendChild(opt);
    });
    // Dropdown "Shift" pada Monitoring dihapus dari HTML (P1 §3.6); tidak ada
    // lagi elemen #MonFilterShift untuk diisi di sini.
  }
  /**
   * Kategori kustom (dibuat lewat option "+ Tambah Kategori Baru") disimpan
   * permanen di sheet KATEGORI_CUSTOM (lihat Reports.gs/Api.gs) supaya SEMUA
   * petugas melihatnya, bukan cuma yang menambahkan. Dipanggil sekali di
   * afterAuthReady() setelah populateStaticSelects() mengisi kategori bawaan.
   */
  async function loadKategoriKustom(){
    try{
      const json = await authRun('apiGetKategoriKustom');
      if(json && json.ok && Array.isArray(json.kategori)){
        json.kategori.forEach(k => appendKategoriOption(k));
      }
    }catch(e){ /* gagal ambil kategori kustom bukan error fatal -- kategori bawaan tetap jalan */ }
  }

  /**
   * Area Kerja kustom (dibuat lewat option "+ Tambah Area Kerja Baru"),
   * disimpan permanen di sheet AREA_KERJA_CUSTOM. Pola sama persis dengan
   * loadKategoriKustom() di atas.
   */
  async function loadAreaKerjaKustom(){
    try{
      const json = await authRun('apiGetAreaKerjaKustom');
      if(json && json.ok && Array.isArray(json.area)){
        json.area.forEach(a => appendAreaKerjaOption(a));
      }
    }catch(e){ /* gagal ambil area kustom bukan error fatal -- area bawaan tetap jalan */ }
  }

  /**
   * Item kustom (dibuat lewat option "+ Tambah Item Baru"), dikelompokkan per
   * Area Kerja dan disimpan permanen di sheet ITEM_CUSTOM. Dimuat SEKALI ke
   * CUSTOM_ITEMS_BY_AREA (bukan per pergantian Area Kerja) supaya hemat
   * panggilan API -- refreshItemOptions() menggabungkannya dengan
   * ITEMS_BY_AREA (bawaan) tiap kali Area Kerja berganti.
   */
  async function loadItemKustomAll(){
    try{
      const json = await authRun('apiGetItemKustom');
      if(json && json.ok && json.items && typeof json.items === 'object'){
        CUSTOM_ITEMS_BY_AREA = json.items;
      }
    }catch(e){ /* gagal ambil item kustom bukan error fatal -- item bawaan tetap jalan */ }
  }

  /**
   * Sisipkan <option> baru SEBELUM option "+ Tambah ... Baru" (kalau ada),
   * supaya option tambah itu SELALU tetap berada paling bawah dropdown --
   * baik saat memuat data awal (populateStaticSelects -> load*Kustom ->
   * appendAddNewOption) maupun saat menambah satu kategori/area/item baru
   * di tengah sesi (lewat modal). Kalau select belum punya option "+ Tambah
   * ... Baru" (mis. FilterKategori/FilterArea), cukup ditambah di paling
   * bawah seperti biasa.
   */
  function insertOptionBeforeAddNew(sel, value, label){
    if(!sel) return;
    const exists = Array.from(sel.options).some(o => o.value === value);
    if(exists) return;
    const opt = document.createElement('option');
    opt.value = value; opt.innerText = label;
    const addNewOpt = Array.from(sel.options).find(o => o.value === ADD_NEW_VALUE);
    if(addNewOpt){
      const prev = addNewOpt.previousElementSibling;
      const anchor = (prev && prev.classList && prev.classList.contains('opt-separator')) ? prev : addNewOpt;
      sel.insertBefore(opt, anchor);
    } else {
      sel.appendChild(opt);
    }
  }

  /**
   * Tambahkan option separator (disabled, aman untuk native <select>) diikuti
   * option "+ Tambah ... Baru" di paling bawah select. Dipanggil SETELAH
   * seluruh data bawaan + kustom selesai dimuat, supaya urutannya benar:
   * [bawaan...] [kustom...] [separator] [+ Tambah ... Baru].
   */
  function appendAddNewOption(selectId, label){
    const sel = document.getElementById(selectId);
    if(!sel) return;
    if(Array.from(sel.options).some(o => o.value === ADD_NEW_VALUE)) return; // sudah ada, jangan dobel
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.className = 'opt-separator';
    sep.innerText = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    sel.appendChild(sep);
    const opt = document.createElement('option');
    opt.value = ADD_NEW_VALUE;
    opt.className = 'opt-add-new';
    opt.innerText = label;
    sel.appendChild(opt);
  }

  function appendKategoriOption(nama){
    ['Kategori','FilterKategori'].forEach(id => insertOptionBeforeAddNew(document.getElementById(id), nama, nama));
  }
  function appendAreaKerjaOption(nama){
    ['AreaKerja','FilterArea'].forEach(id => insertOptionBeforeAddNew(document.getElementById(id), nama, nama));
  }

  // ============================================================
  // TAMBAH KATEGORI BARU (dipicu memilih "+ Tambah Kategori Baru" di select Kategori)
  // ============================================================
  function handleKategoriChange(){
    const sel = document.getElementById('Kategori');
    if(sel.value === ADD_NEW_VALUE){
      sel.value = ''; // select dikembalikan ke kosong SEBELUM modal dibuka
      openTambahKategoriModal();
    }
  }
  function openTambahKategoriModal(){
    document.getElementById('kategoriBaruInput').value = '';
    setMsg('kategoriBaruMsg', '');
    document.getElementById('kategoriModalBg').classList.add('show');
  }
  function closeTambahKategoriModal(){
    document.getElementById('kategoriModalBg').classList.remove('show');
    // Batal -> pastikan select tetap/kembali ke kosong (sesuai spesifikasi).
    const sel = document.getElementById('Kategori');
    if(sel.value === ADD_NEW_VALUE) sel.value = '';
  }
  async function simpanKategoriBaru(){
    const nama = document.getElementById('kategoriBaruInput').value.trim();
    if(!nama){ setMsg('kategoriBaruMsg', 'Nama kategori wajib diisi.', true); return; }
    setMsg('kategoriBaruMsg', 'Menyimpan...');
    try{
      const json = await authRun('apiTambahKategori', nama, STATIC_KATEGORI);
      if(json && json.ok){
        appendKategoriOption(json.kategori);
        document.getElementById('Kategori').value = json.kategori;
        closeTambahKategoriModal();
        setMsg('msgInput', 'Kategori "' + json.kategori + '" ditambahkan & dipilih.');
      } else {
        setMsg('kategoriBaruMsg', (json && json.msg) ? json.msg : 'Gagal menambah kategori.', true);
      }
    }catch(err){
      setMsg('kategoriBaruMsg', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  // ============================================================
  // TAMBAH AREA KERJA BARU (dipicu memilih "+ Tambah Area Kerja Baru" di select AreaKerja)
  // ============================================================
  function handleAreaKerjaChange(){
    const sel = document.getElementById('AreaKerja');
    if(sel.value === ADD_NEW_VALUE){
      sel.value = ''; // select dikembalikan ke kosong SEBELUM modal dibuka
      refreshItemOptions(); // Item ikut direset ke "Pilih area kerja dahulu..."
      openTambahAreaModal();
      return;
    }
    refreshItemOptions();
  }
  function openTambahAreaModal(){
    document.getElementById('areaBaruInput').value = '';
    setMsg('areaBaruMsg', '');
    document.getElementById('areaModalBg').classList.add('show');
  }
  function closeTambahAreaModal(){
    document.getElementById('areaModalBg').classList.remove('show');
    const sel = document.getElementById('AreaKerja');
    if(sel.value === ADD_NEW_VALUE) sel.value = '';
  }
  async function simpanAreaBaru(){
    const nama = document.getElementById('areaBaruInput').value.trim();
    if(!nama){ setMsg('areaBaruMsg', 'Nama area kerja wajib diisi.', true); return; }
    setMsg('areaBaruMsg', 'Menyimpan...');
    try{
      const json = await authRun('apiTambahAreaKerja', nama, STATIC_AREA);
      if(json && json.ok){
        appendAreaKerjaOption(json.area);
        document.getElementById('AreaKerja').value = json.area;
        refreshItemOptions();
        closeTambahAreaModal();
        setMsg('msgInput', 'Area kerja "' + json.area + '" ditambahkan & dipilih.');
      } else {
        setMsg('areaBaruMsg', (json && json.msg) ? json.msg : 'Gagal menambah area kerja.', true);
      }
    }catch(err){
      setMsg('areaBaruMsg', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  // ============================================================
  // ITEM (bergantung pada Area Kerja) + TAMBAH ITEM BARU
  // ============================================================
  /**
   * Menampilkan Item sesuai Area Kerja yang aktif dipilih (gabungan Item
   * bawaan ITEMS_BY_AREA + Item kustom CUSTOM_ITEMS_BY_AREA untuk area
   * tersebut), lalu menaruh "+ Tambah Item Baru" di paling bawah. Dipanggil
   * ulang setiap Area Kerja berganti -- Item sebelumnya SELALU direset
   * (select dibangun ulang dari kosong) supaya Item dari Area Kerja lama
   * tidak pernah ikut terbawa ke Area Kerja baru.
   */
  function refreshItemOptions(){
    const area = document.getElementById('AreaKerja').value;
    const sel = document.getElementById('Item');
    sel.innerHTML = '';
    if(!area || area === ADD_NEW_VALUE){
      sel.innerHTML = '<option value="">Pilih area kerja dahulu&hellip;</option>';
      return;
    }
    sel.innerHTML = '<option value="">Pilih item&hellip;</option>';
    const staticItems = ITEMS_BY_AREA[area] || [];
    const customItems = CUSTOM_ITEMS_BY_AREA[area] || [];
    staticItems.concat(customItems).forEach(it => {
      const opt = document.createElement('option');
      opt.value = it; opt.innerText = it;
      sel.appendChild(opt);
    });
    appendAddNewOption('Item', '+ Tambah Item Baru');
  }

  function handleItemChange(){
    const sel = document.getElementById('Item');
    if(sel.value === ADD_NEW_VALUE){
      sel.value = ''; // select dikembalikan ke kosong SEBELUM modal dibuka
      const area = document.getElementById('AreaKerja').value;
      if(!area){ setMsg('msgInput', 'Pilih Area Kerja terlebih dahulu sebelum menambah item.', true); return; }
      openTambahItemModal();
    }
  }
  function openTambahItemModal(){
    const area = document.getElementById('AreaKerja').value;
    document.getElementById('itemBaruAreaLabel').innerText = area || '-';
    document.getElementById('itemBaruInput').value = '';
    setMsg('itemBaruMsg', '');
    document.getElementById('itemModalBg').classList.add('show');
  }
  function closeTambahItemModal(){
    document.getElementById('itemModalBg').classList.remove('show');
    const sel = document.getElementById('Item');
    if(sel.value === ADD_NEW_VALUE) sel.value = '';
  }
  async function simpanItemBaru(){
    const area = document.getElementById('AreaKerja').value;
    const nama = document.getElementById('itemBaruInput').value.trim();
    if(!area){ setMsg('itemBaruMsg', 'Area kerja wajib dipilih.', true); return; }
    if(!nama){ setMsg('itemBaruMsg', 'Nama item wajib diisi.', true); return; }
    setMsg('itemBaruMsg', 'Menyimpan...');
    try{
      const existingForArea = (ITEMS_BY_AREA[area] || []).concat(CUSTOM_ITEMS_BY_AREA[area] || []);
      const json = await authRun('apiTambahItem', area, nama, existingForArea);
      if(json && json.ok){
        if(!CUSTOM_ITEMS_BY_AREA[area]) CUSTOM_ITEMS_BY_AREA[area] = [];
        CUSTOM_ITEMS_BY_AREA[area].push(json.item);
        refreshItemOptions();
        document.getElementById('Item').value = json.item;
        closeTambahItemModal();
        setMsg('msgInput', 'Item "' + json.item + '" ditambahkan & dipilih.');
      } else {
        setMsg('itemBaruMsg', (json && json.msg) ? json.msg : 'Gagal menambah item.', true);
      }
    }catch(err){
      setMsg('itemBaruMsg', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  // ============================================================
  // INPUT LAPORAN
  // ============================================================
  function setStatusValue(value){
    const status = document.getElementById('Status');
    const v = value == null ? '' : String(value);
    if(status) status.value = v;

    document.querySelectorAll('#page-input .status-choice').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.status === v);
    });
  }

  function selectInputStatus(value){
    const status = document.getElementById('Status');
    if(status && status.disabled) return;
    setStatusValue(value);
  }

  function setStatusButtonsDisabled(disabled){
    document.querySelectorAll('#page-input .status-choice').forEach(btn => {
      btn.disabled = !!disabled;
    });
  }

  let _dateTimePickerDate = null;
  let _dateTimePickerMonth = null;
  let _dateTimePickerMode = 'DATE';
  let _dateTimeDateSelectedByUser = false;
  let _dateTimeHourSelectedByUser = false;
  let _dateTimeMinuteSelectedByUser = false;

  function pad2_(n){ return String(n).padStart(2,'0'); }

  function parseDateOnly_(value){

    const s=String(value||'').trim();

    if(!s) return null;

    // ISO date-time dari Google Apps Script / Google Sheets.
    // Contoh:
    // 2026-09-19T17:00:00.000Z
    // dikonversi ke tanggal lokal Asia/Jakarta.
    const isoDateTime =
      s.match(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/
      );

    if(isoDateTime){

      const parsed=new Date(s);

      if(Number.isNaN(parsed.getTime())){
        return null;
      }

      const parts =
        new Intl.DateTimeFormat(
          'en-GB',
          {
            timeZone:'Asia/Jakarta',
            year:'numeric',
            month:'2-digit',
            day:'2-digit'
          }
        ).formatToParts(parsed);

      const get =
        type =>
          parts.find(
            p => p.type === type
          )?.value || '';

      const year=Number(get('year'));
      const month=Number(get('month'));
      const day=Number(get('day'));

      const d =
        new Date(
          year,
          month-1,
          day
        );

      return Number.isNaN(d.getTime())
        ? null
        : d;
    }

    // Format date-only normal:
    // YYYY-MM-DD
    const m =
      s.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if(!m) return null;

    const d =
      new Date(
        Number(m[1]),
        Number(m[2])-1,
        Number(m[3])
      );

    return Number.isNaN(d.getTime())
      ? null
      : d;
  }

  function renderDateTimePickerCalendar_(){
    const title=document.getElementById('datetimeMonthTitle'), days=document.getElementById('datetimeDays');
    if(!title||!days||!_dateTimePickerMonth) return;
    title.textContent=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(_dateTimePickerMonth);
    const y=_dateTimePickerMonth.getFullYear(), m=_dateTimePickerMonth.getMonth(), first=new Date(y,m,1);
    const start=new Date(y,m,1-first.getDay()), selected=_dateTimePickerDate;
    days.innerHTML='';
    for(let i=0;i<42;i++){
      const d=new Date(start); d.setDate(start.getDate()+i);
      const b=document.createElement('button'); b.type='button'; b.className='datetime-day';
      if(d.getMonth()!==m) b.classList.add('other-month');
      if(selected&&d.getFullYear()===selected.getFullYear()&&d.getMonth()===selected.getMonth()&&d.getDate()===selected.getDate()) b.classList.add('selected');
      b.textContent=d.getDate();
      b.addEventListener('click',()=>{
        _dateTimePickerDate=new Date(d);
        _dateTimeDateSelectedByUser=true;
        renderDateTimePickerCalendar_();
        updateDateTimePickerFooter_();
      });
      days.appendChild(b);
    }
  }

  function centerDateTimeSelectOption_(selectEl){
    if(!selectEl) return;
    const selected=selectEl.querySelector('.datetime-time-option.selected');
    if(!selected) return;
    const target=selected.offsetTop - Math.max(0,(selectEl.clientHeight-selected.offsetHeight)/2);
    const maxScroll=Math.max(0,selectEl.scrollHeight-selectEl.clientHeight);
    selectEl.scrollTop=Math.max(0,Math.min(maxScroll,target));
  }

  function centerDateTimeDefaults_(){
    const h=document.getElementById('datetimeHour'), min=document.getElementById('datetimeMinute');
    centerDateTimeSelectOption_(h);
    centerDateTimeSelectOption_(min);
  }

  function renderDateTimeOptionList_(container, count, selectedValue, onSelect){
    if(!container) return;
    container.innerHTML='';
    const frag=document.createDocumentFragment();
    // Menit yang paling umum digunakan ditempatkan di posisi strategis
    // agar 00, 15, 30, 45 dapat dipilih dengan cepat tanpa mencari.
    const minutePriority=['00','15','30','45'];
    const allValues=Array.from({length:count},(_,i)=>pad2_(i));
    let values;
    if(container.id==='datetimeMinute'){
      // Tempatkan 00/15/30/45 di area tengah grid agar mudah ditemukan.
      // Semua menit lainnya tetap tersedia dan urut.
      const normalValues=allValues.filter(v=>!minutePriority.includes(v));
      const insertAt=Math.floor(normalValues.length/2)-3; // posisi awal baris tengah
      values=normalValues.slice(0,insertAt)
        .concat(minutePriority)
        .concat(normalValues.slice(insertAt));
    }else{
      values=allValues;
    }
    values.forEach(value=>{
      const btn=document.createElement('button');
      const isCommonMinute=container.id==='datetimeMinute' && minutePriority.includes(value);
      btn.type='button';
      btn.className='datetime-time-option'
        + (value===selectedValue ? ' selected' : '')
        + (isCommonMinute ? ' datetime-minute-common' : '');
      btn.dataset.value=value;
      btn.setAttribute('role','option');
      btn.setAttribute('aria-selected', value===selectedValue ? 'true' : 'false');
      btn.textContent=value;
      btn.addEventListener('click', function(){ onSelect(value); });
      frag.appendChild(btn);
    });
    container.appendChild(frag);
  }

  function getDateTimeListValue_(id, fallback){
    const el=document.getElementById(id);
    const selected=el?.querySelector('.datetime-time-option.selected');
    return selected ? selected.dataset.value : fallback;
  }

  function setDateTimeListValue_(id, value){
    const el=document.getElementById(id);
    if(!el) return;
    const target=pad2_(Number(value));
    el.querySelectorAll('.datetime-time-option').forEach(btn=>{
      const selected=btn.dataset.value===target;
      btn.classList.toggle('selected',selected);
      btn.setAttribute('aria-selected',selected?'true':'false');
    });
    const selected=el.querySelector('.datetime-time-option.selected');
    if(selected){
      const top=selected.offsetTop - Math.max(0,(el.clientHeight-selected.offsetHeight)/2);
      el.scrollTop=Math.max(0,Math.min(el.scrollHeight-el.clientHeight,top));
    }
  }

  function populateDateTimePickerOptions_(){
    const h=document.getElementById('datetimeHour'), min=document.getElementById('datetimeMinute');
    if(!h||!min) return;

    // Native <select size="5"> sengaja tidak dipakai lagi.
    // Chrome Android dapat memperlakukan native select/option secara berbeda,
    // termasuk ketika user mengetuk nilai yang sama dengan nilai aktif.
    // Daftar tombol memberi event click yang konsisten pada touch screen.
    // Laporan baru tidak boleh otomatis memilih 12:30.
    // Jam dan menit harus dipilih oleh user.
    renderDateTimeOptionList_(h,24,null,selectDateTimeHour_);
    renderDateTimeOptionList_(min,60,null,selectDateTimeMinute_);
    _dateTimeHourSelectedByUser=false;
    _dateTimeMinuteSelectedByUser=false;
    requestAnimationFrame(centerDateTimeDefaults_);
  }

  function setDateTimePickerMode_(mode){
    _dateTimePickerMode=mode==='TIME'?'TIME':'DATE';
    const calendarPane=document.getElementById('datetimeCalendarPane');
    const timePane=document.getElementById('datetimeTimePane');
    const title=document.getElementById('datetimePickerTitle');
    const head=document.querySelector('.datetime-picker-head');
    const modal=document.querySelector('.datetime-picker-modal');
    const footerDate=document.getElementById('datetimeFooterDate');
    const footerTime=document.getElementById('datetimeFooterTime');
    if(calendarPane) calendarPane.classList.toggle('datetime-pane-hidden',_dateTimePickerMode!=='DATE');
    if(timePane) timePane.classList.toggle('datetime-pane-hidden',_dateTimePickerMode!=='TIME');
    if(head) head.classList.toggle('datetime-time-mode',_dateTimePickerMode==='TIME');
    if(modal) modal.classList.toggle('datetime-time-mode',_dateTimePickerMode==='TIME');
    if(title) title.textContent=_dateTimePickerMode==='DATE'?'Pilih Tanggal':'Pilih Pukul';
    if(footerDate) footerDate.classList.toggle('datetime-footer-hidden',_dateTimePickerMode!=='DATE');
    if(footerTime) footerTime.classList.toggle('datetime-footer-hidden',_dateTimePickerMode!=='TIME');
    if(_dateTimePickerMode==='TIME') updateDateTimePickerSelectionMessage_();
  }

  function updateDateTimePickerFooter_(){
    const btn=document.getElementById('datetimeGoTimeBtn');
    if(btn) btn.disabled=!_dateTimeDateSelectedByUser;
  }

  function updateDateTimePickerSelectionMessage_(){
    const msg=document.getElementById('datetimeTimeSelectionMessage');
    const hour=document.getElementById('datetimeHour');
    const minute=document.getElementById('datetimeMinute');
    if(!msg||!hour||!minute) return;
    if(_dateTimeHourSelectedByUser && _dateTimeMinuteSelectedByUser){
      msg.className='datetime-selection-message datetime-selection-ok';
      msg.textContent='✓ Pukul telah dipilih: '+getDateTimeListValue_('datetimeHour','12')+':'+getDateTimeListValue_('datetimeMinute','30');
    }else if(!_dateTimeHourSelectedByUser){
      msg.className='datetime-selection-message datetime-selection-warning';
      msg.textContent='⚠ Silakan pilih jam terlebih dahulu';
    }else{
      msg.className='datetime-selection-message datetime-selection-warning';
      msg.innerHTML='<span class="datetime-selection-hour-ok">✓ Jam '+getDateTimeListValue_('datetimeHour','12')+' telah dipilih</span>' +
        '<span class="datetime-selection-minute-warning"> · Silakan pilih menit</span>';
    }
  }

  function selectDateTimeHour_(value){
    setDateTimeListValue_('datetimeHour', value);
    _dateTimeHourSelectedByUser=true;
    updateDateTimePickerSelectionMessage_();
  }

  function selectDateTimeMinute_(value){
    setDateTimeListValue_('datetimeMinute', value);
    _dateTimeMinuteSelectedByUser=true;
    updateDateTimePickerSelectionMessage_();
  }

  function openDateTimePicker(){
    const tanggal=document.getElementById('Tanggal'), pukul=document.getElementById('Pukul');
    if(tanggal?.disabled||pukul?.disabled) return;
    const base=parseDateOnly_(tanggal?.value)||new Date();
    _dateTimePickerDate=new Date(base);
    _dateTimePickerMonth=new Date(base.getFullYear(),base.getMonth(),1);
    populateDateTimePickerOptions_();
    const hm=String(pukul?.value||'').match(/^(\d{1,2}):(\d{2})/);
    const hour=document.getElementById('datetimeHour'), minute=document.getElementById('datetimeMinute');
    const hasExistingTime=!!hm;
    const hasExistingDate=!!tanggal?.value;
    // Hanya laporan EDIT yang sudah memiliki waktu yang langsung dipilih.
    // Laporan baru tetap kosong sampai user memilih Jam dan Menit.
    if(hm){
      const hourValue=pad2_(hm[1]);
      const minuteValue=pad2_(Math.max(0,Math.min(59,Number(hm[2]))));
      setDateTimeListValue_('datetimeHour', hourValue);
      setDateTimeListValue_('datetimeMinute', minuteValue);
    }
    // Tanggal yang tampil saat picker dibuka (tanggal laporan yang sudah ada,
    // atau hari ini untuk laporan baru) dianggap sebagai tanggal terpilih.
    // Ini sesuai dengan tanggal yang sudah terlihat/ditandai pada kalender,
    // sehingga tombol OK tidak harus didahului klik tanggal lain.
    _dateTimeDateSelectedByUser=true;

    // Valid hanya jika laporan EDIT memang memiliki waktu tersimpan.
    // Laporan baru harus memilih Jam dan Menit terlebih dahulu.
    _dateTimeHourSelectedByUser=hasExistingTime;
    _dateTimeMinuteSelectedByUser=hasExistingTime;
    renderDateTimePickerCalendar_();
    document.getElementById('datetimePickerBackdrop')?.classList.remove('hidden');
    setDateTimePickerMode_('DATE');
    updateDateTimePickerFooter_();
  }

  function closeDateTimePicker(){
    document.getElementById('datetimePickerBackdrop')?.classList.add('hidden');
  }

  function goToDateTimeTimeMode(){
    if(!_dateTimeDateSelectedByUser){
      alert('Silakan pilih tanggal terlebih dahulu.');
      return;
    }

    // Tampilkan mode waktu tanpa menimpa nilai waktu yang sudah ada.
    // populateDateTimePickerOptions_() sudah menetapkan default 12:30 untuk
    // laporan baru; laporan yang memiliki waktu tetap mempertahankan waktunya.
    setDateTimePickerMode_('TIME');
    requestAnimationFrame(()=>{
      centerDateTimeDefaults_();
      // Satu frame tambahan setelah pane TIME selesai layout.
      requestAnimationFrame(centerDateTimeDefaults_);
    });
  }

  function backToDateTimeDateMode(){
    setDateTimePickerMode_('DATE');
    updateDateTimePickerFooter_();
  }

  function changeDateTimeMonth(delta){
    if(!_dateTimePickerMonth) return;
    _dateTimePickerMonth=new Date(_dateTimePickerMonth.getFullYear(),_dateTimePickerMonth.getMonth()+delta,1);
    renderDateTimePickerCalendar_();
  }

  function applyDateTimePicker(){
    if(!_dateTimeDateSelectedByUser){
      alert('Silakan pilih tanggal terlebih dahulu.');
      return;
    }
    if(!_dateTimeHourSelectedByUser || !_dateTimeMinuteSelectedByUser){
      updateDateTimePickerSelectionMessage_();
      alert(!_dateTimeHourSelectedByUser
        ? 'Jam wajib diisi. Silakan pilih jam terlebih dahulu.'
        : 'Menit wajib diisi. Silakan pilih menit terlebih dahulu.');
      return;
    }
    const hour=getDateTimeListValue_('datetimeHour','12');
    const minute=getDateTimeListValue_('datetimeMinute','00');
    const tanggal=_dateTimePickerDate.getFullYear()+'-'+pad2_(_dateTimePickerDate.getMonth()+1)+'-'+pad2_(_dateTimePickerDate.getDate());
    const pukul=hour+':'+minute;
    const t=document.getElementById('Tanggal'), p=document.getElementById('Pukul');
    if(t) t.value=tanggal;
    if(p) p.value=pukul;
    syncDateTimeDisplay_();
    closeDateTimePicker();
  }

  function syncDateTimeDisplay_(){
    const t=document.getElementById('Tanggal')?.value||'', p=document.getElementById('Pukul')?.value||'';
    const datePart=document.getElementById('TanggalWaktuDate'), timePart=document.getElementById('TanggalWaktuTime'), box=document.getElementById('TanggalWaktuDisplay');
    if(!datePart||!timePart||!box) return;
    const d=parseDateOnly_(t);
    if(d){
      datePart.textContent=pad2_(d.getDate())+'/'+pad2_(d.getMonth()+1)+'/'+d.getFullYear();
      timePart.textContent=p||'--:--';
      box.classList.add('has-value');
    }else{
      datePart.textContent='Pilih tanggal';
      timePart.textContent=p||'--:--';
      box.classList.remove('has-value');
    }
  }

  function getInputPayload(){
    const payload = {
      Tanggal: document.getElementById('Tanggal').value,
      Pelapor: document.getElementById('Pelapor').value.trim(),
      Pukul: document.getElementById('Pukul').value.trim(),
      NoLK: document.getElementById('NoLK').value.trim(),
      Ruang: document.getElementById('Ruang').value.trim(),
      MasalahKegiatan: document.getElementById('MasalahKegiatan').value.trim(),
      Tindakan: document.getElementById('Tindakan').value.trim(),
      SparePartUnit: document.getElementById('SparePartUnit').value.trim(),
      Type: document.getElementById('Type').value.trim(),
      Jumlah: document.getElementById('Jumlah').value.trim(),
      Status: document.getElementById('Status').value,
      Kategori: document.getElementById('Kategori').value,
      AreaKerja: document.getElementById('AreaKerja').value,
      Item: document.getElementById('Item').value,
      Keterangan: document.getElementById('Keterangan').value.trim()
    };
    if(_reportFormMode !== 'EDIT'){
      payload.Petugas = CURRENT_SESSION ? (CURRENT_SESSION.nama || CURRENT_SESSION.username) : '';
    }
    return payload;
  }

  function getMissingRequiredFields(p){
    const missing = [];
    if(!String(p.Tanggal || '').trim()) missing.push('Tanggal');
    if(!String(p.Pukul || '').trim()) missing.push('Jam');
    if(!String(p.Ruang || '').trim()) missing.push('Ruangan');
    if(!String(p.MasalahKegiatan || '').trim()) missing.push('Masalah/Kegiatan');
    if(!String(p.Tindakan || '').trim()) missing.push('Tindakan');
    if(!String(p.Status || '').trim()) missing.push('Status');
    if(!String(p.Kategori || '').trim()) missing.push('Kategori');
    if(!String(p.AreaKerja || '').trim()) missing.push('Area Kerja');
    if(!String(p.Item || '').trim()) missing.push('Item');

    // Hanya kategori resmi Spare Part Baru / Unit Baru yang mewajibkan
    // Spare Part / Unit, Type, dan Jumlah. Harus konsisten dengan backend.
    const kategoriBaru = String(p.Kategori || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const kategoriWajibBaru = new Set([
      'PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART BARU',
      'PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART BARU',
      'PERBAIKAN DENGAN PENGGANTIAN SPARE PART BARU',
      'PENGGANTIAN ATAU PEMASANGAN UNIT /ALAT BARU (PERBAIKAN ATAU PASANG BARU)'
    ]);
    if(kategoriWajibBaru.has(kategoriBaru)){
      if(!String(p.SparePartUnit || '').trim()) missing.push('Spare Part / Unit');
      if(!String(p.Type || '').trim()) missing.push('Type');
      if(!String(p.Jumlah || '').trim()) missing.push('Jumlah');
    }
    return missing;
  }

  function openRequiredFieldsModal(fields){
    const bg = document.getElementById('requiredFieldsModalBg');
    const list = document.getElementById('requiredFieldsModalList');
    if(!bg || !list) return;
    list.innerHTML = fields.map(function(field){
      return '<li><span class="required-modal-dot"></span><span>' +
        String(field).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
        ' <strong>wajib diisi</strong>.</span></li>';
    }).join('');
    bg.classList.add('show');
    document.body.classList.add('modal-open');
  }

  function closeRequiredFieldsModal(){
    const bg = document.getElementById('requiredFieldsModalBg');
    if(bg) bg.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  function validateInputPayload(p){
    const missing = getMissingRequiredFields(p);
    if(missing.length) return missing[0] + ' wajib diisi.';
    // Jaga-jaga di frontend (validasi sesungguhnya tetap di backend, lihat
    // Reports.gs: validateReportPayload_): placeholder "+ Tambah ... Baru"
    // tidak pernah boleh lolos sebagai nilai laporan.
    if(p.Kategori === ADD_NEW_VALUE || p.AreaKerja === ADD_NEW_VALUE || p.Item === ADD_NEW_VALUE){
      return 'Pilihan tidak valid, silakan pilih ulang dari dropdown.';
    }
    return '';
  }

  async function saveData(){
    const payload = getInputPayload();
    const missingRequired = getMissingRequiredFields(payload);
    if(missingRequired.length){
      openRequiredFieldsModal(missingRequired);
      setMsg('msgInput', missingRequired[0] + ' wajib diisi.', true);
      return;
    }
    const err = validateInputPayload(payload);
    if(err){ setMsg('msgInput', err, true); return; }

    const inputPage = document.getElementById('page-input');
    const inputPageIsEdit = !!(inputPage && inputPage.classList.contains('edit-mode'));
    const isEditMode = _reportFormMode === 'EDIT' || inputPageIsEdit;
    const editingReportId = String(_editingReportId || '').trim();

    // FAIL-SAFE: halaman EDIT tidak boleh pernah jatuh menjadi CREATE.
    // Jika state EDIT kehilangan report ID, batalkan penyimpanan agar tidak
    // membuat baris/laporan baru secara tidak sengaja.
    if(isEditMode && !editingReportId){
      setMsg('msgInput', 'ID laporan EDIT tidak ditemukan. Penyimpanan dibatalkan untuk mencegah duplikasi.', true);
      alert('ID laporan EDIT tidak ditemukan. Penyimpanan dibatalkan. Silakan buka laporan kembali dari menu Laporan.');
      return;
    }

    const isEdit = isEditMode;
    setMsg('msgInput', isEdit ? 'Menyimpan perubahan...' : 'Menyimpan...');
    try{
      const json = isEdit
        ? await authRun('apiUpdateReport', editingReportId, payload)
        : await authRun('apiCreateReport', payload);

      if(json && json.ok){
        // FIX: Laporan baru/edit membuat status "sudah isi hari ini" berubah
        // di server, tapi cache read 30 detik di browser (laporan-edit-
        // direction-fix.js) tidak tahu itu. Tanpa ini, tab Monitoring Harian
        // / Rekap / Daftar bisa menampilkan status "Belum Isi" yang sudah
        // basi selama sampai 30 detik setelah laporan tersimpan.
        if(typeof window.__ipsrsClearLaporanApiCache === 'function'){
          window.__ipsrsClearLaporanApiCache();
        }
        if(typeof window.__ipsrsClearDashboardCache === 'function'){
          window.__ipsrsClearDashboardCache();
        }
        if(isEdit){
          invalidateLaporanViews();
          const editedId = _editingReportId;
          startCreateReportForm(true);
          openSaveSuccessModal('Perubahan laporan berhasil disimpan (ID: ' + editedId + ').');
          goPage('laporan');
        } else {
          invalidateLaporanViews();
          setMsg('msgInput', 'Laporan tersimpan (ID: ' + json.report_id + ').');
          resetInputFieldsAfterCreate();
          openSaveSuccessModal('Laporan berhasil disimpan (ID: ' + json.report_id + ').');
        }
      } else {
        setMsg('msgInput', (json && json.msg) ? json.msg : (isEdit ? 'Gagal menyimpan perubahan.' : 'Gagal menyimpan laporan.'), true);
      }
    }catch(err){
      setMsg('msgInput', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  function resetInputFieldsAfterCreate(){
    ['Tanggal','Pelapor','Pukul','NoLK','Ruang','MasalahKegiatan','Tindakan','SparePartUnit','Type','Jumlah','Keterangan'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    const kategori = document.getElementById('Kategori');
    const area = document.getElementById('AreaKerja');
    if(kategori) kategori.value = '';
    if(area) area.value = '';
    refreshItemOptions();
    setStatusValue('');
    syncDateTimeDisplay_();
  }

  function startCreateReportForm(forceCreate){
    // Jangan izinkan reset CREATE tak sengaja saat proses EDIT masih aktif.
    // Navigasi Input normal dan reset setelah simpan memanggil forceCreate=true.
    if(!forceCreate && _reportFormMode === 'EDIT' && _editingReportId){
      console.warn('[EDIT] startCreateReportForm() diabaikan karena EDIT masih aktif:', _editingReportId);
      return;
    }
    _editTransitionToken = null;
    _reportFormMode = 'CREATE';
    const inputPage = document.getElementById('page-input');
    if(inputPage) inputPage.classList.remove('edit-mode');
    _editingReportId = null;
    _historyLoadedForReportId = null;

    const title = document.getElementById('inputPageTitle');
    const desc = document.getElementById('inputPageDesc');
    const btn = document.getElementById('btnSaveInput');
    const note = document.getElementById('inputPermissionNote');
    const history = document.getElementById('inputHistoryPanel');
    if(title) title.innerText = 'Input Laporan';
    if(desc) desc.innerText = 'Isi laporan kegiatan / perbaikan harian ini';
    if(btn){ btn.innerText = 'Simpan Laporan'; btn.classList.remove('hidden'); }
    if(note) note.classList.add('hidden');
    if(history) history.classList.add('hidden');

    INPUT_EDITABLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.disabled = false;
    });
    setStatusButtonsDisabled(false);
    const petugas = document.getElementById('Petugas');
    if(petugas){
      petugas.disabled = false;
      petugas.readOnly = true;
      petugas.value = CURRENT_SESSION ? (CURRENT_SESSION.nama || CURRENT_SESSION.username || '') : '';
    }

    resetInputFieldsAfterCreate();
    const tanggal = document.getElementById('Tanggal');
    if(tanggal) tanggal.value = '';
    const pukul = document.getElementById('Pukul');
    if(pukul) pukul.value = '';
    syncDateTimeDisplay_();
    setMsg('msgInput','');
  }

  function getReportField_(report, names){
    if(!report) return '';
    const list=Array.isArray(names)?names:[names];
    for(let i=0;i<list.length;i++){
      const key=list[i];
      if(Object.prototype.hasOwnProperty.call(report,key) &&
         report[key] !== null &&
         report[key] !== undefined &&
         String(report[key]).trim() !== ''){
        return report[key];
      }
    }
    return '';
  }

  function setInputSelectValue(id, value){
    const sel = document.getElementById(id);
    if(!sel) return;
    const v = value == null ? '' : String(value);
    if(v && !Array.from(sel.options).some(o => o.value === v)){
      const opt = document.createElement('option');
      opt.value = v;
      opt.innerText = v;
      sel.appendChild(opt);
    }
    sel.value = v;
  }

  async function openEditModalForReport(report){
    if(!report) return;

    const reportIdKey = Object.keys(report).find(function(k){
      return /^(report[_ ]?id|id[_ ]?report)$/i.test(String(k).trim()) ||
             (/report/i.test(k) && /id/i.test(k));
    });

    const resolvedReportId = String(
      report.ID ??
      report.report_id ??
      report.ReportID ??
      report.id ??
      (reportIdKey ? report[reportIdKey] : '') ??
      ''
    ).trim();

    if(!resolvedReportId){
      alert('ID laporan tidak ditemukan. Form EDIT dibatalkan agar tidak berisiko membuat duplikat.');
      console.error('[EDIT] Report tanpa ID:', report);
      return;
    }

    _reportFormMode = 'EDIT';
    _editingReportId = resolvedReportId;
    _editTransitionToken = resolvedReportId + '|' + Date.now() + '|' + Math.random().toString(36).slice(2);
    const editTransitionToken = _editTransitionToken;
    _historyLoadedForReportId = null;

    goPage('input', true);

    const inputPage = document.getElementById('page-input');
    if(inputPage) inputPage.classList.add('edit-mode');

    const title = document.getElementById('inputPageTitle');
    const desc = document.getElementById('inputPageDesc');
    const btn = document.getElementById('btnSaveInput');
    const note = document.getElementById('inputPermissionNote');
    const history = document.getElementById('inputHistoryPanel');

    if(title) title.innerText = 'Edit Laporan';
    if(desc) desc.innerText = 'Mengambil data laporan terbaru...';
    if(btn){ btn.innerText = 'Memuat...'; btn.classList.add('hidden'); }
    if(note){ note.classList.add('hidden'); note.innerText = ''; }

    INPUT_EDITABLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.disabled = true;
    });
    setStatusButtonsDisabled(true);

    setMsg('msgInput','Mengambil data laporan terbaru...');

    let latest = null;
    try{
      const json = await authRun('apiGetReportById', resolvedReportId);

      if(_editTransitionToken !== editTransitionToken ||
         _reportFormMode !== 'EDIT' ||
         String(_editingReportId || '').trim() !== resolvedReportId){
        console.warn('[EDIT] Transisi EDIT dibatalkan karena state berubah.');
        return;
      }

      if(!json || !json.ok){
        throw new Error((json && json.msg) ? json.msg : 'Gagal mengambil data laporan terbaru.');
      }

      latest = json.data || json.report || null;
      if(!latest){
        throw new Error('Data laporan terbaru tidak ditemukan.');
      }
    }catch(err){
      if(_editTransitionToken !== editTransitionToken) return;
      if(title) title.innerText = 'Edit Laporan';
      if(desc) desc.innerText = 'Gagal mengambil data laporan terbaru.';
      setMsg('msgInput', 'Gagal memuat laporan: ' + (err && err.message ? err.message : err), true);
      console.error('[EDIT] Gagal mengambil laporan terbaru:', err);
      return;
    }

    const editable = canEditReport(latest);

    if(title) title.innerText = 'Edit Laporan';
    if(desc) desc.innerText = 'ID: ' + resolvedReportId + ' · Petugas: ' + (getReportField_(latest, ['Petugas','nama_snapshot','petugas']) || '-') + ' · Data terbaru dari server';
    if(btn){
      btn.innerText = 'Simpan Perubahan';
      btn.classList.toggle('hidden', !editable);
    }
    if(note){
      note.classList.toggle('hidden', editable);
      note.innerText = 'Anda hanya dapat MELIHAT laporan ini (bukan milik Anda). Hanya pemilik laporan, Administrasi, atau KA IPSRS yang dapat mengedit.';
    }

    INPUT_EDITABLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.disabled = !editable;
    });
    setStatusButtonsDisabled(!editable);

    const editData = {
      Tanggal: getReportField_(latest, ['Tanggal','tanggal']),
      Pelapor: getReportField_(latest, ['Pelapor','pelapor']),
      Pukul: getReportField_(latest, ['Pukul','pukul']),
      NoLK: getReportField_(latest, ['NoLK','nolk','no_lk']),
      Ruang: getReportField_(latest, ['Ruang','ruang']),
      MasalahKegiatan: getReportField_(latest, ['MasalahKegiatan','masalah_kegiatan']),
      Tindakan: getReportField_(latest, ['Tindakan','tindakan']),
      SparePartUnit: getReportField_(latest, ['SparePartUnit','spare_part_unit']),
      Type: getReportField_(latest, ['Type','type']),
      Jumlah: getReportField_(latest, ['Jumlah','jumlah']),
      Status: getReportField_(latest, ['Status','status']),
      Kategori: getReportField_(latest, ['Kategori','kategori']),
      AreaKerja: getReportField_(latest, ['AreaKerja','area_kerja']),
      Item: getReportField_(latest, ['Item','item']),
      Keterangan: getReportField_(latest, ['Keterangan','keterangan']),
      Petugas: getReportField_(latest, ['Petugas','nama_snapshot','petugas'])
    };

    document.getElementById('Tanggal').value = editData.Tanggal || '';
    document.getElementById('Pelapor').value = editData.Pelapor || '';
    document.getElementById('Pukul').value = editData.Pukul || '';
    syncDateTimeDisplay_();
    document.getElementById('NoLK').value = editData.NoLK || '';
    document.getElementById('Ruang').value = editData.Ruang || '';
    document.getElementById('MasalahKegiatan').value = editData.MasalahKegiatan || '';
    document.getElementById('Tindakan').value = editData.Tindakan || '';
    document.getElementById('SparePartUnit').value = editData.SparePartUnit || '';
    document.getElementById('Type').value = editData.Type || '';
    document.getElementById('Jumlah').value = editData.Jumlah || '';
    setStatusValue(editData.Status || '');

    setInputSelectValue('Kategori', editData.Kategori || '');
    setInputSelectValue('AreaKerja', editData.AreaKerja || '');
    refreshItemOptions();
    setInputSelectValue('Item', editData.Item || '');
    document.getElementById('Keterangan').value = editData.Keterangan || '';

    const petugas = document.getElementById('Petugas');
    if(petugas){
      petugas.disabled = false;
      petugas.readOnly = true;
      petugas.value = editData.Petugas || '';
    }

    console.info('[EDIT] Data laporan terbaru dipetakan ke form:', {
      id: resolvedReportId,
      tanggal: editData.Tanggal,
      pelapor: editData.Pelapor,
      ruang: editData.Ruang,
      status: editData.Status
    });

    setMsg('msgInput','');

    if(history){
      const showHistory = CURRENT_SESSION && (CURRENT_SESSION.role === 'KA_IPSRS' || CURRENT_SESSION.role === 'ADMINISTRASI');
      history.classList.toggle('hidden', !showHistory);
      if(showHistory){
        document.getElementById('historyList').classList.add('hidden');
        document.getElementById('historyList').innerHTML = '';
      }
    }
  }

  function closeEditModal(){
    // Kompatibilitas dengan pemanggilan lama; Edit sekarang tidak memakai modal.
    startCreateReportForm(true);
  }

  // ============================================================
  // LAPORAN (tabel + kartu mobile + filter + admin staff picker)
  // ============================================================
  function getActiveLaporanMode_(){
    const active = document.querySelector('.sub-tab.active');
    return active && active.dataset && active.dataset.subtab === 'daftar' ? 'daftar' : 'saya';
  }

  async function loadReportsBySelectedMonth(){
    const bulan = document.getElementById('FilterBulan').value;
    const modeAtRequest = getActiveLaporanMode_();
    _laporanMode = modeAtRequest;
    const requestSeq = (Number(window.__IPSRS_LAPORAN_REQUEST_SEQ) || 0) + 1;
    window.__IPSRS_LAPORAN_REQUEST_SEQ = requestSeq;
    setMsg('msgReport', 'Memuat data...');
    try{
      const staffFilter = (modeAtRequest === 'saya' && CURRENT_SESSION) ? (CURRENT_SESSION.staff_id || '') : '';
      const json = await authRun('apiGetReports', bulan, staffFilter, '', modeAtRequest);

      // Request lama atau response dari mode yang sudah tidak aktif
      // tidak boleh menyentuh rawData/render tabel.
      if(requestSeq !== Number(window.__IPSRS_LAPORAN_REQUEST_SEQ) ||
         getActiveLaporanMode_() !== modeAtRequest){
        return false;
      }

      if(!json || !json.ok){
        setMsg('msgReport', (json && json.msg) ? json.msg : 'Gagal memuat data.', true);
        rawData = [];
        renderReportTable([]);
        return false;
      }
      rawData = json.data || [];

      if(!Array.isArray(ADMIN_STAFF_LIST) || ADMIN_STAFF_LIST.length === 0){
        syncAdminStaffFromReports_();
      }else{
        renderAdminStaffSelect();
      }

      applyFilters();
      return true;
    }catch(err){
      if(requestSeq !== Number(window.__IPSRS_LAPORAN_REQUEST_SEQ) ||
         getActiveLaporanMode_() !== modeAtRequest){
        return false;
      }
      setMsg('msgReport', 'Error: ' + (err && err.message ? err.message : err), true);
      return false;
    }
  }

  function applyFilters(){
    const status = document.getElementById('FilterStatus').value;
    const isDashboardUnfinishedFilter = status === '__BELUM_SELESAI__';
    const kategori = document.getElementById('FilterKategori').value;
    const area = document.getElementById('FilterArea').value;
    const bidang = document.getElementById('FilterBidang').value;
    // Filter "Shift" dihapus (P1 §3.6) -- elemen #FilterShift tidak ada lagi
    // di HTML, dan backend tidak pernah memproses parameter shift.
    const cari = document.getElementById('FilterCari').value.trim().toLowerCase();

    const viewData = rawData.filter(r => {
      if(isDashboardUnfinishedFilter){
        if(r.Status === 'Selesai') return false;
      }else if(status && r.Status !== status) return false;
      if(kategori && r.Kategori !== kategori) return false;
      if(area && r.AreaKerja !== area) return false;
      if(bidang && r.Bidang !== bidang) return false;
      if(adminSelectedStaffId && r.StaffID !== adminSelectedStaffId) return false;
      if(cari){
        const hay = [r.Ruang, r.MasalahKegiatan, r.Tindakan, r.Item, r.NoLK, r.Petugas].join(' ').toLowerCase();
        if(hay.indexOf(cari) === -1) return false;
      }
      return true;
    });

    renderReportTable(viewData);
    renderLaporanSummary(viewData, document.getElementById('FilterBulan') ? document.getElementById('FilterBulan').value : '');
    setMsg('msgReport', 'Data tampil: ' + viewData.length + ' dari ' + rawData.length);
  }

  function openDaftarUnfinishedReports(){
    // Saat kartu "Belum" diklik dari Laporan Saya, tetap di Laporan Saya
    // dan tetap memakai data staff_id user yang sedang login.
    const panel = document.getElementById('subtab-daftar');
    const sayaAktif = panel && !panel.classList.contains('hidden') && _laporanMode === 'saya';
    const statusEl = document.getElementById('FilterStatus');

    if(sayaAktif){
      if(statusEl) statusEl.value = '__BELUM_SELESAI__';
      window.__IPSRS_SAYA_UNFINISHED_DRILLDOWN = true;
      if(Array.isArray(rawData) && rawData.length){
        if(typeof applyFilters === 'function') applyFilters();
        window.__IPSRS_SAYA_UNFINISHED_DRILLDOWN = false;
      }else if(typeof loadReportsBySelectedMonth === 'function'){
        loadReportsBySelectedMonth();
      }
      return;
    }

    // Saat kartu "Belum" diklik dari Daftar Laporan, tampilkan pekerjaan
    // yang belum selesai dalam scope data yang diizinkan backend.
    if(statusEl) statusEl.value = '__BELUM_SELESAI__';
    const daftarAktif = panel && !panel.classList.contains('hidden');
    if(daftarAktif && Array.isArray(rawData) && rawData.length){
      if(typeof applyFilters === 'function') applyFilters();
      return;
    }

    window.__IPSRS_DAFTAR_UNFINISHED_DRILLDOWN = true;
    if(typeof goLaporanSubTab === 'function') goLaporanSubTab('daftar');
  }

  function bindDaftarUnfinishedDrilldown(){
    const valueEl = document.getElementById('lapBelum');
    if(!valueEl) return;
    const card = valueEl.closest('.stat-card');
    if(!card || card.dataset.ipsrsUnfinishedBound === '1') return;
    card.dataset.ipsrsUnfinishedBound = '1';
    card.style.cursor = 'pointer';
    card.title = 'Lihat pekerjaan yang belum selesai';
    card.addEventListener('click', function(event){
      event.preventDefault();
      openDaftarUnfinishedReports();
    });
  }

  function renderLaporanSummary(rows, bulan){
    const total = rows.length;
    const selesai = rows.filter(r => r.Status === 'Selesai').length;
    const belum = rows.filter(r => r.Status !== 'Selesai').length;
    const el = id => document.getElementById(id);
    if(el('lapTotal')) el('lapTotal').innerText = total;
    if(el('lapSelesai')) el('lapSelesai').innerText = selesai;
    if(el('lapBelum')) el('lapBelum').innerText = belum;
    if(el('lapBulanIni')) el('lapBulanIni').innerText = bulan || '-';
    bindDaftarUnfinishedDrilldown();
  }

  function renderReportTable(viewData){
    const tbody = document.getElementById('reportTableBody');
    const cardList = document.getElementById('reportCardList');
    tbody.innerHTML = '';
    cardList.innerHTML = '';

    window.__IPSRS_REPORTS = window.__IPSRS_REPORTS || {};
    viewData.forEach(row => {
      // Normalisasi ID laporan dari backend. REPORTS menggunakan field report_id.
      const resolvedReportId = String(
        row.ID ?? row.report_id ?? row.ReportID ?? row.id ?? ''
      ).trim();

      // Simpan sebagai ID juga agar seluruh alur frontend memakai satu nama field.
      if(resolvedReportId) row.ID = resolvedReportId;

      window.__IPSRS_REPORTS[resolvedReportId] = row;
      const tr = document.createElement('tr');
      // Kolom "Bidang/Shift" (P1 §3.6): konsep Shift sudah dihapus dari
      // backend, jadi kolom ini sekarang murni menampilkan Bidang.
      const bidang = row.Bidang || '-';
      tr.innerHTML = `
        <td>${escapeHtml(formatTanggalDisplay(row.Tanggal))}</td>
        <td>${escapeHtml(row.Pukul)}</td>
        <td>${escapeHtml(row.Ruang)}</td>
        <td>${escapeHtml(row.NoLK)}</td>
        <td>${escapeHtml(row.MasalahKegiatan)}</td>
        <td>${escapeHtml(row.Tindakan)}</td>
        <td>${escapeHtml(row.Petugas)}</td>
        <td>${escapeHtml(bidang)}</td>
        <td><span class="pill ${row.Status==='Selesai'?'success':'warning'}">${escapeHtml(row.Status)}</span></td>
        <td>${escapeHtml(row.Kategori)}</td>
        <td>${escapeHtml(row.AreaKerja)}</td>
        <td>${escapeHtml(row.Item)}</td>
        <td class="report-action"><button class="btn" type="button">✏️ Edit</button></td>
      `;
      tr.className = row.Status === 'Selesai' ? 'report-row-selesai' : (row.Status === 'Belum' ? 'report-row-belum' : 'report-row-proses');

      // Baris laporan tidak membuka form. Hanya tombol Edit yang membuka mode EDIT.
      const editBtn = tr.querySelector('.report-action button');
      if(editBtn){
        editBtn.addEventListener('click', function(event){
          event.preventDefault();
          event.stopPropagation();
          openEditModalForReport(row);
        });
      }
      tbody.appendChild(tr);

      const card = document.createElement('div');
card.className = 'rcard';

card.innerHTML = `
  <div class="rc-top">
    <div class="rc-title">
      <span class="rc-date">${escapeHtml(formatTanggalDisplay(row.Tanggal))}</span>
      <span class="rc-separator" aria-hidden="true"></span>
      <span class="rc-room">${escapeHtml(row.Ruang)}</span>
    </div>

    <span class="pill ${row.Status === 'Selesai' ? 'success' : 'warning'}">
      ${escapeHtml(row.Status)}
    </span>
  </div>

  <div class="rc-line">
    <span class="rc-label">Masalah:</span>
    ${escapeHtml(row.MasalahKegiatan)}
  </div>

  <div class="rc-line">
    <span class="rc-label">Tindak Lanjut:</span>
    ${escapeHtml(row.Tindakan)}
  </div>

  <div class="rc-line">
    <span class="rc-label">Petugas:</span>
    ${escapeHtml(row.Petugas)}
  </div>
`;

// Kartu laporan tidak membuka edit saat area kartu diklik.
cardList.appendChild(card);
    });
  }

  // ============================================================
  // SUB-TAB HALAMAN LAPORAN (Monitoring Harian / Rekap Bulanan / Daftar Laporan)
  // ============================================================
  const _laporanSubTabLoaded = { monitoring: false, rekap: false, daftar: false, saya: false };
  const _laporanSubTabLoading = { monitoring: false, rekap: false, daftar: false, saya: false };
  let _laporanMode = 'saya';

  function loadLaporanSubTabOnce_(name, loader){
    if(_laporanSubTabLoaded[name] || _laporanSubTabLoading[name]) return;
    _laporanSubTabLoading[name] = true;
    let result;
    try{
      result = loader();
    }catch(err){
      _laporanSubTabLoading[name] = false;
      throw err;
    }
    if(result && typeof result.then === 'function'){
      result.then(function(ok){
        _laporanSubTabLoaded[name] = (ok !== false);
      },function(){
        _laporanSubTabLoaded[name] = false;
      }).finally(function(){
        _laporanSubTabLoading[name] = false;
      });
    }else{
      _laporanSubTabLoaded[name] = (result !== false);
      _laporanSubTabLoading[name] = false;
    }
  }
  // Laporan tidak perlu mengulang request setiap kali user bolak-balik menu.
  // Refresh hanya dipaksa saat pertama dibuka atau setelah data laporan berubah.
  let _laporanPageInitialized = false;
  let _laporanNeedsRefresh = false;

  function resetLaporanFilterControls_(options){
    const opts = options || {};
    const preserveUnfinished = opts.preserveUnfinished === true;

    // Filter petugas Daftar Laporan.
    adminSelectedStaffId = '';
    const adminStaff = document.getElementById('adminStaffSelect');
    if(adminStaff) adminStaff.value = '';

    // Filter Daftar/Laporan Saya.
    const reportFilterIds = [
      'FilterKategori',
      'FilterArea',
      'FilterBidang',
      'FilterCari'
    ];
    reportFilterIds.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    const statusEl = document.getElementById('FilterStatus');
    if(statusEl) statusEl.value = preserveUnfinished ? '__BELUM_SELESAI__' : '';

    // Filter Monitoring Harian.
    ['MonFilterStatus','MonFilterBidang','MonFilterCari'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });

    // Filter petugas Dashboard.
    const dashStaff = document.getElementById('DashStaff');
    if(dashStaff) dashStaff.value = '';

    // Karena navigasi ini tidak selalu memicu event onchange, render ulang
    // data yang sudah ada agar hasil langsung kembali ke kondisi tanpa filter.
    const activeSubTab = document.querySelector('.sub-tab.active')?.dataset?.subtab || '';
    if(activeSubTab === 'monitoring' && Array.isArray(_monData)){
      renderStaffMonitoring();
    }else if((activeSubTab === 'saya' || activeSubTab === 'daftar') && Array.isArray(rawData)){
      applyFilters();
    }
  }

  function goLaporanSubTab(name){
    const loadingName = (name === 'monitoring' || name === 'rekap') ? name : (name === 'daftar' ? 'daftar' : 'saya');
    if(typeof window.__ipsrsLaporanNavigationStart === 'function') window.__ipsrsLaporanNavigationStart(loadingName);
    const finishNavigationLoading = function(){
      if(typeof window.__ipsrsLaporanNavigationDone === 'function') window.__ipsrsLaporanNavigationDone();
    };
    // Klik manual menu/submenu Laporan selalu menjadi titik reset filter.
    // Drill-down Dashboard dikecualikan hanya selama navigasi internal.
    const internalNav = window.__IPSRS_LAPORAN_INTERNAL_NAV === true;
    if(!internalNav){
      resetLaporanUnfinishedState();
    }
    const panelName = (name === 'saya' || name === 'daftar') ? 'daftar' : name;
    document.querySelectorAll('.sub-tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('subtab-' + panelName).classList.remove('hidden');
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === name));

    // Reset dilakukan setelah panel tujuan aktif supaya data yang sudah
    // termuat langsung dirender ulang tanpa filter lama.
    resetLaporanFilterControls_({
      preserveUnfinished: internalNav && window.__IPSRS_DASHBOARD_UNFINISHED_DRILLDOWN === true
    });

    if(name === 'saya' || name === 'daftar'){
      _laporanMode = name;
      const staffPanel = document.getElementById('adminStaffPanel');
      if(staffPanel) staffPanel.classList.toggle('hidden', name !== 'daftar');

      // Jangan request ulang setiap kali user bolak-balik Laporan Saya/Daftar.
      // Data dimuat sekali per siklus dan di-invalidasi setelah create/edit.
      if(!_laporanSubTabLoaded[name] && !_laporanSubTabLoading[name]){
        // Panel petugas hanya diperlukan pada Daftar Laporan. Jangan panggil
        // apiListStaff saat login karena itu menambah waktu tunggu awal.
        if(name === 'daftar') loadAdminStaffListIfNeeded();
        loadLaporanSubTabOnce_(name, loadReportsBySelectedMonth);
      }
      requestAnimationFrame(function(){
        if(!_laporanSubTabLoading[name]) finishNavigationLoading();
      });
      return;
    }
    if(name === 'monitoring'){
      loadLaporanSubTabOnce_(name, loadStaffMonitoring);
    }else if(name === 'rekap'){
      loadLaporanSubTabOnce_(name, loadMonthlyRecap);
    }
    requestAnimationFrame(function(){
      // Jika loader data sedang berjalan, biarkan request-level loader yang menutup overlay.
      // Jika data sudah cached/tidak ada request, tutup setelah panel sempat dirender.
      if(!_laporanSubTabLoading[name]) finishNavigationLoading();
    });
  }

  function invalidateLaporanViews(){
    _laporanSubTabLoaded.monitoring = false;
    _laporanSubTabLoaded.rekap = false;
    _laporanSubTabLoaded.daftar = false;
    _laporanSubTabLoaded.saya = false;
    _laporanNeedsRefresh = true;
  }

  function resetLaporanSubTabCache(){
    _laporanNeedsRefresh = false;
    _laporanSubTabLoaded.monitoring = false;
    _laporanSubTabLoaded.rekap = false;
    _laporanSubTabLoaded.daftar = false;
    _laporanSubTabLoaded.saya = false;

    // Default normal tetap Laporan Saya. Namun drill-down dari Dashboard
    // Belum Selesai secara eksplisit meminta Daftar Laporan agar sumber data
    // mencakup seluruh petugas sesuai hak akses backend.
    const drilldownTarget = window.__IPSRS_DASHBOARD_UNFINISHED_TARGET === 'daftar'
      ? 'daftar'
      : 'saya';
    _laporanMode = drilldownTarget;
    window.__IPSRS_LAPORAN_INTERNAL_NAV = true;
    try{
      goLaporanSubTab(drilldownTarget);
    }finally{
      window.__IPSRS_LAPORAN_INTERNAL_NAV = false;
    }

    // Target hanya berlaku untuk satu navigasi drill-down.
    window.__IPSRS_DASHBOARD_UNFINISHED_TARGET = '';
  }

  // ============================================================
  // MONITORING HARIAN
  // ============================================================
  let _monData = [];
  let _monSummary = {};

  async function loadStaffMonitoring(){
    const bulan = document.getElementById('MonBulan').value;
    const tanggal = document.getElementById('MonTanggal').value;
    // FIX: samakan perilaku dengan loadDashboard() -- Monitoring Harian
    // harus selalu membaca status terbaru, bukan hasil cache read 30 detik
    // yang bisa tertinggal dari laporan yang baru saja masuk.
    if(typeof window.__ipsrsClearLaporanApiCache === 'function'){
      window.__ipsrsClearLaporanApiCache('apiGetStaffMonitoring', [bulan, tanggal]);
    }
    setMsg('monMsg', 'Memuat data monitoring...');
    try{
      const json = await authRun('apiGetStaffMonitoring', bulan, tanggal);
      if(!json || !json.ok){
        setMsg('monMsg', (json && json.msg) ? json.msg : 'Gagal memuat data monitoring.', true);
        _monData = [];
        renderStaffMonitoring();
        return false;
      }
      _monData = json.data || [];
      _monSummary = { hari_wajib_terhitung: json.hari_wajib_terhitung || 0, tanggal: json.tanggal, bulan: json.bulan };
      renderStaffMonitoring();
      return true;
    }catch(err){
      setMsg('monMsg', 'Error: ' + (err && err.message ? err.message : err), true);
      return false;
    }
  }

  function renderStaffMonitoring(){
    const status = document.getElementById('MonFilterStatus').value;
    const bidang = document.getElementById('MonFilterBidang').value;
    // Filter "Shift" dihapus (P1 §3.6) -- elemen #MonFilterShift tidak ada
    // lagi di HTML, dan backend tidak pernah memproses parameter shift.
    const cari = document.getElementById('MonFilterCari').value.trim().toLowerCase();

    const view = _monData.filter(s => {
      if(status && s.status_hari_ini !== status) return false;
      if(bidang && s.bidang !== bidang) return false;
      if(cari && s.nama.toLowerCase().indexOf(cari) === -1) return false;
      return true;
    });

    const totalStaf = _monData.filter(s => s.status === 'Aktif').length;
    const sudah = _monData.filter(s => s.status_hari_ini === 'SUDAH_ISI').length;
    const belum = _monData.filter(s => s.status_hari_ini === 'BELUM_ISI').length;
    const persen = totalStaf > 0 ? Math.round((sudah / totalStaf) * 100) : 0;

    const grid = document.getElementById('monSummaryGrid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="s-icon" style="background:var(--primary-light); color:var(--primary);">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <div class="s-value">${totalStaf}</div>
        <div class="s-label">Total Staf Aktif</div>
      </div>
      <div class="stat-card">
        <div class="s-icon" style="background:var(--success-bg); color:var(--success);">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"></path></svg>
        </div>
        <div class="s-value">${sudah}</div>
        <div class="s-label">Sudah Isi Hari Ini</div>
      </div>
      <div class="stat-card">
        <div class="s-icon" style="background:var(--danger-bg); color:var(--danger);">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4M12 16h.01"></path></svg>
        </div>
        <div class="s-value">${belum}</div>
        <div class="s-label">Belum Isi Hari Ini</div>
      </div>
      <div class="stat-card">
        <div class="s-icon" style="background:var(--primary-light); color:var(--primary);">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
        </div>
        <div class="s-value">${persen}%</div>
        <div class="s-label">Tingkat Kepatuhan</div>
      </div>
    `;

    const container = document.getElementById('monStaffGrid');
    container.innerHTML = '';
    if(_monData.length === 0){
      container.innerHTML = '<div class="smallnote">Master staf belum tersedia.</div>';
      setMsg('monMsg', '');
      return;
    }
    if(view.length === 0){
      container.innerHTML = '<div class="smallnote">Tidak ada staf yang cocok dengan filter ini.</div>';
      setMsg('monMsg', '');
      return;
    }

    view.forEach(s => {
      const card = document.createElement('div');
      card.className = 'staff-monitor-card';
      const dotClass = s.status_hari_ini === 'SUDAH_ISI' ? 'sudah' : (s.status_hari_ini === 'BELUM_ISI' ? 'belum' : 'libur');
      const statusLabel = s.status_hari_ini === 'SUDAH_ISI' ? 'Sudah Isi'
        : (s.status_hari_ini === 'BELUM_ISI' ? 'Belum Isi'
        : (s.status_hari_ini === 'BELUM_TERJADI' ? 'Belum Terjadi' : 'Tidak Wajib'));
      // Kartu Monitoring (P1 §3.6): konsep Shift sudah dihapus dari backend,
      // jadi ini sekarang murni menampilkan Bidang.
      const bidang = s.bidang || '-';
      const sdmBadge = s.status !== 'Aktif'
        ? `<span class="pill muted" style="margin-left:6px;">${escapeHtml(s.status)}</span>` : '';
      card.innerHTML = `
        <div class="smc-top">
          <div>
            <div class="smc-name">${escapeHtml(s.nama)}${sdmBadge}</div>
            <div class="smc-jabatan">${escapeHtml(s.jabatan || s.role_label)}</div>
          </div>
          <span class="pill ${s.status_hari_ini==='SUDAH_ISI'?'success':(s.status_hari_ini==='BELUM_ISI'?'warning':'muted')}">
            <span class="status-dot ${dotClass}"></span>${statusLabel}
          </span>
        </div>
        <div class="smc-meta">${escapeHtml(s.role_label)} &middot; ${escapeHtml(bidang)}</div>
        <div class="smc-stats">
          <div class="smc-stat"><div class="v">${s.laporan_hari_ini}</div><div class="l">Hari Ini</div></div>
          <div class="smc-stat"><div class="v">${s.sudah_isi_hari_bulan_ini}</div><div class="l">Hari Isi</div></div>
          <div class="smc-stat"><div class="v">${s.belum_isi_hari_bulan_ini}</div><div class="l">Belum Isi</div></div>
          <div class="smc-stat"><div class="v">${s.total_transaksi_bulan_ini}</div><div class="l">Transaksi</div></div>
        </div>
      `;
      card.onclick = () => openStaffDetailModal(s);
      container.appendChild(card);
    });

    setMsg('monMsg', 'Menampilkan ' + view.length + ' dari ' + _monData.length + ' staf' +
      (_monSummary.hari_wajib_terhitung ? ' &middot; ' + _monSummary.hari_wajib_terhitung + ' hari wajib terhitung bulan ini' : ''));
  }

  // ============================================================
  // DETAIL STAF (kalender bulanan + daftar laporan)
  // ============================================================
  async function openStaffDetailModal(staff){
    document.getElementById('staffDetailName').innerText = staff.nama;
    document.getElementById('staffDetailMeta').innerText =
      // (P1 §3.6) staff.shift tidak pernah ada di backend -- tampilkan Bidang saja.
      (staff.jabatan || staff.role_label) + ' \u00b7 ' + (staff.bidang || '-') + ' \u00b7 staff_id: ' + staff.staff_id;
    document.getElementById('staffDetailCalendar').innerHTML = '<div class="smallnote">Memuat kalender...</div>';
    document.getElementById('staffDetailReports').innerHTML = '';
    document.getElementById('staffDetailModalBg').classList.add('show');

    try{
      const bulan = document.getElementById('MonBulan').value;
      const json = await authRun('apiGetStaffDailyStatus', staff.staff_id, bulan);
      if(!json || !json.ok){
        document.getElementById('staffDetailCalendar').innerHTML = '<div class="smallnote">' + escapeHtml((json&&json.msg)||'Gagal memuat detail.') + '</div>';
        return;
      }
      renderStaffCalendar(json.kalender || []);
      renderStaffDetailReports(json.laporan || []);
    }catch(err){
      document.getElementById('staffDetailCalendar').innerHTML = '<div class="smallnote">Error: ' + escapeHtml(err && err.message ? err.message : err) + '</div>';
    }
  }
  function closeStaffDetailModal(){
    document.getElementById('staffDetailModalBg').classList.remove('show');
  }

  function renderStaffCalendar(kalender){
    const cal = document.getElementById('staffDetailCalendar');
    cal.innerHTML = '';
    kalender.forEach(d => {
      const day = document.createElement('div');
      const cls = d.status === 'SUDAH_ISI' ? 'sudah' : (d.status === 'BELUM_ISI' ? 'belum' : (d.status === 'BELUM_TERJADI' ? 'depan' : 'libur'));
      day.className = 'cal-day ' + cls;
      day.title = formatTanggalDisplay(d.tanggal) + ' \u2014 ' + d.status + (d.jumlah ? ' (' + d.jumlah + ' laporan)' : '');
      day.innerHTML = '<span class="n">' + parseInt(d.tanggal.split('-')[2], 10) + '</span>';
      cal.appendChild(day);
    });
  }

  function renderStaffDetailReports(laporan){
    const wrap = document.getElementById('staffDetailReports');
    if(laporan.length === 0){
      wrap.innerHTML = emptyStateHtml('Belum ada laporan pada bulan ini.');
      return;
    }
    wrap.innerHTML = '';
    laporan.forEach(row => {
      const card = document.createElement('div');
      card.className = 'rcard';
      card.style.marginBottom = '8px';
      card.innerHTML = `
        <div class="rc-top">
          <div class="rc-title">${escapeHtml(row.Ruang)} &middot; ${escapeHtml(formatTanggalDisplay(row.Tanggal))} ${escapeHtml(row.Pukul||'')}</div>
          <span class="pill ${row.Status==='Selesai'?'success':'warning'}">${escapeHtml(row.Status)}</span>
        </div>
        <div class="rc-line">${escapeHtml(row.MasalahKegiatan)}</div>
      `;
      card.onclick = () => { closeStaffDetailModal(); openEditModalForReport(row); };
      wrap.appendChild(card);
    });
  }

  // ============================================================
  // REKAP BULANAN
  // ============================================================
  async function loadMonthlyRecap(){
    const bulan = document.getElementById('RekapBulan').value;
    const staffBody = document.getElementById('rekapStaffBody');
    const bidangBody = document.getElementById('rekapBidangBody');
    staffBody.innerHTML = '<tr><td colspan="6" class="smallnote">Memuat rekap...</td></tr>';
    bidangBody.innerHTML = '';
    try{
      const json = await authRun('apiGetMonthlyRecap', bulan);
      if(!json || !json.ok){
        staffBody.innerHTML = '<tr><td colspan="6" class="smallnote">' + escapeHtml((json&&json.msg)||'Gagal memuat rekap.') + '</td></tr>';
        return false;
      }
      renderMonthlyRecap(json);
      return true;
    }catch(err){
      staffBody.innerHTML = '<tr><td colspan="6" class="smallnote">Error: ' + escapeHtml(err && err.message ? err.message : err) + '</td></tr>';
      return false;
    }
  }

  function renderMonthlyRecap(json){
    const r = json.ringkasan || {};
    const grid = document.getElementById('rekapSummaryGrid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="s-value">${r.total_staff||0}</div>
        <div class="s-label">Total Staf Aktif</div>
      </div>
      <div class="stat-card">
        <div class="s-value">${r.total_staff_days_sudah_isi||0}</div>
        <div class="s-label">Staff-hari Sudah Isi</div>
      </div>
      <div class="stat-card">
        <div class="s-value">${r.total_staff_days_belum_isi||0}</div>
        <div class="s-label">Staff-hari Belum Isi</div>
      </div>
      <div class="stat-card">
        <div class="s-value">${r.persentase_kepatuhan||0}%</div>
        <div class="s-label">Persentase Kepatuhan</div>
      </div>
    `;

    const staffBody = document.getElementById('rekapStaffBody');
    const perStaff = json.per_staff || [];
    if(perStaff.length === 0){
      staffBody.innerHTML = '<tr><td colspan="6">' + emptyStateHtml('Belum ada data staf.') + '</td></tr>';
    } else {
      staffBody.innerHTML = perStaff.map(s => `
        <tr>
          <td>${escapeHtml(s.nama)}</td>
          <td>${escapeHtml(s.jabatan||s.role_label)}</td>
          <td>${escapeHtml(s.bidang||'-')}</td>
          <td>${s.sudah_isi_hari_bulan_ini}</td>
          <td>${s.belum_isi_hari_bulan_ini}</td>
          <td>${s.total_transaksi_bulan_ini}</td>
        </tr>
      `).join('');
    }

    const bidangBody = document.getElementById('rekapBidangBody');
    const perBidang = json.per_bidang || [];
    if(perBidang.length === 0){
      bidangBody.innerHTML = '<tr><td colspan="4">' + emptyStateHtml('Belum ada data bidang.') + '</td></tr>';
    } else {
      bidangBody.innerHTML = perBidang.map(b => `
        <tr>
          <td>${escapeHtml(b.bidang)}</td>
          <td>${b.jumlah_staf}</td>
          <td>${b.hari_isi}</td>
          <td>${b.total_transaksi}</td>
        </tr>
      `).join('');
    }
  }

  // ============================================================
  // EDIT LAPORAN
  // ============================================================
  let _editingReportId = null;
  let _editTransitionToken = null;
  let _reportFormMode = 'CREATE';
  let _customDataReady = Promise.resolve();

  // Satu form dipakai untuk CREATE dan EDIT. Hanya mode, ID laporan,
  // data awal, dan endpoint penyimpanan yang berbeda.
  const INPUT_EDITABLE_IDS = ['Tanggal','Pelapor','Pukul','NoLK','Ruang',
    'MasalahKegiatan','Tindakan','SparePartUnit','Type','Jumlah','Status',
    'Kategori','AreaKerja','Item','Keterangan'];


  function toggleHistoryList(){
    const list = document.getElementById('historyList');
    if(!list) return;
    const willShow = list.classList.contains('hidden');
    list.classList.toggle('hidden');
    if(willShow && _historyLoadedForReportId !== _editingReportId){
      loadReportHistory();
    }
  }

  async function loadReportHistory(){
    const list = document.getElementById('historyList');
    if(!list) return;
    list.innerHTML = '<div class="smallnote">Memuat riwayat...</div>';
    try{
      const json = await authRun('apiGetReportHistory', _editingReportId);
      _historyLoadedForReportId = _editingReportId;
      if(!json || !json.ok){
        list.innerHTML = '<div class="smallnote">' + escapeHtml((json&&json.msg)||'Gagal memuat riwayat.') + '</div>';
        return;
      }
      if(!json.data || json.data.length === 0){
        list.innerHTML = emptyStateHtml('Belum ada riwayat perubahan untuk laporan ini.');
        return;
      }
      list.innerHTML = '';
      json.data.forEach(h => {
        const changedFields = Object.keys(h.after).filter(k => h.before[k] !== h.after[k] && k !== 'ID');
        const diffHtml = changedFields.length
          ? changedFields.map(k => '<div style="font-size:11.5px; margin-top:3px;"><b>' + escapeHtml(k) + ':</b> <span style="color:var(--danger);">' + escapeHtml(h.before[k]) + '</span> &rarr; <span style="color:var(--success);">' + escapeHtml(h.after[k]) + '</span></div>').join('')
          : '<div class="smallnote">Tidak ada field yang berubah.</div>';
        const row = document.createElement('div');
        row.style.cssText = 'background:#fff; border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:8px;';
        row.innerHTML = '<div style="font-size:11.5px; font-weight:700;">' + escapeHtml(h.edited_at) + ' oleh ' + escapeHtml(h.edited_by_username) + ' (' + escapeHtml(h.edited_by_staff_id) + ')</div>' + diffHtml;
        list.appendChild(row);
      });
    }catch(err){
      list.innerHTML = '<div class="smallnote">Error: ' + escapeHtml(err && err.message ? err.message : err) + '</div>';
    }
  }


  // ============================================================
  // ADMIN: DAFTAR PETUGAS
  // ============================================================
  async function loadAdminStaffListIfNeeded(){
    if(!CURRENT_SESSION) return;
    // Satu sumber data dipakai bersama Dashboard + Daftar Laporan.
    // Hindari request ganda saat kedua halaman membutuhkan daftar yang sama.
    if(_adminStaffListLoaded){
      renderAdminStaffSelect();
      renderDashStaffSelect();
      return;
    }
    if(_adminStaffListLoading) return _adminStaffListLoading;

    _adminStaffListLoading=(async()=>{
      try{
        const json=await authRun('apiListStaff');
        if(json && json.ok){
          ADMIN_STAFF_LIST=Array.isArray(json.data)?json.data:[];
          _adminStaffListLoaded=true;
          renderAdminStaffSelect();
          renderDashStaffSelect();
        }
      }catch(e){
        // Biarkan percobaan berikutnya mengulang request bila gagal.
      }finally{
        _adminStaffListLoading=null;
      }
    })();
    return _adminStaffListLoading;
  }
  function syncAdminStaffFromReports_(){
    const map = {};
    (Array.isArray(rawData) ? rawData : []).forEach(row => {
      const staffId = String(row.StaffID || row.staff_id || '').trim();
      if(!staffId) return;
      if(!map[staffId]){
        map[staffId] = {
          staff_id: staffId,
          nama: row.Petugas || row.Nama || row.nama || staffId,
          jabatan: row.Jabatan || row.jabatan || '',
          role: row.Role || row.role || '',
          role_label: row.RoleLabel || row.role_label || '',
          bidang: row.Bidang || row.bidang || '',
          // shift dihapus (P1 §3.6) -- field ini tidak pernah dikirim backend.
          status: 'Aktif',
          total_laporan: 0
        };
      }
      map[staffId].total_laporan++;
    });
    ADMIN_STAFF_LIST = Object.keys(map).map(k => map[k]);
    renderAdminStaffSelect();
  }

  function isActiveStaffForFilter_(st){
    // Hanya petugas aktif yang boleh muncul di dropdown Daftar Laporan.
    // Status yang tidak dikenal tetap dipertahankan untuk kompatibilitas
    // dengan data lama yang belum memiliki kolom status.
    const status = String(st && st.status || '').trim().toLowerCase();
    if(!status) return true;
    return ['aktif','active'].includes(status);
  }

  function getStaffNameForFilter_(st){
    // Dropdown menampilkan nama petugas; staff_id tetap menjadi value internal.
    return String((st && (st.nama || st.Nama || st.name || st.staff_name || st.staff_id)) || '').trim();
  }

  function renderAdminStaffSelect(){
    const sel = document.getElementById('adminStaffSelect');
    if(!sel) return;
    const current = adminSelectedStaffId || '';
    sel.innerHTML = '<option value="">Semua Petugas</option>';

    ADMIN_STAFF_LIST
      .filter(isActiveStaffForFilter_)
      .sort((a,b) => getStaffNameForFilter_(a).localeCompare(getStaffNameForFilter_(b), 'id', {sensitivity:'base'}))
      .forEach(st => {
        const namaPetugas = getStaffNameForFilter_(st);
        if(!namaPetugas) return;
        const opt = document.createElement('option');
        opt.value = st.staff_id;
        // Yang terlihat di dropdown: nama petugas saja.
        // Value internal tetap staff_id agar filter laporan tidak berubah.
        opt.innerText = namaPetugas;
        sel.appendChild(opt);
      });

    // Jika petugas yang sebelumnya dipilih sudah tidak aktif, kembalikan
    // pilihan ke Semua Petugas agar tidak tersisa filter yang tidak valid.
    const stillExists = Array.from(sel.options).some(opt => opt.value === current);
    sel.value = stillExists ? current : '';
    if(!stillExists && current) adminSelectedStaffId = '';
  }

  // Dipertahankan untuk kompatibilitas struktur lama; panel Daftar Laporan
  // sekarang menggunakan dropdown agar ringkas di HP.
  function renderAdminStaffGrid(){
    const grid = document.getElementById('adminStaffGrid');
    if(!grid) return;
    grid.innerHTML = '';
  }

  function isDashboardStaffForFilter_(st){
    // Dashboard mengikuti aturan hak & wewenang yang berlaku:
    // hanya akun KA IPSRS yang tidak ditampilkan sebagai pilihan petugas.
    // Role lain (ADMINISTRASI, KASIE, STAF, PETUGAS_SHIFT, dll.) tetap tersedia.
    const role = String(st && (st.role || st.Role || '') || '').trim().toUpperCase();
    return role !== 'KA_IPSRS';
  }

  function renderDashStaffSelect(){
    const sel = document.getElementById('DashStaff');
    if(!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Semua Petugas</option>';
    ADMIN_STAFF_LIST
      .filter(isActiveStaffForFilter_)
      .filter(isDashboardStaffForFilter_)
      .sort((a,b) => getStaffNameForFilter_(a).localeCompare(getStaffNameForFilter_(b), 'id', {sensitivity:'base'}))
      .forEach(st => {
        const namaPetugas = getStaffNameForFilter_(st);
        if(!namaPetugas) return;
        const opt = document.createElement('option');
        opt.value = st.staff_id;
        opt.innerText = namaPetugas;
        sel.appendChild(opt);
      });
    // SENGAJA tidak fallback ke adminSelectedStaffId di sini -- itu default
    // punya panel "Filter Petugas" di tab Laporan (default: diri sendiri).
    // Dashboard harus tetap default "Semua Petugas" sendiri, independen.
    sel.value = current || '';
  }
  function selectAdminStaff(staffId){
    adminSelectedStaffId = staffId;
    const pill = document.getElementById('adminStaffActivePill');
    if(pill){
      if(!staffId) pill.innerText = 'Menampilkan: Semua Petugas';
      else{
        const st = ADMIN_STAFF_LIST.find(x => x.staff_id === staffId);
        pill.innerText = 'Menampilkan: ' + getStaffNameForFilter_(st);
      }
    }
    renderAdminStaffSelect();
    const dashSel = document.getElementById('DashStaff');
    if(dashSel) dashSel.value = staffId;
    applyFilters();
    loadDashboard();
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function renderBarList(containerId, items){
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if(!items || items.length === 0){
      el.innerHTML = emptyStateHtml('Belum ada data.');
      return;
    }
    const max = Math.max.apply(null, items.map(i => i.value)) || 1;
    items.forEach(i => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = `
        <div class="bar-label" title="${escapeHtml(i.label)}">${escapeHtml(i.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(i.value/max*100)}%"></div></div>
        <div class="bar-val">${i.value}</div>
      `;
      el.appendChild(row);
    });
  }

  function renderStatusChart(selesai, belum){
    const ctx = document.getElementById('statusChart');
    const legendEl = document.getElementById('statusLegend');
    if(statusChartInstance){ statusChartInstance.destroy(); }

    const data = [selesai, belum];
    const labels = ['Selesai', 'Belum Selesai'];
    const colors = ['#1a9e57', '#b91c1c'];

    if(selesai === 0 && belum === 0){
      ctx.parentElement.innerHTML = emptyStateHtml('Belum ada data pada periode ini.');
      legendEl.innerHTML = '';
      return;
    }

    statusChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false } }
      }
    });

    legendEl.innerHTML = '';
    labels.forEach((lbl, i) => {
      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML = `<span class="legend-dot" style="background:${colors[i]}"></span><span class="lbl">${lbl}</span><span class="val">${data[i]}</span>`;
      legendEl.appendChild(row);
    });
  }

  function renderRecentList(recent){
    const el = document.getElementById('recentList');
    el.innerHTML = '';
    if(!recent || recent.length === 0){
      el.innerHTML = emptyStateHtml('Belum ada laporan.');
      return;
    }
    recent.forEach(r => {
      const item = document.createElement('div');
      item.className = 'recent-item';
      item.innerHTML = `
        <div>
         <div class="r-main">${escapeHtml(formatTanggalDisplay(r.Tanggal))} | ${escapeHtml(r.Ruang)}</div>
          <div class="r-sub">${escapeHtml(r.Petugas)} | ${escapeHtml(r.MasalahKegiatan)}</div>
          <div class="r-action">Tindakan: ${escapeHtml(r.Tindakan || '-')}</div>
        </div>
        <span class="pill ${r.Status==='Selesai'?'success':'warning'}">${escapeHtml(r.Status)}</span>
      `;
      el.appendChild(item);
    });
  }

  function bindDashboardUnfinishedDrilldown(){
    const valueEl = document.getElementById('statBelum');
    if(!valueEl) return;
    const card = valueEl.closest('.stat-card');
    if(!card || card.dataset.ipsrsDrilldownBound === '1') return;
    card.dataset.ipsrsDrilldownBound = '1';
    card.style.cursor = 'pointer';
    card.title = 'Lihat laporan yang belum selesai';
    card.addEventListener('click', function(event){
      event.preventDefault();
      openDashboardUnfinishedReports();
    });
  }

  // Cache sangat pendek untuk navigasi Dashboard berulang. Tujuannya hanya
  // menghindari request identik saat user bolak-balik menu dalam beberapa detik;
  // cache dibersihkan segera setelah create/edit laporan.
  const _dashboardResponseCache = new Map();
  const _dashboardInflight = new Map();
  const _DASHBOARD_CACHE_TTL = 3000;

  function clearDashboardResponseCache(){
    _dashboardResponseCache.clear();
  }

  window.__ipsrsClearDashboardCache = clearDashboardResponseCache;

  function getDashboardDataCached_(bulan, staffFilter){
    const key = String(bulan || '') + '|' + String(staffFilter || '');
    const cached = _dashboardResponseCache.get(key);
    if(cached && (Date.now() - cached.at) < _DASHBOARD_CACHE_TTL){
      return Promise.resolve(cached.value);
    }
    if(_dashboardInflight.has(key)) return _dashboardInflight.get(key);

    // DashboardStats sekarang sudah membawa KPI monitoring hari yang sama,
    // sehingga tidak perlu request apiGetStaffMonitoring kedua.
    const p = authRun('apiDashboardStats', bulan, staffFilter)
      .then(function(statsJson){
        const monData = statsJson && statsJson.data && statsJson.data.monitoring_today
          ? statsJson.data.monitoring_today
          : {tanggal:todayLocalISO(),data:[]};
        const value=[statsJson,{ok:!!(statsJson&&statsJson.ok),data:Array.isArray(monData.data)?monData.data:[]}];
        _dashboardResponseCache.set(key,{at:Date.now(),value:value});
        return value;
      }).finally(function(){
        _dashboardInflight.delete(key);
      });

    _dashboardInflight.set(key,p);
    return p;
  }

  async function loadDashboard(){
    // Satu sumber status loading Dashboard: request ini sendiri.
    // Tidak lagi bergantung pada intersep window.fetch global.
    const dashboardLoadSeq = (window.__ipsrsDashboardLoadSeq || 0) + 1;
    window.__ipsrsDashboardLoadSeq = dashboardLoadSeq;
    if(typeof window.__ipsrsDashboardLoadingStart === 'function'){
      window.__ipsrsDashboardLoadingStart(dashboardLoadSeq);
    }
    let dashboardLoadOk = false;
    const bulan = document.getElementById('DashBulan').value;
    // SENGAJA tidak fallback ke adminSelectedStaffId (default punya tab Laporan)
    // -- Dashboard punya pilihan sendiri lewat dropdown #DashStaff, default "Semua Petugas".
    const staffFilter = document.getElementById('DashStaff').value || null;
    // Dashboard KPI hari ini harus selalu membaca status terbaru.
    // Cache Monitoring tetap dipakai untuk halaman Laporan, tetapi entry
    // monitoring untuk tanggal yang sedang ditampilkan di Dashboard
    // dibersihkan sebelum request agar laporan yang baru masuk tidak tertahan
    // oleh cache 30 detik.
    if(typeof window.__ipsrsClearLaporanApiCache === 'function'){
      window.__ipsrsClearLaporanApiCache('apiGetStaffMonitoring', [bulan, todayLocalISO()]);
    }
    try{
      const [statsJson, monJson] = await getDashboardDataCached_(bulan, staffFilter);

      // Request yang lebih baru sudah berjalan: abaikan response request lama.
      if(dashboardLoadSeq !== window.__ipsrsDashboardLoadSeq) return;

      if(monJson && monJson.ok){
        // Terapkan filter petugas yang sama dengan yang dipakai statsJson, supaya
        // KPI "Kepatuhan Hari Ini" tidak menyesatkan saat user memilih 1 petugas.
        // Juga hanya hitung staf berstatus Aktif (Calon/Nonaktif tidak wajib lapor).
        const monData = monJson.data.filter(s => s.status === 'Aktif' && (!staffFilter || s.staff_id === staffFilter));
        const total = monData.length;
        const sudah = monData.filter(s => s.status_hari_ini === 'SUDAH_ISI').length;
        const belum = monData.filter(s => s.status_hari_ini === 'BELUM_ISI').length;
        const persen = total > 0 ? Math.round((sudah/total)*100) : 0;
        document.getElementById('statPetugasAktif').innerText = total;
        document.getElementById('statSudahIsiHariIni').innerText = sudah;
        document.getElementById('statBelumIsiHariIni').innerText = belum;
        document.getElementById('statComplianceHariIni').innerText = persen + '%';
        document.getElementById('dashComplianceNote').innerText = belum > 0
          ? belum + ' petugas belum mengisi laporan hari ini -- lihat halaman Laporan > Monitoring Harian untuk daftarnya.'
          : (total > 0 ? 'Semua petugas aktif sudah mengisi laporan hari ini.' : 'Master staf belum tersedia.');
      }

      if(!statsJson || !statsJson.ok) return;
      const d = statsJson.data;
      document.getElementById('statTotal').innerText = d.total;
      document.getElementById('statSelesai').innerText = d.selesai;
      document.getElementById('statBelum').innerText = d.belum;
      document.getElementById('statPersen').innerText = d.total ? Math.round(d.selesai / d.total * 100) + '%' : '0%';
      bindDashboardUnfinishedDrilldown();

      const pencapaianOrder = ['Selesai','Sebagian','Belum Selesai','Ditunda','Tindak Lanjut','Belum Diisi'];
      const pencapaianBars = pencapaianOrder
        .map(label => ({ label, value: (d.pencapaian && d.pencapaian[label]) || 0 }))
        .filter(x => x.value > 0);
      renderBarList('barPencapaian', pencapaianBars.length ? pencapaianBars : [{label:'Belum ada data', value:0}]);

      const sortDashboardBars = arr => (Array.isArray(arr) ? arr.slice().sort((a,b) => Number(b.value||0)-Number(a.value||0) || String(a.label||'').localeCompare(String(b.label||''),'id')) : []);
      renderBarList('barKategori', sortDashboardBars(d.kategori));
      renderBarList('barArea', sortDashboardBars(d.area));
      renderStatusChart(d.selesai, d.belum);
      renderRecentList(d.recent);

      renderBarList('barStaff', (Array.isArray(d.staff) ? d.staff.slice() : []).sort((a,b) => Number(b.value||0)-Number(a.value||0) || String(a.nama||a.staff_id||'').localeCompare(String(b.nama||b.staff_id||''),'id')).map(s => ({ label: (s.nama||s.staff_id), value: s.value })));
      dashboardLoadOk = true;
    }catch(e){
      console.error('Dashboard data error:', e);
    }finally{
      if(typeof window.__ipsrsDashboardLoadingDone === 'function'){
        window.__ipsrsDashboardLoadingDone(dashboardLoadSeq, dashboardLoadOk);
      }
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  async function afterAuthReady(){
    applyIdentityToUI();
    buildMonthOptions();
    populateStaticSelects();
    // Inisialisasi login HARUS ringan. Data tambahan dimuat di background/lazy
    // supaya user tidak tertahan di splash screen dan tidak ada navigasi tertunda.
    appendAddNewOption('Kategori', '+ Tambah Kategori Baru');
    appendAddNewOption('AreaKerja', '+ Tambah Area Kerja Baru');
    refreshItemOptions();
    setStatusValue('');

    // Data kustom tidak boleh berebut koneksi dengan proses login/halaman pertama.
    // Mulai sedikit setelah UI aktif; data bawaan tetap langsung tersedia.
    startIpsrsHeartbeat_();
    _customDataReady = new Promise(resolve => setTimeout(resolve, 1200))
      .then(() => Promise.all([loadKategoriKustom(), loadAreaKerjaKustom(), loadItemKustomAll()]))
      .then(() => {
        appendAddNewOption('Kategori', '+ Tambah Kategori Baru');
        appendAddNewOption('AreaKerja', '+ Tambah Area Kerja Baru');

        // Jangan menghapus Item yang sedang dipilih pada form EDIT ketika
        // data kustom selesai dimuat di background.
        const selectedItemBeforeRefresh =
          (_reportFormMode === 'EDIT' && document.getElementById('Item'))
            ? document.getElementById('Item').value
            : '';

        refreshItemOptions();

        if(_reportFormMode === 'EDIT' && selectedItemBeforeRefresh){
          setInputSelectValue('Item', selectedItemBeforeRefresh);
        }
      })
      .catch(() => {});
  }

  async function checkAuthAndInit(){
    // Startup SELALU berhenti di halaman login.
    // Tidak ada auto-login dari Supabase session maupun sessionStorage aplikasi.
    // Pengguna tetap harus menekan tombol MASUK.
    clearSession();
    showLoginScreen();
  }

  // Jika browser kehilangan koneksi, reset state drill-down agar setelah
  // koneksi/session pulih aplikasi kembali ke daftar normal.
  window.addEventListener('offline', function(){
    resetLaporanUnfinishedState();
  });

  loadRememberedCredentials();
  checkAuthAndInit();