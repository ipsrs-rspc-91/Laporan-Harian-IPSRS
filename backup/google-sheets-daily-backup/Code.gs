/**
 * IPSRS — daily Supabase-to-Google-Sheets snapshot backup.
 *
 * IMPORTANT:
 * - This creates a NEW spreadsheet for each calendar day in a private Drive folder.
 * - It does not write to Supabase and does not change the production app.
 * - Run only from a restricted Google Apps Script project owned by the responsible admin.
 * - Store secrets in Script Properties; never commit them to GitHub or put them in source.
 * - This is a secondary export, not a substitute for a database-native backup/restore plan.
 */

const CONFIG = {
  BACKUP_PREFIX: 'IPSRS_DB_BACKUP_',
  PAGE_SIZE: 500,
  TIMEZONE: 'Asia/Jakarta',
  META_SHEET: 'BACKUP_META',
  // All production base tables inspected on 2026-10-16.
  // Staff's last_login_device is intentionally excluded; auth_user_id is retained for
  // operational account mapping, so the resulting spreadsheet must remain restricted.
  TABLES: [
    { name: 'reports', order: 'report_id.asc', columns: ['report_id','staff_id','nama_snapshot','bidang_snapshot','role_snapshot','tanggal','pelapor','pukul','nolk','ruang','masalah_kegiatan','tindakan','status','keterangan','kategori','area_kerja','item','spare_part_unit','type','jumlah','jadwal_kerja','rencana_kegiatan','target_pekerjaan','realisasi_pekerjaan','hasil_pencapaian','status_pencapaian','kendala','tindak_lanjut','waktu_mulai','waktu_selesai','created_at','updated_at','created_by_username','created_by_staff_id','created_by_name','created_by_role','updated_by_staff_id','updated_by_name','updated_by_role','version','deleted_at','deleted_by_staff_id','deleted_by_name','delete_reason','spare_part_unit_kind','spare_part_unit_status','unit_status','unit_name','unit_type','unit_jumlah','spare_part_material_status','spare_part_material','spare_part_material_type','spare_part_material_jumlah'] },
    { name: 'staff', order: 'staff_id.asc', columns: ['staff_id','nama','jabatan','role','bidang','status','auth_user_id','created_at','updated_at','last_login_at','last_seen_at','lhi_manual_unblock_until'] },
    { name: 'master_data', order: 'id.asc', columns: ['id','data_type','parent_id','name','sort_order','is_active','created_at','updated_at','created_by','updated_by'] },
    { name: 'report_history', order: 'history_id.asc', columns: ['history_id','report_id','edited_at','edited_by_username','edited_by_staff_id','data_before_json','data_after_json'] },
    { name: 'audit_log', order: 'audit_id.asc', columns: ['audit_id','timestamp','username','staff_id','action','report_id','keterangan','field_changed','old_value','new_value','version_before','version_after'] },
    { name: 'access_settings', order: 'key.asc', columns: ['key','value','updated_at','updated_by_staff_id','updated_by_name'] },
    { name: 'edit_permissions', order: 'permission_id.asc', columns: ['permission_id','granted_to_staff_id','granted_to_staff_name','target_staff_id','target_staff_name','is_active','granted_by_staff_id','granted_by_name','created_at','updated_at'] },
    { name: 'migration_errors', order: 'id.asc', columns: ['id','report_id','nama_asli','alasan','tanggal_migrasi'] },
    { name: 'master_item_review_queue', order: 'review_id.asc', columns: ['review_id','master_data_id','item_name','area_name','submitted_by_staff_id','submitted_by_name','submitted_by_role','submitted_at','status','checked_by_staff_id','checked_by_name','checked_at','review_note','updated_at'] },
    { name: 'master_data_sipil_backup_20261010', order: 'id.asc', columns: ['id','data_type','parent_id','name','sort_order','is_active','created_at','updated_at','created_by','updated_by'] },
    { name: 'report_elektromedik_snapshot_20261012', order: 'report_id.asc', columns: ['report_id','staff_id','nama_snapshot','bidang_snapshot','role_snapshot','tanggal','pelapor','pukul','nolk','ruang','masalah_kegiatan','tindakan','status','keterangan','kategori','area_kerja','item','spare_part_unit','type','jumlah','jadwal_kerja','rencana_kegiatan','target_pekerjaan','realisasi_pekerjaan','hasil_pencapaian','status_pencapaian','kendala','tindak_lanjut','waktu_mulai','waktu_selesai','created_at','updated_at','created_by_username','created_by_staff_id','created_by_name','created_by_role','updated_by_staff_id','updated_by_name','updated_by_role','version','deleted_at','deleted_by_staff_id','deleted_by_name','delete_reason','spare_part_unit_kind','spare_part_unit_status','unit_status','unit_name','unit_type','unit_jumlah','spare_part_material_status','spare_part_material','spare_part_material_type','spare_part_material_jumlah'] },
    { name: 'report_reclass_snapshot_20261011', order: 'snapshot_at.asc,report_id.asc', columns: ['snapshot_at','report_id','staff_id','nama_snapshot','bidang_snapshot','role_snapshot','tanggal','pelapor','pukul','nolk','ruang','masalah_kegiatan','tindakan','status','keterangan','kategori','area_kerja','item','spare_part_unit','type','jumlah','jadwal_kerja','rencana_kegiatan','target_pekerjaan','realisasi_pekerjaan','hasil_pencapaian','status_pencapaian','kendala','tindak_lanjut','waktu_mulai','waktu_selesai','created_at','updated_at','created_by_username','created_by_staff_id','created_by_name','created_by_role','updated_by_staff_id','updated_by_name','updated_by_role','version','deleted_at','deleted_by_staff_id','deleted_by_name','delete_reason','spare_part_unit_kind','spare_part_unit_status','unit_status','unit_name','unit_type','unit_jumlah','spare_part_material_status','spare_part_material','spare_part_material_type','spare_part_material_jumlah'] }
  ]
};

/**
 * Run once manually to create today's backup. Safe to rerun: a completed backup
 * for today is left untouched; an incomplete one is rebuilt in the same file.
 */
function runDailyBackup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Backup lain sedang berjalan; coba lagi nanti.');
  let book = null;
  try {
    const props = PropertiesService.getScriptProperties();
    const baseUrl = requiredProperty_(props, 'SUPABASE_URL').replace(/\/+$/, '');
    const serviceKey = requiredProperty_(props, 'SUPABASE_SERVICE_ROLE_KEY');
    const folderId = requiredProperty_(props, 'BACKUP_FOLDER_ID');
    const folder = DriveApp.getFolderById(folderId);
    const day = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const fileName = CONFIG.BACKUP_PREFIX + day;
    book = getOrCreateBackupBook_(folder, fileName);
    const meta = getOrCreateMetaSheet_(book);
    if (isBackupComplete_(meta)) {
      console.log('Backup hari ini sudah lengkap; tidak ditimpa: ' + book.getUrl());
      return { status: 'SKIPPED_ALREADY_COMPLETE', url: book.getUrl() };
    }

    resetDataSheets_(book);
    writeMeta_(meta, {
      status: 'RUNNING',
      backup_date: day,
      started_at_utc: new Date().toISOString(),
      finished_at_utc: '',
      project_ref: baseUrl.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1] || 'configured-project',
      table_count_expected: CONFIG.TABLES.length,
      total_rows: 0,
      error: ''
    });

    let totalRows = 0;
    const results = [];
    for (const table of CONFIG.TABLES) {
      const sheet = getOrCreateSheet_(book, table.name);
      const rows = fetchAllRows_(baseUrl, serviceKey, table);
      writeRows_(sheet, table.columns, rows);
      totalRows += rows.length;
      results.push([table.name, rows.length, new Date().toISOString(), 'OK']);
      console.log('Backup ' + table.name + ': ' + rows.length + ' baris');
    }

    const summary = getOrCreateSheet_(book, 'TABLE_SUMMARY');
    summary.clearContents();
    summary.getRange(1, 1, 1, 4).setValues([['table_name','row_count','exported_at_utc','status']]);
    if (results.length) summary.getRange(2, 1, results.length, 4).setValues(results);
    summary.setFrozenRows(1);

    writeMeta_(meta, {
      status: 'COMPLETED',
      backup_date: day,
      started_at_utc: meta.getRange('B4').getDisplayValue() || '',
      finished_at_utc: new Date().toISOString(),
      project_ref: baseUrl.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1] || 'configured-project',
      table_count_expected: CONFIG.TABLES.length,
      total_rows: totalRows,
      error: ''
    });
    console.log('BACKUP COMPLETED: ' + book.getUrl() + ' | rows=' + totalRows);
    return { status: 'COMPLETED', totalRows: totalRows, url: book.getUrl() };
  } catch (err) {
    if (book) {
      try {
        const meta = getOrCreateMetaSheet_(book);
        writeMeta_(meta, {
          status: 'FAILED',
          backup_date: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'),
          finished_at_utc: new Date().toISOString(),
          error: String(err && err.message ? err.message : err).slice(0, 1000)
        });
      } catch (metaErr) {
        console.error('Gagal menulis status backup: ' + metaErr);
      }
    }
    console.error(err && err.stack ? err.stack : err);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** Run once after configuring Script Properties; creates one daily 02:00 trigger. */
function installDailyTrigger() {
  const handler = 'runDailyBackup';
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === handler)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(2).create();
  console.log('Trigger harian dibuat. Pastikan timezone project Apps Script = Asia/Jakarta.');
}

function fetchAllRows_(baseUrl, serviceKey, table) {
  const rows = [];
  const select = table.columns.join(',');
  for (let offset = 0; ; offset += CONFIG.PAGE_SIZE) {
    const url = baseUrl + '/rest/v1/' + encodeURIComponent(table.name) +
      '?select=' + encodeURIComponent(select) +
      '&order=' + encodeURIComponent(table.order);
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        Range: offset + '-' + (offset + CONFIG.PAGE_SIZE - 1),
        'Range-Unit': 'items',
        'Accept-Profile': 'public'
      },
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error('Supabase export gagal untuk tabel ' + table.name +
        ' (HTTP ' + status + '): ' + response.getContentText().slice(0, 500));
    }
    const page = JSON.parse(response.getContentText() || '[]');
    if (!Array.isArray(page)) throw new Error('Respons bukan array pada tabel ' + table.name);
    rows.push.apply(rows, page);
    if (page.length < CONFIG.PAGE_SIZE) break;
    if (offset > 1000000) throw new Error('Batas aman pagination terlampaui pada ' + table.name);
  }
  return rows;
}

function writeRows_(sheet, columns, rows) {
  const requiredRows = Math.max(1, rows.length + 1);
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < columns.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns.length - sheet.getMaxColumns());
  sheet.clearContents();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
  if (!rows.length) return;
  const values = rows.map(row => columns.map(col => safeCellValue_(row[col])));
  // Write in chunks to avoid large single Spreadsheet service requests.
  const chunkSize = 300;
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const range = sheet.getRange(i + 2, 1, chunk.length, columns.length);
    range.setNumberFormat('@');
    range.setValues(chunk);
  }
  sheet.autoResizeColumns(1, Math.min(columns.length, 12));
}

function safeCellValue_(value) {
  if (value === null || value === undefined) return '';
  let text = (typeof value === 'object') ? JSON.stringify(value) : String(value);
  // Prevent report text from being interpreted as a spreadsheet formula.
  if (/^[=+@]/.test(text) || /^-[=+@]/.test(text)) text = "'" + text;
  return text;
}

function getOrCreateBackupBook_(folder, name) {
  const files = folder.getFilesByName(name);
  if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());
  const book = SpreadsheetApp.create(name);
  DriveApp.getFileById(book.getId()).moveTo(folder);
  return book;
}

function getOrCreateMetaSheet_(book) {
  let sheet = book.getSheetByName(CONFIG.META_SHEET);
  if (!sheet) {
    sheet = book.getSheets()[0];
    sheet.setName(CONFIG.META_SHEET);
  }
  return sheet;
}

function getOrCreateSheet_(book, name) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  return sheet;
}

function resetDataSheets_(book) {
  for (const sheet of book.getSheets()) {
    if (sheet.getName() === CONFIG.META_SHEET) continue;
    if (book.getSheets().length > 1) book.deleteSheet(sheet);
  }
  const meta = getOrCreateMetaSheet_(book);
  meta.clearContents();
}

function isBackupComplete_(sheet) {
  return sheet.getRange('B2').getDisplayValue() === 'COMPLETED';
}

function writeMeta_(sheet, data) {
  const current = {};
  const old = sheet.getLastRow() >= 2 ? sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues() : [];
  old.forEach(row => { if (row[0]) current[String(row[0])] = row[1]; });
  const merged = Object.assign({}, current, data);
  const keys = [
    'status','backup_date','started_at_utc','finished_at_utc',
    'project_ref','table_count_expected','total_rows','error'
  ];
  sheet.clearContents();
  sheet.getRange(1, 1, keys.length, 2).setValues([['field','value']].concat(keys.map(k => [k, merged[k] === undefined ? '' : String(merged[k])])));
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function requiredProperty_(props, name) {
  const value = props.getProperty(name);
  if (!value || !value.trim()) throw new Error('Script Property belum diisi: ' + name);
  return value.trim();
}
