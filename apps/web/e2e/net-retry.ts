/**
 * Retry page.goto() on transient network errors with increasing back-off.
 * Delays: 10 s → 25 s → 50 s — total max wait ≈ 85 s, fits inside 150 s timeout.
 */
const NETWORK_ERR = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_TIMED_OUT|ERR_CONNECTION_TIMED_OUT|NS_ERROR_UNKNOWN_HOST|Could not resolve hostname/i;
const DELAYS = [10_000, 25_000, 50_000];

type PW_Page = import('@playwright/test').Page;

export async function gotoWithRetry(
  page: PW_Page,
  url: string,
  options?: Parameters<PW_Page['goto']>[1],
): Promise<void> {
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      await page.goto(url, options);
      return;
    } catch (err) {
      const msg = String(err);
      if (NETWORK_ERR.test(msg) && attempt < DELAYS.length) {
        const wait = DELAYS[attempt]!;
        console.warn(`[net-retry] ${msg.split('\n')[0]} — waiting ${wait / 1000}s (attempt ${attempt + 1}/${DELAYS.length})`);
        await page.waitForTimeout(wait);
        continue;
      }
      throw err;
    }
  }
}
