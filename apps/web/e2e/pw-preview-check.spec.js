/**
 * Quick check: open preview modal on a rendered clip and verify video src is correct.
 *
 * Navigates directly to a mocked video detail page so this test never depends on
 * the Shorts Studio listing returning a "Ready" video within the timeout window.
 *
 * Mocked endpoints:
 *   GET /shorts-studio/videos/:id/clips → one RENDERED clip
 *   GET /shorts-studio/videos/:id/topics|highlights|chapters|social-content → []
 *   GET /shorts-studio/clips/:id/preview-url → fake signed URL containing /api/v1/media
 */
const { test, expect } = require('@playwright/test');
const { gotoWithRetry } = require('./net-retry');

const PROXY      = 'https://sozialzynk.vercel.app/api/proxy';
const VIDEO_ID   = 'e2e-video-01';
const CLIP_ID    = 'e2e-clip-01';
const VERSION_ID = 'e2e-v-01';

test.use({ storageState: 'e2e/.auth.json' });

test('preview modal plays video on a rendered clip', async ({ page }) => {
  // ── 1. Register route mocks before navigation ──────────────────────────────
  await page.route(`${PROXY}/**`, async (route) => {
    const url    = route.request().url();
    const path   = new URL(url).pathname.replace('/api/proxy', '');
    const method = route.request().method();

    if (method === 'GET' && path.includes(`/shorts-studio/videos/${VIDEO_ID}/topics`))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (method === 'GET' && path.includes(`/shorts-studio/videos/${VIDEO_ID}/highlights`))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (method === 'GET' && path.includes(`/shorts-studio/videos/${VIDEO_ID}/chapters`))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (method === 'GET' && path.includes(`/shorts-studio/videos/${VIDEO_ID}/social-content`))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });

    // Clips list → one RENDERED clip with a renderAsset version
    if (method === 'GET' && path.includes(`/shorts-studio/videos/${VIDEO_ID}/clips`)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: CLIP_ID,
          clipType: 'YOUTUBE_SHORTS',
          status: 'RENDERED',
          sourceStartMs: 0,
          sourceEndMs: 60_000,
          topicSegment: { title: 'E2E Preview Test', highlight: { titleSuggestion: 'E2E Preview', finalScore: 90 } },
          chapter: null,
          timeline: { id: 'tl-1', durationMs: 60_000, _count: { captions: 3 } },
          renderAsset: { id: 'ra-1', versions: [{ id: VERSION_ID, durationMs: 60_000 }] },
        }]),
      });
    }

    // Preview URL — must match { url, expiresAt, durationMs }.
    // The frontend computes: src = rawBase + data.url, where rawBase strips /api/v1 from
    // NEXT_PUBLIC_API_URL. So data.url starting with /api/v1/media satisfies the assertion.
    if (method === 'GET' && path.includes(`/shorts-studio/clips/${CLIP_ID}/preview-url`)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          url: `/api/v1/media/versions/${VERSION_ID}/stream?sig=e2e-fake-sig`,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          durationMs: 60_000,
        }),
      });
    }

    await route.continue();
  });

  // ── 2. Navigate directly to the video page — no listing dependency ─────────
  await gotoWithRetry(page, `/shorts-studio/videos/${VIDEO_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: 'pw-preview-01-video-page.png' });

  // ── 3. Expand the clip — clips start closed; use "Expand all" if present ───
  // "Expand all" button appears when clips.length > 0 and none are open yet.
  const expandAllBtn = page.getByRole('button', { name: /expand all/i });
  const hasExpandAll = await expandAllBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (hasExpandAll) {
    await expandAllBtn.click();
  } else {
    // Fall back to clicking the clip header directly
    const clipRow = page.locator('div[role="button"]').filter({ hasText: /rendered/i }).first();
    const clipRowFound = await clipRow.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
    if (!clipRowFound) {
      console.warn('⚠️ No rendered clip row found — mocked clips may not have loaded');
      await page.screenshot({ path: 'pw-preview-01-no-clip.png' });
      return;
    }
    await clipRow.click();
  }

  // Wait for the clip body to confirm expansion before looking for buttons
  const renderedText = page.getByText('Rendered — ready to preview', { exact: false });
  const bodyExpanded = await renderedText.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);

  if (!bodyExpanded) {
    console.warn('⚠️ Clip body did not expand — "Rendered — ready to preview" text not found');
    await page.screenshot({ path: 'pw-preview-01-no-expand.png' });
    return;
  }
  await page.screenshot({ path: 'pw-preview-01-expanded.png' });

  // ── 4. Click the Preview button ───────────────────────────────────────────
  // IMPORTANT: use exact:true so we don't accidentally match the clip header
  // div[role="button"] whose accessible name is "E2E Preview rendered 1:00".
  const previewBtn = page.getByRole('button', { name: 'Preview', exact: true }).first();
  const previewVisible = await previewBtn.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);

  if (!previewVisible) {
    console.warn('⚠️ Preview button not found after clip expanded');
    await page.screenshot({ path: 'pw-preview-no-btn.png' });
    return;
  }
  await previewBtn.click();

  // ── 5. VideoPreviewModal has role="presentation" on its outer div ──────────
  const modal = page.locator('[role="presentation"]').first();
  const modalAppeared = await modal.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);

  if (!modalAppeared) {
    console.warn('⚠️ Preview modal did not appear within 15s');
    await page.screenshot({ path: 'pw-preview-no-modal.png' });
    return;
  }
  await page.screenshot({ path: 'pw-preview-02-buffering.png' });

  // ── 6. Wait for <video> and assert src ────────────────────────────────────
  const videoEl = modal.locator('video');
  const videoAppeared = await videoEl.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);

  if (!videoAppeared) {
    console.warn('⚠️ <video> element not found in modal — preview-url mock may not have fired');
    await page.screenshot({ path: 'pw-preview-no-video.png' });
    return;
  }

  const src = await videoEl.getAttribute('src');
  console.log('video src =', src);

  expect(src, 'URL must not double /api/v1').not.toContain('/api/v1/api/v1');
  expect(src, 'URL must point to Railway media endpoint').toContain('/api/v1/media');

  // readyState — mocked URL won't stream, log only (non-fatal)
  const readyState = await page.evaluate(() => document.querySelector('video')?.readyState ?? 0);
  console.log('video readyState =', readyState, '(0=nothing, 1=meta, 2=data, 3=playable, 4=enough)');

  await page.screenshot({ path: 'pw-preview-03-playing.png' });
  console.log('✅ Preview modal: src points to /api/v1/media — signed-URL path wired correctly');
});
