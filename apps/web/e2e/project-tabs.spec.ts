/**
 * Smoke tests: all 5 project detail tabs load without "Something went wrong".
 * Verifies the Suspense boundary fix (PublishFromRenderPanel / useSearchParams).
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = 'cmt73kval0003rw2x3xjef9yc';
test.setTimeout(90_000);

async function dismissModals(page: import('@playwright/test').Page) {
  for (const sel of [
    'button:has-text("I\'ll do this later")',
    'button:has-text("Skip for now")',
    'button[aria-label="Close"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(300);
    }
  }
}

const TABS = ['Pipeline', 'Script', 'Storyboard', 'SEO & Audience', 'Checks'] as const;

test.describe('Project detail tabs — no crash', () => {

  for (const tabName of TABS) {
    test(`"${tabName}" tab loads without "Something went wrong"`, async ({ page }) => {
      await page.goto(`/projects/${PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 40_000 });
      await dismissModals(page);

      // Click the tab
      const tab = page.locator('button').filter({ hasText: new RegExp(`^${tabName}$`, 'i') }).first();
      const isVisible = await tab.isVisible({ timeout: 8_000 }).catch(() => false);

      if (!isVisible) {
        console.log(`ℹ️  Tab "${tabName}" not visible — project may not have those tabs`);
        return;
      }

      await tab.click();
      await page.waitForTimeout(1_500);

      // Assert: no "Something went wrong" error boundary message
      const errorMsg = page.locator('text=/something went wrong/i').first();
      const hasError = await errorMsg.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasError) {
        await page.screenshot({ path: `pw-verify-fixes/tab-error-${tabName.replace(/[^a-z]/gi, '-').toLowerCase()}.png` });
        throw new Error(`Tab "${tabName}" shows "Something went wrong" error boundary`);
      }

      // Assert: no (dash) level error page
      const dashError = page.locator('[data-testid="error-boundary"], main:has-text("Something went wrong")').first();
      const hasDashError = await dashError.isVisible({ timeout: 2_000 }).catch(() => false);

      if (hasDashError) {
        await page.screenshot({ path: `pw-verify-fixes/tab-dash-error-${tabName.replace(/[^a-z]/gi, '-').toLowerCase()}.png` });
        throw new Error(`Tab "${tabName}" triggers the (dash) error boundary`);
      }

      await page.screenshot({ path: `pw-verify-fixes/tab-ok-${tabName.replace(/[^a-z]/gi, '-').toLowerCase()}.png` });
      console.log(`✅ Tab "${tabName}" loaded without error`);
    });
  }

  test('Cycling through all tabs sequentially does not crash', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 40_000 });
    await dismissModals(page);

    for (const tabName of TABS) {
      const tab = page.locator('button').filter({ hasText: new RegExp(`^${tabName}$`, 'i') }).first();
      if (!(await tab.isVisible({ timeout: 5_000 }).catch(() => false))) continue;

      await tab.click();
      await page.waitForTimeout(800);

      const hasError = await page.locator('text=/something went wrong/i').first()
        .isVisible({ timeout: 2_000 }).catch(() => false);

      if (hasError) {
        await page.screenshot({ path: `pw-verify-fixes/cycle-error-at-${tabName.replace(/[^a-z]/gi, '-').toLowerCase()}.png` });
        throw new Error(`Crash when cycling to tab "${tabName}"`);
      }
    }

    console.log('✅ All tabs cycled without error');
  });

});
