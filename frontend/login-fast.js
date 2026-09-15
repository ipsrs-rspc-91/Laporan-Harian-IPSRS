/* Login fast-path + progress UI + password visibility toggle.
 * Menampilkan status proses selama backend GAS memproses login,
 * lalu tetap menampilkan aplikasi segera setelah autentikasi berhasil.
 * Tidak mengubah autentikasi, session, role, atau hak akses backend.
 */
(function(){
  const originalPerformLogin = window.performLogin;
  if(typeof originalPerformLogin !== 'function') return;

  // Tambahkan style kecil langsung agar tidak perlu mengubah CSS utama.
  if(!document.getElementById('ipsrsLoginProgressStyle')){
    const style=document.createElement('style');
    style.id='ipsrsLoginProgressStyle';
    style.textContent='\n      #loginMsg.ipsrs-login-processing{display:flex;align-items:center;justify-content:center;gap:8px;min-height:24px;}\n      #loginMsg .ipsrs-login-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;animation:ipsrsLoginSpin .7s linear infinite;flex:0 0 auto;}\n      @keyframes ipsrsLoginSpin{to{transform:rotate(360deg);}}\n      #togglePassword:hover{background:rgba(100,116,139,.08)!important;}\n      #togglePassword:focus-visible{outline:2px solid #64748b;outline-offset:2px;border-radius:8px;}\n    ';
    document.head.appendChild(style);
  }

  // Tampilkan / sembunyikan password.
  window.togglePasswordVisibility = function(){
    const input=document.getElementById('loginPassword');
    const button=document.getElementById('togglePassword');
    const icon=document.getElementById('passwordEyeIcon');
    if(!input) return;

    const show=input.type==='password';
    input.type=show?'text':'password';

    if(button){
      button.setAttribute('aria-pressed',show?'true':'false');
      button.setAttribute('aria-label',show?'Sembunyikan password':'Tampilkan password');
      button.setAttribute('title',show?'Sembunyikan password':'Tampilkan password');
    }

    if(icon){
      // Eye saat password tersembunyi, eye-off saat password terlihat.
      icon.innerHTML=show
        ? '<path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a18.2 18.2 0 0 1-3.2 4.2"></path><path d="M6.1 6.1C3.5 8.1 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4-.8"></path>'
        : '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
  };

  function setProgress(msgEl, text){
    if(!msgEl) return;
    msgEl.classList.add('ipsrs-login-processing');
    msgEl.innerHTML='<span class="ipsrs-login-spinner" aria-hidden="true"></span><span>'+text+'</span>';
  }

  function clearProgress(msgEl){
    if(!msgEl) return;
    msgEl.classList.remove('ipsrs-login-processing');
  }

  function getLoginButton(){
    return document.querySelector('#loginScreen button[onclick*="doLogin"], #loginScreen #btnLogin, #loginScreen button[type="submit"]') || document.querySelector('button[onclick*="doLogin"]');
  }

  window.performLogin = async function(username, password, remember, msgEl, autoMode){
    if(!username || !password){
      clearProgress(msgEl);
      if(msgEl) msgEl.innerText = 'Username dan password wajib diisi.';
      return false;
    }

    const button=getLoginButton();
    const oldButtonText=button ? button.innerHTML : '';
    const oldDisabled=button ? button.disabled : false;
    const statuses=autoMode
      ? ['Masuk otomatis...','Memverifikasi sesi...','Menyiapkan akses...']
      : ['Memeriksa akun...','Memproses login...','Memverifikasi akses...','Menyiapkan sesi aman...'];
    let statusIndex=0;
    let statusTimer=null;

    setProgress(msgEl,statuses[0]);
    if(button){
      button.disabled=true;
      button.innerHTML='⟳ Memproses...';
      button.style.cursor='wait';
      button.setAttribute('aria-busy','true');
    }

    statusTimer=setInterval(function(){
      statusIndex=(statusIndex+1)%statuses.length;
      setProgress(msgEl,statuses[statusIndex]);
    },1800);

    try{
      const json = await gsRun('apiLogin', username, password);
      if(json && json.ok){
        clearInterval(statusTimer);
        setSession(json);
        if(remember) saveRememberedCredentials(username, password);
        else clearRememberedCredentials();
        if(msgEl){msgEl.innerText='';clearProgress(msgEl);}
        const p = document.getElementById('loginPassword');
        if(p){ p.value = ''; p.type='password'; }

        const toggle=document.getElementById('togglePassword');
        if(toggle){
          toggle.setAttribute('aria-pressed','false');
          toggle.setAttribute('aria-label','Tampilkan password');
          toggle.setAttribute('title','Tampilkan password');
        }
        const icon=document.getElementById('passwordEyeIcon');
        if(icon){
          icon.innerHTML='<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle>';
        }

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

      clearInterval(statusTimer);
      clearProgress(msgEl);
      if(msgEl) msgEl.innerText = (json && json.msg) ? json.msg : 'Login gagal.';
      if(autoMode) clearRememberedCredentials();
      return false;
    }catch(err){
      clearInterval(statusTimer);
      clearProgress(msgEl);
      if(msgEl) msgEl.innerText = 'Error: ' + (err && err.message ? err.message : err);
      return false;
    }finally{
      if(button){
        button.disabled=oldDisabled;
        button.innerHTML=oldButtonText;
        button.style.cursor='';
        button.removeAttribute('aria-busy');
      }
    }
  };
})();
