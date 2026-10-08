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

  // All deferred SPA pages must eventually mount before a user can navigate to them.
  // This catches the blank-screen race independently of authentication state.
  await expect(page.locator('#page-dashboard')).toBeAttached({timeout:10000});
  await expect(page.locator('#page-laporan')).toBeAttached({timeout:10000});
  await expect(page.locator('#page-online')).toBeAttached({timeout:10000});

  // Auth bootstrap can take a few seconds; the expected unauthenticated state is
  // the login screen, while authenticated sessions may legitimately show the app shell.
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

  // Derive the asset URLs from the same index.html that production serves.
  // This prevents the smoke test from silently testing obsolete hard-coded
  // cache versions after a frontend JS update.
  const scriptAssets = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)]
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


test('mobile-input-keyboard-scroll-keeps-next-field-visible', async ({ page }) => {
  // Deterministic keyboard simulation: Android Chrome reduces the visual
  // viewport when the keyboard opens. Mock that geometry so CI can verify
  // the same scroll contract without requiring a physical Android keyboard.
  await page.addInitScript(() => {
    const mockVisualViewport = {
      offsetTop: 0,
      height: 430,
      addEventListener() {},
      removeEventListener() {}
    };
    try {
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        get: () => mockVisualViewport
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
  const masalah = page.locator('#MasalahKegiatan');
  const tindakan = page.locator('#Tindakan');

  await expect(masalah).toBeAttached();
  await expect(tindakan).toBeAttached();

  await content.evaluate(el => { el.scrollTop = 0; });
  await masalah.focus();
  await page.waitForTimeout(700);

  const result = await page.evaluate(() => {
    const content = document.querySelector('main.content');
    const target = document.getElementById('Tindakan');
    const vv = window.visualViewport;
    const keyboardTop = (vv?.offsetTop || 0) + (vv?.height || window.innerHeight);
    const gap = keyboardTop - target.getBoundingClientRect().bottom;
    return {
      scrollTop: content ? content.scrollTop : 0,
      targetBottom: target.getBoundingClientRect().bottom,
      keyboardTop,
      gap
    };
  });

  expect(result.scrollTop, 'Form must scroll upward when Masalah/Kegiatan is focused').toBeGreaterThan(0);
  expect(result.gap, 'Tindakan must be visible above the simulated keyboard').toBeGreaterThanOrEqual(20);
  expect(runtimeErrors, 'No runtime error may abort keyboard scroll').toEqual([]);
});
