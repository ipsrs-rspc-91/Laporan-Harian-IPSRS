/**
 * Utils.gs
 * Fungsi bantu umum: akses spreadsheet, konversi objek <-> baris, output JSON,
 * dan helper untuk menyusun halaman HTML dari beberapa file terpisah.
 */

function getSS() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Ambil sheet berdasarkan nama. Jika belum ada, buat otomatis beserta header-nya
 * sesuai definisi di HEADERS (Config.gs). Ini membuat setup database "self-healing"
 * tanpa menghapus data yang sudah ada.
 */
function getSheet(name) {
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
  return sheet;
}

/**
 * Paksa kolom-kolom yang isinya teks "mirip tanggal/waktu" (tanggal, pukul,
 * waktu_mulai, waktu_selesai) supaya format selnya SELALU Plain Text ('@'),
 * bukan "Automatic". TANPA INI, Google Sheets bisa otomatis mengonversi teks
 * seperti "2026-09-12" menjadi objek Date internal begitu ditulis -- dan kalau
 * itu terjadi, SEMUA filter bulan/tanggal di aplikasi ini (yang membandingkan
 * `tanggal` sebagai string, mis. .indexOf(bulan)) akan rusak total karena
 * Date.toString() tidak lagi mengandung "YYYY-MM". Dipanggil sekali saat sheet
 * baru dibuat, dan juga dari ensureHeaders() supaya sheet yang sudah ada (dibuat
 * sebelum perbaikan ini) ikut diperbaiki formatnya tanpa menyentuh datanya.
 */
function applyPlainTextColumns_(sheet, headers) {
  const plainTextCols = ['tanggal', 'pukul', 'waktu_mulai', 'waktu_selesai'];
  // Selalu cakup baris yang sudah ada + buffer untuk pertumbuhan data ke depan
  // (dipanggil ulang tiap ensureHeaders()/doGet(), jadi buffer ini terus "mengejar"
  // seiring sheet bertambah baris -- bukan sekali pasang lalu berhenti di baris ke-1000).
  const rowCount = Math.max(sheet.getLastRow() + 500, 1000);
  plainTextCols.forEach(function (col) {
    const idx = headers.indexOf(col);
    if (idx > -1) {
      sheet.getRange(1, idx + 1, rowCount, 1).setNumberFormat('@');
    }
  });
}

/**
 * Jaga-jaga (defense in depth) kalau ADA baris lama yang isi kolom tanggalnya
 * SUDAH kadung berupa objek Date (misalnya karena pernah tertulis sebelum
 * applyPlainTextColumns_ diberlakukan). Selalu kembalikan string 'YYYY-MM-DD'
 * murni supaya perbandingan/filter string tetap benar, apa pun bentuk aslinya.
 */
function normalizeTanggal_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return (value || '').toString();
}

/**
 * Pastikan seluruh sheet database sudah ada. Aman dipanggil berkali-kali --
 * tidak pernah menghapus sheet/kolom/baris yang sudah ada. Dipanggil di setiap
 * doGet() (lihat Code.gs), makanya HARUS murah/cepat & 100% non-destruktif:
 * getSheet() hanya membuat sheet BILA belum ada, dan ensureHeaders() hanya
 * MENAMBAH kolom yang belum ada di ujung kanan (data lama tidak tersentuh).
 */
function setupDatabase() {
  Object.keys(HEADERS).forEach(function (name) { getSheet(name); });
  ensureHeaders();
  PropertiesService.getScriptProperties().setProperty('DB_INITIALIZED', 'true');
}

/**
 * Migrasi struktur AMAN: untuk setiap sheet di HEADERS, cek kolom mana yang
 * didefinisikan di Config.gs tapi belum ada di sheet sungguhan, lalu tambahkan
 * di kolom paling kanan. Header/kolom yang sudah ada TIDAK pernah diubah,
 * dipindah, atau dihapus -- baris data lama otomatis punya nilai kosong untuk
 * kolom baru tersebut, bukan error. Ini memenuhi kebutuhan "create if missing,
 * add missing headers, preserve existing data".
 */
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
    applyPlainTextColumns_(sheet, wanted);
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

/**
 * Waktu sekarang dalam format ISO-like TAPI zona WIB (Asia/Jakarta), BUKAN UTC.
 * PENTING: jangan ganti ini ke `new Date().toISOString()` -- itu bug: toISOString()
 * selalu UTC, sementara RS Puri Cinere di WIB (UTC+7), jadi created_at/updated_at/
 * edited_at/timestamp yang tampil ke user (mis. panel Riwayat Perubahan) akan
 * selisih -7 jam dari waktu asli. Nilai ini TIDAK pernah di-parse balik jadi
 * Date object untuk perhitungan (hanya disimpan/ditampilkan/diurutkan sebagai
 * teks), jadi aman memakai format lokal di sini. Untuk session expiry (Auth.gs),
 * TETAP pakai .toISOString() asli (UTC) karena itu memang dibandingkan lewat
 * Date.now() -- jangan disamakan dengan fungsi ini.
 */
function nowIso() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Catat satu baris audit. `extra` opsional untuk detail per-field (dipakai saat
 * update laporan): { field_changed, old_value, new_value, version_before, version_after }.
 * Parameter ini backward-compatible -- pemanggilan lama dengan 5 argumen tetap
 * berfungsi, kolom detailnya hanya akan kosong.
 */
function logAudit(username, staffId, action, reportId, keterangan, extra) {
  try {
    extra = extra || {};
    const sheet = getSheet(SHEET_AUDIT);
    sheet.appendRow([
      nowIso(), username || '', staffId || '', action || '', reportId || '', keterangan || '',
      extra.field_changed || '', extra.old_value || '', extra.new_value || '',
      (extra.version_before !== undefined && extra.version_before !== null) ? extra.version_before : '',
      (extra.version_after !== undefined && extra.version_after !== null) ? extra.version_after : ''
    ]);
  } catch (e) {
    // Jangan sampai kegagalan audit log menggagalkan proses utama.
  }
}

/**
 * Ambil baris AUDIT_LOG, opsional difilter per report_id. Dipakai oleh
 * apiGetAuditLog() -- akses dibatasi di Api.gs (hanya KA_IPSRS/ADMINISTRASI).
 */
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

/**
 * Menyisipkan isi file HTML lain ke dalam template (dipakai lewat
 * <?!= include('NamaFile'); ?> di file .html).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
