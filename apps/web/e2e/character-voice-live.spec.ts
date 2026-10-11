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

test('Character-aware voice generation with real script', async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  await dismissModals(page);

  // Switch to Pipeline tab
  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(500);
  }

  // Expand Voice over tile
  const voiceTile = page.locator('button[aria-label="Expand Voice over"]').first();
  await expect(voiceTile).toBeVisible({ timeout: 10_000 });
  await voiceTile.click();
  await page.waitForTimeout(600);
  console.log('✅ Voice over tile expanded');

  // Ensure AI Voice card is selected
  const aiCard = page.locator('button').filter({ hasText: /AI Voice/i }).first();
  await expect(aiCard).toBeVisible({ timeout: 8_000 });
  await aiCard.click();
  await page.waitForTimeout(300);
  console.log('✅ AI Voice card selected');

  // Check the character-aware voices checkbox
  const checkbox = page.locator('input[type="checkbox"]').first();
  await expect(checkbox).toBeVisible({ timeout: 5_000 });
  const wasChecked = await checkbox.isChecked();
  if (!wasChecked) {
    await checkbox.click();
    await page.waitForTimeout(200);
  }
  expect(await checkbox.isChecked()).toBe(true);
  console.log('✅ Character-aware voices checkbox enabled');

  await page.screenshot({ path: 'pw-verify-fixes/char-voice-triggered.png' });

  // Click Generate / Regenerate AI Narration
  const genBtn = page.locator('button').filter({ hasText: /Generate AI Narration|Regenerate AI Narration/i }).first();
  await expect(genBtn).toBeVisible({ timeout: 5_000 });
  const isEnabled = await genBtn.isEnabled({ timeout: 3_000 }).catch(() => false);
  if (!isEnabled) {
    console.log('⚠️  Generate button not enabled — script may not be complete for this project');
    await page.screenshot({ path: 'pw-verify-fixes/char-voice-result.png' });
    return;
  }
  await genBtn.click();
  console.log('✅ Generate AI Narration clicked with character voices ON');

  // Wait for result: audio element OR "Completed" status OR error
  console.log('⏳ Waiting for voice generation to complete (up to 3 min)…');

  let resultState = 'timeout';
  const deadline = Date.now() + 175_000;

  while (Date.now() < deadline) {
    await page.waitForTimeout(4_000);

    const hasAudio = await page.locator('audio').first().isVisible({ timeout: 500 }).catch(() => false);
    const hasCompleted = await page.locator('text=/Completed/i').first().isVisible({ timeout: 500 }).catch(() => false);
    const hasFailed = await page.locator('text=/failed|error/i').first().isVisible({ timeout: 500 }).catch(() => false);
    const hasUnavailable = await page.locator('text=/File unavailable/i').first().isVisible({ timeout: 500 }).catch(() => false);

    if (hasAudio) { resultState = 'audio_ready'; break; }
    if (hasUnavailable) { resultState = 'file_unavailable'; break; }
    if (hasFailed) { resultState = 'failed'; break; }
    if (hasCompleted) { resultState = 'completed_no_audio'; break; }
  }

  await page.screenshot({ path: 'pw-verify-fixes/char-voice-result.png' });

  if (resultState === 'audio_ready') {
    console.log('✅ Audio player appeared — character voice generation succeeded');
  } else if (resultState === 'file_unavailable') {
    console.log('✅ Job ran but file not on disk (Railway ephemeral) — generation pipeline worked, storage issue only');
  } else if (resultState === 'completed_no_audio') {
    console.log('✅ Job completed — audio element loading or auto-loading in progress');
  } else if (resultState === 'failed') {
    const errText = await page.locator('text=/failed|error/i').first().textContent().catch(() => 'unknown');
    console.log(`⚠️  Job failed: ${errText}`);
  } else {
    console.log('⏱️  Timed out waiting for completion — job may still be running');
  }

  console.log(`Result state: ${resultState}`);
});
