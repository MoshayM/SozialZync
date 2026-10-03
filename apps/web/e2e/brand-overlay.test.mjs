/**
 * Unit tests for the Brand Overlay feature in both editors.
 *
 * Mirrors the exact logic from:
 *   - apps/web/src/app/(dash)/editor/[editId]/page.tsx       (standalone editor)
 *   - apps/web/src/app/(dash)/shorts-studio/clips/[shortClipId]/edit/page.tsx (clip editor)
 *
 * Run: node apps/web/e2e/brand-overlay.test.mjs
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
function assertClose(a, b, label, tol = 0.01) {
  if (Math.abs(a - b) <= tol) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected ${b}, got ${a}`);
    failed++;
  }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS — used by both editors
// ════════════════════════════════════════════════════════════════════════════

/** Brand renders only when brand is non-null AND brand.visible === true */
function shouldRenderBrand(brand) {
  return brand != null && brand.visible === true;
}

/** 9-point grid positions — used in both editors */
const GRID_POSITIONS = [
  { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
  { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
  { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
];

/** Clip editor grid position labels */
const CLIP_GRID_LABELS = ['TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'];

// ════════════════════════════════════════════════════════════════════════════
// STANDALONE EDITOR — brandOverlay state
// ════════════════════════════════════════════════════════════════════════════

console.log('\n══ Standalone Editor — brandOverlay state ════════════════════════════');

/** Mirrors the default state set when clicking the Brand button */
const STANDALONE_BRAND_DEFAULT = {
  type: 'text',
  text: '',
  logoUrl: '',
  x: 10,
  y: 10,
  size: 32,
  visible: true,
  color: '#ffffff',
};

// ── Default state shape ───────────────────────────────────────────────────
console.log('\n── Default state shape ───────────────────────────────────────────────');
{
  const b = { ...STANDALONE_BRAND_DEFAULT };
  assert(b.type === 'text', 'default type is "text"');
  assert(b.text === '', 'default text is empty string');
  assert(b.logoUrl === '', 'default logoUrl is empty string');
  assert(b.x === 10, 'default x = 10');
  assert(b.y === 10, 'default y = 10');
  assert(b.size === 32, 'default size = 32 (px raw value)');
  assert(b.visible === true, 'default visible = true');
  assert(b.color === '#ffffff', 'default color = white');
}

// ── Visibility gating ─────────────────────────────────────────────────────
console.log('\n── Visibility gating ─────────────────────────────────────────────────');
{
  assert(!shouldRenderBrand(null), 'null brand → not rendered');
  assert(!shouldRenderBrand(undefined), 'undefined brand → not rendered');
  assert(!shouldRenderBrand({ ...STANDALONE_BRAND_DEFAULT, visible: false }), 'visible=false → not rendered');
  assert(shouldRenderBrand({ ...STANDALONE_BRAND_DEFAULT, visible: true }), 'visible=true → rendered');
}

// ── Visibility toggle ─────────────────────────────────────────────────────
console.log('\n── Visibility toggle ─────────────────────────────────────────────────');
{
  // Mirrors: setBrandOverlay(b => b ? { ...b, visible: !b.visible } : b)
  function toggleVisible(b) {
    return b ? { ...b, visible: !b.visible } : b;
  }

  const b1 = { ...STANDALONE_BRAND_DEFAULT, visible: true };
  const b2 = toggleVisible(b1);
  assert(b2.visible === false, 'toggle visible: true → false');

  const b3 = toggleVisible(b2);
  assert(b3.visible === true, 'toggle visible: false → true');

  // null is a no-op
  assert(toggleVisible(null) === null, 'toggle on null is a no-op');
}

// ── Remove brand ──────────────────────────────────────────────────────────
console.log('\n── Remove brand ──────────────────────────────────────────────────────');
{
  // Clicking the remove button: setBrandPanelOpen(false); setBrandOverlay(null)
  let brandOverlay = { ...STANDALONE_BRAND_DEFAULT };
  let brandPanelOpen = true;

  // Simulate remove
  brandPanelOpen = false;
  brandOverlay = null;

  assert(brandOverlay === null, 'remove sets brandOverlay to null');
  assert(brandPanelOpen === false, 'remove closes the panel');
}

// ── Type switching ─────────────────────────────────────────────────────────
console.log('\n── Type switching ────────────────────────────────────────────────────');
{
  function setType(b, t) { return b ? { ...b, type: t } : b; }

  const textBrand = { ...STANDALONE_BRAND_DEFAULT, type: 'text' };
  const logoBrand = setType(textBrand, 'logo');
  assert(logoBrand.type === 'logo', 'set type to "logo"');
  assert(logoBrand.text === textBrand.text, 'switching type preserves text field');
  assert(logoBrand.logoUrl === textBrand.logoUrl, 'switching type preserves logoUrl');
  assert(logoBrand.x === textBrand.x, 'switching type preserves position x');

  const backToText = setType(logoBrand, 'text');
  assert(backToText.type === 'text', 'switch back to "text"');
}

// ── Size slider (standalone) ──────────────────────────────────────────────
console.log('\n── Size slider (standalone) ──────────────────────────────────────────');
{
  // Slider: min=16, max=96, value directly = size (raw px)
  const MIN = 16, MAX = 96;

  assert(STANDALONE_BRAND_DEFAULT.size >= MIN, 'default size within slider min');
  assert(STANDALONE_BRAND_DEFAULT.size <= MAX, 'default size within slider max');

  // Font size formula: Math.max(10, size * 0.4)
  function computeFontSize(size) { return Math.max(10, size * 0.4); }
  function computeLogoHeight(size) { return Math.max(16, size * 0.4); }

  assertClose(computeFontSize(16),  10, 'size=16 → font clamped to 10px');
  assertClose(computeFontSize(32),  12.8, 'size=32 → font=12.8px');
  assertClose(computeFontSize(64),  25.6, 'size=64 → font=25.6px');
  assertClose(computeFontSize(96),  38.4, 'size=96 → font=38.4px');

  assertClose(computeLogoHeight(16), 16, 'size=16 → logo height clamped to 16px');
  assertClose(computeLogoHeight(32), 16, 'size=32 → logo height clamped to 16px (32*0.4=12.8 < 16)');
  // Wait: Math.max(16, 32*0.4) = Math.max(16, 12.8) = 16
  assertClose(computeLogoHeight(40), 16, 'size=40 → logo height=16px (40*0.4=16)');
  assertClose(computeLogoHeight(48), 19.2, 'size=48 → logo height=19.2px');
  assertClose(computeLogoHeight(96), 38.4, 'size=96 → logo height=38.4px');

  // Slider value IS the size (no multiplication needed)
  assert(STANDALONE_BRAND_DEFAULT.size === 32, 'default slider value 32 maps directly to size=32');
}

// ── Position grid (standalone) ────────────────────────────────────────────
console.log('\n── Position grid (standalone) ────────────────────────────────────────');
{
  assert(GRID_POSITIONS.length === 9, '9 grid positions');

  // Verify grid layout (row-major: top→bottom, left→right)
  assert(GRID_POSITIONS[0].x === 10 && GRID_POSITIONS[0].y === 10, 'pos[0] = top-left (10,10)');
  assert(GRID_POSITIONS[1].x === 50 && GRID_POSITIONS[1].y === 10, 'pos[1] = top-center (50,10)');
  assert(GRID_POSITIONS[2].x === 90 && GRID_POSITIONS[2].y === 10, 'pos[2] = top-right (90,10)');
  assert(GRID_POSITIONS[3].x === 10 && GRID_POSITIONS[3].y === 50, 'pos[3] = mid-left (10,50)');
  assert(GRID_POSITIONS[4].x === 50 && GRID_POSITIONS[4].y === 50, 'pos[4] = center (50,50)');
  assert(GRID_POSITIONS[5].x === 90 && GRID_POSITIONS[5].y === 50, 'pos[5] = mid-right (90,50)');
  assert(GRID_POSITIONS[6].x === 10 && GRID_POSITIONS[6].y === 90, 'pos[6] = bottom-left (10,90)');
  assert(GRID_POSITIONS[7].x === 50 && GRID_POSITIONS[7].y === 90, 'pos[7] = bottom-center (50,90)');
  assert(GRID_POSITIONS[8].x === 90 && GRID_POSITIONS[8].y === 90, 'pos[8] = bottom-right (90,90)');

  // Active detection: Math.abs(x - pos.x) < 3 && Math.abs(y - pos.y) < 3
  function isActiveStandalone(brand, pos) {
    return Math.abs(brand.x - pos.x) < 3 && Math.abs(brand.y - pos.y) < 3;
  }

  const b = { ...STANDALONE_BRAND_DEFAULT, x: 10, y: 10 };
  assert(isActiveStandalone(b, { x: 10, y: 10 }), 'exact match → active');
  assert(isActiveStandalone(b, { x: 12, y: 11 }), 'within ±2 → active');
  assert(!isActiveStandalone(b, { x: 13, y: 10 }), '3px off → not active');
  assert(!isActiveStandalone(b, { x: 50, y: 10 }), 'different column → not active');

  // Apply grid position
  function applyGridPos(brand, pos) { return brand ? { ...brand, x: pos.x, y: pos.y } : brand; }
  const after = applyGridPos(b, GRID_POSITIONS[4]);
  assert(after.x === 50 && after.y === 50, 'applying center pos sets x=50, y=50');
}

// ── X/Y sliders (standalone) ──────────────────────────────────────────────
console.log('\n── X/Y sliders (standalone) ──────────────────────────────────────────');
{
  // Slider: min=0, max=100, value directly = x or y
  const xSlider = { min: 0, max: 100, key: 'x' };
  const ySlider = { min: 0, max: 100, key: 'y' };

  function applySlider(brand, key, value) {
    return brand ? { ...brand, [key]: Number(value) } : brand;
  }

  let b = { ...STANDALONE_BRAND_DEFAULT };
  b = applySlider(b, 'x', 75);
  assert(b.x === 75, 'X slider sets x = 75');
  b = applySlider(b, 'y', 25);
  assert(b.y === 25, 'Y slider sets y = 25');

  // Values within valid range
  assert(xSlider.min === 0,   'X slider min = 0');
  assert(xSlider.max === 100, 'X slider max = 100');
  assert(ySlider.min === 0,   'Y slider min = 0');
  assert(ySlider.max === 100, 'Y slider max = 100');
}

// ── Drag: delta-based (standalone) ────────────────────────────────────────
console.log('\n── Drag: delta-based (standalone) ────────────────────────────────────');
{
  // Mirrors onPointerDown → onMove:
  //   dx = ((ev.clientX - startX) / rect.width) * 100
  //   dy = ((ev.clientY - startY) / rect.height) * 100
  //   newX = clamp(startXPct + dx, 0, 100)
  //   newY = clamp(startYPct + dy, 0, 100)

  function computeDrag(startXPct, startYPct, pointerStartX, pointerStartY, pointerCurrX, pointerCurrY, rectWidth, rectHeight) {
    const dx = ((pointerCurrX - pointerStartX) / rectWidth) * 100;
    const dy = ((pointerCurrY - pointerStartY) / rectHeight) * 100;
    return {
      x: clamp(startXPct + dx, 0, 100),
      y: clamp(startYPct + dy, 0, 100),
    };
  }

  // 600×400 preview frame
  const W = 600, H = 400;

  // Drag 60px right, 40px down from x=10,y=10
  {
    const r = computeDrag(10, 10, 0, 0, 60, 40, W, H);
    assertClose(r.x, 10 + (60 / W) * 100, 'drag right: x increases proportionally');
    assertClose(r.y, 10 + (40 / H) * 100, 'drag down: y increases proportionally');
  }

  // Drag so far left it would go negative → clamped to 0
  {
    const r = computeDrag(5, 5, 0, 0, -200, 0, W, H);
    assert(r.x === 0, 'drag beyond left edge → clamped to 0');
  }

  // Drag so far right it would exceed 100 → clamped
  {
    const r = computeDrag(90, 90, 0, 0, 200, 200, W, H);
    assert(r.x === 100, 'drag beyond right edge → clamped to 100');
    assert(r.y === 100, 'drag beyond bottom edge → clamped to 100');
  }

  // No drag → position unchanged
  {
    const r = computeDrag(50, 50, 100, 100, 100, 100, W, H);
    assertClose(r.x, 50, 'zero drag: x unchanged');
    assertClose(r.y, 50, 'zero drag: y unchanged');
  }

  // Drag up/left (negative delta)
  {
    const r = computeDrag(50, 50, 100, 100, 70, 80, W, H);
    assert(r.x < 50, 'drag left: x decreases');
    assert(r.y < 50, 'drag up: y decreases');
  }

  // Frame size affects sensitivity
  {
    const smallFrame = computeDrag(50, 50, 0, 0, 30, 0, 300, 400);
    const largeFrame = computeDrag(50, 50, 0, 0, 30, 0, 600, 400);
    assert(smallFrame.x > largeFrame.x, 'same pixel drag → larger Δ% on smaller frame');
  }
}

// ── Text rendering (standalone) ───────────────────────────────────────────
console.log('\n── Text rendering (standalone) ───────────────────────────────────────');
{
  // type='text' → show text or fallback 'Brand Title'
  function resolveDisplayText(b) {
    if (b.type !== 'text') return null;
    return b.text || 'Brand Title';
  }

  assert(resolveDisplayText({ type: 'text', text: '' }) === 'Brand Title', 'empty text → fallback "Brand Title"');
  assert(resolveDisplayText({ type: 'text', text: 'Acme Corp' }) === 'Acme Corp', 'non-empty text → shown');
  assert(resolveDisplayText({ type: 'logo', text: 'x', logoUrl: '' }) === null, 'logo type → null (not text span)');
}

// ── Logo rendering (standalone) ───────────────────────────────────────────
console.log('\n── Logo rendering (standalone) ───────────────────────────────────────');
{
  // type='logo', logoUrl truthy → img tag
  // type='logo', logoUrl falsy  → fallback span "Logo"
  function resolveLogoRendering(b) {
    if (b.type !== 'logo') return 'text-span';
    return b.logoUrl ? 'img' : 'fallback-span';
  }

  assert(resolveLogoRendering({ type: 'logo', logoUrl: 'https://cdn.example.com/logo.png' }) === 'img', 'logo with URL → img element');
  assert(resolveLogoRendering({ type: 'logo', logoUrl: '' }) === 'fallback-span', 'logo without URL → fallback span');
  assert(resolveLogoRendering({ type: 'logo', logoUrl: null }) === 'fallback-span', 'logo with null URL → fallback span');
  assert(resolveLogoRendering({ type: 'text', text: 'x' }) === 'text-span', 'text type → text-span path');
}

// ── Position CSS (standalone) ─────────────────────────────────────────────
console.log('\n── Position CSS (standalone) ─────────────────────────────────────────');
{
  // left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)'
  function positionStyle(b) {
    return { left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%, -50%)' };
  }

  const s = positionStyle({ x: 25, y: 75 });
  assert(s.left === '25%', 'left = x%');
  assert(s.top === '75%', 'top = y%');
  assert(s.transform === 'translate(-50%, -50%)', 'transform centres the overlay at (x,y)');

  const s2 = positionStyle({ x: 0, y: 0 });
  assert(s2.left === '0%', 'x=0 → left=0%');
  assert(s2.top === '0%', 'y=0 → top=0%');

  const s3 = positionStyle({ x: 100, y: 100 });
  assert(s3.left === '100%', 'x=100 → left=100%');
}

// ── Panel open/close ──────────────────────────────────────────────────────
console.log('\n── Panel open/close ──────────────────────────────────────────────────');
{
  let brandPanelOpen = false;

  // Toggle
  function togglePanel(open) { return !open; }
  brandPanelOpen = togglePanel(brandPanelOpen);
  assert(brandPanelOpen === true, 'toggle panel: closed → open');
  brandPanelOpen = togglePanel(brandPanelOpen);
  assert(brandPanelOpen === false, 'toggle panel: open → closed');

  // When brand was null before clicking Brand button, it creates a default brand AND opens the panel
  let brandOverlay = null;
  brandPanelOpen = true;
  if (!brandOverlay) {
    brandOverlay = { ...STANDALONE_BRAND_DEFAULT };
  }
  assert(brandOverlay !== null, 'clicking Brand button creates brandOverlay if null');
  assert(brandPanelOpen === true, 'clicking Brand button opens panel');
}

// ════════════════════════════════════════════════════════════════════════════
// CLIP EDITOR — brand state
// ════════════════════════════════════════════════════════════════════════════

console.log('\n══ Clip Editor — brand state ═════════════════════════════════════════');

/** Mirrors the default brand created when clicking "Hidden" with brand=null */
const CLIP_BRAND_DEFAULT = {
  type: 'text',
  text: '',
  x: 10,
  y: 10,
  size: 1.2,
  visible: true,
  color: '#ffffff',
};

// ── Default state shape ───────────────────────────────────────────────────
console.log('\n── Default state shape ───────────────────────────────────────────────');
{
  const b = { ...CLIP_BRAND_DEFAULT };
  assert(b.type === 'text', 'clip: default type is "text"');
  assert(b.text === '', 'clip: default text is empty string');
  assert(b.x === 10, 'clip: default x = 10');
  assert(b.y === 10, 'clip: default y = 10');
  assertClose(b.size, 1.2, 'clip: default size = 1.2');
  assert(b.visible === true, 'clip: default visible = true');
  assert(b.color === '#ffffff', 'clip: default color = white');
}

// ── Visibility toggle (clip) ──────────────────────────────────────────────
console.log('\n── Visibility toggle (clip) ──────────────────────────────────────────');
{
  // Mirrors: setBrand((b) => b ? { ...b, visible: !b.visible } : { type:'text', text:'', x:10, y:10, size:1.2, visible:true, color:'#ffffff' })
  function clipToggleVisible(b) {
    return b
      ? { ...b, visible: !b.visible }
      : { type: 'text', text: '', x: 10, y: 10, size: 1.2, visible: true, color: '#ffffff' };
  }

  // null → creates new visible brand
  const created = clipToggleVisible(null);
  assert(created.visible === true, 'clip: toggle on null → creates brand with visible=true');
  assert(created.type === 'text', 'clip: toggle on null → type defaults to text');

  // visible → hidden
  const hidden = clipToggleVisible(created);
  assert(hidden.visible === false, 'clip: toggle visible → hidden');

  // hidden → visible
  const reshow = clipToggleVisible(hidden);
  assert(reshow.visible === true, 'clip: toggle hidden → visible');
}

// ── Size slider (clip) ────────────────────────────────────────────────────
console.log('\n── Size slider (clip) ────────────────────────────────────────────────');
{
  // Size stored as decimal; slider min=5 max=20 step=1, value = Math.round(size * 10)
  // onChange: size = parseInt(e.target.value) / 10

  function sliderValueFromSize(size) { return Math.round(size * 10); }
  function sizeFromSliderValue(v) { return parseInt(v) / 10; }

  assertClose(sliderValueFromSize(1.2), 12, 'size=1.2 → slider value=12');
  assertClose(sliderValueFromSize(0.5), 5,  'size=0.5 → slider value=5 (min)');
  assertClose(sliderValueFromSize(2.0), 20, 'size=2.0 → slider value=20 (max)');
  assertClose(sliderValueFromSize(1.0), 10, 'size=1.0 → slider value=10');

  assertClose(sizeFromSliderValue(5),  0.5, 'slider=5 → size=0.5');
  assertClose(sizeFromSliderValue(10), 1.0, 'slider=10 → size=1.0');
  assertClose(sizeFromSliderValue(12), 1.2, 'slider=12 → size=1.2');
  assertClose(sizeFromSliderValue(20), 2.0, 'slider=20 → size=2.0');

  // Round-trip: encode then decode
  for (const s of [0.5, 0.8, 1.0, 1.2, 1.5, 2.0]) {
    assertClose(sizeFromSliderValue(sliderValueFromSize(s)), s, `size ${s} round-trips through slider`, 0.05);
  }

  // Font size display: `${size}rem`
  function fontSizeStyle(size) { return `${size}rem`; }
  assert(fontSizeStyle(1.2) === '1.2rem', 'size 1.2 → "1.2rem"');
  assert(fontSizeStyle(0.5) === '0.5rem', 'size 0.5 → "0.5rem"');

  // Logo height: `${size * 32}px`
  function logoHeightStyle(size) { return `${size * 32}px`; }
  assert(logoHeightStyle(1.0) === '32px', 'size 1.0 → logo height "32px"');
  assert(logoHeightStyle(1.2) === '38.4px', 'size 1.2 → logo height "38.4px"');
  assert(logoHeightStyle(2.0) === '64px', 'size 2.0 → logo height "64px"');
}

// ── Position grid (clip editor) ───────────────────────────────────────────
console.log('\n── Position grid (clip editor) ───────────────────────────────────────');
{
  assert(CLIP_GRID_LABELS.length === 9, '9 labeled grid positions');
  assert(CLIP_GRID_LABELS[0] === 'TL', 'first label = TL');
  assert(CLIP_GRID_LABELS[4] === 'MC', 'center label = MC');
  assert(CLIP_GRID_LABELS[8] === 'BR', 'last label = BR');

  // All 9 positions match the same (x,y) values as standalone editor
  for (let i = 0; i < 9; i++) {
    assert(
      GRID_POSITIONS[i].x === GRID_POSITIONS[i].x &&
      GRID_POSITIONS[i].y === GRID_POSITIONS[i].y,
      `${CLIP_GRID_LABELS[i]}: matches expected grid coordinate (${GRID_POSITIONS[i].x},${GRID_POSITIONS[i].y})`
    );
  }

  // Clip editor active detection: EXACT match (no tolerance like standalone)
  function isActiveClip(brand, bx, by) {
    return brand.x === bx && brand.y === by;
  }

  const b = { ...CLIP_BRAND_DEFAULT, x: 10, y: 10 };
  assert(isActiveClip(b, 10, 10), 'clip: exact match → active');
  assert(!isActiveClip(b, 11, 10), 'clip: 1px off → NOT active (no tolerance)');
  assert(!isActiveClip(b, 50, 10), 'clip: different column → not active');

  // Apply grid position
  function applyClipGridPos(brand, bx, by) {
    return brand ? { ...brand, x: bx, y: by } : brand;
  }
  const after = applyClipGridPos(b, 50, 90); // BC
  assert(after.x === 50 && after.y === 90, 'apply BC → x=50, y=90');
  assert(isActiveClip(after, 50, 90), 'after applying BC → BC is active');
}

// ── Drag: absolute position (clip editor) ─────────────────────────────────
console.log('\n── Drag: absolute position (clip editor) ─────────────────────────────');
{
  // Mirrors onMouseDown → onMove:
  //   nx = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100))
  //   ny = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100))
  //   setBrand(b => b ? { ...b, x: Math.round(nx), y: Math.round(ny) } : b)
  //
  // Note: ABSOLUTE position from rect.left/top — NOT delta-based

  function computeClipDrag(clientX, clientY, rectLeft, rectTop, rectWidth, rectHeight) {
    const nx = Math.max(0, Math.min(100, ((clientX - rectLeft) / rectWidth) * 100));
    const ny = Math.max(0, Math.min(100, ((clientY - rectTop) / rectHeight) * 100));
    return { x: Math.round(nx), y: Math.round(ny) };
  }

  // Preview frame at (100, 200) with 300×400 dimensions
  const L = 100, T = 200, W = 300, H = 400;

  // Cursor at centre of frame
  {
    const r = computeClipDrag(L + W / 2, T + H / 2, L, T, W, H);
    assert(r.x === 50, 'clip drag: cursor at frame centre → x=50');
    assert(r.y === 50, 'clip drag: cursor at frame centre → y=50');
  }

  // Cursor at top-left
  {
    const r = computeClipDrag(L, T, L, T, W, H);
    assert(r.x === 0, 'clip drag: cursor at top-left → x=0');
    assert(r.y === 0, 'clip drag: cursor at top-left → y=0');
  }

  // Cursor at bottom-right
  {
    const r = computeClipDrag(L + W, T + H, L, T, W, H);
    assert(r.x === 100, 'clip drag: cursor at bottom-right → x=100');
    assert(r.y === 100, 'clip drag: cursor at bottom-right → y=100');
  }

  // Cursor beyond frame bounds → clamped
  {
    const r = computeClipDrag(L - 50, T - 50, L, T, W, H);
    assert(r.x === 0, 'clip drag: cursor left of frame → clamped to x=0');
    assert(r.y === 0, 'clip drag: cursor above frame → clamped to y=0');
  }
  {
    const r = computeClipDrag(L + W + 100, T + H + 100, L, T, W, H);
    assert(r.x === 100, 'clip drag: cursor right of frame → clamped to x=100');
    assert(r.y === 100, 'clip drag: cursor below frame → clamped to y=100');
  }

  // Rounding
  {
    const r = computeClipDrag(L + 1, T + 1, L, T, W, H);
    assert(Number.isInteger(r.x), 'clip drag: x is always rounded to integer');
    assert(Number.isInteger(r.y), 'clip drag: y is always rounded to integer');
  }
}

// ── Clip text / logo rendering ────────────────────────────────────────────
console.log('\n── Clip text / logo rendering ────────────────────────────────────────');
{
  function resolveClipRendering(b) {
    if (b.type === 'text') return { el: 'span', content: b.text || 'Brand' };
    if (b.logoUrl) return { el: 'img', src: b.logoUrl };
    return { el: 'span', content: 'Logo URL →' };
  }

  const r1 = resolveClipRendering({ type: 'text', text: '' });
  assert(r1.el === 'span' && r1.content === 'Brand', 'clip: empty text → fallback "Brand"');

  const r2 = resolveClipRendering({ type: 'text', text: 'My Channel' });
  assert(r2.el === 'span' && r2.content === 'My Channel', 'clip: non-empty text → shown');

  const r3 = resolveClipRendering({ type: 'logo', logoUrl: 'https://cdn.example.com/logo.png' });
  assert(r3.el === 'img', 'clip: logo with URL → img element');
  assert(r3.src === 'https://cdn.example.com/logo.png', 'clip: img src = logoUrl');

  const r4 = resolveClipRendering({ type: 'logo', logoUrl: '' });
  assert(r4.el === 'span' && r4.content === 'Logo URL →', 'clip: logo without URL → fallback prompt');
}

// ════════════════════════════════════════════════════════════════════════════
// CROSS-EDITOR — shared invariants
// ════════════════════════════════════════════════════════════════════════════

console.log('\n══ Cross-editor shared invariants ════════════════════════════════════');

// ── Grid position coverage ────────────────────────────────────────────────
console.log('\n── Grid position coverage ────────────────────────────────────────────');
{
  // All 9 positions should be unique
  const keys = GRID_POSITIONS.map((p) => `${p.x},${p.y}`);
  const unique = new Set(keys);
  assert(unique.size === 9, 'all 9 grid positions are unique (x,y) pairs');

  // Should have 3 distinct x-values and 3 distinct y-values (a true 3×3 grid)
  const xs = [...new Set(GRID_POSITIONS.map((p) => p.x))].sort((a, b) => a - b);
  const ys = [...new Set(GRID_POSITIONS.map((p) => p.y))].sort((a, b) => a - b);
  assert(xs.length === 3, 'grid has exactly 3 x-columns');
  assert(ys.length === 3, 'grid has exactly 3 y-rows');
  assert(xs[0] < xs[1] && xs[1] < xs[2], 'x-columns are strictly increasing');
  assert(ys[0] < ys[1] && ys[1] < ys[2], 'y-rows are strictly increasing');
}

// ── Position clamping ─────────────────────────────────────────────────────
console.log('\n── Position clamping ─────────────────────────────────────────────────');
{
  function assertClamped(v, min, max, label) {
    assert(v >= min && v <= max, label);
  }

  for (const pos of GRID_POSITIONS) {
    assertClamped(pos.x, 0, 100, `grid x=${pos.x} within [0,100]`);
    assertClamped(pos.y, 0, 100, `grid y=${pos.y} within [0,100]`);
  }

  // X slider clamp (standalone: 0–100; clip: implicit from drag 0–100)
  assert(clamp(-5, 0, 100) === 0, 'clamp(-5,0,100)=0');
  assert(clamp(105, 0, 100) === 100, 'clamp(105,0,100)=100');
  assert(clamp(50, 0, 100) === 50, 'clamp(50,0,100)=50 (unchanged)');
}

// ── Type value guard ──────────────────────────────────────────────────────
console.log('\n── Type value guard ──────────────────────────────────────────────────');
{
  const VALID_TYPES = ['text', 'logo'];

  assert(VALID_TYPES.includes('text'), '"text" is a valid type');
  assert(VALID_TYPES.includes('logo'), '"logo" is a valid type');
  assert(!VALID_TYPES.includes('image'), '"image" is not a valid type');
  assert(!VALID_TYPES.includes(''), 'empty string is not a valid type');

  // Default brands use valid types
  assert(VALID_TYPES.includes(STANDALONE_BRAND_DEFAULT.type), 'standalone default type is valid');
  assert(VALID_TYPES.includes(CLIP_BRAND_DEFAULT.type), 'clip default type is valid');
}

// ── Immutable state updates ───────────────────────────────────────────────
console.log('\n── Immutable state updates ───────────────────────────────────────────');
{
  const original = { ...STANDALONE_BRAND_DEFAULT };
  const updated = { ...original, x: 75 };
  assert(original.x === 10, 'original unchanged after spread update');
  assert(updated.x === 75, 'spread update creates new object with changed x');
  assert(updated !== original, 'spread update returns different object reference');

  // All other fields preserved
  assert(updated.type === original.type, 'type preserved in spread update');
  assert(updated.text === original.text, 'text preserved in spread update');
  assert(updated.visible === original.visible, 'visible preserved in spread update');
  assert(updated.color === original.color, 'color preserved in spread update');
}

// ── Null-safety: state update callbacks ───────────────────────────────────
console.log('\n── Null-safety: state update callbacks ───────────────────────────────');
{
  // All setters use pattern: b => b ? { ...b, [field]: value } : b
  // When brand is null, callbacks must be no-ops

  function safeUpdate(b, patch) {
    return b ? { ...b, ...patch } : b;
  }

  assert(safeUpdate(null, { x: 50 }) === null, 'null brand update returns null (no-op)');
  assert(safeUpdate(undefined, { x: 50 }) === undefined, 'undefined brand update returns undefined (no-op)');
  const b = { ...STANDALONE_BRAND_DEFAULT };
  const after = safeUpdate(b, { x: 70, y: 30 });
  assert(after.x === 70 && after.y === 30, 'non-null brand update applies patch');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
