import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

async function login(page: Page) {
  await page.goto('/login');
  const alreadyAuth = await page.waitForURL(
    /\/(home|projects|dashboard)/,
    { timeout: 8_000 },
  ).then(() => true).catch(() => false);

  if (alreadyAuth) {
    // Check JWT expiry — if < 10 min remain the app will redirect mid-test; force re-auth now.
    const expiresAt = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) ?? '') ?? '';
        if (!v.startsWith('eyJ')) continue;
        const parts = v.split('.');
        if (parts.length !== 3) continue;
        try { return (JSON.parse(atob(parts[1])).exp ?? 0) * 1000; } catch { /* not a JWT */ }
      }
      return null;
    });
    const TEN_MIN = 10 * 60 * 1000;
    if (expiresAt === null || expiresAt > Date.now() + TEN_MIN) return;
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.goto('/login');
    const cookieAuth = await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 2_000 })
      .then(() => true).catch(() => false);
    if (cookieAuth) return;
  }

  async function fillAndSubmit() {
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in with password/i }).click();
  }

  async function raceNavOrLimit(): Promise<boolean> {
    let ok = false;
    await Promise.race([
      page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 30_000, waitUntil: 'commit' })
        .then(() => { ok = true; }).catch(() => {}),
      page.getByText(/too many attempts/i).waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => {}),
    ]);
    return ok;
  }

  await fillAndSubmit();
  if (await raceNavOrLimit()) return;

  // Two 120s waits = 240s elapsed — fixed rate-limit window guaranteed clear.
  for (let i = 0; i < 2; i++) {
    await page.waitForTimeout(120_000);
    await page.goto('/login');
    await fillAndSubmit();
    if (await raceNavOrLimit()) return;
  }

  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 60_000, waitUntil: 'commit' });
}

/** Capture responses and console errors for /platforms endpoints to diagnose mock-vs-real issues. */
function attachNetworkLogger(page: Page, log: string[]) {
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/platforms')) {
      res.text().then((body) => {
        log.push(`[${res.status()}] ${res.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')} → ${body.slice(0, 400)}`);
      }).catch(() => {});
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') log.push(`[console.error] ${msg.text()}`);
  });
}

test.describe('Watch feature — live smoke test', () => {
  // Each test's beforeEach runs up to 60s warmup + 130s login = ~190s before test body
  // starts. Raise the whole-describe timeout so no test is killed mid-beforeEach.
  test.use({ timeout: 300_000 });

  // Warm up Railway so the channel-access API doesn't cold-start mid-test.
  test.beforeAll(async ({ request }) => {
    // watch-feature runs late in the 40-minute suite — Railway may be cold or under
    // load. Wait up to 2 minutes before proceeding so connection-status API calls
    // don't time out in individual tests.
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try {
        const res = await request.get('/api/proxy/copilot/stt-status', { timeout: 12_000 });
        if (res.status() > 0) return;
      } catch { /* still booting */ }
      await new Promise(r => setTimeout(r, 3_000));
    }
  });

  test.beforeEach(async ({ page, request }) => {
    // Re-warm Railway before each test — beforeAll covers test 1 but Railway can
    // cool down in the minutes between tests when the suite is heavily loaded.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await request.get('/api/proxy/copilot/stt-status', { timeout: 12_000 });
        if (res.status() > 0) break;
      } catch { /* still booting */ }
      await new Promise(r => setTimeout(r, 3_000));
    }
    await login(page);
  });

  test('channel-access page loads with Social Platforms section', async ({ page }) => {
    // test.use({ timeout }) inside describe is not reliable for the first test in a describe.
    // Set it explicitly in the body: beforeEach warmup(60s) + login(300s) + test body.
    test.setTimeout(300_000);
    await page.goto('/channel-access');
    await expect(page.getByRole('heading', { name: 'Social Platforms' })).toBeVisible({ timeout: 30_000 });
    for (const name of ['Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'Threads']) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
    const watchBtns = page.getByRole('button', { name: /watch/i });
    await expect(watchBtns.first()).toBeVisible();
    await page.screenshot({ path: 'e2e/pw-watch-1-loaded.png', fullPage: false });
  });

  test('Watch button expands section with handle input and Add button', async ({ page }) => {
    await page.goto('/channel-access');
    await expect(page.getByRole('heading', { name: 'Social Platforms' })).toBeVisible({ timeout: 30_000 });

    const allWatchBtns = page.getByRole('button', { name: /watch/i });
    // TikTok is the 3rd platform (index 2)
    await allWatchBtns.nth(2).click();

    await expect(page.locator('input[placeholder*="handle"]').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /^add$/i }).first()).toBeVisible();
    await page.screenshot({ path: 'e2e/pw-watch-2-expanded.png', fullPage: false });
  });

  test('can add and remove a watch account on Instagram', async ({ page }) => {
    test.setTimeout(300_000);
    const networkLog: string[] = [];
    attachNetworkLogger(page, networkLog);

    await page.goto('/channel-access');
    await expect(page.getByRole('heading', { name: 'Social Platforms' })).toBeVisible({ timeout: 30_000 });
    // Wait for the initial connection-status fetch to complete so our interceptor only
    // catches the post-add refetch, not the page-load request.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Instagram is the 2nd platform (index 1)
    const watchBtns = page.getByRole('button', { name: /watch/i });
    await expect(watchBtns.nth(1)).toBeVisible({ timeout: 120_000 });
    await watchBtns.nth(1).click();

    const handleInput = page.locator('input[placeholder*="handle"]').first();
    await expect(handleInput).toBeVisible({ timeout: 8_000 });

    await handleInput.fill('@pw_testhandle');

    // Intercept the watch POST response directly
    const watchResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/platforms') && res.request().method() === 'POST',
      { timeout: 30_000 },
    );
    const statusResponsePromise = page.waitForResponse(
      (res) => res.url().includes('connection-status'),
      { timeout: 30_000 },
    );

    await page.getByRole('button', { name: /^add$/i }).first().click();

    const watchRes = await watchResponsePromise;
    const watchBody = await watchRes.text();
    console.log(`WATCH POST status=${watchRes.status()} body=${watchBody}`);

    const statusRes = await statusResponsePromise;
    const statusBody = await statusRes.text();
    console.log(`CONNECTION-STATUS GET status=${statusRes.status()} body=${statusBody.slice(0, 600)}`);

    // Fail early with diagnostics if the API returned an error (201 Created is correct for POST)
    expect(watchRes.status(), `Watch POST failed — body: ${watchBody}`).toBeLessThan(300);

    // Confirm the refetch response contains the new handle
    expect(statusBody, 'connection-status refetch should contain @pw_testhandle').toContain('@pw_testhandle');

    // Handle appears in the UI list
    await expect(page.getByText('@pw_testhandle')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/pw-watch-3-added.png', fullPage: false });

    // Unwatch it
    const unwatchResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/platforms') && res.request().method() === 'DELETE',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /unwatch/i }).first().click();
    const unwatchRes = await unwatchResponsePromise;
    console.log(`UNWATCH DELETE status=${unwatchRes.status()}`);

    await expect(page.getByText('@pw_testhandle')).not.toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/pw-watch-4-removed.png', fullPage: false });

    if (networkLog.length) console.log('Network log:\n' + networkLog.join('\n'));
  });

  test('Watch button shows count badge after adding multiple accounts', async ({ page }) => {
    test.setTimeout(300_000);
    const networkLog: string[] = [];
    attachNetworkLogger(page, networkLog);

    await page.goto('/channel-access');
    await expect(page.getByRole('heading', { name: 'Social Platforms' })).toBeVisible({ timeout: 30_000 });
    // Wait for connection-status API to populate all platform cards (Railway may be slow)
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    // X is the 4th platform (index 3)
    const watchBtns = page.getByRole('button', { name: /watch/i });
    await expect(watchBtns.nth(3)).toBeVisible({ timeout: 120_000 });
    await watchBtns.nth(3).click();

    const handleInput = page.locator('input[placeholder*="handle"]').first();
    await expect(handleInput).toBeVisible({ timeout: 8_000 });

    // Remove any watches left over from prior test runs so we start from a clean slate
    const existingUnwatches = page.getByRole('button', { name: /unwatch/i });
    while ((await existingUnwatches.count()) > 0) {
      const preDelPromise = page.waitForResponse(
        (r) => r.url().includes('/platforms') && r.request().method() === 'DELETE',
        { timeout: 10_000 },
      );
      await existingUnwatches.first().click();
      await preDelPromise;
      // Wait for refetch to settle before checking the count again
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    }

    // Add first account — wait for Add button to be enabled first
    await handleInput.fill('@x_user_one');
    await expect(page.getByRole('button', { name: /^add$/i }).first()).toBeEnabled({ timeout: 5_000 });
    const res1Promise = page.waitForResponse(
      (r) => r.url().includes('/platforms') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /^add$/i }).first().click();
    const res1 = await res1Promise;
    console.log(`ADD @x_user_one status=${res1.status()} body=${await res1.text()}`);
    expect(res1.status(), 'First watch POST should succeed').toBeLessThan(300);
    await expect(page.getByText('@x_user_one')).toBeVisible({ timeout: 10_000 });

    // Add second account — wait for Add button to be enabled (mutation may still be settling)
    await handleInput.fill('@x_user_two');
    await expect(page.getByRole('button', { name: /^add$/i }).first()).toBeEnabled({ timeout: 10_000 });
    const res2Promise = page.waitForResponse(
      (r) => r.url().includes('/platforms') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /^add$/i }).first().click();
    const res2 = await res2Promise;
    console.log(`ADD @x_user_two status=${res2.status()} body=${await res2.text()}`);
    expect(res2.status(), 'Second watch POST should succeed').toBeLessThan(300);
    await expect(page.getByText('@x_user_two')).toBeVisible({ timeout: 10_000 });

    // Badge should show 2 — scoped to the X Watch toggle button to avoid false matches
    // (other spans on the page may contain "2", e.g. the @x_user_two handle)
    const xWatchToggle = page.getByRole('button', { name: /^watch/i }).nth(3);
    const badge = xWatchToggle.locator('span').filter({ hasText: /^2$/ });
    await expect(badge).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: 'e2e/pw-watch-5-badge.png', fullPage: false });

    // Clean up — after each DELETE, wait for networkidle so the UI refetch completes
    // before clicking the next Unwatch. Without this, the second click targets the
    // same (already-deleted) item still visible in the stale pre-refetch list.
    const unwatchBtns = page.getByRole('button', { name: /unwatch/i });
    let remaining = await unwatchBtns.count();
    while (remaining > 0) {
      const delPromise = page.waitForResponse(
        (r) => r.url().includes('/platforms') && r.request().method() === 'DELETE',
        { timeout: 30_000 },
      );
      await unwatchBtns.first().click();
      await delPromise;
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      remaining = await unwatchBtns.count();
    }

    await expect(page.getByText('@x_user_one')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('@x_user_two')).not.toBeVisible({ timeout: 5_000 });

    if (networkLog.length) console.log('Network log:\n' + networkLog.join('\n'));
  });
});
