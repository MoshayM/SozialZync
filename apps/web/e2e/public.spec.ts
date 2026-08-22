import { test, expect } from '@playwright/test';

test.describe('Public browse page', () => {
  test('renders without auth', async ({ page }) => {
    await page.goto('/browse');
    await expect(page).toHaveTitle(/Sozial/i);
    // Should not redirect to login
    await expect(page).not.toHaveURL(/login/);
  });

  test('has search or content visible', async ({ page }) => {
    await page.goto('/browse');
    const hasContent = await page.locator('input[type="search"], [role="search"], video, img, h1, h2').first().isVisible();
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Root redirect', () => {
  test('root redirects to browse or login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/browse|login|home|welcome/, { timeout: 10_000 }).catch(() => {});
    const url = page.url();
    expect(url).not.toMatch(/^https?:\/\/[^/]+\/?$/);
  });
});

test.describe('Protected pages redirect to login', () => {
  for (const path of ['/home', '/projects', '/insights', '/copilot', '/admin']) {
    test(`${path} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/login/, { timeout: 10_000 }).catch(() => {});
      expect(page.url()).toMatch(/login/);
    });
  }
});
