// Frontend migration of JS_Core.html — behavior preserved; transport changed to HTTP API.
// ============================================================
  // SESSION (token disimpan di sessionStorage HANYA untuk menjaga
  // login antar aksi di tab yang sama -- data tetap 100% di server)
  // ============================================================
  const SESSION_KEY = 'ipsrs_session_v1';
  // "Ingat saya": disimpan di localStorage (bukan sessionStorage) supaya
  // tetap ada walau tab/browser ditutup atau HP/PC di-restart. Password
  // di sini hanya disamarkan (base64), BUKAN dienkripsi -- jadi hanya untuk
  // dipakai di HP/PC pribadi milik petugas sendiri, bukan perangkat bersama.
  const REMEMBER_KEY = 'ipsrs_remember_v1';
  const BIDANG_LIST = ['ME', 'Sipil', 'Workshop', 'Elektromedik', 'Kesling'];
  const SHIFT_LIST = ['Pagi', 'Siang', 'Malam'];
  const ROLE_LABELS_CLIENT = {
    KA_IPSRS: 'KA IPSRS',
    ADMINISTRASI: 'Administrasi IPSRS',
    KASIE: 'Kasie',
    STAF: 'Staf',
    PETUGAS_SHIFT: 'Petugas Shift'
  };
  let CURRENT_SESSION = null;
  let ADMIN_STAFF_LIST = [];
  let adminSelectedStaffId = '';
  let rawData = [];
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
  // "INGAT SAYA" -- simpan username/password di localStorage HP/PC
  // ============================================================
  function saveRememberedCredentials(username, password){
    try{
      const payload = { u: btoa(unescape(encodeURIComponent(username))), p: btoa(unescape(encodeURIComponent(password))) };
      localStorage.setItem(REMEMBER_KEY, JSON.stringify(payload));
    }catch(e){}
  }
  function clearRememberedCredentials(){
    try{ localStorage.removeItem(REMEMBER_KEY); }catch(e){}
  }
  function loadRememberedCredentials(){
    try{
      const raw = localStorage.getItem(REMEMBER_KEY);
      if(!raw) return;
      const payload = JSON.parse(raw);
      const username = decodeURIComponent(escape(atob(payload.u)));
      const password = decodeURIComponent(escape(atob(payload.p)));
      const uEl = document.getElementById('loginUsername');
      const pEl = document.getElementById('loginPassword');
      const rEl = document.getElementById('loginRemember');
      if(uEl) uEl.value = username;
      if(pEl) pEl.value = password;
      if(rEl) rEl.checked = true;
    }catch(e){}
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
  // HTTP API WRAPPER — GitHub Pages -> Google Apps Script Web App
  // ============================================================
  function getApiUrl(){
    const url = (window.IPSRS_API_URL || '').trim();
    if(!url || /GANTI_DENGAN_URL/i.test(url)){
      throw new Error('URL backend belum dikonfigurasi. Isi IPSRS_API_URL di config.js.');
    }
    return url;
  }

  async function gsRun(fnName, ...args){
    const payload = {};
    switch(fnName){
      case 'apiLogin':
        payload.username = args[0] || '';
        payload.password = args[1] || '';
        break;
      case 'apiLogout':
      case 'apiWhoAmI':
      case 'apiChangePassword':
      case 'apiGetReportHistory':
      case 'apiListStaff':
      case 'apiGetKategoriKustom':
      case 'apiGetAreaKerjaKustom':
        if(fnName === 'apiChangePassword'){
          payload.token = args[0] || '';
          payload.oldPassword = args[1] || '';
          payload.newPassword = args[2] || '';
        }else if(fnName === 'apiGetReportHistory'){
          payload.token = args[0] || '';
          payload.reportId = args[1] || '';
        }else{
          payload.token = args[0] || '';
        }
        break;
      case 'apiCreateReport':
        payload.token = args[0] || '';
        payload.payload = args[1] || {};
        break;
      case 'apiGetReports':
        payload.token = args[0] || '';
        payload.bulan = args[1] || '';
        payload.staffIdFilter = args[2] || null;
        payload.bidangFilter = args[3] || null;
        payload.shiftFilter = args[4] || null;
        break;
      case 'apiUpdateReport':
        payload.token = args[0] || '';
        payload.reportId = args[1] || '';
        payload.payload = args[2] || {};
        break;
      case 'apiDashboardStats':
        payload.token = args[0] || '';
        payload.bulan = args[1] || '';
        payload.staffIdFilter = args[2] || null;
        payload.bidangFilter = args[3] || null;
        payload.shiftFilter = args[4] || null;
        break;
      case 'apiGetStaffMonitoring':
        payload.token = args[0] || '';
        payload.bulan = args[1] || '';
        payload.tanggal = args[2] || '';
        break;
      case 'apiGetStaffDailyStatus':
        payload.token = args[0] || '';
        payload.staffId = args[1] || '';
        payload.bulan = args[2] || '';
        break;
      case 'apiGetMonthlyRecap':
        payload.token = args[0] || '';
        payload.bulan = args[1] || '';
        break;
      case 'apiGetAuditLog':
        payload.token = args[0] || '';
        payload.reportId = args[1] || '';
        break;
      case 'apiGetStaffReports':
        payload.token = args[0] || '';
        payload.staffId = args[1] || '';
        payload.bulan = args[2] || '';
        break;
      case 'apiGetStaffPerformance':
        payload.token = args[0] || '';
        payload.staffId = args[1] || '';
        payload.bulan = args[2] || '';
        break;
      case 'apiTambahKategori':
        payload.token = args[0] || '';
        payload.nama = args[1] || '';
        payload.staticList = Array.isArray(args[2]) ? args[2] : [];
        break;
      case 'apiTambahAreaKerja':
        payload.token = args[0] || '';
        payload.nama = args[1] || '';
        payload.staticList = Array.isArray(args[2]) ? args[2] : [];
        break;
      case 'apiGetItemKustom':
        payload.token = args[0] || '';
        payload.area = args[1] || '';
        payload.nama = args[2] || '';
        payload.existingItemsForArea = Array.isArray(args[3]) ? args[3] : [];
        break;
      case 'apiTambahItem':
        payload.token = args[0] || '';
        payload.area = args[1] || '';
        payload.nama = args[2] || '';
        payload.existingItemsForArea = Array.isArray(args[3]) ? args[3] : [];
        break;
      default:
        throw new Error('Action API tidak dikenal: ' + fnName);
    }

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: fnName, data: payload })
    });

    const text = await response.text();
    let json;
    try{ json = JSON.parse(text); }
    catch(e){ throw new Error('Respons backend bukan JSON yang valid. HTTP ' + response.status); }
    if(!response.ok && (!json || json.ok !== false)){
      throw new Error('HTTP ' + response.status);
    }
    return json;
  }

  async function authRun(fnName, ...args){
    const s = getSession();
    if(!s){ showLoginScreen('Sesi tidak ditemukan, silakan login kembali.'); throw new Error('Belum login'); }
    const json = await gsRun(fnName, s.token, ...args);
    if(json && json.ok === false && /sesi tidak valid/i.test(json.msg||'')){
      clearSession();
      showLoginScreen('Sesi berakhir, silakan login kembali.');
    }
    return json;
  }

  // ============================================================
  // LOGIN / LOGOUT / PASSWORD
  // ============================================================
  function showLoginScreen(msg){
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

  async function performLogin(username, password, remember, msgEl, autoMode){
    if(!username || !password){
      if(msgEl) msgEl.innerText = 'Username dan password wajib diisi.';
      return false;
    }
    if(msgEl) msgEl.innerText = autoMode ? 'Masuk otomatis...' : 'Memeriksa...';
    try{
      const json = await gsRun('apiLogin', username, password);
      if(json && json.ok){
        setSession(json);
        if(remember){ saveRememberedCredentials(username, password); }
        else{ clearRememberedCredentials(); }
        if(msgEl) msgEl.innerText = '';
        document.getElementById('loginPassword').value = '';
        applyIdentityToUI();
        await afterAuthReady();
        // Tampilkan aplikasi setelah seluruh inisialisasi selesai.
        // Sebelumnya appShell ditampilkan sebelum afterAuthReady(), sehingga
        // user bisa klik Laporan saat inisialisasi masih berjalan.
        // afterAuthReady() lalu memanggil goPage('input') beberapa detik
        // kemudian dan menimpa halaman yang sedang dibuka user.
        hideLoginScreen();
        goPage('input');
        return true;
      } else {
        if(msgEl) msgEl.innerText = (json && json.msg) ? json.msg : 'Login gagal.';
        // Kredensial "Ingat Saya" tersimpan sudah tidak valid (mis. password
        // diganti) -- hapus supaya tidak terus-menerus mencoba auto-login
        // dengan kredensial yang salah setiap kali app dibuka.
        if(autoMode) clearRememberedCredentials();
        return false;
      }
    }catch(err){
      if(msgEl) msgEl.innerText = 'Error: ' + (err && err.message ? err.message : err);
      return false;
    }
  }

  async function doLogin(){
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('loginRemember').checked;
    const msgEl = document.getElementById('loginMsg');
    await performLogin(username, password, remember, msgEl, false);
  }

  function doLogout(){
    // PENTING: showLoginScreen() dipanggil LANGSUNG di sini (bukan setelah
    // `await gsRun('apiLogout', ...)`) -- versi sebelumnya menunggu balasan
    // server dulu baru mengganti layar, jadi kalau GAS sedang lambat, tombol
    // "Keluar" terasa "tidak bereaksi" selama itu. Sesi lokal (token) dihapus
    // dan layar login ditampilkan SEKETIKA; penghapusan baris sesi di server
    // tetap dikirim, tapi berjalan di latar belakang tanpa diTUNGGU UI.
    const s = getSession();
    clearSession();
    closeUserMenu();
    showLoginScreen('Anda sudah keluar. Silakan login kembali.');
    if(s && s.token){ gsRun('apiLogout', s.token).catch(function(e){}); }
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
      if(json && json.ok){ setMsg('pwMsg','Password berhasil diganti.'); setTimeout(closePwModal, 900); }
      else setMsg('pwMsg', (json && json.msg) ? json.msg : 'Gagal mengganti password.', true);
    }catch(err){ setMsg('pwMsg', 'Error: ' + (err && err.message ? err.message : err), true); }
  }

  // ============================================================
  // IDENTITY / SIDEBAR / NAVIGASI
  // ============================================================
  function roleContextLabel(session){
    const roleLabel = ROLE_LABELS_CLIENT[session.role] || session.role;
    if(session.role === 'KASIE' || session.role === 'STAF') return roleLabel + ' \u00b7 ' + (session.bidang||'-');
    if(session.role === 'PETUGAS_SHIFT') return roleLabel + ' \u00b7 ' + (session.shift||'-');
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

    // Default filter Petugas = diri sendiri (bukan "Semua Petugas") supaya
    // begitu buka tab Laporan, yang langsung tampil adalah laporan milik
    // petugas yang login -- bukan gabungan semua orang. Tetap bisa diganti
    // ke "Semua Petugas" kapan saja lewat panel Filter Petugas (ini cuma
    // nilai AWAL, bukan pembatasan akses -- prinsip "semua boleh melihat
    // semua" di atas tetap berlaku).
    adminSelectedStaffId = CURRENT_SESSION.staff_id || '';
    const pill = document.getElementById('adminStaffActivePill');
    if(pill) pill.innerText = 'Menampilkan: ' + (CURRENT_SESSION.staff_id||'-') + ' - ' + nama;
  }

  function canEditReport(report){
    if(!CURRENT_SESSION || !report) return false;
    if(CURRENT_SESSION.role === 'KA_IPSRS' || CURRENT_SESSION.role === 'ADMINISTRASI') return true;
    return report.StaffID === CURRENT_SESSION.staff_id;
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

  const PAGE_TITLES = { dashboard:'Dashboard', input:'Input Laporan', laporan:'Laporan' };

  function goPage(name){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === name));
    closeUserMenu();

    if(name === 'dashboard') loadDashboard();
    if(name === 'laporan') resetLaporanSubTabCache();
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
  function formatTanggalDisplay(iso){
    if(!iso) return '';
    const parts = iso.toString().split('-');
    if(parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
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
    const shiftSel = document.getElementById('FilterShift');
    SHIFT_LIST.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.innerText = s;
      shiftSel.appendChild(opt);
    });

    const monBidangSel = document.getElementById('MonFilterBidang');
    BIDANG_LIST.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b; opt.innerText = b;
      monBidangSel.appendChild(opt);
    });
    const monShiftSel = document.getElementById('MonFilterShift');
    SHIFT_LIST.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.innerText = s;
      monShiftSel.appendChild(opt);
    });
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
  function getInputPayload(){
    return {
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
      Petugas: CURRENT_SESSION ? (CURRENT_SESSION.nama || CURRENT_SESSION.username) : '',
      Kategori: document.getElementById('Kategori').value,
      AreaKerja: document.getElementById('AreaKerja').value,
      Item: document.getElementById('Item').value,
      Keterangan: document.getElementById('Keterangan').value.trim()
    };
  }

  function validateInputPayload(p){
    if(!p.Tanggal) return 'Tanggal wajib diisi.';
    if(!p.Ruang) return 'Ruang wajib diisi.';
    if(!p.MasalahKegiatan) return 'Masalah/Kegiatan wajib diisi.';
    if(!p.Kategori) return 'Kategori wajib dipilih.';
    if(!p.AreaKerja) return 'Area kerja wajib dipilih.';
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
    const err = validateInputPayload(payload);
    if(err){ setMsg('msgInput', err, true); return; }

    setMsg('msgInput', 'Menyimpan...');
    try{
      const json = await authRun('apiCreateReport', payload);
      if(json && json.ok){
        setMsg('msgInput', 'Laporan tersimpan (ID: ' + json.report_id + ').');
        ['Pelapor','Pukul','NoLK','Ruang','MasalahKegiatan','Tindakan','SparePartUnit','Type','Jumlah','Keterangan'].forEach(id => {
          document.getElementById(id).value = '';
        });
        document.getElementById('Kategori').value = '';
        document.getElementById('AreaKerja').value = '';
        refreshItemOptions();
        document.getElementById('Status').value = 'Selesai';
        openSaveSuccessModal('Laporan berhasil disimpan (ID: ' + json.report_id + ').');
      } else {
        setMsg('msgInput', (json && json.msg) ? json.msg : 'Gagal menyimpan laporan.', true);
      }
    }catch(err){
      setMsg('msgInput', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  // ============================================================
  // LAPORAN (tabel + kartu mobile + filter + admin staff picker)
  // ============================================================
  async function loadReportsBySelectedMonth(){
    const bulan = document.getElementById('FilterBulan').value;
    setMsg('msgReport', 'Memuat data...');
    try{
      // Melihat laporan terbuka untuk semua peran -- filter petugas/bidang/shift
      // dilakukan di client (applyFilters) supaya panel & dropdown tetap responsif.
      const staffFilter = (_laporanMode === 'saya' && CURRENT_SESSION) ? (CURRENT_SESSION.staff_id || '') : '';
      const json = await authRun('apiGetReports', bulan, staffFilter, '', '');
      if(!json || !json.ok){
        setMsg('msgReport', (json && json.msg) ? json.msg : 'Gagal memuat data.', true);
        rawData = [];
        renderReportTable([]);
        return;
      }
      rawData = json.data || [];
      applyFilters();
    }catch(err){
      setMsg('msgReport', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  function applyFilters(){
    const status = document.getElementById('FilterStatus').value;
    const kategori = document.getElementById('FilterKategori').value;
    const area = document.getElementById('FilterArea').value;
    const bidang = document.getElementById('FilterBidang').value;
    const shift = document.getElementById('FilterShift').value;
    const cari = document.getElementById('FilterCari').value.trim().toLowerCase();

    const viewData = rawData.filter(r => {
      if(status && r.Status !== status) return false;
      if(kategori && r.Kategori !== kategori) return false;
      if(area && r.AreaKerja !== area) return false;
      if(bidang && r.Bidang !== bidang) return false;
      if(shift && r.Shift !== shift) return false;
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

  function renderLaporanSummary(rows, bulan){
    const total = rows.length;
    const selesai = rows.filter(r => r.Status === 'Selesai').length;
    const belum = rows.filter(r => r.Status !== 'Selesai').length;
    const el = id => document.getElementById(id);
    if(el('lapTotal')) el('lapTotal').innerText = total;
    if(el('lapSelesai')) el('lapSelesai').innerText = selesai;
    if(el('lapBelum')) el('lapBelum').innerText = belum;
    if(el('lapBulanIni')) el('lapBulanIni').innerText = bulan || '-';
  }

  function renderReportTable(viewData){
    const tbody = document.getElementById('reportTableBody');
    const cardList = document.getElementById('reportCardList');
    tbody.innerHTML = '';
    cardList.innerHTML = '';

    window.__IPSRS_REPORTS = window.__IPSRS_REPORTS || {};
    viewData.forEach(row => {
      window.__IPSRS_REPORTS[String(row.ID)] = row;
      const tr = document.createElement('tr');
      const bidangShift = row.Bidang || row.Shift || '-';
      tr.innerHTML = `
        <td>${escapeHtml(formatTanggalDisplay(row.Tanggal))}</td>
        <td>${escapeHtml(row.Pukul)}</td>
        <td>${escapeHtml(row.Ruang)}</td>
        <td>${escapeHtml(row.NoLK)}</td>
        <td>${escapeHtml(row.MasalahKegiatan)}</td>
        <td>${escapeHtml(row.Tindakan)}</td>
        <td>${escapeHtml(row.Petugas)}</td>
        <td>${escapeHtml(bidangShift)}</td>
        <td><span class="pill ${row.Status==='Selesai'?'success':'warning'}">${escapeHtml(row.Status)}</span></td>
        <td>${escapeHtml(row.Kategori)}</td>
        <td>${escapeHtml(row.AreaKerja)}</td>
        <td>${escapeHtml(row.Item)}</td>
        <td class="report-action"><button class="btn" type="button" onclick="event.stopPropagation();openEditModalForReport(window.__IPSRS_REPORTS['${escapeHtml(String(row.ID))}'])">✏️ Edit</button></td>
      `;
      tr.className = row.Status === 'Selesai' ? 'report-row-selesai' : (row.Status === 'Belum' ? 'report-row-belum' : 'report-row-proses');
      tr.onclick = () => openEditModalForReport(row);
      tbody.appendChild(tr);

      const card = document.createElement('div');
card.className = 'rcard';

card.innerHTML = `
  <div class="rc-top">
    <div class="rc-title">
      ${escapeHtml(formatTanggalDisplay(row.Tanggal))}
      &middot;
      ${escapeHtml(row.Ruang)}
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

card.onclick = () => openEditModalForReport(row);
cardList.appendChild(card);
    });
  }

  // ============================================================
  // SUB-TAB HALAMAN LAPORAN (Monitoring Harian / Rekap Bulanan / Daftar Laporan)
  // ============================================================
  const _laporanSubTabLoaded = { monitoring: false, rekap: false, daftar: false, saya: false };
  let _laporanMode = 'saya';

  function goLaporanSubTab(name){
    const panelName = (name === 'saya' || name === 'daftar') ? 'daftar' : name;
    document.querySelectorAll('.sub-tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('subtab-' + panelName).classList.remove('hidden');
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === name));
    if(name === 'saya' || name === 'daftar'){
      _laporanMode = name;
      const staffPanel = document.getElementById('adminStaffPanel');
      if(staffPanel) staffPanel.classList.toggle('hidden', name !== 'daftar');
      _laporanSubTabLoaded[name] = false;
      // Panel petugas hanya diperlukan pada Daftar Laporan. Jangan panggil
      // apiListStaff saat login karena itu menambah waktu tunggu awal.
      if(name === 'daftar') loadAdminStaffListIfNeeded();
      loadReportsBySelectedMonth();
      return;
    }
    if(!_laporanSubTabLoaded[name]){
      _laporanSubTabLoaded[name] = true;
      if(name === 'monitoring') loadStaffMonitoring();
      if(name === 'rekap') loadMonthlyRecap();
    }
  }

  function resetLaporanSubTabCache(){
    _laporanSubTabLoaded.monitoring = false;
    _laporanSubTabLoaded.rekap = false;
    _laporanSubTabLoaded.daftar = false;
    _laporanSubTabLoaded.saya = false;
    _laporanMode = 'saya';
    goLaporanSubTab('saya');
  }

  // ============================================================
  // MONITORING HARIAN
  // ============================================================
  let _monData = [];
  let _monSummary = {};

  async function loadStaffMonitoring(){
    const bulan = document.getElementById('MonBulan').value;
    const tanggal = document.getElementById('MonTanggal').value;
    setMsg('monMsg', 'Memuat data monitoring...');
    try{
      const json = await authRun('apiGetStaffMonitoring', bulan, tanggal);
      if(!json || !json.ok){
        setMsg('monMsg', (json && json.msg) ? json.msg : 'Gagal memuat data monitoring.', true);
        _monData = [];
        renderStaffMonitoring();
        return;
      }
      _monData = json.data || [];
      _monSummary = { hari_wajib_terhitung: json.hari_wajib_terhitung || 0, tanggal: json.tanggal, bulan: json.bulan };
      renderStaffMonitoring();
    }catch(err){
      setMsg('monMsg', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  function renderStaffMonitoring(){
    const status = document.getElementById('MonFilterStatus').value;
    const bidang = document.getElementById('MonFilterBidang').value;
    const shift = document.getElementById('MonFilterShift').value;
    const cari = document.getElementById('MonFilterCari').value.trim().toLowerCase();

    const view = _monData.filter(s => {
      if(status && s.status_hari_ini !== status) return false;
      if(bidang && s.bidang !== bidang) return false;
      if(shift && s.shift !== shift) return false;
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
      const bidangShift = s.bidang || s.shift || '-';
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
        <div class="smc-meta">${escapeHtml(s.role_label)} &middot; ${escapeHtml(bidangShift)}</div>
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
      (staff.jabatan || staff.role_label) + ' \u00b7 ' + (staff.bidang || staff.shift || '-') + ' \u00b7 staff_id: ' + staff.staff_id;
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
        return;
      }
      renderMonthlyRecap(json);
    }catch(err){
      staffBody.innerHTML = '<tr><td colspan="6" class="smallnote">Error: ' + escapeHtml(err && err.message ? err.message : err) + '</td></tr>';
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
          <td>${escapeHtml(s.bidang||s.shift||'-')}</td>
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

  const EDIT_FIELD_IDS = ['Edit_Tanggal','Edit_Pelapor','Edit_Pukul','Edit_NoLK','Edit_Ruang',
    'Edit_MasalahKegiatan','Edit_Tindakan','Edit_SparePartUnit','Edit_Type','Edit_Jumlah',
    'Edit_Status','Edit_Kategori','Edit_AreaKerja','Edit_Item','Edit_Keterangan'];

  function openEditModalForReport(report){
    if(!report) return;
    _editingReportId = report.ID;
    _historyLoadedForReportId = null;
    document.getElementById('editModalSub').innerText = 'ID: ' + report.ID + '  \u00b7  Petugas: ' + (report.Petugas||'-') + '  \u00b7  ' + (report.Bidang||report.Shift||'-');

    const editable = canEditReport(report);
    EDIT_FIELD_IDS.forEach(id => { document.getElementById(id).disabled = !editable; });
    document.getElementById('btnSaveEdit').classList.toggle('hidden', !editable);
    const noteEl = document.getElementById('editPermissionNote');
    if(!editable){
      noteEl.classList.remove('hidden');
      noteEl.innerText = 'Anda hanya dapat MELIHAT laporan ini (bukan milik Anda). Hanya pemilik laporan, Administrasi, atau KA IPSRS yang dapat mengedit.';
    } else {
      noteEl.classList.add('hidden');
    }

    const historyPanel = document.getElementById('historyPanel');
    if(CURRENT_SESSION && (CURRENT_SESSION.role === 'KA_IPSRS' || CURRENT_SESSION.role === 'ADMINISTRASI')){
      historyPanel.classList.remove('hidden');
      document.getElementById('historyList').classList.add('hidden');
      document.getElementById('historyList').innerHTML = '';
    } else {
      historyPanel.classList.add('hidden');
    }
    document.getElementById('Edit_Tanggal').value = report.Tanggal||'';
    document.getElementById('Edit_Pelapor').value = report.Pelapor||'';
    document.getElementById('Edit_Pukul').value = report.Pukul||'';
    document.getElementById('Edit_NoLK').value = report.NoLK||'';
    document.getElementById('Edit_Ruang').value = report.Ruang||'';
    document.getElementById('Edit_MasalahKegiatan').value = report.MasalahKegiatan||'';
    document.getElementById('Edit_Tindakan').value = report.Tindakan||'';
    document.getElementById('Edit_SparePartUnit').value = report.SparePartUnit||'';
    document.getElementById('Edit_Type').value = report.Type||'';
    document.getElementById('Edit_Jumlah').value = report.Jumlah||'';
    document.getElementById('Edit_Status').value = report.Status||'Selesai';
    document.getElementById('Edit_Petugas').value = report.Petugas||'';
    document.getElementById('Edit_Kategori').value = report.Kategori||'';
    document.getElementById('Edit_AreaKerja').value = report.AreaKerja||'';
    document.getElementById('Edit_Item').value = report.Item||'';
    document.getElementById('Edit_Keterangan').value = report.Keterangan||'';
    setMsg('msgEdit','');
    document.getElementById('editModalBg').classList.add('show');
  }
  function closeEditModal(){
    document.getElementById('editModalBg').classList.remove('show');
    _editingReportId = null;
  }

  function toggleHistoryList(){
    const list = document.getElementById('historyList');
    const willShow = list.classList.contains('hidden');
    list.classList.toggle('hidden');
    if(willShow && _historyLoadedForReportId !== _editingReportId){
      loadReportHistory();
    }
  }

  async function loadReportHistory(){
    const list = document.getElementById('historyList');
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
          ? changedFields.map(k => `<div style="font-size:11.5px; margin-top:3px;"><b>${escapeHtml(k)}:</b> <span style="color:var(--danger);">${escapeHtml(h.before[k])}</span> &rarr; <span style="color:var(--success);">${escapeHtml(h.after[k])}</span></div>`).join('')
          : '<div class="smallnote">Tidak ada field yang berubah.</div>';
        const row = document.createElement('div');
        row.style.cssText = 'background:#fff; border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:8px;';
        row.innerHTML = `<div style="font-size:11.5px; font-weight:700;">${escapeHtml(h.edited_at)} oleh ${escapeHtml(h.edited_by_username)} (${escapeHtml(h.edited_by_staff_id)})</div>${diffHtml}`;
        list.appendChild(row);
      });
    }catch(err){
      list.innerHTML = '<div class="smallnote">Error: ' + escapeHtml(err && err.message ? err.message : err) + '</div>';
    }
  }

  async function saveEdit(){
    if(!_editingReportId){ setMsg('msgEdit','Tidak ada laporan yang dipilih.', true); return; }
    setMsg('msgEdit','Menyimpan perubahan...');
    const payload = {
      Tanggal: document.getElementById('Edit_Tanggal').value,
      Pelapor: document.getElementById('Edit_Pelapor').value.trim(),
      Pukul: document.getElementById('Edit_Pukul').value.trim(),
      NoLK: document.getElementById('Edit_NoLK').value.trim(),
      Ruang: document.getElementById('Edit_Ruang').value.trim(),
      MasalahKegiatan: document.getElementById('Edit_MasalahKegiatan').value.trim(),
      Tindakan: document.getElementById('Edit_Tindakan').value.trim(),
      SparePartUnit: document.getElementById('Edit_SparePartUnit').value.trim(),
      Type: document.getElementById('Edit_Type').value.trim(),
      Jumlah: document.getElementById('Edit_Jumlah').value.trim(),
      Status: document.getElementById('Edit_Status').value,
      Kategori: document.getElementById('Edit_Kategori').value.trim(),
      AreaKerja: document.getElementById('Edit_AreaKerja').value.trim(),
      Item: document.getElementById('Edit_Item').value.trim(),
      Keterangan: document.getElementById('Edit_Keterangan').value.trim()
    };
    try{
      const json = await authRun('apiUpdateReport', _editingReportId, payload);
      if(json && json.ok){
        setMsg('msgEdit','Perubahan tersimpan.');
        _laporanSubTabLoaded.monitoring = false;
        _laporanSubTabLoaded.rekap = false;
        closeEditModal();
        openSaveSuccessModal('Perubahan laporan berhasil disimpan.');
        loadReportsBySelectedMonth();
      } else {
        setMsg('msgEdit', (json && json.msg) ? json.msg : 'Gagal menyimpan.', true);
      }
    }catch(err){
      setMsg('msgEdit', 'Error: ' + (err && err.message ? err.message : err), true);
    }
  }

  // ============================================================
  // ADMIN: DAFTAR PETUGAS
  // ============================================================
  async function loadAdminStaffListIfNeeded(){
    if(!CURRENT_SESSION) return;
    try{
      const json = await authRun('apiListStaff');
      if(json && json.ok){
        ADMIN_STAFF_LIST = json.data || [];
        renderAdminStaffGrid();
        renderDashStaffSelect();
      }
    }catch(e){}
  }
  function renderAdminStaffGrid(){
    const grid = document.getElementById('adminStaffGrid');
    if(!grid) return;
    grid.innerHTML = '';
    const allChip = document.createElement('div');
    allChip.className = 'staff-chip' + (adminSelectedStaffId==='' ? ' active' : '');
    allChip.innerHTML = '<div><div class="sc-name">Semua Petugas</div><div class="sc-meta">Gabungan seluruh laporan</div></div>';
    allChip.onclick = () => selectAdminStaff('');
    grid.appendChild(allChip);

    ADMIN_STAFF_LIST.forEach(st => {
      const chip = document.createElement('div');
      chip.className = 'staff-chip' + (adminSelectedStaffId===st.staff_id ? ' active' : '');
      const ctx = (st.role_label||st.role||'-') + (st.bidang ? ' \u00b7 ' + st.bidang : '') + (st.shift ? ' \u00b7 ' + st.shift : '');
      chip.innerHTML = `<div><div class="sc-name">${escapeHtml(st.staff_id)} &mdash; ${escapeHtml(st.nama||'')}</div><div class="sc-meta">${escapeHtml(ctx)}</div></div><div class="sc-count">${st.total_laporan||0}</div>`;
      chip.onclick = () => selectAdminStaff(st.staff_id);
      grid.appendChild(chip);
    });
  }
  function renderDashStaffSelect(){
    const sel = document.getElementById('DashStaff');
    if(!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Semua Petugas</option>';
    ADMIN_STAFF_LIST.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st.staff_id;
      opt.innerText = st.staff_id + ' - ' + (st.nama||'');
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
        pill.innerText = 'Menampilkan: ' + staffId + (st ? ' - ' + st.nama : '');
      }
    }
    renderAdminStaffGrid();
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
    const colors = ['#1a9e57', '#c98a12'];

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
          <div class="r-main">${escapeHtml(r.Ruang)} &middot; ${escapeHtml(r.Tanggal)}</div>
          <div class="r-sub">${escapeHtml(r.MasalahKegiatan)}</div>
        </div>
        <span class="pill ${r.Status==='Selesai'?'success':'warning'}">${escapeHtml(r.Status)}</span>
      `;
      el.appendChild(item);
    });
  }

  async function loadDashboard(){
    const bulan = document.getElementById('DashBulan').value;
    // SENGAJA tidak fallback ke adminSelectedStaffId (default punya tab Laporan)
    // -- Dashboard punya pilihan sendiri lewat dropdown #DashStaff, default "Semua Petugas".
    const staffFilter = document.getElementById('DashStaff').value || null;
    try{
      const [statsJson, monJson] = await Promise.all([
        authRun('apiDashboardStats', bulan, staffFilter),
        authRun('apiGetStaffMonitoring')
      ]);

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

      const pencapaianOrder = ['Selesai','Sebagian','Belum Selesai','Ditunda','Tindak Lanjut','Belum Diisi'];
      const pencapaianBars = pencapaianOrder
        .map(label => ({ label, value: (d.pencapaian && d.pencapaian[label]) || 0 }))
        .filter(x => x.value > 0);
      renderBarList('barPencapaian', pencapaianBars.length ? pencapaianBars : [{label:'Belum ada data', value:0}]);

      renderBarList('barKategori', d.kategori);
      renderBarList('barArea', d.area);
      renderStatusChart(d.selesai, d.belum);
      renderRecentList(d.recent);

      renderBarList('barStaff', d.staff.map(s => ({ label: (s.nama||s.staff_id), value: s.value })));
    }catch(e){}
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
    document.getElementById('Status').value = 'Selesai';

    // Data kustom tidak boleh menghambat login. Jalankan setelah UI sudah aktif.
    // Promise sengaja tidak di-await.
    Promise.all([loadKategoriKustom(), loadAreaKerjaKustom(), loadItemKustomAll()])
      .then(() => {
        appendAddNewOption('Kategori', '+ Tambah Kategori Baru');
        appendAddNewOption('AreaKerja', '+ Tambah Area Kerja Baru');
        refreshItemOptions();
      })
      .catch(() => {});
  }

  async function checkAuthAndInit(){
    const s = getSession();
    if(s && s.token){
      CURRENT_SESSION = s;
      try{
        const json = await gsRun('apiWhoAmI', s.token);
        if(json && json.ok){
          setSession(Object.assign({}, s, json));
          await afterAuthReady();
          hideLoginScreen();
          goPage('input');
          return;
        } else {
          clearSession();
          showLoginScreen('Sesi berakhir, silakan login kembali.');
          return;
        }
      }catch(err){
        showLoginScreen('Tidak dapat menghubungi server: ' + (err && err.message ? err.message : err));
        return;
      }
    }

    // Tidak ada sesi aktif (sessionStorage kosong/berakhir, mis. browser baru
    // dibuka lagi). Form login tetap ditampilkan dan user WAJIB klik tombol
    // "Masuk" sendiri -- TIDAK ADA login otomatis diam-diam lagi (dihapus atas
    // permintaan: auto-login dianggap berisiko keamanan). Username/password
    // "Ingat Saya" (kalau ada) tetap terisi otomatis di form oleh
    // loadRememberedCredentials() supaya user tinggal klik, bukan mengetik ulang.
    showLoginScreen();
  }

  loadRememberedCredentials();
  checkAuthAndInit();

