import { test, expect } from '@playwright/test';

// Settings → Owner card: the owner's user row (GET/PATCH /protected/users/me)
// and its email states. Every state and transition is stubbed per test via
// page.route — the mock server's shared state stays untouched.

const OWNER = { id: 1, username: 'owner', display_name: 'Max Mustermann', role: 'owner' };

function user(fields) {
  return { ...OWNER, email: null, pending_email: null, ...fields };
}

// Serves GET /users/me from `reads` (the last one repeats), GET /settings,
// and records every non-GET call to /users/me* so tests can assert bodies.
async function stubOwner(page, { reads, emailEnabled = true, patch, resend, discard }) {
  const calls = [];
  let n = 0;
  await page.route('**/core/protected/settings', (route) =>
    route.fulfill({ json: { email_enabled: emailEnabled } }));
  await page.route((url) => url.pathname.startsWith('/core/protected/users/me'), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname.endsWith('/users/me')) {
      const body = reads[Math.min(n, reads.length - 1)];
      n += 1;
      return route.fulfill({ json: body });
    }
    calls.push({ method: req.method(), path: url.pathname, body: req.postDataJSON?.() ?? null });
    if (req.method() === 'PATCH' && patch) return patch(route, req.postDataJSON());
    if (url.pathname.endsWith('/email/resend') && resend) return resend(route);
    if (url.pathname.endsWith('/email/pending') && discard) return discard(route);
    return route.fulfill({ status: 500, json: { detail: 'unstubbed' } });
  });
  return { calls, reads: () => n };
}

async function editField(page, field, value) {
  const el = page.locator(`fs-owner-card .owner-${field}`);
  await el.locator('[data-act="edit"]').click();
  await el.locator('input').fill(value);
  await el.locator('input').press('Enter');
}

const card = (page) => page.locator('fs-owner-card .owner-card');

test('set: shows the owner row, not identity or profile, with no pending block', async ({ page }) => {
  await stubOwner(page, { reads: [user({ display_name: 'Row Name', email: 'row@example.org' })] });
  await page.goto('/settings');
  await expect(card(page).locator('.owner-name .editable-value')).toHaveText('Row Name');
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('row@example.org');
  await expect(card(page).locator('.pending-change')).toHaveCount(0);
  await expect(card(page).locator('[data-email-state="none"]')).toHaveCount(0);
  // the card is the first one in the grid
  await expect(page.locator('.settings-grid > *').first()).toHaveJSProperty('tagName', 'FS-OWNER-CARD');
});

test('none: a prompt, not an error', async ({ page }) => {
  await stubOwner(page, { reads: [user({})] });
  await page.goto('/settings');
  const hint = card(page).locator('[data-email-state="none"]');
  await expect(hint).toContainText('No address yet.');
  await expect(hint).toContainText('so we can reach you');
  await expect(card(page).locator('.alert')).toHaveCount(0);
});

test('pending: live address plus the candidate, with resend and discard', async ({ page }) => {
  await stubOwner(page, { reads: [user({ email: 'old@example.org', pending_email: 'new@example.org' })] });
  await page.goto('/settings');
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('old@example.org');
  const pending = card(page).locator('.pending-change');
  await expect(pending.locator('.pending-change__value')).toHaveText('new@example.org');
  await expect(pending).toContainText('valid for one hour');
  await expect(pending.locator('[data-act="resend"]')).toBeVisible();
  await expect(pending.locator('[data-act="discard"]')).toBeVisible();
});

test('an email edit in progress survives a Settings re-render', async ({ page }) => {
  const stub = await stubOwner(page, { reads: [user({ email: 'old@example.org' })] });
  await page.goto('/settings');
  const field = card(page).locator('.owner-email');
  await field.locator('[data-act="edit"]').click();
  await field.locator('input').fill('half-typed@exa');
  // a WS disk update re-renders the whole Settings view
  await page.evaluate(async () => {
    const { store } = await import('/js/store.js');
    store.set({ disk_usage: { ...store.state.disk_usage, free_gb: 3, disk_space_warning: true } });
  });
  await expect(page.locator('.disk-gauge-info .alert--warn')).toBeVisible();
  await expect(card(page).locator('.owner-email input')).toHaveValue('half-typed@exa');
  await expect(card(page).locator('.owner-email input')).toBeFocused();
  expect(stub.reads()).toBe(1);
});

test('an email edit in progress survives a name save rebuilding the card', async ({ page }) => {
  let releaseName;
  const nameHeld = new Promise((r) => { releaseName = r; });
  await stubOwner(page, {
    reads: [user({ email: 'old@example.org' })],
    patch: async (route, body) => {
      await nameHeld;
      return route.fulfill({ json: user({ email: 'old@example.org', ...body }) });
    },
  });
  await page.goto('/settings');
  await editField(page, 'name', 'Erika Musterfrau');
  const email = card(page).locator('.owner-email');
  await email.locator('[data-act="edit"]').click();
  await email.locator('input').fill('half-typed@exa');
  releaseName();
  await expect(card(page).locator('.owner-name .editable-value')).toHaveText('Erika Musterfrau');
  await expect(email.locator('input')).toHaveValue('half-typed@exa');
  await expect(email.locator('input')).toBeFocused();
});

test('confirming an unchanged address sends nothing', async ({ page }) => {
  const { calls } = await stubOwner(page, { reads: [user({ email: 'row@example.org' })] });
  await page.goto('/settings');
  await editField(page, 'email', ' row@example.org ');
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('row@example.org');
  await expect(card(page).locator('.pending-change')).toHaveCount(0);
  expect(calls).toEqual([]);
});

test('name writes through with PATCH {display_name}', async ({ page }) => {
  const { calls } = await stubOwner(page, {
    reads: [user({ email: 'row@example.org' })],
    patch: (route, body) => route.fulfill({ json: user({ email: 'row@example.org', ...body }) }),
  });
  await page.goto('/settings');
  await editField(page, 'name', '  Erika Musterfrau ');
  await expect(card(page).locator('.owner-name .editable-value')).toHaveText('Erika Musterfrau');
  expect(calls).toEqual([{ method: 'PATCH', path: '/core/protected/users/me', body: { display_name: 'Erika Musterfrau' } }]);
});

test('a new address becomes the pending candidate; the live value stays', async ({ page }) => {
  const { calls } = await stubOwner(page, {
    reads: [user({ email: 'old@example.org' })],
    patch: (route, body) => route.fulfill({ json: user({ email: 'old@example.org', pending_email: body.email }) }),
  });
  await page.goto('/settings');
  await editField(page, 'email', 'new@example.org');
  await expect(card(page).locator('.pending-change__value')).toHaveText('new@example.org');
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('old@example.org');
  await expect(page.locator('.toast--success .toast__title')).toHaveText('Confirmation email sent');
  expect(calls[0].body).toEqual({ email: 'new@example.org' });
});

test('emptying the field clears the address with PATCH {email: null}', async ({ page }) => {
  const { calls } = await stubOwner(page, {
    reads: [user({ email: 'old@example.org' })],
    patch: (route) => route.fulfill({ json: user({}) }),
  });
  await page.goto('/settings');
  await editField(page, 'email', '   ');
  await expect(card(page).locator('[data-email-state="none"]')).toBeVisible();
  expect(calls[0].body).toEqual({ email: null });
});

test('502 from PATCH: the stored candidate is shown from a refetch, not reported as a failed save', async ({ page }) => {
  // First read: no candidate. Later reads: the candidate as shard_core stored
  // it (normalised domain), so only the recovery refetch can put it on screen.
  const stub = await stubOwner(page, {
    reads: [user({ email: 'old@example.org' }), user({ email: 'old@example.org', pending_email: 'new@example.org' })],
    patch: (route) => route.fulfill({
      status: 502,
      json: { detail: 'The address was saved but the confirmation email could not be sent. Send it again in a moment.' },
    }),
  });
  await page.goto('/settings');
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('old@example.org');
  await expect(card(page).locator('.pending-change')).toHaveCount(0);

  await editField(page, 'email', 'new@EXAMPLE.ORG');
  const pending = card(page).locator('.pending-change');
  await expect(pending.locator('.pending-change__value')).toHaveText('new@example.org');
  await expect(pending.locator('.pending-change__notice')).toContainText('was saved, but the confirmation email could not be sent');
  await expect(pending.locator('[data-act="resend"]')).toBeVisible();
  await expect(page.locator('.toast--error')).toHaveCount(0);
  expect(stub.reads()).toBeGreaterThanOrEqual(2);
});

test('a successful resend clears the delivery-failed message', async ({ page }) => {
  const { calls } = await stubOwner(page, {
    reads: [user({}), user({ pending_email: 'new@example.org' })],
    patch: (route) => route.fulfill({ status: 502, json: { detail: 'The address was saved but the confirmation email could not be sent.' } }),
    resend: (route) => route.fulfill({ status: 204 }),
  });
  await page.goto('/settings');
  await editField(page, 'email', 'new@example.org');
  const pending = card(page).locator('.pending-change');
  await expect(pending.locator('.pending-change__notice')).toBeVisible();

  await pending.locator('[data-act="resend"]').click();
  await expect(page.locator('.toast--success .toast__title')).toHaveText('Confirmation email sent');
  await expect(pending.locator('.pending-change__notice')).toHaveCount(0);
  await expect(pending.locator('.pending-change__note')).toContainText('valid for one hour');
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
    'PATCH /core/protected/users/me',
    'POST /core/protected/users/me/email/resend',
  ]);
});

test('a proxy 502 without the API body is a failed save, not a stored candidate', async ({ page }) => {
  await stubOwner(page, {
    reads: [user({ email: 'old@example.org' })],
    patch: (route) => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>' }),
  });
  await page.goto('/settings');
  await editField(page, 'email', 'new@example.org');
  await expect(page.locator('.toast--error .toast__title')).toHaveText('Could not save the address');
  await expect(card(page).locator('.pending-change')).toHaveCount(0);
});

test('429 shows the rate-limit detail', async ({ page }) => {
  await stubOwner(page, {
    reads: [user({})],
    patch: (route) => route.fulfill({ status: 429, json: { detail: 'Too many confirmation emails requested. Try again later.' } }),
  });
  await page.goto('/settings');
  await editField(page, 'email', 'new@example.org');
  await expect(page.locator('.toast--error .toast__msg')).toHaveText('Too many confirmation emails requested. Try again later.');
  await expect(card(page).locator('.pending-change')).toHaveCount(0);
});

test('403 says only the owner can change the address', async ({ page }) => {
  await stubOwner(page, {
    reads: [user({})],
    patch: (route) => route.fulfill({ status: 403, json: { detail: "Only the shard owner's address can be set from here." } }),
  });
  await page.goto('/settings');
  await editField(page, 'email', 'new@example.org');
  await expect(page.locator('.toast--error .toast__msg')).toHaveText("Only the Shard's owner can change this address.");
});

test('discard drops the candidate', async ({ page }) => {
  const { calls } = await stubOwner(page, {
    reads: [user({ email: 'old@example.org', pending_email: 'new@example.org' })],
    discard: (route) => route.fulfill({ status: 204 }),
  });
  await page.goto('/settings');
  await card(page).locator('[data-act="discard"]').click();
  await expect(card(page).locator('.pending-change')).toHaveCount(0);
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('old@example.org');
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['DELETE /core/protected/users/me/email/pending']);
});

test('verification disabled: the address is set directly, no resend control', async ({ page }) => {
  await stubOwner(page, {
    reads: [user({})],
    emailEnabled: false,
    patch: (route, body) => route.fulfill({ json: user({ email: body.email }) }),
  });
  await page.goto('/settings');
  await expect(card(page).locator('[data-email-state="direct"]')).toContainText('cannot send email');
  // no promise of mail the shard cannot send
  await expect(card(page).locator('[data-email-state="none"]')).not.toContainText('reach you');

  await editField(page, 'email', 'direct@example.org');
  await expect(card(page).locator('.owner-email .editable-value')).toHaveText('direct@example.org');
  await expect(card(page).locator('.pending-change')).toHaveCount(0);
  await expect(card(page).locator('[data-act="resend"]')).toHaveCount(0);
});

test('verification disabled with a leftover candidate: discard only, no resend', async ({ page }) => {
  await stubOwner(page, { reads: [user({ pending_email: 'stale@example.org' })], emailEnabled: false });
  await page.goto('/settings');
  await expect(card(page).locator('.pending-change__value')).toHaveText('stale@example.org');
  await expect(card(page).locator('[data-act="discard"]')).toBeVisible();
  await expect(card(page).locator('[data-act="resend"]')).toHaveCount(0);
});

test('an unreadable owner row says so instead of spinning', async ({ page }) => {
  await page.route('**/core/protected/users/me', (route) => route.fulfill({ status: 500, json: { detail: 'boom' } }));
  await page.goto('/settings');
  await expect(card(page).locator('.alert')).toContainText('could not be loaded');
  await expect(card(page).locator('fs-editable-text')).toHaveCount(0);
});

test('the About list no longer carries the controller copy of owner and email', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.about-fields')).toContainText('Shard ID');
  // the mock profile still has owner / owner_email: they must not render
  await expect(page.locator('.about-fields')).not.toContainText('max@example.org');
  await expect(page.locator('.about-fields .fs-label', { hasText: /^Owner/ })).toHaveCount(0);
});
