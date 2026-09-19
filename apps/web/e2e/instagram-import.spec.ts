/**
 * E2E: Instagram Reel import via the Video Editor URL bar.
 * Uses the known-good public Reel URL and verifies the editor
 * navigates into an edit session (import succeeded).
 */
import { test, expect } from '@playwright/test';

const REEL_URL =
  'https://www.instagram.com/reel/DcFd8Z7CZDT/?utm_source=ig_web_copy_link';

test('Instagram Reel imports and opens editor', async ({ page }) => {
  // ── 1. Go to editor page ─────────────────────────────────────────────────
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/ig-1-editor.png' });

  // ── 2. Click "From URL" source card to reveal URL bar ────────────────────
  // SourceCard for URL has subtitle "YouTube, TikTok, Instagram or direct link"
  const urlCard = page.locator('button', { hasText: /instagram/i }).first();
  await expect(urlCard).toBeVisible({ timeout: 15_000 });
  await urlCard.click();
  await page.screenshot({ path: 'e2e/ig-2-urlbar-open.png' });

  // ── 3. Fill the Instagram Reel URL ───────────────────────────────────────
  const urlInput = page.locator('input[type="url"]');
  await expect(urlInput).toBeVisible({ timeout: 8_000 });
  await urlInput.fill(REEL_URL);

  // Blue info chip should appear: "Instagram detected"
  await expect(page.locator('text=Instagram detected')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'e2e/ig-3-url-filled.png' });

  // ── 4. Click Import ───────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^import$/i }).click();

  // Downloading… spinner/chip should appear
  await expect(
    page.locator('text=Downloading from Instagram')
  ).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'e2e/ig-4-downloading.png' });

  // ── 5. Wait up to 90 s for navigation to edit session ────────────────────
  // On success the page navigates away from /editor to /editor/<projectId>/<editId>
  // On failure an error banner appears with "Could not download" text.
  await Promise.race([
    page.waitForURL(/\/editor\/.+/, { timeout: 90_000 }),
    page.locator('[class*="red"], [class*="error"]').waitFor({ timeout: 90_000 }),
  ]);

  // ── 6. Assert no error banner ─────────────────────────────────────────────
  const errorBanner = page.locator('text=Could not download, text=sign-in required, text=failed');
  await expect(errorBanner).not.toBeVisible();

  await page.screenshot({ path: 'e2e/ig-5-success.png' });

  const finalUrl = page.url();
  console.log('✓ Navigated to:', finalUrl);
  expect(finalUrl).toMatch(/\/editor\/.+/);
});
