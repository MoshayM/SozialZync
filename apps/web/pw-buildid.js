// Get build ID and find editor chunk
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const BASE = 'https://sozialzync.vercel.app';

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Extract buildId from inline Next.js data
  const buildId = await page.evaluate(() => {
    for (const s of document.querySelectorAll('script')) {
      const m = (s.textContent || '').match(/"buildId":"([^"]+)"/);
      if (m) return m[1];
    }
    return null;
  });
  console.log('Build ID:', buildId);

  if (buildId) {
    // Fetch the buildManifest which lists all chunks for each page
    const resp = await page.request.get(`${BASE}/_next/static/${buildId}/_buildManifest.js`);
    if (resp.ok()) {
      const txt = await resp.text();
      // Find editor route entry
      const editorMatch = txt.match(/editor[^:]*:\s*\[([^\]]+)\]/g);
      console.log('Editor route chunks:', editorMatch?.join('\n'));
      // Find all page chunks
      const pageChunks = txt.match(/"static\/chunks\/[^"]+\.js"/g) || [];
      console.log('\nAll page-level chunks:');
      pageChunks.forEach(c => console.log(' ', c));
    }
  }

  // Directly fetch the editor page chunk at App Router path
  const editorChunkUrl = `${BASE}/_next/static/chunks/app/%28dash%29/editor/%5BeditId%5D/page.js`;
  const editorResp = await page.request.get(editorChunkUrl);
  console.log(`\nDirect editor chunk fetch (${editorChunkUrl}):`);
  console.log(`  Status: ${editorResp.status()}`);
  if (editorResp.ok()) {
    const body = await editorResp.text();
    console.log(`  Size: ${Math.round(body.length/1024)}KB`);
    console.log(`  AudioContext: ${body.includes('AudioContext') ? '✅' : '❌'}`);
    console.log(`  suspended: ${body.includes('suspended') ? '✅' : '❌'}`);
    console.log(`  .resume: ${body.includes('.resume') ? '✅' : '❌'}`);
    // Show ~500 chars around requestAnimationFrame
    const idx = body.indexOf('requestAnimationFrame');
    if (idx > -1) {
      console.log('\nrAF context:');
      console.log(body.slice(Math.max(0,idx-100), idx+500));
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
