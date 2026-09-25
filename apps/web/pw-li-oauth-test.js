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

function apiGet(urlPath, jwt) {
  return new Promise((resolve) => {
    const url = new URL(`${API}${urlPath}`);
    const opts = jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {};
    https.get(url, opts, (res) => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
}

(async () => {
  const stored = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const jwt = stored.origins[0].localStorage.find(e => e.name === 'cf_token').value;

  // ── 1. API: /platforms/linkedin/auth-url ──────────────────────────────────
  console.log('\n── Step 1: Test /platforms/linkedin/auth-url API ──');
  const r = await apiGet('/platforms/linkedin/auth-url?returnTo=/publishing/accounts', jwt);
  console.log('HTTP Status:', r.status);
  log('Returns 200', r.status === 200, `HTTP ${r.status}`);

  let authUrl = '';
  try {
    const parsed = JSON.parse(r.body);
    authUrl = parsed.url ?? '';
    log('Response has url field', !!authUrl, authUrl ? authUrl.slice(0, 80) + '...' : r.body.slice(0, 150));
  } catch (e) {
    log('Response parseable', false, r.body.slice(0, 200));
  }

  if (authUrl) {
    const u = new URL(authUrl);
    log('URL is linkedin.com/oauth', u.hostname.includes('linkedin.com'), u.hostname + u.pathname);

    const clientId = u.searchParams.get('client_id');
    const redirect  = u.searchParams.get('redirect_uri');
    const scope     = u.searchParams.get('scope');
    const stateRaw  = u.searchParams.get('state');
    const respType  = u.searchParams.get('response_type');

    log('client_id set', !!clientId && clientId !== '', clientId ?? 'MISSING');
    log('redirect_uri → /linkedin/callback', redirect?.includes('/linkedin/callback') ?? false, redirect ?? 'MISSING');
    log('scope: openid', scope?.includes('openid') ?? false, scope ?? 'MISSING');
    log('scope: profile', scope?.includes('profile') ?? false);
    log('scope: w_member_social (post permission)', scope?.includes('w_member_social') ?? false);
    log('scope: offline_access (refresh token)', scope?.includes('offline_access') ?? false);
    log('response_type=code', respType === 'code', respType ?? 'MISSING');

    if (stateRaw) {
      try {
        const decoded = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
        log('state.userId from JWT (not query param)', !!decoded.userId, decoded.userId ?? 'MISSING');
        log('state.returnTo set', !!decoded.returnTo, decoded.returnTo ?? 'MISSING');
      } catch { log('state decoded', false, 'parse error'); }
    }

    console.log('\n── OAuth URL Parameters ──');
    console.log('client_id   :', clientId);
    console.log('redirect_uri:', redirect);
    console.log('scope       :', scope);
    console.log('response_type:', respType);
  }

  // ── 2. Check env vars are set (client_id not empty) ───────────────────────
  console.log('\n── Step 2: LinkedIn env var check ──');
  if (authUrl) {
    const u = new URL(authUrl);
    const clientId = u.searchParams.get('client_id');
    log('LINKEDIN_CLIENT_ID is configured', !!clientId && clientId.length > 4, clientId ?? 'empty/missing');
    const redirect = u.searchParams.get('redirect_uri');
    log('LINKEDIN_CLIENT_SECRET implied (redirect_uri set)', !!redirect);
  }

  // ── 3. Security checks ────────────────────────────────────────────────────
  console.log('\n── Step 3: Security checks ──');
  const oldRoute = await apiGet('/platforms/linkedin/auth?userId=hacker', jwt);
  log('Old /auth route blocked (404)', oldRoute.status === 404, `HTTP ${oldRoute.status}`);

  const unauth = await apiGet('/platforms/linkedin/auth-url', null);
  log('No JWT → 401 Unauthorized', unauth.status === 401, `HTTP ${unauth.status}`);

  // ── 4. Browser UI ─────────────────────────────────────────────────────────
  console.log('\n── Step 4: Browser UI — LinkedIn Connect button ──');
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: AUTH_FILE });
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/settings/channels`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'pw-li-01-page.png' });
    log('settings/channels loaded', !page.url().includes('/login'), page.url());

    // Find LinkedIn Connect button
    const connectBtns = await page.locator('button').filter({ hasText: /^connect$/i }).all();
    let liBtn = null;
    for (const btn of connectBtns) {
      if (!await btn.isVisible()) continue;
      const platform = await page.evaluate((el) => {
        let p = el.parentElement;
        for (let i = 0; i < 7; i++) {
          if (!p) break;
          const t = p.textContent ?? '';
          if (t.includes('LinkedIn')) return 'linkedin';
          p = p.parentElement;
        }
        return 'unknown';
      }, await btn.elementHandle());
      if (platform === 'linkedin') { liBtn = btn; break; }
    }

    log('LinkedIn Connect button found', !!liBtn);

    if (liBtn) {
      let capturedUrl = '';
      await page.route('**linkedin.com**', async (route) => {
        capturedUrl = route.request().url();
        await route.abort();
      });

      await liBtn.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: 'pw-li-02-after-click.png' });

      const finalUrl = page.url();
      const onLinkedIn = finalUrl.includes('linkedin.com') || !!capturedUrl;
      const destination = capturedUrl || finalUrl;
      log('Redirected to LinkedIn OAuth', onLinkedIn, destination.slice(0, 80));

      if (onLinkedIn) {
        const raw = decodeURIComponent(destination);
        const redirect = raw.match(/redirect_uri=([^&]+)/)?.[1] ?? '';
        log('redirect_uri → /linkedin/callback', redirect.includes('/linkedin/callback'),
          decodeURIComponent(redirect));
        log('redirect_uri no comma-URL bug', !redirect.includes(','));
      }
    } else {
      // LinkedIn might be marked "coming soon" / disabled in UI
      const liSection = await page.locator('text=LinkedIn').first().isVisible().catch(() => false);
      log('LinkedIn section visible in UI', liSection);
      const comingSoon = await page.locator('text=/coming soon|unavailable|disabled/i').isVisible().catch(() => false);
      log('LinkedIn marked as coming soon', comingSoon, comingSoon ? 'UI shows coming soon' : 'no coming-soon label found');
      await page.screenshot({ path: 'pw-li-02-linkedin-section.png' });
    }

  } catch (err) {
    console.error('Browser error:', err.message);
    await page.screenshot({ path: 'pw-li-error.png' }).catch(() => {});
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('LINKEDIN OAUTH TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log('════════════════════════════════════════');

  await browser.close();
})();
