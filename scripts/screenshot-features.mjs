/**
 * Feature screenshot capture — Sozialzync new features
 * Run: node scripts/screenshot-features.mjs
 * Output: screenshots/ directory at repo root
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
let shotCount = 0;

async function shot(page, name, description) {
  try {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
    shotCount++;
    console.log(`  ✓  ${name}.png — ${description}`);
  } catch (e) {
    console.log(`  ✗  ${name}.png failed: ${e.message}`);
  }
}

async function tryClick(page, locator, timeout = 5000) {
  try {
    await locator.click({ timeout, force: true });
    await page.waitForTimeout(600);
    return true;
  } catch { return false; }
}

async function main() {
  console.log('\n📸  Sozialzync Feature Screenshots\n');

  const browser = await chromium.launch({ headless: true });

  // ── Desktop context ──────────────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Block API calls to avoid auth redirects from 401s
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    // Allow ipapi.co for IP detection
    if (url.includes('ipapi.co')) { await route.continue(); return; }
    // Mock wallet balance response
    if (url.includes('wallet') && url.includes('balance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balanceCredits: 1250, lifetimePurchased: 5000, lifetimeUsed: 3750, buckets: {} }) });
      return;
    }
    // Mock subscription response
    if (url.includes('subscription')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'Pro', status: 'active', currentPeriodEnd: '2026-08-25T00:00:00Z' }) });
      return;
    }
    // Mock all other API calls with 200 empty
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Inject auth state before page loads
  async function setupAuth(p) {
    await p.evaluate(() => {
      localStorage.setItem('cf_plan', 'pro');
      localStorage.setItem('cf_role', 'superadmin');
      localStorage.setItem('cf_credit_pro_active', 'true');
      localStorage.setItem('cf_user_name', 'Demo Admin');
      // Seed enterprise requests
      const requests = [
        { id: 'req_001', userId: 'u_demo', userName: 'Meera Nair', userEmail: 'meera@brandcraft.in', company: 'BrandCraft Agency', teamSize: '25–50', useCase: 'We manage content for 40+ D2C brands across Instagram, YouTube and LinkedIn. Need white-label, team seats, and custom AI budgets per client.', budget: '$650', status: 'pending', submittedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
        { id: 'req_002', userId: 'u_007', userName: 'Arjun Sharma', userEmail: 'arjun@mediagroup.com', company: 'MediaGroup India', teamSize: '10–25', useCase: 'B2B content agency producing video + social for SaaS clients. Require SLA and custom AI quota per workspace.', budget: '$400', status: 'validating', submittedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      ];
      localStorage.setItem('cf_enterprise_requests', JSON.stringify(requests));
    });
  }

  // ── 1. Landing page ──────────────────────────────────────────────────────────
  console.log('1. Landing page…');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await shot(page, '01-landing-hero', 'Multi-platform landing hero');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(400);
  await shot(page, '02-landing-workflow', 'Landing page workflow section');

  // ── 2. Login page ────────────────────────────────────────────────────────────
  console.log('2. Login page…');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await shot(page, '03-login', 'Login page with Privacy/Terms links');

  // ── 3. Privacy + Terms ───────────────────────────────────────────────────────
  console.log('3. Privacy & Terms pages…');
  await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  await shot(page, '04-privacy', 'Privacy Policy page');

  await page.goto(`${BASE}/terms`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  await shot(page, '05-terms', 'Terms of Service page');

  // ── 4. Wallet page ───────────────────────────────────────────────────────────
  console.log('4. Wallet page…');
  // Navigate to a valid page first to set localStorage
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await setupAuth(page);
  await page.goto(`${BASE}/wallet`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Take screenshot of whatever loaded
  await shot(page, '06-wallet-top', 'Wallet page — financial hero with credit balance');

  // Scroll to SmartTopUp (auto locale detection)
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(800);
  await shot(page, '07-wallet-topup-auto-locale', 'SmartTopUp — auto-detected currency (no manual selector)');

  // Try to click My Plan tab
  const planTabResult = await tryClick(page, page.getByRole('button', { name: /My Plan/i }).first());
  if (planTabResult) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await shot(page, '08-wallet-plan-tab', 'My Plan tab — Enterprise shows Request Access button');

    // Scroll to Enterprise card
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(400);
    await shot(page, '09-wallet-enterprise-card', 'Enterprise plan card with Request Access button');

    // Try to open the enterprise modal
    const reqBtn = page.getByRole('button', { name: /Request.*Access/i }).first();
    if (await tryClick(page, reqBtn)) {
      await page.waitForTimeout(500);
      await shot(page, '10-enterprise-modal-empty', 'Enterprise access request modal — empty');

      // Fill form
      try {
        await page.fill('input[placeholder="Acme Corp"]', 'TechVentures Ltd');
        await page.fill('input[placeholder*="team" i]', '15–30');
        await page.fill('input[placeholder*="budget" i]', '$500');
        await page.fill('textarea', 'We produce content for 20 B2B SaaS clients across LinkedIn and YouTube. Need custom AI budgets per client and team collaboration features.');
        await page.waitForTimeout(400);
        await shot(page, '11-enterprise-modal-filled', 'Enterprise modal — form filled, ready to submit');
      } catch (e) { console.log(`  (form fill skipped: ${e.message})`); }
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // ── 5. Admin — Enterprise Requests tab ───────────────────────────────────────
  console.log('5. Admin — Enterprise Requests…');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await setupAuth(page);
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot(page, '12-admin-dashboard', 'Admin — Enterprise Dashboard tab');

  const entTab = page.getByRole('button', { name: /Enterprise Requests/i });
  if (await tryClick(page, entTab)) {
    await page.waitForTimeout(600);
    await shot(page, '13-admin-enterprise-requests', 'Admin — Enterprise Requests tab with pending count');

    // Expand first request
    const reviewBtn = page.getByRole('button', { name: 'Review' }).first();
    if (await tryClick(page, reviewBtn)) {
      await page.waitForTimeout(500);
      await shot(page, '14-admin-request-expanded', 'Admin — expanded request (status → validating)');

      // Click AI Validate
      const aiBtn = page.getByRole('button', { name: /Validate with AI/i }).first();
      if (await tryClick(page, aiBtn)) {
        await page.waitForTimeout(600);
        await shot(page, '15-admin-ai-validating', 'AI validation in progress');
        await page.waitForTimeout(2500); // wait for mock to complete
        await shot(page, '16-admin-ai-result', 'AI validation — risk score + signals + recommendation');

        // Scroll to approve/reject buttons
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(300);
        await shot(page, '17-admin-approve-reject', 'Approve & Activate Payment / Reject buttons');
      }
    }
  }

  // ── 6. Admin — Page Views ────────────────────────────────────────────────────
  console.log('6. Admin — Page Views…');
  const pvTab = page.getByRole('button', { name: /Page Views/i });
  if (await tryClick(page, pvTab)) {
    await page.waitForTimeout(600);
    await shot(page, '18-admin-page-views', 'Admin — Page Views by platform and plan tier');
  }

  // ── 7. Admin — Users (with impersonation) ───────────────────────────────────
  console.log('7. Admin — Users…');
  const usersTab = page.getByRole('button', { name: /User Accounts/i });
  if (await tryClick(page, usersTab)) {
    await page.waitForTimeout(600);
    await shot(page, '19-admin-users', 'Admin — User Accounts table');
    const viewBtn = page.getByRole('button', { name: /View as/i }).first();
    if (await tryClick(page, viewBtn)) {
      await page.waitForTimeout(400);
      await shot(page, '20-admin-impersonation', 'Admin — Superadmin impersonation active (amber banner)');
    }
  }

  // ── 8. Mobile — wallet ───────────────────────────────────────────────────────
  console.log('8. Mobile viewport…');
  await ctx.close();

  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mob = await mCtx.newPage();
  await mob.route('**/api/**', async (route) => {
    if (route.request().url().includes('balance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balanceCredits: 1250, lifetimePurchased: 5000, lifetimeUsed: 3750, buckets: {} }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  await mob.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mob.evaluate(() => {
    localStorage.setItem('cf_plan', 'pro');
    localStorage.setItem('cf_role', 'superadmin');
    localStorage.setItem('cf_credit_pro_active', 'true');
  });

  await mob.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await mob.waitForTimeout(800);
  await mob.screenshot({ path: join(OUT, '21-mobile-landing.png') });
  console.log('  ✓  21-mobile-landing.png — Mobile landing page');
  shotCount++;

  await mob.goto(`${BASE}/wallet`, { waitUntil: 'networkidle', timeout: 30000 });
  await mob.waitForTimeout(1500);
  await mob.screenshot({ path: join(OUT, '22-mobile-wallet.png') });
  console.log('  ✓  22-mobile-wallet.png — Mobile wallet view');
  shotCount++;

  await mCtx.close();
  await browser.close();

  console.log(`\n✅  ${shotCount} screenshots saved to ./screenshots/\n`);
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
