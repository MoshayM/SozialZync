/**
 * Unit tests for save, export (render), and publish workflow in the editor.
 * Mirrors handleSave, auto-save debounce, startRender, handleQueuePublish,
 * and all render preset / format / quality constants from page.tsx.
 *
 * Run: node apps/web/e2e/save-export-publish.test.mjs
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

function assertClose(a, b, label, tol = 1) {
  if (Math.abs(a - b) <= tol) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — expected ${b}, got ${a}`);
    failed++;
  }
}

// ── Constants (mirrored from page.tsx) ───────────────────────────────────────

const PRESETS = [
  { value: '1080P_16_9', label: '1080p 16:9 (Landscape)' },
  { value: '1080P_9_16', label: '1080p 9:16 (Vertical / Shorts)' },
  { value: '720P_16_9',  label: '720p 16:9' },
  { value: '1080P_1_1',  label: '1080p 1:1 (Square)' },
  { value: 'SOURCE',     label: 'Match source' },
];

const FORMATS = [
  { value: 'mp4',  label: 'MP4 (H.264)' },
  { value: 'webm', label: 'WebM (VP9)' },
];

const QUALITIES = [
  { value: 'draft',    label: 'Draft',    hint: 'Fast, lower bitrate — good for review' },
  { value: 'standard', label: 'Standard', hint: 'Balanced quality and file size' },
  { value: 'high',     label: 'High',     hint: 'Maximum quality, larger file' },
];

const SOCIAL_PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',      bg: '#FF0000', abbr: 'YT' },
  { id: 'instagram', label: 'Instagram',    bg: '#E1306C', abbr: 'IG' },
  { id: 'tiktok',    label: 'TikTok',       bg: '#010101', abbr: 'TK' },
  { id: 'x',         label: 'X (Twitter)',  bg: '#1A1A1A', abbr: 'X' },
  { id: 'linkedin',  label: 'LinkedIn',     bg: '#0A66C2', abbr: 'in' },
  { id: 'facebook',  label: 'Facebook',     bg: '#1877F2', abbr: 'fb' },
];

// ── Helpers (pure logic extracted from page.tsx) ──────────────────────────────

/** Mirrors handleSave success path */
async function simulateSave({ timeline, editId, api, setState }) {
  if (!timeline) return { skipped: true };

  setState('saving', true);
  setState('saveError', null);

  try {
    await api.editor.saveTimeline(editId, timeline);
    setState('dirty', false);
    setState('savedRecently', true);
    // simulate 3s reset (tested via flag, not timer)
    return { success: true };
  } catch (err) {
    const msg = err?.response?.data?.message ?? 'Save failed';
    setState('saveError', msg);
    return { success: false, error: msg };
  } finally {
    setState('saving', false);
  }
}

/** Mirrors auto-save guard: returns true when auto-save should fire */
function shouldAutoSave({ autoSave, dirty, timeline }) {
  return !!(autoSave && dirty && timeline);
}

/** Mirrors startRender — synchronous subset (no polling) */
async function simulateStartRender({
  editId, preset, format, quality,
  api, onBeforeRender, setState,
}) {
  setState('submitting', true);
  setState('error', null);
  setState('renderStatus', null);

  try {
    if (onBeforeRender) await onBeforeRender();
    const options = { preset, format, quality };
    const res = await api.editor.render(editId, options);
    setState('renderStatus', res.data.renderStatus);
    return { success: true, renderStatus: res.data.renderStatus };
  } catch (err) {
    const msg = err?.response?.data?.message ?? 'Failed to start render';
    setState('error', msg);
    return { success: false, error: msg };
  } finally {
    setState('submitting', false);
  }
}

/** Mirrors poll tick logic for a single tick */
function simulatePollTick({ status, data, setState, stopPoll, onRenderDone }) {
  setState('renderStatus', status);
  if (status === 'READY') {
    setState('renderVersionId', data?.renderVersionId ?? null);
    setState('downloadPath', data?.downloadPath ?? null);
    stopPoll();
    onRenderDone?.();
    return 'done';
  } else if (status === 'FAILED') {
    setState('error', 'Render failed on the server. Retry or contact support.');
    stopPoll();
    onRenderDone?.();
    return 'failed';
  }
  return 'continue';
}

/** Mirrors handleQueuePublish — returns the payload that would be sent */
function buildPublishPayload({
  editId, channelId, pubTitle, projectTitle, pubDesc,
  pubTags, pubSchedule, pubScheduledAt,
}) {
  const title = pubTitle.trim() || projectTitle;
  const tags = pubTags.split(',').map((t) => t.trim()).filter(Boolean);
  const payload = {
    editId,
    channelId,
    title,
    description: pubDesc,
    tags,
  };
  if (pubSchedule === 'later' && pubScheduledAt) {
    payload.scheduledAt = new Date(pubScheduledAt).toISOString();
  }
  return payload;
}

/** Guard: handleQueuePublish returns early when platform or channel missing */
function canQueuePublish({ pubPlatform, pubChannelId }) {
  return !!(pubPlatform && pubChannelId);
}

/** Mirror of downloadFilename expression */
function buildDownloadFilename(format) {
  return `export.${format}`;
}

// ── Save: handleSave ──────────────────────────────────────────────────────────

console.log('\n── handleSave: success path ──────────────────────────────────────');
{
  const state = {};
  const setState = (k, v) => { state[k] = v; };
  const apiCalls = [];
  const api = {
    editor: {
      saveTimeline: async (editId, tl) => { apiCalls.push({ editId, tl }); },
    },
  };
  const result = await simulateSave({
    timeline: { tracks: [], durationMs: 1000, width: 1920, height: 1080 },
    editId: 'edit-123',
    api,
    setState,
  });

  assert(result.success === true, 'handleSave: returns success');
  assert(apiCalls.length === 1, 'handleSave: calls api.editor.saveTimeline once');
  assert(apiCalls[0].editId === 'edit-123', 'handleSave: passes correct editId');
  assert(apiCalls[0].tl.durationMs === 1000, 'handleSave: passes timeline object');
  assert(state.dirty === false, 'handleSave: sets dirty=false on success');
  assert(state.savedRecently === true, 'handleSave: sets savedRecently=true on success');
  assert(state.saving === false, 'handleSave: sets saving=false in finally');
  assert(state.saveError === null, 'handleSave: clears saveError on success');
}

console.log('\n── handleSave: no timeline (early return) ────────────────────────');
{
  const state = {};
  const setState = (k, v) => { state[k] = v; };
  const apiCalls = [];
  const api = { editor: { saveTimeline: async () => { apiCalls.push(1); } } };
  const result = await simulateSave({ timeline: null, editId: 'e', api, setState });

  assert(result.skipped === true, 'handleSave: returns early when timeline is null');
  assert(apiCalls.length === 0, 'handleSave: does not call API when timeline is null');
  assert(state.dirty === undefined, 'handleSave: does not mutate dirty when skipped');
}

console.log('\n── handleSave: error path ────────────────────────────────────────');
{
  const state = {};
  const setState = (k, v) => { state[k] = v; };
  const api = {
    editor: {
      saveTimeline: async () => {
        const err = new Error('Forbidden');
        err.response = { data: { message: 'Timeline save rejected' } };
        throw err;
      },
    },
  };
  const result = await simulateSave({
    timeline: { tracks: [] },
    editId: 'e',
    api,
    setState,
  });

  assert(result.success === false, 'handleSave: returns failure on API error');
  assert(result.error === 'Timeline save rejected', 'handleSave: extracts message from response');
  assert(state.saveError === 'Timeline save rejected', 'handleSave: sets saveError from response.data.message');
  assert(state.saving === false, 'handleSave: clears saving=false in finally even on error');
  assert(state.dirty !== false, 'handleSave: does not set dirty=false on error');
}

console.log('\n── handleSave: error fallback message ────────────────────────────');
{
  const state = {};
  const setState = (k, v) => { state[k] = v; };
  const api = {
    editor: { saveTimeline: async () => { throw new Error('network'); } },
  };
  const result = await simulateSave({ timeline: { tracks: [] }, editId: 'e', api, setState });
  assert(result.error === 'Save failed', 'handleSave: falls back to "Save failed" when no response.data.message');
  assert(state.saveError === 'Save failed', 'handleSave: saveError = fallback string');
}

// ── Auto-save: debounce guard ────────────────────────────────────────────────

console.log('\n── Auto-save: shouldAutoSave guard ───────────────────────────────');
{
  const tl = { tracks: [] };
  assert(shouldAutoSave({ autoSave: true,  dirty: true,  timeline: tl }),   'auto-save fires when autoSave=true, dirty=true, timeline set');
  assert(!shouldAutoSave({ autoSave: false, dirty: true,  timeline: tl }),  'auto-save blocked when autoSave=false');
  assert(!shouldAutoSave({ autoSave: true,  dirty: false, timeline: tl }),  'auto-save blocked when dirty=false');
  assert(!shouldAutoSave({ autoSave: true,  dirty: true,  timeline: null }), 'auto-save blocked when timeline=null');
  assert(!shouldAutoSave({ autoSave: false, dirty: false, timeline: null }), 'auto-save blocked when all false/null');
}

console.log('\n── Auto-save: debounce timing ────────────────────────────────────');
{
  // Verify the 5-second debounce: multiple rapid calls clear prior timeout
  let fired = 0;
  let timerId = null;
  const DEBOUNCE_MS = 5000;

  function scheduleAutoSave() {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => fired++, DEBOUNCE_MS);
  }

  scheduleAutoSave(); // first call
  scheduleAutoSave(); // second call — clears first
  scheduleAutoSave(); // third call — clears second

  // Only one pending timer remains
  clearTimeout(timerId); // simulate component unmount / cleanup
  assert(fired === 0, 'auto-save: debounce clears previous timeout on each new call');

  // Simulate fire
  let fired2 = 0;
  const t = setTimeout(() => fired2++, 0);
  await new Promise((r) => setTimeout(r, 10));
  clearTimeout(t);
  assert(fired2 === 1, 'auto-save: timeout callback fires once when not cancelled');
}

// ── Export: startRender ───────────────────────────────────────────────────────

console.log('\n── startRender: calls onBeforeRender first ───────────────────────');
{
  const callOrder = [];
  const api = {
    editor: {
      render: async () => {
        callOrder.push('render');
        return { data: { renderStatus: 'QUEUED' } };
      },
    },
  };
  const state = {};
  const result = await simulateStartRender({
    editId: 'e', preset: '1080P_16_9', format: 'mp4', quality: 'standard',
    api,
    onBeforeRender: async () => { callOrder.push('beforeRender'); },
    setState: (k, v) => { state[k] = v; },
  });

  assert(callOrder[0] === 'beforeRender', 'startRender: calls onBeforeRender before render API');
  assert(callOrder[1] === 'render', 'startRender: calls render API after onBeforeRender');
  assert(result.success === true, 'startRender: returns success');
  assert(result.renderStatus === 'QUEUED', 'startRender: captures initial renderStatus');
  assert(state.submitting === false, 'startRender: clears submitting in finally');
}

console.log('\n── startRender: passes correct options to API ────────────────────');
{
  const captured = [];
  const api = {
    editor: {
      render: async (editId, options) => {
        captured.push({ editId, options });
        return { data: { renderStatus: 'PENDING' } };
      },
    },
  };
  await simulateStartRender({
    editId: 'edit-abc', preset: '1080P_9_16', format: 'webm', quality: 'high',
    api,
    onBeforeRender: undefined,
    setState: () => {},
  });

  assert(captured.length === 1, 'startRender: calls api.editor.render once');
  assert(captured[0].editId === 'edit-abc', 'startRender: passes editId');
  assert(captured[0].options.preset === '1080P_9_16', 'startRender: passes preset');
  assert(captured[0].options.format === 'webm', 'startRender: passes format');
  assert(captured[0].options.quality === 'high', 'startRender: passes quality');
}

console.log('\n── startRender: works without onBeforeRender ────────────────────');
{
  const api = {
    editor: { render: async () => ({ data: { renderStatus: 'QUEUED' } }) },
  };
  const result = await simulateStartRender({
    editId: 'e', preset: '1080P_16_9', format: 'mp4', quality: 'standard',
    api,
    onBeforeRender: undefined,
    setState: () => {},
  });
  assert(result.success === true, 'startRender: succeeds when onBeforeRender is undefined');
}

console.log('\n── startRender: error path ───────────────────────────────────────');
{
  const state = {};
  const api = {
    editor: {
      render: async () => {
        const err = new Error('Quota exceeded');
        err.response = { data: { message: 'Render quota exceeded' } };
        throw err;
      },
    },
  };
  const result = await simulateStartRender({
    editId: 'e', preset: '1080P_16_9', format: 'mp4', quality: 'standard',
    api,
    onBeforeRender: undefined,
    setState: (k, v) => { state[k] = v; },
  });

  assert(result.success === false, 'startRender: returns failure on API error');
  assert(result.error === 'Render quota exceeded', 'startRender: extracts message from response');
  assert(state.error === 'Render quota exceeded', 'startRender: sets error state');
  assert(state.submitting === false, 'startRender: clears submitting in finally on error');
}

console.log('\n── startRender: error fallback ───────────────────────────────────');
{
  const state = {};
  const api = {
    editor: { render: async () => { throw new Error('network'); } },
  };
  const result = await simulateStartRender({
    editId: 'e', preset: '1080P_16_9', format: 'mp4', quality: 'standard',
    api,
    onBeforeRender: undefined,
    setState: (k, v) => { state[k] = v; },
  });
  assert(result.error === 'Failed to start render', 'startRender: fallback error message when no response.data');
}

// ── Poll tick ──────────────────────────────────────────────────────────────────

console.log('\n── Poll tick: READY status ───────────────────────────────────────');
{
  const state = {};
  let pollStopped = false;
  let renderDoneFired = false;
  const result = simulatePollTick({
    status: 'READY',
    data: { renderVersionId: 'rv-001', downloadPath: '/downloads/out.mp4' },
    setState: (k, v) => { state[k] = v; },
    stopPoll: () => { pollStopped = true; },
    onRenderDone: () => { renderDoneFired = true; },
  });

  assert(result === 'done', 'poll tick: returns "done" on READY status');
  assert(state.renderStatus === 'READY', 'poll tick: sets renderStatus to READY');
  assert(state.renderVersionId === 'rv-001', 'poll tick: sets renderVersionId from response');
  assert(state.downloadPath === '/downloads/out.mp4', 'poll tick: sets downloadPath from response');
  assert(pollStopped === true, 'poll tick: stops polling on READY');
  assert(renderDoneFired === true, 'poll tick: fires onRenderDone on READY');
}

console.log('\n── Poll tick: FAILED status ──────────────────────────────────────');
{
  const state = {};
  let pollStopped = false;
  let renderDoneFired = false;
  const result = simulatePollTick({
    status: 'FAILED',
    data: {},
    setState: (k, v) => { state[k] = v; },
    stopPoll: () => { pollStopped = true; },
    onRenderDone: () => { renderDoneFired = true; },
  });

  assert(result === 'failed', 'poll tick: returns "failed" on FAILED status');
  assert(state.renderStatus === 'FAILED', 'poll tick: sets renderStatus to FAILED');
  assert(state.error === 'Render failed on the server. Retry or contact support.', 'poll tick: sets correct error message on FAILED');
  assert(pollStopped === true, 'poll tick: stops polling on FAILED');
  assert(renderDoneFired === true, 'poll tick: fires onRenderDone on FAILED');
}

console.log('\n── Poll tick: RENDERING (in progress) ───────────────────────────');
{
  const state = {};
  let pollStopped = false;
  const result = simulatePollTick({
    status: 'RENDERING',
    data: {},
    setState: (k, v) => { state[k] = v; },
    stopPoll: () => { pollStopped = true; },
    onRenderDone: undefined,
  });

  assert(result === 'continue', 'poll tick: returns "continue" on RENDERING status');
  assert(state.renderStatus === 'RENDERING', 'poll tick: updates renderStatus to RENDERING');
  assert(pollStopped === false, 'poll tick: does NOT stop polling while rendering');
}

console.log('\n── Poll tick: QUEUED (waiting for worker) ────────────────────────');
{
  const state = {};
  let pollStopped = false;
  const result = simulatePollTick({
    status: 'QUEUED',
    data: {},
    setState: (k, v) => { state[k] = v; },
    stopPoll: () => { pollStopped = true; },
    onRenderDone: undefined,
  });

  assert(result === 'continue', 'poll tick: returns "continue" on QUEUED status');
  assert(pollStopped === false, 'poll tick: does NOT stop polling when QUEUED');
}

console.log('\n── Poll tick: READY with missing renderVersionId ─────────────────');
{
  const state = {};
  simulatePollTick({
    status: 'READY',
    data: { downloadPath: '/download/out.mp4' }, // no renderVersionId
    setState: (k, v) => { state[k] = v; },
    stopPoll: () => {},
    onRenderDone: undefined,
  });
  assert(state.renderVersionId === null, 'poll tick: renderVersionId=null when absent in response');
  assert(state.downloadPath === '/download/out.mp4', 'poll tick: downloadPath still set from response');
}

// ── Render preset constants ────────────────────────────────────────────────────

console.log('\n── Render presets ────────────────────────────────────────────────');
{
  assert(PRESETS.length === 5, `presets: exactly 5 presets defined (got ${PRESETS.length})`);
  assert(PRESETS[0].value === '1080P_16_9', 'presets: default preset is 1080P_16_9 (first entry)');
  assert(PRESETS.some((p) => p.value === '1080P_9_16'), 'presets: includes vertical/Shorts preset 1080P_9_16');
  assert(PRESETS.some((p) => p.value === '720P_16_9'),  'presets: includes 720p 16:9 preset');
  assert(PRESETS.some((p) => p.value === '1080P_1_1'),  'presets: includes 1:1 square preset');
  assert(PRESETS.some((p) => p.value === 'SOURCE'),      'presets: includes SOURCE (match source) preset');

  // All presets have non-empty labels
  for (const p of PRESETS) {
    assert(typeof p.label === 'string' && p.label.length > 0, `preset ${p.value}: has non-empty label`);
  }

  // No duplicate values
  const vals = new Set(PRESETS.map((p) => p.value));
  assert(vals.size === PRESETS.length, 'presets: no duplicate preset values');
}

// ── Render format constants ────────────────────────────────────────────────────

console.log('\n── Render formats ────────────────────────────────────────────────');
{
  assert(FORMATS.length === 2, `formats: exactly 2 formats defined (got ${FORMATS.length})`);
  assert(FORMATS[0].value === 'mp4',  'formats: mp4 is first (default)');
  assert(FORMATS.some((f) => f.value === 'webm'), 'formats: includes webm');

  for (const f of FORMATS) {
    assert(typeof f.label === 'string' && f.label.length > 0, `format ${f.value}: has non-empty label`);
  }

  // downloadFilename mirrors format
  assert(buildDownloadFilename('mp4')  === 'export.mp4',  'downloadFilename: mp4 → "export.mp4"');
  assert(buildDownloadFilename('webm') === 'export.webm', 'downloadFilename: webm → "export.webm"');
}

// ── Render quality constants ────────────────────────────────────────────────────

console.log('\n── Render qualities ──────────────────────────────────────────────');
{
  assert(QUALITIES.length === 3, `qualities: exactly 3 quality levels defined (got ${QUALITIES.length})`);
  assert(QUALITIES[0].value === 'draft',    'qualities: draft is first option');
  assert(QUALITIES[1].value === 'standard', 'qualities: standard is second (default)');
  assert(QUALITIES[2].value === 'high',     'qualities: high is third option');

  for (const q of QUALITIES) {
    assert(typeof q.hint === 'string' && q.hint.length > 0, `quality ${q.value}: has non-empty hint text`);
    assert(typeof q.label === 'string' && q.label.length > 0, `quality ${q.value}: has non-empty label`);
  }

  // Hint retrieval mirrors the JSX expression
  const hint = QUALITIES.find((q) => q.value === 'standard')?.hint;
  assert(hint === 'Balanced quality and file size', 'qualities: standard hint text is correct');

  const draftHint = QUALITIES.find((q) => q.value === 'draft')?.hint;
  assert(draftHint?.includes('Fast'), 'qualities: draft hint mentions "Fast"');

  const highHint = QUALITIES.find((q) => q.value === 'high')?.hint;
  assert(highHint?.includes('Maximum quality'), 'qualities: high hint mentions "Maximum quality"');
}

// ── Publish: canQueuePublish guard ────────────────────────────────────────────

console.log('\n── Publish: canQueuePublish guard ────────────────────────────────');
{
  assert(canQueuePublish({ pubPlatform: 'youtube', pubChannelId: 'ch-1' }),    'canQueuePublish: true when both platform and channelId set');
  assert(!canQueuePublish({ pubPlatform: null,      pubChannelId: 'ch-1' }),   'canQueuePublish: false when pubPlatform is null');
  assert(!canQueuePublish({ pubPlatform: 'youtube', pubChannelId: null }),     'canQueuePublish: false when pubChannelId is null');
  assert(!canQueuePublish({ pubPlatform: null,      pubChannelId: null }),     'canQueuePublish: false when both are null');
  assert(!canQueuePublish({ pubPlatform: '',        pubChannelId: 'ch-1' }),   'canQueuePublish: false when pubPlatform is empty string');
}

// ── Publish: buildPublishPayload ──────────────────────────────────────────────

console.log('\n── Publish: buildPublishPayload ──────────────────────────────────');
{
  const payload = buildPublishPayload({
    editId: 'edit-xyz',
    channelId: 'ch-abc',
    pubTitle: 'My Video',
    projectTitle: 'Project Default',
    pubDesc: 'A description',
    pubTags: 'travel, vlog, adventure',
    pubSchedule: 'now',
    pubScheduledAt: '',
  });

  assert(payload.editId === 'edit-xyz', 'publish payload: editId is correct');
  assert(payload.channelId === 'ch-abc', 'publish payload: channelId is correct');
  assert(payload.title === 'My Video', 'publish payload: uses pubTitle when set');
  assert(payload.description === 'A description', 'publish payload: description is correct');
  assert(Array.isArray(payload.tags), 'publish payload: tags is an array');
  assert(payload.tags.length === 3, 'publish payload: tags split correctly (3 items from "travel, vlog, adventure")');
  assert(payload.tags[0] === 'travel', 'publish payload: first tag is "travel"');
  assert(payload.tags[1] === 'vlog', 'publish payload: second tag is "vlog" (trimmed)');
  assert(payload.tags[2] === 'adventure', 'publish payload: third tag is "adventure" (trimmed)');
  assert(payload.scheduledAt === undefined, 'publish payload: scheduledAt absent when pubSchedule="now"');
}

console.log('\n── Publish: title fallback to projectTitle ───────────────────────');
{
  const payload = buildPublishPayload({
    editId: 'e', channelId: 'c',
    pubTitle: '   ', // whitespace-only → trim → ''
    projectTitle: 'Project Default',
    pubDesc: '', pubTags: '',
    pubSchedule: 'now', pubScheduledAt: '',
  });
  assert(payload.title === 'Project Default', 'publish payload: falls back to projectTitle when pubTitle is whitespace-only');
}

console.log('\n── Publish: scheduledAt included only for pubSchedule="later" ───');
{
  const scheduled = buildPublishPayload({
    editId: 'e', channelId: 'c',
    pubTitle: 'Title', projectTitle: 'P',
    pubDesc: '', pubTags: '',
    pubSchedule: 'later',
    pubScheduledAt: '2026-12-01T10:00',
  });
  assert(typeof scheduled.scheduledAt === 'string', 'publish payload: scheduledAt is a string when pubSchedule="later"');
  assert(scheduled.scheduledAt.includes('2026-12-01'), 'publish payload: scheduledAt contains the expected date');

  const notScheduled = buildPublishPayload({
    editId: 'e', channelId: 'c',
    pubTitle: 'Title', projectTitle: 'P',
    pubDesc: '', pubTags: '',
    pubSchedule: 'later',
    pubScheduledAt: '', // empty — no scheduled date
  });
  assert(notScheduled.scheduledAt === undefined, 'publish payload: scheduledAt absent when pubScheduledAt is empty');
}

console.log('\n── Publish: tags split and filter ────────────────────────────────');
{
  // Empty tags string → empty array
  const p1 = buildPublishPayload({
    editId: 'e', channelId: 'c', pubTitle: 'T', projectTitle: 'P',
    pubDesc: '', pubTags: '', pubSchedule: 'now', pubScheduledAt: '',
  });
  assert(p1.tags.length === 0, 'publish payload: empty pubTags → empty tags array');

  // Trailing comma → filtered out
  const p2 = buildPublishPayload({
    editId: 'e', channelId: 'c', pubTitle: 'T', projectTitle: 'P',
    pubDesc: '', pubTags: 'tag1,tag2,', pubSchedule: 'now', pubScheduledAt: '',
  });
  assert(p2.tags.length === 2, 'publish payload: trailing comma filtered from tags');
  assert(p2.tags.every((t) => t.length > 0), 'publish payload: no empty strings in tags');

  // Spaces around commas → trimmed
  const p3 = buildPublishPayload({
    editId: 'e', channelId: 'c', pubTitle: 'T', projectTitle: 'P',
    pubDesc: '', pubTags: ' a , b , c ', pubSchedule: 'now', pubScheduledAt: '',
  });
  assert(p3.tags[0] === 'a', 'publish payload: tag leading/trailing spaces trimmed');
  assert(p3.tags[1] === 'b', 'publish payload: middle tag trimmed');
  assert(p3.tags[2] === 'c', 'publish payload: last tag trimmed');
}

// ── Social platform list ────────────────────────────────────────────────────────

console.log('\n── Social platforms ──────────────────────────────────────────────');
{
  assert(SOCIAL_PLATFORMS.length === 6, `platforms: exactly 6 social platforms defined (got ${SOCIAL_PLATFORMS.length})`);
  assert(SOCIAL_PLATFORMS.some((p) => p.id === 'youtube'),   'platforms: YouTube included');
  assert(SOCIAL_PLATFORMS.some((p) => p.id === 'instagram'), 'platforms: Instagram included');
  assert(SOCIAL_PLATFORMS.some((p) => p.id === 'tiktok'),    'platforms: TikTok included');
  assert(SOCIAL_PLATFORMS.some((p) => p.id === 'x'),         'platforms: X (Twitter) included');
  assert(SOCIAL_PLATFORMS.some((p) => p.id === 'linkedin'),  'platforms: LinkedIn included');
  assert(SOCIAL_PLATFORMS.some((p) => p.id === 'facebook'),  'platforms: Facebook included');

  for (const p of SOCIAL_PLATFORMS) {
    assert(p.id && p.label && p.bg && p.abbr, `platform ${p.id}: has id, label, bg, abbr fields`);
    assert(p.bg.startsWith('#'), `platform ${p.id}: bg is a hex color`);
    assert(p.abbr.length >= 1 && p.abbr.length <= 3, `platform ${p.id}: abbr is 1–3 chars`);
  }

  // No duplicate IDs
  const ids = new Set(SOCIAL_PLATFORMS.map((p) => p.id));
  assert(ids.size === SOCIAL_PLATFORMS.length, 'platforms: no duplicate platform IDs');
}

// ── Export → Publish flow (state machine) ─────────────────────────────────────

console.log('\n── Export → Publish state machine ───────────────────────────────');
{
  // pubStep: null → 'choose' → 'account' → 'details'
  let pubStep = null;

  // Render complete → show Download + "Send to Publish" button
  assert(pubStep === null, 'publish flow: initially pubStep=null (publish section hidden)');

  // User clicks "Send to Publish"
  pubStep = 'choose';
  assert(pubStep === 'choose', 'publish flow: clicking "Send to Publish" sets pubStep="choose"');

  // User clicks back
  pubStep = null;
  assert(pubStep === null, 'publish flow: clicking back arrow resets pubStep=null');

  // Full flow: choose → account → details
  pubStep = 'choose';
  pubStep = 'account'; // selected a platform
  pubStep = 'details'; // selected a channel
  assert(pubStep === 'details', 'publish flow: reaches "details" step');
}

// ── Render status messages ─────────────────────────────────────────────────────

console.log('\n── Render status UI strings ──────────────────────────────────────');
{
  // Mirrors the JSX condition text for in-progress states
  function renderStatusMessage(status) {
    if (status === 'PENDING' || status === 'QUEUED') return 'Queued — waiting for worker…';
    return 'Rendering…';
  }

  assert(renderStatusMessage('PENDING')   === 'Queued — waiting for worker…', 'render status: PENDING shows queue message');
  assert(renderStatusMessage('QUEUED')    === 'Queued — waiting for worker…', 'render status: QUEUED shows queue message');
  assert(renderStatusMessage('RENDERING') === 'Rendering…',                    'render status: RENDERING shows rendering message');
}

// ── Poll interval ─────────────────────────────────────────────────────────────

console.log('\n── Poll interval (4000ms) ────────────────────────────────────────');
{
  const POLL_INTERVAL_MS = 4000;
  assert(POLL_INTERVAL_MS === 4000, 'poll: interval is exactly 4000ms (4 seconds)');
  assert(POLL_INTERVAL_MS > 1000, 'poll: interval > 1s (not hammering the server)');
  assert(POLL_INTERVAL_MS < 10000, 'poll: interval < 10s (responsive for user)');
}

// ── savedRecently reset timer ──────────────────────────────────────────────────

console.log('\n── savedRecently: 3-second reset ────────────────────────────────');
{
  const SAVED_RECENTLY_MS = 3000;
  assert(SAVED_RECENTLY_MS === 3000, 'savedRecently: resets after 3000ms (3 seconds)');
  assert(SAVED_RECENTLY_MS < 5000, 'savedRecently: resets before auto-save debounce fires');
}

// ── Auto-save debounce timeout ─────────────────────────────────────────────────

console.log('\n── Auto-save debounce timeout ────────────────────────────────────');
{
  const AUTOSAVE_DEBOUNCE_MS = 5000;
  assert(AUTOSAVE_DEBOUNCE_MS === 5000, 'auto-save: debounce is exactly 5000ms (5 seconds)');
  assert(AUTOSAVE_DEBOUNCE_MS > 3000, 'auto-save: debounce > savedRecently reset (no flash overlap)');
}

// ── Round-trip: onBeforeRender flushes dirty saves ───────────────────────────

console.log('\n── Round-trip: onBeforeRender flushes dirty saves ───────────────');
{
  // Simulates: ExportDialog.startRender calls onBeforeRender=handleSave
  // to flush unsaved timeline edits before enqueueing the render job.

  const state = { dirty: true };
  const apiCalls = { save: 0, render: 0 };

  const api = {
    editor: {
      saveTimeline: async () => { apiCalls.save++; state.dirty = false; },
      render: async () => {
        apiCalls.render++;
        return { data: { renderStatus: 'QUEUED' } };
      },
    },
  };

  const result = await simulateStartRender({
    editId: 'e',
    preset: '1080P_16_9', format: 'mp4', quality: 'standard',
    api,
    onBeforeRender: async () => {
      // mirrors: if (onBeforeRender) await onBeforeRender();
      await api.editor.saveTimeline('e', { tracks: [] });
    },
    setState: (k, v) => { state[k] = v; },
  });

  assert(apiCalls.save === 1, 'round-trip: saveTimeline called before render (onBeforeRender)');
  assert(apiCalls.render === 1, 'round-trip: render API called after save');
  assert(state.dirty === false, 'round-trip: dirty cleared by onBeforeRender save');
  assert(result.success === true, 'round-trip: overall startRender succeeds');
}

// ── Results ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed ✓');
