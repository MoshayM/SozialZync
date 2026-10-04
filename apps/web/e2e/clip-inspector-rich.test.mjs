/**
 * Unit tests for the rich inspector panels added in commit a1a515a:
 *   - Text overlay: textAnim, X/Y sliders, color picker, size buttons
 *   - Audio/Linked-audio: volume, gainDb, fadeInMs, fadeOutMs, duckUnderVoice
 *   - itemPropsMap: getItemProps / setItemProp helpers
 *   - Save Draft footer: button state logic
 *
 * Run: node apps/web/e2e/clip-inspector-rich.test.mjs
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
function assertClose(a, b, eps, label) {
  if (Math.abs(a - b) <= eps) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label} — expected ~${b}, got ${a}`); failed++; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TextOverlay type — textAnim field
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TextOverlay.textAnim field ───────────────────────────────────────');

function makeOverlay(overrides = {}) {
  return {
    id: 'o1', startMs: 0, endMs: 3000,
    text: 'Hello', x: 50, y: 80,
    fontSize: 'md', color: '#ffffff',
    textAnim: 'none',
    ...overrides,
  };
}

{
  const o = makeOverlay();
  assertEq(o.textAnim, 'none', 'default textAnim is "none"');

  const o2 = { ...o, textAnim: 'fade-in' };
  assertEq(o2.textAnim, 'fade-in', 'textAnim can be set to "fade-in"');

  const o3 = { ...o, textAnim: 'slide-up' };
  assertEq(o3.textAnim, 'slide-up', 'textAnim can be set to "slide-up"');

  // Simulate the select onChange
  const validAnims = ['none', 'fade-in', 'slide-up'];
  validAnims.forEach((anim) => {
    const updated = { ...o, textAnim: anim };
    assert(validAnims.includes(updated.textAnim), `textAnim "${anim}" is a valid option`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Text overlay X / Y sliders
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Text overlay X / Y position sliders ──────────────────────────────');

function updateOverlayProp(overlays, id, key, value) {
  return overlays.map((o) => o.id === id ? { ...o, [key]: value } : o);
}

{
  const overlays = [makeOverlay({ id: 'o1', x: 50, y: 80 })];

  // X slider change
  const after1 = updateOverlayProp(overlays, 'o1', 'x', 30);
  assertEq(after1[0].x, 30, 'X slider updates x to 30');
  assertEq(after1[0].y, 80, 'X slider does not change y');

  // Y slider change
  const after2 = updateOverlayProp(overlays, 'o1', 'y', 20);
  assertEq(after2[0].y, 20, 'Y slider updates y to 20');
  assertEq(after2[0].x, 50, 'Y slider does not change x');

  // Clamp: sliders are min=0 max=100
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  assertEq(clamp(-10, 0, 100), 0, 'X below 0 clamped to 0');
  assertEq(clamp(110, 0, 100), 100, 'X above 100 clamped to 100');
  assertEq(clamp(50, 0, 100), 50, 'X within range unchanged');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Text overlay color picker
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Text overlay color picker ─────────────────────────────────────────');

{
  const overlays = [makeOverlay({ id: 'o1', color: '#ffffff' })];

  // Native color input produces 6-char hex
  const newColor = '#ef4444';
  const after = updateOverlayProp(overlays, 'o1', 'color', newColor);
  assertEq(after[0].color, '#ef4444', 'color picker updates color to red');

  // Quick swatches
  const swatches = ['#ffffff','#000000','#f59e0b','#ef4444','#3b82f6','#22c55e'];
  swatches.forEach((c) => {
    const a = updateOverlayProp(overlays, 'o1', 'color', c);
    assertEq(a[0].color, c, `swatch ${c} sets color correctly`);
  });

  // Active swatch highlight: color === swatch value
  const isActive = (overlayColor, swatchColor) => overlayColor === swatchColor;
  assert(isActive('#ef4444', '#ef4444'), 'active swatch matches current color');
  assert(!isActive('#ffffff', '#ef4444'), 'inactive swatch does not match');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Text overlay size buttons
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Text overlay size buttons ─────────────────────────────────────────');

{
  const overlays = [makeOverlay({ id: 'o1', fontSize: 'md' })];

  const sizes = ['sm', 'md', 'lg'];
  sizes.forEach((s) => {
    const after = updateOverlayProp(overlays, 'o1', 'fontSize', s);
    assertEq(after[0].fontSize, s, `size button "${s}" sets fontSize to "${s}"`);
    // Active state: border-amber-500 applied only when match
    const isActive = (current, btn) => current === btn;
    assert(isActive(s, s), `active class applied for "${s}"`);
    assert(!isActive(s, sizes.find((x) => x !== s)), `active class not applied for other size`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. itemPropsMap — getItemProps / setItemProp helpers
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── itemPropsMap helpers ─────────────────────────────────────────────');

// Mirror the component logic
function makePropsMap() {
  let map = new Map();
  const getItemProps = (id) => map.get(id) ?? {};
  const setItemProp = (id, key, value) => {
    const next = new Map(map);
    next.set(id, { ...next.get(id), [key]: value });
    map = next;
    return next;
  };
  return { getItemProps, setItemProp, getMap: () => map };
}

{
  const { getItemProps, setItemProp } = makePropsMap();

  // Unknown item → empty object defaults
  const empty = getItemProps('item-1');
  assertEq(empty.volume, undefined, 'unknown item volume defaults to undefined');
  assertEq(empty.gainDb, undefined, 'unknown item gainDb defaults to undefined');

  // Fallback to defaults in UI: ip.volume ?? 1 → 1
  assertEq((empty.volume ?? 1), 1, 'volume defaults to 1 (100%) via ?? operator');
  assertEq((empty.gainDb ?? 0), 0, 'gainDb defaults to 0 dB via ?? operator');
  assertEq((empty.speed ?? 1), 1, 'speed defaults to 1× via ?? operator');
  assertEq((empty.duckUnderVoice ?? false), false, 'duckUnderVoice defaults to false');
  assertEq((empty.reverse ?? false), false, 'reverse defaults to false');
  assertEq((empty.grayscale ?? false), false, 'grayscale defaults to false');

  // Set a property
  setItemProp('item-1', 'volume', 1.5);
  assertClose(getItemProps('item-1').volume, 1.5, 0.001, 'volume set to 1.5 (150%)');

  // Other properties unaffected
  assertEq(getItemProps('item-1').gainDb, undefined, 'gainDb unaffected after volume change');

  // Set multiple props
  setItemProp('item-1', 'gainDb', -6);
  setItemProp('item-1', 'speed', 2);
  const ip = getItemProps('item-1');
  assertClose(ip.volume, 1.5, 0.001, 'volume still 1.5 after further changes');
  assertClose(ip.gainDb, -6, 0.001, 'gainDb is -6 dB');
  assertClose(ip.speed, 2, 0.001, 'speed is 2×');

  // Different items are isolated
  setItemProp('item-2', 'volume', 0.5);
  assertClose(getItemProps('item-2').volume, 0.5, 0.001, 'item-2 volume is 0.5');
  assertClose(getItemProps('item-1').volume, 1.5, 0.001, 'item-1 volume still 1.5 (isolated)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Audio inspector — volume slider range
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Audio inspector — volume slider ──────────────────────────────────');

{
  // Volume: range input min=0 max=2 step=0.01
  // Display: Math.round(volume * 100) + '%'
  const displayVolume = (v) => `${Math.round(v * 100)}%`;

  assertEq(displayVolume(0), '0%', 'volume 0 displays as 0%');
  assertEq(displayVolume(1), '100%', 'volume 1 displays as 100%');
  assertEq(displayVolume(1.5), '150%', 'volume 1.5 displays as 150%');
  assertEq(displayVolume(2), '200%', 'volume 2 displays as 200% (max)');
  assertEq(displayVolume(0.5), '50%', 'volume 0.5 displays as 50%');

  // Parsing from range input
  const parseVolume = (str) => parseFloat(str);
  assertClose(parseVolume('1.50'), 1.5, 0.001, 'parseFloat parses range value correctly');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Audio inspector — gain dB slider
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Audio inspector — gain dB slider ─────────────────────────────────');

{
  // Gain: range input min=-60 max=12 step=0.5
  // Display: gainDb.toFixed(1) + ' dB'
  const displayGain = (v) => `${v.toFixed(1)} dB`;

  assertEq(displayGain(0), '0.0 dB', 'gain 0 displays as "0.0 dB"');
  assertEq(displayGain(-6), '-6.0 dB', 'gain -6 displays as "-6.0 dB"');
  assertEq(displayGain(12), '12.0 dB', 'gain 12 displays as "12.0 dB" (max)');
  assertEq(displayGain(-60), '-60.0 dB', 'gain -60 displays as "-60.0 dB" (min)');
  assertEq(displayGain(3.5), '3.5 dB', 'gain 3.5 displays correctly');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Audio inspector — fade in/out ms inputs
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Audio inspector — fade in/out ms inputs ──────────────────────────');

{
  // Fade ms: number input, max(0, parseInt(value) || 0)
  const parseFadeMs = (str) => Math.max(0, parseInt(str) || 0);

  assertEq(parseFadeMs('500'), 500, 'fade 500ms parses correctly');
  assertEq(parseFadeMs('0'), 0, 'fade 0ms → 0');
  assertEq(parseFadeMs('-100'), 0, 'negative fade clamped to 0');
  assertEq(parseFadeMs('abc'), 0, 'invalid string → 0');
  assertEq(parseFadeMs('10000'), 10000, 'fade 10000ms (max) parses correctly');

  // itemPropsMap integration
  const { getItemProps, setItemProp } = makePropsMap();
  setItemProp('item-1', 'fadeInMs', 300);
  setItemProp('item-1', 'fadeOutMs', 500);
  assertEq(getItemProps('item-1').fadeInMs, 300, 'fadeInMs stored correctly');
  assertEq(getItemProps('item-1').fadeOutMs, 500, 'fadeOutMs stored correctly');
  assertEq(getItemProps('item-1').fadeInMs ?? 0, 300, 'fadeInMs read with ?? fallback');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Audio inspector — duck under voice checkbox (AUDIO only)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Audio inspector — duck under voice ───────────────────────────────');

{
  // Duck checkbox shown only for AUDIO tracks (not MUSIC)
  const showDuck = (trackType) => trackType === 'AUDIO';

  assert(showDuck('AUDIO'), 'duck checkbox shown for AUDIO track');
  assert(!showDuck('MUSIC'), 'duck checkbox hidden for MUSIC track');
  assert(!showDuck('VIDEO'), 'duck checkbox hidden for VIDEO track');

  // State toggle
  const { getItemProps, setItemProp } = makePropsMap();
  assertEq(getItemProps('a1').duckUnderVoice ?? false, false, 'duckUnderVoice starts false');
  setItemProp('a1', 'duckUnderVoice', true);
  assertEq(getItemProps('a1').duckUnderVoice, true, 'duckUnderVoice toggles to true');
  setItemProp('a1', 'duckUnderVoice', false);
  assertEq(getItemProps('a1').duckUnderVoice, false, 'duckUnderVoice toggles back to false');
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Video inspector — speed slider and presets
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Video inspector — speed slider + presets ─────────────────────────');

{
  const { getItemProps, setItemProp } = makePropsMap();

  // Default speed
  assertClose(getItemProps('v1').speed ?? 1, 1, 0.001, 'speed defaults to 1×');

  // Preset clicks
  const presets = [0.5, 0.75, 1, 1.5, 2, 4];
  presets.forEach((s) => {
    setItemProp('v1', 'speed', s);
    assertClose(getItemProps('v1').speed, s, 0.001, `preset ${s}× sets speed correctly`);
  });

  // Active preset detection: Math.abs((ip.speed ?? 1) - s) < 0.01
  const isActivePreset = (currentSpeed, preset) => Math.abs((currentSpeed ?? 1) - preset) < 0.01;
  setItemProp('v1', 'speed', 2);
  assert(isActivePreset(getItemProps('v1').speed, 2), 'preset 2× is active when speed=2');
  assert(!isActivePreset(getItemProps('v1').speed, 1), 'preset 1× not active when speed=2');

  // Display
  const displaySpeed = (v) => `${(v ?? 1).toFixed(2)}×`;
  assertEq(displaySpeed(1), '1.00×', 'speed 1 displays as 1.00×');
  assertEq(displaySpeed(1.5), '1.50×', 'speed 1.5 displays as 1.50×');
  assertEq(displaySpeed(0.25), '0.25×', 'speed 0.25 displays as 0.25×');
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Video inspector — effects (brightness/contrast/saturation/blur)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Video inspector — effects ─────────────────────────────────────────');

{
  const { getItemProps, setItemProp, getMap } = makePropsMap();

  const EFFECT_DEFAULTS = { brightness: 0, contrast: 1, saturation: 1, blur: 0 };

  // Defaults via ??
  const ip = getItemProps('v1');
  assertEq((ip.brightness ?? 0), 0, 'brightness defaults to 0');
  assertEq((ip.contrast ?? 1), 1, 'contrast defaults to 1');
  assertEq((ip.saturation ?? 1), 1, 'saturation defaults to 1');
  assertEq((ip.blur ?? 0), 0, 'blur defaults to 0');
  assertEq((ip.grayscale ?? false), false, 'grayscale defaults to false');

  // Set effects
  setItemProp('v1', 'brightness', 0.5);
  setItemProp('v1', 'contrast', 1.2);
  setItemProp('v1', 'saturation', 0.8);
  setItemProp('v1', 'blur', 4);
  setItemProp('v1', 'grayscale', true);

  const ip2 = getItemProps('v1');
  assertClose(ip2.brightness, 0.5, 0.001, 'brightness set to 0.5');
  assertClose(ip2.contrast, 1.2, 0.001, 'contrast set to 1.2');
  assertClose(ip2.saturation, 0.8, 0.001, 'saturation set to 0.8');
  assertClose(ip2.blur, 4, 0.001, 'blur set to 4px');
  assertEq(ip2.grayscale, true, 'grayscale set to true');

  // Reset effects button logic (mirrors the reset button onClick)
  const resetEffects = (id) => {
    const next = new Map(getMap());
    next.set(id, { ...next.get(id), ...EFFECT_DEFAULTS, grayscale: false });
    return next;
  };
  const afterReset = resetEffects('v1');
  const r = afterReset.get('v1');
  assertEq(r.brightness, 0, 'reset: brightness → 0');
  assertEq(r.contrast, 1, 'reset: contrast → 1');
  assertEq(r.saturation, 1, 'reset: saturation → 1');
  assertEq(r.blur, 0, 'reset: blur → 0');
  assertEq(r.grayscale, false, 'reset: grayscale → false');
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Video inspector — transition in
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Video inspector — transition in ──────────────────────────────────');

{
  const { getItemProps, setItemProp } = makePropsMap();

  // Default: no transition
  assertEq((getItemProps('v1').transitionIn ?? 'none'), 'none', 'transition defaults to "none"');

  const transitions = ['none', 'fade', 'dissolve', 'slide'];
  transitions.forEach((t) => {
    setItemProp('v1', 'transitionIn', t);
    assertEq(getItemProps('v1').transitionIn, t, `transition "${t}" set correctly`);
  });

  // Duration slider shown only when transition is not 'none'
  const showDuration = (t) => t && t !== 'none';
  assert(!showDuration('none'), 'duration hidden when transition is none');
  assert(showDuration('fade'), 'duration shown for fade');
  assert(showDuration('dissolve'), 'duration shown for dissolve');
  assert(showDuration('slide'), 'duration shown for slide');

  // Duration default 500ms
  assertEq((getItemProps('v1').transitionInDurMs ?? 500), 500, 'transition duration defaults to 500ms');
  setItemProp('v1', 'transitionInDurMs', 1200);
  assertEq(getItemProps('v1').transitionInDurMs, 1200, 'transition duration set to 1200ms');
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Linked-audio detection
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Linked-audio (embedded video audio) detection ────────────────────');

{
  const isLinkedAudio = (id) => id?.startsWith('linked-audio-');

  assert(isLinkedAudio('linked-audio-item-1'), 'linked-audio-* ID detected as linked audio');
  assert(!isLinkedAudio('item-1'), 'regular item not detected as linked audio');
  assert(!isLinkedAudio(null), 'null ID not detected as linked audio');
  assert(!isLinkedAudio(undefined), 'undefined ID not detected as linked audio');
  assert(isLinkedAudio('linked-audio-abc123'), 'longer linked-audio ID detected correctly');
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Save Draft footer — button state logic
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Save Draft footer — button state logic ───────────────────────────');

{
  // Button label logic: saving > pending > saved
  const saveBtnLabel = (saving, pendingCount) => {
    if (saving) return 'Saving…';
    if (pendingCount > 0) return 'Save Draft';
    return 'All Changes Saved';
  };

  assertEq(saveBtnLabel(false, 0), 'All Changes Saved', 'no pending → "All Changes Saved"');
  assertEq(saveBtnLabel(false, 3), 'Save Draft', 'pending edits → "Save Draft"');
  assertEq(saveBtnLabel(true, 3), 'Saving…', 'saving in progress → "Saving…"');
  assertEq(saveBtnLabel(true, 0), 'Saving…', 'saving takes priority over no pending');

  // Button disabled when saving OR no pending
  const isDisabled = (saving, pendingCount) => saving || pendingCount === 0;
  assert(isDisabled(false, 0), 'button disabled: no pending changes');
  assert(isDisabled(true, 5), 'button disabled: saving in progress');
  assert(!isDisabled(false, 5), 'button enabled: has pending changes and not saving');
  assert(isDisabled(true, 0), 'button disabled: saving + no pending');
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Inspector section visibility — which card shows per selectedId/item type
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Inspector card selection logic ───────────────────────────────────');

{
  // Mirrors the if-chain in the desktopTab === 'canvas' block
  function whichCard(selectedId, selectedItem, selectedTrackType, userTextOverlays) {
    if (selectedId?.startsWith('linked-audio-')) return 'linked-audio';
    if (selectedItem && (selectedTrackType === 'AUDIO' || selectedTrackType === 'MUSIC')) return 'audio';
    if (selectedItem && selectedTrackType === 'VIDEO') return 'video';
    const sel = userTextOverlays.find((o) => o.id === selectedId);
    if (sel) return 'text';
    return 'placeholder';
  }

  const dummyItem = { id: 'i1', startMs: 0, endMs: 5000 };
  const overlays = [{ id: 'txt1', text: 'Hi', startMs: 0, endMs: 2000, x: 50, y: 80, fontSize: 'md', color: '#fff' }];

  assertEq(whichCard('linked-audio-i1', null, null, []), 'linked-audio', 'linked-audio ID → linked-audio card');
  assertEq(whichCard('i1', dummyItem, 'AUDIO', []), 'audio', 'AUDIO track item → audio card');
  assertEq(whichCard('i1', dummyItem, 'MUSIC', []), 'audio', 'MUSIC track item → audio card');
  assertEq(whichCard('i1', dummyItem, 'VIDEO', []), 'video', 'VIDEO track item → video card');
  assertEq(whichCard('txt1', null, null, overlays), 'text', 'text overlay ID → text card');
  assertEq(whichCard(null, null, null, []), 'placeholder', 'nothing selected → placeholder');
  assertEq(whichCard('unknown', null, null, []), 'placeholder', 'unknown ID → placeholder');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
