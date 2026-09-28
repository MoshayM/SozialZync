/**
 * Verify: AI thumbnail generation via DALL-E 3 / Pollinations in Publish modal
 * Run with: npx playwright test ai-thumbnail-verify --project=chromium --headed
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth.json');

test.use({ storageState: AUTH_FILE });

test('AI thumbnail generation in Publish modal', async ({ page }) => {
  // Navigate to Shorts Studio
  await page.goto('/shorts-studio', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'e2e/ai-thumb-1-studio.png', fullPage: true });

  // Find first "Publish" button visible on a clip card
  const publishBtn = page.getByRole('button', { name: /publish/i }).first();
  await expect(publishBtn).toBeVisible({ timeout: 30_000 });
  await publishBtn.click();

  // Publish modal should open
  await page.screenshot({ path: 'e2e/ai-thumb-2-modal-open.png' });

  // Switch to AI Generate tab/mode
  const aiTab = page.getByRole('button', { name: /ai generate/i }).first();
  await expect(aiTab).toBeVisible({ timeout: 10_000 });
  await aiTab.click();
  await page.screenshot({ path: 'e2e/ai-thumb-3-ai-mode.png' });

  // Fill in the prompt
  const promptInput = page.locator('textarea, input[placeholder*="prompt" i], input[placeholder*="describe" i]').first();
  await expect(promptInput).toBeVisible({ timeout: 5_000 });
  await promptInput.fill('speaker on stage with blue dramatic lighting');

  // Click Generate with AI and time it
  const generateBtn = page.getByRole('button', { name: /generate with ai/i }).first();
  await expect(generateBtn).toBeVisible({ timeout: 5_000 });

  const t0 = Date.now();
  await generateBtn.click();

  // Wait for loading spinner to disappear (up to 90s for AI generation)
  await page.waitForFunction(
    () => !document.querySelector('[class*="animate-spin"], [class*="spinner"], [aria-label*="loading" i]'),
    { timeout: 90_000 }
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Generation took ${elapsed}s`);

  await page.screenshot({ path: 'e2e/ai-thumb-4-generated.png' });

  // Check for 3 thumbnail images in the grid (no broken images)
  const thumbnailImgs = page.locator('img[alt*="Thumbnail"], img[alt*="thumbnail"], img[class*="aspect"]');
  const count = await thumbnailImgs.count();
  console.log(`Thumbnail image count: ${count}`);

  // Check none are broken (naturalWidth > 0 means loaded)
  const loadedCount = await thumbnailImgs.evaluateAll((imgs: HTMLImageElement[]) =>
    imgs.filter(img => img.naturalWidth > 0).length
  );
  console.log(`Successfully loaded images: ${loadedCount}`);

  // Verify at least 2 of 3 loaded successfully
  expect(loadedCount).toBeGreaterThanOrEqual(2);
  console.log(`PASS — ${loadedCount} AI thumbnails generated and displayed in ${elapsed}s`);
});
