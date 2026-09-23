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
  function button(){return document.querySelector('#ipsrsLoginForm button[type="submit"],#loginScreen #loginBtn,#loginScreen button[onclick*="doLogin"]');}
  // Password "Ingat Saya" tidak pernah disimpan plaintext di localStorage,
  // sessionStorage, database aplikasi, atau Supabase.
  // Untuk mendukung refresh/PWA di perangkat yang tidak mendukung PasswordCredential,
  // aplikasi menyimpan ciphertext AES-GCM di IndexedDB; browser Password Manager
  // tetap digunakan sebagai jalur tambahan bila tersedia.
  // Password tidak pernah dikirim ke backend sebagai data Remember Me.
  // Kunci AES dibuat non-extractable dan tidak pernah ditulis ke localStorage.
  // Ini membuat aplikasi dapat mengisi ulang password setelah refresh/PWA restart
  // tanpa menyimpan password plaintext di localStorage/sessionStorage/Supabase.
  const IPSRS_CRED_DB='ipsrs-credential-v1';
  const IPSRS_CRED_STORE='credential';
  function openRememberedPasswordDb_(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB tidak tersedia'));return;}
      const req=indexedDB.open(IPSRS_CRED_DB,1);
      req.onupgradeneeded=function(){
        const db=req.result;
        if(!db.objectStoreNames.contains(IPSRS_CRED_STORE)) db.createObjectStore(IPSRS_CRED_STORE);
      };
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){reject(req.error||new Error('Gagal membuka IndexedDB'));};
    });
  }
  async function getRememberedPasswordKey_(){
    const db=await openRememberedPasswordDb_();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(IPSRS_CRED_STORE,'readonly');
      const req=tx.objectStore(IPSRS_CRED_STORE).get('key');
      req.onsuccess=async function(){
        try{
          if(req.result){resolve(req.result);return;}
          const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
          const wtx=db.transaction(IPSRS_CRED_STORE,'readwrite');
          wtx.objectStore(IPSRS_CRED_STORE).put(key,'key');
          wtx.oncomplete=function(){resolve(key);};
          wtx.onerror=function(){reject(wtx.error||new Error('Gagal menyimpan kunci kredensial'));};
        }catch(e){reject(e);}
      };
      req.onerror=function(){reject(req.error||new Error('Gagal membaca kunci kredensial'));};
    });
  }
  function bytesToB64_(bytes){
    let s='';
    const arr=new Uint8Array(bytes);
    for(let i=0;i<arr.length;i+=0x8000) s+=String.fromCharCode.apply(null,arr.subarray(i,i+0x8000));
    return btoa(s);
  }
  function b64ToBytes_(b64){
    const s=atob(b64),out=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i);
    return out;
  }
  async function saveRememberedPassword_(username,password){
    if(!username || !password) return false;
    try{
      const key=await getRememberedPasswordKey_();
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const plain=new TextEncoder().encode(JSON.stringify({username:String(username),password:String(password)}));
      const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
      const db=await openRememberedPasswordDb_();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(IPSRS_CRED_STORE,'readwrite');
        tx.objectStore(IPSRS_CRED_STORE).put({iv:bytesToB64_(iv),cipher:bytesToB64_(cipher)},'data');
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('Gagal menyimpan kredensial'));
      });
      return true;
    }catch(_e){return false;}
  }
  window.clearRememberedPassword_=async function(){
    try{
      const db=await openRememberedPasswordDb_();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(IPSRS_CRED_STORE,'readwrite');
        tx.objectStore(IPSRS_CRED_STORE).delete('data');
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
    }catch(_e){}
  };
  async function restoreRememberedPassword_(){
    if(typeof window.isRememberMeEnabled_==='function' && !window.isRememberMeEnabled_()) return;
    const usernameEl=document.getElementById('loginUsername');
    const passwordEl=document.getElementById('loginPassword');
    if(!passwordEl) return;
    try{
      const db=await openRememberedPasswordDb_();
      const record=await new Promise((resolve,reject)=>{
        const tx=db.transaction(IPSRS_CRED_STORE,'readonly');
        const req=tx.objectStore(IPSRS_CRED_STORE).get('data');
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
      });
      if(!record){
        // Fallback ke Password Manager browser bila kredensial sudah tersimpan di sana.
        try{
          if(
            window.isSecureContext &&
            navigator.credentials &&
            typeof navigator.credentials.get==='function'
          ){
            const credential=await navigator.credentials.get({password:true,mediation:'optional'});
            if(credential && credential.type==='password'){
              if(usernameEl && credential.id) usernameEl.value=String(credential.id);
              if(credential.password) passwordEl.value=String(credential.password);
            }
          }
        }catch(_e){}
        return;
      }
      const key=await getRememberedPasswordKey_();
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes_(record.iv)},key,b64ToBytes_(record.cipher));
      const payload=JSON.parse(new TextDecoder().decode(plain));
      if(usernameEl && payload.username && usernameEl.value.trim()!==String(payload.username).trim()){
        return;
      }
      if(payload.password) passwordEl.value=String(payload.password);
    }catch(_e){}
  }

  window.storeBrowserCredential_=async function(username,password,remember){
    if(!remember || !username || !password) return false;
    let stored=false;
    try{ stored=await saveRememberedPassword_(username,password); }catch(_e){}
    try{
      if(
        window.isSecureContext &&
        navigator.credentials &&
        'PasswordCredential' in window &&
        typeof navigator.credentials.store === 'function'
      ){
        const credential=new PasswordCredential({
          id:String(username),
          password:String(password),
          name:String(username)
        });
        await navigator.credentials.store(credential);
        stored=true;
      }
    }catch(_e){}
    return stored;
  };

  // Ambil kredensial tersimpan saat halaman login selesai dimuat.
  // Hanya mengisi field; TIDAK memanggil doLogin/performLogin.
  setTimeout(function(){ restoreRememberedPassword_(); },0);

  window.performLogin=async function(username,password,remember,msgEl,autoMode){
    if(!username||!password){clearProgress(msgEl);if(msgEl)msgEl.innerText='Username dan password wajib diisi.';return false;}
    const b=button(),old=b?b.innerHTML:'',disabled=b?b.disabled:false;
    if(b){b.disabled=true;b.innerHTML='⟳ Memproses...';b.setAttribute('aria-busy','true');}
    setProgress(msgEl,'Memeriksa akun Supabase...');
    try{
      // Penyimpanan kredensial dilakukan di app.js setelah autentikasi berhasil.
      return await originalPerformLogin(username,password,remember,msgEl,autoMode);
    }finally{clearProgress(msgEl);if(b){b.disabled=disabled;b.innerHTML=old;b.removeAttribute('aria-busy');}}
  };

})();
