import { test, expect } from '@playwright/test';

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

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await emailInput(page).fill('wrong@example.com');
    await passwordInput(page).fill('wrongpass123');
    await signInBtn(page).click();
    // Should show error message or stay on login page
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/login/);
  });

  test('admin can log in and reach dashboard', async ({ page }) => {
    await page.goto('/login');
    await emailInput(page).fill(ADMIN_EMAIL);
    await passwordInput(page).fill(ADMIN_PASS);
    await signInBtn(page).click();
    // Wait for redirect to dashboard
    await page.waitForURL(/\/(home|dashboard|\(dash\))/, { timeout: 20_000 }).catch(() => {});
    const url = page.url();
    expect(url).not.toMatch(/login/);
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
