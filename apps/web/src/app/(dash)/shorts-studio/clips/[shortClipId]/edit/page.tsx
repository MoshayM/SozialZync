'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Play, Pause, Scissors, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Wand2, Captions, Check, X, Save, Clapperboard,
  Film, Music2, Type, Layers, Volume2, VolumeX, Layout,
  Monitor, Smartphone, Square, RectangleHorizontal,
  Mic, Users, ImageIcon, Settings2, Sparkles, Zap, SlidersHorizontal,
  Copy, GitMerge, Eraser, ExternalLink, ClipboardPaste, Plus,
} from 'lucide-react';
import { api, apiClient } from '@/lib/api';
import { StudioToolPanels } from './StudioToolPanels';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  trackId: string;
  startMs: number;
  endMs: number;
  properties?: { sourceStartMs?: number; sourceEndMs?: number } | null;
  sourceAsset?: { id: string; versions: Array<{ id: string; durationMs: number | null }> } | null;
}
interface Track { id: string; type: 'VIDEO' | 'AUDIO' | 'MUSIC' | 'CAPTION' | 'OVERLAY'; orderIndex: number; items: Item[] }
interface Caption { id: string; startMs: number; endMs: number; text: string; emphasis: boolean; emoji: string | null }
interface TextOverlay { id: string; startMs: number; endMs: number; text: string; x: number; y: number; fontSize: 'sm' | 'md' | 'lg'; color: string }
interface CanvasConfig { aspect: '9:16' | '16:9' | '1:1' | '4:5'; fit: 'fill' | 'contain'; panX: number; panY: number; scale: number }
interface TimelineData { id: string; durationMs: number; tracks: Track[]; captions: Caption[]; canvasConfig?: CanvasConfig | null }
interface ClipData {
  id: string;
  clipType: string;
  status: string;
  timeline: TimelineData;
  topicSegment: { title: string; importedVideoId: string; highlight: { titleSuggestion: string } | null };
}

type Command =
  | { type: 'TRIM'; itemId: string; newStartMs: number; newEndMs: number }
  | { type: 'SPLIT'; itemId: string; atMs: number }
  | { type: 'DELETE'; itemId: string }
  | { type: 'DUPLICATE'; itemId: string }
  | { type: 'MOVE'; itemId: string; toTrackId: string; toStartMs: number }
  | { type: 'CUT_RANGE'; startMs: number; endMs: number; reason?: string };

interface EditAction { commands: Command[]; before: TimelineData }

const TRACK_COLORS: Record<Track['type'], string> = {
  VIDEO: 'bg-violet-600/90 border-violet-500',
  AUDIO: 'bg-emerald-500/90 border-emerald-400',
  MUSIC: 'bg-cyan-500/90 border-cyan-400',
  CAPTION: 'bg-amber-400/90 border-amber-300',
  OVERLAY: 'bg-fuchsia-500/90 border-fuchsia-400',
};
const TRACK_HEIGHTS: Record<Track['type'], number> = {
  VIDEO: 64, AUDIO: 56, MUSIC: 56, CAPTION: 36, OVERLAY: 36,
};
const TRACK_BAR: Record<Track['type'], string> = {
  VIDEO: 'bg-violet-500', AUDIO: 'bg-emerald-500', MUSIC: 'bg-cyan-500',
  CAPTION: 'bg-amber-400', OVERLAY: 'bg-fuchsia-500',
};

const CANVAS_PRESETS: { label: string; sub: string; key: CanvasConfig['aspect']; w: number; h: number; Icon: typeof Smartphone }[] = [
  { label: 'Shorts / Reels', sub: '9:16 · 1080×1920', key: '9:16', w: 1080, h: 1920, Icon: Smartphone },
  { label: 'Square', sub: '1:1 · 1080×1080', key: '1:1', w: 1080, h: 1080, Icon: Square },
  { label: 'Portrait', sub: '4:5 · 1080×1350', key: '4:5', w: 1080, h: 1350, Icon: RectangleHorizontal },
  { label: 'Widescreen', sub: '16:9 · 1920×1080', key: '16:9', w: 1920, h: 1080, Icon: Monitor },
];

const ASPECT_PAIRS: Record<CanvasConfig['aspect'], [number, number]> = {
  '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5], '16:9': [16, 9],
};

const DEFAULT_CANVAS: CanvasConfig = { aspect: '9:16', fit: 'fill', panX: 0, panY: 0, scale: 1 };

function defaultAspectForClipType(clipType: string): CanvasConfig['aspect'] {
  if (clipType === 'PODCAST_HIGHLIGHTS' || clipType === 'SMALL_VIDEO') return '16:9';
  if (clipType === 'LINKEDIN_CLIPS') return '1:1';
  return '9:16';
}

function fmt(ms: number): string {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
}
function clone<T>(t: T): T { return JSON.parse(JSON.stringify(t)) as T; }

function timelineToSource(tracks: Track[], tMs: number, renderedSrc = false): number | null {
  if (renderedSrc) return tMs;
  for (const track of tracks) {
    if (track.type !== 'VIDEO') continue;
    for (const item of track.items) {
      if (tMs >= item.startMs && tMs < item.endMs && typeof item.properties?.sourceStartMs === 'number') {
        return item.properties.sourceStartMs + (tMs - item.startMs);
      }
    }
  }
  return null;
}

export default function TimelineEditorPage() {
  const { shortClipId } = useParams<{ shortClipId: string }>();
  const qc = useQueryClient();
  const router = useRouter();

  const [captionPending, setCaptionPending] = useState(false);

  const { data: clip, isLoading } = useQuery<ClipData>({
    queryKey: ['clip-timeline', shortClipId],
    queryFn: () => api.shortsStudio.clipTimeline(shortClipId).then((r) => r.data as ClipData),
    refetchOnWindowFocus: false,
    refetchInterval: (q) =>
      captionPending && (q.state.data?.timeline?.captions?.length ?? 0) === 0 ? 3000 : false,
  });

  // ── Local editable state + history ──────────────────────────────────────────
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [undoStack, setUndoStack] = useState<EditAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditAction[]>([]);
  const [pending, setPending] = useState<Command[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(12);
  const [playing, setPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [canvasPanelOpen, setCanvasPanelOpen] = useState(false);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS);
  const [quickTool, setQuickTool] = useState<string | null>(null);
  const [mobileSheet, setMobileSheet] = useState<'none' | 'studio' | 'inspect' | 'tools' | 'canvas'>('none');
  const [desktopTab, setDesktopTab] = useState<'canvas' | 'ai' | 'studio' | 'text' | 'brand' | null>('ai');
  const [useRenderedSource, setUseRenderedSource] = useState(false);
  const useRenderedSourceRef = useRef(false);
  useRenderedSourceRef.current = useRenderedSource;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ capability: string; commands: Command[] } | null>(null);
  const [assistBusy, setAssistBusy] = useState<string | null>(null);
  const [fadeMap, setFadeMap] = useState<Map<string, { fadeIn: boolean; fadeOut: boolean }>>(new Map());
  const [openingInEditor, setOpeningInEditor] = useState(false);
  const [clipboard, setClipboard] = useState<Item | null>(null);
  const [textToolOpen, setTextToolOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textDurationSec, setTextDurationSec] = useState(2);
  const [textNewX, setTextNewX] = useState(50);
  const [textNewY, setTextNewY] = useState(80);
  const [textNewFontSize, setTextNewFontSize] = useState<TextOverlay['fontSize']>('md');
  const [textNewColor, setTextNewColor] = useState('#ffffff');
  const [userTextOverlays, setUserTextOverlays] = useState<TextOverlay[]>([]);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [brand, setBrand] = useState<{
    type: 'text' | 'logo'; text: string; logoUrl?: string;
    x: number; y: number; size: number; visible: boolean; color: string;
  } | null>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Command[]>([]);
  pendingRef.current = pending;
  const timelineRef = useRef<TimelineData | null>(null);
  timelineRef.current = timeline;

  // Sync timeline from server on first load
  useEffect(() => {
    if (clip?.timeline && !timeline) setTimeline(clone(clip.timeline));
  }, [clip, timeline]);

  // Load canvas config from server (or derive from clipType default)
  useEffect(() => {
    if (!clip) return;
    const serverCfg = clip.timeline.canvasConfig;
    if (serverCfg && serverCfg.aspect) {
      setCanvasConfig({ ...DEFAULT_CANVAS, ...serverCfg });
    } else {
      setCanvasConfig({ ...DEFAULT_CANVAS, aspect: defaultAspectForClipType(clip.clipType) });
    }
  }, [clip]);

  // When captions arrive, only update the captions array — preserve track items and their
  // sourceStartMs mappings so playback isn't interrupted by the timeline reset.
  useEffect(() => {
    if (captionPending && (clip?.timeline?.captions?.length ?? 0) > 0) {
      setCaptionPending(false);
      setTimeline((prev) =>
        prev
          ? { ...prev, captions: clip!.timeline.captions }
          : clone(clip!.timeline),
      );
    }
  }, [captionPending, clip]);

  // Sync muted prop to video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Stable video asset version ID — changes only when the source video is replaced,
  // not when captions or other metadata arrive (prevents spurious video reloads)
  const videoVersionId = useMemo(() =>
    clip?.timeline.tracks
      .filter((t) => t.type === 'VIDEO')
      .flatMap((t) => t.items)
      .find((i) => i.sourceAsset?.versions[0])?.sourceAsset?.versions[0]?.id,
  [clip]);

  // Source video — short-lived signed URL enabling Range requests for seeking.
  // Depends only on videoVersionId (not the full clip) so caption arrival doesn't
  // reload the video element and break playback.
  useEffect(() => {
    const apiBase = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/api\/v\d+\/?$/, '');
    let cancelled = false;
    setVideoLoading(true);

    const loadRendered = () => {
      void api.shortsStudio.previewUrl(shortClipId)
        .then((r) => {
          if (!cancelled && r.data.url) {
            setVideoUrl(`${apiBase}${r.data.url}`);
            setUseRenderedSource(true);
          } else if (!cancelled) {
            setVideoUrl(null);
          }
        })
        .catch(() => { if (!cancelled) setVideoUrl(null); });
    };

    if (!videoVersionId) {
      loadRendered();
      return () => { cancelled = true; };
    }

    void apiClient
      .get<{ url: string }>(`/media/versions/${videoVersionId}/editor-url`)
      .then((r) => {
        if (!cancelled) {
          setVideoUrl(`${apiBase}${r.data.url}`);
          setUseRenderedSource(false);
        }
      })
      .catch(() => { if (!cancelled) loadRendered(); });

    return () => { cancelled = true; };
  }, [videoVersionId, shortClipId]);

  // Fetch first thumbnail to use as poster so the preview shows immediately while the signed URL loads
  useEffect(() => {
    void api.shortsStudio.thumbnails(shortClipId).then((r) => {
      const list = r.data as Array<{ url?: string; signedUrl?: string }>;
      const first = list?.[0];
      if (!first) return;
      const apiBase = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/api\/v\d+\/?$/, '');
      const raw = first.signedUrl ?? first.url ?? '';
      setPosterUrl(raw.startsWith('http') ? raw : `${apiBase}${raw}`);
    }).catch(() => {});
  }, [shortClipId]);

  // ── Persistence ─────────────────────────────────────────────────────────────

  const flush = useCallback(async () => {
    const commands = pendingRef.current;
    const tl = timelineRef.current;
    if (!commands.length || !tl) return;
    setPending([]);
    setSaving(true);
    try {
      const res = await api.shortsStudio.applyCommands(tl.id, commands);
      setSaveError(null);
      const serverTimeline = res.data as TimelineData;
      setTimeline((prev) => prev ? { ...serverTimeline, captions: serverTimeline.captions ?? prev.captions } : serverTimeline);
      qc.setQueryData<ClipData>(['clip-timeline', shortClipId], (old) =>
        old ? { ...old, timeline: serverTimeline } : old,
      );
      setUndoStack([]);
      setRedoStack([]);
    } catch (err: unknown) {
      setPending((p) => [...commands, ...p]);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed — please retry';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [qc, shortClipId]);

  useEffect(() => {
    if (pending.length === 0) return;
    const structural = pending.some((c) => c.type === 'SPLIT' || c.type === 'DUPLICATE' || c.type === 'CUT_RANGE');
    const t = setTimeout(() => void flush(), structural ? 150 : 1500);
    return () => clearTimeout(t);
  }, [pending, flush]);

  const perform = useCallback((commands: Command[]) => {
    setTimeline((prev) => {
      if (!prev) return prev;
      const before = clone(prev);
      const next = clone(prev);
      for (const cmd of commands) applyLocal(next, cmd);
      setUndoStack((s) => [...s.slice(-49), { commands, before }]);
      setRedoStack([]);
      setPending((p) => [...p, ...commands]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1];
      if (!last) return stack;
      setPending((p) => {
        const cut = p.length - last.commands.length;
        if (cut < 0 || p.slice(cut).some((c, i) => c !== last.commands[i])) return p;
        setTimeline(clone(last.before));
        setRedoStack((r) => [...r, last]);
        return p.slice(0, cut);
      });
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      const last = stack[stack.length - 1];
      if (!last) return stack;
      setTimeline((prev) => {
        if (!prev) return prev;
        const next = clone(prev);
        for (const cmd of last.commands) applyLocal(next, cmd);
        return next;
      });
      setUndoStack((s) => [...s, last]);
      setPending((p) => [...p, ...last.commands]);
      return stack.slice(0, -1);
    });
  }, []);

  // ── Canvas config persistence ─────────────────────────────────────────────

  const updateCanvas = useMutation({
    mutationFn: (cfg: CanvasConfig) =>
      timeline ? api.shortsStudio.updateCanvas(timeline.id, cfg) : Promise.resolve(null),
    onSuccess: (_, cfg) => {
      qc.setQueryData<ClipData>(['clip-timeline', shortClipId], (old) =>
        old ? { ...old, timeline: { ...old.timeline, canvasConfig: cfg } } : old,
      );
    },
  });

  // ── Local reducer ────────────────────────────────────────────────────────────

  function applyLocal(tl: TimelineData, cmd: Command): void {
    const allItems = tl.tracks.flatMap((t) => t.items);
    const find = (id: string) => allItems.find((i) => i.id === id);
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
        const track = tl.tracks.find((t) => t.id === item.trackId)!;
        const right: Item = {
          ...clone({ ...item, id: `tmp-${Math.random().toString(36).slice(2)}` }),
          startMs: cmd.atMs,
        };
        if (typeof right.properties?.sourceStartMs === 'number' && typeof item.properties?.sourceStartMs === 'number') {
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
      case 'DUPLICATE': {
        const item = find(cmd.itemId);
        if (!item) return;
        const track = tl.tracks.find((t) => t.id === item.trackId)!;
        const len = item.endMs - item.startMs;
        track.items.push({ ...clone(item), id: `tmp-${Math.random().toString(36).slice(2)}`, startMs: item.endMs, endMs: item.endMs + len });
        return;
      }
      case 'MOVE': {
        const item = find(cmd.itemId);
        if (!item) return;
        const len = item.endMs - item.startMs;
        item.startMs = cmd.toStartMs;
        item.endMs = cmd.toStartMs + len;
        return;
      }
      case 'CUT_RANGE': {
        const { startMs, endMs } = cmd;
        const cut = endMs - startMs;
        for (const track of tl.tracks) {
          const kept: Item[] = [];
          for (const item of track.items) {
            if (item.endMs <= startMs) { kept.push(item); continue; }
            if (item.startMs >= endMs) { item.startMs -= cut; item.endMs -= cut; kept.push(item); continue; }
            if (item.startMs >= startMs && item.endMs <= endMs) continue;
            if (item.startMs < startMs && item.endMs > endMs) {
              const right: Item = { ...clone(item), id: `tmp-${Math.random().toString(36).slice(2)}` };
              if (typeof right.properties?.sourceStartMs === 'number' && typeof item.properties?.sourceStartMs === 'number') {
                right.properties.sourceStartMs = item.properties.sourceStartMs + (endMs - item.startMs);
              }
              right.startMs = startMs;
              right.endMs = startMs + (item.endMs - endMs);
              item.endMs = startMs;
              kept.push(item, right);
              continue;
            }
            if (item.startMs < startMs) { item.endMs = startMs; kept.push(item); continue; }
            const keepLen = item.endMs - endMs;
            if (typeof item.properties?.sourceStartMs === 'number') item.properties.sourceStartMs += endMs - item.startMs;
            item.startMs = startMs;
            item.endMs = startMs + keepLen;
            kept.push(item);
          }
          track.items = kept.sort((a, b) => a.startMs - b.startMs);
        }
        tl.captions = tl.captions
          .filter((c) => !(c.startMs >= startMs && c.endMs <= endMs))
          .map((c) => {
            if (c.endMs <= startMs) return c;
            if (c.startMs >= endMs) return { ...c, startMs: c.startMs - cut, endMs: c.endMs - cut };
            return { ...c, startMs: Math.min(c.startMs, startMs), endMs: startMs + Math.max(0, c.endMs - endMs) };
          })
          .filter((c) => c.endMs - c.startMs >= 200);
        return;
      }
    }
  }

  // ── Playback sync ────────────────────────────────────────────────────────────

  const durationMs = useMemo(
    () => timeline ? Math.max(1000, ...timeline.tracks.flatMap((t) => t.items.map((i) => i.endMs))) : 1000,
    [timeline],
  );

  // Virtual display tracks — always show VIDEO + AUDIO + CAPTION even if not in DB.
  // When no real AUDIO track exists or it has no items, populate it with read-only
  // linked items from the VIDEO track so users can see the embedded audio is there.
  const displayTracks = useMemo((): Track[] => {
    if (!timeline) return [];
    const existing = new Set(timeline.tracks.map((t) => t.type));
    const result = [...timeline.tracks];

    // Build linked-audio items from VIDEO track items so the Audio track
    // always shows the embedded audio, even when no separate AUDIO track exists
    // or when the existing AUDIO track has no items yet.
    const linkedItems: Item[] = timeline.tracks
      .filter((t) => t.type === 'VIDEO')
      .flatMap((t) =>
        t.items.map((item) => ({
          id: `linked-audio-${item.id}`,
          trackId: 'virt-audio',
          startMs: item.startMs,
          endMs: item.endMs,
          properties: item.properties ?? null,
          sourceAsset: item.sourceAsset ?? null,
        }))
      );

    if (!existing.has('AUDIO')) {
      result.push({ id: 'virt-audio', type: 'AUDIO', orderIndex: 10, items: linkedItems });
    } else {
      // AUDIO track exists — if it has no real items, show linked video audio items
      const audioIdx = result.findIndex((t) => t.type === 'AUDIO');
      if (audioIdx !== -1 && result[audioIdx].items.length === 0 && linkedItems.length > 0) {
        result[audioIdx] = { ...result[audioIdx], items: linkedItems.map((i) => ({ ...i, trackId: result[audioIdx].id })) };
      }
    }

    if (!existing.has('CAPTION')) result.push({ id: 'virt-caption', type: 'CAPTION', orderIndex: 11, items: [] });
    return result.sort((a, b) => a.orderIndex - b.orderIndex);
  }, [timeline]);

  const seekVideo = useCallback((tMs: number) => {
    const v = videoRef.current;
    const tl = timelineRef.current;
    if (!v || !tl) return;
    const src = timelineToSource(tl.tracks, Math.min(tMs, durationMs - 1), useRenderedSourceRef.current);
    if (src != null) v.currentTime = src / 1000;
  }, [durationMs]);

  const seekVideoRef = useRef(seekVideo);
  seekVideoRef.current = seekVideo;
  const durationMsRef = useRef(durationMs);
  durationMsRef.current = durationMs;
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      const tl = timelineRef.current;
      if (v && tl) {
        const srcMs = v.currentTime * 1000;
        if (useRenderedSourceRef.current) {
          if (v.ended || srcMs >= durationMsRef.current) { v.pause(); setPlaying(false); }
          else setPlayheadMs(srcMs);
        } else {
          let found = false;
          for (const track of tl.tracks) {
            if (track.type !== 'VIDEO') continue;
            for (const item of track.items) {
              const s0 = item.properties?.sourceStartMs;
              if (typeof s0 !== 'number') continue;
              const len = item.endMs - item.startMs;
              if (srcMs >= s0 && srcMs < s0 + len) { setPlayheadMs(item.startMs + (srcMs - s0)); found = true; break; }
            }
            if (found) break;
          }
          if (!found) {
            const items = tl.tracks.filter((t) => t.type === 'VIDEO').flatMap((t) => t.items)
              .filter((i) => typeof i.properties?.sourceStartMs === 'number')
              .sort((a, b) => a.startMs - b.startMs);
            const next = items.find((i) => (i.properties!.sourceStartMs as number) >= srcMs);
            if (next) v.currentTime = (next.properties!.sourceStartMs as number) / 1000;
            else { v.pause(); setPlaying(false); }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      seekVideo(playheadMs);
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false)); // Handle autoplay policy rejection
    }
  }, [playing, playheadMs, seekVideo]);

  // ── Editing actions ─────────────────────────────────────────────────────────

  const splitAtPlayhead = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    const target = selectedId
      ? tl.tracks.flatMap((t) => t.items).find((i) => i.id === selectedId)
      : tl.tracks.filter((t) => t.type === 'VIDEO').flatMap((t) => t.items).find((i) => playheadMs > i.startMs && playheadMs < i.endMs);
    if (!target || playheadMs <= target.startMs || playheadMs >= target.endMs || target.id.startsWith('tmp-')) return;
    perform([{ type: 'SPLIT', itemId: target.id, atMs: Math.round(playheadMs) }]);
  }, [selectedId, playheadMs, perform]);

  const deleteSelected = useCallback(() => {
    if (!selectedId || selectedId.startsWith('tmp-')) return;
    // Text overlays are local-only — remove from state, not the timeline
    const isTextOverlay = userTextOverlays.some((o) => o.id === selectedId);
    if (isTextOverlay) {
      setUserTextOverlays((prev) => prev.filter((o) => o.id !== selectedId));
      setSelectedId(null);
      return;
    }
    perform([{ type: 'DELETE', itemId: selectedId }]);
    setSelectedId(null);
  }, [selectedId, userTextOverlays, perform]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId || selectedId.startsWith('tmp-')) return;
    perform([{ type: 'DUPLICATE', itemId: selectedId }]);
  }, [selectedId, perform]);

  const mergeWithAdjacent = useCallback(() => {
    if (!selectedId || !timeline) return;
    for (const track of timeline.tracks) {
      const item = track.items.find((i) => i.id === selectedId);
      if (!item) continue;
      const next = track.items.find((i) => i.startMs >= item.endMs - 80 && i.startMs <= item.endMs + 80 && i.id !== selectedId);
      if (!next) return;
      perform([
        { type: 'TRIM', itemId: item.id, newStartMs: item.startMs, newEndMs: next.endMs },
        { type: 'DELETE', itemId: next.id },
      ]);
      return;
    }
  }, [selectedId, timeline, perform]);

  const rippleDelete = useCallback(() => {
    if (!selectedId || selectedId.startsWith('tmp-') || !timeline) return;
    for (const track of timeline.tracks) {
      const item = track.items.find((i) => i.id === selectedId);
      if (!item) continue;
      const len = item.endMs - item.startMs;
      const moves: Command[] = timeline.tracks.flatMap((tr) =>
        tr.items
          .filter((i) => i.id !== selectedId && i.startMs >= item.endMs)
          .map((i) => ({ type: 'MOVE' as const, itemId: i.id, toTrackId: i.trackId, toStartMs: i.startMs - len })),
      );
      perform([{ type: 'DELETE', itemId: selectedId }, ...moves]);
      setSelectedId(null);
      return;
    }
  }, [selectedId, timeline, perform]);

  const toggleFade = useCallback((itemId: string, side: 'in' | 'out') => {
    setFadeMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId) ?? { fadeIn: false, fadeOut: false };
      next.set(itemId, side === 'in' ? { ...cur, fadeIn: !cur.fadeIn } : { ...cur, fadeOut: !cur.fadeOut });
      return next;
    });
  }, []);

  const openInEditor = async () => {
    setOpeningInEditor(true);
    try {
      const res = await api.editor.createFromShortClip(shortClipId);
      router.push(`/editor/${(res.data as { id: string }).id}`);
    } catch {
      setOpeningInEditor(false);
    }
  };

  const handleCopySelected = useCallback(() => {
    if (!selectedId || !timeline) return;
    const item = timeline.tracks.flatMap((t) => t.items).find((i) => i.id === selectedId);
    if (item) setClipboard(item);
  }, [selectedId, timeline]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.id.startsWith('tmp-')) return;
    perform([{ type: 'DUPLICATE', itemId: clipboard.id }]);
  }, [clipboard, perform]);

  const handleAddText = () => {
    const text = textInput.trim();
    if (!text) return;
    const newOverlay: TextOverlay = {
      id: `user-text-${Date.now()}`,
      startMs: Math.round(playheadMs),
      endMs: Math.round(playheadMs) + textDurationSec * 1000,
      text,
      x: textNewX,
      y: textNewY,
      fontSize: textNewFontSize,
      color: textNewColor,
    };
    setUserTextOverlays((prev) => [...prev, newOverlay]);
    setTextInput('');
  };

  const handleDeleteTextOverlay = (id: string) => {
    setUserTextOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  const mergeTarget = useMemo(() => {
    if (!selectedId || !timeline) return null;
    for (const track of timeline.tracks) {
      const item = track.items.find((i) => i.id === selectedId);
      if (!item) continue;
      return track.items.find((i) => i.startMs >= item.endMs - 80 && i.startMs <= item.endMs + 80 && i.id !== selectedId) ?? null;
    }
    return null;
  }, [selectedId, timeline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 's' || e.key === 'S') splitAtPlayhead();
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); duplicateSelected(); }
      else if (e.key === 'j' || e.key === 'J') { e.preventDefault(); mergeWithAdjacent(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey) { e.preventDefault(); rippleDelete(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); handleCopySelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); handlePaste(); }
      else if (e.key === '+' || e.key === '=') setPxPerSec((z) => Math.min(80, z * 1.4));
      else if (e.key === '-') setPxPerSec((z) => Math.max(3, z / 1.4));
      else if (e.key === 'ArrowLeft') setPlayheadMs((p) => Math.max(0, p - (e.shiftKey ? 1000 : 100)));
      else if (e.key === 'ArrowRight') setPlayheadMs((p) => Math.min(durationMs, p + (e.shiftKey ? 1000 : 100)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, splitAtPlayhead, deleteSelected, duplicateSelected, mergeWithAdjacent, rippleDelete, undo, redo, durationMs, handleCopySelected, handlePaste]);

  // Lock body scroll while any mobile sheet is open
  useEffect(() => {
    if (mobileSheet !== 'none') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileSheet]);

  // ── Drag interactions ────────────────────────────────────────────────────────

  const dragState = useRef<{ mode: 'move' | 'trim-l' | 'trim-r' | 'playhead'; itemId?: string; startX: number; orig?: Item } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragState.current;
    if (!d) return;
    const dxMs = ((e.clientX - d.startX) / pxPerSecRef.current) * 1000;
    if (d.mode === 'playhead') {
      const newMs = Math.max(0, Math.min(durationMsRef.current, (d.orig?.startMs ?? 0) + dxMs));
      setPlayheadMs(newMs);
      seekVideoRef.current(newMs);
      return;
    }
    if (!d.itemId || !d.orig) return;
    setTimeline((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      const item = next.tracks.flatMap((t) => t.items).find((i) => i.id === d.itemId);
      if (!item) return prev;
      const len = d.orig!.endMs - d.orig!.startMs;
      if (d.mode === 'move') {
        const s = Math.max(0, Math.round(d.orig!.startMs + dxMs));
        item.startMs = s; item.endMs = s + len;
      } else if (d.mode === 'trim-l') {
        const s = Math.max(0, Math.min(Math.round(d.orig!.startMs + dxMs), d.orig!.endMs - 200));
        if (typeof item.properties?.sourceStartMs === 'number' && typeof d.orig!.properties?.sourceStartMs === 'number') {
          item.properties.sourceStartMs = d.orig!.properties.sourceStartMs + (s - d.orig!.startMs);
        }
        item.startMs = s;
      } else {
        item.endMs = Math.max(Math.round(d.orig!.endMs + dxMs), d.orig!.startMs + 200);
      }
      return next;
    });
  }, [pxPerSec, durationMs]);

  const onMouseUp = useCallback(() => {
    const d = dragState.current;
    dragState.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    if (!d || d.mode === 'playhead' || !d.itemId || !d.orig) return;
    const tl = timelineRef.current;
    const item = tl?.tracks.flatMap((t) => t.items).find((i) => i.id === d.itemId);
    if (!tl || !item || item.id.startsWith('tmp-')) return;
    if (item.startMs === d.orig.startMs && item.endMs === d.orig.endMs) return;
    const cmd: Command = d.mode === 'move'
      ? { type: 'MOVE', itemId: item.id, toTrackId: item.trackId, toStartMs: item.startMs }
      : { type: 'TRIM', itemId: item.id, newStartMs: item.startMs, newEndMs: item.endMs };
    setUndoStack((s) => [...s.slice(-49), { commands: [cmd], before: (() => { const b = clone(tl); const bi = b.tracks.flatMap((t) => t.items).find((i) => i.id === d.itemId)!; bi.startMs = d.orig!.startMs; bi.endMs = d.orig!.endMs; if (bi.properties && d.orig!.properties) bi.properties.sourceStartMs = d.orig!.properties.sourceStartMs; return b; })() }]);
    setRedoStack([]);
    setPending((p) => [...p, cmd]);
  }, [onMouseMove]);

  const startDrag = (mode: 'move' | 'trim-l' | 'trim-r', item: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId(item.id);
    dragState.current = { mode, itemId: item.id, startX: e.clientX, orig: clone(item) };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp, { once: true });
  };

  const startPlayheadDrag = (e: React.MouseEvent) => {
    const rect = scrollRef.current?.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const ms = Math.max(0, Math.min(durationMsRef.current, (((e.clientX - (rect?.left ?? 0)) + scrollLeft) / pxPerSecRef.current) * 1000));
    setPlayheadMs(ms);
    seekVideoRef.current(ms);
    dragState.current = { mode: 'playhead', startX: e.clientX, orig: { startMs: ms } as Item };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMouseMove);
    }, { once: true });
  };

  const startDiamondDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragState.current = { mode: 'playhead', startX: e.clientX, orig: { startMs: playheadMs } as Item };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMouseMove);
    }, { once: true });
  };

  const startPlayheadTouch = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const rect = scrollRef.current?.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const ms = Math.max(0, Math.min(durationMsRef.current, (((touch.clientX - (rect?.left ?? 0)) + scrollLeft) / pxPerSecRef.current) * 1000));
    setPlayheadMs(ms);
    seekVideoRef.current(ms);
    const startX = touch.clientX;
    const origMs = ms;
    const onTM = (te: TouchEvent) => {
      const t = te.touches[0];
      if (!t) return;
      te.preventDefault();
      const dxMs = ((t.clientX - startX) / pxPerSecRef.current) * 1000;
      const newMs = Math.max(0, Math.min(durationMsRef.current, origMs + dxMs));
      setPlayheadMs(newMs);
      seekVideoRef.current(newMs);
    };
    const onTE = () => window.removeEventListener('touchmove', onTM);
    window.addEventListener('touchmove', onTM, { passive: false });
    window.addEventListener('touchend', onTE, { once: true });
  };

  // ── AI assistant ─────────────────────────────────────────────────────────────

  const runAssist = async (capability: string) => {
    if (!timeline) return;
    await flush();
    setAssistBusy(capability);
    setSuggestions(null);
    try {
      const res = await api.shortsStudio.aiSuggest(timeline.id, capability);
      setSuggestions(res.data as { capability: string; commands: Command[] });
    } catch {
      setSuggestions({ capability, commands: [] });
    } finally {
      setAssistBusy(null);
    }
  };

  const applySuggestions = useMutation({
    mutationFn: async () => {
      if (!timeline || !suggestions) return null;
      const res = await api.shortsStudio.aiApply(timeline.id, suggestions.commands);
      return res.data as TimelineData;
    },
    onSuccess: (data) => {
      if (data) {
        setTimeline((prev) => prev ? { ...data, captions: data.captions ?? prev.captions } : data);
        qc.setQueryData<ClipData>(['clip-timeline', shortClipId], (old) =>
          old ? { ...old, timeline: data } : old,
        );
      }
      setSuggestions(null);
      setUndoStack([]); setRedoStack([]);
    },
  });

  const genCaptions = useMutation({
    mutationFn: () => api.shortsStudio.generateCaptions(shortClipId),
    onSuccess: () => { setCaptionPending(true); },
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading || !timeline) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-24 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading editor…
      </div>
    );
  }

  const widthPx = (durationMs / 1000) * pxPerSec + 200;
  const tickEveryS = pxPerSec >= 30 ? 1 : pxPerSec >= 10 ? 5 : 10;
  const ticks = Array.from({ length: Math.ceil(durationMs / 1000 / tickEveryS) + 1 }, (_, i) => i * tickEveryS);
  const activeCaption = timeline.captions.find((c) => playheadMs >= c.startMs && playheadMs < c.endMs);

  // Context-aware inspector: resolve selected real item + its track type
  const selectedItem = selectedId && !selectedId.startsWith('linked-audio-')
    ? timeline.tracks.flatMap((t) => t.items).find((i) => i.id === selectedId) ?? null
    : null;
  const selectedTrack = selectedItem
    ? timeline.tracks.find((t) => t.items.some((i) => i.id === selectedItem.id)) ?? null
    : null;
  const selectedTrackType = selectedTrack?.type ?? null;

  // Preview container dimensions — respect canvas aspect ratio
  const previewH = 300;
  const [aw, ah] = ASPECT_PAIRS[canvasConfig.aspect] ?? [9, 16];
  const previewW = Math.round(previewH * aw / ah);

  // Video object-fit + position reflects the canvas fit mode and pan
  const videoObjectFit = canvasConfig.fit === 'contain' ? 'contain' : 'cover';
  const videoObjectPosition = `${50 + canvasConfig.panX * 100}% ${50 + canvasConfig.panY * 100}%`;

  return (
    <div className="p-4 pb-24 lg:pb-4 max-w-[1400px] mx-auto select-none">
      <div className="mb-4 space-y-2">
        {/* Row 1: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/shorts-studio/videos/${clip!.topicSegment.importedVideoId}`} className="text-gray-500 hover:text-gray-800 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 truncate">
              {clip!.topicSegment.highlight?.titleSuggestion ?? clip!.topicSegment.title}
            </h1>
            <p className="text-xs text-gray-500">{clip!.clipType.replace(/_/g, ' ')} · {fmt(durationMs)} · {clip!.status.replace(/_/g, ' ')}</p>
          </div>
        </div>
        {/* Row 2: save status + actions */}
        <div className="flex items-center gap-2 pl-8 flex-wrap">
          {saveError && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <X className="w-3.5 h-3.5" /> {saveError}
            </span>
          )}
          {saving ? (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </span>
          ) : pending.length > 0 ? (
            <button
              onClick={() => { setSaveError(null); void flush(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save changes
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <div className="flex-1" />
          <Link
            href={`/shorts-studio/clips/${shortClipId}/export`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pending.length === 0 && !saving ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            <Clapperboard className="w-3.5 h-3.5" /> Export &amp; Publish
          </Link>
        </div>
      </div>

      <div>
        <div>
          {/* ── Player ──────────────────────────────────────────────────────── */}
          <div className="flex justify-center">
            <div
              ref={previewFrameRef}
              className="bg-black rounded-2xl overflow-hidden flex items-center justify-center relative"
              style={{ height: previewH, width: previewW, maxWidth: '100%' }}
            >
              {videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={posterUrl ?? undefined}
                  playsInline
                  preload="auto"
                  muted={muted}
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: videoObjectFit, objectPosition: videoObjectPosition }}
                  onLoadedMetadata={() => { seekVideo(0); setVideoLoading(false); }}
                  onCanPlay={() => setVideoLoading(false)}
                  onWaiting={() => setVideoLoading(true)}
                  onPlaying={() => setVideoLoading(false)}
                  onEnded={() => setPlaying(false)}
                />
              ) : (
                <p className="text-gray-500 text-sm px-4 text-center">
                  Preview unavailable — source video not downloaded
                </p>
              )}
              {/* Caption overlay */}
              {captionsVisible && activeCaption && (
                <div className="absolute bottom-6 left-0 right-0 text-center px-8 pointer-events-none z-10">
                  <span className={`inline-block px-3 py-1 rounded-lg text-white text-lg font-bold bg-black/60 ${activeCaption.emphasis ? 'text-amber-300' : ''}`}>
                    {activeCaption.text}{activeCaption.emoji ? ` ${activeCaption.emoji}` : ''}
                  </span>
                </div>
              )}
              {/* User text overlays — free-positioned, selectable, draggable */}
              {userTextOverlays
                .filter((o) => (playheadMs >= o.startMs && playheadMs < o.endMs) || selectedId === o.id)
                .map((o) => {
                  const isSel = selectedId === o.id;
                  return (
                    <div
                      key={o.id}
                      className={`absolute z-20 cursor-move select-none ${isSel ? 'ring-2 ring-amber-400 ring-offset-1 rounded-lg' : ''}`}
                      style={{ left: `${o.x}%`, top: `${o.y}%`, transform: 'translate(-50%, -50%)' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(o.id); setDesktopTab('text'); }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedId(o.id);
                        setDesktopTab('text');
                        const rect = previewFrameRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const onMove = (me: MouseEvent) => {
                          const nx = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100));
                          const ny = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100));
                          setUserTextOverlays((prev) => prev.map((p) => p.id === o.id ? { ...p, x: Math.round(nx), y: Math.round(ny) } : p));
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      }}
                    >
                      <span className={`inline-block px-3 py-1 rounded-lg font-semibold bg-black/60 whitespace-nowrap ${
                        o.fontSize === 'sm' ? 'text-sm' : o.fontSize === 'lg' ? 'text-xl' : 'text-base'
                      }`} style={{ color: o.color }}>
                        {o.text}
                      </span>
                    </div>
                  );
                })
              }
              {/* Brand overlay — draggable */}
              {brand?.visible && (
                <div
                  className="absolute z-30 cursor-move select-none"
                  style={{ left: `${brand.x}%`, top: `${brand.y}%`, transform: 'translate(-50%, -50%)' }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const rect = previewFrameRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const onMove = (me: MouseEvent) => {
                      const nx = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100));
                      const ny = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100));
                      setBrand((b) => b ? { ...b, x: Math.round(nx), y: Math.round(ny) } : b);
                    };
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  {brand.type === 'text' ? (
                    <span className="inline-block font-bold drop-shadow-lg whitespace-nowrap"
                      style={{ color: brand.color, fontSize: `${brand.size}rem` }}>
                      {brand.text || 'Brand'}
                    </span>
                  ) : brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt="brand logo"
                      className="object-contain drop-shadow-lg pointer-events-none"
                      style={{ height: `${brand.size * 32}px`, maxWidth: '120px' }} />
                  ) : (
                    <span className="text-white text-xs bg-white/20 px-2 py-1 rounded border border-white/40">Logo URL →</span>
                  )}
                </div>
              )}
              {/* Buffering indicator */}
              {videoLoading && videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              {/* Canvas aspect badge */}
              <div className="absolute top-2 left-2 bg-black/50 text-white text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none">
                {canvasConfig.aspect} · {canvasConfig.fit}
              </div>
            </div>
          </div>

          {/* Preview controls: mute + CC toggle */}
          <div className="flex items-center gap-2 mt-2 justify-center">
            <button
              onClick={() => setMuted((m) => !m)}
              title={muted ? 'Unmute' : 'Mute'}
              className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-gray-500" /> : <Volume2 className="w-3.5 h-3.5 text-gray-600" />}
            </button>
            <button
              onClick={() => setCaptionsVisible((v) => !v)}
              title={captionsVisible ? 'Hide captions' : 'Show captions'}
              className={`flex items-center gap-1.5 px-2.5 h-7 border rounded-lg text-[11px] font-medium transition-colors ${captionsVisible ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
            >
              <Captions className="w-3.5 h-3.5" /> CC
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <button onClick={togglePlay} className="flex items-center justify-center w-8 h-8 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shrink-0" title="Play/Pause (Space)">
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <span className="text-xs font-mono tabular-nums text-gray-700 px-2 shrink-0 whitespace-nowrap">
              {fmt(playheadMs)}<span className="text-gray-400"> / {fmt(durationMs)}</span>
            </span>
            <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
            <button onClick={() => setPxPerSec((z) => Math.max(3, z / 1.4))} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0" title="Zoom out (-)"><ZoomOut className="w-3.5 h-3.5 text-gray-600" /></button>
            <button onClick={() => setPxPerSec((z) => Math.min(80, z * 1.4))} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0" title="Zoom in (+)"><ZoomIn className="w-3.5 h-3.5 text-gray-600" /></button>
            <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
            <button onClick={undo} disabled={undoStack.length === 0} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5 text-gray-600" /></button>
            <button onClick={redo} disabled={redoStack.length === 0} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-3.5 h-3.5 text-gray-600" /></button>
            <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
            <button onClick={splitAtPlayhead} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0" title="Split at playhead (S)"><Scissors className="w-3.5 h-3.5 text-gray-600" /></button>
            <button onClick={mergeWithAdjacent} disabled={!mergeTarget} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Merge with next clip (J)"><GitMerge className="w-3.5 h-3.5 text-gray-600" /></button>
            <button onClick={handleCopySelected} disabled={!selectedId} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Copy selected (Ctrl+C)"><Copy className="w-3.5 h-3.5 text-gray-600" /></button>
            <button onClick={handlePaste} disabled={!clipboard} className="flex items-center justify-center w-7 h-7 border border-brand-300 bg-brand-50 rounded-lg hover:bg-brand-100 disabled:opacity-40 shrink-0" title="Paste (Ctrl+V)"><ClipboardPaste className="w-3.5 h-3.5 text-brand-600" /></button>
            <button onClick={duplicateSelected} disabled={!selectedId} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Duplicate selected (D)"><Layers className="w-3.5 h-3.5 text-gray-400" /></button>
            <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
            <button onClick={deleteSelected} disabled={!selectedId} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Delete selected (Del)"><Trash2 className="w-3.5 h-3.5 text-gray-600" /></button>
            <button onClick={rippleDelete} disabled={!selectedId} className="flex items-center justify-center w-7 h-7 border border-red-100 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-40 shrink-0" title="Ripple delete — close gap (Shift+Del)"><Eraser className="w-3.5 h-3.5 text-red-500" /></button>
            <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
            <button
              onClick={() => setTextToolOpen((o) => !o)}
              className={`flex items-center justify-center w-7 h-7 rounded-lg border shrink-0 ${textToolOpen ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
              title="Text tool — add text overlay"
            >
              <Type className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Text Overlay Tool ────────────────────────────────────────── */}
          {textToolOpen && (
            <div className="mt-2 border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs font-semibold text-amber-800 flex-1">Add Text Overlay</p>
                <button onClick={() => setTextToolOpen(false)} className="p-1 rounded hover:bg-amber-100"><X className="w-3.5 h-3.5 text-amber-500" /></button>
              </div>
              {/* Row 1: text input — full width */}
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddText(); }}
                placeholder="Type text to overlay on video…"
                className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              {/* Row 2: position sliders */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Horizontal</span><span className="font-mono">{textNewX}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={textNewX}
                    onChange={(e) => setTextNewX(parseInt(e.target.value))}
                    className="w-full h-1.5 accent-amber-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Vertical</span><span className="font-mono">{textNewY}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={textNewY}
                    onChange={(e) => setTextNewY(parseInt(e.target.value))}
                    className="w-full h-1.5 accent-amber-500"
                  />
                </div>
              </div>
              {/* Row 3: duration + Add — always fully visible */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 shrink-0">Duration:</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={textDurationSec}
                  onChange={(e) => setTextDurationSec(Math.max(1, parseInt(e.target.value) || 2))}
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
                />
                <span className="text-[10px] text-gray-500 shrink-0">s</span>
                <div className="flex-1" />
                <button
                  onClick={handleAddText}
                  disabled={!textInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {userTextOverlays.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {userTextOverlays.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-amber-200">
                      <Type className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="flex-1 text-xs text-gray-700 truncate">{o.text}</span>
                      <span className="text-[10px] font-mono text-gray-400">{fmt(o.startMs)}–{fmt(o.endMs)}</span>
                      <button onClick={() => handleDeleteTextOverlay(o.id)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Timeline ────────────────────────────────────────────────────── */}
          <div className="mt-3 border border-gray-700/60 rounded-xl overflow-hidden flex bg-[#0f1623]">
            {/* Fixed track-labels column */}
            <div className="w-[72px] shrink-0 bg-[#0f1623] border-r border-gray-700/50">
              <div className="h-7 border-b border-gray-700/50 bg-[#141d2b]" />
              {displayTracks.map((track) => (
                <div
                  key={track.id}
                  className="border-b border-gray-700/30 flex items-center gap-1.5 px-2"
                  style={{ height: TRACK_HEIGHTS[track.type] ?? 48 }}
                >
                  <div className={`w-[3px] self-stretch my-2 rounded-full shrink-0 ${TRACK_BAR[track.type]}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-gray-300">
                      {track.type === 'VIDEO' && <Film className="w-2.5 h-2.5 shrink-0" />}
                      {(track.type === 'AUDIO' || track.type === 'MUSIC') && <Music2 className="w-2.5 h-2.5 shrink-0" />}
                      {track.type === 'CAPTION' && <Type className="w-2.5 h-2.5 shrink-0" />}
                      {track.type === 'OVERLAY' && <Layers className="w-2.5 h-2.5 shrink-0" />}
                      <span className="text-[8px] font-bold uppercase tracking-widest leading-tight truncate">
                        {track.type === 'MUSIC' ? 'Music' : track.type.charAt(0) + track.type.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-[7px] text-gray-600 leading-tight mt-0.5">
                      {track.type === 'CAPTION'
                        ? (timeline.captions.length > 0 ? `${timeline.captions.length} caption${timeline.captions.length > 1 ? 's' : ''}` : 'empty')
                        : (track.id.startsWith('virt-') && track.type === 'AUDIO' && track.items.length > 0)
                      ? 'video audio'
                      : track.items.length > 0 ? `${track.items.length} clip${track.items.length > 1 ? 's' : ''}` : 'empty'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Scrollable timeline content */}
            <div ref={scrollRef} className="overflow-x-auto flex-1">
              <div className="relative" style={{ width: widthPx }}>
                {/* Ruler */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div
                  className="h-7 border-b border-gray-700/50 relative cursor-pointer bg-[#141d2b] select-none"
                  onMouseDown={startPlayheadDrag}
                  onTouchStart={startPlayheadTouch}
                >
                  {ticks.map((s) => (
                    <span key={s} className="absolute bottom-1 text-[9px] text-gray-500 font-mono" style={{ left: s * pxPerSec + 2 }}>
                      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
                    </span>
                  ))}
                </div>

                {/* Tracks */}
                {displayTracks.map((track) => {
                  const trackH = TRACK_HEIGHTS[track.type] ?? 48;
                  const isAudioTrack = track.type === 'AUDIO' || track.type === 'MUSIC';
                  const isVirtual = track.id.startsWith('virt-');
                  return (
                    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                    <div
                      key={track.id}
                      className="relative border-b border-gray-700/30 bg-[#0f1623]"
                      style={{ height: trackH }}
                      onMouseDown={() => setSelectedId(null)}
                    >
                      {/* VIDEO track: show source-audio note */}
                      {track.type === 'VIDEO' && track.items.length > 0 && (
                        <div className="absolute top-0.5 right-2 text-[7px] text-gray-600 flex items-center gap-0.5">
                          <Volume2 className="w-2 h-2" /> audio embedded
                        </div>
                      )}

                      {/* CAPTION track */}
                      {track.type === 'CAPTION' && (
                        timeline.captions.length === 0 && userTextOverlays.length === 0
                          ? <span className="absolute inset-0 flex items-center px-3 text-[9px] text-gray-600 italic">No captions yet — use Generate captions or Text tool →</span>
                          : ([...timeline.captions.map((c) => ({ id: c.id, startMs: c.startMs, endMs: c.endMs, text: c.text, emoji: c.emoji })),
                              ...userTextOverlays.map((o) => ({ id: o.id, startMs: o.startMs, endMs: o.endMs, text: o.text, emoji: null }))]).map((c) => (
                            <div
                              key={c.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); if (userTextOverlays.some((o) => o.id === c.id)) setDesktopTab('text'); }}
                              className={`absolute top-1.5 bottom-1.5 rounded bg-amber-400/80 border border-amber-300 px-1 overflow-hidden cursor-pointer ${selectedId === c.id ? 'ring-2 ring-white/80 ring-offset-1' : 'hover:border-amber-200 hover:bg-amber-400'}`}
                              style={{ left: (c.startMs / 1000) * pxPerSec, width: Math.max(2, ((c.endMs - c.startMs) / 1000) * pxPerSec) }}
                              title={c.text}
                            >
                              <span className="text-[8px] text-amber-950 whitespace-nowrap">{'emoji' in c && c.emoji ? `${c.emoji} ` : ''}{c.text}</span>
                            </div>
                          ))
                      )}

                      {/* Empty track placeholder */}
                      {track.type !== 'CAPTION' && track.items.length === 0 && (
                        <div className="absolute inset-y-2 left-1 right-1 rounded-lg border border-dashed border-gray-700/50 flex items-center px-3">
                          <span className="text-[9px] text-gray-600 italic">
                            {track.type === 'AUDIO'
                              ? (isVirtual ? 'Voice-over (source audio is in Video track) — add via Studio Tools →' : 'Voice-over — add via Studio Tools')
                              : track.type === 'MUSIC' ? 'Music — add via Studio Tools'
                              : 'Empty'}
                          </span>
                        </div>
                      )}

                      {/* Regular items */}
                      {track.type !== 'CAPTION' && track.items.map((item) => {
                        const w = Math.max(8, ((item.endMs - item.startMs) / 1000) * pxPerSec);
                        const isLinkedAudio = item.id.startsWith('linked-audio-');
                        if (isLinkedAudio) {
                          return (
                            <div
                              key={item.id}
                              onClick={() => { setSelectedId(item.id); setDesktopTab('studio'); }}
                              className={`absolute top-1.5 bottom-1.5 rounded-lg border border-teal-400 bg-teal-500/40 overflow-hidden cursor-pointer hover:bg-teal-500/60 ${selectedId === item.id ? 'ring-2 ring-white/60 ring-offset-1' : ''}`}
                              style={{ left: (item.startMs / 1000) * pxPerSec, width: w }}
                              title="Video audio (embedded) — click to select"
                            >
                              {w > 16 && (
                                <div className="absolute inset-0 flex items-center gap-px px-1 overflow-hidden opacity-50">
                                  {Array.from({ length: Math.floor((w - 8) / 3) }).map((_, bi) => {
                                    const bh = 18 + Math.round(Math.abs(Math.sin(bi * 1.4 + 0.9) * Math.cos(bi * 0.6)) * 64);
                                    return <div key={bi} style={{ width: 2, height: `${Math.min(88, bh)}%`, background: 'rgba(255,255,255,0.7)', borderRadius: 1, flexShrink: 0 }} />;
                                  })}
                                </div>
                              )}
                              <span className="absolute bottom-0.5 left-1 text-[7px] text-teal-100/80 whitespace-nowrap z-10">video audio</span>
                            </div>
                          );
                        }
                        return (
                          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                          <div
                            key={item.id}
                            onMouseDown={(e) => startDrag('move', item, e)}
                            onClick={() => { if (isAudioTrack) setDesktopTab('studio'); }}
                            className={`absolute top-1.5 bottom-1.5 rounded-lg border cursor-grab active:cursor-grabbing overflow-hidden ${TRACK_COLORS[track.type]} ${selectedId === item.id ? 'ring-2 ring-offset-1 ring-white/60' : ''}`}
                            style={{ left: (item.startMs / 1000) * pxPerSec, width: w }}
                          >
                            {isAudioTrack && w > 16 && (
                              <div className="absolute inset-0 flex items-center gap-px px-1 overflow-hidden opacity-60 pointer-events-none">
                                {Array.from({ length: Math.floor((w - 8) / 3) }).map((_, bi) => {
                                  const bh = 18 + Math.round(Math.abs(Math.sin(bi * 1.4 + 0.9) * Math.cos(bi * 0.6)) * 64);
                                  return <div key={bi} style={{ width: 2, height: `${Math.min(88, bh)}%`, background: 'rgba(255,255,255,0.7)', borderRadius: 1, flexShrink: 0 }} />;
                                })}
                              </div>
                            )}
                            {track.type === 'VIDEO' && w > 24 && (
                              <div className="absolute inset-y-0 left-0 right-0 flex items-start pt-1 gap-px px-1 overflow-hidden pointer-events-none">
                                {Array.from({ length: Math.floor(w / 12) }).map((_, fi) => (
                                  <div key={fi} className="w-1.5 h-2 rounded-sm bg-white/10 shrink-0" />
                                ))}
                              </div>
                            )}
                            <span className="absolute bottom-1 left-2 text-[9px] text-white/80 whitespace-nowrap z-10 font-mono">
                              {fmt(item.endMs - item.startMs)}
                            </span>
                            {/* Fade-in overlay */}
                            {fadeMap.get(item.id)?.fadeIn && (
                              <div className="absolute left-0 top-0 bottom-0 w-8 rounded-l-lg pointer-events-none z-[5]" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)' }} />
                            )}
                            {/* Fade-out overlay */}
                            {fadeMap.get(item.id)?.fadeOut && (
                              <div className="absolute right-0 top-0 bottom-0 w-8 rounded-r-lg pointer-events-none z-[5]" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.7), transparent)' }} />
                            )}
                            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                            <div onMouseDown={(e) => startDrag('trim-l', item, e)} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40 rounded-l-lg z-10" />
                            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                            <div onMouseDown={(e) => startDrag('trim-r', item, e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40 rounded-r-lg z-10" />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Playhead */}
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: (playheadMs / 1000) * pxPerSec }}>
                  <div className="absolute top-0 bottom-0 w-px bg-red-500 -translate-x-1/2 pointer-events-none" />
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div
                    onMouseDown={startDiamondDrag}
                    className="pointer-events-auto absolute -top-0.5 w-3.5 h-3.5 bg-red-500 rotate-45 -translate-x-1/2 cursor-grab active:cursor-grabbing shadow-md z-20"
                  />
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 select-none">
            Space play/pause · S split · J merge · D duplicate · Del delete · Shift+Del ripple delete · Ctrl+Z/Y undo/redo · +/− zoom · ←/→ nudge · drag edges to trim
          </p>
        </div>

      </div>

      {/* ── Desktop bottom tools panel (replaces sidebar) ─────────────────── */}
      <div className="hidden lg:flex mt-4 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 shrink-0">
          {([
            { id: 'canvas' as const, label: 'Inspect', Icon: Settings2,          color: 'text-brand-600'   },
            { id: 'ai'     as const, label: 'AI',      Icon: Sparkles,            color: 'text-purple-600'  },
            { id: 'studio' as const, label: 'Edit',    Icon: SlidersHorizontal,  color: 'text-cyan-600'    },
            { id: 'text'   as const, label: 'Text',    Icon: Type,               color: 'text-amber-600'   },
            { id: 'brand'  as const, label: 'Brand',   Icon: ImageIcon,          color: 'text-fuchsia-600' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setDesktopTab((prev) => prev === t.id ? null : t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                desktopTab === t.id
                  ? `border-brand-500 ${t.color} bg-gray-50`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Canvas tab */}
        {desktopTab === 'canvas' && (
          <div className="p-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {CANVAS_PRESETS.map((p) => {
                const active = canvasConfig.aspect === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => { const cfg: CanvasConfig = { ...canvasConfig, aspect: p.key }; setCanvasConfig(cfg); updateCanvas.mutate(cfg); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <p.Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                    <span className="font-medium">{p.label}</span>
                    <span className={`text-[10px] ${active ? 'text-brand-500' : 'text-gray-400'}`}>{p.sub}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              {(['fill', 'contain'] as const).map((f) => (
                <button key={f} onClick={() => { const cfg: CanvasConfig = { ...canvasConfig, fit: f }; setCanvasConfig(cfg); updateCanvas.mutate(cfg); }} className={`flex-1 max-w-[140px] py-1.5 text-xs rounded-lg border font-medium transition-colors ${canvasConfig.fit === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {f === 'fill' ? 'Fill (crop)' : 'Contain (letterbox)'}
                </button>
              ))}
            </div>
            {canvasConfig.fit === 'fill' && (
              <div className="flex gap-6">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Horizontal</span><span className="font-mono">{canvasConfig.panX > 0 ? '+' : ''}{Math.round(canvasConfig.panX * 100)}%</span>
                  </div>
                  <input type="range" min="-50" max="50" value={Math.round(canvasConfig.panX * 100)} onChange={(e) => setCanvasConfig((prev) => ({ ...prev, panX: parseInt(e.target.value) / 100 }))} onMouseUp={() => updateCanvas.mutate(canvasConfig)} onTouchEnd={() => updateCanvas.mutate(canvasConfig)} className="w-full h-1.5 accent-brand-600" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Vertical</span><span className="font-mono">{canvasConfig.panY > 0 ? '+' : ''}{Math.round(canvasConfig.panY * 100)}%</span>
                  </div>
                  <input type="range" min="-50" max="50" value={Math.round(canvasConfig.panY * 100)} onChange={(e) => setCanvasConfig((prev) => ({ ...prev, panY: parseInt(e.target.value) / 100 }))} onMouseUp={() => updateCanvas.mutate(canvasConfig)} onTouchEnd={() => updateCanvas.mutate(canvasConfig)} className="w-full h-1.5 accent-brand-600" />
                </div>
                <button onClick={() => { const cfg: CanvasConfig = { ...canvasConfig, panX: 0, panY: 0 }; setCanvasConfig(cfg); updateCanvas.mutate(cfg); }} className="text-[10px] text-gray-400 hover:text-gray-600 underline self-end mb-1">Reset</button>
              </div>
            )}
            {updateCanvas.isPending && <p className="text-[10px] text-brand-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</p>}
            {updateCanvas.isSuccess && <p className="text-[10px] text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Canvas saved</p>}
          </div>
        )}

        {/* AI Tools tab */}
        {desktopTab === 'ai' && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['remove-silence', 'Remove Silence'],
                ['remove-fillers', 'Remove Filler Words'],
                ['improve-pacing', 'Improve Pacing'],
              ] as const).map(([cap, label]) => (
                <button key={cap} onClick={() => void runAssist(cap)} disabled={assistBusy !== null}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {assistBusy === cap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-gray-500" />}
                  {label}
                </button>
              ))}
              <button onClick={() => genCaptions.mutate()} disabled={genCaptions.isPending || captionPending}
                className="flex items-center gap-2 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                {(genCaptions.isPending || captionPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Captions className="w-4 h-4" />}
                {captionPending ? 'Generating…' : 'Generate Captions'}
              </button>
            </div>
            {suggestions && suggestions.commands.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-600">{suggestions.commands.length} suggestion{suggestions.commands.length === 1 ? '' : 's'}</p>
                {suggestions.commands.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-gray-600">
                      {c.type === 'CUT_RANGE' ? `Cut ${fmt(c.startMs)}–${fmt(c.endMs)}` : c.type}
                      {'reason' in c && c.reason ? <span className="text-gray-400"> — {c.reason}</span> : null}
                    </span>
                    <button onClick={() => setSuggestions((s) => s ? { ...s, commands: s.commands.filter((_, j) => j !== i) } : s)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => applySuggestions.mutate()} disabled={applySuggestions.isPending}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
                  {applySuggestions.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Apply {suggestions.commands.length} edit{suggestions.commands.length === 1 ? '' : 's'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Edit tab (studio) */}
        {desktopTab === 'studio' && (
          <div className="p-3 max-h-64 overflow-y-auto space-y-3">
            {/* Quick edit actions */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Edit Actions</p>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={splitAtPlayhead} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50"><Scissors className="w-3.5 h-3.5" /> Split (S)</button>
                <button onClick={mergeWithAdjacent} disabled={!mergeTarget} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"><GitMerge className="w-3.5 h-3.5" /> Merge (J)</button>
                <button onClick={duplicateSelected} disabled={!selectedId} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Copy className="w-3.5 h-3.5" /> Duplicate (D)</button>
                <button onClick={rippleDelete} disabled={!selectedId} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-100 bg-red-50 rounded-lg text-xs text-red-600 hover:bg-red-100 disabled:opacity-40"><Eraser className="w-3.5 h-3.5" /> Ripple Delete</button>
              </div>
            </div>
            {/* Audio info when linked-audio is selected */}
            {selectedId?.startsWith('linked-audio-') && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5 mb-1">
                  <Volume2 className="w-3.5 h-3.5" /> Video Audio (Embedded)
                </p>
                <p className="text-[11px] text-teal-600">This is the audio embedded in the video clip. Use Fade In / Fade Out below to add transitions.</p>
              </div>
            )}
            {/* Transition controls for selected clip */}
            {selectedId && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Transitions</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFade(selectedId, 'in')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border font-medium transition-colors ${fadeMap.get(selectedId)?.fadeIn ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    ◁ Fade In
                  </button>
                  <button
                    onClick={() => toggleFade(selectedId, 'out')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border font-medium transition-colors ${fadeMap.get(selectedId)?.fadeOut ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Fade Out ▷
                  </button>
                </div>
                {(fadeMap.get(selectedId)?.fadeIn || fadeMap.get(selectedId)?.fadeOut) && (
                  <p className="text-[10px] text-gray-400 mt-1">Fades preview on the timeline. Applied during render.</p>
                )}
              </div>
            )}
            <div className="border-t border-gray-100 pt-2">
              <StudioToolPanels
                timelineId={timeline.id}
                shortClipId={shortClipId}
                captionsText={timeline.captions.map((c) => c.text).join(' ')}
                audioVersionId={timeline.tracks.find((t) => t.type === 'AUDIO')?.items[0]?.sourceAsset?.versions[0]?.id}
                requestOpen={quickTool}
              />
            </div>
          </div>
        )}

        {/* Text tab */}
        {desktopTab === 'text' && (
          <div className="p-4 space-y-3">
            {/* ── Edit selected overlay ───────────────────────────────────── */}
            {(() => {
              const sel = userTextOverlays.find((o) => o.id === selectedId);
              if (!sel) return null;
              return (
                <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" /> Editing overlay
                    </p>
                    <button
                      onClick={() => { setUserTextOverlays((prev) => prev.filter((o) => o.id !== selectedId)); setSelectedId(null); }}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sel.text}
                    onChange={(e) => setUserTextOverlays((prev) => prev.map((o) => o.id === selectedId ? { ...o, text: e.target.value } : o))}
                    className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Text content…"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>X</span><span className="font-mono">{sel.x}%</span></div>
                      <input type="range" min={0} max={100} value={sel.x}
                        onChange={(e) => setUserTextOverlays((prev) => prev.map((o) => o.id === selectedId ? { ...o, x: parseInt(e.target.value) } : o))}
                        className="w-full h-1.5 accent-amber-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Y</span><span className="font-mono">{sel.y}%</span></div>
                      <input type="range" min={0} max={100} value={sel.y}
                        onChange={(e) => setUserTextOverlays((prev) => prev.map((o) => o.id === selectedId ? { ...o, y: parseInt(e.target.value) } : o))}
                        className="w-full h-1.5 accent-amber-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {(['sm', 'md', 'lg'] as const).map((s) => (
                        <button key={s}
                          onClick={() => setUserTextOverlays((prev) => prev.map((o) => o.id === selectedId ? { ...o, fontSize: s } : o))}
                          className={`px-2 py-1 text-xs rounded-lg border font-medium transition-colors ${sel.fontSize === s ? 'border-amber-500 bg-amber-100 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5 ml-auto">
                      {['#ffffff', '#000000', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e'].map((c) => (
                        <button key={c}
                          onClick={() => setUserTextOverlays((prev) => prev.map((o) => o.id === selectedId ? { ...o, color: c } : o))}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${sel.color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="border-t border-gray-100 pt-1" />
            {/* Input row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddText(); }}
                placeholder="Type text overlay…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number" min={1} max={60} value={textDurationSec}
                  onChange={(e) => setTextDurationSec(Math.max(1, parseInt(e.target.value) || 2))}
                  className="w-12 border border-gray-200 rounded px-1.5 py-1 text-xs text-center"
                  title="Duration in seconds"
                />
                <span className="text-[10px] text-gray-400">s</span>
              </div>
              <button onClick={handleAddText} disabled={!textInput.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" /> Add at {fmt(playheadMs)}
              </button>
            </div>
            {/* Position + style controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>X position</span><span className="font-mono">{textNewX}%</span></div>
                <input type="range" min={0} max={100} value={textNewX} onChange={(e) => setTextNewX(parseInt(e.target.value))} className="w-full h-1.5 accent-amber-500" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Y position</span><span className="font-mono">{textNewY}%</span></div>
                <input type="range" min={0} max={100} value={textNewY} onChange={(e) => setTextNewY(parseInt(e.target.value))} className="w-full h-1.5 accent-amber-500" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button key={s} onClick={() => setTextNewFontSize(s)}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${textNewFontSize === s ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 ml-auto">
                {['#ffffff', '#000000', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e'].map((c) => (
                  <button key={c} onClick={() => setTextNewColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${textNewColor === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            {/* Overlay list */}
            {userTextOverlays.length > 0 ? (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Text Overlays ({userTextOverlays.length})</p>
                {userTextOverlays.map((o) => (
                  <div key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border cursor-pointer transition-colors ${selectedId === o.id ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                    <Type className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="flex-1 text-xs text-gray-700 truncate">{o.text || <em className="text-gray-400">empty</em>}</span>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">{fmt(o.startMs)}–{fmt(o.endMs)}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTextOverlay(o.id); }} className="text-gray-300 hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Move the playhead to where you want text to appear, then type and click Add.</p>
            )}
          </div>
        )}

        {/* Brand tab */}
        {desktopTab === 'brand' && (
          <div className="p-4 space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Brand Overlay</p>
              <button
                onClick={() => setBrand((b) => b ? { ...b, visible: !b.visible } : { type: 'text', text: '', x: 50, y: 10, size: 1.2, visible: true, color: '#ffffff' })}
                className={`px-3 py-1 text-xs rounded-lg border font-medium transition-colors ${brand?.visible ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {brand?.visible ? 'Visible' : brand ? 'Hidden' : 'Add Brand'}
              </button>
            </div>
            {brand && (
              <>
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(['text', 'logo'] as const).map((t) => (
                    <button key={t} onClick={() => setBrand((b) => b ? { ...b, type: t } : b)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors capitalize ${brand.type === t ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {t === 'text' ? 'Brand Title' : 'Logo Image'}
                    </button>
                  ))}
                </div>
                {brand.type === 'text' ? (
                  <div>
                    <input type="text" value={brand.text} onChange={(e) => setBrand((b) => b ? { ...b, text: e.target.value } : b)}
                      placeholder="Your Brand Name"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-400" />
                    <div className="flex gap-1.5 mt-2">
                      {['#ffffff', '#000000', '#f59e0b', '#a855f7', '#ef4444', '#22c55e'].map((c) => (
                        <button key={c} onClick={() => setBrand((b) => b ? { ...b, color: c } : b)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${brand.color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <input type="text" value={brand.logoUrl ?? ''} onChange={(e) => setBrand((b) => b ? { ...b, logoUrl: e.target.value } : b)}
                    placeholder="Logo image URL…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-400" />
                )}
                {/* Quick position grid */}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1.5">Position (drag on preview or pick)</p>
                  <div className="grid grid-cols-3 gap-1 w-24">
                    {[['TL',10,10],['TC',50,10],['TR',90,10],['ML',10,50],['MC',50,50],['MR',90,50],['BL',10,90],['BC',50,90],['BR',90,90]].map(([label, bx, by]) => (
                      <button key={String(label)} onClick={() => setBrand((b) => b ? { ...b, x: bx as number, y: by as number } : b)}
                        className={`py-1 text-[9px] rounded border transition-colors ${brand.x === bx && brand.y === by ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Size slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Size</span><span className="font-mono">{brand.size.toFixed(1)}×</span></div>
                  <input type="range" min={5} max={20} step={1} value={Math.round(brand.size * 10)}
                    onChange={(e) => setBrand((b) => b ? { ...b, size: parseInt(e.target.value) / 10 } : b)}
                    className="w-full h-1.5 accent-fuchsia-500" />
                </div>
              </>
            )}
            {!brand && (
              <p className="text-xs text-gray-400 italic">Click "Hidden" to enable the brand overlay on the preview.</p>
            )}
          </div>
        )}
      </div>

      {/* Mobile Canvas Size bottom sheet */}
      {mobileSheet === 'canvas' && (
        <div
          className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/40"
          style={{ bottom: 0 }}
          onClick={() => setMobileSheet('none')}
          role="presentation"
        />
      )}
      <div
        className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'canvas' ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '70vh', bottom: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Canvas size"
      >
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
          <Layout className="w-4 h-4 text-brand-600" />
          <p className="text-sm font-semibold text-gray-800 flex-1">Canvas Size</p>
          <span className="text-xs text-gray-400 font-mono mr-2">{canvasConfig.aspect}</span>
          <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close canvas">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {CANVAS_PRESETS.map((p) => {
              const active = canvasConfig.aspect === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    const cfg: CanvasConfig = { ...canvasConfig, aspect: p.key };
                    setCanvasConfig(cfg);
                    updateCanvas.mutate(cfg);
                  }}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-colors ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <p.Icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-center leading-tight">{p.label}</span>
                  <span className={`text-[9px] ${active ? 'text-brand-500' : 'text-gray-400'}`}>{p.sub}</span>
                </button>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Video fit</p>
            <div className="flex gap-2">
              {(['fill', 'contain'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    const cfg: CanvasConfig = { ...canvasConfig, fit: f };
                    setCanvasConfig(cfg);
                    updateCanvas.mutate(cfg);
                  }}
                  className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-colors ${canvasConfig.fit === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {f === 'fill' ? 'Fill (crop)' : 'Contain (letterbox)'}
                </button>
              ))}
            </div>
          </div>
          {canvasConfig.fit === 'fill' && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Position</p>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Horizontal</span>
                  <span className="font-mono">{canvasConfig.panX > 0 ? '+' : ''}{Math.round(canvasConfig.panX * 100)}%</span>
                </div>
                <input type="range" min="-50" max="50"
                  value={Math.round(canvasConfig.panX * 100)}
                  onChange={(e) => setCanvasConfig((prev) => ({ ...prev, panX: parseInt(e.target.value) / 100 }))}
                  onMouseUp={() => updateCanvas.mutate(canvasConfig)}
                  onTouchEnd={() => updateCanvas.mutate(canvasConfig)}
                  className="w-full h-2 accent-brand-600" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Vertical</span>
                  <span className="font-mono">{canvasConfig.panY > 0 ? '+' : ''}{Math.round(canvasConfig.panY * 100)}%</span>
                </div>
                <input type="range" min="-50" max="50"
                  value={Math.round(canvasConfig.panY * 100)}
                  onChange={(e) => setCanvasConfig((prev) => ({ ...prev, panY: parseInt(e.target.value) / 100 }))}
                  onMouseUp={() => updateCanvas.mutate(canvasConfig)}
                  onTouchEnd={() => updateCanvas.mutate(canvasConfig)}
                  className="w-full h-2 accent-brand-600" />
              </div>
              <button
                onClick={() => {
                  const cfg: CanvasConfig = { ...canvasConfig, panX: 0, panY: 0 };
                  setCanvasConfig(cfg);
                  updateCanvas.mutate(cfg);
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline"
              >
                Reset position
              </button>
            </div>
          )}
          {updateCanvas.isSuccess && (
            <p className="text-[10px] text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Canvas saved — re-render to apply
            </p>
          )}
        </div>
      </div>

      {/* Mobile Studio Tools bottom sheet */}
      {mobileSheet === 'studio' && (
        <div
          className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/40"
          style={{ bottom: 0 }}
          onClick={() => setMobileSheet('none')}
          role="presentation"
        />
      )}
      <div
        className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'studio' ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '75vh', bottom: 0 }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 shrink-0">
          <Sparkles className="w-4 h-4 text-cyan-600" />
          <p className="text-sm font-semibold text-gray-800 flex-1">AI & Studio Tools</p>
          <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close AI tools">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {/* AI Assistant quick actions */}
        <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">AI Assistant</p>
          {([
            ['remove-silence', 'Remove Silence'],
            ['remove-fillers', 'Remove Filler Words'],
            ['improve-pacing', 'Improve Pacing'],
          ] as const).map(([cap, label]) => (
            <button
              key={cap}
              onClick={() => { void runAssist(cap); setMobileSheet('none'); }}
              disabled={assistBusy !== null}
              className="w-full flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {assistBusy === cap ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600 shrink-0" /> : <Wand2 className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
              {label}
            </button>
          ))}
          <button
            onClick={() => { genCaptions.mutate(); setMobileSheet('none'); }}
            disabled={genCaptions.isPending || captionPending}
            className="w-full flex items-center gap-2.5 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {(genCaptions.isPending || captionPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Captions className="w-3.5 h-3.5 shrink-0" />}
            {captionPending ? 'Generating captions…' : 'Generate Captions'}
          </button>
        </div>
        {/* Studio tool selector tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-100 shrink-0 overflow-x-auto">
          {([
            { id: 'music',  label: 'Music',      Icon: Music2,     color: 'text-cyan-600',    active: 'bg-cyan-50 border-cyan-300 text-cyan-700' },
            { id: 'voice',  label: 'Voice-Over',  Icon: Mic,        color: 'text-brand-600',   active: 'bg-brand-50 border-brand-300 text-brand-700' },
            { id: 'audio',  label: 'AI Audio',    Icon: Volume2,    color: 'text-emerald-600', active: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
            { id: 'chars',  label: 'Characters',  Icon: Users,      color: 'text-fuchsia-600', active: 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-700' },
            { id: 'images', label: 'Images',      Icon: ImageIcon,  color: 'text-purple-600',  active: 'bg-purple-50 border-purple-300 text-purple-700' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setQuickTool((prev) => prev === t.id ? null : t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${quickTool === t.id ? t.active : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <t.Icon className={`w-3.5 h-3.5 ${quickTool === t.id ? '' : t.color}`} />
              {t.label}
            </button>
          ))}
        </div>
        {/* Tool panel content */}
        <div className="flex-1 overflow-y-auto">
          <StudioToolPanels
            timelineId={timeline.id}
            shortClipId={shortClipId}
            captionsText={timeline.captions.map((c) => c.text).join(' ')}
            audioVersionId={
              timeline.tracks
                .find((t) => t.type === 'AUDIO')
                ?.items[0]
                ?.sourceAsset?.versions[0]?.id
            }
            requestOpen={quickTool ?? undefined}
          />
        </div>
      </div>

      {/* Mobile Inspect bottom sheet — context-aware based on selected clip type */}
      {mobileSheet === 'inspect' && (
        <div className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/40" style={{ bottom: 0 }} onClick={() => setMobileSheet('none')} role="presentation" />
      )}
      <div
        className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'inspect' ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '60vh', bottom: 0 }}
        role="dialog" aria-modal="true" aria-label="Clip inspector"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 shrink-0">
          <Settings2 className="w-4 h-4 text-brand-600" />
          <p className="text-sm font-semibold text-gray-800 flex-1">
            {selectedTrackType === 'VIDEO' ? 'Video Clip' : selectedTrackType === 'AUDIO' ? 'Audio Clip' : selectedTrackType === 'MUSIC' ? 'Music' : 'Inspector'}
          </p>
          {selectedItem && (
            <span className="text-[10px] font-mono text-gray-400 mr-2">{fmt(selectedItem.endMs - selectedItem.startMs)}</span>
          )}
          <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close inspector">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
              <Layers className="w-8 h-8" />
              <p className="text-sm font-medium">No clip selected</p>
              <p className="text-xs text-center">Tap a clip in the timeline to inspect and edit it</p>
            </div>
          ) : (
            <>
              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { splitAtPlayhead(); setMobileSheet('none'); }}
                  className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Scissors className="w-4 h-4" /> Split here
                </button>
                <button
                  onClick={() => { deleteSelected(); setMobileSheet('none'); }}
                  className="flex items-center justify-center gap-2 py-2.5 border border-red-100 bg-red-50 rounded-xl text-sm text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>

              {/* VIDEO-specific tools */}
              {selectedTrackType === 'VIDEO' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">AI Enhancements</p>
                  {([
                    ['remove-silence', 'Remove Silence', 'Cuts out pauses automatically'] ,
                    ['remove-fillers', 'Remove Filler Words', 'Removes um, uh, like…'],
                    ['improve-pacing', 'Improve Pacing', 'Tightens the overall rhythm'],
                  ] as const).map(([cap, label, sub]) => (
                    <button
                      key={cap}
                      onClick={() => { void runAssist(cap); setMobileSheet('none'); }}
                      disabled={assistBusy !== null}
                      className="w-full flex items-start gap-3 px-3 py-2.5 border border-gray-200 rounded-xl text-left hover:bg-gray-50 disabled:opacity-50"
                    >
                      {assistBusy === cap ? <Loader2 className="w-4 h-4 animate-spin mt-0.5 text-brand-600 shrink-0" /> : <Wand2 className="w-4 h-4 mt-0.5 text-brand-500 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-[11px] text-gray-500">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* AUDIO-specific tools */}
              {(selectedTrackType === 'AUDIO' || selectedTrackType === 'MUSIC') && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Audio Tools</p>
                  {([
                    { id: 'audio', label: 'AI Enhance Audio', sub: 'Boost clarity & presence', Icon: Sparkles },
                    { id: 'trim', label: 'Trim Silence', sub: 'Remove quiet gaps', Icon: Scissors },
                    { id: 'normalize', label: 'Normalize Loudness', sub: 'Balance volume levels', Icon: SlidersHorizontal },
                    { id: 'denoise', label: 'Remove Background Noise', sub: 'Clean up the audio track', Icon: Zap },
                  ]).map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setQuickTool('audio');
                        setMobileSheet('studio');
                      }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 border border-gray-200 rounded-xl text-left hover:bg-gray-50"
                    >
                      <tool.Icon className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{tool.label}</p>
                        <p className="text-[11px] text-gray-500">{tool.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Tools bottom sheet */}
      {mobileSheet === 'tools' && (
        <div className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/40" style={{ bottom: 0 }} onClick={() => setMobileSheet('none')} role="presentation" />
      )}
      <div
        className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'tools' ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '60vh', bottom: 0 }}
        role="dialog" aria-modal="true" aria-label="Editor tools"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-purple-600" />
          <p className="text-sm font-semibold text-gray-800 flex-1">Edit Tools</p>
          <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close edit tools">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {/* Edit history */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">History</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={undo} disabled={undoStack.length === 0} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button onClick={redo} disabled={redoStack.length === 0} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                <Redo2 className="w-4 h-4" /> Redo
              </button>
            </div>
          </div>

          {/* Clip actions */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Clip</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { splitAtPlayhead(); setMobileSheet('none'); }} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                <Scissors className="w-4 h-4" /> Split
              </button>
              <button onClick={() => { mergeWithAdjacent(); setMobileSheet('none'); }} disabled={!mergeTarget} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                <GitMerge className="w-4 h-4" /> Merge
              </button>
              <button onClick={() => { duplicateSelected(); setMobileSheet('none'); }} disabled={!selectedId} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                <Copy className="w-4 h-4" /> Duplicate
              </button>
              <button onClick={() => { deleteSelected(); setMobileSheet('none'); }} disabled={!selectedId} className="flex items-center justify-center gap-2 py-2.5 border border-red-100 bg-red-50 rounded-xl text-sm text-red-600 hover:bg-red-100 disabled:opacity-40">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button onClick={() => { rippleDelete(); setMobileSheet('none'); }} disabled={!selectedId} className="col-span-2 flex items-center justify-center gap-2 py-2.5 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-50 disabled:opacity-40">
                <Eraser className="w-4 h-4" /> Ripple Delete (close gap)
              </button>
            </div>
          </div>
          {/* Transitions */}
          {selectedId && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Transitions</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => toggleFade(selectedId, 'in')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border font-medium transition-colors ${fadeMap.get(selectedId)?.fadeIn ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  ◁ Fade In
                </button>
                <button
                  onClick={() => toggleFade(selectedId, 'out')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border font-medium transition-colors ${fadeMap.get(selectedId)?.fadeOut ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  Fade Out ▷
                </button>
              </div>
            </div>
          )}

          {/* Copy / Paste */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Copy / Paste</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { handleCopySelected(); setMobileSheet('none'); }}
                disabled={!selectedId}
                className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button
                onClick={() => { handlePaste(); setMobileSheet('none'); }}
                disabled={!clipboard}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-colors disabled:opacity-40 ${clipboard ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100' : 'border-gray-200 text-gray-400'}`}
              >
                <ClipboardPaste className="w-4 h-4" /> Paste
              </button>
            </div>
            {clipboard && <p className="text-[10px] text-brand-600 mt-1">Clipboard: {fmt(clipboard.endMs - clipboard.startMs)} clip ready to paste</p>}
          </div>

          {/* Text Overlays */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Text Overlay</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Add text at playhead…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                onClick={() => { handleAddText(); }}
                disabled={!textInput.trim()}
                className="flex items-center gap-1 px-3 py-2.5 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {userTextOverlays.length > 0 && (
              <div className="mt-2 space-y-1">
                {userTextOverlays.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <span className="flex-1 text-xs text-gray-700 truncate">{o.text}</span>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">{fmt(o.startMs)}</span>
                    <button onClick={() => handleDeleteTextOverlay(o.id)} className="text-gray-300 hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Captions */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Captions</p>
            <button
              onClick={() => { genCaptions.mutate(); setMobileSheet('none'); }}
              disabled={genCaptions.isPending || captionPending}
              className="w-full flex items-center gap-3 px-3 py-2.5 border border-amber-200 bg-amber-50 rounded-xl text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              {(genCaptions.isPending || captionPending) ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Captions className="w-4 h-4 shrink-0" />}
              {captionPending ? 'Generating captions…' : 'Generate Captions'}
            </button>
          </div>

          {/* Canvas */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Canvas</p>
            <button
              onClick={() => setMobileSheet('canvas')}
              className="w-full flex items-center gap-3 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
            >
              <Layout className="w-4 h-4 text-brand-600 shrink-0" />
              Canvas Size <span className="ml-auto font-mono text-[10px] text-gray-400">{canvasConfig.aspect}</span>
            </button>
          </div>

          {/* Brand overlay */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Brand Overlay</p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setBrand((b) => b ? { ...b, visible: !b.visible } : { type: 'text', text: '', x: 10, y: 10, size: 1.2, visible: true, color: '#ffffff' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border font-medium transition-colors ${brand?.visible ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                <ImageIcon className="w-4 h-4" /> {brand?.visible ? 'Brand visible' : 'Enable Brand'}
              </button>
            </div>
            {brand && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['text', 'logo'] as const).map((t) => (
                    <button key={t} onClick={() => setBrand((b) => b ? { ...b, type: t } : b)}
                      className={`flex-1 py-2 text-xs rounded-xl border font-medium capitalize transition-colors ${brand.type === t ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {t === 'text' ? 'Brand Title' : 'Logo Image'}
                    </button>
                  ))}
                </div>
                {brand.type === 'text' ? (
                  <input type="text" value={brand.text} onChange={(e) => setBrand((b) => b ? { ...b, text: e.target.value } : b)}
                    placeholder="Your Brand Name"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-400" />
                ) : (
                  <input type="text" value={brand.logoUrl ?? ''} onChange={(e) => setBrand((b) => b ? { ...b, logoUrl: e.target.value } : b)}
                    placeholder="Logo image URL…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-400" />
                )}
                <p className="text-[10px] text-gray-400">Drag the overlay on the preview to reposition it.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile bottom tab bar — z-[35] sits above the dashboard mobile nav (z-30) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[35] bg-white border-t border-gray-200 flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {([
          { id: 'studio' as const,  label: 'AI',     Icon: Sparkles,          color: 'text-cyan-600',   activeBg: 'bg-cyan-50',   activeTxt: 'text-cyan-700' },
          { id: 'inspect' as const, label: 'Inspect', Icon: Settings2,         color: 'text-brand-600',  activeBg: 'bg-brand-50',  activeTxt: 'text-brand-700' },
          { id: 'tools' as const,   label: 'Edit',   Icon: SlidersHorizontal, color: 'text-purple-600', activeBg: 'bg-purple-50', activeTxt: 'text-purple-700' },
        ]).map((tab) => {
          const active = mobileSheet === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileSheet(active ? 'none' : tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${active ? tab.activeBg : 'hover:bg-gray-50'}`}
            >
              <tab.Icon className={`w-5 h-5 ${active ? tab.activeTxt : tab.color}`} />
              <span className={`text-[10px] font-medium ${active ? tab.activeTxt : 'text-gray-500'}`}>{tab.label}</span>
              {active && <span className="w-4 h-0.5 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
