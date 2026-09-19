import { test, expect, devices } from '@playwright/test';

// Run these tests with Pixel 5 emulation to match the Android Brave screenshot.
// Clear storageState: the login page must render (not auto-redirect via JWT).
test.use({ ...devices['Pixel 5'], storageState: { cookies: [], origins: [] } });

// Helpers to target a specific form by its submit button text
const mainForm = (page: Parameters<typeof test>[1] extends { page: infer P } ? P : import('@playwright/test').Page) =>
  page.locator('form').filter({
    has: page.locator('button').filter({ hasText: /sign in with password/i }),
  });

const setupForm = (page: Parameters<typeof test>[1] extends { page: infer P } ? P : import('@playwright/test').Page) =>
  page.locator('form').filter({
    has: page.locator('button').filter({ hasText: /sign in & add passkey/i }),
  });

/** Ensure the green registration card is visible — click passkey button if not already shown */
async function ensureSetupCard(page: import('@playwright/test').Page) {
  const visible = await page.getByText(/register a passkey/i).isVisible();
  if (!visible) {
    await page.locator('button').filter({ hasText: 'Sign in instantly' }).click();
    await expect(page.getByText(/register a passkey/i)).toBeVisible({ timeout: 15_000 });
  }
}

test.describe('Login page — mobile passkey UX', () => {
  test('passkey button visible and no mock-mode loading screen', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText(/starting mock api/i)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    const passkeyBtn = page.locator('button').filter({ hasText: 'Sign in instantly' });
    await expect(passkeyBtn).toBeVisible();
    await expect(page.getByText(/fingerprint|touch id|face id|device unlock|windows hello|device passkey/i).first()).toBeVisible();

    await page.screenshot({ path: 'e2e/mobile-login.png' });
  });

  test('tapping passkey button shows cancellation, NOT the generic error', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    await page.locator('button').filter({ hasText: 'Sign in instantly' }).click();

    await expect(page.getByText(/sign-in was cancelled/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/passkey sign-in failed/i)).not.toBeVisible();

    await page.screenshot({ path: 'e2e/mobile-login-cancelled.png' });
  });

  test('registration card is visible (on load or after failed attempt)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    await ensureSetupCard(page);

    // Card contents are correct
    await expect(page.getByText(/sign in once/i)).toBeVisible();
    await expect(setupForm(page).locator('input[type="email"]')).toBeVisible();
    await expect(setupForm(page).locator('input[type="password"]')).toBeVisible();
    await expect(setupForm(page).locator('button').filter({ hasText: /sign in & add passkey/i })).toBeVisible();

    await page.screenshot({ path: 'e2e/mobile-login-setup-card.png' });
  });

  test('setup card email syncs with main email field', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    await ensureSetupCard(page);

    // Type in the main password form's email input
    await mainForm(page).locator('input[type="email"]').fill('user@example.com');

    // Setup form email should stay in sync via React state
    await expect(setupForm(page).locator('input[type="email"]')).toHaveValue('user@example.com');

    await page.screenshot({ path: 'e2e/mobile-login-prefill.png' });
  });

  test('setup card shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    await ensureSetupCard(page);

    await setupForm(page).locator('input[type="email"]').fill('notareal@example.com');
    await setupForm(page).locator('input[type="password"]').fill('WrongPassword123');
    await setupForm(page).locator('button').filter({ hasText: /sign in & add passkey/i }).click();

    // Accept either the 401 message or the 429 rate-limit message (both mean credentials were rejected)
    await expect(page.getByText(/incorrect email or password|too many attempts/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'e2e/mobile-login-setup-error.png' });
  });

  test('password sign-in still works on mobile', async ({ page }) => {
    // Other tests in this suite (auth.setup + auth.spec) also login as the admin,
    // so the rate-limiter may already be triggered. Give up to 90s for it to clear.
    test.setTimeout(150_000);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });

    // Scope to the main password form to avoid strict-mode violations
    // when the green registration card is also present on the page.
    await mainForm(page).locator('input[type="email"]').fill('sozialzync@gmail.com');
    await mainForm(page).locator('input[type="password"]').fill('Admin@123');
    await mainForm(page).locator('button').filter({ hasText: /sign in with password/i }).click();

    // If rate-limited by prior test-suite logins, wait 90s for the window to clear then retry.
    const rateLimited = page.getByText(/too many attempts/i);
    if (await rateLimited.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await page.waitForTimeout(90_000);
      await mainForm(page).locator('button').filter({ hasText: /sign in with password/i }).click();
    }

    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 60_000 });
    await page.screenshot({ path: 'e2e/mobile-login-success.png' });
  });
});
