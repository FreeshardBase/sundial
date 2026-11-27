import { test, expect } from '@playwright/test';

// The app-shell owner-email hint (fs-owner-email-banner): shown across every
// route while the owner has no verified address (`email` null in
// GET /protected/users/me). The user row is stubbed per test via page.route so
// the mock server's shared state stays untouched.

const OWNER = { id: 1, username: 'owner', display_name: 'Max Mustermann', role: 'owner' };

function user(fields) {
  // Every existing test here models a candidate something was actually
  // attempted for; the "never sent" state gets its own test below with
  // pending_email_sent: false overridden explicitly.
  return { ...OWNER, email: null, pending_email: null, pending_email_sent: true, ...fields };
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
  await expect(banner(page).locator('.owner-email-banner__text')).toContainText('or send it again');
  await resend.click();
  await expect(page.locator('.toast--success .toast__title')).toHaveText('Confirmation email sent');
  await expect(page.locator('.toast--success .toast__msg')).toContainText('new@example.org');
  expect(calls).toEqual(['POST /core/protected/users/me/email/resend']);
  // Still unverified, so the hint stays.
  await expect(banner(page)).toBeVisible();
});

test('pending, never sent: offers Send, not a claim of an email that never went out', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org', pending_email_sent: false }));
  await page.goto('/');
  await expect(banner(page).locator('[data-act="resend"]')).toHaveText('Send');
  const text = banner(page).locator('.owner-email-banner__text');
  await expect(text).toContainText('Confirm your email address new@example.org');
  await expect(text).toContainText('Send yourself a confirmation link, then open it');
  await expect(text).not.toContainText('again');
});

test('pending, never sent: after a first send the hint switches to the resend wording', async ({ page }) => {
  const { calls } = await stubUser(page, user({ pending_email: 'new@example.org', pending_email_sent: false }));
  await page.goto('/');
  const send = banner(page).locator('[data-act="resend"]');
  await send.click();
  await expect(page.locator('.toast--success .toast__title')).toHaveText('Confirmation email sent');
  expect(calls).toEqual(['POST /core/protected/users/me/email/resend']);
  await expect(banner(page).locator('.owner-email-banner__text')).toContainText('or send it again');
  await expect(send).toHaveText('Send again');
});

test('pending, never sent: a first send from the banner also updates the Owner card', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org', pending_email_sent: false }));
  await page.goto('/settings');
  const card = page.locator('fs-owner-card .owner-card');
  await expect(card).toContainText('No confirmation email has been sent for this address yet.');
  await expect(card.locator('[data-act="resend"]')).toHaveText('Send');
  await banner(page).locator('[data-act="resend"]').click();
  await expect(page.locator('.toast--success')).toBeVisible();
  await expect(card).toContainText('Open the link in the confirmation email sent to this address');
  await expect(card).not.toContainText('No confirmation email has been sent');
  await expect(card.locator('[data-act="resend"]')).toHaveText('Resend');
});

test('pending, never sent: a failed first send keeps the never-sent wording', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org', pending_email_sent: false }), {
    resend: (route) => route.fulfill({ status: 500, json: { detail: 'Mail delivery failed.' } }),
  });
  await page.goto('/');
  await banner(page).locator('[data-act="resend"]').click();
  await expect(page.locator('.toast--error')).toBeVisible();
  const text = banner(page).locator('.owner-email-banner__text');
  await expect(text).toContainText('Send yourself a confirmation link, then open it');
  await expect(text).not.toContainText('again');
  await expect(banner(page).locator('[data-act="resend"]')).toHaveText('Send');
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
  await expect(banner(page).locator('.owner-email-banner__text')).toContainText('sende ihn erneut');
  await expect(banner(page).locator('[data-act="resend"]')).toHaveText('Erneut senden');
});

test('German copy renders for the pending, never-sent variant', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sundial.locale', 'de'));
  await stubUser(page, user({ pending_email: 'neu@example.org', pending_email_sent: false }));
  await page.goto('/');
  const text = banner(page).locator('.owner-email-banner__text');
  await expect(text).toContainText('Bestätige deine E-Mail-Adresse neu@example.org');
  await expect(text).toContainText('Sende dir einen Bestätigungslink');
  await expect(text).not.toContainText('erneut');
  await expect(banner(page).locator('[data-act="resend"]')).toHaveText('Senden');
});

test('the hint stays off the confirm-email page and returns elsewhere', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/?confirm_email=tok-hidden');
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await expect(page.locator('fs-owner-email-banner')).toBeAttached();
  await expect(banner(page)).toHaveCount(0);

  await page.goto('/');
  await expect(page.locator('view-home')).toBeVisible();
  await expect(banner(page)).toBeVisible();

  await page.goto('/settings');
  await expect(page.locator('view-settings')).toBeVisible();
  await expect(banner(page)).toBeVisible();

  await page.goBack();
  await expect(page.locator('view-home')).toBeVisible();
  await expect(banner(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator('view-confirm-email')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
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

// Confirming on a paired device refetches the user row, so the hint stays
// cleared once the owner moves on, without a manual reload.
test('confirming on a paired device clears the shell banner', async ({ page }) => {
  let row = user({ pending_email: 'new@example.org' });
  await page.route('**/core/protected/settings', (route) => route.fulfill({ json: { email_enabled: true } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), (route) => route.fulfill({ json: row }));
  await page.route('**/core/public/users/confirm-email', (route) => {
    row = user({ email: 'new@example.org' });
    return route.fulfill({ status: 200, json: { status: 'confirmed', email: 'new@example.org' } });
  });
  await page.goto('/?confirm_email=tok-paired');
  await expect(page.locator('view-confirm-email')).toBeVisible();

  await page.locator('[data-act="confirm"]').click();
  await expect(page.locator('.confirm-email__confirmed')).toBeVisible();

  await page.goto('/settings');
  await expect(banner(page)).toHaveCount(0);
});
