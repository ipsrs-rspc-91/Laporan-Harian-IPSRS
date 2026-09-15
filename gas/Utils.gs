/**
 * Utils.gs
 * Fungsi bantu umum: akses spreadsheet, konversi objek <-> baris, output JSON,
 * dan helper untuk menyusun halaman HTML dari beberapa file terpisah.
 */

let _SS_CACHE_ = null;
let _SHEET_CACHE_ = {};

function getSS() {
  if (!_SS_CACHE_) {
    _SS_CACHE_ = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  }
  return _SS_CACHE_;
}

function getSheet(name) {
  if (_SHEET_CACHE_[name]) return _SHEET_CACHE_[name];
  const ss = getSS();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = HEADERS[name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      applyPlainTextColumns_(sheet, headers);
    }
  }
  _SHEET_CACHE_[name] = sheet;
  return sheet;
}

function applyPlainTextColumns_(sheet, headers) {
  const plainTextCols = ['tanggal', 'pukul', 'waktu_mulai', 'waktu_selesai'];
  const rowCount = Math.max(sheet.getLastRow() + 500, 1000);
  plainTextCols.forEach(function (col) {
    const idx = headers.indexOf(col);
    if (idx > -1) sheet.getRange(1, idx + 1, rowCount, 1).setNumberFormat('@');
  });
}

function normalizeTanggal_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Jakarta', 'yyyy-MM-dd');
  return (value || '').toString();
}

function setupDatabase() {
  Object.keys(HEADERS).forEach(function (name) { getSheet(name); });
  ensureHeaders();
  PropertiesService.getScriptProperties().setProperty('DB_INITIALIZED', 'true');
}

function ensureHeaders() {
  Object.keys(HEADERS).forEach(function (name) {
    const sheet = getSheet(name);
    const wanted = HEADERS[name];
    const lastCol = sheet.getLastColumn();
    const current = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    const missing = wanted.filter(function (h) { return current.indexOf(h) === -1; });
    if (missing.length > 0) {
      sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    }
    const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    applyPlainTextColumns_(sheet, actualHeaders);
  });
}

function rowToObj(headers, rowArr) {
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = rowArr[i]; });
  return obj;
}

function objToRow(headers, obj) {
  return headers.map(function (h) {
    return (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '';
  });
}

function appendRowSafe(sheet, obj) {
  const lastCol = sheet.getLastColumn();
  const actualHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  sheet.appendRow(objToRow(actualHeaders, obj));
}

function nowIso() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss");
}

function logAudit(username, staffId, action, reportId, keterangan, extra) {
  try {
    extra = extra || {};
    const sheet = getSheet(SHEET_AUDIT);
    appendRowSafe(sheet, {
      timestamp: nowIso(), username: username || '', staff_id: staffId || '',
      action: action || '', report_id: reportId || '', keterangan: keterangan || '',
      field_changed: extra.field_changed || '', old_value: extra.old_value || '',
      new_value: extra.new_value || '',
      version_before: (extra.version_before !== undefined && extra.version_before !== null) ? extra.version_before : '',
      version_after: (extra.version_after !== undefined && extra.version_after !== null) ? extra.version_after : ''
    });
  } catch (e) {
    Logger.log('logAudit GAGAL (' + action + ', report_id=' + reportId + '): ' + e.message);
  }
}

function getAuditLogForReport(reportId) {
  const sheet = getSheet(SHEET_AUDIT);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return { ok: true, data: [] };
  const headers = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rowToObj(headers, rows[i]);
    if (reportId && r.report_id !== reportId) continue;
    out.push(r);
  }
  out.sort(function (a, b) { return a.timestamp < b.timestamp ? 1 : -1; });
  return { ok: true, data: out };
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
