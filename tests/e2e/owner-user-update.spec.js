import { test, expect } from '@playwright/test';

// owner_user_update: the server's WS push after any change to the owner's
// row. Each push goes through ws.js's real handle(), so validation, the store
// patch and the onMessage() dispatch are all exercised. The initial row is
// stubbed via page.route so the mock server's shared state stays untouched.

const OWNER = { id: 1, username: 'owner', display_name: 'Max Mustermann', role: 'owner' };

function user(fields) {
  return { ...OWNER, email: null, pending_email: null, pending_email_sent: true, ...fields };
}

// Serves GET /users/me and GET /settings, and records every other call to
// /users/me* so tests can assert nothing was submitted. `patch`, if given,
// answers PATCH /users/me.
async function stubOwner(page, row, { patch } = {}) {
  const calls = [];
  await page.route('**/core/protected/settings', (route) =>
    route.fulfill({ json: { email_enabled: true } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname.endsWith('/users/me')) return route.fulfill({ json: row });
    calls.push(`${req.method()} ${url.pathname}`);
    if (req.method() === 'PATCH' && patch) return patch(route, req.postDataJSON());
    return route.fulfill({ status: 500, json: { detail: 'unstubbed' } });
  });
  return { calls };
}

async function push(page, row) {
  await page.evaluate(async (message) => {
    const { handle } = await import('/js/ws.js');
    handle({ message_type: 'owner_user_update', message });
  }, row);
}

const banner = (page) => page.locator('.owner-email-banner');
const emailField = (page) => page.locator('fs-owner-card .owner-email');
const addressToast = (page) =>
  page.locator('.toast--success .toast__title', { hasText: 'Email address changed' });
const pendingToast = (page) =>
  page.locator('.toast--success .toast__title', { hasText: 'Unconfirmed address changed' });

async function startEmailEdit(page, value) {
  await emailField(page).locator('[data-act="edit"]').click();
  await emailField(page).locator('input').fill(value);
}

test('a confirmed address pushed over WS clears the banner without a reload', async ({ page }) => {
  await stubOwner(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/');
  await expect(banner(page)).toBeVisible();

  await push(page, user({ email: 'new@example.org' }));
  await expect(banner(page)).toHaveCount(0);
});

test('an address change closes an open email edit without submitting it, and says so', async ({ page }) => {
  const { calls } = await stubOwner(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/settings');
  await startEmailEdit(page, 'half-typed@exa');

  await push(page, user({ email: 'new@example.org' }));
  await expect(emailField(page).locator('input')).toHaveCount(0);
  await expect(emailField(page).locator('.editable-value')).toHaveText('new@example.org');
  await expect(page.locator('fs-owner-card .pending-change')).toHaveCount(0);
  await expect(addressToast(page)).toBeVisible();
  await expect(pendingToast(page)).toHaveCount(0);
  await expect(emailField(page).locator('[data-act="edit"]')).toBeFocused();
  expect(calls).toEqual([]);
});

test('a push that leaves the address alone keeps an open edit and shows no toast', async ({ page }) => {
  await stubOwner(page, user({ email: 'old@example.org' }));
  await page.goto('/settings');
  await startEmailEdit(page, 'half-typed@exa');

  await push(page, user({ email: 'old@example.org', display_name: 'Erika Musterfrau' }));
  await expect(page.locator('fs-owner-card .owner-name .editable-value')).toHaveText('Erika Musterfrau');
  await expect(emailField(page).locator('input')).toHaveValue('half-typed@exa');
  await expect(addressToast(page)).toHaveCount(0);
  await expect(pendingToast(page)).toHaveCount(0);
});

test('a new candidate set elsewhere closes an open edit, though the live address stays', async ({ page }) => {
  await stubOwner(page, user({ email: 'old@example.org' }));
  await page.goto('/settings');
  await startEmailEdit(page, 'half-typed@exa');

  await push(page, user({ email: 'old@example.org', pending_email: 'other@example.org' }));
  await expect(emailField(page).locator('input')).toHaveCount(0);
  await expect(page.locator('fs-owner-card .pending-change__value')).toHaveText('other@example.org');
  await expect(pendingToast(page)).toBeVisible();
  await expect(addressToast(page)).toHaveCount(0);
});

test('a live address set directly elsewhere closes an open edit', async ({ page }) => {
  // A shard that cannot send mail takes the address as typed: only `email` moves.
  await stubOwner(page, user({ email: 'old@example.org' }));
  await page.goto('/settings');
  await startEmailEdit(page, 'half-typed@exa');

  await push(page, user({ email: 'other@example.org' }));
  await expect(emailField(page).locator('input')).toHaveCount(0);
  await expect(emailField(page).locator('.editable-value')).toHaveText('other@example.org');
  await expect(addressToast(page)).toBeVisible();
});

test("the push for this device's own save leaves the saving field to finish", async ({ page }) => {
  // The server pushes before it answers the PATCH (the mail goes out in between).
  let release;
  const held = new Promise((r) => { release = r; });
  await stubOwner(page, user({ email: 'old@example.org' }), {
    patch: async (route) => {
      await held;
      return route.fulfill({ json: user({ email: 'old@example.org', pending_email: 'new@example.org' }) });
    },
  });
  await page.goto('/settings');
  await startEmailEdit(page, 'new@example.org');
  await emailField(page).locator('input').press('Enter');
  await expect(emailField(page).locator('input')).toBeDisabled();

  await push(page, user({ email: 'old@example.org', pending_email: 'new@example.org' }));
  await expect(pendingToast(page)).toBeVisible();
  await expect(emailField(page).locator('input')).toBeDisabled();

  release();
  await expect(emailField(page).locator('input')).toHaveCount(0);
  await expect(page.locator('.toast--success .toast__title', { hasText: 'Confirmation email sent' })).toBeVisible();
  await expect(page.locator('fs-owner-card .pending-change__value')).toHaveText('new@example.org');
});

test('a card left behind by navigating away stops listening', async ({ page }) => {
  await stubOwner(page, user({}));
  await page.goto('/settings');
  await expect(emailField(page)).toBeVisible();
  await page.evaluate(async () => {
    const { navigate } = await import('/js/router.js');
    navigate('');
  });
  await expect(page.locator('fs-owner-card')).toHaveCount(0);

  await push(page, user({ pending_email: 'new@example.org' }));
  await expect(banner(page)).toContainText('new@example.org');
  await expect(addressToast(page)).toHaveCount(0);
  await expect(pendingToast(page)).toHaveCount(0);
});
