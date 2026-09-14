/**
 * Auth.gs
 * Login, session token, dan hashing password.
 * Optimasi: CacheService untuk lookup USERS/STAFF dan tidak melakukan
 * cleanup seluruh sheet SESSIONS pada setiap login.
 */
function randomSalt(){return Utilities.getUuid();}

function hashPassword(password,salt){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(password)+'::'+String(salt),Utilities.Charset.UTF_8);
  return bytes.map(function(b){return (b<0?b+256:b).toString(16).padStart(2,'0');}).join('');
}

const AUTH_CACHE_TTL_SECONDS_=300;

function getCachedUserByUsername_(username){
  const key='auth:user:'+String(username||'').trim().toLowerCase();
  const cache=CacheService.getScriptCache();
  const cached=cache.get(key);
  if(cached){try{return JSON.parse(cached);}catch(e){cache.remove(key);}}
  const found=findUserByUsernameFromSheet_(username);
  if(found)cache.put(key,JSON.stringify(found),AUTH_CACHE_TTL_SECONDS_);
  return found;
}

function getCachedStaffById_(staffId){
  const key='auth:staff:'+String(staffId||'');
  const cache=CacheService.getScriptCache();
  const cached=cache.get(key);
  if(cached){try{return JSON.parse(cached);}catch(e){cache.remove(key);}}
  const staff=getStaffByIdFromSheet_(staffId);
  if(staff)cache.put(key,JSON.stringify(staff),AUTH_CACHE_TTL_SECONDS_);
  return staff;
}

function invalidateAuthCache_(username,staffId){
  const cache=CacheService.getScriptCache();
  if(username)cache.remove('auth:user:'+String(username).trim().toLowerCase());
  if(staffId)cache.remove('auth:staff:'+String(staffId));
}

function getStaffByIdFromSheet_(staffId){
  const sheet=getSheet(SHEET_STAFF),rows=sheet.getDataRange().getValues(),headers=rows[0];
  for(let i=1;i<rows.length;i++)if(rows[i][0]===staffId)return rowToObj(headers,rows[i]);
  return null;
}

function getStaffById(staffId){return getCachedStaffById_(staffId);}

function findUserByUsernameFromSheet_(username){
  const sheet=getSheet(SHEET_USERS),rows=sheet.getDataRange().getValues(),headers=rows[0];
  for(let i=1;i<rows.length;i++){
    const r=rowToObj(headers,rows[i]);
    if(r.username===username)return {row:r,rowIndex:i+1,headers:headers};
  }
  return null;
}

function findUserByUsername(username){return getCachedUserByUsername_(username);}

function cleanupExpiredSessions_(){
  try{
    const sheet=getSheet(SHEET_SESSIONS),data=sheet.getDataRange().getValues();
    if(data.length<2)return;
    const headers=data[0],expIdx=headers.indexOf('expires_at');
    if(expIdx<0)return;
    const nowMs=Date.now();
    for(let i=data.length-1;i>=1;i--){
      const exp=new Date(data[i][expIdx]).getTime();
      if(!isNaN(exp)&&exp<nowMs)sheet.deleteRow(i+1);
    }
  }catch(e){}
}

function login(username,password){
  username=(username||'').toString().trim();
  password=(password||'').toString();
  if(!username||!password)return {ok:false,msg:'Username dan password wajib diisi.'};

  const found=findUserByUsername(username);
  if(!found)return {ok:false,msg:'Username tidak ditemukan.'};
  const u=found.row;
  if(u.status!=='Aktif')return {ok:false,msg:'Akun nonaktif. Hubungi KA IPSRS.'};

  const hash=hashPassword(password,u.password_salt);
  if(hash!==u.password_hash){
    logAudit(username,u.staff_id,'LOGIN_FAILED','','Password salah');
    return {ok:false,msg:'Password salah.'};
  }

  const staff=getStaffById(u.staff_id),
    nama=staff?staff.nama:'',
    bidang=staff?staff.bidang:'',
    shift=staff?staff.shift:'';

  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return {ok:false,msg:'Server sedang sibuk, silakan coba lagi.'};
  let token;
  try{
    // Jangan scan/delete seluruh SESSIONS setiap login. Session kedaluwarsa
    // tetap ditolak oleh validateSession(); pembersihan dapat dilakukan terpisah.
    token=Utilities.getUuid()+'-'+Utilities.getUuid();
    const now=new Date(),exp=new Date(now.getTime()+SESSION_LIFETIME_MS),sess=getSheet(SHEET_SESSIONS);
    sess.appendRow(objToRow(HEADERS.SESSIONS,{token:token,username:username,staff_id:u.staff_id,role:u.role,bidang:bidang,shift:shift,nama:nama,created_at:now.toISOString(),expires_at:exp.toISOString()}));
  }finally{lock.releaseLock();}

  // Login berhasil tidak perlu menunggu penulisan audit tambahan. Audit
  // LOGIN_FAILED tetap dipertahankan untuk keamanan; aktivitas penting seperti
  // CREATE/UPDATE laporan tetap dicatat oleh Reports.gs.
  return {ok:true,token:token,username:username,staff_id:u.staff_id,role:u.role,nama:nama,bidang:bidang,shift:shift};
}

function validateSession(token){
  if(!token)return null;
  const sheet=getSheet(SHEET_SESSIONS),rows=sheet.getDataRange().getValues(),headers=rows[0];
  for(let i=1;i<rows.length;i++){
    if(rows[i][0]===token){
      const row=rowToObj(headers,rows[i]);
      if(new Date(row.expires_at).getTime()<Date.now())return null;
      return row;
    }
  }
  return null;
}

function logout(token){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))return {ok:false,msg:'Server sedang sibuk, silakan coba lagi.'};
  try{
    const sheet=getSheet(SHEET_SESSIONS),data=sheet.getDataRange().getValues();
    for(let i=1;i<data.length;i++){if(data[i][0]===token){sheet.deleteRow(i+1);break;}}
  }finally{lock.releaseLock();}
  return {ok:true};
}

function changePassword(session,oldPassword,newPassword){
  newPassword=(newPassword||'').toString();
  if(newPassword.length<6)return {ok:false,msg:'Password baru minimal 6 karakter.'};
  const found=findUserByUsername(session.username);
  if(!found)return {ok:false,msg:'User tidak ditemukan.'};
  const oldHash=hashPassword(oldPassword,found.row.password_salt);
  if(oldHash!==found.row.password_hash)return {ok:false,msg:'Password lama salah.'};
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))return {ok:false,msg:'Server sedang sibuk, silakan coba lagi.'};
  try{
    const sheet=getSheet(SHEET_USERS),salt=randomSalt(),hash=hashPassword(newPassword,salt),hIdx=found.headers.indexOf('password_hash'),sIdx=found.headers.indexOf('password_salt'),uIdx=found.headers.indexOf('updated_at');
    sheet.getRange(found.rowIndex,hIdx+1).setValue(hash);
    sheet.getRange(found.rowIndex,sIdx+1).setValue(salt);
    sheet.getRange(found.rowIndex,uIdx+1).setValue(nowIso());
    invalidateAuthCache_(session.username,session.staff_id);
  }finally{lock.releaseLock();}
  logAudit(session.username,session.staff_id,'CHANGE_PASSWORD','','');
  return {ok:true};
}

function adminResetPassword(session,targetUsername,newPassword){
  if(session.role!==ROLE_KA_IPSRS&&session.role!==ROLE_ADMINISTRASI)return {ok:false,msg:'Akses ditolak.'};
  newPassword=(newPassword||'').toString();
  if(newPassword.length<6)return {ok:false,msg:'Password baru minimal 6 karakter.'};
  const found=findUserByUsername(targetUsername);
  if(!found)return {ok:false,msg:'User tidak ditemukan.'};
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))return {ok:false,msg:'Server sedang sibuk, silakan coba lagi.'};
  try{
    const sheet=getSheet(SHEET_USERS),salt=randomSalt(),hash=hashPassword(newPassword,salt),hIdx=found.headers.indexOf('password_hash'),sIdx=found.headers.indexOf('password_salt'),uIdx=found.headers.indexOf('updated_at');
    sheet.getRange(found.rowIndex,hIdx+1).setValue(hash);
    sheet.getRange(found.rowIndex,sIdx+1).setValue(salt);
    sheet.getRange(found.rowIndex,uIdx+1).setValue(nowIso());
    invalidateAuthCache_(targetUsername,found.row.staff_id);
  }finally{lock.releaseLock();}
  logAudit(session.username,session.staff_id,'ADMIN_RESET_PASSWORD','','target='+targetUsername);
  return {ok:true};
}
