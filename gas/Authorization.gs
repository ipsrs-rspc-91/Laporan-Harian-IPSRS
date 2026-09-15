// Authorization.gs
// ============================================================
// PENGATURAN AKSES LAPORAN / EDIT LAPORAN
// ============================================================

const ACCESS_SETTING_LAPORAN_TIM = 'LAPORAN_TIM';
const ACCESS_SETTING_ADMINISTRASI_EDIT = 'ADMINISTRASI_EDIT';
const ACCESS_ACTIVE = 'AKTIF';
const ACCESS_INACTIVE = 'NONAKTIF';
const SHEET_ACCESS_SETTINGS = 'ACCESS_SETTINGS';
const SHEET_EDIT_PERMISSIONS = 'EDIT_PERMISSIONS';

function ensureAccessSheets_(){
  const ss = getSS();
  let sh = ss.getSheetByName(SHEET_ACCESS_SETTINGS);
  if(!sh){
    sh = ss.insertSheet(SHEET_ACCESS_SETTINGS);
    sh.getRange(1,1,1,4).setValues([['setting','value','updated_at','updated_by_staff_id']]);
  }
  const rows = sh.getDataRange().getValues();
  const existing = {};
  for(let i=1;i<rows.length;i++){
    const key = String(rows[i][0] || '').trim();
    if(key) existing[key] = i+1;
  }
  const defaults = [
    [ACCESS_SETTING_LAPORAN_TIM, ACCESS_ACTIVE],
    [ACCESS_SETTING_ADMINISTRASI_EDIT, ACCESS_INACTIVE]
  ];
  defaults.forEach(function(d){
    if(!existing[d[0]]) sh.appendRow([d[0],d[1],new Date(),'']);
  });

  let ep = ss.getSheetByName(SHEET_EDIT_PERMISSIONS);
  if(!ep){
    ep = ss.insertSheet(SHEET_EDIT_PERMISSIONS);
    ep.getRange(1,1,1,7).setValues([['grantee_staff_id','grantee_name','target_staff_id','target_name','status','created_at','created_by_staff_id']]);
  }
}

function getAccessSetting_(setting, fallback){
  ensureAccessSheets_();
  const sh = getSS().getSheetByName(SHEET_ACCESS_SETTINGS);
  const rows = sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][0] || '').trim() === String(setting)){
      const value = String(rows[i][1] || '').trim();
      return value || fallback;
    }
  }
  return fallback;
}

function setAccessSetting_(session, setting, value){
  if(!session || session.role !== ROLE_KA_IPSRS) return {ok:false,msg:'Hanya KA IPSRS yang dapat mengubah pengaturan akses.'};
  value = String(value || '').trim().toUpperCase();
  if([ACCESS_ACTIVE,ACCESS_INACTIVE].indexOf(value) < 0) return {ok:false,msg:'Nilai pengaturan tidak valid.'};
  ensureAccessSheets_();
  const sh = getSS().getSheetByName(SHEET_ACCESS_SETTINGS);
  const rows = sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][0] || '').trim() === String(setting)){
      sh.getRange(i+1,2,1,3).setValues([[value,new Date(),session.staff_id || '']]);
      return {ok:true,msg:'Pengaturan akses berhasil diperbarui.',setting:setting,value:value};
    }
  }
  sh.appendRow([setting,value,new Date(),session.staff_id || '']);
  return {ok:true,msg:'Pengaturan akses berhasil dibuat.',setting:setting,value:value};
}

function canViewReport_(session, reportOwnerStaffId){
  if(!session) return false;
  if(session.role === ROLE_KA_IPSRS) return true;
  if(String(session.staff_id) === String(reportOwnerStaffId)) return true;
  return getAccessSetting_(ACCESS_SETTING_LAPORAN_TIM, ACCESS_ACTIVE) === ACCESS_ACTIVE;
}

function getReportOwner_(reportId){
  const sh = getSheet(SHEET_REPORTS);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  const idIdx = headers.indexOf('report_id');
  const staffIdx = headers.indexOf('staff_id');
  const roleIdx = headers.indexOf('role_snapshot');
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][idIdx] || '') === String(reportId)){
      return {staff_id:String(rows[i][staffIdx] || ''),role:String(rows[i][roleIdx] || '')};
    }
  }
  return null;
}

function hasActiveEditPermission_(granteeStaffId, targetStaffId){
  ensureAccessSheets_();
  const sh = getSS().getSheetByName(SHEET_EDIT_PERMISSIONS);
  const rows = sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][0] || '') === String(granteeStaffId) && String(rows[i][2] || '') === String(targetStaffId) && String(rows[i][4] || '').toUpperCase() === ACCESS_ACTIVE) return true;
  }
  return false;
}

function canEditReport_(session,reportOwnerStaffId,reportOwnerRole){
  if(!session)return false;
  if(session.role===ROLE_KA_IPSRS)return true;
  if(reportOwnerRole===ROLE_KA_IPSRS)return false;

  if(session.role===ROLE_ADMINISTRASI){
    if(String(session.staff_id)===String(reportOwnerStaffId))return true;
    if(getAccessSetting_(ACCESS_SETTING_ADMINISTRASI_EDIT,ACCESS_INACTIVE)===ACCESS_ACTIVE)return true;
    return hasActiveEditPermission_(session.staff_id,reportOwnerStaffId);
  }

  if(String(session.staff_id)===String(reportOwnerStaffId))return true;
  return hasActiveEditPermission_(session.staff_id,reportOwnerStaffId);
}

function canEditReportById_(session, reportId){
  const owner = getReportOwner_(reportId);
  if(!owner) return false;
  return canEditReport_(session,owner.staff_id,owner.role);
}

function setEditPermission_(session, granteeStaffId, targetStaffId, active){
  if(!session || session.role !== ROLE_KA_IPSRS) return {ok:false,msg:'Hanya KA IPSRS yang dapat mengatur izin edit.'};
  granteeStaffId = String(granteeStaffId || '').trim();
  targetStaffId = String(targetStaffId || '').trim();
  if(!granteeStaffId || !targetStaffId) return {ok:false,msg:'Grantee dan target wajib diisi.'};
  if(granteeStaffId === targetStaffId) return {ok:false,msg:'Izin khusus tidak diperlukan untuk laporan sendiri.'};
  const target = getStaffById_(targetStaffId);
  if(target && String(target.role || '') === ROLE_KA_IPSRS) return {ok:false,msg:'Laporan KA IPSRS tidak dapat diberikan izin edit.'};

  ensureAccessSheets_();
  const sh = getSS().getSheetByName(SHEET_EDIT_PERMISSIONS);
  const rows = sh.getDataRange().getValues();
  const status = active ? ACCESS_ACTIVE : ACCESS_INACTIVE;
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][0] || '') === granteeStaffId && String(rows[i][2] || '') === targetStaffId){
      sh.getRange(i+1,5,1,3).setValues([[status,new Date(),session.staff_id || '']]);
      return {ok:true,msg:'Izin edit berhasil diperbarui.',status:status};
    }
  }
  const grantee = getStaffById_(granteeStaffId);
  sh.appendRow([granteeStaffId,grantee ? grantee.nama : '',targetStaffId,target ? target.nama : '',status,new Date(),session.staff_id || '']);
  return {ok:true,msg:'Izin edit berhasil dibuat.',status:status};
}

function listEditPermissions_(session){
  if(!session || session.role !== ROLE_KA_IPSRS) return {ok:false,msg:'Akses ditolak.'};
  ensureAccessSheets_();
  const sh = getSS().getSheetByName(SHEET_EDIT_PERMISSIONS);
  const rows = sh.getDataRange().getValues();
  const out=[];
  for(let i=1;i<rows.length;i++){
    if(!rows[i][0] && !rows[i][2]) continue;
    out.push({grantee_staff_id:String(rows[i][0]||''),grantee_name:String(rows[i][1]||''),target_staff_id:String(rows[i][2]||''),target_name:String(rows[i][3]||''),status:String(rows[i][4]||''),created_at:rows[i][5]||'',created_by_staff_id:String(rows[i][6]||'')});
  }
  return {ok:true,permissions:out};
}

function getAccessSettingsForSession_(session){
  if(!session) return {ok:false,msg:'Akses ditolak.'};
  ensureAccessSheets_();
  return {ok:true,settings:{LAPORAN_TIM:getAccessSetting_(ACCESS_SETTING_LAPORAN_TIM,ACCESS_ACTIVE),ADMINISTRASI_EDIT:getAccessSetting_(ACCESS_SETTING_ADMINISTRASI_EDIT,ACCESS_INACTIVE)}};
}
