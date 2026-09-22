const { chromium } = require('@playwright/test');
const { createHmac } = require('crypto');

function makeJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const ADMIN_USER = {
  id: 'cmrxvqtrr0001la046w82ne3v',
  email: 'ethonanpasumvalki@gmail.com',
  name: 'Ethonan P',
  role: 'SUPER_ADMIN',
  plan: 'FREE',
  avatarUrl: null,
};

(async () => {
  const secret = process.env.JWT_SECRET_ARG || '8c1fe81b4a0c0e182dd28849d52be9371062aef';
  const now = Math.floor(Date.now() / 1000);
  const accessToken = makeJwt(
    { sub: ADMIN_USER.id, email: ADMIN_USER.email, role: ADMIN_USER.role, sid: 'admin-check', plan: ADMIN_USER.plan, iat: now, exp: now + 3600 },
    secret
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Intercept all proxy calls that go to the backend
  await page.route('**/api/proxy/**', async (route, request) => {
    const url = request.url();
    const method = request.method();
    console.log(`[INTERCEPT] ${method} ${url}`);

    // /auth/me — return admin profile (flat object, not wrapped)
    if (url.includes('/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: ADMIN_USER.id, email: ADMIN_USER.email, name: ADMIN_USER.name, role: ADMIN_USER.role, avatarUrl: ADMIN_USER.avatarUrl, phone: null }),
      });
      return;
    }

    // /auth/refresh — return fresh token
    if (url.includes('/auth/refresh')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken, refreshToken: accessToken }),
      });
      return;
    }

    // Admin stats/dashboard endpoints — return empty/default data
    if (url.includes('/admin/stats') || url.includes('/admin/dashboard')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalUsers: 1, activeUsers: 1, totalVideos: 0, totalProjects: 0 }),
      });
      return;
    }

    // Admin users list
    if (url.includes('/admin/users')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: [ADMIN_USER], total: 1, page: 1, limit: 20 }),
      });
      return;
    }

    // Default: pass through to actual backend
    await route.continue();
  });

  // Step 1: Load the login page to establish the origin
  await page.goto('https://sozialzynk.vercel.app/login');
  await page.waitForLoadState('domcontentloaded');

  // Step 2: Inject tokens + role into localStorage
  const adminData = JSON.stringify(ADMIN_USER);
  await page.evaluate(({ tok, adminJson }) => {
    const user = JSON.parse(adminJson);
    localStorage.setItem('cf_token', tok);
    localStorage.setItem('cf.refreshToken', tok);
    localStorage.setItem('cf_user_role', user.role);
    localStorage.setItem('cf_user_name', user.name);
    localStorage.setItem('cf_mock_email', user.email);
  }, { tok: accessToken, adminJson: adminData });

  // Step 3: Navigate to admin panel
  await page.goto('https://sozialzynk.vercel.app/admin');
  await page.waitForTimeout(5000);

  const finalUrl = page.url();
  console.log('\nFinal URL:', finalUrl);

  const title = await page.title();
  console.log('Page title:', title);

  const body = await page.locator('body').innerText();
  console.log('\n--- Page content (first 2000 chars) ---');
  console.log(body.substring(0, 2000));

  await page.screenshot({ path: 'pw-admin-panel.png', fullPage: false });
  console.log('\nScreenshot saved: pw-admin-panel.png');

  await browser.close();
})();
