/**
 * Setup.gs
 *
 * Fungsi setup ADMINISTRATIF untuk sistem Laporan Harian IPSRS.
 *
 * CATATAN PENTING:
 * - Tidak menggunakan field shift.
 * - Tidak menggunakan Pagi/Siang/Malam.
 * - Tidak melakukan seed ulang STAFF/USERS yang sudah ada.
 * - Tidak menghapus data.
 * - Tidak mengubah data STAFF/USERS yang sudah ada.
 *
 * setupDatabase() tetap digunakan untuk memastikan sheet yang diperlukan
 * tersedia. Fungsi setupDatabase() berasal dari struktur setup sistem.
 */

function addNewStaffAccount(
  staffId,
  username,
  nama,
  role,
  bidang,
  initialPassword
) {
  setupDatabase();

  if (!staffId) { Logger.log('GAGAL: staff_id wajib diisi.'); return; }
  if (!username) { Logger.log('GAGAL: username wajib diisi.'); return; }
  if (!nama) { Logger.log('GAGAL: nama wajib diisi.'); return; }
  if (!role) { Logger.log('GAGAL: role wajib diisi.'); return; }
  if (!initialPassword) { Logger.log('GAGAL: password awal wajib diisi.'); return; }

  const existingUser = findUserByUsername(username);
  if (existingUser) {
    Logger.log('GAGAL: username "' + username + '" sudah dipakai. Tidak ada akun yang dibuat.');
    return;
  }

  const existingStaff = getStaffById(staffId);
  if (existingStaff) {
    Logger.log('GAGAL: staff_id "' + staffId + '" sudah dipakai. Tidak ada akun yang dibuat.');
    return;
  }

  const now = nowIso();
  const staffSheet = getSheet(SHEET_STAFF);

  appendRowSafe(staffSheet, {
    staff_id: staffId,
    nama: nama,
    jabatan: ROLE_LABELS[role] || role,
    role: role,
    bidang: bidang || '',
    status: 'Aktif',
    created_at: now,
    updated_at: now
  });

  const usersSheet = getSheet(SHEET_USERS);
  const salt = randomSalt();

  appendRowSafe(usersSheet, {
    user_id: Utilities.getUuid(),
    username: username,
    password_hash: hashPassword(initialPassword, salt),
    password_salt: salt,
    staff_id: staffId,
    role: role,
    status: 'Aktif',
    created_at: now,
    updated_at: now
  });

  Logger.log(
    'Akun baru berhasil dibuat: ' + username + ' / ' + initialPassword +
    ' (staff_id=' + staffId + ', role=' + role + ', bidang=' + (bidang || '') + ')'
  );
}

function checkDatabaseStructure() {
  setupDatabase();

  const requiredSheets = [
    SHEET_USERS,
    SHEET_STAFF,
    SHEET_REPORTS,
    SHEET_SESSIONS,
    SHEET_HISTORY,
    SHEET_AUDIT
  ];

  const result = [];

  requiredSheets.forEach(function(sheetName) {
    try {
      const sheet = getSheet(sheetName);
      result.push(sheetName + ': OK (' + sheet.getLastRow() + ' baris)');
    } catch (e) {
      result.push(sheetName + ': ERROR - ' + e.message);
    }
  });

  Logger.log('=== PEMERIKSAAN DATABASE IPSRS ===\n' + result.join('\n'));
  return result;
}

function verifyStaffStructure() {
  const sheet = getSheet(SHEET_STAFF);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(v) {
    return String(v).trim();
  });

  const requiredHeaders = [
    'staff_id', 'nama', 'jabatan', 'role', 'bidang',
    'status', 'created_at', 'updated_at'
  ];

  const missing = [];
  requiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) missing.push(header);
  });

  const hasShift = headers.indexOf('shift') !== -1;
  const message = [];
  message.push('=== VERIFIKASI STAFF ===');
  message.push('Jumlah kolom: ' + headers.length);
  message.push('Header: ' + headers.join(' | '));

  if (missing.length > 0) {
    message.push('HEADER KURANG: ' + missing.join(', '));
  } else {
    message.push('Semua header STAFF yang diperlukan: OK');
  }

  if (hasShift) {
    message.push('PERINGATAN: kolom "shift" masih ada di STAFF.');
  } else {
    message.push('Kolom "shift": TIDAK ADA');
  }

  Logger.log(message.join('\n'));

  return {
    ok: missing.length === 0 && !hasShift,
    headers: headers,
    missing: missing,
    hasShift: hasShift
  };
}

function verifyReportsStructure() {
  const sheet = getSheet(SHEET_REPORTS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(v) {
    return String(v).trim();
  });

  const requiredHeaders = [
    'report_id', 'staff_id', 'nama_snapshot', 'bidang_snapshot', 'role_snapshot',
    'tanggal', 'pelapor', 'pukul', 'nolk', 'ruang', 'masalah_kegiatan', 'tindakan',
    'status', 'keterangan', 'kategori', 'area_kerja', 'item', 'spare_part_unit', 'type',
    'jumlah', 'jadwal_kerja', 'rencana_kegiatan', 'target_pekerjaan', 'realisasi_pekerjaan',
    'hasil_pencapaian', 'status_pencapaian', 'kendala', 'tindak_lanjut', 'waktu_mulai',
    'waktu_selesai', 'created_at', 'updated_at', 'created_by_username', 'created_by_staff_id',
    'created_by_name', 'created_by_role', 'updated_by_staff_id', 'updated_by_name',
    'updated_by_role', 'version'
  ];

  const missing = [];
  requiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) missing.push(header);
  });

  const hasShiftSnapshot = headers.indexOf('shift_snapshot') !== -1;
  const message = [];
  message.push('=== VERIFIKASI REPORTS ===');
  message.push('Jumlah kolom: ' + headers.length);

  if (missing.length > 0) {
    message.push('HEADER KURANG: ' + missing.join(', '));
  } else {
    message.push('Semua header REPORTS yang diperlukan: OK');
  }

  if (hasShiftSnapshot) {
    message.push('PERINGATAN: kolom "shift_snapshot" masih ada di REPORTS.');
  } else {
    message.push('Kolom "shift_snapshot": TIDAK ADA');
  }

  Logger.log(message.join('\n'));

  return {
    ok: missing.length === 0 && !hasShiftSnapshot,
    headers: headers,
    missing: missing,
    hasShiftSnapshot: hasShiftSnapshot
  };
}

function slugifyUsername_(nama) {
  return nama.toString().trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * CATATAN MIGRASI:
 *
 * Fungsi seedInitialAccounts() dan seedInitialStaff() VERSI LAMA sengaja
 * DIHAPUS dari Setup.gs.
 *
 * Database saat ini sudah memiliki 40 STAFF dan 40 USERS.
 * MASTER_STAFF_SEED bukan lagi sumber data utama yang boleh digunakan
 * untuk menimpa struktur. Sistem tidak lagi menggunakan shift.
 *
 * Penambahan staf baru dilakukan melalui addNewStaffAccount(
 *   staffId, username, nama, role, bidang, initialPassword
 * );
 *
 * PETUGAS_SHIFT adalah ROLE. "Shift" adalah bidang/tim.
 * Tidak ada field shift Pagi/Siang/Malam.
 */
