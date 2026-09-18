import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

async function login(page: Page) {
  await page.goto('/login');
  // When a stored JWT is in localStorage the login page useEffect auto-redirects.
  const alreadyAuth = await page.waitForURL(
    /\/(home|projects|dashboard)/,
    { timeout: 4_000 },
  ).then(() => true).catch(() => false);
  if (alreadyAuth) return;

  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 20_000 });
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
  // Warm up Railway so the channel-access API doesn't cold-start mid-test.
  test.beforeAll(async ({ request }) => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await request.get('/api/proxy/copilot/stt-status', { timeout: 12_000 });
        if (res.status() > 0) return;
      } catch { /* still booting */ }
      await new Promise(r => setTimeout(r, 3_000));
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('channel-access page loads with Social Platforms section', async ({ page }) => {
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
    const networkLog: string[] = [];
    attachNetworkLogger(page, networkLog);

    await page.goto('/channel-access');
    await expect(page.getByRole('heading', { name: 'Social Platforms' })).toBeVisible({ timeout: 30_000 });
    // Wait for the initial connection-status fetch to complete so our interceptor only
    // catches the post-add refetch, not the page-load request.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Instagram is the 2nd platform (index 1)
    const watchBtns = page.getByRole('button', { name: /watch/i });
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
    const networkLog: string[] = [];
    attachNetworkLogger(page, networkLog);

    await page.goto('/channel-access');
    await expect(page.getByRole('heading', { name: 'Social Platforms' })).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // X is the 4th platform (index 3)
    const watchBtns = page.getByRole('button', { name: /watch/i });
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
    }

    // Add first account
    await handleInput.fill('@x_user_one');
    const res1Promise = page.waitForResponse(
      (r) => r.url().includes('/platforms') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /^add$/i }).first().click();
    const res1 = await res1Promise;
    console.log(`ADD @x_user_one status=${res1.status()} body=${await res1.text()}`);
    expect(res1.status(), 'First watch POST should succeed').toBeLessThan(300);
    await expect(page.getByText('@x_user_one')).toBeVisible({ timeout: 10_000 });

    // Add second account
    await handleInput.fill('@x_user_two');
    const res2Promise = page.waitForResponse(
      (r) => r.url().includes('/platforms') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /^add$/i }).first().click();
    const res2 = await res2Promise;
    console.log(`ADD @x_user_two status=${res2.status()} body=${await res2.text()}`);
    expect(res2.status(), 'Second watch POST should succeed').toBeLessThan(300);
    await expect(page.getByText('@x_user_two')).toBeVisible({ timeout: 10_000 });

    // Badge should show 2
    const badge = page.locator('span').filter({ hasText: '2' });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
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
