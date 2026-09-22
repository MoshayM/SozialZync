// Search for minification-proof code signatures from the audio fix
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allScripts = new Map(); // url -> size

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('_next/static') && url.endsWith('.js')) {
      allScripts.set(url, 0);
    }
  });

  await page.goto('https://sozialzync.vercel.app/editor/cmu805rtj000xrq3l3p140e84', { waitUntil: 'networkidle' });
  console.log(`Chunks loaded: ${allScripts.size}`);

  // These patterns survive minification:
  // 1. 'suspended' — string literal in AudioContext.resume() check
  // 2. AudioContext — constructor name (global, not mangled)
  // 3. 'linkedAudioMuted' won't survive but look for the resume() pattern
  // 4. The old pattern was: muted=a||b||c||null!==d  (checking activeAudioItemRef)
  //    The new pattern adds the linked audio muted check before that

  const SURVIVING_PATTERNS = [
    { label: 'AudioContext constructor used', pattern: 'AudioContext' },
    { label: 'audioCtx.resume() with suspended check', pattern: "'suspended'" },
    { label: '"suspended" double-quote', pattern: '"suspended"' },
  ];

  let editorChunk = null;
  let results = {};

  for (const src of allScripts.keys()) {
    let code;
    try {
      code = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return r.ok ? r.text() : '';
      }, src);
    } catch { continue; }

    const name = src.split('/').pop();

    // The editor page chunk will contain 'MEDIA BIN' or 'activeSourceSec' patterns
    const isEditorChunk = code.includes('MEDIA BIN') ||
                          code.includes('Media Bin') ||
                          code.includes('activeSourceSec') ||
                          code.includes('pxPerSec') ||
                          code.includes('timelineStartMs') ||
                          code.includes('Detach Audio');

    if (isEditorChunk) {
      editorChunk = name;
      console.log(`\n📦 Editor chunk identified: ${name} (${Math.round(code.length/1024)}KB)`);

      for (const { label, pattern } of SURVIVING_PATTERNS) {
        const count = (code.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        results[label] = count;
        console.log(`   ${count > 0 ? '✅' : '❌'} ${label}: ${count} occurrence(s)`);
      }

      // Check for AudioContext usage specifically in a play-related context
      // New code: new AudioContext(), audioCtxRef.current.state==="suspended", .resume()
      const hasAudioCtxNew = /new\s+AudioContext\s*\(\s*\)/.test(code);
      const hasSuspendedCheck = /\.state\s*===?\s*["']suspended["']/.test(code);
      const hasResume = /\.resume\s*\(\s*\)/.test(code);

      console.log(`\n   AudioContext patterns (survive minification):`);
      console.log(`   new AudioContext(): ${hasAudioCtxNew ? '✅' : '❌'}`);
      console.log(`   .state === "suspended": ${hasSuspendedCheck ? '✅' : '❌'}`);
      console.log(`   .resume(): ${hasResume ? '✅' : '❌'}`);

      // Check if old single-condition mute is replaced by multi-condition mute
      // Old: ...||null!==activeAudioItemRef.current (just one check)
      // New: ...||linkedMuted||null!==activeAudioItemRef.current (two checks)
      // Since vars are mangled, look for the structural pattern around video.muted assignment
      // The comment "Audio routing" also won't survive but the code structure does

      const audioCtxUsed = hasAudioCtxNew && hasSuspendedCheck && hasResume;
      console.log(`\n🎯 Audio fix verdict: ${audioCtxUsed ? '✅ NEW CODE CONFIRMED DEPLOYED' : '❌ Pattern not found — might be minified differently'}`);
    }
  }

  if (!editorChunk) {
    console.log('\n❌ Could not identify the editor chunk');
    console.log('All chunks:', [...allScripts.keys()].map(s => s.split('/').pop()).join(', '));
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
