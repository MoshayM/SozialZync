'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  History, Search, Trash2, Clock, Eye, X, Play,
  CheckCircle2, Circle, BarChart2,
} from 'lucide-react';
import {
  type WatchEntry,
  getHistory,
  saveHistory,
  removeEntry,
  clearHistory,
} from '@/lib/watch-history';

// ── Seed data (written on first visit if history is empty) ────────────────────

const GRADIENTS = [
  'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#3730a3 100%)',
  'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
  'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)',
  'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
  'linear-gradient(135deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)',
  'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)',
  'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 50%,#2563eb 100%)',
  'linear-gradient(135deg,#4a1d96 0%,#6d28d9 50%,#7c3aed 100%)',
];

function seed(
  videoId: string, title: string, channel: string,
  duration: string, durationSec: number, progress: number,
  views: string, gi: number, hoursAgo: number,
): WatchEntry {
  return {
    id: `seed-${videoId}`,
    videoId,
    title,
    channel,
    duration,
    durationSec,
    progress,
    progressSec: Math.round(durationSec * progress / 100),
    watchedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    gradient: GRADIENTS[gi % GRADIENTS.length]!,
    views,
    kind: 'video',
  };
}

const SEED: WatchEntry[] = [
  seed('v1',  'Top 5 AI Tools for Content Creators in 2026',           'MyTech Channel',    '18:42', 1122, 82,  '34.8K', 0,  2),
  seed('v2',  'ChatGPT vs Claude: An Honest Side-by-Side Review',      'AI Explained',      '14:28',  868, 100, '28.3K', 1,  5),
  seed('v3',  'The Creator Morning Routine That Grew My Channel 3×',   'Creator HQ',         '9:15',  555, 45,  '21.1K', 2, 28),
  seed('v4',  'Tech Review: M4 MacBook Pro — Is It Worth It?',         'TechWithMe',        '22:10', 1330, 100, '18.2K', 3, 32),
  seed('v5',  'YouTube SEO Guide 2026: Rank Every Video You Upload',   'GrowthPro',         '16:55', 1015, 100, '14.1K', 4, 60),
  seed('v6',  "Beginner's Guide to AI-Assisted Content Creation",      'AI CreatorForce',   '11:30',  690, 60,  '11.4K', 5, 63),
  seed('v7',  'How I Script 30 Videos in One Weekend with AI',         'AI CreatorForce',   '13:08',  788, 100,  '9.7K', 6, 90),
  seed('v8',  'Building a $10K/Month YouTube Business — Full Breakdown','MonetizePro',      '27:44', 1664, 35,   '7.3K', 7, 94),
  seed('v9',  'Perfect Thumbnail Formula Every Creator Needs',         'ClickMaster',        '8:44',  524, 100,  '6.1K', 0, 140),
  seed('v10', 'YouTube Analytics Deep Dive — Full Walkthrough',        'DataCreator',       '19:22', 1162, 70,   '5.4K', 1, 145),
  seed('v11', 'Build Your Brand with AI in 30 Days',                   'BrandAI',           '24:18', 1458, 100,  '4.8K', 2, 168),
  seed('v12', 'Social Media Algorithm Breakdown 2026',                 'GrowthHacks',       '12:05',  725, 20,   '4.2K', 3, 172),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtWatchTime(totalSec: number): string {
  if (totalSec < 60)   return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateGroupLabel(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const day0 = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diff = Math.round((day0(now) - day0(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <  7)  return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(now.getFullYear() !== d.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function groupByDate(entries: WatchEntry[]) {
  const map = new Map<string, WatchEntry[]>();
  for (const e of entries) {
    const label = dateGroupLabel(e.watchedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = 'all' | 'in-progress' | 'completed';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WatchHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<WatchEntry[]>([]);
  const [loaded,  setLoaded]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<Filter>('all');

  // Load from localStorage; seed on first visit
  useEffect(() => {
    const stored = getHistory();
    if (stored.length === 0) {
      saveHistory(SEED);
      setHistory(SEED);
    } else {
      setHistory(stored);
    }
    setLoaded(true);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const completed  = history.filter((e) => e.progress >= 100).length;
    const inProgress = history.filter((e) => e.progress > 0 && e.progress < 100).length;
    const totalSec   = history.reduce((acc, e) => acc + Math.round(e.durationSec * e.progress / 100), 0);
    return { completed, inProgress, totalSec, total: history.length };
  }, [history]);

  const visible = useMemo(() => history.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.channel.toLowerCase().includes(q);
    const matchFilter =
      filter === 'all'         ? true :
      filter === 'in-progress' ? (e.progress > 0 && e.progress < 100) :
      /* completed */             e.progress >= 100;
    return matchSearch && matchFilter;
  }), [history, search, filter]);

  const groups = useMemo(() => groupByDate(visible), [visible]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function remove(id: string) {
    removeEntry(id);
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (!window.confirm('Clear all watch history?')) return;
    clearHistory();
    setHistory([]);
  }

  // ── Filter tabs config ───────────────────────────────────────────────────────

  const FILTER_TABS: { id: Filter; label: string; count: number }[] = [
    { id: 'all',         label: 'All',         count: stats.total       },
    { id: 'in-progress', label: 'In Progress', count: stats.inProgress  },
    { id: 'completed',   label: 'Completed',   count: stats.completed   },
  ];

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F4F3FB] p-4 sm:p-6">
        <div className="max-w-4xl space-y-3">
          <div className="h-8 w-40 rounded-xl bg-gray-200 animate-pulse mb-5" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" style={{ border: '1px solid #e5e7eb' }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F4F3FB]">
      <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-4xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <History className="w-5 h-5 text-gray-700" />
              <h1 className="text-xl font-bold text-gray-900">Watch History</h1>
            </div>
            <p className="text-sm text-gray-500">Videos you&apos;ve watched recently.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search history…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 h-9 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 w-full sm:w-48 transition"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Clear all */}
            <button
              onClick={clearAll}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-50 transition shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-2xl p-3 flex items-center gap-2.5" style={{ border: '1px solid #e5e7eb' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ede9fe' }}>
                <BarChart2 className="w-4 h-4" style={{ color: '#7c3aed' }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 leading-none mb-0.5">Watch time</p>
                <p className="text-sm font-bold text-gray-800 truncate">{fmtWatchTime(stats.totalSec)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 flex items-center gap-2.5" style={{ border: '1px solid #e5e7eb' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
                <Circle className="w-4 h-4" style={{ color: '#d97706' }} />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 leading-none mb-0.5">In progress</p>
                <p className="text-sm font-bold text-gray-800">{stats.inProgress}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 flex items-center gap-2.5" style={{ border: '1px solid #e5e7eb' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#d1fae5' }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: '#059669' }} />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 leading-none mb-0.5">Completed</p>
                <p className="text-sm font-bold text-gray-800">{stats.completed}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {history.length > 0 && (
          <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: '#f3f4f6', width: 'fit-content' }}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={filter === tab.id
                  ? { background: '#fff', color: '#374151', boxShadow: '0 2px 8px rgba(55,65,81,.15)' }
                  : { color: '#9ca3af' }}
              >
                {tab.label}
                <span
                  className="text-[10px] rounded-full px-1.5 py-0.5 leading-none"
                  style={filter === tab.id
                    ? { background: '#f3f4f6', color: '#6b7280' }
                    : { background: 'transparent' }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
              <History className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700">
              {filter === 'in-progress' ? 'No videos in progress'
               : filter === 'completed'   ? 'No completed videos'
               : search                   ? 'No results found'
               :                           'No watch history yet'}
            </p>
            <p className="text-sm text-gray-400 max-w-xs">
              {filter !== 'all' ? 'Switch to All to see everything.'
               : search         ? 'Try different search terms.'
               :                  'Videos you watch will appear here.'}
            </p>
            {filter === 'all' && !search && (
              <button
                onClick={() => router.push('/browse')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white mt-1"
                style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
              >
                <Play className="w-4 h-4" />
                Go to Browse
              </button>
            )}
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="text-xs font-semibold underline underline-offset-2 text-gray-400 hover:text-gray-600 transition"
              >
                Show all
              </button>
            )}
          </div>
        )}

        {/* Grouped list */}
        {groups.map(({ date, items }) => (
          <div key={date} className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{date}</p>
            <div className="flex flex-col gap-2">
              {items.map((e) => (
                <div
                  key={e.id}
                  className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 hover:shadow-sm transition-shadow group cursor-pointer"
                  onClick={() => router.push('/browse')}
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden flex-shrink-0"
                    style={{ background: e.gradient }}
                  >
                    {/* Duration badge */}
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                      {e.duration}
                    </span>

                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                        <Play className="w-3.5 h-3.5 text-gray-900 ml-0.5" />
                      </div>
                    </div>

                    {/* Progress bar */}
                    {e.progress > 0 && e.progress < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/30">
                        <div className="h-full bg-red-500" style={{ width: `${e.progress}%` }} />
                      </div>
                    )}

                    {/* Completed tick */}
                    {e.progress >= 100 && (
                      <div className="absolute bottom-1 left-1">
                        <CheckCircle2 className="w-4 h-4 text-green-400 drop-shadow" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-0.5">
                      {e.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{e.channel}</p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relTime(e.watchedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {e.views}
                      </span>
                    </div>

                    {/* Inline progress bar for in-progress videos */}
                    {e.progress > 0 && e.progress < 100 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 max-w-28 h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${e.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{e.progress}% watched</span>
                      </div>
                    )}
                  </div>

                  {/* Remove button — revealed on hover */}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="Remove from history"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
