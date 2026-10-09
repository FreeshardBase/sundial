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

// A store catalogue carrying per-app minimum_freeshard_version (freeshard#246),
// flat on the entry exactly as the published catalogue serves it.
const VERSION_GATED_STORE = {
  apps: [
    { name: 'anyapp', app_version: '1.0.0', icon: 'icon.svg',
      store_info: { description_short: 'No version requirement' } },
    { name: 'oldapp', app_version: '1.0.0', icon: 'icon.svg', minimum_freeshard_version: '1.0.0',
      store_info: { description_short: 'Runs on any recent shard' } },
    { name: 'edgeapp', app_version: '1.0.0', icon: 'icon.svg', minimum_freeshard_version: '1.4.0',
      store_info: { description_short: 'Needs exactly this shard' } },
    { name: 'futureapp', app_version: '1.0.0', icon: 'icon.svg', minimum_freeshard_version: '2.0.0',
      store_info: { description_short: 'Needs a newer shard' } },
  ],
};

test('available apps whose minimum_freeshard_version exceeds the shard are hidden', async ({ page }) => {
  await page.route('**/store_metadata.json*', (route) => route.fulfill({ json: VERSION_GATED_STORE }));
  // Shard runs 1.4.0 (also the dev-server mock default, pinned here for clarity).
  await page.route('**/core/public/meta/version*', (route) => route.fulfill({ json: { version: '1.4.0' } }));
  await page.goto('/apps');

  const available = page.locator('view-apps section').nth(1).locator('.store-card');
  // anyapp (no min), oldapp (1.0.0 ≤ 1.4.0) and edgeapp (1.4.0 == 1.4.0) show;
  // futureapp (2.0.0 > 1.4.0) is hidden.
  await expect(available).toHaveCount(3);
  await expect(page.locator('[data-name="oldapp"]')).toBeVisible();
  await expect(page.locator('[data-name="edgeapp"]')).toBeVisible();
  await expect(page.locator('[data-name="futureapp"]')).toHaveCount(0);
});

test('when the shard version is unreadable, apps declaring a minimum fail safe to hidden', async ({ page }) => {
  await page.route('**/store_metadata.json*', (route) => route.fulfill({ json: VERSION_GATED_STORE }));
  // An old shard predating the endpoint: it 404s. Every app that declares any
  // minimum is hidden (we can't confirm the shard is new enough); only apps
  // with no requirement at all remain offered.
  await page.route('**/core/public/meta/version*', (route) => route.fulfill({ status: 404, body: 'not found' }));
  await page.goto('/apps');

  const available = page.locator('view-apps section').nth(1).locator('.store-card');
  await expect(available).toHaveCount(1);
  await expect(page.locator('[data-name="anyapp"]')).toBeVisible();
  await expect(page.locator('[data-name="oldapp"]')).toHaveCount(0);
  await expect(page.locator('[data-name="edgeapp"]')).toHaveCount(0);
  await expect(page.locator('[data-name="futureapp"]')).toHaveCount(0);
});

test('store outage degrades gracefully', async ({ page }) => {
  await page.unroute('**/store_metadata.json*');
  await page.route('**/store_metadata.json*', (route) => route.abort());
  await page.goto('/apps');
  // installed apps still render from the shard API; store failure is flagged
  await expect(page.locator('view-apps section').nth(0).locator('.store-card')).toHaveCount(4);
  await expect(page.locator('.alert--warn')).toContainText(/store/i);
});
