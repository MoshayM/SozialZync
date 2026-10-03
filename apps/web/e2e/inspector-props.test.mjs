/**
 * Unit tests for standalone editor inspector — speed presets and reverse toggle.
 * Mirrors the exact conditional expressions from the Inspector component.
 * Run: node apps/web/e2e/inspector-props.test.mjs
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

// ── Speed preset chip active logic ────────────────────────────────────────────
// From Inspector JSX: Math.abs((props.speed ?? 1) - s) < 0.01
function isActivePreset(speed, preset) {
  return Math.abs((speed ?? 1) - preset) < 0.01;
}

console.log('\n── Speed presets — active chip detection ─────────────────────────');

const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4];

// Default speed (undefined → 1): only 1× chip should be active
{
  const active = PRESETS.filter((s) => isActivePreset(undefined, s));
  assert(active.length === 1, 'exactly one preset active when speed is undefined');
  assert(active[0] === 1, 'default active preset is 1×');
}

// Each exact preset value activates exactly one chip
for (const preset of PRESETS) {
  const active = PRESETS.filter((s) => isActivePreset(preset, s));
  assert(active.length === 1, `exactly one chip active when speed = ${preset}`);
  assert(active[0] === preset, `correct chip active for speed ${preset}×`);
}

// Slider value 0.999 — within 0.01 of 1× so 1× chip stays active
{
  assert(isActivePreset(0.999, 1), 'speed 0.999 still highlights 1× chip (within tolerance)');
  assert(!isActivePreset(0.999, 0.75), 'speed 0.999 does not highlight 0.75× chip');
}

// Slider value 1.011 — outside 0.01 of any preset, so no chip is active
{
  const active = PRESETS.filter((s) => isActivePreset(1.011, s));
  assert(active.length === 0, 'speed 1.011 activates no preset chip (between presets)');
}

// setProp('speed', preset) — verify all preset values are valid (0.1–10 range from schema)
{
  const allInRange = PRESETS.every((s) => s >= 0.1 && s <= 10);
  assert(allInRange, 'all presets within schema speed range (0.1–10)');
}

// ── Reverse toggle logic ───────────────────────────────────────────────────────
// From Inspector JSX: setProp('reverse', !(props.reverse ?? false))
function toggleReverse(currentReverse) {
  return !(currentReverse ?? false);
}

console.log('\n── Reverse toggle ────────────────────────────────────────────────');

{
  assert(toggleReverse(undefined) === true,  'undefined → true (first toggle turns on)');
  assert(toggleReverse(false)     === true,  'false → true');
  assert(toggleReverse(true)      === false, 'true → false (toggle turns off)');
}

// Round-trip: two toggles returns to original
{
  const original = undefined;
  const once = toggleReverse(original);  // true
  const twice = toggleReverse(once);     // false
  assert(twice === false, 'two toggles from undefined returns false');

  const start = true;
  assert(toggleReverse(toggleReverse(start)) === start, 'two toggles from true is idempotent');
}

// Button label logic: props.reverse ? 'On' : 'Off'
{
  const label = (rev) => (rev ? 'On' : 'Off');
  assert(label(undefined) === 'Off', 'undefined shows Off');
  assert(label(false)     === 'Off', 'false shows Off');
  assert(label(true)      === 'On',  'true shows On');
}

// ── Speed + reverse interaction ───────────────────────────────────────────────
// Both are independent properties; changing one must not affect the other.

console.log('\n── Speed + reverse independence ──────────────────────────────────');
{
  // Simulate setting speed preset while reverse is on
  const propsA = { speed: 1, reverse: true };
  const afterSpeedChange = { ...propsA, speed: 2 };
  assert(afterSpeedChange.reverse === true, 'reverse unaffected after speed preset change');
  assert(afterSpeedChange.speed === 2, 'speed correctly updated');

  // Simulate toggling reverse while speed is custom
  const propsB = { speed: 1.5, reverse: false };
  const afterReverseToggle = { ...propsB, reverse: toggleReverse(propsB.reverse) };
  assert(afterReverseToggle.speed === 1.5, 'speed unaffected after reverse toggle');
  assert(afterReverseToggle.reverse === true, 'reverse correctly toggled');
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
