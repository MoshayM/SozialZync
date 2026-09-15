import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 20_000 });
}

test.describe('Watch feature — live smoke test', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('channel-access page loads with Social Platforms section', async ({ page }) => {
    await page.goto('/channel-access');
    await expect(page.getByText('Social Platforms')).toBeVisible({ timeout: 15_000 });
    // All expected platforms present
    for (const name of ['Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'Threads']) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
    // Every platform has a Watch button (Eye icon button)
    const watchBtns = page.getByRole('button', { name: /watch/i });
    await expect(watchBtns.first()).toBeVisible();
    await page.screenshot({ path: 'e2e/pw-watch-1-loaded.png', fullPage: false });
  });

  test('Watch button expands section with handle input and Add button', async ({ page }) => {
    await page.goto('/channel-access');
    await expect(page.getByText('Social Platforms')).toBeVisible({ timeout: 15_000 });

    // Click Watch on TikTok card
    const tiktokRow = page.locator('div').filter({ hasText: /^TikTok/ }).first();
    // The Watch button is in the social platform row area
    const allWatchBtns = page.getByRole('button', { name: /watch/i });
    // TikTok is the 3rd platform (index 2)
    await allWatchBtns.nth(2).click();

    // After expanding, an input with handle placeholder should appear
    await expect(page.locator('input[placeholder*="handle"]').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /^add$/i }).first()).toBeVisible();
    await page.screenshot({ path: 'e2e/pw-watch-2-expanded.png', fullPage: false });
  });

  test('can add and remove a watch account on Instagram', async ({ page }) => {
    await page.goto('/channel-access');
    await expect(page.getByText('Social Platforms')).toBeVisible({ timeout: 15_000 });

    // Instagram is the 2nd platform (index 1) — click its Watch button
    const watchBtns = page.getByRole('button', { name: /watch/i });
    await watchBtns.nth(1).click();

    // Input should appear
    const handleInput = page.locator('input[placeholder*="handle"]').first();
    await expect(handleInput).toBeVisible({ timeout: 8_000 });

    // Add @pw_testhandle
    await handleInput.fill('@pw_testhandle');
    await page.getByRole('button', { name: /^add$/i }).first().click();

    // Handle appears in the list
    await expect(page.getByText('@pw_testhandle')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/pw-watch-3-added.png', fullPage: false });

    // Unwatch it
    await page.getByRole('button', { name: /unwatch/i }).first().click();
    await expect(page.getByText('@pw_testhandle')).not.toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/pw-watch-4-removed.png', fullPage: false });
  });

  test('Watch button shows count badge after adding multiple accounts', async ({ page }) => {
    await page.goto('/channel-access');
    await expect(page.getByText('Social Platforms')).toBeVisible({ timeout: 15_000 });

    // X is the 4th platform (index 3)
    const watchBtns = page.getByRole('button', { name: /watch/i });
    await watchBtns.nth(3).click();

    const handleInput = page.locator('input[placeholder*="handle"]').first();
    await expect(handleInput).toBeVisible({ timeout: 8_000 });

    // Add first account
    await handleInput.fill('@x_user_one');
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await expect(page.getByText('@x_user_one')).toBeVisible({ timeout: 10_000 });

    // Add second account
    await handleInput.fill('@x_user_two');
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await expect(page.getByText('@x_user_two')).toBeVisible({ timeout: 10_000 });

    // Badge on the Watch button should now show 2
    const badge = page.locator('span').filter({ hasText: '2' });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'e2e/pw-watch-5-badge.png', fullPage: false });

    // Clean up
    const unwatchBtns = page.getByRole('button', { name: /unwatch/i });
    await unwatchBtns.first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /unwatch/i }).first().click();
    await expect(page.getByText('@x_user_one')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('@x_user_two')).not.toBeVisible({ timeout: 8_000 });
  });
});
