import { test, expect } from '@playwright/test';

test('run images step', async ({ page }) => {
  test.setTimeout(360_000);

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle', { timeout: 20000 });
  console.log('Dashboard URL:', page.url());

  // Open first project
  const link = page.locator('a[href*="/studio/"]').first();
  await expect(link).toBeVisible({ timeout: 15000 });
  const href = await link.getAttribute('href') ?? '';
  console.log('Opening project:', href);
  await link.click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  console.log('Studio URL:', page.url());

  // Click Images tab
  const imagesTab = page.locator('button:has-text("Images"), [role="tab"]:has-text("Images")').first();
  if (await imagesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await imagesTab.click();
    await page.waitForTimeout(2000);
    console.log('Clicked Images tab');
  } else {
    const tabs = await page.locator('[role="tab"], nav a, nav button').allTextContents();
    console.log('Images tab not found. Available tabs:', tabs.join(' | '));
  }

  // Click Run / Generate / Regenerate All
  const runBtn = page.locator('button:has-text("Run"), button:has-text("Generate"), button:has-text("Regenerate All")').first();
  if (await runBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking Run button');
    await runBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('No Run button visible');
    const btns = await page.locator('button').allTextContents();
    console.log('Buttons on page:', btns.slice(0, 25).join(' | '));
  }

  // Poll up to 4 min for blob images
  console.log('Polling for generated images...');
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(10000);
    const blobs = await page.locator('img[src^="blob:"]').count();
    const errors = await page.locator('text=Preview unavailable').count();
    const unavail = await page.locator('text=File not available').count();
    console.log(`t+${(i + 1) * 10}s — blobs:${blobs} previewErr:${errors} unavail:${unavail}`);
    if (blobs > 0) break;
  }

  // Final counts
  const blobImgs = await page.locator('img[src^="blob:"]').count();
  const previewErr = await page.locator('text=Preview unavailable').count();
  const fileErr = await page.locator('text=File not available').count();

  // Measure actual file sizes from blob URLs
  const sizes: number[] = await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img[src^="blob:"]')) as HTMLImageElement[];
    const results: number[] = [];
    for (const img of imgs.slice(0, 8)) {
      try {
        const r = await fetch(img.src);
        const buf = await r.arrayBuffer();
        results.push(buf.byteLength);
      } catch {
        results.push(-1);
      }
    }
    return results;
  });

  console.log('=== FINAL RESULTS ===');
  console.log('Blob images:', blobImgs);
  console.log('Preview unavailable:', previewErr);
  console.log('File not available:', fileErr);
  console.log('Image sizes (bytes):', sizes);
  console.log('Real images (>10KB):', sizes.filter(s => s > 10000).length);
  console.log('Gradients (<2KB):', sizes.filter(s => s > 0 && s < 2000).length);

  await page.screenshot({ path: 'test-results/images-step.png', fullPage: false });

  expect(previewErr, 'Preview unavailable errors').toBe(0);
  expect(fileErr, 'File not available errors').toBe(0);
  expect(blobImgs, 'Should have at least one blob image').toBeGreaterThan(0);
  expect(sizes.filter(s => s > 0 && s < 2000).length, 'No gradient placeholders').toBe(0);
});
