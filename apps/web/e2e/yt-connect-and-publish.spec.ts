/**
 * Full YouTube flow: connect channel (by URL, no OAuth) → import video →
 * wait for analysis → open Shorts Studio → open Publish modal → AI thumbnails.
 *
 * Run:
 *   npx playwright test yt-connect-and-publish --project=chromium-desktop --headed --no-deps
 *
 * If you want to actually submit to YouTube, you need OAuth:
 *   Open /settings/channels in a browser and click "Connect with Google".
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth.json');
const API_BASE  = 'https://sozialzync-api-production.up.railway.app';
// 19-second "Me at the zoo" — shortest non-trivial public YT video
const TEST_YT_ID  = 'jNQXAC9IVRw';
const TEST_YT_URL = `https://www.youtube.com/watch?v=${TEST_YT_ID}`;

test.use({ storageState: AUTH_FILE });
test.setTimeout(600_000); // 10 min: yt-dlp + whisper can be slow

// ── helpers ──────────────────────────────────────────────────────────────────

async function getJwt(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: 'sozialzync@gmail.com', password: 'Admin@123' },
  });
  const body = await res.json() as { accessToken?: string };
  return body.accessToken!;
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/yt-flow-${name}.png`, fullPage: false });
}

async function poll<T>(
  fn: () => Promise<T | null>,
  isDone: (v: T) => boolean,
  intervalMs = 8_000,
  timeoutMs = 480_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v && isDone(v)) return v;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Poll timed out');
}

// ── Test ─────────────────────────────────────────────────────────────────────

test('YouTube: connect by URL → import → analyze → Shorts Studio → Publish modal', async ({ page, request }) => {
  const jwt = await getJwt(request);
  const authHdr = { Authorization: `Bearer ${jwt}` };

  // ── 1. Connect channel by URL (no OAuth) ──────────────────────────────────
  console.log('1. Connecting YouTube channel by URL…');
  let channelId: string;
  {
    // Check if already connected
    const listRes = await request.get(`${API_BASE}/api/v1/channels`, { headers: authHdr });
    const existing = (await listRes.json() as Array<{ id: string; name: string }>);
    if (existing.length > 0) {
      channelId = existing[0].id;
      console.log(`   Already connected: ${existing[0].name} (${channelId})`);
    } else {
      const connectRes = await request.post(`${API_BASE}/api/v1/channels/connect-by-url`, {
        headers: { ...authHdr, 'Content-Type': 'application/json' },
        data: { channelUrl: 'https://www.youtube.com/@jawed', access: 'READ_ONLY' },
      });
      expect(connectRes.ok(), `connect-by-url failed: ${await connectRes.text()}`).toBeTruthy();
      const conn = await connectRes.json() as { id: string; name: string };
      channelId = conn.id;
      console.log(`   Connected: ${conn.name} (${channelId})`);
    }
  }

  // ── 2. Import the test video ───────────────────────────────────────────────
  console.log(`2. Importing video ${TEST_YT_ID}…`);
  let videoId: string;
  {
    // Check if already imported
    const listRes = await request.get(
      `${API_BASE}/api/v1/shorts-studio/videos?channelId=${channelId}`,
      { headers: authHdr },
    );
    const existing = listRes.ok()
      ? (await listRes.json() as Array<{ id: string; youtubeVideoId?: string; status: string }>)
      : [];
    const already = existing.find(v => v.youtubeVideoId === TEST_YT_ID);
    if (already) {
      videoId = already.id;
      console.log(`   Already imported: ${videoId} (status: ${already.status})`);
    } else {
      const importRes = await request.post(`${API_BASE}/api/v1/shorts-studio/videos/import`, {
        headers: { ...authHdr, 'Content-Type': 'application/json' },
        data: { channelId, youtubeVideoId: TEST_YT_ID },
      });
      expect(importRes.ok(), `import failed: ${await importRes.text()}`).toBeTruthy();
      const imp = await importRes.json() as { id: string };
      videoId = imp.id;
      console.log(`   Import started: ${videoId}`);
    }
  }

  // ── 3. Trigger analysis (starts yt-dlp download) ─────────────────────────
  console.log('3. Triggering analysis (yt-dlp + Whisper)…');
  {
    const r = await request.post(
      `${API_BASE}/api/v1/shorts-studio/videos/${videoId}/analyze`,
      { headers: authHdr },
    );
    // 202 = queued, 409 = already running — both are fine
    expect([200, 202, 409], `analyze returned ${r.status()}: ${await r.text()}`).toContain(r.status());
    console.log(`   Analyze queued (${r.status()})`);
  }

  // ── 4. Poll analysis-status until done ───────────────────────────────────
  console.log('4. Polling analysis-status…');
  type AnalysisStatus = { sourceDownloaded?: boolean; pipeline?: { status?: string; error?: string }; counts?: Record<string, number> };
  const finalStatus = await poll<AnalysisStatus>(
    async () => {
      const r = await request.get(
        `${API_BASE}/api/v1/shorts-studio/videos/${videoId}/analysis-status`,
        { headers: authHdr },
      );
      if (!r.ok()) return null;
      return r.json() as Promise<AnalysisStatus>;
    },
    s => {
      const ps = (s.pipeline?.status ?? '').toUpperCase();
      const done = s.sourceDownloaded || ['COMPLETE', 'DONE', 'SUCCEEDED'].includes(ps);
      const failed = ['FAILED', 'ERROR'].includes(ps);
      console.log(`   downloaded=${s.sourceDownloaded} pipeline=${ps} counts=${JSON.stringify(s.counts ?? {})}`);
      if (failed) throw new Error(`Analysis FAILED: ${s.pipeline?.error ?? 'unknown'}`);
      return done;
    },
    8_000,
    480_000,
  );
  console.log(`   Analysis done ✅ — ${JSON.stringify(finalStatus.counts ?? {})}`);

  // ── 4. Open Shorts Studio UI ──────────────────────────────────────────────
  console.log('4. Opening Shorts Studio…');
  await page.goto('/shorts-studio', { waitUntil: 'networkidle' });
  await screenshot(page, '01-studio-loaded');

  // Select the channel in the dropdown if visible
  const channelDropdown = page.locator('button, [role="combobox"]')
    .filter({ hasText: /select.*channel|no channel/i }).first();
  if (await channelDropdown.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await channelDropdown.click();
    await page.locator('[role="option"], [role="menuitem"]').first().click();
    await page.waitForTimeout(1_500);
  }

  // ── 5. Find the imported video / a clip card ───────────────────────────────
  console.log('5. Looking for clip cards…');
  await screenshot(page, '02-after-channel-select');

  // Wait for at least one clip card to appear
  const clipCard = page.locator(
    '[data-testid="clip-card"], [class*="clip"], [class*="Clip"]'
  ).filter({ hasNotText: /loading|spinner/i }).first();

  await expect(clipCard).toBeVisible({ timeout: 60_000 });
  console.log('   Clip card visible ✅');
  await screenshot(page, '03-clip-cards');

  // ── 6. Click Publish on the first clip ────────────────────────────────────
  console.log('6. Clicking Publish…');
  const publishBtn = page.getByRole('button', { name: /^publish$/i }).first();
  await expect(publishBtn).toBeVisible({ timeout: 30_000 });
  await publishBtn.click();
  await screenshot(page, '04-publish-clicked');

  // ── 7. Verify Publish modal ────────────────────────────────────────────────
  console.log('7. Checking Publish modal…');
  const modal = page.locator('[role="dialog"]').first();
  await expect(modal).toBeVisible({ timeout: 15_000 });
  console.log('   Modal opened ✅');
  await screenshot(page, '05-modal-open');

  // ── 8. AI Thumbnail tab ────────────────────────────────────────────────────
  const aiTab = modal.getByRole('button', { name: /ai generate/i }).first();
  if (await aiTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    console.log('8. Switching to AI Generate tab…');
    await aiTab.click();

    const promptInput = modal.locator('textarea, input[placeholder*="prompt" i], input[placeholder*="describe" i]').first();
    if (await promptInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await promptInput.fill('dynamic speaker on stage, blue dramatic lighting, vertical format');
      const genBtn = modal.getByRole('button', { name: /generate with ai/i }).first();
      await expect(genBtn).toBeEnabled({ timeout: 5_000 });
      await genBtn.click();
      console.log('   Generating AI thumbnails (up to 90 s)…');
      await page.waitForFunction(
        () => !document.querySelector('[class*="animate-spin"], [class*="spinner"]'),
        { timeout: 90_000 },
      );
      console.log('   AI thumbnails generated ✅');
      await screenshot(page, '06-ai-thumbnails');

      // Verify at least one thumbnail loaded
      const thumbs = modal.locator('img').filter({ hasNot: page.locator('[alt*="broken"]') });
      const loadedCount = await thumbs.evaluateAll(
        (imgs: HTMLImageElement[]) => imgs.filter(i => i.naturalWidth > 0).length,
      );
      console.log(`   Loaded thumbnails: ${loadedCount}`);
      expect(loadedCount).toBeGreaterThanOrEqual(1);
    }
  }

  // ── 9. Verify platform selector & publish button ──────────────────────────
  console.log('9. Checking publish controls…');
  await screenshot(page, '07-ready-to-publish');

  const submitBtn = modal.getByRole('button', { name: /publish now|publish to youtube|submit/i }).first();
  await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  console.log(`   Submit button visible, disabled=${await submitBtn.isDisabled()} ✅`);

  console.log('\n✅ Full publish flow verified through UI. To actually upload, click "Publish now" in the browser.');
});
