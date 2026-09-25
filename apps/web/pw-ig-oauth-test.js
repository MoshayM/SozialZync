const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const https = require('https');

const AUTH_FILE = path.join(__dirname, 'e2e', '.auth.json');
const BASE = 'https://sozialzynk.vercel.app';
const API  = 'https://sozialzync-api-production.up.railway.app/api/v1';
const results = [];

function log(label, pass, detail = '') {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, pass, detail });
}

function apiGet(path, jwt) {
  return new Promise((resolve) => {
    const url = new URL(`${API}${path}`);
    const req = https.get(url, { headers: { Authorization: `Bearer ${jwt}` } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
  });
}

(async () => {
  const stored = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const jwt = stored.origins[0].localStorage.find(e => e.name === 'cf_token').value;

  // ── 1. API: /platforms/instagram/auth-url ─────────────────────────────────
  console.log('\n── Step 1: Test /platforms/instagram/auth-url API ──');
  const r = await apiGet('/platforms/instagram/auth-url?returnTo=/publishing/accounts', jwt);
  console.log('HTTP Status:', r.status);
  log('Returns 200', r.status === 200, `HTTP ${r.status}`);

  let authUrl = '';
  try {
    const parsed = JSON.parse(r.body);
    authUrl = parsed.url ?? '';
    log('Response has url field', !!authUrl, authUrl ? authUrl.slice(0, 80) + '...' : r.body.slice(0, 100));
  } catch (e) {
    log('Response parseable', false, r.body.slice(0, 150));
  }

  if (authUrl) {
    const u = new URL(authUrl);
    log('URL is facebook.com (correct for Instagram API)', u.hostname.includes('facebook.com'), u.hostname);
    log('Path is /v19.0/dialog/oauth', u.pathname.includes('dialog/oauth'), u.pathname);

    const clientId  = u.searchParams.get('client_id');
    const redirect  = u.searchParams.get('redirect_uri');
    const scope     = u.searchParams.get('scope');
    const stateRaw  = u.searchParams.get('state');
    const authType  = u.searchParams.get('auth_type');

    log('client_id (Facebook App ID) set', !!clientId && clientId !== '', clientId ?? 'MISSING');
    log('redirect_uri → /instagram/callback', redirect?.includes('/instagram/callback') ?? false, redirect ?? 'MISSING');
    log('scope: instagram_basic', scope?.includes('instagram_basic') ?? false, scope ?? 'MISSING');
    log('scope: instagram_content_publish', scope?.includes('instagram_content_publish') ?? false);
    log('scope: pages_read_engagement', scope?.includes('pages_read_engagement') ?? false);
    log('scope: pages_show_list', scope?.includes('pages_show_list') ?? false);
    log('auth_type=rerequest (re-prompt permissions)', authType === 'rerequest', authType ?? 'missing');

    if (stateRaw) {
      try {
        const decoded = JSON.parse(Buffer.from(stateRaw, 'base64').toString());
        log('state.userId from JWT (not query param)', !!decoded.userId, decoded.userId ?? 'MISSING');
        log('state.returnTo set', !!decoded.returnTo, decoded.returnTo ?? 'MISSING');
      } catch { log('state decoded', false, 'parse error'); }
    }

    console.log('\n── OAuth URL Parameters ──');
    console.log('full URL    :', authUrl.slice(0, 120) + '...');
    console.log('client_id   :', clientId);
    console.log('redirect_uri:', redirect);
    console.log('scope       :', scope);
    console.log('auth_type   :', authType);
  }

  // ── 2. Confirm old /auth route is gone (security check) ──────────────────
  console.log('\n── Step 2: Security — old /platforms/instagram/auth route blocked ──');
  const oldRoute = await apiGet('/platforms/instagram/auth?userId=hacker123', jwt);
  log('Old /auth route returns 404 (blocked)', oldRoute.status === 404, `HTTP ${oldRoute.status}`);

  // ── 3. Unauthenticated request is rejected ────────────────────────────────
  console.log('\n── Step 3: Security — unauthenticated request rejected ──');
  const unauth = await new Promise((resolve) => {
    const url = new URL(`${API}/platforms/instagram/auth-url`);
    https.get(url, (res) => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
  log('No JWT → 401 Unauthorized', unauth.status === 401, `HTTP ${unauth.status}`);

  // ── 4. Browser UI test ────────────────────────────────────────────────────
  console.log('\n── Step 4: Browser UI — settings/channels Instagram connect ──');
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: AUTH_FILE });
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/settings/channels`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'pw-ig-oauth-01-page.png' });
    log('settings/channels loaded', !page.url().includes('/login'), page.url());

    // Find Instagram Connect button
    const connectBtns = await page.locator('button').filter({ hasText: /^connect$/i }).all();
    let igBtn = null;
    for (const btn of connectBtns) {
      if (!await btn.isVisible()) continue;
      const platform = await page.evaluate((el) => {
        let p = el.parentElement;
        for (let i = 0; i < 7; i++) {
          if (!p) break;
          const t = p.textContent ?? '';
          if (t.includes('Instagram')) return 'instagram';
          if (t.includes('Facebook') && !t.includes('Instagram')) return 'facebook';
          p = p.parentElement;
        }
        return 'unknown';
      }, await btn.elementHandle());
      if (platform === 'instagram') { igBtn = btn; break; }
    }

    log('Instagram Connect button found on settings/channels', !!igBtn);

    if (igBtn) {
      // Intercept Facebook OAuth redirect
      let capturedUrl = '';
      await page.route('**facebook.com**', async (route) => {
        capturedUrl = route.request().url();
        await route.abort();
      });

      await igBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'pw-ig-oauth-02-clicked.png' });

      // Check for guide modal
      const modalVisible = await page.locator('h2').filter({ hasText: /Connect Instagram/i }).isVisible({ timeout: 3000 }).catch(() => false);
      log('Guide modal shown', modalVisible);

      if (modalVisible) {
        const ctaText = (await page.locator('button').filter({ hasText: /continue to/i }).first().textContent().catch(() => ''))?.trim();
        log('CTA says "Continue to Instagram"', ctaText?.includes('Instagram') ?? false, `"${ctaText}"`);
        await page.screenshot({ path: 'pw-ig-oauth-03-modal.png' });

        // Click CTA
        await page.locator('button').filter({ hasText: /continue to instagram/i }).first().click().catch(() =>
          page.locator('button').filter({ hasText: /continue to/i }).first().click()
        );
        await page.waitForTimeout(4000);
        await page.screenshot({ path: 'pw-ig-oauth-04-redirect.png' });

        const finalUrl = page.url();
        const onFb = finalUrl.includes('facebook.com') || !!capturedUrl;
        log('Redirected to Facebook OAuth (correct for Instagram)', onFb,
          (capturedUrl || finalUrl).slice(0, 80));

        if (finalUrl.includes('facebook.com')) {
          const raw = decodeURIComponent(finalUrl);
          const redirectUri = raw.match(/redirect_uri=([^&]+)/)?.[1] ?? '';
          log('redirect_uri → /instagram/callback (not /facebook)', redirectUri.includes('/instagram/callback'),
            decodeURIComponent(redirectUri));
          log('redirect_uri NOT comma-URL (WEB_URL bug fixed)', !redirectUri.includes(','));
        }
      }
    }
  } catch (err) {
    console.error('Browser error:', err.message);
    await page.screenshot({ path: 'pw-ig-oauth-error.png' }).catch(() => {});
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('INSTAGRAM OAUTH TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log('════════════════════════════════════════');

  await browser.close();
})();
