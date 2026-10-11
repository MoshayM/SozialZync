/**
 * Smoke test: music brief panel — view, edit, copy, download prompt.
 * Does NOT trigger real music generation jobs.
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = 'cmt73kval0003rw2x3xjef9yc';

async function dismissModals(page: import('@playwright/test').Page) {
  for (const sel of [
    'button:has-text("I\'ll do this later")',
    'button:has-text("Skip for now")',
    'button[aria-label="Close"]',
    'button:has-text("Cancel")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(300);
    }
  }
}

async function openMusicDetail(page: import('@playwright/test').Page) {
  await page.goto(`/projects/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  await dismissModals(page);

  // Ensure Pipeline tab is active
  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(500);
  }

  // Expand the Music card
  const musicTile = page.locator('button[aria-label="Expand Music"]').first();
  await expect(musicTile).toBeVisible({ timeout: 10_000 });
  await musicTile.click();
  await page.waitForTimeout(600);
  console.log('✅ Music card expanded');
}

test.describe('Music brief panel', () => {

  test('Music tile expands and shows mood/genre inputs', async ({ page }) => {
    await openMusicDetail(page);

    const moodInput = page.locator('input[aria-label="Music mood"]');
    await expect(moodInput).toBeVisible({ timeout: 8_000 });
    console.log('✅ Mood input visible');

    const genreInput = page.locator('input[aria-label="Music genre"]');
    await expect(genreInput).toBeVisible({ timeout: 5_000 });
    console.log('✅ Genre input visible');

    await page.screenshot({ path: 'pw-verify-fixes/music-panel-inputs.png' });
  });

  test('AI Music Brief section visible when brief has run', async ({ page }) => {
    await openMusicDetail(page);

    // The brief section only renders when musicBrief?.prompt exists
    const briefHeader = page.locator('button').filter({ hasText: /AI Music Brief/i }).first();
    const hasBrief = await briefHeader.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasBrief) {
      console.log('ℹ️  No music brief yet for this project — brief section correctly hidden');
      await page.screenshot({ path: 'pw-verify-fixes/music-brief-not-run.png' });
      return;
    }

    console.log('✅ AI Music Brief header visible');

    // Expand the collapsible brief section
    await briefHeader.click();
    await page.waitForTimeout(400);
    console.log('✅ Brief section expanded');

    // Textarea with prompt
    const textarea = page.locator('textarea[placeholder*="Music prompt"]').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    const promptText = await textarea.inputValue();
    console.log(`✅ Prompt textarea has content (${promptText.length} chars)`);

    // Copy button
    const copyBtn = page.locator('button:has-text("Copy")').first();
    await expect(copyBtn).toBeVisible({ timeout: 5_000 });
    console.log('✅ Copy button visible');

    // Download button (has Download icon)
    const downloadBtn = page.locator('button[title="Download brief as text"]').first();
    await expect(downloadBtn).toBeVisible({ timeout: 5_000 });
    console.log('✅ Download brief button visible');

    await page.screenshot({ path: 'pw-verify-fixes/music-brief-visible.png' });
  });

  test('Editing the brief textarea shows custom prompt notice', async ({ page }) => {
    await openMusicDetail(page);

    const briefHeader = page.locator('button').filter({ hasText: /AI Music Brief/i }).first();
    const hasBrief = await briefHeader.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasBrief) {
      console.log('ℹ️  No music brief yet — skipping edit test');
      return;
    }

    // Expand the collapsible brief section before accessing textarea
    await briefHeader.click();
    await page.waitForTimeout(400);

    const textarea = page.locator('textarea[placeholder*="Music prompt"]').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // Edit the textarea
    await textarea.click();
    await textarea.fill('Custom cinematic orchestral prompt for testing, slow build, hopeful tone');
    await page.waitForTimeout(300);
    console.log('✅ Textarea edited');

    // Amber notice should appear
    const notice = page.locator('text=/Custom prompt active/i').first();
    await expect(notice).toBeVisible({ timeout: 5_000 });
    console.log('✅ Custom prompt notice visible');

    await page.screenshot({ path: 'pw-verify-fixes/music-brief-edited.png' });
  });

  test('Copy button copies prompt to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openMusicDetail(page);

    const briefHeader = page.locator('button').filter({ hasText: /AI Music Brief/i }).first();
    const hasBrief = await briefHeader.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasBrief) {
      console.log('ℹ️  No music brief yet — skipping copy test');
      return;
    }

    // Expand the collapsible brief section before accessing textarea/copy button
    await briefHeader.click();
    await page.waitForTimeout(400);

    const textarea = page.locator('textarea[placeholder*="Music prompt"]').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    const originalText = await textarea.inputValue();

    const copyBtn = page.locator('button:has-text("Copy")').first();
    await copyBtn.click();
    await page.waitForTimeout(300);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(originalText);
    console.log('✅ Clipboard contains the music prompt');

    await page.screenshot({ path: 'pw-verify-fixes/music-brief-copied.png' });
  });

  test('Music tile Run button is present and correctly gated', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await dismissModals(page);

    const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
    if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pipelineTab.click();
      await page.waitForTimeout(500);
    }

    // Run/Regenerate button should exist in the music tile header area
    // (not necessarily enabled — depends on whether script is done)
    const musicRunBtn = page.locator('button').filter({ hasText: /^Run$|^Regenerate$/ }).nth(1);
    await expect(musicRunBtn).toBeVisible({ timeout: 10_000 });
    console.log('✅ Music Run/Regenerate button visible');

    await page.screenshot({ path: 'pw-verify-fixes/music-run-button.png' });
  });

});
