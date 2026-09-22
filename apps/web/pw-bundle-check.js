// Search all loaded JS chunks for the new audio fix identifiers
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const allScripts = new Set();

  // Intercept all JS requests to capture dynamic chunks too
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('_next/static') && url.endsWith('.js')) {
      allScripts.add(url);
    }
  });

  // Load home first
  await page.goto('https://sozialzync.vercel.app/', { waitUntil: 'networkidle' });
  // Load editor list to trigger lazy chunks
  await page.goto('https://sozialzync.vercel.app/editor', { waitUntil: 'networkidle' });
  // Load an actual editor page to trigger the editor chunk
  await page.goto('https://sozialzync.vercel.app/editor/cmu805rtj000xrq3l3p140e84', { waitUntil: 'networkidle' });

  console.log(`Total JS chunks intercepted: ${allScripts.size}`);

  const MARKERS = ['activeLinkedAudioItemRef', 'linkedAudioMuted', 'audioCtxRef', 'allActiveAudioItems'];
  let foundIn = null;

  for (const src of allScripts) {
    try {
      const code = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return r.ok ? r.text() : '';
      }, src);

      const hits = MARKERS.filter(m => code.includes(m));
      if (hits.length > 0) {
        foundIn = src.split('/').pop();
        console.log(`\n✅ FOUND in ${foundIn}`);
        console.log(`   Markers present: ${hits.join(', ')}`);

        // Also check the OLD mute logic is gone
        const hasOldMute = code.includes('activeAudioItemRef.current!==null') ||
                           code.includes('activeAudioItemRef.current !==null');
        const hasNewMute = code.includes('linkedAudioMuted');
        console.log(`   Old blanket-mute logic removed: ${!hasOldMute ? '✅' : '⚠️'}`);
        console.log(`   New linked-audio mute logic: ${hasNewMute ? '✅' : '⚠️'}`);
        break;
      }
    } catch { /* skip */ }
  }

  if (!foundIn) {
    console.log('\n❌ Audio fix markers NOT found in any intercepted chunk');
    console.log('Chunks searched:', [...allScripts].map(s => s.split('/').pop()).join(', '));
  }

  await browser.close();
  process.exit(foundIn ? 0 : 1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
