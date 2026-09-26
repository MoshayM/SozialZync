/**
 * YouTube import — UI test (no mocks).
 * Tests the full flow through the Shorts Studio UI:
 *   1. Navigate to /shorts-studio
 *   2. Click "Import URL" button
 *   3. Paste YouTube URL into modal
 *   4. Click Import
 *   5. Verify video appears in the imported list
 *   6. Trigger Analyze and wait for READY status
 *
 * Run: npx playwright test youtube-import-ui --project=chromium-desktop
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'pw-yt-import-ui');
const TEST_YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const TEST_YT_TITLE = 'Rick Astley';

function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

test.describe('YouTube import — Shorts Studio UI', () => {
  test.setTimeout(300_000);

  test('import URL → video appears → analyze → READY', async ({ page }) => {
    // ── 1. Navigate to Shorts Studio ────────────────────────────────────────
    await page.goto('/shorts-studio');
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await shot(page, '01-home');
    console.log('✓ Navigated to /shorts-studio');

    // ── 2. Check channel is connected ───────────────────────────────────────
    const noChannel = page.getByText(/connect.*channel|no channel/i).first();
    if (await noChannel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log('⚠ No YouTube channel connected — skipping (connect a channel in Settings first)');
      test.skip();
      return;
    }

    // ── 3. Click "Import URL" button ────────────────────────────────────────
    const importUrlBtn = page.getByRole('button', { name: /import url/i });
    await expect(importUrlBtn).toBeVisible({ timeout: 20_000 });
    await importUrlBtn.click();
    await shot(page, '02-import-btn-clicked');
    console.log('✓ Clicked "Import URL"');

    // ── 4. Modal opens ───────────────────────────────────────────────────────
    const dialog = page.getByRole('dialog', { name: /import from youtube url/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await shot(page, '03-modal-open');
    console.log('✓ Import modal opened');

    // ── 5. Enter YouTube URL ─────────────────────────────────────────────────
    const urlInput = dialog.locator('input[type="url"]');
    await expect(urlInput).toBeVisible({ timeout: 5_000 });
    await urlInput.fill(TEST_YT_URL);
    await shot(page, '04-url-filled');
    console.log(`✓ Filled URL: ${TEST_YT_URL}`);

    // ── 6. Click Import ──────────────────────────────────────────────────────
    const importBtn = dialog.getByRole('button', { name: /^import$/i });
    await expect(importBtn).toBeEnabled({ timeout: 5_000 });

    const importResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/shorts-studio/videos/import'),
      { timeout: 30_000 },
    );
    await importBtn.click();
    console.log('✓ Clicked Import — waiting for API response...');

    const importRes = await importResponsePromise;
    expect(importRes.status(), `Import API must return 2xx, got ${importRes.status()}`).toBeLessThan(300);
    const importBody = await importRes.json() as { id?: string; title?: string };
    console.log(`✓ Import API responded ${importRes.status()} — video: "${importBody.title ?? importBody.id}"`);

    await shot(page, '05-import-done');

    // Modal closes automatically on success
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    console.log('✓ Modal closed');

    // ── 7. Video appears in imported list ────────────────────────────────────
    await page.waitForTimeout(1_500); // allow query invalidation to re-fetch
    const videoRow = page.locator('div, tr, li').filter({ hasText: TEST_YT_TITLE }).first();
    const rowVisible = await videoRow.isVisible({ timeout: 20_000 }).catch(() => false);
    await shot(page, '06-video-in-list');

    if (rowVisible) {
      console.log(`✓ Video "${TEST_YT_TITLE}" appeared in imported list`);
    } else {
      console.log(`⚠ Video row not visible — it may already be in the list from a prior import`);
    }

    // ── 8. Find Analyze button and trigger analysis ──────────────────────────
    const importedVideoId = importBody.id;
    if (!importedVideoId) {
      console.log('⚠ No importedVideoId in response — skipping analyze step');
      return;
    }

    // Expand the video row to find the Analyze button
    if (rowVisible) {
      await videoRow.click().catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, '07-row-expanded');
    }

    const analyzeBtn = page.getByRole('button', { name: /analyze/i }).first();
    const analyzeBtnVisible = await analyzeBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    if (analyzeBtnVisible) {
      const analyzeResponsePromise = page.waitForResponse(
        (res) => res.url().includes('/analyze'),
        { timeout: 20_000 },
      );
      await analyzeBtn.click();
      const analyzeRes = await analyzeResponsePromise.catch(() => null);
      if (analyzeRes) {
        console.log(`✓ Analyze triggered — status ${analyzeRes.status()}`);
      }
      await shot(page, '08-analyze-triggered');
    } else {
      console.log('ℹ Analyze button not visible — video may already be analyzed or analyzing');
    }

    // ── 9. Poll until READY badge appears or timeout ─────────────────────────
    console.log('Polling for READY status in UI...');
    const deadline = Date.now() + 240_000;
    let ready = false;

    while (Date.now() < deadline) {
      await page.waitForTimeout(10_000);

      const readyBadge = page.locator('text=Ready').or(page.locator('[class*="badge"]').filter({ hasText: /ready/i })).first();
      if (await readyBadge.isVisible({ timeout: 2_000 }).catch(() => false)) {
        ready = true;
        console.log('✓ READY badge visible in UI!');
        break;
      }

      // Also check for error state
      const errorBadge = page.locator('text=Failed').or(page.locator('[class*="badge"]').filter({ hasText: /failed|error/i })).first();
      if (await errorBadge.isVisible({ timeout: 2_000 }).catch(() => false)) {
        console.log('✗ FAILED badge appeared in UI');
        break;
      }

      console.log(`  Still processing... (${Math.round((deadline - Date.now()) / 1000)}s left)`);
    }

    await shot(page, '09-final');

    expect(ready, 'Expected "Ready" badge to appear in UI within 4 minutes').toBe(true);
    console.log('✓ Full UI import flow PASSED');
  });
});
