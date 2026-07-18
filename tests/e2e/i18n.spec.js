import { test, expect } from '@playwright/test';

// Language switcher: live EN↔DE re-render, persistence, shard sync attempt.

test('switching to German re-renders the whole UI live', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('view-settings h1').first()).toHaveText('Settings');
  await expect(page.locator('.dock-nav [data-route=""] .dock-label')).toHaveText('Home');

  // the PUT to /protected/preferences is fired even though the endpoint
  // doesn't exist server-side yet (freeshard#168)
  const putSent = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().includes('/core/protected/preferences'));
  await page.locator('[data-locale="de"]').click();
  await putSent;

  await expect(page.locator('view-settings h1').first()).toHaveText('Einstellungen');
  await expect(page.locator('.dock-nav [data-route=""] .dock-label')).toHaveText('Start');
  await expect(page).toHaveTitle('Shard [geszt8] - Einstellungen');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');

  // Intl formatting follows: German decimal comma in the disk usage line
  await expect(page.locator('view-settings')).toContainText('12,20');
});

test('German persists across client-side navigation and reload', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('[data-locale="de"]').click();
  await expect(page.locator('view-settings h1').first()).toHaveText('Einstellungen');

  await page.locator('.dock-nav [data-route=""]').click();
  await expect(page).toHaveTitle('Shard [geszt8] - Startseite');

  await page.reload();
  await expect(page).toHaveTitle('Shard [geszt8] - Startseite');
  expect(await page.evaluate(() => localStorage.getItem('sundial.locale'))).toBe('de');
});

test('switching back to English restores EN strings', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('[data-locale="de"]').click();
  await expect(page.locator('view-settings h1').first()).toHaveText('Einstellungen');
  await page.locator('[data-locale="en"]').click();
  await expect(page.locator('view-settings h1').first()).toHaveText('Settings');
  await expect(page.locator('.dock-nav [data-route=""] .dock-label')).toHaveText('Home');
});
