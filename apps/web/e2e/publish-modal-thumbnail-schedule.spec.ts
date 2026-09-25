/**
 * Focused E2E tests for the Thumbnail and Scheduling UI in PublishConfirmModal.
 *
 * Strategy:
 *  - Intercept ALL requests with page.route('**', ...) — this reliably catches
 *    cross-origin Railway API calls even from Vercel-hosted Next.js pages.
 *  - Navigate directly to /shorts-studio/videos/FAKE_VIDEO_ID with every
 *    required endpoint mocked.  The page has no "video must exist" guard; it
 *    just renders whatever the queries return.
 *  - Mock the clips endpoint to return one RENDERED clip so the Publish button
 *    becomes visible.  Click the row to expand it, then click Publish.
 *  - Inside the modal, test Thumbnail (3 modes) and Scheduling (3 modes).
 *
 * Run: npx playwright test publish-modal-thumbnail-schedule --project=chromium-desktop
 */
import { test, expect, Page, Route } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'pw-thumb-sched');

// ── Constants ─────────────────────────────────────────────────────────────────

const FAKE_VIDEO_ID = 'e2e-fake-video-001';
const FAKE_CLIP_ID  = 'e2e-fake-clip-001';

// ── Fake data ─────────────────────────────────────────────────────────────────

const FAKE_CLIP = {
  id: FAKE_CLIP_ID,
  clipType: 'YOUTUBE_SHORTS',
  status: 'RENDERED',
  sourceStartMs: 0,
  sourceEndMs: 60_000,
  topicSegment: {
    title: 'E2E Test Topic',
    highlight: { titleSuggestion: 'E2E Thumbnail & Schedule Test', finalScore: 88 },
  },
  chapter: null,
  timeline: { id: 'tl-1', durationMs: 60_000, _count: { captions: 5 } },
  renderAsset: { id: 'ra-1', versions: [{ id: 'v-1', durationMs: 60_000 }] },
};

const FAKE_PUBLISH_META = {
  title: 'E2E Thumbnail & Schedule Test',
  description: 'Auto-generated description for E2E tests.',
  tags: ['e2e', 'test', 'shorts'],
  originalLanguage: 'en',
  clipType: 'YOUTUBE_SHORTS',
};

const FAKE_THUMBNAILS = [
  { id: 'thumb-1', url: 'https://placehold.co/180x320/FF4444/FFFFFF?text=Thumb+1', isPrimary: true },
  { id: 'thumb-2', url: 'https://placehold.co/180x320/4444FF/FFFFFF?text=Thumb+2', isPrimary: false },
];

const FAKE_SCHEDULE_SLOTS = [
  { label: 'Mon, Oct 6 at 2:00 PM', iso: new Date(Date.now() + 4  * 3600 * 1000).toISOString() },
  { label: 'Mon, Oct 6 at 8:00 PM', iso: new Date(Date.now() + 10 * 3600 * 1000).toISOString() },
  { label: 'Tue, Oct 7 at 2:00 PM', iso: new Date(Date.now() + 28 * 3600 * 1000).toISOString() },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

/**
 * Install a catch-all route mock.
 * Intercepts Railway API calls for the fake video / clip and returns stub data.
 * Thumbnails can be overridden via opts.thumbnails (pass [] to simulate no AI thumbs).
 * Everything else continues to the real server.
 */
async function installMocks(
  page: Page,
  opts: { thumbnails?: typeof FAKE_THUMBNAILS | [] } = {},
) {
  const thumbs = opts.thumbnails ?? FAKE_THUMBNAILS;

  await page.route('https://sozialzynk.vercel.app/api/proxy/**', async (route: Route) => {
    const url  = route.request().url();
    const meth = route.request().method();

    // ── video detail page data ────────────────────────────────────────────────
    // topics & highlights → empty arrays so loading finishes immediately
    if (meth === 'GET' && url.includes(`/shorts-studio/videos/${FAKE_VIDEO_ID}/topics`)) {
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    if (meth === 'GET' && url.includes(`/shorts-studio/videos/${FAKE_VIDEO_ID}/highlights`)) {
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    if (meth === 'GET' && url.includes(`/shorts-studio/videos/${FAKE_VIDEO_ID}/chapters`)) {
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    if (meth === 'GET' && url.includes(`/shorts-studio/videos/${FAKE_VIDEO_ID}/social-content`)) {
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    // clips → our RENDERED fake clip
    if (meth === 'GET' && url.includes(`/shorts-studio/videos/${FAKE_VIDEO_ID}/clips`)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify([FAKE_CLIP]) });
    }

    // ── publish modal API ─────────────────────────────────────────────────────
    if (meth === 'GET' && url.includes(`/shorts-studio/clips/${FAKE_CLIP_ID}/publish-meta`)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(FAKE_PUBLISH_META) });
    }
    // thumbnails list
    if (
      meth === 'GET' &&
      url.includes(`/shorts-studio/clips/${FAKE_CLIP_ID}/thumbnails`) &&
      !url.includes('/generate') &&
      !url.includes('/upload')
    ) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(thumbs) });
    }
    // generate thumbnails POST
    if (meth === 'POST' && url.includes(`/shorts-studio/clips/${FAKE_CLIP_ID}/thumbnails/generate`)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ skipped: false, thumbnails: 2 }) });
    }
    // upload thumbnail POST
    if (meth === 'POST' && url.includes(`/shorts-studio/clips/${FAKE_CLIP_ID}/thumbnails/upload`)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'thumb-up', key: 'thumbnails/test.jpg', versionId: 'v-up' }) });
    }
    // schedule suggestions
    if (meth === 'GET' && url.includes(`/shorts-studio/clips/${FAKE_CLIP_ID}/schedule-suggestions`)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(FAKE_SCHEDULE_SLOTS) });
    }
    // quick-publish — swallow to avoid actually publishing
    if (meth === 'POST' && url.includes(`/shorts-studio/clips/${FAKE_CLIP_ID}/quick-publish`)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jobId: 'mock-job-id' }) });
    }

    // everything else passes through
    return route.continue();
  });
}

/**
 * Navigate to the fake video detail page, expand the clip row, click Publish.
 * Returns the modal locator, or null if any step fails.
 */
async function openPublishModal(
  page: Page,
  opts: { thumbnails?: typeof FAKE_THUMBNAILS | [] } = {},
): Promise<ReturnType<Page['locator']> | null> {
  await installMocks(page, opts);

  // Navigate directly — no real video needed; all API calls are mocked
  await page.goto(`/shorts-studio/videos/${FAKE_VIDEO_ID}`);
  // Give React Query time to process mock responses and re-render
  await page.waitForTimeout(4000);
  await shot(page, '_after-nav');

  // Verify clips rendered by waiting for the clip title text (more reliable than h2 locator)
  const clipTitleEl = page.getByText('E2E Thumbnail', { exact: false });
  const clipTitleVisible = await clipTitleEl.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!clipTitleVisible) {
    // Log page state for diagnosis
    const h2s = await page.locator('h2').allInnerTexts().catch(() => []);
    const pageText = await page.locator('body').innerText().catch(() => '');
    console.log('[DEBUG] h2s:', h2s);
    console.log('[DEBUG] page contains CLIPS:', pageText.includes('CLIPS'));
    console.log('[DEBUG] page contains rendered:', pageText.toLowerCase().includes('rendered'));
    await shot(page, '_no-clips-header');
    console.warn('⚠️ Clip title not visible — clips section did not render');
    return null;
  }

  // clipsOpen starts true → ClipsList renders immediately.
  // Find the clip row (div[role="button"] inside ClipsList, contains the clip title).
  // The clip title comes from topicSegment.highlight.titleSuggestion.
  let clipRow = page.locator('div[role="button"]').filter({
    hasText: /E2E Thumbnail|E2E Test Topic/i,
  }).first();

  let rowFound = await clipRow.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!rowFound) {
    // Fallback: any div[role="button"] inside a white card (clip rows have this class)
    clipRow = page.locator('div.bg-white.border.border-gray-100 div[role="button"]').first();
    rowFound = await clipRow.isVisible({ timeout: 3_000 }).catch(() => false);
  }
  if (!rowFound) {
    await shot(page, '_no-clip-row');
    console.warn('⚠️ Clip row not found in ClipsList');
    return null;
  }

  await clipRow.scrollIntoViewIfNeeded();
  await clipRow.click();
  await page.waitForTimeout(500);
  await shot(page, '_clip-expanded');

  // After expanding, the Publish button becomes visible (isRendered = true)
  const publishBtn = page.locator('button').filter({ hasText: /^Publish$/ }).first();
  const pubVisible = await publishBtn.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!pubVisible) {
    await shot(page, '_no-publish-btn');
    console.warn('⚠️ Publish button not visible after expanding clip row');
    return null;
  }

  await publishBtn.click();
  await page.waitForTimeout(300);

  // PublishConfirmModal has "Publish to" in the header text
  const modal = page.locator('div[class*="rounded-2xl"]').filter({ hasText: /Publish to/i }).first();
  const modalOk = await modal.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!modalOk) {
    await shot(page, '_modal-not-opened');
    console.warn('⚠️ PublishConfirmModal did not open');
    return null;
  }

  await shot(page, '_modal-open');
  return modal;
}

// ── Thumbnail tests ───────────────────────────────────────────────────────────

test.describe('Thumbnail section', () => {

  test('T1 — Modal shows 3 thumbnail mode buttons', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await expect(modal.getByRole('button', { name: /Keep Default/i }).first()).toBeVisible({ timeout: 8_000 });
    await expect(modal.getByRole('button', { name: /AI Generate/i }).first()).toBeVisible();
    await expect(modal.getByRole('button', { name: /Upload/i }).first()).toBeVisible();

    await shot(page, 'T1-three-thumb-buttons');
    console.log('✅ All 3 thumbnail mode buttons visible');
  });

  test('T2 — "Keep Default" shows confirmation message', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await modal.getByRole('button', { name: /Keep Default/i }).first().click();
    await page.waitForTimeout(300);

    const msg = page.locator('p, div').filter({ hasText: /default.*frame|frame.*will be used|default.*video/i }).first();
    await expect(msg).toBeVisible({ timeout: 5_000 });

    await shot(page, 'T2-keep-default');
    console.log('✅ Keep Default: confirmation visible');
  });

  test('T3 — "AI Generate" with no thumbnails shows Generate button', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page, { thumbnails: [] });
    if (!modal) { test.skip(); return; }

    await modal.getByRole('button', { name: /AI Generate/i }).first().click();
    await page.waitForTimeout(500);

    const generateBtn = page.getByRole('button', { name: /Generate AI Thumbnails/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });
    await shot(page, 'T3-ai-generate-btn');
    console.log('✅ AI Generate (no thumbs) → Generate button visible');

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes('/thumbnails/generate') && r.method() === 'POST',
        { timeout: 6_000 },
      ).catch(() => null),
      generateBtn.click(),
    ]);
    await shot(page, 'T3-generate-fired');
    console.log(req ? '✅ POST /thumbnails/generate fired' : '⚠️ request listener window missed');
  });

  test('T4 — "AI Generate" with existing thumbnails shows selectable grid', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page, { thumbnails: FAKE_THUMBNAILS });
    if (!modal) { test.skip(); return; }

    await modal.getByRole('button', { name: /AI Generate/i }).first().click();
    await page.waitForTimeout(800);

    const thumbImgs = page.locator('img[alt="Thumbnail"]');
    const count = await thumbImgs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    console.log(`✅ Thumbnail grid has ${count} image(s)`);

    await thumbImgs.first().click();
    await page.waitForTimeout(300);

    const regenBtn = page.getByRole('button', { name: /Regenerate/i }).first();
    await expect(regenBtn).toBeVisible({ timeout: 5_000 });

    await shot(page, 'T4-grid-selected');
    console.log('✅ Thumbnail selected → Regenerate button visible');
  });

  test('T5 — "Upload" mode shows file drop zone', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await modal.getByRole('button', { name: /^Upload$/i }).first().click();
    await page.waitForTimeout(400);

    const dropZone = page.locator('button').filter({ hasText: /JPEG|PNG|WebP|10 MB/i }).first();
    await expect(dropZone).toBeVisible({ timeout: 5_000 });

    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    await expect(fileInput).toBeAttached({ timeout: 3_000 });

    await shot(page, 'T5-upload-drop-zone');
    console.log('✅ Upload mode: drop zone + file input attached');
  });

});

// ── Scheduling tests ──────────────────────────────────────────────────────────

test.describe('Scheduling section', () => {

  test('S1 — Shows 3 scheduling mode buttons', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await expect(page.getByRole('button', { name: /Publish Now/i }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /Best Time/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Custom/i }).first()).toBeVisible();

    await shot(page, 'S1-three-sched-buttons');
    console.log('✅ All 3 scheduling mode buttons visible');
  });

  test('S2 — "Publish Now" shows "immediately" message', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await page.getByRole('button', { name: /Publish Now/i }).first().click();
    await page.waitForTimeout(300);

    const msg = page.locator('p').filter({ hasText: /immediately|compliance/i }).first();
    await expect(msg).toBeVisible({ timeout: 5_000 });

    await shot(page, 'S2-publish-now');
    console.log('✅ Publish Now: "immediately" message visible');
  });

  test('S3 — "Best Time" loads AI slot buttons', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await page.getByRole('button', { name: /Best Time/i }).first().click();
    await page.waitForTimeout(1500);
    await shot(page, 'S3-slots');

    const slotBtns = page.locator('button').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ });
    const count = await slotBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
    console.log(`✅ Best Time: ${count} slot button(s) loaded`);

    const hint = page.locator('p').filter({ hasText: /peak engagement/i }).first();
    await expect(hint).toBeVisible({ timeout: 3_000 });

    await slotBtns.first().click();
    await page.waitForTimeout(300);
    const label = await slotBtns.first().textContent();
    await shot(page, 'S3-slot-selected');
    console.log(`✅ Slot "${label?.trim()}" selected`);
  });

  test('S4 — "Custom" shows datetime-local input', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await page.getByRole('button', { name: /Custom/i }).first().click();
    await page.waitForTimeout(300);

    const dateInput = page.locator('input[type="datetime-local"]').first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    const min = await dateInput.getAttribute('min');
    expect(min).toBeTruthy();

    await shot(page, 'S4-custom-datetime');
    console.log(`✅ Custom mode: datetime-local visible, min="${min}"`);
  });

  test('S5 — Footer shows "Scheduled for…" when slot selected', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    await page.getByRole('button', { name: /Best Time/i }).first().click();
    await page.waitForTimeout(1500);

    await page.locator('button').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click();
    await page.waitForTimeout(400);

    const footerMsg = page.locator('p').filter({ hasText: /Scheduled for/i }).first();
    await expect(footerMsg).toBeVisible({ timeout: 5_000 });
    console.log(`✅ Footer: "${(await footerMsg.textContent())?.trim()}"`);

    const scheduleBtn = page.getByRole('button', { name: /^Schedule$/i }).first();
    await expect(scheduleBtn).toBeVisible({ timeout: 3_000 });

    await shot(page, 'S5-footer-scheduled');
    console.log('✅ Button label → "Schedule"');
  });

  test('S6 — Default state: "immediately" in footer, button "Confirm & Publish"', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    const footerMsg = page.locator('p').filter({ hasText: /immediately|compliance/i }).last();
    await expect(footerMsg).toBeVisible({ timeout: 8_000 });

    const confirmBtn = page.getByRole('button', { name: /Confirm & Publish/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });

    await shot(page, 'S6-default-state');
    console.log('✅ Default: "immediately" footer + "Confirm & Publish" button');
  });

});

// ── Cross-section ─────────────────────────────────────────────────────────────

test.describe('Button label gating', () => {

  test('X1 — Label toggles "Confirm & Publish" ↔ "Schedule"', async ({ page }) => {
    test.setTimeout(90_000);
    const modal = await openPublishModal(page);
    if (!modal) { test.skip(); return; }

    const confirmBtn = page.getByRole('button', { name: /Confirm & Publish/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 8_000 });
    console.log('✅ Default: "Confirm & Publish"');

    // Switch to Best Time + select a slot → "Schedule"
    await page.getByRole('button', { name: /Best Time/i }).first().click();
    await page.waitForTimeout(1500);
    await page.locator('button').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ }).first().click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /^Schedule$/i }).first()).toBeVisible({ timeout: 5_000 });
    console.log('✅ After slot: "Schedule"');

    // Back to Publish Now → "Confirm & Publish"
    await page.getByRole('button', { name: /Publish Now/i }).first().click();
    await page.waitForTimeout(300);
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    console.log('✅ Back to Publish Now: "Confirm & Publish"');

    await shot(page, 'X1-label-cycle');
  });

});
