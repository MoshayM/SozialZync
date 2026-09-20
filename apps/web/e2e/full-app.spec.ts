/**
 * Full-app E2E — covers every major page, flow, and API connection.
 * Runs against https://sozialzynk.vercel.app (or PW_BASE_URL).
 *
 * Auth strategy: authenticated sections use storageState pre-seeded by
 * auth.setup.ts — NO per-test login(), avoiding Railway rate-limit hits.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth.json');

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL ?? 'sozialzync@gmail.com';
const ADMIN_PASS  = process.env.PW_ADMIN_PASS  ?? 'Admin@123';

/** Navigate to `path` with inline JWT-expiry recovery for late-running authenticated tests. */
async function gotoWithAuth(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  // Client-side auth guard fires via useEffect after React hydration — can take up to ~10s
  // on slow Vercel cold starts. 3s was too short and caused false negatives (guard fired
  // after gotoWithAuth returned, causing mid-test redirects).
  const expired = await page.waitForURL(/\/login/, { timeout: 12_000 })
    .then(() => true).catch(() => false);
  if (!expired) return;

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
  await emailInput.fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.getByRole('button', { name: /sign in with password/i }).click();

  // Race: successful navigation vs rate-limit toast. A cold Railway can take >4 s to return
  // a 429, so a fixed 4 s sequential check misses it. The race resolves as soon as either
  // the redirect lands or the "too many attempts" text becomes visible.
  let navigated = false;
  await Promise.race([
    page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 30_000, waitUntil: 'commit' })
      .then(() => { navigated = true; }).catch(() => {}),
    page.getByText(/too many attempts/i).waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {}),
  ]);

  if (navigated) {
    await page.goto(path);
    return;
  }

  // Not navigated in 30 s — either rate-limited or Railway is very slow.
  if (await page.getByText(/too many attempts/i).isVisible()) {
    // Do NOT click again — each click may reset the rate-limit window.
    // 120 s clears a typical 2-minute rate-limit window.
    await page.waitForTimeout(120_000);
    // Re-navigate to reset form state, then re-submit fresh credentials.
    await page.goto('/login');
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in with password/i }).click();
  }
  // Railway should now be warm and rate-limit cleared — 120 s covers cold-start overhead.
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 120_000, waitUntil: 'commit' });
  await page.goto(path);
}

// ── 1. PUBLIC PAGES (no auth needed) ──────────────────────────────────────────

test.describe('Public — landing + auth pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('root redirects away from bare domain', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/browse|login|home/, { timeout: 15_000 }).catch(() => {});
    expect(page.url()).not.toMatch(/^https?:\/\/[^/]+\/?$/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await page.screenshot({ path: 'e2e/full-login.png' });
  });

  test('login sign-in button disabled until both fields filled', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    const btn = page.getByRole('button', { name: /sign in with password/i });
    await expect(btn).toBeDisabled();
    await page.locator('input[type="email"]').first().fill('test@test.com');
    await expect(btn).toBeDisabled();
    await page.locator('input[type="password"]').first().fill('password123');
    await expect(btn).toBeEnabled();
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('register → login link works', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/login/);
  });

  test('forgot-password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /send|reset|email/i })).toBeVisible();
  });

  test('login → forgot password link works', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('browse page loads without auth', async ({ page }) => {
    await page.goto('/browse');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'e2e/full-browse.png' });
  });

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).not.toHaveURL(/404|not.found/i);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).not.toHaveURL(/404|not.found/i);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── 2. AUTH PROTECTION ────────────────────────────────────────────────────────

test.describe('Auth protection — unauthenticated redirects', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const PROTECTED = [
    '/home', '/projects', '/insights', '/copilot', '/admin',
    '/settings', '/library', '/editor', '/publish', '/calendar',
    '/plans', '/wallet',
  ];
  for (const route of PROTECTED) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/login/, { timeout: 20_000 }).catch(() => {});
      expect(page.url()).toMatch(/login/);
    });
  }
});

// ── 3. AUTHENTICATED — CORE PAGES ────────────────────────────────────────────
// storageState comes from playwright.config.ts project-level setting

test.describe('Authenticated — core pages load', () => {
  test('home dashboard renders', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('aside, nav').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/full-home.png' });
  });

  test('sidebar navigation links present', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('a[href="/projects"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('a[href="/home"]').first()).toBeVisible();
  });

  test('projects page loads', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/full-projects.png' });
  });

  test('new project button visible', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible({ timeout: 20_000 });
  });

  test('create project modal opens', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: /new project/i }).click();
    await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'e2e/full-create-project-modal.png' });
  });

  test('insights page loads', async ({ page }) => {
    await page.goto('/insights');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('publish page loads', async ({ page }) => {
    await page.goto('/publish');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('calendar page loads', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('library page loads', async ({ page }) => {
    await page.goto('/library');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/full-library.png' });
  });

  test('editor page loads', async ({ page }) => {
    await page.goto('/editor');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2, textarea, [class*="editor"]').first()).toBeVisible({ timeout: 25_000 });
    await page.screenshot({ path: 'e2e/full-editor.png' });
  });

  test('/copilot redirects to /home (widget lives there)', async ({ page }) => {
    await page.goto('/copilot');
    await expect(page).toHaveURL(/home/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('copilot widget trigger button present on home page', async ({ page }) => {
    await page.goto('/home');
    // The .cf-copilot-widget div starts hidden; the trigger button is always visible
    await expect(page.locator('[title="Ask Copilot"]')).toBeVisible({ timeout: 20_000 });
  });

  test('plans page heading visible', async ({ page }) => {
    await page.goto('/plans');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('heading', { name: /plans|pricing/i })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/full-plans.png' });
  });

  test('wallet page loads', async ({ page }) => {
    await page.goto('/wallet');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('admin page accessible for admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/full-admin.png' });
  });
});

// ── 4. SETTINGS (real routes) ─────────────────────────────────────────────────

test.describe('Authenticated — settings', () => {
  test('settings root loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('settings/channels — heading visible', async ({ page }) => {
    await page.goto('/settings/channels');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('heading', { name: /channels/i })).toBeVisible({ timeout: 25_000 });
    await page.screenshot({ path: 'e2e/full-settings-channels.png' });
  });

  test('settings/channels — Google connect button present', async ({ page }) => {
    test.setTimeout(300_000);
    await gotoWithAuth(page, '/settings/channels');
    await expect(page.getByRole('heading', { name: /channels/i })).toBeVisible({ timeout: 25_000 });
    // Button text varies: "Add via Google" (has channels) or "Connect with Google" (empty state)
    // 30s: Railway channels API can take 15-25s after cold start to return connection status
    await expect(page.getByRole('button', { name: /add via google|connect with google/i }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('settings/ai-infrastructure loads', async ({ page }) => {
    await page.goto('/settings/ai-infrastructure');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('settings/ai-providers loads', async ({ page }) => {
    await page.goto('/settings/ai-providers');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('settings/models loads', async ({ page }) => {
    await page.goto('/settings/models');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('settings/storage loads', async ({ page }) => {
    await page.goto('/settings/storage');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });
});

// ── 5. API HEALTH ─────────────────────────────────────────────────────────────

test.describe('API connectivity', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('backend health endpoint responds', async ({ request }) => {
    const res = await request.get('https://sozialzync-api-production.up.railway.app/api/v1/health', {
      timeout: 30_000,
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('frontend API proxy /api/auth/providers responds', async ({ request }) => {
    const res = await request.get('https://sozialzynk.vercel.app/api/auth/providers', {
      timeout: 20_000,
    });
    expect(res.status()).toBeLessThan(500);
  });
});

// ── 6. NAVIGATION FLOWS ───────────────────────────────────────────────────────

test.describe('Authenticated — navigation flows', () => {
  test('sidebar: home → projects via link', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('a[href="/projects"]').first()).toBeVisible({ timeout: 20_000 });
    await page.locator('a[href="/projects"]').first().click();
    await expect(page).toHaveURL(/projects/, { timeout: 20_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('insights page navigates correctly', async ({ page }) => {
    // The "Grow" sidebar section is collapsible — test page navigation directly
    await page.goto('/insights');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
  });

  test('topbar renders', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('header, [class*="topbar"], [class*="header"]').first()).toBeVisible({ timeout: 20_000 });
  });

  test('browser back works between pages', async ({ page }) => {
    await page.goto('/home');
    await page.goto('/projects');
    await page.goBack();
    await expect(page).toHaveURL(/home/);
  });
});

// ── 7. COPILOT WIDGET ─────────────────────────────────────────────────────────

test.describe('Authenticated — copilot widget', () => {
  test('copilot trigger button visible on home', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('[title="Ask Copilot"]')).toBeVisible({ timeout: 20_000 });
  });

  test('clicking Ask Copilot opens widget', async ({ page }) => {
    await page.goto('/home');
    const trigger = page.locator('[title="Ask Copilot"]');
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();
    await expect(page.locator('.cf-copilot-widget')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/full-copilot-open.png' });
  });
});

// ── 8. PLANS ─────────────────────────────────────────────────────────────────

test.describe('Authenticated — plans', () => {
  // Plans tests run late in the suite — Railway may be cold. Warm it up once so
  // the login POST in gotoWithAuth is fast and rate-limit responses are immediate.
  test.beforeAll(async ({ request }) => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await request.get('/api/proxy/copilot/stt-status', { timeout: 12_000 });
        if (res.status() > 0) return;
      } catch { /* still booting */ }
      await new Promise(r => setTimeout(r, 3_000));
    }
  });

  test('plans page shows pricing tiers (waits for API)', async ({ page }) => {
    test.setTimeout(300_000);
    await gotoWithAuth(page, '/plans');
    await expect(page.getByRole('heading', { name: /plans|pricing/i })).toBeVisible({ timeout: 20_000 });
    // The plan grid is `grid grid-cols-1 sm:grid-cols-3 gap-5`.
    // .grid.grid-cols-1 matches multiple elements on the page — use page-level assertions
    // with .first() to avoid strict-mode violations.
    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('plans page has plan action elements', async ({ page }) => {
    test.setTimeout(300_000);
    await gotoWithAuth(page, '/plans');
    // Wait for plan cards to render before asserting action buttons
    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible({ timeout: 40_000 });
    // Any plan action: "Upgrade to X", "Switch to X", "Your plan", "Downgrade via cancel"
    await expect(
      page.locator('text=/upgrade to|switch to|your plan|downgrade/i').first()
    ).toBeVisible({ timeout: 20_000 });
  });
});

// ── 9. RESPONSIVE — MOBILE ───────────────────────────────────────────────────

test.describe('Responsive — mobile viewport', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
  });

  test('login renders on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/full-mobile-login.png' });
  });

  test('browse renders on mobile', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'e2e/full-mobile-browse.png' });
  });

  test('brand panel hidden on mobile login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.lg\\:flex').first()).toBeHidden();
  });
});

// ── 10. 404 / ERROR HANDLING ─────────────────────────────────────────────────

test.describe('404 and error handling', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unknown route shows 404 or redirects gracefully', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz-99999');
    await expect(page.locator('body')).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10);
  });
});

// ── 11. LAYOUT / VISUAL SANITY ────────────────────────────────────────────────

test.describe('Layout and visual sanity', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page — no horizontal scroll', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW).toBeLessThanOrEqual(clientW + 2);
  });

  test('browse page — no horizontal scroll', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW).toBeLessThanOrEqual(clientW + 2);
  });

  test('login page — no critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR')
    );
    expect(critical).toHaveLength(0);
  });
});
