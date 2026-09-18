import { test, expect } from '@playwright/test';

// Desktop / laptop viewport — 1440×900
test.use({
  viewport: { width: 1440, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});

const mainForm = (page: import('@playwright/test').Page) =>
  page.locator('form').filter({
    has: page.locator('button').filter({ hasText: /sign in with password/i }),
  });

async function loginWithPassword(page: import('@playwright/test').Page) {
  await page.goto('/login');
  // When a stored JWT is in localStorage the login page useEffect auto-redirects.
  // Detect that and skip form-filling so the fill() calls don't race the redirect.
  const alreadyAuth = await page.waitForURL(
    /\/(home|projects|dashboard)/,
    { timeout: 4_000 },
  ).then(() => true).catch(() => false);
  if (alreadyAuth) return;

  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  await mainForm(page).locator('input[type="email"]').fill('sozialzync@gmail.com');
  await mainForm(page).locator('input[type="password"]').fill('Admin@123');
  await mainForm(page).locator('button').filter({ hasText: /sign in with password/i }).click();
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 30_000 });
}

async function openCopilotChat(page: import('@playwright/test').Page) {
  await page.locator('[title="Ask Copilot"]').click();
  await expect(page.locator('.cf-copilot-widget')).toBeVisible({ timeout: 10_000 });
  await page.locator('.cf-topic-btn').filter({ hasText: /^Chat$/ }).click();
  await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).toBeVisible({ timeout: 8_000 });
}

test.describe('Copilot panel — desktop smoke tests', () => {

  test('X close button closes the chat panel (not the whole widget)', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    await page.screenshot({ path: 'e2e/copilot-robo-after-tap.png' });

    // Confirm chat textarea is visible (panel is open)
    await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).toBeVisible();

    await page.locator('button[aria-label="Close panel"]').click();

    // Panel content (textarea) should be gone; widget (robot) stays visible
    await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.cf-copilot-widget')).toBeVisible();

    await page.screenshot({ path: 'e2e/copilot-panel-closed.png' });
  });

  test('panel reopens after close — Chat tab click brings it back', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    // Close the panel via X
    await page.locator('button[aria-label="Close panel"]').click();
    await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).not.toBeVisible({ timeout: 5_000 });

    // Reopen via Chat tab
    await page.locator('.cf-topic-btn').filter({ hasText: /^Chat$/ }).click();
    await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).toBeVisible({ timeout: 8_000 });

    await page.screenshot({ path: 'e2e/copilot-panel-reopened.png' });
  });

  test('resize handles are present — left edge and bottom-left corner', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    // Left-edge resize handle: 6px strip with ew-resize cursor and title "Drag to resize width"
    const leftHandle = page.locator('[title="Drag to resize width"]');
    await expect(leftHandle).toBeVisible({ timeout: 5_000 });
    const leftCursor = await leftHandle.evaluate((el: HTMLElement) => el.style.cursor);
    expect(leftCursor).toBe('ew-resize');

    // Bottom-left corner handle: title "Drag to resize"
    const cornerHandle = page.locator('[title="Drag to resize"]');
    await expect(cornerHandle).toBeVisible({ timeout: 5_000 });
    const cornerCursor = await cornerHandle.evaluate((el: HTMLElement) => el.style.cursor);
    expect(cornerCursor).toBe('sw-resize');

    await page.screenshot({ path: 'e2e/copilot-resize-handles.png' });
  });

  test('panel width changes when left edge is dragged', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    const panel = page.locator('.cf-copilot-widget > div > div').first();
    // Wait for panel to be positioned
    await page.waitForTimeout(500);

    const before = await page.locator('[title="Drag to resize width"]').boundingBox();
    if (!before) throw new Error('Left resize handle not found');

    const initialPanelBox = await panel.boundingBox();
    if (!initialPanelBox) throw new Error('Panel not found');

    // Drag the left edge 80px to the left (should widen the panel by ~80px)
    await page.mouse.move(before.x + 3, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + 3 - 80, before.y + before.height / 2, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(200);
    const afterPanelBox = await panel.boundingBox();
    if (!afterPanelBox) throw new Error('Panel not found after resize');

    // Panel should be wider by ~80px (allow ±20px tolerance)
    expect(afterPanelBox.width).toBeGreaterThan(initialPanelBox.width + 60);

    await page.screenshot({ path: 'e2e/copilot-panel-resized.png' });
  });

});
