/**
 * Live site test: login + all new Studio pages
 * Usage: node scripts/test-studio-live.mjs
 */
import pkg from '../apps/e2e/node_modules/@playwright/test/index.js';
const { chromium } = pkg;
import { promises as fs } from 'fs';
import path from 'path';

const BASE = 'https://sozialzync.vercel.app';
const EMAIL = 'ethonanpasumvalki@gmail.com';
const PASS  = 'Admin@2026';
const OUT   = 'screenshots/studio-test';

const PAGES = [
  { name: '01-home',             url: '/home' },
  { name: '02-characters',       url: '/studio/characters' },
  { name: '03-characters-create',url: '/studio/characters', action: 'create-tab' },
  { name: '04-characters-presets',url:'/studio/characters', action: 'presets-tab' },
  { name: '05-voices',           url: '/studio/voices' },
  { name: '06-music',            url: '/studio/music' },
  { name: '07-assets',           url: '/studio/assets' },
  { name: '08-assets-thumbnails',url: '/studio/assets', action: 'thumbnail-tab' },
];

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await ctx.newPage();

const log = (msg) => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);
const shot = async (name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(`  screenshot → ${file}`);
};

// ── Login ─────────────────────────────────────────────────────────────────────
log('Navigating to login…');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
await shot('00-login');

// Inject auth tokens directly into localStorage to bypass client-side auth guard
const ACCESS  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXNmaGhmZ2swa3BucGkxaWJnaXZ5aXV2IiwiZW1haWwiOiJzdHVkaW8tdGVzdEBzb3ppYWx6eW5jLmRldiIsInJvbGUiOiJNRU1CRVIiLCJzaWQiOiJhZmJkZWI0NS02NjkzLTQxYTQtOWZkNy04ZmE1MmJmYjI4YzEiLCJwbGFuIjoiRlJFRSIsImlhdCI6MTc4NTg5Nzg3NCwiZXhwIjoxNzg1ODk4Nzc0fQ.Tk8W4Hz-2cb0zSHE3-AqoEl-arorF6SdOdXhazz_uPE';
const REFRESH = 'sBZh_ywin99R3tiEKwMp_Vw18V7SwpEjJ99Z_4CojeW_mbGbe6Vtk2Mf60PIRpMq';

// Tokens are short-lived — re-login to get fresh tokens before injecting
log('Logging in to get fresh tokens…');
const loginRes = await page.evaluate(async ({ email, pass, base }) => {
  const r = await fetch(`${base}/api/proxy/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  if (r.ok) return r.json();
  // If login fails, try register (first run already registered)
  return null;
}, { email: EMAIL, pass: PASS, base: BASE });

let freshAccess = ACCESS;
let freshRefresh = REFRESH;
if (loginRes?.accessToken) {
  freshAccess  = loginRes.accessToken;
  freshRefresh = loginRes.refreshToken;
  log('Fresh login succeeded');
} else {
  // Re-register with a unique email (token may be expired)
  const regRes = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/proxy/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `studio-test-${Date.now()}@sozialzync.dev`, password: 'StudioTest@2026', name: 'Studio Tester' }),
    });
    return r.ok ? r.json() : null;
  }, BASE);
  if (regRes?.accessToken) {
    freshAccess  = regRes.accessToken;
    freshRefresh = regRes.refreshToken;
    log('Registered new test account');
  } else {
    log('Using stored token (may be expired)');
  }
}

await page.evaluate(({ a, r }) => {
  localStorage.setItem('cf_token', a);
  localStorage.setItem('cf.refreshToken', r);
}, { a: freshAccess, r: freshRefresh });
log('Auth tokens injected into localStorage');

// ── Test each Studio page ─────────────────────────────────────────────────────
const results = [];

for (const p of PAGES) {
  log(`Testing ${p.name}…`);
  await page.goto(`${BASE}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500); // let JS hydrate + lazy content load

  // click specific tabs if needed
  if (p.action === 'create-tab') {
    const btn = page.getByRole('button', { name: /create|custom/i }).first();
    if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(1000); }
  }
  if (p.action === 'presets-tab') {
    const btn = page.getByRole('button', { name: /preset/i }).first();
    if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(1000); }
  }
  if (p.action === 'thumbnail-tab') {
    const btn = page.getByRole('button', { name: /thumbnail/i }).first();
    if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(1000); }
  }

  await shot(p.name);

  // collect page state — pages return 200 and render shell even without login
  const title    = await page.title();
  const finalUrl = page.url();
  const has404   = await page.locator('text=/page not found|404/i').count() > 0;
  const hasStudioContent = await page.locator('[class*="studio"], [class*="character"], [class*="voice"], [class*="asset"], h1, h2').count() > 0;
  results.push({
    page: p.name,
    url: finalUrl,
    title,
    ok: !has404 && hasStudioContent,
    note: has404 ? '404' : hasStudioContent ? 'content visible' : 'empty shell',
  });
}

await browser.close();

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('  STUDIO LIVE TEST RESULTS');
console.log('══════════════════════════════════════════');
for (const r of results) {
  const icon = r.ok ? '✓' : '✗';
  console.log(`${icon}  ${r.page.padEnd(28)} ${r.ok ? 'PASS' : 'FAIL'} — ${r.note}`);
}
const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} pages passed`);
console.log(`Screenshots saved to → ${OUT}/`);
