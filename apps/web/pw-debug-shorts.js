const { chromium } = require('@playwright/test');

const EMAIL = 'sozialzync@gmail.com';
const PASS  = 'Admin@123';
const BASE  = 'https://sozialzynk.vercel.app';
const API   = 'https://sozialzync-api-production.up.railway.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(() => !!localStorage.getItem('cf_token'), undefined, { timeout: 30_000 });
  const token = await page.evaluate(() => localStorage.getItem('cf_token'));
  console.log('[AUTH] ✅ Logged in, token length:', token?.length);

  // Check platforms/connection-status
  const connRes = await page.evaluate(async ({ api, tok }) => {
    const r = await fetch(`${api}/platforms/connection-status`, { headers: { Authorization: `Bearer ${tok}` } });
    const text = await r.text();
    return { status: r.status, body: text.slice(0, 500) };
  }, { api: API, tok: token });
  console.log('[API] /platforms/connection-status →', connRes.status, connRes.body);

  // Try to get channels from the web
  await page.goto(`${BASE}/shorts-studio`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.screenshot({ path: 'pw-debug-shorts-page.png' });
  console.log('[SCREENSHOT] pw-debug-shorts-page.png');

  // Get all links on page
  const links = await page.$$eval('a', els => els.map(e => e.href).filter(h => h.includes('shorts-studio')));
  console.log('[LINKS] Shorts Studio links:', links.slice(0, 10));

  // Get all text content to see what's rendered
  const headings = await page.$$eval('h2, h3, button', els => els.map(e => e.textContent?.trim()).filter(Boolean).slice(0, 20));
  console.log('[DOM] Headings/buttons:', headings);

  await browser.close();
})();
