/**
 * E2E: Editor workspace — verifies the editor page loads without hitting the
 * (dash)/error.tsx boundary. Specifically covers the null-items bug where
 * track.items === null caused a render-phase TypeError.
 *
 * The /editor entry point now smart-redirects: it opens the most-recent edit
 * project (or creates a blank one). There is no listing/card UI any more.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

/** Navigate to /editor with JWT-expiry recovery. The storageState JWT may
 *  expire mid-suite; on redirect to /login, re-authenticate and retry. */
async function goToEditor(page: import('@playwright/test').Page) {
  await page.goto('/editor');
  // Detect where we land — editor workspace or login (JWT expired)
  const landed = await Promise.race([
    page.waitForURL(/\/editor\/.+/, { timeout: 30_000 }).then(() => 'editor' as const),
    page.waitForURL(/\/login/, { timeout: 30_000 }).then(() => 'login' as const),
  ]).catch(() => 'editor' as const); // default: assume we're on editor if neither fires

  if (landed === 'login') {
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
    await page.goto('/editor');
    await page.waitForURL(/\/editor\/.+/, { timeout: 60_000 });
  }
}

test('editor smart-redirect opens workspace without error boundary', async ({ page }) => {
  // ── 1. Go to the editor entry point — triggers smart redirect ─────────────
  await goToEditor(page);

  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/editor-1-workspace.png' });

  // ── 2. Verify error boundary is NOT shown ─────────────────────────────────
  await expect(page.locator('h2', { hasText: /something went wrong/i })).not.toBeVisible();

  // ── 3. Verify editor UI is present ────────────────────────────────────────
  // Top bar has Save and AI-edit buttons
  await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible({ timeout: 10_000 });

  const finalUrl = page.url();
  console.log('✓ Editor workspace loaded at:', finalUrl);
  expect(finalUrl).toMatch(/\/editor\/.+/);
});

test('editor back arrow opens My Edits drawer', async ({ page }) => {
  await goToEditor(page);
  await page.waitForLoadState('networkidle');

  // Back arrow button has title="My edits"
  await page.getByTitle('My edits').click();

  // HistoryDrawer dialog should appear
  await expect(page.getByRole('dialog', { name: /my edits/i })).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'e2e/editor-2-history-drawer.png' });
});
