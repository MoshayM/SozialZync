const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const AUTH_FILE = path.join(__dirname, 'e2e', '.auth.json');
const BASE = 'https://sozialzynk.vercel.app';
const results = [];

function log(label, pass, detail = '') {
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, pass, detail });
}

async function ensureAuth(browser) {
  // Try stored state first
  try {
    const stored = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    const tok = stored?.origins?.[0]?.localStorage?.find(e => e.name === 'cf_token')?.value;
    if (tok) {
      const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
      const secsLeft = payload.exp - Math.floor(Date.now() / 1000);
      if (secsLeft > 300) {
        console.log(`Stored token valid for ${Math.round(secsLeft / 60)} more minutes.`);
        return browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: AUTH_FILE });
      }
      console.log('Stored token expired. Opening browser for fresh login...');
    }
  } catch { console.log('No valid auth file. Opening browser for fresh login...'); }

  // Need fresh login
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  ACTION: Log in with Google in the browser  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  await page.waitForFunction(() => !!localStorage.getItem('cf_token'), undefined, { timeout: 180_000, polling: 1500 });
  await ctx.storageState({ path: AUTH_FILE });
  const tok = await page.evaluate(() => localStorage.getItem('cf_token'));
  const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
  console.log(`Logged in as: ${p.email} | expires: ${new Date(p.exp * 1000).toISOString()}`);
  await page.close();
  return ctx;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });

  let ctx;
  try {
    ctx = await ensureAuth(browser);
  } catch (e) {
    console.error('Login failed or timed out:', e.message);
    await browser.close();
    return;
  }

  const page = await ctx.newPage();

  try {
    // ── 1. Load publishing/accounts ────────────────────────────────────────
    console.log('\n── Step 1: Load publishing/accounts ──');
    await page.goto(`${BASE}/publishing/accounts`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const onApp = !page.url().includes('/login') && !page.url().includes('google.com');
    log('Auth valid — on accounts page', onApp, page.url());
    if (!onApp) { console.error('Auth failed'); await browser.close(); return; }

    await page.screenshot({ path: 'pw-fb-01-page.png' });

    // ── 2. Find & click Facebook Connect ──────────────────────────────────
    console.log('\n── Step 2: Find Facebook Connect button ──');

    const connectBtns = await page.locator('button').filter({ hasText: /^connect$/i }).all();
    console.log(`Found ${connectBtns.length} Connect buttons`);

    let clicked = false;
    for (const btn of connectBtns) {
      if (!await btn.isVisible()) continue;
      const platform = await page.evaluate((el) => {
        let p = el.parentElement;
        for (let i = 0; i < 7; i++) {
          if (!p) break;
          const t = p.textContent ?? '';
          if (t.includes('Facebook') && !t.includes('Instagram')) return 'facebook';
          if (t.includes('Instagram')) return 'instagram';
          p = p.parentElement;
        }
        return 'unknown';
      }, await btn.elementHandle());

      if (platform === 'facebook') {
        await btn.click();
        clicked = true;
        console.log('Clicked Facebook Connect');
        break;
      }
    }

    if (!clicked) {
      // Fallback: container search
      const fbContainers = await page.locator('div, li, section').filter({ hasText: /^Facebook/ }).all();
      for (const c of fbContainers) {
        const btn = c.locator('button').filter({ hasText: /connect/i }).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click(); clicked = true; break;
        }
      }
    }

    log('Clicked Facebook Connect button', clicked);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'pw-fb-02-after-click.png' });

    // ── 3. Guide modal ─────────────────────────────────────────────────────
    console.log('\n── Step 3: Guide modal ──');
    const modalH2 = page.locator('h2').filter({ hasText: /Connect Facebook/i });
    const modalVisible = await modalH2.isVisible({ timeout: 4000 }).catch(() => false);
    log('Guide modal appeared', modalVisible);
    await page.screenshot({ path: 'pw-fb-03-modal.png' });

    if (modalVisible) {
      // Check content
      const hasPageReq = await page.locator('text=/Facebook Page/i').isVisible().catch(() => false);
      log('Facebook Page prereq shown', hasPageReq);

      const ctaBtn = page.locator('button').filter({ hasText: /continue to/i }).first();
      const ctaText = await ctaBtn.isVisible().catch(() => false)
        ? (await ctaBtn.textContent())?.trim() ?? '' : '';
      log('CTA found', !!ctaText, `"${ctaText}"`);
      log('CTA says "Continue to Facebook"', ctaText.includes('Facebook'), `"${ctaText}"`);

      // ── 4. Click CTA → should land on facebook.com ─────────────────────
      console.log('\n── Step 4: Click CTA and verify redirect ──');
      if (ctaText) await ctaBtn.click();

      // Wait for redirect to facebook.com (up to 8s)
      await page.waitForFunction(
        () => window.location.hostname.includes('facebook.com'),
        undefined,
        { timeout: 8000 }
      ).catch(() => {});

      const finalUrl = page.url();
      console.log('\nFinal URL:', finalUrl.slice(0, 200));
      await page.screenshot({ path: 'pw-fb-04-facebook-dialog.png' });

      const onFacebook = finalUrl.includes('facebook.com');
      log('Redirected to facebook.com OAuth', onFacebook);

      if (onFacebook) {
        // Parse OAuth params from the URL
        // Facebook wraps the actual OAuth dialog URL in a `next` param
        const raw = decodeURIComponent(finalUrl);
        const clientIdMatch = raw.match(/client_id=([^&]+)/);
        const redirectUriMatch = raw.match(/redirect_uri=([^&]+)/);
        const scopeMatch = raw.match(/scope=([^&]+)/);
        const stateMatch = raw.match(/state=([^&]+)/);
        const apiKeyMatch = raw.match(/api_key=([^&]+)/);

        const clientId = clientIdMatch?.[1] ?? apiKeyMatch?.[1] ?? null;
        const redirectUri = redirectUriMatch ? decodeURIComponent(redirectUriMatch[1]) : null;
        const scope = scopeMatch ? decodeURIComponent(scopeMatch[1]) : null;
        const stateRaw = stateMatch ? decodeURIComponent(stateMatch[1]) : null;

        log('client_id present', !!clientId, clientId ?? 'MISSING');
        log('redirect_uri → /facebook/callback', redirectUri?.includes('/facebook/callback') ?? false, redirectUri ?? 'MISSING');
        log('scope: pages_manage_posts', scope?.includes('pages_manage_posts') ?? false, scope ?? 'MISSING');
        log('scope: pages_read_engagement', scope?.includes('pages_read_engagement') ?? false);
        log('scope: pages_show_list', scope?.includes('pages_show_list') ?? false);

        if (stateRaw) {
          try {
            const decoded = JSON.parse(Buffer.from(stateRaw.split('#')[0], 'base64').toString());
            log('state.userId from JWT', !!decoded.userId, decoded.userId ?? 'MISSING');
            log('state.returnTo set', !!decoded.returnTo, decoded.returnTo ?? 'MISSING');
          } catch { log('state decoded', false, 'parse error'); }
        }

        console.log('\n── OAuth Parameters ──');
        console.log('client_id   :', clientId);
        console.log('redirect_uri:', redirectUri);
        console.log('scope       :', scope);

        // ── 5. Check this is NOT using wrong callback ─────────────────────
        log('redirect_uri NOT instagram callback (correct)', !redirectUri?.includes('instagram'), redirectUri ?? '');
        log('redirect_uri NOT comma-URL (WEB_URL bug fixed)', !(redirectUri?.includes(',') ?? false));
      }
    }

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: 'pw-fb-error.png' }).catch(() => {});
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('FACEBOOK CONNECT TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log('════════════════════════════════════════');

  await browser.close();
})();
