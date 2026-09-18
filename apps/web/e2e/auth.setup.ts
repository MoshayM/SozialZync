/**
 * One-time auth setup — logs in once and saves storageState to e2e/.auth.json.
 * All authenticated tests use this file via test.use({ storageState: 'e2e/.auth.json' }).
 */
import { test as setup } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth.json');

const EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 35_000 });
  // Save auth state (cookies + localStorage, including the JWT)
  await page.context().storageState({ path: AUTH_FILE });
});
