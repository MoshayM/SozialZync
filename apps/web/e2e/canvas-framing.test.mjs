/**
 * Unit tests for canvas-aware preview framing introduced in commit 4974bb2.
 * Focuses on vertical (9:16) and non-widescreen canvases.
 *
 * Run: node apps/web/e2e/canvas-framing.test.mjs
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
function assertClose(a, b, label, tol = 0.5) {
  if (Math.abs(a - b) <= tol) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected ${b}, got ${a}`);
    failed++;
  }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ── Helpers that mirror the page JSX ──────────────────────────────────────────

/** Mirrors: `aspectRatio: \`${timeline?.width ?? 1920} / ${timeline?.height ?? 1080}\`` */
function frameAspectRatioString(timeline) {
  return `${timeline?.width ?? 1920} / ${timeline?.height ?? 1080}`;
}

/** Parse the CSS aspect-ratio string back to a numeric ratio. */
function parseAspectRatio(str) {
  const [w, h] = str.split('/').map((s) => parseFloat(s.trim()));
  return w / h;
}

/**
 * Given a container (outerW × outerH) and a canvas (canvasW × canvasH),
 * compute the inner frame's rendered pixel dimensions.
 * Mirrors CSS: aspectRatio + maxWidth:100% + maxHeight:100%.
 */
function computeFrame(outerW, outerH, canvasW, canvasH) {
  const ratio = canvasW / canvasH;
  // Start with full width, then check if height fits
  let w = outerW;
  let h = Math.round(w / ratio);
  if (h > outerH) {
    // Height would overflow — constrain by height instead
    h = outerH;
    w = Math.round(h * ratio);
  }
  return { w, h };
}

/**
 * Drag position computation — mirrors the text-overlay onPointerDown handler.
 * Uses the FRAME rect (not the outer container).
 */
function computeDragPos(startPct, delta, frameSize) {
  return clamp(startPct + (delta / frameSize) * 100, 0, 100);
}

// ── Aspect ratio string ────────────────────────────────────────────────────────
console.log('\n── aspectRatio CSS string ────────────────────────────────────────');
{
  assert(frameAspectRatioString({ width: 1920, height: 1080 }) === '1920 / 1080', 'Widescreen → "1920 / 1080"');
  assert(frameAspectRatioString({ width: 1080, height: 1920 }) === '1080 / 1920', 'Shorts 9:16 → "1080 / 1920"');
  assert(frameAspectRatioString({ width: 1080, height: 1080 }) === '1080 / 1080', 'Square 1:1 → "1080 / 1080"');
  assert(frameAspectRatioString({ width: 1080, height: 1350 }) === '1080 / 1350', 'Portrait 4:5 → "1080 / 1350"');
  assert(frameAspectRatioString(null)      === '1920 / 1080', 'null timeline → fallback "1920 / 1080"');
  assert(frameAspectRatioString(undefined) === '1920 / 1080', 'undefined timeline → fallback "1920 / 1080"');
}

// ── Numeric ratio from string ──────────────────────────────────────────────────
console.log('\n── Numeric ratio parsing ─────────────────────────────────────────');
{
  assertClose(parseAspectRatio(frameAspectRatioString({ width: 1920, height: 1080 })), 16 / 9,  'Widescreen → 1.778');
  assertClose(parseAspectRatio(frameAspectRatioString({ width: 1080, height: 1920 })), 9 / 16,  'Shorts 9:16 → 0.5625');
  assertClose(parseAspectRatio(frameAspectRatioString({ width: 1080, height: 1080 })), 1,        'Square → 1.0');
  assertClose(parseAspectRatio(frameAspectRatioString({ width: 1080, height: 1350 })), 4 / 5,   'Portrait → 0.8');
}

// ── Frame sizing: widescreen container ────────────────────────────────────────
// Outer container: 960 × 300 (wide, short — typical desktop editor preview bar)

console.log('\n── Frame sizing in 960×300 widescreen container ──────────────────');
{
  // 16:9 canvas → fills full width, height = 300 is capped (actually 960/1.778=540>300 → cap at h=300, w=533)
  const f = computeFrame(960, 300, 1920, 1080);
  assertClose(f.h, 300, 'Widescreen: frame height capped at container height (300)');
  assertClose(f.w, Math.round(300 * (16 / 9)), 'Widescreen: frame width = 300 * (16/9) = 533');
}
{
  // 9:16 canvas in 960×300 container → h=300 (cap), w=300*(9/16)=168.75≈169
  const f = computeFrame(960, 300, 1080, 1920);
  assertClose(f.h, 300, 'Shorts 9:16: frame height capped at container height');
  assertClose(f.w, Math.round(300 * (9 / 16)), 'Shorts 9:16: narrow pillarboxed frame width = 169');
  assert(f.w < 960 / 2, 'Shorts 9:16: frame is narrower than half the container (visible pillarbox)');
}
{
  // 1:1 canvas in 960×300 → h=300 (cap), w=300
  const f = computeFrame(960, 300, 1080, 1080);
  assertClose(f.h, 300, 'Square: height capped at container height');
  assertClose(f.w, 300, 'Square: frame width equals height (perfect square)');
  assert(f.w < 960, 'Square: clear black bars on left and right');
}
{
  // 4:5 canvas in 960×300 → h=300, w=300*(4/5)=240
  const f = computeFrame(960, 300, 1080, 1350);
  assertClose(f.h, 300, 'Portrait 4:5: height capped at container height');
  assertClose(f.w, 240, 'Portrait 4:5: frame width = 240');
  assert(f.w < 960, 'Portrait 4:5: black bars on left and right');
}

// ── Frame sizing: tall container ───────────────────────────────────────────────
// Outer container: 400 × 700 (portrait-ish, e.g. mobile preview)

console.log('\n── Frame sizing in 400×700 tall container ────────────────────────');
{
  // 9:16 canvas in 400×700: w=400 fits, h=400/(9/16)=711 > 700 → cap at h=700, w=700*(9/16)=393.75≈394
  const f = computeFrame(400, 700, 1080, 1920);
  assertClose(f.h, 700, 'Shorts 9:16 in tall container: height capped');
  assertClose(f.w, Math.round(700 * (9 / 16)), 'Shorts 9:16 in tall container: width = 394');
}
{
  // 16:9 canvas in 400×700: w=400, h=400/1.778=225 < 700 → no cap needed
  const f = computeFrame(400, 700, 1920, 1080);
  assertClose(f.w, 400, 'Widescreen in tall container: fills full width');
  assertClose(f.h, Math.round(400 / (16 / 9)), 'Widescreen in tall container: height = 225');
  assert(f.h < 700, 'Widescreen in tall container: black bars above and below');
}

// ── Pillarbox calculation for Shorts 9:16 ────────────────────────────────────
// The horizontal black bar width on each side of the pillarboxed frame

console.log('\n── Pillarbox bar width for Shorts 9:16 ──────────────────────────');
{
  const outerW = 960, outerH = 300;
  const f = computeFrame(outerW, outerH, 1080, 1920);
  const barWidth = (outerW - f.w) / 2;
  assert(barWidth > 0, 'Shorts 9:16: positive pillarbox bar on each side');
  assertClose(barWidth, (960 - Math.round(300 * 9 / 16)) / 2, 'Shorts 9:16: bar width = (960 - frameW) / 2');
  assert(f.w + 2 * barWidth <= outerW + 1, 'Shorts 9:16: frame + 2 bars fits exactly in container');
}

// ── Letterbox calculation for Widescreen in square container ─────────────────

console.log('\n── Letterbox for 16:9 video in 1:1 frame ────────────────────────');
{
  // When a 16:9 video plays inside a 1:1 (square) canvas frame,
  // CSS object-contain will add letterbox bars top & bottom.
  // frameH = 300, frameW = 300 (square frame)
  // video natural ratio = 16:9 → rendered video height = 300*(9/16) = 168.75
  const frameSize = 300;
  const videoRatio = 16 / 9;
  const renderedVideoH = frameSize / videoRatio; // constrained by width
  const barH = (frameSize - renderedVideoH) / 2;
  assert(barH > 0, '16:9 video letterboxed inside 1:1 frame has top/bottom bars');
  assertClose(renderedVideoH, 300 * (9 / 16), '16:9 video rendered height inside square frame');
}

// ── Drag position with previewFrameRef ────────────────────────────────────────
// For a 9:16 canvas in a 960×300 container, the frame is ~169×300.
// A drag of 50px horizontally on the frame maps to (50/169)*100 ≈ 29.6%
// The SAME 50px drag on the outer container (960px wide) would be only (50/960)*100 ≈ 5.2%
// Using the frame ref corrects this — prevents the drag from feeling sluggish on vertical canvases.

console.log('\n── Drag position uses frame rect (not outer container) ───────────');
{
  const outerW = 960, outerH = 300;
  const f = computeFrame(outerW, outerH, 1080, 1920); // Shorts 9:16
  const frameW = f.w; // ≈ 169

  const dragDeltaPx = 50;
  const posUsingFrame = computeDragPos(50, dragDeltaPx, frameW);
  const posUsingOuter = computeDragPos(50, dragDeltaPx, outerW);

  assert(posUsingFrame > posUsingOuter, 'frame-based drag gives larger Δ% than container-based drag');
  assertClose(posUsingFrame, 50 + (dragDeltaPx / frameW) * 100, 'frame-based drag: correct position');
  assertClose(posUsingOuter, 50 + (dragDeltaPx / outerW) * 100, 'container-based drag: would be too sluggish');

  // The ratio shows how much more responsive the frame-based drag is
  const sensitivityRatio = (posUsingFrame - 50) / (posUsingOuter - 50);
  assertClose(sensitivityRatio, outerW / frameW, 'sensitivity ratio = outerW / frameW (≈5.7× for 9:16)');
  assert(sensitivityRatio > 5, 'frame-based drag is >5× more responsive than container-based for 9:16');
}

{
  // For 16:9 canvas, frame almost fills container → minimal difference
  const outerW = 960, outerH = 300;
  const f = computeFrame(outerW, outerH, 1920, 1080);
  const dragDeltaPx = 50;
  const posUsingFrame = computeDragPos(50, dragDeltaPx, f.w);
  const posUsingOuter = computeDragPos(50, dragDeltaPx, outerW);
  // For 16:9, frameW ≈ 533, outerW = 960 — still a difference but smaller
  assert(Math.abs(posUsingFrame - posUsingOuter) < Math.abs(computeDragPos(50, dragDeltaPx, Math.round(300 * 9 / 16)) - posUsingOuter),
    '16:9 frame-vs-container drag difference is smaller than 9:16 difference');
}

// ── Centre mapping: x=50% y=50% always maps to visual centre ─────────────────
// Regardless of canvas shape, x=50%/y=50% must be the canvas centre.
// With the frame approach this is guaranteed because `left: 50%; top: 50%`
// with `transform: translate(-50%,-50%)` always centres in the frame div.

console.log('\n── x=50%, y=50% always maps to canvas centre ─────────────────────');
{
  const canvases = [
    { w: 1920, h: 1080, name: 'Widescreen 16:9' },
    { w: 1080, h: 1920, name: 'Shorts 9:16' },
    { w: 1080, h: 1080, name: 'Square 1:1' },
    { w: 1080, h: 1350, name: 'Portrait 4:5' },
  ];
  for (const c of canvases) {
    // In the frame, left:50% = frameW/2, top:50% = frameH/2 → visual centre ✓
    const frame = computeFrame(960, 300, c.w, c.h);
    const centreX = frame.w * 0.5;
    const centreY = frame.h * 0.5;
    assertClose(centreX / frame.w * 100, 50, `${c.name}: x=50% maps to horizontal centre of frame`);
    assertClose(centreY / frame.h * 100, 50, `${c.name}: y=50% maps to vertical centre of frame`);
  }
}

// ── Overflow/clamp: drag cannot place element outside the frame ───────────────
console.log('\n── Drag clamping keeps element within canvas frame ───────────────');
{
  const f = computeFrame(960, 300, 1080, 1920);
  // Massive positive drag
  assert(computeDragPos(80, 999, f.w) === 100, 'drag clamped to 100 at right/bottom edge');
  assert(computeDragPos(20, -999, f.w) === 0,  'drag clamped to 0 at left/top edge');
  // Small drag stays within bounds
  const mid = computeDragPos(50, 20, f.w);
  assert(mid > 50 && mid < 100, 'small drag stays within [0, 100]');
}

// ── Frame changes when canvas preset changes ──────────────────────────────────
console.log('\n── Frame updates when canvas preset applied ──────────────────────');
{
  const outer = { w: 960, h: 300 };
  const presets = [
    { w: 1080, h: 1920, name: 'Shorts 9:16'   },
    { w: 1080, h: 1080, name: 'Square 1:1'    },
    { w: 1080, h: 1350, name: 'Portrait 4:5'  },
    { w: 1920, h: 1080, name: 'Widescreen 16:9' },
  ];

  let prevFrameW = null;
  for (const p of presets) {
    const f = computeFrame(outer.w, outer.h, p.w, p.h);
    const str = frameAspectRatioString({ width: p.w, height: p.h });
    const numRatio = parseAspectRatio(str);
    assertClose(numRatio, p.w / p.h, `${p.name}: numeric ratio from string matches expected`);
    assertClose(f.w / f.h, p.w / p.h, `${p.name}: rendered frame preserves canvas ratio`, 0.01);
    if (prevFrameW !== null) {
      assert(f.w !== prevFrameW, `${p.name}: frame width changes when preset changes (was ${prevFrameW}, now ${f.w})`);
    }
    prevFrameW = f.w;
  }
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
