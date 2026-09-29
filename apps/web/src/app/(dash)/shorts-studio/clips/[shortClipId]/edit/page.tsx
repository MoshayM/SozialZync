'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Play, Pause, Scissors, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Wand2, Captions, Check, X, Save, Clapperboard,
  Maximize2, Film, Music2, Type, Layers, Volume2, VolumeX, Layout,
  Monitor, Smartphone, Square, RectangleHorizontal,
  Mic, Users, ImageIcon,
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
  const [previewSize, setPreviewSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [muted, setMuted] = useState(false);
  const [canvasPanelOpen, setCanvasPanelOpen] = useState(false);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS);
  const [quickTool, setQuickTool] = useState<string | null>(null);
  const [useRenderedSource, setUseRenderedSource] = useState(false);
  const useRenderedSourceRef = useRef(false);
  useRenderedSourceRef.current = useRenderedSource;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ capability: string; commands: Command[] } | null>(null);
  const [assistBusy, setAssistBusy] = useState<string | null>(null);

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

  // Virtual display tracks — always show VIDEO + AUDIO + CAPTION even if not in DB
  const displayTracks = useMemo((): Track[] => {
    if (!timeline) return [];
    const existing = new Set(timeline.tracks.map((t) => t.type));
    const result = [...timeline.tracks];
    if (!existing.has('AUDIO')) result.push({ id: 'virt-audio', type: 'AUDIO', orderIndex: 10, items: [] });
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
    perform([{ type: 'DELETE', itemId: selectedId }]);
    setSelectedId(null);
  }, [selectedId, perform]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 's' || e.key === 'S') splitAtPlayhead();
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      else if (e.key === '+' || e.key === '=') setPxPerSec((z) => Math.min(80, z * 1.4));
      else if (e.key === '-') setPxPerSec((z) => Math.max(3, z / 1.4));
      else if (e.key === 'ArrowLeft') setPlayheadMs((p) => Math.max(0, p - (e.shiftKey ? 1000 : 100)));
      else if (e.key === 'ArrowRight') setPlayheadMs((p) => Math.min(durationMs, p + (e.shiftKey ? 1000 : 100)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, splitAtPlayhead, deleteSelected, undo, redo, durationMs]);

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

  // Preview container dimensions — respect canvas aspect ratio
  const previewH = previewSize === 'sm' ? 200 : previewSize === 'lg' ? 480 : 320;
  const [aw, ah] = ASPECT_PAIRS[canvasConfig.aspect] ?? [9, 16];
  const previewW = Math.round(previewH * aw / ah);

  // Video object-fit + position reflects the canvas fit mode and pan
  const videoObjectFit = canvasConfig.fit === 'contain' ? 'contain' : 'cover';
  const videoObjectPosition = `${50 + canvasConfig.panX * 100}% ${50 + canvasConfig.panY * 100}%`;

  return (
    <div className="p-6 max-w-[1400px] mx-auto select-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/shorts-studio/videos/${clip!.topicSegment.importedVideoId}`} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 truncate">
              {clip!.topicSegment.highlight?.titleSuggestion ?? clip!.topicSegment.title}
            </h1>
            <p className="text-xs text-gray-500">{clip!.clipType.replace(/_/g, ' ')} · {fmt(durationMs)} · {clip!.status.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {saveError && (
            <span className="flex items-center gap-1 text-red-600">
              <X className="w-3.5 h-3.5" /> {saveError}
            </span>
          )}
          {saving ? <span className="flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>
            : pending.length > 0 ? <button onClick={() => { setSaveError(null); void flush(); }} className="flex items-center gap-1 text-brand-600 hover:underline"><Save className="w-3.5 h-3.5" /> {pending.length} unsaved</button>
            : <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-500" /> Saved</span>}
          <Link
            href={`/shorts-studio/clips/${shortClipId}/export`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700"
          >
            <Clapperboard className="w-3.5 h-3.5" /> Export
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4">
        <div>
          {/* ── Player ──────────────────────────────────────────────────────── */}
          <div className="flex justify-center">
            <div
              className="bg-black rounded-2xl overflow-hidden flex items-center justify-center relative"
              style={{ height: previewH, width: previewW, maxWidth: '100%' }}
            >
              {videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={videoRef}
                  src={videoUrl}
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
              {activeCaption && (
                <div className="absolute bottom-6 left-0 right-0 text-center px-8 pointer-events-none z-10">
                  <span className={`inline-block px-3 py-1 rounded-lg text-white text-lg font-bold bg-black/60 ${activeCaption.emphasis ? 'text-amber-300' : ''}`}>
                    {activeCaption.text}{activeCaption.emoji ? ` ${activeCaption.emoji}` : ''}
                  </span>
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

          {/* Preview resize + mute controls */}
          <div className="flex items-center gap-1.5 mt-2 justify-center">
            <Maximize2 className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-[10px] text-gray-400 mr-0.5">Preview:</span>
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setPreviewSize(s)}
                className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${previewSize === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button
              onClick={() => setMuted((m) => !m)}
              title={muted ? 'Unmute' : 'Mute'}
              className="flex items-center justify-center w-6 h-6 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-gray-500" /> : <Volume2 className="w-3.5 h-3.5 text-gray-600" />}
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
            <button onClick={deleteSelected} disabled={!selectedId} className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 shrink-0" title="Delete selected (Del)"><Trash2 className="w-3.5 h-3.5 text-gray-600" /></button>
            <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
            {/* Studio Tools quick-access — each button opens the corresponding panel in the sidebar */}
            {([
              { id: 'music',  label: 'Music',      Icon: Music2,     color: 'text-cyan-600' },
              { id: 'voice',  label: 'Voice-Over',  Icon: Mic,        color: 'text-brand-600' },
              { id: 'audio',  label: 'Audio',       Icon: Volume2,    color: 'text-emerald-600' },
              { id: 'chars',  label: 'Characters',  Icon: Users,      color: 'text-fuchsia-600' },
              { id: 'images', label: 'Images',      Icon: ImageIcon,  color: 'text-purple-600' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setQuickTool((prev) => prev === t.id ? null : t.id)}
                title={t.label}
                className={`flex items-center justify-center w-7 h-7 border rounded-lg shrink-0 transition-colors ${
                  quickTool === t.id
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <t.Icon className={`w-3.5 h-3.5 ${quickTool === t.id ? 'text-brand-600' : t.color}`} />
              </button>
            ))}
          </div>

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
                        timeline.captions.length === 0
                          ? <span className="absolute inset-0 flex items-center px-3 text-[9px] text-gray-600 italic">No captions yet — use Generate captions →</span>
                          : timeline.captions.map((c) => (
                            <div
                              key={c.id}
                              className="absolute top-1.5 bottom-1.5 rounded bg-amber-400/80 border border-amber-300 px-1 overflow-hidden"
                              style={{ left: (c.startMs / 1000) * pxPerSec, width: Math.max(2, ((c.endMs - c.startMs) / 1000) * pxPerSec) }}
                              title={c.text}
                            >
                              <span className="text-[8px] text-amber-950 whitespace-nowrap">{c.emoji ? `${c.emoji} ` : ''}{c.text}</span>
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
                        return (
                          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                          <div
                            key={item.id}
                            onMouseDown={(e) => startDrag('move', item, e)}
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
            Space play/pause · S split · Del delete · Ctrl+Z/Y undo/redo · +/− zoom · ←/→ nudge · drag ruler or diamond to seek · drag edges to trim
          </p>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────────── */}
        <aside className="space-y-3">
          {/* Canvas size panel */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <button
              onClick={() => setCanvasPanelOpen(!canvasPanelOpen)}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-800"
            >
              <span className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-brand-600" /> Canvas Size
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{canvasConfig.aspect}</span>
            </button>

            {canvasPanelOpen && (
              <div className="mt-3 space-y-3">
                {/* Aspect ratio presets */}
                <div className="grid grid-cols-2 gap-1.5">
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
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs transition-colors ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        <p.Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                        <span className="font-medium text-center leading-tight">{p.label}</span>
                        <span className={`text-[9px] ${active ? 'text-brand-500' : 'text-gray-400'}`}>{p.sub}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Fit mode */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Video fit</p>
                  <div className="flex gap-1.5">
                    {(['fill', 'contain'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          const cfg: CanvasConfig = { ...canvasConfig, fit: f };
                          setCanvasConfig(cfg);
                          updateCanvas.mutate(cfg);
                        }}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${canvasConfig.fit === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {f === 'fill' ? 'Fill (crop)' : 'Contain (letterbox)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pan controls — only useful with Fill mode */}
                {canvasConfig.fit === 'fill' && (
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Position</p>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Horizontal</span>
                        <span className="font-mono">{canvasConfig.panX > 0 ? '+' : ''}{Math.round(canvasConfig.panX * 100)}%</span>
                      </div>
                      <input
                        type="range" min="-50" max="50"
                        value={Math.round(canvasConfig.panX * 100)}
                        onChange={(e) => setCanvasConfig((prev) => ({ ...prev, panX: parseInt(e.target.value) / 100 }))}
                        onMouseUp={() => updateCanvas.mutate(canvasConfig)}
                        onTouchEnd={() => updateCanvas.mutate(canvasConfig)}
                        className="w-full h-1.5 accent-brand-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Vertical</span>
                        <span className="font-mono">{canvasConfig.panY > 0 ? '+' : ''}{Math.round(canvasConfig.panY * 100)}%</span>
                      </div>
                      <input
                        type="range" min="-50" max="50"
                        value={Math.round(canvasConfig.panY * 100)}
                        onChange={(e) => setCanvasConfig((prev) => ({ ...prev, panY: parseInt(e.target.value) / 100 }))}
                        onMouseUp={() => updateCanvas.mutate(canvasConfig)}
                        onTouchEnd={() => updateCanvas.mutate(canvasConfig)}
                        className="w-full h-1.5 accent-brand-600"
                      />
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

                {updateCanvas.isPending && (
                  <p className="text-[10px] text-brand-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving canvas…
                  </p>
                )}
                {updateCanvas.isSuccess && (
                  <p className="text-[10px] text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Canvas saved — re-render to apply
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI Assistant panel */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
              <Wand2 className="w-4 h-4 text-brand-600" /> AI Assistant
            </h2>
            <div className="space-y-2">
              {([
                ['remove-silence', 'Remove silence'],
                ['remove-fillers', 'Remove filler words'],
                ['improve-pacing', 'Improve pacing'],
              ] as const).map(([cap, label]) => (
                <button
                  key={cap}
                  onClick={() => void runAssist(cap)}
                  disabled={assistBusy !== null}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {assistBusy === cap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-gray-500" />}
                  {label}
                </button>
              ))}
              <button
                onClick={() => genCaptions.mutate()}
                disabled={genCaptions.isPending || captionPending}
                className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {(genCaptions.isPending || captionPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Captions className="w-4 h-4 text-gray-500" />}
                {captionPending ? 'Generating captions…' : 'Generate captions'}
              </button>
              {captionPending && (
                <p className="text-[11px] text-brand-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Processing speech — captions will appear on the timeline when ready.
                </p>
              )}
            </div>

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
              requestOpen={quickTool}
            />

            {suggestions && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {suggestions.commands.length} suggestion{suggestions.commands.length === 1 ? '' : 's'}
                </p>
                {suggestions.commands.length === 0 && (
                  <p className="text-xs text-gray-500">Nothing to change — this clip already looks tight.</p>
                )}
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {suggestions.commands.map((c, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-gray-600">
                        {c.type === 'CUT_RANGE' ? `Cut ${fmt(c.startMs)}–${fmt(c.endMs)}` : c.type}
                        {'reason' in c && c.reason ? <span className="text-gray-500"> — {c.reason}</span> : null}
                      </span>
                      <button
                        onClick={() => setSuggestions((s) => s ? { ...s, commands: s.commands.filter((_, j) => j !== i) } : s)}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {suggestions.commands.length > 0 && (
                  <button
                    onClick={() => applySuggestions.mutate()}
                    disabled={applySuggestions.isPending}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
                  >
                    {applySuggestions.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Apply {suggestions.commands.length} edit{suggestions.commands.length === 1 ? '' : 's'}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
