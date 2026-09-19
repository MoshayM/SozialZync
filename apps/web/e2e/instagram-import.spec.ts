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

  // ── 5. Wait up to 90s for the title dialog ───────────────────────────────
  // After download: "Name your edit" dialog appears (pre-filled with filename).
  // User must confirm before the edit project is created and navigation happens.
  const titleDialog = page.getByRole('dialog', { name: /name your edit/i });
  await expect(titleDialog).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: 'e2e/ig-4-title-dialog.png' });

  // ── 6. Verify title is pre-filled ────────────────────────────────────────
  const titleInput = titleDialog.locator('input[type="text"]');
  await expect(titleInput).toBeVisible();
  const prefilled = await titleInput.inputValue();
  console.log('✓ Title pre-filled as:', prefilled);
  expect(prefilled.length).toBeGreaterThan(0);

  // ── 7. Click "Open Editor" to create the project and navigate ─────────────
  await titleDialog.getByRole('button', { name: /open editor/i }).click();
  await page.waitForURL(/\/editor\/.+/, { timeout: 30_000 });
  await page.screenshot({ path: 'e2e/ig-5-success.png' });

  const finalUrl = page.url();
  console.log('✓ Instagram Reel imported → navigated to:', finalUrl);
  expect(finalUrl).toMatch(/\/editor\/.+/);
});
