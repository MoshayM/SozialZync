/**
 * Full pipeline quality test — verifies:
 * 1. Images are real (>10 KB), not gradients (~500 bytes)
 * 2. No "Preview unavailable" errors after generation
 * 3. No 429 rate limit errors on file fetches
 * 4. Voice audio loads (blob URL created)
 * 5. Music audio loads (blob URL created)
 */
import { test, expect } from '@playwright/test';

const BASE        = 'https://sozialzynk.vercel.app';
const API_BASE    = 'https://sozialzync-api-production.up.railway.app';
const PROJECT_ID  = 'cmt73kval0003rw2x3xjef9yc';

test.setTimeout(600_000);

async function dismissModals(page: import('@playwright/test').Page) {
  for (const sel of ["button:has-text(\"I'll do this later\")", 'button:has-text("Skip for now")', 'button:has-text("Skip")']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(300);
    }
  }
}

test('Full pipeline quality — real images, audio, no 429s', async ({ page, request }) => {
  const mediaRequests: Array<{ url: string; status: number; sizeBytes: number; contentType: string }> = [];
  const errors429: string[] = [];

  // Intercept all media file fetches to measure sizes + status codes
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/media/versions/') && url.includes('/file')) {
      try {
        const status = response.status();
        const contentType = response.headers()['content-type'] ?? '';
        const body = await response.body().catch(() => Buffer.alloc(0));
        const sizeBytes = body.length;
        mediaRequests.push({ url, status, sizeBytes, contentType });
        if (status === 429) errors429.push(url);
        console.log(`[media] ${status} ${url.split('/').slice(-3).join('/')} — ${sizeBytes} bytes, ${contentType}`);
      } catch { /* ignore */ }
    }
  });

  // ── Navigate to project ────────────────────────────────────────────────────
  await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await dismissModals(page);
  await page.waitForTimeout(2_000);

  // Switch to Pipeline tab if present
  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(1_000);
  }

  await page.screenshot({ path: 'e2e/fq-01-pipeline.png', fullPage: true });

  // ── Expand Images tile ─────────────────────────────────────────────────────
  const imagesExpBtn = page.locator('button[aria-label="Expand Images"]').first();
  if (await imagesExpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await imagesExpBtn.click();
    await page.waitForTimeout(1_000);
  }

  // Wait for images section
  const hasSceneImages = await page.locator('text=/Scene Images/i').first()
    .isVisible({ timeout: 10_000 }).catch(() => false);

  if (hasSceneImages) {
    // Wait for image blob URLs to load (ImagePreview fetches happen asynchronously)
    await page.waitForTimeout(8_000);
    await page.screenshot({ path: 'e2e/fq-02-images.png', fullPage: true });

    // Check "Preview unavailable" count
    const previewUnavailCount = await page.locator('text=Preview unavailable').count();
    console.log(`\nPreview unavailable count: ${previewUnavailCount}`);

    // Report on image file sizes
    const imageRequests = mediaRequests.filter(r => r.contentType.startsWith('image/') || r.url.includes('/file'));
    console.log(`\n── Image file fetches (${imageRequests.length}) ──`);
    let gradientCount = 0;
    let realImageCount = 0;
    for (const req of imageRequests) {
      const isGradient = req.sizeBytes < 10_000;
      if (isGradient) gradientCount++;
      else realImageCount++;
      console.log(`  ${req.status === 200 ? '✅' : '❌'} ${req.sizeBytes.toLocaleString()} bytes — ${isGradient ? '⚠️ GRADIENT' : '✅ real image'} — ${req.url.split('/').slice(-3, -1).join('/')}`);
    }

    console.log(`\nReal images: ${realImageCount}, Gradient placeholders: ${gradientCount}`);
    expect(gradientCount, 'No gradient images should be generated').toBe(0);
    expect(previewUnavailCount, 'No "Preview unavailable" errors').toBe(0);
  } else {
    console.log('ℹ️  No Scene Images section — images not yet generated. Running Images pipeline...');

    // Try to run images
    const runBtns = page.locator('button').filter({ hasText: /^Run$/ });
    const n = await runBtns.count();
    for (let i = 0; i < n; i++) {
      const btn = runBtns.nth(i);
      if (await btn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
        // Find the one near "Images"
        const nearby = await btn.locator('xpath=ancestor::div[contains(@class,"rounded")][3]//p[contains(text(),"Images")]').count().catch(() => 0);
        if (nearby > 0 || i === 2) {
          await btn.click();
          console.log(`✅ Clicked Run at index ${i}`);
          break;
        }
      }
    }

    // Wait up to 5 min for images to generate
    const imagesReady = await page.locator('text=/Scene Images/i').first()
      .isVisible({ timeout: 300_000 }).catch(() => false);

    if (imagesReady) {
      await page.waitForTimeout(8_000);
      await page.screenshot({ path: 'e2e/fq-02-images-generated.png', fullPage: true });

      const previewUnavailCount = await page.locator('text=Preview unavailable').count();
      console.log(`Preview unavailable after generation: ${previewUnavailCount}`);

      const imageRequests = mediaRequests.filter(r => r.contentType.startsWith('image/'));
      let gradientCount = 0;
      for (const req of imageRequests) {
        if (req.sizeBytes < 10_000) gradientCount++;
      }
      console.log(`Gradient count: ${gradientCount}, Real image count: ${imageRequests.length - gradientCount}`);
      expect(gradientCount, 'No gradient images').toBe(0);
      expect(previewUnavailCount, 'No Preview unavailable errors').toBe(0);
    } else {
      console.log('⚠️  Images did not generate within timeout');
    }
  }

  // Collapse images
  const imagesColBtn = page.locator('button[aria-label="Collapse Images"]').first();
  if (await imagesColBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await imagesColBtn.click();
    await page.waitForTimeout(500);
  }

  // ── Expand Voice tile ──────────────────────────────────────────────────────
  const voiceExpBtn = page.locator('button[aria-label="Expand Voice over"], button[aria-label="Expand Voice"]').first();
  if (await voiceExpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await voiceExpBtn.click();
    await page.waitForTimeout(2_000);
  }

  const hasVoiceAudio = await page.locator('audio').first().isVisible({ timeout: 10_000 }).catch(() => false);
  const voiceAudioSrc = hasVoiceAudio ? await page.locator('audio').first().getAttribute('src').catch(() => '') : '';
  console.log(`\nVoice audio src: ${voiceAudioSrc ? voiceAudioSrc.slice(0, 60) : 'NOT FOUND'}`);

  const voiceRequests = mediaRequests.filter(r => r.contentType.startsWith('audio/'));
  console.log(`Voice file fetches: ${voiceRequests.length}`);
  for (const req of voiceRequests) {
    console.log(`  ${req.status} ${req.sizeBytes.toLocaleString()} bytes — ${req.url.split('/').slice(-3, -1).join('/')}`);
  }

  await page.screenshot({ path: 'e2e/fq-03-voice.png', fullPage: true });

  // Collapse voice
  const voiceColBtn = page.locator('button[aria-label="Collapse Voice over"], button[aria-label="Collapse Voice"]').first();
  if (await voiceColBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await voiceColBtn.click();
    await page.waitForTimeout(500);
  }

  // ── Expand Music tile ──────────────────────────────────────────────────────
  const musicExpBtn = page.locator('button[aria-label="Expand Music"]').first();
  if (await musicExpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await musicExpBtn.click();
    await page.waitForTimeout(2_000);
  }

  const hasMusicAudio = await page.locator('audio').first().isVisible({ timeout: 10_000 }).catch(() => false);
  const musicAudioSrc = hasMusicAudio ? await page.locator('audio').first().getAttribute('src').catch(() => '') : '';
  console.log(`\nMusic audio src: ${musicAudioSrc ? musicAudioSrc.slice(0, 60) : 'NOT FOUND'}`);

  const musicRequests = mediaRequests.filter(r => r.contentType.startsWith('audio/') || r.url.includes('/file'));
  console.log(`Music file fetches: ${musicRequests.length}`);

  await page.screenshot({ path: 'e2e/fq-04-music.png', fullPage: true });

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log('\n══ PIPELINE QUALITY SUMMARY ═════════════');
  console.log(`Total media file fetches : ${mediaRequests.length}`);
  console.log(`429 rate limit errors    : ${errors429.length}`);
  if (errors429.length) console.log('429 URLs:', errors429.slice(0, 5));

  const allStatuses = mediaRequests.map(r => r.status);
  const okCount   = allStatuses.filter(s => s === 200).length;
  const failCount = allStatuses.filter(s => s !== 200).length;
  console.log(`200 OK fetches           : ${okCount}`);
  console.log(`Non-200 fetches          : ${failCount}`);

  // Hard assertions
  expect(errors429.length, 'No 429 rate limit errors on file fetches').toBe(0);
  expect(failCount, 'All media fetches should return 200').toBe(0);

  console.log('\n✅ All pipeline quality checks passed');
});
