/**
 * Retry page.goto() on transient network errors with increasing back-off.
 * Used by .js spec files that test against the live Vercel deployment where
 * the network can drop briefly (ERR_INTERNET_DISCONNECTED, ERR_NETWORK_CHANGED,
 * ERR_TIMED_OUT) before recovering.
 *
 * Delays: 10 s → 25 s → 50 s — total max wait ≈ 85 s, fits inside 150 s timeout.
 */
const NETWORK_ERR = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_TIMED_OUT|ERR_CONNECTION_TIMED_OUT|NS_ERROR_UNKNOWN_HOST|Could not resolve hostname/i;
const DELAYS = [10_000, 25_000, 50_000];

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 * @param {Parameters<import('@playwright/test').Page['goto']>[1]} [options]
 */
async function gotoWithRetry(page, url, options) {
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      await page.goto(url, options);
      return;
    } catch (err) {
      const msg = String(err);
      if (NETWORK_ERR.test(msg) && attempt < DELAYS.length) {
        const wait = DELAYS[attempt];
        console.warn(`[net-retry] ${msg.split('\n')[0]} — waiting ${wait / 1000}s (attempt ${attempt + 1}/${DELAYS.length})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

module.exports = { gotoWithRetry };
