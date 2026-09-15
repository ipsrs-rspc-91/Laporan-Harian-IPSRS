/* Login fast-path: tampilkan UI segera setelah autentikasi berhasil.
 * Inisialisasi non-kritis dijalankan di background agar login tidak menunggu.
 */
(function(){
  const originalPerformLogin = window.performLogin;
  if(typeof originalPerformLogin !== 'function') return;

  window.performLogin = async function(username, password, remember, msgEl, autoMode){
    if(!username || !password){
      if(msgEl) msgEl.innerText = 'Username dan password wajib diisi.';
      return false;
    }
    if(msgEl) msgEl.innerText = autoMode ? 'Masuk otomatis...' : 'Memeriksa...';

    try{
      const json = await gsRun('apiLogin', username, password);
      if(json && json.ok){
        setSession(json);
        if(remember) saveRememberedCredentials(username, password);
        else clearRememberedCredentials();
        if(msgEl) msgEl.innerText = '';
        const p = document.getElementById('loginPassword');
        if(p) p.value = '';

        // Tampilkan aplikasi SEGERA. Jangan menunggu data tambahan.
        applyIdentityToUI();
        hideLoginScreen();
        goPage('input');

        // Inisialisasi tambahan berjalan di belakang layar.
        Promise.resolve().then(function(){
          return afterAuthReady();
        }).catch(function(err){
          console.warn('Background init login:', err);
        });
        return true;
      }

      if(msgEl) msgEl.innerText = (json && json.msg) ? json.msg : 'Login gagal.';
      if(autoMode) clearRememberedCredentials();
      return false;
    }catch(err){
      if(msgEl) msgEl.innerText = 'Error: ' + (err && err.message ? err.message : err);
      return false;
    }
  };
})();
