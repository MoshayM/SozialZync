import { test, expect } from '@playwright/test';

// Desktop / laptop viewport — 1280×800, standard laptop
test.use({
  viewport: { width: 1280, height: 800 },
  // Standard desktop UA — no mobile keywords, maxTouchPoints will be 0
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});

test.describe('Laptop UI — passkey hidden + no layout shift', () => {
  test('login page: passkey "Sign in instantly" button is NOT shown on desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    // Wait for the useEffect that sets passkeySupported to run
    await page.waitForTimeout(500);

    const passkeyBtn = page.locator('button').filter({ hasText: 'Sign in instantly' });
    await expect(passkeyBtn).not.toBeVisible();

    await page.screenshot({ path: 'e2e/laptop-login.png' });
  });

  test('login page: email input does NOT have "webauthn" in autocomplete on desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);

    // On desktop passkeySupported=false → autoComplete="email" (no webauthn hint)
    const emailInput = page.locator('input[type="email"]').first();
    const autoComplete = await emailInput.getAttribute('autocomplete');
    expect(autoComplete).not.toContain('webauthn');

    await page.screenshot({ path: 'e2e/laptop-login-autocomplete.png' });
  });

  test('login page: form does not jump after load (no layout shift from session-expired banner)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });

    // Snapshot form Y position right after heading appears
    const emailInput = page.locator('input[type="email"]').first();
    const before = await emailInput.boundingBox();

    // Wait for any dynamic renders (banner, etc.)
    await page.waitForTimeout(1000);
    const after = await emailInput.boundingBox();

    // Email input should not shift by more than 4px
    expect(Math.abs((before?.y ?? 0) - (after?.y ?? 0))).toBeLessThan(4);

    await page.screenshot({ path: 'e2e/laptop-login-stable.png' });
  });

  test('home page: AI Channel Insight card does not flash (localStorage init)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });

    // Clear insight dismissal so card is expected to show
    await page.evaluate(() => localStorage.removeItem('cf_insight_dismissed'));
    await page.goto('/home');
    await page.waitForTimeout(2000);

    const insightCard = page.getByText(/ai channel insight/i);
    const wasVisible = await insightCard.isVisible();
    await page.waitForTimeout(800);
    const stillVisible = await insightCard.isVisible();

    // Should be stable — not flash in then out
    expect(wasVisible).toBe(stillVisible);

    await page.screenshot({ path: 'e2e/laptop-home.png' });
  });
});
