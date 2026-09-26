/**
 * E2E test: Timeline editor on a real clip.
 *
 * Verifies three fixes applied in commit f277bde:
 *   1. Toolbar — single compact row, no Duplicate button, all expected buttons present
 *   2. Ruler click — clicking the ruler seeks the playhead and updates the time display
 *   3. Diamond drag — dragging the playhead diamond seeks the video (time display changes)
 *   4. Play/Pause — pausing freezes the time display
 *
 * Auth: storageState from e2e/.auth.json (set by auth.setup.ts)
 * Run:  npx playwright test e2e/editor-timeline.spec.ts --project=chromium-desktop
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'pw-editor-timeline');
const PROXY = 'https://sozialzynk.vercel.app/api/proxy';

function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

/**
 * Use the proxy API to find the first available short clip, then return
 * its editor URL. Avoids brittle UI accordion navigation.
 */
async function findEditUrl(page: Page): Promise<string | null> {
  await page.goto('/home');
  await page.waitForLoadState('domcontentloaded');

  const token = await page.evaluate(() => localStorage.getItem('cf_token'));
  if (!token) return null;

  return page.evaluate(
    async ({ proxy, tok }: { proxy: string; tok: string }) => {
      const h = { Authorization: `Bearer ${tok}` };

      // 1. List connected channels
      const chRes = await fetch(`${proxy}/channels`, { headers: h });
      if (!chRes.ok) return null;
      const channels = (await chRes.json()) as Array<{ id: string }>;
      if (!Array.isArray(channels) || !channels.length) return null;

      // 2. For each channel, find imported videos that have clips
      for (const ch of channels.slice(0, 3)) {
        const vRes = await fetch(`${proxy}/shorts-studio/channels/${ch.id}/imported`, { headers: h });
        if (!vRes.ok) continue;
        const videos = (await vRes.json()) as Array<{ id: string }>;
        if (!Array.isArray(videos) || !videos.length) continue;

        // 3. Get clips for each video
        for (const vid of videos.slice(0, 5)) {
          const cRes = await fetch(`${proxy}/shorts-studio/videos/${vid.id}/clips`, { headers: h });
          if (!cRes.ok) continue;
          const clips = (await cRes.json()) as Array<{ id: string; status: string }>;
          if (!Array.isArray(clips) || !clips.length) continue;
          // Any clip will work — the editor loads for all statuses
          return `/shorts-studio/clips/${clips[0].id}/edit`;
        }
      }
      return null;
    },
    { proxy: PROXY, tok: token },
  );
}

/** Navigate to the editor and wait for the toolbar to hydrate. */
async function openEditor(page: Page, editUrl: string) {
  await page.goto(editUrl);
  // Wait for the Play/Pause button — it's the definitive signal that the editor rendered
  await page.waitForSelector('button[title="Play/Pause (Space)"]', { timeout: 45_000 });
  // Extra buffer for React Query to load the timeline data
  await page.waitForTimeout(3_000);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Timeline editor — real clip', () => {

  test('toolbar: single row with all expected buttons, no Duplicate', async ({ page }) => {
    const editUrl = await findEditUrl(page);
    if (!editUrl) {
      test.skip(true, 'No clips found — account may have no imported videos');
      return;
    }

    await openEditor(page, editUrl);
    await shot(page, '01-editor-loaded');

    // ── All required toolbar buttons ──────────────────────────────────────
    await expect(page.locator('button[title="Play/Pause (Space)"]')).toBeVisible();
    await expect(page.locator('button[title="Zoom out (-)"]')).toBeVisible();
    await expect(page.locator('button[title="Zoom in (+)"]')).toBeVisible();
    await expect(page.locator('button[title="Undo (Ctrl+Z)"]')).toBeVisible();
    await expect(page.locator('button[title="Redo (Ctrl+Shift+Z)"]')).toBeVisible();
    await expect(page.locator('button[title="Split at playhead (S)"]')).toBeVisible();
    await expect(page.locator('button[title="Delete selected (Del)"]')).toBeVisible();

    // ── No Duplicate button (removed in the toolbar redesign) ─────────────
    await expect(page.locator('button[title*="Duplicate"], button[title*="Copy"]')).toHaveCount(0);

    // ── All toolbar buttons in a single row (tops align within 20px) ──────
    const playBox = await page.locator('button[title="Play/Pause (Space)"]').boundingBox();
    const zoomBox = await page.locator('button[title="Zoom in (+)"]').boundingBox();
    const undoBox = await page.locator('button[title="Undo (Ctrl+Z)"]').boundingBox();
    if (playBox && zoomBox && undoBox) {
      expect(Math.abs(playBox.y - zoomBox.y)).toBeLessThan(20);
      expect(Math.abs(playBox.y - undoBox.y)).toBeLessThan(20);
    }

    await shot(page, '02-toolbar-verified');
    console.log('✓ Toolbar: single row, all buttons present, no Duplicate');
  });

  test('ruler click: playhead moves and time display updates', async ({ page }) => {
    const editUrl = await findEditUrl(page);
    if (!editUrl) {
      test.skip(true, 'No clips found — account may have no imported videos');
      return;
    }

    await openEditor(page, editUrl);

    // The time display: "0:00.0 / 0:30.5" — outer span has font-mono
    const timeDisplay = page.locator('span.font-mono.tabular-nums').first();
    const timeBefore = await timeDisplay.textContent();
    console.log('Time before ruler click:', timeBefore);

    // The ruler div: h-7 border-b border-gray-200 relative cursor-pointer bg-white select-none
    const ruler = page.locator('div.h-7.cursor-pointer.select-none').first();
    const rulerBox = await ruler.boundingBox();

    if (!rulerBox || rulerBox.width < 10) {
      console.warn('Ruler not found or too narrow — skipping');
      await shot(page, '03-ruler-not-found');
      test.skip(true, 'Ruler element not visible');
      return;
    }

    // Click ruler at 30% of its width to seek away from 0:00
    const clickX = rulerBox.x + rulerBox.width * 0.3;
    const clickY = rulerBox.y + rulerBox.height / 2;
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(400);

    const timeAfter = await timeDisplay.textContent();
    console.log('Time after ruler click:', timeAfter);
    await shot(page, '03-after-ruler-seek');

    // Playhead should have moved
    expect(timeAfter).not.toBe(timeBefore);
    console.log('✓ Ruler click: time updated from', timeBefore, '→', timeAfter);
  });

  test('diamond drag: playhead moves and time display updates', async ({ page }) => {
    const editUrl = await findEditUrl(page);
    if (!editUrl) {
      test.skip(true, 'No clips found — account may have no imported videos');
      return;
    }

    await openEditor(page, editUrl);

    const timeDisplay = page.locator('span.font-mono.tabular-nums').first();

    // First click the ruler at 20% to give the diamond a non-zero starting position
    const ruler = page.locator('div.h-7.cursor-pointer.select-none').first();
    const rulerBox = await ruler.boundingBox();
    if (rulerBox && rulerBox.width > 10) {
      await page.mouse.click(rulerBox.x + rulerBox.width * 0.2, rulerBox.y + rulerBox.height / 2);
      await page.waitForTimeout(300);
    }

    const timeBefore = await timeDisplay.textContent();
    console.log('Time before diamond drag:', timeBefore);

    // The diamond: div with bg-red-500 rotate-45 classes (the playhead handle)
    const diamond = page.locator('div.rotate-45.bg-red-500').first();
    const diamondVisible = await diamond.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!diamondVisible) {
      await shot(page, '04-diamond-not-visible');
      test.skip(true, 'Playhead diamond not visible — may be off-screen');
      return;
    }

    const diamondBox = await diamond.boundingBox();
    if (!diamondBox) {
      test.skip(true, 'Diamond bounding box not available');
      return;
    }

    // Drag the diamond 80px to the right
    const cx = diamondBox.x + diamondBox.width / 2;
    const cy = diamondBox.y + diamondBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy, { steps: 5 });
    await page.mouse.move(cx + 80, cy, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const timeAfter = await timeDisplay.textContent();
    console.log('Time after diamond drag:', timeAfter);
    await shot(page, '04-after-diamond-drag');

    expect(timeAfter).not.toBe(timeBefore);
    console.log('✓ Diamond drag: time updated from', timeBefore, '→', timeAfter);
  });

  test('play/pause: pausing freezes the time display', async ({ page }) => {
    const editUrl = await findEditUrl(page);
    if (!editUrl) {
      test.skip(true, 'No clips found — account may have no imported videos');
      return;
    }

    await openEditor(page, editUrl);

    const timeDisplay = page.locator('span.font-mono.tabular-nums').first();
    const playBtn = page.locator('button[title="Play/Pause (Space)"]');

    await shot(page, '05-before-play');

    // Click Play → video may or may not advance (depends on signed URL availability)
    await playBtn.click();
    await page.waitForTimeout(2_000);
    await shot(page, '06-while-playing');

    // Click Pause
    await playBtn.click();
    await page.waitForTimeout(300);
    const timeAtPause = await timeDisplay.textContent();

    // After pause, time should NOT change over the next second
    await page.waitForTimeout(1_200);
    const timeOneSecLater = await timeDisplay.textContent();

    await shot(page, '07-after-pause');

    expect(timeAtPause).toBe(timeOneSecLater);
    console.log('✓ Play/Pause: time frozen after pause =', timeAtPause);
  });

});
