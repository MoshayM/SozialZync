/**
 * Mobile demo screenshots — iPhone 15 Pro Max viewport
 * Run: node scripts/mobile-demo.mjs
 */
import pkg from '../node_modules/.pnpm/@playwright+test@1.61.1/node_modules/@playwright/test/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://sozialzync.vercel.app';

// iPhone 15 Pro Max logical dimensions
const VIEWPORT = { width: 430, height: 932 };
const DPR = 3;

async function shot(page, name, desc) {
  await page.screenshot({ path: join(OUT, `m-${name}.png`), fullPage: false });
  console.log(`  ✓  m-${name}.png — ${desc}`);
}

// Intercept API calls to return realistic data for authenticated pages
async function mockApi(page) {
  // Browser calls /api/proxy/* (Next.js server route) which forwards to Railway
  await page.route('**/api/proxy/**', async (route) => {
    const url = route.request().url();
    const path = url.replace(/.*\/api\/proxy/, '');

    if (path.startsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'usr_demo', email: 'ethonanpasumvalki@gmail.com', name: 'Ethonan P',
        role: 'OWNER', plan: 'PRO', avatarUrl: null,
      })});
    }
    if (path.startsWith('/wallet/balance')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        balanceCredits: 1250, lifetimePurchased: 5000, lifetimeUsed: 3750,
      })});
    }
    if (path.startsWith('/channels')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        data: [], total: 0, page: 1, limit: 20,
      })});
    }
    if (path.startsWith('/projects')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        data: [], total: 0,
      })});
    }
    if (path.startsWith('/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] })});
    }
    if (path.startsWith('/auth/providers')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        google: false, apple: false, facebook: false,
      })});
    }
    // Suppress ipapi.co (not our API)
    if (url.includes('ipapi.co')) return route.continue();
    // Default: empty success
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function setAuth(page) {
  await page.evaluate(() => {
    localStorage.setItem('cf_token', 'demo-token');
    localStorage.setItem('cf_refresh', 'demo-refresh');
    localStorage.setItem('cf_plan', 'pro');
    localStorage.setItem('cf_role', 'owner');
    localStorage.setItem('cf_credit_pro_active', 'true');
    localStorage.setItem('pwa_banner_dismissed', '0'); // show the banner
  });
}

async function main() {
  console.log('\n📱  Sozialzync Mobile Demo Screenshots (iPhone 15 Pro Max)\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await mockApi(page);

  // ── 1. Landing page ──────────────────────────────────────────────────────────
  console.log('1. Landing page');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, '01-landing', 'Landing page hero on mobile');

  // Scroll down to show features
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(400);
  await shot(page, '02-landing-features', 'Landing page features section');

  // ── 2. Login page ────────────────────────────────────────────────────────────
  console.log('2. Login page');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await shot(page, '03-login', 'Login page — mobile form only');

  // ── 3. Dashboard (authenticated) ────────────────────────────────────────────
  console.log('3. Dashboard');
  // Navigate to base to set localStorage, then go to home
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await setAuth(page);
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '04-dashboard', 'Dashboard — AI Copilot + bottom nav');

  // ── 4. PWA install banner ────────────────────────────────────────────────────
  console.log('4. PWA install banner');
  // Trigger the beforeinstallprompt event to show banner
  await page.evaluate(() => {
    localStorage.removeItem('pwa_banner_dismissed');
    // Fire a fake beforeinstallprompt event to show our custom banner
    const event = new Event('beforeinstallprompt');
    Object.defineProperty(event, 'preventDefault', { value: () => {} });
    Object.defineProperty(event, 'prompt', { value: async () => {} });
    Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await page.waitForTimeout(600);
  await shot(page, '05-pwa-banner', 'PWA install banner — properly positioned, closeable');

  // Scroll to show the banner isn't clipped
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  await shot(page, '06-pwa-banner-scroll', 'PWA install banner visible while scrolled');

  // ── 5. Wallet page ───────────────────────────────────────────────────────────
  console.log('5. Wallet page');
  await page.goto(`${BASE}/wallet`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '07-wallet-top', 'Wallet — Financial Hero with Pro badge + 1,250 credits');

  // Scroll to top-up section
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(600);
  await shot(page, '08-wallet-topup', 'SmartTopUp — auto-detected currency, no manual selector');

  // Try to click My Plan tab
  try {
    const planTab = page.getByRole('button', { name: /My Plan/i }).first();
    await planTab.click({ timeout: 3000, force: true });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, '09-wallet-plans', 'My Plan tab — credit-based access tiers');

    // Scroll to see all 3 cards
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(400);
    await shot(page, '10-wallet-enterprise', 'Enterprise card — Request Access flow');
  } catch { console.log('  (My Plan tab skipped)'); }

  // ── 6. Bottom navigation ─────────────────────────────────────────────────────
  console.log('6. Bottom nav on various pages');
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, '11-bottom-nav', 'Bottom navigation bar — 5 tabs');

  await browser.close();
  console.log(`\n✅  Screenshots saved to ./screenshots/ (prefixed m-)\n`);
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
