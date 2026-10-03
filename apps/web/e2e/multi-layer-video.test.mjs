/**
 * Unit tests for multi-layer video playback logic.
 * Mirrors the exact expressions from SecondaryVideoPlayer, secondaryVidsRef,
 * the rAF tick sync block, and handleUpdateItemProps in the standalone editor.
 *
 * Run: node apps/web/e2e/multi-layer-video.test.mjs
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

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    kind: 'VIDEO',
    sourceAssetId: 'asset-1',
    timelineStartMs: 2000,
    timelineEndMs: 7000,
    sourceInMs: 0,
    properties: {},
    ...overrides,
  };
}

/** Mock HTMLVideoElement (minimal surface used by the rAF tick) */
function makeVideoEl(overrides = {}) {
  return {
    paused: true,
    currentTime: 0,
    playbackRate: 1,
    muted: false,
    played: 0,
    _playCount: 0,
    _pauseCount: 0,
    play() { this.paused = false; this._playCount++; return Promise.resolve(); },
    pause() { this.paused = true; this._pauseCount++; },
    ...overrides,
  };
}

/** Simulate one rAF tick — mirrors the secondary-video sync block in startPlay(). */
function tickSecondaryVideos(secondaryVidsRef, t) {
  for (const [, { el: sv, item: sItem }] of secondaryVidsRef) {
    if (t >= sItem.timelineStartMs && t < sItem.timelineEndMs) {
      const rate = sItem.properties?.speed ?? 1;
      if (sv.playbackRate !== rate) sv.playbackRate = rate;
      sv.muted = true;
      const sourceSec = Math.max(0, ((sItem.sourceInMs ?? 0) + (t - sItem.timelineStartMs) * rate) / 1000);
      if (Math.abs(sv.currentTime - sourceSec) > 0.5) sv.currentTime = sourceSec;
      if (sv.paused) sv.play();
    } else if (!sv.paused) {
      sv.pause();
    }
  }
}

// ── Registration logic ─────────────────────────────────────────────────────────
// mirrors handleRegisterSecondaryVideo

function makeRegistry() {
  return new Map();
}

function registerVideo(registry, itemId, el, item) {
  if (el) registry.set(itemId, { el, item });
  else registry.delete(itemId);
}

console.log('\n── Registration ──────────────────────────────────────────────────');
{
  const reg = makeRegistry();
  const el = makeVideoEl();
  const item = makeItem();

  registerVideo(reg, 'item-1', el, item);
  assert(reg.size === 1, 'register adds entry');
  assert(reg.get('item-1').el === el, 'registered el matches');
  assert(reg.get('item-1').item === item, 'registered item matches');

  registerVideo(reg, 'item-1', null, item);
  assert(reg.size === 0, 'unregister removes entry');
}

{
  const reg = makeRegistry();
  const el1 = makeVideoEl(), el2 = makeVideoEl();
  const it1 = makeItem({ id: 'a' }), it2 = makeItem({ id: 'b', timelineStartMs: 5000, timelineEndMs: 9000 });
  registerVideo(reg, 'a', el1, it1);
  registerVideo(reg, 'b', el2, it2);
  assert(reg.size === 2, 'two secondary layers registered independently');

  // Update item reference (timing change)
  const it1v2 = { ...it1, sourceInMs: 500 };
  registerVideo(reg, 'a', el1, it1v2);
  assert(reg.size === 2, 'update does not grow the map');
  assert(reg.get('a').item.sourceInMs === 500, 'updated item reference stored');
}

// ── rAF tick: play / pause logic ──────────────────────────────────────────────
console.log('\n── rAF tick — play / pause ───────────────────────────────────────');
{
  const reg = makeRegistry();
  const el = makeVideoEl();
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 7000 });
  registerVideo(reg, item.id, el, item);

  // t inside window → should play
  tickSecondaryVideos(reg, 3000);
  assert(!el.paused, 'video plays when t is inside item window');
  assert(el.muted === true, 'secondary layer is always muted');
  assert(el._playCount === 1, 'play() called once');
}

{
  const reg = makeRegistry();
  const el = makeVideoEl({ paused: false }); // already playing
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 7000 });
  registerVideo(reg, item.id, el, item);

  // t before window → should pause
  tickSecondaryVideos(reg, 1000);
  assert(el.paused, 'video paused when t is before item window');
  assert(el._pauseCount === 1, 'pause() called once');
}

{
  const reg = makeRegistry();
  const el = makeVideoEl({ paused: false });
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 7000 });
  registerVideo(reg, item.id, el, item);

  // t exactly at timelineEndMs → boundary is exclusive (< not <=), so pause
  tickSecondaryVideos(reg, 7000);
  assert(el.paused, 'video paused when t === timelineEndMs (exclusive boundary)');
}

{
  const reg = makeRegistry();
  const el = makeVideoEl({ paused: false });
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 7000 });
  registerVideo(reg, item.id, el, item);

  // t exactly at timelineStartMs → inclusive (>= ), so play
  tickSecondaryVideos(reg, 2000);
  assert(!el.paused, 'video plays when t === timelineStartMs (inclusive)');
}

// ── rAF tick: seek / drift correction ─────────────────────────────────────────
console.log('\n── rAF tick — seek / drift correction ────────────────────────────');
{
  const reg = makeRegistry();
  // sourceInMs=1000 means the video source starts 1 s in
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 8000, sourceInMs: 1000 });
  const el = makeVideoEl({ currentTime: 0 });
  registerVideo(reg, item.id, el, item);

  // At t=4000ms: elapsed on timeline = 2000ms; sourceSec = (1000 + 2000) / 1000 = 3.0
  tickSecondaryVideos(reg, 4000);
  // drift = |0 - 3.0| = 3.0 > 0.5 → should seek
  assert(Math.abs(el.currentTime - 3.0) < 0.001, 'seeks to correct source time (sourceInMs offset)');
}

{
  const reg = makeRegistry();
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 8000, sourceInMs: 0 });
  const el = makeVideoEl({ currentTime: 1.0 }); // already close (< 500ms drift)
  registerVideo(reg, item.id, el, item);

  // At t=3000ms: sourceSec = (0 + 1000) / 1000 = 1.0 — drift = |1.0 - 1.0| = 0 → no seek
  tickSecondaryVideos(reg, 3000);
  assert(el.currentTime === 1.0, 'does not seek when drift < 500 ms');
}

{
  const reg = makeRegistry();
  const item = makeItem({ timelineStartMs: 2000, timelineEndMs: 8000, sourceInMs: 0 });
  const el = makeVideoEl({ currentTime: 5.0 }); // 5 s drift
  registerVideo(reg, item.id, el, item);

  // At t=3000ms: sourceSec = 1.0 — drift = 4.0 > 0.5 → seek
  tickSecondaryVideos(reg, 3000);
  assert(el.currentTime === 1.0, 'seeks when drift exceeds 500 ms threshold');
}

// ── rAF tick: playback speed ───────────────────────────────────────────────────
console.log('\n── rAF tick — playback speed ─────────────────────────────────────');
{
  const reg = makeRegistry();
  const item = makeItem({ timelineStartMs: 0, timelineEndMs: 10000, sourceInMs: 0, properties: { speed: 2 } });
  const el = makeVideoEl({ currentTime: 0 });
  registerVideo(reg, item.id, el, item);

  tickSecondaryVideos(reg, 2000);
  assert(el.playbackRate === 2, 'playbackRate set to item speed (2×)');
  // sourceSec = (0 + 2000 * 2) / 1000 = 4.0
  assert(Math.abs(el.currentTime - 4.0) < 0.001, 'source time accounts for speed factor');
}

{
  const reg = makeRegistry();
  // No speed property → default 1×
  const item = makeItem({ timelineStartMs: 0, timelineEndMs: 10000, sourceInMs: 0 });
  const el = makeVideoEl();
  registerVideo(reg, item.id, el, item);

  tickSecondaryVideos(reg, 3000);
  assert(el.playbackRate === 1, 'default playbackRate is 1 when speed not set');
}

// ── Multiple secondary layers ──────────────────────────────────────────────────
console.log('\n── Multiple secondary layers ──────────────────────────────────────');
{
  const reg = makeRegistry();
  const elA = makeVideoEl(), elB = makeVideoEl({ paused: false });
  const itemA = makeItem({ id: 'a', timelineStartMs: 0, timelineEndMs: 5000, sourceInMs: 0 });
  const itemB = makeItem({ id: 'b', timelineStartMs: 6000, timelineEndMs: 10000, sourceInMs: 0 });
  registerVideo(reg, 'a', elA, itemA);
  registerVideo(reg, 'b', elB, itemB);

  // At t=3000: A is active, B is not yet
  tickSecondaryVideos(reg, 3000);
  assert(!elA.paused, 'layer A plays at t=3000');
  assert(elB.paused, 'layer B paused at t=3000 (not started yet)');

  // At t=8000: A ended, B is active
  elA.paused = false;
  tickSecondaryVideos(reg, 8000);
  assert(elA.paused, 'layer A paused at t=8000 (ended)');
  assert(!elB.paused, 'layer B plays at t=8000');
}

{
  // Two layers with overlapping time windows (PiP)
  const reg = makeRegistry();
  const elA = makeVideoEl(), elB = makeVideoEl();
  const itemA = makeItem({ id: 'a', timelineStartMs: 0, timelineEndMs: 10000, sourceInMs: 0 });
  const itemB = makeItem({ id: 'b', timelineStartMs: 0, timelineEndMs: 10000, sourceInMs: 0 });
  registerVideo(reg, 'a', elA, itemA);
  registerVideo(reg, 'b', elB, itemB);

  tickSecondaryVideos(reg, 5000);
  assert(!elA.paused, 'overlapping layer A plays simultaneously');
  assert(!elB.paused, 'overlapping layer B plays simultaneously');
  assert(elA.muted && elB.muted, 'both secondary layers are muted');
}

// ── handleUpdateItemProps logic ────────────────────────────────────────────────
// Mirrors the updateTimeline call in handleUpdateItemProps

function updateItemProps(tracks, itemId, updates) {
  return tracks.map((tr) => ({
    ...tr,
    items: (tr.items ?? []).map((it) =>
      it.id === itemId ? { ...it, properties: { ...(it.properties ?? {}), ...updates } } : it
    ),
  }));
}

console.log('\n── handleUpdateItemProps ─────────────────────────────────────────');
{
  const tracks = [
    { id: 't1', kind: 'VIDEO', items: [makeItem({ id: 'a', properties: { x: 50, y: 50, scale: 0.35 } })] },
    { id: 't2', kind: 'VIDEO', items: [makeItem({ id: 'b', properties: { x: 80, y: 20 } })] },
  ];

  const updated = updateItemProps(tracks, 'a', { x: 60, y: 40 });
  assert(updated[0].items[0].properties.x === 60, 'x updated on target item');
  assert(updated[0].items[0].properties.y === 40, 'y updated on target item');
  assert(updated[0].items[0].properties.scale === 0.35, 'scale unchanged on target item');
  assert(updated[1].items[0].properties.x === 80, 'other item untouched');
}

{
  // Scale update from corner drag
  const tracks = [
    { id: 't1', kind: 'VIDEO', items: [makeItem({ id: 'a', properties: { scale: 0.5 } })] },
  ];
  const updated = updateItemProps(tracks, 'a', { scale: 0.8 });
  assert(updated[0].items[0].properties.scale === 0.8, 'scale updated via drag');
}

{
  // Partial update merges with existing properties (does not wipe unrelated keys)
  const tracks = [
    { id: 't1', kind: 'VIDEO', items: [makeItem({ id: 'a', properties: { x: 50, y: 50, scale: 0.35, opacity: 0.7 } })] },
  ];
  const updated = updateItemProps(tracks, 'a', { x: 70 });
  const p = updated[0].items[0].properties;
  assert(p.x === 70, 'x updated');
  assert(p.y === 50, 'y preserved');
  assert(p.scale === 0.35, 'scale preserved');
  assert(p.opacity === 0.7, 'opacity preserved');
}

// ── Drag position clamping ─────────────────────────────────────────────────────
// Drag x/y are clamped to [0, 100]

function computeDragX(startXPct, dx) { return clamp(startXPct + dx, 0, 100); }
function computeDragY(startYPct, dy) { return clamp(startYPct + dy, 0, 100); }
function computeScale(startScale, dx) { return clamp(startScale + dx, 0.1, 1.5); }

console.log('\n── Drag clamping ─────────────────────────────────────────────────');
{
  assert(computeDragX(50, 30) === 80, 'x: normal drag right');
  assert(computeDragX(50, -40) === 10, 'x: normal drag left');
  assert(computeDragX(90, 20) === 100, 'x: clamped to 100 at right edge');
  assert(computeDragX(10, -20) === 0, 'x: clamped to 0 at left edge');

  assert(computeDragY(50, 30) === 80, 'y: normal drag down');
  assert(computeDragY(50, -60) === 0, 'y: clamped to 0 at top');
  assert(computeDragY(80, 30) === 100, 'y: clamped to 100 at bottom');

  assert(Math.abs(computeScale(0.35, 0.5) - 0.85) < 0.001, 'scale: normal grow');
  assert(Math.abs(computeScale(0.35, -0.5) - 0.1) < 0.001, 'scale: clamp at min 0.1');
  assert(computeScale(1.4, 0.5) === 1.5, 'scale: clamp at max 1.5');
  assert(computeScale(0.2, -0.5) === 0.1, 'scale: cannot go below 0.1');
}

// ── Source time floor ──────────────────────────────────────────────────────────
// Math.max(0, ...) ensures sourceSec never goes negative when t < timelineStartMs

console.log('\n── Source time floor ─────────────────────────────────────────────');
{
  const item = makeItem({ timelineStartMs: 3000, timelineEndMs: 8000, sourceInMs: 0 });
  // t=1000 < timelineStartMs → elapsed = -2000ms → unclamped sourceSec = -2.0
  const elapsed = 1000 - item.timelineStartMs; // -2000
  const sourceSec = Math.max(0, (item.sourceInMs + elapsed) / 1000);
  assert(sourceSec === 0, 'sourceSec clamped to 0 when t < timelineStartMs');
}

{
  const item = makeItem({ timelineStartMs: 0, timelineEndMs: 10000, sourceInMs: 500 });
  const t = 0;
  const sourceSec = Math.max(0, ((item.sourceInMs) + (t - item.timelineStartMs)) / 1000);
  assert(Math.abs(sourceSec - 0.5) < 0.001, 'sourceInMs offset applies at t=0');
}

// ── stopPlay: pause all secondary layers ───────────────────────────────────────

function stopPlay(secondaryVidsRef) {
  for (const [, { el: sv }] of secondaryVidsRef) {
    if (!sv.paused) sv.pause();
  }
}

console.log('\n── stopPlay pauses all secondary layers ──────────────────────────');
{
  const reg = makeRegistry();
  const elA = makeVideoEl({ paused: false });
  const elB = makeVideoEl({ paused: false });
  const elC = makeVideoEl({ paused: true }); // already paused
  registerVideo(reg, 'a', elA, makeItem({ id: 'a' }));
  registerVideo(reg, 'b', elB, makeItem({ id: 'b' }));
  registerVideo(reg, 'c', elC, makeItem({ id: 'c' }));

  stopPlay(reg);
  assert(elA.paused, 'layer A paused by stopPlay');
  assert(elB.paused, 'layer B paused by stopPlay');
  assert(elC._pauseCount === 0, 'already-paused layer C: pause() not called again');
}

// ── startPlay: trigger secondary in gesture context ────────────────────────────

function startPlaySecondary(secondaryVidsRef, currentTimeMs) {
  for (const [, { el: sv, item: sItem }] of secondaryVidsRef) {
    if (currentTimeMs >= sItem.timelineStartMs && currentTimeMs < sItem.timelineEndMs) {
      sv.muted = true;
      sv.play();
    }
  }
}

console.log('\n── startPlay: gesture-context secondary play ─────────────────────');
{
  const reg = makeRegistry();
  const elA = makeVideoEl(), elB = makeVideoEl();
  const itA = makeItem({ id: 'a', timelineStartMs: 0, timelineEndMs: 10000 });
  const itB = makeItem({ id: 'b', timelineStartMs: 8000, timelineEndMs: 15000 });
  registerVideo(reg, 'a', elA, itA);
  registerVideo(reg, 'b', elB, itB);

  // playhead at 3000 → only A is active
  startPlaySecondary(reg, 3000);
  assert(elA._playCount === 1, 'active layer A gets play() in gesture context');
  assert(elB._playCount === 0, 'inactive layer B does not get play() in gesture context');
  assert(elA.muted === true, 'secondary layer muted before play()');
}

{
  const reg = makeRegistry();
  const el = makeVideoEl();
  const item = makeItem({ id: 'a', timelineStartMs: 5000, timelineEndMs: 10000 });
  registerVideo(reg, 'a', el, item);

  // playhead at 0 → item not started → should NOT play
  startPlaySecondary(reg, 0);
  assert(el._playCount === 0, 'layer not triggered when playhead is before its window');
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
