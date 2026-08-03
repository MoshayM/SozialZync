import { test, expect } from '@playwright/test';
import { setupApiMocks, setAuthToken } from './fixtures/api-mock';

const PROXY = 'http://localhost:3007/api/proxy';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeVideoPage(
  count: number,
  offset: number,
  nextCursor: string | null,
) {
  const data = Array.from({ length: count }, (_, i) => ({
    id: `vid-${offset + i}`,
    youtubeVideoId: `yt-${offset + i}`,
    kind: 'video' as const,
    title: `Test Video ${offset + i + 1}`,
    description: null,
    thumbnailUrl: null,
    durationMs: 300_000,
    publishedAt: '2026-01-01T00:00:00.000Z',
    viewCount: 1000,
    likeCount: 50,
    commentCount: 5,
  }));
  return { data, nextCursor };
}

function makePlaylist(i: number) {
  return {
    id: `pl-${i}`,
    youtubePlaylistId: `ytpl-${i}`,
    title: `Playlist ${i}`,
    description: null,
    thumbnailUrl: null,
    itemCount: 3,
  };
}

// ── Per-test route setup ───────────────────────────────────────────────────────

async function setupLibraryMocks(
  page: import('@playwright/test').Page,
  syncPhase: 'IDLE' | 'VIDEOS' = 'IDLE',
) {
  // Must be registered AFTER setupApiMocks: Playwright invokes the
  // last-registered matching route first, so these override the fixture's
  // channelStore-backed /channels handler (whose store starts empty).

  // Channels list — single channel
  // Include all fields ChannelAccessContent renders (e.g. subscriberCount) to
  // avoid a TypeError crash when the component calls .toLocaleString() on it.
  await page.route(`${PROXY}/channels`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: [{
          id: 'ch-lib-1',
          title: 'Test Channel',
          youtubeChannelId: 'UCtest',
          active: true,
          subscriberCount: 0,
          customUrl: '@testchannel',
          thumbnailUrl: null,
          lastSyncedAt: null,
          readOnly: false,
          accessLevel: 'PUBLISH',
        }],
      });
    } else {
      await route.continue();
    }
  });

  // Sync status
  await page.route(`${PROXY}/channels/ch-lib-1/sync-status`, async (route) => {
    await route.fulfill({
      json: {
        phase: syncPhase,
        syncedVideos: syncPhase === 'VIDEOS' ? 12 : 0,
        syncedPlaylists: 0,
        error: null,
      },
    });
  });

  // Videos — two pages
  await page.route(`${PROXY}/channels/ch-lib-1/videos*`, async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get('cursor');
    if (cursor === 'page2') {
      await route.fulfill({ json: makeVideoPage(5, 50, null) });
    } else {
      await route.fulfill({ json: makeVideoPage(50, 0, 'page2') });
    }
  });

  // Playlists
  await page.route(`${PROXY}/channels/ch-lib-1/playlists*`, async (route) => {
    const url = new URL(route.request().url());
    const isItems = /\/playlists\/[^/]+\/items/.test(url.pathname);
    if (!isItems) {
      await route.fulfill({
        json: { data: [makePlaylist(1), makePlaylist(2)], nextCursor: null },
      });
    }
  });

  // Playlist items
  await page.route(/\/api\/proxy\/channels\/ch-lib-1\/playlists\/pl-\d+\/items/, async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: 'pli-1',
            position: 0,
            video: {
              id: 'vid-0',
              youtubeVideoId: 'yt-0',
              kind: 'video',
              title: 'Test Video 1',
              description: null,
              thumbnailUrl: null,
              durationMs: 300_000,
              publishedAt: '2026-01-01T00:00:00.000Z',
              viewCount: 1000,
              likeCount: 50,
              commentCount: 5,
            },
          },
        ],
        nextCursor: null,
      },
    });
  });

  // Sync start
  await page.route(`${PROXY}/channels/ch-lib-1/sync`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, json: { jobId: 'job-sync-1' } });
    }
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await setupLibraryMocks(page);
    await setAuthToken(page);
    // Library was merged into Projects > Channel Access tab.
    // Navigate directly to the canonical URL to avoid the client-side redirect race.
    await page.goto('/projects?tab=channels');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Channel Access tab is visible in Projects page', async ({ page }) => {
    // The library lives under Projects > Channel Access tab
    await expect(page.getByRole('button', { name: 'Channel Access' })).toBeVisible({ timeout: 8_000 });
  });

  test('YouTube accordion is open by default', async ({ page }) => {
    // YouTube accordion starts open. Use .first() because "YouTube" appears in
    // multiple places (accordion button, ChannelAccessPanel heading, etc.).
    // 12s: channel query can be slow when run after a heavy preceding suite.
    await expect(page.getByText('YouTube').first()).toBeVisible({ timeout: 12_000 });
  });

  test('channel is auto-selected and videos render', async ({ page }) => {
    // Wait for videos to appear after auto-selection of the single channel
    // (exact: true — substring matching would also hit "Test Video 10" etc.)
    await expect(page.getByText('Test Video 1', { exact: true })).toBeVisible({ timeout: 10_000 });
    // Virtual grid renders visible subset — just assert at least one title is in the DOM
    await expect(page.getByText(/Test Video/).first()).toBeVisible();
  });

  test('search input filters videos via API', async ({ page }) => {
    // Wait for channel to be auto-selected first
    await expect(page.getByText('Test Video 1', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Intercept the next videos request to capture the q param
    let capturedQ: string | null = null;
    await page.route(`${PROXY}/channels/ch-lib-1/videos*`, async (route) => {
      const url = new URL(route.request().url());
      capturedQ = url.searchParams.get('q');
      await route.fulfill({ json: makeVideoPage(3, 0, null) });
    });

    const searchInput = page.getByRole('searchbox', { name: 'Search videos' });
    await searchInput.fill('hello');

    // The API call should carry the q param (debounced at 300 ms)
    await expect.poll(() => capturedQ, { timeout: 5_000 }).toBe('hello');
  });

  test('type filter Shorts refetches with type=short', async ({ page }) => {
    await expect(page.getByText('Test Video 1', { exact: true })).toBeVisible({ timeout: 10_000 });

    let capturedType: string | null = null;
    await page.route(`${PROXY}/channels/ch-lib-1/videos*`, async (route) => {
      const url = new URL(route.request().url());
      capturedType = url.searchParams.get('type');
      await route.fulfill({ json: makeVideoPage(3, 0, null) });
    });

    await page.getByRole('button', { name: 'Shorts' }).click();
    await expect.poll(() => capturedType, { timeout: 5_000 }).toBe('short');
  });

  test('playlists tab lists playlists', async ({ page }) => {
    await expect(page.getByText('Test Video 1', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Playlists' }).click();
    await expect(page.getByText('Playlist 1')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Playlist 2')).toBeVisible();
  });

  test('sync button POSTs /channels/:id/sync', async ({ page }) => {
    await expect(page.getByText('Test Video 1', { exact: true })).toBeVisible({ timeout: 10_000 });
    const syncPost = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/channels/ch-lib-1/sync'),
    );
    // The sync button is rendered by SyncBadge when status.phase is IDLE.
    // exact: true avoids the accordion header button whose accessible name also
    // contains "Sync library" as a substring (nested button inside the header).
    await page.getByRole('button', { name: 'Sync library', exact: true }).click({ timeout: 10_000 });
    await syncPost;
  });
});

test.describe('Library — syncing badge', () => {
  test('shows syncing badge when sync phase is VIDEOS', async ({ page }) => {
    // Fixture first, specific routes after — last-registered route wins
    await setupApiMocks(page);
    await page.route(`${PROXY}/channels`, async (route) => {
      await route.fulfill({
        json: [{
          id: 'ch-lib-1',
          title: 'Test Channel',
          youtubeChannelId: 'UCtest',
          active: true,
          subscriberCount: 0,
          customUrl: '@testchannel',
          thumbnailUrl: null,
          lastSyncedAt: null,
          readOnly: false,
          accessLevel: 'PUBLISH',
        }],
      });
    });
    await page.route(`${PROXY}/channels/ch-lib-1/sync-status`, async (route) => {
      await route.fulfill({
        json: { phase: 'VIDEOS', syncedVideos: 12, syncedPlaylists: 0, error: null },
      });
    });
    await page.route(`${PROXY}/channels/ch-lib-1/videos*`, async (route) => {
      await route.fulfill({ json: makeVideoPage(3, 0, null) });
    });
    await page.route(`${PROXY}/channels/ch-lib-1/playlists*`, async (route) => {
      await route.fulfill({ json: { data: [], nextCursor: null } });
    });
    await setAuthToken(page);
    await page.goto('/projects?tab=channels');
    await page.waitForLoadState('domcontentloaded');
    // Channel auto-selects, SyncBadge renders the active-phase message
    await expect(page.getByText(/Syncing/)).toBeVisible({ timeout: 10_000 });
  });
});
