import { test, expect } from '@playwright/test';

// The app-shell owner-email hint (fs-owner-email-banner): shown across every
// route while the owner has no verified address (`email` null in
// GET /protected/users/me). The user row is stubbed per test via page.route so
// the mock server's shared state stays untouched.

const OWNER = { id: 1, username: 'owner', display_name: 'Max Mustermann', role: 'owner' };

function user(fields) {
  return { ...OWNER, email: null, pending_email: null, ...fields };
}

// Serves GET /users/me from `row`, GET /settings from `emailEnabled`, and
// records resend calls.
async function stubUser(page, row, { resend, emailEnabled = true } = {}) {
  const calls = [];
  await page.route('**/core/protected/settings', (route) =>
    route.fulfill({ json: { email_enabled: emailEnabled } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname.endsWith('/users/me')) return route.fulfill({ json: row });
    calls.push(`${req.method()} ${url.pathname}`);
    if (url.pathname.endsWith('/email/resend')) return (resend ?? ((r) => r.fulfill({ status: 204 })))(route);
    return route.fulfill({ status: 500, json: { detail: 'unstubbed' } });
  });
  return { calls };
}

const banner = (page) => page.locator('.owner-email-banner');

test('a verified address shows no hint', async ({ page }) => {
  await stubUser(page, user({ email: 'owner@example.org' }));
  await page.goto('/');
  await expect(page.locator('view-home')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test('no address: the hint shows app-wide, on Home, and links to the Owner card', async ({ page }) => {
  await stubUser(page, user({}));
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('no confirmed email address');
  await expect(banner(page)).toContainText('some apps may not be able to sign you in');
  const link = banner(page).locator('.owner-email-banner__action');
  await expect(link).toHaveText('Add an address');
  await expect(link).toHaveAttribute('href', /settings\?section=owner$/);
});

test('no address: the link opens Settings scrolled to the Owner card', async ({ page }) => {
  await stubUser(page, user({}));
  await page.goto('/');
  await banner(page).locator('.owner-email-banner__action').click();
  await expect(page).toHaveURL(/\/settings\?section=owner$/);
  await expect(page.locator('fs-owner-card .owner-card')).toBeInViewport();
});

test('pending: the hint names the candidate and resends from the inbox', async ({ page }) => {
  const { calls } = await stubUser(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/');
  await expect(banner(page)).toContainText('Confirm your email address new@example.org');
  await expect(banner(page)).toContainText('some apps may not be able to sign you in');
  const resend = banner(page).locator('[data-act="resend"]');
  await expect(resend).toHaveText('Send again');
  await resend.click();
  await expect(page.locator('.toast--success .toast__title')).toHaveText('Confirmation email sent');
  expect(calls).toEqual(['POST /core/protected/users/me/email/resend']);
  // Still unverified, so the hint stays.
  await expect(banner(page)).toBeVisible();
});

test('pending: a failed resend reports the error and keeps the hint', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org' }), {
    resend: (route) => route.fulfill({ status: 429, json: { detail: 'Too many confirmation emails requested. Try again later.' } }),
  });
  await page.goto('/');
  await banner(page).locator('[data-act="resend"]').click();
  await expect(page.locator('.toast--error .toast__msg')).toHaveText('Too many confirmation emails requested. Try again later.');
  await expect(banner(page)).toBeVisible();
});

test('mail disabled: a leftover candidate still shows only the no-address variant', async ({ page }) => {
  // A self-hosted shard cannot send mail, so a leftover pending_email is
  // unconfirmable: offer "add an address", never a resend that would fail.
  await stubUser(page, user({ pending_email: 'stale@example.org' }), { emailEnabled: false });
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('no confirmed email address');
  await expect(banner(page).locator('[data-act="resend"]')).toHaveCount(0);
  await expect(banner(page).locator('.owner-email-banner__action')).toHaveText('Add an address');
});

test('a member session with no address sees no owner hint', async ({ page }) => {
  await stubUser(page, user({ role: 'member' }));
  await page.goto('/');
  await expect(page.locator('view-home')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test('the hint clears once the address is verified', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await page.evaluate(async () => {
    const { store } = await import('/js/store.js');
    store.set({ user: { ...store.state.user, email: 'new@example.org', pending_email: null } });
  });
  await expect(banner(page)).toHaveCount(0);
});

test('German copy renders for the no-address hint', async ({ page }) => {
  await stubUser(page, user({}));
  await page.addInitScript(() => localStorage.setItem('sundial.locale', 'de'));
  await page.goto('/');
  await expect(banner(page)).toContainText('keine bestätigte E-Mail-Adresse');
  await expect(banner(page).locator('.owner-email-banner__action')).toHaveText('Adresse hinzufügen');
});
