import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

async function loginAs(page: Page, email: string, pass: string) {
  await page.goto('/login');
  // Inputs use placeholder only — locate by type
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 20_000 });
}

test.describe('Dashboard — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASS);
  });

  test('sidebar is visible with gray brand colors', async ({ page }) => {
    await page.goto('/home');
    const sidebar = page.locator('aside, nav').first();
    await expect(sidebar).toBeVisible();

    // Sidebar background should be white, not purple
    const bg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // white = rgb(255, 255, 255)
    expect(bg).toMatch(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255/);
  });

  test('home page loads with key widgets', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/home');
    // /projects is in the top (always-visible) nav group
    await expect(page.locator('a[href="/projects"]').first()).toBeVisible({ timeout: 10_000 });
    // /insights lives inside the collapsible "Grow" section — check page loads directly
    await page.goto('/projects');
    await expect(page).not.toHaveURL(/login/);
    await page.goto('/insights');
    await expect(page).not.toHaveURL(/login/);
  });

  test('authenticated home page shows key navigation', async ({ page }) => {
    await page.goto('/home');
    // Sidebar renders for authenticated users (projects link is in the uncollapsed top group)
    await expect(page.locator('a[href="/projects"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('no purple inline styles in dashboard DOM', async ({ page }) => {
    await page.goto('/home');
    const html = await page.evaluate(() => document.documentElement.innerHTML);
    // Look for purple hex codes in inline styles only (not CSS class names or comments)
    const inlineStylePurple = (html.match(/style="[^"]*#7C3AED[^"]*"/gi) ?? []).length;
    expect(inlineStylePurple, 'Purple inline styles in home DOM').toBe(0);
  });

  test('calendar page loads', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });

  test('publish page loads', async ({ page }) => {
    await page.goto('/publish');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('insights page loads', async ({ page }) => {
    await page.goto('/insights');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('copilot page loads', async ({ page }) => {
    await page.goto('/copilot');
    await expect(page.locator('h1, h2, textarea, input').first()).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('admin page accessible for admin user', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('topbar renders', async ({ page }) => {
    await page.goto('/home');
    const topbar = page.locator('header, [class*="topbar"]').first();
    await expect(topbar).toBeVisible();
  });
});
