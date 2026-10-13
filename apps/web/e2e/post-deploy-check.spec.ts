import { test, expect } from '@playwright/test';

test('post-deploy pipeline health check', async ({ page }) => {
  // Collect console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto('https://sozialzynk.vercel.app');
  await page.waitForTimeout(2000);

  // Login if needed
  if (page.url().includes('/login') || page.url().includes('/auth')) {
    await page.fill('input[type="email"]', 'sozialzync@gmail.com');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  }

  await page.screenshot({ path: 'e2e/post-deploy-1-dashboard.png', fullPage: false });

  // Find a project with completed script — look for projects list
  await page.goto('https://sozialzynk.vercel.app/projects');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/post-deploy-2-projects.png' });

  // Click the first project
  const projectLinks = page.locator('a[href*="/projects/"]');
  const count = await projectLinks.count();
  console.log(`Found ${count} project links`);
  if (count === 0) {
    console.log('No projects found — skipping pipeline checks');
    return;
  }
  await projectLinks.first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/post-deploy-3-project.png', fullPage: true });

  // Check for "File not available" errors
  const fileNotAvailable = await page.locator('text=File not available').count();
  const producedNoResults = await page.locator('text=produced no results').count();
  const previewUnavailable = await page.locator('text=Preview unavailable').count();

  console.log(`File not available: ${fileNotAvailable}`);
  console.log(`Produced no results: ${producedNoResults}`);
  console.log(`Preview unavailable: ${previewUnavailable}`);

  // Look for style picker
  const stylePicker = await page.locator('text=AI picks').count();
  const hasStylePicker = stylePicker > 0;
  console.log(`Style picker visible: ${hasStylePicker}`);

  // Check for audio players (voice / music)
  const audioPlayers = await page.locator('audio').count();
  console.log(`Audio players loaded: ${audioPlayers}`);

  // Check for image previews
  const imageGrid = await page.locator('img[alt=""]').count();
  console.log(`Images in grid: ${imageGrid}`);

  // Check completed steps
  const completedBadges = await page.locator('text=Completed').count();
  console.log(`Completed steps: ${completedBadges}`);

  // Check failed steps
  const failedBadges = await page.locator('text=Failed').count();
  console.log(`Failed steps: ${failedBadges}`);

  await page.screenshot({ path: 'e2e/post-deploy-4-pipeline-state.png', fullPage: true });

  // Summary assertion — no "File not available" errors
  console.log(`\n=== SUMMARY ===`);
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) console.log(consoleErrors.slice(0, 5).join('\n'));

  expect(fileNotAvailable, '"File not available" errors found').toBe(0);
  expect(producedNoResults, '"produced no results" errors found').toBe(0);
});
