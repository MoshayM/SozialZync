/**
 * Unit-level test for split + merge logic in the re-edit page.
 * Mirrors the applyLocal() function exactly — no browser needed.
 * Run: node apps/web/e2e/editor-ops.test.mjs
 */

function clone(t) { return JSON.parse(JSON.stringify(t)); }

function applyLocal(tl, cmd) {
  const allItems = tl.tracks.flatMap((t) => t.items);
  const find = (id) => allItems.find((i) => i.id === id);

  switch (cmd.type) {
    case 'TRIM': {
      const item = find(cmd.itemId);
      if (!item) return;
      if (typeof item.properties?.sourceStartMs === 'number') {
        item.properties.sourceStartMs += cmd.newStartMs - item.startMs;
      }
      item.startMs = cmd.newStartMs;
      item.endMs = cmd.newEndMs;
      return;
    }
    case 'SPLIT': {
      const item = find(cmd.itemId);
      if (!item || cmd.atMs <= item.startMs || cmd.atMs >= item.endMs) return;
      const track = tl.tracks.find((t) => t.id === item.trackId);
      const right = {
        ...clone({ ...item, id: `tmp-split` }),
        startMs: cmd.atMs,
      };
      if (typeof right.properties?.sourceStartMs === 'number' &&
          typeof item.properties?.sourceStartMs === 'number') {
        right.properties.sourceStartMs = item.properties.sourceStartMs + (cmd.atMs - item.startMs);
      }
      item.endMs = cmd.atMs;
      track.items.push(right);
      track.items.sort((a, b) => a.startMs - b.startMs);
      return;
    }
    case 'DELETE': {
      for (const track of tl.tracks) track.items = track.items.filter((i) => i.id !== cmd.itemId);
      return;
    }
  }
}

function perform(tl, commands) {
  const next = clone(tl);
  for (const cmd of commands) applyLocal(next, cmd);
  return next;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function makeTimeline() {
  return {
    id: 'tl-1',
    tracks: [{
      id: 'track-1',
      type: 'VIDEO',
      orderIndex: 0,
      items: [{
        id: 'item-a',
        trackId: 'track-1',
        startMs: 0,
        endMs: 10000,
        properties: { sourceStartMs: 5000, sourceEndMs: 15000 },
        sourceAsset: null,
      }],
    }],
    captions: [],
  };
}

// ── Test: SPLIT ───────────────────────────────────────────────────────────────

console.log('\n── SPLIT ─────────────────────────────────────────────────────────');
{
  const tl = makeTimeline();
  const result = perform(tl, [{ type: 'SPLIT', itemId: 'item-a', atMs: 4000 }]);
  const items = result.tracks[0].items;

  assert(items.length === 2, 'produces 2 clips after split');
  assert(items[0].startMs === 0 && items[0].endMs === 4000, 'left half: 0–4000ms');
  assert(items[1].startMs === 4000 && items[1].endMs === 10000, 'right half: 4000–10000ms');
  assert(items[1].properties.sourceStartMs === 5000 + 4000, 'right half sourceStartMs offset correctly (9000)');
  assert(items[0].id === 'item-a', 'original item keeps its id');
  assert(items[1].id !== 'item-a', 'new right item gets a different id');
}

// Split at exact start — should be a no-op
{
  const tl = makeTimeline();
  const result = perform(tl, [{ type: 'SPLIT', itemId: 'item-a', atMs: 0 }]);
  assert(result.tracks[0].items.length === 1, 'split at startMs is no-op');
}

// Split at exact end — should be a no-op
{
  const tl = makeTimeline();
  const result = perform(tl, [{ type: 'SPLIT', itemId: 'item-a', atMs: 10000 }]);
  assert(result.tracks[0].items.length === 1, 'split at endMs is no-op');
}

// ── Test: MERGE (TRIM + DELETE) ────────────────────────────────────────────────

console.log('\n── MERGE (via TRIM + DELETE) ──────────────────────────────────────');
{
  // Start with two adjacent clips (the result of a split)
  const tl = makeTimeline();
  const afterSplit = perform(tl, [{ type: 'SPLIT', itemId: 'item-a', atMs: 4000 }]);
  const items = afterSplit.tracks[0].items;
  const leftId = items[0].id;
  const rightId = items[1].id;

  // Merge: extend left to cover right, then delete right
  const afterMerge = perform(afterSplit, [
    { type: 'TRIM', itemId: leftId, newStartMs: 0, newEndMs: 10000 },
    { type: 'DELETE', itemId: rightId },
  ]);

  const merged = afterMerge.tracks[0].items;
  assert(merged.length === 1, 'merge produces 1 clip');
  assert(merged[0].startMs === 0, 'merged clip starts at 0');
  assert(merged[0].endMs === 10000, 'merged clip ends at 10000');
  assert(merged[0].id === leftId, 'merged clip keeps left id');
}

// Merge two non-adjacent clips (simulating mergeWithAdjacent with a gap)
{
  const tl = {
    id: 'tl-2',
    tracks: [{
      id: 'track-1',
      type: 'VIDEO',
      orderIndex: 0,
      items: [
        { id: 'clip-1', trackId: 'track-1', startMs: 0,    endMs: 5000,  properties: null, sourceAsset: null },
        { id: 'clip-2', trackId: 'track-1', startMs: 5050, endMs: 10000, properties: null, sourceAsset: null },
      ],
    }],
    captions: [],
  };

  // clips are 50ms apart — within the 80ms tolerance in mergeWithAdjacent
  // simulate: TRIM clip-1 to cover clip-2.endMs, DELETE clip-2
  const result = perform(tl, [
    { type: 'TRIM', itemId: 'clip-1', newStartMs: 0, newEndMs: 10000 },
    { type: 'DELETE', itemId: 'clip-2' },
  ]);

  const items = result.tracks[0].items;
  assert(items.length === 1, 'near-adjacent clips merge to 1');
  assert(items[0].endMs === 10000, 'merged clip covers both ranges');
}

// ── Test: SPLIT then MERGE idempotency ────────────────────────────────────────

console.log('\n── SPLIT then MERGE (round-trip) ─────────────────────────────────');
{
  const tl = makeTimeline();
  const original = clone(tl);

  const afterSplit = perform(tl, [{ type: 'SPLIT', itemId: 'item-a', atMs: 6000 }]);
  const [left, right] = afterSplit.tracks[0].items;

  const restored = perform(afterSplit, [
    { type: 'TRIM', itemId: left.id, newStartMs: left.startMs, newEndMs: right.endMs },
    { type: 'DELETE', itemId: right.id },
  ]);

  const r = restored.tracks[0].items[0];
  const o = original.tracks[0].items[0];

  assert(r.startMs === o.startMs, `round-trip startMs matches (${r.startMs} === ${o.startMs})`);
  assert(r.endMs === o.endMs, `round-trip endMs matches (${r.endMs} === ${o.endMs})`);
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed ✓');
}
