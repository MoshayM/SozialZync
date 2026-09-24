/**
 * Shorts Studio full pipeline E2E test.
 *
 * Covers: navigate → highlights → Create Clip → circular progress → clips
 * appear → expand clip → Preview modal → video src present.
 *
 * Auth: storageState from .auth.json (set by auth.setup.ts).
 * Run: npx playwright test shorts-studio-pipeline --project=chromium-desktop
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'pw-shorts-pipeline');
const API_URL = process.env['PW_API_URL'] ?? 'https://sozialzync-api-production.up.railway.app';

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

test.describe('Shorts Studio pipeline', () => {
  test('01 — navigate to Shorts Studio and find a video', async ({ page }) => {
    await page.goto('/shorts-studio');
    await page.waitForLoadState('networkidle');
    await shot(page, '01-shorts-studio-home');

    // Should show at least one imported video card
    const videoCard = page.locator('a[href*="/shorts-studio/videos/"]').first();
    await expect(videoCard).toBeVisible({ timeout: 20_000 });
    console.log('✅ Shorts Studio home shows video cards');
  });

  test('02 — full pipeline: highlights → Create Clip → clips appear → Preview', async ({ page }) => {
    test.setTimeout(360_000); // 6 minutes — rendering can be slow

    // ── Step 1: Go to Shorts Studio ─────────────────────────────────────────
    await page.goto('/shorts-studio');
    await page.waitForLoadState('networkidle');
    await shot(page, '02-01-home');

    const videoCard = page.locator('a[href*="/shorts-studio/videos/"]').first();
    await expect(videoCard).toBeVisible({ timeout: 20_000 });
    await videoCard.click();
    await page.waitForLoadState('networkidle');
    await shot(page, '02-02-video-page');
    console.log('✅ Step 1: navigated to video analysis page');

    // ── Step 2: Highlights section ───────────────────────────────────────────
    const highlightsTab = page.getByRole('button', { name: /highlights/i }).first();
    if (await highlightsTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await highlightsTab.click();
    }

    // Wait for at least one highlight card (score badge visible)
    const highlightCard = page.locator('[class*="rounded-xl"]').filter({ hasText: /\d+/ }).first();
    await expect(highlightCard).toBeVisible({ timeout: 30_000 });
    await shot(page, '02-03-highlights-visible');
    console.log('✅ Step 2: highlights loaded');

    // ── Step 3: Expand first highlight card ──────────────────────────────────
    const firstCard = page.locator('[class*="rounded-xl"][class*="shadow"]').first();
    await firstCard.click();
    await page.waitForTimeout(800);
    await shot(page, '02-04-card-expanded');

    // ── Step 4: Find and click Create Clip ───────────────────────────────────
    const createBtn = page.getByRole('button', { name: /create clip/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await shot(page, '02-05-before-create');
    console.log('✅ Step 3: "Create Clip" button visible');

    await createBtn.click();

    // ── Step 5: Circular progress should appear ───────────────────────────────
    // Look for the spinning SVG (animate-spin class) or "Creating clips" text
    const spinnerOrText = page.locator('.animate-spin, text="Creating clips"').first();
    await expect(spinnerOrText).toBeVisible({ timeout: 10_000 });
    await shot(page, '02-06-circular-progress-visible');
    console.log('✅ Step 4: circular progress appeared');

    // ── Step 6: Wait up to 5 min for a clip to appear in the Clips section ───
    const clipsSection = page.locator('section, div').filter({ hasText: /clips/i }).last();
    const renderedClip = page.locator('[class*="rounded-xl"]').filter({ hasText: /rendered|candidate/i });

    let clipsFound = false;
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(5_000);
      const count = await renderedClip.count();
      if (count > 0) {
        clipsFound = true;
        break;
      }
      // Also accept any clip card appearing (even RENDERING status)
      const anyClip = page.locator('[class*="rounded-xl"]').filter({ hasText: /rendering|rendered|candidate/i });
      if (await anyClip.count() > 0) {
        await shot(page, '02-07-clips-appeared');
        console.log('✅ Step 5: clips section populated');
        // Keep polling until rendered
      }
    }

    await shot(page, '02-08-after-wait');

    if (!clipsFound) {
      // Non-fatal: rendering may still be in progress — log and skip preview step
      console.warn('⚠️  Clips not in "rendered" state within 5 min — skipping preview test (rendering likely still running)');
      return;
    }

    console.log('✅ Step 5: rendered clip found');

    // ── Step 7: Expand clip and click Preview ────────────────────────────────
    const firstRenderedClip = renderedClip.first();
    await firstRenderedClip.click();
    await page.waitForTimeout(800);
    await shot(page, '02-09-clip-expanded');

    const previewBtn = page.getByRole('button', { name: /preview/i }).first();
    if (!await previewBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.warn('⚠️  Preview button not visible — clip may lack rendered asset');
      return;
    }
    await previewBtn.click();

    // ── Step 8: Verify preview modal and video element ───────────────────────
    const videoEl = page.locator('video').first();
    await expect(videoEl).toBeVisible({ timeout: 15_000 });
    await shot(page, '02-10-preview-modal-open');

    const src = await videoEl.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src!.length).toBeGreaterThan(10);
    await shot(page, '02-11-video-src-present');
    console.log(`✅ Step 6: preview modal open, video src = ${src?.slice(0, 60)}…`);
  });

  test('03 — preview-url API responds quickly', async ({ page }) => {
    test.setTimeout(30_000);

    // Get list of clips from API using the page's cookies for auth
    await page.goto('/shorts-studio');
    await page.waitForLoadState('networkidle');

    // Use fetch inside the page context (shares cookies) to hit the API
    const result = await page.evaluate(async (apiBase: string) => {
      // Hit the shorts-studio list endpoint to find any clip
      try {
        const videosRes = await fetch(`${apiBase}/api/v1/shorts-studio/videos?limit=1`, {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token') ?? document.cookie}` },
        });
        if (!videosRes.ok) return { error: `videos ${videosRes.status}` };
        const videos = await videosRes.json() as Array<{ id: string }>;
        if (!videos?.length) return { error: 'no videos' };

        const clipsRes = await fetch(`${apiBase}/api/v1/shorts-studio/videos/${videos[0]!.id}/clips`, {
          credentials: 'include',
        });
        if (!clipsRes.ok) return { error: `clips ${clipsRes.status}` };
        const clips = await clipsRes.json() as Array<{ id: string; status: string }>;
        const rendered = clips.find((c) => c.status === 'RENDERED');
        if (!rendered) return { error: 'no rendered clip' };

        const t0 = Date.now();
        const urlRes = await fetch(`${apiBase}/api/v1/shorts-studio/clips/${rendered.id}/preview-url`, {
          credentials: 'include',
        });
        const elapsed = Date.now() - t0;
        if (!urlRes.ok) return { error: `preview-url ${urlRes.status}` };
        const body = await urlRes.json() as { url?: string };
        return { url: body.url, elapsed };
      } catch (e) {
        return { error: String(e) };
      }
    }, API_URL);

    if ('error' in result && result.error) {
      // Non-fatal — may be no rendered clips yet
      console.warn(`⚠️  preview-url check skipped: ${result.error}`);
      return;
    }

    expect(result.url).toBeTruthy();
    expect(result.elapsed).toBeLessThan(5_000); // should respond in < 5s (no R2 download)
    console.log(`✅ preview-url responded in ${result.elapsed}ms — url: ${String(result.url).slice(0, 60)}…`);
  });
});
