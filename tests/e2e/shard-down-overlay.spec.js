import { test, expect } from '@playwright/test';

// Shard-down overlay: full-screen status display while the WS connection is
// lost (replaces the old small dock warn icon as the single source of truth
// for this signal — see boot.spec.js's "no disconnected warning" test).
// Simulated by patching the store directly (same module instance ws.js
// writes to) rather than actually dropping the mock server's socket.

async function waitForRealConnection(page) {
  // The initial store value is also null before any connection has been
  // attempted, so wait for the actual first WS handshake, not just the
  // value — otherwise the real onopen fires a moment later and clobbers
  // whatever we fake.
  const wsEvent = page.waitForEvent('websocket');
  await page.goto('/');
  await page.waitForSelector('fs-dock nav.dock');
  await wsEvent;
  await page.waitForTimeout(300);
}

async function setDisconnectedSince(page, value) {
  await page.evaluate(async (v) => {
    const { store } = await import('./js/store.js');
    store.set({ ws: { disconnectedSince: v } });
  }, value);
}

test('stays hidden during the 5s grace period, then shows dimmed + tier-1 message', async ({ page }) => {
  await waitForRealConnection(page);
  await expect(page.locator('.shard-down-sheet')).toHaveCount(0);

  await setDisconnectedSince(page, Date.now());
  await page.waitForTimeout(1500);
  await expect(page.locator('.shard-down-sheet')).toHaveCount(0);
  await expect(page.locator('#view')).not.toHaveClass(/page-receded/);

  await page.waitForTimeout(4000); // past the 5s grace
  await expect(page.locator('.shard-down-sheet')).toBeVisible();
  await expect(page.locator('#view')).toHaveClass(/page-receded/);
  await expect(page.locator('#dock-slot')).toHaveClass(/page-receded/);
  await expect(page.locator('.shard-down-message')).toContainText('restarting');
});

test('escalates to the contact-support tier once 5 minutes have elapsed', async ({ page }) => {
  await waitForRealConnection(page);
  // Fake elapsed time by backdating disconnectedSince — no real 5-minute wait.
  await setDisconnectedSince(page, Date.now() - (5 * 60 * 1000 + 2000));
  await page.waitForTimeout(6000); // past the 5s grace so it renders
  await expect(page.locator('.shard-down-sheet')).toBeVisible();
  await expect(page.locator('.shard-down-message a[href^="mailto:"]')).toBeVisible();
});

test('clears as soon as the connection is marked reconnected', async ({ page }) => {
  await waitForRealConnection(page);
  await setDisconnectedSince(page, Date.now());
  await page.waitForTimeout(5500);
  await expect(page.locator('.shard-down-sheet')).toBeVisible();

  await setDisconnectedSince(page, null);
  await expect(page.locator('.shard-down-sheet')).toHaveCount(0);
  await expect(page.locator('#view')).not.toHaveClass(/page-receded/);
});
