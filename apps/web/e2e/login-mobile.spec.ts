import { test, expect, devices } from '@playwright/test';

// Run these tests with Pixel 5 emulation to match the Android Brave screenshot
test.use({ ...devices['Pixel 5'] });

test.describe('Login page — mobile passkey UX', () => {
  test('passkey button visible and no mock-mode loading screen', async ({ page }) => {
    await page.goto('/login');

    // Must NOT see the mock API loading screen
    await expect(page.getByText(/starting mock api/i)).not.toBeVisible({ timeout: 5_000 });

    // "Welcome back" heading loads
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    // The passkey button renders with aria-label "Sign in with <method>" where <method>
    // is e.g. "Fingerprint / device unlock" on Android — find it by its visible text instead.
    const passkeyBtn = page.locator('button').filter({ hasText: 'Sign in instantly' });
    await expect(passkeyBtn).toBeVisible();

    // The subtitle shows the platform label (e.g. "Fingerprint / device unlock")
    await expect(page.getByText(/fingerprint|touch id|face id|device unlock|windows hello|device passkey/i).first()).toBeVisible();

    await page.screenshot({ path: 'e2e/mobile-login.png' });
  });

  test('tapping passkey button shows cancellation, NOT the generic error', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    const passkeyBtn = page.locator('button').filter({ hasText: 'Sign in instantly' });
    await expect(passkeyBtn).toBeVisible();

    await passkeyBtn.click();

    // Without real hardware, the browser throws NotAllowedError (or AbortError).
    // Both now map to "Sign-in was cancelled." — the fix ensures the GENERIC
    // "Passkey sign-in failed" message no longer appears.
    await expect(
      page.getByText(/sign-in was cancelled/i),
    ).toBeVisible({ timeout: 15_000 });

    // The old generic fallback must be absent
    await expect(page.getByText(/passkey sign-in failed/i)).not.toBeVisible();

    await page.screenshot({ path: 'e2e/mobile-login-cancelled.png' });
  });

  test('password sign-in still works on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    await page.locator('input[type="email"]').fill('sozialzync@gmail.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.getByRole('button', { name: /sign in with password/i }).click();

    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 25_000 });
    await page.screenshot({ path: 'e2e/mobile-login-success.png' });
  });
});
