const { chromium } = require('@playwright/test');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'e2e', '.auth.json');
const BASE = 'https://sozialzynk.vercel.app';
const API  = 'https://sozialzync-api-production.up.railway.app/api/v1';
const results = [];

function log(label, pass, detail = '') {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, pass, detail });
}

(async () => {
  // ── 1. Test API endpoint directly ─────────────────────────────────────────
  console.log('\n── Step 1: Test /channels/auth-url API directly ──');
  const fs = require('fs');
  const https = require('https');

  const stored = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const jwt = stored.origins[0].localStorage.find(e => e.name === 'cf_token').value;

  const apiResult = await new Promise((resolve) => {
    const url = new URL(`${API}/channels/auth-url?access=PUBLISH&returnTo=/publishing/accounts`);
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${jwt}` }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
  });

  console.log('Status:', apiResult.status);
  log('/channels/auth-url returns 200', apiResult.status === 200, `HTTP ${apiResult.status}`);

  let authUrl = '';
  try {
    const parsed = JSON.parse(apiResult.body);
    authUrl = parsed.url ?? parsed.authUrl ?? '';
    log('Response has url field', !!authUrl, authUrl ? authUrl.slice(0, 80) + '...' : 'MISSING');

    if (authUrl) {
      const u = new URL(authUrl);
      log('URL is accounts.google.com', u.hostname === 'accounts.google.com', u.hostname);
      log('scope includes youtube', u.searchParams.get('scope')?.includes('youtube') ?? false,
        u.searchParams.get('scope') ?? 'MISSING');
      log('access_type=offline (refresh token)', u.searchParams.get('access_type') === 'offline',
        u.searchParams.get('access_type') ?? 'MISSING');
      log('redirect_uri set', !!u.searchParams.get('redirect_uri'),
        u.searchParams.get('redirect_uri') ?? 'MISSING');
      const state = u.searchParams.get('state');
      log('state param present', !!state, state ? state.slice(0, 40) + '...' : 'MISSING');

      console.log('\n── OAuth URL Parameters ──');
      console.log('client_id    :', u.searchParams.get('client_id'));
      console.log('redirect_uri :', u.searchParams.get('redirect_uri'));
      console.log('scope        :', u.searchParams.get('scope'));
      console.log('access_type  :', u.searchParams.get('access_type'));
      console.log('response_type:', u.searchParams.get('response_type'));
    }
  } catch (e) {
    console.log('Parse error:', e.message, '| Body:', apiResult.body.slice(0, 200));
    log('Response parseable', false, e.message);
  }

  // ── 2. Test via browser UI ─────────────────────────────────────────────────
  console.log('\n── Step 2: Test YouTube Connect via browser UI ──');
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: AUTH_FILE });
  const page = await ctx.newPage();

  try {
    // Try settings/channels page (has YouTube connect)
    await page.goto(`${BASE}/settings/channels`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'pw-yt-01-channels.png' });

    const onApp = !page.url().includes('/login');
    log('Auth valid on settings/channels', onApp, page.url());

    // Find YouTube Connect / Add via Google button
    console.log('\nLooking for YouTube connect button...');
    const allBtns = await page.locator('button, a').all();
    for (const btn of allBtns) {
      const txt = (await btn.textContent().catch(() => '')).trim();
      if (txt) console.log(' -', txt.slice(0, 60));
    }

    // Look for "Add via Google", "Connect YouTube", "Connect with Google"
    const ytBtn = page.locator('button, a').filter({
      hasText: /Add via Google|Connect.*YouTube|Connect.*Google|Sign in with Google/i
    }).first();

    const ytBtnVisible = await ytBtn.isVisible().catch(() => false);
    log('YouTube connect button found', ytBtnVisible,
      ytBtnVisible ? await ytBtn.textContent() : 'not found');

    if (ytBtnVisible) {
      // Intercept navigation to Google
      let capturedGoogleUrl = '';
      await page.route('**accounts.google.com**', async (route) => {
        capturedGoogleUrl = route.request().url();
        await route.abort();
      });

      await ytBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'pw-yt-02-after-click.png' });

      const finalUrl = page.url();
      const onGoogle = finalUrl.includes('accounts.google.com') || !!capturedGoogleUrl;
      log('Redirected to Google OAuth', onGoogle,
        capturedGoogleUrl ? capturedGoogleUrl.slice(0, 80) : finalUrl.slice(0, 80));
    }

    // Also check publishing/accounts for YouTube channel list
    console.log('\n── Step 3: Check YouTube channels listed ──');
    await page.goto(`${BASE}/publishing/accounts`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'pw-yt-03-pub-accounts.png' });

    const hasChannelTitle = await page.locator('text=/YouTube|channel/i').first().isVisible().catch(() => false);
    log('YouTube section visible on publishing/accounts', hasChannelTitle);

    // Check if any channels are connected (from the sync we did earlier)
    const channelNames = await page.locator('[class*="channel"], [class*="card"]').allTextContents();
    console.log('Channel content found:', channelNames.slice(0, 3).map(t => t.slice(0, 60)));

  } catch (err) {
    console.error('Browser test error:', err.message);
    await page.screenshot({ path: 'pw-yt-error.png' }).catch(() => {});
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('YOUTUBE OAUTH TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log('════════════════════════════════════════');

  await browser.close();
})();
