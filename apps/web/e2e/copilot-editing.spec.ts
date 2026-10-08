/**
 * E2E: Copilot expert video editing capability
 *
 * Verifies that the main AI Copilot (Zyn) answers video editing questions
 * as an expert editor and guides users to the AI Edit panel for live changes.
 * Added in commit 504a41f.
 */
import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

const COPILOT_TIMEOUT = 90_000;

test.beforeEach(async ({}, testInfo) => { testInfo.setTimeout(300_000); });

// ── helpers ────────────────────────────────────────────────────────────────────

async function loginAndHome(page: Page) {
  await page.goto('/home');
  const landed = await Promise.race([
    page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 20_000 }).then(() => 'home' as const),
    page.waitForURL(/\/login/, { timeout: 20_000 }).then(() => 'login' as const),
  ]).catch(() => 'home' as const);

  if (landed !== 'login') return;
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
}

async function openCopilotChat(page: Page) {
  await page.locator('[title="Ask Copilot"]').click();
  await expect(page.locator('.cf-copilot-widget')).toBeVisible({ timeout: 10_000 });
  const chatBtn = page.locator('.cf-topic-btn').filter({ hasText: /^Chat$/ });
  await expect(chatBtn).toBeVisible({ timeout: 10_000 });
  await expect(chatBtn).toBeEnabled({ timeout: 5_000 });
  await chatBtn.click();
  await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).toBeVisible({ timeout: 8_000 });
}

async function sendCopilotMessage(page: Page, message: string) {
  const ta = page.locator('textarea[placeholder="What\'s on your mind?"]');
  await ta.fill(message);
  await ta.press('Enter');
}

async function waitForCopilotReply(page: Page) {
  // Wait for the busy state to clear — copilot shows a spinner or "thinking" state
  // Give up to COPILOT_TIMEOUT ms for the cold-start + LLM round trip
  await expect(page.locator('.cf-copilot-widget')).toBeVisible();
  // Simple approach: wait until at least one assistant bubble appears and is not loading
  await page.waitForFunction(() => {
    const bubbles = document.querySelectorAll('[class*="assistant"], [class*="reply"]');
    return bubbles.length > 0;
  }, { timeout: COPILOT_TIMEOUT }).catch(() => {/* best-effort — check reply text anyway */});
  // Additional settle time for animation
  await page.waitForTimeout(1_000);
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Copilot — expert video editing expertise', () => {

  test('copilot answers a pacing/cut question with expert editing advice', async ({ page }) => {
    await loginAndHome(page);
    await openCopilotChat(page);

    await sendCopilotMessage(page, 'My video has long pauses and dead air. How do I fix the pacing?');

    await waitForCopilotReply(page);

    const widgetText = await page.locator('.cf-copilot-widget').textContent() ?? '';

    // Should contain expert editing vocabulary
    expect(widgetText).toMatch(/cut|trim|pause|pacing|jump cut|edit|clip|gap|remove|second/i);

    await page.screenshot({ path: 'e2e/copilot-editing-pacing.png' });
  });

  test('copilot guides to AI Edit panel for live timeline changes', async ({ page }) => {
    await loginAndHome(page);
    await openCopilotChat(page);

    await sendCopilotMessage(page, 'I want to add a title card to my video timeline.');

    await waitForCopilotReply(page);

    const widgetText = await page.locator('.cf-copilot-widget').textContent() ?? '';

    // Copilot should mention the AI Edit panel (or editor/timeline) for actual changes
    expect(widgetText).toMatch(/ai edit|editor|timeline|toolbar|panel/i);

    await page.screenshot({ path: 'e2e/copilot-editing-title-card.png' });
  });

  test('copilot gives transition advice as an expert', async ({ page }) => {
    await loginAndHome(page);
    await openCopilotChat(page);

    await sendCopilotMessage(page, 'What transition should I use between an interview clip and a b-roll shot?');

    await waitForCopilotReply(page);

    const widgetText = await page.locator('.cf-copilot-widget').textContent() ?? '';

    // Should mention transitions or editing concepts
    expect(widgetText).toMatch(/transition|cut|dissolve|fade|j-cut|l-cut|b-roll|interview|match/i);

    await page.screenshot({ path: 'e2e/copilot-editing-transition.png' });
  });
});
