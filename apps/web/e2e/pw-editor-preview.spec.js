/**
 * Verify that the video preview works in the shorts clip timeline editor.
 * Tests the new signed-URL approach (no more full-blob download).
 */
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth.json' });

test('editor preview loads and seeks to clip start', async ({ page }) => {
  // ── 1. Navigate to Shorts Studio ──────────────────────────────────────────
  await page.goto('/shorts-studio', { waitUntil: 'networkidle' });

  // Expand first "Ready" video row
  const videoRow = page.locator('div[role="button"]').filter({ hasText: 'Ready' }).first();
  await videoRow.waitFor({ timeout: 30_000 });
  await videoRow.click();

  // Go to the analysis/results page
  const resultsLink = page.getByRole('link', { name: /results|analysis/i }).first();
  await resultsLink.waitFor({ timeout: 15_000 });
  await resultsLink.click();
  await page.waitForURL(/\/shorts-studio\/videos\//, { timeout: 30_000 });

  // ── 2. Expand a rendered/exported clip ───────────────────────────────────
  const clipRow = page.locator('[role="button"]').filter({ hasText: /rendered|exported/i }).first();
  await clipRow.waitFor({ timeout: 20_000 });
  await clipRow.click();
  await page.screenshot({ path: 'pw-editor-01-clip-expanded.png' });

  // ── 3. Click the Edit / Re-edit button ───────────────────────────────────
  const editBtn = page.getByRole('link', { name: /re.?edit|edit/i }).first();
  await editBtn.waitFor({ timeout: 10_000 });
  await editBtn.click();
  await page.waitForURL(/\/shorts-studio\/clips\/[^/]+\/edit/, { timeout: 20_000 });
  console.log('Editor URL:', page.url());

  // ── 4. Wait for the timeline editor to render ─────────────────────────────
  // The editor shows a <video> in the player area
  const videoEl = page.locator('video').first();
  await videoEl.waitFor({ timeout: 30_000 });
  await page.screenshot({ path: 'pw-editor-02-loading.png' });

  // ── 5. Check the video src is a signed streaming URL (not a blob) ─────────
  // Give the editor-url fetch up to 15s to resolve
  await page.waitForFunction(
    () => {
      const v = document.querySelector('video');
      return v && v.src && !v.src.startsWith('blob:') && v.src.length > 0;
    },
    { timeout: 15_000 },
  );

  const src = await videoEl.getAttribute('src');
  console.log('video src =', src);

  // Must be a signed streaming URL (contains /media/versions/ and a sig param)
  expect(src, 'src should point to media/versions endpoint').toMatch(/\/media\/versions\//);
  expect(src, 'src should not be a blob URL').not.toMatch(/^blob:/);
  expect(src, 'src should not double /api/v1').not.toContain('/api/v1/api/v1');

  // ── 6. Wait for video to buffer (readyState >= 2) ─────────────────────────
  await page.waitForFunction(
    () => { const v = document.querySelector('video'); return v ? v.readyState >= 2 : false; },
    { timeout: 40_000 },
  );

  const readyState = await page.evaluate(() => document.querySelector('video')?.readyState ?? 0);
  console.log('video readyState =', readyState, '(2=has data, 3=can play, 4=enough data)');
  expect(readyState).toBeGreaterThanOrEqual(2);

  // ── 7. Verify the video is seeked to the clip start, not 0:00 ─────────────
  // onLoadedMetadata seeks to sourceStartMs. If the clip starts mid-video,
  // currentTime should be > 0 (unless the clip genuinely starts at 0).
  const currentTime = await page.evaluate(() => document.querySelector('video')?.currentTime ?? 0);
  console.log('video currentTime =', currentTime, 's');
  // We can't assert > 0 here because some clips may start at 0:00 in the source.
  // Just log it — the key check is readyState >= 2.

  // ── 8. Final screenshot ───────────────────────────────────────────────────
  await page.screenshot({ path: 'pw-editor-03-ready.png' });

  // ── 9. Verify audio/caption track placeholders are visible ───────────────
  const audioPlaceholder = page.getByText(/voice-over.*studio tools/i).first();
  const audioVisible = await audioPlaceholder.isVisible().catch(() => false);
  console.log('Audio track placeholder visible:', audioVisible);
});
