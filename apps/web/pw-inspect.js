const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://sozialzynk.vercel.app/login?mode=expired');
  await page.waitForTimeout(3000);
  const allText = await page.locator('body').innerText();
  console.log('=== PAGE TEXT ===');
  console.log(allText.substring(0, 3000));
  await browser.close();
})();
