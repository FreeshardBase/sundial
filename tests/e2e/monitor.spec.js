import { test, expect } from '@playwright/test';

// Resource monitor: sparklines fed by polling the mock /protected/stats
// snapshot endpoint (freeshard#155 shape).

test('CPU + memory sparklines render with live data', async ({ page }) => {
  await page.goto('/');
  const monitor = page.locator('fs-resource-monitor');
  await expect(monitor).toBeVisible();

  await expect(monitor.locator('.monitor-card')).toHaveCount(2);
  await expect(monitor.locator('.monitor-card__head').first()).toContainText(/cpu/i);
  await expect(monitor.locator('.monitor-card__head').nth(1)).toContainText(/memory/i);

  // both sparklines draw an SVG value path (may be a single point right
  // after boot — zero-size, so assert the path data, not visibility)
  await expect(monitor.locator('fs-sparkline svg').first()).toBeVisible();
  await expect(monitor.locator('[data-kind="cpu"] svg path').first()).toHaveAttribute('d', /M /);
  await expect(monitor.locator('[data-kind="mem"] svg path').first()).toHaveAttribute('d', /M /);

  // live values, honest units
  await expect(monitor.locator('.monitor-card__head .mono').first()).toContainText('%');
  await expect(monitor.locator('.monitor-card__head .mono').nth(1)).toContainText('GiB');
});

test('sparkline grows as new samples arrive', async ({ page }) => {
  await page.goto('/');
  const cpuPath = page.locator('fs-resource-monitor [data-kind="cpu"] svg path').first();
  await expect(cpuPath).toHaveAttribute('d', /M /);
  const before = await cpuPath.getAttribute('d');
  // sample interval is 5s — wait for at least one more sample
  await expect(async () => {
    const after = await cpuPath.getAttribute('d');
    expect(after).not.toBe(before);
    expect(after.length).toBeGreaterThan(before.length);
  }).toPass({ timeout: 12_000 });
});
