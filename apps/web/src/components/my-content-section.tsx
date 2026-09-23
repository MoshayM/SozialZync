'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api, type MyContentItem } from '@/lib/api';
import {
  Film, Lock, Globe, MoreVertical, Play, Pencil, Download,
  Share2, BarChart2, EyeOff, Send, Trash2, Link2, CheckCircle2,
  Plus, Loader2, FileEdit,
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
function PrivacyBadge({ isPublic, isDraft }: { isPublic: boolean; isDraft?: boolean }) {
  if (isDraft) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
        style={{ background: 'rgba(234,179,8,.12)', color: '#854d0e' }}>
        <FileEdit className="w-2.5 h-2.5" /> Draft
      </span>
    );
  }
  return isPublic ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: 'rgba(5,150,105,.1)', color: '#059669' }}>
      <Globe className="w-2.5 h-2.5" /> Public
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: 'rgba(55,65,81,.1)', color: '#374151' }}>
      <Lock className="w-2.5 h-2.5" /> Private
    </span>
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
  const isDraft = item.source === 'edit_draft';

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
      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          {!isDraft && mi(() => null, <Play className="w-3.5 h-3.5" />, 'Watch / Preview')}
          {!isDraft && !item.isPublic && mi(() => null, <Pencil className="w-3.5 h-3.5" />, 'Edit in Editor')}
          {!isDraft && !item.isPublic && mi(() => null, <Send className="w-3.5 h-3.5 text-purple-600" />, 'Publish to Channel')}
          {!isDraft && !item.isPublic && mi(() => null, <Download className="w-3.5 h-3.5" />, 'Download Original')}
          {isDraft && mi(() => null, <Pencil className="w-3.5 h-3.5" />, 'Open in Editor')}
          <div className="h-px bg-gray-100 my-1" />
          {!isDraft && item.isPublic && item.shareUrl && (
            <button
              type="button"
              onClick={async (e) => { e.stopPropagation(); setOpen(false); await navigator.clipboard.writeText(item.shareUrl!).catch(() => null); }}
              className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold transition-colors"
              style={{ color: '#0891B2' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdfe'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
            >
              <Share2 className="w-3.5 h-3.5" /> Share Link / Copy URL
            </button>
          )}
          {!isDraft && mi(() => null, <BarChart2 className="w-3.5 h-3.5" />, 'Analytics')}
          <div className="h-px bg-gray-100 my-1" />
          {!item.isPublic
            ? mi(onMakePublic, <Globe className="w-3.5 h-3.5" />, isDraft ? 'Push to Public' : 'Make Public')
            : mi(onMakePrivate, <EyeOff className="w-3.5 h-3.5" />, 'Move to Private')
          }
          <div className="h-px bg-gray-100 my-1" />
          {mi(onDelete, <Trash2 className="w-3.5 h-3.5" />, 'Delete', true)}

          {!isDraft && item.isPublic && (
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
    mutationFn: ({ id, isPublic, source, editId }: { id: string; isPublic: boolean; source?: string; editId?: string }) => {
      if (source === 'edit_draft' && editId) {
        return api.myContent.setEditDraftVisibility(editId, isPublic);
      }
      return api.myContent.setVisibility(id, isPublic);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-content'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, source, editId }: { id: string; source?: string; editId?: string }) => {
      if (source === 'edit_draft' && editId) {
        return api.myContent.deleteEditDraft(editId);
      }
      return api.myContent.delete(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-content'] });
    },
  });

  const items = data?.data.items ?? [];
  const isEmpty = !isLoading && !isError && items.length === 0;
  const showSkeleton = isLoading;

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
      <div className="mb-4 space-y-2">
        <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-500" />
          My Content
        </h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: '#f3f4f6' }}>
            {(['all', 'private', 'public'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-3.5 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all capitalize"
                style={filter === f
                  ? { background: '#fff', color: '#374151', boxShadow: '0 1px 4px rgba(55,65,81,.15)' }
                  : { color: '#6b7280' }}
              >
                {f === 'private' && <Lock className="w-2.5 h-2.5 inline mr-1" />}
                {f === 'public' && <Globe className="w-2.5 h-2.5 inline mr-1" />}
                {f}
              </button>
            ))}
          </div>
          <Link
            href="/projects"
            className="text-[13px] font-semibold hover:underline shrink-0"
            style={{ color: '#374151' }}
          >
            View all →
          </Link>
        </div>
      </div>

      {/* Content permission callout */}
      <div className="rounded-2xl p-4 mb-4 grid grid-cols-2 gap-4"
        style={{ background: 'rgba(55,65,81,.04)', border: '1px solid rgba(55,65,81,.15)' }}>
        <div>
          <div className="text-[11px] font-semibold mb-2 uppercase tracking-[0.05em]" style={{ color: '#9ca3af' }}>
            🔒 Private — full creator control
          </div>
          <div className="text-[12px] leading-relaxed" style={{ color: '#6b7280' }}>
            ✅ Watch / Preview<br />
            ✅ Edit in Editor<br />
            ✅ Publish to connected channel<br />
            ✅ Download original<br />
            ✅ Move to Public
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold mb-2 uppercase tracking-[0.05em]" style={{ color: '#059669' }}>
            🌐 Public — share-only
          </div>
          <div className="text-[12px] leading-relaxed" style={{ color: '#6b7280' }}>
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
          <p className="text-[14px] font-semibold text-gray-500 mb-1">Content not available</p>
          <p className="text-[13px] text-gray-400">The content service is unavailable. Check back shortly.</p>
        </div>
      )}

      {isEmpty && (
        <div className="rounded-2xl p-10 text-center" style={{ border: '1.5px dashed #d8d0f5', background: '#faf8ff' }}>
          <div className="text-3xl mb-3">🎬</div>
          <p className="text-[15px] font-semibold text-gray-700 mb-1">
            {filter === 'public' ? 'No public content yet' : filter === 'private' ? 'No private content' : 'No content yet'}
          </p>
          <p className="text-[13px] text-gray-400 mb-4">
            {filter === 'public'
              ? 'Make a private video public to share it with the world.'
              : filter === 'private'
              ? 'Save a draft in the editor or render a video to see it here.'
              : 'Create your first video or upload existing content to get started.'}
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors"
            style={{ background: '#374151' }}
          >
            <Plus className="w-3.5 h-3.5" /> Open Editor
          </Link>
        </div>
      )}

      {!showSkeleton && !isError && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item, i) => {
            const isDraft = item.source === 'edit_draft';
            return (
              <div key={item.id}
                className="rounded-2xl overflow-hidden group relative transition-all hover:-translate-y-0.5"
                style={{
                  background: '#fff',
                  border: isDraft ? '1.5px solid #fde68a' : '1.5px solid #e3ddf8',
                  boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = isDraft ? '#f59e0b' : 'rgba(55,65,81,.35)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = isDraft ? '#fde68a' : '#e3ddf8'; }}
              >
                {/* Thumbnail */}
                <div className="aspect-video relative flex items-center justify-center overflow-hidden"
                  style={{ background: item.thumbnailUrl ? undefined : placeholderGrad(i) }}>
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="text-3xl">{isDraft ? '📝' : placeholderIcon(i)}</span>
                  }
                  {fmtDuration(item.duration) && (
                    <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-md"
                      style={{ background: 'rgba(0,0,0,.8)' }}>
                      {fmtDuration(item.duration)}
                    </span>
                  )}
                  {/* Play overlay — only for non-drafts */}
                  {!isDraft && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,.35)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,.9)' }}>
                        <Play className="w-4 h-4 text-gray-800 ml-0.5" />
                      </div>
                    </div>
                  )}
                  {/* Context menu */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <ContentMenu
                      item={item}
                      onMakePublic={() => visibilityMut.mutate({ id: item.id, isPublic: true, source: item.source, editId: item.editId })}
                      onMakePrivate={() => visibilityMut.mutate({ id: item.id, isPublic: false, source: item.source, editId: item.editId })}
                      onDelete={() => {
                        const label = isDraft ? 'draft' : 'content item';
                        if (window.confirm(`Delete "${item.title}"? This permanently removes this ${label}.`)) {
                          deleteMut.mutate({ id: item.id, source: item.source, editId: item.editId });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Body */}
                <div className="p-3.5">
                  <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{item.title}</p>

                  {/* Inline action row — always visible */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PrivacyBadge isPublic={item.isPublic} isDraft={isDraft} />

                    {/* Delete — always visible for drafts */}
                    {isDraft && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete draft "${item.title}"?`)) {
                            deleteMut.mutate({ id: item.id, source: item.source, editId: item.editId });
                          }
                        }}
                        disabled={deleteMut.isPending}
                        className="text-[11px] font-semibold flex items-center gap-0.5 transition-colors hover:text-red-600 disabled:opacity-50 ml-auto"
                        style={{ color: '#ef4444' }}
                      >
                        {deleteMut.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />
                        }
                      </button>
                    )}

                    {/* Push to Public — inline for private items */}
                    {!item.isPublic && (
                      <button
                        type="button"
                        onClick={() => visibilityMut.mutate({ id: item.id, isPublic: true, source: item.source, editId: item.editId })}
                        disabled={visibilityMut.isPending}
                        className="text-[12px] font-semibold flex items-center gap-1 transition-colors hover:text-purple-600 disabled:opacity-50"
                        style={{ color: isDraft ? '#d97706' : '#9CA3AF', marginLeft: isDraft ? '0' : 'auto' }}
                      >
                        {visibilityMut.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Globe className="w-3 h-3" />
                        }
                        {isDraft ? 'Push Public' : 'Make Public'}
                      </button>
                    )}

                    {/* Share — for public items with shareUrl */}
                    {item.isPublic && item.shareUrl && (
                      <button
                        type="button"
                        onClick={async () => { await navigator.clipboard.writeText(item.shareUrl!).catch(() => null); }}
                        className="text-[12px] font-semibold flex items-center gap-1 transition-colors ml-auto"
                        style={{ color: '#0891B2' }}
                      >
                        <Share2 className="w-3 h-3" /> Share
                      </button>
                    )}

                    {/* Link copy for public content with no shareUrl */}
                    {item.isPublic && !item.shareUrl && (
                      <button
                        type="button"
                        onClick={() => visibilityMut.mutate({ id: item.id, isPublic: false, source: item.source, editId: item.editId })}
                        disabled={visibilityMut.isPending}
                        className="text-[12px] font-semibold flex items-center gap-1 transition-colors hover:text-gray-600 disabled:opacity-50 ml-auto"
                        style={{ color: '#9CA3AF' }}
                      >
                        {visibilityMut.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <EyeOff className="w-3 h-3" />
                        }
                        Make Private
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Upload / Create card */}
          <Link href="/projects"
            className="rounded-2xl flex flex-col items-center justify-center aspect-video sm:aspect-auto min-h-[120px] gap-2 transition-all hover:border-purple-300"
            style={{ border: '1.5px dashed #d1d5db', background: 'transparent' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(55,65,81,.03)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
          >
            <Plus className="w-6 h-6 text-gray-400" />
            <span className="text-[13px] font-semibold text-gray-400">Upload or Create</span>
          </Link>
        </div>
      )}
    </div>
  );
}
