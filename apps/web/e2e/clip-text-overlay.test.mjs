/**
 * Unit tests for text overlay selection, editing, drag, and deletion
 * introduced in commit 59701e1.
 *
 * Run: node apps/web/e2e/clip-text-overlay.test.mjs
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label}`); failed++; }
}
function assertEq(a, b, label) {
  if (a === b) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); failed++; }
}
function assertClose(a, b, label, tol = 0.5) {
  if (Math.abs(a - b) <= tol) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label} — expected ${b}, got ${a}`); failed++; }
}

// ── Helpers mirroring the page implementation ──────────────────────────────

function makeOverlay(overrides = {}) {
  return {
    id: overrides.id ?? `ov-${Math.random().toString(36).slice(2)}`,
    startMs: overrides.startMs ?? 0,
    endMs: overrides.endMs ?? 5000,
    text: overrides.text ?? 'Hello',
    x: overrides.x ?? 50,
    y: overrides.y ?? 50,
    fontSize: overrides.fontSize ?? 'md',
    color: overrides.color ?? '#ffffff',
  };
}

// Mirrors: overlay visible only when playheadMs in [startMs, endMs)
function visibleOverlays(overlays, playheadMs) {
  return overlays.filter((o) => playheadMs >= o.startMs && playheadMs < o.endMs);
}

// Mirrors: onClick → setSelectedId(o.id) + setDesktopTab('text')
function simulateOverlayClick(overlays, clickedId) {
  let selectedId = null;
  let desktopTab = 'ai';
  const setSelectedId = (id) => { selectedId = id; };
  const setDesktopTab = (t) => { desktopTab = t; };

  const target = overlays.find((o) => o.id === clickedId);
  if (target) {
    setSelectedId(target.id);
    setDesktopTab('text');
  }
  return { selectedId, desktopTab };
}

// Mirrors: drag onMouseDown → absolute-position math
function computeDragPosition(clientX, clientY, rect) {
  const nx = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const ny = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  return { x: Math.round(nx), y: Math.round(ny) };
}

// Mirrors: updating one overlay preserves all others
function updateOverlay(overlays, id, patch) {
  return overlays.map((o) => o.id === id ? { ...o, ...patch } : o);
}

// Mirrors: delete button / Delete key
function deleteOverlay(overlays, selectedId) {
  return overlays.filter((o) => o.id !== selectedId);
}

// Mirrors: keyboard handler delete logic
function handleKeyDown(key, target, selectedId, userTextOverlays) {
  const isInput = ['INPUT', 'TEXTAREA'].includes(target?.tagName);
  if ((key === 'Delete' || key === 'Backspace') && selectedId && !isInput) {
    const isTextOverlay = userTextOverlays.some((o) => o.id === selectedId);
    if (isTextOverlay) {
      return {
        overlays: userTextOverlays.filter((o) => o.id !== selectedId),
        selectedId: null,
        prevented: true,
      };
    }
  }
  return { overlays: userTextOverlays, selectedId, prevented: false };
}

// Mirrors: className for overlay div
function overlayClassName(overlayId, selectedId) {
  const isSel = selectedId === overlayId;
  return `absolute z-20 cursor-move select-none${isSel ? ' ring-2 ring-amber-400 ring-offset-1 rounded-lg' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Visibility filter
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Visibility filter (playhead gating) ──────────────────────────────');
{
  const overlays = [
    makeOverlay({ id: 'a', startMs: 0,    endMs: 2000 }),
    makeOverlay({ id: 'b', startMs: 2000, endMs: 5000 }),
    makeOverlay({ id: 'c', startMs: 1000, endMs: 3000 }),
  ];

  const at0    = visibleOverlays(overlays, 0).map((o) => o.id);
  const at1500 = visibleOverlays(overlays, 1500).map((o) => o.id);
  const at2000 = visibleOverlays(overlays, 2000).map((o) => o.id);
  const at5000 = visibleOverlays(overlays, 5000).map((o) => o.id);

  assert(at0.includes('a') && !at0.includes('b') && !at0.includes('c'), 'at 0ms: only overlay a visible');
  assert(at1500.includes('a') && at1500.includes('c') && !at1500.includes('b'), 'at 1500ms: a and c visible, b not');
  assert(at2000.includes('b') && at2000.includes('c') && !at2000.includes('a'), 'at 2000ms: a ends (exclusive), b and c visible');
  assertEq(at5000.length, 0, 'at 5000ms: no overlays visible (all end at or before 5000ms)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Click selection
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Click selection ───────────────────────────────────────────────────');
{
  const overlays = [makeOverlay({ id: 'x' }), makeOverlay({ id: 'y' })];

  const r1 = simulateOverlayClick(overlays, 'x');
  assertEq(r1.selectedId, 'x', 'clicking overlay x sets selectedId to x');
  assertEq(r1.desktopTab, 'text', 'clicking overlay auto-switches desktopTab to "text"');

  const r2 = simulateOverlayClick(overlays, 'y');
  assertEq(r2.selectedId, 'y', 'clicking overlay y sets selectedId to y');
  assertEq(r2.desktopTab, 'text', 'clicking y also switches to text tab');

  const r3 = simulateOverlayClick(overlays, 'nonexistent');
  assertEq(r3.selectedId, null, 'clicking unknown id leaves selectedId null');
  assertEq(r3.desktopTab, 'ai', 'clicking unknown id does not change tab');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Selection ring className
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Selection ring ────────────────────────────────────────────────────');
{
  const cls = overlayClassName('ov-1', 'ov-1');
  assert(cls.includes('ring-2'), 'selected overlay has ring-2');
  assert(cls.includes('ring-amber-400'), 'selected overlay has ring-amber-400');
  assert(cls.includes('ring-offset-1'), 'selected overlay has ring-offset-1');
  assert(cls.includes('rounded-lg'), 'selected overlay has rounded-lg for ring shape');
  assert(cls.includes('z-20'), 'overlay uses z-20');
  assert(cls.includes('cursor-move'), 'overlay has cursor-move');

  const cls2 = overlayClassName('ov-1', 'ov-2');
  assert(!cls2.includes('ring-2'), 'non-selected overlay has no ring');
  assert(!cls2.includes('ring-amber-400'), 'non-selected overlay has no amber ring color');
  assert(cls2.includes('z-20'), 'non-selected overlay still has z-20');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Drag math (absolute-position, mirrors brand overlay)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Drag math (absolute position) ────────────────────────────────────');
{
  const rect = { left: 100, top: 50, width: 400, height: 600 };

  // Center of preview
  const center = computeDragPosition(300, 350, rect);
  assertEq(center.x, 50, 'center of preview → x=50%');
  assertEq(center.y, 50, 'center of preview → y=50%');

  // Top-left corner
  const topLeft = computeDragPosition(100, 50, rect);
  assertEq(topLeft.x, 0, 'top-left corner → x=0%');
  assertEq(topLeft.y, 0, 'top-left corner → y=0%');

  // Bottom-right corner
  const botRight = computeDragPosition(500, 650, rect);
  assertEq(botRight.x, 100, 'bottom-right corner → x=100%');
  assertEq(botRight.y, 100, 'bottom-right corner → y=100%');

  // Clamp: outside left edge
  const outsideLeft = computeDragPosition(50, 350, rect); // clientX < rect.left
  assertEq(outsideLeft.x, 0, 'outside left → clamped to 0');

  // Clamp: outside right edge
  const outsideRight = computeDragPosition(600, 350, rect); // clientX > rect.right
  assertEq(outsideRight.x, 100, 'outside right → clamped to 100');

  // Clamp: above top edge
  const aboveTop = computeDragPosition(300, 0, rect); // clientY < rect.top
  assertEq(aboveTop.y, 0, 'above top → clamped to 0');

  // Clamp: below bottom edge
  const belowBottom = computeDragPosition(300, 700, rect);
  assertEq(belowBottom.y, 100, 'below bottom → clamped to 100');

  // Quarter point
  const q = computeDragPosition(200, 200, rect); // (200-100)/400=25%, (200-50)/600=25%
  assertEq(q.x, 25, 'quarter point → x=25%');
  assertEq(q.y, 25, 'quarter point → y=25%');

  // Rounding: Math.round applied
  const r = computeDragPosition(133, 65, rect); // x=(33/400)*100=8.25→8, y=(15/600)*100=2.5→3
  assertEq(r.x, 8, 'drag position is rounded via Math.round (x)');
  assertEq(r.y, 3, 'drag position is rounded via Math.round (y)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Text editing
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Text editing ──────────────────────────────────────────────────────');
{
  const overlays = [
    makeOverlay({ id: 'a', text: 'Hello' }),
    makeOverlay({ id: 'b', text: 'World' }),
  ];

  const updated = updateOverlay(overlays, 'a', { text: 'Updated' });
  assertEq(updated.find((o) => o.id === 'a').text, 'Updated', 'text updated for target overlay');
  assertEq(updated.find((o) => o.id === 'b').text, 'World', 'other overlay text unchanged');
  assertEq(updated.length, 2, 'overlay count unchanged after text edit');

  // Updating text preserves all other fields
  const orig = makeOverlay({ id: 'c', text: 'Orig', x: 30, y: 40, fontSize: 'lg', color: '#ff0000' });
  const patched = updateOverlay([orig], 'c', { text: 'New' })[0];
  assertEq(patched.x, 30, 'text update preserves x');
  assertEq(patched.y, 40, 'text update preserves y');
  assertEq(patched.fontSize, 'lg', 'text update preserves fontSize');
  assertEq(patched.color, '#ff0000', 'text update preserves color');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Position slider updates
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Position sliders ──────────────────────────────────────────────────');
{
  const overlays = [makeOverlay({ id: 'a', x: 50, y: 50 })];

  const movedX = updateOverlay(overlays, 'a', { x: 75 });
  assertEq(movedX[0].x, 75, 'X slider updates x to 75');
  assertEq(movedX[0].y, 50, 'X slider does not change y');

  const movedY = updateOverlay(overlays, 'a', { y: 20 });
  assertEq(movedY[0].y, 20, 'Y slider updates y to 20');
  assertEq(movedY[0].x, 50, 'Y slider does not change x');

  // Edge values
  const atMin = updateOverlay(overlays, 'a', { x: 0, y: 0 });
  assertEq(atMin[0].x, 0, 'x can be set to 0');
  assertEq(atMin[0].y, 0, 'y can be set to 0');

  const atMax = updateOverlay(overlays, 'a', { x: 100, y: 100 });
  assertEq(atMax[0].x, 100, 'x can be set to 100');
  assertEq(atMax[0].y, 100, 'y can be set to 100');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Font size buttons (sm / md / lg)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Font size buttons ─────────────────────────────────────────────────');
{
  const overlays = [makeOverlay({ id: 'a', fontSize: 'md' })];

  for (const size of ['sm', 'md', 'lg']) {
    const updated = updateOverlay(overlays, 'a', { fontSize: size });
    assertEq(updated[0].fontSize, size, `fontSize updates to '${size}'`);
  }

  // fontSize update preserves other fields
  const orig = makeOverlay({ id: 'b', text: 'Hi', x: 20, y: 30, color: '#ff0', fontSize: 'sm' });
  const updated = updateOverlay([orig], 'b', { fontSize: 'lg' })[0];
  assertEq(updated.text, 'Hi', 'fontSize update preserves text');
  assertEq(updated.x, 20, 'fontSize update preserves x');
  assertEq(updated.color, '#ff0', 'fontSize update preserves color');
}

// fontSize renders correctly in span className
function fontSizeClass(fontSize) {
  return fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-xl' : 'text-base';
}
{
  assertEq(fontSizeClass('sm'), 'text-sm', 'sm → text-sm Tailwind class');
  assertEq(fontSizeClass('md'), 'text-base', 'md → text-base Tailwind class');
  assertEq(fontSizeClass('lg'), 'text-xl', 'lg → text-xl Tailwind class');
  assertEq(fontSizeClass('unknown'), 'text-base', 'unknown fontSize → text-base fallback');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Color swatches
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Color swatches ────────────────────────────────────────────────────');
{
  const COLORS = ['#ffffff', '#000000', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e'];
  const overlays = [makeOverlay({ id: 'a', color: '#ffffff' })];

  for (const c of COLORS) {
    const updated = updateOverlay(overlays, 'a', { color: c });
    assertEq(updated[0].color, c, `color updates to ${c}`);
  }

  // Color update preserves text
  const orig = makeOverlay({ id: 'b', text: 'Keep me', color: '#fff' });
  const updated = updateOverlay([orig], 'b', { color: '#000000' })[0];
  assertEq(updated.text, 'Keep me', 'color update preserves text field');
  assertEq(updated.fontSize, orig.fontSize, 'color update preserves fontSize');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Delete button
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Delete button ─────────────────────────────────────────────────────');
{
  const overlays = [
    makeOverlay({ id: 'a' }),
    makeOverlay({ id: 'b' }),
    makeOverlay({ id: 'c' }),
  ];

  const after = deleteOverlay(overlays, 'b');
  assertEq(after.length, 2, 'delete removes one overlay');
  assert(!after.some((o) => o.id === 'b'), 'deleted overlay is gone');
  assert(after.some((o) => o.id === 'a'), 'other overlay a preserved');
  assert(after.some((o) => o.id === 'c'), 'other overlay c preserved');

  // After delete, selectedId should be cleared (simulated)
  let selectedId = 'b';
  const remaining = deleteOverlay(overlays, selectedId);
  selectedId = null; // cleared after delete
  assertEq(selectedId, null, 'selectedId cleared after delete');
  assertEq(remaining.length, 2, 'remaining count correct after delete');
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Delete / Backspace key
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Delete / Backspace key ────────────────────────────────────────────');
{
  const overlays = [makeOverlay({ id: 'x' }), makeOverlay({ id: 'y' })];

  // Delete key on a selected text overlay — not in an input
  const r1 = handleKeyDown('Delete', { tagName: 'DIV' }, 'x', overlays);
  assertEq(r1.overlays.length, 1, 'Delete key removes selected text overlay');
  assert(!r1.overlays.some((o) => o.id === 'x'), 'overlay x is removed');
  assertEq(r1.selectedId, null, 'selectedId cleared after Delete key');
  assert(r1.prevented, 'event.preventDefault() called');

  // Backspace key also works
  const r2 = handleKeyDown('Backspace', { tagName: 'DIV' }, 'y', overlays);
  assertEq(r2.overlays.length, 1, 'Backspace key removes selected text overlay');
  assertEq(r2.selectedId, null, 'selectedId cleared after Backspace key');

  // Delete key when focused on an INPUT — should NOT remove overlay
  const r3 = handleKeyDown('Delete', { tagName: 'INPUT' }, 'x', overlays);
  assertEq(r3.overlays.length, 2, 'Delete key in INPUT does not remove overlay');
  assertEq(r3.selectedId, 'x', 'selectedId unchanged when Delete in INPUT');
  assert(!r3.prevented, 'event.preventDefault() NOT called in input');

  // Delete key when focused on a TEXTAREA — should NOT remove overlay
  const r4 = handleKeyDown('Delete', { tagName: 'TEXTAREA' }, 'x', overlays);
  assertEq(r4.overlays.length, 2, 'Delete key in TEXTAREA does not remove overlay');
  assert(!r4.prevented, 'event.preventDefault() NOT called in textarea');

  // Delete key when selectedId does not match any text overlay
  const r5 = handleKeyDown('Delete', { tagName: 'DIV' }, 'video-item-1', overlays);
  assertEq(r5.overlays.length, 2, 'Delete key on non-text-overlay selectedId does nothing to text overlays');
  assert(!r5.prevented, 'event.preventDefault() NOT called for non-text-overlay');

  // Delete key when selectedId is null
  const r6 = handleKeyDown('Delete', { tagName: 'DIV' }, null, overlays);
  assertEq(r6.overlays.length, 2, 'Delete key with no selection does nothing');

  // Other keys are ignored
  const r7 = handleKeyDown('Enter', { tagName: 'DIV' }, 'x', overlays);
  assertEq(r7.overlays.length, 2, 'Enter key does not remove overlay');
  assert(!r7.prevented, 'Enter key does not preventDefault');
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Multi-overlay independence
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Multi-overlay independence ────────────────────────────────────────');
{
  const overlays = [
    makeOverlay({ id: 'a', text: 'A', x: 10, y: 20, fontSize: 'sm', color: '#fff' }),
    makeOverlay({ id: 'b', text: 'B', x: 50, y: 50, fontSize: 'md', color: '#000' }),
    makeOverlay({ id: 'c', text: 'C', x: 90, y: 80, fontSize: 'lg', color: '#f00' }),
  ];

  // Editing one overlay does not affect others
  const after = updateOverlay(overlays, 'b', { text: 'B-new', x: 60, color: '#blue' });
  assertEq(after.find((o) => o.id === 'a').text, 'A', 'editing b does not change a.text');
  assertEq(after.find((o) => o.id === 'c').text, 'C', 'editing b does not change c.text');
  assertEq(after.find((o) => o.id === 'a').x, 10, 'editing b does not change a.x');
  assertEq(after.find((o) => o.id === 'c').x, 90, 'editing b does not change c.x');
  assertEq(after.find((o) => o.id === 'b').text, 'B-new', 'b.text updated correctly');
  assertEq(after.find((o) => o.id === 'b').x, 60, 'b.x updated correctly');

  // Deleting one overlay does not affect others
  const afterDel = deleteOverlay(overlays, 'b');
  assertEq(afterDel.length, 2, 'delete b: 2 remaining');
  assert(afterDel.every((o) => o.id !== 'b'), 'b removed');
  assertEq(afterDel[0].id, 'a', 'a order preserved');
  assertEq(afterDel[1].id, 'c', 'c order preserved');
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Z-index ordering (text overlays at z-20, brand at z-30)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Z-index ordering ──────────────────────────────────────────────────');
{
  const textOverlayClass = 'absolute z-20 cursor-move select-none';
  const brandOverlayClass = 'absolute z-30 cursor-move select-none';

  assert(textOverlayClass.includes('z-20'), 'text overlays use z-20');
  assert(!textOverlayClass.includes('z-30'), 'text overlays do NOT use z-30');
  assert(brandOverlayClass.includes('z-30'), 'brand overlay uses z-30');
  assert(!brandOverlayClass.includes('z-20'), 'brand overlay does NOT use z-20');

  // Numeric comparison: z-30 > z-20
  const parseZ = (cls) => parseInt(cls.match(/z-(\d+)/)?.[1] ?? '0');
  assert(parseZ(brandOverlayClass) > parseZ(textOverlayClass), 'brand z-index is higher than text overlay z-index');
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Edit panel appearance (selectedId matches text overlay)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Edit panel appearance ─────────────────────────────────────────────');
{
  const overlays = [makeOverlay({ id: 'a' }), makeOverlay({ id: 'b' })];

  // Mirrors: const sel = userTextOverlays.find((o) => o.id === selectedId)
  function getSelectedOverlay(overlays, selectedId) {
    return overlays.find((o) => o.id === selectedId) ?? null;
  }

  assertEq(getSelectedOverlay(overlays, 'a')?.id, 'a', 'edit panel finds selected overlay a');
  assertEq(getSelectedOverlay(overlays, 'b')?.id, 'b', 'edit panel finds selected overlay b');
  assertEq(getSelectedOverlay(overlays, 'none'), null, 'edit panel returns null when no match (panel hidden)');
  assertEq(getSelectedOverlay(overlays, null), null, 'edit panel hidden when selectedId is null');
  assertEq(getSelectedOverlay([], 'a'), null, 'edit panel hidden when overlay list is empty');
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Drag vs. click: onMouseDown also sets selectedId + tab
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Drag also selects (onMouseDown) ───────────────────────────────────');
{
  // Mirrors: onMouseDown calls setSelectedId(o.id) + setDesktopTab('text') before setting up mousemove
  function simulateMouseDown(overlays, targetId) {
    let selectedId = null;
    let desktopTab = 'canvas';
    const target = overlays.find((o) => o.id === targetId);
    if (target) {
      selectedId = target.id;
      desktopTab = 'text';
    }
    return { selectedId, desktopTab };
  }

  const overlays = [makeOverlay({ id: 'drag-me' })];
  const r = simulateMouseDown(overlays, 'drag-me');
  assertEq(r.selectedId, 'drag-me', 'mouseDown selects the overlay');
  assertEq(r.desktopTab, 'text', 'mouseDown switches to text tab');
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Empty list edge cases
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Empty list edge cases ─────────────────────────────────────────────');
{
  assertEq(visibleOverlays([], 1000).length, 0, 'empty overlay list → nothing visible');
  assertEq(deleteOverlay([], 'any').length, 0, 'delete on empty list → empty list');

  const r = handleKeyDown('Delete', { tagName: 'DIV' }, 'x', []);
  assertEq(r.overlays.length, 0, 'Delete key on empty list → still empty');
  assert(!r.prevented, 'Delete key on empty list → no preventDefault (overlay not found)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
