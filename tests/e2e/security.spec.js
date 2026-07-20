import { test, expect } from '@playwright/test';

// Security regressions: headers, CSP enforcement, XSS sinks (markdown from
// the public identity + CMS banners), WS payload validation, URL guards.
// All hostile input arrives via route interception — the mock server's
// STATE is never touched.

const EVIL_MD = [
  'Hello **bold** [ok](https://example.com)',
  '<script>window.__xss = 1</script>',
  '<img src="x.png" onerror="window.__xss = 2">',
  '[evil](javascript:window.__xss=3)',
  '<a href="https://example.com" onclick="window.__xss = 4">click</a>',
].join('\n\n');

test('security headers are served and extend the meta CSP', async ({ page, request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");

  await page.goto('/');
  const metaCsp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(headers['content-security-policy']).toBe(`${metaCsp}; frame-ancestors 'none'`);
  expect(metaCsp).not.toContain('unsafe-inline');
  expect(metaCsp).not.toContain('unsafe-eval');
});

test('no CSP violations while visiting every view', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} <- ${e.blockedURI || 'inline'}`);
    });
  });
  for (const route of ['', 'apps', 'terminals', 'peers', 'public', 'settings', 'welcome', 'pair']) {
    await page.goto(`/${route}`);
    await page.waitForLoadState('networkidle');
  }
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test('hostile markdown in the public identity is sanitized on /welcome', async ({ page }) => {
  await page.route('**/core/public/meta/whoareyou', async (route) => {
    const body = await (await route.fetch()).json();
    await route.fulfill({ json: { ...body, description: EVIL_MD } });
  });
  await page.goto('/welcome');

  const desc = page.locator('.welcome-desc');
  // benign markdown still renders — the sanitizer must not nuke content
  await expect(desc.locator('strong')).toHaveText('bold');
  await expect(desc.locator('a[href="https://example.com"]').first()).toBeVisible();
  // the DOM-shape assertions are the load-bearing ones: even with the
  // sanitizer deleted the CSP would stop __xss from firing, but these
  // attributes/elements would appear in the DOM and turn the test red.
  await expect(desc.locator('script')).toHaveCount(0);
  await expect(desc.locator('[onerror], [onclick]')).toHaveCount(0);
  await expect(desc.locator('a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('hostile markdown in a CMS banner is sanitized', async ({ page }) => {
  await page.route('**/cnc/banners.json', (route) => route.fulfill({
    json: { banners: [{ content_md: EVIL_MD, variant: 'info' }] },
  }));
  await page.goto('/');

  const banner = page.locator('fs-banner .banner');
  await expect(banner.locator('strong')).toHaveText('bold');
  await expect(banner.locator('script')).toHaveCount(0);
  await expect(banner.locator('[onerror], [onclick]')).toHaveCount(0);
  await expect(banner.locator('a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('malformed WS payloads are dropped; valid ones still apply', async ({ page }) => {
  let server;
  await page.routeWebSocket(/\/core\/protected\/ws\/updates/, (ws) => { server = ws; });
  await page.goto('/');
  await expect(page.locator('.summary-card')).toContainText('12.2 / 29.4 GiB');
  await expect.poll(() => !!server).toBe(true);

  server.send('not json at all');
  server.send(JSON.stringify({ message_type: 'disk_usage_update',
    message: { total_gb: '<script>x</script>', free_gb: null } }));
  server.send(JSON.stringify({ message_type: 'apps_update', message: { name: 'not-a-list' } }));
  // valid update proves the socket path still works after the garbage
  server.send(JSON.stringify({ message_type: 'disk_usage_update',
    message: { total_gb: 29.4, free_gb: 9.4, disk_space_low: false } }));

  await expect(page.locator('.summary-card')).toContainText('20.0 / 29.4 GiB');
  await expect(page.locator('.app-grid fs-app-tile')).toHaveCount(4);
});

test('a javascript: approval_url from the subscribe API never navigates', async ({ page }) => {
  await page.route('**/management/api/shards/self/subscribe', (route) => route.fulfill({
    json: { approval_url: 'javascript:window.__pwned = 1' },
  }));
  await page.goto('/settings');
  await page.locator('[data-act="subscribe"]').click();

  // guarded path: bad URL is treated as missing -> error toast, no navigation
  await expect(page.locator('.toast--error')).toContainText('No approval URL');
  expect(page.url()).toContain('/settings');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('sanitize module primitives reject dangerous input', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const { sanitizeHtml, isSafeHttpUrl } = await import('./js/sanitize.js');
    return {
      script: sanitizeHtml('<script>bad()</script>hi'),
      onerror: sanitizeHtml('<img src="x.png" onerror="bad()">'),
      jsHref: sanitizeHtml('<a href="javascript:bad()">x</a>'),
      styleTag: sanitizeHtml('<style>*{display:none}</style>ok'),
      unwrap: sanitizeHtml('<article>kept text</article>'),
      good: sanitizeHtml('<b>b</b> <a href="https://example.com" title="t">a</a>'),
      jsUrl: isSafeHttpUrl('javascript:bad()'),
      dataUrl: isSafeHttpUrl('data:text/html,x'),
      relative: isSafeHttpUrl('/relative'),
      https: isSafeHttpUrl('https://www.paypal.com/manage'),
    };
  });
  expect(r.script).toBe('hi');
  expect(r.onerror).not.toContain('onerror');
  expect(r.jsHref).not.toContain('javascript:');
  expect(r.styleTag).toBe('ok');
  expect(r.unwrap).toBe('kept text');
  expect(r.good).toContain('href="https://example.com"');
  expect(r.good).toContain('rel="noopener noreferrer"');
  expect(r.jsUrl).toBe(false);
  expect(r.dataUrl).toBe(false);
  expect(r.relative).toBe(false);
  expect(r.https).toBe(true);
});
