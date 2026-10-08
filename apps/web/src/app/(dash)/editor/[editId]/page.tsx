'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Film, Play, Pause, Loader2, Save, Download, Wand2,
  Volume2, Zap, Type, Image, X,
  ZoomIn, ZoomOut, Plus, Maximize2,
  SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Sparkles, KeyRound, Link2Off,
  Music, CheckCircle2, HelpCircle, Mic, ListMusic, Lock, Upload,
  Link2, Library, Trash2, Youtube, Search, AlertCircle, Clock, ArrowRight, Layers,
  Scissors, RotateCcw, RotateCw, Magnet, VolumeX, Eye, EyeOff, PanelBottom, Settings2, LockOpen, Copy, GitMerge, Eraser,
  FolderOpen, BookmarkPlus, Smartphone, Monitor, Square,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  FlipHorizontal2, Video, Shield, Volume1,
  ArrowUp, ArrowDown, Clipboard, ClipboardPaste,
  LayoutPanelLeft, PictureInPicture2, SplitSquareHorizontal, SplitSquareVertical, Layers3,
} from 'lucide-react';
import {
  api,
  apiClient,
  type EditProject,
  type EditTimeline,
  type EditTrack,
  type EditItem,
  type EditItemProperties,
  type EditItemFilters,
  type TransitionType,
  type EditItemTransition,
  type TextAnimType,
  type EditKeyframe,
  type MediaBinEntry,
  type RenderPreset,
  type RenderStatus,
  type EditExportOptions,
  type RenderFormat,
  type RenderQuality,
  type VoiceLibraryEntry,
  type MusicTrack,
  type LibraryVideo,
  type LibraryVideosPage,
} from '@/lib/api';
import { JobErrorCard } from '@/components/job-error-card';
import { usePlanGate, useIsAdmin, planAtLeast, triggerUpgradeSheet, ProButton } from '@/components/plan-gate';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const TRACK_H = 40; // px, also min touch target height
const LABEL_W = 96; // px — matches w-24 track label width
const SNAP_MS = 200; // snap threshold in ms at 40px/s
const TRACK_COLORS: Record<string, string> = {
  VIDEO: 'bg-violet-600/80 border-violet-700 text-white',
  AUDIO: 'bg-teal-500/80 border-teal-600 text-white',
  TEXT: 'bg-amber-400/80 border-amber-500 text-gray-900',
};
// Linked audio clips (extracted from video) use a slightly different shade to distinguish
const LINKED_AUDIO_COLOR = 'bg-teal-600/90 border-teal-700 text-white';

function msToX(ms: number, pxPerSec: number): number {
  return (ms / 1000) * pxPerSec;
}
function xToMs(px: number, pxPerSec: number): number {
  return (px / pxPerSec) * 1000;
}

/** Media-bin asset kinds → timeline item kind. VOICE/MUSIC are audio-only. */
function binKindToItemKind(kind: string): 'VIDEO' | 'IMAGE' | 'AUDIO' {
  if (kind === 'AUDIO' || kind === 'VOICE' || kind === 'MUSIC') return 'AUDIO';
  if (kind === 'IMAGE') return 'IMAGE';
  return 'VIDEO';
}

// Signed media URLs let the <video> element stream straight from the API
// without needing an Authorization header. Cached per asset version and
// refreshed shortly before expiry.
const signedUrlCache = new Map<string, { url: string; expiresAtMs: number }>();

function useSignedMediaUrl(versionId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!versionId) return null;
    const hit = signedUrlCache.get(versionId);
    return hit && hit.expiresAtMs - Date.now() > 30_000 ? hit.url : null;
  });
  useEffect(() => {
    if (!versionId) { setUrl(null); return; }
    const hit = signedUrlCache.get(versionId);
    if (hit && hit.expiresAtMs - Date.now() > 30_000) { setUrl(hit.url); return; }
    let cancelled = false;
    void api.media.versionSignedUrl(versionId).then((r) => {
      // r.data.url is API-relative: "/api/v1/media/versions/xxx/file?exp=…&sig=…"
      // apiClient.defaults.baseURL is "/api/proxy" in the browser — a relative
      // path that new URL() cannot parse and would throw. Rewrite directly.
      const raw: string = r.data.url;
      const abs = raw.startsWith('/api/v1/')
        ? raw.replace('/api/v1/', '/api/proxy/')
        : raw;
      signedUrlCache.set(versionId, { url: abs, expiresAtMs: new Date(r.data.expiresAt).getTime() });
      if (!cancelled) setUrl(abs);
    }).catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [versionId]);
  return url;
}

// ── Secondary video layer player ──────────────────────────────────────────────
// Wraps a single secondary-track item in its own component so `useSignedMediaUrl`
// is called as a hook at the component level (React rules of hooks). The parent
// page registers each <video> element via `onRegister` so the rAF tick can sync
// position and play/pause without going through React state.
function SecondaryVideoPlayer({
  item,
  versionId,
  currentTimeMs,
  isSelected,
  onSelect,
  onRegister,
  onUpdateProps,
  previewContainerRef,
  zIndexBase = 10,
}: {
  item: EditItem;
  versionId: string | null;
  currentTimeMs: number;
  isSelected: boolean;
  onSelect: () => void;
  onRegister: (itemId: string, el: HTMLVideoElement | null, item: EditItem) => void;
  onUpdateProps: (itemId: string, updates: Partial<EditItemProperties>, skipHistory?: boolean) => void;
  previewContainerRef: { current: HTMLDivElement | null };
  zIndexBase?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = useSignedMediaUrl(versionId);

  useEffect(() => {
    const v = videoRef.current;
    if (v) onRegister(item.id, v, item);
    return () => { onRegister(item.id, null, item); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (src && v) onRegister(item.id, v, item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) onRegister(item.id, v, item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.sourceInMs, item.timelineStartMs, item.timelineEndMs, item.properties?.speed]);

  const x = item.properties?.x ?? 50;
  const y = item.properties?.y ?? 50;
  const scale = item.properties?.scale ?? 0.35;
  const opacity = clamp(item.properties?.opacity ?? 1, 0, 1);

  if (item.properties?.hidden) return null;

  function makeResizeHandler(corner: 'se' | 'sw' | 'ne' | 'nw') {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const rect = previewContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX, startScale = scale;
      const dir = corner === 'se' || corner === 'ne' ? 1 : -1;
      const onMove = (ev: PointerEvent) => {
        const dx = ((ev.clientX - startX) / rect.width) * 2 * dir;
        onUpdateProps(item.id, { scale: clamp(startScale + dx, 0.05, 1.5) }, true);
      };
      const onUp = () => { el.removeEventListener('pointermove', onMove as EventListener); };
      el.addEventListener('pointermove', onMove as EventListener);
      el.addEventListener('pointerup', onUp, { once: true });
    };
  }

  return (
    <div
      className={`absolute overflow-visible rounded select-none ${isSelected ? 'ring-2 ring-yellow-400' : 'ring-1 ring-white/20 hover:ring-white/50'}`}
      style={{
        left: `${x}%`, top: `${y}%`,
        width: `${scale * 100}%`, aspectRatio: '16/9',
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 50 : zIndexBase,
        opacity,
        cursor: 'move',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
        e.stopPropagation();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        onSelect();
        const rect = previewContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startX = e.clientX, startY = e.clientY;
        const startXPct = x, startYPct = y;
        const onMove = (ev: PointerEvent) => {
          const dx = ((ev.clientX - startX) / rect.width) * 100;
          const dy = ((ev.clientY - startY) / rect.height) * 100;
          onUpdateProps(item.id, { x: clamp(startXPct + dx, 0, 100), y: clamp(startYPct + dy, 0, 100) }, true);
        };
        const onUp = () => { el.removeEventListener('pointermove', onMove as EventListener); };
        el.addEventListener('pointermove', onMove as EventListener);
        el.addEventListener('pointerup', onUp, { once: true });
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="w-full h-full overflow-hidden rounded">
        <video
          ref={videoRef}
          src={src ?? undefined}
          className="w-full h-full object-cover pointer-events-none"
          playsInline
          muted
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (!v) return;
            const sourceSec = Math.max(0, ((item.sourceInMs ?? 0) + (currentTimeMs - item.timelineStartMs)) / 1000);
            v.currentTime = sourceSec;
          }}
        />
        {!src && (
          <div className="absolute inset-0 bg-violet-900/80 flex items-center justify-center gap-1 pointer-events-none">
            <Film className="w-4 h-4 text-violet-300" />
            <span className="text-violet-200 text-[10px] font-semibold">Loading…</span>
          </div>
        )}
      </div>
      {/* 4-corner resize handles — visible when selected */}
      {isSelected && (
        <>
          {/* SE */}
          <div data-resize-handle="true" title="Drag to resize"
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-yellow-400 rounded-sm cursor-se-resize flex items-center justify-center z-10"
            onPointerDown={makeResizeHandler('se')}>
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1 7L7 1M4 7L7 4" stroke="black" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          {/* SW */}
          <div data-resize-handle="true" title="Drag to resize"
            className="absolute -bottom-2 -left-2 w-4 h-4 bg-yellow-400 rounded-sm cursor-sw-resize flex items-center justify-center z-10"
            onPointerDown={makeResizeHandler('sw')}>
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M7 7L1 1M4 7L1 4" stroke="black" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          {/* NE */}
          <div data-resize-handle="true" title="Drag to resize"
            className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-sm cursor-ne-resize flex items-center justify-center z-10"
            onPointerDown={makeResizeHandler('ne')}>
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1 7L7 1M7 4L7 1L4 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          {/* NW */}
          <div data-resize-handle="true" title="Drag to resize"
            className="absolute -top-2 -left-2 w-4 h-4 bg-yellow-400 rounded-sm cursor-nw-resize flex items-center justify-center z-10"
            onPointerDown={makeResizeHandler('nw')}>
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M7 7L1 1M1 4L1 1L4 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtLibDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: '#f3f4f6', text: '#4b5563' },
  RENDERING: { bg: '#eff6ff', text: '#1d4ed8' },
  READY:     { bg: '#ecfdf5', text: '#065f46' },
  FAILED:    { bg: '#fef2f2', text: '#b91c1c' },
};

// ── Library Drawer ────────────────────────────────────────────────────────────

function LibraryDrawer({
  onClose,
  onSelect,
  onSelectProjectEntry,
  selecting,
}: {
  onClose: () => void;
  onSelect: (video: LibraryVideo) => void;
  onSelectProjectEntry?: (entry: MediaBinEntry) => void;
  selecting: string | null;
}) {
  const [tab, setTab] = useState<'social' | 'project'>('social');
  const [q, setQ] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ── Social tab: YouTube channel videos ────────────────────────────────────
  const { data: channels = [] } = useQuery<Array<{ id: string; title: string; thumbnailUrl?: string | null }>>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
    staleTime: 120_000,
  });
  const channelId = channels[0]?.id ?? '';
  const { data: pageData, isLoading: videosLoading, error: videosError } = useQuery<LibraryVideosPage>({
    queryKey: ['library-videos', channelId, q],
    queryFn: () => api.library.listVideos(channelId, { q: q || undefined, sort: 'date' }).then((r) => r.data),
    enabled: !!channelId && tab === 'social',
    staleTime: 60_000,
  });
  const videos: LibraryVideo[] = pageData?.data ?? [];

  // ── From Projects tab ─────────────────────────────────────────────────────
  const { data: projects = [], isLoading: projectsLoading } = useQuery<EditProject[]>({
    queryKey: ['editor-mine'],
    queryFn: () => api.editor.listMine().then((r) => (Array.isArray(r.data) ? r.data : [])),
    staleTime: 60_000,
    enabled: tab === 'project',
  });
  const { data: projectBin = [], isLoading: binLoading } = useQuery<MediaBinEntry[]>({
    queryKey: ['editor-media-bin', selectedProjectId],
    queryFn: () => api.editor.mediaBin(selectedProjectId!).then((r) => (Array.isArray(r.data) ? r.data : [])),
    staleTime: 30_000,
    enabled: tab === 'project' && !!selectedProjectId,
  });
  const projectSourceEntries = projectBin.filter(
    (e) => ['VIDEO', 'RENDER_SOURCE', 'SHORTS_SOURCE_VIDEO', 'EDIT_RENDER'].includes(e.kind),
  );
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import from library"
        className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <Library className="w-4 h-4 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-sm leading-tight">Import from Library</h2>
            <p className="text-xs text-gray-400 mt-0.5">Social media channels or your SozialZynk projects</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4">
          <button
            type="button"
            onClick={() => { setTab('social'); setSelectedProjectId(null); }}
            className={`text-xs font-semibold py-2.5 px-3 border-b-2 transition-colors ${tab === 'social' ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Social Media
          </button>
          <button
            type="button"
            onClick={() => { setTab('project'); setQ(''); }}
            className={`text-xs font-semibold py-2.5 px-3 border-b-2 transition-colors ${tab === 'project' ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            From Project
          </button>
        </div>

        {/* ── Social Media tab ── */}
        {tab === 'social' && (
          <>
            {!!channelId && (
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search videos…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {!channelId && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Youtube className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No channel connected</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect a YouTube channel in Settings to browse your videos here.
                  </p>
                </div>
              )}
              {!!channelId && videosLoading && (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading videos…</span>
                </div>
              )}
              {!!channelId && videosError && (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Could not load videos.</span>
                </div>
              )}
              {!!channelId && !videosLoading && videos.length === 0 && !videosError && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Film className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-sm">No videos found{q ? ' for that search' : ''}.</p>
                </div>
              )}
              {videos.map((v) => {
                const isSel = selecting === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelect(v)}
                    disabled={!!selecting}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all text-left disabled:opacity-60 group"
                  >
                    <div className="w-24 shrink-0 rounded-lg overflow-hidden bg-gray-900 relative" style={{ aspectRatio: '16/9' }}>
                      {v.thumbnailUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Film className="w-5 h-5 text-gray-600" /></div>}
                      {v.durationMs > 0 && (
                        <span className="absolute bottom-1 right-1 text-[9px] font-mono text-white bg-black/70 rounded px-1">
                          {fmtLibDuration(v.durationMs)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">{v.title}</p>
                      {v.publishedAt && <p className="text-[11px] text-gray-400 mt-1">{relativeTime(v.publishedAt)}</p>}
                    </div>
                    <div className="shrink-0 pt-1">
                      {isSel
                        ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        : (
                          <span className="text-[11px] font-semibold text-gray-400 group-hover:text-gray-700 transition-colors flex items-center gap-0.5">
                            Import <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── From Project tab ── */}
        {tab === 'project' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {selectedProjectId ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(null)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500 shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <p className="text-xs font-semibold text-gray-700 truncate">{selectedProject?.title ?? 'Project'}</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                  {binLoading && (
                    <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading files…</span>
                    </div>
                  )}
                  {!binLoading && projectSourceEntries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Film className="w-8 h-8 text-gray-200 mb-2" />
                      <p className="text-sm">No video files in this project.</p>
                    </div>
                  )}
                  {projectSourceEntries.map((entry) => {
                    const isSel = selecting === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onSelectProjectEntry?.(entry)}
                        disabled={!!selecting || !entry.versionId}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all text-left disabled:opacity-50 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{entry.label}</p>
                          {(entry.durationMs ?? 0) > 0 && (
                            <p className="text-[11px] text-gray-400">{fmtLibDuration(entry.durationMs!)}</p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {isSel
                            ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            : (
                              <span className="text-[11px] font-semibold text-gray-400 group-hover:text-gray-700 transition-colors flex items-center gap-0.5">
                                Add <ArrowRight className="w-3 h-3" />
                              </span>
                            )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                {projectsLoading && (
                  <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading projects…</span>
                  </div>
                )}
                {!projectsLoading && projects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Clapperboard className="w-8 h-8 text-gray-200 mb-2" />
                    <p className="text-sm">No other projects found.</p>
                  </div>
                )}
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <Clapperboard className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.title}</p>
                      <p className="text-[11px] text-gray-400">{relativeTime(p.lastEditedAt)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── History Drawer (My Edits — Video Editor) ─────────────────────────────────

function HistoryDrawer({
  currentEditId,
  onClose,
  onNew,
}: {
  currentEditId: string;
  onClose: () => void;
  onNew: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editSearch, setEditSearch] = useState('');

  const { data: edits = [], refetch } = useQuery<EditProject[]>({
    queryKey: ['editor-mine-list'],
    queryFn: () => api.editor.listMine().then((r) => {
      const arr = Array.isArray(r.data) ? r.data : [];
      return arr.slice().sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime());
    }),
    staleTime: 10_000,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleDelete(id: string, isCurrent: boolean) {
    setDeleting(id);
    try {
      await api.editor.deleteProject(id);
      if (isCurrent) {
        const remaining = edits.filter((e) => e.id !== id);
        const next = remaining[0];
        router.push(next ? `/editor/${next.id}` : '/editor');
        onClose();
      } else {
        void refetch();
      }
    } catch { /* silently ignore */ } finally {
      setDeleting(null);
    }
  }

  const q = editSearch.trim().toLowerCase();
  const filteredEdits = q ? edits.filter((p) => p.title.toLowerCase().includes(q)) : edits;
  const totalCount = edits.length;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="w-80 sm:w-96 bg-white h-full flex flex-col shadow-xl" role="dialog" aria-modal="true" aria-label="My edits">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Film className="w-4 h-4 text-brand-500" />
          <p className="flex-1 font-semibold text-gray-800 text-sm">My Edits</p>
          <span className="text-[10px] text-gray-400 font-medium">{totalCount} total</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 ml-1" aria-label="Close my edits">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-3 space-y-2 border-b border-gray-100">
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Edit
          </button>
          {totalCount > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={editSearch}
                onChange={(e) => setEditSearch(e.target.value)}
                placeholder="Search all edits…"
                className="w-full pl-7 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400 bg-gray-50"
              />
              {editSearch && (
                <button onClick={() => setEditSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
          {/* ── Video Editor section ─────────────────────────────────────────── */}
          {filteredEdits.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-1.5">Video Editor</p>
              <div className="space-y-1.5">
                {filteredEdits.map((p) => {
                  const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS['DRAFT']!;
                  const isCurrent = p.id === currentEditId;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors group ${isCurrent ? 'border-brand-200 bg-brand-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                    >
                      <button
                        type="button"
                        onClick={() => { router.push(`/editor/${p.id}`); onClose(); }}
                        className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCurrent ? 'bg-brand-100' : 'bg-gray-100'}`}>
                          <Film className={`w-3.5 h-3.5 ${isCurrent ? 'text-brand-600' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-brand-800' : 'text-gray-800'}`}>{p.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-gray-400" />
                            <span className="text-[10px] text-gray-400">{relativeTime(p.lastEditedAt)}</span>
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: sc.bg, color: sc.text }}>
                              {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={deleting === p.id}
                        onClick={() => void handleDelete(p.id, isCurrent)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                        title="Delete this edit"
                      >
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {totalCount === 0 && !editSearch && (
            <p className="text-xs text-gray-400 text-center py-8">No edits yet — create one above.</p>
          )}
          {filteredEdits.length === 0 && editSearch ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Search className="w-8 h-8 text-gray-200" />
              <p className="text-xs text-gray-400">No edits match <strong>&quot;{editSearch}&quot;</strong></p>
              <button onClick={() => setEditSearch('')} className="text-[11px] text-brand-500 hover:underline">Clear search</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Saved Versions (Snapshots) ────────────────────────────────────────────────

type SnapshotEntry = {
  id: string;
  name: string;
  savedAt: string;
  timeline: EditTimeline;
  movedAt?: string;
};

function SnapshotSaveDialog({
  defaultName,
  onSave,
  onClose,
}: {
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookmarkPlus className="w-4 h-4 text-brand-600 shrink-0" />
          <p className="flex-1 font-bold text-gray-800 text-sm">Save version</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Version name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }}
            placeholder="e.g. Rough cut v1, Final draft…"
            maxLength={80}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
          />
          <p className="text-[11px] text-gray-400">
            Saved locally in this browser. Load anytime from <strong>Private Drafts</strong>.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) onSave(name.trim()); }}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 font-medium"
          >
            Save version
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionsDrawer({
  snapshots,
  onSaveNew,
  onLoad,
  onDelete,
  onMove,
  onClose,
}: {
  snapshots: SnapshotEntry[];
  onSaveNew: () => void;
  onLoad: (s: SnapshotEntry) => void;
  onDelete: (id: string) => void;
  onMove: (s: SnapshotEntry) => void;
  onClose: () => void;
}) {
  const [vSearch, setVSearch] = useState('');
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = vSearch.trim()
    ? [...snapshots].reverse().filter((s) => s.name.toLowerCase().includes(vSearch.toLowerCase()))
    : [...snapshots].reverse();

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="w-80 sm:w-96 bg-white h-full flex flex-col shadow-xl" role="dialog" aria-modal="true" aria-label="Private Drafts">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <FolderOpen className="w-4 h-4 text-brand-500 shrink-0" />
          <p className="flex-1 font-semibold text-gray-800 text-sm">Private Drafts</p>
          <span className="text-[10px] text-gray-400 font-medium">{snapshots.length} saved</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 ml-1" aria-label="Close">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-3 space-y-2 border-b border-gray-100">
          <button
            type="button"
            onClick={onSaveNew}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <BookmarkPlus className="w-4 h-4" /> Save current version
          </button>
          {/* Search */}
          {snapshots.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={vSearch}
                onChange={(e) => setVSearch(e.target.value)}
                placeholder="Search versions…"
                className="w-full pl-7 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400 bg-gray-50"
              />
              {vSearch && (
                <button onClick={() => setVSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <p className="px-4 py-2 text-[11px] text-gray-400">
          Saved locally in this browser · Ctrl+Z restores previous state after loading
        </p>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <FolderOpen className="w-10 h-10 text-gray-200" />
              <div>
                <p className="text-sm font-semibold text-gray-500">No saved versions yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click <strong>Save current version</strong> above to create a named snapshot of your timeline.
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Search className="w-8 h-8 text-gray-200" />
              <p className="text-xs text-gray-400">No versions match <strong>&quot;{vSearch}&quot;</strong></p>
              <button onClick={() => setVSearch('')} className="text-[11px] text-brand-500 hover:underline">Clear search</button>
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 p-2.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <BookmarkPlus className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                      {s.movedAt && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                          In My Content
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(s.savedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-10">
                  <button
                    onClick={() => onLoad(s)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-brand-600 text-white rounded-md hover:bg-brand-700 shrink-0"
                  >
                    Load
                  </button>
                  {!s.movedAt ? (
                    <button
                      onClick={() => onMove(s)}
                      className="px-2.5 py-1 text-[11px] font-semibold border border-gray-200 text-gray-600 rounded-md hover:bg-gray-100 shrink-0 flex items-center gap-1"
                      title="Move this draft to My Content → Private"
                    >
                      <ArrowRight className="w-3 h-3" /> Move to Private
                    </button>
                  ) : (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Saved to My Content
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(s.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 ml-auto shrink-0"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Render Export Dialog ──────────────────────────────────────────────────────

const PRESETS: { value: RenderPreset; label: string }[] = [
  { value: '1080P_16_9', label: '1080p 16:9 (Landscape)' },
  { value: '1080P_9_16', label: '1080p 9:16 (Vertical / Shorts)' },
  { value: '720P_16_9', label: '720p 16:9' },
  { value: '1080P_1_1', label: '1080p 1:1 (Square)' },
  { value: 'SOURCE', label: 'Match source' },
];

const FORMATS: { value: RenderFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4 (H.264)' },
  { value: 'webm', label: 'WebM (VP9)' },
];

const QUALITIES: { value: RenderQuality; label: string; hint: string }[] = [
  { value: 'draft', label: 'Draft', hint: 'Fast, lower bitrate — good for review' },
  { value: 'standard', label: 'Standard', hint: 'Balanced quality and file size' },
  { value: 'high', label: 'High', hint: 'Maximum quality, larger file' },
];

function ExportDialog({
  editId,
  projectId,
  projectTitle,
  onClose,
  onBeforeRender,
  onRenderStart,
  onRenderDone,
}: {
  editId: string;
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  /** Called before enqueueing the render job — use this to flush any unsaved timeline changes. */
  onBeforeRender?: () => Promise<void>;
  onRenderStart?: () => void;
  onRenderDone?: () => void;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState<RenderPreset>('1080P_16_9');
  const [format, setFormat] = useState<RenderFormat>('mp4');
  const [quality, setQuality] = useState<RenderQuality>('standard');
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [renderVersionId, setRenderVersionId] = useState<string | null>(null);
  // null = idle, 0-100 = downloading, 101 = done
  const [dlProgress, setDlProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDownload = async () => {
    const url = renderVersionId
      ? `/api/proxy/media/versions/${encodeURIComponent(renderVersionId)}/file`
      : downloadPath;
    if (!url) return;
    setDlProgress(0);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null;
      const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      let indeterminate = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          setDlProgress(Math.min(99, Math.round((received / contentLength) * 100)));
        } else {
          // No content-length header — animate to ~90% then hold
          indeterminate = Math.min(90, indeterminate + Math.random() * 8 + 2);
          setDlProgress(Math.round(indeterminate));
        }
      }
      const blob = new Blob(chunks as unknown as BlobPart[]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setDlProgress(101); // done state — show checkmark
      setTimeout(() => setDlProgress(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
      setDlProgress(null);
    }
  };
  // Publish flow: null=hidden, 'choose'=platform picker, 'account'=account selector, 'details'=fill details
  const [pubStep, setPubStep] = useState<'choose' | 'account' | 'details' | null>(null);
  const [pubPlatform, setPubPlatform] = useState<string | null>(null);
  const [pubChannelId, setPubChannelId] = useState<string | null>(null);
  const [pubTitle, setPubTitle] = useState(projectTitle);
  const [pubDesc, setPubDesc] = useState('');
  const [pubTags, setPubTags] = useState('');
  const [pubVisibility, setPubVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [pubSchedule, setPubSchedule] = useState<'now' | 'later'>('now');
  const [pubScheduledAt, setPubScheduledAt] = useState('');
  const [pubQueuing, setPubQueuing] = useState(false);
  const [pubQueued, setPubQueued] = useState(false);
  const [pubQueueError, setPubQueueError] = useState<string | null>(null);

  // Fetch connected channels when account-selection step is active for YouTube
  const { data: ytChannels = [] } = useQuery<Array<{ id: string; title: string; active: boolean | null }>>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Array<{ id: string; title: string; active: boolean | null }>),
    enabled: pubStep === 'account' && pubPlatform === 'youtube',
  });

  const handleQueuePublish = async () => {
    if (!pubPlatform || !pubChannelId) return;
    setPubQueuing(true);
    setPubQueueError(null);
    try {
      await api.publishing.queueEditor({
        editId,
        channelId: pubChannelId,
        title: pubTitle.trim() || projectTitle,
        description: pubDesc,
        tags: pubTags.split(',').map((t) => t.trim()).filter(Boolean),
        ...(pubSchedule === 'later' && pubScheduledAt
          ? { scheduledAt: new Date(pubScheduledAt).toISOString() }
          : {}),
      });
      setPubQueued(true);
      setTimeout(() => {
        router.push('/publish?tab=publish-center');
        onClose();
      }, 1200);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setPubQueueError(err.response?.data?.message ?? 'Failed to queue for publish');
    } finally {
      setPubQueuing(false);
    }
  };

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPoll(), []);

  const startRender = async () => {
    setSubmitting(true);
    setError(null);
    setRenderStatus(null);
    onRenderStart?.();
    try {
      // Flush any unsaved timeline edits (including effects/filters) to the server
      // before enqueueing the render job. Without this, changes made since the last
      // auto-save would be silently ignored by the render worker.
      if (onBeforeRender) await onBeforeRender();
      const options: EditExportOptions = { preset, format, quality };
      const res = await api.editor.render(editId, options);
      setRenderStatus(res.data.renderStatus);
      // Poll render-status
      pollRef.current = setInterval(async () => {
        try {
          const s = await api.editor.renderStatus(editId);
          setRenderStatus(s.data.renderStatus);
          if (s.data.renderStatus === 'READY') {
            setRenderVersionId((s.data as { renderVersionId?: string }).renderVersionId ?? null);
            setDownloadPath(s.data.downloadPath ?? null);
            stopPoll();
            onRenderDone?.();
          } else if (s.data.renderStatus === 'FAILED') {
            setError('Render failed on the server. Retry or contact support.');
            stopPoll();
            onRenderDone?.();
          }
        } catch { /* keep polling */ }
      }, 4000);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to start render');
      onRenderDone?.();
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Build a download filename hint from the chosen format
  const downloadFilename = `export.${format}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div role="dialog" aria-modal="true" aria-label="Export video" className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <Download className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-semibold text-gray-900 flex-1">Export video</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="export-preset" className="text-sm font-medium text-gray-700 block mb-1.5">Output preset</label>
            <select
              id="export-preset"
              value={preset}
              onChange={(e) => setPreset(e.target.value as RenderPreset)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="export-format" className="text-sm font-medium text-gray-700 block mb-1.5">Format</label>
              <select
                id="export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as RenderFormat)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="export-quality" className="text-sm font-medium text-gray-700 block mb-1.5">Quality</label>
              <select
                id="export-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as RenderQuality)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {QUALITIES.map((q) => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">
            {QUALITIES.find((q) => q.value === quality)?.hint}
          </p>

          {renderStatus && renderStatus !== 'READY' && renderStatus !== 'FAILED' && (
            <div className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              {renderStatus === 'PENDING' || renderStatus === 'QUEUED' ? 'Queued — waiting for worker…' : 'Rendering…'}
            </div>
          )}

          {renderStatus === 'READY' && (renderVersionId || downloadPath) && pubStep === null && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-3">
              <p className="text-sm text-green-800 font-medium">Render complete!</p>
              <div className="flex flex-wrap gap-2">
                <ProButton
                  feature="Download video"
                  type="button"
                  onClick={handleDownload}
                  disabled={dlProgress !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:cursor-default transition-all"
                  style={{ minWidth: 112 }}
                >
                  {dlProgress === null && <><Download className="w-4 h-4" /> Download</>}
                  {dlProgress !== null && dlProgress <= 100 && (() => {
                    const r = 7, circ = 2 * Math.PI * r;
                    const pct = dlProgress;
                    return (
                      <>
                        <svg width="20" height="20" viewBox="0 0 20 20" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                          <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
                          <circle
                            cx="10" cy="10" r={r} fill="none"
                            stroke="white" strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={circ * (1 - pct / 100)}
                            style={{ transition: 'stroke-dashoffset 0.15s ease' }}
                          />
                        </svg>
                        <span className="tabular-nums">{pct}%</span>
                      </>
                    );
                  })()}
                  {dlProgress === 101 && (
                    <>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="9" cy="9" r="8" fill="white" fillOpacity=".2" />
                        <path d="M5 9l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Saved!
                    </>
                  )}
                </ProButton>
                <ProButton
                  feature="Publish to external platform"
                  type="button"
                  onClick={() => setPubStep('choose')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
                >
                  <Zap className="w-4 h-4" /> Send to Publish
                </ProButton>
              </div>
            </div>
          )}

          {/* ── Publish step 1: Platform picker ── */}
          {renderStatus === 'READY' && pubStep === 'choose' && (() => {
            const SOCIAL = [
              { id: 'youtube', label: 'YouTube', bg: '#FF0000', abbr: 'YT' },
              { id: 'instagram', label: 'Instagram', bg: '#E1306C', abbr: 'IG' },
              { id: 'tiktok', label: 'TikTok', bg: '#010101', abbr: 'TK' },
              { id: 'x', label: 'X (Twitter)', bg: '#1A1A1A', abbr: 'X' },
              { id: 'linkedin', label: 'LinkedIn', bg: '#0A66C2', abbr: 'in' },
              { id: 'facebook', label: 'Facebook', bg: '#1877F2', abbr: 'fb' },
            ];
            return (
              <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-4 space-y-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPubStep(null)} className="p-1 rounded-lg hover:bg-white/60 text-gray-500">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold text-brand-900 flex-1">Where do you want to publish?</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">Social Platforms</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SOCIAL.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPubPlatform(p.id); setPubChannelId(null); setPubStep('account'); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-200 hover:border-brand-400 hover:shadow-sm transition-all group"
                      >
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                          style={{ backgroundColor: p.bg }}
                        >{p.abbr}</span>
                        <span className="text-[11px] text-gray-600 font-medium leading-tight text-center">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Publish step 1b: Account selector ── */}
          {renderStatus === 'READY' && pubStep === 'account' && (() => {
            const SOCIAL_LABELS: Record<string, string> = {
              youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok',
              x: 'X (Twitter)', linkedin: 'LinkedIn', facebook: 'Facebook',
            };
            const activeChannels = ytChannels.filter((c) => c.active !== false);
            return (
              <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPubStep('choose')} className="p-1 rounded-lg hover:bg-white/60 text-gray-500">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold text-brand-900 flex-1">
                    Select {SOCIAL_LABELS[pubPlatform ?? ''] ?? pubPlatform} account
                  </p>
                </div>
                {pubPlatform === 'youtube' ? (
                  activeChannels.length === 0 ? (
                    <div className="text-center py-3 space-y-2">
                      <p className="text-sm text-gray-600">No YouTube channels connected.</p>
                      <a href="/channel-access" className="text-xs font-semibold text-brand-600 hover:underline">
                        Connect a channel →
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeChannels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => { setPubChannelId(ch.id); setPubStep('details'); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                            pubChannelId === ch.id
                              ? 'border-brand-400 bg-white shadow-sm font-semibold text-gray-900'
                              : 'border-gray-200 bg-white hover:border-brand-300 text-gray-700'
                          }`}
                        >
                          <span className="w-7 h-7 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">YT</span>
                          <span className="truncate flex-1">{ch.title}</span>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">
                      Direct publishing for {SOCIAL_LABELS[pubPlatform ?? ''] ?? pubPlatform} is coming soon.
                      Your content will be queued for manual publishing.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setPubChannelId('manual'); setPubStep('details'); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-brand-300 text-sm text-gray-700 text-left"
                    >
                      Continue →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Publish step 2: Details form ── */}
          {renderStatus === 'READY' && pubStep === 'details' && (() => {
            const SOCIAL_META: Record<string, { label: string; bg: string; abbr: string }> = {
              youtube: { label: 'YouTube', bg: '#FF0000', abbr: 'YT' },
              instagram: { label: 'Instagram', bg: '#E1306C', abbr: 'IG' },
              tiktok: { label: 'TikTok', bg: '#010101', abbr: 'TK' },
              x: { label: 'X (Twitter)', bg: '#1A1A1A', abbr: 'X' },
              linkedin: { label: 'LinkedIn', bg: '#0A66C2', abbr: 'in' },
              facebook: { label: 'Facebook', bg: '#1877F2', abbr: 'fb' },
            };
            const meta = pubPlatform ? SOCIAL_META[pubPlatform] : null;
            // Minimum 31 min from now for YouTube scheduling
            const minDt = new Date(Date.now() + 31 * 60 * 1000);
            const minDtLocal = new Date(minDt.getTime() - minDt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            return (
              <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPubStep('account')} className="p-1 rounded-lg hover:bg-white/60 text-gray-500">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  {meta && (
                    <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: meta.bg }}>{meta.abbr}</span>
                  )}
                  <p className="text-sm font-semibold text-brand-900 flex-1">
                    Publish to {meta?.label ?? pubPlatform}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Title</label>
                  <input
                    type="text"
                    value={pubTitle}
                    onChange={(e) => setPubTitle(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 bg-white"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
                  <textarea
                    value={pubDesc}
                    onChange={(e) => setPubDesc(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 resize-none bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={pubTags}
                    onChange={(e) => setPubTags(e.target.value)}
                    placeholder="tutorial, vlog, tips"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 bg-white"
                  />
                </div>
                {(pubPlatform === 'youtube' || pubPlatform === 'facebook') && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Visibility</label>
                    <div className="flex gap-2">
                      {(['public', 'unlisted', 'private'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPubVisibility(v)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${pubVisibility === v ? 'border-brand-400 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300'}`}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Scheduling */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">When to publish</label>
                  <div className="flex gap-2 mb-2">
                    {(['now', 'later'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPubSchedule(s)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${pubSchedule === s ? 'border-brand-400 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300'}`}
                      >
                        {s === 'now' ? 'Publish Now' : 'Schedule'}
                      </button>
                    ))}
                  </div>
                  {pubSchedule === 'later' && (
                    <input
                      type="datetime-local"
                      value={pubScheduledAt}
                      min={minDtLocal}
                      onChange={(e) => setPubScheduledAt(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 bg-white"
                    />
                  )}
                </div>
                {pubQueueError && (
                  <p className="text-xs text-red-600">{pubQueueError}</p>
                )}
                {pubQueued && (
                  <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Queued! Redirecting to Publish Hub…
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPubStep('account')}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-white bg-white/50"
                  >Back</button>
                  <button
                    type="button"
                    disabled={!pubTitle.trim() || pubQueuing || pubQueued || (pubSchedule === 'later' && !pubScheduledAt)}
                    onClick={() => void handleQueuePublish()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
                  >
                    {pubQueuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {pubQueuing ? 'Queuing…' : 'Send to Publish Hub'}
                  </button>
                </div>
              </div>
            );
          })()}

          {error && (
            <JobErrorCard
              error={error}
              errorCode="JOB_FAILED"
              onRetry={() => void startRender()}
            />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              {renderStatus === 'READY' ? 'Close' : 'Cancel'}
            </button>
            {!renderStatus && (
              <button
                onClick={() => void startRender()}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Start render
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Editor loading screen ─────────────────────────────────────────────────────

function EditorLoadingScreen() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let v = 0;
    const t = setInterval(() => {
      v = Math.min(90, v + (90 - v) * 0.09 + 0.5);
      setPct(Math.floor(v));
      if (v >= 89.5) clearInterval(t);
    }, 120);
    return () => clearInterval(t);
  }, []);

  const size = 64;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 select-none">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.2s ease-out' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">
          {pct}
        </span>
      </div>
      <p className="text-sm text-gray-500 font-medium">Loading editor…</p>
    </div>
  );
}

// ── Preview loading overlay ───────────────────────────────────────────────────
// Shown while the signed media URL for the active clip is being fetched.
// key={item.id} on the parent forces a remount — and restarts the sim — each
// time the selected clip changes.

function PreviewLoadingOverlay({
  playing, onToggle, unavailable, completed, onHidden,
}: {
  playing: boolean;
  onToggle: () => void;
  /** true = versionId is null or signed URL returned an error; skip loading animation */
  unavailable?: boolean;
  /** true = URL has arrived; animate ring to 100% then call onHidden */
  completed?: boolean;
  onHidden?: () => void;
}) {
  const [timedOut, setTimedOut] = useState(false);
  const [pct, setPct] = useState(0);
  const pctRef = useRef(0);
  const onHiddenRef = useRef(onHidden);
  useEffect(() => { onHiddenRef.current = onHidden; }, [onHidden]);

  // If not immediately unavailable, timeout after 9s → switch to error state
  useEffect(() => {
    if (unavailable) return;
    const id = setTimeout(() => setTimedOut(true), 9000);
    return () => clearTimeout(id);
  }, [unavailable]);

  // Loading: ease ring toward 90% (stops when completed or timed out)
  useEffect(() => {
    if (unavailable || timedOut || completed) return;
    const t = setInterval(() => {
      pctRef.current = Math.min(90, pctRef.current + (90 - pctRef.current) * 0.1 + 0.6);
      setPct(Math.floor(pctRef.current));
      if (pctRef.current >= 89.5) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [unavailable, timedOut, completed]);

  // Completion: sprint from current position to 100%, then call onHidden
  useEffect(() => {
    if (!completed) return;
    const t = setInterval(() => {
      pctRef.current = Math.min(100, pctRef.current + 5);
      setPct(Math.floor(pctRef.current));
      if (pctRef.current >= 100) {
        clearInterval(t);
        setTimeout(() => onHiddenRef.current?.(), 500);
      }
    }, 20);
    return () => clearInterval(t);
  }, [completed]);

  if (unavailable || timedOut) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 z-10">
        <AlertCircle className="w-8 h-8 text-white/30" />
        <div className="text-center">
          <p className="text-[12px] text-white/50 font-medium">Source video unavailable</p>
          <p className="text-[10px] text-white/25 mt-0.5">The original file hasn't been downloaded yet</p>
        </div>
      </div>
    );
  }

  const size = 72;
  const strokeW = 5;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const ringColor = completed ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.85)';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 z-10">
      <button
        onClick={onToggle}
        className="relative hover:opacity-80 transition-opacity"
        aria-label={playing ? 'Pause' : 'Play'}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeW} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={ringColor}
            strokeWidth={strokeW} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.12s linear, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-semibold text-white" style={{ fontSize: 16, letterSpacing: '-0.5px' }}>
            {pct}%
          </span>
        </div>
      </button>
      <p className="text-[11px] text-white/50">
        {completed ? 'Ready!' : 'Loading preview…'}
      </p>
    </div>
  );
}

// ── Circular progress ring ────────────────────────────────────────────────────

function CircularProgress({ pct, size = 36 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.25s ease-out' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-white"
        style={{ fontSize: 8, letterSpacing: '-0.3px' }}
      >
        {Math.min(99, Math.round(pct))}%
      </span>
    </div>
  );
}

// ── Status Tray (background operation toasts) ─────────────────────────────────

function StatusTray({
  toasts,
  savePct,
  onDismiss,
}: {
  toasts: Array<{ id: string; label: string; status: 'pending' | 'success' | 'error'; message?: string }>;
  savePct: number;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-[72px] lg:bottom-4 right-3 z-[70] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-3 py-2.5 rounded-xl shadow-lg border text-sm max-w-[300px] w-full transition-all duration-300 ${
            t.status === 'pending' ? 'bg-gray-900 border-white/10 text-white' :
            t.status === 'success' ? 'bg-green-900 border-green-700/40 text-green-100' :
            'bg-red-900 border-red-700/40 text-red-100'
          }`}
        >
          <span className="shrink-0">
            {t.status === 'pending' && <CircularProgress pct={savePct} />}
            {t.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {t.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs leading-snug truncate">{t.label}</p>
            {t.status === 'pending' && (
              <p className="text-[10px] text-white/40 mt-0.5">{savePct < 90 ? 'Uploading…' : 'Finishing…'}</p>
            )}
            {t.message && <p className="text-[11px] opacity-70 mt-0.5 leading-snug">{t.message}</p>}
          </div>
          {(t.status === 'error' || t.status === 'success') && (
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── AI Edit Dialog ────────────────────────────────────────────────────────────

const AUTO_EDIT_INSTRUCTION =
  'I just opened this video in the editor from Shorts Studio. ' +
  'Use the transcript (if available) to identify filler words, repeated phrases, and long pauses to cut. ' +
  'Then produce an edited timeline that: (1) trims those dead sections using sourceInMs/sourceOutMs and splits the clip where needed, ' +
  '(2) adds a fade-in transition at the start, (3) adds a title text overlay in the first 3 seconds. ' +
  'Apply these changes directly and return the updated timeline JSON now.';

type ChatMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; pendingTimeline?: unknown | null };

// @reason: SpeechRecognition interface is absent from TypeScript's DOM lib (still experimental)
interface SpeechRecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function AiEditDialog({
  editId,
  timeline,
  mediaBin,
  autoSuggest = false,
  onClose,
  onApplyTimeline,
}: {
  editId: string;
  timeline: EditTimeline | null;
  mediaBin: MediaBinEntry[];
  autoSuggest?: boolean;
  onClose: () => void;
  onApplyTimeline: (t: unknown) => void;
}) {
  const [input, setInput] = useState(autoSuggest ? AUTO_EDIT_INSTRUCTION : '');
  const storageKey = `ai-edit-history-${editId}`;
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      return saved ? (JSON.parse(saved) as ChatMsg[]).slice(-50) : [];
    } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('ai-edit-auto-speak') === '1'; } catch { return false; }
  });
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    // @reason: window.SpeechRecognition and webkitSpeechRecognition absent from TS Window type
    const w = typeof window !== 'undefined'
      ? (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
      : null;
    const SR = w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
    if (!SR) { setError('Voice input requires Chrome or Edge.'); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i]?.[0];
        if (alt) parts.push(alt.transcript);
      }
      const transcript = parts.join(' ').trim();
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function speakText(text: string) {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth) return;
    synth.cancel();
    setSpeaking(true);
    synthRef.current = synth;
    const u = new SpeechSynthesisUtterance(text.replace(/[^\x00-\x7F]/g, ' '));
    u.rate = 1.05;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }

  function stopSpeaking() {
    synthRef.current?.cancel();
    setSpeaking(false);
  }

  function toggleAutoSpeak() {
    const next = !autoSpeak;
    setAutoSpeak(next);
    try { localStorage.setItem('ai-edit-auto-speak', next ? '1' : '0'); } catch { /* ignore */ }
    if (!next) stopSpeaking();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Persist history to localStorage whenever messages change (cap at 50)
  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50))); } catch { /* ignore */ }
  }, [messages, storageKey]);

  // Auto-speak last AI reply when voice output is enabled
  useEffect(() => {
    if (!autoSpeak || busy) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') speakText(last.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Build history for the API from current messages array
  const historyForApi = (msgs: ChatMsg[]) =>
    msgs.flatMap<{ role: 'user' | 'assistant'; content: string }>((m) =>
      m.role === 'user'
        ? [{ role: 'user' as const, content: m.text }]
        : [{ role: 'assistant' as const, content: m.text }],
    );

  const submit = async (text?: string, currentMessages?: ChatMsg[]) => {
    const prompt = (text ?? input).trim();
    if (!prompt || busy) return;
    setInput('');
    setError(null);
    const updated: ChatMsg[] = [...(currentMessages ?? messages), { role: 'user', text: prompt }];
    setMessages(updated);
    setBusy(true);
    try {
      const res = await api.editor.editorCopilot(editId, prompt, {
        mediaBin,
        clientTimeline: timeline,
        history: historyForApi(updated.slice(0, -1)), // exclude the message we're sending now
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.data.reply, pendingTimeline: res.data.timeline ?? null },
      ]);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Request failed — please try again.');
      setMessages((prev) => prev.slice(0, -1)); // remove the optimistic user message on error
    } finally {
      setBusy(false);
    }
  };

  // Auto-suggest: fire once when opened from "Video Edit" on an imported video.
  // Wait for mediaBin to load so the AI has file context; fall back after 1.5 s
  // in case the project genuinely has no files yet.
  useEffect(() => {
    if (!autoSuggest || autoRan.current || timeline === undefined) return;
    if (mediaBin.length > 0) {
      autoRan.current = true;
      void submit(AUTO_EDIT_INSTRUCTION, []);
      return;
    }
    const t = setTimeout(() => {
      if (!autoRan.current) {
        autoRan.current = true;
        void submit(AUTO_EDIT_INSTRUCTION, []);
      }
    }, 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSuggest, timeline, mediaBin]);

  const binSummary =
    mediaBin.length === 0
      ? 'No files in Working Files yet'
      : `${mediaBin.length} file${mediaBin.length === 1 ? '' : 's'} available: ${mediaBin
          .slice(0, 3)
          .map((f) => f.label)
          .join(', ')}${mediaBin.length > 3 ? ` +${mediaBin.length - 3} more` : ''}`;

  const SUGGESTIONS = [
    '🔍 Analyze — what needs editing in this video?',
    'Add all files to the timeline',
    'Extend background music to cover the full video',
    '✨ Prepare for publish — add transitions and fade out',
  ];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI edit assistant"
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl flex flex-col overflow-hidden h-dvh sm:h-auto sm:max-h-[90dvh] sm:min-h-[420px]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">AI Edit</p>
            <p className="text-[10px] text-gray-400 truncate">{binSummary}</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); try { localStorage.removeItem(storageKey); } catch { /* ignore */ } }}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"
              title="Clear conversation history"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={toggleAutoSpeak}
            className={`p-1.5 rounded-lg shrink-0 transition-colors ${autoSpeak ? 'bg-brand-100 text-brand-600' : 'text-gray-400 hover:bg-gray-100'}`}
            title={autoSpeak ? 'Voice replies on — click to disable' : 'Voice replies off — click to enable'}
            aria-label="Toggle voice replies"
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {/* Empty state with quick chips */}
          {messages.length === 0 && !busy && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-brand-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">What would you like to edit?</p>
              <p className="text-xs text-gray-400 max-w-[260px] mx-auto mb-4">
                I can see your Working Files and timeline. Ask me to analyze the video, add clips, trim filler words, extend music, or prepare for publish.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void submit(s, [])}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] bg-brand-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm">
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[88%] space-y-2">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                    <div className="flex justify-end mt-1.5 -mb-0.5">
                      <button
                        onClick={() => speaking ? stopSpeaking() : speakText(msg.text)}
                        className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors rounded"
                        title={speaking ? 'Stop' : 'Read aloud'}
                        aria-label="Read message aloud"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {msg.pendingTimeline != null && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-xs text-green-800 flex-1">Timeline changes ready</p>
                      <button
                        onClick={() => onApplyTimeline(msg.pendingTimeline)}
                        className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                <span className="text-xs text-gray-500">Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className="shrink-0 px-4 pt-2 border-t border-gray-100"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
              }}
              rows={2}
              placeholder="Add all clips to the timeline, extend music to cover the whole video…  (Enter to send)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 resize-none leading-relaxed"
            />
            <button
              onClick={toggleVoice}
              type="button"
              disabled={busy}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 mb-0.5 transition-colors disabled:opacity-40 ${
                listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              title={listening ? 'Listening… click to stop' : 'Voice input (Chrome / Edge)'}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() => void submit()}
              disabled={!input.trim() || busy}
              className="flex items-center justify-center w-9 h-9 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 shrink-0 mb-0.5"
              aria-label="Send"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Audio Panel (shown in Inspector when nothing is selected) ──────────────

function AIAudioPanel({
  editId,
  onAddToTimeline,
}: {
  editId: string;
  onAddToTimeline: (entry: MediaBinEntry) => void;
}) {
  const [tab, setTab] = useState<'voice' | 'music'>('voice');

  // Voice state
  const [voices, setVoices] = useState<VoiceLibraryEntry[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [selectedVoiceSource, setSelectedVoiceSource] = useState<'elevenlabs' | 'openai'>('openai');
  const [script, setScript] = useState('');
  const [voiceGenerating, setVoiceGenerating] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceDone, setVoiceDone] = useState(false);

  // Music state
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [musicAiPicking, setMusicAiPicking] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [musicVibe, setMusicVibe] = useState('');

  useEffect(() => {
    setVoicesLoading(true);
    api.voice.library()
      .then((r) => {
        const list = r.data?.voices ?? [];
        setVoices(list);
        const first = list[0];
        if (first) { setSelectedVoiceId(first.id); setSelectedVoiceSource(first.source); }
      })
      .catch(() => {})
      .finally(() => setVoicesLoading(false));
  }, []);

  useEffect(() => {
    setMusicLoading(true);
    api.music.list()
      .then((r) => setMusicTracks(r.data?.tracks ?? []))
      .catch(() => {})
      .finally(() => setMusicLoading(false));
  }, []);

  async function handleGenerateVoice() {
    if (!script.trim() || !selectedVoiceId) return;
    setVoiceGenerating(true); setVoiceError(''); setVoiceDone(false);
    try {
      const { data } = await api.editor.generateVoice(editId, { text: script.trim(), voiceId: selectedVoiceId, source: selectedVoiceSource });
      onAddToTimeline(data);
      setVoiceDone(true);
      setScript('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setVoiceError(msg ?? 'Voiceover generation failed. Check your ElevenLabs / OpenAI key in Settings → AI Providers.');
    } finally {
      setVoiceGenerating(false);
    }
  }

  async function handleAiPickMusic() {
    setMusicAiPicking(true); setMusicError('');
    try {
      const { data } = await api.music.autoSelect(musicVibe || 'upbeat background music for YouTube');
      if (data.track) setSelectedMusic(data.track);
      else setMusicError('No matching track in your library. Add music tracks via Studio → Music first.');
    } catch {
      setMusicError('AI pick failed. Try again.');
    } finally {
      setMusicAiPicking(false);
    }
  }

  function addMusicToTimeline() {
    if (!selectedMusic) return;
    onAddToTimeline({
      id: selectedMusic.id,
      kind: 'MUSIC',
      label: selectedMusic.title,
      durationMs: Math.round(selectedMusic.duration * 1000),
      previewPath: selectedMusic.fileUrl,
      versionId: null,
    });
    setSelectedMusic(null);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 shrink-0">
        {(['voice', 'music'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${tab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'voice' ? <><Mic className="w-3.5 h-3.5" /> Voice</> : <><ListMusic className="w-3.5 h-3.5" /> Music</>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'voice' && (
          <>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Generate an AI voiceover and add it directly to the timeline.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Voice</label>
              {voicesLoading ? (
                <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading voices…</p>
              ) : voices.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">No voices available. Add ElevenLabs or OpenAI keys in Settings → AI Providers.</p>
              ) : (
                <select
                  value={selectedVoiceId}
                  onChange={(e) => {
                    setSelectedVoiceId(e.target.value);
                    const v = voices.find((vv) => vv.id === e.target.value);
                    if (v) setSelectedVoiceSource(v.source);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.source === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}{v.gender ? ` · ${v.gender}` : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Script / Text</label>
              <textarea
                value={script}
                onChange={(e) => { setScript(e.target.value); setVoiceDone(false); setVoiceError(''); }}
                placeholder="Paste your voiceover script here…"
                rows={6}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            {voiceError && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{voiceError}</p>}
            {voiceDone && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Voiceover added to timeline!
              </p>
            )}
            <button
              type="button"
              disabled={voiceGenerating || !script.trim() || !selectedVoiceId}
              onClick={() => { void handleGenerateVoice(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff', boxShadow: '0 2px 12px rgba(55,65,81,0.3)' }}
            >
              {voiceGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
              {voiceGenerating ? 'Generating…' : 'Generate & Add to Timeline'}
            </button>
          </>
        )}

        {tab === 'music' && (
          <>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              AI picks the best background track from your library, or browse manually.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Describe the vibe (optional)</label>
              <input
                type="text"
                value={musicVibe}
                onChange={(e) => setMusicVibe(e.target.value)}
                placeholder="e.g. energetic tech tutorial, calm lo-fi"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <button
              type="button"
              disabled={musicAiPicking}
              onClick={() => { void handleAiPickMusic(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-brand-300 text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              {musicAiPicking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {musicAiPicking ? 'AI picking…' : 'AI Pick Music'}
            </button>
            {musicError && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{musicError}</p>}
            {musicTracks.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Or pick from library</label>
                <select
                  value={selectedMusic?.id ?? ''}
                  onChange={(e) => setSelectedMusic(musicTracks.find((m) => m.id === e.target.value) ?? null)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <option value="">— select a track —</option>
                  {musicTracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}{t.artist ? ` — ${t.artist}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            {musicLoading && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading library…</p>}
            {selectedMusic && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-800">{selectedMusic.title}</p>
                {selectedMusic.artist && <p className="text-[11px] text-gray-500">{selectedMusic.artist}</p>}
                <div className="flex gap-1.5 flex-wrap">
                  {(selectedMusic.mood ?? []).slice(0, 3).map((m) => (
                    <span key={m} className="text-[10px] bg-brand-100 text-brand-700 rounded px-1.5 py-0.5">{m}</span>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={!selectedMusic}
              onClick={addMusicToTimeline}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff', boxShadow: '0 2px 12px rgba(55,65,81,0.3)' }}
            >
              <ListMusic className="w-3.5 h-3.5" />
              Add to Timeline
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inspector Panel ───────────────────────────────────────────────────────────

function Inspector({
  item,
  onChange,
  onDelete,
  onDetachAudio,
  currentTimeMs,
  editId,
  onAddToTimeline,
  onSplit,
  onMerge,
  onDuplicate,
  onRippleDelete,
  canMerge,
  onCopy,
  onPaste,
}: {
  item: EditItem | null;
  onChange: (patch: Partial<EditItem>) => void;
  onDelete?: () => void;
  onDetachAudio?: () => void;
  currentTimeMs: number;
  editId: string;
  onAddToTimeline: (entry: MediaBinEntry) => void;
  onSplit?: () => void;
  onMerge?: () => void;
  onDuplicate?: () => void;
  onRippleDelete?: () => void;
  canMerge?: boolean;
  onCopy?: () => void;
  onPaste?: () => void;
}) {
  // Collapsible section open states
  const [effectsOpen, setEffectsOpen] = useState(true);
  const [transitionOpen, setTransitionOpen] = useState(true);
  const [textAnimOpen, setTextAnimOpen] = useState(true);
  const [keyframesOpen, setKeyframesOpen] = useState(true);
  const [audioOpen, setAudioOpen] = useState(true);
  const [aiAudioOpen, setAiAudioOpen] = useState(true);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceDone, setEnhanceDone] = useState(false);
  const [enhanceError, setEnhanceError] = useState('');
  const [enhanceSteps, setEnhanceSteps] = useState({ trimSilence: true, denoise: true, normalize: true });

  if (!item) {
    return <AIAudioPanel editId={editId} onAddToTimeline={onAddToTimeline} />;
  }

  const props = item.properties ?? {};

  // @reason: EditItemProperties keys are statically known; the dynamic key is always a valid property name.
  const setProp = (key: keyof EditItemProperties, value: number | string | boolean | EditItemFilters | EditItemTransition | TextAnimType | EditKeyframe[] | undefined) => {
    onChange({ properties: { ...props, [key]: value } });
  };

  const filters = props.filters ?? {};

  const setFilter = (key: keyof EditItemFilters, value: number | boolean) => {
    onChange({ properties: { ...props, filters: { ...filters, [key]: value } } });
  };

  const resetFilters = () => {
    onChange({ properties: { ...props, filters: undefined } });
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* ── Item info ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {item.kind} item
        </p>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>Start: {fmtMs(item.timelineStartMs)}</p>
          <p>End: {fmtMs(item.timelineEndMs)}</p>
          <p>Duration: {fmtMs(item.timelineEndMs - item.timelineStartMs)}</p>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            title="Remove this item from the timeline (Delete)"
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5" /> Remove from timeline
          </button>
        )}
      </div>

      {/* ── Edit Actions ── */}
      {(onSplit || onMerge || onDuplicate || onRippleDelete) && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Edit Actions</p>
          <div className="flex flex-wrap gap-1.5">
            {onSplit && (
              <button onClick={onSplit} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <Scissors className="w-3 h-3" /> Split (S)
              </button>
            )}
            {onMerge && (
              <button onClick={onMerge} disabled={!canMerge} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                <GitMerge className="w-3 h-3" /> Merge (J)
              </button>
            )}
            {onDuplicate && (
              <button onClick={onDuplicate} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <Copy className="w-3 h-3" /> Dupe (D)
              </button>
            )}
            {onRippleDelete && (
              <button onClick={onRippleDelete} className="flex items-center gap-1 px-2.5 py-1.5 border border-red-100 bg-red-50 rounded-lg text-xs text-red-600 hover:bg-red-100">
                <Eraser className="w-3 h-3" /> Ripple Del
              </button>
            )}
            {onCopy && (
              <button onClick={onCopy} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <Clipboard className="w-3 h-3" /> Copy (C)
              </button>
            )}
            {onPaste && (
              <button onClick={onPaste} className="flex items-center gap-1 px-2.5 py-1.5 border border-brand-200 bg-brand-50 rounded-lg text-xs text-brand-700 hover:bg-brand-100">
                <ClipboardPaste className="w-3 h-3" /> Paste (V)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Layout presets (VIDEO / IMAGE) ── */}
      {(item.kind === 'VIDEO' || item.kind === 'IMAGE') && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Layout</p>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { label: 'Full', icon: <LayoutPanelLeft className="w-3.5 h-3.5" />, x: 50, y: 50, scale: 1 },
              { label: 'PiP ↗', icon: <PictureInPicture2 className="w-3.5 h-3.5" />, x: 80, y: 20, scale: 0.35 },
              { label: 'PiP ↘', icon: <PictureInPicture2 className="w-3.5 h-3.5" />, x: 80, y: 80, scale: 0.35 },
              { label: '← Left', icon: <SplitSquareHorizontal className="w-3.5 h-3.5" />, x: 25, y: 50, scale: 0.5 },
              { label: 'Right →', icon: <SplitSquareHorizontal className="w-3.5 h-3.5" />, x: 75, y: 50, scale: 0.5 },
              { label: 'Top ↑', icon: <SplitSquareVertical className="w-3.5 h-3.5" />, x: 50, y: 25, scale: 1 },
              { label: 'Bottom ↓', icon: <SplitSquareVertical className="w-3.5 h-3.5" />, x: 50, y: 75, scale: 1 },
              { label: 'Overlay', icon: <Layers3 className="w-3.5 h-3.5" />, x: 50, y: 50, scale: 0.7 },
            ] as { label: string; icon: React.ReactNode; x: number; y: number; scale: number }[]).map((preset) => {
              const active = Math.abs((props.x ?? 50) - preset.x) < 1 && Math.abs((props.y ?? 50) - preset.y) < 1 && Math.abs((props.scale ?? 1) - preset.scale) < 0.02;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    onChange({ properties: { ...props, x: preset.x, y: preset.y, scale: preset.scale } });
                  }}
                  className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-gray-50'}`}
                >
                  {preset.icon}
                  {preset.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Position applies during render. Preview shows approximation.</p>
        </div>
      )}

      {/* ── Volume (AUDIO / VIDEO) ── */}
      {(item.kind === 'AUDIO' || item.kind === 'VIDEO') && (
        <div>
          <label htmlFor="insp-volume" className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1.5">
            <Volume2 className="w-3.5 h-3.5" /> Volume
          </label>
          <input
            id="insp-volume"
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={props.volume ?? 1}
            onChange={(e) => setProp('volume', parseFloat(e.target.value))}
            className="w-full accent-brand-600"
          />
          <p className="text-[11px] text-gray-500 text-right">{Math.round((props.volume ?? 1) * 100)}%</p>
        </div>
      )}

      {/* ── Speed (VIDEO) ── */}
      {item.kind === 'VIDEO' && (
        <div>
          <label htmlFor="insp-speed" className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1.5">
            <Zap className="w-3.5 h-3.5" /> Speed
          </label>
          <input
            id="insp-speed"
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={props.speed ?? 1}
            onChange={(e) => setProp('speed', parseFloat(e.target.value))}
            className="w-full accent-brand-600"
          />
          <p className="text-[11px] text-gray-500 text-right">{(props.speed ?? 1).toFixed(2)}×</p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {[0.25, 0.5, 0.75, 1, 1.5, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setProp('speed', s)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${Math.abs((props.speed ?? 1) - s) < 0.01 ? 'border-brand-500 bg-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Reverse (VIDEO) ── */}
      {item.kind === 'VIDEO' && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <FlipHorizontal2 className="w-3.5 h-3.5" /> Reverse
          </label>
          <button
            onClick={() => setProp('reverse', !(props.reverse ?? false))}
            className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${props.reverse ? 'border-brand-500 bg-brand-100 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            {props.reverse ? 'On' : 'Off'}
          </button>
        </div>
      )}

      {/* ── Detach Audio (VIDEO) ── */}
      {item.kind === 'VIDEO' && onDetachAudio && (
        <div>
          <button
            onClick={onDetachAudio}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 active:bg-gray-100"
          >
            <Link2Off className="w-3.5 h-3.5" /> Detach Audio
          </button>
          <p className="text-[10px] text-gray-400 mt-1 text-center">Extracts audio as MP3 onto the Audio track</p>
        </div>
      )}

      {/* ── Opacity / Scale / Position (VIDEO / IMAGE) ── */}
      {(item.kind === 'VIDEO' || item.kind === 'IMAGE') && (
        <>
          <div>
            <label htmlFor="insp-opacity" className="text-xs font-medium text-gray-700 block mb-1.5">Opacity</label>
            <input
              id="insp-opacity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={props.opacity ?? 1}
              onChange={(e) => setProp('opacity', parseFloat(e.target.value))}
              className="w-full accent-brand-600"
            />
            <p className="text-[11px] text-gray-500 text-right">{Math.round((props.opacity ?? 1) * 100)}%</p>
          </div>
          <div>
            <label htmlFor="insp-scale" className="text-xs font-medium text-gray-700 block mb-1.5">Scale</label>
            <input
              id="insp-scale"
              type="range"
              min={0.1}
              max={3}
              step={0.01}
              value={props.scale ?? 1}
              onChange={(e) => setProp('scale', parseFloat(e.target.value))}
              className="w-full accent-brand-600"
            />
            <p className="text-[11px] text-gray-500 text-right">{(props.scale ?? 1).toFixed(2)}×</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="insp-x" className="text-xs font-medium text-gray-700 block mb-1">X position</label>
              <input
                id="insp-x"
                type="number"
                value={props.x ?? 0}
                onChange={(e) => setProp('x', parseFloat(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label htmlFor="insp-y" className="text-xs font-medium text-gray-700 block mb-1">Y position</label>
              <input
                id="insp-y"
                type="number"
                value={props.y ?? 0}
                onChange={(e) => setProp('y', parseFloat(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Text controls (TEXT) ── */}
      {item.kind === 'TEXT' && (
        <>
          {/* Text content with live style preview */}
          <div>
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1.5">
              <Type className="w-3.5 h-3.5" /> Text content
            </label>
            <textarea
              value={props.text ?? ''}
              onChange={(e) => setProp('text', e.target.value)}
              rows={3}
              placeholder="Enter text…"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              style={{
                fontFamily: props.fontFamily ?? 'sans-serif',
                fontWeight: props.fontWeight ?? 'bold',
                fontStyle: props.fontStyle ?? 'normal',
                textAlign: (props.textAlign ?? 'center') as 'left' | 'center' | 'right',
                color: props.color && props.color !== '#ffffff' ? props.color : '#111',
              }}
            />
          </div>

          {/* Font family */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Font</label>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { label: 'Sans',    value: 'sans-serif' },
                { label: 'Serif',   value: 'Georgia, serif' },
                { label: 'Impact',  value: 'Impact, sans-serif' },
                { label: 'Mono',    value: 'Courier New, monospace' },
                { label: 'Script',  value: 'cursive' },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setProp('fontFamily', f.value)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${props.fontFamily === f.value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style + Align */}
          <div className="flex items-start gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Style</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setProp('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${props.fontWeight === 'bold' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setProp('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${props.fontStyle === 'italic' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Align</label>
              <div className="flex gap-1.5">
                {([
                  { align: 'left' as const,   Icon: AlignLeft },
                  { align: 'center' as const, Icon: AlignCenter },
                  { align: 'right' as const,  Icon: AlignRight },
                ]).map(({ align, Icon }) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setProp('textAlign', align)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${(props.textAlign ?? 'center') === align ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    title={align}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Text color */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Text color</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {['#ffffff', '#000000', '#facc15', '#f87171', '#60a5fa', '#4ade80', '#f472b6', '#a78bfa'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setProp('color', c)}
                  className="w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 active:scale-95 shrink-0"
                  style={{ background: c, borderColor: (props.color ?? '#ffffff') === c ? '#374151' : 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={props.color ?? '#ffffff'}
                onChange={(e) => setProp('color', e.target.value)}
                className="w-8 h-8 border border-gray-200 rounded-lg cursor-pointer shrink-0 p-0.5"
              />
              <input
                type="text"
                value={props.color ?? '#ffffff'}
                onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setProp('color', e.target.value); }}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono"
                maxLength={7}
                spellCheck={false}
              />
            </div>
          </div>

          {/* Background */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Background</label>
            <div className="flex gap-1.5">
              {([
                { label: 'None',  value: undefined },
                { label: 'Dark',  value: 'rgba(0,0,0,0.55)' },
                { label: 'Light', value: 'rgba(255,255,255,0.65)' },
              ] as const).map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setProp('backgroundColor', value as string | undefined)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${(props.backgroundColor ?? undefined) === value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── EFFECTS section (VIDEO / IMAGE) ── */}
      {/* TODO (Phase 2): Effects/filters are stored in properties.filters and sent to the render/export pipeline.
          Live preview does NOT reflect these in Phase 2 — the preview still shows the raw clip.
          WYSIWYG canvas preview is planned for Phase 3. */}
      {(item.kind === 'VIDEO' || item.kind === 'IMAGE') && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left mb-3 min-h-[44px]"
            onClick={() => setEffectsOpen((o) => !o)}
            aria-expanded={effectsOpen}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Effects</p>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${effectsOpen ? '' : '-rotate-90'}`} />
          </button>
          {effectsOpen && (
            <div className="space-y-3">
              <div>
                <label htmlFor="insp-brightness" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Brightness</span>
                  <span className="tabular-nums">{(filters.brightness ?? 0).toFixed(2)}</span>
                </label>
                <input
                  id="insp-brightness"
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={filters.brightness ?? 0}
                  onChange={(e) => setFilter('brightness', clamp(parseFloat(e.target.value), -1, 1))}
                  className="w-full accent-brand-600"
                />
              </div>
              <div>
                <label htmlFor="insp-contrast" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Contrast</span>
                  <span className="tabular-nums">{(filters.contrast ?? 1).toFixed(2)}</span>
                </label>
                <input
                  id="insp-contrast"
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={filters.contrast ?? 1}
                  onChange={(e) => setFilter('contrast', clamp(parseFloat(e.target.value), 0, 2))}
                  className="w-full accent-brand-600"
                />
              </div>
              <div>
                <label htmlFor="insp-saturation" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Saturation</span>
                  <span className="tabular-nums">{(filters.saturation ?? 1).toFixed(2)}</span>
                </label>
                <input
                  id="insp-saturation"
                  type="range"
                  min={0}
                  max={3}
                  step={0.01}
                  value={filters.saturation ?? 1}
                  onChange={(e) => setFilter('saturation', clamp(parseFloat(e.target.value), 0, 3))}
                  className="w-full accent-brand-600"
                />
              </div>
              <div>
                <label htmlFor="insp-blur" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Blur</span>
                  <span className="tabular-nums">{(filters.blur ?? 0).toFixed(1)}px</span>
                </label>
                <input
                  id="insp-blur"
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={filters.blur ?? 0}
                  onChange={(e) => setFilter('blur', clamp(parseFloat(e.target.value), 0, 20))}
                  className="w-full accent-brand-600"
                />
              </div>
              <div className="flex items-center gap-2 min-h-[44px]">
                <input
                  id="insp-grayscale"
                  type="checkbox"
                  checked={filters.grayscale ?? false}
                  onChange={(e) => setFilter('grayscale', e.target.checked)}
                  className="w-4 h-4 accent-brand-600 rounded"
                />
                <label htmlFor="insp-grayscale" className="text-xs font-medium text-gray-700 cursor-pointer">Grayscale</label>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-gray-500 hover:text-red-600 underline min-h-[44px] w-full text-left"
              >
                Reset effects
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSITION section (VIDEO items) ── */}
      {/* TODO (Phase 2): Transition is stored in properties.transitionIn and applied on render/export.
          Live preview does NOT show the transition in Phase 2. WYSIWYG planned for Phase 3. */}
      {item.kind === 'VIDEO' && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left mb-3 min-h-[44px]"
            onClick={() => setTransitionOpen((o) => !o)}
            aria-expanded={transitionOpen}
          >
            <Clapperboard className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Transition in</p>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${transitionOpen ? '' : '-rotate-90'}`} />
          </button>
          {transitionOpen && (
            <div className="space-y-3">
              <div>
                <label htmlFor="insp-transition-type" className="text-xs font-medium text-gray-700 block mb-1.5">Type</label>
                <select
                  id="insp-transition-type"
                  value={props.transitionIn?.type ?? 'none'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'none') {
                      setProp('transitionIn', undefined);
                    } else {
                      setProp('transitionIn', {
                        type: v as TransitionType,
                        durationMs: props.transitionIn?.durationMs ?? 500,
                      });
                    }
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="none">None</option>
                  <option value="fade">Fade</option>
                  <option value="dissolve">Dissolve</option>
                  <option value="slide">Slide</option>
                </select>
              </div>
              {props.transitionIn && (
                <div>
                  <label htmlFor="insp-transition-dur" className="text-xs font-medium text-gray-700 flex justify-between mb-1.5">
                    <span>Duration</span>
                    <span className="tabular-nums">{props.transitionIn.durationMs}ms</span>
                  </label>
                  <input
                    id="insp-transition-dur"
                    type="range"
                    min={100}
                    max={3000}
                    step={50}
                    value={props.transitionIn.durationMs}
                    onChange={(e) => {
                      const dur = clamp(parseInt(e.target.value, 10), 100, 3000);
                      setProp('transitionIn', { ...props.transitionIn!, durationMs: dur });
                    }}
                    className="w-full accent-brand-600"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TEXT ANIMATION section (TEXT items) ── */}
      {/* TODO (Phase 2): textAnim is stored in properties and applied on render/export.
          Live preview does NOT animate text in Phase 2. WYSIWYG planned for Phase 3. */}
      {item.kind === 'TEXT' && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left mb-3 min-h-[44px]"
            onClick={() => setTextAnimOpen((o) => !o)}
            aria-expanded={textAnimOpen}
          >
            <Sparkles className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Text animation</p>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${textAnimOpen ? '' : '-rotate-90'}`} />
          </button>
          {textAnimOpen && (
            <div>
              <label htmlFor="insp-text-anim" className="text-xs font-medium text-gray-700 block mb-1.5">Animation</label>
              <select
                id="insp-text-anim"
                value={props.textAnim ?? 'none'}
                onChange={(e) => setProp('textAnim', e.target.value as TextAnimType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="none">None</option>
                <option value="fade-in">Fade in</option>
                <option value="slide-up">Slide up</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIO section (VIDEO / AUDIO) ── */}
      {/* TODO (Phase 3): Fade envelope and gain are applied on render/export only.
          Live preview does NOT reflect audio processing in Phase 3.
          Waveform visualisation skipped — no client-side audio decode; add in a future phase. */}
      {(item.kind === 'VIDEO' || item.kind === 'AUDIO') && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left mb-3 min-h-[44px]"
            onClick={() => setAudioOpen((o) => !o)}
            aria-expanded={audioOpen}
          >
            <Music className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Audio</p>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${audioOpen ? '' : '-rotate-90'}`} />
          </button>
          {audioOpen && (
            <div className="space-y-3">
              {/* Fade in */}
              <div>
                <label htmlFor="insp-fade-in" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Fade in</span>
                  <span className="tabular-nums">{props.fadeInMs ?? 0} ms</span>
                </label>
                <input
                  id="insp-fade-in"
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={props.fadeInMs ?? 0}
                  onChange={(e) => setProp('fadeInMs', clamp(parseInt(e.target.value, 10) || 0, 0, 10000))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              {/* Fade out */}
              <div>
                <label htmlFor="insp-fade-out" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Fade out</span>
                  <span className="tabular-nums">{props.fadeOutMs ?? 0} ms</span>
                </label>
                <input
                  id="insp-fade-out"
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={props.fadeOutMs ?? 0}
                  onChange={(e) => setProp('fadeOutMs', clamp(parseInt(e.target.value, 10) || 0, 0, 10000))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              {/* Gain */}
              <div>
                <label htmlFor="insp-gain" className="text-xs font-medium text-gray-700 flex justify-between mb-1">
                  <span>Gain</span>
                  <span className="tabular-nums">{(props.gainDb ?? 0).toFixed(1)} dB</span>
                </label>
                <input
                  id="insp-gain"
                  type="range"
                  min={-60}
                  max={12}
                  step={0.5}
                  value={props.gainDb ?? 0}
                  onChange={(e) => setProp('gainDb', clamp(parseFloat(e.target.value), -60, 12))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>-60 dB</span>
                  <span>0 dB</span>
                  <span>+12 dB</span>
                </div>
              </div>
              {/* Duck under voice (AUDIO items only) */}
              {item.kind === 'AUDIO' && (
                <div className="flex items-center gap-2 min-h-[44px]">
                  <input
                    id="insp-duck-voice"
                    type="checkbox"
                    checked={props.duckUnderVoice ?? false}
                    onChange={(e) => setProp('duckUnderVoice', e.target.checked)}
                    className="w-4 h-4 accent-brand-600 rounded"
                  />
                  <label htmlFor="insp-duck-voice" className="text-xs font-medium text-gray-700 cursor-pointer">
                    Duck under voice
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AI AUDIO section (VIDEO / AUDIO) — enhance audio with AI processing ── */}
      {(item.kind === 'AUDIO' || item.kind === 'VIDEO') && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left mb-3 min-h-[44px]"
            onClick={() => setAiAudioOpen((o) => !o)}
            aria-expanded={aiAudioOpen}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide flex-1">AI Audio Enhance</p>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${aiAudioOpen ? '' : '-rotate-90'}`} />
          </button>
          {aiAudioOpen && (
            <div className="space-y-3">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Processes the audio server-side. The cleaned version is saved as a new asset version.
              </p>
              {(['trimSilence', 'denoise', 'normalize'] as const).map((step) => (
                <label key={step} className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={enhanceSteps[step]}
                    onChange={(e) => setEnhanceSteps((s) => ({ ...s, [step]: e.target.checked }))}
                    className="w-4 h-4 accent-brand-600 rounded"
                  />
                  <span className="text-xs text-gray-700 font-medium">
                    {step === 'trimSilence' ? 'Trim silence' : step === 'denoise' ? 'Noise removal' : 'Normalize loudness (−14 LUFS)'}
                  </span>
                </label>
              ))}
              {enhanceError && (
                <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{enhanceError}</p>
              )}
              {enhanceDone && !enhanceError && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Audio enhanced — new version saved
                </p>
              )}
              <button
                type="button"
                disabled={enhancing || (!enhanceSteps.trimSilence && !enhanceSteps.denoise && !enhanceSteps.normalize)}
                onClick={async () => {
                  if (!item.sourceAssetId) return;
                  setEnhancing(true); setEnhanceDone(false); setEnhanceError('');
                  try {
                    const { data } = await api.editor.enhanceAsset(editId, {
                      assetVersionId: item.sourceAssetId,
                      ...enhanceSteps,
                    });
                    if (data.durationMs && data.durationMs !== (item.timelineEndMs - item.timelineStartMs)) {
                      onChange({ timelineEndMs: item.timelineStartMs + data.durationMs });
                    }
                    setEnhanceDone(true);
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                    setEnhanceError(msg ?? 'Enhancement failed. The audio file may not be locally accessible on the server.');
                  } finally {
                    setEnhancing(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff', boxShadow: '0 2px 12px rgba(55,65,81,0.3)' }}
              >
                {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {enhancing ? 'Processing audio…' : 'Run AI Enhance'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── KEYFRAMES section (VIDEO / IMAGE / TEXT) ── */}
      {/* TODO (Phase 2): Keyframe interpolation is applied on render/export only.
          Live preview does NOT reflect keyframe motion in Phase 2. WYSIWYG curve editor planned for Phase 3. */}
      {(item.kind === 'VIDEO' || item.kind === 'IMAGE' || item.kind === 'TEXT') && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            className="flex items-center gap-1.5 w-full text-left mb-3 min-h-[44px]"
            onClick={() => setKeyframesOpen((o) => !o)}
            aria-expanded={keyframesOpen}
          >
            <KeyRound className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Keyframes</p>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${keyframesOpen ? '' : '-rotate-90'}`} />
          </button>
          {keyframesOpen && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  const existing = props.keyframes ?? [];
                  // Schema wants integer ms; avoid duplicate atMs
                  const atMs = Math.max(0, Math.round(currentTimeMs));
                  if (existing.some((kf) => kf.atMs === atMs)) return;
                  const updated = [...existing, { atMs }].sort((a, b) => a.atMs - b.atMs);
                  setProp('keyframes', updated);
                }}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 border border-dashed border-brand-300 text-brand-700 text-xs rounded-lg hover:bg-brand-50 min-h-[44px]"
              >
                <Plus className="w-3.5 h-3.5" /> Add keyframe at {fmtMs(currentTimeMs)}
              </button>
              {(props.keyframes ?? []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-1">No keyframes yet</p>
              )}
              {(props.keyframes ?? []).map((kf, idx) => (
                <div key={kf.atMs} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-600">{fmtMs(kf.atMs)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (props.keyframes ?? []).filter((_, i) => i !== idx);
                        setProp('keyframes', updated.length > 0 ? updated : undefined);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={`Delete keyframe at ${fmtMs(kf.atMs)}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`kf-opacity-${idx}`} className="text-[10px] font-medium text-gray-500 block mb-0.5">Opacity</label>
                      <input
                        id={`kf-opacity-${idx}`}
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        placeholder="—"
                        value={kf.opacity ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : clamp(parseFloat(e.target.value), 0, 1);
                          const updated = (props.keyframes ?? []).map((k, i) => i === idx ? { ...k, opacity: v } : k);
                          setProp('keyframes', updated);
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor={`kf-scale-${idx}`} className="text-[10px] font-medium text-gray-500 block mb-0.5">Scale</label>
                      <input
                        id={`kf-scale-${idx}`}
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.01}
                        placeholder="—"
                        value={kf.scale ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : clamp(parseFloat(e.target.value), 0.1, 10);
                          const updated = (props.keyframes ?? []).map((k, i) => i === idx ? { ...k, scale: v } : k);
                          setProp('keyframes', updated);
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor={`kf-x-${idx}`} className="text-[10px] font-medium text-gray-500 block mb-0.5">X</label>
                      <input
                        id={`kf-x-${idx}`}
                        type="number"
                        step={1}
                        placeholder="—"
                        value={kf.x ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          const updated = (props.keyframes ?? []).map((k, i) => i === idx ? { ...k, x: v } : k);
                          setProp('keyframes', updated);
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor={`kf-y-${idx}`} className="text-[10px] font-medium text-gray-500 block mb-0.5">Y</label>
                      <input
                        id={`kf-y-${idx}`}
                        type="number"
                        step={1}
                        placeholder="—"
                        value={kf.y ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          const updated = (props.keyframes ?? []).map((k, i) => i === idx ? { ...k, y: v } : k);
                          setProp('keyframes', updated);
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Timeline Track ────────────────────────────────────────────────────────────

function TimelineTrack({
  track,
  durationMs,
  pxPerSec,
  selectedId,
  snapPoints,
  nameMap,
  onSelect,
  onOpenInspector,
  onMoveItem,
  onTrimItem,
  onItemDragStart,
  onDropFromBin,
  onMuteItem,
  onHideItem,
  onDelinkItem,
  onDeleteTrack,
  onCrossTrackDrop,
  onMoveTrack,
  trackIndex = 0,
  totalTracks = 1,
}: {
  track: EditTrack;
  durationMs: number;
  pxPerSec: number;
  selectedId: string | null;
  snapPoints: number[];
  nameMap: Map<string, string>;
  onSelect: (id: string) => void;
  onOpenInspector?: (id: string) => void;
  onMoveItem: (itemId: string, newStartMs: number) => void;
  onTrimItem: (itemId: string, newStartMs: number, newEndMs: number) => void;
  onItemDragStart: () => void;
  onDropFromBin: (trackId: string, xInTrack: number) => void;
  onMuteItem: (itemId: string) => void;
  onHideItem: (itemId: string) => void;
  onDelinkItem: (itemId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onCrossTrackDrop?: (itemId: string, toTrackId: string, newStartMs: number) => void;
  onMoveTrack?: (direction: 'up' | 'down') => void;
  trackIndex?: number;
  totalTracks?: number;
}) {
  const totalW = Math.max(msToX(durationMs, pxPerSec) + 200, 600);
  const [dragOver, setDragOver] = useState(false);
  const trackMuted = (track.items ?? []).length > 0 && (track.items ?? []).every((it) => !!it.properties?.muted);
  const trackHidden = (track.items ?? []).length > 0 && (track.items ?? []).every((it) => !!it.properties?.hidden);

  return (
    <div className="flex items-center border-b border-gray-800" style={{ minHeight: TRACK_H + 4 }}>
      {/* Track label */}
      <div
        className="shrink-0 flex items-center gap-1 px-1.5 border-r border-gray-700"
        style={{ width: LABEL_W, height: TRACK_H + 4 }}
      >
        {track.kind === 'VIDEO' ? <Film className="w-3 h-3 text-violet-400 shrink-0" /> :
         track.kind === 'AUDIO' ? <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" /> :
         <Type className="w-3 h-3 text-amber-400 shrink-0" />}
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate flex-1 min-w-0">{track.label}</span>
        {track.kind === 'VIDEO' && (track.items ?? []).length > 0 && (
          <button
            onClick={() => { const target = !trackHidden; (track.items ?? []).forEach((it) => { if (!!it.properties?.hidden !== target) onHideItem(it.id); }); }}
            className="shrink-0 p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white"
            title={trackHidden ? 'Show all clips' : 'Hide all clips'}
          >
            {trackHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
          </button>
        )}
        {track.kind === 'AUDIO' && (track.items ?? []).length > 0 && (
          <button
            onClick={() => { const target = !trackMuted; (track.items ?? []).forEach((it) => { if (!!it.properties?.muted !== target) onMuteItem(it.id); }); }}
            className="shrink-0 p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white"
            title={trackMuted ? 'Unmute all clips' : 'Mute all clips'}
          >
            {trackMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
          </button>
        )}
        {/* Track reorder — up/down */}
        {totalTracks > 1 && onMoveTrack && (
          <div className="flex flex-col gap-px shrink-0">
            <button
              onClick={() => onMoveTrack('up')}
              disabled={trackIndex === 0}
              className="p-0.5 rounded hover:bg-white/10 text-gray-600 hover:text-white disabled:opacity-20 transition-colors"
              title="Move track up"
            >
              <ArrowUp className="w-2 h-2" />
            </button>
            <button
              onClick={() => onMoveTrack('down')}
              disabled={trackIndex === totalTracks - 1}
              className="p-0.5 rounded hover:bg-white/10 text-gray-600 hover:text-white disabled:opacity-20 transition-colors"
              title="Move track down"
            >
              <ArrowDown className="w-2 h-2" />
            </button>
          </div>
        )}
        {/* Delete track — always visible; confirm only when track has clips */}
        <button
          onClick={() => {
            const hasClips = (track.items ?? []).length > 0;
            if (!hasClips || window.confirm(`Delete "${track.label}" and all its clips?`)) {
              onDeleteTrack(track.id);
            }
          }}
          className="shrink-0 p-0.5 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors"
          title="Delete track"
          aria-label="Delete track"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
      {/* Track lane */}
      <div
        data-trackid={track.id}
        data-trackkind={track.kind}
        className={`relative flex-none transition-colors ${dragOver ? 'bg-white/5' : 'bg-transparent'}`}
        style={{ height: TRACK_H + 4, width: totalW }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('text/binentryid')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          if (!e.dataTransfer.types.includes('text/binentryid')) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          onDropFromBin(track.id, x);
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onSelect(''); }}
      >
        {(track.items ?? []).map((item) => (
          <TimelineItem
            key={item.id}
            item={item}
            pxPerSec={pxPerSec}
            trackH={TRACK_H + 4}
            selected={item.id === selectedId}
            colorClass={
              track.kind === 'AUDIO' && !!item.linkedItemId
                ? LINKED_AUDIO_COLOR
                : (TRACK_COLORS[track.kind] ?? 'bg-gray-400/70 border-gray-500 text-white')
            }
            snapPoints={snapPoints.filter((p) => p !== item.timelineStartMs && p !== item.timelineEndMs)}
            label={
              // Linked AUDIO clips are visual-only companions to a video clip —
              // show "Audio" instead of the video filename so users aren't confused.
              (item.kind === 'AUDIO' && item.linkedItemId)
                ? 'Audio'
                : item.sourceAssetId
                  ? (nameMap.get(item.sourceAssetId) ?? item.properties?.text ?? item.kind.toLowerCase())
                  : (item.properties?.text ?? item.kind.toLowerCase())
            }
            isLinked={!!item.linkedItemId}
            trackKind={track.kind}
            currentTrackId={track.id}
            onSelect={() => onSelect(item.id)}
            onOpenInspector={onOpenInspector ? () => onOpenInspector(item.id) : undefined}
            onMove={(newStartMs) => onMoveItem(item.id, newStartMs)}
            onTrim={(newStartMs, newEndMs) => onTrimItem(item.id, newStartMs, newEndMs)}
            onDragStart={onItemDragStart}
            onMuteToggle={track.kind === 'AUDIO' ? () => onMuteItem(item.id) : undefined}
            onHideToggle={track.kind === 'VIDEO' ? () => onHideItem(item.id) : undefined}
            onDelinkItem={track.kind === 'AUDIO' && !!item.linkedItemId ? () => onDelinkItem(item.id) : undefined}
            onCrossTrackDrop={onCrossTrackDrop}
          />
        ))}
        {dragOver && (
          <div className="absolute inset-0 border-2 border-dashed border-brand-400/50 rounded pointer-events-none" />
        )}
      </div>
    </div>
  );
}

// ── Timeline Item (drag to move, drag edges to trim) ─────────────────────────

function TimelineItem({
  item,
  pxPerSec,
  trackH,
  selected,
  colorClass,
  snapPoints,
  label,
  isLinked,
  trackKind,
  currentTrackId,
  onSelect,
  onOpenInspector,
  onMove,
  onTrim,
  onDragStart,
  onMuteToggle,
  onHideToggle,
  onDelinkItem,
  onCrossTrackDrop,
}: {
  item: EditItem;
  pxPerSec: number;
  trackH: number;
  selected: boolean;
  colorClass: string;
  snapPoints: number[];
  label: string;
  isLinked?: boolean;
  trackKind?: string;
  currentTrackId?: string;
  onSelect: () => void;
  onOpenInspector?: () => void;
  onMove: (newStartMs: number) => void;
  onTrim: (newStartMs: number, newEndMs: number) => void;
  onDragStart?: () => void;
  onMuteToggle?: () => void;
  onHideToggle?: () => void;
  onDelinkItem?: () => void;
  onCrossTrackDrop?: (itemId: string, toTrackId: string, newStartMs: number) => void;
}) {
  const left = msToX(item.timelineStartMs, pxPerSec);
  const width = Math.max(4, msToX(item.timelineEndMs - item.timelineStartMs, pxPerSec));
  const HANDLE_W = 8;
  const durMs = item.timelineEndMs - item.timelineStartMs;

  // Store origStartMs + origEndMs at drag start so pointer-move deltas are always
  // relative to the original position — avoids stale-closure accumulation on trim-right.
  const dragRef = useRef<{
    startX: number;
    origStartMs: number;
    origEndMs: number;
    mode: 'move' | 'trim-left' | 'trim-right';
    currentNewStartMs: number;
    targetTrackId: string | null;
    prevTargetEl: Element | null;
  } | null>(null);
  // Long-press timer: fires on touch hold ≥500 ms without drag movement
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function snapTo(ms: number): number {
    const thresholdMs = (SNAP_MS / 40) * pxPerSec;
    let best = ms;
    let bestDist = thresholdMs;
    for (const pt of snapPoints) {
      const d = Math.abs(pt - ms);
      if (d < bestDist) { bestDist = d; best = pt; }
    }
    return best;
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'trim-left' | 'trim-right') => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      origStartMs: item.timelineStartMs,
      origEndMs: item.timelineEndMs,
      mode,
      currentNewStartMs: item.timelineStartMs,
      targetTrackId: null,
      prevTargetEl: null,
    };
    onSelect();
    // Touch long-press: hold ≥500 ms on the clip body without dragging → open inspector
    if (e.pointerType === 'touch' && mode === 'move') {
      if (longPressRef.current) clearTimeout(longPressRef.current);
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null;
        dragRef.current = null; // cancel drag so pointerUp is a no-op
        onOpenInspector?.();
      }, 500);
    }
    onDragStart?.();
  }, [item.timelineStartMs, item.timelineEndMs, onSelect, onOpenInspector, onDragStart]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    // Cancel long-press if the pointer moves (user is dragging, not holding)
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    const dx = e.clientX - dragRef.current.startX;
    const deltaMs = xToMs(dx, pxPerSec);
    const { origStartMs, origEndMs } = dragRef.current;
    if (dragRef.current.mode === 'move') {
      const newStart = Math.max(0, snapTo(origStartMs + deltaMs));
      dragRef.current.currentNewStartMs = newStart;
      onMove(newStart);

      // Detect which track lane the pointer is over for cross-track drag
      if (onCrossTrackDrop && currentTrackId) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const lane = el?.closest('[data-trackid]') as HTMLElement | null;
        const toTrackId = lane?.dataset.trackid ?? null;

        // Highlight target lane
        if (lane !== dragRef.current.prevTargetEl) {
          if (dragRef.current.prevTargetEl) {
            dragRef.current.prevTargetEl.classList.remove('drag-target-track');
          }
          if (lane && toTrackId && toTrackId !== currentTrackId) {
            lane.classList.add('drag-target-track');
          }
          dragRef.current.prevTargetEl = lane;
        }
        dragRef.current.targetTrackId = (toTrackId && toTrackId !== currentTrackId) ? toTrackId : null;
      }
    } else if (dragRef.current.mode === 'trim-left') {
      const newStart = clamp(snapTo(origStartMs + deltaMs), 0, origEndMs - 100);
      onTrim(newStart, origEndMs);
    } else {
      const newEnd = clamp(snapTo(origEndMs + deltaMs), origStartMs + 100, Infinity);
      onTrim(origStartMs, newEnd);
    }
  }, [pxPerSec, onMove, onTrim, onCrossTrackDrop, currentTrackId, snapPoints]);

  const onPointerUp = useCallback(() => {
    // Cancel any pending long-press timer (normal tap completed)
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    if (dragRef.current) {
      // Clear cross-track highlight
      if (dragRef.current.prevTargetEl) {
        dragRef.current.prevTargetEl.classList.remove('drag-target-track');
      }
      // Fire cross-track drop if we landed on a different track
      if (dragRef.current.targetTrackId && onCrossTrackDrop) {
        onCrossTrackDrop(item.id, dragRef.current.targetTrackId, dragRef.current.currentNewStartMs);
      }
    }
    dragRef.current = null;
  }, [item.id, onCrossTrackDrop]);

  const muted = !!item.properties?.muted;      // AUDIO clips: audio silenced
  const hidden = !!item.properties?.hidden;    // VIDEO clips: frames hidden
  const isVideoTrack = trackKind === 'VIDEO';

  return (
    <div
      data-clip="1"
      style={{ left, width, height: trackH - 4, position: 'absolute', top: 2 }}
      className={`group rounded border ${colorClass} ${
        (isVideoTrack ? hidden : muted) ? 'opacity-40' : selected ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : 'opacity-90'
      } flex items-center overflow-hidden select-none touch-none`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Fade-in overlay */}
      {(item.properties?.fadeInMs ?? 0) > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-[5] rounded-l" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)' }} />
      )}
      {/* Fade-out overlay */}
      {(item.properties?.fadeOutMs ?? 0) > 0 && (
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-[5] rounded-r" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.7), transparent)' }} />
      )}
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 cursor-ew-resize z-10 flex items-center justify-center hover:bg-white/20"
        style={{ width: HANDLE_W }}
        onPointerDown={(e) => onPointerDown(e, 'trim-left')}
      >
        <div className="w-0.5 h-4 bg-white/60 rounded-full" />
      </div>
      {/* Main body — drag to move; double-click/double-tap opens inspector */}
      <div
        className="flex-1 h-full flex flex-col justify-center cursor-grab active:cursor-grabbing overflow-hidden relative"
        style={{ paddingLeft: HANDLE_W + 4, paddingRight: HANDLE_W + 4 }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
        onDoubleClick={(e) => { e.stopPropagation(); onOpenInspector?.(); }}
      >
        {/* Waveform visual for audio clips */}
        {item.kind === 'AUDIO' && width > 32 && (
          <div className="absolute inset-0 flex items-center gap-px px-2 pointer-events-none opacity-40" aria-hidden>
            {Array.from({ length: Math.min(60, Math.floor(width / 4)) }).map((_, i) => {
              const h = 30 + Math.sin(i * 1.7) * 20 + Math.sin(i * 0.5) * 15;
              return <div key={i} className="w-px bg-white rounded-full" style={{ height: `${h}%` }} />;
            })}
          </div>
        )}
        <div className="flex items-center gap-1 relative z-10">
          {isLinked && <Link2Off className="w-2.5 h-2.5 opacity-60 shrink-0" />}
          {/* State indicator */}
          {isVideoTrack && hidden && <EyeOff className="w-2.5 h-2.5 opacity-80 shrink-0" />}
          {!isVideoTrack && muted && <VolumeX className="w-2.5 h-2.5 opacity-80 shrink-0" />}
          <span className="text-[11px] font-medium truncate leading-tight">{label}</span>
        </div>
        {width > 48 && (
          <span className="text-[9px] opacity-60 leading-tight relative z-10">{fmtMs(durMs)}</span>
        )}
      </div>

      {/* VIDEO TRACK: Eye/EyeOff toggle (show/hide clip frames) */}
      {onHideToggle && width > 40 && (
        <button
          className="absolute top-0.5 right-8 p-0.5 rounded z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onHideToggle(); }}
          title={hidden ? 'Show clip' : 'Hide clip'}
          aria-label={hidden ? 'Show clip' : 'Hide clip'}
        >
          {hidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
        </button>
      )}

      {/* AUDIO TRACK: Mute toggle + Delink button */}
      {onMuteToggle && width > 40 && (
        <button
          className="absolute top-0.5 right-8 p-0.5 rounded z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMuteToggle(); }}
          title={muted ? 'Unmute audio' : 'Mute audio'}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        >
          {muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
        </button>
      )}
      {onDelinkItem && width > 56 && (
        <button
          className="absolute top-0.5 right-14 p-0.5 rounded z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelinkItem(); }}
          title="Detach audio from video"
          aria-label="Detach audio from video"
        >
          <Link2Off className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Edit / inspector button — appears only when clip is selected.
          Gives touch users a reliable tap target beyond double-tap / long-press. */}
      {selected && onOpenInspector && width > 32 && (
        <button
          className="absolute bottom-0.5 right-8 p-0.5 rounded z-20 bg-white/30 hover:bg-white/50 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenInspector(); }}
          title="Edit clip (double-tap or long-press also works)"
          aria-label="Edit clip properties"
        >
          <Settings2 className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 cursor-ew-resize z-10 flex items-center justify-center hover:bg-white/20"
        style={{ width: HANDLE_W }}
        onPointerDown={(e) => onPointerDown(e, 'trim-right')}
      >
        <div className="w-0.5 h-4 bg-white/60 rounded-full" />
      </div>
    </div>
  );
}

// ── Media Bin ─────────────────────────────────────────────────────────────────

const KIND_ICON: Record<string, React.ReactNode> = {
  VIDEO:               <Film        className="w-3.5 h-3.5 text-brand-500"  />,
  IMAGE:               <Image       className="w-3.5 h-3.5 text-amber-500"  />,
  AUDIO:               <Volume2     className="w-3.5 h-3.5 text-emerald-500"/>,
  VOICE:               <Volume2     className="w-3.5 h-3.5 text-emerald-500"/>,
  MUSIC:               <Music       className="w-3.5 h-3.5 text-emerald-500"/>,
  RENDER_SOURCE:       <Film        className="w-3.5 h-3.5 text-brand-500"  />,
  EDIT_RENDER:         <Clapperboard className="w-3.5 h-3.5 text-purple-500"/>,
  SHORTS_SOURCE_VIDEO: <Clapperboard className="w-3.5 h-3.5 text-brand-500"/>,
};

/** Maps a bin-entry kind to the short badge label shown in the grouped media bin. */
function kindBadge(kind: string): string {
  if (kind === 'VIDEO' || kind === 'RENDER_SOURCE' || kind === 'SHORTS_SOURCE_VIDEO') return 'SOURCE';
  if (kind === 'EDIT_RENDER') return 'RENDER';
  if (kind === 'AUDIO' || kind === 'VOICE' || kind === 'MUSIC') return 'AUDIO';
  if (kind === 'IMAGE') return 'IMAGE';
  return kind;
}

function BinEntry({
  entry,
  onAdd,
  onDelete,
  onLockToggle,
  onDragStart,
}: {
  entry: MediaBinEntry;
  onAdd: (e: MediaBinEntry) => void;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
  onDragStart?: (entry: MediaBinEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(entry.label);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() { setEditing(true); setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10); }
  function commitEdit() { setEditing(false); }

  const isProcessing = !entry.versionId;
  const isLocked = entry.locked ?? false;

  return (
    <div
      className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2 py-1.5 hover:bg-gray-50 hover:border-gray-200 group/entry transition-colors"
      draggable={!isProcessing}
      onDragStart={(e) => {
        if (isProcessing) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/binentryid', entry.id);
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart?.(entry);
      }}
    >
      {/* Kind icon */}
      <span className="shrink-0 text-gray-400">{KIND_ICON[entry.kind] ?? <Film className="w-3.5 h-3.5" />}</span>

      {/* Label + meta badges */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitEdit(); }}
            className="text-xs font-medium text-gray-800 border border-brand-300 rounded px-1 py-0.5 w-full focus:outline-none"
            maxLength={80}
          />
        ) : (
          <p
            className="text-xs font-medium text-gray-800 truncate cursor-text hover:text-brand-700"
            title="Click to rename"
            onClick={startEdit}
          >
            {label}
          </p>
        )}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {isProcessing ? (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 flex items-center gap-0.5">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing…
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-gray-100 text-gray-500">
              {kindBadge(entry.kind)}
            </span>
          )}
          {(entry.durationMs ?? 0) > 0 && (
            <span className="text-[10px] text-gray-400">{fmtMs(entry.durationMs!)}</span>
          )}
          {isLocked && (
            <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-amber-50 text-amber-600 flex items-center gap-0.5">
              <Lock className="w-2 h-2" /> Locked
            </span>
          )}
        </div>
      </div>

      {/* Secondary actions: lock + delete
          Always visible on touch screens (no hover), hover-reveal on desktop */}
      <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover/entry:opacity-100 transition-opacity duration-150">
        {onLockToggle && (
          <button
            onClick={() => onLockToggle(entry.id, !isLocked)}
            title={isLocked ? 'Unlock file' : 'Lock file'}
            className={`shrink-0 p-1 rounded transition-colors ${isLocked ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => {
              if (isLocked) { alert('This file is locked. Unlock it first before removing.'); return; }
              onDelete(entry.id);
            }}
            title={isLocked ? 'Unlock first to remove' : 'Remove file'}
            className={`shrink-0 p-1 rounded transition-colors ${isLocked ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Add to timeline — always visible, primary action */}
      <button
        onClick={() => onAdd(entry)}
        disabled={isProcessing}
        title={isProcessing ? 'Processing — please wait' : 'Add to timeline'}
        className="shrink-0 p-1 rounded-md bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function MediaBin({
  entries,
  onAddToTimeline,
  onUpload,
  uploading,
  onImportUrl,
  urlImporting,
  onOpenLibrary,
  onDeleteEntry,
  onLockEntry,
  onEntryDragStart,
}: {
  entries: MediaBinEntry[];
  onAddToTimeline: (entry: MediaBinEntry) => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
  onImportUrl?: (url: string, confirmOwnership?: boolean) => void;
  urlImporting?: boolean;
  onOpenLibrary?: () => void;
  onDeleteEntry?: (id: string) => void;
  onLockEntry?: (id: string, locked: boolean) => void;
  onEntryDragStart?: (entry: MediaBinEntry) => void;
}) {
  const [rendersOpen, setRendersOpen] = useState(false);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [binSearch, setBinSearch] = useState('');

  const NON_YT_SOCIAL = /tiktok\.com|instagram\.com|twitter\.com|x\.com|facebook\.com|fb\.watch|linkedin\.com|twitch\.tv|vimeo\.com|dailymotion\.com|reddit\.com|bilibili\.com/i;
  const isNonYtSocial = NON_YT_SOCIAL.test(urlValue);
  const uploadRef = useRef<HTMLInputElement>(null);

  const SOURCE_KINDS  = new Set(['VIDEO', 'RENDER_SOURCE', 'SHORTS_SOURCE_VIDEO']);
  const RENDER_KINDS  = new Set(['EDIT_RENDER']);
  const AUDIO_KINDS   = new Set(['AUDIO', 'VOICE', 'MUSIC']);
  const IMAGE_KINDS   = new Set(['IMAGE']);

  const q = binSearch.trim().toLowerCase();
  const matchesSearch = (e: MediaBinEntry) => !q || e.label.toLowerCase().includes(q);

  const sources  = entries.filter((e) => SOURCE_KINDS.has(e.kind) && matchesSearch(e));
  const renders  = entries.filter((e) => RENDER_KINDS.has(e.kind) && matchesSearch(e));
  const audios   = entries.filter((e) => AUDIO_KINDS.has(e.kind) && matchesSearch(e));
  const images   = entries.filter((e) => IMAGE_KINDS.has(e.kind) && matchesSearch(e));
  const totalFiltered = sources.length + renders.length + audios.length + images.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    e.target.value = '';
  };

  function submitUrl() {
    const u = urlValue.trim();
    if (!u || !onImportUrl) return;
    onImportUrl(u, isNonYtSocial ? ownershipConfirmed : undefined);
    setUrlValue('');
    setOwnershipConfirmed(false);
    setShowUrlBar(false);
  }

  // Action buttons always shown at top of bin
  const actionButtons = (
    <div className="px-2 pt-2 pb-1 space-y-1.5">
      {onUpload && (
        <>
          <input ref={uploadRef} type="file" accept="video/*,image/*,audio/*,.mp4,.mov,.avi,.webm,.mkv,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.aac" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => uploadRef.current?.click()}
            className="w-full flex items-center gap-1.5 text-xs text-brand-600 border border-dashed border-brand-200 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 font-medium px-3 py-2 rounded-lg transition-colors"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
        </>
      )}
      {urlImporting && !showUrlBar && (
        <div className="w-full flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-700 font-medium">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          Importing from URL…
        </div>
      )}
      {onImportUrl && (
        showUrlBar ? (
          <>
            <div className="flex gap-1">
              <input
                autoFocus
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape') { setShowUrlBar(false); setUrlValue(''); } }}
                placeholder="YouTube, Instagram, TikTok, X, or direct file URL…"
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={submitUrl}
                disabled={urlImporting || !urlValue.trim() || (isNonYtSocial && !ownershipConfirmed)}
                className="px-2 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                {urlImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
              </button>
              <button type="button" onClick={() => { setShowUrlBar(false); setUrlValue(''); setOwnershipConfirmed(false); }} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                <X className="w-3 h-3" />
              </button>
            </div>
            {isNonYtSocial && (
              <label className="flex items-start gap-2 px-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownershipConfirmed}
                  onChange={(e) => setOwnershipConfirmed(e.target.checked)}
                  className="mt-0.5 accent-brand-600"
                />
                <span className="text-[10px] text-amber-700 leading-tight">
                  I confirm this video belongs to my account and I have the right to download it.
                </span>
              </label>
            )}
            <p className="text-[10px] text-gray-400 px-1">Supports YouTube, Instagram, TikTok, Twitter/X, LinkedIn, and direct video/image links</p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowUrlBar(true)}
            className="w-full flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Link2 className="w-3 h-3" /> Import from URL
          </button>
        )
      )}
      {onOpenLibrary && (
        <button
          type="button"
          onClick={onOpenLibrary}
          className="w-full flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Library className="w-3 h-3" /> Import from Library
        </button>
      )}
      {/* Search Working Files */}
      {entries.length > 0 && (
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={binSearch}
            onChange={(e) => setBinSearch(e.target.value)}
            placeholder="Search working files…"
            className="w-full pl-7 pr-7 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400 bg-gray-50"
          />
          {binSearch && (
            <button onClick={() => setBinSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        {actionButtons}
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-400 text-xs gap-3">
          <Film className="w-8 h-8 opacity-20" />
          <div>
            <p className="font-semibold text-gray-500 text-sm mb-1">No media yet</p>
            <p className="leading-relaxed">Upload a video above, or send one from <strong>Projects</strong> / <strong>Shorts Studio</strong>.</p>
          </div>
          <Link href="/projects" className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1">Go to Projects <ChevronRight className="w-3 h-3" /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {actionButtons}

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Search no-results state */}
        {binSearch && totalFiltered === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
            <Search className="w-8 h-8 text-gray-200" />
            <p className="text-xs text-gray-400">No files match <strong>&quot;{binSearch}&quot;</strong></p>
            <button onClick={() => setBinSearch('')} className="text-[11px] text-brand-500 hover:underline">Clear search</button>
          </div>
        )}

        {/* Source Videos */}
        {sources.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">
              Working Files {binSearch && <span className="text-gray-300 normal-case font-normal">({sources.length})</span>}
            </p>
            {sources.map((e) => <BinEntry key={e.id} entry={e} onAdd={onAddToTimeline} onDelete={onDeleteEntry} onLockToggle={onLockEntry} onDragStart={onEntryDragStart} />)}
          </>
        )}

        {/* AI Generated (renders) — collapsible, starts collapsed */}
        {renders.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setRendersOpen((o) => !o)}
              className="w-full flex items-center gap-1 px-2 pt-3 pb-1 hover:opacity-70 transition-opacity"
            >
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex-1 text-left">AI Generated</p>
              <span className="text-[9px] text-gray-400 font-medium">{renders.length} render{renders.length !== 1 ? 's' : ''}</span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${rendersOpen ? '' : '-rotate-90'}`} />
            </button>
            {rendersOpen && renders.map((e) => <BinEntry key={e.id} entry={e} onAdd={onAddToTimeline} onDragStart={onEntryDragStart} />)}
          </>
        )}

        {/* Audio */}
        {audios.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-3 pb-1">
              Audio {binSearch && <span className="text-gray-300 normal-case font-normal">({audios.length})</span>}
            </p>
            {audios.map((e) => <BinEntry key={e.id} entry={e} onAdd={onAddToTimeline} onDelete={onDeleteEntry} onLockToggle={onLockEntry} onDragStart={onEntryDragStart} />)}
          </>
        )}

        {/* Images */}
        {images.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-3 pb-1">
              Images {binSearch && <span className="text-gray-300 normal-case font-normal">({images.length})</span>}
            </p>
            {images.map((e) => <BinEntry key={e.id} entry={e} onAdd={onAddToTimeline} onDelete={onDeleteEntry} onLockToggle={onLockEntry} onDragStart={onEntryDragStart} />)}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Editor Page ──────────────────────────────────────────────────────────

const RECORD_EFFECTS: Record<string, string> = {
  none: '',
  bright: 'brightness(1.4) contrast(1.05)',
  warm: 'brightness(1.1) saturate(1.5) sepia(0.15)',
  cool: 'saturate(0.7) hue-rotate(20deg) brightness(1.05)',
  dramatic: 'contrast(1.6) brightness(0.85) saturate(1.4)',
  bw: 'grayscale(1) contrast(1.3)',
};

export default function EditorWorkspacePage() {
  const { editId } = useParams<{ editId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // Load edit project
  const { data: project, isLoading, error: loadError } = useQuery<EditProject>({
    queryKey: ['editor-project', editId],
    queryFn: async () => {
      const r = await api.editor.get(editId);
      // Cache so /editor can skip listMine() on the next visit
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('lastEditorId', editId);
      return r.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Load media bin in parallel with project (only needs editId, not project data)
  const { data: mediaBin = [] } = useQuery<MediaBinEntry[]>({
    queryKey: ['editor-media-bin', editId],
    queryFn: () => api.editor.mediaBin(editId).then((r) => r.data ?? []),
    staleTime: 30_000,
    enabled: !!editId,
  });

  // ── Status tray (background operation toasts) ────────────────────────────────
  const [toasts, setToasts] = useState<Array<{ id: string; label: string; status: 'pending' | 'success' | 'error'; message?: string }>>([]);
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Top progress bar ──────────────────────────────────────────────────────────
  const [barPct, setBarPct] = useState(0);
  const [barVisible, setBarVisible] = useState(false);
  const barActiveOps = useRef(0);
  const barSimTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((id: string, label: string) => {
    setToasts((prev) => [...prev.filter((t) => t.id !== id), { id, label, status: 'pending' }]);
  }, []);

  const updateToast = useCallback((id: string, status: 'success' | 'error', message?: string) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, status, message } : t));
    if (status === 'success') {
      if (toastTimers.current[id]) clearTimeout(toastTimers.current[id]);
      toastTimers.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete toastTimers.current[id];
      }, 3000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    if (toastTimers.current[id]) { clearTimeout(toastTimers.current[id]); delete toastTimers.current[id]; }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const progressStart = useCallback(() => {
    barActiveOps.current += 1;
    if (barActiveOps.current === 1) {
      if (barSimTimer.current) { clearInterval(barSimTimer.current); barSimTimer.current = null; }
      setBarPct(0);
      setBarVisible(true);
      let pct = 0;
      barSimTimer.current = setInterval(() => {
        pct = Math.min(85, pct + (85 - pct) * 0.08 + 0.4);
        setBarPct(Math.floor(pct));
        if (pct >= 84.5) { clearInterval(barSimTimer.current!); barSimTimer.current = null; }
      }, 160);
    }
  }, []);

  const progressSet = useCallback((pct: number) => {
    setBarPct(Math.min(95, Math.round(pct)));
  }, []);

  const progressDone = useCallback(() => {
    barActiveOps.current = Math.max(0, barActiveOps.current - 1);
    if (barActiveOps.current === 0) {
      if (barSimTimer.current) { clearInterval(barSimTimer.current); barSimTimer.current = null; }
      setBarPct(100);
      setTimeout(() => { setBarVisible(false); setBarPct(0); }, 500);
    }
  }, []);

  // Local timeline state (editable copy, synced from server initially)
  const [timeline, setTimeline] = useState<EditTimeline | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [pxPerSec, setPxPerSec] = useState(40);
  useEffect(() => { pxPerSecRef.current = pxPerSec; }, [pxPerSec]);
  const [playing, setPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  type MediaLoadPhase = { kind: 'idle' } | { kind: 'loading' | 'completing'; itemId: string };
  const [mediaLoadPhase, setMediaLoadPhase] = useState<MediaLoadPhase>({ kind: 'idle' });
  // Keep the ref in sync when state changes from outside (e.g. inspector seek)
  useEffect(() => { currentTimeMsRef.current = currentTimeMs; }, [currentTimeMs]);
  const [showExport, setShowExport] = useState(false);
  const [showAiEdit, setShowAiEdit] = useState(false);
  const userPlan = usePlanGate();
  const isAdmin = useIsAdmin();
  const canExport = isAdmin || planAtLeast(userPlan, 'PRO');
  const [aiAutoSuggest, setAiAutoSuggest] = useState(false);
  // Mobile bottom-sheet: which panel is open
  const [mobileSheet, setMobileSheet] = useState<'none' | 'media' | 'inspector' | 'tools' | 'canvas' | 'text' | 'record'>('none');
  // Text tool emoji tab
  const [emojiTab, setEmojiTab] = useState(0);
  // Dynamic sheet top — anchored just below the preview so preview is never covered
  const [sheetTop, setSheetTop] = useState(300);
  // Live record state
  const [recordMode, setRecordMode] = useState<'audio' | 'video'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordMuted, setRecordMuted] = useState(false);
  const [recordEffect, setRecordEffect] = useState<'none' | 'bright' | 'warm' | 'cool' | 'dramatic' | 'bw'>('none');
  const [recordShowEffects, setRecordShowEffects] = useState(false);
  const [recordFullscreen, setRecordFullscreen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [permState, setPermState] = useState<{ mic: string; cam: string }>({ mic: 'unknown', cam: 'unknown' });
  const recordStreamRef = useRef<MediaStream | null>(null);
  // Keep legacy vars so existing references compile
  const mobileBinOpen = mobileSheet === 'media';
  const mobileInspectorOpen = mobileSheet === 'inspector';
  const setMobileBinOpen = (v: boolean) => setMobileSheet(v ? 'media' : 'none');
  const setMobileInspectorOpen = (v: boolean) => setMobileSheet(v ? 'inspector' : 'none');
  // History + library drawers
  const [showHistory, setShowHistory] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySelecting, setLibrarySelecting] = useState<string | null>(null);
  // Auto-save preference — default ON; user can disable via the Save menu
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('editor-autosave') !== 'false';
  });
  // Brief "Saved ✓" confirmation flash after a successful autosave
  const [savedRecently, setSavedRecently] = useState(false);
  // Named snapshots saved to localStorage per edit
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`editor-snapshots-${editId}`);
      return raw ? (JSON.parse(raw) as SnapshotEntry[]) : [];
    } catch { return []; }
  });
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const [binUploading, setBinUploading] = useState(false);
  const [binUrlImporting, setBinUrlImporting] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [binPanelOpen, setBinPanelOpen] = useState(true);
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(true);
  const [canvasPopoverOpen, setCanvasPopoverOpen] = useState(false);
  const [recordPopoverOpen, setRecordPopoverOpen] = useState(false);
  const canvasButtonRef = useRef<HTMLButtonElement>(null);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const PREVIEW_H_PRESETS = { sm: 160, md: 240, lg: 380 } as const;
  const [previewSizeKey, setPreviewSizeKey] = useState<'sm' | 'md' | 'lg'>('md');
  const [previewH, setPreviewH] = useState(() => {
    if (typeof window === 'undefined') return 240;
    if (window.innerWidth < 768) return Math.round(window.innerHeight * 0.32);
    return 200;
  });
  function setPreviewSize(key: 'sm' | 'md' | 'lg') {
    setPreviewSizeKey(key);
    setPreviewH(PREVIEW_H_PRESETS[key]);
  }

  // Brand overlay — local-only watermark (text or logo) draggable on preview
  const [brandOverlay, setBrandOverlay] = useState<{
    type: 'text' | 'logo';
    text: string;
    logoUrl: string;
    x: number; y: number; size: number;
    visible: boolean; color: string;
  } | null>(null);
  const assetNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of mediaBin) m.set(e.id, e.label);
    return m;
  }, [mediaBin]);

  const handleBinUpload = useCallback(async (file: File) => {
    if (!project?.projectId) return;
    const id = `upload-${Date.now()}`;
    setBinUploading(true);
    addToast(id, `Uploading ${file.name}`);
    progressStart();
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      await apiClient.post(
        `/media/media/upload?projectId=${encodeURIComponent(project.projectId)}`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) progressSet(Math.round((e.loaded / e.total) * 90));
          },
        },
      );
      await qc.invalidateQueries({ queryKey: ['editor-media-bin', editId] });
      updateToast(id, 'success', `${file.name} added to Working Files`);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      updateToast(id, 'error', e.response?.data?.message ?? 'Upload failed');
    } finally {
      setBinUploading(false);
      progressDone();
    }
  }, [project?.projectId, editId, qc, addToast, updateToast, progressStart, progressSet, progressDone]);

  const handleBinUrlImport = useCallback(async (url: string, confirmOwnership?: boolean) => {
    if (!project?.projectId) return;
    const id = `import-url-${Date.now()}`;
    setBinUrlImporting(true);
    addToast(id, 'Importing video from URL…');
    progressStart();
    try {
      await api.media.importVideoFromUrl(url, { projectId: project.projectId, confirmOwnership });
      await qc.invalidateQueries({ queryKey: ['editor-media-bin', editId] });
      updateToast(id, 'success', 'Video added to Working Files');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      updateToast(id, 'error', e.response?.data?.message ?? 'Import failed');
    } finally {
      setBinUrlImporting(false);
      progressDone();
    }
  }, [project?.projectId, editId, qc, addToast, updateToast, progressStart, progressDone]);

  const handleLibrarySelect = useCallback(async (video: LibraryVideo) => {
    setLibrarySelecting(video.id);
    const id = `import-lib-${video.id}`;
    addToast(id, `Importing "${video.title}"…`);
    progressStart();
    try {
      await api.media.importVideoFromUrl(
        `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
        { title: video.title, projectId: project?.projectId, confirmOwnership: true },
      );
      await qc.invalidateQueries({ queryKey: ['editor-media-bin', editId] });
      setShowLibrary(false);
      updateToast(id, 'success', `"${video.title}" added to Working Files`);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      updateToast(id, 'error', e.response?.data?.message ?? 'Import from library failed');
    } finally {
      setLibrarySelecting(null);
      progressDone();
    }
  }, [project?.projectId, editId, qc, addToast, updateToast, progressStart, progressDone]);

  const handleProjectBinSelect = useCallback(async (entry: MediaBinEntry) => {
    if (!entry.versionId || !project?.projectId) return;
    setLibrarySelecting(entry.id);
    const id = `import-proj-${entry.id}`;
    addToast(id, `Importing "${entry.label}"…`);
    progressStart();
    try {
      const { data: { url } } = await api.media.versionSignedUrl(entry.versionId, 600);
      const absoluteUrl = url.startsWith('http')
        ? url
        : url.startsWith('/api/v1/')
          ? `${window.location.origin}${url.replace('/api/v1/', '/api/proxy/')}`
          : `${window.location.origin}${url}`;
      await api.media.importVideoFromUrl(absoluteUrl, { title: entry.label, projectId: project.projectId });
      await qc.invalidateQueries({ queryKey: ['editor-media-bin', editId] });
      setShowLibrary(false);
      updateToast(id, 'success', `"${entry.label}" added to Working Files`);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      updateToast(id, 'error', e.response?.data?.message ?? 'Import from project failed');
    } finally {
      setLibrarySelecting(null);
      progressDone();
    }
  }, [project?.projectId, editId, qc, addToast, updateToast, progressStart, progressDone]);

  const handleBinDeleteEntry = useCallback(async (assetId: string) => {
    if (!window.confirm('Remove this file? It will be permanently deleted from Cloudflare storage.')) return;
    const id = `delete-${assetId}`;
    addToast(id, 'Removing file…');
    progressStart();
    const previous = qc.getQueryData<MediaBinEntry[]>(['editor-media-bin', editId]);
    qc.setQueryData<MediaBinEntry[]>(
      ['editor-media-bin', editId],
      (old) => old?.filter((e) => e.id !== assetId) ?? [],
    );
    try {
      await api.editor.removeBinEntry(editId, assetId);
      updateToast(id, 'success', 'File deleted');
    } catch {
      if (previous !== undefined) qc.setQueryData(['editor-media-bin', editId], previous);
      updateToast(id, 'error', 'Could not remove file — please try again');
    } finally {
      progressDone();
      void qc.invalidateQueries({ queryKey: ['editor-media-bin', editId] });
    }
  }, [editId, qc, addToast, updateToast, progressStart, progressDone]);

  const handleBinLockEntry = useCallback(async (assetId: string, locked: boolean) => {
    qc.setQueryData<MediaBinEntry[]>(
      ['editor-media-bin', editId],
      (old) => old?.map((e) => e.id === assetId ? { ...e, locked } : e) ?? [],
    );
    try {
      await api.editor.lockBinEntry(editId, assetId, locked);
    } catch {
      qc.setQueryData<MediaBinEntry[]>(
        ['editor-media-bin', editId],
        (old) => old?.map((e) => e.id === assetId ? { ...e, locked: !locked } : e) ?? [],
      );
      addToast(`lock-err-${Date.now()}`, locked ? 'Could not lock file' : 'Could not unlock file');
      setTimeout(() => {}, 0); // trigger re-render
    }
  }, [editId, qc, addToast]);

  const handleNewEdit = useCallback(async () => {
    try {
      const { data: edit } = await api.editor.createBlank({ title: 'New Edit' });
      window.location.href = `/editor/${edit.id}`;
    } catch { /* ignore — user can retry */ }
  }, []);

  // Arriving from "Video Edit" on an imported video (?autoEdit=1): open the
  // AI dialog immediately so the assistant proposes an auto-edit plan.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('autoEdit') === '1') {
      setAiAutoSuggest(true);
      setShowAiEdit(true);
    }
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  // Refs let the rAF tick read current values without stale closures or 60fps state updates.
  const currentTimeMsRef = useRef(0);
  const activeVideoItemRef = useRef<EditItem | null>(null);
  const activeAudioItemRef = useRef<EditItem | null>(null);       // standalone audio only
  const activeLinkedAudioItemRef = useRef<EditItem | null>(null); // AUDIO clip linked to current video
  const audioSrcRef = useRef<string | null>(null);
  // AudioContext kept alive for the session; resumed inside every Play gesture to
  // satisfy browser autoplay policy for <audio>-element standalone clips.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const draggedBinEntryRef = useRef<MediaBinEntry | null>(null);
  const previewDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // Inner canvas-frame ref — has the correct aspect ratio for the current canvas size.
  // All drag position calculations use this ref so x/y percentages map to the canvas frame,
  // not the surrounding black letterbox area.
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraSheetPreviewRef = useRef<HTMLVideoElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalMutedRef = useRef(false);
  const [globalMuted, setGlobalMuted] = useState(false);
  const globalVolumeRef = useRef(1);
  const [globalVolume, setGlobalVolume] = useState(1);
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<EditTimeline[]>([]);
  const historyIndexRef = useRef(-1);
  // Map from itemId → { el, item } for secondary VIDEO track layers synced in rAF tick
  const secondaryVidsRef = useRef<Map<string, { el: HTMLVideoElement; item: EditItem }>>(new Map());
  // Kept in sync with pxPerSec state so the rAF tick can read the current zoom level.
  const pxPerSecRef = useRef(40);
  // Scroll container for the timeline — used for auto-scroll during playback and drag.
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  // True while the active clip's signed URL is still being fetched.
  // The rAF tick re-anchors its wall-clock every frame when this is set,
  // freezing the playhead until media is ready.
  const mediaWaitingRef = useRef(false);

  // Initialise timeline from server — normalise Prisma's default {} or null (no tracks)
  useEffect(() => {
    if (project && !timeline) {
      // @reason: Prisma JSON returns null for brand-new projects; ?? falls back to seed so every
      // code-path that calls tl.tracks.map() always has an array.
      const seed: EditTimeline = { width: 1920, height: 1080, fps: 30, durationMs: 0, tracks: [] };
      const raw = project.timeline ?? seed;
      setTimeline({ ...seed, ...raw, tracks: (raw.tracks ?? []).map((t) => ({ ...t, items: t.items ?? [] })) });
    }
  }, [project, timeline]);

  // Debounced auto-save — 5 s after last change; quiet when autosave is off
  useEffect(() => {
    if (!autoSave || !dirty || !timeline) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void handleSave(), 5000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [dirty, timeline, autoSave]);

  const handleSave = async () => {
    if (!timeline) return;
    setSaving(true);
    setSaveError(null);
    const id = 'save';
    addToast(id, 'Saving timeline…');
    progressStart();
    try {
      await api.editor.saveTimeline(editId, timeline);
      setDirty(false);
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 3000);
      void qc.invalidateQueries({ queryKey: ['editor-project', editId] });
      void qc.invalidateQueries({ queryKey: ['editor-mine'] });
      void qc.invalidateQueries({ queryKey: ['editor-mine-list'] });
      updateToast(id, 'success', 'All changes saved');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      const msg = e.response?.data?.message ?? 'Save failed';
      setSaveError(msg);
      updateToast(id, 'error', msg);
    } finally {
      setSaving(false);
      progressDone();
    }
  };

  // skipHistory=true during pointer-move (drag/trim) so Ctrl+Z steps through
  // whole operations, not individual pixel positions.
  const updateTimeline = useCallback((updater: (tl: EditTimeline) => EditTimeline, skipHistory = false) => {
    setTimeline((prev) => {
      if (!prev) return prev;
      const safe: EditTimeline = { ...prev, tracks: prev.tracks ?? [] };
      const next = updater(safe);
      setDirty(true);
      if (!skipHistory) {
        const base = historyRef.current.slice(0, historyIndexRef.current + 1);
        const newHist = [...base, next].slice(-50); // cap at 50 entries
        historyRef.current = newHist;
        historyIndexRef.current = newHist.length - 1;
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(false);
      }
      return next;
    });
  }, []);

  // The timeline schema requires integer ms — pointer deltas come in as
  // fractional pixels, so every write from a drag/trim must round, or the
  // autosave is rejected with "Invalid timeline: … expected integer".
  const handleMoveItem = useCallback((itemId: string, newStartMs: number) => {
    updateTimeline((tl) => {
      let delta = 0;
      let linkedItemId: string | null = null;
      for (const tr of tl.tracks) {
        for (const it of tr.items ?? []) {
          if (it.id === itemId) {
            delta = Math.max(0, Math.round(newStartMs)) - it.timelineStartMs;
            linkedItemId = it.linkedItemId ?? null;
            break;
          }
        }
      }
      return {
        ...tl,
        tracks: tl.tracks.map((tr) => ({
          ...tr,
          items: (tr.items ?? []).map((it) => {
            if (it.id === itemId) {
              const start = Math.max(0, Math.round(newStartMs));
              return { ...it, timelineStartMs: start, timelineEndMs: start + (it.timelineEndMs - it.timelineStartMs) };
            }
            if (linkedItemId && it.id === linkedItemId) {
              const start = Math.max(0, it.timelineStartMs + delta);
              return { ...it, timelineStartMs: start, timelineEndMs: start + (it.timelineEndMs - it.timelineStartMs) };
            }
            return it;
          }),
        })),
      };
    }, true); // skipHistory — history captured once on drag start
  }, [updateTimeline]);

  const handleTrimItem = useCallback((itemId: string, newStartMs: number, newEndMs: number) => {
    updateTimeline((tl) => {
      let startDelta = 0;
      let endDelta = 0;
      let linkedItemId: string | null = null;
      for (const tr of tl.tracks) {
        for (const it of tr.items ?? []) {
          if (it.id === itemId) {
            startDelta = Math.max(0, Math.round(newStartMs)) - it.timelineStartMs;
            endDelta = Math.max(it.timelineStartMs + 1, Math.round(newEndMs)) - it.timelineEndMs;
            linkedItemId = it.linkedItemId ?? null;
            break;
          }
        }
      }
      return {
        ...tl,
        tracks: tl.tracks.map((tr) => ({
          ...tr,
          items: (tr.items ?? []).map((it) => {
            if (it.id === itemId) {
              const start = Math.max(0, Math.round(newStartMs));
              const end = Math.max(start + 1, Math.round(newEndMs));
              return { ...it, timelineStartMs: start, timelineEndMs: end };
            }
            if (linkedItemId && it.id === linkedItemId) {
              const start = Math.max(0, it.timelineStartMs + startDelta);
              const end = Math.max(start + 1, it.timelineEndMs + endDelta);
              return { ...it, timelineStartMs: start, timelineEndMs: end };
            }
            return it;
          }),
        })),
      };
    }, true); // skipHistory — history captured once on drag start
  }, [updateTimeline]);

  const handleInspectorChange = useCallback((patch: Partial<EditItem>) => {
    if (!selectedItemId) return;
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.map((tr) => ({
        ...tr,
        items: (tr.items ?? []).map((it) =>
          it.id === selectedItemId ? { ...it, ...patch } : it,
        ),
      })),
    }));
  }, [selectedItemId, updateTimeline]);

  // Probe real media duration from the browser's native video element when
  // the server hasn't stored it yet (existing assets uploaded before the fix).
  const probeMediaDurationMs = useCallback((versionId: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.src = `/api/proxy/media/versions/${encodeURIComponent(versionId)}/file`;
      let settled = false;
      const done = (val: number | null) => {
        if (settled) return;
        settled = true;
        el.src = '';
        el.load();
        resolve(val);
      };
      el.onloadedmetadata = () => done(isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 1000) : null);
      el.onerror = () => done(null);
      setTimeout(() => done(null), 15_000);
    });
  }, []);

  const handleAddToTimeline = useCallback(async (entry: MediaBinEntry) => {
    let clipDurationMs = entry.durationMs ?? 0;
    if (!clipDurationMs && entry.versionId && ['VIDEO', 'SHORTS_SOURCE_VIDEO', 'MUSIC', 'VOICE'].includes(entry.kind)) {
      clipDurationMs = (await probeMediaDurationMs(entry.versionId)) ?? 5000;
    }
    if (!clipDurationMs) clipDurationMs = 5000;

    updateTimeline((tl) => {
      const itemKind = binKindToItemKind(entry.kind);
      // VOICE/MUSIC/AUDIO assets go straight to an AUDIO track only
      const kind = itemKind === 'AUDIO' ? 'AUDIO' : 'VIDEO';
      const startMs = Math.max(0, Math.round(tl.durationMs));
      const endMs = startMs + Math.max(1, Math.round(clipDurationMs));
      const ts = Date.now();
      const videoId = `item-${ts}-v`;
      const audioId = `item-${ts}-a`;

      // Primary clip (VIDEO or standalone AUDIO/IMAGE).
      // Video clips link to a companion AUDIO clip so users can see the
      // audio track on the timeline; the video element carries the actual audio.
      const primaryItem: EditItem = {
        id: videoId,
        sourceAssetId: entry.id,
        kind: itemKind,
        timelineStartMs: startMs,
        timelineEndMs: endMs,
        linkedItemId: itemKind === 'VIDEO' ? audioId : undefined,
      };

      let newTracks = [...tl.tracks];

      const primaryTrack = newTracks.find((t) => t.kind === kind);
      if (primaryTrack) {
        newTracks = newTracks.map((t) => t.id === primaryTrack.id ? { ...t, items: [...(t.items ?? []), primaryItem] } : t);
      } else {
        newTracks = [...newTracks, { id: `track-${ts}`, kind, label: kind === 'VIDEO' ? 'Video' : 'Audio', items: [primaryItem] }];
      }

      // Companion AUDIO clip — visual only; audio comes from the <video> element.
      if (itemKind === 'VIDEO') {
        const audioItem: EditItem = {
          id: audioId,
          sourceAssetId: entry.id,
          kind: 'AUDIO',
          timelineStartMs: startMs,
          timelineEndMs: endMs,
          linkedItemId: videoId,
        };
        const audioTrack = newTracks.find((t) => t.kind === 'AUDIO');
        newTracks = audioTrack
          ? newTracks.map((t) => t.kind === 'AUDIO' ? { ...t, items: [...(t.items ?? []), audioItem] } : t)
          : [...newTracks, { id: `track-audio-${ts}`, kind: 'AUDIO' as const, label: 'Audio', items: [audioItem] }];
      }

      return { ...tl, durationMs: endMs, tracks: newTracks };
    });
  }, [updateTimeline, probeMediaDurationMs]);

  // Auto-populate the timeline with the first video bin entry when the project loads empty.
  // Handles the common case where a video was imported to the bin but never placed on the timeline.
  const autoPopulatedRef = useRef(false);
  useEffect(() => { autoPopulatedRef.current = false; }, [editId]);
  useEffect(() => {
    if (autoPopulatedRef.current) return;
    if (!timeline) return;
    const hasContent = timeline.tracks.some((t) => (t.items ?? []).length > 0);
    if (hasContent) return;
    if (mediaBin.length === 0) return;
    const videoEntry = mediaBin.find((e) => e.kind === 'SHORTS_SOURCE_VIDEO')
      ?? mediaBin.find((e) => e.kind === 'VIDEO')
      ?? mediaBin.find((e) => e.kind === 'RENDER_SOURCE');
    if (!videoEntry) return;
    autoPopulatedRef.current = true;
    void handleAddToTimeline(videoEntry);
  }, [timeline, mediaBin, handleAddToTimeline, editId]);

  // Remove an item from the timeline (Inspector button or Delete/Backspace).
  // Empty tracks are pruned and the master duration recomputed.
  // Detach audio from a VIDEO clip: call the backend to extract the audio as
  // an MP3, then add an AUDIO track item covering the same time range.
  const handleDetachAudio = useCallback(async (item: EditItem) => {
    const entry = item.sourceAssetId ? mediaBin.find((e) => e.id === item.sourceAssetId) : null;
    if (!entry?.versionId) return;
    try {
      const { data } = await api.media.extractAudio(entry.versionId);
      // Refresh the bin so the new MP3 asset appears
      await qc.invalidateQueries({ queryKey: ['editor-media-bin', editId] });
      // Add an AUDIO track item at the same time range, linked to the video item
      const audioItemId = `item-${Date.now()}-detached-audio`;
      updateTimeline((tl) => {
        const audioItem: EditItem = {
          id: audioItemId,
          sourceAssetId: data.assetId,
          kind: 'AUDIO',
          timelineStartMs: item.timelineStartMs,
          timelineEndMs: item.timelineEndMs,
          linkedItemId: item.id,
          properties: { volume: 1 },
        };
        // Update the video item to point back at the audio item
        let newTracks = tl.tracks.map((tr) => ({
          ...tr,
          items: (tr.items ?? []).map((it) =>
            it.id === item.id
              ? { ...it, linkedItemId: audioItemId }
              : it,
          ),
        }));
        const audioTrack = newTracks.find((t) => t.kind === 'AUDIO');
        newTracks = audioTrack
          ? newTracks.map((t) => t.id === audioTrack.id ? { ...t, items: [...(t.items ?? []), audioItem] } : t)
          : [...newTracks, { id: `track-audio-${Date.now()}`, kind: 'AUDIO' as const, label: 'Audio', items: [audioItem] }];
        return { ...tl, tracks: newTracks };
      });
    } catch {
      // Surface error to the user via a toast if one is wired up, otherwise silently fail
      console.error('Audio extraction failed');
    }
  }, [mediaBin, editId, qc, updateTimeline]);

  const handleDeleteItem = useCallback((itemId: string) => {
    setSelectedItemId((sel) => (sel === itemId ? null : sel));
    updateTimeline((tl) => {
      let linkedItemId: string | null = null;
      for (const tr of tl.tracks) {
        for (const it of tr.items ?? []) {
          if (it.id === itemId) {
            linkedItemId = it.linkedItemId ?? null;
            break;
          }
        }
      }
      const toDelete = new Set([itemId, ...(linkedItemId ? [linkedItemId] : [])]);
      const tracks = tl.tracks
        .map((tr) => ({ ...tr, items: (tr.items ?? []).filter((it) => !toDelete.has(it.id)) }))
        .filter((tr) => tr.items.length > 0);
      const durationMs = tracks.reduce(
        (max, tr) => tr.items.reduce((m, it) => Math.max(m, it.timelineEndMs), max),
        0,
      );
      return { ...tl, tracks, durationMs };
    });
  }, [updateTimeline]);

  const handleDuplicateItem = useCallback((itemId: string) => {
    updateTimeline((tl) => {
      for (const tr of tl.tracks) {
        const item = (tr.items ?? []).find((it) => it.id === itemId);
        if (!item) continue;
        const len = item.timelineEndMs - item.timelineStartMs;
        const dupe: EditItem = { ...item, id: `item-dup-${Date.now()}`, timelineStartMs: item.timelineEndMs, timelineEndMs: item.timelineEndMs + len, linkedItemId: undefined };
        return {
          ...tl,
          durationMs: Math.max(tl.durationMs, dupe.timelineEndMs),
          tracks: tl.tracks.map((t) =>
            t.id === tr.id
              ? { ...t, items: [...(t.items ?? []), dupe].sort((a, b) => a.timelineStartMs - b.timelineStartMs) }
              : t,
          ),
        };
      }
      return tl;
    });
  }, [updateTimeline]);

  const handleMergeItem = useCallback((itemId: string) => {
    updateTimeline((tl) => {
      for (const tr of tl.tracks) {
        const items = tr.items ?? [];
        const item = items.find((it) => it.id === itemId);
        if (!item) continue;
        const next = items.find((it) => it.timelineStartMs >= item.timelineEndMs - 80 && it.timelineStartMs <= item.timelineEndMs + 80 && it.id !== itemId);
        if (!next) continue;
        return {
          ...tl,
          tracks: tl.tracks.map((t) =>
            t.id === tr.id
              ? {
                  ...t,
                  items: items
                    .filter((it) => it.id !== next.id)
                    .map((it) => it.id === itemId ? { ...it, timelineEndMs: next.timelineEndMs, sourceOutMs: next.sourceOutMs } : it),
                }
              : t,
          ),
        };
      }
      return tl;
    });
  }, [updateTimeline]);

  const handleRippleDeleteItem = useCallback((itemId: string) => {
    setSelectedItemId((sel) => (sel === itemId ? null : sel));
    updateTimeline((tl) => {
      let len = 0;
      let endMs = 0;
      for (const tr of tl.tracks) {
        const item = (tr.items ?? []).find((it) => it.id === itemId);
        if (item) { len = item.timelineEndMs - item.timelineStartMs; endMs = item.timelineEndMs; break; }
      }
      if (!len) return tl;
      const tracks = tl.tracks
        .map((tr) => ({
          ...tr,
          items: (tr.items ?? [])
            .filter((it) => it.id !== itemId)
            .map((it) =>
              it.timelineStartMs >= endMs
                ? { ...it, timelineStartMs: it.timelineStartMs - len, timelineEndMs: it.timelineEndMs - len }
                : it,
            ),
        }))
        .filter((tr) => (tr.items ?? []).length > 0);
      const durationMs = tracks.reduce(
        (max, tr) => (tr.items ?? []).reduce((m, it) => Math.max(m, it.timelineEndMs), max),
        0,
      );
      return { ...tl, tracks, durationMs };
    });
  }, [updateTimeline]);

  const [fadeMap, setFadeMap] = useState<Map<string, { fadeIn: boolean; fadeOut: boolean }>>(new Map());

  // ── Clipboard (Copy / Paste) ──────────────────────────────────────────────
  const [clipboard, setClipboard] = useState<EditItem | null>(null);

  const handleCopyItem = useCallback((itemId: string) => {
    const item = (timeline?.tracks ?? []).flatMap((t) => t.items ?? []).find((it) => it.id === itemId);
    if (item) setClipboard(item);
  }, [timeline]);

  const handlePasteItem = useCallback(() => {
    if (!clipboard) return;
    const dur = clipboard.timelineEndMs - clipboard.timelineStartMs;
    const newItem: EditItem = {
      ...clipboard,
      id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timelineStartMs: currentTimeMsRef.current,
      timelineEndMs: currentTimeMsRef.current + dur,
    };
    updateTimeline((tl) => {
      const track = tl.tracks.find((t) => t.kind === clipboard.kind && !clipboard.linkedItemId);
      if (!track) return tl;
      return {
        ...tl,
        tracks: tl.tracks.map((t) =>
          t.id === track.id
            ? { ...t, items: [...(t.items ?? []), newItem].sort((a, b) => a.timelineStartMs - b.timelineStartMs) }
            : t,
        ),
      };
    });
  }, [clipboard, updateTimeline]);

  // ── Track reordering ──────────────────────────────────────────────────────
  const handleMoveTrack = useCallback((trackId: string, direction: 'up' | 'down') => {
    updateTimeline((tl) => {
      const tracks = [...(tl.tracks ?? [])];
      const idx = tracks.findIndex((t) => t.id === trackId);
      if (idx === -1) return tl;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= tracks.length) return tl;
      [tracks[idx], tracks[newIdx]] = [tracks[newIdx], tracks[idx]];
      return { ...tl, tracks };
    });
  }, [updateTimeline]);
  const toggleFade = useCallback((itemId: string, side: 'in' | 'out') => {
    setFadeMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId) ?? { fadeIn: false, fadeOut: false };
      next.set(itemId, side === 'in' ? { ...cur, fadeIn: !cur.fadeIn } : { ...cur, fadeOut: !cur.fadeOut });
      return next;
    });
  }, []);

  const mergeTarget = useMemo(() => {
    if (!selectedItemId || !timeline) return null;
    for (const tr of timeline.tracks) {
      const items = tr.items ?? [];
      const item = items.find((it) => it.id === selectedItemId);
      if (!item) continue;
      return items.find((it) => it.timelineStartMs >= item.timelineEndMs - 80 && it.timelineStartMs <= item.timelineEndMs + 80 && it.id !== selectedItemId) ?? null;
    }
    return null;
  }, [selectedItemId, timeline]);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const state = historyRef.current[historyIndexRef.current];
    if (state) { setTimeline(state); setDirty(true); setCanUndo(historyIndexRef.current > 0); setCanRedo(true); }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const state = historyRef.current[historyIndexRef.current];
    if (state) { setTimeline(state); setDirty(true); setCanUndo(true); setCanRedo(historyIndexRef.current < historyRef.current.length - 1); }
  }, []);

  // Called by TimelineItem on pointer-down — captures the before-state so the
  // entire move/trim gesture undoes in a single Ctrl+Z step.
  const pushUndo = useCallback(() => {
    setTimeline((curr) => {
      if (!curr) return curr;
      const base = historyRef.current.slice(0, historyIndexRef.current + 1);
      const newHist = [...base, curr].slice(-50);
      historyRef.current = newHist;
      historyIndexRef.current = newHist.length - 1;
      setCanUndo(true);
      setCanRedo(false);
      return curr; // no change to timeline, only history
    });
  }, []);

  const toggleAutoSave = useCallback(() => {
    setAutoSave((prev) => {
      const next = !prev;
      localStorage.setItem('editor-autosave', String(next));
      const id = `autosave-${Date.now()}`;
      addToast(id, next ? 'Auto-save enabled' : 'Auto-save disabled');
      updateToast(id, 'success');
      return next;
    });
  }, [addToast, updateToast]);

  const handleSaveSnapshot = useCallback((name: string) => {
    if (!timeline) return;
    const entry: SnapshotEntry = {
      id: `snap-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      timeline,
    };
    setSnapshots((prev) => {
      const next = [...prev, entry].slice(-30); // keep last 30 versions
      try { localStorage.setItem(`editor-snapshots-${editId}`, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
    setShowSaveDialog(false);
    const toastId = `snap-saved-${Date.now()}`;
    addToast(toastId, `Version "${name}" saved to Private Drafts`);
    updateToast(toastId, 'success');
  }, [timeline, editId, addToast, updateToast]);

  const handleLoadSnapshot = useCallback((s: SnapshotEntry) => {
    // Single state update: push current to history AND set new timeline (avoids double render)
    setTimeline((curr) => {
      if (curr) {
        const base = historyRef.current.slice(0, historyIndexRef.current + 1);
        const newHist = [...base, curr].slice(-50);
        historyRef.current = newHist;
        historyIndexRef.current = newHist.length - 1;
        setCanUndo(true);
        setCanRedo(false);
      }
      return s.timeline;
    });
    setDirty(true);
    setShowSnapshots(false);
    const loadId = `snap-load-${Date.now()}`;
    addToast(loadId, `Loaded "${s.name}"`);
    updateToast(loadId, 'success');
  }, [addToast, updateToast]);

  const handleDeleteSnapshot = useCallback((id: string) => {
    if (!window.confirm('Delete this saved version? It will be permanently removed from Private Drafts and My Content.')) return;
    setSnapshots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try { localStorage.setItem(`editor-snapshots-${editId}`, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
    // Reset edit project status so it's removed from My Content Private
    void api.editor.setStatus(editId, 'DRAFT').catch(() => null);
  }, [editId]);

  const handleMoveSnapshot = useCallback(async (s: SnapshotEntry) => {
    const id = `snap-moved-${Date.now()}`;
    addToast(id, `Moving "${s.name}" to Private Content…`);
    try {
      await api.editor.setStatus(editId, 'PRIVATE_CONTENT');
      setSnapshots((prev) => {
        const next = prev.map((snap) =>
          snap.id === s.id ? { ...snap, movedAt: new Date().toISOString() } : snap
        );
        try { localStorage.setItem(`editor-snapshots-${editId}`, JSON.stringify(next)); } catch { /* */ }
        return next;
      });
      updateToast(id, 'success', `"${s.name}" moved to Private Content`);
    } catch {
      updateToast(id, 'error', 'Failed to move to Private Content');
    }
  }, [editId, addToast, updateToast]);

  const handleAddTrack = useCallback((kind: 'VIDEO' | 'AUDIO') => {
    updateTimeline((tl) => {
      const count = tl.tracks.filter((t) => t.kind === kind).length + 1;
      const newTrack: EditTrack = {
        id: `track-${kind.toLowerCase()}-${Date.now()}`,
        kind,
        label: `${kind.charAt(0) + kind.slice(1).toLowerCase()} ${count}`,
        items: [],
      };
      return { ...tl, tracks: [...tl.tracks, newTrack] };
    });
  }, [updateTimeline]);

  const handleAddTextItem = useCallback(() => {
    const newId = `text-item-${Date.now()}`;
    updateTimeline((tl) => {
      const startMs = currentTimeMsRef.current;
      const endMs = Math.min(startMs + 5000, (tl.durationMs ?? 0) > 0 ? tl.durationMs! : startMs + 5000);
      const newItem: EditItem = {
        id: newId,
        kind: 'TEXT',
        timelineStartMs: startMs,
        timelineEndMs: endMs > startMs ? endMs : startMs + 5000,
        properties: {
          text: 'Your text here',
          fontSize: 36,
          color: '#ffffff',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          textAlign: 'center',
          y: 80,
        },
      };
      const existingTextTrack = tl.tracks.find((t) => t.kind === 'TEXT');
      if (existingTextTrack) {
        return {
          ...tl,
          tracks: tl.tracks.map((t) =>
            t.id === existingTextTrack.id ? { ...t, items: [...(t.items ?? []), newItem] } : t
          ),
        };
      }
      const newTrack: EditTrack = {
        id: `track-text-${Date.now()}`,
        kind: 'TEXT',
        label: 'Text 1',
        items: [newItem],
      };
      return { ...tl, tracks: [...tl.tracks, newTrack] };
    });
    setSelectedItemId(newId);
  }, [updateTimeline, currentTimeMsRef]);

  const handleStartRecord = useCallback(async () => {
    try {
      const constraints = recordMode === 'video'
        ? { audio: true, video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      if (recordMuted) stream.getAudioTracks().forEach(t => { t.enabled = false; });
      if (recordMode === 'video' && cameraSheetPreviewRef.current) {
        cameraSheetPreviewRef.current.srcObject = stream;
        void cameraSheetPreviewRef.current.play();
      }
      const mimeType = recordMode === 'video'
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')
        : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm');
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        // Strip codec params so the File has a clean MIME the server's Content-Type detection can read
        const cleanMime = (mr.mimeType || mimeType).split(';')[0]?.trim() ?? 'audio/webm';
        const blob = new Blob(recordChunksRef.current, { type: cleanMime });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: cleanMime });
        setIsRecording(false);
        if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        setRecordSec(0);
        setRecordFullscreen(false);
        setMobileSheet('none');
        await handleBinUpload(file);
      };
      mr.start(250);
      setIsRecording(true);
      setRecordSec(0);
      recordTimerRef.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch (err) {
      const denied = err instanceof Error && err.name === 'NotAllowedError';
      setPermState(prev => ({ mic: denied ? 'denied' : prev.mic, cam: denied ? 'denied' : prev.cam }));
      const errId = `rec-err-${Date.now()}`;
      addToast(errId, denied ? 'Permission denied — check browser settings' : 'Recording not supported on this device');
      updateToast(errId, 'error');
    }
  }, [recordMode, cameraFacing, recordMuted, handleBinUpload, addToast, updateToast]);

  const handleStopRecord = useCallback(() => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setIsRecording(false);
    setRecordFullscreen(false);
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    if (cameraSheetPreviewRef.current) cameraSheetPreviewRef.current.srcObject = null;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    recordStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const handleToggleMute = useCallback(() => {
    recordStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setRecordMuted(prev => !prev);
  }, []);

  const handleFlipCamera = useCallback(async () => {
    if (isRecording) return;
    const next: 'user' | 'environment' = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(next);
    if (recordMode === 'video') {
      recordStreamRef.current?.getTracks().forEach(t => t.stop());
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: true });
        recordStreamRef.current = s;
        if (cameraSheetPreviewRef.current) { cameraSheetPreviewRef.current.srcObject = s; void cameraSheetPreviewRef.current.play(); }
      } catch { /* ignore */ }
    }
  }, [isRecording, cameraFacing, recordMode]);

  // Check browser permissions when record sheet opens
  useEffect(() => {
    if (mobileSheet !== 'record') return;
    setPermState({ mic: 'unknown', cam: 'unknown' });
    const checkPerms = async () => {
      try {
        const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermState(prev => ({ ...prev, mic: micPerm.state }));
        micPerm.onchange = () => setPermState(prev => ({ ...prev, mic: micPerm.state }));
        if (recordMode === 'video') {
          const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setPermState(prev => ({ ...prev, cam: camPerm.state }));
          camPerm.onchange = () => setPermState(prev => ({ ...prev, cam: camPerm.state }));
        } else {
          setPermState(prev => ({ ...prev, cam: 'granted' }));
        }
      } catch {
        setPermState({ mic: 'prompt', cam: recordMode === 'video' ? 'prompt' : 'granted' });
      }
    };
    void checkPerms();
  }, [mobileSheet, recordMode]);

  // Keep sheetTop updated — sheets anchor just below the preview so preview is never covered
  useEffect(() => {
    const update = () => {
      if (previewContainerRef.current) {
        setSheetTop(Math.round(previewContainerRef.current.getBoundingClientRect().bottom));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [previewH]);

  // Transfer camera stream between sheet video and fullscreen video when toggling fullscreen
  useEffect(() => {
    const stream = recordStreamRef.current;
    if (!stream || recordMode !== 'video') return;
    if (recordFullscreen && cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = stream;
      void cameraPreviewRef.current.play();
    } else if (!recordFullscreen && cameraSheetPreviewRef.current) {
      cameraSheetPreviewRef.current.srcObject = stream;
      void cameraSheetPreviewRef.current.play();
    }
  }, [recordFullscreen, recordMode]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.filter((t) => t.id !== trackId),
    }));
    setSelectedItemId((prev) => {
      // If the selected item was on this track, deselect
      if (!prev) return prev;
      return prev;
    });
  }, [updateTimeline]);

  const handleClearEmptyTracks = useCallback(() => {
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.filter((t) => (t.items ?? []).length > 0),
    }));
  }, [updateTimeline]);

  // Move a clip from its current track to a different track of the same kind.
  const handleCrossTrackDrop = useCallback((itemId: string, toTrackId: string, newStartMs: number) => {
    updateTimeline((tl) => {
      let movingItem: EditItem | null = null;
      let fromTrackKind: string | null = null;

      // Find the item and its source track kind
      for (const tr of tl.tracks) {
        const found = (tr.items ?? []).find((it) => it.id === itemId);
        if (found) { movingItem = found; fromTrackKind = tr.kind; break; }
      }
      if (!movingItem) return tl;

      const toTrack = tl.tracks.find((t) => t.id === toTrackId);
      if (!toTrack) return tl;

      // Only allow drops onto same-kind tracks (VIDEO→VIDEO, AUDIO→AUDIO, TEXT→TEXT)
      if (toTrack.kind !== fromTrackKind) return tl;

      const durMs = movingItem.timelineEndMs - movingItem.timelineStartMs;
      const clampedStart = Math.max(0, Math.round(newStartMs));
      const updatedItem: EditItem = { ...movingItem, timelineStartMs: clampedStart, timelineEndMs: clampedStart + durMs };

      return {
        ...tl,
        tracks: tl.tracks.map((tr) => {
          if (tr.id === toTrackId) {
            // Add to destination (avoid duplicate if same track)
            const already = (tr.items ?? []).some((it) => it.id === itemId);
            return { ...tr, items: already ? (tr.items ?? []).map((it) => it.id === itemId ? updatedItem : it) : [...(tr.items ?? []), updatedItem] };
          }
          // Remove from source track
          return { ...tr, items: (tr.items ?? []).filter((it) => it.id !== itemId) };
        }),
      };
    });
  }, [updateTimeline]);

  const handleMuteItem = useCallback((itemId: string) => {
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.map((tr) => ({
        ...tr,
        items: (tr.items ?? []).map((it) =>
          it.id === itemId ? { ...it, properties: { ...it.properties, muted: !it.properties?.muted } } : it,
        ),
      })),
    }));
  }, [updateTimeline]);

  // Toggle VIDEO clip visibility (eye on/off) — does NOT affect audio.
  const handleHideItem = useCallback((itemId: string) => {
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.map((tr) => ({
        ...tr,
        items: (tr.items ?? []).map((it) =>
          it.id === itemId ? { ...it, properties: { ...it.properties, hidden: !it.properties?.hidden } } : it,
        ),
      })),
    }));
  }, [updateTimeline]);

  // Remove the link between an AUDIO clip and its paired VIDEO clip.
  const handleDelinkItem = useCallback((itemId: string) => {
    updateTimeline((tl) => {
      let pairedId: string | undefined;
      for (const tr of tl.tracks) {
        for (const it of (tr.items ?? [])) {
          if (it.id === itemId) { pairedId = it.linkedItemId; }
        }
      }
      return {
        ...tl,
        tracks: tl.tracks.map((tr) => ({
          ...tr,
          items: (tr.items ?? []).map((it) => {
            if (it.id === itemId || (pairedId && it.id === pairedId)) {
              return { ...it, linkedItemId: undefined };
            }
            return it;
          }),
        })),
      };
    });
  }, [updateTimeline]);

  const handleGlobalMuteToggle = useCallback(() => {
    const next = !globalMutedRef.current;
    globalMutedRef.current = next;
    setGlobalMuted(next);
    const v = videoRef.current;
    const a = audioRef.current;
    if (v) v.muted = next;
    if (a) a.muted = next;
    secondaryVidsRef.current.forEach(({ el }) => { el.muted = next; });
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    const prev = globalVolumeRef.current;
    globalVolumeRef.current = v;
    setGlobalVolume(v);
    const vid = videoRef.current;
    const aud = audioRef.current;
    // Apply master volume scaled by each element's per-clip volume.
    if (vid) vid.volume = clamp((activeVideoItemRef.current?.properties?.volume ?? 1) * v, 0, 1);
    if (aud) aud.volume = clamp((activeAudioItemRef.current?.properties?.volume ?? 1) * v, 0, 1);
    secondaryVidsRef.current.forEach(({ el, item }) => { el.volume = clamp((item.properties?.volume ?? 1) * v, 0, 1); });
    // Auto-mute when slider hits 0.
    if (v === 0 && !globalMutedRef.current) {
      globalMutedRef.current = true;
      setGlobalMuted(true);
      if (vid) vid.muted = true;
      if (aud) aud.muted = true;
      secondaryVidsRef.current.forEach(({ el }) => { el.muted = true; });
    // Auto-unmute ONLY when coming back from zero — not when the mute button was pressed manually.
    } else if (v > 0 && prev === 0 && globalMutedRef.current) {
      globalMutedRef.current = false;
      setGlobalMuted(false);
      if (vid) vid.muted = false;
      if (aud) aud.muted = false;
      secondaryVidsRef.current.forEach(({ el }) => { el.muted = false; });
    }
  }, []);

  const handleRegisterSecondaryVideo = useCallback((itemId: string, el: HTMLVideoElement | null, item: EditItem) => {
    if (el) secondaryVidsRef.current.set(itemId, { el, item });
    else secondaryVidsRef.current.delete(itemId);
  }, []);

  const handleUpdateItemProps = useCallback((itemId: string, updates: Partial<EditItemProperties>, skipHistory = false) => {
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.map((tr) => ({
        ...tr,
        items: (tr.items ?? []).map((it) =>
          it.id === itemId ? { ...it, properties: { ...(it.properties ?? {}), ...updates } } : it
        ),
      })),
    }), skipHistory);
  }, [updateTimeline]);

  const handleSplitItem = useCallback((itemId: string, atMs: number) => {
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.map((track) => ({
        ...track,
        items: (track.items ?? []).flatMap((item) => {
          if (item.id !== itemId) return [item];
          if (atMs <= item.timelineStartMs || atMs >= item.timelineEndMs) return [item];
          const leftDur = atMs - item.timelineStartMs;
          return [
            { ...item, timelineEndMs: atMs },
            {
              ...item,
              id: `item-${Date.now()}-r`,
              timelineStartMs: atMs,
              timelineEndMs: item.timelineEndMs,
              sourceInMs: Math.round((item.sourceInMs ?? 0) + leftDur),
            },
          ];
        }),
      })),
    }));
  }, [updateTimeline]);

  const handleSplitAtPlayhead = useCallback(() => {
    const t = currentTimeMsRef.current;
    updateTimeline((tl) => ({
      ...tl,
      tracks: tl.tracks.map((tr) => ({
        ...tr,
        items: tr.items.flatMap((it) => {
          if (t <= it.timelineStartMs || t >= it.timelineEndMs) return [it];
          const elapsed = t - it.timelineStartMs;
          const left: EditItem = {
            ...it,
            id: `${it.id}-L`,
            timelineEndMs: Math.round(t),
            sourceOutMs: Math.round((it.sourceInMs ?? 0) + elapsed),
          };
          const right: EditItem = {
            ...it,
            id: `item-${Date.now()}-R`,
            timelineStartMs: Math.round(t),
            sourceInMs: Math.round((it.sourceInMs ?? 0) + elapsed),
          };
          return [left, right];
        }),
      })),
    }));
  }, [updateTimeline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.shiftKey && selectedItemId) {
        e.preventDefault(); handleRippleDeleteItem(selectedItemId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        e.preventDefault(); handleDeleteItem(selectedItemId);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault(); handleSplitAtPlayhead();
      } else if ((e.key === 'd' || e.key === 'D') && selectedItemId) {
        e.preventDefault(); handleDuplicateItem(selectedItemId);
      } else if ((e.key === 'j' || e.key === 'J') && selectedItemId) {
        e.preventDefault(); handleMergeItem(selectedItemId);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault(); handleRedo();
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selectedItemId) {
        e.preventDefault(); handleCopyItem(selectedItemId);
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); handlePasteItem();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedItemId, handleDeleteItem, handleRippleDeleteItem, handleDuplicateItem, handleMergeItem, handleSplitAtPlayhead, handleUndo, handleRedo, handleCopyItem, handlePasteItem]);

  // Playback via rAF — video is synced directly in the tick (not via React effects)
  // so React state is only updated at ~30 fps for the seek bar / time display.
  const startPlay = useCallback(() => {
    if (!timeline) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dur = timeline.durationMs;
    // Allow restart from beginning if already at the end
    const origin = currentTimeMsRef.current >= dur ? 0 : currentTimeMsRef.current;
    currentTimeMsRef.current = origin;
    let startWall = Date.now() - origin;
    let lastUiMs = -Infinity;

    const tick = () => {
      // If the active clip's signed URL is still loading, freeze the clock
      // by re-anchoring startWall so elapsed stays at the current position.
      if (mediaWaitingRef.current) {
        startWall = Date.now() - currentTimeMsRef.current;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Date.now() - startWall;
      const t = Math.min(elapsed, dur);
      currentTimeMsRef.current = t;

      // Sync <video> at full rAF rate without going through React.
      const v = videoRef.current;
      const item = activeVideoItemRef.current;
      if (v && item) {
        const rate = item.properties?.speed ?? 1;
        if (v.playbackRate !== rate) v.playbackRate = rate;
        const vol = clamp((item.properties?.volume ?? 1) * globalVolumeRef.current, 0, 1);
        v.volume = vol;
        // Audio muting is controlled by the AUDIO track clip (linkedAudio), not the VIDEO clip.
        // The VIDEO clip's hidden/eye toggle does not silence audio.
        const linkedAudio = activeLinkedAudioItemRef.current;
        v.muted = globalMutedRef.current || !!linkedAudio?.properties?.muted;
        const sourceSec = Math.max(0, ((item.sourceInMs ?? 0) + (t - item.timelineStartMs) * rate) / 1000);
        // Correct drift only when it exceeds 500 ms to avoid interrupting playback.
        if (Math.abs(v.currentTime - sourceSec) > 0.5) v.currentTime = sourceSec;
        if (v.paused) void v.play().catch(() => undefined);
      } else if (v && !v.paused) {
        v.pause();
      }

      // Sync <audio> — only used for STANDALONE (unlinked) audio clips like voice/music.
      // Linked-video audio is handled by the <video> element above.
      const a = audioRef.current;
      const aItem = activeAudioItemRef.current;
      const aSrc = audioSrcRef.current;
      if (a && aItem && aSrc) {
        const aVol = clamp((aItem.properties?.volume ?? 1) * globalVolumeRef.current, 0, 1);
        a.volume = aVol;
        a.muted = globalMutedRef.current || aVol === 0 || !!aItem.properties?.muted;
        const sourceSec = Math.max(0, ((aItem.sourceInMs ?? 0) + (t - aItem.timelineStartMs)) / 1000);
        if (Math.abs(a.currentTime - sourceSec) > 0.5) a.currentTime = sourceSec;
        if (a.paused) void a.play().catch(() => undefined);
      } else if (a && !a.paused) {
        a.pause();
      }

      // Sync secondary VIDEO layer elements at full rAF rate (muted — visual-only overlay)
      for (const [, { el: sv, item: sItem }] of secondaryVidsRef.current) {
        if (t >= sItem.timelineStartMs && t < sItem.timelineEndMs) {
          const rate = sItem.properties?.speed ?? 1;
          if (sv.playbackRate !== rate) sv.playbackRate = rate;
          sv.muted = true;
          const sourceSec = Math.max(0, ((sItem.sourceInMs ?? 0) + (t - sItem.timelineStartMs) * rate) / 1000);
          if (Math.abs(sv.currentTime - sourceSec) > 0.5) sv.currentTime = sourceSec;
          if (sv.paused) void sv.play().catch(() => undefined);
        } else if (!sv.paused) {
          sv.pause();
        }
      }

      // Update React state at ~30 fps so the seek bar and time display stay smooth
      // without flooding reconciliation at 60 fps.
      if (t - lastUiMs >= 33) {
        lastUiMs = t;
        setCurrentTimeMs(t);
        // Auto-scroll timeline to keep playhead visible during playback.
        const scrollEl = timelineScrollRef.current;
        if (scrollEl) {
          const playheadX = LABEL_W + msToX(t, pxPerSecRef.current);
          const { scrollLeft, clientWidth } = scrollEl;
          const MARGIN = 80;
          if (playheadX > scrollLeft + clientWidth - MARGIN) {
            scrollEl.scrollLeft = playheadX - clientWidth + MARGIN;
          } else if (playheadX < scrollLeft + LABEL_W + MARGIN) {
            scrollEl.scrollLeft = Math.max(0, playheadX - LABEL_W - MARGIN);
          }
        }
      }

      if (t >= dur) {
        setCurrentTimeMs(0);
        currentTimeMsRef.current = 0;
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    setPlaying(true);

    // Resume AudioContext for standalone audio clips (voice/music).
    if (typeof AudioContext !== 'undefined') {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume();
    }

    const vNow = videoRef.current;
    const itemNow = activeVideoItemRef.current;
    const aNow = audioRef.current;
    const aItemNow = activeAudioItemRef.current; // standalone audio only

    // Play <video> in the gesture context so the browser unlocks its audio track.
    // v.muted must be false and v.volume > 0 BEFORE calling play().
    if (vNow) {
      const vol = clamp((itemNow?.properties?.volume ?? 1) * globalVolumeRef.current, 0, 1);
      vNow.volume = vol;
      const linkedAudioNow = activeLinkedAudioItemRef.current;
      vNow.muted = globalMutedRef.current || !!linkedAudioNow?.properties?.muted;
      if (itemNow) vNow.playbackRate = itemNow.properties?.speed ?? 1;
      void vNow.play().catch(() => undefined);
    }
    if (aNow && aItemNow && audioSrcRef.current) {
      aNow.volume = clamp((aItemNow.properties?.volume ?? 1) * globalVolumeRef.current, 0, 1);
      aNow.muted = globalMutedRef.current || !!aItemNow.properties?.muted;
      void aNow.play().catch(() => undefined);
    }

    // Trigger secondary video layers inside the gesture context so autoplay unlocks
    const tStart = currentTimeMsRef.current;
    for (const [, { el: sv, item: sItem }] of secondaryVidsRef.current) {
      if (tStart >= sItem.timelineStartMs && tStart < sItem.timelineEndMs) {
        sv.muted = true;
        void sv.play().catch(() => undefined);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [timeline]);

  const stopPlay = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    for (const [, { el: sv }] of secondaryVidsRef.current) {
      if (!sv.paused) sv.pause();
    }
  }, []);

  // Stop immediately when the timeline becomes empty
  useEffect(() => {
    if (!playing) return;
    const hasItems = timeline?.tracks.some((t) => (t.items ?? []).length > 0) ?? false;
    if (!hasItems) stopPlay();
  }, [timeline, playing, stopPlay]);

  // Space = play/pause  |  ← → = seek ±1 s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          setPlaying(false);
        } else {
          startPlay();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = Math.max(0, currentTimeMsRef.current - 1000);
        currentTimeMsRef.current = next;
        setCurrentTimeMs(next);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = currentTimeMsRef.current + 1000;
        currentTimeMsRef.current = next;
        setCurrentTimeMs(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startPlay]);


  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Find the currently-active item on the PRIMARY video track only (first VIDEO track).
  // Using only the first track avoids falsely detecting overlay clips as the primary source.
  const primaryVideoTrack = (timeline?.tracks ?? []).find((t) => t.kind === 'VIDEO');
  const activeTimelineItem = primaryVideoTrack?.items
    ?.find((it) => it.timelineStartMs <= currentTimeMs && it.timelineEndMs > currentTimeMs) ?? null;

  const isActiveImage = activeTimelineItem?.kind === 'IMAGE';
  const activeVideoItem = isActiveImage ? null : activeTimelineItem;

  // All audio clips overlapping the current playhead
  const allActiveAudioItems = (timeline?.tracks ?? [])
    .filter((t) => t.kind === 'AUDIO')
    .flatMap((t) => t.items ?? [])
    .filter((it) => it.timelineStartMs <= currentTimeMs && it.timelineEndMs > currentTimeMs);

  // LINKED audio: the AUDIO-track clip paired to the active video clip.
  // Audio for these comes from the <video> element — no separate <audio> element needed.
  const activeLinkedAudioItem = activeVideoItem
    ? (allActiveAudioItems.find((it) =>
        it.linkedItemId === activeVideoItem.id || activeVideoItem.linkedItemId === it.id
      ) ?? null)
    : null;

  // STANDALONE audio: voice-over / music / imported audio NOT linked to the current video.
  // These play via the <audio> element.
  const activeAudioItem = allActiveAudioItems.find((it) =>
    it.linkedItemId !== activeVideoItem?.id && activeVideoItem?.linkedItemId !== it.id
  ) ?? null;

  const activeDisplayEntry = activeTimelineItem?.sourceAssetId
    ? mediaBin.find((e) => e.id === activeTimelineItem.sourceAssetId)
    : null;
  const activeAudioEntry = activeAudioItem?.sourceAssetId
    ? mediaBin.find((e) => e.id === activeAudioItem.sourceAssetId)
    : null;

  // The bin's previewPath is a server disk path the browser can't load —
  // stream through the media API with an expiring signed URL instead.
  const displaySrc = useSignedMediaUrl(activeDisplayEntry?.versionId ?? null);
  const audioSrc   = useSignedMediaUrl(activeAudioEntry?.versionId ?? null);
  const videoSrc   = isActiveImage ? null : displaySrc;

  // Freeze the rAF clock while a clip's signed URL is still being fetched.
  // Covers: video clip loading, and standalone audio-only clips loading.
  useEffect(() => {
    const videoWaiting = !!(activeDisplayEntry?.versionId && !displaySrc);
    const audioWaiting = !!(activeAudioEntry?.versionId && !audioSrc && !videoSrc);
    mediaWaitingRef.current = videoWaiting || audioWaiting;
  }, [activeDisplayEntry?.versionId, displaySrc, activeAudioEntry?.versionId, audioSrc, videoSrc]);

  // Drive the preview loading overlay state machine:
  //   idle → loading (clip with versionId selected, URL pending)
  //   loading → completing (URL arrives)
  //   completing → idle (overlay calls onHidden after 100% animation)
  useEffect(() => {
    const itemId = activeTimelineItem?.id;
    const hasVersion = !!activeDisplayEntry?.versionId;
    if (itemId && hasVersion && !displaySrc) {
      if (mediaLoadPhase.kind === 'idle' || mediaLoadPhase.itemId !== itemId) {
        setMediaLoadPhase({ kind: 'loading', itemId });
      }
    } else if (displaySrc && mediaLoadPhase.kind === 'loading' && mediaLoadPhase.itemId === itemId) {
      setMediaLoadPhase({ kind: 'completing', itemId: mediaLoadPhase.itemId });
    } else if (!itemId || !hasVersion) {
      if (mediaLoadPhase.kind !== 'idle') setMediaLoadPhase({ kind: 'idle' });
    }
  }, [activeTimelineItem?.id, activeDisplayEntry?.versionId, displaySrc, mediaLoadPhase]);

  // TEXT items overlapping the playhead — overlaid on the preview as a
  // lower-third approximation of the rendered output.
  const activeTextItems = (timeline?.tracks ?? [])
    .filter((t) => t.kind === 'TEXT')
    .flatMap((t) => t.items ?? [])
    .filter((it) => it.timelineStartMs <= currentTimeMs && it.timelineEndMs > currentTimeMs);

  // Clip-local source time: timeline offset within the clip, scaled by its
  // speed, plus the source trim-in point. This is what the render produces,
  // so the preview seeks here instead of the raw global timeline time.
  const activeSourceSec = activeVideoItem
    ? ((activeVideoItem.sourceInMs ?? 0) + (currentTimeMs - activeVideoItem.timelineStartMs) * (activeVideoItem.properties?.speed ?? 1)) / 1000
    : 0;

  // Keep refs in sync so the rAF tick can read current values without stale closures.
  useEffect(() => { activeVideoItemRef.current = activeVideoItem; }, [activeVideoItem]);
  useEffect(() => { activeAudioItemRef.current = activeAudioItem; }, [activeAudioItem]);
  useEffect(() => { activeLinkedAudioItemRef.current = activeLinkedAudioItem; }, [activeLinkedAudioItem]);
  useEffect(() => { audioSrcRef.current = audioSrc ?? null; }, [audioSrc]);

  // When paused, snap the <video> to the exact seek position.
  // While playing, the rAF tick drives the video directly.
  useEffect(() => {
    if (playing) return;
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) v.pause();
    if (activeVideoItem) {
      const sourceSec = Math.max(0, ((activeVideoItem.sourceInMs ?? 0) + (currentTimeMs - activeVideoItem.timelineStartMs) * (activeVideoItem.properties?.speed ?? 1)) / 1000);
      if (Math.abs(v.currentTime - sourceSec) > 0.05) v.currentTime = sourceSec;
    }
  }, [playing, currentTimeMs, activeVideoItem]);

  // When paused, snap the <audio> to the seek position.
  // While playing, the rAF tick drives it directly.
  useEffect(() => {
    if (playing) return;
    const a = audioRef.current;
    if (!a) return;
    if (!audioSrc || !activeAudioItem) { if (!a.paused) a.pause(); return; }
    if (!a.paused) a.pause();
    const sourceSec = Math.max(0, ((activeAudioItem.sourceInMs ?? 0) + (currentTimeMs - activeAudioItem.timelineStartMs)) / 1000);
    if (Math.abs(a.currentTime - sourceSec) > 0.05) a.currentTime = sourceSec;
  }, [playing, currentTimeMs, activeAudioItem, audioSrc]);

  // Re-unlock audio when the signed URL loads after the user has already clicked Play.
  // The play() inside startPlay() fires in the gesture context but videoRef may have had
  // no src yet (URL was still fetching). Once videoSrc arrives, resume here — Chrome
  // allows this within ~1 s of the originating gesture.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing || !videoSrc) return;
    const item = activeVideoItemRef.current;
    if (!item) return;
    const vol = clamp((item.properties?.volume ?? 1) * globalVolumeRef.current, 0, 1);
    v.volume = vol;
    const linkedAudio = activeLinkedAudioItemRef.current;
    v.muted = globalMutedRef.current || !!linkedAudio?.properties?.muted;
    void v.play().catch(() => undefined);
  }, [videoSrc, playing]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !playing || !audioSrc) return;
    const aItem = activeAudioItemRef.current;
    a.muted = globalMutedRef.current || (aItem?.properties?.muted ?? false);
    void a.play().catch(() => undefined);
  }, [audioSrc, playing]);

  // Selected item
  const selectedItem = selectedItemId
    ? (timeline?.tracks ?? []).flatMap((t) => t.items ?? []).find((it) => it.id === selectedItemId) ?? null
    : null;

  // Drop from bin onto a specific track at a pixel position
  const handleDropFromBin = useCallback(async (trackId: string, xInTrack: number) => {
    const entry = draggedBinEntryRef.current;
    if (!entry) return;
    draggedBinEntryRef.current = null;

    let clipDurationMs = entry.durationMs ?? 0;
    if (!clipDurationMs && entry.versionId && ['VIDEO', 'SHORTS_SOURCE_VIDEO', 'MUSIC', 'VOICE'].includes(entry.kind)) {
      clipDurationMs = (await probeMediaDurationMs(entry.versionId)) ?? 5000;
    }
    if (!clipDurationMs) clipDurationMs = 5000;

    const dropMs = Math.max(0, Math.round(xToMs(xInTrack, pxPerSec)));
    updateTimeline((tl) => {
      const itemKind = binKindToItemKind(entry.kind);
      const endMs = dropMs + Math.max(1, Math.round(clipDurationMs));
      const ts = Date.now();
      const videoId = `item-${ts}-v`;
      const audioId = `item-${ts}-a`;
      const newItem: EditItem = {
        id: videoId,
        sourceAssetId: entry.id,
        kind: itemKind,
        timelineStartMs: dropMs,
        timelineEndMs: endMs,
        linkedItemId: itemKind === 'VIDEO' ? audioId : undefined,
      };
      const newDuration = Math.max(tl.durationMs, endMs);
      const dropTrack = tl.tracks.find((t) => t.id === trackId);
      if (!dropTrack) return tl;

      let newTracks = tl.tracks.map((t) => t.id === trackId ? { ...t, items: [...(t.items ?? []), newItem] } : t);

      if (itemKind === 'VIDEO') {
        const audioItem: EditItem = {
          id: audioId,
          sourceAssetId: entry.id,
          kind: 'AUDIO',
          timelineStartMs: dropMs,
          timelineEndMs: endMs,
          linkedItemId: videoId,
        };
        const audioTrack = newTracks.find((t) => t.kind === 'AUDIO');
        newTracks = audioTrack
          ? newTracks.map((t) => t.kind === 'AUDIO' ? { ...t, items: [...(t.items ?? []), audioItem] } : t)
          : [...newTracks, { id: `track-audio-${ts}`, kind: 'AUDIO' as const, label: 'Audio', items: [audioItem] }];
      }

      return { ...tl, durationMs: newDuration, tracks: newTracks };
    });
  }, [pxPerSec, updateTimeline, probeMediaDurationMs]);

  // All clip edge points for snapping (unique sorted list) — must be before early returns (Rules of Hooks)
  const allSnapPoints = useMemo(() => {
    const pts = new Set<number>();
    for (const tr of timeline?.tracks ?? []) {
      for (const it of tr.items ?? []) {
        pts.add(it.timelineStartMs);
        pts.add(it.timelineEndMs);
      }
    }
    return Array.from(pts).sort((a, b) => a - b);
  }, [timeline]);

  if (isLoading) {
    return <EditorLoadingScreen />;
  }

  if (loadError || !project) {
    const httpStatus = (loadError as { response?: { status?: number } } | null)?.response?.status;
    const apiMessage = (loadError as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;
    const is404 = httpStatus === 404;
    const is403 = httpStatus === 403;

    // 403 = stale or wrong-account editId (most common for free users after a re-login).
    // Clear the cached ID so the /editor redirect page creates a fresh blank edit.
    if (is403) {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('lastEditorId');
      router.replace('/editor');
      return <EditorLoadingScreen />;
    }

    return (
      <div className="p-8">
        <Link href="/editor" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Video Editor
        </Link>
        {is404 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 max-w-md">
            <p className="text-sm font-semibold text-amber-800 mb-1">Edit project not found</p>
            <p className="text-xs text-amber-700 mb-3">This edit may have been deleted or the link is outdated.</p>
            <Link href="/editor" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200">
              <ArrowLeft className="w-3 h-3" /> Back to My Edits
            </Link>
          </div>
        ) : (
          <JobErrorCard
            error={apiMessage ?? 'Could not load this edit project'}
            errorCode="JOB_FAILED"
            onRetry={() => { void qc.invalidateQueries({ queryKey: ['editor-project', editId] }); }}
          />
        )}
      </div>
    );
  }

  const dur = timeline?.durationMs ?? 0;
  const totalTimelineW = msToX(dur || 60000, pxPerSec);

  return (
    <div className="cf-editor-page relative flex flex-col h-full overflow-hidden">
      {/* ── Top progress bar ─────────────────────────────────────────────── */}
      {barVisible && (
        <div className="absolute top-0 left-0 right-0 z-[80] h-[3px] pointer-events-none" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-[width] duration-300 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-2 sm:px-4 border-b border-gray-100 bg-white shrink-0">
        {/* Left scrollable section: back, title, panel toggles, AI edit, guide */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none py-1.5">
        <button
          onClick={() => setShowHistory(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 h-9 w-9 flex items-center justify-center shrink-0"
          title="My edits"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Film className="w-4 h-4 text-brand-500 shrink-0" />
        <p className="font-semibold text-gray-800 text-sm truncate flex-1 min-w-0">{project.title}</p>

        {/* Desktop-only panel toggles (xl+) */}
        <button
          onClick={() => setBinPanelOpen(o => !o)}
          className="hidden lg:flex p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 h-9 w-9 items-center justify-center shrink-0"
          title="Media bin"
        >
          <Film className="w-4 h-4" />
        </button>
        <button
          onClick={() => setInspectorPanelOpen(o => !o)}
          className="hidden lg:flex p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 h-9 w-9 items-center justify-center shrink-0"
          title="Inspector"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* AI Edit — visible on all screen sizes */}
        <button
          onClick={() => { setShowAiEdit(true); setMobileSheet('none'); }}
          className="flex items-center gap-1.5 px-2 sm:px-3 h-9 border border-brand-200 text-brand-700 rounded-lg text-xs hover:bg-brand-50 shrink-0"
          title="AI edit"
        >
          <Wand2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">AI edit</span>
        </button>
        <Link
          href="/guide"
          className="hidden sm:flex items-center gap-1.5 px-3 h-9 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 shrink-0"
          title="How to use the editor"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Guide</span>
        </Link>
        </div>
        {/* Right non-scrollable section: save group + export — kept outside overflow-x-auto so the dropdown is never clipped */}
        <div className="flex items-center gap-1.5 shrink-0 py-1.5 pl-2 border-l border-gray-100 ml-1.5">
        {/* ── Save group: Save + dropdown (Save As / Auto-save / Versions) ── */}
        <div ref={saveMenuRef} className="relative flex items-center">
          {/* Primary Save button — calm status indicator when autosave is on */}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={`flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-l-lg text-xs font-medium transition-all disabled:opacity-40 border-r-0 ${
              saving
                ? 'border border-gray-200 text-gray-400'
                : autoSave
                  ? savedRecently
                    ? 'border border-green-200 text-green-600 bg-green-50'
                    : dirty
                      ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                      : 'border border-gray-200 text-gray-400 hover:bg-gray-50'
                  : dirty
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            title={saving ? 'Saving…' : dirty ? 'Save changes (Ctrl+S)' : 'All changes saved'}
          >
            {saving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : savedRecently
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <Save className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">
              {saving ? 'Saving…' : savedRecently ? 'Saved' : 'Save'}
            </span>
          </button>
          {/* Dropdown trigger */}
          <button
            onClick={() => setShowSaveMenu((v) => !v)}
            title="Save options"
            className={`flex items-center justify-center px-1.5 h-9 rounded-r-lg text-xs border transition-colors ${
              dirty
                ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 border-l border-amber-400'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showSaveMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Save options popover */}
          {showSaveMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSaveMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-40 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                {/* Auto-save toggle */}
                <button
                  onClick={() => { toggleAutoSave(); setShowSaveMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs hover:bg-gray-50 transition-colors"
                >
                  <span className={`relative w-8 h-4.5 rounded-full flex items-center transition-colors shrink-0 ${autoSave ? 'bg-green-500' : 'bg-gray-300'}`} style={{ height: '18px', width: '32px' }}>
                    <span className={`absolute w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${autoSave ? 'translate-x-[14px]' : 'translate-x-0.5'}`} />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-700">Auto-save</p>
                    <p className="text-[10px] text-gray-400">{autoSave ? 'On — saves 5 s after changes' : 'Off — manual save only'}</p>
                  </div>
                  {autoSave && <span className="text-green-500 text-[9px] font-bold uppercase tracking-wide">ON</span>}
                </button>

                <div className="h-px bg-gray-100 mx-3 my-1" />

                {/* Save As */}
                <button
                  onClick={() => { setShowSaveMenu(false); setShowSaveDialog(true); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs hover:bg-gray-50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                    <BookmarkPlus className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-700">Save as…</p>
                    <p className="text-[10px] text-gray-400">Name &amp; bookmark this state</p>
                  </div>
                </button>

              </div>
            </>
          )}
        </div>
        {canExport ? (
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 h-9 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700"
            title="Export"
          >
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </button>
        ) : (
          <button
            onClick={() => triggerUpgradeSheet({ feature: 'Export Video', plan: 'PRO' })}
            className="flex items-center gap-1.5 px-2 sm:px-3 h-9 border border-gray-200 text-gray-400 rounded-lg text-xs hover:bg-gray-50"
            title="Pro plan required to export videos"
          >
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </button>
        )}
        </div>{/* end right section */}
      </div>{/* end toolbar */}

      {/* ── Main layout: left bin / center / right inspector ───────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: Media Bin (xl+ collapsible inline, below xl slide-over) ── */}
        <aside className={`hidden lg:flex flex-col shrink-0 border-r border-gray-100 bg-gray-50 transition-all duration-200 ${binPanelOpen ? 'w-52' : 'w-9 overflow-hidden'}`}>
          <div className="px-2 py-2.5 border-b border-gray-100 flex items-center gap-1.5 min-h-[40px]">
            {binPanelOpen && <Film className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
            {binPanelOpen && <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1 truncate">Media bin</p>}
            <button
              onClick={() => setBinPanelOpen(o => !o)}
              className="p-1 rounded hover:bg-gray-200 shrink-0 ml-auto"
              title={binPanelOpen ? 'Collapse bin' : 'Expand bin'}
              aria-label={binPanelOpen ? 'Collapse media bin' : 'Expand media bin'}
            >
              {binPanelOpen ? <ChevronLeft className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          </div>
          {binPanelOpen && (
            <>
              <MediaBin
                entries={mediaBin}
                onAddToTimeline={handleAddToTimeline}
                onUpload={handleBinUpload}
                uploading={binUploading}
                onImportUrl={handleBinUrlImport}
                urlImporting={binUrlImporting}
                onOpenLibrary={() => setShowLibrary(true)}
                onDeleteEntry={handleBinDeleteEntry}
                onLockEntry={handleBinLockEntry}
                onEntryDragStart={(e) => { draggedBinEntryRef.current = e; }}
              />
            </>
          )}
        </aside>

        {/* Mobile bottom sheets — media bin and inspector */}
        {/* Backdrop — stops at bottom-14 so tab bar stays visible and clickable */}
        {mobileSheet !== 'none' && (
          <div
            className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/40"
            style={{ bottom: 56 }}
            onClick={() => setMobileSheet('none')}
            role="presentation"
          />
        )}

        {/* Media bin bottom sheet */}
        <div
          className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'media' ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ top: sheetTop, bottom: 56 }}
          role="dialog"
          aria-modal="true"
          aria-label="Media bin"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
            <Film className="w-4 h-4 text-brand-500" />
            <p className="text-sm font-semibold text-gray-800 flex-1">Media</p>
            <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <MediaBin
              entries={mediaBin}
              onAddToTimeline={(e) => { handleAddToTimeline(e); setMobileSheet('none'); }}
              onUpload={handleBinUpload}
              uploading={binUploading}
              onImportUrl={handleBinUrlImport}
              urlImporting={binUrlImporting}
              onOpenLibrary={() => { setShowLibrary(true); setMobileSheet('none'); }}
              onDeleteEntry={handleBinDeleteEntry}
              onLockEntry={handleBinLockEntry}
              onEntryDragStart={(e) => { draggedBinEntryRef.current = e; }}
            />
          </div>
        </div>

        {/* ── Center: Preview + Timeline ───────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Preview area — outer black container, inner frame sized to canvas aspect ratio */}
          <div ref={previewContainerRef} className="relative shrink-0 bg-black flex items-center justify-center" style={{ height: previewH }}>
            {/* Hidden audio element — outside the frame so it never clips */}
            <audio ref={audioRef} src={audioSrc ?? undefined} style={{ display: 'none' }}>
              <track kind="captions" />
            </audio>

            {/* Canvas frame: matches the selected canvas ratio (9:16, 1:1, 4:5, 16:9…).
                max-width/max-height ensure it fits inside the drag-resizable container.
                All overlays (text, secondary video) are positioned relative to this frame
                so x/y=50% always maps to the canvas centre regardless of canvas shape. */}
            <div
              ref={previewFrameRef}
              className="relative bg-black overflow-hidden"
              style={{
                aspectRatio: `${timeline?.width ?? 1920} / ${timeline?.height ?? 1080}`,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              {mediaLoadPhase.kind !== 'idle' && activeTimelineItem?.id === mediaLoadPhase.itemId && (
                <PreviewLoadingOverlay
                  key={mediaLoadPhase.itemId}
                  playing={playing}
                  onToggle={() => playing ? stopPlay() : startPlay()}
                  unavailable={!activeDisplayEntry?.versionId}
                  completed={mediaLoadPhase.kind === 'completing'}
                  onHidden={() => setMediaLoadPhase({ kind: 'idle' })}
                />
              )}
              {isActiveImage && displaySrc ? (
                <>
                  <img
                    src={displaySrc}
                    alt=""
                    className="w-full h-full object-contain"
                    style={{ opacity: clamp(activeTimelineItem?.properties?.opacity ?? 1, 0, 1) }}
                  />
                  {activeTextItems.map((it) => {
                    const p = it.properties ?? {};
                    const xPct = p.x ?? 50;
                    const yPct = p.y ?? 80;
                    const isSelected = it.id === selectedItemId;
                    const itemId = it.id;
                    return (
                      <span
                        key={itemId}
                        onPointerDown={(e) => {
                          if (!previewFrameRef.current) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setSelectedItemId(itemId);
                          const rect = previewFrameRef.current.getBoundingClientRect();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startXPct = xPct;
                          const startYPct = yPct;
                          const props = { ...p };
                          const onMove = (ev: PointerEvent) => {
                            const dx = ((ev.clientX - startX) / rect.width) * 100;
                            const dy = ((ev.clientY - startY) / rect.height) * 100;
                            updateTimeline((tl) => ({
                              ...tl,
                              tracks: tl.tracks.map((tr) => ({
                                ...tr,
                                items: (tr.items ?? []).map((i) =>
                                  i.id === itemId ? { ...i, properties: { ...props, x: clamp(startXPct + dx, 0, 100), y: clamp(startYPct + dy, 0, 100) } } : i
                                ),
                              })),
                            }), true);
                          };
                          const onUp = () => { e.currentTarget.removeEventListener('pointermove', onMove as EventListener); };
                          e.currentTarget.addEventListener('pointermove', onMove as EventListener);
                          e.currentTarget.addEventListener('pointerup', onUp, { once: true });
                        }}
                        className="absolute cursor-move px-2 max-w-[90%] whitespace-pre-wrap break-words select-none"
                        style={{
                          left: `${xPct}%`,
                          top: `${yPct}%`,
                          transform: `translate(-50%, -50%) rotate(${p.rotation ?? 0}deg)`,
                          color: p.color ?? '#ffffff',
                          fontSize: Math.max(10, (p.fontSize ?? 32) * 0.4),
                          opacity: clamp(p.opacity ?? 1, 0, 1),
                          fontFamily: p.fontFamily ?? 'sans-serif',
                          fontWeight: p.fontWeight ?? 'bold',
                          fontStyle: p.fontStyle ?? 'normal',
                          textAlign: (p.textAlign ?? 'center') as 'left' | 'center' | 'right',
                          textShadow: p.backgroundColor ? 'none' : '0 1px 3px rgba(0,0,0,0.8)',
                          backgroundColor: p.backgroundColor ?? undefined,
                          borderRadius: p.backgroundColor ? '4px' : undefined,
                          padding: p.backgroundColor ? '2px 6px' : undefined,
                          outline: isSelected ? '2px dashed rgba(251,191,36,0.8)' : 'none',
                          outlineOffset: '2px',
                        }}
                      >
                        {p.text ?? ''}
                      </span>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Always render the video element so videoRef is set when Play is
                      clicked — even if the signed URL hasn't arrived yet. Without this,
                      videoRef.current is null at click time, v.play() inside the
                      user-gesture context is skipped, and the browser blocks audio on
                      every subsequent rAF-triggered play() call. Hidden via CSS when
                      no src so it doesn't affect layout. */}
                  {/* Primary video — full-canvas by default; switches to draggable overlay when scale < 1 */}
                  {(() => {
                    const pvProps = activeVideoItem?.properties;
                    const pvScale = pvProps?.scale;
                    const pvIsOverlay = pvScale !== undefined && pvScale < 1;
                    const pvX = pvProps?.x ?? 50;
                    const pvY = pvProps?.y ?? 50;
                    const pvScaleVal = pvScale ?? 1;
                    const pvIsSelected = !!(activeVideoItem && selectedItemId === activeVideoItem.id);
                    if (pvIsOverlay && activeVideoItem) {
                      return (
                        <div
                          className="absolute select-none"
                          style={{
                            left: `${pvX}%`, top: `${pvY}%`,
                            width: `${pvScaleVal * 100}%`, aspectRatio: '16/9',
                            transform: 'translate(-50%, -50%)',
                            zIndex: pvIsSelected ? 50 : 2,
                            opacity: clamp(pvProps?.opacity ?? 1, 0, 1),
                            outline: pvIsSelected ? '2px solid rgba(250,204,21,0.8)' : '1px solid rgba(255,255,255,0.15)',
                            outlineOffset: '2px',
                            borderRadius: '3px',
                            cursor: 'move',
                            overflow: 'visible',
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedItemId(activeVideoItem.id); }}
                          onPointerDown={(e) => {
                            if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
                            e.stopPropagation();
                            const el = e.currentTarget;
                            el.setPointerCapture(e.pointerId);
                            setSelectedItemId(activeVideoItem.id);
                            const rect = previewFrameRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const startX = e.clientX, startY = e.clientY;
                            const startXPct = pvX, startYPct = pvY;
                            const onMove = (ev: PointerEvent) => {
                              const dx = ((ev.clientX - startX) / rect.width) * 100;
                              const dy = ((ev.clientY - startY) / rect.height) * 100;
                              handleUpdateItemProps(activeVideoItem.id, { x: clamp(startXPct + dx, 0, 100), y: clamp(startYPct + dy, 0, 100) }, true);
                            };
                            const onUp = () => { el.removeEventListener('pointermove', onMove as EventListener); };
                            el.addEventListener('pointermove', onMove as EventListener);
                            el.addEventListener('pointerup', onUp, { once: true });
                          }}
                        >
                          <video
                            ref={videoRef}
                            src={videoSrc ?? undefined}
                            className="w-full h-full object-cover pointer-events-none rounded"
                            style={{ display: (videoSrc && !pvProps?.hidden) ? undefined : 'none' }}
                            onLoadedMetadata={(e) => { e.currentTarget.currentTime = activeSourceSec; }}
                            playsInline
                          >
                            <track kind="captions" />
                          </video>
                          {pvIsSelected && (
                            <div
                              data-resize-handle="true"
                              title="Drag to resize"
                              className="absolute -bottom-2 -right-2 w-4 h-4 bg-yellow-400 rounded-sm cursor-se-resize flex items-center justify-center z-10"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const el = e.currentTarget;
                                el.setPointerCapture(e.pointerId);
                                const rect = previewFrameRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                const startX = e.clientX, startScl = pvScaleVal;
                                const onMove = (ev: PointerEvent) => {
                                  const dx = ((ev.clientX - startX) / rect.width) * 2;
                                  handleUpdateItemProps(activeVideoItem.id, { scale: clamp(startScl + dx, 0.05, 1.5) }, true);
                                };
                                const onUp = () => { el.removeEventListener('pointermove', onMove as EventListener); };
                                el.addEventListener('pointermove', onMove as EventListener);
                                el.addEventListener('pointerup', onUp, { once: true });
                              }}
                            >
                              <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1 7L7 1M4 7L7 4" stroke="black" strokeWidth="1.5" strokeLinecap="round" /></svg>
                            </div>
                          )}
                        </div>
                      );
                    }
                    // Full-canvas mode: render video directly with no wrapper to avoid layout regressions
                    return (
                      <video
                        ref={videoRef}
                        src={videoSrc ?? undefined}
                        className="w-full h-full object-contain"
                        style={{
                          opacity: clamp(pvProps?.opacity ?? 1, 0, 1),
                          display: (videoSrc && !pvProps?.hidden) ? undefined : 'none',
                        }}
                        onClick={() => { if (activeVideoItem) setSelectedItemId(activeVideoItem.id); }}
                        onLoadedMetadata={(e) => { e.currentTarget.currentTime = activeSourceSec; }}
                        playsInline
                      >
                        <track kind="captions" />
                      </video>
                    );
                  })()}
                  {/* Secondary video track layers — real <video> elements that play in sync */}
                  {(timeline?.tracks ?? [])
                    .filter((t) => t.kind === 'VIDEO')
                    .slice(1)
                    .flatMap((t, trackIdx) =>
                      (t.items ?? [])
                        .filter((it) => it.timelineStartMs <= currentTimeMs && it.timelineEndMs > currentTimeMs)
                        .map((it) => {
                          const binEntry = it.sourceAssetId ? mediaBin.find((e) => e.id === it.sourceAssetId) : null;
                          return (
                            <SecondaryVideoPlayer
                              key={it.id}
                              item={it}
                              versionId={binEntry?.versionId ?? null}
                              currentTimeMs={currentTimeMs}
                              isSelected={it.id === selectedItemId}
                              onSelect={() => setSelectedItemId(it.id)}
                              onRegister={handleRegisterSecondaryVideo}
                              onUpdateProps={handleUpdateItemProps}
                              previewContainerRef={previewFrameRef}
                              zIndexBase={3 + trackIdx}
                            />
                          );
                        })
                    )}
                  {/* Black placeholder shown when the active video clip is hidden (eye-off) */}
                  {videoSrc && activeVideoItem?.properties?.hidden && (
                    <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none">
                      <EyeOff className="w-8 h-8 text-white/30" />
                    </div>
                  )}
                  {videoSrc && activeTextItems.map((it) => {
                    const p = it.properties ?? {};
                    const xPct = p.x ?? 50;
                    const yPct = p.y ?? 80;
                    const isSelected = it.id === selectedItemId;
                    const itemId = it.id;
                    return (
                      <span
                        key={itemId}
                        onPointerDown={(e) => {
                          if (!previewFrameRef.current) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setSelectedItemId(itemId);
                          const rect = previewFrameRef.current.getBoundingClientRect();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startXPct = xPct;
                          const startYPct = yPct;
                          const props = { ...p };
                          const onMove = (ev: PointerEvent) => {
                            const dx = ((ev.clientX - startX) / rect.width) * 100;
                            const dy = ((ev.clientY - startY) / rect.height) * 100;
                            updateTimeline((tl) => ({
                              ...tl,
                              tracks: tl.tracks.map((tr) => ({
                                ...tr,
                                items: (tr.items ?? []).map((i) =>
                                  i.id === itemId ? { ...i, properties: { ...props, x: clamp(startXPct + dx, 0, 100), y: clamp(startYPct + dy, 0, 100) } } : i
                                ),
                              })),
                            }), true);
                          };
                          const onUp = () => { e.currentTarget.removeEventListener('pointermove', onMove as EventListener); };
                          e.currentTarget.addEventListener('pointermove', onMove as EventListener);
                          e.currentTarget.addEventListener('pointerup', onUp, { once: true });
                        }}
                        className="absolute cursor-move px-2 max-w-[90%] whitespace-pre-wrap break-words select-none"
                        style={{
                          left: `${xPct}%`,
                          top: `${yPct}%`,
                          transform: `translate(-50%, -50%) rotate(${p.rotation ?? 0}deg)`,
                          color: p.color ?? '#ffffff',
                          fontSize: Math.max(10, (p.fontSize ?? 32) * 0.4),
                          opacity: clamp(p.opacity ?? 1, 0, 1),
                          fontFamily: p.fontFamily ?? 'sans-serif',
                          fontWeight: p.fontWeight ?? 'bold',
                          fontStyle: p.fontStyle ?? 'normal',
                          textAlign: (p.textAlign ?? 'center') as 'left' | 'center' | 'right',
                          textShadow: p.backgroundColor ? 'none' : '0 1px 3px rgba(0,0,0,0.8)',
                          backgroundColor: p.backgroundColor ?? undefined,
                          borderRadius: p.backgroundColor ? '4px' : undefined,
                          padding: p.backgroundColor ? '2px 6px' : undefined,
                          outline: isSelected ? '2px dashed rgba(251,191,36,0.8)' : 'none',
                          outlineOffset: '2px',
                        }}
                      >
                        {p.text ?? ''}
                      </span>
                    );
                  })}
                  {!videoSrc && activeAudioItem && (
                    <div className="text-gray-400 text-sm text-center space-y-2 p-4">
                      <Volume2 className="w-10 h-10 mx-auto opacity-50" />
                      <p className="opacity-70 font-medium">Audio track</p>
                      <p className="text-xs opacity-40">{activeAudioEntry?.label ?? 'Playing audio…'}</p>
                    </div>
                  )}
                  {!videoSrc && !activeAudioItem && !activeTimelineItem && (
                    <div className="text-gray-600 text-sm text-center space-y-1 p-4">
                      <Film className="w-8 h-8 mx-auto opacity-40" />
                      <p className="opacity-60">Approximate preview</p>
                      <p className="text-xs opacity-40">Add media to the timeline to preview it here</p>
                    </div>
                  )}
                </>
              )}
              {/* Brand overlay — draggable watermark */}
              {brandOverlay?.visible && (
                <div
                  className="absolute cursor-move select-none z-50"
                  style={{
                    left: `${brandOverlay.x}%`,
                    top: `${brandOverlay.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={(e) => {
                    if (!previewFrameRef.current) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const rect = previewFrameRef.current.getBoundingClientRect();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startXPct = brandOverlay.x;
                    const startYPct = brandOverlay.y;
                    const onMove = (ev: PointerEvent) => {
                      const dx = ((ev.clientX - startX) / rect.width) * 100;
                      const dy = ((ev.clientY - startY) / rect.height) * 100;
                      setBrandOverlay(b => b ? { ...b, x: clamp(startXPct + dx, 0, 100), y: clamp(startYPct + dy, 0, 100) } : b);
                    };
                    const onUp = () => e.currentTarget.removeEventListener('pointermove', onMove as EventListener);
                    e.currentTarget.addEventListener('pointermove', onMove as EventListener);
                    e.currentTarget.addEventListener('pointerup', onUp, { once: true });
                  }}
                >
                  {brandOverlay.type === 'text' ? (
                    <span style={{ color: brandOverlay.color, fontWeight: 'bold', fontSize: Math.max(10, brandOverlay.size * 0.4), textShadow: '0 1px 3px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                      {brandOverlay.text || 'Brand Title'}
                    </span>
                  ) : brandOverlay.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brandOverlay.logoUrl} alt="Brand logo" style={{ height: Math.max(16, brandOverlay.size * 0.4), width: 'auto', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ color: brandOverlay.color, fontWeight: 'bold', fontSize: Math.max(10, brandOverlay.size * 0.4), textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Logo</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Transport bar */}
          <div className="shrink-0 bg-gray-900 text-white flex items-center gap-2 px-3 py-1">
            <button
              onClick={() => playing ? stopPlay() : startPlay()}
              className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div
              role="slider"
              aria-label="Seek"
              aria-valuenow={currentTimeMs}
              aria-valuemin={0}
              aria-valuemax={dur || 60000}
              tabIndex={0}
              className="flex-1 relative h-3 flex items-center cursor-pointer group"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const ms = Math.round(frac * (dur || 60000));
                currentTimeMsRef.current = ms;
                setCurrentTimeMs(ms);
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const ms = Math.round(frac * (dur || 60000));
                currentTimeMsRef.current = ms;
                setCurrentTimeMs(ms);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { const ms = Math.max(0, currentTimeMs - 1000); currentTimeMsRef.current = ms; setCurrentTimeMs(ms); }
                if (e.key === 'ArrowRight') { const ms = Math.min(dur, currentTimeMs + 1000); currentTimeMsRef.current = ms; setCurrentTimeMs(ms); }
              }}
            >
              <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full group-hover:h-2 transition-all">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-brand-400 rounded-full"
                  style={{ width: `${dur > 0 ? (currentTimeMs / dur) * 100 : 0}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${dur > 0 ? (currentTimeMs / dur) * 100 : 0}% - 6px)` }}
                />
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums">{fmtMs(currentTimeMs)} / {fmtMs(dur)}</span>
            {/* Volume popover */}
            <div className="relative">
              <button
                ref={volumeButtonRef}
                onClick={() => setVolumePopoverOpen(o => !o)}
                className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${globalMuted || globalVolume === 0 ? 'text-red-400 bg-red-900/30 hover:bg-red-900/50' : 'hover:bg-white/10'}`}
                title="Volume"
                aria-label="Volume"
              >
                {(globalMuted || globalVolume === 0) ? <VolumeX className="w-4 h-4" /> : globalVolume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {volumePopoverOpen && volumeButtonRef.current && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setVolumePopoverOpen(false)} />
                  <div
                    className="fixed z-40 bg-[#111318] border border-white/10 rounded-2xl shadow-2xl"
                    style={{
                      width: 204,
                      bottom: window.innerHeight - volumeButtonRef.current.getBoundingClientRect().top + 10,
                      left: Math.max(8, volumeButtonRef.current.getBoundingClientRect().left + volumeButtonRef.current.getBoundingClientRect().width / 2 - 102),
                    }}
                  >
                    <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
                      <Volume2 className="w-3.5 h-3.5 text-white/60" />
                      <span className="text-xs font-semibold text-white">Master Volume</span>
                      <span className="ml-auto text-[10px] text-white/40 tabular-nums">{Math.round(globalVolume * 100)}%</span>
                    </div>
                    <div className="px-4 py-4 flex flex-col gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(globalVolume * 100)}
                        onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10) / 100)}
                        className="w-full cursor-pointer accent-purple-500"
                        style={{ height: 4 }}
                      />
                      <button
                        onClick={handleGlobalMuteToggle}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${globalMuted ? 'bg-red-600/20 border-red-500/40 text-red-300' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.07] hover:text-white/80'}`}
                      >
                        {globalMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        {globalMuted ? 'Unmute' : 'Mute all'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Zoom controls — visible on all screen sizes */}
            <button
              onClick={() => setPxPerSec((p) => Math.max(1, p - 10))}
              className="flex p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] items-center justify-center"
              title="Zoom out (timeline)"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={pxPerSec}
              min={1}
              max={500}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) setPxPerSec(Math.min(500, v));
              }}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                setPxPerSec(isNaN(v) ? 40 : Math.max(1, Math.min(500, v)));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="w-10 text-xs text-white/80 tabular-nums text-center bg-white/10 rounded-md px-1 py-0.5 border border-white/10 focus:outline-none focus:border-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Zoom level — type to set"
              aria-label="Zoom level"
            />
            <button
              onClick={() => setPxPerSec((p) => Math.min(500, p + 10))}
              className="flex p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] items-center justify-center"
              title="Zoom in (timeline)"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* ── Drag-to-resize handle — preview vs timeline ──────────────── */}
          <div
            className="shrink-0 flex items-center justify-center bg-gray-950 cursor-row-resize select-none touch-none group"
            style={{ height: 7 }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              previewDragRef.current = { startY: e.clientY, startH: previewH };
            }}
            onPointerMove={(e) => {
              if (!previewDragRef.current) return;
              const newH = Math.max(100, Math.min(560, previewDragRef.current.startH + (e.clientY - previewDragRef.current.startY)));
              setPreviewH(newH);
            }}
            onPointerUp={() => { previewDragRef.current = null; }}
            onDoubleClick={() => setPreviewH(200)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize preview"
            title="Drag to resize · Double-click to reset"
          >
            <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-0.5 rounded-full bg-white group-hover:bg-brand-400 transition-colors" />
              <div className="w-1 h-1 rounded-full bg-white/70 group-hover:bg-brand-400 transition-colors" />
              <div className="w-8 h-0.5 rounded-full bg-white group-hover:bg-brand-400 transition-colors" />
            </div>
          </div>

          {/* Timeline — Professional dark multi-track editor */}
          <div className="flex-1 overflow-hidden bg-gray-900 flex flex-col" style={{ paddingBottom: 0 }}>
            {/* Timeline toolbar */}
            <div className="shrink-0 flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700">
              {/* Scrollable action buttons — overflow when toolbar is narrow */}
              <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-none">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 text-white"
                  title="Undo (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 text-white"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-white/20 mx-0.5 shrink-0" />
                <button
                  onClick={() => selectedItemId ? handleSplitItem(selectedItemId, currentTimeMsRef.current) : handleSplitAtPlayhead()}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 text-white shrink-0"
                  title="Split clip at playhead (S)"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Split</span>
                </button>
                <button
                  onClick={() => selectedItemId && handleMergeItem(selectedItemId)}
                  disabled={!mergeTarget}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 disabled:opacity-30 text-white shrink-0"
                  title="Merge with next clip (J)"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Merge</span>
                </button>
                <button
                  onClick={() => selectedItemId && handleDuplicateItem(selectedItemId)}
                  disabled={!selectedItemId}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 disabled:opacity-30 text-white shrink-0"
                  title="Duplicate selected (D)"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dupe</span>
                </button>
                <button
                  onClick={() => selectedItemId && handleCopyItem(selectedItemId)}
                  disabled={!selectedItemId}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 disabled:opacity-30 text-white shrink-0"
                  title="Copy selected (Ctrl+C)"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                {clipboard && (
                  <button
                    onClick={handlePasteItem}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-brand-500/20 text-brand-400 shrink-0"
                    title="Paste at playhead (Ctrl+V)"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Paste</span>
                  </button>
                )}
                <div className="w-px h-4 bg-white/20 mx-0.5 shrink-0" />
                <button
                  onClick={() => selectedItemId && handleDeleteItem(selectedItemId)}
                  disabled={!selectedItemId}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-500/20 disabled:opacity-30 text-red-400 shrink-0"
                  title="Delete clip (Del)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
                <button
                  onClick={() => selectedItemId && handleRippleDeleteItem(selectedItemId)}
                  disabled={!selectedItemId}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-500/20 disabled:opacity-30 text-red-400 shrink-0"
                  title="Ripple delete — close gap (Shift+Del)"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ripple</span>
                </button>
                <div className="w-px h-4 bg-white/20 mx-0.5 shrink-0" />
                <button
                  onClick={() => setSnapEnabled((s) => !s)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors shrink-0 ${snapEnabled ? 'text-brand-400 bg-brand-900/30' : 'text-gray-500 hover:bg-white/10 hover:text-white'}`}
                  title={snapEnabled ? 'Snap on (click to disable)' : 'Snap off (click to enable)'}
                >
                  <Magnet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Snap</span>
                </button>
                {/* Canvas size — desktop only inline popover (hidden on mobile) */}
                <div className="relative hidden lg:block shrink-0">
                  <button
                    ref={canvasButtonRef}
                    onClick={() => setCanvasPopoverOpen(o => !o)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors shrink-0 ${canvasPopoverOpen ? 'text-purple-400 bg-purple-900/30' : 'text-gray-500 hover:bg-white/10 hover:text-white'}`}
                    title="Canvas size"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Canvas</span>
                  </button>
                  {canvasPopoverOpen && canvasButtonRef.current && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setCanvasPopoverOpen(false)} />
                      <div
                        className="fixed z-40 bg-[#111318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        style={{
                          width: 224,
                          bottom: window.innerHeight - canvasButtonRef.current.getBoundingClientRect().top + 10,
                          left: canvasButtonRef.current.getBoundingClientRect().left,
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs font-semibold text-white">Canvas Size</span>
                        </div>
                        {/* Size cards */}
                        <div className="flex flex-col gap-1.5 p-3">
                          {([
                            { label: 'Shorts / Reels', sub: '9:16 · 1080×1920', Icon: Smartphone, w: 1080, h: 1920 },
                            { label: 'Square', sub: '1:1 · 1080×1080', Icon: Square, w: 1080, h: 1080 },
                            { label: 'Portrait', sub: '4:5 · 1080×1350', Icon: Film, w: 1080, h: 1350 },
                            { label: 'Widescreen', sub: '16:9 · 1920×1080', Icon: Monitor, w: 1920, h: 1080 },
                          ] as const).map(({ label, sub, Icon, w, h }) => {
                            const active = timeline?.width === w && timeline?.height === h;
                            return (
                              <button
                                key={sub}
                                onClick={() => { updateTimeline(tl => ({ ...tl, width: w, height: h })); setCanvasPopoverOpen(false); }}
                                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border transition-all ${active ? 'bg-purple-600/20 border-purple-500/40 text-white' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.07] hover:text-white/80'}`}
                              >
                                <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${active ? 'bg-purple-500/30 text-purple-300' : 'bg-white/[0.06] text-white/40'}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </span>
                                <span className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-xs font-semibold leading-none">{label}</span>
                                  <span className={`text-[10px] leading-none ${active ? 'text-white/50' : 'text-white/30'}`}>{sub}</span>
                                </span>
                                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Always-visible track add buttons — pinned to right, never clipped */}
              <div className="shrink-0 flex items-center gap-1 border-l border-white/10 pl-2">
                <button
                  onClick={() => handleAddTrack('VIDEO')}
                  className="flex items-center gap-1 px-2 py-1.5 rounded bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 transition-colors"
                  title="Add video track"
                >
                  <Plus className="w-3.5 h-3.5" /><Film className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAddTrack('AUDIO')}
                  className="flex items-center gap-1 px-2 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 transition-colors"
                  title="Add audio track"
                >
                  <Plus className="w-3.5 h-3.5" /><Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAddTextItem()}
                  className="flex items-center gap-1 px-2 py-1.5 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 transition-colors"
                  title="Add text overlay"
                >
                  <Plus className="w-3.5 h-3.5" /><Type className="w-3.5 h-3.5" />
                </button>
                {/* Record — desktop only inline popover (hidden on mobile) */}
                <div className="relative hidden lg:block shrink-0">
                  {isRecording ? (
                    <button
                      onClick={handleStopRecord}
                      className="flex items-center gap-1 px-2 py-1.5 rounded bg-red-600/40 text-red-300 border border-red-500/50 transition-colors"
                      title="Stop recording"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span className="text-[10px] font-mono tabular-nums ml-0.5">
                        {String(Math.floor(recordSec / 60)).padStart(2, '0')}:{String(recordSec % 60).padStart(2, '0')}
                      </span>
                    </button>
                  ) : (
                    <button
                      ref={recordButtonRef}
                      onClick={() => setRecordPopoverOpen(o => !o)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded border transition-colors ${recordPopoverOpen ? 'bg-red-600/40 text-red-300 border-red-500/50' : 'bg-red-600/20 hover:bg-red-600/40 text-red-300 border-red-500/30'}`}
                      title="Record audio or video"
                    >
                      <Plus className="w-3.5 h-3.5" /><Mic className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {recordPopoverOpen && !isRecording && recordButtonRef.current && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setRecordPopoverOpen(false)} />
                      <div
                        className="fixed z-40 bg-[#111318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        style={{
                          width: 224,
                          bottom: window.innerHeight - recordButtonRef.current.getBoundingClientRect().top + 10,
                          right: window.innerWidth - recordButtonRef.current.getBoundingClientRect().right,
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs font-semibold text-white">Live Capture</span>
                        </div>
                        {/* Mode cards */}
                        <div className="flex flex-col gap-1.5 p-3">
                          {([
                            { mode: 'audio' as const, Icon: Mic, label: 'Audio Only', sub: 'Voice narration, no camera' },
                            { mode: 'video' as const, Icon: Video, label: 'Audio + Video', sub: 'Record with camera' },
                          ]).map(({ mode, Icon, label, sub }) => {
                            const active = recordMode === mode;
                            return (
                              <button
                                key={mode}
                                onClick={() => setRecordMode(mode)}
                                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border transition-all ${active ? 'bg-red-600/20 border-red-500/40 text-white' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.07] hover:text-white/80'}`}
                              >
                                <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${active ? 'bg-red-500/30 text-red-300' : 'bg-white/[0.06] text-white/40'}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </span>
                                <span className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-xs font-semibold leading-none">{label}</span>
                                  <span className={`text-[10px] leading-none ${active ? 'text-white/50' : 'text-white/30'}`}>{sub}</span>
                                </span>
                                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        {/* Start button */}
                        <div className="px-3 pb-3">
                          <button
                            onClick={() => { setRecordPopoverOpen(false); void handleStartRecord(); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 active:scale-[0.98] text-white text-xs font-bold transition-all"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                            Start Recording
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline scroll area */}
            {!timeline ? (
              <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading timeline…
              </div>
            ) : (timeline.tracks ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500 text-sm gap-2">
                <Film className="w-8 h-8 opacity-30" />
                <p>Drag media from the bin onto tracks, or click + to add clips</p>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => handleAddTrack('VIDEO')} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 rounded text-xs">
                    <Plus className="w-3 h-3" /><Film className="w-3 h-3" /> Add Video Track
                  </button>
                  <button onClick={() => handleAddTrack('AUDIO')} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded text-xs">
                    <Plus className="w-3 h-3" /><Volume2 className="w-3 h-3" /> Add Audio Track
                  </button>
                </div>
              </div>
            ) : (
              <div ref={timelineScrollRef} className="flex-1 overflow-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                {(() => {
                  const totalW = Math.max(msToX(dur || 60000, pxPerSec) + 200, 600);
                  const tickIntervalMs = (() => {
                    const options = [500, 1000, 2000, 5000, 10000, 30000, 60000];
                    return options.find((ms) => msToX(ms, pxPerSec) >= 50) ?? 60000;
                  })();
                  const tickCount = Math.ceil((dur || 60000) / tickIntervalMs) + 2;
                  const snapPoints: number[] = [0, dur];
                  for (const track of timeline.tracks ?? []) {
                    for (const item of track.items ?? []) {
                      snapPoints.push(item.timelineStartMs, item.timelineEndMs);
                    }
                  }
                  return (
                    <div className="relative" style={{ minWidth: LABEL_W + totalW + 16 }}>
                      {/* Sticky ruler — click/drag to seek */}
                      <div
                        className="sticky top-0 z-20 flex bg-gray-800 border-b border-gray-700 cursor-col-resize select-none"
                        style={{ height: 28 }}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          const wasPlaying = rafRef.current !== null;
                          if (wasPlaying) stopPlay();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left - LABEL_W;
                          if (x >= 0) {
                            const ms = Math.max(0, Math.round(xToMs(x, pxPerSec)));
                            currentTimeMsRef.current = ms;
                            setCurrentTimeMs(ms);
                          }
                          if (wasPlaying) {
                            const el = e.currentTarget;
                            el.addEventListener('pointerup', () => startPlay(), { once: true });
                          }
                        }}
                        onPointerMove={(e) => {
                          if (e.buttons !== 1) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left - LABEL_W;
                          if (x < 0) return;
                          const ms = Math.max(0, Math.min(dur || 60000, Math.round(xToMs(x, pxPerSec))));
                          currentTimeMsRef.current = ms;
                          setCurrentTimeMs(ms);
                        }}
                      >
                        <div style={{ width: LABEL_W }} className="shrink-0 border-r border-gray-700" />
                        <div className="relative flex-1" style={{ width: totalW }}>
                          {Array.from({ length: tickCount }).map((_, i) => {
                            const ms = i * tickIntervalMs;
                            return (
                              <div
                                key={i}
                                className="absolute top-0 flex flex-col items-start pointer-events-none"
                                style={{ left: msToX(ms, pxPerSec) }}
                              >
                                <div className="w-px h-2 bg-white/30 mt-1" />
                                <span className="text-[9px] text-gray-400 pl-0.5 mt-0.5 whitespace-nowrap">{fmtMs(ms)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Playhead line — spans ruler + all tracks */}
                      <div
                        className="absolute top-0 bottom-0 z-30 pointer-events-none"
                        style={{ left: LABEL_W + msToX(currentTimeMs, pxPerSec), width: 1 }}
                      >
                        <div className="w-full h-full bg-red-500 opacity-80" />
                        {/* Draggable diamond — pointer-events-auto breaks out of the none parent */}
                        <div
                          className="absolute -left-2.5 w-5 h-5 bg-red-500 rotate-45 cursor-ew-resize pointer-events-auto touch-none select-none"
                          style={{ top: 18 }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const el = e.currentTarget;
                            el.setPointerCapture(e.pointerId);
                            const startX = e.clientX;
                            const startMs = currentTimeMsRef.current;
                            const wasPlaying = rafRef.current !== null;
                            if (wasPlaying) stopPlay();
                            const onMove = (ev: PointerEvent) => {
                              const dx = ev.clientX - startX;
                              const newMs = Math.max(0, Math.min(dur || 60000, Math.round(startMs + (dx / pxPerSec) * 1000)));
                              currentTimeMsRef.current = newMs;
                              setCurrentTimeMs(newMs);
                              // Auto-scroll to keep playhead in view during drag.
                              const scrollEl = timelineScrollRef.current;
                              if (scrollEl) {
                                const playheadX = LABEL_W + msToX(newMs, pxPerSec);
                                const { scrollLeft, clientWidth } = scrollEl;
                                const MARGIN = 80;
                                if (playheadX > scrollLeft + clientWidth - MARGIN) {
                                  scrollEl.scrollLeft = playheadX - clientWidth + MARGIN;
                                } else if (playheadX < scrollLeft + LABEL_W + MARGIN) {
                                  scrollEl.scrollLeft = Math.max(0, playheadX - LABEL_W - MARGIN);
                                }
                              }
                            };
                            const onUp = () => {
                              el.removeEventListener('pointermove', onMove as EventListener);
                              if (wasPlaying) startPlay();
                            };
                            el.addEventListener('pointermove', onMove as EventListener);
                            el.addEventListener('pointerup', onUp, { once: true });
                          }}
                        />
                      </div>

                      {/* Tracks */}
                      {(() => {
                        // Asset IDs that appear in MORE than one track = linked clips
                        return (
                          <div className="flex flex-col">
                            {(timeline.tracks ?? []).map((track, trackIdx) => (
                              <TimelineTrack
                                key={track.id}
                                track={track}
                                durationMs={dur || 60000}
                                pxPerSec={pxPerSec}
                                selectedId={selectedItemId}
                                snapPoints={snapEnabled ? allSnapPoints : []}
                                nameMap={assetNameMap}
                                trackIndex={trackIdx}
                                totalTracks={(timeline.tracks ?? []).length}
                                onSelect={(id) => {
                                  // Single tap/click = select only. Inspector stays closed.
                                  setSelectedItemId(id || null);
                                }}
                                onOpenInspector={(id) => {
                                  // Double-tap / long-press / edit button = select + open inspector
                                  setSelectedItemId(id || null);
                                  if (id && window.innerWidth < 1024) setMobileSheet('inspector');
                                }}
                                onMoveItem={handleMoveItem}
                                onTrimItem={handleTrimItem}
                                onItemDragStart={pushUndo}
                                onDropFromBin={handleDropFromBin}
                                onMuteItem={handleMuteItem}
                                onHideItem={handleHideItem}
                                onDelinkItem={handleDelinkItem}
                                onDeleteTrack={handleDeleteTrack}
                                onCrossTrackDrop={handleCrossTrackDrop}
                                onMoveTrack={(dir) => handleMoveTrack(track.id, dir)}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Inspector (xl+ collapsible inline, below xl slide-over) ─ */}
        <aside className={`hidden lg:flex flex-col shrink-0 border-l border-gray-100 bg-white transition-all duration-200 ${inspectorPanelOpen ? 'w-72' : 'w-9 overflow-hidden'}`}>
          <div className="px-2 py-2.5 border-b border-gray-100 flex items-center gap-1.5 min-h-[40px]">
            <button
              onClick={() => setInspectorPanelOpen(o => !o)}
              className="p-1 rounded hover:bg-gray-100 shrink-0"
              title={inspectorPanelOpen ? 'Collapse inspector' : 'Expand inspector'}
              aria-label={inspectorPanelOpen ? 'Collapse inspector' : 'Expand inspector'}
            >
              {inspectorPanelOpen ? <ChevronRight className="w-3.5 h-3.5 text-gray-500" /> : <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />}
            </button>
            {inspectorPanelOpen && <Maximize2 className="w-3.5 h-3.5 text-gray-500" />}
            {inspectorPanelOpen && <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Inspector</p>}
          </div>
          {inspectorPanelOpen && (
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <Inspector item={selectedItem} onChange={handleInspectorChange} onDelete={selectedItemId ? () => handleDeleteItem(selectedItemId) : undefined} onDetachAudio={selectedItem?.kind === 'VIDEO' ? () => { void handleDetachAudio(selectedItem); } : undefined} currentTimeMs={currentTimeMs} editId={editId} onAddToTimeline={handleAddToTimeline} onSplit={handleSplitAtPlayhead} onMerge={selectedItemId ? () => handleMergeItem(selectedItemId) : undefined} onDuplicate={selectedItemId ? () => handleDuplicateItem(selectedItemId) : undefined} onRippleDelete={selectedItemId ? () => handleRippleDeleteItem(selectedItemId) : undefined} canMerge={!!mergeTarget} onCopy={selectedItemId ? () => handleCopyItem(selectedItemId) : undefined} onPaste={clipboard ? handlePasteItem : undefined} />
              {selectedItem?.kind === 'TEXT' && (() => {
                const tp = selectedItem.properties ?? {};
                const setT = (k: string, v: unknown) => handleInspectorChange({ properties: { ...tp, [k]: v } });
                return (
                  <div className="px-4 py-3 space-y-5 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Transform</p>
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Size</label>
                        <span className="text-xs text-gray-500 font-mono">{tp.fontSize ?? 36}px</span>
                      </div>
                      <input type="range" min={12} max={120} step={2} value={tp.fontSize ?? 36} onChange={(e) => setT('fontSize', parseInt(e.target.value, 10))} className="w-full accent-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</label>
                        <span className="text-[10px] text-gray-400 font-mono">{tp.x ?? 50}% · {tp.y ?? 80}%</span>
                      </div>
                      <div
                        className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none touch-none"
                        style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100)));
                          const y = Math.round(Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100)));
                          handleInspectorChange({ properties: { ...tp, x, y } });
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={{ borderRight: '1px solid rgba(255,255,255,0.12)', borderLeft: '1px solid rgba(255,255,255,0.12)', left: '33.3%', right: '33.3%' }} />
                        <div className="absolute inset-0 pointer-events-none" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', borderTop: '1px solid rgba(255,255,255,0.12)', top: '33.3%', bottom: '33.3%' }} />
                        <div className="absolute inset-[6%] rounded-lg border border-dashed border-white/10 pointer-events-none" />
                        <div className="absolute pointer-events-none flex flex-col items-center gap-0.5" style={{ left: `${tp.x ?? 50}%`, top: `${tp.y ?? 80}%`, transform: 'translate(-50%, -50%)' }}>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md max-w-[80px] truncate text-center leading-tight" style={{ color: tp.color ?? '#ffffff', fontFamily: tp.fontFamily ?? 'sans-serif', fontWeight: tp.fontWeight ?? 'bold', fontStyle: tp.fontStyle ?? 'normal', backgroundColor: tp.backgroundColor ?? 'rgba(0,0,0,0.45)', transform: `rotate(${tp.rotation ?? 0}deg)` }}>{tp.text?.slice(0, 12) || 'Text'}</span>
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow ring-2 ring-amber-400/40" />
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-3 mt-3">
                        <button onClick={() => setT('x', Math.max(5, (tp.x ?? 50) - 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move left">←</button>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => setT('y', Math.max(5, (tp.y ?? 80) - 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move up">↑</button>
                          <button onClick={() => setT('y', Math.min(95, (tp.y ?? 80) + 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move down">↓</button>
                        </div>
                        <button onClick={() => setT('x', Math.min(95, (tp.x ?? 50) + 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move right">→</button>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rotation</label>
                        <span className="text-xs text-gray-500 font-mono">{tp.rotation ?? 0}°</span>
                      </div>
                      <input type="range" min={-180} max={180} step={1} value={tp.rotation ?? 0} onChange={(e) => setT('rotation', parseInt(e.target.value, 10))} className="w-full accent-amber-500" />
                    </div>
                  </div>
                );
              })()}

              {/* ── Brand Overlay ─────────────────────────────────────────── */}
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Brand
                  </p>
                  <button
                    onClick={() => {
                      if (!brandOverlay) {
                        setBrandOverlay({ type: 'text', text: '', logoUrl: '', x: 50, y: 10, size: 32, visible: true, color: '#ffffff' });
                      } else {
                        setBrandOverlay((b) => b ? { ...b, visible: !b.visible } : b);
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      brandOverlay
                        ? brandOverlay.visible
                          ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {brandOverlay ? (brandOverlay.visible ? 'Visible' : 'Hidden') : 'Add Brand'}
                  </button>
                </div>
                {brandOverlay && (
                  <div className="space-y-3">
                    {/* Type toggle */}
                    <div className="flex gap-2">
                      {(['text', 'logo'] as const).map((t) => (
                        <button key={t} onClick={() => setBrandOverlay((b) => b ? { ...b, type: t } : b)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${brandOverlay.type === t ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {t === 'text' ? <><Type className="w-3 h-3 inline mr-1" />Text</> : <><Image className="w-3 h-3 inline mr-1" />Logo</>}
                        </button>
                      ))}
                    </div>
                    {/* Text or logo input */}
                    {brandOverlay.type === 'text' ? (
                      <div className="space-y-2">
                        <input type="text" value={brandOverlay.text}
                          onChange={(e) => setBrandOverlay((b) => b ? { ...b, text: e.target.value } : b)}
                          placeholder="@YourChannel"
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Color</span>
                          <input type="color" value={brandOverlay.color}
                            onChange={(e) => setBrandOverlay((b) => b ? { ...b, color: e.target.value } : b)}
                            className="w-8 h-7 rounded cursor-pointer border border-gray-200" />
                        </div>
                      </div>
                    ) : (
                      <input type="url" value={brandOverlay.logoUrl}
                        onChange={(e) => setBrandOverlay((b) => b ? { ...b, logoUrl: e.target.value } : b)}
                        placeholder="https://logo-url..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    )}
                    {/* 9-point position grid */}
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1.5">Quick position</p>
                      <div className="grid grid-cols-3 gap-1">
                        {([
                          { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
                          { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
                          { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
                        ] as const).map((pos, i) => (
                          <button key={i} onClick={() => setBrandOverlay((b) => b ? { ...b, x: pos.x, y: pos.y } : b)}
                            className={`h-7 rounded border transition-colors ${Math.abs(brandOverlay.x - pos.x) < 3 && Math.abs(brandOverlay.y - pos.y) < 3 ? 'bg-purple-600 border-purple-600' : 'border-gray-200 hover:bg-purple-50'}`} />
                        ))}
                      </div>
                    </div>
                    {/* Size slider */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-6">Sz</span>
                      <input type="range" min={16} max={96} value={brandOverlay.size}
                        onChange={(e) => setBrandOverlay((b) => b ? { ...b, size: Number(e.target.value) } : b)}
                        className="flex-1 accent-purple-600" />
                      <span className="text-xs text-gray-400 w-10 text-right">{Math.round(brandOverlay.size)}px</span>
                    </div>
                    {/* Remove */}
                    <button onClick={() => setBrandOverlay(null)}
                      className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 py-1.5 rounded-lg border border-red-100 transition-colors">
                      Remove brand overlay
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Inspector bottom sheet — only half height so timeline stays usable */}
        <div
          className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'inspector' ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ top: sheetTop, bottom: 56 }}
          role="dialog"
          aria-modal="true"
          aria-label="Inspector"
        >
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
            <Settings2 className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-800 flex-1">
              {selectedItem ? `${selectedItem.kind.charAt(0) + selectedItem.kind.slice(1).toLowerCase()} Clip` : 'Inspector'}
            </p>
            <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close inspector">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <Inspector item={selectedItem} onChange={handleInspectorChange} onDelete={selectedItemId ? () => handleDeleteItem(selectedItemId) : undefined} onDetachAudio={selectedItem?.kind === 'VIDEO' ? () => { void handleDetachAudio(selectedItem); } : undefined} currentTimeMs={currentTimeMs} editId={editId} onAddToTimeline={handleAddToTimeline} onSplit={handleSplitAtPlayhead} onMerge={selectedItemId ? () => handleMergeItem(selectedItemId) : undefined} onDuplicate={selectedItemId ? () => handleDuplicateItem(selectedItemId) : undefined} onRippleDelete={selectedItemId ? () => handleRippleDeleteItem(selectedItemId) : undefined} canMerge={!!mergeTarget} onCopy={selectedItemId ? () => handleCopyItem(selectedItemId) : undefined} onPaste={clipboard ? handlePasteItem : undefined} />
            {selectedItem?.kind === 'TEXT' && (() => {
              const tp = selectedItem.properties ?? {};
              const setT = (k: string, v: unknown) => handleInspectorChange({ properties: { ...tp, [k]: v } });
              return (
                <div className="px-4 py-3 space-y-5 border-t border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Transform</p>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Size</label>
                      <span className="text-xs text-gray-500 font-mono">{tp.fontSize ?? 36}px</span>
                    </div>
                    <input type="range" min={12} max={120} step={2} value={tp.fontSize ?? 36} onChange={(e) => setT('fontSize', parseInt(e.target.value, 10))} className="w-full accent-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</label>
                      <span className="text-[10px] text-gray-400 font-mono">{tp.x ?? 50}% · {tp.y ?? 80}%</span>
                    </div>
                    <div
                      className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none touch-none"
                      style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100)));
                        const y = Math.round(Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100)));
                        handleInspectorChange({ properties: { ...tp, x, y } });
                      }}
                    >
                      <div className="absolute inset-0 pointer-events-none" style={{ borderRight: '1px solid rgba(255,255,255,0.12)', borderLeft: '1px solid rgba(255,255,255,0.12)', left: '33.3%', right: '33.3%' }} />
                      <div className="absolute inset-0 pointer-events-none" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', borderTop: '1px solid rgba(255,255,255,0.12)', top: '33.3%', bottom: '33.3%' }} />
                      <div className="absolute inset-[6%] rounded-lg border border-dashed border-white/10 pointer-events-none" />
                      <div className="absolute pointer-events-none flex flex-col items-center gap-0.5" style={{ left: `${tp.x ?? 50}%`, top: `${tp.y ?? 80}%`, transform: 'translate(-50%, -50%)' }}>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md max-w-[80px] truncate text-center leading-tight" style={{ color: tp.color ?? '#ffffff', fontFamily: tp.fontFamily ?? 'sans-serif', fontWeight: tp.fontWeight ?? 'bold', fontStyle: tp.fontStyle ?? 'normal', backgroundColor: tp.backgroundColor ?? 'rgba(0,0,0,0.45)', transform: `rotate(${tp.rotation ?? 0}deg)` }}>{tp.text?.slice(0, 12) || 'Text'}</span>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow ring-2 ring-amber-400/40" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <button onClick={() => setT('x', Math.max(5, (tp.x ?? 50) - 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move left">←</button>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => setT('y', Math.max(5, (tp.y ?? 80) - 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move up">↑</button>
                        <button onClick={() => setT('y', Math.min(95, (tp.y ?? 80) + 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move down">↓</button>
                      </div>
                      <button onClick={() => setT('x', Math.min(95, (tp.x ?? 50) + 2))} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-gray-500 text-base font-bold transition-colors" title="Move right">→</button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rotation</label>
                      <span className="text-xs text-gray-500 font-mono">{tp.rotation ?? 0}°</span>
                    </div>
                    <input type="range" min={-180} max={180} step={1} value={tp.rotation ?? 0} onChange={(e) => setT('rotation', parseInt(e.target.value, 10))} className="w-full accent-amber-500" />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Canvas Size bottom sheet */}
        <div
          className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'canvas' ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ top: sheetTop, bottom: 56 }}
          role="dialog"
          aria-modal="true"
          aria-label="Canvas size"
        >
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
            <Layers className="w-4 h-4 text-brand-600" />
            <p className="text-sm font-semibold text-gray-800 flex-1">Canvas Size</p>
            <span className="text-xs text-gray-400 font-mono mr-2">{timeline?.width ?? 1920}×{timeline?.height ?? 1080}</span>
            <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close canvas">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: 'Shorts / Reels', sub: '9:16 · 1080×1920', w: 1080, h: 1920, Icon: Smartphone },
                { label: 'Square', sub: '1:1 · 1080×1080', w: 1080, h: 1080, Icon: Square },
                { label: 'Portrait', sub: '4:5 · 1080×1350', w: 1080, h: 1350, Icon: Film },
                { label: 'Widescreen', sub: '16:9 · 1920×1080', w: 1920, h: 1080, Icon: Monitor },
              ] as const).map((p) => {
                const active = timeline?.width === p.w && timeline?.height === p.h;
                return (
                  <button
                    key={p.sub}
                    onClick={() => {
                      updateTimeline((tl) => ({ ...tl, width: p.w, height: p.h }));
                      setMobileSheet('none');
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
            <p className="text-[10px] text-gray-400 text-center">Canvas dimensions apply to the rendered output. The preview scales proportionally.</p>
          </div>
        </div>

        {/* Tools bottom sheet — undo/redo/split/delete/snap */}
        <div
          className={`lg:hidden fixed left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'tools' ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ top: sheetTop, bottom: 56 }}
          role="dialog"
          aria-modal="true"
          aria-label="Edit tools"
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
            <Scissors className="w-4 h-4 text-white/70" />
            <p className="text-sm font-semibold text-white flex-1">Tools</p>
            <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Close tools">
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
          <div className="overflow-y-auto">
            <div className="grid grid-cols-4 gap-3 px-4 py-4">
              {[
                { icon: <RotateCcw className="w-5 h-5" />, label: 'Undo', action: handleUndo, disabled: !canUndo, color: 'text-white' },
                { icon: <RotateCw className="w-5 h-5" />, label: 'Redo', action: handleRedo, disabled: !canRedo, color: 'text-white' },
                { icon: <Scissors className="w-5 h-5" />, label: 'Split', action: () => selectedItemId ? handleSplitItem(selectedItemId, currentTimeMsRef.current) : handleSplitAtPlayhead(), disabled: false, color: 'text-white' },
                { icon: <GitMerge className="w-5 h-5" />, label: 'Merge', action: () => selectedItemId && handleMergeItem(selectedItemId), disabled: !mergeTarget, color: 'text-white' },
                { icon: <Copy className="w-5 h-5" />, label: 'Dupe', action: () => selectedItemId && handleDuplicateItem(selectedItemId), disabled: !selectedItemId, color: 'text-white' },
                { icon: <Clipboard className="w-5 h-5" />, label: 'Copy', action: () => selectedItemId && handleCopyItem(selectedItemId), disabled: !selectedItemId, color: 'text-white' },
                { icon: <ClipboardPaste className="w-5 h-5" />, label: 'Paste', action: handlePasteItem, disabled: !clipboard, color: 'text-brand-400' },
                { icon: <Trash2 className="w-5 h-5" />, label: 'Delete', action: () => selectedItemId && handleDeleteItem(selectedItemId), disabled: !selectedItemId, color: 'text-red-400' },
                { icon: <Eraser className="w-5 h-5" />, label: 'Ripple', action: () => selectedItemId && handleRippleDeleteItem(selectedItemId), disabled: !selectedItemId, color: 'text-red-400' },
                { icon: <Magnet className="w-5 h-5" />, label: snapEnabled ? 'Snap On' : 'Snap Off', action: () => setSnapEnabled(s => !s), disabled: false, color: snapEnabled ? 'text-brand-400' : 'text-gray-400' },
                { icon: <Film className="w-5 h-5" />, label: '+ Video', action: () => { handleAddTrack('VIDEO'); setMobileSheet('none'); }, disabled: false, color: 'text-violet-400' },
                { icon: <Volume2 className="w-5 h-5" />, label: '+ Audio', action: () => { handleAddTrack('AUDIO'); setMobileSheet('none'); }, disabled: false, color: 'text-emerald-400' },
                { icon: <Trash2 className="w-5 h-5" />, label: 'Clear Empty', action: () => { handleClearEmptyTracks(); setMobileSheet('none'); }, disabled: (timeline?.tracks ?? []).every(t => (t.items ?? []).length > 0), color: 'text-orange-400' },
                { icon: <Wand2 className="w-5 h-5" />, label: 'AI Edit', action: () => { setShowAiEdit(true); setMobileSheet('none'); }, disabled: false, color: 'text-brand-400' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => { if (!item.disabled) item.action(); }}
                  disabled={item.disabled}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors ${item.color}`}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium text-white/70 leading-tight text-center">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Studio tools section */}
            <div className="px-4 pb-4">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2.5">Studio</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { icon: <Type className="w-5 h-5" />, label: 'Text', action: () => { handleAddTextItem(); setMobileSheet('text'); }, color: 'text-amber-400' },
                  { icon: <SlidersHorizontal className="w-5 h-5" />, label: 'Canvas', action: () => setMobileSheet('canvas'), color: 'text-purple-400' },
                  { icon: <Mic className="w-5 h-5" />, label: 'Record', action: () => setMobileSheet('record'), color: 'text-red-400' },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors ${item.color}`}
                  >
                    {item.icon}
                    <span className="text-[10px] font-medium text-white/70 leading-tight text-center">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
        </div>

      </div>

      {/* ── Text Tool bottom sheet ────────────────────────────────────────── */}
      {mobileSheet === 'text' && (
        <div
          className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/30"
          style={{ bottom: 56 }}
          onClick={() => setMobileSheet('none')}
          role="presentation"
        />
      )}
      <div
        className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'text' ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ top: sheetTop, bottom: 56 }}
        role="dialog"
        aria-modal="true"
        aria-label="Text tool"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
          <Type className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-semibold text-gray-800 flex-1">Text Tool</p>
          <button
            onClick={() => { handleAddTextItem(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600"
          >
            <Plus className="w-3.5 h-3.5" /> Add Text
          </button>
          <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-gray-100 ml-1" aria-label="Close text tool">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body — only shown when a TEXT item is selected */}
        {(() => {
          const sel = selectedItemId
            ? (timeline?.tracks ?? []).flatMap((t) => t.items ?? []).find((it) => it.id === selectedItemId)
            : null;
          const isText = sel?.kind === 'TEXT';
          if (!isText) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Type className="w-10 h-10 text-amber-400" />
                <p className="text-sm font-semibold text-gray-700">No text selected</p>
                <p className="text-xs text-gray-400">Tap "+ Add Text" to place a new text overlay, or select an existing one from the timeline.</p>
              </div>
            );
          }
          const p = sel.properties ?? {};
          const set = (key: keyof EditItemProperties, val: string | number | boolean) =>
            handleInspectorChange({ properties: { ...p, [key]: val } });

          const EMOJI_GROUPS = [
            { label: 'Faces', items: ['😀','😂','😍','🥰','😎','🤩','😭','😱','🥳','🤔','😴','🤣','😅','🥺','🤯','😤','🫶','🙌','👏','🤝'] },
            { label: 'Hearts', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','🔥','✨','⭐','🌟','💫'] },
            { label: 'Symbols', items: ['✅','❌','⚡','🎯','🚀','🎉','🎊','🏆','🥇','💪','👑','💎','🎵','🎶','📌','🔑','💡','📣','🌈','🍀'] },
            { label: 'People', items: ['👍','👎','👋','🤙','✌️','🤞','🫰','☝️','👇','👈','👉','🙏','💪','🦾','👀','👁️','🫦','🧠','🫀','🦷'] },
            { label: 'Nature', items: ['🌸','🌺','🌻','🌹','🌿','🍃','🌊','🔥','💧','🌙','☀️','⭐','🌈','🦋','🐝','🦄','🐬','🦅','🌴','🍄'] },
          ];

          const FONTS = [
            { label: 'Sans', value: 'sans-serif' },
            { label: 'Serif', value: 'Georgia, serif' },
            { label: 'Impact', value: 'Impact, sans-serif' },
            { label: 'Mono', value: 'Courier New, monospace' },
            { label: 'Cursive', value: 'cursive' },
          ] as const;

          const COLOR_SWATCHES = ['#ffffff', '#000000', '#facc15', '#f87171', '#60a5fa', '#4ade80', '#f472b6', '#a78bfa'];

          return (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Text content */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Text Content</label>
                <textarea
                  value={p.text ?? ''}
                  onChange={(e) => set('text', e.target.value)}
                  rows={3}
                  placeholder="Enter your text…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{
                    fontFamily: p.fontFamily ?? 'sans-serif',
                    fontWeight: p.fontWeight ?? 'bold',
                    fontStyle: p.fontStyle ?? 'normal',
                    textAlign: (p.textAlign ?? 'center') as 'left' | 'center' | 'right',
                    color: p.color ?? '#111',
                  }}
                />
              </div>

              {/* Emoji & Symbols */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Emoji &amp; Symbols</label>
                <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-none">
                  {EMOJI_GROUPS.map((g, i) => (
                    <button
                      key={g.label}
                      onClick={() => setEmojiTab(i)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${emojiTab === i ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-10 gap-0.5">
                  {EMOJI_GROUPS[emojiTab]?.items.map((em) => (
                    <button
                      key={em}
                      onClick={() => set('text', (p.text ?? '') + em)}
                      className="text-xl h-9 flex items-center justify-center rounded-lg hover:bg-amber-50 active:scale-90 transition-transform"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font family */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Font</label>
                <div className="flex gap-2 flex-wrap">
                  {FONTS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => set('fontFamily', f.value)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${p.fontFamily === f.value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      style={{ fontFamily: f.value }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style + Align */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Style</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => set('fontWeight', p.fontWeight === 'bold' ? 'normal' : 'bold')}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${p.fontWeight === 'bold' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => set('fontStyle', p.fontStyle === 'italic' ? 'normal' : 'italic')}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${p.fontStyle === 'italic' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Align</label>
                  <div className="flex gap-2">
                    {([
                      { align: 'left', Icon: AlignLeft },
                      { align: 'center', Icon: AlignCenter },
                      { align: 'right', Icon: AlignRight },
                    ] as const).map(({ align, Icon }) => (
                      <button
                        key={align}
                        onClick={() => set('textAlign', align)}
                        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${(p.textAlign ?? 'center') === align ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        title={align}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Text Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => set('color', c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${(p.color ?? '#ffffff') === c ? 'border-amber-500 scale-110' : 'border-white shadow'}`}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                  <label className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer hover:border-amber-400 overflow-hidden" title="Custom color">
                    <input
                      type="color"
                      value={p.color ?? '#ffffff'}
                      onChange={(e) => set('color', e.target.value)}
                      className="opacity-0 absolute w-0 h-0"
                    />
                    <span className="text-[10px] text-gray-500 font-semibold">+</span>
                  </label>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Fullscreen recording overlay ─────────────────────────────────── */}
      {recordFullscreen && isRecording && (
        <div className="lg:hidden fixed inset-0 z-[200] bg-black flex flex-col">
          <video
            ref={cameraPreviewRef}
            muted playsInline
            className="flex-1 w-full object-cover"
            style={{ filter: RECORD_EFFECTS[recordEffect] || undefined }}
          />
          <div className="absolute bottom-0 left-0 right-0 pb-10 pt-6 px-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white font-mono text-2xl font-bold tracking-wider">
                {String(Math.floor(recordSec / 60)).padStart(2, '0')}:{String(recordSec % 60).padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-8">
              <button onClick={handleToggleMute} className="flex flex-col items-center gap-1.5">
                {recordMuted ? <VolumeX className="w-7 h-7 text-red-400" /> : <Volume2 className="w-7 h-7 text-white" />}
                <span className="text-[10px] text-white/60">{recordMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button onClick={() => setRecordShowEffects(prev => !prev)} className="flex flex-col items-center gap-1.5">
                <Sparkles className={`w-7 h-7 ${recordShowEffects ? 'text-amber-400' : 'text-white'}`} />
                <span className="text-[10px] text-white/60">Effects</span>
              </button>
              <button
                onClick={handleStopRecord}
                className="w-20 h-20 rounded-full bg-red-500 border-4 border-white flex items-center justify-center shadow-2xl active:scale-95"
              >
                <Square className="w-9 h-9 text-white fill-white" />
              </button>
              <button onClick={() => setRecordFullscreen(false)} className="flex flex-col items-center gap-1.5">
                <Maximize2 className="w-7 h-7 text-white" />
                <span className="text-[10px] text-white/60">Exit</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 opacity-30" disabled>
                <FlipHorizontal2 className="w-7 h-7 text-white" />
                <span className="text-[10px] text-white/60">Flip</span>
              </button>
            </div>
          </div>
          {recordShowEffects && (
            <div className="absolute bottom-44 left-0 right-0 px-4">
              <div className="bg-black/85 rounded-2xl p-4 backdrop-blur-md">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-3">Camera Effect</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {(['none','bright','warm','cool','dramatic','bw'] as const).map((ef) => (
                    <button key={ef} onClick={() => { setRecordEffect(ef); setRecordShowEffects(false); }}
                      className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${recordEffect === ef ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                      {ef === 'none' ? 'Natural' : ef === 'bw' ? 'B&W' : ef.charAt(0).toUpperCase() + ef.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Live Record bottom sheet ─────────────────────────────────────── */}
      {mobileSheet === 'record' && !recordFullscreen && (
        <div
          className="lg:hidden fixed inset-x-0 top-0 z-40 bg-black/50"
          style={{ bottom: 56 }}
          onClick={() => { if (!isRecording) setMobileSheet('none'); }}
          role="presentation"
        />
      )}
      <div
        className={`lg:hidden fixed left-0 right-0 z-50 bg-gray-950 rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'record' && !recordFullscreen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ top: sheetTop, bottom: 56 }}
        role="dialog" aria-modal="true" aria-label="Live record"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 shrink-0">
          <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
          <p className="text-sm font-semibold text-white flex-1">Live Record</p>
          {isRecording && (
            <span className="text-white font-mono text-sm font-bold tabular-nums">
              {String(Math.floor(recordSec / 60)).padStart(2, '0')}:{String(recordSec % 60).padStart(2, '0')}
            </span>
          )}
          {!isRecording && (
            <button onClick={() => setMobileSheet('none')} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Close">
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Mode toggle — before recording only */}
          {!isRecording && (
            <div className="flex gap-2 mx-4 mt-4 bg-white/10 rounded-xl p-1">
              {([
                { mode: 'audio' as const, label: 'Audio Only', Icon: Mic },
                { mode: 'video' as const, label: 'Audio + Video', Icon: Video },
              ]).map(({ mode, label, Icon }) => (
                <button key={mode} onClick={() => setRecordMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors ${recordMode === mode ? 'bg-red-500 text-white shadow' : 'text-white/60 hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}

          {/* Permission denied banner */}
          {!isRecording && (permState.mic === 'denied' || (permState.cam === 'denied' && recordMode === 'video')) && (
            <div className="mx-4 mt-3 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center gap-3 px-4 py-3.5">
              <Shield className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-300">
                  {recordMode === 'video' ? 'Microphone & Camera' : 'Microphone'} blocked
                </p>
                <p className="text-[11px] text-white/45 mt-0.5">Tap Allow to grant access</p>
              </div>
              <button
                onClick={() => void handleStartRecord()}
                className="shrink-0 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors active:scale-95"
              >
                Allow
              </button>
            </div>
          )}

          {/* Camera preview */}
          {recordMode === 'video' && (
            <div className="relative mx-4 mt-3 rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: '16/9' }}>
              <video
                ref={cameraSheetPreviewRef}
                muted playsInline
                className="w-full h-full object-cover"
                style={{ filter: RECORD_EFFECTS[recordEffect] || undefined }}
              />
              {!isRecording && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 rounded-xl px-4 py-2 flex items-center gap-2">
                    <Video className="w-4 h-4 text-white/50" />
                    <span className="text-white/50 text-xs">Camera preview starts on record</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Effect chips — during recording */}
          {isRecording && (
            <div className="px-4 mt-3">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Camera Effect</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(['none','bright','warm','cool','dramatic','bw'] as const).map((ef) => (
                  <button key={ef} onClick={() => setRecordEffect(ef)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${recordEffect === ef ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                    {ef === 'none' ? 'Natural' : ef === 'bw' ? 'B&W' : ef.charAt(0).toUpperCase() + ef.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls row — during recording */}
          {isRecording && (
            <div className="flex items-center justify-center gap-5 px-6 py-3">
              <button onClick={handleToggleMute} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors min-w-[52px]">
                {recordMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white/70" />}
                <span className="text-[9px] text-white/50 mt-0.5">{recordMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              {recordMode === 'video' && (
                <button onClick={() => setRecordFullscreen(true)} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors min-w-[52px]">
                  <Maximize2 className="w-5 h-5 text-white/70" />
                  <span className="text-[9px] text-white/50 mt-0.5">Full</span>
                </button>
              )}
              {recordMode === 'video' && (
                <button disabled className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/5 opacity-30 min-w-[52px]" title="Stop recording to flip camera">
                  <FlipHorizontal2 className="w-5 h-5 text-white/70" />
                  <span className="text-[9px] text-white/50 mt-0.5">Flip</span>
                </button>
              )}
            </div>
          )}

          {/* Pre-record: flip + facing label */}
          {!isRecording && recordMode === 'video' && (
            <div className="flex items-center gap-2 px-4 mt-2">
              <button onClick={() => void handleFlipCamera()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white/70 text-xs font-medium hover:bg-white/20 transition-colors">
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                {cameraFacing === 'user' ? 'Switch to back cam' : 'Switch to front cam'}
              </button>
              <span className="text-[10px] text-white/30 flex-1 text-right">
                {cameraFacing === 'user' ? 'Front camera' : 'Back camera'}
              </span>
            </div>
          )}

          {/* Main record/stop button */}
          <div className="flex flex-col items-center gap-3 py-6">
            <button
              onClick={isRecording ? handleStopRecord : () => void handleStartRecord()}
              className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${
                isRecording
                  ? 'bg-red-500 ring-4 ring-red-500/40 ring-offset-2 ring-offset-gray-950 animate-pulse'
                  : 'bg-red-500 hover:bg-red-400 ring-4 ring-red-500/25 ring-offset-2 ring-offset-gray-950'
              }`}
            >
              {isRecording
                ? <Square className="w-9 h-9 text-white fill-white" />
                : <Mic className="w-9 h-9 text-white" />}
            </button>
            <p className="text-xs text-white/40 text-center px-8 leading-relaxed">
              {isRecording
                ? 'Tap to stop — file saves to Working Files'
                : permState.mic === 'denied'
                  ? 'Follow the steps above, then tap Record'
                  : permState.mic === 'prompt' || permState.mic === 'unknown'
                    ? 'Tap — browser will ask for permission'
                    : 'Tap to start recording'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────────────────────── */}
      <nav className="lg:hidden shrink-0 flex items-stretch bg-gray-950 border-t border-white/10 relative z-[60]" style={{ height: 56, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {[
          {
            id: 'media' as const,
            icon: <Film className="w-5 h-5" />,
            label: 'Media',
            badge: mediaBin.length > 0 ? mediaBin.length : undefined,
          },
          {
            id: 'inspector' as const,
            icon: <Settings2 className="w-5 h-5" />,
            label: selectedItem ? selectedItem.kind.charAt(0) + selectedItem.kind.slice(1).toLowerCase() : 'Inspect',
            badge: selectedItem ? undefined : undefined,
          },
          {
            id: 'tools' as const,
            icon: <Scissors className="w-5 h-5" />,
            label: 'Tools',
          },
        ].map((tab) => {
          const active = mobileSheet === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileSheet(mobileSheet === tab.id ? 'none' : tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${active ? 'text-brand-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {tab.badge !== undefined && (
                <span className="absolute top-2 right-1/4 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
              {active && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-brand-400" />}
            </button>
          );
        })}
      </nav>


      {/* Dialogs */}
      {showExport && <ExportDialog editId={editId} projectId={project.projectId} projectTitle={project.title} onClose={() => setShowExport(false)} onBeforeRender={handleSave} onRenderStart={progressStart} onRenderDone={progressDone} />}
      {showAiEdit && (
        <AiEditDialog
          editId={editId}
          timeline={timeline}
          mediaBin={mediaBin}
          autoSuggest={aiAutoSuggest}
          onClose={() => { setShowAiEdit(false); setAiAutoSuggest(false); }}
          onApplyTimeline={(t) => {
            pushUndo();
            const applied = t as EditTimeline;
            setTimeline(applied);
            setDirty(true);
            // Auto-save AI edits to Private Drafts (fire-and-forget; non-fatal)
            void api.editor.saveTimeline(editId, applied)
              .then(() => api.editor.setStatus(editId, 'PRIVATE_CONTENT'))
              .then(() => {
                void qc.invalidateQueries({ queryKey: ['editor-mine'] });
                void qc.invalidateQueries({ queryKey: ['editor-mine-list'] });
              })
              .catch(() => undefined);
          }}
        />
      )}
      {showHistory && (
        <HistoryDrawer
          currentEditId={editId}
          onClose={() => setShowHistory(false)}
          onNew={() => { setShowHistory(false); void handleNewEdit(); }}
        />
      )}
      {showLibrary && (
        <LibraryDrawer
          onClose={() => setShowLibrary(false)}
          onSelect={handleLibrarySelect}
          onSelectProjectEntry={handleProjectBinSelect}
          selecting={librarySelecting}
        />
      )}
      {showSnapshots && (
        <VersionsDrawer
          snapshots={snapshots}
          onSaveNew={() => { setShowSnapshots(false); setShowSaveDialog(true); }}
          onLoad={handleLoadSnapshot}
          onDelete={handleDeleteSnapshot}
          onMove={handleMoveSnapshot}
          onClose={() => setShowSnapshots(false)}
        />
      )}
      {showSaveDialog && (
        <SnapshotSaveDialog
          defaultName={project.title ? `${project.title} — ${new Date().toLocaleDateString()}` : `Version ${snapshots.length + 1}`}
          onSave={handleSaveSnapshot}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

      {/* Background-operation status tray */}
      <StatusTray toasts={toasts} savePct={barPct} onDismiss={dismissToast} />
    </div>
  );
}
