// Find the current build's editor page chunk via the deployment manifest
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Fetch the App Router flight manifest — lists all page chunks
  const baseUrl = 'https://sozialzync.vercel.app';

  // Try to find editor chunk via the client-reference-manifest
  const manifests = [
    '/_next/static/chunks/app/(dash)/editor/[editId]/page.js',
    '/_next/static/chunks/app/(dash)/editor/%5BeditId%5D/page.js',
  ];

  for (const m of manifests) {
    const resp = await page.request.get(baseUrl + m);
    if (resp.ok()) {
      const body = await resp.text();
      console.log(`Found: ${m}`);
      console.log(`Size: ${Math.round(body.length/1024)}KB`);
      const hasAudioCtx = body.includes('AudioContext');
      const hasSuspended = body.includes('suspended');
      const hasResume = body.includes('.resume(');
      console.log(`AudioContext: ${hasAudioCtx ? '✅' : '❌'}`);
      console.log(`"suspended": ${hasSuspended ? '✅' : '❌'}`);
      console.log(`.resume(): ${hasResume ? '✅' : '❌'}`);
      console.log('\nSample of play-area code:');
      const idx = body.indexOf('requestAnimationFrame');
      if (idx > -1) console.log('...', body.slice(Math.max(0,idx-200), idx+400), '...');
    }
  }

  // Also try fetching the build manifest to find the editor chunk hash
  const buildManifest = await page.request.get(`${baseUrl}/_next/static/${await page.evaluate(async () => {
    const r = await fetch('/_next/static/chunks/main-app.js');
    const txt = await r.text();
    const m = txt.match(/__BUILD_ID[^"]*"([^"]+)"/);
    return m ? m[1] : 'unknown';
  })}/pages-manifest.json`);

  // Alternative: get the current _NEXT_DATA or buildId
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const buildId = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    if (el) return JSON.parse(el.textContent || '{}').buildId;
    // Try next script tag
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const s of scripts) {
      const m = (s.textContent || '').match(/"buildId":"([^"]+)"/);
      if (m) return m[1];
    }
    return null;
  });
  console.log(`\nBuild ID: ${buildId}`);

  if (buildId) {
    // Fetch the page manifest for the editor route
    const editorManifest = await page.request.get(
      `${baseUrl}/_next/static/${buildId}/_buildManifest.js`
    );
    if (editorManifest.ok()) {
      const txt = await editorManifest.text();
      console.log('Build manifest (first 500 chars):', txt.slice(0, 500));
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
