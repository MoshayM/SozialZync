/**
 * E2E: AI Edit floating panel behaviour
 *
 * Verifies the new glass floating-panel design introduced in 504a41f:
 *   1. No solid dark backdrop — panel floats over a transparent overlay
 *   2. aria-modal="false" — interaction with background elements is allowed
 *   3. Panel is positioned at the bottom of the viewport, not centred
 *   4. Collapse button shrinks panel to header-only
 *   5. Expand button restores chat area and input bar
 *   6. On desktop the panel is right-anchored, not full-width
 */
import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

test.beforeEach(async ({}, testInfo) => { testInfo.setTimeout(300_000); });

// ── helpers ────────────────────────────────────────────────────────────────────

async function goToEditor(page: Page) {
  await page.goto('/editor');
  const landed = await Promise.race([
    page.waitForURL(/\/editor\/.+/, { timeout: 30_000 }).then(() => 'editor' as const),
    page.waitForURL(/\/login/,      { timeout: 30_000 }).then(() => 'login'  as const),
  ]).catch(() => 'editor' as const);

  if (landed !== 'login') return;
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
  await page.goto('/editor');
  await page.waitForURL(/\/editor\/.+/, { timeout: 60_000 });
}

const dlg = (page: Page) => page.getByRole('dialog', { name: /ai edit assistant/i });

async function openPanel(page: Page) {
  await page.getByTitle('AI edit').click();
  await expect(dlg(page)).toBeVisible({ timeout: 10_000 });
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('AI Edit — floating glass panel', () => {

  test('no dark backdrop — overlay is transparent (pointer-events-none)', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);

    // The DIRECT parent of the AI Edit dialog must be pointer-events-none with no dark fill.
    // OLD: parent had bg-black/50 (modal backdrop).  NEW: parent is transparent pass-through.
    const parentClass = await dlg(page).evaluate((el: HTMLElement) => el.parentElement?.className ?? '');
    expect(parentClass).toContain('pointer-events-none');
    expect(parentClass).not.toContain('bg-black');

    await page.screenshot({ path: 'e2e/ai-edit-float-no-backdrop.png' });
  });

  test('aria-modal is false — panel does not trap focus like a modal', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);

    const ariaModal = await dlg(page).getAttribute('aria-modal');
    expect(ariaModal).toBe('false');
  });

  test('panel is positioned near the bottom of the viewport, not centred', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);

    const vp  = page.viewportSize()!;
    const box = await dlg(page).boundingBox();
    expect(box).not.toBeNull();

    // Bottom edge of the panel must be in the lower 40% of the viewport
    const bottomEdge = box!.y + box!.height;
    expect(bottomEdge).toBeGreaterThan(vp.height * 0.6);

    await page.screenshot({ path: 'e2e/ai-edit-float-position.png' });
  });

  test('collapse button hides chat area and input — panel shrinks to header', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);
    const d = dlg(page);

    // Textarea is visible before collapse
    await expect(d.locator('textarea')).toBeVisible({ timeout: 5_000 });

    // Click collapse
    await d.getByRole('button', { name: /collapse panel/i }).click();

    // Textarea must no longer be visible
    await expect(d.locator('textarea')).not.toBeVisible({ timeout: 3_000 });

    // Header (AI Edit title) must still be visible
    await expect(d.getByText('AI Edit')).toBeVisible();

    await page.screenshot({ path: 'e2e/ai-edit-float-collapsed.png' });
  });

  test('expand button restores chat area and input bar', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);
    const d = dlg(page);

    // Collapse first
    await d.getByRole('button', { name: /collapse panel/i }).click();
    await expect(d.locator('textarea')).not.toBeVisible({ timeout: 3_000 });

    // Expand
    await d.getByRole('button', { name: /expand panel/i }).click();
    await expect(d.locator('textarea')).toBeVisible({ timeout: 3_000 });

    await page.screenshot({ path: 'e2e/ai-edit-float-expanded.png' });
  });

  test('desktop: panel is right-anchored and narrower than the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);

    const vp  = page.viewportSize()!;
    const box = await dlg(page).boundingBox();
    expect(box).not.toBeNull();

    // Panel width ≤ 420px (sm:w-[400px] + border)
    expect(box!.width).toBeLessThan(430);

    // Panel right edge ≤ viewport right edge
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 5);

    // Panel is not full-width (not a modal)
    expect(box!.width).toBeLessThan(vp.width * 0.5);

    await page.screenshot({ path: 'e2e/ai-edit-float-desktop.png' });
  });

  test('mobile: panel floats above tab bar without covering full screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);

    const vp  = page.viewportSize()!;
    const box = await dlg(page).boundingBox();
    expect(box).not.toBeNull();

    // Panel must NOT be full-height (it's a floating card, not a modal sheet)
    expect(box!.height).toBeLessThan(vp.height * 0.85);

    // Textarea is still accessible inside the panel
    await expect(dlg(page).locator('textarea')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'e2e/ai-edit-float-mobile.png' });
  });

  test('collapsed panel shows voice status bar — no text input, mic/speaker in header', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);
    const d = dlg(page);

    // Collapse the panel
    await d.getByRole('button', { name: /collapse panel/i }).click();
    await expect(d.locator('textarea')).not.toBeVisible({ timeout: 3_000 });

    // Compact text input must NOT be visible (replaced by pure voice mode)
    await expect(d.locator('input[placeholder*="message"]')).not.toBeVisible({ timeout: 2_000 });

    // Mic and speaker buttons must be in the header (always accessible)
    await expect(d.getByRole('button', { name: /voice input/i })).toBeVisible();
    await expect(d.getByRole('button', { name: /toggle voice replies/i })).toBeVisible();

    // Voice status bar shows idle hint text
    await expect(d.getByText(/tap mic to speak/i)).toBeVisible({ timeout: 3_000 });

    // Language selector pills must be visible
    await expect(d.getByRole('button', { name: 'EN' })).toBeVisible({ timeout: 3_000 });
    await expect(d.getByRole('button', { name: 'TA' })).toBeVisible({ timeout: 3_000 });

    // AI Edit title still visible
    await expect(d.getByText('AI Edit')).toBeVisible();

    await page.screenshot({ path: 'e2e/ai-edit-float-collapsed-voice.png' });
  });

  test('Escape key still closes the floating panel', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openPanel(page);

    await page.keyboard.press('Escape');
    await expect(dlg(page)).not.toBeVisible({ timeout: 5_000 });
  });
});
