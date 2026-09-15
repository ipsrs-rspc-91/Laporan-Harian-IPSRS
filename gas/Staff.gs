/**
 * Staff.gs
 *
 * Daftar seluruh petugas + jumlah laporan masing-masing.
 * Dibuka untuk SEMUA peran yang login.
 *
 * TAHAP 2:
 * - Tidak ada lagi field shift.
 * - PETUGAS_SHIFT tetap merupakan role.
 * - Identitas tim menggunakan field bidang.
 * - Untuk PETUGAS_SHIFT, bidang = "Shift".
 */


/**
 * MONITORING HARIAN
 *
 * Menggabungkan STAFF (populasi) dengan REPORTS (transaksi),
 * supaya staf yang BELUM PERNAH membuat laporan tetap muncul.
 *
 * Aturan:
 * - minimal satu laporan pada tanggal tersebut = SUDAH_ISI
 * - jumlah transaksi hanya sebagai informasi tambahan
 * - LIBUR_TANGGAL tidak dihitung sebagai BELUM_ISI
 * - staf Nonaktif tidak dihitung sebagai kewajiban
 */
function getStaffMonitoring(session, bulan, tanggal) {

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  bulan = bulan || todayStr.substring(0, 7);
  tanggal = tanggal || todayStr;

  if (tanggal.indexOf(bulan) !== 0) {
    tanggal = bulan === todayStr.substring(0, 7) ? todayStr : bulan + '-01';
  }

  const staffSheet = getSheet(SHEET_STAFF);
  const staffRows = staffSheet.getDataRange().getValues();

  if (staffRows.length < 1) {
    return {ok: true, bulan: bulan, tanggal: tanggal, hari_wajib_terhitung: 0, data: []};
  }

  const staffHeaders = staffRows[0];
  const reportSheet = getSheet(SHEET_REPORTS);
  const reportRows = reportSheet.getDataRange().getValues();
  const reportHeaders = reportRows[0] || [];

  const byStaffDate = {};
  const byStaffMonthTotal = {};
  const byStaffTodayCount = {};

  for (let i = 1; i < reportRows.length; i++) {
    const r = rowToObj(reportHeaders, reportRows[i]);
    r.tanggal = normalizeTanggal_(r.tanggal);

    if (!r.staff_id || !r.tanggal) continue;

    const tgl = r.tanggal.toString();
    if (tgl.indexOf(bulan) !== 0) continue;

    byStaffMonthTotal[r.staff_id] = (byStaffMonthTotal[r.staff_id] || 0) + 1;
    byStaffDate[r.staff_id] = byStaffDate[r.staff_id] || {};
    byStaffDate[r.staff_id][tgl] = (byStaffDate[r.staff_id][tgl] || 0) + 1;

    if (tgl === tanggal) {
      byStaffTodayCount[r.staff_id] = (byStaffTodayCount[r.staff_id] || 0) + 1;
    }
  }

  const wajibDates = getHariWajibDalamBulan_(bulan);
  const bulanBerjalan = bulan === todayStr.substring(0, 7);
  const tanggalTidakWajib = LIBUR_TANGGAL.indexOf(tanggal) > -1;
  const out = [];

  for (let i = 1; i < staffRows.length; i++) {
    const s = rowToObj(staffHeaders, staffRows[i]);
    if (!s.staff_id) continue;

    const dateMap = byStaffDate[s.staff_id] || {};
    let sudahIsiHari = 0;

    wajibDates.forEach(function(ds) {
      if (dateMap[ds]) sudahIsiHari++;
    });

    const isAktif = (s.status || 'Aktif') === 'Aktif';
    const belumIsiHari = isAktif ? Math.max(0, wajibDates.length - sudahIsiHari) : 0;
    let statusHariIni;

    if (!isAktif) {
      statusHariIni = 'TIDAK_WAJIB';
    } else if (tanggalTidakWajib) {
      statusHariIni = 'TIDAK_WAJIB';
    } else if (tanggal > todayStr) {
      statusHariIni = 'BELUM_TERJADI';
    } else {
      statusHariIni = dateMap[tanggal] ? 'SUDAH_ISI' : 'BELUM_ISI';
    }

    out.push({
      staff_id: s.staff_id,
      nama: s.nama,
      jabatan: s.jabatan || '',
      role: s.role,
      role_label: ROLE_LABELS[s.role] || s.role,
      bidang: s.bidang || '',
      status: s.status || 'Aktif',
      status_hari_ini: statusHariIni,
      laporan_hari_ini: byStaffTodayCount[s.staff_id] || 0,
      sudah_isi_hari_bulan_ini: sudahIsiHari,
      belum_isi_hari_bulan_ini: belumIsiHari,
      total_transaksi_bulan_ini: byStaffMonthTotal[s.staff_id] || 0
    });
  }

  out.sort(function(a, b) {
    return a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0;
  });

  return {
    ok: true,
    bulan: bulan,
    tanggal: tanggal,
    bulan_berjalan: bulanBerjalan,
    hari_wajib_terhitung: wajibDates.length,
    data: out
  };
}


function getHariWajibDalamBulan_(bulan) {
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const bulanIni = todayStr.substring(0, 7);
  const parts = bulan.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  let daysToCount;

  if (bulan < bulanIni) {
    daysToCount = lastDayOfMonth;
  } else if (bulan === bulanIni) {
    daysToCount = parseInt(todayStr.substring(8, 10), 10);
  } else {
    daysToCount = 0;
  }

  const out = [];
  for (let d = 1; d <= daysToCount; d++) {
    const ds = bulan + '-' + String(d).padStart(2, '0');
    if (LIBUR_TANGGAL.indexOf(ds) === -1) out.push(ds);
  }
  return out;
}


function getStaffDailyStatus(session, staffId, bulan) {
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  bulan = bulan || todayStr.substring(0, 7);

  const s = getStaffById(staffId);
  if (!s) return {ok: false, msg: 'Staf tidak ditemukan.'};

  const reportSheet = getSheet(SHEET_REPORTS);
  const rows = reportSheet.getDataRange().getValues();
  const headers = rows[0] || [];
  const perDate = {};
  const laporanList = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rowToObj(headers, rows[i]);
    r.tanggal = normalizeTanggal_(r.tanggal);

    if (r.staff_id !== staffId) continue;
    const tgl = (r.tanggal || '').toString();
    if (tgl.indexOf(bulan) !== 0) continue;

    perDate[tgl] = (perDate[tgl] || 0) + 1;
    laporanList.push(mapReportToLegacyShape(r));
  }

  laporanList.sort(function(a, b) {
    return a.ID < b.ID ? 1 : -1;
  });

  const parts = bulan.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const kalender = [];
  const isAktif = (s.status || 'Aktif') === 'Aktif';

  for (let d = 1; d <= lastDayOfMonth; d++) {
    const ds = bulan + '-' + String(d).padStart(2, '0');
    let status;

    if (!isAktif) {
      status = 'TIDAK_WAJIB';
    } else if (LIBUR_TANGGAL.indexOf(ds) > -1) {
      status = 'TIDAK_WAJIB';
    } else if (ds > todayStr) {
      status = 'BELUM_TERJADI';
    } else {
      status = perDate[ds] ? 'SUDAH_ISI' : 'BELUM_ISI';
    }

    kalender.push({tanggal: ds, status: status, jumlah: perDate[ds] || 0});
  }

  return {
    ok: true,
    staff: {
      staff_id: s.staff_id,
      nama: s.nama,
      jabatan: s.jabatan || '',
      role: s.role,
      role_label: ROLE_LABELS[s.role] || s.role,
      bidang: s.bidang || '',
      status: s.status || 'Aktif'
    },
    bulan: bulan,
    kalender: kalender,
    laporan: laporanList
  };
}


function getMonthlyRecap(session, bulan) {
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  bulan = bulan || todayStr.substring(0, 7);

  const monRes = getStaffMonitoring(session, bulan, bulan + '-01');
  if (!monRes.ok) return monRes;

  const perStaff = monRes.data.filter(function(s) {
    return s.status === 'Aktif';
  });

  const perBidangMap = {};

  perStaff.forEach(function(s) {
    let key = s.bidang;
    if (!key) key = s.role === ROLE_PETUGAS_SHIFT ? 'Shift' : 'Manajemen';

    if (!perBidangMap[key]) {
      perBidangMap[key] = {bidang: key, jumlah_staf: 0, hari_isi: 0, total_transaksi: 0};
    }

    perBidangMap[key].jumlah_staf += 1;
    perBidangMap[key].hari_isi += s.sudah_isi_hari_bulan_ini;
    perBidangMap[key].total_transaksi += s.total_transaksi_bulan_ini;
  });

  const totalStaff = perStaff.length;
  const totalHariWajib = monRes.hari_wajib_terhitung;
  const totalStaffDaysWajib = totalStaff * totalHariWajib;
  const totalStaffDaysSudahIsi = perStaff.reduce(function(sum, s) {
    return sum + s.sudah_isi_hari_bulan_ini;
  }, 0);
  const totalStaffDaysBelumIsi = Math.max(0, totalStaffDaysWajib - totalStaffDaysSudahIsi);
  const totalTransaksi = perStaff.reduce(function(sum, s) {
    return sum + s.total_transaksi_bulan_ini;
  }, 0);
  const persentaseKepatuhan = totalStaffDaysWajib > 0
    ? Math.round((totalStaffDaysSudahIsi / totalStaffDaysWajib) * 1000) / 10
    : 0;

  return {
    ok: true,
    bulan: bulan,
    per_staff: perStaff,
    per_bidang: Object.keys(perBidangMap).map(function(k) {
      return perBidangMap[k];
    }).sort(function(a, b) {
      return a.bidang < b.bidang ? -1 : 1;
    }),
    ringkasan: {
      total_staff: totalStaff,
      total_hari_wajib: totalHariWajib,
      total_staff_days_wajib: totalStaffDaysWajib,
      total_staff_days_sudah_isi: totalStaffDaysSudahIsi,
      total_staff_days_belum_isi: totalStaffDaysBelumIsi,
      persentase_kepatuhan: persentaseKepatuhan,
      total_transaksi: totalTransaksi
    }
  };
}


function getStaffReports(session, staffId, bulan) {
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  bulan = bulan || todayStr.substring(0, 7);

  const s = getStaffById(staffId);
  if (!s) return {ok: false, msg: 'Staf tidak ditemukan.'};

  const reportSheet = getSheet(SHEET_REPORTS);
  const rows = reportSheet.getDataRange().getValues();
  const headers = rows[0] || [];
  const laporanList = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rowToObj(headers, rows[i]);
    r.tanggal = normalizeTanggal_(r.tanggal);

    if (r.staff_id !== staffId) continue;
    const tgl = (r.tanggal || '').toString();
    if (tgl.indexOf(bulan) !== 0) continue;

    laporanList.push(mapReportToLegacyShape(r));
  }

  laporanList.sort(function(a, b) {
    return a.ID < b.ID ? 1 : -1;
  });

  return {
    ok: true,
    staff: {
      staff_id: s.staff_id,
      nama: s.nama,
      jabatan: s.jabatan || '',
      role: s.role,
      bidang: s.bidang || ''
    },
    bulan: bulan,
    laporan: laporanList
  };
}


function getStaffPerformance(session, staffId, bulan) {
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  bulan = bulan || todayStr.substring(0, 7);

  const s = getStaffById(staffId);
  if (!s) return {ok: false, msg: 'Staf tidak ditemukan.'};

  const reportSheet = getSheet(SHEET_REPORTS);
  const rows = reportSheet.getDataRange().getValues();
  const headers = rows[0] || [];
  const pencapaian = {
    'Selesai': 0,
    'Sebagian': 0,
    'Belum Selesai': 0,
    'Ditunda': 0,
    'Tindak Lanjut': 0,
    'Belum Diisi': 0
  };
  const byKategori = {};
  const byArea = {};
  let totalLaporan = 0;
  const tanggalSet = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rowToObj(headers, rows[i]);
    r.tanggal = normalizeTanggal_(r.tanggal);

    if (r.staff_id !== staffId) continue;
    const tgl = (r.tanggal || '').toString();
    if (tgl.indexOf(bulan) !== 0) continue;

    totalLaporan++;
    tanggalSet[tgl] = true;

    const sp = (r.status_pencapaian || '').toString();
    if (pencapaian.hasOwnProperty(sp) && sp !== '') {
      pencapaian[sp]++;
    } else {
      pencapaian['Belum Diisi']++;
    }

    if (r.kategori) byKategori[r.kategori] = (byKategori[r.kategori] || 0) + 1;
    if (r.area_kerja) byArea[r.area_kerja] = (byArea[r.area_kerja] || 0) + 1;
  }

  function toSortedArray(obj) {
    return Object.keys(obj).map(function(k) {
      return {label: k, value: obj[k]};
    }).sort(function(a, b) {
      return b.value - a.value;
    });
  }

  return {
    ok: true,
    staff: {
      staff_id: s.staff_id,
      nama: s.nama,
      jabatan: s.jabatan || '',
      role: s.role,
      bidang: s.bidang || ''
    },
    bulan: bulan,
    aktivitas: {
      total_laporan: totalLaporan,
      hari_isi: Object.keys(tanggalSet).length,
      kategori: toSortedArray(byKategori),
      area_kerja: toSortedArray(byArea)
    },
    pencapaian: pencapaian
  };
}


function listStaff(session) {
  const staffSheet = getSheet(SHEET_STAFF);
  const staffRows = staffSheet.getDataRange().getValues();
  const staffHeaders = staffRows[0];
  const reportSheet = getSheet(SHEET_REPORTS);
  const reportRows = reportSheet.getDataRange().getValues();
  const reportHeaders = reportRows[0];
  const staffIdIdx = reportHeaders.indexOf('staff_id');
  const counts = {};

  for (let i = 1; i < reportRows.length; i++) {
    const sid = reportRows[i][staffIdIdx];
    if (!sid) continue;
    counts[sid] = (counts[sid] || 0) + 1;
  }

  const out = [];

  for (let i = 1; i < staffRows.length; i++) {
    const r = rowToObj(staffHeaders, staffRows[i]);
    if (!r.staff_id) continue;

    out.push({
      staff_id: r.staff_id,
      nama: r.nama,
      jabatan: r.jabatan || '',
      role: r.role,
      role_label: ROLE_LABELS[r.role] || r.role,
      bidang: r.bidang || '',
      status: r.status,
      total_laporan: counts[r.staff_id] || 0
    });
  }

  return {ok: true, data: out};
}
