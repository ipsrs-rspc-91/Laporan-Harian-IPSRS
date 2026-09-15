/**
 * Auth.gs
 * Login, session token, dan hashing password.
 *
 * TAHAP 2:
 * - Tidak lagi menggunakan staff.shift.
 * - Session tidak lagi menyimpan shift.
 * - PETUGAS_SHIFT tetap dikenali melalui role.
 * - bidang digunakan untuk identitas tim, termasuk bidang "Shift".
 *
 * Optimasi:
 * - CacheService untuk lookup USERS/STAFF.
 * - Tidak melakukan cleanup seluruh sheet SESSIONS pada setiap login.
 */

function randomSalt() {
  return Utilities.getUuid();
}

function hashPassword(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password) + '::' + String(salt),
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(function(b) {
      return (b < 0 ? b + 256 : b)
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
}


const AUTH_CACHE_TTL_SECONDS_ = 300;
const AUTH_DIRECTORY_CACHE_KEY_ = 'auth:directory:v3';


function buildAuthDirectory_() {
  const usersSheet = getSheet(SHEET_USERS);
  const staffSheet = getSheet(SHEET_STAFF);

  const users = usersSheet.getDataRange().getValues();
  const staff = staffSheet.getDataRange().getValues();

  const userHeaders = users[0] || [];
  const staffHeaders = staff[0] || [];

  const byUsername = {};
  const byStaffId = {};

  for (let i = 1; i < users.length; i++) {
    const r = rowToObj(userHeaders, users[i]);

    const key = String(r.username || '')
      .trim()
      .toLowerCase();

    if (key) {
      byUsername[key] = {
        row: r,
        rowIndex: i + 1,
        headers: userHeaders
      };
    }
  }

  for (let i = 1; i < staff.length; i++) {
    const r = rowToObj(staffHeaders, staff[i]);

    const key = String(r.staff_id || '');

    if (key) {
      byStaffId[key] = r;
    }
  }

  return {
    byUsername: byUsername,
    byStaffId: byStaffId
  };
}


function getAuthDirectory_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(AUTH_DIRECTORY_CACHE_KEY_);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      cache.remove(AUTH_DIRECTORY_CACHE_KEY_);
    }
  }

  const directory = buildAuthDirectory_();

  try {
    cache.put(
      AUTH_DIRECTORY_CACHE_KEY_,
      JSON.stringify(directory),
      AUTH_CACHE_TTL_SECONDS_
    );
  } catch (e) {}

  return directory;
}


function invalidateAuthCache_(username, staffId) {
  const cache = CacheService.getScriptCache();

  cache.remove(AUTH_DIRECTORY_CACHE_KEY_);

  if (username) {
    cache.remove(
      'auth:user:' +
      String(username).trim().toLowerCase()
    );
  }

  if (staffId) {
    cache.remove(
      'auth:staff:' +
      String(staffId)
    );
  }
}


function getCachedUserByUsername_(username) {
  const key = String(username || '')
    .trim()
    .toLowerCase();

  const directory = getAuthDirectory_();

  return directory.byUsername[key] || null;
}


function getCachedStaffById_(staffId) {
  const directory = getAuthDirectory_();

  return directory.byStaffId[
    String(staffId || '')
  ] || null;
}


function getStaffByIdFromSheet_(staffId) {
  const sheet = getSheet(SHEET_STAFF);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === staffId) {
      return rowToObj(headers, rows[i]);
    }
  }

  return null;
}


function getStaffById(staffId) {
  return getCachedStaffById_(staffId);
}


function findUserByUsernameFromSheet_(username) {
  const sheet = getSheet(SHEET_USERS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    const r = rowToObj(headers, rows[i]);

    if (
      String(r.username || '').trim().toLowerCase() ===
      String(username || '').trim().toLowerCase()
    ) {
      return {
        row: r,
        rowIndex: i + 1,
        headers: headers
      };
    }
  }

  return null;
}


function findUserByUsername(username) {
  return getCachedUserByUsername_(username);
}


function cleanupExpiredSessions_() {
  try {
    const sheet = getSheet(SHEET_SESSIONS);
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) return;

    const headers = data[0];
    const expIdx = headers.indexOf('expires_at');

    if (expIdx < 0) return;

    const nowMs = Date.now();

    for (let i = data.length - 1; i >= 1; i--) {
      const exp = new Date(
        data[i][expIdx]
      ).getTime();

      if (!isNaN(exp) && exp < nowMs) {
        sheet.deleteRow(i + 1);
      }
    }
  } catch (e) {}
}


/**
 * LOGIN
 *
 * TAHAP 2:
 * Session hanya menyimpan:
 * token
 * username
 * staff_id
 * role
 * bidang
 * nama
 * created_at
 * expires_at
 *
 * Tidak ada lagi shift.
 */
function login(username, password) {

  username = (username || '')
    .toString()
    .trim();

  password = (password || '')
    .toString();

  if (!username || !password) {
    return {
      ok: false,
      msg: 'Username dan password wajib diisi.'
    };
  }

  const found = findUserByUsername(username);

  if (!found) {
    return {
      ok: false,
      msg: 'Username tidak ditemukan.'
    };
  }

  const u = found.row;

  if (u.status !== 'Aktif') {
    return {
      ok: false,
      msg: 'Akun nonaktif. Hubungi KA IPSRS.'
    };
  }

  const hash = hashPassword(
    password,
    u.password_salt
  );

  if (hash !== u.password_hash) {
    logAudit(
      username,
      u.staff_id,
      'LOGIN_FAILED',
      '',
      'Password salah'
    );

    return {
      ok: false,
      msg: 'Password salah.'
    };
  }

  const staff = getStaffById(u.staff_id);

  const nama = staff ? staff.nama : '';
  const bidang = staff ? staff.bidang : '';

  const token =
    Utilities.getUuid() +
    '-' +
    Utilities.getUuid();

  const now = new Date();

  const exp = new Date(
    now.getTime() + SESSION_LIFETIME_MS
  );

  const sess = getSheet(SHEET_SESSIONS);

  sess.appendRow(
    objToRow(
      HEADERS.SESSIONS,
      {
        token: token,
        username: username,
        staff_id: u.staff_id,
        role: u.role,
        bidang: bidang,
        nama: nama,
        created_at: now.toISOString(),
        expires_at: exp.toISOString()
      }
    )
  );

  return {
    ok: true,
    token: token,
    username: username,
    staff_id: u.staff_id,
    role: u.role,
    nama: nama,
    bidang: bidang
  };
}


function validateSession(token) {

  if (!token) return null;

  const sheet = getSheet(SHEET_SESSIONS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {

    if (rows[i][0] === token) {

      const row = rowToObj(
        headers,
        rows[i]
      );

      if (
        new Date(row.expires_at).getTime() <
        Date.now()
      ) {
        return null;
      }

      return row;
    }
  }

  return null;
}


function logout(token) {

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    return {
      ok: false,
      msg: 'Server sedang sibuk, silakan coba lagi.'
    };
  }

  try {

    const sheet = getSheet(SHEET_SESSIONS);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {

      if (data[i][0] === token) {
        sheet.deleteRow(i + 1);
        break;
      }
    }

  } finally {
    lock.releaseLock();
  }

  return {
    ok: true
  };
}


function changePassword(
  session,
  oldPassword,
  newPassword
) {

  newPassword = (newPassword || '')
    .toString();

  if (newPassword.length < 6) {
    return {
      ok: false,
      msg: 'Password baru minimal 6 karakter.'
    };
  }

  const found = findUserByUsername(
    session.username
  );

  if (!found) {
    return {
      ok: false,
      msg: 'User tidak ditemukan.'
    };
  }

  const oldHash = hashPassword(
    oldPassword,
    found.row.password_salt
  );

  if (
    oldHash !== found.row.password_hash
  ) {
    return {
      ok: false,
      msg: 'Password lama salah.'
    };
  }

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(15000)) {
    return {
      ok: false,
      msg: 'Server sedang sibuk, silakan coba lagi.'
    };
  }

  try {

    const sheet = getSheet(SHEET_USERS);

    const salt = randomSalt();

    const hash = hashPassword(
      newPassword,
      salt
    );

    const hIdx =
      found.headers.indexOf(
        'password_hash'
      );

    const sIdx =
      found.headers.indexOf(
        'password_salt'
      );

    const uIdx =
      found.headers.indexOf(
        'updated_at'
      );

    sheet
      .getRange(
        found.rowIndex,
        hIdx + 1
      )
      .setValue(hash);

    sheet
      .getRange(
        found.rowIndex,
        sIdx + 1
      )
      .setValue(salt);

    sheet
      .getRange(
        found.rowIndex,
        uIdx + 1
      )
      .setValue(nowIso());

    invalidateAuthCache_(
      session.username,
      session.staff_id
    );

  } finally {
    lock.releaseLock();
  }

  logAudit(
    session.username,
    session.staff_id,
    'CHANGE_PASSWORD',
    '',
    ''
  );

  return {
    ok: true
  };
}


function adminResetPassword(
  session,
  targetUsername,
  newPassword
) {

  if (
    session.role !== ROLE_KA_IPSRS &&
    session.role !== ROLE_ADMINISTRASI
  ) {
    return {
      ok: false,
      msg: 'Akses ditolak.'
    };
  }

  newPassword = (newPassword || '')
    .toString();

  if (newPassword.length < 6) {
    return {
      ok: false,
      msg: 'Password baru minimal 6 karakter.'
    };
  }

  const found =
    findUserByUsername(
      targetUsername
    );

  if (!found) {
    return {
      ok: false,
      msg: 'User tidak ditemukan.'
    };
  }

  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(15000)) {
    return {
      ok: false,
      msg: 'Server sedang sibuk, silakan coba lagi.'
    };
  }

  try {

    const sheet =
      getSheet(SHEET_USERS);

    const salt =
      randomSalt();

    const hash =
      hashPassword(
        newPassword,
        salt
      );

    const hIdx =
      found.headers.indexOf(
        'password_hash'
      );

    const sIdx =
      found.headers.indexOf(
        'password_salt'
      );

    const uIdx =
      found.headers.indexOf(
        'updated_at'
      );

    sheet
      .getRange(
        found.rowIndex,
        hIdx + 1
      )
      .setValue(hash);

    sheet
      .getRange(
        found.rowIndex,
        sIdx + 1
      )
      .setValue(salt);

    sheet
      .getRange(
        found.rowIndex,
        uIdx + 1
      )
      .setValue(nowIso());

    invalidateAuthCache_(
      targetUsername,
      found.row.staff_id
    );

  } finally {
    lock.releaseLock();
  }

  logAudit(
    session.username,
    session.staff_id,
    'ADMIN_RESET_PASSWORD',
    '',
    'target=' + targetUsername
  );

  return {
    ok: true
  };
}
