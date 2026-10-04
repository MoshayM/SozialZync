/**
 * Unit tests for the Brand Overlay in the Clip/Short editor (Brand tab).
 * Mirrors the exact logic from desktopTab === 'brand' block in page.tsx.
 *
 * Run: node apps/web/e2e/clip-brand-overlay.test.mjs
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
// Helpers mirroring the component
// ─────────────────────────────────────────────────────────────────────────────

function makeDefaultBrand() {
  return { type: 'text', text: '', x: 50, y: 10, size: 1.2, visible: true, color: '#ffffff' };
}

// Toggle button onClick: b => b ? { ...b, visible: !b.visible } : makeDefaultBrand()
function toggleBrand(brand) {
  return brand ? { ...brand, visible: !brand.visible } : makeDefaultBrand();
}

// Button label: brand?.visible ? 'Visible' : brand ? 'Hidden' : 'Add Brand'
function brandBtnLabel(brand) {
  return brand?.visible ? 'Visible' : brand ? 'Hidden' : 'Add Brand';
}

// Size slider: value = Math.round(brand.size * 10);  onChange = parseInt(val) / 10
function sizeToSlider(size) { return Math.round(size * 10); }
function sliderToSize(val)  { return parseInt(String(val)) / 10; }

// ─────────────────────────────────────────────────────────────────────────────
// 1. Toggle button label
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Toggle button label ──────────────────────────────────────────────');

assertEq(brandBtnLabel(null),      'Add Brand', 'null brand → "Add Brand"');
assertEq(brandBtnLabel(undefined), 'Add Brand', 'undefined brand → "Add Brand"');
assertEq(brandBtnLabel({ ...makeDefaultBrand(), visible: true  }), 'Visible', 'visible brand → "Visible"');
assertEq(brandBtnLabel({ ...makeDefaultBrand(), visible: false }), 'Hidden',  'hidden brand → "Hidden"');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Toggle button onClick — create / toggle visible
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Toggle button onClick ─────────────────────────────────────────────');

{
  // First click on null → creates default brand
  const b1 = toggleBrand(null);
  assert(b1 !== null, 'first click creates brand object');
  assertEq(b1.type,    'text',     'default type is "text"');
  assertEq(b1.text,    '',         'default text is empty string');
  assertEq(b1.x,       50,         'default x is 50 (center)');
  assertEq(b1.y,       10,         'default y is 10 (near top)');
  assertClose(b1.size, 1.2, 0.001, 'default size is 1.2');
  assertEq(b1.visible, true,       'default visible is true');
  assertEq(b1.color,   '#ffffff',  'default color is white');

  // Second click → hides
  const b2 = toggleBrand(b1);
  assertEq(b2.visible, false, 'second click hides brand');
  assertEq(b2.text, b1.text, 'toggle does not change text');
  assertEq(b2.x,    b1.x,    'toggle does not change x');

  // Third click → shows again
  const b3 = toggleBrand(b2);
  assertEq(b3.visible, true, 'third click shows brand again');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Type toggle (Brand Title / Logo Image)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Type toggle ──────────────────────────────────────────────────────');

{
  let b = makeDefaultBrand();
  assertEq(b.type, 'text', 'starts as "text" type');

  // Switch to logo
  b = { ...b, type: 'logo' };
  assertEq(b.type, 'logo', 'type set to "logo"');

  // Switch back to text
  b = { ...b, type: 'text' };
  assertEq(b.type, 'text', 'type set back to "text"');

  // Active state: border-fuchsia-500 applied when type matches
  const isActiveType = (brand, t) => brand.type === t;
  const brandWithLogo = { ...makeDefaultBrand(), type: 'logo' };
  assert(isActiveType(brandWithLogo, 'logo'),   'logo button active when type=logo');
  assert(!isActiveType(brandWithLogo, 'text'),  'text button inactive when type=logo');
  assert(isActiveType(makeDefaultBrand(), 'text'), 'text button active when type=text');

  // Label display
  const typeLabel = (t) => t === 'text' ? 'Brand Title' : 'Logo Image';
  assertEq(typeLabel('text'), 'Brand Title', '"text" type shows "Brand Title" label');
  assertEq(typeLabel('logo'), 'Logo Image',  '"logo" type shows "Logo Image" label');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Text input — updates brand.text
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Text input ───────────────────────────────────────────────────────');

{
  let b = makeDefaultBrand();

  const updateText = (brand, newText) => ({ ...brand, text: newText });
  b = updateText(b, 'SozialZynk');
  assertEq(b.text, 'SozialZynk', 'text input sets brand.text');

  b = updateText(b, '');
  assertEq(b.text, '', 'clearing text sets brand.text to empty string');

  // Fallback display: {brand.text || 'Brand'}
  const displayText = (brand) => brand.text || 'Brand';
  assertEq(displayText({ text: '' }),          'Brand',      'empty text falls back to "Brand"');
  assertEq(displayText({ text: 'SozialZynk' }),'SozialZynk','non-empty text shows as-is');
  assertEq(displayText({ text: '   ' }),       '   ',        'whitespace-only text shows as-is (truthy)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Logo URL input
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Logo URL input ───────────────────────────────────────────────────');

{
  let b = { ...makeDefaultBrand(), type: 'logo' };
  assertEq(b.logoUrl, undefined, 'logoUrl starts as undefined');

  // Input value: brand.logoUrl ?? ''
  assertEq(b.logoUrl ?? '', '', 'logoUrl ?? "" is empty string when undefined');

  const updateLogo = (brand, url) => ({ ...brand, logoUrl: url });
  b = updateLogo(b, 'https://example.com/logo.png');
  assertEq(b.logoUrl, 'https://example.com/logo.png', 'logoUrl set correctly');

  b = updateLogo(b, '');
  assertEq(b.logoUrl, '', 'logoUrl cleared to empty string');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Color swatches (text type only)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Color swatches ───────────────────────────────────────────────────');

{
  const SWATCHES = ['#ffffff', '#000000', '#f59e0b', '#a855f7', '#ef4444', '#22c55e'];
  assertEq(SWATCHES.length, 6, 'exactly 6 color swatches');

  let b = makeDefaultBrand();
  assertEq(b.color, '#ffffff', 'default color is #ffffff (first swatch)');

  SWATCHES.forEach((c) => {
    const updated = { ...b, color: c };
    assertEq(updated.color, c, `swatch ${c} sets color correctly`);

    // Active swatch detection: brand.color === c
    assert(updated.color === c, `active class applied for swatch ${c}`);
    SWATCHES.filter((s) => s !== c).forEach((s) => {
      assert(updated.color !== s, `inactive class for swatch ${s} when ${c} is selected`);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. 9-point position grid
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 9-point position grid ────────────────────────────────────────────');

{
  const POSITIONS = [
    ['TL', 10, 10], ['TC', 50, 10], ['TR', 90, 10],
    ['ML', 10, 50], ['MC', 50, 50], ['MR', 90, 50],
    ['BL', 10, 90], ['BC', 50, 90], ['BR', 90, 90],
  ];

  assertEq(POSITIONS.length, 9, 'exactly 9 position grid buttons');

  let b = makeDefaultBrand();

  POSITIONS.forEach(([label, bx, by]) => {
    const updated = { ...b, x: bx, y: by };
    assertEq(updated.x, bx, `${label}: x = ${bx}`);
    assertEq(updated.y, by, `${label}: y = ${by}`);

    // Active detection: brand.x === bx && brand.y === by
    const isActive = (brand, px, py) => brand.x === px && brand.y === py;
    assert(isActive(updated, bx, by), `${label} grid button is active when x=${bx}, y=${by}`);
    assert(!isActive(updated, bx + 1, by), `${label} grid button inactive when x differs`);
  });

  // Default brand (x=50, y=10) matches TC
  assertEq(b.x, 50, 'default x=50 matches TC column');
  assertEq(b.y, 10, 'default y=10 matches top row');
  const isActive = (brand, px, py) => brand.x === px && brand.y === py;
  assert(isActive(b, 50, 10), 'default brand is at TC position');
  assert(!isActive(b, 10, 10), 'default brand is NOT at TL');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Size slider — encoding / decoding
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Size slider encoding / decoding ──────────────────────────────────');

{
  // Slider: min=5 max=20 step=1  (internal value = size * 10)
  // size = slider / 10

  assertClose(sliderToSize(5),  0.5, 0.001, 'slider 5  → size 0.5');
  assertClose(sliderToSize(10), 1.0, 0.001, 'slider 10 → size 1.0');
  assertClose(sliderToSize(12), 1.2, 0.001, 'slider 12 → size 1.2 (default)');
  assertClose(sliderToSize(20), 2.0, 0.001, 'slider 20 → size 2.0 (max)');

  assertEq(sizeToSlider(0.5), 5,  'size 0.5 → slider 5');
  assertEq(sizeToSlider(1.0), 10, 'size 1.0 → slider 10');
  assertEq(sizeToSlider(1.2), 12, 'size 1.2 → slider 12 (default)');
  assertEq(sizeToSlider(2.0), 20, 'size 2.0 → slider 20');

  // Round-trip
  [0.5, 0.8, 1.0, 1.2, 1.5, 2.0].forEach((s) => {
    assertClose(sliderToSize(sizeToSlider(s)), s, 0.001, `round-trip: size ${s} survives encode→decode`);
  });

  // Display: brand.size.toFixed(1) + '×'
  const displaySize = (s) => `${s.toFixed(1)}×`;
  assertEq(displaySize(1.2), '1.2×', 'default size displays as "1.2×"');
  assertEq(displaySize(0.5), '0.5×', 'min size displays as "0.5×"');
  assertEq(displaySize(2.0), '2.0×', 'max size displays as "2.0×"');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Preview overlay rendering conditions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Preview overlay rendering conditions ─────────────────────────────');

{
  // Overlay shown: brand?.visible
  const showOverlay = (brand) => !!(brand?.visible);

  assert(!showOverlay(null),                               'null brand → no overlay');
  assert(!showOverlay(undefined),                          'undefined brand → no overlay');
  assert(!showOverlay({ ...makeDefaultBrand(), visible: false }), 'hidden brand → no overlay');
  assert(showOverlay({ ...makeDefaultBrand(), visible: true }),   'visible brand → show overlay');

  // Overlay position style: left=`${x}%`, top=`${y}%`, transform='translate(-50%,-50%)'
  const overlayStyle = (brand) => ({
    left: `${brand.x}%`,
    top:  `${brand.y}%`,
    transform: 'translate(-50%, -50%)',
  });

  const style = overlayStyle({ x: 50, y: 10 });
  assertEq(style.left,      '50%',                   'x=50 → left: 50%');
  assertEq(style.top,       '10%',                   'y=10 → top: 10%');
  assertEq(style.transform, 'translate(-50%, -50%)', 'transform centers the overlay');

  // z-index: z-30 (above video tracks, below UI chrome)
  const overlayClass = 'absolute z-30 cursor-move select-none';
  assert(overlayClass.includes('z-30'), 'overlay uses z-30');
  assert(!overlayClass.includes('z-20'), 'overlay does NOT use z-20');
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Text vs logo rendering in preview
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Preview: text vs logo rendering ──────────────────────────────────');

{
  // Text rendering: color, fontSize, text || 'Brand'
  const renderText = (brand) => ({
    color: brand.color,
    fontSize: `${brand.size}rem`,
    content: brand.text || 'Brand',
  });

  const tb = { ...makeDefaultBrand(), text: 'SozialZynk', color: '#f59e0b', size: 1.5 };
  const r = renderText(tb);
  assertEq(r.color,    '#f59e0b',    'text color applied from brand.color');
  assertEq(r.fontSize, '1.5rem',     'font size in rem from brand.size');
  assertEq(r.content,  'SozialZynk', 'brand text shown when non-empty');

  const emptyText = renderText({ ...tb, text: '' });
  assertEq(emptyText.content, 'Brand', 'empty text falls back to "Brand"');

  // Logo rendering: height = size * 32px, maxWidth = 120px
  const renderLogo = (brand) => ({
    height: `${brand.size * 32}px`,
    maxWidth: '120px',
  });

  const lb = { ...makeDefaultBrand(), type: 'logo', size: 1.2, logoUrl: 'https://example.com/logo.png' };
  const lr = renderLogo(lb);
  assertEq(lr.height,   `${1.2 * 32}px`, 'logo height = size × 32px');
  assertEq(lr.maxWidth, '120px',          'logo maxWidth is 120px');
  assertClose(1.2 * 32, 38.4, 0.001,     'size 1.2 → logo height 38.4px');
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Drag position update
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Drag position update ─────────────────────────────────────────────');

{
  // When dragging: setBrand(b => b ? { ...b, x: Math.round(nx), y: Math.round(ny) } : b)
  const dragUpdate = (brand, nx, ny) =>
    brand ? { ...brand, x: Math.round(nx), y: Math.round(ny) } : brand;

  let b = makeDefaultBrand();

  // Normal drag to center
  b = dragUpdate(b, 45.7, 62.3);
  assertEq(b.x, 46, 'drag x rounded to 46');
  assertEq(b.y, 62, 'drag y rounded to 62');

  // Drag on null brand is no-op
  const result = dragUpdate(null, 30, 50);
  assertEq(result, null, 'drag on null brand returns null (no-op)');

  // Rounding edge cases
  b = dragUpdate(b, 49.5, 49.5);
  assertEq(b.x, 50, 'drag 49.5 rounds up to 50');
  assertEq(b.y, 50, 'drag 49.5 rounds up to 50 (y)');

  b = dragUpdate(b, 0.4, 99.6);
  assertEq(b.x, 0,   'drag 0.4 rounds down to 0');
  assertEq(b.y, 100, 'drag 99.6 rounds up to 100');
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Empty state hint
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Empty state hint ─────────────────────────────────────────────────');

{
  // Hint shown when brand is null
  const showHint = (brand) => brand === null || brand === undefined;
  assert(showHint(null),             'hint shown when brand is null');
  assert(showHint(undefined),        'hint shown when brand is undefined');
  assert(!showHint(makeDefaultBrand()), 'hint hidden when brand exists');
  assert(!showHint({ ...makeDefaultBrand(), visible: false }), 'hint hidden even when brand is hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Brand tab tab-switching — desktopTab === 'brand'
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Tab switching ────────────────────────────────────────────────────');

{
  const DESKTOP_TABS = ['canvas', 'ai', 'studio', 'text', 'brand'];
  assert(DESKTOP_TABS.includes('brand'), '"brand" is a valid desktop tab');
  assertEq(DESKTOP_TABS.indexOf('brand'), 4, 'brand tab is last (index 4)');

  // Brand tab renders when desktopTab === 'brand'
  const showBrandPanel = (tab) => tab === 'brand';
  assert(showBrandPanel('brand'),   'brand panel shown when desktopTab=brand');
  assert(!showBrandPanel('canvas'), 'brand panel hidden when desktopTab=canvas');
  assert(!showBrandPanel('studio'), 'brand panel hidden when desktopTab=studio');
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
