const SPREADSHEET_ID = '';

const SHEET_USERS='USERS', SHEET_STAFF='STAFF', SHEET_REPORTS='REPORTS', SHEET_SESSIONS='SESSIONS', SHEET_AUDIT='AUDIT_LOG', SHEET_HISTORY='REPORT_HISTORY', SHEET_MIGRATION_ERROR='MIGRATION_ERROR';
const SHEET_KATEGORI_CUSTOM='KATEGORI_CUSTOM', SHEET_AREA_KERJA_CUSTOM='AREA_KERJA_CUSTOM', SHEET_ITEM_CUSTOM='ITEM_CUSTOM';
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const ROLE_KA_IPSRS='KA_IPSRS', ROLE_ADMINISTRASI='ADMINISTRASI', ROLE_KASIE='KASIE', ROLE_STAF='STAF', ROLE_PETUGAS_SHIFT='PETUGAS_SHIFT';
const BIDANG_LIST=['ME','Sipil','Workshop','Elektromedik','Kesling'];
const SHIFT_LIST=['Pagi','Siang','Malam'];
const ROLE_LABELS={KA_IPSRS:'KA IPSRS',ADMINISTRASI:'Administrasi IPSRS',KASIE:'Kasie',STAF:'Staf',PETUGAS_SHIFT:'Petugas Shift'};
const HEADERS={
USERS:['user_id','username','password_hash','password_salt','staff_id','role','status','created_at','updated_at'],
STAFF:['staff_id','nama','role','bidang','status','created_at','updated_at','jabatan'],
REPORTS:['report_id','staff_id','nama_snapshot','bidang_snapshot','role_snapshot','shift_snapshot','tanggal','pelapor','pukul','nolk','ruang','masalah_kegiatan','tindakan','status','keterangan','kategori','area_kerja','item','spare_part_unit','type','jumlah','jadwal_kerja','rencana_kegiatan','target_pekerjaan','realisasi_pekerjaan','hasil_pencapaian','status_pencapaian','kendala','tindak_lanjut','waktu_mulai','waktu_selesai','created_at','updated_at','created_by_username','created_by_staff_id','created_by_name','created_by_role','updated_by_staff_id','updated_by_name','updated_by_role','version'],
SESSIONS:['token','username','staff_id','role','bidang','shift','nama','created_at','expires_at'],
AUDIT_LOG:['timestamp','username','staff_id','action','report_id','keterangan','field_changed','old_value','new_value','version_before','version_after'],
REPORT_HISTORY:['history_id','report_id','edited_at','edited_by_username','edited_by_staff_id','data_before_json','data_after_json'],
MIGRATION_ERROR:['report_id','nama_asli','alasan','tanggal_migrasi'],
KATEGORI_CUSTOM:['nama','created_at','created_by_staff_id','created_by_name'],
AREA_KERJA_CUSTOM:['nama','created_at','created_by_staff_id','created_by_name'],
ITEM_CUSTOM:['area','nama','created_at','created_by_staff_id','created_by_name']};
const STATUS_PENCAPAIAN_LIST=['Selesai','Sebagian','Belum Selesai','Ditunda','Tindak Lanjut'];
const STATUS_SDM_LIST=['Aktif','Calon','Nonaktif'];
const CALON_STAFF_SEED=[];
const LIBUR_TANGGAL=[];
const MASTER_STAFF_SEED=[];
const REPORT_EDITABLE_FIELD_MAP={tanggal:'Tanggal',pelapor:'Pelapor',pukul:'Pukul',nolk:'NoLK',ruang:'Ruang',masalah_kegiatan:'MasalahKegiatan',tindakan:'Tindakan',status:'Status',keterangan:'Keterangan',kategori:'Kategori',area_kerja:'AreaKerja',item:'Item',spare_part_unit:'SparePartUnit',type:'Type',jumlah:'Jumlah',jadwal_kerja:'JadwalKerja',rencana_kegiatan:'RencanaKegiatan',target_pekerjaan:'TargetPekerjaan',realisasi_pekerjaan:'RealisasiPekerjaan',hasil_pencapaian:'HasilPencapaian',status_pencapaian:'StatusPencapaian',kendala:'Kendala',tindak_lanjut:'TindakLanjut',waktu_mulai:'WaktuMulai',waktu_selesai:'WaktuSelesai'};
