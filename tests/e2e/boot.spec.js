import { test, expect } from '@playwright/test';

// Boot/hydrate: the app loads with no build step, hydrates the store from
// the mock API, renders Home, and keeps the updates WebSocket connected.

test('app boots and hydrates from the API', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Shard [geszt8] - Home');
  await expect(page.locator('#splash')).toHaveCount(0);
  await expect(page.locator('view-home')).toBeVisible();

  // 4 mock apps, no "add app" tile and no "apps" header on the grid
  await expect(page.locator('.app-grid fs-app-tile')).toHaveCount(4);
  await expect(page.locator('.app-tile--add')).toHaveCount(0);
  await expect(page.locator('.home-status')).toHaveCount(0);

  // summary hydrated from /stats/disk and /terminals
  await expect(page.locator('.summary-card')).toContainText('12.2 / 29.4 GiB');
  await expect(page.locator('.summary-card')).toContainText('2 paired');
});

test('dock renders shard badge and all nav items', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('fs-dock nav.dock');
  await expect(dock).toBeVisible();
  await expect(dock.locator('fs-shard-badge')).toHaveAttribute('shard-id', 'geszt8');
  await expect(dock.locator('.dock-nav .dock-item')).toHaveCount(5);
  await expect(dock.locator('[data-route=""]').last()).toHaveAttribute('aria-current', 'page');
});

test('websocket connects — no disconnected warning after the grace period', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('fs-dock nav.dock')).toBeVisible();
  // dock shows the warning only after its 5s grace timer — outwait it
  await page.waitForTimeout(6500);
  await expect(page.locator('.dock-status--warn')).toHaveCount(0);
});

test('update available: persistent banner shows text + refresh button, no duplicate dock icon', async ({ page }) => {
  // Simulate a newer deployed build without touching the shared mock server's
  // state: stub version.json for the first request only, then let reload
  // through so clicking Refresh can be observed clearing the banner.
  let first = true;
  await page.route('**/version.json*', (route) => {
    if (first) { first = false; return route.fulfill({ json: { version: '9.9.9' } }); }
    return route.continue();
  });

  await page.goto('/');
  const banner = page.locator('.update-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('9.9.9');
  // the old icon-only dock affordance is replaced by the banner, not duplicated
  await expect(page.locator('.dock-update')).toHaveCount(0);

  await Promise.all([
    page.waitForNavigation(),
    banner.locator('.update-banner__refresh').click(),
  ]);
  await expect(page.locator('.update-banner')).toHaveCount(0);
});
