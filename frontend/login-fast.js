/* Login progress UI. Authentication itself is owned by app.js/Supabase. */
(function(){
  const originalPerformLogin=window.performLogin;
  if(typeof originalPerformLogin!=='function') return;
  if(!document.getElementById('ipsrsLoginProgressStyle')){
    const style=document.createElement('style');
    style.id='ipsrsLoginProgressStyle';
    style.textContent='#loginMsg.ipsrs-login-processing{display:flex;align-items:center;justify-content:center;gap:8px;min-height:24px}#loginMsg .ipsrs-login-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;animation:ipsrsLoginSpin .7s linear infinite}@keyframes ipsrsLoginSpin{to{transform:rotate(360deg)}}#togglePassword:hover{background:rgba(100,116,139,.08)!important}';
    document.head.appendChild(style);
  }
  window.togglePasswordVisibility=function(){
    const input=document.getElementById('loginPassword'),button=document.getElementById('togglePassword');
    if(!input)return;
    const show=input.type==='password'; input.type=show?'text':'password';
    if(button){button.setAttribute('aria-pressed',show?'true':'false');button.setAttribute('aria-label',show?'Sembunyikan password':'Tampilkan password');button.setAttribute('title',show?'Sembunyikan password':'Tampilkan password');}
  };
  function setProgress(el,text){if(!el)return;el.classList.add('ipsrs-login-processing');el.innerHTML='<span class="ipsrs-login-spinner" aria-hidden="true"></span><span>'+text+'</span>';}
  function clearProgress(el){if(el)el.classList.remove('ipsrs-login-processing');}
  function button(){return document.querySelector('#loginScreen button[onclick*="doLogin"],#loginScreen #btnLogin,button[onclick*="doLogin"]');}
  // Simpan username/password hanya melalui password manager browser/perangkat.
  // Password TIDAK ditulis ke localStorage, sessionStorage, database, atau Supabase.
  async function storeBrowserCredential_(username,password,remember){
    if(!remember || !username || !password) return;
    try{
      if(
        window.isSecureContext &&
        navigator.credentials &&
        'PasswordCredential' in window &&
        typeof navigator.credentials.store === 'function'
      ){
        const credential = new PasswordCredential({
          id: String(username),
          password: String(password),
          name: String(username)
        });
        await navigator.credentials.store(credential);
      }
    }catch(_e){
      // Tidak mengganggu login bila browser tidak mendukung API ini
      // atau pengguna menolak penyimpanan kredensial.
    }
  }

  window.performLogin=async function(username,password,remember,msgEl,autoMode){
    if(!username||!password){clearProgress(msgEl);if(msgEl)msgEl.innerText='Username dan password wajib diisi.';return false;}
    const b=button(),old=b?b.innerHTML:'',disabled=b?b.disabled:false;
    if(b){b.disabled=true;b.innerHTML='⟳ Memproses...';b.setAttribute('aria-busy','true');}
    setProgress(msgEl,'Memeriksa akun Supabase...');
    try{
      const ok=await originalPerformLogin(username,password,remember,msgEl,autoMode);
      if(ok) await storeBrowserCredential_(username,password,remember);
      return ok;
    }finally{clearProgress(msgEl);if(b){b.disabled=disabled;b.innerHTML=old;b.removeAttribute('aria-busy');}}
  };
})();