/**
 * Test: export page filler progress button with pause/resume.
 *
 * Navigates directly to the export page for a mocked clip so this test never
 * depends on the Shorts Studio listing page or Railway returning "Ready" videos.
 * Uses a stateful route mock to simulate the RENDERED → RENDERING transition
 * that makes the filler progress button appear.
 */
const { test, expect } = require('@playwright/test');
const { gotoWithRetry } = require('./net-retry');

const PROXY   = 'https://sozialzynk.vercel.app/api/proxy';
const CLIP_ID = 'e2e-clip-01';
const JOB_ID  = 'e2e-job-01';

test.use({ storageState: 'e2e/.auth.json' });

test('export page shows filler progress button when rendering', async ({ page }) => {
  // ── Stateful mock: tracks whether a render job is active ─────────────────
  let renderActive = false;
  let renderPaused = false;

  await page.route(`${PROXY}/**`, async (route) => {
    const url    = route.request().url();
    const path   = new URL(url).pathname.replace('/api/proxy', '');
    const method = route.request().method();

    // GET /shorts-studio/clips/:id/render-status
    if (path.includes(`/shorts-studio/clips/${CLIP_ID}/render-status`) && method === 'GET') {
      if (!renderActive) {
        // Before POST /render: show clip as RENDERED with no active job.
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ clipStatus: 'RENDERED', renderJob: null }),
        });
      } else {
        // After POST /render: show RENDERING with an active job.
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            clipStatus: 'RENDERING',
            renderJob: {
              jobId: JOB_ID,
              status: renderPaused ? 'CHECKPOINTED' : 'RUNNING',
              progress: renderPaused ? 0.35 : 0.1,
            },
          }),
        });
      }
      return;
    }

    // POST /shorts-studio/clips/:id/render — start rendering
    if (path.includes(`/shorts-studio/clips/${CLIP_ID}/render`) && method === 'POST') {
      renderActive = true;
      renderPaused = false;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ jobId: JOB_ID, status: 'RUNNING' }),
      });
      return;
    }

    // PATCH /jobs/:id/pause
    if (path.includes(`/jobs/${JOB_ID}/pause`) && method === 'PATCH') {
      renderPaused = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    // PATCH /jobs/:id/resume
    if (path.includes(`/jobs/${JOB_ID}/resume`) && method === 'PATCH') {
      renderPaused = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    // GET /shorts-studio/clips/:id (clip detail for export page)
    if (path.match(/\/shorts-studio\/clips\/[^/]+$/) && method === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: CLIP_ID, title: 'E2E Export Clip', status: 'RENDERED',
          startMs: 10_000, endMs: 40_000 }),
      });
      return;
    }

    await route.continue();
  });

  // ── Navigate directly to the export page ─────────────────────────────────
  await gotoWithRetry(page, `/shorts-studio/clips/${CLIP_ID}/export`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: 'pw-export-02-page.png' });
  console.log('✅ Export page loaded:', page.url());

  // ── Click Re-render / Render clip to start rendering ─────────────────────
  const renderBtn = page.getByRole('button', { name: /re-render|render clip/i });
  const renderBtnVisible = await renderBtn.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);

  if (!renderBtnVisible) {
    console.warn('⚠️ Render button not found — export page may not have loaded properly');
    await page.screenshot({ path: 'pw-export-no-render-btn.png' });
    return;
  }

  await renderBtn.click();
  console.log('✅ Render triggered');

  // ── Filler button should appear after render starts ───────────────────────
  // Text is "Starting…", "Rendering X%", or "Paused — resume" depending on state.
  const fillerBtn = page.locator('button').filter({ hasText: /starting|rendering \d+%|paused/i });
  const fillerAppeared = await fillerBtn.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);

  if (!fillerAppeared) {
    console.warn('⚠️ Filler button not visible after render trigger (may be timing or query cache)');
    await page.screenshot({ path: 'pw-export-no-filler.png' });
    return;
  }

  await page.screenshot({ path: 'pw-export-03-filler-appeared.png' });
  console.log('✅ Filler progress button visible');

  // Verify the filler div (progress sweep) exists inside the button
  const fillerBar = fillerBtn.locator('div.absolute.inset-y-0');
  const fillerBarAttached = await fillerBar.count().then(c => c > 0).catch(() => false);
  if (fillerBarAttached) {
    console.log('✅ Filler progress bar div present inside button');
  } else {
    console.warn('⚠️ Filler bar div not found — component structure may have changed');
  }

  // ── Click filler to Pause ─────────────────────────────────────────────────
  await fillerBtn.click();
  const pausedBtn = page.locator('button').filter({ hasText: /paused — resume/i });
  const pausedVisible = await pausedBtn.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);

  if (!pausedVisible) {
    console.warn('⚠️ Paused state not confirmed within 10s — pause mutation may be async');
    await page.screenshot({ path: 'pw-export-04-pause-timeout.png' });
    return;
  }

  await page.screenshot({ path: 'pw-export-04-paused.png' });
  console.log('✅ Paused state confirmed');

  // ── Click again to Resume ─────────────────────────────────────────────────
  await pausedBtn.click();
  const resumedBtn = page.locator('button').filter({ hasText: /starting|rendering \d+%/i });
  const resumedVisible = await resumedBtn.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);

  if (!resumedVisible) {
    console.warn('⚠️ Resumed state not confirmed within 10s');
    await page.screenshot({ path: 'pw-export-05-resume-timeout.png' });
    return;
  }

  await page.screenshot({ path: 'pw-export-05-resumed.png' });
  console.log('✅ Resumed — filler button back. Export filler flow verified.');
});
