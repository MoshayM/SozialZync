'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo-mark';
import { Search, Play, MoreVertical } from 'lucide-react';

// ─ Types ─────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  duration: string | null;
  creator: string;
  viewCount: number | null;
  createdAt: string;
  gradient: string;
  emoji: string;
}

const PLACEHOLDER_GRADIENTS = [
  { gradient: 'linear-gradient(135deg,#1a0533,#2d1b69)', emoji: '🎬' },
  { gradient: 'linear-gradient(135deg,#0f2027,#203a43)', emoji: '🤖' },
  { gradient: 'linear-gradient(135deg,#020024,#090979)', emoji: '📈' },
  { gradient: 'linear-gradient(135deg,#200122,#6f0000)', emoji: '💡' },
  { gradient: 'linear-gradient(135deg,#141e30,#243b55)', emoji: '📊' },
  { gradient: 'linear-gradient(135deg,#283048,#859398)', emoji: '🎤' },
  { gradient: 'linear-gradient(135deg,#4a1942,#c94b4b)', emoji: '💰' },
  { gradient: 'linear-gradient(135deg,#1d4350,#a43931)', emoji: '🎬' },
];

const PLACEHOLDER_VIDEOS: ContentItem[] = [
  { id: 'b1', title: 'How to Grow to 100K Followers', thumbnailUrl: null, duration: '14:32', creator: '@CreatorPro', viewCount: 2400000, createdAt: '3 days ago', gradient: PLACEHOLDER_GRADIENTS[0].gradient, emoji: PLACEHOLDER_GRADIENTS[0].emoji },
  { id: 'b2', title: 'Top 10 AI Tools for Creators 2025', thumbnailUrl: null, duration: '8:18', creator: '@AIWeekly', viewCount: 1100000, createdAt: '1 week ago', gradient: PLACEHOLDER_GRADIENTS[1].gradient, emoji: PLACEHOLDER_GRADIENTS[1].emoji },
  { id: 'b3', title: 'Social Media Algorithm Breakdown', thumbnailUrl: null, duration: '11:05', creator: '@GrowthHacks', viewCount: 876000, createdAt: '5 days ago', gradient: PLACEHOLDER_GRADIENTS[2].gradient, emoji: PLACEHOLDER_GRADIENTS[2].emoji },
  { id: 'b4', title: 'From 0 to $10K/month as a Creator', thumbnailUrl: null, duration: '19:44', creator: '@MonetiseIt', viewCount: 654000, createdAt: '2 weeks ago', gradient: PLACEHOLDER_GRADIENTS[3].gradient, emoji: PLACEHOLDER_GRADIENTS[3].emoji },
  { id: 'b5', title: 'Social Media SEO Secrets 2025', thumbnailUrl: null, duration: '7:22', creator: '@SEOKing', viewCount: 432000, createdAt: '4 days ago', gradient: PLACEHOLDER_GRADIENTS[4].gradient, emoji: PLACEHOLDER_GRADIENTS[4].emoji },
  { id: 'b6', title: 'AI Voice Generation — Full Guide', thumbnailUrl: null, duration: '13:11', creator: '@VoiceTech', viewCount: 321000, createdAt: '6 days ago', gradient: PLACEHOLDER_GRADIENTS[5].gradient, emoji: PLACEHOLDER_GRADIENTS[5].emoji },
  { id: 'b7', title: 'Monetisation Masterclass 2025', thumbnailUrl: null, duration: '16:55', creator: '@MoneyTube', viewCount: 218000, createdAt: '1 week ago', gradient: PLACEHOLDER_GRADIENTS[6].gradient, emoji: PLACEHOLDER_GRADIENTS[6].emoji },
  { id: 'b8', title: 'Perfect Thumbnail Formula', thumbnailUrl: null, duration: '9:30', creator: '@ClickMaster', viewCount: 189000, createdAt: '2 weeks ago', gradient: PLACEHOLDER_GRADIENTS[7].gradient, emoji: PLACEHOLDER_GRADIENTS[7].emoji },
];

const CONTENT_TYPES = [
  { id: 'all', label: '📹 All Videos' },
  { id: 'short', label: '✂️ Shorts' },
  { id: 'reel', label: '🎞️ Reels' },
  { id: 'image', label: '🖼 Images' },
];

const CATEGORY_FILTERS = [
  { id: 'ai', label: '🤖 AI & Tech' },
  { id: 'growth', label: '📈 Growth' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'finance', label: '💰 Finance' },
  { id: 'fitness', label: '🏋️ Fitness' },
  { id: 'creative', label: '🎨 Creative' },
];

const SORT_OPTIONS = ['Sort: Trending', 'Most Recent', 'Most Viewed'];

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
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
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-gray-900 fill-gray-900 ml-0.5" />
          </div>
        </div>
        <button className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
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

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 animate-pulse bg-white">
      <div className="aspect-video bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function SidebarItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-all mb-0.5"
      style={active
        ? { background: 'rgba(124,58,237,0.1)', color: '#7C3AED', fontWeight: 700 }
        : { color: '#6B7280' }
      }
    >
      {label}
    </button>
  );
}

export default function BrowsePage() {
  const [activeType, setActiveType] = useState('all');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSort, setActiveSort] = useState(SORT_OPTIONS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: activeType, sort: activeSort, take: '8' });
        if (activeCategory) params.set('category', activeCategory);
        const res = await fetch(`/api/proxy/content/public?${params.toString()}`);
        if (res.ok) {
          const d = await res.json() as { items?: unknown[] };
          if (d.items?.length) {
            setVideos((d.items as Record<string, unknown>[]).map((raw, i) => ({
              id: String(raw.id ?? i),
              title: String(raw.title ?? 'Untitled'),
              thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : null,
              duration: raw.duration ? String(raw.duration) : null,
              creator: String(raw.creator ?? '@creator'),
              viewCount: typeof raw.viewCount === 'number' ? raw.viewCount : null,
              createdAt: raw.createdAt ? String(raw.createdAt) : '',
              gradient: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length].gradient,
              emoji: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length].emoji,
            })));
          } else {
            setVideos(PLACEHOLDER_VIDEOS);
          }
        } else {
          setVideos(PLACEHOLDER_VIDEOS);
        }
      } catch {
        setVideos(PLACEHOLDER_VIDEOS);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeType, activeCategory, activeSort]);

  const filteredVideos = searchQuery
    ? videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.creator.toLowerCase().includes(searchQuery.toLowerCase()))
    : videos;

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FA', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-6 py-3"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E5E7EB' }}>
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <LogoMark className="w-[26px] h-[20px]" />
          <span className="text-[13px] font-extrabold tracking-tight text-gray-900">
            Sozial<span style={{ color: '#7C3AED' }}>Z</span>ynk
          </span>
        </Link>
        <div className="relative flex-1 max-w-[420px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full text-[12px] border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-purple-400 transition-all"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Sign In</Link>
          <Link href="/become-creator"
            className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white transition-colors hover:opacity-90"
            style={{ background: '#7C3AED' }}>🚀 Start Creating</Link>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        <div className="flex gap-5">

          {/* Sidebar filter */}
          <aside className="w-[180px] shrink-0">
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 px-3 mb-2">Content Type</p>
            {CONTENT_TYPES.map(t => (
              <SidebarItem key={t.id} label={t.label} active={activeType === t.id} onClick={() => setActiveType(t.id)} />
            ))}
            <div className="h-px bg-gray-200 my-3 mx-3" />
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 px-3 mb-2">Category</p>
            {CATEGORY_FILTERS.map(c => (
              <SidebarItem key={c.id} label={c.label} active={activeCategory === c.id} onClick={() => setActiveCategory(prev => prev === c.id ? '' : c.id)} />
            ))}
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-[14px] font-extrabold text-gray-900">All Public Videos</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Public only</span>
              <div className="ml-auto">
                <select
                  value={activeSort}
                  onChange={e => setActiveSort(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2"
                  style={{ focusRingColor: 'rgba(124,58,237,0.2)' } as React.CSSProperties}
                >
                  {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <p className="text-2xl mb-3">🔍</p>
                <p className="font-semibold text-gray-700 mb-1">No content found</p>
                <p className="text-sm text-gray-400">Try adjusting the filters or search terms</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredVideos.map(v => <VCard key={v.id} item={v} />)}
              </div>
            )}

            {/* Load more */}
            {!loading && filteredVideos.length > 0 && (
              <div className="mt-6 text-center">
                <button className="px-6 py-2.5 rounded-xl text-[12px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Load more →
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
