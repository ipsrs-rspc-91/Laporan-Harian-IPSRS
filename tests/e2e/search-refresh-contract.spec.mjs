import { test, expect } from '@playwright/test';

test('Cari hanya menerapkan filter lokal dan tidak memanggil loader/server', async ({ request }) => {
  const response = await request.get('/laporan-fast-v2.js?v=20261020-SEARCH-REFRESH-FIX2');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();

  const searchStart = source.indexOf('window.searchLaporan=function(){');
  const refreshStart = source.indexOf('window.forceReloadLaporan=function(){');
  expect(searchStart, 'searchLaporan must exist').toBeGreaterThanOrEqual(0);
  expect(refreshStart, 'forceReloadLaporan must exist').toBeGreaterThan(searchStart);

  const searchCode = source.slice(searchStart, refreshStart);
  expect(searchCode).toContain('window.applyFilters()');
  expect(searchCode).not.toContain('loadReportsUltra');
  expect(searchCode).not.toContain('requestReports');
  expect(searchCode).not.toContain("authRun('apiGetReports'");
});

test('Refresh meminta data server baru, mempertahankan keyword dan menerapkan filter kembali', async ({ request }) => {
  const response = await request.get('/laporan-fast-v2.js?v=20261020-SEARCH-REFRESH-FIX2');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();

  const refreshStart = source.indexOf('window.forceReloadLaporan=function(){');
  const refreshEnd = source.indexOf('const originalApply=window.applyFilters;', refreshStart);
  expect(refreshStart).toBeGreaterThanOrEqual(0);
  expect(refreshEnd).toBeGreaterThan(refreshStart);
  const refreshCode = source.slice(refreshStart, refreshEnd);

  expect(refreshCode).toContain('window.__IPSRS_APPLIED_REPORT_SEARCH=String(input&&input.value||\'\').trim()');
  expect(refreshCode).toContain('loadReportsUltra(true)');
  expect(refreshCode).toContain("period.value='3'");
  expect(refreshCode).toContain('FilterStatus');
  expect(refreshCode).toContain('FilterKategori');
  expect(refreshCode).toContain('FilterArea');
  expect(refreshCode).toContain('FilterBidang');
  expect(refreshCode).toContain('adminStaffSelect');

  const loaderStart = source.indexOf('async function loadReportsUltra(forceRefresh)');
  const loaderEnd = source.indexOf('window.searchLaporan=function(){', loaderStart);
  expect(loaderStart).toBeGreaterThanOrEqual(0);
  const loaderCode = source.slice(loaderStart, loaderEnd > loaderStart ? loaderEnd : undefined);
  expect(loaderCode).toContain('requestReports(');
  expect(loaderCode).toContain('forceRefresh===true');
  expect(loaderCode).toContain('applyFilters()');
});

test('kolom pencarian hanya lima field yang disepakati', async ({ request }) => {
  const response = await request.get('/app.js?v=20261015-MAINTENANCE-OFF-1345');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();

  const filterStart = source.indexOf('function applyFilters(){');
  expect(filterStart).toBeGreaterThanOrEqual(0);
  const filterCode = source.slice(filterStart, filterStart + 5000);
  const fields = ['r.Ruang', 'r.MasalahKegiatan', 'r.Tindakan', 'r.Keterangan', 'r.Item'];
  for (const field of fields) expect(filterCode).toContain(field);
  expect(filterCode).toContain('window.__IPSRS_APPLIED_REPORT_SEARCH');
  expect(filterCode).toContain('hay.includes(cari)');
  expect(filterCode).not.toMatch(/r\.(?:ID|ReportID|Tanggal|StaffName|NamaPetugas)\b/);
});
