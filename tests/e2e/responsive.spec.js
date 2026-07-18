import { test, expect } from '@playwright/test';

// Responsive extremes: small mobile and a large desktop viewport.

test.describe('mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('home renders without horizontal overflow, dock reachable at the bottom', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('view-home')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const dock = page.locator('fs-dock nav.dock');
    await expect(dock).toBeVisible();
    const box = await dock.boundingBox();
    // bottom-docked and within the viewport
    expect(box.y + box.height).toBeLessThanOrEqual(844 + 1);
    expect(box.y).toBeGreaterThan(844 / 2);
  });

  test('settings cards stack and stay usable', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('view-settings h1').first()).toBeVisible();
    const cards = page.locator('.settings-grid .settings-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
    // single column: consecutive cards align at the same x
    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    expect(Math.round(a.x)).toBe(Math.round(b.x));
  });
});

test.describe('large screen (2560x1440)', () => {
  test.use({ viewport: { width: 2560, height: 1440 } });

  test('home uses the two-column layout: apps beside the monitor', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('view-home')).toBeVisible();

    const columns = await page.locator('.home-layout').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);

    const apps = await page.locator('.home-apps').boundingBox();
    const monitor = await page.locator('.home-monitor').boundingBox();
    expect(monitor.x).toBeGreaterThan(apps.x + apps.width - 1);
  });
});
