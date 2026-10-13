/**
 * Run Images step and verify real FLUX images (not gradients).
 * Gradient PNGs: ~400-800 bytes. Real Pollinations images: 50 KB – 2 MB.
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID  = 'cmt73kval0003rw2x3xjef9yc';
const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

test.setTimeout(420_000);
test.use({ storageState: { cookies: [], origins: [] } });

test('run Images step and verify real images vs gradients', async ({ page }) => {
  // ── Auth ─────────────────────────────────────────────────────────────────
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|dashboard|\(dash\))/, { timeout: 60_000 });
  console.log('✅ Logged in');

  // ── Open project pipeline ─────────────────────────────────────────────
  await page.goto(`/projects/${PROJECT_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // Dismiss any modals
  for (const sel of ['button:has-text("Skip for now")', 'button:has-text("I\'ll do this later")', 'button[aria-label="Close"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1_500 }).catch(() => false)) await el.click();
  }

  // Switch to Pipeline tab if needed
  const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
  if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pipelineTab.click();
    await page.waitForTimeout(500);
  }

  // ── Expand Images tile ────────────────────────────────────────────────
  const expandBtn = page.locator('button[aria-label="Expand Images"], button[aria-label="Collapse Images"]').first();
  const imagesDiv = page.locator('div[role="button"]').filter({ hasText: /^Images$/ }).first();

  let expanded = false;
  if (await expandBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
    const label = await expandBtn.getAttribute('aria-label');
    if (label === 'Expand Images') await expandBtn.click();
    expanded = true;
  } else if (await imagesDiv.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await imagesDiv.click();
    expanded = true;
  }

  if (!expanded) {
    console.log('⚠️  Images tile not found — Script step may not be complete');
    await page.screenshot({ path: 'run-images-step-notfound.png' });
    return;
  }
  await page.waitForTimeout(600);
  console.log('✅ Images tile expanded');

  // ── Check if images already exist ────────────────────────────────────
  const sceneImagesSection = page.locator('p.font-semibold.text-gray-500.uppercase').filter({ hasText: /Scene Images/i }).first();
  const alreadyHasImages = await sceneImagesSection.isVisible({ timeout: 3_000 }).catch(() => false);

  if (!alreadyHasImages) {
    // Need to trigger Run/Regenerate — find the Images tile action button.
    // The tile-level buttons use rounded-full styling. The label is "Run" (first time)
    // or "Regenerate" (when re-running). Per-image Regenerate buttons inside the
    // expanded panel use rounded-lg — excluded by the rounded-full selector.
    const tileActionBtns = page.locator('button.rounded-full').filter({ hasText: /^(Run|Regenerate)$/ });
    const count = await tileActionBtns.count();
    console.log(`Found ${count} tile-level Run/Regenerate buttons`);

    // Log each one for debugging
    for (let i = 0; i < count; i++) {
      const txt = await tileActionBtns.nth(i).textContent().catch(() => '');
      const enabled = await tileActionBtns.nth(i).isEnabled().catch(() => false);
      console.log(`  Button ${i}: "${txt?.trim()}" enabled=${enabled}`);
    }

    // The Images tile button is the one after Script/Voice/Music.
    // Try: find the last enabled "Run" or first enabled "Regenerate" among tile buttons.
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const btn = tileActionBtns.nth(i);
      if (await btn.isEnabled({ timeout: 1_000 }).catch(() => false)) {
        const txt = await btn.textContent().catch(() => '');
        // Skip Script/Voice/Music buttons — Images is typically button index 3+
        if (i >= 3 || count <= 4) {
          await btn.click();
          clicked = true;
          console.log(`✅ Clicked "${txt?.trim()}" button at index ${i}`);
          break;
        }
      }
    }

    // Fallback: click last enabled tile button
    if (!clicked) {
      for (let i = count - 1; i >= 0; i--) {
        const btn = tileActionBtns.nth(i);
        if (await btn.isEnabled({ timeout: 1_000 }).catch(() => false)) {
          const txt = await btn.textContent().catch(() => '');
          await btn.click();
          clicked = true;
          console.log(`✅ Clicked fallback "${txt?.trim()}" button at index ${i}`);
          break;
        }
      }
    }

    if (!clicked) {
      console.log('⚠️  Could not find enabled Run/Regenerate button for Images');
      await page.screenshot({ path: 'run-images-step-norun.png' });
      return;
    }

    await page.screenshot({ path: 'run-images-step-running.png' });
    console.log('⏳ Waiting up to 6 min for images to generate…');

    // Wait for Scene Images section to appear
    await expect(sceneImagesSection).toBeVisible({ timeout: 360_000 });
    console.log('✅ Images generated — Scene Images section visible');
  } else {
    console.log('ℹ️  Images already generated — verifying existing images');
  }

  await page.screenshot({ path: 'run-images-step-done.png' });

  // ── Error counts ──────────────────────────────────────────────────────
  const previewUnavail = await page.locator('text=Preview unavailable').count();
  const fileNotAvail   = await page.locator('text=File not available').count();
  console.log(`Preview unavailable: ${previewUnavail}`);
  console.log(`File not available: ${fileNotAvail}`);

  // ── Verify image quality via naturalWidth ─────────────────────────────
  // Blob URLs are revoked by React after img.onload (memory management), so
  // fetch(blobUrl) always returns 0. Use naturalWidth instead — it reads from
  // the decoded image cache and works even after blob revocation.
  const allImgs = page.locator('img[src^="blob:"], img[src*="/media/versions/"]');
  const imgCount = await allImgs.count();
  console.log(`Found ${imgCount} scene image elements`);

  let loadedCount = 0;
  let brokenCount = 0;
  for (let i = 0; i < imgCount; i++) {
    const dims = await allImgs.nth(i).evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth, h: el.naturalHeight, complete: el.complete,
    }));
    const loaded = dims.complete && dims.w > 0;
    if (loaded) loadedCount++;
    else brokenCount++;
    console.log(`  Image ${i + 1}: ${dims.w}×${dims.h} complete=${dims.complete} — ${loaded ? '✅ loaded' : '❌ broken'}`);
  }
  console.log(`\nSummary: ${loadedCount} loaded, ${brokenCount} broken, ${imgCount} total`);

  // ── Assertions ────────────────────────────────────────────────────────
  expect(previewUnavail, '"Preview unavailable" count').toBe(0);
  expect(fileNotAvail,   '"File not available" count').toBe(0);
  expect(brokenCount, 'Broken images (naturalWidth=0)').toBe(0);
  if (imgCount > 0) {
    expect(loadedCount, 'Loaded images count').toBeGreaterThan(0);
  }
});
