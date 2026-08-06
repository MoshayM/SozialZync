'use client';
import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FolderOpen, Plus, Loader2, Video, Zap, PlayCircle,
  ChevronDown, ArrowRight, Bot, Clock, MoreVertical,
  ListVideo, Layers, Music, Image, Mic, FileText, RefreshCw, CheckCircle, AlertCircle,
  Youtube, Instagram, Facebook,
  Search, ListOrdered, Award, ArrowRightLeft,
} from 'lucide-react';
import DiscoverPage from '../discover/page';
import SeriesPlannerPage from '../series-planner/page';
import ScoreScriptPage from '../score-script/page';
import RepurposePage from '../repurpose/page';
import { api } from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import { usePlan } from '@/lib/plan';
import { ProBanner, ProLockBadge } from '@/components/pro-gate';
import { VirtualVideoGrid } from '@/components/library/VirtualVideoGrid';
import { PlaylistsTab } from '@/components/library/PlaylistsTab';
import { SyncBadge } from '@/components/library/SyncBadge';
import { ChannelAccessPanel } from '@/components/channel-access-panel';
import { ProGate } from '@/components/pro-gate';

// ── Projects types ────────────────────────────────────────────────────────────

type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'THREADS' | 'FACEBOOK';
type ContentFormat = string;

interface Project {
  id: string;
  title: string;
  niche?: string;
  targetLang?: string;
  status: string;
  publishingStatus?: string;
  channel?: { title: string; thumbnailUrl?: string } | null;
  _count: { jobs: number; videos: number };
  updatedAt: string;
}

interface Channel { id: string; title: string; platform?: string; thumbnailUrl?: string; }

// ── Library types ─────────────────────────────────────────────────────────────

interface AssetProject { id: string; title: string; }

interface Asset {
  id: string;
  projectId: string;
  kind: string;
  status: string;
  label: string | null;
  createdAt: string;
  versions: Array<{ id: string; version: number; provider?: string; durationMs?: number; sizeBytes?: string }>;
}

type LibTabId = 'videos' | 'playlists' | 'assets';

const LIB_TABS: Array<{ id: LibTabId; label: string; description: string }> = [
  { id: 'videos',    label: 'Videos',      description: 'Browse and search synced channel videos' },
  { id: 'playlists', label: 'Playlists',   description: 'View and manage your video playlists' },
  { id: 'assets',    label: 'Media Assets', description: 'AI-generated media assets for your projects' },
];

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MUSIC: Music, VIDEO: Video, THUMBNAIL: Image, VOICE: Mic,
  IMAGE: Image, SUBTITLE: FileText, UPLOAD: Layers, RENDER_SOURCE: Layers,
};

const STATUS_BADGE: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; style: React.CSSProperties }> = {
  BRIEFED:    { label: 'Brief ready', icon: Clock,        style: { background: '#f3f4f6', color: '#4b5563' } },
  GENERATING: { label: 'Generating',  icon: RefreshCw,    style: { background: '#eff6ff', color: '#1d4ed8' } },
  READY:      { label: 'Ready',       icon: CheckCircle,  style: { background: '#ecfdf5', color: '#065f46' } },
  ACCEPTED:   { label: 'Accepted',    icon: CheckCircle,  style: { background: '#f5f2fd', color: '#6D4AE0' } },
  FAILED:     { label: 'Failed',      icon: AlertCircle,  style: { background: '#fef2f2', color: '#dc2626' } },
};

const CHANNEL_LS_KEY = 'cf.library.channelId';

// ── Media platform icons ──────────────────────────────────────────────────────

const TikTokIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

const LinkedInSvg = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.35-1.85 3.58 0 4.24 2.36 4.24 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>
  </svg>
);

const XSvg = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// ── Media platform config ─────────────────────────────────────────────────────

type MediaPlatformId = 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'LINKEDIN' | 'X';

interface MediaPlatform {
  id: MediaPlatformId;
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  mediaTypes: string[];
  hasSync: boolean;
}

const MEDIA_PLATFORMS: MediaPlatform[] = [
  { id: 'YOUTUBE',   label: 'YouTube',   color: '#FF0000', bg: '#fff5f5', border: '#fecaca', Icon: Youtube,      mediaTypes: ['videos', 'playlists', 'assets'], hasSync: true  },
  { id: 'INSTAGRAM', label: 'Instagram', color: '#E1306C', bg: '#fff0f6', border: '#fbcfe8', Icon: Instagram,    mediaTypes: ['reels', 'posts'],                hasSync: false },
  { id: 'FACEBOOK',  label: 'Facebook',  color: '#1877F2', bg: '#eff6ff', border: '#bfdbfe', Icon: Facebook,     mediaTypes: ['videos', 'posts'],               hasSync: false },
  { id: 'TIKTOK',    label: 'TikTok',    color: '#010101', bg: '#f8f8f8', border: '#d1d5db', Icon: TikTokIcon,   mediaTypes: ['videos'],                        hasSync: false },
  { id: 'LINKEDIN',  label: 'LinkedIn',  color: '#0A66C2', bg: '#eff6ff', border: '#bfdbfe', Icon: LinkedInSvg,  mediaTypes: ['posts', 'articles'],             hasSync: false },
  { id: 'X',         label: 'X',         color: '#000000', bg: '#f9fafb', border: '#e5e7eb', Icon: XSvg,         mediaTypes: ['posts', 'videos'],               hasSync: false },
];

// ── Platform config ───────────────────────────────────────────────────────────

interface FormatDef { type: string; emoji: string; label: string; desc: string; }
interface PlatformDef {
  platform: Platform; label: string; emoji: string;
  color: string; bg: string; border: string; textColor: string;
  formats: FormatDef[];
}

const PLATFORMS: PlatformDef[] = [
  {
    platform: 'YOUTUBE', label: 'YouTube', emoji: '▶️',
    color: '#FF0000', bg: '#fff0f0', border: '#fecaca', textColor: '#b91c1c',
    formats: [
      { type: 'YT_VIDEO',   emoji: '🎬', label: 'Long Video',      desc: 'AI research, script, chapters & SEO publish' },
      { type: 'YT_SHORT',   emoji: '⚡', label: 'Short / Reel',    desc: 'Vertical <60s from scratch or clipped' },
      { type: 'YT_PODCAST', emoji: '🎙️', label: 'Podcast / Audio', desc: 'Video podcast or audio-first content' },
    ],
  },
  {
    platform: 'INSTAGRAM', label: 'Instagram', emoji: '📸',
    color: '#E1306C', bg: '#fff0f6', border: '#fbcfe8', textColor: '#be185d',
    formats: [
      { type: 'IG_REEL',  emoji: '🎞️', label: 'Reel',            desc: 'Short vertical video up to 90 s' },
      { type: 'IG_POST',  emoji: '🖼️', label: 'Post / Carousel', desc: 'Image or multi-image carousel' },
      { type: 'IG_STORY', emoji: '⭕', label: 'Story',           desc: '15 s disappearing content' },
    ],
  },
  {
    platform: 'LINKEDIN', label: 'LinkedIn', emoji: '💼',
    color: '#0A66C2', bg: '#eff6ff', border: '#bfdbfe', textColor: '#1d4ed8',
    formats: [
      { type: 'LI_ARTICLE', emoji: '📄', label: 'Article',      desc: 'Long-form thought leadership piece' },
      { type: 'LI_POST',    emoji: '✍️', label: 'Post',         desc: 'Text + optional image/video' },
      { type: 'LI_VIDEO',   emoji: '🎥', label: 'Native Video', desc: 'Short video direct upload' },
    ],
  },
  {
    platform: 'TIKTOK', label: 'TikTok', emoji: '🎵',
    color: '#000000', bg: '#f8f8f8', border: '#d1d5db', textColor: '#111827',
    formats: [
      { type: 'TT_VIDEO',  emoji: '🎵', label: 'TikTok Video', desc: 'Short-form vertical video' },
      { type: 'TT_SERIES', emoji: '📚', label: 'Series',       desc: 'Multi-part episodic content' },
    ],
  },
  {
    platform: 'X', label: 'X / Twitter', emoji: '𝕏',
    color: '#000000', bg: '#f9fafb', border: '#e5e7eb', textColor: '#111827',
    formats: [
      { type: 'X_THREAD', emoji: '🧵', label: 'Thread',     desc: 'Multi-post text thread' },
      { type: 'X_VIDEO',  emoji: '📹', label: 'Video Post', desc: 'Short video with caption' },
    ],
  },
  {
    platform: 'THREADS', label: 'Threads', emoji: '🧶',
    color: '#1a1a1a', bg: '#f9fafb', border: '#e5e7eb', textColor: '#111827',
    formats: [
      { type: 'TH_THREAD', emoji: '🧵', label: 'Thread',     desc: 'Multi-post text thread' },
      { type: 'TH_VIDEO',  emoji: '📹', label: 'Video Post', desc: 'Short video + caption' },
    ],
  },
  {
    platform: 'FACEBOOK', label: 'Facebook', emoji: '📘',
    color: '#1877F2', bg: '#eff6ff', border: '#bfdbfe', textColor: '#1d4ed8',
    formats: [
      { type: 'FB_VIDEO', emoji: '📺', label: 'Video', desc: 'Facebook native video' },
      { type: 'FB_REEL',  emoji: '⚡', label: 'Reel',  desc: 'Short vertical video' },
      { type: 'FB_POST',  emoji: '📝', label: 'Post',  desc: 'Text + image post' },
    ],
  },
];

const LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇺🇸' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', name: 'French',     flag: '🇫🇷' },
  { code: 'de', name: 'German',     flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'tr', name: 'Turkish',    flag: '🇹🇷' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch',      flag: '🇳🇱' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  ACTIVE:   { bg: '#ecfdf5', color: '#065f46', dot: '#10b981' },
  DRAFT:    { bg: '#f5f2fd', color: '#6D4AE0', dot: '#6D4AE0' },
  PAUSED:   { bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  ARCHIVED: { bg: '#f3f4f6', color: '#4b5563', dot: '#9ca3af' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function platformFromChannel(ch: Channel): Platform {
  const p = (ch.platform ?? 'YOUTUBE').toUpperCase() as Platform;
  return PLATFORMS.find(d => d.platform === p) ? p : 'YOUTUBE';
}

function getProjectMeta(id: string): { platform: Platform; format: ContentFormat } {
  if (typeof window === 'undefined') return { platform: 'YOUTUBE', format: 'YT_VIDEO' };
  return {
    platform: (localStorage.getItem(`cf_platform_${id}`) as Platform | null) ?? 'YOUTUBE',
    format:   (localStorage.getItem(`cf_ct_${id}`) as string | null) ?? 'YT_VIDEO',
  };
}

function getCrossPosts(id: string): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(`cf_crosspost_${id}`) ?? '[]') as string[]; }
  catch { return []; }
}

function formatLabel(fmt: string): string {
  for (const pd of PLATFORMS) {
    const fd = pd.formats.find(f => f.type === fmt);
    if (fd) return fd.label;
  }
  return fmt;
}

function formatEmoji(fmt: string): string {
  for (const pd of PLATFORMS) {
    const fd = pd.formats.find(f => f.type === fmt);
    if (fd) return fd.emoji;
  }
  return '📁';
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(value); }, delay);
    return () => { clearTimeout(t); };
  }, [value, delay]);
  return debounced;
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls = 'w-full bg-white rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none transition-all focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] placeholder:text-gray-600';
const inputStyle = { border: '1.5px solid #e3e0f0' };

// ── Projects sub-components ───────────────────────────────────────────────────

function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  const cfg = PLATFORMS.find(d => d.platform === platform) ?? PLATFORMS[0]!;
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        background: cfg.color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, fontWeight: 800, fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      {cfg.emoji}
    </span>
  );
}

function ProjectSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 animate-pulse" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 bg-gray-100 rounded-xl w-3/4" />
          <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
        </div>
        <div className="h-5 w-14 bg-gray-100 rounded-full shrink-0" />
      </div>
      <div className="h-px bg-gray-50 mb-3" />
      <div className="flex gap-4">
        <div className="h-3 bg-gray-100 rounded-lg w-20" />
        <div className="h-3 bg-gray-100 rounded-lg w-16" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE['DRAFT']!;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

function CardMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative" style={{ zIndex: 10 }}>
      <button
        type="button"
        aria-label="Project options"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-700 hover:bg-gray-100 transition-all"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 bg-white rounded-2xl py-1 min-w-[130px] shadow-xl"
          style={{ border: '1.5px solid #e3ddf8', zIndex: 20 }}
        >
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onRename(); }}
            className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-[#f5f2fd] hover:text-[#6D4AE0] transition-colors"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full text-left px-4 py-2 text-sm font-semibold transition-colors"
            style={{ color: '#dc2626' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function RenameModal({ project, onClose, onSuccess }: { project: Project; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(project.title);
  const renameMutation = useMutation({
    mutationFn: () => api.projects.update(project.id, { title }),
    onSuccess: () => { onSuccess(); onClose(); },
  });
  const unchanged = title.trim() === project.title.trim();
  const disabled = !title.trim() || unchanged || renameMutation.isPending;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,40,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="px-7 py-5 flex items-center justify-between" style={{ borderBottom: '1.5px solid #f0edf9' }}>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Rename project</h2>
            <p className="text-xs text-gray-600 mt-0.5">Update the title for this project</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-colors text-lg leading-none">×</button>
        </div>
        <div className="px-7 py-6">
          <Field label="Project title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) renameMutation.mutate(); }}
              className={inputCls} style={inputStyle} placeholder="Enter a title…"
            />
          </Field>
        </div>
        <div className="px-7 py-5 flex items-center justify-between gap-3" style={{ borderTop: '1.5px solid #f0edf9' }}>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors">Cancel</button>
          <button
            type="button" onClick={() => renameMutation.mutate()} disabled={disabled}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 16px rgba(109,74,224,0.30)' }}
          >
            {renameMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {renameMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ project, onClose, onSuccess }: { project: Project; onClose: () => void; onSuccess: () => void }) {
  const deleteMutation = useMutation({
    mutationFn: () => api.projects.delete(project.id),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,40,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="px-7 py-5 flex items-center justify-between" style={{ borderBottom: '1.5px solid #f0edf9' }}>
          <h2 className="text-lg font-extrabold text-gray-900">Delete this project?</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-colors text-lg leading-none">×</button>
        </div>
        <div className="px-7 py-6 space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            You are about to delete <span className="font-extrabold">&ldquo;{project.title}&rdquo;</span>.
          </p>
          <div className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca' }}>
            This cannot be undone. All jobs and videos in this project will be removed.
          </div>
        </div>
        <div className="px-7 py-5 flex items-center justify-between gap-3" style={{ borderTop: '1.5px solid #f0edf9' }}>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors">Cancel</button>
          <button
            type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', boxShadow: '0 4px 16px rgba(220,38,38,0.30)' }}
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Channel Access tab ────────────────────────────────────────────────────────

function ChannelsTab() {
  return (
    <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Channel connections */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
        <ProGate
          feature="Channel Access"
          description="Connect and manage your YouTube, Instagram, TikTok, and other social channels. Upgrade to Pro to unlock channel management and direct publishing."
        >
          <ChannelAccessPanel />
        </ProGate>
      </div>

      {/* Media library — scoped to selected channel */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: '#e3ddf8' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a78bdb' }}>
            Channel Media
          </span>
          <div className="h-px flex-1" style={{ background: '#e3ddf8' }} />
        </div>
        <MediaLibraryTab />
      </div>
    </div>
  );
}

// ── Media Library tab (ported from /library) ──────────────────────────────────

type VideoType = 'all' | 'video' | 'short';
type VideoSort = 'recent' | 'title';

const API_BASE_LIB = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api';

async function fetchLibApi<T>(path: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null;
  const res = await fetch(`${API_BASE_LIB}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function MediaLibraryTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Accordion open state — YouTube open by default
  const [openPlatforms, setOpenPlatforms] = useState<Set<MediaPlatformId>>(
    () => new Set<MediaPlatformId>(['YOUTUBE'])
  );
  function togglePlatform(id: MediaPlatformId) {
    setOpenPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Per-platform channel selection
  const [platformChannelIds, setPlatformChannelIds] = useState<Partial<Record<MediaPlatformId, string>>>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(CHANNEL_LS_KEY) : null;
    return stored ? { YOUTUBE: stored } : {};
  });
  function getChannelForPlatform(platId: MediaPlatformId): string {
    return platformChannelIds[platId] ?? '';
  }
  function setChannelForPlatform(platId: MediaPlatformId, id: string) {
    setPlatformChannelIds(prev => ({ ...prev, [platId]: id }));
    if (platId === 'YOUTUBE') localStorage.setItem(CHANNEL_LS_KEY, id);
  }

  // YouTube media sub-tab
  const ytMediaTab = (searchParams.get('media') ?? 'videos') as LibTabId;
  function setYtMediaTab(t: LibTabId) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'channels');
    p.set('media', t);
    router.replace(`/projects?${p.toString()}`, { scroll: false });
  }

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Channel[]),
  });

  // Auto-select first channel per platform once channels load
  useEffect(() => {
    if (!channels.length) return;
    setPlatformChannelIds(prev => {
      const next = { ...prev };
      for (const plat of MEDIA_PLATFORMS) {
        if (!next[plat.id]) {
          const first = channels.find(c => (c.platform ?? 'YOUTUBE').toUpperCase() === plat.id);
          if (first) next[plat.id] = first.id;
        }
      }
      return next;
    });
  }, [channels]);

  const ytChannelId = getChannelForPlatform('YOUTUBE');

  // Assets
  const [assetProjects, setAssetProjects] = useState<AssetProject[]>([]);
  const [selectedAssetProject, setSelectedAssetProject] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');

  useEffect(() => {
    fetchLibApi<{ data: AssetProject[] }>('/projects')
      .then((p) => setAssetProjects(p.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAssetProject) return;
    setAssetsLoading(true);
    setAssetsError('');
    fetchLibApi<{ data: Asset[] }>(`/assets/project/${selectedAssetProject}`)
      .then((p) => setAssets(p.data))
      .catch((e: unknown) => setAssetsError(e instanceof Error ? e.message : 'Failed to load assets'))
      .finally(() => setAssetsLoading(false));
  }, [selectedAssetProject]);

  const groupedAssets = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    acc[a.kind] = [...(acc[a.kind] ?? []), a];
    return acc;
  }, {});

  // Videos
  const [searchInput, setSearchInput] = useState('');
  const [videoType, setVideoType] = useState<VideoType>('all');
  const [videoSort, setVideoSort] = useState<VideoSort>('recent');
  const q = useDebounced(searchInput, 300);

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: videosLoading,
  } = useInfiniteQuery({
    queryKey: ['library-videos', ytChannelId, q, videoType, videoSort],
    queryFn: ({ pageParam }) =>
      api.library.listVideos(ytChannelId, {
        cursor: pageParam as string | undefined,
        q: q || undefined,
        type: videoType === 'all' ? undefined : videoType,
        sort: videoSort,
      }).then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!ytChannelId && ytMediaTab === 'videos',
  });

  const allVideos = videosData?.pages.flatMap((p) => p.data) ?? [];

  const handleFetchNextPage = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-3">
      {MEDIA_PLATFORMS.map((plat) => {
        const isOpen = openPlatforms.has(plat.id);
        const platChannels = channels.filter(c => (c.platform ?? 'YOUTUBE').toUpperCase() === plat.id);
        const connected = platChannels.length > 0;
        const activeChId = getChannelForPlatform(plat.id);

        return (
          <div
            key={plat.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{ border: `1.5px solid ${isOpen ? plat.border : '#e3ddf8'}` }}
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => togglePlatform(plat.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
              style={{ background: isOpen ? plat.bg : '#fff' }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: plat.color + '18' }}>
                <plat.Icon className="w-4 h-4" style={{ color: plat.color }} />
              </div>
              <span className="font-bold text-sm text-gray-900 flex-1">{plat.label}</span>

              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                style={connected
                  ? { background: '#ecfdf5', color: '#15803d' }
                  : { background: '#f3f4f6', color: '#374151' }}
              >
                {connected ? `${platChannels.length} channel${platChannels.length > 1 ? 's' : ''}` : 'Not connected'}
              </span>

              {plat.id === 'YOUTUBE' && connected && isOpen && activeChId && (
                <span onClick={e => e.stopPropagation()}>
                  <SyncBadge channelId={activeChId} />
                </span>
              )}

              <ChevronDown
                className="w-4 h-4 shrink-0 transition-transform duration-200"
                style={{ color: '#374151', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div style={{ borderTop: `1.5px solid ${plat.border}` }}>

                {/* Not connected */}
                {!connected && (
                  <div className="p-10 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                         style={{ background: plat.color + '12' }}>
                      <plat.Icon className="w-7 h-7" style={{ color: plat.color }} />
                    </div>
                    <p className="text-sm font-extrabold text-gray-900 mb-1">{plat.label} not connected</p>
                    <p className="text-xs text-gray-600 mb-4">Connect your {plat.label} account to browse your media here.</p>
                    <Link
                      href="/projects?tab=channels"
                      className="px-5 py-2.5 rounded-2xl text-sm font-bold text-white hover:opacity-90 transition-all"
                      style={{ background: plat.color }}
                    >
                      Connect {plat.label} →
                    </Link>
                  </div>
                )}

                {/* Connected — no sync yet */}
                {connected && !plat.hasSync && (
                  <div className="p-10 flex flex-col items-center text-center">
                    <div className="px-3 py-1 rounded-full text-xs font-bold mb-3 inline-flex"
                         style={{ background: '#f0edf9', color: '#6D4AE0' }}>
                      Coming Soon
                    </div>
                    <p className="text-sm font-extrabold text-gray-900 mb-1">{plat.label} Media Library</p>
                    <p className="text-xs text-gray-600">
                      Your channel is connected. Media sync for {plat.label} is coming soon —<br />
                      you&apos;ll be able to browse all your {plat.label} content here.
                    </p>
                  </div>
                )}

                {/* YouTube — full browser */}
                {connected && plat.hasSync && plat.id === 'YOUTUBE' && (
                  <div>
                    {/* Channel selector row */}
                    <div className="flex items-center gap-4 px-5 py-3 flex-wrap"
                         style={{ borderBottom: `1px solid ${plat.border}`, background: plat.bg }}>
                      {platChannels.length > 1 ? (
                        <select
                          value={activeChId}
                          onChange={e => setChannelForPlatform('YOUTUBE', e.target.value)}
                          className="bg-white rounded-xl px-3 py-2 text-xs font-medium outline-none"
                          style={{ border: `1.5px solid ${plat.border}` }}
                          aria-label="Select channel"
                        >
                          {platChannels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-gray-700">{platChannels[0]?.title}</span>
                      )}
                    </div>

                    {/* Media type sub-tabs */}
                    <div className="flex border-b overflow-x-auto no-scrollbar" style={{ borderColor: plat.border }}>
                      {LIB_TABS.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setYtMediaTab(t.id)}
                          className="px-5 py-3.5 text-sm shrink-0 border-b-2 transition-all whitespace-nowrap"
                          style={ytMediaTab === t.id
                            ? { borderColor: plat.color, color: plat.color, fontWeight: 700 }
                            : { borderColor: 'transparent', color: '#4b5563', fontWeight: 500 }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Assets */}
                      {ytMediaTab === 'assets' && (
                        <div className="space-y-5">
                          <div>
                            <label htmlFor="assets-project" className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-2">Select Project</label>
                            <div className="relative">
                              <select
                                id="assets-project"
                                value={selectedAssetProject}
                                onChange={e => setSelectedAssetProject(e.target.value)}
                                className="w-full bg-white rounded-2xl px-4 py-3 pr-10 text-sm text-gray-700 outline-none appearance-none"
                                style={{ border: '1.5px solid #e3e0f0' }}
                              >
                                <option value="">Choose a project…</option>
                                {assetProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            </div>
                          </div>
                          {assetsLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#6D4AE0' }} /></div>}
                          {assetsError && <p className="text-sm text-red-500">{assetsError}</p>}
                          {selectedAssetProject && !assetsLoading && assets.length === 0 && !assetsError && (
                            <div className="rounded-3xl p-12 flex flex-col items-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
                              <Layers className="w-10 h-10 mb-3" style={{ color: '#6D4AE0' }} />
                              <p className="text-sm font-semibold text-gray-700">No assets yet for this project</p>
                              <p className="text-xs text-gray-600 mt-1">Run Voice Spec, Image Brief, or Music Brief from the project pipeline.</p>
                            </div>
                          )}
                          {Object.entries(groupedAssets).map(([kind, kindAssets]) => {
                            const KindIcon = KIND_ICONS[kind] ?? Layers;
                            return (
                              <div key={kind}>
                                <h3 className="flex items-center gap-2 mb-3">
                                  <KindIcon className="w-4 h-4 text-[#6D4AE0]" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600">{kind.replace('_', ' ')}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: '#f5f2fd', color: '#6D4AE0' }}>{kindAssets.length}</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {kindAssets.map(asset => {
                                    const status = STATUS_BADGE[asset.status] ?? STATUS_BADGE['BRIEFED']!;
                                    const StatusIcon = status.icon;
                                    const latest = asset.versions[0];
                                    return (
                                      <div key={asset.id} className="bg-white rounded-2xl p-4" style={{ border: '1.5px solid #e3ddf8' }}>
                                        <div className="flex items-start justify-between mb-2">
                                          <p className="text-sm font-medium text-gray-900 truncate flex-1">{asset.label ?? `${kind} — ${asset.id.slice(0, 8)}`}</p>
                                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ml-2" style={status.style}>
                                            <StatusIcon className={`w-3 h-3 ${asset.status === 'GENERATING' ? 'animate-spin' : ''}`} />
                                            {status.label}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-600">
                                          {asset.versions.length} version{asset.versions.length !== 1 ? 's' : ''}
                                          {latest?.provider ? ` · ${latest.provider}` : ''}
                                          {latest?.durationMs ? ` · ${Math.round(latest.durationMs / 1000)}s` : ''}
                                        </p>
                                        <p className="text-xs text-gray-300 mt-1">Created {new Date(asset.createdAt).toLocaleDateString()}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Videos */}
                      {ytMediaTab === 'videos' && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                              </svg>
                              <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                                placeholder="Search videos…" aria-label="Search videos"
                                className="w-full pl-10 pr-4 bg-white rounded-2xl py-3 text-sm outline-none"
                                style={{ border: '1.5px solid #e3e0f0' }} />
                            </div>
                            <div className="flex gap-1.5">
                              {(['all', 'video', 'short'] as VideoType[]).map(t => (
                                <button key={t} type="button" onClick={() => setVideoType(t)}
                                  className="px-3 py-2 text-sm font-semibold rounded-2xl transition-all"
                                  style={videoType === t
                                    ? { background: plat.color, color: '#fff', border: `1.5px solid ${plat.color}` }
                                    : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }}>
                                  {t === 'all' ? 'All' : t === 'video' ? 'Videos' : 'Shorts'}
                                </button>
                              ))}
                            </div>
                            <select value={videoSort} onChange={e => setVideoSort(e.target.value as VideoSort)}
                              aria-label="Sort videos"
                              className="bg-white rounded-2xl px-4 py-3 text-sm outline-none"
                              style={{ border: '1.5px solid #e3e0f0' }}>
                              <option value="recent">Recent</option>
                              <option value="title">Title</option>
                            </select>
                          </div>
                          {videosLoading && (
                            <div className="flex items-center gap-2 py-16 justify-center text-gray-700">
                              <Loader2 className="w-5 h-5 animate-spin" style={{ color: plat.color }} /> Loading library…
                            </div>
                          )}
                          {!videosLoading && allVideos.length === 0 && (
                            <div className="rounded-3xl p-14 flex flex-col items-center justify-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
                              <ListVideo className="w-10 h-10 mb-3" style={{ color: '#6D4AE0' }} />
                              <p className="text-base font-extrabold text-gray-900 mb-1">No videos synced yet</p>
                              <p className="text-sm text-gray-600 mb-4">Sync your channel to see videos here.</p>
                              <SyncBadge channelId={ytChannelId} />
                            </div>
                          )}
                          {!videosLoading && allVideos.length > 0 && (
                            <VirtualVideoGrid videos={allVideos} hasNextPage={!!hasNextPage} isFetchingNextPage={isFetchingNextPage} fetchNextPage={handleFetchNextPage} />
                          )}
                        </div>
                      )}

                      {/* Playlists */}
                      {ytMediaTab === 'playlists' && (
                        <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                          <PlaylistsTab channelId={ytChannelId} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Projects tab ──────────────────────────────────────────────────────────────

interface ProjectsTabProps {
  projects: Project[];
  channels: Channel[];
  isLoading: boolean;
  searchQuery: string;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  createStep: 1 | 2;
  setCreateStep: (v: 1 | 2) => void;
  createError: string | null;
  setCreateError: (v: string | null) => void;
  form: {
    platform: Platform; contentFormat: ContentFormat;
    primaryChannelId: string; crossPostChannelIds: string[];
    title: string; niche: string; goal: string; targetLang: string;
  };
  setForm: React.Dispatch<React.SetStateAction<ProjectsTabProps['form']>>;
  closeCreate: () => void;
  createMutation: { mutate: () => void; isPending: boolean };
  setRenameProject: (p: Project | null) => void;
  setDeleteProject: (p: Project | null) => void;
  isFreeTier: boolean;
  limits: { maxProjects: number };
  atProjectLimit: boolean;
  filteredProjects: Project[];
  activeCount: number;
  totalJobs: number;
  totalVideos: number;
}

function ProjectsTab({
  projects, channels, isLoading, searchQuery,
  showCreate, setShowCreate, createStep, setCreateStep,
  createError, form, setForm, closeCreate, createMutation,
  setRenameProject, setDeleteProject,
  isFreeTier, limits, atProjectLimit,
  filteredProjects, activeCount, totalJobs, totalVideos,
}: ProjectsTabProps) {
  const router = useRouter();

  const selPlatform = PLATFORMS.find(d => d.platform === form.platform) ?? PLATFORMS[0]!;
  const platformChannels = channels.filter(ch => platformFromChannel(ch) === form.platform);
  const otherChannels = channels.filter(ch => ch.id !== form.primaryChannelId);

  const titlePlaceholder =
    selPlatform.platform === 'YOUTUBE'   ? 'e.g. How to Start Investing in 2025' :
    selPlatform.platform === 'INSTAGRAM' ? 'e.g. Morning Routine – 5 Habits That Changed My Life' :
    selPlatform.platform === 'LINKEDIN'  ? 'e.g. Why Remote Work Changed My Leadership Style' :
    'e.g. My content campaign title';

  return (
    <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Projects</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-600">Manage your content campaigns</p>
            {isFreeTier && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f5f2fd', color: '#6D4AE0' }}>
                {projects.length}/{limits.maxProjects} Free
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { if (!atProjectLimit) setShowCreate(true); }}
          disabled={atProjectLimit}
          title={atProjectLimit ? `Free plan: max ${limits.maxProjects} projects. Upgrade to Pro for unlimited.` : undefined}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Stats */}
      {(projects.length > 0 || isLoading) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard tone="lilac"      icon={<FolderOpen className="w-5 h-5" />} label="Projects"   value={projects.length} />
          <StatCard tone="periwinkle" icon={<PlayCircle className="w-5 h-5" />} label="Active"     value={activeCount} sub="in production" />
          <StatCard tone="cream"      icon={<Zap className="w-5 h-5" />}        label="Agent Jobs" value={totalJobs} sub="across all projects" />
          <StatCard tone="pink"       icon={<Video className="w-5 h-5" />}      label="Videos"     value={totalVideos} />
        </div>
      )}

      {/* Search result indicator */}
      {searchQuery && !isLoading && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-600">
            {filteredProjects.length > 0
              ? <><span className="font-semibold text-gray-800">{filteredProjects.length}</span> result{filteredProjects.length !== 1 ? 's' : ''} for &ldquo;<span className="text-[#6D4AE0] font-semibold">{searchQuery}</span>&rdquo;</>
              : <>No projects match &ldquo;<span className="text-[#6D4AE0] font-semibold">{searchQuery}</span>&rdquo;</>}
          </p>
          <button type="button" onClick={() => router.replace('/projects')} className="text-xs font-semibold text-[#6D4AE0] hover:underline">
            Clear search
          </button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <ProjectSkeleton key={i} />)}
        </div>
      ) : filteredProjects.length === 0 && searchQuery ? (
        <div className="rounded-3xl flex flex-col items-center justify-center py-16 px-6 text-center" style={{ background: 'white', border: '1.5px solid #e3ddf8' }}>
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">No results</h2>
          <p className="text-gray-600 text-sm">Try a different keyword or <button type="button" onClick={() => router.replace('/projects')} className="text-[#6D4AE0] font-semibold hover:underline">clear the search</button>.</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl flex flex-col items-center justify-center py-20 px-6 text-center" style={{ background: 'white', border: '1.5px solid #e3ddf8' }}>
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6" style={{ background: 'linear-gradient(135deg, #f0edf9, #e3ddf8)' }}>🎬</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">No projects yet</h2>
          <p className="text-gray-600 text-sm max-w-xs mb-8 leading-relaxed">
            Create your first content campaign — YouTube videos, Instagram Reels, LinkedIn articles, TikTok videos, and more.
          </p>
          <button
            type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.30)' }}
          >
            <Plus className="w-4 h-4" /> Create first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => {
            const { platform, format } = getProjectMeta(p.id);
            const pdCfg = PLATFORMS.find(d => d.platform === platform) ?? PLATFORMS[0]!;
            const crossPosts = getCrossPosts(p.id);
            return (
              <div key={p.id} className="relative group">
                <Link
                  href={`/projects/${p.id}`}
                  className="block bg-white rounded-2xl p-5 transition-all hover:border-[#6D4AE0]/40 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  <div className="flex items-start gap-3 mb-4 pr-10">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: pdCfg.bg }}>
                      {formatEmoji(format)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="font-extrabold text-gray-900 text-sm leading-tight truncate">{p.title}</h3>
                        {p.targetLang && p.targetLang !== 'en' && (() => {
                          const lang = LANGUAGES.find(l => l.code === p.targetLang);
                          return lang ? (
                            <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: '#f0edf9', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>
                              {lang.flag} {lang.code.toUpperCase()}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <PlatformIcon platform={platform} size={14} />
                        {p.channel?.title
                          ? <span className="truncate">{p.channel.title}</span>
                          : <span className="truncate italic" style={{ color: '#6D4AE0' }}>No account linked</span>}
                        {crossPosts.length > 0 && (
                          <span className="flex items-center gap-1 ml-1">
                            <span className="text-[10px] text-gray-300 mx-0.5">+</span>
                            {crossPosts.slice(0, 3).map((cpId, i) => {
                              const cpCh = channels.find(c => c.id === cpId);
                              const cpPlatform = cpCh ? platformFromChannel(cpCh) : 'YOUTUBE';
                              return <PlatformIcon key={i} platform={cpPlatform} size={12} />;
                            })}
                            {crossPosts.length > 3 && <span className="text-[10px] text-gray-600">+{crossPosts.length - 3}</span>}
                          </span>
                        )}
                        {p.niche && <><span>·</span><span className="truncate">{p.niche}</span></>}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                    {p.publishingStatus && p.publishingStatus !== 'NOT_PUBLISHED' && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            p.publishingStatus === 'PUBLISHED'  ? '#dcfce7' :
                            p.publishingStatus === 'SCHEDULED'  ? '#dbeafe' :
                            p.publishingStatus === 'FAILED'     ? '#fee2e2' :
                            p.publishingStatus === 'READY'      ? '#f0fdf4' :
                            '#f5f2fd',
                          color:
                            p.publishingStatus === 'PUBLISHED'  ? '#16a34a' :
                            p.publishingStatus === 'SCHEDULED'  ? '#1d4ed8' :
                            p.publishingStatus === 'FAILED'     ? '#dc2626' :
                            p.publishingStatus === 'READY'      ? '#15803d' :
                            '#6D4AE0',
                        }}
                      >
                        {p.publishingStatus === 'PUBLISHED' ? '✓ Published' :
                         p.publishingStatus === 'SCHEDULED' ? '🕐 Scheduled' :
                         p.publishingStatus === 'FAILED'    ? '✗ Failed' :
                         p.publishingStatus === 'READY'     ? '● Ready' :
                         p.publishingStatus === 'DRAFT'     ? '◌ Draft' :
                         p.publishingStatus}
                      </span>
                    )}
                  </div>
                  <div className="h-px mb-3" style={{ background: '#f5f2fd' }} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: pdCfg.bg, color: pdCfg.textColor }}>
                        {formatEmoji(format)} {formatLabel(format)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-600"><Zap className="w-3 h-3" /> {p._count.jobs} jobs</span>
                      <span className="flex items-center gap-1 text-xs text-gray-600"><Video className="w-3 h-3" /> {p._count.videos} videos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <Clock className="w-3 h-3" />
                      {relativeTime(p.updatedAt)}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#6D4AE0] transition-colors ml-1" />
                    </div>
                  </div>
                </Link>
                <div className="absolute top-3 right-3" style={{ zIndex: 10 }}>
                  <CardMenu onRename={() => setRenameProject(p)} onDelete={() => setDeleteProject(p)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,10,40,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCreate(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeCreate(); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="px-7 py-5 flex items-start justify-between gap-4" style={{ borderBottom: '1.5px solid #f0edf9' }}>
              <div className="space-y-2.5">
                <h2 className="text-lg font-extrabold text-gray-900">New Project</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {[{ n: 1, label: 'Platform & Format' }, { n: 2, label: 'Accounts & Details' }].map(({ n, label }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: createStep >= n ? '#6D4AE0' : '#e5e7eb', color: createStep >= n ? '#fff' : '#4b5563' }}>{n}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: createStep === n ? '#6D4AE0' : '#4b5563' }}>{label}</span>
                      {n < 2 && <span style={{ width: 24, height: 2, background: '#e5e7eb', borderRadius: 2 }} />}
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={closeCreate} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-colors text-lg leading-none shrink-0">×</button>
            </div>

            {createStep === 1 && (
              <>
                <div className="px-7 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-3">Platform</p>
                    <div className="grid grid-cols-4 gap-3">
                      {PLATFORMS.map((pd) => {
                        const isLocked = isFreeTier && pd.platform !== 'YOUTUBE';
                        return (
                          <button
                            key={pd.platform} type="button"
                            onClick={() => {
                              if (isLocked) return;
                              setForm(f => ({ ...f, platform: pd.platform, contentFormat: pd.formats[0]!.type, primaryChannelId: '', crossPostChannelIds: [] }));
                            }}
                            title={isLocked ? 'Upgrade to Pro to create projects for this platform' : undefined}
                            style={form.platform === pd.platform
                              ? { background: pd.bg, border: `2px solid ${pd.color}` }
                              : isLocked
                              ? { background: '#f9fafb', border: '1.5px solid #e5e7eb', opacity: 0.65, cursor: 'not-allowed' }
                              : { background: '#faf9ff', border: '1.5px solid #e3ddf8' }}
                            className="relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl text-center transition-all hover:border-gray-300"
                          >
                            {isLocked && <span className="absolute top-1.5 right-1.5"><ProLockBadge /></span>}
                            <span style={{ fontSize: 22 }}>{pd.emoji}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: form.platform === pd.platform ? pd.textColor : '#374151' }}>{pd.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-3">Content format</p>
                    <div className="grid grid-cols-3 gap-3">
                      {selPlatform.formats.map(fd => (
                        <button
                          key={fd.type} type="button"
                          onClick={() => setForm(f => ({ ...f, contentFormat: fd.type }))}
                          style={form.contentFormat === fd.type
                            ? { background: selPlatform.bg, border: `2px solid ${selPlatform.color}` }
                            : { background: '#faf9ff', border: '1.5px solid #e3ddf8' }}
                          className="flex flex-col items-start gap-1 p-3.5 rounded-2xl text-left transition-all"
                        >
                          <span style={{ fontSize: 18 }}>{fd.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: form.contentFormat === fd.type ? selPlatform.textColor : '#374151' }}>{fd.label}</span>
                          <span style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.35 }}>{fd.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-7 py-5 flex items-center justify-between gap-3" style={{ borderTop: '1.5px solid #f0edf9' }}>
                  <button type="button" onClick={closeCreate} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors">Cancel</button>
                  <button
                    type="button" onClick={() => setCreateStep(2)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 16px rgba(109,74,224,0.30)' }}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {createStep === 2 && (
              <>
                <div className="px-7 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
                  {isFreeTier && (
                    <ProBanner
                      feature="Connect social accounts"
                      description="Free plan: content will be created without a connected account. Upgrade to Pro to link YouTube, Instagram, TikTok, and publish directly."
                    />
                  )}
                  <Field
                    label={<span className="flex items-center gap-2">Primary account<span className="text-xs font-medium rounded-full px-2 py-0.5" style={{ background: '#ede9fe', color: '#6D4AE0' }}>Optional</span></span>}
                    hint={`Optimizes content for ${selPlatform.label}. You can connect an account now or publish later.`}
                  >
                    {platformChannels.length === 0 ? (
                      <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#f5f2fd', border: '1.5px solid #d4c9f9' }}>
                        <p className="font-semibold mb-1" style={{ color: '#4c1d95' }}>ℹ No accounts connected yet</p>
                        <p style={{ color: '#4b5563' }}>You don&apos;t need to connect any account now. Create your content first.</p>
                        <p className="mt-2">
                          <button
                            type="button"
                            onClick={() => void startOAuthFromWizard()}
                            className="text-[#6D4AE0] font-semibold hover:underline"
                          >
                            Connect Account →
                          </button>
                          {' '}<span style={{ color: '#4b5563', fontSize: 12 }}>(optional)</span>
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          aria-label="Primary account" value={form.primaryChannelId}
                          onChange={(e) => setForm(f => ({ ...f, primaryChannelId: e.target.value }))}
                          className={`${inputCls} pr-10 appearance-none cursor-pointer`} style={inputStyle}
                        >
                          <option value="">Select a {selPlatform.label} account…</option>
                          {platformChannels.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                      </div>
                    )}
                  </Field>

                  <Field label="Cross-post to (optional)" hint="Also publish this content to other connected accounts.">
                    {otherChannels.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#4b5563' }}>
                        No other accounts connected yet.{' '}
                        <Link href="/publish?tab=accounts" className="text-[#6D4AE0] font-semibold hover:underline" onClick={closeCreate}>Connect accounts →</Link>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {otherChannels.map(ch => {
                          const chPlatform = platformFromChannel(ch);
                          const chPd = PLATFORMS.find(d => d.platform === chPlatform) ?? PLATFORMS[0]!;
                          const isSel = form.crossPostChannelIds.includes(ch.id);
                          return (
                            <button
                              key={ch.id} type="button"
                              onClick={() => setForm(f => ({
                                ...f,
                                crossPostChannelIds: isSel
                                  ? f.crossPostChannelIds.filter(id => id !== ch.id)
                                  : [...f.crossPostChannelIds, ch.id],
                              }))}
                              style={isSel
                                ? { background: chPd.bg, border: `1.5px solid ${chPd.color}`, color: chPd.textColor }
                                : { background: '#f9fafb', border: '1.5px solid #e5e7eb', color: '#374151' }}
                              className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition-all"
                            >
                              <PlatformIcon platform={chPlatform} size={14} />
                              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</span>
                              {isSel && <span style={{ fontSize: 10, marginLeft: 2 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Field>

                  <Field label="Project title">
                    <input
                      placeholder={titlePlaceholder} value={form.title}
                      onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                      className={inputCls} style={inputStyle}
                    />
                  </Field>

                  <Field label="Niche / Topic" hint="Helps AI tune research & script for your audience">
                    <input
                      placeholder="Optional — e.g. Personal Finance, Tech, Wellness" value={form.niche}
                      onChange={(e) => setForm(f => ({ ...f, niche: e.target.value }))}
                      className={inputCls} style={inputStyle}
                    />
                  </Field>

                  <Field label="Goal / Brief">
                    <textarea
                      placeholder="Optional — describe the goal, angle, or target audience for this project"
                      value={form.goal} onChange={(e) => setForm(f => ({ ...f, goal: e.target.value }))}
                      rows={2} className={inputCls} style={{ ...inputStyle, resize: 'none' }}
                    />
                  </Field>

                  <Field label="Content Language" hint="AI will generate scripts and research in this language">
                    <div className="relative">
                      <select
                        value={form.targetLang}
                        onChange={(e) => setForm(f => ({ ...f, targetLang: e.target.value }))}
                        className={`${inputCls} pr-10 appearance-none cursor-pointer`}
                        style={inputStyle}
                      >
                        {LANGUAGES.map(l => (
                          <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                    </div>
                  </Field>
                </div>

                {createError && <p className="px-7 pb-2 text-sm text-red-600">{createError}</p>}
                <div className="px-7 py-5 flex items-center justify-between gap-3" style={{ borderTop: '1.5px solid #f0edf9' }}>
                  <button type="button" onClick={() => setCreateStep(1)} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors">← Back</button>
                  <button
                    type="button" onClick={() => createMutation.mutate()}
                    disabled={!form.title || createMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 16px rgba(109,74,224,0.30)' }}
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {createMutation.isPending ? 'Creating…' : 'Create project'}
                    {!createMutation.isPending && <Bot className="w-4 h-4 opacity-70" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── View router ───────────────────────────────────────────────────────────────

const VIEW_TABS = [
  { id: 'projects',  label: 'Projects',       icon: FolderOpen    },
  { id: 'discover',  label: 'Discover',        icon: Search        },
  { id: 'series',    label: 'Series Planner',  icon: ListOrdered   },
  { id: 'score',     label: 'Script Score',    icon: Award         },
  { id: 'repurpose', label: 'Repurpose',       icon: ArrowRightLeft },
] as const;
type ViewId = typeof VIEW_TABS[number]['id'];

function ProjectsViewRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') ?? 'projects') as ViewId;

  function selectView(v: ViewId) {
    if (v === 'projects') router.replace('/projects');
    else router.replace(`/projects?view=${v}`);
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Tab bar */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-[#e3ddf8] px-4 sm:px-6 flex overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {VIEW_TABS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectView(id)}
              className={[
                'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium shrink-0 border-b-2 transition-all whitespace-nowrap',
                active
                  ? 'border-[#6D4AE0] text-[#6D4AE0] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
              ].join(' ')}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#6D4AE0]' : 'text-gray-400'}`} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {view === 'projects'  && <ProjectsInner />}
      {view === 'discover'  && <DiscoverPage />}
      {view === 'series'    && <SeriesPlannerPage />}
      {view === 'score'     && <ScoreScriptPage />}
      {view === 'repurpose' && <RepurposePage />}
    </div>
  );
}

export default function ProjectsPage() {
  return <Suspense fallback={null}><ProjectsViewRouter /></Suspense>;
}

const _WIZARD_API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';

async function startOAuthFromWizard() {
  try {
    const redirectUri = `${_WIZARD_API_URL}/channels/oauth/callback`;
    const { data } = await api.channels.getAuthUrl(redirectUri, 'PUBLISH', '/projects?connected=1') as { data: { url: string } };
    window.location.href = data.url;
  } catch { /* ignore */ }
}

function ProjectsInner() {
  const qc = useQueryClient();
  const router = useRouter();

  const searchParams = useSearchParams();

  const mainTab = (searchParams.get('tab') ?? 'projects') as 'projects' | 'channels';

  function setMainTab(t: 'projects' | 'channels') {
    const p = new URLSearchParams();
    p.set('tab', t);
    router.replace(`/projects?${p.toString()}`);
  }

  const searchQuery = searchParams.get('q')?.trim() ?? '';
  const { isFreeTier, limits } = usePlan();
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform: 'YOUTUBE' as Platform,
    contentFormat: 'YT_VIDEO' as ContentFormat,
    primaryChannelId: '',
    crossPostChannelIds: [] as string[],
    title: '',
    niche: '',
    goal: '',
    targetLang: 'en',
  });
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.projects.list().then((r) => (r.data as { data: Project[] }).data),
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Channel[]),
  });

  function closeCreate() {
    setShowCreate(false);
    setCreateStep(1);
    setCreateError(null);
    setForm({ platform: 'YOUTUBE', contentFormat: 'YT_VIDEO', primaryChannelId: '', crossPostChannelIds: [], title: '', niche: '', goal: '', targetLang: 'en' });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.projects.create({
        channelId: form.primaryChannelId || undefined,
        title: form.title,
        niche: form.niche || undefined,
        contentFormat: form.contentFormat,
        targetLang: form.targetLang !== 'en' ? form.targetLang : undefined,
        platforms: [
          form.platform,
          ...form.crossPostChannelIds
            .map(id => channels.find(c => c.id === id))
            .filter((c): c is Channel => Boolean(c))
            .map(c => platformFromChannel(c))
            .filter((p, i, a) => a.indexOf(p) === i),
        ],
      }),
    onSuccess: (res) => {
      const newId: string = (res.data as { id: string }).id;
      localStorage.setItem(`cf_ct_${newId}`, form.contentFormat);
      localStorage.setItem(`cf_platform_${newId}`, form.platform);
      if (form.crossPostChannelIds.length > 0) {
        localStorage.setItem(`cf_crosspost_${newId}`, JSON.stringify(form.crossPostChannelIds));
      }
      void qc.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${newId}`);
      closeCreate();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(typeof msg === 'string' ? msg : 'Failed to create project. Please try again.');
    },
  });

  function invalidateProjects() { void qc.invalidateQueries({ queryKey: ['projects'] }); }

  const atProjectLimit = isFreeTier && projects.length >= limits.maxProjects;
  const filteredProjects = searchQuery
    ? projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.niche ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.channel?.title ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;
  const activeCount = projects.filter(p => p.status === 'ACTIVE').length;
  const totalJobs   = projects.reduce((s, p) => s + p._count.jobs, 0);
  const totalVideos = projects.reduce((s, p) => s + p._count.videos, 0);

  const MAIN_TABS = [
    { id: 'projects' as const,  label: 'Projects',       icon: '📁' },
    { id: 'channels' as const,  label: 'Channel Access', icon: '📺' },
  ];

  return (
    <div className="min-h-full bg-[#faf9ff]">
      {/* Tab bar */}
      <div style={{ borderBottom: '1.5px solid #e3ddf8', background: 'white' }}>
        <div className="max-w-5xl mx-auto px-5 lg:px-7">
          <div className="flex gap-0">
            {MAIN_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMainTab(t.id)}
                className="flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all relative"
                style={{ color: mainTab === t.id ? '#6D4AE0' : '#374151' }}
              >
                <span>{t.icon}</span>
                {t.label}
                {mainTab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: '#6D4AE0' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {mainTab === 'projects' && (
        <ProjectsTab
          projects={projects}
          channels={channels}
          isLoading={isLoading}
          searchQuery={searchQuery}
          showCreate={showCreate}
          setShowCreate={setShowCreate}
          createStep={createStep}
          setCreateStep={setCreateStep}
          createError={createError}
          setCreateError={setCreateError}
          form={form}
          setForm={setForm}
          closeCreate={closeCreate}
          createMutation={createMutation}
          setRenameProject={setRenameProject}
          setDeleteProject={setDeleteProject}
          isFreeTier={isFreeTier}
          limits={limits}
          atProjectLimit={atProjectLimit}
          filteredProjects={filteredProjects}
          activeCount={activeCount}
          totalJobs={totalJobs}
          totalVideos={totalVideos}
        />
      )}
      {mainTab === 'channels' && <ChannelsTab />}

      {/* Modals (outside tab content so they stay mounted) */}
      {renameProject && (
        <RenameModal project={renameProject} onClose={() => setRenameProject(null)} onSuccess={invalidateProjects} />
      )}
      {deleteProject && (
        <DeleteModal project={deleteProject} onClose={() => setDeleteProject(null)} onSuccess={invalidateProjects} />
      )}
    </div>
  );
}
