import { test, expect, type Page } from '@playwright/test';
import { setupApiMocks, setAuthToken } from './fixtures/api-mock';

// Browser routes all API calls through the Next.js proxy — never directly to port 4007.
const PROXY = 'http://localhost:3007/api/proxy';

const MOCK_METRICS = {
  mrr: 250_000,
  arr: 3_000_000,
  revenueByMonth: [100_000, 120_000, 150_000, 180_000, 210_000, 250_000],
  arpu: 1_900,
  ltv: 45_000,
  churn: 0.042,
  aiCostUsd: 812.5,
  cacheSavingsUsd: 137.25,
  topModels: [
    { model: 'claude-sonnet-4-6', costUsd: 512.4, tokensIn: 9_400_000, tokensOut: 2_100_000 },
    { model: 'claude-haiku-4-5', costUsd: 300.1, tokensIn: 22_000_000, tokensOut: 4_900_000 },
  ],
};

const MOCK_FORECASTS = [
  { id: 'fc-1', metric: 'revenue', horizonDays: 30, predictedValue: 280_000, confidenceLow: 240_000, confidenceHigh: 320_000, method: 'window_average', inputPointsCount: 6, generatedAt: '2026-07-11T00:00:00.000Z' },
  { id: 'fc-2', metric: 'cost', horizonDays: 30, predictedValue: 950.0, confidenceLow: 800.0, confidenceHigh: 1_100.0, method: 'window_average', inputPointsCount: 6, generatedAt: '2026-07-11T00:00:00.000Z' },
];

const MOCK_TOKEN_USAGE = {
  sinceDays: 7,
  totals: { calls: 2_500, tokensIn: 45_000_000, tokensOut: 9_800_000, costUsd: 812.5 },
  byModel: [
    { provider: 'anthropic', model: 'claude-sonnet-4-6', calls: 1_200, tokensIn: 28_000_000, tokensOut: 6_200_000, costUsd: 512.4 },
    { provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1_300, tokensIn: 17_000_000, tokensOut: 3_600_000, costUsd: 300.1 },
  ],
  copilot: { turns: 890, cacheHits: 278, cacheHitRate: 0.312 },
  byVideo: [],
  byDay: [
    { date: 'Jul 21', costUsd: 95.0, tokensIn: 4_000_000, tokensOut: 1_000_000, calls: 400 },
    { date: 'Jul 22', costUsd: 110.0, tokensIn: 5_000_000, tokensOut: 1_200_000, calls: 500 },
    { date: 'Jul 23', costUsd: 130.0, tokensIn: 6_000_000, tokensOut: 1_400_000, calls: 600 },
    { date: 'Jul 24', costUsd: 142.0, tokensIn: 6_500_000, tokensOut: 1_500_000, calls: 650 },
    { date: 'Jul 25', costUsd: 160.0, tokensIn: 7_500_000, tokensOut: 1_700_000, calls: 750 },
    { date: 'Jul 26', costUsd: 175.5, tokensIn: 8_000_000, tokensOut: 1_800_000, calls: 800 },
  ],
};

const MOCK_PROVIDERS = [
  {
    id: 'prov-1', name: 'anthropic', status: 'ACTIVE', priority: 1,
    qualityScore: 0.97, failureRate: 0.004, avgHealthScore: 98,
    costRates: [{ unit: 'per_1m_tokens', inputCost: 3, outputCost: 15 }],
    healthEvents: [],
  },
  {
    id: 'prov-2', name: 'elevenlabs', status: 'DEGRADED', priority: 2,
    qualityScore: 0.91, failureRate: 0.062, avgHealthScore: 74,
    costRates: [],
    healthEvents: [],
  },
];

async function mockAdminRoutes(page: Page, opts?: { forbidden?: boolean }) {
  await page.route(`${PROXY}/admin/analytics/enterprise`, (route) =>
    opts?.forbidden
      ? route.fulfill({ status: 403, json: { message: 'Forbidden' } })
      : route.fulfill({ json: MOCK_METRICS }),
  );
  await page.route(/\/api\/proxy\/admin\/forecasts(\?.*)?$/, (route) =>
    opts?.forbidden
      ? route.fulfill({ status: 403, json: { message: 'Forbidden' } })
      : route.fulfill({ json: MOCK_FORECASTS }),
  );
  await page.route(`${PROXY}/admin/providers`, (route) => route.fulfill({ json: MOCK_PROVIDERS }));
  await page.route(`${PROXY}/token-usage/summary`, (route) =>
    opts?.forbidden
      ? route.fulfill({ status: 403, json: { message: 'Forbidden' } })
      : route.fulfill({ json: MOCK_TOKEN_USAGE }),
  );
  await page.route(`${PROXY}/admin/forecasts/generate`, (route) =>
    route.fulfill({ json: { ok: true, message: 'queued' } }),
  );
}

test.describe('Admin enterprise dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setAuthToken(page);
  });

  test('renders KPI cards, forecasts and provider health', async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto('/admin');

    // KPI cards (minor units → dollars)
    await expect(page.getByRole('heading', { name: 'Enterprise Dashboard' })).toBeVisible();
    // "$2,500" appears twice (KPI + last revenue bar label) — first() avoids strict mode
    await expect(page.getByText('$2,500').first()).toBeVisible(); // MRR 250_000 cents
    await expect(page.getByText('4.2%')).toBeVisible(); // churn

    // Forecast cards with per-metric units
    await expect(page.getByText('Revenue (30d)')).toBeVisible();
    await expect(page.getByText('$2,800')).toBeVisible(); // revenue forecast, minor units
    await expect(page.getByText('$950.00')).toBeVisible(); // cost forecast, USD float

    // Provider table
    await expect(page.getByText('anthropic')).toBeVisible();
    await expect(page.getByText('DEGRADED')).toBeVisible();
    await expect(page.getByText('$3 · $15')).toBeVisible();
  });

  test('generate button POSTs /admin/forecasts/generate and reloads', async ({ page }) => {
    await mockAdminRoutes(page);
    let generated = false;
    await page.route(`${PROXY}/admin/forecasts/generate`, (route) => {
      generated = true;
      return route.fulfill({ json: { ok: true, message: 'queued' } });
    });
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    const btn = page.getByRole('button', { name: 'Generate now' });
    await btn.waitFor({ timeout: 15_000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ force: true });
    await expect.poll(() => generated).toBe(true);
  });

  test('non-admin gets the access-required state, not an error dump', async ({ page }) => {
    await mockAdminRoutes(page, { forbidden: true });
    await page.goto('/admin');
    await expect(page.getByText('Admin access required')).toBeVisible();
    await expect(page.getByText('Enterprise Dashboard')).toHaveCount(0);
  });

  test('AI Usage tab shows platform-wide token consumption', async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto('/admin');

    // Switch to the AI Usage tab
    await page.getByRole('button', { name: /AI Usage/i }).click();

    // Stat cards from MOCK_TOKEN_USAGE
    // Page renders costUsd.toFixed(4) → "$812.5000"; cacheHitRate * 100 .toFixed(0) → "31%"
    await expect(page.getByText('$812.5000').first()).toBeVisible({ timeout: 8_000 });  // total cost
    await expect(page.getByText('31%').first()).toBeVisible();  // cache hit rate

    // Provider breakdown
    await expect(page.getByText('anthropic').first()).toBeVisible();

    // Model table rows
    await expect(page.getByText('claude-sonnet-4-6').first()).toBeVisible();
    await expect(page.getByText('claude-haiku-4-5').first()).toBeVisible();

    // Daily trend bars should be rendered (at least 6 date labels visible)
    await expect(page.getByText('Jul 21')).toBeVisible();
    await expect(page.getByText('Jul 26')).toBeVisible();
  });
});
