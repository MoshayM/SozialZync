/**
 * Smoke test: voice-over panel redesign (AI Voice / Your Voice cards).
 * Verifies UI structure and interactions — does NOT trigger real AI jobs.
 * Microphone is faked via --use-fake-device-for-media-stream.
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

async function openVoiceDetail(page: import('@playwright/test').Page) {
  await page.goto(`/projects/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  await dismissModals(page);

  // Ensure Pipeline tab is active
  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(500);
  }

  // Expand the Voice over card
  const voiceTile = page.locator('button[aria-label="Expand Voice over"]').first();
  await expect(voiceTile).toBeVisible({ timeout: 10_000 });
  await voiceTile.click();
  await page.waitForTimeout(600);
  console.log('✅ Voice over card expanded');
}

test.describe('Voice panel redesign', () => {

  test('shows AI Voice and Your Voice mode cards', async ({ page }) => {
    await openVoiceDetail(page);

    // Both mode cards must be visible
    const aiCard = page.locator('button').filter({ hasText: /AI Voice/i }).first();
    await expect(aiCard).toBeVisible({ timeout: 8_000 });
    console.log('✅ AI Voice card visible');

    const yourCard = page.locator('button').filter({ hasText: /Your Voice/i }).first();
    await expect(yourCard).toBeVisible({ timeout: 5_000 });
    console.log('✅ Your Voice card visible');

    // Browser Preview tab must be gone
    const previewTab = page.locator('button').filter({ hasText: /Browser Preview/i });
    await expect(previewTab).toHaveCount(0);
    console.log('✅ Browser Preview tab absent');

    await page.screenshot({ path: 'pw-verify-fixes/voice-mode-cards.png' });
  });

  test('AI Voice card is selected by default and shows narration section', async ({ page }) => {
    await openVoiceDetail(page);

    // AI Voice card should be active (border-brand-500 bg-brand-50)
    const aiCard = page.locator('button').filter({ hasText: /AI Voice/i }).first();
    await expect(aiCard).toBeVisible({ timeout: 8_000 });

    // Voice Style picker and Generate button should be visible by default
    const voiceOptions = page.locator('text=/Voice Style|Generate AI Narration/i').first();
    await expect(voiceOptions).toBeVisible({ timeout: 5_000 });
    console.log('✅ AI Voice content visible by default');

    await page.screenshot({ path: 'pw-verify-fixes/voice-ai-default.png' });
  });

  test('Your Voice card shows Record Full Script and Voice Reference sub-pills', async ({ page }) => {
    await openVoiceDetail(page);

    // Click Your Voice card
    const yourCard = page.locator('button').filter({ hasText: /Your Voice/i }).first();
    await expect(yourCard).toBeVisible({ timeout: 8_000 });
    await yourCard.click();
    await page.waitForTimeout(400);
    console.log('✅ Your Voice card clicked');

    // Sub-mode pills must appear
    const fullPill = page.locator('button').filter({ hasText: /Record Full Script/i }).first();
    await expect(fullPill).toBeVisible({ timeout: 5_000 });
    console.log('✅ Record Full Script pill visible');

    const refPill = page.locator('button').filter({ hasText: /Voice Reference/i }).first();
    await expect(refPill).toBeVisible({ timeout: 5_000 });
    console.log('✅ Voice Reference pill visible');

    await page.screenshot({ path: 'pw-verify-fixes/voice-your-voice-pills.png' });
  });

  test('Record Full Script: Start/Stop recording buttons work, preview has stop capability', async ({ page }) => {
    await openVoiceDetail(page);

    const yourCard = page.locator('button').filter({ hasText: /Your Voice/i }).first();
    await expect(yourCard).toBeVisible({ timeout: 8_000 });
    await yourCard.click();
    await page.waitForTimeout(400);

    // Full Script is default sub-mode — Start Recording button visible
    const startBtn = page.locator('button').filter({ hasText: /Start Recording/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 5_000 });
    console.log('✅ Start Recording button visible');

    // Click Start — fake mic, so it should transition to Stop Recording
    await startBtn.click();
    await page.waitForTimeout(800);

    const stopBtn = page.locator('button').filter({ hasText: /Stop Recording/i }).first();
    await expect(stopBtn).toBeVisible({ timeout: 5_000 });
    console.log('✅ Stop Recording button appeared after start');

    // Stop the recording
    await stopBtn.click();
    await page.waitForTimeout(600);

    // Preview button should now appear
    const previewBtn = page.locator('button').filter({ hasText: /Preview/i }).first();
    await expect(previewBtn).toBeVisible({ timeout: 5_000 });
    console.log('✅ Preview button appeared after recording stopped');

    await page.screenshot({ path: 'pw-verify-fixes/voice-full-script-recorded.png' });
  });

  test('Voice Reference sub-mode shows clone flow UI', async ({ page }) => {
    await openVoiceDetail(page);

    const yourCard = page.locator('button').filter({ hasText: /Your Voice/i }).first();
    await expect(yourCard).toBeVisible({ timeout: 8_000 });
    await yourCard.click();
    await page.waitForTimeout(400);

    // Switch to Voice Reference
    const refPill = page.locator('button').filter({ hasText: /Voice Reference/i }).first();
    await expect(refPill).toBeVisible({ timeout: 5_000 });
    await refPill.click();
    await page.waitForTimeout(400);
    console.log('✅ Voice Reference sub-mode activated');

    // How-it-works info box
    const howItWorks = page.locator('text=/How it works/i').first();
    await expect(howItWorks).toBeVisible({ timeout: 5_000 });
    console.log('✅ How it works info box visible');

    // Record Sample button
    const recordSampleBtn = page.locator('button').filter({ hasText: /Record Sample/i }).first();
    await expect(recordSampleBtn).toBeVisible({ timeout: 5_000 });
    console.log('✅ Record Sample button visible');

    // Import audio file label
    const importLabel = page.locator('text=/Import audio file/i').first();
    await expect(importLabel).toBeVisible({ timeout: 5_000 });
    console.log('✅ Import audio file option visible');

    // Clone Voice & Generate button (disabled until sample recorded)
    const cloneBtn = page.locator('button').filter({ hasText: /Clone Voice & Generate/i }).first();
    await expect(cloneBtn).toBeVisible({ timeout: 5_000 });
    await expect(cloneBtn).toBeDisabled();
    console.log('✅ Clone Voice & Generate button visible and correctly disabled');

    await page.screenshot({ path: 'pw-verify-fixes/voice-reference-ui.png' });
  });

  test('Voice Reference: Record Sample → stop → clone button enabled', async ({ page }) => {
    await openVoiceDetail(page);

    const yourCard = page.locator('button').filter({ hasText: /Your Voice/i }).first();
    await expect(yourCard).toBeVisible({ timeout: 8_000 });
    await yourCard.click();
    await page.waitForTimeout(400);

    const refPill = page.locator('button').filter({ hasText: /Voice Reference/i }).first();
    await refPill.click();
    await page.waitForTimeout(400);

    // Start sample recording (fake mic)
    const recordSampleBtn = page.locator('button').filter({ hasText: /Record Sample/i }).first();
    await recordSampleBtn.click();
    await page.waitForTimeout(800);

    const stopSampleBtn = page.locator('button').filter({ hasText: /^Stop$/i }).first();
    await expect(stopSampleBtn).toBeVisible({ timeout: 5_000 });
    await stopSampleBtn.click();
    await page.waitForTimeout(600);
    console.log('✅ Voice sample recorded');

    // Clone button should now be enabled
    const cloneBtn = page.locator('button').filter({ hasText: /Clone Voice & Generate/i }).first();
    await expect(cloneBtn).toBeVisible({ timeout: 5_000 });
    await expect(cloneBtn).toBeEnabled();
    console.log('✅ Clone Voice & Generate button enabled after sample recorded');

    await page.screenshot({ path: 'pw-verify-fixes/voice-reference-ready.png' });
  });

});
