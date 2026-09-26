/**
 * Real YouTube import integration test — no mocks.
 * Tests the full pipeline: import metadata → trigger analyze → poll until done.
 *
 * Run: npx playwright test youtube-import-real --project=chromium-desktop
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env['PW_API_URL'] ?? 'https://sozialzync-api-production.up.railway.app';
const ADMIN_EMAIL = process.env['PW_ADMIN_EMAIL'] ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env['PW_ADMIN_PASS']  ?? 'Admin@123';

// A short, public YouTube video (Rick Astley — stable, always up)
const TEST_YT_ID = 'dQw4w9WgXcQ';

async function getJwt(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
  });
  expect(res.status(), 'Login must succeed').toBeLessThan(300);
  const body = await res.json() as { accessToken?: string };
  expect(body.accessToken, 'accessToken must be present').toBeTruthy();
  return body.accessToken!;
}

async function getFirstChannelId(
  request: import('@playwright/test').APIRequestContext,
  jwt: string,
): Promise<string | null> {
  const res = await request.get(`${API_BASE}/api/v1/channels`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok()) return null;
  const channels = await res.json() as Array<{ id: string; name: string }>;
  return channels[0]?.id ?? null;
}

test.describe('YouTube import — real pipeline (no mocks)', () => {
  test.setTimeout(300_000); // 5 min: yt-dlp + ffmpeg processing

  test('full pipeline: import → analyze → success', async ({ request }) => {
    // ── 1. Auth ────────────────────────────────────────────────────────────────
    const jwt = await getJwt(request);
    console.log('✓ Authenticated');

    // ── 2. Get channel ─────────────────────────────────────────────────────────
    const channelId = await getFirstChannelId(request, jwt);
    if (!channelId) {
      console.log('⚠ No YouTube channel connected — skipping (connect a channel in Settings)');
      test.skip();
      return;
    }
    console.log(`✓ Using channelId: ${channelId}`);

    // ── 3. Import video metadata ───────────────────────────────────────────────
    const importRes = await request.post(`${API_BASE}/api/v1/shorts-studio/videos/import`, {
      headers: { Authorization: `Bearer ${jwt}` },
      data: { channelId, youtubeVideoId: TEST_YT_ID },
    });

    console.log(`Import response status: ${importRes.status()}`);
    const importBody = await importRes.json() as { id?: string; status?: string };
    console.log('Import body:', JSON.stringify(importBody, null, 2));

    expect(importRes.status(), 'Import must return 2xx').toBeLessThan(300);
    expect(importBody.id, 'Import must return an importedVideoId').toBeTruthy();

    const importedVideoId = importBody.id!;
    console.log(`✓ ImportedVideo created: ${importedVideoId}`);

    // ── 4. Trigger analysis (starts yt-dlp download) ──────────────────────────
    const analyzeRes = await request.post(
      `${API_BASE}/api/v1/shorts-studio/videos/${importedVideoId}/analyze`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    console.log(`Analyze response status: ${analyzeRes.status()}`);
    const analyzeBody = await analyzeRes.json().catch(() => ({})) as Record<string, unknown>;
    console.log('Analyze body:', JSON.stringify(analyzeBody, null, 2));

    // 409 = already processing — that's fine
    expect(
      analyzeRes.status() === 200 || analyzeRes.status() === 202 || analyzeRes.status() === 409,
      `Analyze must return 200/202/409, got ${analyzeRes.status()}`,
    ).toBeTruthy();

    console.log('✓ Analysis queued — polling status...');

    // ── 5. Poll analysis status ────────────────────────────────────────────────
    const deadline = Date.now() + 240_000; // 4 min
    let lastStatus = 'UNKNOWN';

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 10_000));

      const statusRes = await request.get(
        `${API_BASE}/api/v1/shorts-studio/videos/${importedVideoId}/analysis-status`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );

      if (!statusRes.ok()) {
        console.log(`Status poll returned ${statusRes.status()} — retrying`);
        continue;
      }

      const statusBody = await statusRes.json() as {
        sourceDownloaded?: boolean;
        transcriptStatus?: string;
        pipeline?: { status?: string; error?: string };
        stages?: Array<{ type: string; satisfied: boolean }>;
        counts?: Record<string, number>;
      };

      const downloaded = statusBody.sourceDownloaded ?? false;
      const pipelineStatus = statusBody.pipeline?.status ?? 'PENDING';
      const counts = statusBody.counts ?? {};
      lastStatus = downloaded ? 'READY' : (pipelineStatus === 'FAILED' ? 'FAILED' : 'PROCESSING');

      console.log(
        `downloaded=${downloaded} pipeline=${pipelineStatus} ` +
        `transcript=${statusBody.transcriptStatus ?? '?'} ` +
        `counts=${JSON.stringify(counts)}`,
      );

      if (lastStatus === 'READY') {
        console.log('✓ Video processing SUCCEEDED — yt-dlp + ffmpeg pipeline working!');
        break;
      }

      if (lastStatus === 'FAILED') {
        console.log(`✗ Video processing FAILED: ${statusBody.pipeline?.error ?? 'no error detail'}`);
        break;
      }
    }

    // ── 6. Assert ──────────────────────────────────────────────────────────────
    expect(
      lastStatus,
      `Expected READY but got ${lastStatus} — check Railway logs for yt-dlp errors. ` +
      `If "cookies" is mentioned, set YOUTUBE_COOKIES_CONTENT env var on Railway.`,
    ).toBe('READY');
  });
});
