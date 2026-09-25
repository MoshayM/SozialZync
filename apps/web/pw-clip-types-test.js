/**
 * Verify all 6 clip-type checkboxes appear on a Shorts Studio highlight row.
 */
const { chromium } = require('@playwright/test');

const EMAIL = 'sozialzync@gmail.com';
const PASS  = 'Admin@123';
const BASE  = 'https://sozialzynk.vercel.app';

const EXPECTED = [
  'YouTube Shorts',
  'TikTok',
  'Instagram Reels',
  'Facebook Reels',
  'LinkedIn',
  'Podcast Highlight',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log('[AUTH] Logging in…');
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(() => !!localStorage.getItem('cf_token'), undefined, { timeout: 30_000 });
  console.log('[AUTH] ✅ Logged in');

  // ── Navigate to Shorts Studio and click first card to expand ────────────
  await page.goto(`${BASE}/shorts-studio`, { waitUntil: 'networkidle', timeout: 30_000 });
  console.log('[NAV] Shorts Studio loaded');

  // Click "Expand all" to open all video cards
  await page.locator('text=Expand all').click().catch(() => {});
  await page.waitForTimeout(2000);

  // Now look for a link to the video page
  const videoLink = await page.locator('a[href*="/shorts-studio/videos/"]').first().getAttribute('href').catch(() => null);
  let videoId = videoLink ? videoLink.split('/shorts-studio/videos/')[1] : null;
  if (videoId) console.log('[NAV] Found video link after expand:', videoId);

  // Fallback: intercept API call by navigating fresh and capturing the network request
  if (!videoId) {
    const token = await page.evaluate(() => localStorage.getItem('cf_token'));
    const API_URL = 'https://sozialzync-api-production.up.railway.app';

    // Try to get channels first
    const chRes = await page.evaluate(async ({ api, tok }) => {
      const r = await fetch(`${api}/publishing/channels`, { headers: { Authorization: `Bearer ${tok}` } });
      return r.ok ? r.json() : null;
    }, { api: API_URL, tok: token });

    console.log('[API] /publishing/channels status, first item:', JSON.stringify(chRes)?.slice(0, 200));

    const channels = Array.isArray(chRes) ? chRes : (chRes?.channels ?? chRes?.data ?? []);
    const ytCh = channels.find((c) => c.platform === 'YOUTUBE' || c.channelId) ?? channels[0];

    if (ytCh?.id) {
      const vRes = await page.evaluate(async ({ api, tok, chId }) => {
        const r = await fetch(`${api}/shorts-studio/channels/${chId}/imported`, { headers: { Authorization: `Bearer ${tok}` } });
        return r.ok ? r.json() : null;
      }, { api: API_URL, tok: token, chId: ytCh.id });
      const vids = Array.isArray(vRes) ? vRes : [];
      const vid = vids.find((v) => (v._count?.topicSegments ?? 0) > 0) ?? vids[0];
      if (vid) { videoId = vid.id; console.log('[NAV] Got video from API:', videoId); }
    }
  }

  if (!videoId) {
    // Last resort: capture the page URL when clicking "View highlights" text
    await page.screenshot({ path: 'pw-clip-types-expanded.png' });
    console.log('[DEBUG] Screenshot saved. Page URL:', page.url());
    const allLinks = await page.$$eval('a', els => els.map(e => e.href));
    console.log('[DEBUG] All links:', allLinks.filter(l => l.includes('sozialzyn')).slice(0, 10));
    console.error('[FAIL] Could not determine video ID');
    await browser.close(); process.exit(1);
  }

  await page.goto(`${BASE}/shorts-studio/videos/${videoId}`, { waitUntil: 'networkidle', timeout: 30_000 });

  // Wait for highlights to render
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.screenshot({ path: 'pw-clip-types-video-page.png' });
  console.log('[SCREENSHOT] video page saved');

  // Try to find the highlights — they might need a topic to be expanded
  const hasYT = await page.locator('text=YouTube Shorts').first().isVisible().catch(() => false);
  if (!hasYT) {
    // Expand the first topic/segment accordion if present
    await page.locator('text=Expand all').first().click().catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'pw-clip-types-expanded2.png' });
  }

  const ytVisible = await page.locator('text=YouTube Shorts').first().isVisible().catch(() => false);
  console.log('[CHECK] "YouTube Shorts" visible on page:', ytVisible);
  if (!ytVisible) {
    // Check what IS on the page
    const bodyText = await page.locator('body').textContent();
    console.log('[DEBUG] Page text snippet:', bodyText?.slice(0, 500));
  }

  // ── Check all platform labels are present ──────────────────────────────────
  let allOk = true;
  for (const label of EXPECTED) {
    const count = await page.locator(`text=${label}`).count();
    const ok = count > 0;
    console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ' — NOT FOUND'}`);
    if (!ok) allOk = false;
  }

  // Screenshot for visual confirmation
  await page.screenshot({ path: 'pw-clip-types-result.png', fullPage: false });
  console.log('[SCREENSHOT] pw-clip-types-result.png');

  await browser.close();
  if (!allOk) { console.error('\n[RESULT] ❌ Some platforms missing'); process.exit(1); }
  console.log('\n[RESULT] ✅ All 6 platforms present');
})();
