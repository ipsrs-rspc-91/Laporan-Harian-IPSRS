const SPREADSHEET_ID = '';

const SHEET_USERS='USERS', SHEET_STAFF='STAFF', SHEET_REPORTS='REPORTS', SHEET_SESSIONS='SESSIONS', SHEET_AUDIT='AUDIT_LOG', SHEET_HISTORY='REPORT_HISTORY', SHEET_MIGRATION_ERROR='MIGRATION_ERROR';
const SHEET_KATEGORI_CUSTOM='KATEGORI_CUSTOM', SHEET_AREA_KERJA_CUSTOM='AREA_KERJA_CUSTOM', SHEET_ITEM_CUSTOM='ITEM_CUSTOM';
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const ROLE_KA_IPSRS='KA_IPSRS', ROLE_ADMINISTRASI='ADMINISTRASI', ROLE_KASIE='KASIE', ROLE_STAF='STAF', ROLE_PETUGAS_SHIFT='PETUGAS_SHIFT';
const BIDANG_LIST=['ME','Sipil','Workshop','Elektromedik','Kesling','Shift'];
const ROLE_LABELS={KA_IPSRS:'KA IPSRS',ADMINISTRASI:'Administrasi IPSRS',KASIE:'Kasie',STAF:'Staf',PETUGAS_SHIFT:'Petugas Shift'};
const HEADERS={
USERS:['user_id','username','password_hash','password_salt','staff_id','role','status','created_at','updated_at'],
STAFF:['staff_id','nama','role','bidang','status','created_at','updated_at','jabatan'],
REPORTS:['report_id','staff_id','nama_snapshot','bidang_snapshot','role_snapshot','tanggal','pelapor','pukul','nolk','ruang','masalah_kegiatan','tindakan','status','keterangan','kategori','area_kerja','item','spare_part_unit','type','jumlah','jadwal_kerja','rencana_kegiatan','target_pekerjaan','realisasi_pekerjaan','hasil_pencapaian','status_pencapaian','kendala','tindak_lanjut','waktu_mulai','waktu_selesai','created_at','updated_at','created_by_username','created_by_staff_id','created_by_name','created_by_role','updated_by_staff_id','updated_by_name','updated_by_role','version'],
SESSIONS:['token','username','staff_id','role','bidang','nama','created_at','expires_at'],
AUDIT_LOG:['timestamp','username','staff_id','action','report_id','keterangan','field_changed','old_value','new_value','version_before','version_after'],
REPORT_HISTORY:['history_id','report_id','edited_at','edited_by_username','edited_by_staff_id','data_before_json','data_after_json'],
MIGRATION_ERROR:['report_id','nama_asli','alasan','tanggal_migrasi'],
KATEGORI_CUSTOM:['nama','created_at','created_by_staff_id','created_by_name'],
AREA_KERJA_CUSTOM:['nama','created_at','created_by_staff_id','created_by_name'],
ITEM_CUSTOM:['area','nama','created_at','created_by_staff_id','created_by_name']};
const STATUS_PENCAPAIAN_LIST=['Selesai','Sebagian','Belum Selesai','Ditunda','Tindak Lanjut'];
const STATUS_SDM_LIST=['Aktif','Calon','Nonaktif'];
const CALON_STAFF_SEED=[
{staff_id:'KASIE-SIPIL',nama:'Calon 1 SDM IPSRS',jabatan:'Kasie. Sipil',role:'KASIE',bidang:'Sipil',status:'Nonaktif'},
{staff_id:'KASIE-WORKSHOP',nama:'Calon 2 SDM IPSRS',jabatan:'Kasie. Workshop',role:'KASIE',bidang:'Workshop',status:'Nonaktif'},
{staff_id:'STAF-ME-02',nama:'Calon 3 SDM IPSRS',jabatan:'Staf ME',role:'STAF',bidang:'ME',status:'Nonaktif'},
{staff_id:'STAF-ME-03',nama:'Calon 4 SDM IPSRS',jabatan:'Staf ME',role:'STAF',bidang:'ME',status:'Nonaktif'},
{staff_id:'STAF-SIPIL-03',nama:'Calon 5 SDM IPSRS',jabatan:'Staf Sipil',role:'STAF',bidang:'Sipil',status:'Nonaktif'},
{staff_id:'STAF-SIPIL-04',nama:'Calon 6 SDM IPSRS',jabatan:'Staf Sipil',role:'STAF',bidang:'Sipil',status:'Nonaktif'},
{staff_id:'STAF-SIPIL-05',nama:'Calon 7 SDM IPSRS',jabatan:'Staf Sipil',role:'STAF',bidang:'Sipil',status:'Nonaktif'},
{staff_id:'STAF-WORKSHOP-04',nama:'Calon 8 SDM IPSRS',jabatan:'Staf Workshop',role:'STAF',bidang:'Workshop',status:'Nonaktif'},
{staff_id:'STAF-WORKSHOP-05',nama:'Calon 9 SDM IPSRS',jabatan:'Staf Workshop',role:'STAF',bidang:'Workshop',status:'Nonaktif'},
{staff_id:'STAF-ELEKTROMEDIK-02',nama:'Calon 10 SDM IPSRS',jabatan:'Staf Elektromedik',role:'STAF',bidang:'Elektromedik',status:'Nonaktif'},
{staff_id:'STAF-ELEKTROMEDIK-03',nama:'Calon 11 SDM IPSRS',jabatan:'Staf Elektromedik',role:'STAF',bidang:'Elektromedik',status:'Nonaktif'},
{staff_id:'STAF-KESLING-02',nama:'Calon 12 SDM IPSRS',jabatan:'Staf KesLing',role:'STAF',bidang:'KesLing',status:'Nonaktif'},
{staff_id:'STAF-KESLING-03',nama:'Calon 13 SDM IPSRS',jabatan:'Staf KesLing',role:'STAF',bidang:'KesLing',status:'Nonaktif'},
{staff_id:'STAF-PENDAMPING-03',nama:'Calon 14 SDM IPSRS',jabatan:'Staf Pendamping',role:'STAF',bidang:'Helper',status:'Nonaktif'},
{staff_id:'STAF-PENDAMPING-04',nama:'Calon 15 SDM IPSRS',jabatan:'Staf Pendamping',role:'STAF',bidang:'Helper',status:'Nonaktif'},
{staff_id:'STAF-PENDAMPING-05',nama:'Calon 16 SDM IPSRS',jabatan:'Staf Pendamping',role:'STAF',bidang:'Helper',status:'Nonaktif'},
{staff_id:'STAF-PENDAMPING-06',nama:'Calon 17 SDM IPSRS',jabatan:'Staf Pendamping',role:'STAF',bidang:'Helper',status:'Nonaktif'}
];
const LIBUR_TANGGAL=[];
const MASTER_STAFF_SEED=[
{staff_id:'KAIPSRS',nama:'Herry Hidayat',jabatan:'Ka. IPSRS',role:'KA_IPSRS',bidang:'Semua',status:'Aktif'},
{staff_id:'ADM01',nama:'Riko Ferdyan',jabatan:'Administrasi',role:'ADMINISTRASI',bidang:'Semua',status:'Aktif'},
{staff_id:'KASIE-ME',nama:'Pantiarso',jabatan:'Kasie. ME-Workshop',role:'KASIE',bidang:'ME',status:'Aktif'},
{staff_id:'KASIE-ELEKTROMEDIK',nama:'Agung Prayitno',jabatan:'Kasie. Elektromedik',role:'KASIE',bidang:'Elektromedik',status:'Aktif'},
{staff_id:'KASIE-KESLING',nama:'Rusdi',jabatan:'Kasie KesLing',role:'KASIE',bidang:'Kesling',status:'Aktif'},
{staff_id:'STAF-ME-01',nama:'Sulaiman',jabatan:'Staf ME',role:'STAF',bidang:'ME',status:'Aktif'},
{staff_id:'STAF-SIPIL-01',nama:'Suryadih',jabatan:'Staf Sipil',role:'STAF',bidang:'Sipil',status:'Aktif'},
{staff_id:'STAF-SIPIL-02',nama:'Muhammad Sobur',jabatan:'Staf Sipil',role:'STAF',bidang:'Sipil',status:'Aktif'},
{staff_id:'STAF-WORKSHOP-01',nama:'Abdul Rohim',jabatan:'Staf Workshop',role:'STAF',bidang:'Workshop',status:'Aktif'},
{staff_id:'STAF-WORKSHOP-02',nama:'Heri Septiawan',jabatan:'Staf Workshop',role:'STAF',bidang:'Workshop',status:'Aktif'},
{staff_id:'STAF-WORKSHOP-03',nama:'Suryanto',jabatan:'Staf Workshop',role:'STAF',bidang:'Workshop',status:'Aktif'},
{staff_id:'STAF-ELEKTROMEDIK-01',nama:'Teguh Iman Wahyudi',jabatan:'Staf Elektromedik',role:'STAF',bidang:'Elektromedik',status:'Aktif'},
{staff_id:'STAF-KESLING-01',nama:'Muhammad Raihan Rasyid',jabatan:'Staf KesLing',role:'STAF',bidang:'Kesling',status:'Aktif'},
{staff_id:'SHIFT-01',nama:'Rahmat Kartolo',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-02',nama:'Kabul Wardoyo',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-03',nama:'Setu',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-04',nama:'Samsuri',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-05',nama:'Sunandar',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-06',nama:'Surono',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-07',nama:'Wawan Marwan',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'SHIFT-08',nama:'Selo Setiyawan',jabatan:'Petugas Shift',role:'PETUGAS_SHIFT',bidang:'Shift',status:'Aktif'},
{staff_id:'STAF-PENDAMPING-01',nama:'Mardiyono',jabatan:'Staf Pendamping',role:'STAF',bidang:'Helper',status:'Aktif'},
{staff_id:'STAF-PENDAMPING-02',nama:'Yosep Kurniawan Galang Narpathie',jabatan:'Staf Pendamping',role:'STAF',bidang:'Helper',status:'Aktif'}
];
const REPORT_EDITABLE_FIELD_MAP={tanggal:'Tanggal',pelapor:'Pelapor',pukul:'Pukul',nolk:'NoLK',ruang:'Ruang',masalah_kegiatan:'MasalahKegiatan',tindakan:'Tindakan',status:'Status',keterangan:'Keterangan',kategori:'Kategori',area_kerja:'AreaKerja',item:'Item',spare_part_unit:'SparePartUnit',type:'Type',jumlah:'Jumlah',jadwal_kerja:'JadwalKerja',rencana_kegiatan:'RencanaKegiatan',target_pekerjaan:'TargetPekerjaan',realisasi_pekerjaan:'RealisasiPekerjaan',hasil_pencapaian:'HasilPencapaian',status_pencapaian:'StatusPencapaian',kendala:'Kendala',tindak_lanjut:'TindakLanjut',waktu_mulai:'WaktuMulai',waktu_selesai:'WaktuSelesai'};
