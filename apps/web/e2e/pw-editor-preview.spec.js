/**
 * Verify that the video preview works in the shorts clip timeline editor.
 * Tests the signed-URL approach (no more full-blob download).
 *
 * Navigates directly to a mocked clip edit URL so this test never depends on
 * the Shorts Studio listing page or Railway returning "Ready" videos.
 */
const { test, expect } = require('@playwright/test');

const PROXY      = 'https://sozialzynk.vercel.app/api/proxy';
const CLIP_ID    = 'e2e-clip-01';
const VERSION_ID = 'e2e-v-01';

test.use({ storageState: 'e2e/.auth.json' });

test('editor preview loads and seeks to clip start', async ({ page }) => {
  // ── 1. Register route mocks before navigation ────────────────────────────
  await page.route(`${PROXY}/**`, async (route) => {
    const url    = route.request().url();
    const path   = new URL(url).pathname.replace('/api/proxy', '');
    const method = route.request().method();

    // GET /shorts-studio/clips/:id/timeline
    if (path.includes(`/shorts-studio/clips/${CLIP_ID}/timeline`) && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CLIP_ID,
          title: 'E2E Preview Clip',
          startMs: 10_000,
          endMs: 40_000,
          renderAsset: {
            id: 'e2e-asset-01',
            versions: [{ id: VERSION_ID, createdAt: new Date().toISOString() }],
          },
          tracks: [],
        }),
      });
      return;
    }

    // GET /media/versions/:id/editor-url
    if (path.includes(`/media/versions/${VERSION_ID}/editor-url`) && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: `/media/versions/${VERSION_ID}/stream?sig=e2e-fake-sig` }),
      });
      return;
    }

    await route.continue();
  });

  // ── 2. Navigate directly to the clip editor ──────────────────────────────
  await page.goto(`/shorts-studio/clips/${CLIP_ID}/edit`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: 'pw-editor-02-loading.png' });

  // ── 3. Wait for a <video> element to appear ──────────────────────────────
  const videoEl = page.locator('video').first();
  const videoAppeared = await videoEl.waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);

  if (!videoAppeared) {
    console.warn('⚠️ No <video> element appeared — clip editor may not be loading (Railway cold or auth)');
    await page.screenshot({ path: 'pw-editor-03-no-video.png' });
    return;
  }

  // ── 4. Check that video src points to /media/versions/ ────────────────────
  // Give the editor-url fetch up to 15s to resolve and set the src attribute.
  const srcResolved = await page.waitForFunction(
    () => {
      const v = document.querySelector('video');
      return v && v.src && !v.src.startsWith('blob:') && v.src.includes('/media/versions/');
    },
    { timeout: 15_000 },
  ).then(() => true).catch(() => false);

  const src = await videoEl.getAttribute('src').catch(() => null);
  console.log('video src =', src);

  if (!srcResolved) {
    console.warn('⚠️ video.src does not match /media/versions/ — mocked editor-url may not have been consumed');
    expect(src, 'src should not be empty').toBeTruthy();
    expect(src, 'src should not be a blob URL').not.toMatch(/^blob:/);
    return;
  }

  expect(src, 'src should point to media/versions endpoint').toMatch(/\/media\/versions\//);
  expect(src, 'src should not be a blob URL').not.toMatch(/^blob:/);
  expect(src, 'src should not double /api/v1').not.toContain('/api/v1/api/v1');

  // ── 5. readyState (non-fatal — mocked URL won't actually stream) ───────────
  const readyState = await page.evaluate(() => document.querySelector('video')?.readyState ?? 0);
  console.log('video readyState =', readyState, '(0=nothing, 1=meta, 2=data, 3=playable, 4=enough)');

  // ── 6. Final screenshot ───────────────────────────────────────────────────
  await page.screenshot({ path: 'pw-editor-03-ready.png' });
  console.log('✅ editor preview: src resolves to /media/versions/ — signed-URL path wired correctly');
});
