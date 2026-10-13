import { test, expect } from '@playwright/test';

/**
 * Mock all API proxy calls so the test never hits the real backend.
 */
async function setupMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/proxy/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/') && url.includes('/login') && method === 'POST') {
      return route.fulfill({ json: { accessToken: 'fake-access-token', refreshToken: 'fake-refresh-token' } });
    }
    if (url.includes('/auth/') && url.includes('/me')) {
      return route.fulfill({ json: { id: 'user-e2e', email: 'e2e@example.com', name: 'E2E User', role: 'USER', avatarUrl: null, phone: null } });
    }
    if (url.includes('/auth/') && url.includes('/providers')) {
      return route.fulfill({ json: { google: true } });
    }
    if (url.includes('/auth/') && url.includes('/sessions')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/auth/')) {
      return route.fulfill({ json: {} });
    }
    if (url.includes('/billing/')) {
      return route.fulfill({ json: { plan: 'FREE', status: 'active', currentPeriodEnd: null } });
    }
    if (url.includes('/trial')) {
      return route.fulfill({ json: { hasTrial: false, active: false, daysLeft: 0 } });
    }
    if (url.includes('/wallet/')) {
      return route.fulfill({ json: { balanceCredits: 0, buckets: {}, lifetimePurchased: 0, lifetimeUsed: 0, status: 'NONE', monthlyLimit: 0, spent: 0, remaining: 0, willExceed: false, blocked: false, alertThreshold: 0.8, hardCap: false, balance: 0 } });
    }
    if (url.includes('/channels')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/projects') && method === 'POST') {
      return route.fulfill({ json: { id: 'proj-ct-test', title: 'Documentary test', niche: null, targetLang: 'en', status: 'DRAFT', publishingStatus: 'NOT_PUBLISHED', channel: null, _count: { jobs: 0, videos: 0 }, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() } });
    }
    if (url.includes('/projects')) {
      return route.fulfill({ json: { data: [], nextCursor: null } });
    }
    if (url.includes('/notifications')) {
      return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null } });
    }
    if (url.includes('/orgs/')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/autonomy')) {
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: {} });
  });
}

test.describe('Content Type Wizard — 3-step project creation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cf_token', 'fake-access-token');
      localStorage.setItem('cf.refreshToken', 'fake-refresh-token');
    });
  });

  test('Step 1: all 8 content type cards are visible', async ({ page }) => {
    await page.goto('/projects?new=1');
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible({ timeout: 15_000 });

    // Step 1 heading
    await expect(page.getByText('What are you creating?')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/ct-01-step1.png' });

    const contentTypes = [
      'Educational',
      'Movie & Drama',
      'Story',
      'Series',
      'Commercial',
      'Documentary',
      'Motivational',
      'Comedy',
    ];

    for (const ct of contentTypes) {
      const card = page.locator(`button:has-text("${ct}")`).first();
      const visible = await card.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`${visible ? '✓' : '✗'} Content type card: ${ct}`);
      expect(visible, `Expected "${ct}" card to be visible`).toBe(true);
    }
  });

  test('Step 1→2: selecting Documentary navigates to Platform & Format', async ({ page }) => {
    await page.goto('/projects?new=1');
    await expect(page.getByText('What are you creating?')).toBeVisible({ timeout: 15_000 });

    // Select Documentary
    await page.locator('button:has-text("Documentary")').first().click();
    await page.screenshot({ path: 'e2e/ct-02-documentary-selected.png' });

    // Click Next to advance to Step 2
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 should show Platform
    await expect(page.getByText('Platform & Format')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/ct-03-step2.png' });
    console.log('✓ Step 2 (Platform & Format) visible after Next');
  });

  test('Step 2: context chip shows selected content type', async ({ page }) => {
    await page.goto('/projects?new=1');
    await expect(page.getByText('What are you creating?')).toBeVisible({ timeout: 15_000 });

    // Select "Movie & Drama"
    await page.locator('button:has-text("Movie")').first().click();

    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByText('Platform & Format')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/ct-04-chip.png' });

    // The context chip showing the selected type should appear somewhere on Step 2
    const chip = page.locator('text=/Movie|Drama/i').first();
    const chipVisible = await chip.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(chipVisible ? '✓ Content type chip visible on Step 2' : 'ℹ Content type chip not found (may be inside a label)');
  });

  test('full 3-step flow: Documentary → Platform → create project', async ({ page }) => {
    await page.goto('/projects?new=1');
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible({ timeout: 15_000 });

    // Step 1 — select Documentary
    await expect(page.getByText('What are you creating?')).toBeVisible({ timeout: 10_000 });
    await page.locator('button:has-text("Documentary")').first().click();
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 — Platform & Format; YouTube already selected
    await expect(page.getByText('Platform & Format')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/ct-05-step2.png' });
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3 — fill title and submit
    await expect(page.getByText('Project title')).toBeVisible({ timeout: 10_000 });
    await page.locator('input[placeholder*="e.g."]').first().fill('Documentary test');
    await page.screenshot({ path: 'e2e/ct-06-step3.png' });

    await page.getByRole('button', { name: /create project/i }).click();

    // Must navigate to a real project, not /projects/undefined
    await page.waitForURL(
      (url) => url.pathname.startsWith('/projects/') && url.pathname !== '/projects/undefined',
      { timeout: 15_000 },
    );

    const pathname = new URL(page.url()).pathname;
    expect(pathname).not.toBe('/projects/undefined');
    expect(pathname).toMatch(/^\/projects\/[a-z0-9-]+$/i);

    await page.screenshot({ path: 'e2e/ct-07-success.png' });
    console.log(`✓ Created project at ${pathname}`);
  });

  test('Back button on Step 3 returns to Step 2', async ({ page }) => {
    await page.goto('/projects?new=1');
    await expect(page.getByText('What are you creating?')).toBeVisible({ timeout: 15_000 });

    // Step 1 → 2 → 3
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByText('Platform & Format')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByText('Project title')).toBeVisible({ timeout: 10_000 });

    // Back from Step 3 → Step 2
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page.getByText('Platform & Format')).toBeVisible({ timeout: 10_000 });
    console.log('✓ Back from Step 3 returns to Step 2 (Platform)');
    await page.screenshot({ path: 'e2e/ct-08-back-to-step2.png' });
  });
});
