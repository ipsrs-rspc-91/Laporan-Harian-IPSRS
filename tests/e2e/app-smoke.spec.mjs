import { test, expect } from '@playwright/test';

test('Production IPSRS API returns the Stage 1 CORS preflight cache header', async ({ request }) => {
  const response = await request.fetch('https://tcrmlhfsroyhaxdfwyll.supabase.co/functions/v1/ipsrs-api', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:4173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,apikey'
    }
  });
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
  expect(response.headers()['access-control-max-age']).toBe('600');
});

test('Browser reuses cached preflight for repeated identical production API calls', async ({ page }) => {
  const apiUrl = 'https://tcrmlhfsroyhaxdfwyll.supabase.co/functions/v1/ipsrs-api';
  let optionsCount = 0;
  page.on('request', req => {
    if (req.url() === apiUrl && req.method() === 'OPTIONS') optionsCount += 1;
  });
  await page.goto('/');
  await page.evaluate(async (url) => {
    const init = {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid-stage1-smoke-token',
        apikey: 'invalid-stage1-smoke-key',
        'content-type': 'application/json'
      },
      body: '{}'
    };
    await fetch(url, init).catch(() => null);
    await fetch(url, init).catch(() => null);
  }, apiUrl);
  expect(optionsCount, 'two identical calls should need only one OPTIONS preflight while the cache is valid').toBe(1);
});

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
  const assets = ['/index.html', ...scriptAssets.map(src => src.startsWith('/') ? src : '/'+src.replace(/^\.\//,'')).filter((v,i,a)=>a.indexOf(v)===i)];
  for (const path of assets) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
  }
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
