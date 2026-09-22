/**
 * Debug spec: capture what's actually failing when the editor loads
 */
import { test } from '@playwright/test';

const TEST_EDIT_ID = 'cmua2lpdg0022p23lahy24woo';

test('debug editor load', async ({ page }) => {
  const networkErrors: string[] = [];
  const consoleLogs: string[] = [];

  page.on('response', async (res) => {
    if (res.url().includes('/editor/') || res.url().includes('/proxy/')) {
      const status = res.status();
      if (status >= 400) {
        try {
          const body = await res.text();
          networkErrors.push(`${status} ${res.url()} → ${body.slice(0, 200)}`);
        } catch {
          networkErrors.push(`${status} ${res.url()}`);
        }
      } else {
        networkErrors.push(`${status} OK ${res.url()}`);
      }
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('Error')) {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto(`/editor/${TEST_EDIT_ID}`);
  await page.waitForTimeout(8000);

  console.log('\n=== Network requests involving editor/proxy ===');
  networkErrors.forEach(e => console.log(e));
  console.log('\n=== Console errors ===');
  consoleLogs.forEach(e => console.log(e));
  console.log('\n=== Current URL ===', page.url());

  await page.screenshot({ path: 'pw-verify-fixes/debug-editor.png' });
  require('fs').mkdirSync('pw-verify-fixes', { recursive: true });
  await page.screenshot({ path: 'pw-verify-fixes/debug-editor.png' });
});
