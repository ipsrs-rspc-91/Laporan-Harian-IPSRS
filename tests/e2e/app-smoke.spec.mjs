import { test, expect } from '@playwright/test';

test('IPSRS unauthenticated startup smoke test', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#authLoading')).toBeAttached();
  await expect(page.locator('#loginScreen')).toBeAttached();
  await expect(page.locator('#appShell')).toBeAttached();
  await expect(page.locator('#page-dashboard')).toBeAttached({timeout:10000});
  await expect(page.locator('#page-laporan')).toBeAttached({timeout:10000});
  await expect(page.locator('#page-online')).toBeAttached({timeout:10000});
  await page.waitForTimeout(4000);
  const criticalErrors = consoleErrors.filter(msg =>
    !/favicon|Failed to load resource: the server responded with a status of 404/i.test(msg)
  );
  expect(criticalErrors, 'Critical browser console/page errors').toEqual([]);
});

test('IPSRS critical frontend assets are reachable', async ({ request }) => {
  const indexResponse = await request.get('/index.html');
  expect(indexResponse.ok(), '/index.html').toBeTruthy();
  const indexHtml = await indexResponse.text();
  const scriptAssets = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=[\"']([^\"']+)[\"']/gi)]
    .map(m => m[1])
    .filter(src => {
      const clean = src.split('?')[0].split('#')[0].replace(/^\.\//, '').replace(/^\//, '');
      return clean.endsWith('.js') && [
        'app.js','config.js','laporan-fast-v2.js','login-fast.js',
        'dashboard-loading-v2.js','access-policy-ui.js','static-data.js',
        'required-fields-ui.js','access-control.js','access-visibility-fix.js',
        'laporan-loading-state.js','js/kategori-modal.js'
      ].includes(clean);
    });
  expect(scriptAssets.length, 'Critical frontend asset references found in index.html').toBeGreaterThan(0);
  const assets = ['/index.html', '/export-laporan-excel.js', ...scriptAssets.map(src => src.startsWith('/') ? src : '/'+src.replace(/^\.\//,'')).filter((v,i,a)=>a.indexOf(v)===i)];
  for (const path of assets) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
  }
});

test('Excel export module and Daftar Laporan button load without login', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-laporan')).toBeAttached({ timeout: 10000 });
  await expect(page.locator('#btnDownloadLaporanExcel')).toBeAttached({ timeout: 10000 });
  const moduleLoaded = await page.evaluate(() => window.__IPSRS_EXCEL_EXPORT_V1 === true);
  expect(moduleLoaded, 'Excel export module initialized').toBeTruthy();
  expect(runtimeErrors, 'Excel export module must not introduce runtime errors').toEqual([]);
});

test('Excel export downloads only reports rendered in the current list', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btnDownloadLaporanExcel')).toBeAttached({ timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('btnDownloadLaporanExcel')?.dataset.exportBound === '1');

  // Set up synthetic visible rows only after the application has finished installing
  // the export handler, so normal page initialization cannot overwrite the test data.
  await page.evaluate(() => {
    document.getElementById('authLoading')?.classList.add('hidden');
    document.getElementById('appShell')?.classList.remove('hidden');
    document.getElementById('page-laporan')?.classList.add('active');
    document.getElementById('subtab-daftar')?.classList.remove('hidden');
    window.__IPSRS_REPORTS = {
      'TEST-ONLY-1': {
        ID: 'TEST-ONLY-1', Tanggal: '2026-10-22', Pukul: '08:00',
        Ruang: 'Ruang Uji', MasalahKegiatan: '=1+1', Tindakan: 'Uji ekspor',
        Petugas: 'Petugas Uji', Status: 'Selesai'
      },
      'TEST-NOT-DISPLAYED': {
        ID: 'TEST-NOT-DISPLAYED', Tanggal: '2026-10-21',
        Ruang: 'Tidak tampil', MasalahKegiatan: 'Jangan diekspor'
      }
    };
    // Deterministic SheetJS stub: test the export handler without depending on a CDN.
    window.XLSX = {
      utils: {
        aoa_to_sheet: data => { window.__ipsrsExportTestData = data; return { '!ref': 'A1' }; },
        book_new: () => ({}),
        book_append_sheet: () => {}
      },
      writeFile: (_book, filename) => { window.__ipsrsExportTestFile = filename; }
    };
    document.getElementById('reportTableBody').innerHTML =
      '<tr data-report-id="TEST-ONLY-1"><td>synthetic test row</td></tr>';
  });
  await page.locator('#btnDownloadLaporanExcel').click();
  await page.waitForFunction(() => !!window.__ipsrsExportTestFile);
  const result = await page.evaluate(() => ({
    filename: window.__ipsrsExportTestFile,
    data: window.__ipsrsExportTestData
  }));
  expect(result.filename).toContain('Daftar-Tampil');
  expect(result.filename).toMatch(/\.xlsx$/);
  expect(result.data).toHaveLength(2);
  expect(result.data[1][0]).toBe('TEST-ONLY-1');
  expect(result.data[1][5]).toBe("'=1+1");
  expect(JSON.stringify(result.data)).not.toContain('TEST-NOT-DISPLAYED');
});

test('Individual report Excel button exports only the selected report', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btnDownloadLaporanExcel')).toBeAttached({ timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('btnDownloadLaporanExcel')?.dataset.exportBound === '1');
  await page.evaluate(() => {
    document.getElementById('authLoading')?.classList.add('hidden');
    document.getElementById('appShell')?.classList.remove('hidden');
    document.getElementById('page-laporan')?.classList.add('active');
    document.getElementById('subtab-daftar')?.classList.remove('hidden');
    window.XLSX = {
      utils: {
        aoa_to_sheet: data => { window.__ipsrsSingleExportData = data; return { '!ref': 'A1' }; },
        book_new: () => ({}),
        book_append_sheet: () => {}
      },
      writeFile: (_book, filename) => { window.__ipsrsSingleExportFile = filename; }
    };
    window.renderReportTable([{
      ID: 'TEST-DETAIL-1', Tanggal: '2026-10-22', Pukul: '09:00',
      Ruang: 'Ruang Detail Uji', NoLK: 'LK-TEST-1',
      MasalahKegiatan: 'Uji unduh per laporan', Tindakan: 'Verifikasi',
      Keterangan: 'Data sintetis', Petugas: 'Petugas Uji', Bidang: 'ME',
      Status: 'Selesai', Kategori: 'ME', AreaKerja: 'Ruang Uji',
      Item: 'Item Uji', CanEdit: false
    }]);
  });
  const singleButton = page.locator('#reportCardList .ipsrs-export-single').first();
  await expect(singleButton).toBeVisible();
  await singleButton.click();
  await page.waitForFunction(() => !!window.__ipsrsSingleExportFile);
  const result = await page.evaluate(() => ({
    filename: window.__ipsrsSingleExportFile,
    data: window.__ipsrsSingleExportData
  }));
  expect(result.filename).toContain('ID-TEST-DETAIL-1');
  expect(result.filename).toMatch(/\.xlsx$/);
  expect(result.data).toHaveLength(2);
  expect(result.data[1][0]).toBe('TEST-DETAIL-1');
  expect(JSON.stringify(result.data)).not.toContain('TEST-NOT-DISPLAYED');
});

test('Delete Report control is present but hidden outside edit mode', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const deleteButton = page.locator('#btnDeleteReport');
  await expect(deleteButton).toBeAttached();
  await expect(deleteButton).toBeHidden();
});

test('dashboard-load', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-dashboard')).toBeAttached({timeout:10000});
  await expect(page.locator('#DashBulan')).toBeAttached();
  await expect(page.locator('#statTotal')).toBeAttached();
  await expect(page.locator('#statSelesai')).toBeAttached();
  await expect(page.locator('#statBelum')).toBeAttached();
});

test('unfinished-drilldown', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const card = page.locator('#dashBelumSelesaiCard');
  await expect(card).toBeAttached({timeout:10000});
  await expect(card).toHaveAttribute('onclick', 'openDashboardUnfinishedReports()');
  const fnType = await page.evaluate(() => typeof window.openDashboardUnfinishedReports);
  expect(fnType).toBe('function');
});

test('dashboard-spare-part-table', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dashSparePartCard')).toBeAttached({timeout:10000});
  await expect(page.locator('#dashUnitBaruCard')).toBeAttached();
  await expect(page.locator('#dashSparePartStats')).toBeAttached();
  await expect(page.locator('#dashUnitBaruStats')).toBeAttached();
  await expect(page.locator('#statSparePartTotalQty')).toBeAttached();
  await expect(page.locator('#statUnitBaruTotalQty')).toBeAttached();
});

test('dashboard-mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dashboard = page.locator('#page-dashboard');
  await expect(dashboard).toBeAttached({timeout:10000});
  const overflow = await dashboard.evaluate(el => el.scrollWidth > el.clientWidth);
  expect(overflow, 'Dashboard must not overflow horizontally on mobile').toBeFalsy();
  const tableWraps = page.locator('.dashboard-new-item-table-wrap');
  await expect(tableWraps).toHaveCount(2, { timeout: 10000 });
});

test('SPMU empty selectors have no placeholder helper text', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#spmuUnitChoice')).toBeAttached({timeout:10000});
  await expect(page.locator('#spmuSpareChoice')).toBeAttached({timeout:10000});
  await expect(page.locator('#spmuUnitTitle')).toHaveText('UNIT');
  await expect(page.locator('#spmuSpareTitle')).toHaveText('SPARE PART / MATERIAL');
  await expect(page.locator('#spmuUnitSummary')).toHaveText('');
  await expect(page.locator('#spmuSpareSummary')).toHaveText('');
  await expect(page.locator('#spmuUnitChoice')).not.toContainText('Pilih UNIT');
  await expect(page.locator('#spmuSpareChoice')).not.toContainText('Pilih SPARE PART / MATERIAL');
});

test('mobile-input-keyboard-scroll-keeps-next-field-visible-checkpoint-mode', async ({ page }) => {
  await page.addInitScript(() => {
    const mockVisualViewport = {
      offsetTop: 0, height: 430,
      addEventListener() {}, removeEventListener() {}
    };
    try {
      Object.defineProperty(window, 'visualViewport', {
        configurable: true, get: () => mockVisualViewport
      });
    } catch (_) {}
  });

  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const appShell = page.locator('#appShell');
  await expect(appShell).toBeAttached();
  await appShell.evaluate(el => el.classList.remove('hidden'));

  const content = page.locator('main.content');
  const ruang = page.locator('#Ruang');
  const masalah = page.locator('#MasalahKegiatan');
  const tindakan = page.locator('#Tindakan');

  await expect(ruang).toBeAttached();
  await expect(masalah).toBeAttached();
  await expect(tindakan).toBeAttached();

  // Contract: production follows the 2026-10-05 checkpoint:
  // Android resizes the content viewport when the keyboard opens.
  const viewportMode = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewportMode).toContain('interactive-widget=resizes-content');

  // RUANG -> MASALAH/Kegiatan.
  await content.evaluate(el => { el.scrollTop = 0; });
  const masalahBefore = await masalah.evaluate(el => el.getBoundingClientRect().bottom);
  await ruang.focus();
  await page.waitForTimeout(700);
  const masalahAfter = await masalah.evaluate(el => el.getBoundingClientRect().bottom);

  expect(masalahAfter, 'Masalah/Kegiatan must be above the keyboard after Ruang focus')
    .toBeLessThanOrEqual(430 - 33);
  expect(masalahAfter, 'Masalah/Kegiatan must move upward proportionally')
    .toBeLessThan(masalahBefore);

  // MASALAH/Kegiatan -> TINDAKAN
  await content.evaluate(el => { el.scrollTop = 0; });
  const tindakanBefore = await tindakan.evaluate(el => el.getBoundingClientRect().bottom);
  await masalah.focus();
  await page.waitForTimeout(700);
  const tindakanAfter = await tindakan.evaluate(el => el.getBoundingClientRect().bottom);

  expect(tindakanAfter, 'Tindakan must be above the keyboard after Masalah/Kegiatan focus')
    .toBeLessThanOrEqual(430 - 33);
  expect(tindakanAfter, 'Tindakan must move upward proportionally')
    .toBeLessThan(tindakanBefore);

  expect(runtimeErrors, 'No runtime error may abort keyboard next-field scroll').toEqual([]);
});



test('area picker Item Baru opens modal and preserves selected item when fields are populated', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-input')).toBeAttached({ timeout: 10000 });
  await page.locator('#appShell').evaluate(el => el.classList.remove('hidden'));
  await expect(page.locator('#itemModalBg')).toBeAttached({ timeout: 10000 });

  const setup = await page.evaluate(() => {
    const area = document.getElementById('AreaKerja');
    const item = document.getElementById('Item');
    if (!area || !item || typeof window.buildAreaKerjaPicker_ !== 'function') {
      return { areaExists: !!area, itemExists: !!item, pickerBuilder: typeof window.buildAreaKerjaPicker_ };
    }

    // Arrange a realistic, already-filled form locally. No API calls or writes.
    const areaName = 'M.E. Umum';
    if (![...area.options].some(o => o.value === areaName)) area.add(new Option(areaName, areaName));
    area.value = areaName;
    item.innerHTML = '';
    item.add(new Option('Pilih item…', ''));
    item.add(new Option('Lampu LED', 'Lampu LED'));
    item.add(new Option('+ Tambah Item Baru', '__ADD_NEW__'));
    item.value = 'Lampu LED';
    window.buildAreaKerjaPicker_();
    return {
      areaExists: true,
      itemExists: true,
      pickerBuilder: typeof window.buildAreaKerjaPicker_,
      selectedArea: area.value,
      selectedItem: item.value
    };
  });

  expect(setup.areaExists && setup.itemExists, 'Area and Item controls must exist').toBeTruthy();
  expect(setup.pickerBuilder, 'Real area picker builder must be callable').toBe('function');
  expect(setup.selectedArea).toBe('M.E. Umum');
  expect(setup.selectedItem).toBe('Lampu LED');

  await page.locator('#areaKerjaPicker .area-picker-trigger').click();
  await page.locator('.area-item-picker-group-head').filter({ hasText: 'M.E.' }).first().click();
  await page.locator('.area-item-picker-area[data-area-value="M.E. Umum"]').click();
  await page.locator('.area-item-picker-add-item').click();

  await expect(page.locator('#itemModalBg')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#itemBaruAreaLabel')).toHaveText('M.E. Umum');
  await expect(page.locator('#itemBaruInput')).toBeVisible();
  await expect(page.locator('#Item')).toHaveValue('Lampu LED');
  expect(runtimeErrors, 'No runtime errors in the real picker click path').toEqual([]);
});

test('add-item modal opens from input form when report fields are populated', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Modal harus tersedia bersama fragment input, tanpa menunggu fragment Laporan.
  await expect(page.locator('#page-input')).toBeAttached({ timeout: 10000 });
  // Smoke test berjalan tanpa autentikasi; tampilkan shell seperti tes form mobile
  // agar visibility modal diuji, bukan status hidden pada shell login.
  await page.locator('#appShell').evaluate(el => el.classList.remove('hidden'));
  await expect(page.locator('#itemModalBg')).toBeAttached({ timeout: 10000 });
  await expect(page.locator('#itemBaruAreaLabel')).toBeAttached();
  await expect(page.locator('#itemBaruInput')).toBeAttached();

  // Isi form secara lokal saja. Tidak login, tidak memanggil simpan, dan tidak menulis ke API/DB.
  const setup = await page.evaluate(async () => {
    const values = {
      Tanggal: '2026-10-12',
      Pelapor: 'Uji Regresi',
      Ruang: 'Ruang Uji',
      MasalahKegiatan: 'Uji modal saat formulir terisi',
      Tindakan: 'Uji regresi tanpa menyimpan laporan'
    };
    const fields = {};
    for (const [id, value] of Object.entries(values)) {
      const el = document.getElementById(id);
      fields[id] = !!el;
      if (el) el.value = value;
    }

    const area = document.getElementById('AreaKerja');
    const item = document.getElementById('Item');
    if (area && ![...area.options].some(o => o.value === 'Rapat dan Pertemuan')) {
      area.add(new Option('Rapat dan Pertemuan', 'Rapat dan Pertemuan'));
    }
    if (area) area.value = 'Rapat dan Pertemuan';
    if (item && ![...item.options].some(o => o.value === '__ADD_NEW__')) {
      item.add(new Option('+ Tambah Item Baru', '__ADD_NEW__'));
    }
    if (item) item.value = '__ADD_NEW__';

    const handlerType = typeof window.handleItemChange;
    if (handlerType === 'function') window.handleItemChange();
    return new Promise(resolve => setTimeout(() => resolve({
      fields,
      areaExists: !!area,
      itemExists: !!item,
      handlerType,
      modalHasShow: !!document.getElementById('itemModalBg')?.classList.contains('show'),
      modalAreaLabel: document.getElementById('itemBaruAreaLabel')?.textContent
    }), 500));
  });

  expect(Object.values(setup.fields).every(Boolean), 'Representative report fields must exist').toBeTruthy();
  expect(setup.areaExists && setup.itemExists, 'Area and Item controls must exist').toBeTruthy();
  expect(setup.handlerType, 'The real Item change handler must be available').toBe('function');
  expect(setup.modalHasShow, 'Add-item modal must open after report fields have values').toBeTruthy();
  expect(setup.modalAreaLabel).toBe('Rapat dan Pertemuan');
  await expect(page.locator('#itemModalBg')).toBeVisible();
  expect(runtimeErrors, 'No runtime error may prevent opening the add-item modal').toEqual([]);
});


test('area picker stays open and explains when Item Baru is tapped without selecting an area', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-input')).toBeAttached({ timeout: 10000 });
  await page.locator('#appShell').evaluate(el => el.classList.remove('hidden'));

  const setup = await page.evaluate(() => {
    const area = document.getElementById('AreaKerja');
    const item = document.getElementById('Item');
    if (!area || !item || typeof window.buildAreaKerjaPicker_ !== 'function') {
      return { ready: false, builder: typeof window.buildAreaKerjaPicker_ };
    }
    area.value = '';
    item.value = '';
    window.buildAreaKerjaPicker_();
    return { ready: true, areaValue: area.value };
  });
  expect(setup.ready, 'Real area picker builder must be available').toBeTruthy();
  expect(setup.areaValue).toBe('');

  await page.locator('#areaKerjaPicker .area-picker-trigger').click();
  await expect(page.locator('#areaItemPickerModalBg')).toBeVisible();
  await page.locator('.area-item-picker-add-item').click();

  await expect(page.locator('#areaItemPickerModalBg')).toBeVisible();
  await expect(page.locator('.area-item-picker-item-list'))
    .toContainText('Pilih sub-area di kolom kiri dulu, lalu tekan Item Baru.');
  await expect(page.locator('#itemModalBg')).not.toBeVisible();
});


test('direct Area Kerja group selection is retained for Item Baru', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-input')).toBeAttached({ timeout: 10000 });
  await page.locator('#appShell').evaluate(el => el.classList.remove('hidden'));

  const setup = await page.evaluate(() => {
    const area = document.getElementById('AreaKerja');
    const item = document.getElementById('Item');
    if (!area || !item || typeof window.buildAreaKerjaPicker_ !== 'function') return false;
    if (![...area.options].some(o => o.value.trim().toLowerCase() === 'rapat/pertemuan')) {
      area.add(new Option('Rapat/Pertemuan', 'Rapat/Pertemuan'));
    }
    area.value = '';
    item.value = '';
    // Reproduce the production lifecycle: picker is built more than once before use.
    window.buildAreaKerjaPicker_();
    window.buildAreaKerjaPicker_();
    return [...area.options].some(o => o.value.trim().toLowerCase() === 'rapat/pertemuan');
  });
  expect(setup, 'Rapat/Pertemuan direct area must exist').toBeTruthy();

  await page.locator('#areaKerjaPicker .area-picker-trigger').click();
  await page.locator('.area-item-picker-group-head').filter({ hasText: 'Rapat/Pertemuan' }).click();
  await expect(page.locator('.area-item-picker-item-list')).not.toContainText('Pilih kelompok dan area kerja');
  await page.locator('.area-item-picker-add-item').click();

  await expect(page.locator('#itemModalBg')).toBeVisible({ timeout: 2500 });
  await expect(page.locator('#itemBaruAreaLabel')).toHaveText('Rapat/Pertemuan');
  expect(runtimeErrors, 'No runtime errors for direct group selection').toEqual([]);
});
