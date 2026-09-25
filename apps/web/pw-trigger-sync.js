/**
 * Logs in, grabs the JWT from localStorage, lists all channels, and triggers sync on each.
 */
const { chromium } = require('@playwright/test');

const EMAIL = process.env.PW_EMAIL || 'sozialzync@gmail.com';
const PASS  = process.env.PW_PASS  || 'Admin@123';
const BASE  = 'https://sozialzynk.vercel.app';
const API   = 'https://sozialzync-api-production.up.railway.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Logging in…');
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  // Try multiple button selectors
  const btn = page.locator('button[type="submit"], button').filter({ hasText: /sign in|log in|continue/i }).first();
  await btn.click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
  await page.waitForFunction(() => !!localStorage.getItem('cf_token'), { timeout: 10_000 });

  const token = await page.evaluate(() => localStorage.getItem('cf_token'));
  console.log('Got JWT ✓');

  // List channels
  const channelsRes = await page.evaluate(async ({ api, token }) => {
    const r = await fetch(`${api}/api/channels`, { headers: { Authorization: `Bearer ${token}` } });
    return r.json();
  }, { api: API, token });

  console.log('Channels raw:', JSON.stringify(channelsRes).slice(0, 300));

  const channels = Array.isArray(channelsRes) ? channelsRes : (channelsRes.data ?? []);
  if (!channels.length) {
    console.log('No channels found for this user.');
    await browser.close();
    return;
  }

  for (const ch of channels) {
    console.log(`\nTriggering sync for channel: ${ch.displayName} (${ch.id})`);
    const syncRes = await page.evaluate(async ({ api, token, channelId }) => {
      const r = await fetch(`${api}/api/channels/${channelId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: r.status, body: await r.json().catch(() => r.text()) };
    }, { api: API, token, channelId: ch.id });
    console.log(`Sync response (${ch.id}): status=${syncRes.status}`, JSON.stringify(syncRes.body).slice(0, 200));
  }

  await browser.close();
  console.log('\nDone — check Railway logs for progress.');
})();
