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
  const assets = [
    '/index.html',
    '/app.js?v=20261001-MONTHPICKER2',
    '/config.js?v=20260928-AUDITTOTAL3',
    '/laporan-fast-v2.js?v=20260928-AUDITTOTAL3',
    '/login-fast.js?v=20260928-AUDITTOTAL3',
    '/dashboard-loading-v2.js?v=20260928-AUDITTOTAL3',
    '/access-policy-ui.js?v=20260928-AUDITTOTAL3',
    '/sw.js?v=20260928-AUDITTOTAL3'
  ];

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
