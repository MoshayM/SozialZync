'use client';
import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Film,
  Upload,
  Link2,
  Library,
  Clock,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Layers,
  ChevronDown,
  X,
  ArrowRight,
  Youtube,
  Search,
} from 'lucide-react';
import { api, type EditProject, type LibraryVideo } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

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

function formatDuration(ms: number): string {
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

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

function DeleteConfirmDialog({
  project,
  onCancel,
  onConfirm,
  deleting,
}: {
  project: EditProject;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Delete this edit?</h2>
            <p className="text-xs text-gray-400 truncate max-w-[220px] mt-0.5">{project.title}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          The timeline and settings will be removed. Your source video files are not affected.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Library Drawer ────────────────────────────────────────────────────────────

function LibraryDrawer({
  onClose,
  onSelect,
  selecting,
}: {
  onClose: () => void;
  onSelect: (video: LibraryVideo) => void;
  selecting: string | null;
}) {
  const [q, setQ] = useState('');

  const { data: channels = [] } = useQuery<Array<{ id: string; title: string; thumbnailUrl?: string | null }>>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
    staleTime: 120_000,
  });

  const channelId = channels[0]?.id ?? '';

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['library-videos', channelId, q],
    queryFn: () => api.library.listVideos(channelId, { q: q || undefined, sort: 'date' }).then((r) => r.data),
    enabled: !!channelId,
    staleTime: 60_000,
  });

  const videos: LibraryVideo[] = page?.data ?? [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick a video from your library"
        className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl"
      >
        {/* Drawer header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Youtube className="w-4.5 h-4.5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-sm leading-tight">Your Library</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {channels[0]?.title ?? 'Connect a channel to browse videos'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
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

        {/* Video list */}
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

          {!!channelId && isLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading videos…</span>
            </div>
          )}

          {!!channelId && error && (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Could not load videos.</span>
            </div>
          )}

          {!!channelId && !isLoading && videos.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Film className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-sm">No videos found{q ? ' for that search' : ''}.</p>
            </div>
          )}

          {videos.map((v) => {
            const isSelecting = selecting === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v)}
                disabled={!!selecting}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all text-left disabled:opacity-60 group"
              >
                {/* Thumbnail */}
                <div className="w-28 shrink-0 rounded-lg overflow-hidden bg-gray-900 relative" style={{ aspectRatio: '16/9' }}>
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                  {v.durationMs > 0 && (
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono text-white bg-black/70 rounded px-1">
                      {formatDuration(v.durationMs)}
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">{v.title}</p>
                  {v.publishedAt && (
                    <p className="text-[11px] text-gray-400 mt-1">{relativeTime(v.publishedAt)}</p>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0 pt-1">
                  {isSelecting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <span className="text-[11px] font-semibold text-gray-400 group-hover:text-gray-700 transition-colors flex items-center gap-0.5">
                      Edit <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Continue-editing card ─────────────────────────────────────────────────────

function EditCard({
  project,
  onDelete,
}: {
  project: EditProject;
  onDelete: (p: EditProject) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS['DRAFT'];

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setGroupOpen(false); }}
    >
      {/* 16:9 thumbnail */}
      <div className="relative w-full bg-gray-900" style={{ paddingTop: '56.25%' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="w-10 h-10 text-gray-700" />
        </div>
        <div className="absolute bottom-2 right-2 text-[10px] font-mono text-gray-400 bg-gray-900/70 rounded px-1.5 py-0.5 backdrop-blur-sm">
          {project.width}×{project.height}
        </div>

        {/* Hover overlay with widget buttons */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ background: 'rgba(0,0,0,0.62)' }}
        >
          <Link
            href={`/editor/${project.id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white border border-white/25 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>

          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onDelete(project); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-200 border border-red-300/30 bg-red-500/20 hover:bg-red-500/40 transition-colors backdrop-blur-sm"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setGroupOpen((o) => !o); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 border border-white/20 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <Layers className="w-3.5 h-3.5" /> Group <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {groupOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10">
                <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Organize</p>
                <button type="button" onClick={() => setGroupOpen(false)} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-between">
                  Add to collection <span className="text-[10px] text-gray-300">soon</span>
                </button>
                <button type="button" onClick={() => setGroupOpen(false)} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-between">
                  Move to project <span className="text-[10px] text-gray-300">soon</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{project.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-[11px] text-gray-400">{relativeTime(project.lastEditedAt)}</span>
          <span
            className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: sc.bg, color: sc.text }}
          >
            {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Source cards ──────────────────────────────────────────────────────────────

function SourceCard({
  icon,
  label,
  sub,
  accent,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  accent: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 active:scale-[.98] transition-all p-6 text-center disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
        style={{ background: accent }}
      >
        {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : icon}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800 group-hover:text-gray-900 transition-colors">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{sub}</p>
      </div>
    </button>
  );
}

// ── Platform detector — informs UX, does NOT block import ────────────────────

function detectSocialPlatform(url: string): string | null {
  let host: string;
  try { host = new URL(url).hostname.replace(/^(www\.|m\.|vm\.)/, ''); }
  catch { return null; }
  if (/youtube\.com|youtu\.be/.test(host)) return 'YouTube';
  if (/tiktok\.com/.test(host)) return 'TikTok';
  if (/instagram\.com/.test(host)) return 'Instagram';
  if (/twitter\.com|^x\.com$/.test(host)) return 'Twitter/X';
  if (/facebook\.com|fb\.watch/.test(host)) return 'Facebook';
  if (/twitch\.tv/.test(host)) return 'Twitch';
  if (/vimeo\.com/.test(host)) return 'Vimeo';
  if (/dailymotion\.com/.test(host)) return 'Dailymotion';
  if (/reddit\.com/.test(host)) return 'Reddit';
  return null;
}

// ── URL import inline input ───────────────────────────────────────────────────

function UrlImportBar({
  onImport,
  importing,
  onClose,
}: {
  onImport: (url: string) => void;
  importing: boolean;
  onClose: () => void;
}) {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const platform = val.trim() ? detectSocialPlatform(val.trim()) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
        <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="url"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onImport(val); if (e.key === 'Escape') onClose(); }}
          placeholder="Paste a video URL — YouTube, TikTok, Instagram, or direct .mp4…"
          className="flex-1 text-sm outline-none placeholder:text-gray-300"
        />
        <button
          type="button"
          onClick={() => onImport(val)}
          disabled={!val.trim() || importing}
          className="px-4 py-2 rounded-xl text-white text-xs font-bold bg-gray-800 hover:bg-gray-900 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {importing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{platform ? `Downloading…` : 'Importing…'}</>
            : <><ArrowRight className="w-3.5 h-3.5" />Import</>}
        </button>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info chip — social URLs work, just take longer */}
      {platform && !importing && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 border border-blue-100 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{platform}</span> detected — we&apos;ll extract the video for you. Public videos only; may take 30–60 s.
          </p>
        </div>
      )}

      {/* Progress hint while downloading */}
      {platform && importing && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 border border-blue-100 rounded-xl">
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
          <p className="text-xs text-blue-700 font-medium">
            Downloading from {platform}… this may take up to a minute.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function EditorInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // source UI state
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // import busy state
  const [uploadBusy, setUploadBusy] = useState(false);
  const [urlBusy, setUrlBusy] = useState(false);
  const [librarySelecting, setLibrarySelecting] = useState<string | null>(null);

  // global import error banner
  const [importError, setImportError] = useState<string | null>(null);

  // delete state
  const [pendingDelete, setPendingDelete] = useState<EditProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── helpers ───────────────────────────────────────────────────────────────

  async function openEdit(editId: string) {
    void qc.invalidateQueries({ queryKey: ['editor-projects'] });
    router.push(`/editor/${editId}`);
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    setUploadBusy(true);
    try {
      const { data: uploaded } = await api.media.uploadVideo(file);
      // create an edit session for this video — project folder is handled server-side
      const { data: edit } = await api.editor.create(uploaded.projectId, {
        sourceKind: 'ASSET',
        sourceId: uploaded.assetId,
        title: uploaded.filename ?? file.name,
      });
      await openEdit(edit.id);
    } catch (err) {
      setImportError(getErrorMessage(err));
      setUploadBusy(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUrlImport(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    setImportError(null);
    setUrlBusy(true);
    try {
      const { data: imported } = await api.media.importVideoFromUrl(trimmed);
      const { data: edit } = await api.editor.create(imported.projectId, {
        sourceKind: 'ASSET',
        sourceId: imported.assetId,
        title: imported.filename ?? trimmed.split('/').pop() ?? 'Imported video',
      });
      setShowUrlBar(false);
      await openEdit(edit.id);
    } catch (err) {
      const raw = getErrorMessage(err);
      // Translate generic MIME/network errors into friendlier copy
      const friendly =
        raw.includes('text/html') || (raw.includes('MIME') && raw.includes('html'))
          ? 'That URL points to a web page, not a video. For YouTube/TikTok/Instagram, paste the share URL and we\'ll extract it.'
          : raw.includes('SSRF') || raw.includes('private IP')
          ? 'That URL isn\'t publicly reachable. Use a public video link.'
          : raw;
      setImportError(friendly);
      setUrlBusy(false);
    }
  }

  async function handleLibrarySelect(video: LibraryVideo) {
    setLibrarySelecting(video.id);
    setImportError(null);
    try {
      // create a blank edit named after the library video; user adds it to the timeline
      const { data: edit } = await api.editor.createBlank({ title: video.title });
      setShowLibrary(false);
      await openEdit(edit.id);
    } catch (err) {
      setImportError(getErrorMessage(err));
      setLibrarySelecting(null);
    }
  }

  // ── edit sessions ─────────────────────────────────────────────────────────

  const { data: rawProjects, isLoading: projectsLoading } = useQuery<EditProject[]>({
    queryKey: ['editor-projects'],
    queryFn: () => api.editor.listMine().then((r) => r.data ?? []),
    retry: false,
  });
  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.editor.deleteProject(pendingDelete.id);
      void qc.invalidateQueries({ queryKey: ['editor-projects'] });
      setPendingDelete(null);
    } catch {
      /* swallow — dialog stays open */
    } finally {
      setDeleting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-8 pt-5 lg:pt-6">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
          >
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 leading-tight">Video Editor</h2>
            <p className="text-sm text-gray-400 mt-0.5">Timeline editing &amp; multi-platform export</p>
          </div>
        </div>

        {/* ── Source selection ── */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">What do you want to edit?</h3>

          {/* Three source cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Upload */}
            <SourceCard
              icon={<Upload className="w-6 h-6 text-white" />}
              label="Upload a video"
              sub="MP4, MOV, WebM, MKV — any size"
              accent="linear-gradient(135deg, #374151, #1f2937)"
              loading={uploadBusy}
              onClick={() => { setShowUrlBar(false); setImportError(null); fileInputRef.current?.click(); }}
            />

            {/* From URL */}
            <SourceCard
              icon={<Link2 className="w-6 h-6 text-white" />}
              label="Import from URL"
              sub="YouTube, TikTok, Instagram or direct link"
              accent="linear-gradient(135deg, #1d4ed8, #1e40af)"
              loading={urlBusy}
              onClick={() => { setShowUrlBar((v) => !v); setImportError(null); }}
            />

            {/* Library */}
            <SourceCard
              icon={<Library className="w-6 h-6 text-white" />}
              label="From your library"
              sub="Pick from published channel videos"
              accent="linear-gradient(135deg, #c2410c, #9a3412)"
              loading={!!librarySelecting}
              onClick={() => { setShowUrlBar(false); setImportError(null); setShowLibrary(true); }}
            />
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* URL input bar */}
          {showUrlBar && (
            <UrlImportBar
              onImport={(url) => void handleUrlImport(url)}
              importing={urlBusy}
              onClose={() => setShowUrlBar(false)}
            />
          )}

          {/* Import error */}
          {importError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{importError}</span>
              <button type="button" onClick={() => setImportError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* ── Continue editing ── */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Continue editing</h3>

          {projectsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading your edits…</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
              <Film className="w-8 h-8 text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-400">No edits yet</p>
              <p className="text-xs text-gray-300 mt-1">Upload or import a video above to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((p) => (
                <EditCard key={p.id} project={p} onDelete={setPendingDelete} />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Library drawer */}
      {showLibrary && (
        <LibraryDrawer
          onClose={() => setShowLibrary(false)}
          onSelect={(v) => void handleLibrarySelect(v)}
          selecting={librarySelecting}
        />
      )}

      {/* Delete confirm */}
      {pendingDelete && (
        <DeleteConfirmDialog
          project={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
          deleting={deleting}
        />
      )}
    </div>
  );
}

export default function EditorListPage() {
  return (
    <Suspense fallback={null}>
      <EditorInner />
    </Suspense>
  );
}
