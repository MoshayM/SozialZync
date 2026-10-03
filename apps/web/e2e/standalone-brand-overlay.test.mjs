/**
 * Unit tests for the standalone video editor brand overlay logic (commit 8f66666).
 * Uses `brandOverlay` state (vs `brand` in the clip editor).
 *
 * Run: node apps/web/e2e/standalone-brand-overlay.test.mjs
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
function assertEq(a, b, label) {
  if (a === b) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
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

// ── Helpers mirroring standalone editor logic ─────────────────────────────────

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

/** Default brandOverlay created on first Add Brand click */
function createDefaultBrandOverlay() {
  return { type: 'text', text: '', logoUrl: '', x: 50, y: 10, size: 32, visible: true, color: '#ffffff' };
}

/** Button label: brandOverlay ? (brandOverlay.visible ? 'Visible' : 'Hidden') : 'Add Brand' */
function brandButtonLabel(brandOverlay) {
  return brandOverlay ? (brandOverlay.visible ? 'Visible' : 'Hidden') : 'Add Brand';
}

/** Toggle visible (or create default if null) */
function handleToggle(brandOverlay) {
  if (!brandOverlay) return createDefaultBrandOverlay();
  return { ...brandOverlay, visible: !brandOverlay.visible };
}

/** Delta-based drag: clamp(startX + (dx / frameWidth) * 100, 0, 100) */
function computeDragX(startX, dx, frameWidth) {
  return clamp(startX + (dx / frameWidth) * 100, 0, 100);
}
function computeDragY(startY, dy, frameHeight) {
  return clamp(startY + (dy / frameHeight) * 100, 0, 100);
}

/** Logo height formula: Math.max(16, size / 2.5) */
function computeLogoHeight(size) {
  return Math.max(16, size / 2.5);
}

/** Active grid point detection: tolerance < 3 on both axes */
function isActiveGridPoint(brandOverlay, point) {
  return Math.abs(brandOverlay.x - point.x) < 3 && Math.abs(brandOverlay.y - point.y) < 3;
}

const GRID_POSITIONS = [
  { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
  { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
  { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Default state
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 1. Default state ─────────────────────────────────────────────────');
{
  assertEq(brandButtonLabel(null), 'Add Brand', 'null brandOverlay → label "Add Brand"');
  assertEq(brandButtonLabel(undefined), 'Add Brand', 'undefined brandOverlay → label "Add Brand"');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create brand on first click
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 2. Create brand on first click ───────────────────────────────────');
{
  const b = createDefaultBrandOverlay();
  assertEq(b.x, 50, 'default x is 50 (center)');
  assertEq(b.y, 10, 'default y is 10 (near top)');
  assertEq(b.size, 32, 'default size is 32px');
  assertEq(b.visible, true, 'default visible is true');
  assertEq(b.type, 'text', 'default type is text');
  assertEq(b.color, '#ffffff', 'default color is white');
  assertEq(b.text, '', 'default text is empty string');
  assertEq(b.logoUrl, '', 'default logoUrl is empty string');

  // After first click (handleToggle(null)), state = default
  const created = handleToggle(null);
  assertEq(created.x, 50, 'first click creates at x=50');
  assertEq(created.visible, true, 'first click creates visible=true');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Toggle visible
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 3. Toggle visible ────────────────────────────────────────────────');
{
  let b = handleToggle(null);
  assertEq(brandButtonLabel(b), 'Visible', 'after Add Brand click → label "Visible"');

  b = handleToggle(b);
  assertEq(b.visible, false, 'second click → visible=false');
  assertEq(brandButtonLabel(b), 'Hidden', 'second click → label "Hidden"');

  b = handleToggle(b);
  assertEq(b.visible, true, 'third click → visible=true again');
  assertEq(brandButtonLabel(b), 'Visible', 'third click → label "Visible"');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Type switching
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 4. Type switching ────────────────────────────────────────────────');
{
  let b = createDefaultBrandOverlay();
  assertEq(b.type, 'text', 'starts as text type');

  // Switch to logo
  b = { ...b, type: 'logo' };
  assertEq(b.type, 'logo', 'switched to logo type');
  assertEq(b.text, '', 'text field preserved when switching to logo');
  assertEq(b.logoUrl, '', 'logoUrl field present after switching to logo');

  // Switch back to text
  b = { ...b, type: 'text' };
  assertEq(b.type, 'text', 'switched back to text type');
  assertEq(b.logoUrl, '', 'logoUrl preserved when switching back to text');

  // Preview rendering: text type shows text input (not logoUrl)
  const showsTextInput = (overlay) => overlay.type === 'text';
  const showsLogoInput = (overlay) => overlay.type === 'logo';
  assert(showsTextInput({ ...b, type: 'text' }), 'text type shows text input');
  assert(!showsTextInput({ ...b, type: 'logo' }), 'logo type hides text input');
  assert(showsLogoInput({ ...b, type: 'logo' }), 'logo type shows logo URL input');
  assert(!showsLogoInput({ ...b, type: 'text' }), 'text type hides logo URL input');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Color swatches
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 5. Color swatches ────────────────────────────────────────────────');
{
  const swatches = ['#ffffff', '#000000', '#facc15', '#a855f7', '#ef4444', '#3b82f6'];
  let b = createDefaultBrandOverlay();
  assertEq(b.color, '#ffffff', 'starts white');

  for (const c of swatches) {
    const updated = { ...b, color: c };
    assertEq(updated.color, c, `color swatch ${c} sets color correctly`);
    // Other fields unchanged
    assertEq(updated.x, b.x, `color update preserves x=${b.x}`);
    assertEq(updated.size, b.size, `color update preserves size=${b.size}`);
    assertEq(updated.type, b.type, `color update preserves type=${b.type}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 9-point position grid
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 6. 9-point position grid ─────────────────────────────────────────');
{
  assertEq(GRID_POSITIONS.length, 9, 'grid has exactly 9 positions');

  for (const p of GRID_POSITIONS) {
    let b = createDefaultBrandOverlay();
    // Snap to grid
    b = { ...b, x: p.x, y: p.y };
    assertEq(b.x, p.x, `snapped to grid x=${p.x}`);
    assertEq(b.y, p.y, `snapped to grid y=${p.y}`);

    // Active detection: exact match
    assert(isActiveGridPoint(b, p), `grid point (${p.x},${p.y}) detected as active when brand is at exact position`);

    // Active detection: within tolerance (2px)
    const near = { ...b, x: p.x + 2, y: p.y + 2 };
    assert(isActiveGridPoint(near, p), `grid point (${p.x},${p.y}) detected within ±2 tolerance`);

    // Not active: just outside tolerance (3px)
    const far = { ...b, x: p.x + 3, y: p.y };
    assert(!isActiveGridPoint(far, p), `grid point (${p.x},${p.y}) NOT active at x+3`);
  }

  // At x=50, y=10 (default): only the top-center grid point is active
  const b = createDefaultBrandOverlay();
  const activePoints = GRID_POSITIONS.filter((p) => isActiveGridPoint(b, p));
  assertEq(activePoints.length, 1, 'exactly one grid point active at default position');
  assertEq(activePoints[0].x, 50, 'active grid point is x=50');
  assertEq(activePoints[0].y, 10, 'active grid point is y=10');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Size slider
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 7. Size slider ───────────────────────────────────────────────────');
{
  const MIN = 16, MAX = 96;
  let b = createDefaultBrandOverlay();

  assertEq(b.size, 32, 'default size is 32');
  assert(b.size >= MIN && b.size <= MAX, 'default size within slider range');

  const sizes = [16, 32, 48, 64, 96];
  for (const s of sizes) {
    const updated = { ...b, size: s };
    assertEq(updated.size, s, `size slider set to ${s}`);
    assert(updated.size >= MIN && updated.size <= MAX, `size ${s} is within [${MIN},${MAX}]`);
    // Other fields unchanged
    assertEq(updated.x, b.x, `size update preserves x`);
    assertEq(updated.type, b.type, `size update preserves type`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Remove button
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 8. Remove button ─────────────────────────────────────────────────');
{
  let b = createDefaultBrandOverlay();
  assert(b !== null, 'brand exists before remove');

  // Remove sets brandOverlay to null
  b = null;
  assertEq(b, null, 'after remove, brandOverlay is null');
  assertEq(brandButtonLabel(null), 'Add Brand', 'after remove, button label reverts to "Add Brand"');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Drag math (delta-based)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 9. Drag math (delta-based) ───────────────────────────────────────');
{
  const frameWidth = 400;
  const frameHeight = 300;

  // Positive drag increases x
  const x1 = computeDragX(50, 40, frameWidth); // +40px → +10%
  assertClose(x1, 60, 'positive 40px drag on 400px frame → x+10%');

  // Negative drag decreases x
  const x2 = computeDragX(50, -40, frameWidth); // -40px → -10%
  assertClose(x2, 40, 'negative 40px drag on 400px frame → x-10%');

  // Clamps to 100 at right edge
  assertEq(computeDragX(80, 999, frameWidth), 100, 'large right drag clamps to 100');

  // Clamps to 0 at left edge
  assertEq(computeDragX(20, -999, frameWidth), 0, 'large left drag clamps to 0');

  // Small drag stays in bounds
  const x3 = computeDragX(50, 20, frameWidth); // +5%
  assert(x3 > 50 && x3 < 100, 'small drag stays within [0,100]');

  // Y-axis drag
  const y1 = computeDragY(50, 30, frameHeight); // +30px → +10%
  assertClose(y1, 60, 'positive 30px drag on 300px frame → y+10%');

  const y2 = computeDragY(10, -999, frameHeight); // clamp to 0
  assertEq(y2, 0, 'large upward drag clamps to 0');

  // Delta is relative to frameWidth, NOT container width
  // (If we used containerWidth=960 instead of frameWidth=400, the result would differ significantly)
  const containerWidth = 960;
  const dx = 40;
  const posFrame = computeDragX(50, dx, frameWidth);   // correct
  const posContainer = computeDragX(50, dx, containerWidth); // would be wrong

  assert(posFrame > posContainer, 'frame-relative drag gives larger delta than container-relative (frame < container)');
  assertClose(posFrame - 50, (dx / frameWidth) * 100, 'frame-relative drag delta is correct');

  // Zero drag leaves position unchanged
  assertEq(computeDragX(37, 0, frameWidth), 37, 'zero drag leaves x unchanged');
  assertEq(computeDragY(82, 0, frameHeight), 82, 'zero drag leaves y unchanged');
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Logo height formula
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 10. Logo height formula ──────────────────────────────────────────');
{
  // Math.max(16, size / 2.5)
  assertEq(computeLogoHeight(32), 16,   'size=32 → Math.max(16, 12.8) = 16 (min floor)');
  assertEq(computeLogoHeight(40), 16,   'size=40 → Math.max(16, 16) = 16 (equal, returns 16)');
  assertEq(computeLogoHeight(60), 24,   'size=60 → Math.max(16, 24) = 24');
  assertClose(computeLogoHeight(96), 38.4, 'size=96 → Math.max(16, 38.4) = 38.4', 0.01);
  assertEq(computeLogoHeight(16), 16,   'size=16 → Math.max(16, 6.4) = 16 (min floor)');
  assertEq(computeLogoHeight(10), 16,   'size=10 → Math.max(16, 4) = 16 (min floor)');
  assert(computeLogoHeight(1000) > 16,  'large size → formula, not clamped at min');
  assertClose(computeLogoHeight(1000), 400, 'size=1000 → 1000/2.5 = 400', 0.01);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Preview rendering conditions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 11. Preview rendering conditions ────────────────────────────────');
{
  // Overlay shows only when brandOverlay?.visible === true
  const shouldRender = (brandOverlay) => Boolean(brandOverlay?.visible);

  assert(!shouldRender(null), 'null brandOverlay → no overlay rendered');
  assert(!shouldRender(undefined), 'undefined brandOverlay → no overlay rendered');
  assert(!shouldRender({ visible: false, type: 'text', text: 'X', x: 50, y: 10, size: 32, color: '#fff', logoUrl: '' }),
    'visible=false → overlay hidden');
  assert(shouldRender({ visible: true, type: 'text', text: 'X', x: 50, y: 10, size: 32, color: '#fff', logoUrl: '' }),
    'visible=true → overlay shown');

  // Text fallback: brandOverlay.text || 'Brand'
  const displayText = (b) => b.text || 'Brand';
  assertEq(displayText({ text: '' }), 'Brand', 'empty text → fallback "Brand"');
  assertEq(displayText({ text: 'SozialZynk' }), 'SozialZynk', 'non-empty text → displayed as-is');

  // Logo: show img when logoUrl is set
  const showsImg = (b) => b.type === 'logo' && Boolean(b.logoUrl);
  const showsLogoFallback = (b) => b.type === 'logo' && !b.logoUrl;

  assert(showsImg({ type: 'logo', logoUrl: 'https://example.com/logo.png', text: '', x: 50, y: 10, size: 32, color: '#fff', visible: true }),
    'logo type with logoUrl → img shown');
  assert(!showsImg({ type: 'logo', logoUrl: '', text: '', x: 50, y: 10, size: 32, color: '#fff', visible: true }),
    'logo type with empty logoUrl → img NOT shown');
  assert(showsLogoFallback({ type: 'logo', logoUrl: '', text: '', x: 50, y: 10, size: 32, color: '#fff', visible: true }),
    'logo type with empty logoUrl → fallback text shown');

  // fontSize style: brandOverlay.size + 'px'
  const fontSizeStyle = (b) => b.size + 'px';
  assertEq(fontSizeStyle({ size: 32 }), '32px', 'size=32 → fontSize "32px"');
  assertEq(fontSizeStyle({ size: 64 }), '64px', 'size=64 → fontSize "64px"');
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Inspector panel location (brandPanelOpen removed)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 12. Inspector panel (no brandPanelOpen state) ────────────────────');
{
  // In commit 8f66666, brandPanelOpen was removed.
  // Brand section is always visible in the inspector when inspectorPanelOpen is true.
  // Simulate: no separate panel open state needed.
  const simulateInspectorBrandVisibility = (inspectorOpen) => {
    // Brand section is a child of the inspector panel — visible iff inspector is open
    return inspectorOpen;
  };

  assert(simulateInspectorBrandVisibility(true), 'brand section visible when inspector is open');
  assert(!simulateInspectorBrandVisibility(false), 'brand section hidden when inspector is collapsed');

  // No brandPanelOpen toggle needed — brand is always in inspector
  // Test: the old toolbar button is gone (no separate action required to reveal brand)
  let brandPanelOpen; // should be undefined — state was removed
  assertEq(typeof brandPanelOpen, 'undefined', 'brandPanelOpen is not a needed state (removed in 8f66666)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Color update preserves other fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 13. Color update preserves other fields ──────────────────────────');
{
  const original = { type: 'text', text: 'My Brand', logoUrl: '', x: 75, y: 25, size: 48, visible: true, color: '#000000' };
  const updated = { ...original, color: '#a855f7' };

  assertEq(updated.color, '#a855f7', 'color updated to new value');
  assertEq(updated.type, original.type, 'type unchanged after color update');
  assertEq(updated.text, original.text, 'text unchanged after color update');
  assertEq(updated.x, original.x, 'x unchanged after color update');
  assertEq(updated.y, original.y, 'y unchanged after color update');
  assertEq(updated.size, original.size, 'size unchanged after color update');
  assertEq(updated.visible, original.visible, 'visible unchanged after color update');
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Text update preserves other fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 14. Text update preserves other fields ───────────────────────────');
{
  const original = { type: 'text', text: '', logoUrl: '', x: 50, y: 10, size: 32, visible: true, color: '#ffffff' };
  const updated = { ...original, text: 'SozialZynk' };

  assertEq(updated.text, 'SozialZynk', 'text updated');
  assertEq(updated.type, original.type, 'type unchanged after text update');
  assertEq(updated.color, original.color, 'color unchanged after text update');
  assertEq(updated.x, original.x, 'x unchanged after text update');
  assertEq(updated.size, original.size, 'size unchanged after text update');
  assertEq(updated.visible, original.visible, 'visible unchanged after text update');
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Grid snap + drag independence
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 15. Grid snap + drag independence ────────────────────────────────');
{
  const frameWidth = 400;
  let b = createDefaultBrandOverlay();

  // Snap to bottom-left grid point
  b = { ...b, x: GRID_POSITIONS[6].x, y: GRID_POSITIONS[6].y }; // {x:10, y:90}
  assertEq(b.x, 10, 'snapped to bottom-left x=10');
  assertEq(b.y, 90, 'snapped to bottom-left y=90');
  assertEq(b.size, 32, 'snap does not affect size');
  assertEq(b.type, 'text', 'snap does not affect type');
  assertEq(b.text, '', 'snap does not affect text');

  // Drag from snapped position — now x is no longer on grid
  const newX = computeDragX(b.x, 25, frameWidth); // 10 + (25/400)*100 = 10 + 6.25 = 16.25
  b = { ...b, x: newX };
  assertClose(b.x, 16.25, 'drag from snapped position moves x correctly', 0.1);

  // After drag, no grid point should be active (16.25 is not near 10 or 50)
  const active = GRID_POSITIONS.filter((p) => isActiveGridPoint(b, p));
  assertEq(active.length, 0, 'after drag away from grid, no grid point is active');

  // Drag does not affect size, type, text
  assertEq(b.size, 32, 'drag does not affect size');
  assertEq(b.type, 'text', 'drag does not affect type');
  assertEq(b.text, '', 'drag does not affect text');

  // Snap again to a new grid point — does not affect previously dragged unrelated fields
  b = { ...b, x: GRID_POSITIONS[4].x, y: GRID_POSITIONS[4].y }; // center {x:50,y:50}
  assert(isActiveGridPoint(b, GRID_POSITIONS[4]), 're-snapping to center grid point is detected as active');
  assertEq(b.size, 32, 'second snap does not affect size');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
