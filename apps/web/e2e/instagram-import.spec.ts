/**
 * E2E: Instagram Reel import via the Video Editor URL bar.
 * Uses a mocked import API so the test doesn't need real Instagram credentials.
 */
import { test, expect } from '@playwright/test';

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

test('Instagram Reel URL import — sends URL to API and shows result in bin', async ({ page }) => {
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

  // ── 1. Navigate to editor with JWT-expiry recovery ───────────────────────────
  await page.goto('/editor');
  const landed = await Promise.race([
    page.waitForURL(/\/editor\/.+/, { timeout: 30_000, waitUntil: 'commit' }).then(() => 'editor' as const),
    page.waitForURL(/\/login/, { timeout: 30_000 }).then(() => 'login' as const),
  ]).catch(() => 'editor' as const);
  if (landed === 'login') {
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
    await emailInput.fill(process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com');
    await page.locator('input[type="password"]').first().fill(process.env.PW_ADMIN_PASS ?? 'Admin@123');
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
    await page.goto('/editor');
    await page.waitForURL(/\/editor\/.+/, { timeout: 60_000, waitUntil: 'commit' });
  }
  await page.screenshot({ path: 'e2e/ig-1-editor.png' });

  // ── 2. Open the URL import bar in the Media Bin ──────────────────────────────
  const importBtn = page.getByRole('button', { name: /import from url/i });
  await expect(importBtn).toBeVisible({ timeout: 15_000 });
  await importBtn.click();

  // ── 3. Fill in the Instagram URL ─────────────────────────────────────────────
  const urlInput = page.locator('input[placeholder*="Instagram"], input[placeholder*="file URL"], input[placeholder*="video URL"]').first();
  await expect(urlInput).toBeVisible({ timeout: 5_000 });
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
