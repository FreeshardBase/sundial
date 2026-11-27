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
// /users/me* so tests can assert nothing was submitted.
async function stubUser(page, row) {
  const calls = [];
  await page.route('**/core/protected/settings', (route) =>
    route.fulfill({ json: { email_enabled: true } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname.endsWith('/users/me')) return route.fulfill({ json: row });
    calls.push(`${req.method()} ${url.pathname}`);
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
  page.locator('.toast--success .toast__title', { hasText: 'Your email address was updated' });

test('a confirmed address pushed over WS clears the banner without a reload', async ({ page }) => {
  await stubUser(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/');
  await expect(banner(page)).toBeVisible();

  await push(page, user({ email: 'new@example.org' }));
  await expect(banner(page)).toHaveCount(0);
});

test('an address change closes an open email edit without submitting it, and says so', async ({ page }) => {
  const { calls } = await stubUser(page, user({ pending_email: 'new@example.org' }));
  await page.goto('/settings');
  await emailField(page).locator('[data-act="edit"]').click();
  await emailField(page).locator('input').fill('half-typed@exa');

  await push(page, user({ email: 'new@example.org' }));
  await expect(emailField(page).locator('input')).toHaveCount(0);
  await expect(emailField(page).locator('.editable-value')).toHaveText('new@example.org');
  await expect(page.locator('fs-owner-card .pending-change')).toHaveCount(0);
  await expect(addressToast(page)).toBeVisible();
  expect(calls).toEqual([]);
});

test('a push that leaves the address alone keeps an open edit and shows no toast', async ({ page }) => {
  await stubUser(page, user({ email: 'old@example.org' }));
  await page.goto('/settings');
  await emailField(page).locator('[data-act="edit"]').click();
  await emailField(page).locator('input').fill('half-typed@exa');

  await push(page, user({ email: 'old@example.org', display_name: 'Erika Musterfrau' }));
  // The push was applied: the card shows the new name.
  await expect(page.locator('fs-owner-card .owner-name .editable-value')).toHaveText('Erika Musterfrau');
  await expect(emailField(page).locator('input')).toHaveValue('half-typed@exa');
  await expect(addressToast(page)).toHaveCount(0);
});
