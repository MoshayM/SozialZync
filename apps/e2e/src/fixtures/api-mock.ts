import { Page, request } from '@playwright/test';

// Direct backend URL — used only by setAuthToken's real-JWT acquisition
const BASE = 'http://localhost:4007/api/v1';

// The browser goes through Next.js /api/proxy/* (never directly to port 4007),
// so ALL page.route() mocks must intercept the proxy URL.
const PROXY = 'http://localhost:3007/api/proxy';

// Encodes { sub, email, role: SUPER_ADMIN, plan: ENTERPRISE } so PlanGate reads correct claims
export const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLXRlc3QtMSIsImVtYWlsIjoidGVzdEBjcmVhdG9yZm9yY2UuYWkiLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJwbGFuIjoiRU5URVJQUklTRSIsImlhdCI6MTcyMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.mock-sig';

type StoreChannel = {
  id: string; youtubeChannelId: string; title: string; description: string;
  thumbnailUrl: null; customUrl: string; subscriberCount: number; videoCount: number;
  active: boolean; readOnly?: boolean; lastSyncedAt: string; createdAt: string;
};

// Starts empty — channels are only added when the user explicitly connects one via OAuth
const channelStore: StoreChannel[] = [];
let channelSeq = 0;
const CHANNEL_NAMES = [
  { title: 'Gaming Nexus', customUrl: '@gamingnexus', subs: 4800, videos: 34 },
  { title: 'Cooking with AI', customUrl: '@cookingwithai', subs: 22100, videos: 112 },
  { title: 'Finance Unlocked', customUrl: '@financeunlocked', subs: 9350, videos: 58 },
  { title: 'Travel Hacks', customUrl: '@travelhacks', subs: 31000, videos: 203 },
];

const MOCK_PROJECTS = [
  { id: 'proj-1', title: 'AI Tools Deep Dive', niche: 'Technology', status: 'ACTIVE', targetLang: 'en', channel: { title: 'TechReview Pro', thumbnailUrl: null }, _count: { jobs: 5, videos: 2 }, updatedAt: '2026-06-20T10:00:00.000Z' },
  { id: 'proj-2', title: 'Beginner Coding Series', niche: 'Education', status: 'DRAFT', targetLang: 'en', channel: { title: 'TechReview Pro', thumbnailUrl: null }, _count: { jobs: 1, videos: 0 }, updatedAt: '2026-06-18T10:00:00.000Z' },
];

const MOCK_PROJECT_DETAIL = {
  id: 'proj-1', title: 'AI Tools Deep Dive', niche: 'Technology', status: 'ACTIVE', targetLang: 'en',
  description: 'Comprehensive series on AI productivity tools', channelId: 'ch-1',
  channel: { id: 'ch-1', title: 'TechReview Pro', thumbnailUrl: null, youtubeChannelId: 'UCmock123' },
  jobs: [
    { id: 'job-1', type: 'TREND_ANALYSIS', status: 'COMPLETED', createdAt: '2026-06-20T10:00:00.000Z', completedAt: '2026-06-20T10:01:00.000Z' },
    { id: 'job-2', type: 'RESEARCH', status: 'COMPLETED', createdAt: '2026-06-20T10:02:00.000Z', completedAt: '2026-06-20T10:03:00.000Z' },
    { id: 'job-3', type: 'COMPLIANCE', status: 'WAITING_APPROVAL', createdAt: '2026-06-20T10:04:00.000Z', completedAt: null },
  ],
  videos: [],
  approvals: [{ id: 'appr-1', status: 'PENDING' }],
};

export const MOCK_APPROVALS = [
  {
    id: 'appr-1', status: 'PENDING', expiresAt: '2026-06-28T10:00:00.000Z',
    project: { title: 'AI Tools Deep Dive', channel: { title: 'TechReview Pro' } },
    job: { type: 'METADATA', result: { metadata: { title: 'Top 5 AI Tools That Replace Your Entire Workflow' }, awaitingApproval: true } },
  },
];

const MOCK_TRENDS = {
  trending: [
    { topic: 'AI Agents Automation 2026', score: 94, relatedKeywords: ['n8n', 'make.com', 'zapier AI', 'Claude API'], peakTime: 'weekdays' },
    { topic: 'Local LLMs vs Cloud AI', score: 87, relatedKeywords: ['Ollama', 'LM Studio', 'privacy AI'], peakTime: null },
    { topic: 'Vibe Coding with AI', score: 82, relatedKeywords: ['cursor', 'copilot', 'claude code'], peakTime: null },
  ],
  recommendations: ['Focus on beginner tutorials'],
  analysisDate: '2026-06-26',
};

const MOCK_SUBSCRIPTION = {
  plan: 'FREE', status: 'ACTIVE',
  currentPeriodStart: '2026-06-01T00:00:00.000Z',
  currentPeriodEnd: '2026-06-30T23:59:59.000Z',
  cancelAtPeriodEnd: false,
};

const MOCK_USER = {
  id: 'user-test-1',
  email: 'test@creatorforce.ai',
  name: 'Test User',
  role: 'SUPER_ADMIN',
  phone: null,
  avatarUrl: null,
};

export async function setupApiMocks(page: Page) {
  // ── Catch-all (lowest priority — specific routes registered below override via LIFO) ──
  // Prevents unmocked API calls from returning 401 and triggering window.location.href='/login'
  await page.route('**/api/proxy/**', async (route) => {
    await route.fulfill({ json: {} });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  await page.route(`${PROXY}/auth/login`, async (route) => {
    const body = route.request().postDataJSON() as { email?: string; password?: string } | null;
    if (body?.email && body?.password) {
      await route.fulfill({ json: { accessToken: MOCK_TOKEN, refreshToken: 'mock-refresh-token' } });
    } else {
      await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } });
    }
  });

  await page.route(`${PROXY}/auth/register`, async (route) => {
    await route.fulfill({ status: 201, json: { accessToken: MOCK_TOKEN, refreshToken: 'mock-refresh-token' } });
  });

  // /auth/me — validates the token; without this mock the frontend gets 401 and
  // redirects every protected page to /login, causing setAuthToken tests to fail
  await page.route(`${PROXY}/auth/me`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_USER });
    } else {
      // PATCH /auth/me/profile
      await route.fulfill({ json: MOCK_USER });
    }
  });

  await page.route(/\/api\/proxy\/auth\/me\//, async (route) => {
    await route.fulfill({ json: MOCK_USER });
  });

  // Settings endpoints — return empty arrays so the page doesn't crash when
  // isOwner=true and these queries fire (catch-all returns {} which breaks .map())
  await page.route(`${PROXY}/settings/api-keys`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route(/\/api\/proxy\/dev\/webhooks/, async (route) => {
    await route.fulfill({ json: { webhooks: [] } });
  });

  // Growth page endpoints — catch-all returns {} which causes .map() crash in UpgradeNudges
  // and OfferCenter. Return proper empty-array/false-hasTrial values instead.
  await page.route(`${PROXY}/upgrade/recommendations`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route(`${PROXY}/offers`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route(`${PROXY}/trial/status`, async (route) => {
    await route.fulfill({ json: { hasTrial: false } });
  });

  // Additional auth endpoints used by sessions/providers specs
  await page.route(`${PROXY}/auth/providers`, async (route) => {
    await route.fulfill({ json: { google: false, apple: false, facebook: false } });
  });
  await page.route(`${PROXY}/auth/links`, async (route) => {
    await route.fulfill({ json: { password: true, links: [] } });
  });
  await page.route(`${PROXY}/auth/sessions`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route(`${PROXY}/auth/logout`, async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
  await page.route(`${PROXY}/auth/refresh`, async (route) => {
    await route.fulfill({ json: { accessToken: MOCK_TOKEN, refreshToken: 'mock-refresh-token' } });
  });

  // ── Channels ──────────────────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/channels\/auth-url/, async (route) => {
    // Simulate OAuth succeeding — add a new channel to the store so the list updates after redirect
    const info = CHANNEL_NAMES[channelSeq % CHANNEL_NAMES.length]!;
    const now = new Date().toISOString();
    channelStore.push({
      id: `ch-dyn-${channelSeq + 1}`,
      youtubeChannelId: `UCdyn${channelSeq + 1}`,
      title: info.title,
      customUrl: info.customUrl,
      description: 'Connected via YouTube OAuth',
      thumbnailUrl: null,
      subscriberCount: info.subs,
      videoCount: info.videos,
      active: true,
      lastSyncedAt: now,
      createdAt: now,
    });
    channelSeq++;
    await route.fulfill({ json: { url: 'http://localhost:3007/settings?connected=true' } });
  });

  await page.route(/\/api\/proxy\/channels\/status/, async (route) => {
    const active = channelStore.find((c) => c.active);
    if (!active) {
      await route.fulfill({ json: { connected: false } });
    } else {
      await route.fulfill({ json: {
        connected: true,
        channelId: active.youtubeChannelId,
        channelName: active.title,
        handle: active.customUrl,
        thumbnail: active.thumbnailUrl,
        subscriberCount: active.subscriberCount,
        connectedAt: active.createdAt,
        lastSyncAt: active.lastSyncedAt,
      }});
    }
  });

  await page.route(`${PROXY}/channels/connect-by-url`, async (route) => {
    const body = route.request().postDataJSON() as { channelUrl?: string } | null;
    const raw = (body?.channelUrl ?? '').trim();
    if (!raw) {
      await route.fulfill({ status: 400, json: { message: 'channelUrl is required' } });
      return;
    }
    const handleMatch = raw.match(/(?:youtube\.com\/@?|^@?)([\w.-]+)/i);
    const handleSlug = handleMatch?.[1] ?? raw.replace(/[^a-z0-9]/gi, '');
    const displayName = handleSlug.charAt(0).toUpperCase() + handleSlug.slice(1);
    const customUrl = `@${handleSlug.toLowerCase()}`;
    const now = new Date().toISOString();
    const newCh: StoreChannel = {
      id: `ch-url-${channelSeq + 1}`,
      youtubeChannelId: `UCurl${channelSeq + 1}`,
      title: displayName,
      customUrl,
      description: 'Connected via URL (read-only)',
      thumbnailUrl: null,
      subscriberCount: 0,
      videoCount: 0,
      active: true,
      lastSyncedAt: now,
      createdAt: now,
    };
    channelStore.push(newCh);
    channelSeq++;
    await route.fulfill({ status: 201, json: { ...newCh, readOnly: true } });
  });

  await page.route(`${PROXY}/channels`, async (route) => {
    await route.fulfill({ json: [...channelStore] });
  });

  // ── Projects ──────────────────────────────────────────────────────────────
  await page.route(`${PROXY}/projects`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { data: MOCK_PROJECTS, nextCursor: null } });
    } else {
      const body = route.request().postDataJSON() as { title?: string; channelId?: string } | null;
      await route.fulfill({ status: 201, json: { id: 'proj-new', title: body?.title ?? '', channelId: body?.channelId ?? '', status: 'DRAFT', niche: null, targetLang: 'en', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    }
  });

  // Specific project IDs — registered AFTER the list route, so they take priority (LIFO)
  await page.route(/\/api\/proxy\/projects\/[^/]+$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_PROJECT_DETAIL });
    } else {
      await route.fulfill({ json: { ...MOCK_PROJECT_DETAIL } });
    }
  });

  // ── Jobs ──────────────────────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/jobs\/project\/[^/]+$/, async (route) => {
    await route.fulfill({ json: MOCK_PROJECT_DETAIL.jobs });
  });

  await page.route(`${PROXY}/jobs`, async (route) => {
    const body = route.request().postDataJSON() as { type?: string } | null;
    await route.fulfill({ status: 201, json: { id: 'job-new', projectId: 'proj-1', type: body?.type ?? 'TREND_ANALYSIS', status: 'QUEUED', payload: {}, result: null, error: null, attempts: 0, startedAt: null, completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  });

  await page.route(/\/api\/proxy\/jobs\/[^/]+$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_PROJECT_DETAIL.jobs[0] });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  // ── Approvals ─────────────────────────────────────────────────────────────
  await page.route(`${PROXY}/approvals/pending`, async (route) => {
    await route.fulfill({ json: { data: MOCK_APPROVALS, nextCursor: null } });
  });

  await page.route(/\/api\/proxy\/approvals\/[^/]+\/approve$/, async (route) => {
    await route.fulfill({ json: { id: 'appr-1', status: 'APPROVED' } });
  });

  await page.route(/\/api\/proxy\/approvals\/[^/]+\/reject$/, async (route) => {
    await route.fulfill({ json: { id: 'appr-1', status: 'REJECTED' } });
  });

  // ── Trends ────────────────────────────────────────────────────────────────
  await page.route(`${PROXY}/trends/analyze`, async (route) => {
    await route.fulfill({ json: MOCK_TRENDS });
  });

  // ── Billing ───────────────────────────────────────────────────────────────
  await page.route(`${PROXY}/billing/subscription`, async (route) => {
    await route.fulfill({ json: MOCK_SUBSCRIPTION });
  });

  await page.route(`${PROXY}/billing/checkout`, async (route) => {
    await route.fulfill({ json: { url: 'https://checkout.stripe.com/mock-session' } });
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/notifications/, async (route) => {
    await route.fulfill({ json: { items: [], unreadCount: 0 } });
  });

  // ── System ────────────────────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/system\//, async (route) => {
    await route.fulfill({ json: {} });
  });

  // ── Token usage / admin ───────────────────────────────────────────────────
  await page.route(`${PROXY}/token-usage/summary`, async (route) => {
    await route.fulfill({ json: { totalTokensIn: 0, totalTokensOut: 0, totalCostUsd: 0, cacheSavingsUsd: 0, cacheHitRate: 0, topModels: [], byProvider: [], dailyTrend: [], byVideoType: [] } });
  });

  // ── Wallet / credits ──────────────────────────────────────────────────────
  const MOCK_BALANCE = { balanceCredits: 5_000, buckets: { purchasedCredits: 5_000, trialCredits: 0, bonusCredits: 0, referralCredits: 0, promotionalCredits: 0 }, lifetimePurchased: 5_000, lifetimeUsed: 0 };
  await page.route(`${PROXY}/wallet/balance`, async (route) => {
    await route.fulfill({ json: MOCK_BALANCE });
  });
  await page.route(`${PROXY}/wallet/budget`, async (route) => {
    await route.fulfill({ json: { status: 'NONE', monthlyLimit: 0, spent: 0, remaining: 0, willExceed: false, blocked: false, alertThreshold: 80, hardCap: false } });
  });
  await page.route(`${PROXY}/wallet/forecast`, async (route) => {
    await route.fulfill({ json: { daysToEmpty: 45, projectedDailySpend: 110, rechargeRecommendation: null } });
  });
  await page.route(/\/api\/proxy\/wallet\/usage-summary/, async (route) => {
    await route.fulfill({ json: { totalSpent: 0, byAction: [] } });
  });
  await page.route(`${PROXY}/wallet/transactions`, async (route) => {
    await route.fulfill({ json: { data: [], nextCursor: null } });
  });
  await page.route(`${PROXY}/wallet/lots`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route(`${PROXY}/wallet/recommendations`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route(`${PROXY}/credits/balance`, async (route) => {
    await route.fulfill({ json: MOCK_BALANCE });
  });
  await page.route(`${PROXY}/credits/budget`, async (route) => {
    await route.fulfill({ json: { status: 'NONE', monthlyLimit: 0, spent: 0, remaining: 0, willExceed: false, blocked: false, alertThreshold: 80, hardCap: false } });
  });
  await page.route(`${PROXY}/credits/usage`, async (route) => {
    await route.fulfill({ json: { totalSpent: 0, byAction: [] } });
  });
  await page.route(`${PROXY}/credits/transactions`, async (route) => {
    await route.fulfill({ json: { data: [], nextCursor: null } });
  });
  await page.route(`${PROXY}/credits/lots`, async (route) => {
    await route.fulfill({ json: [] });
  });

  // ── Orgs ──────────────────────────────────────────────────────────────────
  await page.route(`${PROXY}/orgs/mine`, async (route) => {
    await route.fulfill({ json: [] });
  });

  // ── Growth / analytics ────────────────────────────────────────────────────
  await page.route(`${PROXY}/analytics/channel-profile`, async (route) => {
    await route.fulfill({ json: null });
  });
  await page.route(`${PROXY}/analytics/performance`, async (route) => {
    await route.fulfill({ json: { videos: [] } });
  });

  // ── Autonomy / scheduler ──────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/autonomy\//, async (route) => {
    await route.fulfill({ json: {} });
  });
  await page.route(/\/api\/proxy\/scheduler\//, async (route) => {
    await route.fulfill({ json: [] });
  });

  // ── Library / media ───────────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/media\//, async (route) => {
    await route.fulfill({ json: { data: [], nextCursor: null } });
  });
  await page.route(/\/api\/proxy\/library\//, async (route) => {
    await route.fulfill({ json: { data: [], nextCursor: null } });
  });

  // ── Insights (catch-all for analytics sub-routes) ─────────────────────────
  await page.route(/\/api\/proxy\/insights\//, async (route) => {
    await route.fulfill({ json: {} });
  });

  // ── Admin ─────────────────────────────────────────────────────────────────
  await page.route(/\/api\/proxy\/admin\//, async (route) => {
    await route.fulfill({ json: {} });
  });
}

// Cached real JWT so every test in a run shares one login call
let _cachedToken: string | null = null;

export async function setAuthToken(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Use a real JWT obtained via Node.js (outside page context so Playwright
  // route mocks don't intercept it). A real token means any API call that
  // bypasses a route handler returns real data instead of 401.
  if (!_cachedToken) {
    try {
      const ctx = await request.newContext();
      const r = await ctx.post(`${BASE}/auth/login`, {
        data: { email: 'ethonanpasumvalki@gmail.com', password: 'password@123' },
      });
      if (r.ok()) {
        const body = await r.json() as { accessToken?: string };
        _cachedToken = body.accessToken ?? null;
      }
      await ctx.dispose();
    } catch {
      // fall through
    }
  }

  await page.evaluate(
    (token) => localStorage.setItem('cf_token', token),
    _cachedToken ?? MOCK_TOKEN,
  );
}
