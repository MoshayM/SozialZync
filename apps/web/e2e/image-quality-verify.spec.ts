import { test, expect } from '@playwright/test';

const BASE = 'https://sozialzynk.vercel.app';
const PROJECT_ID = 'cmuw68466004fpm756p7rpry3';

// storageState is set by playwright.config.ts for this project
test.use({ storageState: 'e2e/.auth.json' });

test('fresh image gen — verify real images not gradients', async ({ page }) => {
  // Navigate directly to studio (storageState has JWT)
  await page.goto(`${BASE}/studio/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  // If redirected to login, something is wrong with storageState
  if (page.url().includes('/login')) {
    throw new Error('Auth failed — redirected to login');
  }

  console.log('Studio URL:', page.url());
  await page.screenshot({ path: 'e2e/img-q-1-studio.png' });

  // Intercept image file responses to measure sizes
  const imageSizes: Array<{ url: string; size: number; ct: string }> = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('/media/versions/') && resp.url().includes('/file')) {
      try {
        const body = await resp.body();
        const ct = resp.headers()['content-type'] ?? 'unknown';
        if (ct.startsWith('image/') || ct === 'unknown') {
          imageSizes.push({ url: resp.url(), size: body.length, ct });
          console.log(`IMG RESPONSE: ${body.length} bytes (${ct}) — ${resp.url().split('/').slice(-3).join('/')}`);
        }
      } catch { /* ignore */ }
    }
  });

  // Scroll down to find Images step / tile
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(1000);

  // Look for Images section — it may be in an accordion or expandable tile
  const imagesSection = page.locator('text=Images').first();
  const imagesVisible = await imagesSection.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Images section visible:', imagesVisible);

  if (imagesVisible) {
    await imagesSection.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: 'e2e/img-q-2-images-section.png' });

  // Look for Run/Regenerate button
  const btnSelectors = [
    'button:has-text("Regenerate")',
    'button:has-text("Run Images")',
    'button:has-text("Generate Images")',
    'button:has-text("Re-run")',
    'button[aria-label*="generat" i]',
  ];

  let clicked = false;
  for (const sel of btnSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found button:', sel);
      await btn.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    console.log('No run button found — checking existing image previews');
    await page.screenshot({ path: 'e2e/img-q-no-btn.png' });
  } else {
    // Wait up to 3 min for generation
    console.log('Waiting 3 min for image generation...');
    await page.waitForTimeout(180000);
    await page.screenshot({ path: 'e2e/img-q-3-after-gen.png' });
  }

  // Count UI errors
  const noPreview = await page.locator('text=Preview unavailable').count();
  const fileNotAvail = await page.locator('text=File not available').count();
  const blobImgs = await page.locator('img[src^="blob:"]').count();

  console.log('=== RESULTS ===');
  console.log('Preview unavailable:', noPreview);
  console.log('File not available:', fileNotAvail);
  console.log('Blob images visible:', blobImgs);
  console.log('Image file sizes intercepted:', imageSizes.map(i => `${i.size}B`).join(', '));

  const gradients = imageSizes.filter(i => i.size < 5000);
  const real = imageSizes.filter(i => i.size > 10000);
  console.log('Real images (>10KB):', real.length);
  console.log('Gradient-sized (<5KB):', gradients.length);

  if (gradients.length > 0) {
    console.log('GRADIENT IMAGES DETECTED:', gradients.map(i => i.size + 'B').join(', '));
  }

  expect(noPreview, 'Preview unavailable count').toBe(0);
  expect(fileNotAvail, '"File not available" count').toBe(0);
  if (imageSizes.length > 0) {
    expect(gradients.length, 'Gradient images').toBe(0);
  }
});
