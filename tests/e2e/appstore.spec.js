import { test, expect } from '@playwright/test';

// App store: installed + available cards and the detail modal. The Azure
// blob metadata is stubbed via route interception — tests stay hermetic and
// never mutate the mock server's app state.

const STORE_APPS = {
  apps: [
    { name: 'filebrowser', app_version: '2.33.0', icon: 'icon.svg',
      store_info: { description_short: 'Browse and manage your files', is_featured: true } },
    { name: 'navidrome', app_version: '0.52.0', icon: 'icon.svg',
      store_info: {
        description_short: 'Your music, streamed',
        description_long: ['Navidrome streams your own music collection.'],
        hint: 'Point your Subsonic client at the app URL.',
        is_featured: true,
      } },
    { name: 'linkding', app_version: '1.31.0', icon: 'icon.svg',
      store_info: { description_short: 'Bookmark manager' } },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/store_metadata.json*', (route) =>
    route.fulfill({ json: STORE_APPS }));
});

test('installed and available sections render, featured first', async ({ page }) => {
  await page.goto('/apps');

  const sections = page.locator('view-apps section');
  const installed = sections.nth(0).locator('.store-card');
  await expect(installed).toHaveCount(4);
  await expect(installed.first()).toContainText('File Browser');
  // Status is a symbol+tooltip next to the name, not a text line.
  await expect(installed.first().locator('.store-card__name .fs-dot')).toBeVisible();
  await expect(installed.first().locator('.store-card__mark:has(.fs-dot)')).toHaveAttribute('title', 'App is running');

  // available = store minus installed; featured (navidrome) sorts first
  const available = sections.nth(1).locator('.store-card');
  await expect(available).toHaveCount(2);
  await expect(available.nth(0)).toContainText('navidrome');
  await expect(available.nth(0).locator('.store-card__mark--featured')).toBeVisible();
  await expect(available.nth(1)).toContainText('linkding');
});

test('update detection: version drift shows the update alert and card mark', async ({ page }) => {
  await page.goto('/apps');
  // installed filebrowser 2.32.0 vs store 2.33.0
  await expect(page.locator('.store-update-alert')).toContainText('one app with an update');
  await expect(page.locator('[data-name="filebrowser"] .store-card__mark--update')).toBeVisible();
});

test('detail modal for an available app offers install', async ({ page }) => {
  await page.goto('/apps');
  await page.locator('.store-card[data-name="navidrome"]').click();

  const modal = page.locator('[role="dialog"]').last();
  await expect(modal).toContainText('Navidrome streams your own music collection.');
  await expect(modal).toContainText('Point your Subsonic client at the app URL.');
  await expect(modal.getByRole('button', { name: /install/i })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('detail modal for an errored app offers reinstall and remove', async ({ page }) => {
  await page.goto('/apps');
  await page.locator('.store-card[data-name="mealie"]').click();

  const modal = page.locator('[role="dialog"]').last();
  await expect(modal).toContainText('error');
  await expect(modal.getByRole('button', { name: /reinstall/i })).toBeVisible();
  await expect(modal.getByRole('button', { name: /remove/i })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('store outage degrades gracefully', async ({ page }) => {
  await page.unroute('**/store_metadata.json*');
  await page.route('**/store_metadata.json*', (route) => route.abort());
  await page.goto('/apps');
  // installed apps still render from the shard API; store failure is flagged
  await expect(page.locator('view-apps section').nth(0).locator('.store-card')).toHaveCount(4);
  await expect(page.locator('.alert--warn')).toContainText(/store/i);
});
