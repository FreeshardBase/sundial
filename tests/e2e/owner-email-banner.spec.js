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
  await expect(link).toHaveAttribute('href', /\/settings$/);
});

test('no address: the link opens the Owner card and the hint persists there', async ({ page }) => {
  await stubUser(page, user({}));
  await page.goto('/');
  await banner(page).locator('.owner-email-banner__action').click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('fs-owner-card .owner-card')).toBeVisible();
  // The hint is app-wide: it stays on Settings, not only on Home.
  await expect(banner(page)).toBeVisible();
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
  await expect(page.locator('.toast--success .toast__msg')).toContainText('new@example.org');
  expect(calls).toEqual(['POST /core/protected/users/me/email/resend']);
  // Still unverified, so the hint stays.
  await expect(banner(page)).toBeVisible();
});

test('pending: resend is disabled while the request is in flight', async ({ page }) => {
  let release;
  const held = new Promise((r) => { release = r; });
  await stubUser(page, user({ pending_email: 'new@example.org' }), {
    resend: async (route) => { await held; return route.fulfill({ status: 204 }); },
  });
  await page.goto('/');
  const resend = banner(page).locator('[data-act="resend"]');
  await resend.click();
  await expect(resend).toBeDisabled();
  release();
  await expect(page.locator('.toast--success')).toBeVisible();
  await expect(banner(page).locator('[data-act="resend"]')).toBeEnabled();
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

test('German copy renders for the no-address variant', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sundial.locale', 'de'));
  await stubUser(page, user({}));
  await page.goto('/');
  await expect(banner(page)).toContainText('keine bestätigte E-Mail-Adresse');
  await expect(banner(page).locator('.owner-email-banner__action')).toHaveText('Adresse hinzufügen');
});

test('German copy renders for the pending variant', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sundial.locale', 'de'));
  await stubUser(page, user({ pending_email: 'neu@example.org' }));
  await page.goto('/');
  await expect(banner(page)).toContainText('Bestätige deine E-Mail-Adresse neu@example.org');
  await expect(banner(page).locator('[data-act="resend"]')).toHaveText('Erneut senden');
});

// An edit made in the real Owner card must flow through the store into the
// shell banner without a reload — the point of the card's #commitUser sync.
test('adding an address in the Owner card updates the shell banner live', async ({ page }) => {
  let row = user({});
  await page.route('**/core/protected/settings', (route) => route.fulfill({ json: { email_enabled: true } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: row });
    row = user({ pending_email: req.postDataJSON().email });
    return route.fulfill({ json: row });
  });
  await page.goto('/settings');
  await expect(banner(page)).toContainText('no confirmed email address');

  const field = page.locator('fs-owner-card .owner-email');
  await field.locator('[data-act="edit"]').click();
  await field.locator('input').fill('new@example.org');
  await field.locator('input').press('Enter');

  await expect(banner(page)).toContainText('Confirm your email address new@example.org');
  await expect(banner(page).locator('[data-act="resend"]')).toBeVisible();
});

// Confirming on a paired device refetches the user row, so the banner clears
// without a manual reload.
test('confirming on a paired device clears the shell banner', async ({ page }) => {
  let row = user({ pending_email: 'new@example.org' });
  await page.route('**/core/protected/settings', (route) => route.fulfill({ json: { email_enabled: true } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), (route) => route.fulfill({ json: row }));
  await page.route('**/core/public/users/confirm-email', (route) => {
    row = user({ email: 'new@example.org' });
    return route.fulfill({ status: 204 });
  });
  await page.goto('/?confirm_email=tok-paired');
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await expect(banner(page)).toBeVisible();

  await page.locator('[data-act="confirm"]').click();
  await expect(page.locator('.confirm-email__sent')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});
