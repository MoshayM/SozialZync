import { test, expect } from '@playwright/test';

// These tests verify the login/register UI — they must run without any stored
// auth session so the login page actually renders (not immediately redirects).
test.use({ storageState: { cookies: [], origins: [] } });

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

// Inputs use placeholder only (no <label>), so we locate by type
const emailInput    = (page: import('@playwright/test').Page) => page.locator('input[type="email"]').first();
const passwordInput = (page: import('@playwright/test').Page) => page.locator('input[type="password"]').first();
const signInBtn     = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /sign in with password/i });

test.describe('Login page', () => {
  test('renders login form with no purple', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sozial/i);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(emailInput(page)).toBeVisible();
    await expect(passwordInput(page)).toBeVisible();

    // No purple hex in visible text
    const bodyText = await page.evaluate(() => document.body.innerHTML);
    const purpleHits = (bodyText.match(/#7C3AED|#5B21B6|#4C1D95/gi) ?? []).length;
    expect(purpleHits, 'Purple hex codes found in DOM').toBe(0);
  });

  test('shows submit button disabled on empty form', async ({ page }) => {
    await page.goto('/login');
    // Button is disabled until both fields are filled
    await expect(signInBtn(page)).toBeDisabled();
    // URL stays on login
    await expect(page).toHaveURL(/login/);
  });

  test('login form requires both email and password', async ({ page }) => {
    // NOTE: this deployment uses NEXT_PUBLIC_USE_MOCK=true, so any non-empty
    // email+password succeeds. Test form validation logic instead.
    await page.goto('/login');
    // Both fields empty → button disabled
    await expect(signInBtn(page)).toBeDisabled();
    // Only email filled → still disabled
    await emailInput(page).fill('test@example.com');
    await expect(signInBtn(page)).toBeDisabled();
    // Both filled → button enabled
    await passwordInput(page).fill('anypassword');
    await expect(signInBtn(page)).toBeEnabled();
    // Clear email → disabled again
    await emailInput(page).fill('');
    await expect(signInBtn(page)).toBeDisabled();
  });

  test('admin can log in and reach dashboard', async ({ page }) => {
    // 300s: warmup(0) + fill(5) + race(30) + wait(120) + refill(5) + race(30) + waitForURL(60) = 250s
    test.setTimeout(300_000);

    await page.goto('/login');
    // pressSequentially fires real keydown/input/keyup events — more reliable than fill() across browsers.
    await emailInput(page).click();
    await emailInput(page).pressSequentially(ADMIN_EMAIL, { delay: 20 });
    await passwordInput(page).click();
    await passwordInput(page).pressSequentially(ADMIN_PASS, { delay: 20 });
    await expect(signInBtn(page)).toBeEnabled({ timeout: 5_000 });
    await signInBtn(page).click();

    // Race: navigation success vs rate-limit toast — cold Railway returns 429 after >4 s.
    let authOk = false;
    await Promise.race([
      page.waitForURL(/\/(home|dashboard|\(dash\))/, { timeout: 30_000, waitUntil: 'commit' })
        .then(() => { authOk = true; }).catch(() => {}),
      page.getByText(/too many attempts/i).waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
    ]);

    if (!authOk) {
      // Wait for rate-limit window to clear, then retry once.
      await page.waitForTimeout(120_000);
      await page.goto('/login');
      await emailInput(page).click();
      await emailInput(page).pressSequentially(ADMIN_EMAIL, { delay: 20 });
      await passwordInput(page).click();
      await passwordInput(page).pressSequentially(ADMIN_PASS, { delay: 20 });
      await expect(signInBtn(page)).toBeEnabled({ timeout: 5_000 });
      await signInBtn(page).click();
    }

    await page.waitForURL(/\/(home|dashboard|\(dash\))/, { timeout: 120_000, waitUntil: 'commit' });
    expect(page.url()).not.toMatch(/login/);
  });
});

test.describe('Register page', () => {
  test('renders register form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(emailInput(page)).toBeVisible();
  });

  test('no purple in register page DOM', async ({ page }) => {
    await page.goto('/register');
    const html = await page.evaluate(() => document.body.innerHTML);
    const hits = (html.match(/#7C3AED|#4f2ec4|#6D4AE0/gi) ?? []).length;
    expect(hits, 'Purple hex in register DOM').toBe(0);
  });
});

test.describe('Forgot password page', () => {
  test('renders email input', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(emailInput(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /send|reset|email/i })).toBeVisible();
  });
});
