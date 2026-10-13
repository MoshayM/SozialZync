import { test, expect } from '@playwright/test';

test('image previews load in pipeline', async ({ page }) => {
  const BASE = 'https://sozialzynk.vercel.app';

  // ── 1. Navigate to projects list ────────────────────────────────────────────
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle', timeout: 60_000 });

  // ── 2. Open first project with the most jobs (Most Active / first card) ─────
  // Cards are <div> with a right-arrow link inside — click the first project card arrow
  const projectArrow = page.locator('a[href*="/projects/"]').filter({ hasNot: page.locator('[aria-label]') }).first();
  await projectArrow.waitFor({ timeout: 15_000 });
  const href = await projectArrow.getAttribute('href');
  console.log('Navigating to project:', href);
  await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.screenshot({ path: 'e2e/img-preview-2-project.png' });

  // ── 3. Click the Images tile expand button ────────────────────────────────────
  // On desktop, the Tile renders aria-label="Expand Images" on the chevron button
  const expandBtn = page.locator('button[aria-label="Expand Images"]');
  await expandBtn.waitFor({ timeout: 10_000 });
  await expandBtn.click();
  // Also click the tile body itself (outer onClick) in case button stopPropagation wins
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/img-preview-3-tile-clicked.png', fullPage: true });

  // ── 4. Wait for the detail panel to appear ────────────────────────────────────
  // On desktop, the detail renders in a div below the grid — wait for it
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'e2e/img-preview-4-detail.png', fullPage: true });

  // ── 5. Count images loaded and errors ────────────────────────────────────────
  const loadedBefore = await page.locator('img[src^="blob:"]').count();
  const errorsBefore  = await page.locator('text=Preview unavailable').count();
  console.log(`Before retry — blob images: ${loadedBefore}, "Preview unavailable": ${errorsBefore}`);

  // ── 6. Click any Retry buttons ────────────────────────────────────────────────
  const retryBtns = page.locator('button:has-text("Retry")');
  const retryCount = await retryBtns.count();
  if (retryCount > 0) {
    console.log(`Clicking ${retryCount} Retry button(s)…`);
    for (let i = 0; i < retryCount; i++) {
      await retryBtns.nth(i).click().catch(() => {});
      await page.waitForTimeout(5000);
    }
  }

  await page.screenshot({ path: 'e2e/img-preview-5-grid.png', fullPage: true });

  const loadedAfter = await page.locator('img[src^="blob:"]').count();
  const errorsAfter  = await page.locator('text=Preview unavailable').count();
  console.log(`After retry  — blob images: ${loadedAfter}, "Preview unavailable": ${errorsAfter}`);

  // ── 7. Lightbox on first loaded image ────────────────────────────────────────
  const firstImg = page.locator('img[src^="blob:"]').first();
  if (await firstImg.isVisible().catch(() => false)) {
    await firstImg.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/img-preview-6-lightbox.png' });
    await page.keyboard.press('Escape').catch(() => {});
  }

  await page.screenshot({ path: 'e2e/img-preview-7-final.png', fullPage: false });

  // ── 8. Assert ─────────────────────────────────────────────────────────────────
  expect(errorsAfter, `${errorsAfter} image(s) still show "Preview unavailable" after retry`).toBe(0);
  console.log(`✓ All ${loadedAfter} image preview(s) loaded OK`);
});
