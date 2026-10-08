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
