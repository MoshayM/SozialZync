import { test, expect, devices } from '@playwright/test';

/**
 * Google sign-in smoke test — mobile viewport (Pixel 5).
 *
 * Does NOT go to accounts.google.com. Instead:
 *   1. Mocks /api/auth/google/start → returns a known state + a redirectUri
 *      that goes straight to our callback page.
 *   2. Mocks /api/auth/google/callback → returns fake-but-valid JWT tokens.
 *   3. Mocks /api/proxy/auth/me → lets the dashboard think the user is signed in.
 *
 * This verifies the client-side flow:
 *   click Google → start → localStorage state saved → callback page →
 *   state check passes → callback API → tokens set → redirect to /home.
 */
test.use({ ...devices['Pixel 5'] });

const FAKE_STATE  = 'test-oauth-state-abc123';
const FAKE_CODE   = 'test-auth-code-xyz';
const FAKE_USER   = { id: 'google-uid-1', email: 'testuser@gmail.com', name: 'Test User', avatarUrl: null, role: 'USER' };
const FAKE_TOKENS = { accessToken: 'fake.access.token', refreshToken: 'fake.refresh.token', user: FAKE_USER };

test.describe('Google sign-in — mobile', () => {

  test('clicking Google → callback page loads and redirects to /home', async ({ page }) => {
    // 1. Mock the start endpoint — return a URL that goes straight to OUR callback
    await page.route('**/api/auth/google/start', async route => {
      const callbackUrl = `/oauth/callback/google?code=${FAKE_CODE}&state=${FAKE_STATE}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authUrl: callbackUrl, state: FAKE_STATE }),
      });
    });

    // 2. Mock the Vercel callback proxy → return real-looking tokens
    await page.route('**/api/auth/google/callback', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_TOKENS),
      });
    });

    // 3. Mock /auth/me so the dashboard doesn't redirect back to login
    await page.route('**/api/proxy/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: FAKE_USER.id, email: FAKE_USER.email, name: FAKE_USER.name, role: FAKE_USER.role, avatarUrl: null, phone: null }),
      });
    });
    await page.route('**/api/proxy/auth/refresh', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'fake.access.token' }),
      });
    });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });

    // Click the Google button
    await page.locator('button, a').filter({ hasText: /continue with google/i }).click();

    // The start mock returns an authUrl pointing to our callback page.
    // window.location.href navigates there — callback page should show "Connecting Google"
    await expect(page.getByText(/connecting google/i)).toBeVisible({ timeout: 10_000 });

    // State check: the callback page reads localStorage.getItem('cf.oauth.state')
    // which was set by handleGoogleLogin to FAKE_STATE — should match the URL param.
    // Callback then hits /api/auth/google/callback (mocked) → gets tokens → /home.
    await page.waitForURL(/\/home/, { timeout: 20_000 });

    await page.screenshot({ path: 'e2e/google-signin-success.png' });
  });

  test('state mismatch shows error (not session-expired redirect)', async ({ page }) => {
    // Same start mock but we tamper with the state in localStorage after the fact
    await page.route('**/api/auth/google/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authUrl: `/oauth/callback/google?code=${FAKE_CODE}&state=WRONG_STATE`, state: FAKE_STATE }),
      });
    });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });

    await page.locator('button, a').filter({ hasText: /continue with google/i }).click();

    // Callback URL has WRONG_STATE but localStorage has FAKE_STATE → mismatch
    // Should show the "Sign-in failed" error view — NOT redirect to /login?mode=expired
    await expect(page.getByText(/sign-in failed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/security check failed/i)).toBeVisible({ timeout: 5_000 });

    // Must NOT redirect to login with session expired banner
    await expect(page.getByText(/your session expired/i)).not.toBeVisible();
  });

  test('Google button is visible on mobile login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('button, a').filter({ hasText: /continue with google/i })
    ).toBeVisible();
  });

});
