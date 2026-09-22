// Audio fix verification — checks video element is NOT muted for linked audio clips
const { chromium } = require('@playwright/test');
const { createHmac } = require('crypto');

const BASE = 'https://sozialzync.vercel.app';
const JWT_SECRET = '8c1fe81b4a0c0e182dd28849d52be9371062aef';

function makeJwt(payload, secret) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${s}`;
}

const USER = { id: 'cmrxvqtrr0001la046w82ne3v', email: 'ethonanpasumvalki@gmail.com', name: 'Ethonan P', role: 'SUPER_ADMIN', plan: 'PRO' };

// Real project IDs from screenshots — these have actual video clips on the timeline
const KNOWN_PROJECTS = ['cmu805rtj000xrq3l3p140e84', 'cmu6zw48h009pqh3lc53e92rv'];

(async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = makeJwt({ sub: USER.id, email: USER.email, role: USER.role, sid: 'audio-test', plan: USER.plan, iat: now, exp: now + 3600 }, JWT_SECRET);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Inject auth
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ tok, u }) => {
    localStorage.setItem('cf_token', tok);
    localStorage.setItem('cf.refreshToken', tok);
    localStorage.setItem('cf_user_role', u.role);
    localStorage.setItem('cf_user_name', u.name);
    localStorage.setItem('cf_mock_email', u.email);
  }, { tok: token, u: USER });

  console.log('─── Step 1: Verify new bundle is deployed ───────────────────────────');
  // Fetch the editor page HTML and check for our new code markers in the JS bundle
  await page.goto(`${BASE}/editor/${KNOWN_PROJECTS[0]}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'pw-audio-01-load.png' });

  // Check bundle content for key new identifiers
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.src)
      .filter(s => s.includes('_next/static'));
  });
  console.log(`Found ${scripts.length} script tags`);

  // Fetch the main JS chunk and look for our new code signatures
  let bundleHasNewCode = false;
  for (const src of scripts.slice(0, 6)) {
    try {
      const code = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return r.text();
      }, src);
      if (code.includes('activeLinkedAudioItemRef') || code.includes('linkedAudioMuted')) {
        bundleHasNewCode = true;
        console.log(`✅ New audio fix found in bundle: ${src.split('/').pop()}`);
        break;
      }
    } catch { /* skip */ }
  }
  if (!bundleHasNewCode) {
    console.log('⚠️  New code not found in sampled chunks — may be in a different chunk or still deploying');
  }

  console.log('\n─── Step 2: Check editor loads ──────────────────────────────────────');
  const url = page.url();
  const pageText = await page.locator('body').innerText().catch(() => '');
  const hasError = pageText.includes('Something went wrong') || pageText.includes('processing failed');
  const hasEditor = pageText.includes('Video Editor') || pageText.includes('Media Bin') || pageText.includes('MEDIA BIN');
  console.log(`URL: ${url}`);
  console.log(`Has editor UI: ${hasEditor}`);
  console.log(`Has error: ${hasError}`);
  await page.screenshot({ path: 'pw-audio-02-editor.png' });

  console.log('\n─── Step 3: Check <video> muted state before play ───────────────────');
  const videoState = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    return { muted: v.muted, src: v.src ? 'has-src' : 'no-src', paused: v.paused, volume: v.volume };
  });
  console.log('Video element state (before play):', JSON.stringify(videoState));

  console.log('\n─── Step 4: Click Play and check audio state ────────────────────────');
  // Try to find and click the play button
  const playBtn = page.locator('button').filter({ hasText: /^$/ }).locator('svg').filter({ hasClass: /lucide-play/ }).first();
  const playBtnAlt = page.locator('[title*="lay"], button[aria-label*="lay"]').first();

  // More reliable: find any button containing the play icon SVG path
  const clicked = await page.evaluate(() => {
    // Look for the play button in the preview area
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg && (svg.getAttribute('class') || '').includes('lucide-play')) {
        btn.click();
        return true;
      }
      // Also check for play via path data
      const paths = btn.querySelectorAll('path');
      for (const p of paths) {
        const d = p.getAttribute('d') || '';
        // Play icon has a triangular path
        if (d.includes('M6 3') || d.startsWith('m6') || d.includes('5 3L19 12')) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  });
  console.log(`Play button clicked: ${clicked}`);
  await page.waitForTimeout(1500);

  const videoStateAfterPlay = await page.evaluate(() => {
    const v = document.querySelector('video');
    const a = document.querySelector('audio');
    if (!v) return null;
    return {
      video: { muted: v.muted, paused: v.paused, volume: v.volume, src: v.src ? 'has-src' : 'no-src' },
      audio: a ? { muted: a.muted, paused: a.paused, src: a.src ? 'has-src' : 'no-src' } : null,
    };
  });
  console.log('Media element state (after play click):', JSON.stringify(videoStateAfterPlay, null, 2));
  await page.screenshot({ path: 'pw-audio-03-playing.png' });

  const videoMuted = videoStateAfterPlay?.video?.muted;
  const videoPlaying = videoStateAfterPlay?.video?.paused === false;

  console.log('\n════════════════════ RESULTS ════════════════════');
  console.log(`Bundle has new code:    ${bundleHasNewCode ? '✅' : '⚠️  (may be in unchecked chunk)'}`);
  console.log(`Editor page loads:      ${hasEditor ? '✅' : hasError ? '❌ (error state)' : '⚠️  (unknown)'}`);
  console.log(`Video NOT muted:        ${videoMuted === false ? '✅ AUDIO WILL PLAY' : videoMuted === true ? '❌ STILL MUTED' : '⚠️  no video element'}`);
  console.log(`Video is playing:       ${videoPlaying ? '✅' : '⚠️  (paused or no src)'}`);
  console.log('═════════════════════════════════════════════════');

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
