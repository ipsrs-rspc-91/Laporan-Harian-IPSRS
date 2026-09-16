/**
 * AccessPatch.gs
 * Compatibility/fix layer for GitHub Pages -> GAS runtime.
 * Tidak mengubah aturan hak akses inti; hanya menormalkan staff_id
 * dan memastikan endpoint Dashboard mengikuti LAPORAN_TIM.
 */

function normalizeStaffIdFilter_(staffIdFilter) {
  if (staffIdFilter === null || staffIdFilter === undefined || staffIdFilter === '') return null;
  var wanted = String(staffIdFilter).trim();
  if (!wanted) return null;

  var sheet = getSheet(SHEET_REPORTS);
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return wanted;

  var headers = rows[0];
  var idx = headers.indexOf('staff_id');
  if (idx < 0) return wanted;

  for (var i = 1; i < rows.length; i++) {
    var actual = rows[i][idx];
    if (actual !== '' && actual !== null && actual !== undefined && String(actual).trim() === wanted) {
      return actual;
    }
  }
  return wanted;
}

function apiGetReportsFixed(token, bulan, staffIdFilter, bidangFilter) {
  try {
    var s = validateSession(token);
    if (!s) return { ok: false, msg: 'Sesi tidak valid, silakan login kembali.' };

    // Jika LAPORAN_TIM aktif, user boleh melihat laporan tim.
    // Jika nonaktif, canViewReport_() tetap membatasi ke laporan sendiri.
    var normalizedStaffId = normalizeStaffIdFilter_(staffIdFilter);
    return getReports(s, bulan || '', normalizedStaffId, bidangFilter || null);
  } catch (err) {
    return { ok: false, msg: 'Error server: ' + err.message };
  }
}

function apiDashboardStatsFixed(token, bulan, staffIdFilter, bidangFilter) {
  try {
    var s = validateSession(token);
    if (!s) return { ok: false, msg: 'Sesi tidak valid, silakan login kembali.' };

    // Hormati LAPORAN_TIM. Bila aktif, dashboard default dapat melihat
    // agregat seluruh tim. Bila nonaktif, canViewReport_() membatasi data.
    var normalizedStaffId = normalizeStaffIdFilter_(staffIdFilter);
    return getDashboardStats(s, bulan || '', normalizedStaffId, bidangFilter || null);
  } catch (err) {
    return { ok: false, msg: 'Error server: ' + err.message };
  }
}

function apiGetStaffMonitoringFixed(token, bulan, tanggal) {
  try {
    var s = validateSession(token);
    if (!s) return { ok: false, msg: 'Sesi tidak valid, silakan login kembali.' };

    var result = getStaffMonitoring(s, bulan || '', tanggal || '');
    if (!result || result.ok !== true) return result;

    // Saat LAPORAN_TIM nonaktif, petugas biasa hanya boleh melihat monitoring
    // dirinya sendiri. Saat aktif, seluruh monitoring tim tetap terlihat.
    var teamAccess = getAccessSetting_(ACCESS_SETTING_LAPORAN_TIM, ACCESS_ACTIVE) === ACCESS_ACTIVE;
    if (!teamAccess && s.role !== ROLE_KA_IPSRS) {
      result.data = (result.data || []).filter(function (row) {
        return String(row.staff_id) === String(s.staff_id);
      });
    }
    return result;
  } catch (err) {
    return { ok: false, msg: 'Error server: ' + err.message };
  }
}
