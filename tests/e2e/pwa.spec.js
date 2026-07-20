import { test, expect } from '@playwright/test';

// PWA installability: the manifest is linked and valid, its icons resolve as
// real files (the SPA fallback would serve index.html for a missing path, so
// byte-check), and the minimal passthrough service worker registers — at the
// root AND under /sundial/. No offline caching: a controlled page must still
// get live responses.

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

for (const base of ['/', '/sundial/']) {
  test(`manifest is linked, parses and its icons resolve at ${base}`, async ({ page, request }) => {
    await page.goto(base);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const path = await page.evaluate((h) => new URL(h, document.baseURI).pathname, href);
    expect(path).toBe(`${base}manifest.webmanifest`);

    const res = await request.get(path);
    expect(res.status()).toBe(200);
    const manifest = JSON.parse(await res.text());
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      const iconRes = await request.get(base + icon.src);
      expect(iconRes.status(), icon.src).toBe(200);
      const body = await iconRes.body();
      expect(body.subarray(0, 4).equals(PNG_MAGIC), `${icon.src} must be a real PNG`).toBe(true);
    }
  });

  test(`service worker registers with scope ${base}`, async ({ page }) => {
    await page.goto(base);
    const scope = await page.evaluate(async () =>
      (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe(base);
  });
}

test('controlled page still works: live data, working app, zero CSP violations', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} <- ${e.blockedURI || 'inline'}`);
    });
  });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator('view-home')).toBeVisible();

  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toContain('sw.js');
  // passthrough proof: a fetch through the controlled page hits the network
  const version = await page.evaluate(() => fetch('version.json').then((r) => r.json()));
  expect(version.version).toBeTruthy();
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});
