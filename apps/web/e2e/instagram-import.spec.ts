/**
 * E2E: Instagram Reel import via the Video Editor URL bar.
 * Confirmed working via API: 17.7 MB mp4 in ~10s (2026-09-19).
 */
import { test, expect } from '@playwright/test';

const REEL_URL =
  'https://www.instagram.com/reel/DcFd8Z7CZDT/?utm_source=ig_web_copy_link';

test('Instagram Reel imports and opens editor', async ({ page }) => {
  // ── 1. Go to editor page ─────────────────────────────────────────────────
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/ig-1-editor.png' });

  // ── 2. Click the "From URL" source card ──────────────────────────────────
  // The SourceCard subtitle contains "Instagram"; clicking it shows the URL bar
  const urlCard = page.locator('button', { hasText: /instagram/i }).first();
  await expect(urlCard).toBeVisible({ timeout: 15_000 });
  await urlCard.click();

  // ── 3. Fill the Instagram Reel URL ───────────────────────────────────────
  const urlInput = page.locator('input[type="url"]');
  await expect(urlInput).toBeVisible({ timeout: 8_000 });
  await urlInput.fill(REEL_URL);

  // Blue info chip: "Instagram detected — we'll extract the video for you"
  await expect(page.locator('text=Instagram detected')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'e2e/ig-2-url-filled.png' });

  // ── 4. Click Import ───────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^import$/i }).click();

  // Downloading spinner should appear
  await expect(
    page.locator('text=Downloading from Instagram')
  ).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'e2e/ig-3-downloading.png' });

  // ── 5. Wait up to 90s for navigation to /editor/<editId> ─────────────────
  // On success: router.push(`/editor/${editId}`) → URL changes
  // On failure: error banner appears with AlertCircle + message text
  await page.waitForURL(/\/editor\/.+/, { timeout: 90_000 });

  await page.screenshot({ path: 'e2e/ig-4-success.png' });

  // ── 6. Confirm no import-error banner visible on the new edit page ────────
  // The error banner has: <AlertCircle> + text + X button; rendered in red-50 bg
  // It would only be visible if we somehow stayed on /editor with an error.
  await expect(
    page.locator('div.bg-red-50').filter({ hasText: /could not download|sign.in|failed/i })
  ).not.toBeVisible();

  const finalUrl = page.url();
  console.log('✓ Instagram Reel imported → navigated to:', finalUrl);
  expect(finalUrl).toMatch(/\/editor\/.+/);
});
