// Test: Facebook Connect flow on publishing/accounts page
const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: path.join(__dirname, 'e2e', '.auth.json'),
  });
  const page = await ctx.newPage();

  const BASE = 'https://sozialzynk.vercel.app';
  const results = [];

  function log(label, pass, detail = '') {
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
    results.push({ label, pass, detail });
  }

  try {
    // ── 1. Load page ───────────────────────────────────────────────────────
    console.log('\n── Step 1: Load publishing/accounts ──');
    await page.goto(`${BASE}/publishing/accounts`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const isOnApp = !page.url().includes('/login') && !page.url().includes('google.com');
    log('Auth valid — on accounts page', isOnApp, page.url());
    if (!isOnApp) { console.error('Not authenticated'); await browser.close(); return; }

    await page.screenshot({ path: 'pw-fb-01-accounts-page.png' });

    // ── 2. Find Facebook Connect button ────────────────────────────────────
    console.log('\n── Step 2: Find Facebook Connect button ──');

    const allBtns = await page.locator('button').all();
    console.log(`Total buttons: ${allBtns.length}`);

    let clicked = false;
    const connectBtns = await page.locator('button').filter({ hasText: /^connect$/i }).all();
    console.log(`"Connect" buttons: ${connectBtns.length}`);

    for (let i = 0; i < connectBtns.length; i++) {
      const btn = connectBtns[i];
      if (!await btn.isVisible()) continue;
      const nearPlatform = await page.evaluate((el) => {
        let p = el.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!p) break;
          const t = p.textContent ?? '';
          if (t.includes('Facebook') && !t.includes('Instagram')) return 'facebook';
          if (t.includes('Instagram')) return 'instagram';
          if (t.includes('TikTok')) return 'tiktok';
          if (t.includes('LinkedIn')) return 'linkedin';
          p = p.parentElement;
        }
        return 'unknown';
      }, await btn.elementHandle());

      console.log(`  Connect btn ${i}: near="${nearPlatform}"`);

      if (nearPlatform === 'facebook') {
        await btn.click();
        clicked = true;
        console.log('Clicked Facebook Connect button');
        break;
      }
    }

    if (!clicked) {
      // Fallback: find containers with Facebook text
      const fbContainers = await page.locator('div, section, li').filter({ hasText: /^Facebook/ }).all();
      for (const c of fbContainers) {
        const btn = c.locator('button').filter({ hasText: /connect/i }).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          clicked = true;
          console.log('Clicked via container fallback');
          break;
        }
      }
    }

    log('Clicked Facebook Connect button', clicked);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'pw-fb-02-after-click.png' });

    // ── 3. Verify guide modal ──────────────────────────────────────────────
    console.log('\n── Step 3: Verify guide modal ──');

    const modalHeading = page.locator('h2').filter({ hasText: /Connect Facebook/i }).first();
    const modalVisible = await modalHeading.isVisible({ timeout: 4000 }).catch(() => false);
    log('Guide modal appeared — "Connect Facebook"', modalVisible);
    await page.screenshot({ path: 'pw-fb-03-modal.png' });

    if (modalVisible) {
      // ── 4. Check modal content ──────────────────────────────────────────
      console.log('\n── Step 4: Check modal content ──');

      const hasPageReq = await page.locator('text=/Facebook Page/i').isVisible().catch(() => false);
      log('Facebook Page prereq shown', hasPageReq);

      const hasAdminReq = await page.locator('text=/[Aa]dmin/').isVisible().catch(() => false);
      log('Admin access prereq shown', hasAdminReq);

      const hasNote = await page.locator('text=/authorize|posts.*insights|Sozialzynk/i').isVisible().catch(() => false);
      log('Info note present', hasNote);

      // ── 5. Verify CTA button text ────────────────────────────────────────
      console.log('\n── Step 5: Verify CTA button text ──');

      const ctaBtn = page.locator('button').filter({ hasText: /continue to/i }).first();
      const ctaText = await ctaBtn.isVisible().catch(() => false)
        ? (await ctaBtn.textContent())?.trim() ?? ''
        : '';

      log('CTA button found', !!ctaText, `"${ctaText}"`);
      log('CTA says "Continue to Facebook"', ctaText.includes('Facebook'), `Got: "${ctaText}"`);
      log('CTA does NOT say "Instagram"', !ctaText.includes('Instagram'), `Got: "${ctaText}"`);

      // ── 6. Click CTA and capture OAuth URL ─────────────────────────────
      console.log('\n── Step 6: Click CTA and capture OAuth URL ──');

      let capturedUrl = '';

      // Intercept API call
      await page.route('**/platforms/facebook/auth-url**', async (route) => {
        console.log('API /platforms/facebook/auth-url called');
        await route.continue();
      });

      if (ctaText) {
        await ctaBtn.click().catch(() => {});
      }

      await page.waitForTimeout(4000);
      await page.screenshot({ path: 'pw-fb-04-after-cta.png' });

      // The page should have navigated to Facebook OAuth
      const finalUrl = page.url();
      console.log('Final URL (first 300):', finalUrl.slice(0, 300));

      const isOnFacebook = finalUrl.includes('facebook.com');
      log('Redirected to facebook.com', isOnFacebook, finalUrl.slice(0, 80));

      if (isOnFacebook) {
        // Parse from the Facebook URL's `next` param or directly
        try {
          const fbUrl = new URL(finalUrl);
          // Facebook wraps the actual OAuth params in a `next` param
          const nextParam = fbUrl.searchParams.get('next') ?? finalUrl;
          const oauthUrl = new URL(decodeURIComponent(nextParam.includes('dialog/oauth') ? nextParam : finalUrl));

          const clientId = oauthUrl.searchParams.get('client_id') ?? fbUrl.searchParams.get('api_key');
          const scope = oauthUrl.searchParams.get('scope');
          const redirectUri = oauthUrl.searchParams.get('redirect_uri');
          const state = oauthUrl.searchParams.get('state');

          log('client_id is set', !!clientId && clientId !== '', `client_id=${clientId}`);
          log('redirect_uri → /facebook/callback', redirectUri?.includes('/facebook/callback') ?? false, redirectUri ?? 'missing');
          log('scope has pages_manage_posts', scope?.includes('pages_manage_posts') ?? false, scope ?? '');
          log('scope has pages_read_engagement', scope?.includes('pages_read_engagement') ?? false);
          log('scope has pages_show_list', scope?.includes('pages_show_list') ?? false);

          if (state) {
            try {
              const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
              log('state.userId from JWT (not query param)', !!decoded.userId, decoded.userId);
              log('state.returnTo set', !!decoded.returnTo, decoded.returnTo);
            } catch {
              log('state decoded', false, 'parse error');
            }
          }

          console.log('\n── OAuth Parameters ──');
          console.log('client_id:', clientId);
          console.log('redirect_uri:', redirectUri);
          console.log('scope:', scope);
        } catch (e) {
          console.log('URL parse error:', e.message);
          // Try extracting from the raw URL string
          const match = finalUrl.match(/client_id=([^&]+)/);
          if (match) log('client_id extracted from URL', true, match[1]);
        }
      }
    } else {
      await page.screenshot({ path: 'pw-fb-debug-no-modal.png', fullPage: true });
      console.log('Full page screenshot: pw-fb-debug-no-modal.png');
      console.log('Current URL:', page.url());
    }

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: 'pw-fb-error.png' }).catch(() => {});
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('FACEBOOK CONNECT TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log('════════════════════════════════════════');

  await browser.close();
})();
