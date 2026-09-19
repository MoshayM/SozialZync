/**
 * E2E: Editor workspace — verifies the editor page loads without hitting the
 * (dash)/error.tsx boundary. Specifically covers the null-items bug where
 * track.items === null caused a render-phase TypeError.
 */
import { test, expect } from '@playwright/test';

test('existing edit session opens without error boundary', async ({ page }) => {
  // ── 1. Go to the editor listing page ─────────────────────────────────────
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/editor-1-listing.png' });

  // ── 2. Open the first existing edit session ──────────────────────────────
  // Cards use a hover overlay — hover the card to reveal the "Edit" link,
  // then force-click it (it's present in the DOM even while CSS-hidden).
  const editCard = page.locator('a[href^="/editor/"]').first();
  await expect(editCard).toBeAttached({ timeout: 15_000 });
  await editCard.hover({ force: true });
  await editCard.click({ force: true });

  // ── 3. Wait for navigation to /editor/<editId> ────────────────────────────
  await page.waitForURL(/\/editor\/.+/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/editor-2-workspace.png' });

  // ── 4. Verify error boundary is NOT shown ─────────────────────────────────
  await expect(page.locator('h2', { hasText: /something went wrong/i })).not.toBeVisible({ timeout: 5_000 });

  // ── 5. Verify editor UI is present ────────────────────────────────────────
  // Top bar has AI edit + Save buttons
  await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible({ timeout: 10_000 });

  const finalUrl = page.url();
  console.log('✓ Editor workspace loaded at:', finalUrl);
  expect(finalUrl).toMatch(/\/editor\/.+/);
});
