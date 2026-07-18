import { test, expect } from '@playwright/test';

// History-API routing: dock navigation stays client-side, deep links and
// unknown paths resolve through the SPA fallback.

test('dock navigation is client-side across views', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('view-home')).toBeVisible();
  // marker survives only if no full page load happens
  await page.evaluate(() => { window.__noReload = true; });

  await page.locator('.dock-nav [data-route="apps"]').click();
  await expect(page).toHaveURL('/apps');
  await expect(page.locator('view-apps')).toBeVisible();
  await expect(page).toHaveTitle('Shard [geszt8] - Apps');

  await page.locator('.dock-nav [data-route="settings"]').click();
  await expect(page).toHaveURL('/settings');
  await expect(page.locator('view-settings')).toBeVisible();

  await page.locator('.dock-nav [data-route="terminals"]').click();
  await expect(page).toHaveURL('/terminals');
  await expect(page.locator('view-terminals')).toBeVisible();

  expect(await page.evaluate(() => window.__noReload)).toBe(true);
});

test('browser back returns to the previous view', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dock-nav [data-route="public"]').click();
  await expect(page.locator('view-public')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('view-home')).toBeVisible();
});

test('deep link straight into a view works', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('view-settings')).toBeVisible();
  await expect(page.locator('view-settings h1').first()).toContainText('Settings');
});

test('unknown path falls back to home', async ({ page }) => {
  await page.goto('/definitely-not-a-view');
  await expect(page.locator('view-home')).toBeVisible();
});
