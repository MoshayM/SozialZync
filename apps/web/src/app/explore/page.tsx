'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo-mark';
import { Search, Bell, ChevronDown, Play, MoreVertical, Plus, X } from 'lucide-react';

// ─ Types ─────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  duration: string | null;
  creator: string;
  viewCount: number | null;
  createdAt: string;
  type: 'video' | 'short' | 'reel';
  gradient: string;
  emoji: string;
}

interface WatchHistoryItem extends ContentItem {
  progress: number; // 0–100
}

interface Playlist {
  id: string;
  name: string;
  count: number;
  updatedAt: string;
  thumbnails: string[];
  gradients: string[];
  emojis: string[];
}

// ─ Placeholder data ───────────────────────────────────────────────────────────

const PLACEHOLDER_GRADIENTS = [
  { gradient: 'linear-gradient(135deg,#1a0533,#2d1b69)', emoji: '🎬' },
  { gradient: 'linear-gradient(135deg,#0f2027,#203a43)', emoji: '🤖' },
  { gradient: 'linear-gradient(135deg,#020024,#090979)', emoji: '📈' },
  { gradient: 'linear-gradient(135deg,#200122,#6f0000)', emoji: '💡' },
  { gradient: 'linear-gradient(135deg,#141e30,#243b55)', emoji: '📊' },
  { gradient: 'linear-gradient(135deg,#283048,#859398)', emoji: '🎤' },
];

const PLACEHOLDER_VIDEOS: ContentItem[] = [
  { id: 'p1', title: 'How to Grow to 100K Followers in 90 Days', thumbnailUrl: null, duration: '14:32', creator: '@CreatorPro', viewCount: 2400000, createdAt: '3 days ago', type: 'video', gradient: PLACEHOLDER_GRADIENTS[0].gradient, emoji: PLACEHOLDER_GRADIENTS[0].emoji },
  { id: 'p2', title: 'Top 10 AI Tools That Will Replace Your Entire Team', thumbnailUrl: null, duration: '8:18', creator: '@AIWeekly', viewCount: 1100000, createdAt: '1 week ago', type: 'video', gradient: PLACEHOLDER_GRADIENTS[1].gradient, emoji: PLACEHOLDER_GRADIENTS[1].emoji },
  { id: 'p3', title: 'Social Algorithm 2025 — Complete Breakdown', thumbnailUrl: null, duration: '11:05', creator: '@GrowthHacks', viewCount: 876000, createdAt: '5 days ago', type: 'video', gradient: PLACEHOLDER_GRADIENTS[2].gradient, emoji: PLACEHOLDER_GRADIENTS[2].emoji },
  { id: 'p4', title: 'From 0 to $10K/month: My Creator Income Story', thumbnailUrl: null, duration: '19:44', creator: '@MonetiseIt', viewCount: 654000, createdAt: '2 weeks ago', type: 'video', gradient: PLACEHOLDER_GRADIENTS[3].gradient, emoji: PLACEHOLDER_GRADIENTS[3].emoji },
];

const PLACEHOLDER_SHORTS: ContentItem[] = [
  { id: 's1', title: '3 AI tips that go viral every time', thumbnailUrl: null, duration: '0:42', creator: '@TechShorts', viewCount: null, createdAt: '', type: 'short', gradient: 'linear-gradient(135deg,#1a0533,#4c1d95)', emoji: '✂️' },
  { id: 's2', title: 'AI music that sounds human', thumbnailUrl: null, duration: '0:58', creator: '@SoundLab', viewCount: null, createdAt: '', type: 'short', gradient: 'linear-gradient(135deg,#0f2027,#2c5364)', emoji: '🎵' },
  { id: 's3', title: 'How I made $1K with one short', thumbnailUrl: null, duration: '0:31', creator: '@FastMoney', viewCount: null, createdAt: '', type: 'short', gradient: 'linear-gradient(135deg,#200122,#6f0000)', emoji: '🚀' },
  { id: 's4', title: 'ChatGPT prompt that writes scripts', thumbnailUrl: null, duration: '0:45', creator: '@PromptKing', viewCount: null, createdAt: '', type: 'short', gradient: 'linear-gradient(135deg,#000428,#004e92)', emoji: '🤯' },
  { id: 's5', title: 'Editing trick that gets 10× watch time', thumbnailUrl: null, duration: '0:55', creator: '@EditPro', viewCount: null, createdAt: '', type: 'short', gradient: 'linear-gradient(135deg,#1d4350,#a43931)', emoji: '🎬' },
  { id: 's6', title: 'Check your CTR with this formula', thumbnailUrl: null, duration: '0:39', creator: '@DataTube', viewCount: null, createdAt: '', type: 'short', gradient: 'linear-gradient(135deg,#141e30,#243b55)', emoji: '📊' },
];

const PLACEHOLDER_REELS: ContentItem[] = [
  { id: 'r1', title: 'Brand storytelling in 30s', thumbnailUrl: null, duration: '0:28', creator: '@BrandReel', viewCount: null, createdAt: '', type: 'reel', gradient: 'linear-gradient(135deg,#4a1942,#c94b4b)', emoji: '🎞️' },
  { id: 'r2', title: 'Cinematic travel reel — AI edit', thumbnailUrl: null, duration: '0:22', creator: '@WanderAI', viewCount: null, createdAt: '', type: 'reel', gradient: 'linear-gradient(135deg,#0b486b,#f56217)', emoji: '🌅' },
  { id: 'r3', title: 'Day in the life of an AI creator', thumbnailUrl: null, duration: '0:35', creator: '@CreatorDay', viewCount: null, createdAt: '', type: 'reel', gradient: 'linear-gradient(135deg,#283048,#859398)', emoji: '💼' },
  { id: 'r4', title: 'AI voice cover — sounds real', thumbnailUrl: null, duration: '0:30', creator: '@VoiceClone', viewCount: null, createdAt: '', type: 'reel', gradient: 'linear-gradient(135deg,#1f1c2c,#928dab)', emoji: '🎤' },
];

const PLACEHOLDER_HISTORY: WatchHistoryItem[] = [
  { id: 'h1', title: 'How to Grow to 100K Followers in 90 Days', thumbnailUrl: null, duration: '14:32', creator: '@CreatorPro', viewCount: null, createdAt: '', type: 'video', gradient: 'linear-gradient(135deg,#1a0533,#2d1b69)', emoji: '🎬', progress: 62 },
  { id: 'h2', title: 'Top 10 AI Tools That Will Replace Your Entire Team', thumbnailUrl: null, duration: '8:18', creator: '@AIWeekly', viewCount: null, createdAt: '', type: 'video', gradient: 'linear-gradient(135deg,#0f2027,#203a43)', emoji: '🤖', progress: 28 },
  { id: 'h3', title: 'Social Algorithm 2025 — Complete Breakdown', thumbnailUrl: null, duration: '11:05', creator: '@GrowthHacks', viewCount: null, createdAt: '', type: 'video', gradient: 'linear-gradient(135deg,#020024,#090979)', emoji: '📈', progress: 85 },
];

const CATEGORIES = ['All', 'Videos', 'Shorts', 'Reels', 'Images', 'AI Tech', 'Growth', 'Gaming', 'Finance', 'Fitness'];

// ─ Helpers ────────────────────────────────────────────────────────────────────

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

// ─ Sub-components ─────────────────────────────────────────────────────────────

function SkeletonCard({ portrait = false }: { portrait?: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 animate-pulse bg-white">
      <div className={`bg-gray-200 ${portrait ? 'aspect-[9/16]' : 'aspect-video'}`} />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function VCard({ item }: { item: ContentItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 relative group"
      style={{ transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 6px 24px rgba(0,0,0,0.1)' : 'none', borderColor: hovered ? 'rgba(124,58,237,0.3)' : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden flex items-center justify-center text-3xl"
        style={{ background: item.thumbnailUrl ? undefined : item.gradient }}>
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
          : <span>{item.emoji}</span>
        }
        {item.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[9px] font-bold px-1 py-0.5 rounded">
            {item.duration}
          </span>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-gray-900 fill-gray-900 ml-0.5" />
          </div>
        </div>
        {/* 3-dot menu */}
        <button className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
      {/* Body */}
      <div className="p-3">
        <p className="text-[11px] font-semibold text-gray-900 leading-[1.4] line-clamp-2 mb-1.5">{item.title}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span>{item.creator}</span>
          {item.viewCount != null && <><span>·</span><span>{formatViews(item.viewCount)}</span></>}
          {item.createdAt && <><span>·</span><span>{item.createdAt}</span></>}
        </div>
      </div>
    </div>
  );
}

function SCard({ item }: { item: ContentItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 relative"
      style={{ transform: hovered ? 'translateY(-2px)' : 'none', boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.09)' : 'none', borderColor: hovered ? 'rgba(8,145,178,0.4)' : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="aspect-[9/16] relative flex items-center justify-center text-2xl"
        style={{ background: item.thumbnailUrl ? undefined : item.gradient }}>
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
          : <span>{item.emoji}</span>
        }
        {item.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[9px] font-bold px-1 py-0.5 rounded">
            {item.duration}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-[10px] font-semibold text-gray-900 leading-[1.4] line-clamp-2 mb-1">{item.title}</p>
        <p className="text-[10px] text-gray-400">{item.creator}</p>
      </div>
    </div>
  );
}

function WatchCard({ item }: { item: WatchHistoryItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 relative"
      style={{ minWidth: 220, flexShrink: 0, transform: hovered ? 'translateY(-2px)' : 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="aspect-video relative flex items-center justify-center text-3xl"
        style={{ background: item.gradient }}>
        <span>{item.emoji}</span>
        {item.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[9px] font-bold px-1 py-0.5 rounded">
            {item.duration}
          </span>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-gray-900 fill-gray-900 ml-0.5" />
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-[3px] bg-gray-200">
        <div className="h-full bg-red-500 rounded" style={{ width: `${item.progress}%` }} />
      </div>
      <div className="p-3">
        <p className="text-[11px] font-semibold text-gray-900 line-clamp-2 leading-[1.4] mb-1">{item.title}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span>{item.progress}% watched</span>
          <span>·</span>
          <span>{item.creator}</span>
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-purple-200 hover:shadow-md">
      <div className="grid grid-cols-2 grid-rows-2 aspect-video gap-px bg-gray-200">
        {playlist.gradients.slice(0, 3).map((g, i) => (
          <div key={i} className="flex items-center justify-center text-sm" style={{ background: g }}>
            <span>{playlist.emojis[i] ?? '🎬'}</span>
          </div>
        ))}
        {playlist.count > 3 && (
          <div className="flex items-center justify-center bg-gray-100 text-[11px] font-bold text-gray-400">
            +{playlist.count - 3}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[11px] font-semibold text-gray-900 mb-1">{playlist.name}</p>
        <p className="text-[10px] text-gray-400">{playlist.count} videos · Updated {playlist.updatedAt}</p>
      </div>
    </div>
  );
}

// ─ Page ───────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [videos, setVideos] = useState<ContentItem[]>([]);
  const [shorts, setShorts] = useState<ContentItem[]>([]);
  const [reels, setReels] = useState<ContentItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  // Auth detection
  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    setIsLoggedIn(!!token);
    try {
      const saved = localStorage.getItem('szRecentSearches');
      if (saved) setRecentSearches(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
  }, []);

  // Fetch public content
  useEffect(() => {
    void (async () => {
      setLoadingVideos(true);
      try {
        const [vRes, sRes, rRes] = await Promise.allSettled([
          fetch('/api/proxy/content/public?type=trending&take=4'),
          fetch('/api/proxy/content/public?type=shorts&take=6'),
          fetch('/api/proxy/content/public?type=reels&take=4'),
        ]);

        const mapItem = (raw: Record<string, unknown>, i: number): ContentItem => ({
          id: String(raw.id ?? i),
          title: String(raw.title ?? 'Untitled'),
          thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : null,
          duration: raw.duration ? String(raw.duration) : null,
          creator: String(raw.creator ?? raw.creatorName ?? '@creator'),
          viewCount: typeof raw.viewCount === 'number' ? raw.viewCount : null,
          createdAt: raw.createdAt ? String(raw.createdAt) : '',
          type: (raw.type as ContentItem['type']) ?? 'video',
          gradient: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length].gradient,
          emoji: String(raw.emoji ?? PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length].emoji),
        });

        if (vRes.status === 'fulfilled' && vRes.value.ok) {
          const d = await vRes.value.json() as { items?: unknown[] };
          if (d.items?.length) setVideos((d.items as Record<string, unknown>[]).map(mapItem));
          else setVideos(PLACEHOLDER_VIDEOS);
        } else {
          setVideos(PLACEHOLDER_VIDEOS);
        }

        if (sRes.status === 'fulfilled' && sRes.value.ok) {
          const d = await sRes.value.json() as { items?: unknown[] };
          if (d.items?.length) setShorts((d.items as Record<string, unknown>[]).map(mapItem));
          else setShorts(PLACEHOLDER_SHORTS);
        } else {
          setShorts(PLACEHOLDER_SHORTS);
        }

        if (rRes.status === 'fulfilled' && rRes.value.ok) {
          const d = await rRes.value.json() as { items?: unknown[] };
          if (d.items?.length) setReels((d.items as Record<string, unknown>[]).map(mapItem));
          else setReels(PLACEHOLDER_REELS);
        } else {
          setReels(PLACEHOLDER_REELS);
        }
      } catch {
        setVideos(PLACEHOLDER_VIDEOS);
        setShorts(PLACEHOLDER_SHORTS);
        setReels(PLACEHOLDER_REELS);
      } finally {
        setLoadingVideos(false);
      }
    })();
  }, []);

  // Fetch personalized data for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoadingPersonal(true);
    void (async () => {
      try {
        const res = await fetch('/api/proxy/watch/history', {
          headers: { Authorization: `Bearer ${localStorage.getItem('cf_token') ?? ''}` },
        });
        if (res.ok) {
          const d = await res.json() as { items?: unknown[] };
          if (d.items?.length) {
            setWatchHistory((d.items as Record<string, unknown>[]).map((raw, i) => ({
              id: String(raw.id ?? i),
              title: String(raw.title ?? 'Untitled'),
              thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : null,
              duration: raw.duration ? String(raw.duration) : null,
              creator: String(raw.creator ?? '@creator'),
              viewCount: null,
              createdAt: '',
              type: 'video' as const,
              gradient: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length].gradient,
              emoji: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length].emoji,
              progress: typeof raw.progress === 'number' ? raw.progress : 50,
            })));
          } else {
            setWatchHistory(PLACEHOLDER_HISTORY);
          }
        } else {
          setWatchHistory(PLACEHOLDER_HISTORY);
        }
      } catch {
        setWatchHistory(PLACEHOLDER_HISTORY);
      } finally {
        setLoadingPersonal(false);
      }
    })();
  }, [isLoggedIn]);

  const removeSearch = useCallback((term: string) => {
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem('szRecentSearches', JSON.stringify(updated));
  }, [recentSearches]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('szRecentSearches', JSON.stringify(updated));
  }, [searchQuery, recentSearches]);

  const PLACEHOLDER_PLAYLISTS: Playlist[] = [
    { id: 'pl1', name: 'AI & Growth Tactics', count: 11, updatedAt: '2d ago', thumbnails: [], gradients: [PLACEHOLDER_GRADIENTS[0].gradient, PLACEHOLDER_GRADIENTS[1].gradient, PLACEHOLDER_GRADIENTS[2].gradient], emojis: ['🎬', '🤖', '📈'] },
    { id: 'pl2', name: 'Reels Collection', count: 7, updatedAt: '5d ago', thumbnails: [], gradients: ['linear-gradient(135deg,#4a1942,#c94b4b)', 'linear-gradient(135deg,#0b486b,#f56217)', 'linear-gradient(135deg,#283048,#859398)'], emojis: ['🎞️', '🌅', '💼'] },
    { id: 'pl3', name: 'Watch Later', count: 5, updatedAt: '1d ago', thumbnails: [], gradients: ['linear-gradient(135deg,#1f1c2c,#928dab)', 'linear-gradient(135deg,#141e30,#243b55)', 'linear-gradient(135deg,#200122,#6f0000)'], emojis: ['📋', '📊', '💡'] },
  ];

  const displayPlaylists = playlists.length ? playlists : PLACEHOLDER_PLAYLISTS;

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FA', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-6 py-3"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E5E7EB' }}>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <LogoMark className="w-[26px] h-[20px]" />
          <span className="text-[13px] font-extrabold tracking-tight text-gray-900">
            Sozial<span style={{ color: '#7C3AED' }}>Z</span>ynk
          </span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 max-w-[420px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search videos, channels, topics…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full text-[12px] border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-purple-400 transition-all"
            style={{ focusRingColor: 'rgba(124,58,237,0.2)' } as React.CSSProperties}
          />
        </form>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/browse" className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">Browse</Link>
          <button className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">Shorts</button>
          <button className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">Reels</button>
          <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />

          {isLoggedIn ? (
            <>
              <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                <Bell className="w-3.5 h-3.5" />
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#0891B2)' }}>U</div>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Sign In</Link>
              <Link href="/welcome" className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white transition-colors"
                style={{ background: '#7C3AED' }}>🚀 Start Creating</Link>
            </>
          )}
        </div>
      </header>

      {/* ── Category tabs ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-6 py-3 overflow-x-auto border-b border-gray-200 bg-white"
        style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border"
            style={activeCategory === cat
              ? { background: '#7C3AED', borderColor: '#7C3AED', color: '#fff' }
              : { background: 'transparent', borderColor: '#E5E7EB', color: '#6B7280' }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-8">

        {/* ── Logged-in personalized sections ── */}
        {isLoggedIn && (
          <>
            {/* Continue Watching */}
            {(loadingPersonal || watchHistory.length > 0) && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-extrabold text-gray-900 flex items-center gap-2">
                    ▶ Continue Watching
                    <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{watchHistory.length} videos</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button className="text-[11px] font-semibold text-gray-400 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Clear history</button>
                    <button className="text-[11px] font-semibold text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">See all →</button>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {loadingPersonal
                    ? [1, 2, 3].map(i => <div key={i} className="rounded-xl overflow-hidden animate-pulse bg-white border border-gray-100 shrink-0" style={{ minWidth: 220 }}><div className="aspect-video bg-gray-200"/><div className="p-3 space-y-2"><div className="h-3 bg-gray-200 rounded"/><div className="h-2.5 bg-gray-100 rounded w-2/3"/></div></div>)
                    : watchHistory.map(item => <WatchCard key={item.id} item={item} />)
                  }
                </div>
              </section>
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-[14px] font-extrabold text-gray-900">🔍 Recent Searches</h2>
                  <button onClick={() => { setRecentSearches([]); localStorage.removeItem('szRecentSearches'); }}
                    className="text-[11px] font-semibold text-gray-400 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map(term => (
                    <div key={term} className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5 text-[11px] font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors">
                      🔍 {term}
                      <button onClick={() => removeSearch(term)} className="text-gray-400 hover:text-gray-600 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* My Playlists */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-extrabold text-gray-900 flex items-center gap-2">
                  📂 My Playlists
                  <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{displayPlaylists.length} groups</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button className="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors"
                    style={{ background: 'rgba(8,145,178,0.08)', color: '#0891B2', borderColor: 'rgba(8,145,178,0.25)' }}>
                    <Plus className="w-3 h-3 inline mr-1" />New Playlist
                  </button>
                  <button className="text-[11px] font-semibold text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">See all →</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayPlaylists.map(pl => <PlaylistCard key={pl.id} playlist={pl} />)}
                {/* New playlist card */}
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center min-h-[130px] cursor-pointer hover:border-purple-300 transition-colors">
                  <Plus className="w-6 h-6 text-gray-300 mb-1.5" />
                  <p className="text-[11px] font-bold text-gray-300">New Playlist</p>
                  <p className="text-[10px] text-gray-200 mt-0.5">Group videos & reels</p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── Trending Videos ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-gray-900 flex items-center gap-2">
              🔥 Trending Videos
              <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">Public</span>
            </h2>
            <button className="text-[11px] font-semibold text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">See all →</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {loadingVideos
              ? [1, 2, 3, 4].map(i => <SkeletonCard key={i} />)
              : videos.map(v => <VCard key={v.id} item={v} />)
            }
          </div>
        </section>

        {/* ── Popular Shorts ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-gray-900">✂️ Popular Shorts</h2>
            <button className="text-[11px] font-semibold text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">See all →</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {loadingVideos
              ? [1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} portrait />)
              : shorts.map(s => <SCard key={s.id} item={s} />)
            }
          </div>
        </section>

        {/* ── Latest Reels ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-gray-900">🎞️ Latest Reels</h2>
            <button className="text-[11px] font-semibold text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">See all →</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {loadingVideos
              ? [1, 2, 3, 4].map(i => <SkeletonCard key={i} portrait />)
              : reels.map(r => <SCard key={r.id} item={r} />)
            }
          </div>
        </section>

        {/* ── Creator CTA banner ── */}
        <div className="rounded-2xl p-7 flex items-center gap-5"
          style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(6,182,212,0.07))', border: '1px solid rgba(124,58,237,0.25)' }}>
          <div className="text-4xl">🚀</div>
          <div className="flex-1">
            <p className="text-[16px] font-extrabold text-gray-900 mb-1.5">Ready to publish YOUR content here?</p>
            <p className="text-[12px] text-gray-600">Join thousands of creators using SozialZynk's AI to script, produce and publish videos automatically.</p>
          </div>
          <Link href="/welcome"
            className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors hover:opacity-90"
            style={{ background: '#7C3AED' }}>
            Start Creating Free →
          </Link>
        </div>

      </div>
    </div>
  );
}
