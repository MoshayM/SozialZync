/**
 * Capture browser console errors from the live site to diagnose the Application error crash.
 */
import pkg from '../node_modules/.pnpm/@playwright+test@1.61.1/node_modules/@playwright/test/index.js';
const { chromium } = pkg;

const BASE = 'https://sozialzync.vercel.app';
const VIEWPORT = { width: 390, height: 844 };

async function diagnose(browser, url, label) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  // Set auth tokens before navigation (via a blank page)
  await page.goto('about:blank');
  await page.evaluate(() => {
    localStorage.setItem('cf_token', 'demo-token');
    localStorage.setItem('cf_refresh', 'demo-refresh');
    localStorage.setItem('cf_plan', 'pro');
    localStorage.setItem('cf_role', 'owner');
    localStorage.setItem('cf_credit_pro_active', 'true');
    localStorage.setItem('pwa_banner_dismissed', '1');
  }).catch(() => {});

  // Mock API
  await page.route('**/api/proxy/**', async (route) => {
    const path = route.request().url().replace(/.*\/api\/proxy/, '');
    if (path.startsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'usr_demo', email: 'ethonanpasumvalki@gmail.com', name: 'Ethonan P',
        role: 'OWNER', plan: 'PRO', avatarUrl: null,
      })});
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[],"total":0}' });
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    errors.push('LOAD_ERROR: ' + e.message);
  }

  console.log(`\n=== ${label} (${url}) ===`);
  if (errors.length === 0) {
    console.log('  ✓ No console errors');
  } else {
    errors.forEach(e => console.log('  ✗ ' + e));
  }

  await ctx.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  await diagnose(browser, BASE + '/home', 'Dashboard /home');
  await diagnose(browser, BASE + '/login', 'Login page');
  await diagnose(browser, BASE + '/', 'Landing page');
  await browser.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
