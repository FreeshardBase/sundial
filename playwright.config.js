import { defineConfig, devices } from '@playwright/test';

// E2e runs against the mock-API dev server (tools/dev_server.py) on :8021.
// Keep specs read-only towards the mock server's STATE — workers share it.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8021',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'uv run tools/dev_server.py',
    url: 'http://127.0.0.1:8021/version.json',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
