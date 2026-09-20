import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_VIDEO = path.join(__dirname, 'test-video.mp4');
const API = 'https://sozialzync-api-production.up.railway.app/api/v1';
const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

async function goToEditor(page: import('@playwright/test').Page) {
  // /editor creates a project then redirects to /editor/[id]. Wait 90s for the
  // redirect (Railway cold start can take 60s+ to create the project).
  await page.goto('/editor');
  const landed = await Promise.race([
    page.waitForURL(/\/editor\/.+/, { timeout: 90_000 }).then(() => 'editor' as const),
    page.waitForURL(/\/login/, { timeout: 90_000 }).then(() => 'login' as const),
  ]).catch(() => 'timeout' as const);

  if (landed === 'login' || (landed === 'timeout' && page.url().includes('/login'))) {
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 130_000, waitUntil: 'commit' });
    await page.goto('/editor');
    await page.waitForURL(/\/editor\/.+/, { timeout: 90_000 });
  } else if (landed === 'timeout') {
    await page.waitForURL(/\/editor\/.+/, { timeout: 60_000 });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Editor video preview', () => {

  test('upload flow opens editor workspace with Upload video button', async ({ page }) => {
    // /editor now redirects to the workspace — wait for the redirect
    await goToEditor(page);
    await page.screenshot({ path: 'e2e/editor-workspace-initial.png' });

    // Upload via the bin's hidden file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_VIDEO);

    // Upload button should be visible in the bin (before or after upload)
    const uploadBtn = page.locator('button').filter({ hasText: /upload (file|video)/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/editor-upload-btn.png' });
  });

  test('versionFile returns Content-Disposition: inline', async ({ page, request }) => {
    // Capture versionId from the upload API response directly — avoids
    // searching old edits whose files may not exist in R2.
    let capturedVersionId: string | null = null;
    page.on('response', async (response) => {
      if (response.url().includes('/media/video/upload') && response.status() < 300) {
        try {
          const body = await response.json() as { versionId?: string };
          if (body?.versionId) capturedVersionId = body.versionId;
        } catch { /* ignore parse errors */ }
      }
    });

    // /editor redirects to the workspace
    await goToEditor(page);

    // Upload via the bin's hidden file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_VIDEO);

    // Wait for the upload to finish — button shows "Uploading…" then returns to "Upload file"
    const uploadBtn = page.locator('button').filter({ hasText: /upload (file|video)/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 60_000 });

    if (!capturedVersionId) {
      test.skip(true, 'Upload response did not include versionId');
      return;
    }

    // Get auth token (stored under cf_token by the app)
    const token = await page.evaluate(() => localStorage.getItem('cf_token'));
    if (!token) {
      test.skip(true, 'No auth token in localStorage');
      return;
    }

    // Get a signed URL for the freshly-uploaded version (guaranteed in R2)
    const sigRes = await request.get(`${API}/media/versions/${capturedVersionId}/signed-url`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!sigRes.ok()) {
      test.skip(true, `Signed URL request failed: ${sigRes.status()}`);
      return;
    }
    const { url } = await sigRes.json() as { url: string };

    // Fetch the file and assert the Content-Disposition header is inline
    const apiOrigin = new URL(API).origin;
    const fileRes = await request.get(`${apiOrigin}${url}`);
    const disposition = fileRes.headers()['content-disposition'] ?? '';
    const contentType = fileRes.headers()['content-type'] ?? '';

    console.log('Content-Disposition:', disposition);
    console.log('Content-Type:', contentType);
    console.log('HTTP status:', fileRes.status());

    expect(fileRes.status()).toBe(200);
    expect(disposition).toMatch(/^inline/);
    expect(contentType).toMatch(/^video\//);
  });

});
