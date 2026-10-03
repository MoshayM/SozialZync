/**
 * Unit tests for copy/paste clipboard and layout preset logic.
 * Mirrors the exact expressions from the standalone editor page and Inspector.
 * Run: node apps/web/e2e/copy-paste-layout.test.mjs
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    kind: 'VIDEO',
    sourceAssetId: 'asset-1',
    timelineStartMs: 2000,
    timelineEndMs: 7000,
    properties: { volume: 1 },
    linkedItemId: undefined,
    ...overrides,
  };
}

function makeTimeline(items = [makeItem()]) {
  return {
    tracks: [{ id: 'track-1', kind: 'VIDEO', label: 'Video', items }],
    durationMs: 10000,
  };
}

// ── Copy logic ────────────────────────────────────────────────────────────────
// handleCopyItem: finds item by id in timeline and sets it as clipboard

function handleCopyItem(itemId, timeline) {
  const item = (timeline?.tracks ?? []).flatMap((t) => t.items ?? []).find((it) => it.id === itemId);
  return item ?? null;
}

console.log('\n── Copy ──────────────────────────────────────────────────────────');
{
  const tl = makeTimeline();
  const copied = handleCopyItem('item-1', tl);
  assert(copied !== null, 'copy returns the item');
  assert(copied.id === 'item-1', 'copied item has correct id');
  assert(copied.timelineStartMs === 2000, 'copied item has original startMs');
}

{
  const tl = makeTimeline();
  const copied = handleCopyItem('nonexistent', tl);
  assert(copied === null, 'copy of unknown id returns null');
}

{
  // Linked audio clips (linkedItemId set) should not be explicitly copied via handleCopyItem
  // The paste guard checks `!clipboard.linkedItemId`
  const linkedItem = makeItem({ id: 'linked-1', linkedItemId: 'video-1' });
  const tl = makeTimeline([makeItem(), linkedItem]);
  const copied = handleCopyItem('linked-1', tl);
  assert(copied !== null, 'can copy linked item (copy succeeds; paste guards it)');
  assert(!!copied.linkedItemId, 'copied item retains linkedItemId');
}

// ── Paste logic ───────────────────────────────────────────────────────────────
// handlePasteItem: creates clone with new id at playhead, inserts into matching track

function handlePasteItem(clipboard, playheadMs, timeline) {
  if (!clipboard) return timeline;
  const dur = clipboard.timelineEndMs - clipboard.timelineStartMs;
  const newItem = {
    ...clipboard,
    id: `paste-test`,
    timelineStartMs: playheadMs,
    timelineEndMs: playheadMs + dur,
  };
  const track = (timeline.tracks ?? []).find((t) => t.kind === clipboard.kind && !clipboard.linkedItemId);
  if (!track) return timeline;
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === track.id
        ? { ...t, items: [...(t.items ?? []), newItem].sort((a, b) => a.timelineStartMs - b.timelineStartMs) }
        : t,
    ),
  };
}

console.log('\n── Paste ─────────────────────────────────────────────────────────');
{
  const tl = makeTimeline();
  const clipboard = makeItem({ timelineStartMs: 2000, timelineEndMs: 7000 }); // 5s clip
  const after = handlePasteItem(clipboard, 3000, tl);
  const items = after.tracks[0].items;

  assert(items.length === 2, 'paste adds a second clip');
  const pasted = items.find((i) => i.id === 'paste-test');
  assert(pasted !== null, 'pasted item exists');
  assert(pasted.timelineStartMs === 3000, 'pasted clip starts at playhead');
  assert(pasted.timelineEndMs === 8000, 'pasted clip preserves original duration (5s)');
}

{
  // Paste with null clipboard is a no-op
  const tl = makeTimeline();
  const after = handlePasteItem(null, 3000, tl);
  assert(after.tracks[0].items.length === 1, 'paste with null clipboard is no-op');
}

{
  // Paste at time 0
  const tl = makeTimeline();
  const clipboard = makeItem({ timelineStartMs: 5000, timelineEndMs: 8000 }); // 3s
  const after = handlePasteItem(clipboard, 0, tl);
  const pasted = after.tracks[0].items.find((i) => i.id === 'paste-test');
  assert(pasted.timelineStartMs === 0, 'paste at time 0 works');
  assert(pasted.timelineEndMs === 3000, 'duration preserved at time 0');
}

{
  // Paste sorted correctly — earlier item first
  const tl = makeTimeline([makeItem({ id: 'existing', timelineStartMs: 5000, timelineEndMs: 10000 })]);
  const clipboard = makeItem({ timelineStartMs: 5000, timelineEndMs: 8000 });
  const after = handlePasteItem(clipboard, 0, tl);
  const items = after.tracks[0].items;
  assert(items[0].timelineStartMs === 0, 'pasted item sorted before existing (earlier start)');
  assert(items[1].timelineStartMs === 5000, 'existing item stays second');
}

{
  // Linked audio clips are not pasted (paste guard: !clipboard.linkedItemId)
  const tl = makeTimeline();
  const clipboard = makeItem({ linkedItemId: 'video-1' });
  const after = handlePasteItem(clipboard, 2000, tl);
  // track.find returns undefined because `!clipboard.linkedItemId` is false
  assert(after.tracks[0].items.length === 1, 'linked audio clips are not pasted');
}

// ── Layout preset active detection ────────────────────────────────────────────
// From Inspector JSX:
// Math.abs((props.x ?? 50) - preset.x) < 1 &&
// Math.abs((props.y ?? 50) - preset.y) < 1 &&
// Math.abs((props.scale ?? 1) - preset.scale) < 0.02

const LAYOUT_PRESETS = [
  { label: 'Full',      x: 50, y: 50, scale: 1    },
  { label: 'PiP ↗',   x: 80, y: 20, scale: 0.35  },
  { label: 'PiP ↘',   x: 80, y: 80, scale: 0.35  },
  { label: '← Left',   x: 25, y: 50, scale: 0.5   },
  { label: 'Right →',  x: 75, y: 50, scale: 0.5   },
  { label: 'Top ↑',    x: 50, y: 25, scale: 1     },
  { label: 'Bottom ↓', x: 50, y: 75, scale: 1     },
  { label: 'Overlay',  x: 50, y: 50, scale: 0.7   },
];

function isActivePreset(props, preset) {
  return (
    Math.abs((props.x ?? 50) - preset.x) < 1 &&
    Math.abs((props.y ?? 50) - preset.y) < 1 &&
    Math.abs((props.scale ?? 1) - preset.scale) < 0.02
  );
}

console.log('\n── Layout preset active detection ────────────────────────────────');

// Default props (no x/y/scale) → Full preset should be active
{
  const props = {};
  const active = LAYOUT_PRESETS.filter((p) => isActivePreset(props, p));
  assert(active.length === 1, 'exactly one preset active with default props');
  assert(active[0].label === 'Full', 'default props activate Full preset');
}

// Each preset's own values activate exactly itself
for (const preset of LAYOUT_PRESETS) {
  const props = { x: preset.x, y: preset.y, scale: preset.scale };
  const active = LAYOUT_PRESETS.filter((p) => isActivePreset(props, p));
  // Full and Overlay share x=50,y=50 — they differ only by scale, so only one should match
  assert(active.length === 1, `exactly one preset active when applying "${preset.label}"`);
  assert(active[0].label === preset.label, `"${preset.label}" preset correctly self-identifies`);
}

// Values between presets → no preset active
{
  const props = { x: 60, y: 40, scale: 0.8 };
  const active = LAYOUT_PRESETS.filter((p) => isActivePreset(props, p));
  assert(active.length === 0, 'mid-values between presets activate no preset');
}

// Tolerance boundary: within 0.99 of a preset's x → still active
{
  const full = LAYOUT_PRESETS.find((p) => p.label === 'Full');
  const props = { x: 50.99, y: 50.99, scale: 1.019 };
  assert(isActivePreset(props, full), 'values within tolerance still highlight Full preset');
}

// Tolerance boundary: exactly 1.0 away → NOT active (boundary is exclusive `< 1`)
{
  const full = LAYOUT_PRESETS.find((p) => p.label === 'Full');
  const props = { x: 51, y: 50, scale: 1 };
  assert(!isActivePreset(props, full), 'value exactly 1.0 away does not highlight preset');
}

// ── Copy then paste round-trip ─────────────────────────────────────────────────

console.log('\n── Copy → Paste round-trip ───────────────────────────────────────');
{
  const tl = makeTimeline([makeItem({ timelineStartMs: 1000, timelineEndMs: 4000 })]);
  const copied = handleCopyItem('item-1', tl);
  assert(copied !== null, 'copy succeeds');

  const after = handlePasteItem(copied, 6000, tl);
  const items = after.tracks[0].items;
  assert(items.length === 2, 'round-trip: 2 clips after copy+paste');

  const original = items.find((i) => i.id === 'item-1');
  const pasted   = items.find((i) => i.id === 'paste-test');
  assert(original.timelineStartMs === 1000, 'original unchanged');
  assert(pasted.timelineStartMs   === 6000, 'pasted at playhead');
  assert(pasted.timelineEndMs - pasted.timelineStartMs === original.timelineEndMs - original.timelineStartMs, 'duration preserved in round-trip');
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
