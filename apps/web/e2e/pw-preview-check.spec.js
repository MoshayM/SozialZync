/**
 * Quick check: open preview modal on a rendered clip and verify video plays correctly.
 */
const { test, expect } = require('@playwright/test');
const { gotoWithRetry } = require('./net-retry');

test.use({ storageState: 'e2e/.auth.json' });

test('preview modal plays video on a rendered clip', async ({ page }) => {
  // Navigate to Shorts Studio
  await gotoWithRetry(page, '/shorts-studio', { waitUntil: 'networkidle' });

  // Expand the first video row that is Ready
  const videoRow = page.locator('div[role="button"]').filter({ hasText: 'Ready' }).first();
  await videoRow.waitFor({ timeout: 30_000 });
  await videoRow.click();

  // Click Results / Analysis link to open the analysis page
  const resultsLink = page.getByRole('link', { name: /results|analysis/i }).first();
  await resultsLink.waitFor({ timeout: 15_000 });
  await resultsLink.click();
  await page.waitForURL(/\/shorts-studio\/videos\//, { timeout: 30_000 });

  // Wait for the clips section to appear, then expand a rendered or exported clip
  // Clip rows in ClipsList use role="button" on the header div
  const clipRow = page.locator('[role="button"]').filter({ hasText: /rendered|exported/i }).first();
  await clipRow.waitFor({ timeout: 20_000 });
  await clipRow.click();

  // Screenshot after expanding the clip
  await page.screenshot({ path: 'pw-preview-01-expanded.png' });

  // Preview button is now visible inside the expanded clip body
  const previewBtn = page.getByRole('button', { name: /preview/i }).first();
  await previewBtn.waitFor({ timeout: 20_000 });
  await previewBtn.click();

  // Modal should appear
  const modal = page.locator('.fixed.inset-0').last();
  await modal.waitFor({ timeout: 15_000 });

  // Screenshot while circular progress / buffering overlay is shown
  await page.screenshot({ path: 'pw-preview-02-buffering.png' });

  const videoEl = modal.locator('video');
  await videoEl.waitFor({ timeout: 20_000 });

  const src = await videoEl.getAttribute('src');
  console.log('video src =', src);

  // URL must not have double /api/v1
  expect(src, 'URL must not double /api/v1').not.toContain('/api/v1/api/v1');
  expect(src, 'URL must point to Railway media endpoint').toContain('/api/v1/media');

  // Wait for video to have buffered enough data (readyState >= 2 = HAVE_CURRENT_DATA)
  await page.waitForFunction(
    () => { const v = document.querySelector('video'); return v ? v.readyState >= 2 : false; },
    { timeout: 40_000 },
  );

  const readyState = await page.evaluate(() => document.querySelector('video')?.readyState ?? 0);
  console.log('video readyState =', readyState, '(>=2 = has data, >=3 = can play)');

  // Screenshot once video has data — buffering overlay should be gone
  await page.screenshot({ path: 'pw-preview-03-playing.png' });

  expect(readyState).toBeGreaterThanOrEqual(2);
});
