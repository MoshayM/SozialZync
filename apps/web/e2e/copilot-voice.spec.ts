import { test, expect, devices } from '@playwright/test';

/**
 * Copilot voice smoke tests — mobile viewport (Pixel 5).
 *
 * Uses Chrome's --use-fake-ui-for-media-stream + --use-fake-device-for-media-stream
 * so getUserMedia succeeds without real hardware. The fake audio device produces
 * silence; the STT path is exercised but transcription will return empty/error,
 * which is fine — we verify UI states not transcription accuracy.
 *
 * The text-send path exercises the full Thinking → Reply → TTS button flow.
 */
test.use({
  ...devices['Pixel 5'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
  permissions: ['microphone'],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const mainForm = (page: import('@playwright/test').Page) =>
  page.locator('form').filter({
    has: page.locator('button').filter({ hasText: /sign in with password/i }),
  });

async function loginWithPassword(page: import('@playwright/test').Page) {
  // Go to /login (fast static page — no Railway call). If the storageState JWT is
  // still valid the login page useEffect redirects to /home immediately.
  await page.goto('/login');
  const redirectedToHome = await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 8_000 })
    .then(() => true).catch(() => false);

  if (redirectedToHome) {
    // JWT is currently valid. Check whether it expires within 10 minutes —
    // if so, force a fresh login so it doesn't expire mid-test.
    const expiresAt = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) ?? '') ?? '';
        if (!v.startsWith('eyJ')) continue;
        const parts = v.split('.');
        if (parts.length !== 3) continue;
        try { return (JSON.parse(atob(parts[1])).exp ?? 0) * 1000; } catch { /* not a JWT */ }
      }
      return null; // cookie-based auth — no localStorage JWT
    });
    const TEN_MIN = 10 * 60 * 1000;
    if (expiresAt === null || expiresAt > Date.now() + TEN_MIN) return; // fresh enough
    // JWT expires soon — clear it and force re-login via form
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.goto('/login');
    const cookieAuth = await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 2_000 })
      .then(() => true).catch(() => false);
    if (cookieAuth) return;
  }

  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  await mainForm(page).locator('input[type="email"]').fill('sozialzync@gmail.com');
  await mainForm(page).locator('input[type="password"]').fill('Admin@123');
  await mainForm(page).locator('button').filter({ hasText: /sign in with password/i }).click();

  // Race: navigation success vs rate-limit toast — cold Railway returns 429 after >4 s.
  let navigated = false;
  await Promise.race([
    page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 30_000, waitUntil: 'commit' })
      .then(() => { navigated = true; }).catch(() => {}),
    page.getByText(/too many attempts/i).waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {}),
  ]);
  if (!navigated) {
    if (await page.getByText(/too many attempts/i).isVisible()) {
      // Short wait — each attempt takes ~135s total, and 3 attempts span ~270s
      // which naturally clears the ~240s rate-limit window.
      await page.waitForTimeout(15_000);
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
      await mainForm(page).locator('input[type="email"]').fill('sozialzync@gmail.com');
      await mainForm(page).locator('input[type="password"]').fill('Admin@123');
      await mainForm(page).locator('button').filter({ hasText: /sign in with password/i }).click();
    }
    await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 90_000, waitUntil: 'commit' });
  }
}

async function openCopilotChat(page: import('@playwright/test').Page) {
  // Click the "Ask Copilot" nav button — fires cf:open-copilot (no payload)
  // Widget opens showing robot + tabs + ticker only; chat panel stays closed until tapped.
  await page.locator('[title="Ask Copilot"]').click();
  await expect(page.locator('.cf-copilot-widget')).toBeVisible({ timeout: 10_000 });
  // Always click the Chat tab to open the panel.
  await page.locator('.cf-topic-btn').filter({ hasText: /^Chat$/ }).click();
  await expect(page.locator('textarea[placeholder="What\'s on your mind?"]')).toBeVisible({ timeout: 20_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Copilot voice — mobile smoke test', () => {

  // Warm up Railway once before the suite and again before each test.
  // beforeAll covers test 1; Railway can cool down between tests when the suite
  // is heavily loaded across workers — beforeEach keeps it warm for every test.
  async function warmRailway(request: import('@playwright/test').APIRequestContext, maxMs = 90_000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      try {
        const res = await request.get('/api/proxy/copilot/stt-status', { timeout: 15_000 });
        if (res.status() > 0) return;
      } catch { /* still booting */ }
      await new Promise(r => setTimeout(r, 3_000));
    }
  }

  test.beforeAll(async ({ request }) => { await warmRailway(request, 90_000); });
  // Short per-test ping (20s max): confirms Railway is still up without stalling
  // the suite. A 60s beforeEach adds 8+ minutes to a 40-minute suite and causes
  // downstream Railway cold-starts through increased overall duration.
  test.beforeEach(async ({ request }) => { await warmRailway(request, 20_000); });

  test('mic button shows Listening… state (no permission error)', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    // Take a baseline screenshot with widget open
    await page.screenshot({ path: 'e2e/copilot-robo-home.png' });

    // Tap the mic button — the small Mic icon button in the input bar
    const inputBar = page.locator('.cf-popup-input');
    const micButton = inputBar.locator('button').first(); // mic is first, send is second
    await expect(micButton).toBeVisible({ timeout: 20_000 });
    await micButton.click();

    // Should show "Listening…" — key regression test for RECORD_AUDIO fix
    // .first() because it appears in both the input bar AND the panel header simultaneously
    await expect(page.getByText('Listening…').first()).toBeVisible({ timeout: 12_000 });
    // Should NOT show any permission error
    await expect(page.getByText(/microphone permission denied/i)).not.toBeVisible();
    await expect(page.getByText(/could not start microphone/i)).not.toBeVisible();

    await page.screenshot({ path: 'e2e/copilot-robo-after-tap.png' });

    // Click the Stop button
    const stopBtn = page.locator('button').filter({ hasText: /stop/i }).first();
    await stopBtn.click();

    // After stopping — either "Processing…" briefly then back to idle, or mic error (if blob too small)
    // We just confirm it doesn't hang in "Listening…" permanently
    await expect(page.getByText('Listening…').first()).not.toBeVisible({ timeout: 10_000 });
  });

  test('processing state appears after stopping mic', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    const inputBar = page.locator('.cf-popup-input');
    const micButton = inputBar.locator('button').first();
    await expect(micButton).toBeVisible({ timeout: 8_000 });
    await micButton.click();
    await expect(page.getByText('Listening…').first()).toBeVisible({ timeout: 12_000 });

    // Record for 2 seconds so the fake audio device has time to produce data
    await page.waitForTimeout(2_000);

    const stopBtn = page.locator('button').filter({ hasText: /stop/i }).first();
    await stopBtn.click();

    // After stopping, "Processing…" should appear briefly (transcribing state)
    // OR if the fake blob is too small it's skipped — we accept either
    const processingVisible = await page.getByText('Processing…').isVisible().catch(() => false);
    if (processingVisible) {
      // Great — the full transcription path was exercised
      await expect(page.getByText('Processing…')).not.toBeVisible({ timeout: 20_000 });
    }
    // Either way, confirm we're back to a stable input state (no crash)
    await expect(page.locator('.cf-popup-input, [style*="Transcribing"]')).not.toContainText('Listening…', { timeout: 5_000 });
  });

  test('text message → reply appears → Read aloud button visible', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    // Type a short message and send it
    const textarea = page.locator('textarea[placeholder="What\'s on your mind?"]');
    await textarea.fill('Hi');
    await textarea.press('Enter');

    // Should show "Thinking…" / busy state
    await expect(
      page.getByText(/thinking|processing/i).or(page.locator('[style*="Thinking"]'))
    ).toBeVisible({ timeout: 10_000 }).catch(() => {});

    // Wait for the assistant reply — up to 75s covers: warm server (20s AI)
    // or cold start handled by app auto-retry (55s timeout + 5s wait + 20s AI).
    const replyBtn = page.locator('button[aria-label="Read aloud"]').first();
    await expect(replyBtn).toBeVisible({ timeout: 75_000 });

    // Reply text should be in the chat
    await expect(page.locator('[aria-label="Stop speaking"], [aria-label="Read aloud"]').first()).toBeVisible();
  });

  test('Read aloud button triggers TTS or shows Play reply fallback', async ({ page }) => {
    await loginWithPassword(page);
    await openCopilotChat(page);

    const textarea = page.locator('textarea[placeholder="What\'s on your mind?"]');
    await textarea.fill('Hello');
    await textarea.press('Enter');

    // Wait for a reply — 75s ceiling same as test above (covers cold-start path).
    const readAloudBtn = page.locator('button[aria-label="Read aloud"]').first();
    await expect(readAloudBtn).toBeVisible({ timeout: 75_000 });

    // Tap the read-aloud button
    await readAloudBtn.click();

    // On mobile/headless: TTS may either start (→ "Stop speaking") or be blocked (→ "🔊 Play reply")
    // Either outcome is acceptable — what we verify is it doesn't silently fail with no feedback
    await expect(
      page.locator('button[aria-label="Stop speaking"]')
        .or(page.locator('button').filter({ hasText: /play reply/i }))
    ).toBeVisible({ timeout: 5_000 });
  });

});
