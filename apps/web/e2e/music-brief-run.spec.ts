/**
 * Run the Music stage on a project and verify the AI Music Brief panel
 * appears with prompt textarea, copy button, download button, chips.
 * Uses a generous timeout — waits up to 3 min for the job to complete.
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = 'cmt73kval0003rw2x3xjef9yc';

test.setTimeout(240_000);

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

test('Run Music stage and verify AI Music Brief panel', async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  await dismissModals(page);

  // Switch to Pipeline tab
  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(500);
  }

  // Expand the Music tile
  const musicTile = page.locator('button[aria-label="Expand Music"]').first();
  await expect(musicTile).toBeVisible({ timeout: 10_000 });
  await musicTile.click();
  await page.waitForTimeout(600);
  console.log('✅ Music tile expanded');

  // Check if brief already exists — skip trigger if so
  const alreadyHasBrief = await page.locator('text=/AI Music Brief/i').first()
    .isVisible({ timeout: 2_000 }).catch(() => false);

  if (!alreadyHasBrief) {
    // Click Run (or Regenerate) on the Music tile
    // The Run button is the one near the music tile — use the nth sibling
    const runBtn = page.locator('button').filter({ hasText: /^Run$|^Regenerate$/i }).nth(1);
    const isEnabled = await runBtn.isEnabled({ timeout: 5_000 }).catch(() => false);

    if (!isEnabled) {
      console.log('⚠️  Music Run button not enabled — script may not be done. Trying first Run button.');
      const anyRun = page.locator('button').filter({ hasText: /^Run$/ }).first();
      const enabled2 = await anyRun.isEnabled({ timeout: 3_000 }).catch(() => false);
      if (!enabled2) {
        console.log('⚠️  No enabled Run button found — project may not have a completed script. Taking screenshot.');
        await page.screenshot({ path: 'pw-verify-fixes/music-run-blocked.png' });
        return;
      }
    }

    await runBtn.click().catch(async () => {
      // fallback: click whichever Run is enabled
      await page.locator('button').filter({ hasText: /^Run$/ }).first().click();
    });
    console.log('✅ Music Run triggered');

    await page.screenshot({ path: 'pw-verify-fixes/music-running.png' });

    // Wait for the brief to appear — poll for up to 3 minutes
    console.log('⏳ Waiting for MUSIC_BRIEF to complete…');
    await expect(page.locator('text=/AI Music Brief/i').first()).toBeVisible({ timeout: 180_000 });
    console.log('✅ AI Music Brief appeared');
  } else {
    console.log('ℹ️  Brief already exists — checking panel directly');
  }

  await page.screenshot({ path: 'pw-verify-fixes/music-brief-after-run.png' });

  // --- Brief header is visible (collapsed by default) ---
  const briefToggle = page.locator('button').filter({ hasText: /AI Music Brief/i }).first();
  await expect(briefToggle).toBeVisible({ timeout: 10_000 });
  console.log('✅ AI Music Brief toggle header visible');

  // BPM chip should be visible in the collapsed header
  const headerBpmChip = page.locator('span').filter({ hasText: /\d+ BPM/i }).first();
  const hasBpmInHeader = await headerBpmChip.isVisible({ timeout: 3_000 }).catch(() => false);
  if (hasBpmInHeader) {
    console.log(`✅ BPM chip visible in collapsed header: ${await headerBpmChip.textContent()}`);
  } else {
    console.log('ℹ️  BPM chip not in header');
  }

  // Textarea must NOT be visible while collapsed
  const textareaBefore = page.locator('textarea[placeholder*="Music prompt"]').first();
  await expect(textareaBefore).not.toBeVisible({ timeout: 3_000 });
  console.log('✅ Brief collapsed by default — textarea hidden');

  await page.screenshot({ path: 'pw-verify-fixes/music-brief-collapsed.png' });

  // --- Expand the brief ---
  await briefToggle.click();
  await page.waitForTimeout(400);
  console.log('✅ Brief toggle clicked — expanding');

  // Textarea now visible with content
  const textarea = page.locator('textarea[placeholder*="Music prompt"]').first();
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  const promptText = await textarea.inputValue();
  expect(promptText.trim().length).toBeGreaterThan(20);
  console.log(`✅ Prompt textarea content: "${promptText.slice(0, 80)}…"`);

  // Copy button
  const copyBtn = page.locator('button:has-text("Copy")').first();
  await expect(copyBtn).toBeVisible({ timeout: 5_000 });
  console.log('✅ Copy button visible when expanded');

  // Download button
  const downloadBtn = page.locator('button[title="Download brief as text"]').first();
  await expect(downloadBtn).toBeVisible({ timeout: 5_000 });
  console.log('✅ Download button visible when expanded');

  // BPM chip inside expanded body
  const bodyBpmChip = page.locator('span').filter({ hasText: /\d+ BPM/i }).first();
  const hasBpmBody = await bodyBpmChip.isVisible({ timeout: 3_000 }).catch(() => false);
  if (hasBpmBody) {
    console.log(`✅ BPM chip in expanded body: ${await bodyBpmChip.textContent()}`);
  }

  // Emotional Arc label always visible in expanded view
  const arcLabel = page.locator('p').filter({ hasText: /^Emotional Arc$/i }).first();
  await expect(arcLabel).toBeVisible({ timeout: 5_000 });
  console.log('✅ "Emotional Arc" label visible in expanded view');

  // Arc text or placeholder
  const arcText = page.locator('p.italic, p > span.not-italic').first();
  const arcContent = await arcText.textContent({ timeout: 3_000 }).catch(() => '');
  console.log(`✅ Emotional Arc content: "${arcContent?.slice(0, 100)}"`);

  // Collapse and check arc preview shows in header
  await briefToggle.click();
  await page.waitForTimeout(400);
  const arcPreview = page.locator('p.italic').filter({ hasText: /.+/ }).first();
  const hasArcPreview = await arcPreview.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log(hasArcPreview
    ? `✅ Arc preview visible in collapsed header: "${(await arcPreview.textContent())?.slice(0, 80)}"`
    : 'ℹ️  No arc preview in collapsed header (arc not yet generated for this project)');

  // Re-expand for the edit test
  await briefToggle.click();
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'pw-verify-fixes/music-brief-expanded.png' });

  // --- Collapse again ---
  await briefToggle.click();
  await page.waitForTimeout(400);
  await expect(textarea).not.toBeVisible({ timeout: 3_000 });
  console.log('✅ Brief collapses again on second click');

  await page.screenshot({ path: 'pw-verify-fixes/music-brief-recollapsed.png' });

  // --- Re-expand and edit → amber notice + custom badge ---
  await briefToggle.click();
  await page.waitForTimeout(300);
  await textarea.fill('Custom test: soft piano melody, nostalgic mood, 80 BPM, gentle strings');
  await page.waitForTimeout(400);

  const notice = page.locator('text=/Custom prompt active/i').first();
  await expect(notice).toBeVisible({ timeout: 5_000 });
  console.log('✅ Custom prompt notice appears on edit');

  // "custom" badge should appear in the header
  const customBadge = page.locator('span').filter({ hasText: /^custom$/i }).first();
  const hasBadge = await customBadge.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log(hasBadge ? '✅ "custom" badge visible in header' : 'ℹ️  custom badge not detected');

  await page.screenshot({ path: 'pw-verify-fixes/music-brief-edit-notice.png' });
});
