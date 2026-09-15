import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

/**
 * Mock all API proxy calls so the test never hits the real backend.
 * This avoids auth rate-limiter problems from repeated runs.
 */
async function setupMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/proxy/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Auth
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

    // Billing / plan
    if (url.includes('/billing/')) {
      return route.fulfill({ json: { plan: 'FREE', status: 'active', currentPeriodEnd: null } });
    }

    // Trial
    if (url.includes('/trial')) {
      return route.fulfill({ json: { hasTrial: false, active: false, daysLeft: 0 } });
    }

    // Wallet
    if (url.includes('/wallet/')) {
      return route.fulfill({ json: { balanceCredits: 0, buckets: {}, lifetimePurchased: 0, lifetimeUsed: 0, status: 'NONE', monthlyLimit: 0, spent: 0, remaining: 0, willExceed: false, blocked: false, alertThreshold: 0.8, hardCap: false, balance: 0 } });
    }

    // Channels
    if (url.includes('/channels')) {
      return route.fulfill({ json: [] });
    }

    // Projects — POST returns a real project shape with an id
    if (url.includes('/projects') && method === 'POST') {
      return route.fulfill({ json: { id: 'e2e-project-abc123', title: 'Mobile test project', niche: null, targetLang: 'en', status: 'DRAFT', publishingStatus: 'NOT_PUBLISHED', channel: null, _count: { jobs: 0, videos: 0 }, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() } });
    }
    // Projects — GET returns empty list
    if (url.includes('/projects')) {
      return route.fulfill({ json: { data: [], nextCursor: null } });
    }

    // Notifications
    if (url.includes('/notifications')) {
      return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null } });
    }

    // Orgs
    if (url.includes('/orgs/')) {
      return route.fulfill({ json: [] });
    }

    // Autonomy / calendar
    if (url.includes('/autonomy')) {
      return route.fulfill({ json: {} });
    }

    // Fallback
    return route.fulfill({ json: {} });
  });
}

test.describe('Create project — mobile (fix /projects/undefined)', () => {
  test('submitting create form navigates to a real project page, not /projects/undefined', async ({ page }) => {
    // 1. Intercept all API calls so we never touch the real backend
    await setupMocks(page);

    // 2. Set auth tokens in localStorage (page checks these, not cookies)
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('cf_token', 'fake-access-token');
      localStorage.setItem('cf.refreshToken', 'fake-refresh-token');
    });

    // 3. Navigate to projects page with ?new=1 (mimics bottom nav Create button)
    await page.goto('/projects?new=1');
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: 'e2e/create-project-modal.png' });

    // 4. Step 1 — YouTube + default format already selected; click Next
    await page.getByRole('button', { name: /next/i }).click();

    // 5. Step 2 — fill in the project title (first "e.g." input on this step)
    await expect(page.getByText('Project title')).toBeVisible({ timeout: 10_000 });
    await page.locator('input[placeholder*="e.g."]').first().fill('Mobile test project');

    await page.screenshot({ path: 'e2e/create-project-step2.png' });

    // 6. Submit — button is enabled once title is non-empty
    await page.getByRole('button', { name: /create project/i }).click();

    // 7. Must navigate to /projects/{id}, NOT /projects/undefined
    await page.waitForURL(
      (url) => url.pathname.startsWith('/projects/') && url.pathname !== '/projects/undefined',
      { timeout: 15_000 },
    );

    const pathname = new URL(page.url()).pathname;
    expect(pathname).not.toBe('/projects/undefined');
    expect(pathname).toMatch(/^\/projects\/[a-z0-9-]+$/i);

    await page.screenshot({ path: 'e2e/create-project-success.png' });
  });
});
