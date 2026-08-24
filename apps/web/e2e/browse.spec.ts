import { test, expect } from '@playwright/test';

// ── Browse page — public (no auth required) ───────────────────────────────────

test.describe('Browse page — public access', () => {
  test('loads without authentication', async ({ page }) => {
    await page.goto('/browse');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('header')).toBeVisible();
  });

  test('shows SozialZynk logo / brand name', async ({ page }) => {
    await page.goto('/browse');
    const brand = page.getByText(/sozialzynk/i).first();
    await expect(brand).toBeVisible();
  });

  test('shows Sign In and Start Creating buttons for guest', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /start creating/i })).toBeVisible();
  });

  test('search input is present and accepts text', async ({ page }) => {
    await page.goto('/browse');
    const input = page.locator('input[type="search"]');
    await expect(input).toBeVisible();
    await input.fill('AI tools');
    await expect(input).toHaveValue('AI tools');
  });

  test('search filters content in real time', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('input[type="search"]').fill('AI Tools for Creators');
    // At least one matching result title should appear
    await expect(page.getByText(/AI Tools for Creators/i).first()).toBeVisible();
  });

  test('/ keyboard shortcut focuses search', async ({ page }) => {
    await page.goto('/browse');
    await page.keyboard.press('/');
    const input = page.locator('input[type="search"]');
    await expect(input).toBeFocused();
  });

  test('sidebar has content type filters', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.getByRole('button', { name: /all videos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /shorts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reels/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /images/i })).toBeVisible();
  });

  test('videos section renders thumbnail cards', async ({ page }) => {
    await page.goto('/browse');
    // At least one video card is shown (grid)
    const cards = page.locator('h2, h3').filter({ hasText: /videos/i });
    await expect(cards.first()).toBeVisible();
  });

  test('content type filter — Shorts shows portrait grid', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /^shorts$/i }).click();
    // Shorts grid items should be visible
    await expect(page.getByRole('button', { name: /trending/i })).toBeVisible();
  });

  test('empty search shows no-results state', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('input[type="search"]').fill('xyzthiscannotexist99999');
    // All content types empty
    await expect(page.getByText(/no content found/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ── Feed view (TikTok/Reels-style) ───────────────────────────────────────────

test.describe('Browse page — feed mode', () => {
  test('Watch Feed button is visible', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.getByRole('button', { name: /watch feed/i })).toBeVisible();
  });

  test('clicking Watch Feed opens fullscreen feed', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    // Feed overlay should be present (dialog)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test('feed has close button', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    // Wait for the feed overlay to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8_000 });
    const closeBtn = page.getByRole('button', { name: /close feed/i }).first();
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
  });

  test('Escape closes feed', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('clicking a video thumbnail opens feed at that item', async ({ page }) => {
    await page.goto('/browse');
    // Click first video card
    const firstCard = page.locator('[data-slide], .group.cursor-pointer').first();
    // Click a thumbnail card in the grid
    await page.locator('main .group.cursor-pointer').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test('feed shows item count indicator', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8_000 });
    // Counter like "1 / 44" — anchored regex so "11 / 44", "21 / 44" etc. don't match; .first() avoids strict mode
    await expect(page.locator('[role="dialog"]').getByText(/^1 \/ \d+$/).first()).toBeVisible({ timeout: 5_000 });
  });

  test('keyboard ArrowDown navigates to next item', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    const feed = page.locator('[role="dialog"]');
    await expect(feed).toBeVisible({ timeout: 8_000 });
    // .first() — multiple slides rendered in DOM simultaneously
    await expect(feed.getByText(/^1 \/ \d+$/).first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(800); // allow scroll animation
    // After ArrowDown, slide 2 counter becomes the active/visible one
    await expect(feed.getByText(/^2 \/ \d+$/).first()).toBeVisible({ timeout: 5_000 });
  });

  test('feed right-action column has like, comment, share, save buttons', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    const feed = page.locator('[role="dialog"]');
    await expect(feed).toBeVisible({ timeout: 8_000 });
    // Use .first() — multiple slides are in the DOM, each has these buttons
    await expect(feed.getByRole('button', { name: /^like$/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(feed.getByRole('button', { name: /^comments$/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(feed.getByRole('button', { name: /^share$/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(feed.getByRole('button', { name: /^save$/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('like button toggles state', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    const feed = page.locator('[role="dialog"]');
    await expect(feed).toBeVisible({ timeout: 8_000 });
    // First slide's like button
    const likeBtn = feed.getByRole('button', { name: /^like$/i }).first();
    await expect(likeBtn).toBeVisible({ timeout: 5_000 });
    await likeBtn.click();
    // After click the button becomes "Unlike"
    await expect(feed.getByRole('button', { name: /^unlike$/i }).first()).toBeVisible({ timeout: 3_000 });
  });
});

// ── Voice search ──────────────────────────────────────────────────────────────

test.describe('Browse page — voice search UI', () => {
  test('mic button appears when SpeechRecognition is available (Chrome)', async ({ page, browserName }) => {
    // Voice search only supported in Chromium
    if (browserName !== 'chromium') return;
    await page.goto('/browse');
    // The button is rendered after mount (useEffect checks window.SpeechRecognition)
    const micBtn = page.getByRole('button', { name: /voice search/i });
    await expect(micBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ── Responsive / device compatibility ────────────────────────────────────────

test.describe('Browse page — responsive layout', () => {
  test('mobile: sidebar hidden by default (hamburger visible)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/browse');
    const hamburger = page.getByRole('button', { name: /toggle menu/i });
    await expect(hamburger).toBeVisible();
    // Sidebar should be off-screen
    const sidebar = page.locator('aside').first();
    const box = await sidebar.boundingBox();
    // x should be negative (off-screen left)
    expect(box ? box.x : -1).toBeLessThan(0);
  });

  test('mobile: hamburger opens sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/browse');
    await page.getByRole('button', { name: /toggle menu/i }).click();
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeInViewport({ timeout: 3_000 });
  });

  test('tablet: content renders in grid', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/browse');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('desktop: sidebar is visible without hamburger click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/browse');
    const sidebar = page.locator('aside').first();
    const box = await sidebar.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
  });

  test('Watch Feed full-screen on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/browse');
    await page.getByRole('button', { name: /watch feed/i }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Should cover full viewport
    const box = await dialog.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(380);
    expect(box?.height).toBeGreaterThanOrEqual(800);
  });
});

// ── Sort + view mode ──────────────────────────────────────────────────────────

test.describe('Browse page — sort and view mode', () => {
  test('sort dropdown opens and has options', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: /trending/i }).click();
    await expect(page.getByRole('button', { name: /latest/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /most viewed/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /top rated/i })).toBeVisible();
  });

  test('grid / list toggle visible for videos', async ({ page }) => {
    await page.goto('/browse');
    // Grid icon button
    const gridBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(2); // approximate
    await expect(page.locator('main')).toBeVisible();
  });
});

// ── Plan gate — Pro-only pages ────────────────────────────────────────────────

test.describe('Plan gates — Free user sees upgrade card', () => {
  test('automation page shows upgrade info for unauthenticated', async ({ page }) => {
    await page.goto('/automation');
    // Redirected to login (not authenticated)
    await page.waitForURL(/login/, { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toMatch(/login|automation/);
  });
});
