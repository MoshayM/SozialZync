/**
 * E2E: AI Edit dialog
 *
 * Covers:
 *   1. Dialog opens and displays correct initial UI elements
 *   2. New suggestion chips ("Analyze" + "Prepare for publish") visible
 *   3. Voice output toggle button in header; mic button in input bar
 *   4. Sending a message → AI replies without the generic validation error
 *   5. Per-message speak button appears on assistant replies
 *   6. Analysis chip → analysis response, not the generic error
 *   7. Voice output toggle switches title correctly (on ↔ off)
 *   8. Mobile layout: dialog fills viewport height, textarea stays visible
 */
import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

/** Max wait for a full AI round-trip (cold Railway + LLM latency). */
const AI_TIMEOUT = 90_000;

/** The exact text from the OLD broken validation path — must never appear. */
const GENERIC_ERROR = 'Some proposed changes could not be validated';

test.beforeEach(async ({}, testInfo) => { testInfo.setTimeout(300_000); });

// ── Helpers ────────────────────────────────────────────────────────────────────

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

async function openDialog(page: Page) {
  await page.getByTitle('AI edit').click();
  await expect(dlg(page)).toBeVisible({ timeout: 10_000 });
}

/**
 * Wait for the AI typing indicator ("Thinking…") to go away.
 * Using `not.toBeVisible` covers both the fast-response case (never appeared)
 * and the normal case (appeared then disappeared).
 */
async function waitForAiReply(page: Page) {
  await expect(dlg(page).getByText('Thinking…')).not.toBeVisible({ timeout: AI_TIMEOUT });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('AI Edit dialog — UI', () => {
  test('dialog opens with header, suggestion chips, and input controls', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);
    const d = dlg(page);

    // Header title
    await expect(d.getByText('AI Edit')).toBeVisible();

    // Voice output toggle (speaker icon) in header
    await expect(d.getByRole('button', { name: /toggle voice replies/i })).toBeVisible();

    // Mic input button in input bar
    await expect(d.getByRole('button', { name: /voice input/i })).toBeVisible();

    // Target chip buttons explicitly (avoids matching the description text)
    await expect(d.getByRole('button', { name: /analyze.*what needs editing/i })).toBeVisible();
    await expect(d.getByRole('button', { name: /prepare for publish/i })).toBeVisible();
    await expect(d.getByRole('button', { name: /add all files to the timeline/i })).toBeVisible();
    await expect(d.getByRole('button', { name: /extend background music/i })).toBeVisible();

    // Textarea present
    await expect(d.locator('textarea')).toBeVisible();

    await page.screenshot({ path: 'e2e/ai-edit-initial.png' });
  });

  test('dialog closes via the X button', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);

    await dlg(page).getByRole('button', { name: /close/i }).click();
    await expect(dlg(page)).not.toBeVisible({ timeout: 5_000 });
  });

  test('dialog closes via Escape key', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);

    await page.keyboard.press('Escape');
    await expect(dlg(page)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('AI Edit dialog — voice output toggle', () => {
  test('speaker toggle switches between off and on states', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);

    const voiceBtn = dlg(page).getByRole('button', { name: /toggle voice replies/i });

    // Default: off
    await expect(voiceBtn).toHaveAttribute('title', /off.*click to enable/i);

    // Toggle on
    await voiceBtn.click();
    await expect(voiceBtn).toHaveAttribute('title', /on.*click to disable/i);

    // Toggle back off
    await voiceBtn.click();
    await expect(voiceBtn).toHaveAttribute('title', /off.*click to enable/i);
  });
});

test.describe('AI Edit dialog — AI interaction', () => {
  test('sends a question and AI replies without the generic validation error', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);
    const d = dlg(page);

    // Send a simple informational question — no timeline mutation required
    await d.locator('textarea').fill('What files are on my timeline right now?');
    await d.locator('textarea').press('Enter');

    // Wait for AI to finish responding
    await waitForAiReply(page);

    await page.screenshot({ path: 'e2e/ai-edit-reply.png' });

    const text = await d.textContent();
    expect(text).not.toContain(GENERIC_ERROR);

    // Per-message speak button should appear on the AI reply bubble
    await expect(d.getByRole('button', { name: /read message aloud/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Analyze chip gets a structured response, not the generic error', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);
    const d = dlg(page);

    // Click the "Analyze" suggestion chip (target the button, not description text)
    await d.getByRole('button', { name: /analyze.*what needs editing/i }).click();

    await waitForAiReply(page);

    await page.screenshot({ path: 'e2e/ai-edit-analysis.png' });

    const text = await d.textContent();
    expect(text).not.toContain(GENERIC_ERROR);
    // Analysis responses should contain edit-related keywords or numbered suggestions
    expect(text).toMatch(/\d\.|edit|clip|timeline|transition|filler|pause|suggest|Would you like/i);
  });

  test('Prepare for publish chip responds without error', async ({ page }) => {
    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);
    const d = dlg(page);

    // Click by role to avoid strict-mode collision with description text
    await d.getByRole('button', { name: /prepare for publish/i }).click();

    await waitForAiReply(page);

    await page.screenshot({ path: 'e2e/ai-edit-publish.png' });

    const text = await d.textContent();
    expect(text).not.toContain(GENERIC_ERROR);
  });
});

test.describe('AI Edit dialog — mobile layout', () => {
  test('dialog fills viewport height on mobile, textarea stays visible', async ({ page }) => {
    // Simulate a common Android phone (360×740)
    await page.setViewportSize({ width: 360, height: 740 });

    await goToEditor(page);
    await page.waitForLoadState('networkidle');

    // AI Edit button is visible on all screen sizes
    await openDialog(page);
    const d = dlg(page);

    // Textarea must be visible (not cut off below fold)
    await expect(d.locator('textarea')).toBeVisible({ timeout: 5_000 });

    // Dialog should occupy most of the 740px viewport (h-dvh on mobile ≈ 740px)
    const box = await d.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(600);

    // The mobile bottom tab bar (Media/Inspect/Tools) must be hidden behind the dialog
    // — it's at z-[60], the dialog overlay is z-[100]
    const tabBar = page.locator('nav.lg\\:hidden').filter({ hasText: /media|inspect|tools/i });
    if (await tabBar.count() > 0) {
      const tabBox = await tabBar.boundingBox();
      // Either the tab bar is outside the dialog bounds or overlapped by the dialog
      if (tabBox && box) {
        // Tab bar must not be ABOVE the dialog's bottom — it should be covered by z-[100] overlay
        expect(box.y + box.height).toBeGreaterThanOrEqual(tabBox.y);
      }
    }

    await page.screenshot({ path: 'e2e/ai-edit-mobile.png' });
  });

  test('mobile: input bar (textarea + send button) visible at the bottom', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14

    await goToEditor(page);
    await page.waitForLoadState('networkidle');
    await openDialog(page);
    const d = dlg(page);

    const textarea = d.locator('textarea');
    const sendBtn  = d.getByRole('button', { name: /send/i });

    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });

    // Textarea bottom edge must be within the visible viewport
    const vp   = page.viewportSize()!;
    const tBox = await textarea.boundingBox();
    expect(tBox).not.toBeNull();
    expect(tBox!.y + tBox!.height).toBeLessThanOrEqual(vp.height + 5); // ±5px tolerance
  });
});
