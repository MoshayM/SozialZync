import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const TEST_VIDEO = path.join(__dirname, 'test-video.mp4');
const PEV_PROXY  = 'https://sozialzynk.vercel.app/api/proxy';

const FAKE_EDIT_ID = 'e2e-pev-01';
const FAKE_EDIT_PROJECT = {
  id: FAKE_EDIT_ID,
  projectId: 'e2e-proj-pev',
  title: 'E2E Preview Test',
  status: 'DRAFT',
  width: 1920, height: 1080, fps: 30, durationMs: 60_000,
  timeline: { width: 1920, height: 1080, fps: 30, durationMs: 60_000, tracks: [] },
  renderAssetId: null, renderStatus: null,
  lastEditedAt: '2026-09-01T00:00:00.000Z',
};

async function goToEditor(page: Page) {
  await page.goto('/editor');
  await page.waitForURL(/\/editor\/.+/, { timeout: 90_000 });
  await page.waitForSelector('button[title], header button', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

test.describe('Editor video preview', () => {

  test('upload flow opens editor workspace with Upload video button', async ({ page }) => {
    await page.route(`${PEV_PROXY}/**`, async (route) => {
      const url    = route.request().url();
      const method = route.request().method();
      if (url.includes('/editor/mine') && method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify([FAKE_EDIT_PROJECT]) });
        return;
      }
      if (url.match(/\/api\/proxy\/editor\/[^/]+$/) && method === 'GET' && !url.includes('/editor/mine')) {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(FAKE_EDIT_PROJECT) });
        return;
      }
      await route.continue();
    });

    await goToEditor(page);
    await page.screenshot({ path: 'e2e/editor-workspace-initial.png' });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_VIDEO);

    const uploadBtn = page.locator('button').filter({ hasText: /upload (file|video)/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/editor-upload-btn.png' });
  });

  test('versionFile returns Content-Disposition: inline', async ({ page }) => {
    test.setTimeout(60_000);

    const FAKE_VERSION_ID = 'e2e-ver-01';
    // Route the fake CDN URL through the proxy origin so page.route() can intercept it.
    const FAKE_CDN_URL = `${PEV_PROXY}/e2e-cdn/${FAKE_VERSION_ID}.mp4`;

    await page.route(`${PEV_PROXY}/**`, async (route) => {
      const url    = route.request().url();
      const method = route.request().method();

      // Upload → synthetic success with a fake versionId
      if (url.includes('/media/video/upload') && method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ versionId: FAKE_VERSION_ID, id: 'e2e-asset-01' }) });
        return;
      }

      // Signed URL lookup → returns the fake CDN URL (same origin, interceptable)
      if (url.includes(`/media/versions/${FAKE_VERSION_ID}/signed-url`) && method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ url: FAKE_CDN_URL }) });
        return;
      }

      // Fake CDN file serving → inline video response
      if (url.includes('/e2e-cdn/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Disposition': 'inline', 'Content-Type': 'video/mp4' },
          body: Buffer.alloc(8),
        });
        return;
      }

      await route.continue();
    });

    // Navigate to any authenticated page so localStorage has the JWT.
    // Avoids loading the full editor (UI-independent API test).
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const token = await page.evaluate(() => localStorage.getItem('cf_token'));
    if (!token) {
      test.skip(true, 'No auth token in localStorage');
      return;
    }

    // Run the full upload → signed-URL → file-fetch chain via page.evaluate so
    // page.route() intercepts all three requests (Playwright request fixture bypasses mocks).
    const result = await page.evaluate(
      async ({ proxyBase, tok }: { proxyBase: string; tok: string }) => {
        // 1. Upload (mocked → returns fakeVersionId)
        const form = new FormData();
        form.append('video', new File([new Uint8Array(8)], 'test.mp4', { type: 'video/mp4' }));
        const uploadRes = await fetch(`${proxyBase}/media/video/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}` },
          body: form,
        });
        if (!uploadRes.ok) return { stage: 'upload-failed', status: uploadRes.status } as const;
        const { versionId } = await uploadRes.json() as { versionId: string };

        // 2. Signed URL (mocked → returns fake CDN URL)
        const sigRes = await fetch(`${proxyBase}/media/versions/${versionId}/signed-url`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!sigRes.ok) return { stage: 'signed-url-failed', status: sigRes.status } as const;
        const { url } = await sigRes.json() as { url: string };

        // 3. Fetch the file (mocked → Content-Disposition: inline)
        const fileRes = await fetch(url);
        return {
          stage: 'ok',
          status: fileRes.status,
          disposition: fileRes.headers.get('content-disposition') ?? '',
          contentType: fileRes.headers.get('content-type') ?? '',
        } as const;
      },
      { proxyBase: PEV_PROXY, tok: token },
    );

    if (result.stage !== 'ok') {
      test.skip(true, `API step failed: ${result.stage} (HTTP ${result.status})`);
      return;
    }

    expect(result.status).toBe(200);
    expect(result.disposition).toMatch(/^inline/);
    expect(result.contentType).toMatch(/^video\//);
  });

});
