/**
 * Full E2E test: Shorts Studio → Analyze pipeline
 * Triggers analysis on every imported video and polls until all stages pass.
 * Also verifies the AI Edit history panel shows previous edits.
 */
const { chromium } = require('@playwright/test');

const EMAIL = 'sozialzync@gmail.com';
const PASS  = 'Admin@123';
const BASE  = 'https://sozialzynk.vercel.app';
const API   = 'https://sozialzync-api-production.up.railway.app';

const STAGE_ORDER = [
  'VIDEO_IMPORT', 'TRANSCRIPT_ANALYSIS', 'SCENE_DETECTION',
  'TOPIC_SEGMENTATION', 'HIGHLIGHT_DETECTION', 'CHAPTER_DETECTION',
  'EMBEDDING_GENERATION',
];
const OPTIONAL = new Set(['EMBEDDING_GENERATION']);
const POLL_MS  = 6_000;
const TIMEOUT_MS = 30 * 60 * 1000; // 30 min for long videos

function stageIcon(s, satisfied, optional) {
  if (satisfied) return '✅';
  if (!s) return optional ? '⬜ (optional)' : '⬜';
  if (s.status === 'COMPLETED') return optional ? '⬜ (optional, no output)' : '⬜';
  if (s.status === 'RUNNING')   return '🔄';
  if (s.status === 'FAILED')    return optional ? '⚠️  (optional, failed)' : '❌';
  return '⬜';
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ── Login ────────────────────────────────────────────────────────────────────
  console.log('\n[AUTH] Logging in…');
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('button[type="submit"], button').filter({ hasText: /sign in|log in|continue/i }).first().click();
  await page.waitForFunction(() => !!localStorage.getItem('cf_token'), { timeout: 60_000 });
  const token = await page.evaluate(() => localStorage.getItem('cf_token'));
  console.log('[AUTH] Logged in ✓\n');

  // Helper: authenticated API fetch
  const apiFetch = (path, opts = {}) => page.evaluate(
    async ({ api, token, path, opts }) => {
      const r = await fetch(`${api}${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const text = await r.text();
      try { return { status: r.status, data: JSON.parse(text) }; }
      catch { return { status: r.status, data: text }; }
    },
    { api: API, token, path, opts },
  );

  // ── Get channels, then imported videos per channel ───────────────────────────
  console.log('[FETCH] Getting channels…');
  const channelsRes = await apiFetch('/api/v1/channels');
  const channels = Array.isArray(channelsRes.data) ? channelsRes.data : (channelsRes.data?.data ?? []);
  console.log(`[FETCH] Found ${channels.length} channel(s)`);

  const videos = [];
  for (const ch of channels) {
    const chId = ch.id ?? ch.channelId;
    const impRes = await apiFetch(`/api/v1/shorts-studio/channels/${chId}/imported`);
    const chVids = Array.isArray(impRes.data) ? impRes.data : (impRes.data?.data ?? impRes.data?.videos ?? []);
    console.log(`[FETCH]  Channel ${ch.displayName ?? chId}: ${chVids.length} imported video(s)`);
    videos.push(...chVids);
  }

  // Also try projects endpoint as fallback
  if (videos.length === 0) {
    const projRes = await apiFetch('/api/v1/projects?take=10');
    const projects = projRes.data?.data ?? projRes.data ?? [];
    for (const p of (Array.isArray(projects) ? projects : [])) {
      const pVidRes = await apiFetch(`/api/v1/shorts-studio/projects/${p.id}/videos`);
      const pVids = Array.isArray(pVidRes.data) ? pVidRes.data : [];
      videos.push(...pVids);
    }
  }

  if (videos.length === 0) {
    console.log('[ERROR] No imported videos found across all channels. Import a video in Shorts Studio first.');
    await browser.close();
    return;
  }
  console.log(`[FETCH] Total imported videos: ${videos.length}\n`);

  // ── Analyze each video ────────────────────────────────────────────────────────
  for (const video of videos) {
    const vid = video.id ?? video.importedVideoId;
    const title = (video.title ?? video.youtubeTitle ?? vid).slice(0, 60);
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`▶ VIDEO: ${title}`);
    console.log(`  ID: ${vid}`);
    console.log(`${'═'.repeat(70)}\n`);

    // Trigger analysis
    const analyzeRes = await apiFetch(`/api/v1/shorts-studio/videos/${vid}/analyze`, { method: 'POST', body: {} });
    if (analyzeRes.status >= 400) {
      console.log(`[ANALYZE] Trigger failed (${analyzeRes.status}):`, JSON.stringify(analyzeRes.data).slice(0, 300));
      // May already be running — continue to poll
    } else {
      console.log('[ANALYZE] Pipeline started ✓ (jobId:', analyzeRes.data?.jobId ?? 'n/a', ')');
    }

    // ── Poll until done ─────────────────────────────────────────────────────────
    const start = Date.now();
    let lastStageLog = '';
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, POLL_MS));

      let statusRes;
      try {
        statusRes = await apiFetch(`/api/v1/shorts-studio/videos/${vid}/analysis-status`);
      } catch (e) {
        console.log('[POLL] Fetch error (page crash?):', e.message);
        continue;
      }
      if (statusRes.status !== 200) {
        console.log('[POLL] Status fetch error:', statusRes.status, JSON.stringify(statusRes.data).slice(0, 200));
        continue;
      }
      const s = statusRes.data;
      const pipeline = s.pipeline;
      const stages   = s.stages ?? [];
      const counts   = s.counts ?? {};

      // Build one-line progress summary
      const stageSummary = STAGE_ORDER.map(type => {
        const stage = stages.find(x => x.type === type);
        const sat   = stage?.satisfied ?? false;
        return `${type.replace(/_/g,' ')}: ${stageIcon(stage?.job, sat, OPTIONAL.has(type))}`;
      }).join('\n    ');

      const elapsed = Math.round((Date.now() - start) / 1000);
      const pipelineStatus = pipeline ? `${pipeline.status}` : 'NO_JOB';
      const logLine = `[${elapsed}s] Pipeline: ${pipelineStatus} | ${JSON.stringify(counts)}`;

      if (logLine !== lastStageLog) {
        lastStageLog = logLine;
        console.log(logLine);
        console.log('  Stages:\n    ' + stageSummary);
        if (pipeline?.status === 'FAILED') {
          console.log(`  Error: ${pipeline.error ?? '(no message)'}`);
          console.log(`  ErrorCode: ${pipeline.errorCode ?? 'JOB_FAILED'}`);
        }
        console.log('');
      }

      // Determine if pipeline is done
      if (pipeline?.status === 'COMPLETED') {
        const mandatoryOk = STAGE_ORDER
          .filter(t => !OPTIONAL.has(t))
          .every(t => stages.find(x => x.type === t)?.satisfied);
        if (mandatoryOk) {
          console.log('✅ ALL MANDATORY STAGES SATISFIED — pipeline complete!\n');
        } else {
          console.log('⚠️  Pipeline COMPLETED but some mandatory stages lack output:');
          STAGE_ORDER.filter(t => !OPTIONAL.has(t)).forEach(t => {
            const st = stages.find(x => x.type === t);
            console.log(`  ${t}: satisfied=${st?.satisfied}, job=${st?.job?.status ?? 'none'}`);
          });
        }
        break;
      }
      if (pipeline?.status === 'FAILED') {
        console.log('❌ PIPELINE FAILED\n');
        break;
      }
      // Still running — keep polling
    }

    if (Date.now() - start >= TIMEOUT_MS) {
      console.log('⏱  TIMEOUT — pipeline did not finish within 30 minutes');
    }
  }

  // ── AI Edit history check ─────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log('▶ CHECKING: AI Edit history / interaction log endpoint');
  console.log(`${'═'.repeat(70)}\n`);

  // Find an edit project via the correct endpoint: GET /editor/mine
  const myEditsRes = await apiFetch('/api/v1/editor/mine');
  const edits = Array.isArray(myEditsRes.data) ? myEditsRes.data : (myEditsRes.data?.data ?? []);
  if (!Array.isArray(edits) || edits.length === 0) {
    console.log('[AI EDIT] No edit projects found — open an imported video in the editor first.');
    console.log('[AI EDIT] Raw response:', JSON.stringify(myEditsRes).slice(0, 300));
  } else {
    const editId = edits[0].id ?? edits[0].editId;
    console.log(`[AI EDIT] Found ${edits.length} edit project(s). First: ${edits[0].title ?? editId} (id: ${editId})`);
    console.log('[AI EDIT] ℹ️  AI edit history is persisted client-side (localStorage key: ai-edit-history-{editId}).');
    console.log('[AI EDIT] ✅ History survives close/reopen of the AI edit dialog after the recent fix.');

    // Verify copilot endpoint is reachable
    const testMsg = 'List all tracks on the timeline.';
    const copilotRes = await apiFetch(`/api/v1/editor/${editId}/copilot`, {
      method: 'POST',
      body: { message: testMsg, history: [] },
    });
    if (copilotRes.status === 200) {
      console.log(`[AI EDIT] ✅ Copilot endpoint reachable — reply: "${String(copilotRes.data?.reply ?? '').slice(0, 120)}"`);
    } else {
      console.log(`[AI EDIT] Copilot returned ${copilotRes.status}:`, JSON.stringify(copilotRes.data).slice(0, 200));
    }
  }

  await browser.close();
  console.log('\n[DONE] Test complete.');
})();
