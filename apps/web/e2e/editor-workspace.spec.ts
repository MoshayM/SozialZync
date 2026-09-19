/**
 * E2E: Editor workspace — verifies the editor page loads without hitting the
 * (dash)/error.tsx boundary. Specifically covers the null-items bug where
 * track.items === null caused a render-phase TypeError.
 *
 * The /editor entry point now smart-redirects: it opens the most-recent edit
 * project (or creates a blank one). There is no listing/card UI any more.
 */
import { test, expect } from '@playwright/test';

test('editor smart-redirect opens workspace without error boundary', async ({ page }) => {
  // ── 1. Go to the editor entry point — triggers smart redirect ─────────────
  await page.goto('/editor');

  // ── 2. Wait for redirect to /editor/<editId> ──────────────────────────────
  // The component calls api.editor.listMine() then router.replace('/editor/:id').
  // Allow up to 30s for Railway API cold-start + redirect.
  await page.waitForURL(/\/editor\/.+/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/editor-1-workspace.png' });

  // ── 3. Verify error boundary is NOT shown ─────────────────────────────────
  await expect(page.locator('h2', { hasText: /something went wrong/i })).not.toBeVisible();

  // ── 4. Verify editor UI is present ────────────────────────────────────────
  // Top bar has Save and AI-edit buttons
  await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible({ timeout: 10_000 });

  const finalUrl = page.url();
  console.log('✓ Editor workspace loaded at:', finalUrl);
  expect(finalUrl).toMatch(/\/editor\/.+/);
});

test('editor back arrow opens My Edits drawer', async ({ page }) => {
  await page.goto('/editor');
  await page.waitForURL(/\/editor\/.+/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');

  // Back arrow button has title="My edits"
  await page.getByTitle('My edits').click();

  // HistoryDrawer dialog should appear
  await expect(page.getByRole('dialog', { name: /my edits/i })).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'e2e/editor-2-history-drawer.png' });
});
