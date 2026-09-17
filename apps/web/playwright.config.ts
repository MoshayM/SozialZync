import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL ?? 'https://sozialzynk.vercel.app';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 1,
  timeout: 150_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 60_000,
  },
  projects: [
    // ── Chromium (Chrome / Brave) — full voice test including mic ────────────
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
        permissions: ['microphone'],
      },
      testMatch: ['**/copilot-voice.spec.ts', '**/copilot-widget.spec.ts'],
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
        permissions: ['microphone'],
      },
      testMatch: ['**/copilot-voice.spec.ts', '**/copilot-widget.spec.ts'],
    },
    // ── Firefox — text + TTS button only (no fake media flags) ──────────────
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/copilot-widget.spec.ts'],
    },
    // ── WebKit (Safari) — text + TTS button only ────────────────────────────
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/copilot-widget.spec.ts'],
    },
  ],
});
