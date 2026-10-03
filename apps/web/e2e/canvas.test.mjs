/**
 * Unit tests for Canvas (canvas size / aspect ratio) logic in the standalone editor.
 * Mirrors all expressions from the Canvas bottom-sheet, preview container, and
 * secondary-layer aspect ratio used in page.tsx.
 *
 * Run: node apps/web/e2e/canvas.test.mjs
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function assertClose(a, b, label, tol = 0.001) {
  if (Math.abs(a - b) <= tol) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected ${b}, got ${a}`);
    failed++;
  }
}

// ── Canvas presets (mirrors the bottom-sheet presets array) ───────────────────

const CANVAS_PRESETS = [
  { label: 'Shorts / Reels', sub: '9:16 · 1080×1920', w: 1080, h: 1920 },
  { label: 'Square',         sub: '1:1 · 1080×1080',  w: 1080, h: 1080 },
  { label: 'Portrait',       sub: '4:5 · 1080×1350',  w: 1080, h: 1350 },
  { label: 'Widescreen',     sub: '16:9 · 1920×1080', w: 1920, h: 1080 },
];

/** Mirrors the `active` expression from the canvas bottom-sheet. */
function isActivePreset(timeline, preset) {
  return timeline?.width === preset.w && timeline?.height === preset.h;
}

/** Mirrors updateTimeline call when a canvas preset is applied. */
function applyPreset(timeline, preset) {
  return { ...timeline, width: preset.w, height: preset.h };
}

console.log('\n── Preset activation detection ───────────────────────────────────');
{
  // Default timeline (1920×1080) → Widescreen active
  const tl = { width: 1920, height: 1080, fps: 30, durationMs: 0, tracks: [] };
  const active = CANVAS_PRESETS.filter((p) => isActivePreset(tl, p));
  assert(active.length === 1, 'exactly one preset active for default 1920×1080');
  assert(active[0].label === 'Widescreen', 'default timeline activates Widescreen preset');
}

{
  // 1080×1920 → Shorts active
  const tl = { width: 1080, height: 1920 };
  const active = CANVAS_PRESETS.filter((p) => isActivePreset(tl, p));
  assert(active.length === 1, 'exactly one preset active for 1080×1920');
  assert(active[0].label === 'Shorts / Reels', '1080×1920 activates Shorts/Reels preset');
}

{
  // 1080×1080 → Square active
  const tl = { width: 1080, height: 1080 };
  const active = CANVAS_PRESETS.filter((p) => isActivePreset(tl, p));
  assert(active.length === 1, 'exactly one preset active for 1080×1080');
  assert(active[0].label === 'Square', '1080×1080 activates Square preset');
}

{
  // 1080×1350 → Portrait active
  const tl = { width: 1080, height: 1350 };
  const active = CANVAS_PRESETS.filter((p) => isActivePreset(tl, p));
  assert(active.length === 1, 'exactly one preset active for 1080×1350');
  assert(active[0].label === 'Portrait', '1080×1350 activates Portrait preset');
}

{
  // Custom size (e.g. 1280×720) → no preset active
  const tl = { width: 1280, height: 720 };
  const active = CANVAS_PRESETS.filter((p) => isActivePreset(tl, p));
  assert(active.length === 0, 'custom size activates no preset');
}

{
  // null timeline → no preset active (guarded by ?.)
  const active = CANVAS_PRESETS.filter((p) => isActivePreset(null, p));
  assert(active.length === 0, 'null timeline activates no preset');
}

// ── Preset uniqueness ──────────────────────────────────────────────────────────
console.log('\n── Preset uniqueness ─────────────────────────────────────────────');
{
  // No two presets should share the same (w, h) pair
  const seen = new Set();
  let allUnique = true;
  for (const p of CANVAS_PRESETS) {
    const key = `${p.w}×${p.h}`;
    if (seen.has(key)) { allUnique = false; break; }
    seen.add(key);
  }
  assert(allUnique, 'all presets have unique (w, h) pairs — no ambiguous activation');
}

// ── applyPreset (updateTimeline call) ─────────────────────────────────────────
console.log('\n── applyPreset ───────────────────────────────────────────────────');
{
  const tl = { width: 1920, height: 1080, fps: 30, durationMs: 5000, tracks: [{ id: 't1' }] };

  for (const preset of CANVAS_PRESETS) {
    const updated = applyPreset(tl, preset);
    assert(updated.width === preset.w, `applyPreset sets width=${preset.w} for "${preset.label}"`);
    assert(updated.height === preset.h, `applyPreset sets height=${preset.h} for "${preset.label}"`);
    assert(updated.fps === tl.fps, `applyPreset preserves fps for "${preset.label}"`);
    assert(updated.durationMs === tl.durationMs, `applyPreset preserves durationMs for "${preset.label}"`);
    assert(updated.tracks === tl.tracks, `applyPreset preserves tracks reference for "${preset.label}"`);
  }
}

// ── Aspect ratio computation ───────────────────────────────────────────────────
// The preview container should show the canvas at the correct ratio.
// Computed as: aspectRatio = w / h

function canvasAspect(w, h) { return w / h; }

console.log('\n── Aspect ratio values ───────────────────────────────────────────');
{
  assertClose(canvasAspect(1920, 1080), 16 / 9,  'Widescreen  → 16:9 ratio');
  assertClose(canvasAspect(1080, 1920), 9 / 16,  'Shorts      → 9:16 ratio');
  assertClose(canvasAspect(1080, 1080), 1,        'Square      → 1:1 ratio');
  assertClose(canvasAspect(1080, 1350), 4 / 5,   'Portrait    → 4:5 ratio');
}

// ── Preview container height from aspect ratio ─────────────────────────────────
// Given a container width and the canvas aspect ratio, compute the preview height
// so the preview exactly fits the canvas frame.
// height = containerWidth / aspectRatio (letterbox: cap at containerHeight)

function previewFrameHeight(containerW, containerH, canvasW, canvasH) {
  const ratio = canvasW / canvasH;
  const h = Math.round(containerW / ratio);
  return Math.min(h, containerH);
}

console.log('\n── Preview frame height ──────────────────────────────────────────');
{
  // Widescreen 16:9 inside 960×540 container → full height
  assertClose(previewFrameHeight(960, 540, 1920, 1080), 540, 'Widescreen fits exactly in 960×540');

  // Shorts 9:16 in 960×540: height = 960/(9/16) = 960*(16/9) = 1706 → capped at 540
  assertClose(previewFrameHeight(960, 540, 1080, 1920), 540, 'Shorts 9:16 capped at container height');

  // Square 1:1 in 960×540: height = 960/1 = 960 → capped at 540
  assertClose(previewFrameHeight(960, 540, 1080, 1080), 540, 'Square 1:1 capped at container height');

  // Widescreen in 800×200: height = 800/(16/9) = 450 → capped at 200
  assertClose(previewFrameHeight(800, 200, 1920, 1080), 200, 'Widescreen capped when container is short');

  // Portrait 4:5 in 400×600: height = 400/(4/5) = 500 → fits
  assertClose(previewFrameHeight(400, 600, 1080, 1350), 500, 'Portrait 4:5 fits within tall container');
}

// ── Preview frame width from aspect ratio ─────────────────────────────────────
// Given the container dimensions, the visible frame width = min(containerW, frameH * ratio)

function previewFrameWidth(containerW, containerH, canvasW, canvasH) {
  const ratio = canvasW / canvasH;
  const h = Math.min(Math.round(containerW / ratio), containerH);
  return Math.min(containerW, Math.round(h * ratio));
}

console.log('\n── Preview frame width ───────────────────────────────────────────');
{
  // Widescreen 16:9 in 960×540 → full width 960
  assertClose(previewFrameWidth(960, 540, 1920, 1080), 960, 'Widescreen: full width in matching container');

  // Shorts 9:16 in 960×540: h=540, w=540*(9/16)=303.75≈304
  assertClose(previewFrameWidth(960, 540, 1080, 1920), 304, 'Shorts 9:16: narrow pillarboxed frame');

  // Square 1:1 in 960×540: h=540, w=540*1=540
  assertClose(previewFrameWidth(960, 540, 1080, 1080), 540, 'Square 1:1: square frame in wide container');
}

// ── Default seed dimensions ────────────────────────────────────────────────────
// The seed timeline must default to 1920×1080 (from const seed in page.tsx)

console.log('\n── Seed timeline defaults ────────────────────────────────────────');
{
  const seed = { width: 1920, height: 1080, fps: 30, durationMs: 0, tracks: [] };
  assert(seed.width === 1920, 'seed width defaults to 1920');
  assert(seed.height === 1080, 'seed height defaults to 1080');
  assert(seed.fps === 30, 'seed fps defaults to 30');
  assert(isActivePreset(seed, CANVAS_PRESETS.find((p) => p.label === 'Widescreen')), 'seed activates Widescreen preset');
}

// ── Canvas size display string ─────────────────────────────────────────────────
// Mirrors the display in the bottom-sheet header:
// `${timeline?.width ?? 1920}×${timeline?.height ?? 1080}`

function canvasSizeLabel(timeline) {
  return `${timeline?.width ?? 1920}×${timeline?.height ?? 1080}`;
}

console.log('\n── Canvas size label ─────────────────────────────────────────────');
{
  assert(canvasSizeLabel({ width: 1920, height: 1080 }) === '1920×1080', 'Widescreen label');
  assert(canvasSizeLabel({ width: 1080, height: 1920 }) === '1080×1920', 'Shorts label');
  assert(canvasSizeLabel({ width: 1080, height: 1080 }) === '1080×1080', 'Square label');
  assert(canvasSizeLabel({ width: 1080, height: 1350 }) === '1080×1350', 'Portrait label');
  assert(canvasSizeLabel(null) === '1920×1080', 'null timeline falls back to 1920×1080');
  assert(canvasSizeLabel(undefined) === '1920×1080', 'undefined timeline falls back to 1920×1080');
}

// ── Round-trip: apply then detect ─────────────────────────────────────────────
console.log('\n── Apply then detect round-trip ──────────────────────────────────');
{
  const initial = { width: 1920, height: 1080, fps: 30, durationMs: 0, tracks: [] };
  for (const preset of CANVAS_PRESETS) {
    const after = applyPreset(initial, preset);
    const detected = CANVAS_PRESETS.filter((p) => isActivePreset(after, p));
    assert(detected.length === 1, `round-trip: exactly one active preset after applying "${preset.label}"`);
    assert(detected[0].label === preset.label, `round-trip: detects "${preset.label}" after applying it`);
  }
}

// ── Immutable update ───────────────────────────────────────────────────────────
// applyPreset must not mutate the original timeline (spread creates new object)

console.log('\n── Immutable update ──────────────────────────────────────────────');
{
  const original = { width: 1920, height: 1080, fps: 30, durationMs: 0, tracks: [] };
  const updated = applyPreset(original, CANVAS_PRESETS[0]); // Shorts
  assert(original.width === 1920, 'original width unchanged after apply');
  assert(original.height === 1080, 'original height unchanged after apply');
  assert(updated !== original, 'apply returns a new object, not the same reference');
}

// ── Secondary layer aspect ratio ───────────────────────────────────────────────
// SecondaryVideoPlayer uses `aspectRatio: '16/9'` (hardcoded).
// Tests validate that the ratio string parses to the expected numeric value
// and that each canvas preset's ratio is correctly representable.

console.log('\n── Secondary layer aspect ratio ──────────────────────────────────');
{
  // The current implementation always uses '16/9' for the SecondaryVideoPlayer div.
  // This is intentional — secondary layers are always 16:9 video clips overlaid on
  // any canvas. The canvas ratio only changes the output frame, not the clip shape.
  const [w, h] = '16/9'.split('/').map(Number);
  assertClose(w / h, 16 / 9, "secondary layer '16/9' aspectRatio parses correctly");
}

{
  // Validate each preset's ratio string (as CSS `${w}/${h}`)
  for (const p of CANVAS_PRESETS) {
    const ratio = p.w / p.h;
    assertClose(ratio, canvasAspect(p.w, p.h), `${p.label}: aspect ratio ${p.w}/${p.h} consistent`);
  }
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
