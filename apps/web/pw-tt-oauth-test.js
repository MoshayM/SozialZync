const path = require('path');
const fs = require('fs');
const https = require('https');

const AUTH_FILE = path.join(__dirname, 'e2e', '.auth.json');
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
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
}

(async () => {
  const stored = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const jwt = stored.origins[0].localStorage.find(e => e.name === 'cf_token').value;

  // ── 1. API endpoint ───────────────────────────────────────────────────────
  console.log('\n── Step 1: Test /platforms/tiktok/auth-url API ──');
  const r = await apiGet('/platforms/tiktok/auth-url?returnTo=/publishing/accounts', jwt);
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
    log('URL is tiktok.com/v2/auth', u.hostname.includes('tiktok.com'), u.hostname + u.pathname);

    const clientKey = u.searchParams.get('client_key');
    const redirect  = u.searchParams.get('redirect_uri');
    const scope     = u.searchParams.get('scope');
    const stateRaw  = u.searchParams.get('state');
    const respType  = u.searchParams.get('response_type');

    // Critical check — client_key empty means env var not set
    const clientKeySet = !!clientKey && clientKey.trim() !== '';
    log('client_key set (TIKTOK_CLIENT_KEY env var)', clientKeySet, clientKey ? `"${clientKey}"` : '⚠️  EMPTY — env var missing on Railway');
    log('redirect_uri → /tiktok/callback', redirect?.includes('/tiktok/callback') ?? false, redirect ?? 'MISSING');
    log('scope: user.info.basic', scope?.includes('user.info.basic') ?? false, scope ?? 'MISSING');
    log('scope: video.list', scope?.includes('video.list') ?? false);
    log('scope: video.publish', scope?.includes('video.publish') ?? false);
    log('response_type=code', respType === 'code', respType ?? 'MISSING');

    if (stateRaw) {
      try {
        const decoded = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
        log('state.userId from JWT', !!decoded.userId, decoded.userId ?? 'MISSING');
        log('state.returnTo set', !!decoded.returnTo, decoded.returnTo ?? 'MISSING');
      } catch { log('state decoded', false, 'parse error'); }
    }

    console.log('\n── OAuth URL Parameters ──');
    console.log('full URL    :', authUrl.slice(0, 120));
    console.log('client_key  :', clientKey || '⚠️  EMPTY');
    console.log('redirect_uri:', redirect);
    console.log('scope       :', scope);
    console.log('response_type:', respType);

    if (!clientKeySet) {
      console.log('\n⚠️  ROOT CAUSE: TIKTOK_CLIENT_KEY is not set on Railway.');
      console.log('   TikTok OAuth will fail at the TikTok login page with "invalid_client" error.');
      console.log('   Fix: Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to Railway environment variables.');
    }
  }

  // ── 2. Security checks ────────────────────────────────────────────────────
  console.log('\n── Step 2: Security checks ──');
  const oldRoute = await apiGet('/platforms/tiktok/auth?userId=hacker', jwt);
  log('Old /auth route blocked (404)', oldRoute.status === 404, `HTTP ${oldRoute.status}`);

  const unauth = await apiGet('/platforms/tiktok/auth-url', null);
  log('No JWT → 401', unauth.status === 401, `HTTP ${unauth.status}`);

  // ── 3. UI availability ────────────────────────────────────────────────────
  console.log('\n── Step 3: UI availability ──');
  // Check source code for available flag
  const src = fs.readFileSync(
    path.join(__dirname, 'src', 'components', 'channel-access-panel.tsx'), 'utf8'
  );
  const ttMatch = src.match(/key:\s*'tiktok'[^\}]+available:\s*(true|false)/);
  const ttAvailable = ttMatch?.[1] === 'true';
  log('TikTok Connect button enabled in UI', ttAvailable,
    ttAvailable ? 'available: true' : 'available: false — button hidden from users');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('TIKTOK OAUTH TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${results.length} checks passed`);

  if (results.some(r => !r.pass && r.label.includes('client_key'))) {
    console.log('\n🔧 ACTION REQUIRED:');
    console.log('   1. Get your TikTok Developer App credentials from developers.tiktok.com');
    console.log('   2. Add to Railway: TIKTOK_CLIENT_KEY=<your-client-key>');
    console.log('   3. Add to Railway: TIKTOK_CLIENT_SECRET=<your-client-secret>');
    console.log('   4. Redeploy Railway (git push)');
  }
  console.log('════════════════════════════════════════');
})();
