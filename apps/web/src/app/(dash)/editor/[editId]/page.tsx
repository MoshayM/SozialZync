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
  Scissors, RotateCcw, RotateCw, Magnet, VolumeX, Eye, EyeOff, PanelBottom, Settings2, LockOpen,
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
import { usePlanGate, useIsAdmin, planAtLeast } from '@/components/plan-gate';

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

// ── History Drawer (My Edits) ─────────────────────────────────────────────────

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

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.editor.deleteProject(id);
      void refetch();
    } catch { /* silently ignore */ } finally {
      setDeleting(null);
    }
  }

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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close my edits">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-3 border-b border-gray-50">
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Edit
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
          {edits.map((p) => {
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
                {!isCurrent && (
                  <button
                    type="button"
                    disabled={deleting === p.id}
                    onClick={() => void handleDelete(p.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                    title="Delete this edit"
                  >
                    {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            );
          })}
          {edits.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">No edits yet — create one above.</p>
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
  projectTitle,
  onClose,
  onBeforeRender,
  onRenderStart,
  onRenderDone,
}: {
  editId: string;
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Publish form
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [pubTitle, setPubTitle] = useState(projectTitle);
  const [pubDesc, setPubDesc] = useState('');
  const [pubTags, setPubTags] = useState('');

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
      <div role="dialog" aria-modal="true" aria-label="Export video" className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Download className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-semibold text-gray-900 flex-1">Export video</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
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

          {renderStatus === 'READY' && downloadPath && !showPublishForm && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-3">
              <p className="text-sm text-green-800 font-medium">Render complete!</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={downloadPath}
                  download={downloadFilename}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setShowPublishForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
                >
                  <Zap className="w-4 h-4" /> Send to Publish
                </button>
              </div>
            </div>
          )}

          {renderStatus === 'READY' && showPublishForm && (
            <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-brand-800">Queue for Publishing</p>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Title</label>
                <input
                  type="text"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
                <textarea
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={pubTags}
                  onChange={(e) => setPubTags(e.target.value)}
                  placeholder="youtube, tutorial, vlog"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPublishForm(false)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!pubTitle.trim()}
                  onClick={() => {
                    const tags = pubTags.split(',').map((t) => t.trim()).filter(Boolean);
                    const qs = new URLSearchParams({
                      fromEdit: editId,
                      title: pubTitle.trim(),
                      description: pubDesc.trim(),
                      tags: tags.join(','),
                    });
                    router.push(`/publishing?${qs.toString()}`);
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" /> Send to Publish Queue
                </button>
              </div>
            </div>
          )}

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

// ── Status Tray (background operation toasts) ─────────────────────────────────

function StatusTray({
  toasts,
  onDismiss,
}: {
  toasts: Array<{ id: string; label: string; status: 'pending' | 'success' | 'error'; message?: string }>;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-[72px] lg:bottom-4 right-3 z-[70] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg border text-sm max-w-[280px] w-full transition-all duration-300 ${
            t.status === 'pending' ? 'bg-gray-900 border-white/10 text-white' :
            t.status === 'success' ? 'bg-green-900 border-green-700/40 text-green-100' :
            'bg-red-900 border-red-700/40 text-red-100'
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {t.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-white/60" />}
            {t.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {t.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs leading-snug truncate">{t.label}</p>
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
  'Analyze this video edit and suggest an automatic edit plan: silent sections to trim, ' +
  'filler words to cut, pacing improvements, and any title/text overlays or transitions ' +
  'that would improve it. List each suggested edit with timestamps so I can apply them.';

type ChatMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; pendingTimeline?: unknown | null };

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
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

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

  // Auto-suggest: fire once when opened from "Video Edit" on an imported video
  useEffect(() => {
    if (!autoSuggest || autoRan.current || timeline === undefined) return;
    autoRan.current = true;
    void submit(AUTO_EDIT_INSTRUCTION, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSuggest, timeline]);

  const binSummary =
    mediaBin.length === 0
      ? 'No files in Working Files yet'
      : `${mediaBin.length} file${mediaBin.length === 1 ? '' : 's'} available: ${mediaBin
          .slice(0, 3)
          .map((f) => f.label)
          .join(', ')}${mediaBin.length > 3 ? ` +${mediaBin.length - 3} more` : ''}`;

  const SUGGESTIONS = [
    'Add all files to the timeline',
    'Extend background music to cover the full video',
    'Add fade transition between all clips',
    'Set music volume to 30%',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI edit assistant"
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl flex flex-col"
        style={{ maxHeight: '90vh', minHeight: '420px' }}
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
                I can see your Working Files and current timeline. Ask me to add clips, extend music, trim, apply transitions, and more.
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
        <div className="shrink-0 px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
              }}
              rows={2}
              placeholder="Add all clips to the timeline, extend music to cover the whole video…  (Enter to send)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 resize-none"
            />
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
}: {
  item: EditItem | null;
  onChange: (patch: Partial<EditItem>) => void;
  onDelete?: () => void;
  onDetachAudio?: () => void;
  currentTimeMs: number;
  editId: string;
  onAddToTimeline: (entry: MediaBinEntry) => void;
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
          <div>
            <label htmlFor="insp-text" className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1.5">
              <Type className="w-3.5 h-3.5" /> Text
            </label>
            <textarea
              id="insp-text"
              value={props.text ?? ''}
              onChange={(e) => setProp('text', e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none"
            />
          </div>
          <div>
            <label htmlFor="insp-fontsize" className="text-xs font-medium text-gray-700 block mb-1.5">Font size</label>
            <input
              id="insp-fontsize"
              type="number"
              min={8}
              max={200}
              value={props.fontSize ?? 32}
              onChange={(e) => setProp('fontSize', parseInt(e.target.value, 10))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="insp-color" className="text-xs font-medium text-gray-700 block mb-1.5">Color</label>
            <input
              id="insp-color"
              type="color"
              value={props.color ?? '#ffffff'}
              onChange={(e) => setProp('color', e.target.value)}
              className="w-full h-8 border border-gray-200 rounded-lg cursor-pointer"
            />
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
  onMoveItem,
  onTrimItem,
  onItemDragStart,
  onDropFromBin,
  onMuteItem,
  onHideItem,
  onDelinkItem,
  onDeleteTrack,
}: {
  track: EditTrack;
  durationMs: number;
  pxPerSec: number;
  selectedId: string | null;
  snapPoints: number[];
  nameMap: Map<string, string>;
  onSelect: (id: string) => void;
  onMoveItem: (itemId: string, newStartMs: number) => void;
  onTrimItem: (itemId: string, newStartMs: number, newEndMs: number) => void;
  onItemDragStart: () => void;
  onDropFromBin: (trackId: string, xInTrack: number) => void;
  onMuteItem: (itemId: string) => void;
  onHideItem: (itemId: string) => void;
  onDelinkItem: (itemId: string) => void;
  onDeleteTrack: (trackId: string) => void;
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
            onSelect={() => onSelect(item.id)}
            onMove={(newStartMs) => onMoveItem(item.id, newStartMs)}
            onTrim={(newStartMs, newEndMs) => onTrimItem(item.id, newStartMs, newEndMs)}
            onDragStart={onItemDragStart}
            onMuteToggle={track.kind === 'AUDIO' ? () => onMuteItem(item.id) : undefined}
            onHideToggle={track.kind === 'VIDEO' ? () => onHideItem(item.id) : undefined}
            onDelinkItem={track.kind === 'AUDIO' && !!item.linkedItemId ? () => onDelinkItem(item.id) : undefined}
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
  onSelect,
  onMove,
  onTrim,
  onDragStart,
  onMuteToggle,
  onHideToggle,
  onDelinkItem,
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
  onSelect: () => void;
  onMove: (newStartMs: number) => void;
  onTrim: (newStartMs: number, newEndMs: number) => void;
  onDragStart?: () => void;
  onMuteToggle?: () => void;
  onHideToggle?: () => void;
  onDelinkItem?: () => void;
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
  } | null>(null);

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
    };
    onSelect();
    onDragStart?.();
  }, [item.timelineStartMs, item.timelineEndMs, onSelect, onDragStart]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const deltaMs = xToMs(dx, pxPerSec);
    const { origStartMs, origEndMs } = dragRef.current;
    if (dragRef.current.mode === 'move') {
      onMove(Math.max(0, snapTo(origStartMs + deltaMs)));
    } else if (dragRef.current.mode === 'trim-left') {
      const newStart = clamp(snapTo(origStartMs + deltaMs), 0, origEndMs - 100);
      onTrim(newStart, origEndMs);
    } else {
      const newEnd = clamp(snapTo(origEndMs + deltaMs), origStartMs + 100, Infinity);
      onTrim(origStartMs, newEnd);
    }
  }, [pxPerSec, onMove, onTrim, snapPoints]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

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
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 cursor-ew-resize z-10 flex items-center justify-center hover:bg-white/20"
        style={{ width: HANDLE_W }}
        onPointerDown={(e) => onPointerDown(e, 'trim-left')}
      >
        <div className="w-0.5 h-4 bg-white/60 rounded-full" />
      </div>
      {/* Main body — drag to move */}
      <div
        className="flex-1 h-full flex flex-col justify-center cursor-grab active:cursor-grabbing overflow-hidden relative"
        style={{ paddingLeft: HANDLE_W + 4, paddingRight: HANDLE_W + 4 }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
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
  onImportUrl?: (url: string) => void;
  urlImporting?: boolean;
  onOpenLibrary?: () => void;
  onDeleteEntry?: (id: string) => void;
  onLockEntry?: (id: string, locked: boolean) => void;
  onEntryDragStart?: (entry: MediaBinEntry) => void;
}) {
  const [rendersOpen, setRendersOpen] = useState(false);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);

  const SOURCE_KINDS  = new Set(['VIDEO', 'RENDER_SOURCE', 'SHORTS_SOURCE_VIDEO']);
  const RENDER_KINDS  = new Set(['EDIT_RENDER']);
  const AUDIO_KINDS   = new Set(['AUDIO', 'VOICE', 'MUSIC']);
  const IMAGE_KINDS   = new Set(['IMAGE']);

  const sources  = entries.filter((e) => SOURCE_KINDS.has(e.kind));
  const renders  = entries.filter((e) => RENDER_KINDS.has(e.kind));
  const audios   = entries.filter((e) => AUDIO_KINDS.has(e.kind));
  const images   = entries.filter((e) => IMAGE_KINDS.has(e.kind));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    e.target.value = '';
  };

  function submitUrl() {
    const u = urlValue.trim();
    if (!u || !onImportUrl) return;
    onImportUrl(u);
    setUrlValue('');
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
                disabled={urlImporting || !urlValue.trim()}
                className="px-2 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                {urlImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
              </button>
              <button type="button" onClick={() => { setShowUrlBar(false); setUrlValue(''); }} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                <X className="w-3 h-3" />
              </button>
            </div>
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
        {/* Source Videos */}
        {sources.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">Working Files</p>
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
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-3 pb-1">Audio</p>
            {audios.map((e) => <BinEntry key={e.id} entry={e} onAdd={onAddToTimeline} onDelete={onDeleteEntry} onLockToggle={onLockEntry} onDragStart={onEntryDragStart} />)}
          </>
        )}

        {/* Images */}
        {images.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-3 pb-1">Images</p>
            {images.map((e) => <BinEntry key={e.id} entry={e} onAdd={onAddToTimeline} onDelete={onDeleteEntry} onLockToggle={onLockEntry} onDragStart={onEntryDragStart} />)}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Editor Page ──────────────────────────────────────────────────────────

export default function EditorWorkspacePage() {
  const { editId } = useParams<{ editId: string }>();
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
    refetchOnWindowFocus: false,
  });

  // Load media bin — normalise null response (empty project) to []
  const { data: mediaBin = [] } = useQuery<MediaBinEntry[]>({
    queryKey: ['editor-media-bin', editId],
    queryFn: () => api.editor.mediaBin(editId).then((r) => r.data ?? []),
    enabled: !!project,
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
  const [playing, setPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  // Keep the ref in sync when state changes from outside (e.g. inspector seek)
  useEffect(() => { currentTimeMsRef.current = currentTimeMs; }, [currentTimeMs]);
  const [showExport, setShowExport] = useState(false);
  const [showAiEdit, setShowAiEdit] = useState(false);
  const userPlan = usePlanGate();
  const isAdmin = useIsAdmin();
  const canExport = isAdmin || planAtLeast(userPlan, 'PRO');
  const [aiAutoSuggest, setAiAutoSuggest] = useState(false);
  // Mobile bottom-sheet: which panel is open ('none' | 'media' | 'inspector' | 'tools')
  const [mobileSheet, setMobileSheet] = useState<'none' | 'media' | 'inspector' | 'tools'>('none');
  // Keep legacy vars so existing references compile
  const mobileBinOpen = mobileSheet === 'media';
  const mobileInspectorOpen = mobileSheet === 'inspector';
  const setMobileBinOpen = (v: boolean) => setMobileSheet(v ? 'media' : 'none');
  const setMobileInspectorOpen = (v: boolean) => setMobileSheet(v ? 'inspector' : 'none');
  // History + library drawers
  const [showHistory, setShowHistory] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySelecting, setLibrarySelecting] = useState<string | null>(null);
  const [binUploading, setBinUploading] = useState(false);
  const [binUrlImporting, setBinUrlImporting] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [binPanelOpen, setBinPanelOpen] = useState(true);
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(true);
  const [previewH, setPreviewH] = useState(() => {
    if (typeof window === 'undefined') return 200;
    // On mobile: 45% of viewport height for preview
    if (window.innerWidth < 768) return Math.round(window.innerHeight * 0.38);
    return 200;
  });

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

  const handleBinUrlImport = useCallback(async (url: string) => {
    if (!project?.projectId) return;
    const id = `import-url-${Date.now()}`;
    setBinUrlImporting(true);
    addToast(id, 'Importing video from URL…');
    progressStart();
    try {
      await api.media.importVideoFromUrl(url, { projectId: project.projectId });
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
        { title: video.title, projectId: project?.projectId },
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalMutedRef = useRef(false);
  const [globalMuted, setGlobalMuted] = useState(false);
  const historyRef = useRef<EditTimeline[]>([]);
  const historyIndexRef = useRef(-1);

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

  // Debounced autosave (1.5s after last change)
  useEffect(() => {
    if (!dirty || !timeline) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void handleSave(), 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [dirty, timeline]);

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
      void qc.invalidateQueries({ queryKey: ['editor-project', editId] });
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
  }, []);

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        e.preventDefault(); handleDeleteItem(selectedItemId);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault(); handleSplitAtPlayhead();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedItemId, handleDeleteItem, handleSplitAtPlayhead, handleUndo, handleRedo]);

  // Playback via rAF — video is synced directly in the tick (not via React effects)
  // so React state is only updated at ~30 fps for the seek bar / time display.
  const startPlay = useCallback(() => {
    if (!timeline) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dur = timeline.durationMs;
    // Allow restart from beginning if already at the end
    const origin = currentTimeMsRef.current >= dur ? 0 : currentTimeMsRef.current;
    currentTimeMsRef.current = origin;
    const startWall = Date.now() - origin;
    let lastUiMs = -Infinity;

    const tick = () => {
      const elapsed = Date.now() - startWall;
      const t = Math.min(elapsed, dur);
      currentTimeMsRef.current = t;

      // Sync <video> at full rAF rate without going through React.
      const v = videoRef.current;
      const item = activeVideoItemRef.current;
      if (v && item) {
        const rate = item.properties?.speed ?? 1;
        if (v.playbackRate !== rate) v.playbackRate = rate;
        const vol = clamp(item.properties?.volume ?? 1, 0, 1);
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
        const aVol = clamp(aItem.properties?.volume ?? 1, 0, 1);
        a.volume = aVol;
        a.muted = globalMutedRef.current || aVol === 0 || !!aItem.properties?.muted;
        const sourceSec = Math.max(0, ((aItem.sourceInMs ?? 0) + (t - aItem.timelineStartMs)) / 1000);
        if (Math.abs(a.currentTime - sourceSec) > 0.5) a.currentTime = sourceSec;
        if (a.paused) void a.play().catch(() => undefined);
      } else if (a && !a.paused) {
        a.pause();
      }

      // Update React state at ~30 fps so the seek bar and time display stay smooth
      // without flooding reconciliation at 60 fps.
      if (t - lastUiMs >= 33) {
        lastUiMs = t;
        setCurrentTimeMs(t);
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
      const vol = clamp(itemNow?.properties?.volume ?? 1, 0, 1);
      vNow.volume = vol;
      const linkedAudioNow = activeLinkedAudioItemRef.current;
      vNow.muted = globalMutedRef.current || !!linkedAudioNow?.properties?.muted;
      if (itemNow) vNow.playbackRate = itemNow.properties?.speed ?? 1;
      void vNow.play().catch(() => undefined);
    }
    if (aNow && aItemNow && audioSrcRef.current) {
      aNow.volume = clamp(aItemNow.properties?.volume ?? 1, 0, 1);
      aNow.muted = globalMutedRef.current || !!aItemNow.properties?.muted;
      void aNow.play().catch(() => undefined);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [timeline]);

  const stopPlay = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
  }, []);

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

  // Find the currently-active item on VIDEO tracks (may be a video clip or an image)
  const activeTimelineItem = (timeline?.tracks ?? [])
    .filter((t) => t.kind === 'VIDEO')
    .flatMap((t) => t.items ?? [])
    .find((it) => it.timelineStartMs <= currentTimeMs && it.timelineEndMs > currentTimeMs) ?? null;

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
    const vol = clamp(item.properties?.volume ?? 1, 0, 1);
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
    return (
      <div className="flex items-center gap-2 text-gray-500 py-20 justify-center">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading editor…
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="p-8">
        <Link href="/editor" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Video Editor
        </Link>
        <JobErrorCard
          error={(loadError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not load this edit project'}
          errorCode="JOB_FAILED"
          onRetry={() => { void qc.invalidateQueries({ queryKey: ['editor-project', editId] }); }}
        />
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
      <div className="flex items-center gap-1.5 px-2 sm:px-4 py-2 border-b border-gray-100 bg-white shrink-0 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setShowHistory(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="My edits"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Film className="w-4 h-4 text-brand-500 shrink-0" />
        <p className="font-semibold text-gray-800 text-sm truncate flex-1 min-w-0">{project.title}</p>

        {/* Desktop-only panel toggles (xl+) */}
        <button
          onClick={() => setBinPanelOpen(o => !o)}
          className="hidden xl:flex p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 min-h-[44px] min-w-[44px] items-center justify-center"
          title="Media bin"
        >
          <Film className="w-4 h-4" />
        </button>
        <button
          onClick={() => setInspectorPanelOpen(o => !o)}
          className="hidden xl:flex p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 min-h-[44px] min-w-[44px] items-center justify-center"
          title="Inspector"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* AI Edit — visible on all screen sizes */}
        <button
          onClick={() => setShowAiEdit(true)}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border border-brand-200 text-brand-700 rounded-lg text-xs hover:bg-brand-50 min-h-[44px]"
          title="AI edit"
        >
          <Wand2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">AI edit</span>
        </button>
        <Link
          href="/guide"
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 min-h-[44px]"
          title="How to use the editor"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Guide</span>
        </Link>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs min-h-[44px] font-medium transition-colors disabled:opacity-40 ${
            dirty
              ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
          title={dirty ? 'Save changes' : 'No unsaved changes'}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Save</span>
        </button>
        {canExport ? (
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700 min-h-[44px]"
            title="Export"
          >
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </button>
        ) : (
          <Link
            href="/plans"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border border-gray-200 text-gray-400 rounded-lg text-xs hover:bg-gray-50 min-h-[44px]"
            title="Pro plan required to export videos"
          >
            <Lock className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </Link>
        )}
      </div>

      {/* ── Main layout: left bin / center / right inspector ───────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: Media Bin (xl+ collapsible inline, below xl slide-over) ── */}
        <aside className={`hidden xl:flex flex-col shrink-0 border-r border-gray-100 bg-gray-50 transition-all duration-200 ${binPanelOpen ? 'w-52' : 'w-9 overflow-hidden'}`}>
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
          style={{ maxHeight: '70vh', bottom: 56 }}
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

          {/* Preview area — height is user-draggable via the resize handle below */}
          <div className="relative shrink-0 bg-black flex items-center justify-center" style={{ height: previewH }}>
            {/* Hidden audio element slaved to the rAF clock for AUDIO track items */}
            <audio ref={audioRef} src={audioSrc ?? undefined} style={{ display: 'none' }}>
              <track kind="captions" />
            </audio>

            {activeTimelineItem && !displaySrc && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-white/70" />
              </div>
            )}
            {isActiveImage && displaySrc ? (
              <>
                <img
                  src={displaySrc}
                  alt=""
                  className="max-w-full max-h-full object-contain"
                  style={{ opacity: clamp(activeTimelineItem?.properties?.opacity ?? 1, 0, 1) }}
                />
                {activeTextItems.map((it) => (
                  <span
                    key={it.id}
                    className="absolute left-1/2 -translate-x-1/2 pointer-events-none font-semibold text-center px-2 max-w-[90%] truncate"
                    style={{
                      bottom: '12%',
                      color: it.properties?.color ?? '#ffffff',
                      fontSize: Math.max(10, (it.properties?.fontSize ?? 32) * 0.4),
                      opacity: clamp(it.properties?.opacity ?? 1, 0, 1),
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    {it.properties?.text ?? ''}
                  </span>
                ))}
              </>
            ) : (
              <>
                {/* Always render the video element so videoRef is set when Play is
                    clicked — even if the signed URL hasn't arrived yet. Without this,
                    videoRef.current is null at click time, v.play() inside the
                    user-gesture context is skipped, and the browser blocks audio on
                    every subsequent rAF-triggered play() call. Hidden via CSS when
                    no src so it doesn't affect layout. */}
                <video
                  ref={videoRef}
                  src={videoSrc ?? undefined}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    opacity: clamp(activeVideoItem?.properties?.opacity ?? 1, 0, 1),
                    // Hide video frames when the clip is toggled off with the Eye button.
                    // The <video> element stays mounted so audio continues playing.
                    display: (videoSrc && !activeVideoItem?.properties?.hidden) ? undefined : 'none',
                  }}
                  onLoadedMetadata={(e) => { e.currentTarget.currentTime = activeSourceSec; }}
                  playsInline
                >
                  {/* Source clips carry no sidecar caption file; empty track satisfies a11y. */}
                  <track kind="captions" />
                </video>
                {/* Black placeholder shown when the active video clip is hidden (eye-off) */}
                {videoSrc && activeVideoItem?.properties?.hidden && (
                  <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none">
                    <EyeOff className="w-8 h-8 text-white/30" />
                  </div>
                )}
                {videoSrc && activeTextItems.map((it) => (
                  <span
                    key={it.id}
                    className="absolute left-1/2 -translate-x-1/2 pointer-events-none font-semibold text-center px-2 max-w-[90%] truncate"
                    style={{
                      bottom: '12%',
                      color: it.properties?.color ?? '#ffffff',
                      fontSize: Math.max(10, (it.properties?.fontSize ?? 32) * 0.4),
                      opacity: clamp(it.properties?.opacity ?? 1, 0, 1),
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    {it.properties?.text ?? ''}
                  </span>
                ))}
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
            {/* Global mute */}
            <button
              onClick={handleGlobalMuteToggle}
              className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${globalMuted ? 'text-red-400 bg-red-900/30 hover:bg-red-900/50' : 'hover:bg-white/10'}`}
              title={globalMuted ? 'Unmute all' : 'Mute all'}
              aria-label={globalMuted ? 'Unmute all' : 'Mute all'}
            >
              {globalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {/* Zoom controls — hidden on mobile (pinch-scroll the timeline instead) */}
            <button
              onClick={() => setPxPerSec((p) => Math.max(5, p - 10))}
              className="hidden sm:flex p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] items-center justify-center"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="hidden sm:inline text-xs text-white/60 tabular-nums w-8 text-center">{pxPerSec}</span>
            <button
              onClick={() => setPxPerSec((p) => Math.min(200, p + 10))}
              className="hidden sm:flex p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] items-center justify-center"
              title="Zoom in"
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
            <div className="shrink-0 flex items-center gap-1 px-2 py-1 bg-gray-800 border-b border-gray-700">
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
              <div className="w-px h-4 bg-white/20 mx-0.5" />
              <button
                onClick={() => selectedItemId ? handleSplitItem(selectedItemId, currentTimeMsRef.current) : handleSplitAtPlayhead()}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 text-white"
                title="Split clip at playhead (S)"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </button>
              <button
                onClick={() => selectedItemId && handleDeleteItem(selectedItemId)}
                disabled={!selectedItemId}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-500/20 disabled:opacity-30 text-red-400"
                title="Delete clip (Del)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <div className="w-px h-4 bg-white/20 mx-0.5" />
              <button
                onClick={() => setSnapEnabled((s) => !s)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${snapEnabled ? 'text-brand-400 bg-brand-900/30' : 'text-gray-500 hover:bg-white/10 hover:text-white'}`}
                title={snapEnabled ? 'Snap on (click to disable)' : 'Snap off (click to enable)'}
              >
                <Magnet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Snap</span>
              </button>
              <div className="flex-1" />
              <button
                onClick={() => handleAddTrack('VIDEO')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-white/10 text-violet-400"
                title="Add video track"
              >
                <Plus className="w-3 h-3" /><Film className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleAddTrack('AUDIO')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-white/10 text-emerald-400"
                title="Add audio track"
              >
                <Plus className="w-3 h-3" /><Volume2 className="w-3 h-3" />
              </button>
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
              <div className="flex-1 overflow-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left - LABEL_W;
                          if (x < 0) return;
                          const ms = Math.max(0, Math.round(xToMs(x, pxPerSec)));
                          currentTimeMsRef.current = ms;
                          setCurrentTimeMs(ms);
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
                        <div
                          className="absolute -left-1.5 w-3 h-3 bg-red-500 rotate-45"
                          style={{ top: 22 }}
                        />
                      </div>

                      {/* Tracks */}
                      {(() => {
                        // Asset IDs that appear in MORE than one track = linked clips
                        return (
                          <div className="flex flex-col">
                            {(timeline.tracks ?? []).map((track) => (
                              <TimelineTrack
                                key={track.id}
                                track={track}
                                durationMs={dur || 60000}
                                pxPerSec={pxPerSec}
                                selectedId={selectedItemId}
                                snapPoints={snapEnabled ? allSnapPoints : []}
                                nameMap={assetNameMap}
                                onSelect={(id) => {
                                  setSelectedItemId(id || null);
                                  // On mobile: open inspector sheet but DON'T cover the timeline
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
        <aside className={`hidden xl:flex flex-col shrink-0 border-l border-gray-100 bg-white transition-all duration-200 ${inspectorPanelOpen ? 'w-64' : 'w-9 overflow-hidden'}`}>
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
            <Inspector item={selectedItem} onChange={handleInspectorChange} onDelete={selectedItemId ? () => handleDeleteItem(selectedItemId) : undefined} onDetachAudio={selectedItem?.kind === 'VIDEO' ? () => { void handleDetachAudio(selectedItem); } : undefined} currentTimeMs={currentTimeMs} editId={editId} onAddToTimeline={handleAddToTimeline} />
          )}
        </aside>

        {/* Inspector bottom sheet — only half height so timeline stays usable */}
        <div
          className={`lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'inspector' ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '55vh', bottom: 56 }}
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
            <Inspector item={selectedItem} onChange={handleInspectorChange} onDelete={selectedItemId ? () => handleDeleteItem(selectedItemId) : undefined} onDetachAudio={selectedItem?.kind === 'VIDEO' ? () => { void handleDetachAudio(selectedItem); } : undefined} currentTimeMs={currentTimeMs} editId={editId} onAddToTimeline={handleAddToTimeline} />
          </div>
        </div>

        {/* Tools bottom sheet — undo/redo/split/delete/snap */}
        <div
          className={`lg:hidden fixed left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileSheet === 'tools' ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ bottom: 56 }}
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
          <div className="grid grid-cols-4 gap-3 px-4 py-4">
            {[
              { icon: <RotateCcw className="w-5 h-5" />, label: 'Undo', action: handleUndo, disabled: !canUndo, color: 'text-white' },
              { icon: <RotateCw className="w-5 h-5" />, label: 'Redo', action: handleRedo, disabled: !canRedo, color: 'text-white' },
              { icon: <Scissors className="w-5 h-5" />, label: 'Split', action: () => selectedItemId ? handleSplitItem(selectedItemId, currentTimeMsRef.current) : handleSplitAtPlayhead(), disabled: false, color: 'text-white' },
              { icon: <Trash2 className="w-5 h-5" />, label: 'Delete', action: () => selectedItemId && handleDeleteItem(selectedItemId), disabled: !selectedItemId, color: 'text-red-400' },
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
          <div className="h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
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
      {showExport && <ExportDialog editId={editId} projectTitle={project.title} onClose={() => setShowExport(false)} onBeforeRender={handleSave} onRenderStart={progressStart} onRenderDone={progressDone} />}
      {showAiEdit && (
        <AiEditDialog
          editId={editId}
          timeline={timeline}
          mediaBin={mediaBin}
          autoSuggest={aiAutoSuggest}
          onClose={() => { setShowAiEdit(false); setAiAutoSuggest(false); }}
          onApplyTimeline={(t) => { pushUndo(); setTimeline(t as EditTimeline); setDirty(true); }}
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

      {/* Background-operation status tray */}
      <StatusTray toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
