import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory frontend',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 15000
  },
  reporter: [['list'], ['json', { outputFile: 'audit-output/playwright-results.json' }]]
});
