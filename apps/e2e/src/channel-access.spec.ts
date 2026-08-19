import { test, expect, Page } from '@playwright/test';
import { setupApiMocks, setAuthToken } from './fixtures/api-mock';

const PROXY = 'http://localhost:3007/api/proxy';

// Mock Facebook media posts for accordion/feed tests
const MOCK_FB_POSTS = [
  {
    id: 'fb-post-1',
    type: 'photo',
    caption: 'Hello from Facebook!',
    mediaUrl: null,
    thumbnailUrl: null,
    permalink: 'https://www.facebook.com/post/1',
    timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    metrics: { likes: 42, comments: 7, shares: 3 },
  },
  {
    id: 'fb-post-2',
    type: 'video',
    caption: 'A test video post',
    mediaUrl: null,
    thumbnailUrl: null,
    permalink: 'https://www.facebook.com/post/2',
    timestamp: new Date(Date.now() - 7_200_000).toISOString(),
    metrics: { likes: 100, comments: 15 },
  },
];

// Register a route to make a platform appear connected (LIFO — call after setupApiMocks)
async function mockPlatformConnected(page: Page, platformId: string, accountName: string) {
  await page.route(`${PROXY}/platforms/connection-status`, async (route) => {
    await route.fulfill({ json: { [platformId]: { connected: true, accountName } } });
  });
}

// Register a route to serve platform media
async function mockPlatformMedia(page: Page, platformId: string, items = MOCK_FB_POSTS) {
  await page.route(new RegExp(`\\/api\\/proxy\\/platforms\\/${platformId}\\/media`), async (route) => {
    await route.fulfill({ json: { items, nextCursor: null, platformId, accountName: 'Test Account' } });
  });
}

test.describe('Channel Access — /settings/channels', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setAuthToken(page);
    // NOTE: page.goto is NOT called here — each test navigates to its own URL
    // so that tests can register route overrides before navigation.
  });

  // ── Page structure ────────────────────────────────────────────────────────

  test('page loads with "Channel Access" heading', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Channel Access', level: 1 })).toBeVisible({ timeout: 10_000 });
  });

  test('YouTube Channels section is visible', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2').filter({ hasText: 'YouTube Channels' })).toBeVisible({ timeout: 10_000 });
  });

  test('Social Platforms section is visible', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2').filter({ hasText: 'Social Platforms' })).toBeVisible({ timeout: 10_000 });
  });

  // ── YouTube empty state ───────────────────────────────────────────────────

  test('shows empty state and Connect with Google when no YouTube channel', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No YouTube account connected yet')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /connect with google/i })).toBeVisible({ timeout: 8_000 });
  });

  test('URL add form appears when "Add by YouTube channel URL" is clicked', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /add by youtube channel url/i }).click();
    await expect(page.getByPlaceholder(/youtube\.com\/@channelname/i)).toBeVisible({ timeout: 5_000 });
  });

  test('URL add form shows error for invalid input', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /add by youtube channel url/i }).click();
    await page.getByPlaceholder(/youtube\.com\/@channelname/i).fill('not-a-valid-channel');
    // Click the Add button
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText(/enter a youtube channel url/i)).toBeVisible({ timeout: 5_000 });
  });

  test('URL add form succeeds with valid @handle', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /add by youtube channel url/i }).click();
    await page.getByPlaceholder(/youtube\.com\/@channelname/i).fill('@mkbhd');
    await page.getByRole('button', { name: /^add$/i }).click();
    // Mock returns a channel with the handle slug as title → success banner
    await expect(page.getByText(/added in read-only mode/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Social Platforms: available platforms ─────────────────────────────────

  test('Facebook is listed', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    // Look for platform name in the Social Platforms section
    const socialSection = page.locator('section').filter({ hasText: 'Social Platforms' });
    await expect(socialSection.locator('p.font-medium').filter({ hasText: /^Facebook$/ })).toBeVisible({ timeout: 10_000 });
  });

  test('Instagram is listed', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    const socialSection = page.locator('section').filter({ hasText: 'Social Platforms' });
    await expect(socialSection.locator('p.font-medium').filter({ hasText: /^Instagram$/ })).toBeVisible({ timeout: 10_000 });
  });

  test('TikTok shows "Coming soon" badge', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Coming soon').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Connect button is enabled for Facebook when not connected', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    // The header-row Connect button for available-but-disconnected platforms
    const socialSection = page.locator('section').filter({ hasText: 'Social Platforms' });
    const connectBtns = socialSection.getByRole('button', { name: /^connect$/i });
    // Facebook and Instagram both have an enabled Connect button
    await expect(connectBtns.first()).toBeEnabled({ timeout: 10_000 });
  });

  test('not-connected available platforms show inline "Connect <Platform> →" CTA', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    // Inline CTAs inside the dashed "empty" panel for Facebook and Instagram
    await expect(page.getByRole('button', { name: /Connect Facebook →/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Connect Instagram →/i })).toBeVisible({ timeout: 10_000 });
  });

  // ── No duplicate platform entries ─────────────────────────────────────────

  test('each social platform appears exactly once in the panel', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    const socialSection = page.locator('section').filter({ hasText: 'Social Platforms' });
    // Count the platform-name paragraphs — exact match avoids "Facebook not connected" false positives
    const fbNames = socialSection.locator('p.font-medium').filter({ hasText: /^Facebook$/ });
    const igNames = socialSection.locator('p.font-medium').filter({ hasText: /^Instagram$/ });
    const tkNames = socialSection.locator('p.font-medium').filter({ hasText: /^TikTok$/ });
    await expect(fbNames).toHaveCount(1, { timeout: 10_000 });
    await expect(igNames).toHaveCount(1, { timeout: 10_000 });
    await expect(tkNames).toHaveCount(1, { timeout: 10_000 });
  });

  // ── OAuth error banners ───────────────────────────────────────────────────

  test('?error=instagram_auth_failed shows Instagram error banner', async ({ page }) => {
    await page.goto('/settings/channels?error=instagram_auth_failed');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/instagram connection failed/i)).toBeVisible({ timeout: 10_000 });
  });

  test('?error=no_instagram_business_account shows descriptive error banner', async ({ page }) => {
    await page.goto('/settings/channels?error=no_instagram_business_account');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/instagram connected but not linked to a facebook page/i)).toBeVisible({ timeout: 10_000 });
  });

  test('?error=no_facebook_pages shows descriptive error banner', async ({ page }) => {
    await page.goto('/settings/channels?error=no_facebook_pages');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/your facebook account has no pages/i)).toBeVisible({ timeout: 10_000 });
  });

  test('?error=facebook_auth_failed shows Facebook error banner', async ({ page }) => {
    await page.goto('/settings/channels?error=facebook_auth_failed');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/facebook connection failed/i)).toBeVisible({ timeout: 10_000 });
  });

  test('?error=access_denied shows cancellation message', async ({ page }) => {
    await page.goto('/settings/channels?error=access_denied');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/connection cancelled/i)).toBeVisible({ timeout: 10_000 });
  });

  test('error banner can be dismissed', async ({ page }) => {
    await page.goto('/settings/channels?error=instagram_auth_failed');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('[class*="bg-red-50"]').first();
    await expect(banner).toBeVisible({ timeout: 10_000 });
    // Dismiss button is inside the banner (X icon, no aria-label)
    await banner.getByRole('button').click();
    await expect(page.getByText(/instagram connection failed/i)).toHaveCount(0, { timeout: 5_000 });
  });

  // ── OAuth success banner ──────────────────────────────────────────────────

  test('?connected=facebook shows success banner', async ({ page }) => {
    await mockPlatformConnected(page, 'facebook', 'Sozial Zync');
    await page.goto('/settings/channels?connected=facebook');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/facebook connected successfully/i)).toBeVisible({ timeout: 10_000 });
  });

  test('?connected=instagram shows Instagram success banner', async ({ page }) => {
    await mockPlatformConnected(page, 'instagram', '@sozialzync');
    await page.goto('/settings/channels?connected=instagram');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/instagram connected successfully/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Connected platform: accordion ─────────────────────────────────────────

  test('connected Facebook shows account name and Disconnect button', async ({ page }) => {
    await mockPlatformConnected(page, 'facebook', 'Sozial Zync');
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    // Account name should appear as "Connected · Sozial Zync"
    await expect(page.getByText('Sozial Zync')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /disconnect/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('clicking connected Facebook row expands the media feed', async ({ page }) => {
    await mockPlatformConnected(page, 'facebook', 'Sozial Zync');
    await mockPlatformMedia(page, 'facebook');
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    // Expand by clicking the row (the "Connected · Sozial Zync" text is inside the cursor-pointer div)
    await page.getByText('Sozial Zync').click();
    // Feed filter tabs should appear
    await expect(page.locator('.bg-gray-100.rounded-lg').filter({ hasText: /^All/ })).toBeVisible({ timeout: 10_000 });
  });

  test('clicking expanded Facebook row collapses the media feed', async ({ page }) => {
    await mockPlatformConnected(page, 'facebook', 'Sozial Zync');
    await mockPlatformMedia(page, 'facebook');
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    const row = page.getByText('Sozial Zync');
    // Expand
    await row.click();
    await expect(page.locator('.bg-gray-100.rounded-lg').filter({ hasText: /^All/ })).toBeVisible({ timeout: 10_000 });
    // Collapse
    await row.click();
    await expect(page.locator('.bg-gray-100.rounded-lg').filter({ hasText: /^All/ })).toHaveCount(0, { timeout: 5_000 });
  });

  test('media feed filter tabs switch correctly', async ({ page }) => {
    await mockPlatformConnected(page, 'facebook', 'Sozial Zync');
    await mockPlatformMedia(page, 'facebook');
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await page.getByText('Sozial Zync').click();
    const tabBar = page.locator('.bg-gray-100.rounded-lg').filter({ hasText: /^All/ });
    await expect(tabBar).toBeVisible({ timeout: 10_000 });
    // All Photos Videos Reels Albums tabs should all be present
    await expect(tabBar.getByRole('button').filter({ hasText: 'All' })).toBeVisible();
    await expect(tabBar.getByRole('button').filter({ hasText: 'Photos' })).toBeVisible();
    await expect(tabBar.getByRole('button').filter({ hasText: 'Videos' })).toBeVisible();
    // Click Photos tab
    await tabBar.getByRole('button').filter({ hasText: 'Photos' }).click();
    // Active tab should now be Photos (highlighted with white bg in the bar)
    await expect(tabBar.getByRole('button').filter({ hasText: 'Photos' })).toBeVisible();
  });

  test('media feed shows "No posts found" when API returns empty items', async ({ page }) => {
    await mockPlatformConnected(page, 'facebook', 'Sozial Zync');
    // Override media to return empty
    await page.route(/\/api\/proxy\/platforms\/facebook\/media/, async (route) => {
      await route.fulfill({ json: { items: [], nextCursor: null, platformId: 'facebook', accountName: 'Sozial Zync' } });
    });
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await page.getByText('Sozial Zync').click();
    await expect(page.getByText(/no.*posts found/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────

  test('Disconnect removes platform and shows info banner', async ({ page }) => {
    let fbConnected = true;
    // Status endpoint flips after disconnect
    await page.route(`${PROXY}/platforms/connection-status`, async (route) => {
      await route.fulfill({ json: fbConnected ? { facebook: { connected: true, accountName: 'Sozial Zync' } } : {} });
    });
    await page.route(/\/api\/proxy\/platforms\/facebook\/disconnect/, async (route) => {
      fbConnected = false;
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /disconnect/i }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /disconnect/i }).first().click();
    await expect(page.getByText(/facebook disconnected/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Channel Media library section ─────────────────────────────────────────

  test('Channel Media section is present on the page', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Channel Media')).toBeVisible({ timeout: 10_000 });
  });

  test('YouTube accordion in Channel Media opens by default', async ({ page }) => {
    await page.goto('/settings/channels');
    await page.waitForLoadState('networkidle');
    // YouTube accordion is open by default — show "Not connected" state since no channel mocked
    await expect(page.getByText('YouTube not connected').first()).toBeVisible({ timeout: 10_000 });
  });
});
