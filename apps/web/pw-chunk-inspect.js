// Inspect the editor chunk to see what's actually in it
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const chunks = new Map();

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('_next/static') && url.endsWith('.js')) chunks.set(url, '');
  });

  await page.goto('https://sozialzync.vercel.app/editor/cmu805rtj000xrq3l3p140e84', { waitUntil: 'networkidle' });

  let editorCode = '';
  let editorChunkName = '';
  for (const src of chunks.keys()) {
    const code = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.ok ? r.text() : '';
    }, src).catch(() => '');

    if (code.includes('timelineStartMs') || code.includes('pxPerSec') || code.includes('Detach Audio')) {
      editorCode = code;
      editorChunkName = src.split('/').pop();
      break;
    }
  }

  if (!editorCode) { console.log('Editor chunk not found'); await browser.close(); return; }
  console.log(`Editor chunk: ${editorChunkName} (${Math.round(editorCode.length/1024)}KB)`);

  // Search for patterns related to AudioContext and our fix
  const patterns = [
    'AudioContext',
    'resume',
    'suspended',
    'videoRef',
    'audioRef',
    'globalMuted',
    'startPlay',
    'v.muted',
    '.muted',
    'activeAudio',
    'linkedAudio',
    'rAF',
    'requestAnimationFrame',
  ];

  for (const p of patterns) {
    const idx = editorCode.indexOf(p);
    if (idx !== -1) {
      const snippet = editorCode.slice(Math.max(0, idx-30), idx+80).replace(/\s+/g, ' ');
      console.log(`\n"${p}" found at ${idx}:`);
      console.log('  ...', snippet, '...');
    } else {
      console.log(`\n"${p}": NOT FOUND`);
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
