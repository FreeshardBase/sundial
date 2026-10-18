import { test, expect } from '@playwright/test';

// OIDC login return: shard_core sends an unpaired browser to
// `/?oidc_rd=<authorize URL>`; after pairing the app must go there, and only
// there. Anonymity and pairing are stubbed per test via page.route so the
// mock server's shared STATE is never touched.

const ORIGIN = 'http://127.0.0.1:8021';
const AUTHORIZE = `${ORIGIN}/core/public/oidc/authorize?client_id=immich&response_type=code&state=s1`;
const rd = (url) => `oidc_rd=${encodeURIComponent(url)}`;

// Anonymous until a pairing POST succeeds; records every off-app hit.
async function stubShard(page) {
  const hits = { authorize: [], evil: [], pairs: 0 };
  let paired = false;
  await page.route('**/core/public/meta/whoami', (route) => route.fulfill({
    json: paired ? { type: 'terminal', id: 'abc123', name: 'Chrome on Linux' } : { type: 'anonymous' },
  }));
  await page.route('**/core/public/pair/terminal?**', (route) => {
    hits.pairs += 1;
    paired = true;
    return route.fulfill({ json: { id: 'abc123', name: 'Chrome on Linux' } });
  });
  await page.route('**/core/public/oidc/authorize**', (route) => {
    hits.authorize.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<p id="authorize-reached">authorize</p>' });
  });
  await page.route('https://evil.example/**', (route) => {
    hits.evil.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: 'evil' });
  });
  return hits;
}

async function pairWithCode(page) {
  await page.locator('#pair-code').fill('123456');
  await page.locator('.pair-form button[type=submit]').click();
}

test('anonymous landing with a valid oidc_rd: welcome -> pair -> authorize', async ({ page }) => {
  const hits = await stubShard(page);
  await page.goto(`/?${rd(AUTHORIZE)}`);

  // the return survives the boot redirect to welcome, and pairing is the action
  await expect(page).toHaveURL(`/welcome?${rd(AUTHORIZE)}`);
  const login = page.locator('.welcome-login');
  await expect(login).toContainText('Pair this device to continue');
  await expect(page.locator('.welcome-action')).toHaveCount(0);

  await login.getByRole('link').click();
  await expect(page).toHaveURL(`/pair?${rd(AUTHORIZE)}`);
  await expect(page.locator('.pair-app-login')).toBeVisible();

  await pairWithCode(page);
  await expect(page.locator('#authorize-reached')).toBeVisible();
  expect(page.url()).toBe(AUTHORIZE);
  expect(hits.authorize).toEqual([AUTHORIZE]);
  expect(hits.pairs).toBe(1);
});

test('already paired browser landing with oidc_rd goes straight to authorize', async ({ page }) => {
  const hits = await stubShard(page);
  await page.route('**/core/public/meta/whoami', (route) => route.fulfill({
    json: { type: 'terminal', id: 'abc123', name: 'Chrome on Linux' },
  }));
  await page.goto(`/?${rd(AUTHORIZE)}`);
  await expect(page.locator('#authorize-reached')).toBeVisible();
  expect(hits.authorize).toEqual([AUTHORIZE]);
  expect(hits.pairs).toBe(0);
});

test('?code= auto-pairing honours the return', async ({ page }) => {
  const hits = await stubShard(page);
  await page.goto(`/pair?code=123456&${rd(AUTHORIZE)}`);
  await expect(page.locator('#authorize-reached')).toBeVisible();
  expect(hits.authorize).toEqual([AUTHORIZE]);
});

test('works under the /sundial/ subpath', async ({ page }) => {
  const hits = await stubShard(page);
  await page.goto(`/sundial/?${rd(AUTHORIZE)}`);
  await expect(page).toHaveURL(`/sundial/welcome?${rd(AUTHORIZE)}`);
  await page.locator('.welcome-login').getByRole('link').click();
  await expect(page).toHaveURL(`/sundial/pair?${rd(AUTHORIZE)}`);
  await pairWithCode(page);
  await expect(page.locator('#authorize-reached')).toBeVisible();
  expect(hits.authorize).toEqual([AUTHORIZE]);
});

const INVALID = {
  'other origin': `https://evil.example/core/public/oidc/authorize?client_id=x`,
  'javascript: URL': 'javascript:window.__pwned=1',
  'protocol-relative': '//evil.example/core/public/oidc/authorize',
  'other path on this origin': `${ORIGIN}/core/public/oidc/token`,
  'backslash trick': 'https:\\\\evil.example/core/public/oidc/authorize',
};

for (const [name, bad] of Object.entries(INVALID)) {
  test(`invalid oidc_rd (${name}) is dropped: normal pairing, no navigation off-app`, async ({ page }) => {
    const hits = await stubShard(page);
    await page.goto(`/?${rd(bad)}`);

    // dropped at the boot redirect: plain welcome, corner pair control
    await expect(page).toHaveURL('/welcome');
    await expect(page.locator('.welcome-login')).toHaveCount(0);
    await page.locator('.welcome-action').click();
    await expect(page).toHaveURL('/pair');

    await pairWithCode(page);
    await expect(page.locator('view-home')).toBeVisible();
    expect(new URL(page.url()).origin).toBe(ORIGIN);
    expect(new URL(page.url()).pathname).toBe('/');
    expect(hits.pairs).toBe(1);
    expect(hits.authorize).toEqual([]);
    expect(hits.evil).toEqual([]);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });

  test(`invalid oidc_rd (${name}) kept in the pair URL is still not followed`, async ({ page }) => {
    const hits = await stubShard(page);
    await page.goto(`/pair?${rd(bad)}`);
    await expect(page.locator('.pair-app-login')).toHaveCount(0);
    await pairWithCode(page);
    await expect(page.locator('view-home')).toBeVisible();
    expect(new URL(page.url()).origin).toBe(ORIGIN);
    expect(hits.authorize).toEqual([]);
    expect(hits.evil).toEqual([]);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
}
