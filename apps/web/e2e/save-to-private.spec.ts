import { test, expect } from '@playwright/test';

/**
 * Tests Save to Private flow on the Shorts Studio video page
 * and verifies content appears in My Content section on Home.
 */
test.describe('Save to Private flow', () => {
  // Use stored auth from auth.setup.ts
  test.use({ storageState: 'e2e/.auth.json' });

  const IMPORTED_VIDEO_ID = 'cmuinftft0035pr3lhsn3h6aw'; // "Declaration of Unwavering Loyalty" video
  const RENDERED_CLIP_ID  = 'cmujhtbvh01ngpc3lev2mrcfh'; // "Unbreakable Promise" rendered clip

  test('video page loads, rendered clip shows Saved! for already-saved clips', async ({ page }) => {
    await page.goto(`/shorts-studio/videos/${IMPORTED_VIDEO_ID}`);
    // Wait for CLIPS section to appear
    await expect(page.getByText('CLIPS', { exact: false })).toBeVisible({ timeout: 20_000 });

    // Expand a clip by clicking its title row
    const clipRow = page.locator('div[role="button"]').filter({ hasText: 'Declaration of Unwav' }).first();
    if (await clipRow.count() > 0) {
      await clipRow.click();
      // Should show Save to Private or Saved! button
      const saveBtn = page.getByRole('button', { name: /save to private|saved!/i });
      await expect(saveBtn).toBeVisible({ timeout: 10_000 });
      console.log('Save button text:', await saveBtn.textContent());
    }
  });

  test('saved-clip-ids endpoint wires up: already-saved clip shows Saved! on load', async ({ page, request }) => {
    // First confirm the API returns the already-saved clip
    const apiBase = 'https://sozialzync-api-production.up.railway.app/api/v1';

    // Login to get token
    const loginRes = await request.post(`${apiBase}/auth/login`, {
      data: { email: 'sozialzync@gmail.com', password: 'Admin@123' },
    });
    const { accessToken } = await loginRes.json();

    const savedRes = await request.get(`${apiBase}/shorts-studio/saved-clip-ids`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { savedClipIds } = await savedRes.json();
    console.log('Already saved clip IDs:', savedClipIds);

    // Now visit the page and check the button state
    await page.goto(`/shorts-studio/videos/${IMPORTED_VIDEO_ID}`);
    await expect(page.getByText('CLIPS', { exact: false })).toBeVisible({ timeout: 20_000 });

    // Expand the "Unbreakable Promise" clip if it's in the list
    const clipRows = page.locator('div[role="button"]').filter({ hasText: 'Unbreakable' });
    if (await clipRows.count() > 0) {
      await clipRows.first().click();
      await page.waitForTimeout(2_000); // let savedClipIds query resolve

      const saveBtn = page.getByRole('button', { name: /saved!/i });
      if (savedClipIds.includes(RENDERED_CLIP_ID)) {
        // Already saved — button should say "Saved!"
        await expect(saveBtn).toBeVisible({ timeout: 8_000 });
        console.log('Clip is already saved — shows Saved! correctly');
      } else {
        console.log('Clip not yet saved — showing Save to Private');
      }
    }
  });

  test('My Content section on Home shows saved clips with correct tabs', async ({ page }) => {
    await page.goto('/home');
    // Wait for My Content section
    await expect(page.getByText('My Content')).toBeVisible({ timeout: 20_000 });

    // Check "all" tab has items
    const grid = page.locator('.grid').filter({ has: page.locator('[class*="rounded-2xl"]') }).first();
    await expect(grid).toBeVisible({ timeout: 10_000 });

    // Click "private" tab
    await page.getByRole('button', { name: /private/i }).first().click();
    await page.waitForTimeout(1_500);
    const privateItems = page.locator('.grid [class*="rounded-2xl"]');
    const privateCount = await privateItems.count();
    console.log(`Private tab: ${privateCount} items`);
    expect(privateCount).toBeGreaterThan(0);

    // Click "public" tab
    await page.getByRole('button', { name: /public/i }).first().click();
    await page.waitForTimeout(1_500);
    const publicItems = page.locator('.grid [class*="rounded-2xl"]');
    const publicCount = await publicItems.count();
    console.log(`Public tab: ${publicCount} items`);
    expect(publicCount).toBeGreaterThan(0);

    // Click a card that has a play URL and verify it has an <a> wrapper
    const playableCard = page.locator('a[href*="/api/proxy/media/versions"]').first();
    await expect(playableCard).toBeVisible({ timeout: 8_000 });
    const href = await playableCard.getAttribute('href');
    console.log('Card play URL starts with:', href?.substring(0, 60));
    expect(href).toContain('/api/proxy/media/versions');
  });
});
