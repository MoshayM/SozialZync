import { test, expect } from '@playwright/test';
import { setupApiMocks, MOCK_TOKEN } from './fixtures/api-mock';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    // Navigate to a real page first before accessing localStorage
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.removeItem('cf_token'));
  });

  test('login page renders correctly', async ({ page }) => {
    await expect(page.getByText('Sozialzynk').first()).toBeVisible();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create one free/i })).toBeVisible();
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /create free account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^sign in$/i })).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill('test@creatorforce.ai');
    await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    // Login redirects to /home (dashboard root)
    await page.waitForURL(/\/(home|projects|discover)/, { timeout: 25_000 });
    expect(page.url()).toMatch(/\/(home|projects|discover)/);
  });

  test('login stores token in localStorage', async ({ page }) => {
    await page.getByLabel('Email').fill('test@creatorforce.ai');
    await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/(home|projects|discover)/, { timeout: 25_000 });
    const token = await page.evaluate(() => localStorage.getItem('cf_token'));
    expect(token).toBeTruthy();
    expect(token).toBe(MOCK_TOKEN);
  });

  test('register with valid data redirects to dashboard', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/email/i).fill('newuser@example.com');
    await page.getByLabel('Password', { exact: true }).fill('NewPass123!');
    await page.getByRole('button', { name: /create free account/i }).click();
    await page.waitForURL(/\/(home|projects|discover)/, { timeout: 25_000 });
    expect(page.url()).toMatch(/\/(home|projects|discover)/);
  });

  test('login to register navigation works', async ({ page }) => {
    await page.getByRole('link', { name: /create one free/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('register to login navigation works', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('link', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user redirected from dashboard', async ({ page }) => {
    // token already removed in beforeEach
    // /discover still exists and still requires auth — redirect to login
    await page.goto('/discover');
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain('/login');
  });

  test('logout clears token and redirects to login', async ({ page }) => {
    await page.evaluate((tok) => localStorage.setItem('cf_token', tok), MOCK_TOKEN);
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    // Wait for the user menu button to be rendered before clicking
    await page.getByRole('button', { name: 'Open user menu' }).waitFor({ timeout: 10_000 });
    // Open the user account menu, then click Sign Out
    await page.getByRole('button', { name: 'Open user menu' }).click();
    // force: true bypasses overflow-hidden container that clips the dropdown in Playwright
    await page.getByRole('button', { name: /sign out/i }).click({ force: true });
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    const token = await page.evaluate(() => localStorage.getItem('cf_token'));
    expect(token).toBeNull();
  });
});
