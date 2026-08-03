import { test, expect } from '@playwright/test';
import { setupApiMocks, setAuthToken } from './fixtures/api-mock';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setAuthToken(page);
    await page.goto('/settings');
    // networkidle ensures the /me React Query (which gates isOwner sections) has resolved.
    // All API calls return instantly via the mock, so networkidle fires quickly.
    await page.waitForLoadState('networkidle');
  });

  test('settings page renders with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({ timeout: 8_000 });
  });

  test('profile section is visible', async ({ page }) => {
    // exact: true avoids matching "Your Profile" (the card title)
    await expect(page.getByText('Profile', { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /save profile/i })).toBeVisible({ timeout: 8_000 });
  });

  test('sign-in & security section is visible', async ({ page }) => {
    await expect(page.getByText(/sign-in.*security/i)).toBeVisible({ timeout: 8_000 });
  });

  test('linked accounts panel is visible', async ({ page }) => {
    await expect(page.getByText('Linked accounts')).toBeVisible({ timeout: 8_000 });
  });

  test('content channels section links to media control', async ({ page }) => {
    await expect(page.getByText('Content Channels')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('link', { name: /manage channels/i })).toBeVisible({ timeout: 8_000 });
  });

  test('google and apple providers listed in linked accounts', async ({ page }) => {
    await expect(page.getByText('Google')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Apple')).toBeVisible({ timeout: 8_000 });
  });

  test('active sessions section visible for super admin', async ({ page }) => {
    // MOCK_USER.role = SUPER_ADMIN, so isOwner = true and sessions panel renders
    await expect(page.getByText('Active sessions', { exact: true })).toBeVisible({ timeout: 8_000 });
  });

  test('api keys section visible for super admin', async ({ page }) => {
    // Use .first() — the settings page has multiple "API Keys" headings at different levels.
    // 15s timeout: the api-keys query fires after /me resolves (isOwner gate), so it can start
    // slightly after networkidle fires in beforeEach.
    await expect(page.getByText('API Keys', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('webhooks section visible for super admin', async ({ page }) => {
    await expect(page.getByText('Webhooks', { exact: true })).toBeVisible({ timeout: 8_000 });
  });
});
