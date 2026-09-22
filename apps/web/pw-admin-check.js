const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://sozialzynk.vercel.app/login');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  // Sign in with Google (can't automate) — just check if admin panel URL is accessible
  // Navigate directly to admin panel to see what loads for unauthenticated user
  await page.goto('https://sozialzynk.vercel.app/admin');
  await page.waitForTimeout(3000);
  console.log('URL after navigation:', page.url());
  const text = await page.locator('body').innerText();
  console.log(text.substring(0, 500));
  await page.screenshot({ path: 'pw-admin-check.png', fullPage: false });
  await browser.close();
})();
