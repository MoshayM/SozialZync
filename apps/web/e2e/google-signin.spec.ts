import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

const FAKE_STATE  = 'test-oauth-state-abc123';
const FAKE_CODE   = 'test-auth-code-xyz';
const FAKE_USER   = { id: 'google-uid-1', email: 'testuser@gmail.com', name: 'Test User', avatarUrl: null, role: 'USER' };
const FAKE_TOKENS = { accessToken: 'fake.access.token', refreshToken: 'fake.refresh.token', user: FAKE_USER };

test.describe('Google sign-in — mobile', () => {

  // ── Regression: redirectUri validation error ─────────────────────────────
  // Railway OAuthCallbackDto only accepts { code, state }.
  // Sending redirectUri caused "property redirectUri should not exist" (403).
  // The Vercel proxy must strip it before forwarding to Railway.
  test('Vercel callback proxy does NOT forward redirectUri to Railway', async ({ request }) => {
    // Hit the live Vercel proxy with redirectUri included (as the browser sends).
    // Railway must NOT respond with the validation error.
    const res = await request.post('/api/auth/google/callback', {
      data: { code: 'fake-code-for-test', state: 'fake-state-for-test', redirectUri: 'https://sozialzynk.vercel.app/oauth/callback/google' },
    });

    const body = await res.json() as Record<string, unknown>;

    // The proxy should have stripped redirectUri before forwarding.
    // Railway will reject the fake code with an OAuth error (not a DTO validation error).
    expect(
      body['message'] ?? body['error'] ?? '',
      'Railway must not return "property redirectUri should not exist"'
    ).not.toMatch(/redirectUri should not exist/i);

    // Confirm Railway DID receive the request (any HTTP status is fine here —
    // 400/401 from Railway for bad code is expected; 422 for DTO violation is not).
    expect(res.status()).not.toBe(422);
  });

  // ── Full UI flow (mocked) ─────────────────────────────────────────────────
  test('clicking Google → callback page loads and redirects to /home', async ({ page }) => {
    await page.route('**/api/auth/google/start', async route => {
      const callbackUrl = `/oauth/callback/google?code=${FAKE_CODE}&state=${FAKE_STATE}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authUrl: callbackUrl, state: FAKE_STATE }),
      });
    });

    await page.route('**/api/auth/google/callback', async route => {
      // Intercept and capture what the callback page sends to the proxy
      const reqBody = route.request().postDataJSON() as Record<string, unknown>;

      // The callback page must NOT be sending redirectUri to our proxy
      // (even though we stripped it at the proxy layer, belt-and-suspenders check)
      expect(Object.keys(reqBody)).not.toContain('redirectUri');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_TOKENS),
      });
    });

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

    await page.locator('button, a').filter({ hasText: /continue with google/i }).click();

    await expect(page.getByText(/connecting google/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForURL(/\/home/, { timeout: 20_000 });

    await page.screenshot({ path: 'e2e/google-signin-success.png' });
  });

  // ── State mismatch (stored state exists AND differs) ─────────────────────
  // If storedState is null (Android cross-context), we skip the check — Railway
  // validates server-side. We only block when we positively have a wrong state.
  test('positive state mismatch shows error', async ({ page }) => {
    // Start returns FAKE_STATE → stored in localStorage
    // But authUrl has WRONG_STATE → positive mismatch → error
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

    await expect(page.getByText(/sign-in failed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/security check failed/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/your session expired/i)).not.toBeVisible();
  });

  // ── Missing stored state (Android cross-context) ──────────────────────────
  // storedState is null → skip client check → Railway validates → proceed
  test('missing localStorage state proceeds to Railway (Android cross-context)', async ({ page }) => {
    // Callback posts to Railway mock — returns tokens
    await page.route('**/api/auth/google/callback', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_TOKENS),
      });
    });
    await page.route('**/api/proxy/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: FAKE_USER.id, email: FAKE_USER.email, name: FAKE_USER.name, role: FAKE_USER.role, avatarUrl: null, phone: null }),
      });
    });
    await page.route('**/api/proxy/auth/refresh', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'fake.access.token' }) });
    });

    // Navigate directly to callback WITHOUT going through login first
    // → localStorage has NO stored state (simulates Android cross-context)
    await page.goto(`/oauth/callback/google?code=${FAKE_CODE}&state=${FAKE_STATE}`);

    // Should NOT show state-mismatch error — should proceed to /home
    await expect(page.getByText(/security check failed/i)).not.toBeVisible({ timeout: 5_000 });
    await page.waitForURL(/\/home/, { timeout: 20_000 });
  });

  // ── Visibility ────────────────────────────────────────────────────────────
  test('Google button is visible on mobile login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('button, a').filter({ hasText: /continue with google/i })
    ).toBeVisible();
  });

});
