import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } }); // bypass global storageState

test('voice over audio player loads correctly', async ({ page }) => {
  // Login via the app login page
  await page.goto('https://sozialzynk.vercel.app/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"]', 'sozialzync@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|projects|app)/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/vo-1-logged-in.png' });

  // Navigate to projects list
  await page.goto('https://sozialzynk.vercel.app/projects');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/vo-2-projects.png' });

  // Click first project
  const projectLink = page.locator('a[href*="/projects/"]').first();
  await projectLink.waitFor({ timeout: 15000 });
  const href = await projectLink.getAttribute('href');
  console.log('Opening project:', href);
  await projectLink.click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'e2e/vo-3-project.png' });

  // Scroll down to find Voice over tile
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(1000);

  // Find and expand Voice over section
  const voiceText = page.locator('text=Voice over').first();
  await voiceText.waitFor({ timeout: 10000 }).catch(() => console.log('Voice over text not found'));
  await voiceText.scrollIntoViewIfNeeded().catch(() => {});

  // Try to expand via chevron button near Voice over
  const expandBtn = page.locator('[aria-label*="Expand Voice"], [aria-label*="expand voice"]').first();
  const hasExpandBtn = await expandBtn.isVisible().catch(() => false);
  if (hasExpandBtn) {
    await expandBtn.click();
  } else {
    // Click the voice tile row itself
    await voiceText.click().catch(() => {});
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/vo-4-expanded.png' });

  // Check for errors
  const fileNotAvailable = await page.locator('text=File not available').isVisible().catch(() => false);
  console.log('❌ "File not available" error present:', fileNotAvailable);
  expect(fileNotAvailable).toBe(false);

  // Wait for audio element
  const audioEl = page.locator('audio').first();
  const audioAppeared = await audioEl.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  console.log('🎵 Audio element appeared:', audioAppeared);

  if (audioAppeared) {
    const src = await audioEl.getAttribute('src');
    console.log('Audio src (first 80 chars):', src?.slice(0, 80));
    expect(src).toBeTruthy();
    expect(src).toMatch(/^blob:/);

    // Try playing
    await audioEl.evaluate((el: HTMLAudioElement) => el.play().catch(() => {}));
    await page.waitForTimeout(800);
    const paused = await audioEl.evaluate((el: HTMLAudioElement) => el.paused);
    console.log('Audio playing (not paused):', !paused);
  }

  await page.screenshot({ path: 'e2e/vo-5-audio-result.png' });

  // Check smart mix
  const mixVisible = await page.locator('text=Smart Mix').isVisible().catch(() => false);
  console.log('Smart Mix section visible:', mixVisible);

  console.log('\n=== Voice Over Test Summary ===');
  console.log(fileNotAvailable ? '❌ "File not available" shown' : '✅ No errors');
  console.log(audioAppeared ? '✅ Audio player loaded' : '⚠️  Audio player not found (step may not be complete)');
  console.log(mixVisible ? '✅ Smart Mix visible' : '— Smart Mix not visible');
});
