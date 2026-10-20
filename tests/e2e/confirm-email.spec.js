import { test, expect } from '@playwright/test';

// The confirmation landing: the mail link is `<shard>/?confirm_email=<token>`.
// It must work on a never-paired browser, at / and under /sundial/, and must
// only confirm on a click (scanners and prefetchers open links on their own).

const CONFIRM = '**/core/public/users/confirm-email';

// Records confirm POSTs; answers with `status` (204 = what shard_core sends
// whether or not the token matched).
async function stubConfirm(page, status = 204) {
  const posts = [];
  await page.route(CONFIRM, (route) => {
    posts.push(route.request().postDataJSON());
    return status === 204 ? route.fulfill({ status: 204 }) : route.fulfill({ status, json: { detail: 'x' } });
  });
  return posts;
}

// Let anything the view might fire on its own (a microtask, a timer, a
// follow-up fetch) run before asserting that it did not. Needs
// page.clock.install() before goto; a minute of fake time covers any timer.
async function drain(page) {
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(60_000);
  await page.waitForLoadState('networkidle');
}

test('lands on the confirm screen, strips the token, and does not confirm on its own', async ({ page }) => {
  const posts = await stubConfirm(page);
  await page.clock.install();
  await page.goto('/?confirm_email=tok-123');
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await expect(page).toHaveURL('/confirm-email');
  await expect(page).toHaveTitle('Shard [geszt8] - Confirm email');
  await drain(page);
  expect(posts).toEqual([]);

  await page.locator('[data-act="confirm"]').click();
  // hedged: the endpoint answers 204 whether or not the token matched
  await expect(page.locator('.confirm-email__sent')).toContainText('If the link was still valid');
  await expect(page.locator('view-confirm-email')).toContainText('valid for one hour');
  expect(posts).toEqual([{ token: 'tok-123' }]);
});

test('works on a never-paired browser: no redirect to welcome, continue leads there', async ({ page }) => {
  await page.route('**/core/public/meta/whoami', (route) => route.fulfill({ json: { type: 'anonymous' } }));
  const posts = await stubConfirm(page);
  await page.clock.install();
  await page.goto('/?confirm_email=tok-anon');
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await drain(page);
  await expect(page).toHaveURL('/confirm-email');
  await expect(page.locator('fs-dock nav')).toHaveCount(0);
  await expect(page.locator('.confirm-email__continue')).toHaveAttribute('href', '/welcome');

  await page.locator('[data-act="confirm"]').click();
  await expect(page.locator('.confirm-email__sent')).toBeVisible();
  expect(posts).toEqual([{ token: 'tok-anon' }]);
});

test('works under the /sundial/ base', async ({ page }) => {
  const posts = await stubConfirm(page);
  await page.goto('/sundial/?confirm_email=tok-sub');
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await expect(page).toHaveURL('/sundial/confirm-email');
  await expect(page.locator('.confirm-email__continue')).toHaveAttribute('href', '/sundial/');
  await page.locator('[data-act="confirm"]').click();
  await expect(page.locator('.confirm-email__sent')).toBeVisible();
  expect(posts).toEqual([{ token: 'tok-sub' }]);
});

test('the token URL is replaced, not kept in history', async ({ page }) => {
  await stubConfirm(page);
  await page.goto('/?confirm_email=tok-hist');
  await expect(page).toHaveURL('/confirm-email');
  await page.goBack();
  expect(page.url()).not.toContain('confirm_email');
});

test('boot requests do not carry the token in their Referer', async ({ page }) => {
  const referers = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/core/')) referers.push(r.headers().referer ?? ''); });
  await stubConfirm(page);
  await page.goto('/?confirm_email=tok-ref');
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(referers.length).toBeGreaterThan(0);
  expect(referers.filter((r) => r.includes('tok-ref'))).toEqual([]);
});

test('confirm is disabled while in flight; a 422 says the link is invalid', async ({ page }) => {
  let release;
  const held = new Promise((r) => { release = r; });
  const posts = [];
  await page.route(CONFIRM, async (route) => {
    posts.push(route.request().postDataJSON());
    await held;
    return route.fulfill({ status: 422, json: { detail: [] } });
  });
  await page.goto('/?confirm_email=tok-422');
  const button = page.locator('[data-act="confirm"]');
  await button.click();
  await expect(button).toBeDisabled();
  release();
  await expect(page.locator('.confirm-email__invalid')).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('a paired browser with an app login return still lands on the confirm screen', async ({ page }) => {
  const authorize = [];
  await page.route('**/core/public/oidc/authorize**', (route) => { authorize.push(route.request().url()); return route.fulfill({ body: 'authorize' }); });
  await stubConfirm(page);
  const rd = encodeURIComponent('http://127.0.0.1:8021/core/public/oidc/authorize?client_id=app');
  await page.goto(`/?confirm_email=tok-both&oidc_rd=${rd}`);
  await expect(page.locator('view-confirm-email [data-act="confirm"]')).toBeVisible();
  expect(authorize).toEqual([]);
});

test('rate limited: says so and keeps the button', async ({ page }) => {
  await stubConfirm(page, 429);
  await page.goto('/?confirm_email=tok-429');
  await page.locator('[data-act="confirm"]').click();
  await expect(page.locator('view-confirm-email .alert--warn')).toContainText('Too many confirmation attempts');
  await expect(page.locator('[data-act="confirm"]')).toBeEnabled();
});

test('a failed request never logs the token', async ({ page }) => {
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await stubConfirm(page, 500);
  await page.goto('/?confirm_email=secret-token-xyz');
  await page.locator('[data-act="confirm"]').click();
  await expect(page.locator('view-confirm-email .alert--danger')).toContainText('did not reach your Shard');
  expect(logs.some((l) => l.includes('Email confirmation request failed'))).toBe(true);
  expect(logs.filter((l) => l.includes('secret-token-xyz'))).toEqual([]);
});

test('without a token there is nothing to confirm', async ({ page }) => {
  const posts = await stubConfirm(page);
  await page.clock.install();
  await page.goto('/confirm-email');
  await expect(page.locator('.confirm-email__invalid')).toContainText('incomplete');
  await expect(page.locator('[data-act="confirm"]')).toHaveCount(0);
  await drain(page);
  expect(posts).toEqual([]);
});
