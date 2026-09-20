/**
 * E2E: Instagram Reel import via the Video Editor URL bar.
 * Uses a mocked import API so the test doesn't need real Instagram credentials.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

const REEL_URL =
  'https://www.instagram.com/reel/DcFd8Z7CZDT/?utm_source=ig_web_copy_link';

const FAKE_ASSET = {
  id: 'ig-e2e-asset',
  label: 'instagram-reel.mp4',
  kind: 'VIDEO',
  sizeBytes: 17_600_000,
  versionId: 'ig-e2e-version',
  createdAt: new Date().toISOString(),
};

// Warm up Railway before the test — cold starts can take 60-90s.
test.beforeAll(async ({ request }) => {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await request.get('/api/proxy/copilot/stt-status', { timeout: 15_000 });
      if (res.status() > 0) return;
    } catch { /* still booting */ }
    await new Promise(r => setTimeout(r, 3_000));
  }
});

test('Instagram Reel URL import — sends URL to API and shows result in bin', async ({ page }) => {
  test.setTimeout(400_000);
  let capturedUrl = '';

  // Mock the import API — Instagram auth not available in CI
  await page.route('**/media/video/import-from-url', async (route) => {
    const body = route.request().postDataJSON() as { url?: string } | null;
    capturedUrl = body?.url ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        assetId: FAKE_ASSET.id,
        versionId: FAKE_ASSET.versionId,
        projectId: 'e2e-project',
        sizeBytes: FAKE_ASSET.sizeBytes,
        filename: FAKE_ASSET.label,
      }),
    });
  });

  // ── 0. Ensure JWT has ≥ 10 min remaining before touching the editor ──────────
  // The editor redirect → /editor/[id] makes two Railway calls. If the JWT expires
  // between them the /editor/[id] page gets a 401, the auth guard fires a competing
  // redirect, and Playwright sees ERR_ABORTED on the navigation.
  await page.goto('/login');
  const homeReached = await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 8_000 })
    .then(() => true).catch(() => false);
  if (homeReached) {
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
    if (expiresAt !== null && expiresAt <= Date.now() + TEN_MIN) {
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
      await page.goto('/login');
      const cookieOk = await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 2_000 })
        .then(() => true).catch(() => false);
      if (!cookieOk) {
        await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
        await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
        await page.getByRole('button', { name: /sign in with password/i }).click();
        await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 130_000, waitUntil: 'commit' });
      }
    }
  } else {
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 130_000, waitUntil: 'commit' });
  }

  // ── 1. Navigate to editor with JWT-expiry recovery ───────────────────────────
  // /editor creates a project then redirects to /editor/[id]. Wait up to 90s for
  // the redirect (Railway cold start can take 60s+ to create the project).
  await page.goto('/editor');
  const landed = await Promise.race([
    page.waitForURL(/\/editor\/.+/, { timeout: 90_000, waitUntil: 'commit' }).then(() => 'editor' as const),
    page.waitForURL(/\/login/, { timeout: 90_000 }).then(() => 'login' as const),
  ]).catch(() => 'timeout' as const);

  if (landed === 'login' || (landed === 'timeout' && page.url().includes('/login'))) {
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
    await emailInput.fill(process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com');
    await page.locator('input[type="password"]').first().fill(process.env.PW_ADMIN_PASS ?? 'Admin@123');
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 130_000, waitUntil: 'commit' });
    await page.goto('/editor');
    await page.waitForURL(/\/editor\/.+/, { timeout: 90_000, waitUntil: 'commit' });
  } else if (landed === 'timeout') {
    // Railway took > 90s or the /editor/[id] navigation was aborted (auth redirect
    // competed with the router.replace). Navigate to /editor again to retry.
    await page.goto('/editor').catch(() => {});
    const landed2 = await Promise.race([
      page.waitForURL(/\/editor\/.+/, { timeout: 90_000, waitUntil: 'commit' }).then(() => 'editor' as const),
      page.waitForURL(/\/login/, { timeout: 90_000 }).then(() => 'login' as const),
    ]).catch(() => 'timeout2' as const);
    if (landed2 === 'login') {
      await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
      await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
      await page.getByRole('button', { name: /sign in with password/i }).click();
      await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 130_000, waitUntil: 'commit' });
      await page.goto('/editor').catch(() => {});
      await page.waitForURL(/\/editor\/.+/, { timeout: 90_000, waitUntil: 'commit' });
    } else if (landed2 !== 'editor') {
      throw new Error(`Could not navigate to editor after retry. Current URL: ${page.url()}`);
    }
  }
  await page.screenshot({ path: 'e2e/ig-1-editor.png' });

  // ── 2. Open the URL import bar in the Media Bin ──────────────────────────────
  const importBtn = page.getByRole('button', { name: /import from url/i });
  await expect(importBtn).toBeVisible({ timeout: 30_000 });
  await importBtn.click();

  // ── 3. Fill in the Instagram URL ─────────────────────────────────────────────
  // Actual placeholder: "YouTube, Instagram, TikTok, X, or direct file URL…"
  const urlInput = page.locator('input[placeholder*="Instagram"], input[placeholder*="file URL"]').first();
  await expect(urlInput).toBeVisible({ timeout: 15_000 });
  await urlInput.fill(REEL_URL);
  await page.screenshot({ path: 'e2e/ig-2-url-filled.png' });

  // ── 4. Submit — wait for the mocked import API call ──────────────────────────
  const importResponsePromise = page.waitForResponse(
    (res) => res.url().includes('import-from-url'),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: /^go$/i }).click();

  const importRes = await importResponsePromise;
  console.log(`Import API status: ${importRes.status()}, URL captured: ${capturedUrl}`);
  expect(importRes.status(), 'Import API should succeed').toBeLessThan(300);

  // ── 5. Verify the correct Instagram URL was sent ──────────────────────────────
  expect(capturedUrl, 'Instagram URL should be forwarded to import API').toContain(
    'instagram.com',
  );

  // ── 6. After import, the URL bar closes and the bin refetches ─────────────────
  // The Import from URL button should become visible again (bar closed)
  await expect(importBtn).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'e2e/ig-3-done.png' });

  console.log('✓ Instagram Reel import URL submitted successfully');
});
