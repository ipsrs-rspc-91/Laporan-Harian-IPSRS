/**
 * Authorization.gs
 * Aturan akses terpusat untuk laporan IPSRS.
 */
const ACCESS_SETTING_LAPORAN_TIM = 'LAPORAN_TIM';
const ACCESS_SETTING_ADMINISTRASI_EDIT = 'ADMINISTRASI_EDIT';
const ACCESS_ACTIVE = 'AKTIF';
const ACCESS_INACTIVE = 'NONAKTIF';
const SHEET_ACCESS_SETTINGS = 'ACCESS_SETTINGS';
const SHEET_EDIT_PERMISSIONS = 'EDIT_PERMISSIONS';
const ACCESS_HEADERS = {
  ACCESS_SETTINGS: ['key','value','updated_at','updated_by_staff_id','updated_by_name'],
  EDIT_PERMISSIONS: ['permission_id','granted_to_staff_id','granted_to_staff_name','target_staff_id','target_staff_name','is_active','granted_by_staff_id','granted_by_name','created_at','updated_at']
};
function ensureAccessSheets_(){var ss=getSpreadsheet(),sh=ss.getSheetByName(SHEET_ACCESS_SETTINGS);if(!sh){sh=ss.insertSheet(SHEET_ACCESS_SETTINGS);sh.getRange(1,1,1,ACCESS_HEADERS.ACCESS_SETTINGS.length).setValues([ACCESS_HEADERS.ACCESS_SETTINGS]);sh.appendRow([ACCESS_SETTING_LAPORAN_TIM,ACCESS_ACTIVE,nowIso(),'SYSTEM','SYSTEM']);sh.appendRow([ACCESS_SETTING_ADMINISTRASI_EDIT,ACCESS_INACTIVE,nowIso(),'SYSTEM','SYSTEM']);}var ep=ss.getSheetByName(SHEET_EDIT_PERMISSIONS);if(!ep){ep=ss.insertSheet(SHEET_EDIT_PERMISSIONS);ep.getRange(1,1,1,ACCESS_HEADERS.EDIT_PERMISSIONS.length).setValues([ACCESS_HEADERS.EDIT_PERMISSIONS]);}return {settings:sh,permissions:ep};}
function getAccessSetting_(key,defaultValue){var sheets=ensureAccessSheets_(),rows=sheets.settings.getDataRange().getValues();for(var i=1;i<rows.length;i++)if(String(rows[i][0])===String(key))return String(rows[i][1]||defaultValue);sheets.settings.appendRow([key,defaultValue,nowIso(),'SYSTEM','SYSTEM']);return defaultValue;}
function setAccessSetting_(session,key,value){if(!session||session.role!==ROLE_KA_IPSRS)return {ok:false,msg:'Hanya KA IPSRS yang dapat mengubah pengaturan hak akses.'};if([ACCESS_SETTING_LAPORAN_TIM,ACCESS_SETTING_ADMINISTRASI_EDIT].indexOf(String(key))<0)return {ok:false,msg:'Pengaturan tidak dikenal.'};value=String(value||'').toUpperCase();if(value!==ACCESS_ACTIVE&&value!==ACCESS_INACTIVE)return {ok:false,msg:'Nilai pengaturan harus AKTIF atau NONAKTIF.'};var sheets=ensureAccessSheets_(),rows=sheets.settings.getDataRange().getValues();for(var i=1;i<rows.length;i++){if(String(rows[i][0])===String(key)){sheets.settings.getRange(i+1,2,1,4).setValues([[value,nowIso(),session.staff_id,session.nama]]);return {ok:true,key:key,value:value};}}sheets.settings.appendRow([key,value,nowIso(),session.staff_id,session.nama]);return {ok:true,key:key,value:value};}
function canViewReport_(session,reportOwnerStaffId){if(!session)return false;if(session.role===ROLE_KA_IPSRS)return true;if(String(session.staff_id)===String(reportOwnerStaffId))return true;return getAccessSetting_(ACCESS_SETTING_LAPORAN_TIM,ACCESS_ACTIVE)===ACCESS_ACTIVE;}
function canEditReport_(session,reportOwnerStaffId,reportOwnerRole){
  if(!session)return false;
  if(session.role===ROLE_KA_IPSRS)return true;
  if(reportOwnerRole===ROLE_KA_IPSRS)return false;

  // Administrasi selalu dapat mengedit laporannya sendiri.
  // Jika izin edit global Administrasi aktif, Administrasi dapat mengedit
  // laporan seluruh tim (kecuali laporan KA IPSRS). Di luar itu, izin khusus
  // yang diberikan KA IPSRS tetap dapat membuka akses edit untuk target tertentu.
  if(session.role===ROLE_ADMINISTRASI){
    if(String(session.staff_id)===String(reportOwnerStaffId))return true;
    if(getAccessSetting_(ACCESS_SETTING_ADMINISTRASI_EDIT,ACCESS_INACTIVE)===ACCESS_ACTIVE)return true;
    return hasActiveEditPermission_(session.staff_id,reportOwnerStaffId);
  }

  // Role lain dapat mengedit laporan sendiri. Untuk laporan orang lain,
  // hanya dapat diedit jika KA IPSRS memberikan izin khusus yang aktif.
  if(String(session.staff_id)===String(reportOwnerStaffId))return true;
  return hasActiveEditPermission_(session.staff_id,reportOwnerStaffId);
}
function getReportOwner_(reportId){var sh=getSheet(SHEET_REPORTS),rows=sh.getDataRange().getValues(),headers=rows[0]||[],idIdx=headers.indexOf('report_id'),staffIdx=headers.indexOf('staff_id'),roleIdx=headers.indexOf('role_snapshot');for(var i=1;i<rows.length;i++)if(String(rows[i][idIdx])===String(reportId))return {staff_id:rows[i][staffIdx],role:rows[i][roleIdx]};return null;}
function canEditReportById_(session,reportId){var owner=getReportOwner_(reportId);if(!owner)return {ok:false,msg:'Laporan tidak ditemukan.'};return {ok:canEditReport_(session,owner.staff_id,owner.role),owner:owner};}
function hasActiveEditPermission_(grantedToStaffId,targetStaffId){var rows=ensureAccessSheets_().permissions.getDataRange().getValues();for(var i=1;i<rows.length;i++)if(String(rows[i][1])===String(grantedToStaffId)&&String(rows[i][3])===String(targetStaffId)&&String(rows[i][5]).toUpperCase()===ACCESS_ACTIVE)return true;return false;}
function listEditPermissions_(session){if(!session||session.role!==ROLE_KA_IPSRS)return {ok:false,msg:'Hanya KA IPSRS yang dapat mengelola izin edit khusus.'};var rows=ensureAccessSheets_().permissions.getDataRange().getValues(),out=[];for(var i=1;i<rows.length;i++)out.push({permission_id:rows[i][0],granted_to_staff_id:rows[i][1],granted_to_staff_name:rows[i][2],target_staff_id:rows[i][3],target_staff_name:rows[i][4],is_active:rows[i][5],granted_by_staff_id:rows[i][6],granted_by_name:rows[i][7],created_at:rows[i][8],updated_at:rows[i][9]});return {ok:true,data:out};}
function setEditPermission_(session,grantedToStaffId,targetStaffId,isActive){if(!session||session.role!==ROLE_KA_IPSRS)return {ok:false,msg:'Hanya KA IPSRS yang dapat memberi atau mencabut izin edit.'};if(!grantedToStaffId||!targetStaffId)return {ok:false,msg:'User pemberi izin dan target laporan wajib diisi.'};if(String(grantedToStaffId)===String(targetStaffId))return {ok:false,msg:'Izin khusus tidak diperlukan untuk mengedit laporan sendiri.'};var staffRows=getSheet(SHEET_STAFF).getDataRange().getValues(),headers=staffRows[0]||[],idIdx=headers.indexOf('staff_id'),nameIdx=headers.indexOf('nama'),roleIdx=headers.indexOf('role'),grantedName='',targetName='',targetRole='';for(var i=1;i<staffRows.length;i++){if(String(staffRows[i][idIdx])===String(grantedToStaffId))grantedName=staffRows[i][nameIdx]||'';if(String(staffRows[i][idIdx])===String(targetStaffId)){targetName=staffRows[i][nameIdx]||'';targetRole=staffRows[i][roleIdx]||'';}}if(!grantedName||!targetName)return {ok:false,msg:'User pemberi izin atau target laporan tidak ditemukan.'};if(targetRole===ROLE_KA_IPSRS)return {ok:false,msg:'Laporan KA IPSRS tidak dapat diberikan izin edit kepada user lain.'};var sh=ensureAccessSheets_().permissions,data=sh.getDataRange().getValues(),active=isActive===true||String(isActive).toUpperCase()===ACCESS_ACTIVE;for(var j=1;j<data.length;j++){if(String(data[j][1])===String(grantedToStaffId)&&String(data[j][3])===String(targetStaffId)){sh.getRange(j+1,6,1,5).setValues([[active?ACCESS_ACTIVE:ACCESS_INACTIVE,session.staff_id,session.nama,data[j][8]||nowIso(),nowIso()]]);return {ok:true,permission_id:data[j][0],is_active:active?ACCESS_ACTIVE:ACCESS_INACTIVE};}}var id='PERM-'+Utilities.getUuid().split('-')[0];sh.appendRow([id,grantedToStaffId,grantedName,targetStaffId,targetName,active?ACCESS_ACTIVE:ACCESS_INACTIVE,session.staff_id,session.nama,nowIso(),nowIso()]);return {ok:true,permission_id:id,is_active:active?ACCESS_ACTIVE:ACCESS_INACTIVE};}
function getAccessControl_(session){if(!session)return {ok:false,msg:'Sesi tidak valid, silakan login kembali.'};return {ok:true,laporan_tim:getAccessSetting_(ACCESS_SETTING_LAPORAN_TIM,ACCESS_ACTIVE),administrasi_edit:getAccessSetting_(ACCESS_SETTING_ADMINISTRASI_EDIT,ACCESS_INACTIVE),can_manage:session.role===ROLE_KA_IPSRS};}
