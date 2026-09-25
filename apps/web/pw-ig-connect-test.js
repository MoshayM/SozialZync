// Test: Instagram Connect flow on publishing/accounts page
// Uses stored auth state from e2e/.auth.json to skip Google OAuth
const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  // Try to use saved auth state
  const storageStatePath = path.join(__dirname, 'e2e', '.auth.json');
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: storageStatePath,
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
    // ── 1. Verify auth works ───────────────────────────────────────────────
    console.log('\n── Step 1: Verify auth state ──');
    await page.goto(`${BASE}/publishing/accounts`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const isOnApp = !currentUrl.includes('/login') && !currentUrl.includes('google.com');
    log('Auth state valid (not redirected to login)', isOnApp, currentUrl);

    if (!isOnApp) {
      // Auth expired — try to get a fresh JWT via the API
      console.log('Auth state expired. Attempting fresh login via API...');
      await browser.close();

      // Open new browser without storageState
      const b2 = await chromium.launch({ headless: false, slowMo: 300 });
      const c2 = await b2.newContext({ viewport: { width: 1280, height: 800 } });
      const p2 = await c2.newPage();

      await p2.goto(`${BASE}/login`);
      await p2.screenshot({ path: 'pw-ig-login-page.png' });
      console.log('Login page screenshot taken. Manual login required for Google OAuth.');
      console.log('Please check pw-ig-login-page.png');
      await p2.waitForTimeout(5000);
      await b2.close();
      return;
    }

    await page.screenshot({ path: 'pw-ig-01-accounts-page.png' });
    log('On publishing/accounts page', page.url().includes('publishing'), page.url());

    // ── 2. Find the Instagram Connect button ──────────────────────────────
    console.log('\n── Step 2: Find Instagram Connect button ──');

    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Debug: find all visible text containing "Instagram"
    const igTexts = await page.evaluate(() => {
      const els = document.querySelectorAll('*');
      const found = [];
      for (const el of els) {
        if (el.children.length === 0 && el.textContent?.includes('Instagram')) {
          found.push({ tag: el.tagName, text: el.textContent?.trim().slice(0, 80) });
        }
      }
      return found.slice(0, 10);
    });
    console.log('Instagram-related elements:', JSON.stringify(igTexts, null, 2));

    // Find all buttons and list them
    const allBtns = await page.locator('button').all();
    console.log(`Total buttons on page: ${allBtns.length}`);
    for (const btn of allBtns) {
      const txt = await btn.textContent().catch(() => '');
      if (txt?.trim()) console.log(' Button:', txt.trim().slice(0, 60));
    }

    await page.screenshot({ path: 'pw-ig-02-buttons-listed.png' });

    // ── 3. Click Instagram Connect ─────────────────────────────────────────
    console.log('\n── Step 3: Click Instagram Connect ──');

    // Try multiple strategies to find and click the Instagram connect button
    let clicked = false;

    // Strategy 1: button inside element that contains "Instagram"
    const containers = await page.locator('div, section, article, li').filter({ hasText: /^Instagram/ }).all();
    for (const c of containers) {
      const btn = c.locator('button').filter({ hasText: /connect/i }).first();
      if (await btn.count() > 0) {
        const isVisible = await btn.isVisible();
        if (isVisible) {
          await btn.click();
          clicked = true;
          console.log('Clicked via container filter');
          break;
        }
      }
    }

    if (!clicked) {
      // Strategy 2: find button in platform cards
      const instagramCard = page.locator('[data-platform="instagram"], [id*="instagram"]').first();
      if (await instagramCard.count() > 0) {
        const btn = instagramCard.locator('button').first();
        await btn.click();
        clicked = true;
        console.log('Clicked via data-platform attribute');
      }
    }

    if (!clicked) {
      // Strategy 3: click any button containing "Connect" text near page center
      const connectBtns = await page.locator('button').filter({ hasText: /^connect$/i }).all();
      console.log(`Found ${connectBtns.length} "Connect" buttons`);
      // The Instagram one is likely the 2nd (after YouTube which might be first, or just pick by index)
      for (let i = 0; i < connectBtns.length; i++) {
        const btn = connectBtns[i];
        const visible = await btn.isVisible();
        const txt = await btn.textContent();
        console.log(`  Connect btn ${i}: "${txt?.trim()}" visible=${visible}`);
        // Get the platform from the parent context
        const nearText = await page.evaluate((el) => {
          let p = el.parentElement;
          for (let i = 0; i < 5; i++) {
            if (!p) break;
            const t = p.textContent ?? '';
            if (t.includes('Instagram')) return 'instagram';
            if (t.includes('Facebook')) return 'facebook';
            if (t.includes('TikTok')) return 'tiktok';
            p = p.parentElement;
          }
          return 'unknown';
        }, await btn.elementHandle());
        console.log(`  -> Near platform: ${nearText}`);
        if (nearText === 'instagram' && visible) {
          await btn.click();
          clicked = true;
          console.log('Clicked Instagram connect button');
          break;
        }
      }
    }

    if (!clicked) {
      // Strategy 4: screenshot and identify manually
      await page.screenshot({ path: 'pw-ig-03-no-connect-found.png', fullPage: true });
      console.log('Could not find Connect button. Full page screenshot saved.');
    }

    log('Clicked Connect Instagram button', clicked);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'pw-ig-03-after-click.png' });

    // ── 4. Verify guide modal ──────────────────────────────────────────────
    console.log('\n── Step 4: Verify guide modal ──');
    await page.waitForTimeout(500);

    // Look for modal overlay or dialog
    const modalEl = page.locator('[class*="modal"], [class*="overlay"], [role="dialog"]').first();
    const modalByContent = page.locator('text=Connect Instagram').first();

    const modalVisible = await modalByContent.isVisible({ timeout: 4000 }).catch(() => false);
    log('Guide modal appeared with "Connect Instagram" heading', modalVisible);
    await page.screenshot({ path: 'pw-ig-04-modal.png' });

    if (modalVisible) {
      // ── 5. Check prereqs and note ──────────────────────────────────────
      console.log('\n── Step 5: Check modal content ──');

      const hasBusinessReq = await page.locator('text=/Business.*account|Creator account/i').isVisible().catch(() => false);
      log('Instagram Business/Creator account prereq shown', hasBusinessReq);

      const hasFbPageReq = await page.locator('text=/Facebook Page/i').isVisible().catch(() => false);
      log('Facebook Page prereq shown', hasFbPageReq);

      const hasFbNote = await page.locator("text=/Facebook to authorize|Instagram.*API works/i").isVisible().catch(() => false);
      log('Info note explains Facebook redirect', hasFbNote);

      // ── 6. Check CTA button text ────────────────────────────────────────
      console.log('\n── Step 6: Verify CTA button text ──');

      const ctaBtn = page.locator('button').filter({ hasText: /continue to/i }).first();
      const ctaVisible = await ctaBtn.isVisible().catch(() => false);
      const ctaText = ctaVisible ? (await ctaBtn.textContent())?.trim() ?? '' : '';

      log('CTA button found', ctaVisible, `Text: "${ctaText}"`);

      if (ctaVisible) {
        log('"Continue to Instagram" (correct)', ctaText.includes('Instagram'), `Got: "${ctaText}"`);
        log('NOT "Continue to Facebook" (old broken text)', !ctaText.toLowerCase().replace(/\s+/g, ' ').includes('to facebook'), `Got: "${ctaText}"`);
      }

      // ── 7. Click CTA and intercept OAuth URL ─────────────────────────────
      console.log('\n── Step 7: Click CTA and capture OAuth URL ──');

      let capturedUrl = '';

      // Intercept the navigation to Facebook
      await page.route('**/facebook.com/**', async (route) => {
        capturedUrl = route.request().url();
        console.log('\nFacebook OAuth URL intercepted (first 300 chars):');
        console.log(capturedUrl.slice(0, 300));
        await route.abort(); // Don't actually navigate to Facebook
      });

      // Also intercept the API call
      await page.route('**/platforms/instagram/auth-url**', async (route) => {
        console.log('\nAPI call to get auth-url intercepted');
        await route.continue();
      });

      // Listen for popup or new page
      const [newPage] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        ctaBtn.click().catch(async () => {
          // Maybe clicked by text
          const btn2 = page.locator('button').filter({ hasText: /continue to instagram/i }).first();
          if (await btn2.count() > 0) await btn2.click();
        }),
      ]);

      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'pw-ig-05-after-cta.png' });

      if (capturedUrl) {
        try {
          const oauthUrl = new URL(capturedUrl);
          const clientId = oauthUrl.searchParams.get('client_id');
          const redirectUri = oauthUrl.searchParams.get('redirect_uri');
          const scope = oauthUrl.searchParams.get('scope');
          const state = oauthUrl.searchParams.get('state');

          log('OAuth goes to facebook.com (correct for Instagram API)', capturedUrl.includes('facebook.com'));
          log('client_id is set', !!clientId && clientId !== '', `client_id=${clientId}`);
          log('redirect_uri → /instagram/callback', redirectUri?.includes('/instagram/callback') ?? false, redirectUri ?? 'missing');
          log('scope has instagram_basic', scope?.includes('instagram_basic') ?? false, scope ?? 'missing');
          log('scope has instagram_content_publish', scope?.includes('instagram_content_publish') ?? false);

          if (state) {
            try {
              const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
              log('state.userId set (from JWT)', !!decoded.userId, decoded.userId ?? 'missing');
              log('state.returnTo set', !!decoded.returnTo, decoded.returnTo ?? 'missing');
            } catch {
              log('state decoded', false, 'parse error');
            }
          }

          console.log('\n── Full OAuth Parameters ──');
          console.log('URL:', capturedUrl.slice(0, 100) + '...');
          console.log('client_id:', clientId);
          console.log('redirect_uri:', redirectUri);
          console.log('scope:', scope);
        } catch (parseErr) {
          console.log('URL parse error:', parseErr.message);
        }
      } else {
        log('OAuth URL captured', false, 'Navigation was not intercepted — may have gone to a new tab or page redirected');
        console.log('Current page URL:', page.url());

        // Check if we're now on facebook.com or if a new tab opened
        if (newPage) {
          const newUrl = newPage.url();
          console.log('New page URL:', newUrl);
          capturedUrl = newUrl;
          log('OAuth in new tab', newUrl.includes('facebook.com'), newUrl.slice(0, 100));
        }
      }
    } else {
      // Modal didn't appear — take full page screenshot for debugging
      await page.screenshot({ path: 'pw-ig-debug-no-modal.png', fullPage: true });
      console.log('Full page screenshot saved to pw-ig-debug-no-modal.png');

      // Check if we're still on the accounts page
      console.log('Current URL:', page.url());

      // Try to scroll down and look for Instagram
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.screenshot({ path: 'pw-ig-debug-scrolled.png' });
    }

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: 'pw-ig-error.png' }).catch(() => {});
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('INSTAGRAM CONNECT TEST RESULTS');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  results.forEach(r => console.log(`${r.pass ? '✅' : '❌'} ${r.label}${r.detail ? ' → ' + r.detail : ''}`));
  console.log(`\n${passed}/${total} checks passed`);
  console.log('════════════════════════════════════════');

  await browser.close();
})();
