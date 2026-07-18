import { test, expect } from '@playwright/test';

// Subpath serving: the same files must work at /sundial/ (coexistence
// deployment). Own routes/assets under the prefix; API stays absolute.

test('app boots at /sundial/ with a detected base', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/sundial/');

  await expect(page.locator('view-home')).toBeVisible();
  expect(await page.evaluate(() => window.SUNDIAL_BASE)).toBe('/sundial/');

  // own assets are fetched under the prefix, the API at absolute /core
  expect(requests.some((u) => u.includes('/sundial/js/main.js'))).toBe(true);
  expect(requests.some((u) => u.includes('/core/protected/apps'))).toBe(true);
  expect(requests.some((u) => u.includes('/sundial/core/'))).toBe(false);
});

test('navigation stays under the subpath, classic link appears', async ({ page }) => {
  await page.goto('/sundial/');
  await page.locator('.dock-nav [data-route="settings"]').click();
  await expect(page).toHaveURL('/sundial/settings');
  await expect(page.locator('view-settings')).toBeVisible();

  // "Classic UI" escape hatch is only shown when served under the subpath
  await expect(page.locator('.dock-classic')).toHaveAttribute('href', '/');
});

test('deep link under the subpath resolves via SPA fallback', async ({ page }) => {
  await page.goto('/sundial/terminals');
  await expect(page.locator('view-terminals')).toBeVisible();
  expect(await page.evaluate(() => window.SUNDIAL_BASE)).toBe('/sundial/');
});

test('no classic link when served at the root', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('fs-dock nav.dock')).toBeVisible();
  await expect(page.locator('.dock-classic')).toHaveCount(0);
});
