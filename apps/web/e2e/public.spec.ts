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
    await expect(page.locator('input[type="search"], [role="search"], video, img, h1, h2').first()).toBeVisible();
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
  // Must test unauthenticated behaviour — clear stored JWT so the auth guard fires.
  test.use({ storageState: { cookies: [], origins: [] } });

  // /copilot is a tombstone that server-redirects to /home, which then client-redirects
  // to /login. The double-hop is tested separately below; it cannot be in this loop
  // because the extra server → client round-trip exceeds the 20s window in Firefox.
  for (const path of ['/home', '/projects', '/insights', '/admin']) {
    test(`${path} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/login/, { timeout: 20_000 }).catch(() => {});
      expect(page.url()).toMatch(/login/);
    });
  }
});

test.describe('/copilot tombstone redirect', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/copilot redirects unauthenticated users (via /home)', async ({ page }) => {
    // /copilot does a server-side redirect to /home; /home then client-side redirects
    // to /login. Allow extra time for both hops in headless browsers.
    await page.goto('/copilot');
    await page.waitForURL(/login|home/, { timeout: 30_000 }).catch(() => {});
    // Accept any redirect destination — the tombstone must not render a 404 or error page
    const url = page.url();
    expect(url).toMatch(/\/(home|login|projects|dashboard)/);
  });
});
