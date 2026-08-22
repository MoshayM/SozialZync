'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api, type MyContentItem } from '@/lib/api';
import {
  Film, Lock, Globe, MoreVertical, Play, Pencil, Download,
  Share2, BarChart2, EyeOff, Send, Trash2, X, Link2, CheckCircle2,
  Plus, Loader2,
} from 'lucide-react';

// ── Gradient palettes for placeholder thumbnails ───────────────────────────────
const GRADIENTS = [
  'linear-gradient(135deg,#1a0533,#2d1b69)',
  'linear-gradient(135deg,#0f2027,#203a43)',
  'linear-gradient(135deg,#020024,#090979)',
  'linear-gradient(135deg,#200122,#6f0000)',
];
const ICONS = ['🎬', '🤖', '📈', '💡', '✂️', '🎞️'];

function placeholderGrad(i: number) {
  return GRADIENTS[i % GRADIENTS.length]!;
}
function placeholderIcon(i: number) {
  return ICONS[i % ICONS.length]!;
}

// ── Duration formatter ────────────────────────────────────────────────────────
function fmtDuration(secs: number | null | undefined) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Privacy badge ─────────────────────────────────────────────────────────────
function PrivacyBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: 'rgba(5,150,105,.1)', color: '#059669' }}>
      <Globe className="w-2.5 h-2.5" /> Public
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: 'rgba(124,58,237,.1)', color: '#7C3AED' }}>
      <Lock className="w-2.5 h-2.5" /> Private
    </span>
  );
}

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url).catch(() => null);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
      style={{ background: 'rgba(8,145,178,.08)', color: '#0891B2', border: '1px solid rgba(8,145,178,.22)' }}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────
interface MenuProps {
  item: MyContentItem;
  onMakePublic: () => void;
  onMakePrivate: () => void;
  onDelete: () => void;
}

function ContentMenu({ item, onMakePublic, onMakePrivate, onDelete }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const mi = (onClick: () => void, icon: React.ReactNode, label: string, danger = false, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); setOpen(false); if (!disabled) onClick(); }}
      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: danger ? '#dc2626' : '#374151' }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = danger ? '#fef2f2' : '#f9fafb'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Content options"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.8)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.55)'; }}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 bg-white rounded-2xl py-1.5 min-w-[175px] shadow-xl z-30"
          style={{ border: '1.5px solid #e3ddf8' }}>
          {mi(() => null, <Play className="w-3.5 h-3.5" />, 'Watch / Preview')}
          {!item.isPublic && mi(() => null, <Pencil className="w-3.5 h-3.5" />, 'Edit in Editor')}
          {!item.isPublic && mi(() => null, <Send className="w-3.5 h-3.5 text-purple-600" />, 'Publish to Channel')}
          {!item.isPublic && mi(() => null, <Download className="w-3.5 h-3.5" />, 'Download Original')}
          <div className="h-px bg-gray-100 my-1" />
          {item.isPublic && item.shareUrl && (
            <button
              type="button"
              onClick={async (e) => { e.stopPropagation(); setOpen(false); await navigator.clipboard.writeText(item.shareUrl!).catch(() => null); }}
              className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors"
              style={{ color: '#0891B2' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdfe'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
            >
              <Share2 className="w-3.5 h-3.5" /> Share Link / Copy URL
            </button>
          )}
          {mi(() => null, <BarChart2 className="w-3.5 h-3.5" />, 'Analytics')}
          <div className="h-px bg-gray-100 my-1" />
          {!item.isPublic
            ? mi(onMakePublic, <Globe className="w-3.5 h-3.5" />, 'Make Public')
            : mi(onMakePrivate, <EyeOff className="w-3.5 h-3.5" />, 'Move to Private')
          }
          <div className="h-px bg-gray-100 my-1" />
          {mi(onDelete, <Trash2 className="w-3.5 h-3.5" />, 'Delete', true)}

          {/* Greyed-out disabled actions for public content */}
          {item.isPublic && (
            <>
              <div className="h-px bg-gray-100 my-1" />
              {mi(() => null, <Pencil className="w-3.5 h-3.5" />, 'Edit — move to Private first', false, true)}
              {mi(() => null, <Download className="w-3.5 h-3.5" />, 'Download — not available', false, true)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export function MyContentSection() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'private' | 'public'>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-content', filter],
    queryFn: () => api.myContent.list({ take: 8, visibility: filter }),
    retry: false,
  });

  const visibilityMut = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.myContent.setVisibility(id, isPublic),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-content'] });
    },
  });

  const items = data?.data.items ?? [];
  const isEmpty = !isLoading && !isError && items.length === 0;
  const showSkeleton = isLoading;

  // Skeleton cards
  function SkeletonCard() {
    return (
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="aspect-video bg-gray-100" />
        <div className="p-3 space-y-2">
          <div className="h-3 bg-gray-100 rounded-lg w-4/5" />
          <div className="h-2.5 bg-gray-100 rounded-lg w-2/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Film className="w-4 h-4 text-purple-500" />
            My Content
          </h2>
          <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: '#f3f4f6' }}>
            {(['all', 'private', 'public'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-[10px] text-[11px] font-semibold transition-all capitalize"
                style={filter === f
                  ? { background: '#fff', color: '#7C3AED', boxShadow: '0 1px 4px rgba(124,58,237,.15)' }
                  : { color: '#6b7280' }}
              >
                {f === 'private' && <Lock className="w-2.5 h-2.5 inline mr-1" />}
                {f === 'public' && <Globe className="w-2.5 h-2.5 inline mr-1" />}
                {f}
              </button>
            ))}
          </div>
        </div>
        <Link
          href="/projects"
          className="text-xs font-semibold hover:underline"
          style={{ color: '#7C3AED' }}
        >
          View all →
        </Link>
      </div>

      {/* Content permission callout */}
      <div className="rounded-2xl p-4 mb-4 grid grid-cols-2 gap-4"
        style={{ background: 'rgba(124,58,237,.04)', border: '1px solid rgba(124,58,237,.15)' }}>
        <div>
          <div className="text-[10px] font-extrabold mb-2" style={{ color: '#A78BFA' }}>
            🔒 PRIVATE — full creator control
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: '#6b7280' }}>
            ✅ Watch / Preview<br />
            ✅ Edit in Editor<br />
            ✅ Publish to connected channel<br />
            ✅ Download original<br />
            ✅ Move to Public
          </div>
        </div>
        <div>
          <div className="text-[10px] font-extrabold mb-2" style={{ color: '#059669' }}>
            🌐 PUBLIC — share-only
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: '#6b7280' }}>
            ✅ Share link / Copy URL<br />
            ✅ View Analytics<br />
            ✅ Move back to Private (your content only)<br />
            ⛔ No download · No edit · No re-publish
          </div>
        </div>
      </div>

      {/* Grid */}
      {showSkeleton && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl p-8 text-center" style={{ border: '1.5px solid #e3ddf8', background: '#fff' }}>
          <Film className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500 mb-1">Content not available</p>
          <p className="text-xs text-gray-400">The content service is unavailable. Check back shortly.</p>
        </div>
      )}

      {isEmpty && (
        <div className="rounded-2xl p-10 text-center" style={{ border: '1.5px dashed #d8d0f5', background: '#faf8ff' }}>
          <div className="text-3xl mb-3">🎬</div>
          <p className="text-sm font-bold text-gray-700 mb-1">
            {filter === 'public' ? 'No public content yet' : filter === 'private' ? 'No private content' : 'No content yet'}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            {filter === 'public'
              ? 'Make a private video public to share it with the world.'
              : 'Create your first video or upload existing content to get started.'}
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
            style={{ background: '#7C3AED' }}
          >
            <Plus className="w-3.5 h-3.5" /> Create Content
          </Link>
        </div>
      )}

      {!showSkeleton && !isError && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item, i) => (
            <div key={item.id}
              className="rounded-2xl overflow-hidden group relative transition-all hover:-translate-y-0.5"
              style={{ background: '#fff', border: '1.5px solid #e3ddf8', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124,58,237,.35)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e3ddf8'; }}
            >
              {/* Thumbnail */}
              <div className="aspect-video relative flex items-center justify-center overflow-hidden"
                style={{ background: item.thumbnailUrl ? undefined : placeholderGrad(i) }}>
                {item.thumbnailUrl
                  ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-3xl">{placeholderIcon(i)}</span>
                }
                {/* Duration badge */}
                {fmtDuration(item.duration) && (
                  <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(0,0,0,.8)' }}>
                    {fmtDuration(item.duration)}
                  </span>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,.35)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,.9)' }}>
                    <Play className="w-4 h-4 text-gray-800 ml-0.5" />
                  </div>
                </div>
                {/* Context menu (top-right on hover) */}
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <ContentMenu
                    item={item}
                    onMakePublic={() => visibilityMut.mutate({ id: item.id, isPublic: true })}
                    onMakePrivate={() => visibilityMut.mutate({ id: item.id, isPublic: false })}
                    onDelete={() => { /* TODO: delete mutation */ }}
                  />
                </div>
              </div>

              {/* Body */}
              <div className="p-3">
                <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{item.title}</p>
                <div className="flex items-center justify-between gap-2">
                  <PrivacyBadge isPublic={item.isPublic} />
                  {item.isPublic && item.shareUrl
                    ? (
                      <button
                        type="button"
                        onClick={async () => { await navigator.clipboard.writeText(item.shareUrl!).catch(() => null); }}
                        className="text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        style={{ color: '#0891B2' }}
                      >
                        <Share2 className="w-3 h-3" /> Share
                      </button>
                    ) : !item.isPublic ? (
                      <button
                        type="button"
                        onClick={() => visibilityMut.mutate({ id: item.id, isPublic: true })}
                        disabled={visibilityMut.isPending}
                        className="text-[10px] font-semibold flex items-center gap-1 transition-colors hover:text-purple-600 disabled:opacity-50"
                        style={{ color: '#9CA3AF' }}
                      >
                        {visibilityMut.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Globe className="w-3 h-3" />
                        }
                        Make Public
                      </button>
                    ) : null}
                </div>
              </div>
            </div>
          ))}

          {/* Upload / Create card */}
          <Link href="/projects"
            className="rounded-2xl flex flex-col items-center justify-center aspect-video sm:aspect-auto min-h-[120px] gap-2 transition-all hover:border-purple-300"
            style={{ border: '1.5px dashed #d1d5db', background: 'transparent' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(124,58,237,.03)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
          >
            <Plus className="w-6 h-6 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400">Upload or Create</span>
          </Link>
        </div>
      )}
    </div>
  );
}
