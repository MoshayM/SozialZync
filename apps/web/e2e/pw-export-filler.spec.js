/**
 * Test: export page filler progress button with pause/resume.
 * Navigates to a rendered clip's export page, triggers re-render,
 * verifies the filler bar appears and pause/resume works.
 */
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth.json' });

test('export page shows filler progress button when rendering', async ({ page }) => {
  // ── Navigate to analysis page ────────────────────────────────────────────
  await page.goto('/shorts-studio', { waitUntil: 'networkidle' });

  const videoRow = page.locator('div[role="button"]').filter({ hasText: 'Ready' }).first();
  await videoRow.waitFor({ timeout: 30_000 });
  await videoRow.click();

  const resultsLink = page.getByRole('link', { name: /results|analysis/i }).first();
  await resultsLink.waitFor({ timeout: 15_000 });
  await resultsLink.click();
  await page.waitForURL(/\/shorts-studio\/videos\//, { timeout: 30_000 });

  // ── Expand a rendered or exported clip, then click its Export link ────────
  const clipRow = page.locator('[role="button"]').filter({ hasText: /rendered|exported/i }).first();
  await clipRow.waitFor({ timeout: 20_000 });
  await clipRow.click();

  await page.screenshot({ path: 'pw-export-01-clip-expanded.png' });

  const exportLink = page.getByRole('link', { name: /export/i }).first();
  await exportLink.waitFor({ timeout: 10_000 });
  await exportLink.click();
  await page.waitForURL(/\/export/, { timeout: 20_000 });

  // ── Export page loaded — screenshot before triggering render ─────────────
  await page.screenshot({ path: 'pw-export-02-page.png' });
  console.log('✅ Export page loaded:', page.url());

  // ── Click Re-render / Render clip to start rendering ─────────────────────
  const renderBtn = page.getByRole('button', { name: /re-render|render clip/i });
  await renderBtn.waitFor({ timeout: 15_000 });
  await renderBtn.click();
  console.log('✅ Render triggered');

  // ── Filler button should appear: background #5b21b6, text "Starting…" or "Rendering X%" ──
  const fillerBtn = page.locator('button').filter({ hasText: /starting|rendering \d+%|paused/i });
  await fillerBtn.waitFor({ timeout: 20_000 });

  await page.screenshot({ path: 'pw-export-03-filler-appeared.png' });
  console.log('✅ Filler progress button visible');

  // Verify the filler div (progress sweep) exists inside the button
  const fillerBar = fillerBtn.locator('div.absolute.inset-y-0');
  await expect(fillerBar).toBeAttached();

  // ── Click the filler button to Pause ─────────────────────────────────────
  await fillerBtn.click();
  const pausedBtn = page.locator('button').filter({ hasText: /paused — resume/i });
  await pausedBtn.waitFor({ timeout: 10_000 });

  await page.screenshot({ path: 'pw-export-04-paused.png' });
  console.log('✅ Paused state confirmed');

  // ── Click again to Resume ─────────────────────────────────────────────────
  await pausedBtn.click();
  const resumedBtn = page.locator('button').filter({ hasText: /starting|rendering \d+%/i });
  await resumedBtn.waitFor({ timeout: 10_000 });

  await page.screenshot({ path: 'pw-export-05-resumed.png' });
  console.log('✅ Resumed — filler button back');
});
