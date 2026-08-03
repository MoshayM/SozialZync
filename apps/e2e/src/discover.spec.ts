import { test, expect } from '@playwright/test';
import { setupApiMocks, setAuthToken } from './fixtures/api-mock';

const PROXY = 'http://localhost:3007/api/proxy';

const MOCK_AUDIENCE = {
  primaryDemographic: 'Tech enthusiasts 18-34',
  interestClusters: [
    { cluster: 'AI Tools', size: 'Large', engagement: 'High' },
    { cluster: 'Developer Productivity', size: 'Medium', engagement: 'High' },
  ],
  contentPreferences: ['Tutorial videos', 'Comparisons', 'News & Updates'],
  bestPostingTimes: ['Weekday mornings', 'Sunday afternoons'],
  growthTips: ['Focus on beginner-friendly content', 'Publish consistently 2x/week'],
};

async function setupDiscoverMocks(page: import('@playwright/test').Page) {
  await page.route(`${PROXY}/audience/analyze`, async (route) => {
    await route.fulfill({ json: MOCK_AUDIENCE });
  });
  await page.route(`${PROXY}/seo/optimize`, async (route) => {
    await route.fulfill({
      json: {
        searchKeywords: ['AI tools', 'productivity', 'automation'],
        tags: ['AI', 'productivity', 'tutorial'],
        optimizedTitle: 'Top AI Tools for Productivity in 2026',
        optimizedDescription: 'Discover the best AI tools to boost your productivity.',
      },
    });
  });
}

test.describe('Discover / Content Studio', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setupDiscoverMocks(page);
    await setAuthToken(page);
    await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');
  });

  test('discover page renders Content Studio', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Content Studio' })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByPlaceholder(/Niche, e.g. Tech tutorials/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
  });

  test('Trending Topics section prompts to set niche when empty', async ({ page }) => {
    await expect(page.getByText('Set your niche above to find trends')).toBeVisible({ timeout: 8_000 });
  });

  test('Find Trends button appears after setting niche and applying', async ({ page }) => {
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Technology');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('button', { name: 'Find Trends' })).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Find Trends shows interest clusters', async ({ page }) => {
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Technology');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Find Trends' }).click();
    await expect(page.getByText('AI Tools')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Developer Productivity')).toBeVisible();
  });

  test('audience results show Interest Clusters section', async ({ page }) => {
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Technology');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Find Trends' }).click();
    await expect(page.getByText('Interest Clusters')).toBeVisible({ timeout: 10_000 });
  });

  test('audience results show Content Preferences', async ({ page }) => {
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Technology');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Find Trends' }).click();
    await expect(page.getByText('Content Preferences')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Tutorial videos')).toBeVisible();
  });

  test('audience results show Growth Tips', async ({ page }) => {
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Technology');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Find Trends' }).click();
    await expect(page.getByText('Growth Tips')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Focus on beginner-friendly content')).toBeVisible();
  });

  test('Keywords & SEO section is visible', async ({ page }) => {
    await expect(page.getByText('Keywords & SEO')).toBeVisible({ timeout: 8_000 });
  });

  test('POSTs to /audience/analyze with correct niche', async ({ page }) => {
    let capturedBody: unknown = null;
    await page.route(`${PROXY}/audience/analyze`, async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({ json: MOCK_AUDIENCE });
    });
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Finance');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Find Trends' }).click();
    await expect.poll(() => capturedBody, { timeout: 5_000 }).toMatchObject({ niche: 'Finance' });
  });

  test('Optimize button is visible in Keywords & SEO section', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Optimize' })).toBeVisible({ timeout: 8_000 });
  });

  test('Discover tab remains active after page load', async ({ page }) => {
    await expect(page).toHaveURL(/content.*tab=discover|discover/);
  });

  test('Find Trends is disabled while fetching', async ({ page }) => {
    await page.route(`${PROXY}/audience/analyze`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ json: MOCK_AUDIENCE });
    });
    await page.getByPlaceholder(/Niche, e.g. Tech tutorials/i).fill('Technology');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Find Trends' }).click();
    await expect(page.getByRole('button', { name: 'Find Trends' })).toBeDisabled();
    await expect(page.getByText('AI Tools')).toBeVisible({ timeout: 10_000 });
  });
});
