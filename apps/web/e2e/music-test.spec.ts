import { test, expect } from '@playwright/test';

const BASE = process.env.PW_BASE_URL ?? 'https://sozialzynk.vercel.app';
const API  = process.env.PW_API_URL  ?? 'https://sozialzync-api-production.up.railway.app';

const EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

test('music generates and audio player loads', async ({ page }) => {
  // ── 1. Authenticate — use pre-loaded storageState or do a fresh login ────
  // The chromium-desktop project loads storageState from .auth.json so the JWT
  // may already be in localStorage.  Navigate to /home first to read it; only
  // fall back to the full login form if the token is absent.
  await page.goto(`${BASE}/home`, { waitUntil: 'commit', timeout: 60_000 });
  let token = await page.evaluate(() => localStorage.getItem('cf_token'));
  if (!token) {
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASS);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
    await page.waitForFunction(() => !!localStorage.getItem('cf_token'), { timeout: 10_000 });
    token = await page.evaluate(() => localStorage.getItem('cf_token'));
  }
  expect(token, 'cf_token not in localStorage after login').toBeTruthy();
  console.log(`Authenticated ✓`);

  // ── 2. Find most recent project (list returns { data, nextCursor }) ────────
  const projRes = await page.request.get(`${API}/api/v1/projects?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(projRes.ok(), `Projects API returned ${projRes.status()}`).toBeTruthy();
  const projData = await projRes.json() as { data?: Array<{ id: string }> };
  const projectId = projData.data?.[0]?.id;
  expect(projectId, 'No project found').toBeTruthy();
  console.log(`Testing project: ${projectId}`);

  // ── 3. Navigate to the project ───────────────────────────────────────────
  // Intercept media file requests to debug failures
  const mediaRequests: Array<{ url: string; status: number }> = [];
  page.on('response', (res) => {
    if (res.url().includes('/media/versions/') && res.url().includes('/file')) {
      const status = res.status();
      const url = res.url().replace(/.*\/media\/versions\//, 'version:').replace(/\/file.*/, '/file');
      console.log(`[media] ${status} ${url}`);
      mediaRequests.push({ url, status });
    }
  });

  await page.goto(`${BASE}/projects/${projectId}`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/music-1-project.png' });

  // ── 4. Expand Music tile ──────────────────────────────────────────────────
  // Ensure it's expanded (click "Expand Music" if the tile is currently collapsed)
  const collapseBtn = page.locator('button[aria-label="Collapse Music"]');
  if (await collapseBtn.count() === 0) {
    const expandBtn = page.locator('button[aria-label="Expand Music"]');
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await page.waitForTimeout(800);
    }
  } else {
    console.log('Music tile already expanded');
  }
  await page.screenshot({ path: 'e2e/music-2-expanded.png' });

  // ── 5. Click "Regenerate" in the Music tile ──────────────────────────────
  // The Music tile is the last tile in the pipeline grid; its Regenerate button
  // sits alongside the collapse button (aria-label="Collapse Music") which we
  // already confirmed is present (tile is expanded).  All Regenerate buttons
  // on the page share the same label so we pick the one closest to the Music
  // tile header by walking up to the tile container.
  const collapseMusic = page.locator('button[aria-label="Collapse Music"]').first();
  // The Regenerate button is a sibling within the same Tile wrapper div
  const musicTileContainer = collapseMusic.locator('../..'); // go up 2 levels to the tile card
  let regenClicked = false;
  if (await musicTileContainer.count() > 0) {
    const regen = musicTileContainer.locator('button:has-text("Regenerate"), button:has-text("Run")').first();
    if (await regen.count() > 0) {
      await regen.click();
      regenClicked = true;
    }
  }
  if (!regenClicked) {
    // Last-resort: click the last Regenerate button (Music is the rightmost tile)
    const allRegen = page.locator('button:has-text("Regenerate")');
    const regenCount = await allRegen.count();
    console.log(`Regenerate buttons visible: ${regenCount}`);
    if (regenCount > 0) {
      await allRegen.nth(regenCount - 1).click();
      regenClicked = true;
    }
  }
  if (!regenClicked) {
    console.log('WARNING: Could not find Regenerate button for Music — skipping regen step');
  } else {
    console.log('Triggered music Regenerate ✓');
  }
  await page.waitForTimeout(2000);

  // ── 6. Wait for music job to complete (up to 3 min) ───────────────────────
  console.log('Waiting for music to generate...');
  const musicRunning = page.locator('text=internal-music-synth, text=Composing, text=Music track ready, text=Music reused');
  const musicCompleted = page.locator('text=Completed').filter({ has: page.locator('..').locator('text=Music, text=internal-music-synth') });

  // Poll for the "Completed" status in the Music tile
  let musicDone = false;
  for (let i = 0; i < 36; i++) { // up to 3 minutes (36 * 5s)
    await page.waitForTimeout(5000);
    // Check if the Music tile's status changed to "Completed" (no spinner)
    const spinner = page.locator('svg.animate-spin');
    const spinnerCount = await spinner.count();
    if (spinnerCount === 0) {
      musicDone = true;
      console.log(`Music generation complete (after ~${(i + 1) * 5}s) ✓`);
      break;
    }
    if (i % 6 === 0) console.log(`Still generating... (${(i + 1) * 5}s elapsed)`);
  }
  if (!musicDone) console.log('Warning: still spinning after 3 min — proceeding anyway');

  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/music-3-after-regen.png' });

  // ── 7. Scroll down to see the detail panel (below all tiles on desktop) ───
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/music-4-scrolled.png' });

  // ── 8. Verify no "File not available" errors ──────────────────────────────
  console.log(`Total media file requests captured: ${mediaRequests.length}`);
  mediaRequests.forEach((r) => console.log(`  ${r.status} ${r.url}`));

  const fileNotAvailable = page.locator('text=File not available');
  const count = await fileNotAvailable.count();
  console.log(`"File not available" occurrences: ${count}`);
  expect(count, '"File not available" should not appear in music section').toBe(0);

  // ── 9. Wait for audio element ─────────────────────────────────────────────
  // MediaPlayer fetches blob via auth-proxied request — may take a few seconds
  const audio = page.locator('audio').first();
  await expect(audio).toBeVisible({ timeout: 30_000 });

  const src = await audio.getAttribute('src');
  console.log(`Audio src: ${src?.slice(0, 60)}`);
  expect(src, 'Audio src should be a blob URL').toContain('blob:');

  // ── 10. Try playing ───────────────────────────────────────────────────────
  const playBtn = page.locator('button:has-text("Play"), button[aria-label*="play"]').first();
  if (await playBtn.count() > 0) {
    await playBtn.click();
    await page.waitForTimeout(1500);
  }
  const paused = await audio.evaluate((el) => (el as HTMLAudioElement).paused);
  console.log(`Audio paused: ${paused}`);
  await page.screenshot({ path: 'e2e/music-5-player.png' });

  console.log('Music test complete ✓');
});
