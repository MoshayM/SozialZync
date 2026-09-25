// Refresh stored auth state — opens browser for Google login, saves new JWT
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const AUTH_FILE = path.join(__dirname, 'e2e', '.auth.json');
const BASE = 'https://sozialzynk.vercel.app';

(async () => {
  console.log('Opening browser for login...');
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  console.log('\n================================================');
  console.log('ACTION REQUIRED: Please log in with Google in the browser window.');
  console.log('Waiting up to 2 minutes for you to complete login...');
  console.log('================================================\n');

  // Wait until the JWT appears in localStorage (means login is complete)
  try {
    // arg must be null/undefined as second param, options as third
    await page.waitForFunction(
      () => !!localStorage.getItem('cf_token'),
      undefined,
      { timeout: 180_000, polling: 1500 }
    );
  } catch {
    console.error('Timed out waiting for login. Please try again.');
    await browser.close();
    return;
  }

  const token = await page.evaluate(() => localStorage.getItem('cf_token'));
  const refreshToken = await page.evaluate(() => localStorage.getItem('cf.refreshToken'));
  const currentUrl = page.url();

  console.log('Login detected! JWT present.');
  console.log('Current URL:', currentUrl);

  // Decode JWT to confirm identity
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    console.log('Logged in as:', payload.email, '| role:', payload.role);
    const expiresAt = new Date(payload.exp * 1000);
    console.log('Token expires:', expiresAt.toISOString());
  } catch { /* ignore decode errors */ }

  // Save storage state to .auth.json
  await ctx.storageState({ path: AUTH_FILE });
  console.log(`\nAuth state saved to: ${AUTH_FILE}`);

  await browser.close();
  console.log('\nDone. You can now run the connect tests.\n');
})();
