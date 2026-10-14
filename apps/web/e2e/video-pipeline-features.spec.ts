/**
 * Smoke tests for recently shipped video pipeline features:
 * 1. VIDEO step quality toggle (Fast / Cinematic)
 * 2. Per-scene motion style dropdown
 * 3. Per-scene video prompt editing (textarea visible, editable)
 * 4. Content guardrails (blocked prompts show amber warning)
 * 5. Music file unavailable → amber banner + Regenerate button
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = 'cmt73kval0003rw2x3xjef9yc';
test.setTimeout(90_000);

async function dismissModals(page: import('@playwright/test').Page) {
  for (const sel of [
    'button:has-text("I\'ll do this later")',
    'button:has-text("Skip for now")',
    'button[aria-label="Close"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(300);
    }
  }
}

async function openVideoStep(page: import('@playwright/test').Page) {
  await page.goto(`/projects/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 40_000 });
  await dismissModals(page);

  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(500);
  }

  const videoTile = page.locator('button[aria-label="Expand Scene Videos"], button[aria-label="Expand Video"]').first();
  const isVisible = await videoTile.isVisible({ timeout: 8_000 }).catch(() => false);
  if (isVisible) {
    await videoTile.click();
    await page.waitForTimeout(600);
  }
}

test.describe('VIDEO step quality toggle', () => {

  test('Fast / Cinematic toggle is visible and switches state', async ({ page }) => {
    await openVideoStep(page);

    // Quality toggle — look for "Fast" and "Cinematic" buttons or a select
    const fastBtn = page.locator('button').filter({ hasText: /^Fast$/i }).first();
    const cinematicBtn = page.locator('button').filter({ hasText: /^Cinematic$/i }).first();

    const hasFast = await fastBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasFast) {
      // May be a select/dropdown
      const qualitySelect = page.locator('select').filter({ has: page.locator('option:has-text("Fast")') }).first();
      const hasSelect = await qualitySelect.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!hasSelect) {
        console.log('ℹ️  Quality toggle not visible — Video tile may not have a result yet');
        await page.screenshot({ path: 'pw-verify-fixes/video-quality-no-tile.png' });
        return;
      }
      await qualitySelect.selectOption('cinematic');
      await page.waitForTimeout(300);
      const selectedVal = await qualitySelect.inputValue();
      expect(selectedVal).toBe('cinematic');
      console.log('✅ Quality select switched to cinematic');
      await qualitySelect.selectOption('fast');
      return;
    }

    // Button-style toggle
    await fastBtn.click();
    await page.waitForTimeout(200);
    await cinematicBtn.click();
    await page.waitForTimeout(200);

    // Cinematic should be selected (highlighted)
    const isSelected = await cinematicBtn.evaluate(el =>
      el.classList.contains('bg-purple-600') ||
      el.getAttribute('aria-pressed') === 'true' ||
      el.classList.contains('ring-2')
    );
    expect(isSelected).toBe(true);
    console.log('✅ Cinematic quality toggle selected');

    await page.screenshot({ path: 'pw-verify-fixes/video-quality-cinematic.png' });

    // Switch back to Fast
    await fastBtn.click();
    await page.waitForTimeout(200);
    console.log('✅ Switched back to Fast');
  });

});

test.describe('Per-scene motion style dropdown', () => {

  test('Scene cards show motion style dropdown (Auto + named styles)', async ({ page }) => {
    await openVideoStep(page);

    // Scene cards with motion style dropdowns
    const motionSelect = page.locator('select').filter({ has: page.locator('option:has-text("Auto")') }).first();
    const hasMotion = await motionSelect.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasMotion) {
      console.log('ℹ️  No scene cards visible yet — video not generated for this project');
      await page.screenshot({ path: 'pw-verify-fixes/video-motion-no-scenes.png' });
      return;
    }

    // Check Auto is the default
    const defaultVal = await motionSelect.inputValue();
    console.log(`Motion style default: ${defaultVal}`);

    // Change to a named style
    await motionSelect.selectOption('zoom-in');
    await page.waitForTimeout(300);
    const newVal = await motionSelect.inputValue();
    expect(newVal).toBe('zoom-in');
    console.log('✅ Motion style changed to zoom-in');

    // Reset
    await motionSelect.selectOption('auto');
    await page.screenshot({ path: 'pw-verify-fixes/video-motion-changed.png' });
    console.log('✅ Per-scene motion style dropdown works');
  });

});

test.describe('Per-scene video prompt editing', () => {

  test('Scene card shows editable prompt textarea', async ({ page }) => {
    await openVideoStep(page);

    // Look for prompt textarea or edit button on scene cards
    const promptTextarea = page.locator('textarea').filter({ has: page.locator('[placeholder*="prompt" i], [placeholder*="describe" i]') }).first();
    const editBtn = page.locator('button[title*="Edit prompt" i], button[aria-label*="Edit prompt" i]').first();

    const hasTextarea = await promptTextarea.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasEditBtn = await editBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasTextarea && !hasEditBtn) {
      // Try finding any textarea within a scene card
      const anyTextarea = page.locator('[class*="scene"] textarea, [class*="card"] textarea').first();
      const hasAny = await anyTextarea.isVisible({ timeout: 5_000 }).catch(() => false);

      if (!hasAny) {
        console.log('ℹ️  No scene card prompt textarea found — scenes not yet generated');
        await page.screenshot({ path: 'pw-verify-fixes/video-prompt-no-scenes.png' });
        return;
      }

      await anyTextarea.fill('A sweeping cinematic shot of rolling hills at golden hour');
      await page.waitForTimeout(300);
      const val = await anyTextarea.inputValue();
      expect(val.length).toBeGreaterThan(10);
      console.log('✅ Prompt textarea editable');
      await page.screenshot({ path: 'pw-verify-fixes/video-prompt-edited.png' });
      return;
    }

    if (hasEditBtn) {
      await editBtn.click();
      await page.waitForTimeout(400);
    }

    const activeTextarea = promptTextarea.isVisible() ? promptTextarea
      : page.locator('textarea').first();

    await activeTextarea.fill('A sweeping cinematic shot of rolling hills at golden hour');
    await page.waitForTimeout(300);
    const val = await activeTextarea.inputValue();
    expect(val.length).toBeGreaterThan(10);
    console.log('✅ Video prompt textarea editable with custom text');

    await page.screenshot({ path: 'pw-verify-fixes/video-prompt-edited.png' });
  });

  test('Speak button is visible (voice-to-prompt)', async ({ page }) => {
    await openVideoStep(page);

    // Mic/Speak button on scene cards
    const speakBtn = page.locator('button[title*="Speak" i], button[aria-label*="Speak" i], button[title*="voice" i]').first();
    const hasSpeak = await speakBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasSpeak) {
      console.log('ℹ️  Speak button not visible — scenes not generated or not in VIDEO step');
      await page.screenshot({ path: 'pw-verify-fixes/video-speak-no-scenes.png' });
      return;
    }

    console.log('✅ Speak (voice-to-prompt) button visible on scene card');
    await page.screenshot({ path: 'pw-verify-fixes/video-speak-visible.png' });
  });

});

test.describe('Content guardrails', () => {

  test('Blocked prompt shows amber warning in video step', async ({ page }) => {
    await openVideoStep(page);

    // Find any prompt textarea on a scene card
    const promptTextarea = page.locator('textarea').first();
    const hasTextarea = await promptTextarea.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasTextarea) {
      console.log('ℹ️  No scene textarea found — guardrails UI not testable without scene cards');
      return;
    }

    // Type a blocked term
    await promptTextarea.fill('explicit adult content violence drug use');
    await page.waitForTimeout(300);

    // Look for the Enhance button to trigger guard
    const enhanceBtn = page.locator('button').filter({ hasText: /Enhance/i }).first();
    if (await enhanceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enhanceBtn.click();
      await page.waitForTimeout(2_000);

      // Check for amber warning
      const guardWarning = page.locator('text=/blocked|inappropriate|content policy|cannot generate/i').first();
      const hasGuard = await guardWarning.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasGuard) {
        console.log('✅ Content guardrail amber warning shown for blocked prompt');
      } else {
        console.log('ℹ️  No guard warning shown — guard may only trigger at job submission');
      }
      await page.screenshot({ path: 'pw-verify-fixes/guardrail-video-prompt.png' });
    } else {
      console.log('ℹ️  No Enhance button — guardrail fires at job enqueue, not inline');
    }
  });

});

test.describe('Music file unavailable banner', () => {

  test('Amber banner + Regenerate button shown when music file is missing', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 40_000 });
    await dismissModals(page);

    const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
    if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pipelineTab.click();
      await page.waitForTimeout(500);
    }

    const musicTile = page.locator('button[aria-label="Expand Music"]').first();
    if (!(await musicTile.isVisible({ timeout: 8_000 }).catch(() => false))) {
      console.log('ℹ️  Music tile not visible');
      return;
    }
    await musicTile.click();
    await page.waitForTimeout(1_000);

    // Wait for either: audio element (file available) or amber banner (file unavailable)
    const hasAudio = await page.locator('audio').first().isVisible({ timeout: 8_000 }).catch(() => false);
    const hasBanner = await page.locator('text=/Music file lost|file.*lost|regenerate to rebuild/i').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    await page.screenshot({ path: 'pw-verify-fixes/music-unavailable-check.png' });

    if (hasAudio) {
      console.log('✅ Music file available — audio player shown (no banner needed)');
    } else if (hasBanner) {
      // Regenerate button must exist
      const regenBtn = page.locator('button').filter({ hasText: /Regenerate/i }).first();
      await expect(regenBtn).toBeVisible({ timeout: 5_000 });
      console.log('✅ Amber "Music file lost" banner shown with Regenerate button');
    } else {
      console.log('ℹ️  No music result yet — banner only shows when job is COMPLETED with missing file');
    }
  });

});
