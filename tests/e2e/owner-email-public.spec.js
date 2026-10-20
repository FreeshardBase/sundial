import { test, expect } from '@playwright/test';

// The owner's address is not public (freeshard#220 drops identities.email).
// An older shard_core may still send it in the identity: it must not render.

const LEAK = 'leak@example.org';

test('the Welcome page renders no email, even when the identity still carries one', async ({ page }) => {
  await page.route('**/core/public/meta/whoareyou', async (route) => {
    const res = await route.fetch();
    route.fulfill({ response: res, json: { ...(await res.json()), email: LEAK } });
  });
  await page.goto('/welcome');
  await expect(page.locator('.welcome h1')).toHaveText('Max Mustermann');
  await expect(page.locator('view-welcome')).not.toContainText(LEAK);
  await expect(page.locator('view-welcome a[href^="mailto:"]')).toHaveCount(0);
});

test('the Public view has no email field', async ({ page }) => {
  await page.route('**/core/protected/identities/default', async (route) => {
    const res = await route.fetch();
    route.fulfill({ response: res, json: { ...(await res.json()), email: LEAK } });
  });
  await page.goto('/public');
  await expect(page.locator('view-public fs-editable-text')).toHaveCount(2);
  await expect(page.locator('view-public')).not.toContainText(LEAK);
});
