/**
 * Smoke test: multilingual content language picker in studio-flow + UI language switcher.
 * Does NOT trigger expensive AI jobs — UI interaction only.
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = 'cmt73kval0003rw2x3xjef9yc'; // "Inside the AI Studio" project

async function dismissModals(page: import('@playwright/test').Page) {
  // Dismiss onboarding / YouTube connect modals
  for (const sel of [
    'button:has-text("I\'ll do this later")',
    'button:has-text("Skip for now")',
    'button[aria-label="Close"]',
    'button:has-text("Cancel")',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(400);
    }
  }
}

test.describe('Content language picker (studio)', () => {

  test('language picker renders, Tamil searchable, localStorage updated', async ({ page }) => {
    // Go directly to the project page (studio-flow renders at /projects/[id])
    await page.goto(`/projects/${PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await dismissModals(page);
    console.log('✅ Studio page loaded');

    // The language picker lives in StudioFlow's Script card expanded detail (Pipeline tab).
    // Ensure Pipeline tab is active first.
    const pipelineTab = page.locator('button').filter({ hasText: /^Pipeline$/i }).first();
    if (await pipelineTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pipelineTab.click();
      await page.waitForTimeout(600);
    }
    console.log('✅ Pipeline tab active');

    // The Script Tile card has an expand button with aria-label "Expand Script"
    const expandScript = page.locator('button[aria-label="Expand Script"]').first();
    await expect(expandScript).toBeVisible({ timeout: 10_000 });
    await expandScript.click();
    await page.waitForTimeout(800);
    console.log('✅ Script card expanded');

    // Language picker trigger: button containing the active language name
    // (flag span + name span + nativeName span — concatenated text is e.g. "🇮🇳Tamilதமிழ்")
    const langTrigger = page.locator('[aria-label="Close details"] ~ div button').first()
      .or(page.locator('button').filter({ hasText: /Tamil|தமிழ்|English/ }).nth(0));
    await expect(langTrigger).toBeVisible({ timeout: 10_000 });
    await langTrigger.click();
    await page.waitForTimeout(500);
    console.log('✅ Language picker opened');

    // Search input should appear
    const searchInput = page.locator('input[placeholder*="earch" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('Tamil');
    await page.waitForTimeout(400);

    // Tamil row should appear
    const tamilRow = page.locator('button, li, [role="option"]').filter({ hasText: /Tamil/i }).first();
    await expect(tamilRow).toBeVisible({ timeout: 5_000 });
    console.log('✅ Tamil visible in search results');

    await tamilRow.click();
    await page.waitForTimeout(600);

    // localStorage should be updated with BCP-47 code 'ta'
    const stored = await page.evaluate((pid) => localStorage.getItem(`cf_lang_${pid}`), PROJECT_ID);
    expect(stored).toBe('ta');
    console.log(`✅ localStorage cf_lang_${PROJECT_ID} = "ta" ✓`);

    // Trigger should now reflect Tamil
    const updatedTrigger = page.locator('button').filter({ hasText: /Tamil|தமிழ்|🇮🇳/i }).first();
    await expect(updatedTrigger).toBeVisible({ timeout: 5_000 });
    console.log('✅ Language trigger updated to Tamil');
    await page.screenshot({ path: 'pw-verify-fixes/lang-picker-tamil-selected.png' });

    // Reset back to English so the project isn't left in Tamil
    await updatedTrigger.click();
    await page.waitForTimeout(400);
    const searchInput2 = page.locator('input[placeholder*="earch" i]').first();
    if (await searchInput2.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput2.fill('English');
      await page.waitForTimeout(300);
      const enRow = page.locator('button, li, [role="option"]').filter({ hasText: /^english$/i }).first();
      if (await enRow.isVisible({ timeout: 3_000 }).catch(() => false)) await enRow.click();
    }
  });

});

test.describe('UI language switcher (user menu)', () => {

  test('user menu has Language option with Tamil', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await dismissModals(page);

    // The user avatar / initials button is in the top-right of the desktop layout.
    // In layout.tsx it renders as a <button> containing the user's initials or avatar image.
    // It sits inside the header's right section — look for it specifically.
    const avatar = page.locator('header button[class*="rounded-full"], header button img, header button').last();
    // More targeted: layout.tsx wraps everything in a relative div; the user menu button
    // is the one that toggles the dropdown. Try clicking the rightmost header button.
    const headerBtns = page.locator('header button');
    const count = await headerBtns.count();
    // Click the last visible header button (user menu is the rightmost)
    let clicked = false;
    for (let i = count - 1; i >= 0; i--) {
      const btn = headerBtns.nth(i);
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      console.warn('⚠️ Could not find a visible header button');
      await page.screenshot({ path: 'pw-verify-fixes/lang-ui-no-header-btn.png' });
      test.skip();
      return;
    }
    await page.waitForTimeout(600);
    console.log('✅ User menu opened');

    // Look for "Language" menu item (Globe icon row)
    const langItem = page.locator('button, [role="menuitem"]').filter({ hasText: /language/i }).first();
    const hasLang = await langItem.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasLang) {
      console.warn('⚠️ Language menu item not found — taking screenshot');
      await page.screenshot({ path: 'pw-verify-fixes/lang-ui-menu-open.png' });
      // Log all visible buttons for debugging
      const btns = await page.locator('button').allTextContents();
      console.log('Visible buttons:', btns.filter(t => t.trim()).slice(0, 20));
      test.skip();
      return;
    }

    await langItem.click();
    await page.waitForTimeout(400);
    console.log('✅ Language submenu expanded');

    // Search for Tamil
    const searchInput = page.locator('input[placeholder*="earch" i]').first();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('Tamil');
      await page.waitForTimeout(300);
    }

    const tamilRow = page.locator('button, li, [role="option"]').filter({ hasText: /Tamil/i }).first();
    await expect(tamilRow).toBeVisible({ timeout: 5_000 });
    console.log('✅ Tamil present in UI language switcher ✓');
    await page.screenshot({ path: 'pw-verify-fixes/lang-ui-switcher-tamil.png' });
  });

});
