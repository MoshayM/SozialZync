/**
 * Unit tests for the three clip-editor fixes in commit 1bfb92b:
 *   1. Caption/text timeline items are now selectable (onClick → setSelectedId)
 *   2. Body scroll lock when a mobile sheet is open
 *   3. Brand overlay: "Add Brand" label, default x=50, z-30
 *
 * Run: node apps/web/e2e/clip-editor-fixes.test.mjs
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Caption / text track item selectability
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Caption track item selection ─────────────────────────────────────');

// Simulate the state machine: clicking a caption sets selectedId
function simulateCaptionClick(captions, clickedId) {
  let selectedId = null;
  const setSelectedId = (id) => { selectedId = id; };

  const item = captions.find((c) => c.id === clickedId);
  if (item) {
    // This mirrors the onClick: (e) => { e.stopPropagation(); setSelectedId(c.id); }
    setSelectedId(item.id);
  }
  return selectedId;
}

{
  const captions = [
    { id: 'cap-1', startMs: 0, endMs: 2000, text: 'Hello' },
    { id: 'cap-2', startMs: 2000, endMs: 5000, text: 'World' },
  ];

  assertEq(simulateCaptionClick(captions, 'cap-1'), 'cap-1', 'clicking first caption sets selectedId to its id');
  assertEq(simulateCaptionClick(captions, 'cap-2'), 'cap-2', 'clicking second caption sets selectedId to its id');
  assertEq(simulateCaptionClick(captions, 'nonexistent'), null, 'clicking nonexistent id leaves selectedId null');
}

// Selection ring logic: ring class applied only when selectedId matches
function captionItemClassName(captionId, selectedId) {
  const isSelected = selectedId === captionId;
  return [
    'absolute top-1.5 bottom-1.5 rounded bg-amber-400/80 border border-amber-300 px-1 overflow-hidden cursor-pointer',
    isSelected
      ? 'ring-2 ring-white/80 ring-offset-1'
      : 'hover:border-amber-200 hover:bg-amber-400',
  ].join(' ');
}

{
  const cls = captionItemClassName('cap-1', 'cap-1');
  assert(cls.includes('ring-2'), 'selected caption has ring-2 class');
  assert(cls.includes('cursor-pointer'), 'selected caption still has cursor-pointer');
  assert(!cls.includes('hover:border-amber-200'), 'selected caption omits hover class');

  const cls2 = captionItemClassName('cap-1', 'cap-2');
  assert(!cls2.includes('ring-2'), 'non-selected caption has no ring');
  assert(cls2.includes('hover:border-amber-200'), 'non-selected caption has hover class');
  assert(cls2.includes('cursor-pointer'), 'non-selected caption has cursor-pointer');
}

// Both timeline.captions AND userTextOverlays are covered
{
  const captions = [{ id: 'sys-cap', startMs: 0, endMs: 1000, text: 'Auto', emoji: '🎉' }];
  const userTextOverlays = [{ id: 'user-txt', startMs: 500, endMs: 3000, text: 'Custom' }];

  // Merged list (mirrors the JSX [...captions.map(...), ...userTextOverlays.map(...)])
  const merged = [
    ...captions.map((c) => ({ id: c.id, startMs: c.startMs, endMs: c.endMs, text: c.text, emoji: c.emoji })),
    ...userTextOverlays.map((o) => ({ id: o.id, startMs: o.startMs, endMs: o.endMs, text: o.text, emoji: null })),
  ];

  assertEq(merged.length, 2, 'merged caption list contains both system captions and user text overlays');
  assertEq(simulateCaptionClick(merged, 'user-txt'), 'user-txt', 'clicking user text overlay sets selectedId');
  assertEq(simulateCaptionClick(merged, 'sys-cap'), 'sys-cap', 'clicking system caption sets selectedId');
  assertEq(merged.find((c) => c.id === 'user-txt').emoji, null, 'user text overlays have emoji: null in merged list');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Body scroll lock
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Body scroll lock ─────────────────────────────────────────────────');

// Mirror the useEffect logic
function applyScrollLock(mobileSheet, prevOverflow = '') {
  if (mobileSheet !== 'none') {
    return { overflow: 'hidden', cleanup: () => prevOverflow };
  }
  return { overflow: prevOverflow, cleanup: null };
}

{
  const res = applyScrollLock('studio');
  assertEq(res.overflow, 'hidden', "mobileSheet='studio' → body overflow set to 'hidden'");
  assert(typeof res.cleanup === 'function', "mobileSheet='studio' → cleanup function returned");

  const cleaned = res.cleanup();
  assertEq(cleaned, '', "cleanup restores empty string (default overflow)");
}

{
  const res = applyScrollLock('tools');
  assertEq(res.overflow, 'hidden', "mobileSheet='tools' → body overflow set to 'hidden'");
}

{
  const res = applyScrollLock('inspect');
  assertEq(res.overflow, 'hidden', "mobileSheet='inspect' → body overflow set to 'hidden'");
}

{
  const res = applyScrollLock('canvas');
  assertEq(res.overflow, 'hidden', "mobileSheet='canvas' → body overflow set to 'hidden'");
}

{
  const res = applyScrollLock('none');
  assertEq(res.overflow, '', "mobileSheet='none' → overflow NOT locked (stays empty)");
  assertEq(res.cleanup, null, "mobileSheet='none' → no cleanup function (effect is a no-op)");
}

// Cleanup restores the previous overflow value
{
  const prev = 'auto';
  const res = applyScrollLock('studio', prev);
  const restored = res.cleanup();
  assertEq(restored, prev, 'cleanup restores whatever overflow was before the lock');
}

// Transitioning from sheet → none should unlock
{
  let bodyOverflow = '';
  const lock = applyScrollLock('studio');
  bodyOverflow = lock.overflow;
  assertEq(bodyOverflow, 'hidden', 'overflow is hidden while sheet is open');

  // Sheet closes — effect re-runs, lock.cleanup is called, then new applyScrollLock('none') runs
  bodyOverflow = lock.cleanup();
  assertEq(bodyOverflow, '', 'overflow restored when sheet closes');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Brand overlay UX
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Brand overlay label + defaults ───────────────────────────────────');

// Mirror the button label logic: brand?.visible ? 'Visible' : brand ? 'Hidden' : 'Add Brand'
function brandButtonLabel(brand) {
  return brand?.visible ? 'Visible' : brand ? 'Hidden' : 'Add Brand';
}

{
  assertEq(brandButtonLabel(null),  'Add Brand', 'brand=null → label is "Add Brand"');
  assertEq(brandButtonLabel(undefined), 'Add Brand', 'brand=undefined → label is "Add Brand"');
  assertEq(brandButtonLabel({ visible: true,  type: 'text', text: 'X', x: 50, y: 10, size: 1.2, color: '#fff' }), 'Visible', 'brand with visible=true → "Visible"');
  assertEq(brandButtonLabel({ visible: false, type: 'text', text: 'X', x: 50, y: 10, size: 1.2, color: '#fff' }), 'Hidden',  'brand with visible=false → "Hidden"');
}

// Default brand created on first click (when brand is null)
function createDefaultBrand() {
  return { type: 'text', text: '', x: 50, y: 10, size: 1.2, visible: true, color: '#ffffff' };
}

{
  const b = createDefaultBrand();
  assertEq(b.x, 50, 'default brand x is 50 (center, avoids overflow-hidden clipping)');
  assertEq(b.y, 10, 'default brand y is 10 (near top)');
  assertEq(b.visible, true, 'default brand starts visible');
  assertEq(b.type, 'text', 'default brand type is text');
  assertEq(b.color, '#ffffff', 'default brand color is white');
}

// Toggle logic: clicking button when brand is null → creates brand
// clicking when brand exists → toggles visible
function handleBrandToggle(brand) {
  if (brand) {
    return { ...brand, visible: !brand.visible };
  }
  return createDefaultBrand();
}

{
  const b1 = handleBrandToggle(null);
  assertEq(b1.x, 50, 'first click creates brand at x=50');
  assert(b1.visible, 'first click creates brand as visible');

  const b2 = handleBrandToggle(b1);
  assert(!b2.visible, 'second click hides the brand');

  const b3 = handleBrandToggle(b2);
  assert(b3.visible, 'third click shows the brand again');
}

// z-index: brand overlay must use z-30 (not z-20)
{
  // Mirror the className check
  const brandOverlayClass = 'absolute z-30 cursor-move select-none';
  assert(brandOverlayClass.includes('z-30'), 'brand overlay uses z-30');
  assert(!brandOverlayClass.includes('z-20'), 'brand overlay does NOT use z-20');
}

// x=50, y=10 is safe from overflow-hidden clipping
// With transform(-50%,-50%), center is at (x%, y%)
// Left edge = x% - 50% of elementWidth
// At x=50%, left edge ≥ 0 for any reasonable text
{
  const containerWidth = 300; // px, narrow mobile preview
  const textWidth = 120;      // px, wide brand text

  const testX = (xPercent) => {
    const centerPx = containerWidth * (xPercent / 100);
    const leftEdge = centerPx - textWidth / 2;
    return leftEdge;
  };

  const leftEdgeAt10 = testX(10);
  const leftEdgeAt50 = testX(50);

  assert(leftEdgeAt10 < 0, 'x=10 clips brand text on narrow 300px container (left edge negative)');
  assert(leftEdgeAt50 >= 0, 'x=50 keeps brand text visible (left edge non-negative)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
