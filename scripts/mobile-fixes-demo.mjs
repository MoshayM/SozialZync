/**
 * Mobile fix verification screenshots
 * Captures: header (no overflow), project detail (tab bar + stacked layout), copilot hint hidden
 * Run: node scripts/mobile-fixes-demo.mjs
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
const VIEWPORT = { width: 390, height: 844 };   // iPhone 14 / common Android width
const DPR = 3;

async function shot(page, name, desc) {
  await page.screenshot({ path: join(OUT, `fix-${name}.png`), fullPage: false });
  console.log(`  ✓  fix-${name}.png — ${desc}`);
}

async function mockApi(page) {
  await page.route('**/api/proxy/**', async (route) => {
    const url = route.request().url();
    const path = url.replace(/.*\/api\/proxy/, '');

    if (path.startsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'usr_demo', email: 'ethonanpasumvalki@gmail.com', name: 'Ethonan P',
        role: 'ADMIN', plan: 'PRO', avatarUrl: null,
      })});
    }
    if (path.startsWith('/wallet/balance')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        balanceCredits: 1250, lifetimePurchased: 5000, lifetimeUsed: 3750,
      })});
    }
    if (path.startsWith('/projects/demo-project-id')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'demo-project-id',
        title: 'Christian Fun Videos For Kids',
        niche: 'Family Entertainment',
        status: 'ACTIVE',
        billingOrgId: null,
        channel: null,
        jobs: [],
      })});
    }
    if (path.startsWith('/projects')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        data: [{ id: 'demo-project-id', title: 'Christian Fun Videos For Kids', status: 'ACTIVE', niche: 'Family Entertainment' }],
        total: 1,
      })});
    }
    if (path.startsWith('/channels')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0, page: 1, limit: 20 })});
    }
    if (path.startsWith('/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] })});
    }
    if (path.startsWith('/orgs/mine')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([])});
    }
    if (path.startsWith('/copilot') || path.startsWith('/ai/copilot')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] })});
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function setAuth(page, isAdmin = false) {
  await page.evaluate((admin) => {
    localStorage.setItem('cf_token', 'demo-token');
    localStorage.setItem('cf_refresh', 'demo-refresh');
    localStorage.setItem('cf_plan', 'pro');
    localStorage.setItem('cf_role', admin ? 'admin' : 'owner');
    localStorage.setItem('cf_credit_pro_active', 'true');
    localStorage.setItem('pwa_banner_dismissed', '1');
  }, isAdmin);
}

async function main() {
  console.log('\n📱  Mobile Fix Verification (390×844 — common Android width)\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await mockApi(page);

  // ── 1. Dashboard header — ADMIN user, narrow 390px viewport ─────────────────
  console.log('1. Dashboard header (admin user, 390px)');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await setAuth(page, true);   // isAdmin = true
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '01-header-admin-mobile', 'Header — admin on 390px: shield hidden, no overflow');

  // Scroll down to show bottom nav
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(400);
  await shot(page, '02-dashboard-bottom-nav', 'Dashboard with bottom nav visible');

  // ── 2. Project detail page — title stacking + scrollable tab bar ─────────────
  console.log('2. Project detail page');
  await page.goto(`${BASE}/projects/demo-project-id`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-project-detail-top', 'Project detail — title stacks above badges, no overflow');

  // Scroll to show the tab bar
  await page.evaluate(() => window.scrollTo(0, 160));
  await page.waitForTimeout(400);
  await shot(page, '04-project-tabs', 'Tab bar — horizontally scrollable (Pipeline · Script · Storyboard · SEO · Checks)');

  // Scroll the tab bar via JS to show SEO & Checks tabs
  try {
    await page.evaluate(() => {
      const el = document.querySelector('[class*="overflow-x-auto"]');
      if (el) el.scrollLeft = 180;
    });
    await page.waitForTimeout(400);
  } catch { /* ok */ }
  await shot(page, '05-project-tabs-scrolled', 'Tab bar scrolled right — SEO & Audience + Checks visible');

  // ── 3. Copilot — keyboard hint hidden ────────────────────────────────────────
  console.log('3. Copilot panel');
  await page.goto(`${BASE}/copilot`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '06-copilot-no-hint', 'Copilot — "Enter to send" hint hidden on mobile');

  // Open the floating copilot panel via the event
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('cf:open-copilot')));
  await page.waitForTimeout(800);
  await shot(page, '07-copilot-panel-mobile', 'Floating copilot panel — no keyboard hint on mobile');

  await browser.close();
  console.log(`\n✅  Screenshots saved to ./screenshots/ (prefixed fix-)\n`);
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
