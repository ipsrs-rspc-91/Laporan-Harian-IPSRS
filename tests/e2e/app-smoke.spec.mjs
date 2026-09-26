import { test, expect } from '@playwright/test';

test('IPSRS unauthenticated startup smoke test', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#authLoading')).toBeVisible();
  await expect(page.locator('#loginScreen')).toBeAttached();
  await expect(page.locator('#appShell')).toBeAttached();

  // Allow the auth bootstrap/login UI to settle.
  await page.waitForTimeout(4000);

  const criticalErrors = consoleErrors.filter(msg =>
    !/favicon|Failed to load resource: the server responded with a status of 404/i.test(msg)
  );

  expect(criticalErrors, 'Critical browser console/page errors').toEqual([]);
});

test('IPSRS critical frontend assets are reachable', async ({ request }) => {
  const assets = [
    '/index.html',
    '/app.js?v=20260926-SAVEMODAL1',
    '/config.js?v=SUPABASE-CUTOVER-20260923-3',
    '/laporan-fast-v2.js?v=20260926-LAPORANFAST3',
    '/login-fast.js?v=20260924-PASSWORD7',
    '/dashboard-loading-v2.js?v=20260924-DASHFAST1'
  ];

  for (const path of assets) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
  }
});
