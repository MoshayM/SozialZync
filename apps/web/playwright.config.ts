import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL  = process.env.PW_BASE_URL ?? 'https://sozialzynk.vercel.app';
const AUTH_FILE = path.join(__dirname, 'e2e', '.auth.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 2,
  timeout: 150_000,
  expect: { timeout: 20_000 },   // bumped from 12 s — Railway API may be cold
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 60_000,
  },
  projects: [
    // ── Auth setup: runs once, saves storageState ────────────────────────────
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },

    // ── Default: Chromium desktop — runs ALL spec files ──────────────────────
    {
      name: 'chromium-desktop',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,      // start authenticated by default
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
        permissions: ['microphone'],
      },
    },

    // ── Mobile Chrome — selective tests ──────────────────────────────────────
    {
      name: 'chromium-mobile',
      dependencies: ['setup'],        // provides storageState so AI tests don't need fresh login
      use: {
        ...devices['Pixel 5'],
        storageState: AUTH_FILE,      // avoids repeated logins that trigger rate-limiting
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
        permissions: ['microphone'],
      },
      testMatch: [
        '**/login-mobile.spec.ts',
        '**/create-project-mobile.spec.ts',
        '**/copilot-voice.spec.ts',
        '**/copilot-widget.spec.ts',
      ],
    },

    // ── Firefox ───────────────────────────────────────────────────────────────
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: AUTH_FILE,      // avoids repeated logins & rate-limit waits
        // Block media streams — Firefox hangs when video players autoload in Watch Feed
        serviceWorkers: 'block',
      },
      testMatch: [
        '**/public.spec.ts',
        '**/auth.spec.ts',
        '**/browse.spec.ts',
        '**/copilot-widget.spec.ts',
      ],
    },

    // ── WebKit (Safari) ───────────────────────────────────────────────────────
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Safari'],
        storageState: AUTH_FILE,      // avoids repeated logins
        // ignoreHTTPSErrors: helps when IP is pinned via hosts file
        ignoreHTTPSErrors: true,
      },
      testMatch: [
        '**/public.spec.ts',
        '**/browse.spec.ts',
        '**/copilot-widget.spec.ts',
      ],
    },
  ],
});
