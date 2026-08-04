import { test, expect } from '@playwright/test';
import { setupApiMocks, setAuthToken } from './fixtures/api-mock';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setAuthToken(page);
  });

  test('sidebar renders top-level nav links', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    // Top-level items always visible in sidebar (scope to aside to avoid mobile-nav duplicate)
    await expect(page.locator('aside a[href="/projects"]')).toBeVisible();
    await expect(page.locator('aside a[href="/editor"]')).toBeVisible();
    // These links moved to user dropdown — must NOT appear in the main sidebar nav
    // (they DO appear in the lg:hidden mobile-only drawer section, so scope to <nav>)
    await expect(page.locator('aside nav a[href="/settings"]')).toHaveCount(0);
    // Removed routes must not appear anywhere
    await expect(page.locator('a[href="/discover"]')).toHaveCount(0);
    await expect(page.locator('a[href="/analytics"]')).toHaveCount(0);
    await expect(page.locator('a[href="/assets"]')).toHaveCount(0);
    await expect(page.locator('a[href="/jobs"]')).toHaveCount(0);
  });

  test('user dropdown contains settings and account links', async ({ page }) => {
    await page.goto('/projects');
    // networkidle ensures React has hydrated so the onClick handler is wired up
    await page.waitForLoadState('networkidle');
    // Open the user avatar/name dropdown in the topbar
    await page.getByRole('button', { name: 'Open user menu' }).click();
    // Settings, Brand Kit, Billing, Organization links live in the user dropdown.
    // Use .first() because the mobile drawer (aside) also contains these same links.
    await expect(page.locator('a[href="/settings"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('a[href="/brand-kit"]').first()).toBeVisible();
    await expect(page.locator('a[href="/wallet"]').first()).toBeVisible();
    await expect(page.locator('a[href="/orgs"]').first()).toBeVisible();
  });

  test('sidebar shows brand name', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Sozialzync').first()).toBeVisible();
    await expect(page.getByText('AI Content Platform').first()).toBeVisible();
  });

  test('navigate to Projects page', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('aside a[href="/projects"]').click();
    await page.waitForURL(/\/projects/, { timeout: 50_000 });
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 8_000 });
  });

  test('navigate to Settings page via user dropdown', { timeout: 60_000 }, async ({ page }) => {
    await page.goto('/projects');
    // networkidle ensures React has hydrated so the onClick handler is wired up
    await page.waitForLoadState('networkidle');
    // Open user dropdown then click Settings
    await page.getByRole('button', { name: 'Open user menu' }).click();
    // Use .first() — mobile drawer also has a[href="/settings"] in the DOM
    await page.locator('a[href="/settings"]').first().click();
    await page.waitForURL(/\/settings/, { timeout: 50_000 });
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({ timeout: 10_000 });
  });

  test('navigate to Video Editor page via sidebar', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    // Scope to aside to avoid strict mode: mobile nav also has a[href="/editor"]
    await page.locator('aside a[href="/editor"]').click();
    await page.waitForURL(/\/editor/, { timeout: 50_000 });
    await expect(page).toHaveURL(/\/editor/);
  });

  // Root (/) now shows the public landing page — it does NOT redirect to /projects.
  // An unauthenticated visit should see the marketing page with Log in / Get started CTA.
  test('root path shows landing page with Log in and Get started buttons', async ({ page }) => {
    // Visit as unauthenticated (no token set)
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.removeItem('cf_token');
      sessionStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Hydration gate: wait for the banner element itself before querying within it.
    // Without this, getByRole('banner').getByRole('link') can resolve before React
    // hydrates the nav, yielding a flaky "element not found" on slow CI runners.
    const banner = page.getByRole('banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    // Scope "Log in" to the header banner (footer also has a "Log in" link → strict mode)
    await expect(banner.getByRole('link', { name: 'Log in' })).toBeVisible({ timeout: 8_000 });
    // CTA button text is "Get started free" — use first() since it appears in both header & hero
    await expect(page.getByRole('link', { name: 'Get started free' }).first()).toBeVisible({ timeout: 8_000 });
    // Must NOT be redirected to /projects
    await expect(page).toHaveURL('/');
  });

  test('active nav link is highlighted', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    const projectLink = page.locator('aside a[href="/projects"]');
    // Hydration gate: the active background is applied by usePathname() which only
    // runs after React mounts on the client — wait for the link to be visible first.
    await expect(projectLink).toBeVisible({ timeout: 10_000 });
    // Active item background: 'rgba(255,255,255,.92)' → computed background-color
    await expect(projectLink).toHaveCSS('background-color', /rgba\(255, 255, 255/, { timeout: 8_000 });
  });

  // Mobile: sidebar is hidden behind an off-canvas drawer below lg breakpoint
  test('mobile hamburger opens the navigation drawer', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    // At < 1024px the bottom nav "More" button (aria-label "Open navigation menu")
    // is the entry point for the drawer — the topbar button has aria-label "Toggle menu"
    const hamburger = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(hamburger).toBeVisible({ timeout: 8_000 });
    await hamburger.click();
    // Drawer slides in with a 300ms CSS transition; 8s timeout is ample
    await expect(page.locator('aside a[href="/projects"]')).toBeVisible({ timeout: 8_000 });
  });
});
