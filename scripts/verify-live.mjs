/**
 * Verify the live site renders without crashing — 390px Android viewport, full mock
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
const VP = { width: 390, height: 844 };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VP, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Mock auth + API
  await page.route('**/api/proxy/**', async route => {
    const p = route.request().url().replace(/.*\/api\/proxy/, '');
    if (p.startsWith('/auth/me'))       return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ id:'u1', email:'ethonanpasumvalki@gmail.com', name:'Ethonan P', role:'OWNER', plan:'PRO', avatarUrl:null }) });
    if (p.startsWith('/wallet/balance'))return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ balanceCredits:1250, lifetimePurchased:5000, lifetimeUsed:3750 }) });
    if (p.startsWith('/projects'))      return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data:[{ id:'p1', title:'Christian Fun Videos', status:'ACTIVE', niche:'Family', _count:{ videos:3, jobs:7 }, updatedAt: new Date().toISOString() }], total:1 }) });
    if (p.startsWith('/channels'))      return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data:[], total:0, page:1, limit:20 }) });
    if (p.startsWith('/notifications')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data:[] }) });
    if (p.startsWith('/trial/status'))  return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ hasTrial:false }) });
    if (p.startsWith('/automation'))    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ enabled:false }) });
    return route.fulfill({ status:200, contentType:'application/json', body:'{}' });
  });

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('cf_token','demo-token');
    localStorage.setItem('cf_refresh','demo-refresh');
    localStorage.setItem('cf_plan','pro');
    localStorage.setItem('cf_role','owner');
    localStorage.setItem('cf_credit_pro_active','true');
    localStorage.setItem('pwa_banner_dismissed','1');
  });

  await page.goto(`${BASE}/home`, { waitUntil:'networkidle', timeout:30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, 'live-01-home.png'), fullPage:false });
  console.log(errors.length === 0 ? '✓ /home — no errors' : '✗ /home errors: ' + errors.join('; '));

  // Scroll down
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'live-02-home-scroll.png'), fullPage:false });

  // Project detail
  errors.length = 0;
  await page.route('**/api/proxy/projects/p1**', async route =>
    route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ id:'p1', title:'Christian Fun Videos', niche:'Family Entertainment', status:'ACTIVE', billingOrgId:null, channel:null, jobs:[] }) })
  );
  await page.goto(`${BASE}/projects/p1`, { waitUntil:'networkidle', timeout:30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, 'live-03-project-detail.png'), fullPage:false });
  console.log(errors.length === 0 ? '✓ /projects/p1 — no errors' : '✗ project errors: ' + errors.join('; '));

  await browser.close();
  console.log('\nDone. Check screenshots/live-*.png');
}
main().catch(e => { console.error(e.message); process.exit(1); });
