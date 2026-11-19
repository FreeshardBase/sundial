import { test, expect } from '@playwright/test';

// Devices → "Not fully unpaired yet": unpaired devices that still hold undelivered
// app lockouts. GET /protected/terminals/unpaired is stubbed per test via
// page.route, and the retry/dismiss endpoints answer 204 while recording the
// call — the mock server's shared STATE stays untouched. Live updates are
// simulated by patching the store directly (the same module instance ws.js
// writes to), as in shard-down-overlay.spec.js.

function device(fields) {
  return {
    id: 'dev1', name: 'Old Laptop', icon: 'notebook',
    paired_at: '2026-02-10T09:12:00Z',
    last_connection: '2026-11-01T09:12:00Z',
    unpaired_at: '2026-11-18T09:12:00Z',
    lockouts: [{ app_name: 'immich', state: 'waiting_for_start' }],
    ...fields,
  };
}

const FAILED = device({
  id: 'dev2', name: 'Lost Phone', icon: 'smartphone',
  lockouts: [{ app_name: 'immich', state: 'failed' }, { app_name: 'vaultwarden', state: 'retrying' }],
});

async function stubUnpaired(page, list, { actionStatus = 204 } = {}) {
  const calls = [];
  await page.route((url) => url.pathname.startsWith('/core/protected/terminals/unpaired'), (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname === '/core/protected/terminals/unpaired') {
      return route.fulfill({ json: list });
    }
    calls.push({ method: req.method(), path: url.pathname });
    if (actionStatus >= 400) return route.fulfill({ status: actionStatus, json: { detail: 'nope' } });
    return route.fulfill({ status: actionStatus });
  });
  return calls;
}

async function setUnpaired(page, list) {
  await page.evaluate(async (l) => {
    const { store } = await import('./js/store.js');
    store.set({ unpaired_terminals: l });
  }, list);
}

const section = (page) => page.locator('.unpaired-section');
const pills = (page) => page.locator('.unpaired-pill');

test('no section when there are no unpaired devices', async ({ page }) => {
  await stubUnpaired(page, []);
  await page.goto('/terminals');
  await expect(page.locator('view-terminals')).toBeVisible();
  await expect(section(page)).toHaveCount(0);
});

test('the section uses unpair wording, not disconnect', async ({ page }) => {
  await stubUnpaired(page, [device({})]);
  await page.goto('/terminals');
  await expect(section(page)).toContainText('Not fully unpaired yet');
  await expect(page.locator('.unpaired-info')).toHaveAttribute('aria-label', 'About devices not fully unpaired yet');
  await page.locator('.unpaired-info').click();
  await expect(page.locator('.modal-sheet .modal-title h2')).toHaveText('Not fully unpaired yet');
});

test('the section sits below "Pair new device", resting just above the dock', async ({ page }) => {
  await stubUnpaired(page, [device({})]);
  await page.goto('/terminals');
  await expect(section(page)).toBeVisible();
  const button = await page.locator('.pair-new').boundingBox();
  const box = await section(page).boundingBox();
  const dock = await page.locator('.dock').boundingBox();
  const viewport = page.viewportSize();
  // below everything else, the button included
  expect(box.y).toBeGreaterThan(button.y + button.height);
  // never overlapping the dock
  expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
  // short page: pushed down to the bottom of the viewport's content area, so
  // the gap to the dock is the view's dock clearance only, not free page space
  expect(box.y + box.height).toBeGreaterThan(viewport.height / 2);
  const clearance = await page.locator('#view').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(Math.abs(viewport.height - clearance - (box.y + box.height))).toBeLessThanOrEqual(1);
});

test('on a long page the section follows the button and still ends above the dock', async ({ page }) => {
  const many = Array.from({ length: 24 }, (_, i) => ({
    id: `t${i}`, name: `Device ${i}`, icon: 'notebook', last_connection: '2026-11-01T09:12:00Z',
  }));
  await page.route((url) => url.pathname === '/core/protected/terminals', (route) => route.fulfill({ json: many }));
  await stubUnpaired(page, [device({})]);
  await page.goto('/terminals');
  await expect(page.locator('.terminal-card')).toHaveCount(24);
  await section(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const button = await page.locator('.pair-new').boundingBox();
  const box = await section(page).boundingBox();
  const dock = await page.locator('.dock').boundingBox();
  expect(box.y).toBeGreaterThan(button.y + button.height);
  // follows the button directly: only the section's own top margin between them
  expect(box.y - (button.y + button.height)).toBeLessThan(80);
  expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
});

test('a paired device card offers "Unpair device", not "Remove"', async ({ page }) => {
  await stubUnpaired(page, []);
  await page.goto('/terminals');
  const card = page.locator('.terminal-card[data-id="def456"]');
  await card.locator('[data-act="edit"]').click();
  const unpair = card.locator('[data-act="unpair"]');
  await expect(unpair).toHaveAttribute('aria-label', 'Unpair device');
  await unpair.click();
  const modal = page.locator('.modal-sheet');
  await expect(modal).toContainText('Unpair device');
  await expect(modal.locator('[data-act="unpair"]')).toHaveText('Unpair');
  // read-only towards the mock STATE: cancel instead of confirming
  await modal.locator('[data-act="cancel"]').click();
});

test('one device shows one pill, several show several', async ({ page }) => {
  await stubUnpaired(page, [device({}), FAILED, device({ id: 'dev3', name: 'Tablet' })]);
  await page.goto('/terminals');
  await expect(section(page)).toBeVisible();
  await expect(pills(page)).toHaveCount(3);
  await expect(pills(page).filter({ hasText: 'Old Laptop' })).toHaveCount(1);
});

test('a failed lockout gives the pill the distinct failed styling', async ({ page }) => {
  await stubUnpaired(page, [device({}), FAILED]);
  await page.goto('/terminals');
  await expect(pills(page).filter({ hasText: 'Lost Phone' })).toHaveClass(/unpaired-pill--failed/);
  await expect(pills(page).filter({ hasText: 'Old Laptop' })).not.toHaveClass(/unpaired-pill--failed/);
});

test('info popup explains what not fully unpaired devices are', async ({ page }) => {
  await stubUnpaired(page, [device({})]);
  await page.goto('/terminals');
  await page.locator('.unpaired-info').click();
  const modal = page.locator('.modal-sheet');
  await expect(modal).toContainText('can no longer reach your shard');
  await expect(modal).toContainText('sign the device out');
  await expect(modal).toContainText('next time the app starts');
});

test('detail view shows each lockout state copy and the app display name', async ({ page }) => {
  await stubUnpaired(page, [device({
    lockouts: [
      { app_name: 'immich', state: 'waiting_for_start' },
      { app_name: 'vaultwarden', state: 'retrying' },
      { app_name: 'nextcloud', state: 'waiting_for_install' },
      { app_name: 'paperless', state: 'failed' },
    ],
  })]);
  await page.goto('/terminals');
  await pills(page).first().click();
  const apps = page.locator('.unpaired-detail__app');
  await expect(apps).toHaveCount(4);
  // immich is installed in the mock, so its display name is used, not app_name.
  await expect(apps.nth(0)).toContainText('Immich');
  await expect(apps.nth(0)).toContainText('Happens the next time the app starts');
  await expect(apps.nth(1)).toContainText('In progress');
  await expect(apps.nth(2)).toContainText('The app is uninstalled');
  await expect(apps.nth(3)).toContainText('Could not be delivered');
  // nextcloud is not installed, so the raw app_name shows.
  await expect(apps.nth(2)).toContainText('nextcloud');
});

test('a missing timestamp shows the translated "unknown" against its label', async ({ page }) => {
  await stubUnpaired(page, [device({ paired_at: null })]);
  await page.goto('/terminals');
  await pills(page).first().click();
  const row = (label) =>
    page.locator('.unpaired-detail__row', { has: page.getByText(label, { exact: true }) });
  await expect(row('Paired')).toContainText('unknown');
  // the other rows still carry real values
  await expect(row('Last seen')).not.toContainText('unknown');
});

test('a pending-only device has no retry/dismiss actions', async ({ page }) => {
  await stubUnpaired(page, [device({})]);
  await page.goto('/terminals');
  await pills(page).first().click();
  await expect(page.locator('.modal-footer')).toHaveCount(0);
});

test('retry posts to the retry endpoint', async ({ page }) => {
  const calls = await stubUnpaired(page, [FAILED]);
  await page.goto('/terminals');
  await pills(page).first().click();
  await page.locator('.modal-footer [data-act="retry"]').click();
  await expect.poll(() => calls.some((c) => c.method === 'POST' && c.path.endsWith('/dev2/retry'))).toBe(true);
});

test('dismiss confirms first, then deletes the device', async ({ page }) => {
  const calls = await stubUnpaired(page, [FAILED]);
  await page.goto('/terminals');
  await pills(page).first().click();
  await page.locator('.modal-footer [data-act="dismiss"]').click();
  // the confirm dialog warns the device may stay signed in
  const confirm = page.locator('.modal-sheet').last();
  await expect(confirm).toContainText('stay signed in');
  await expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  await confirm.locator('[data-act="confirm"]').click();
  await expect.poll(() => calls.some((c) => c.method === 'DELETE' && c.path.endsWith('/unpaired/dev2'))).toBe(true);
});

test('a failed retry shows an error toast and keeps the detail open', async ({ page }) => {
  await stubUnpaired(page, [FAILED], { actionStatus: 500 });
  await page.goto('/terminals');
  await pills(page).first().click();
  await page.locator('.modal-footer [data-act="retry"]').click();
  await expect(page.locator('.toast--error')).toBeVisible();
  // the detail modal is still open so the owner can try again or dismiss
  await expect(page.locator('.modal-footer [data-act="retry"]')).toBeVisible();
});

test('a live update adds and then removes a pill', async ({ page }) => {
  await stubUnpaired(page, [device({})]);
  await page.goto('/terminals');
  await expect(pills(page)).toHaveCount(1);

  await setUnpaired(page, [device({}), FAILED]);
  await expect(pills(page)).toHaveCount(2);
  await expect(pills(page).filter({ hasText: 'Lost Phone' })).toBeVisible();

  await setUnpaired(page, []);
  await expect(section(page)).toHaveCount(0);
});
