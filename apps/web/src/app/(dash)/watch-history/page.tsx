'use client';

import { useState } from 'react';
import { History, Search, Trash2, Clock, Eye, X, Play } from 'lucide-react';

// ─────────────────────────── Data shapes ───────────────────────────

interface WatchedVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  watchedAt: string;
  watchedDate: string; // date group key e.g. "Today", "Yesterday", "Sep 8, 2026"
  progress: number; // 0–100 percent watched
  gradient: string;
}

// ─────────────────────────── Mock data ───────────────────────────

const HISTORY: WatchedVideo[] = [
  {
    id: 'h1',
    title: 'Top 5 AI Tools for Content Creators in 2026',
    channel: 'MyTech Channel',
    duration: '18:42',
    views: '34.8K',
    watchedAt: '2 hours ago',
    watchedDate: 'Today',
    progress: 82,
    gradient: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#3730a3 100%)',
  },
  {
    id: 'h2',
    title: 'ChatGPT vs Claude: An Honest Side-by-Side Review',
    channel: 'AI Explained',
    duration: '14:28',
    views: '28.3K',
    watchedAt: '5 hours ago',
    watchedDate: 'Today',
    progress: 100,
    gradient: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
  },
  {
    id: 'h3',
    title: 'The Creator Morning Routine That Grew My Channel 3×',
    channel: 'Creator HQ',
    duration: '9:15',
    views: '21.1K',
    watchedAt: 'Yesterday at 8:30 PM',
    watchedDate: 'Yesterday',
    progress: 45,
    gradient: 'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)',
  },
  {
    id: 'h4',
    title: 'Tech Review: M4 MacBook Pro — Is It Worth It for Creators?',
    channel: 'TechWithMe',
    duration: '22:10',
    views: '18.2K',
    watchedAt: 'Yesterday at 3:15 PM',
    watchedDate: 'Yesterday',
    progress: 100,
    gradient: 'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
  },
  {
    id: 'h5',
    title: 'YouTube SEO Guide 2026: Rank Every Video You Upload',
    channel: 'GrowthPro',
    duration: '16:55',
    views: '14.1K',
    watchedAt: 'Sep 8 at 11:00 AM',
    watchedDate: 'Sep 8, 2026',
    progress: 100,
    gradient: 'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
  },
  {
    id: 'h6',
    title: "Beginner's Guide to AI-Assisted Content Creation",
    channel: 'AI CreatorForce',
    duration: '11:30',
    views: '11.4K',
    watchedAt: 'Sep 8 at 9:22 AM',
    watchedDate: 'Sep 8, 2026',
    progress: 60,
    gradient: 'linear-gradient(135deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)',
  },
  {
    id: 'h7',
    title: 'How I Script 30 Videos in One Weekend with AI',
    channel: 'AI CreatorForce',
    duration: '13:08',
    views: '9.7K',
    watchedAt: 'Sep 7 at 6:45 PM',
    watchedDate: 'Sep 7, 2026',
    progress: 100,
    gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)',
  },
  {
    id: 'h8',
    title: 'Building a $10K/Month YouTube Business — Full Breakdown',
    channel: 'MonetizePro',
    duration: '27:44',
    views: '7.3K',
    watchedAt: 'Sep 7 at 2:10 PM',
    watchedDate: 'Sep 7, 2026',
    progress: 35,
    gradient: 'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 50%,#2563eb 100%)',
  },
];

// ─────────────────────────── Helpers ───────────────────────────

function groupByDate(items: WatchedVideo[]): { date: string; videos: WatchedVideo[] }[] {
  const map = new Map<string, WatchedVideo[]>();
  for (const v of items) {
    if (!map.has(v.watchedDate)) map.set(v.watchedDate, []);
    map.get(v.watchedDate)!.push(v);
  }
  return Array.from(map.entries()).map(([date, videos]) => ({ date, videos }));
}

// ─────────────────────────── Page ───────────────────────────

export default function WatchHistoryPage() {
  const [search, setSearch] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = HISTORY.filter(
    (v) =>
      !dismissed.has(v.id) &&
      v.title.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = groupByDate(visible);

  return (
    <div className="min-h-screen bg-[#F4F3FB]">
      <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-4xl">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <History className="w-5 h-5 text-gray-700" />
              <h1 className="text-xl font-bold text-gray-900">Watch History</h1>
            </div>
            <p className="text-sm text-gray-500">Videos you&apos;ve watched recently.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search history…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 h-9 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 w-44 transition"
              />
            </div>

            {/* Clear all */}
            <button
              onClick={() => setDismissed(new Set(HISTORY.map((v) => v.id)))}
              className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        </div>

        {/* ── Empty state ── */}
        {groups.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
              <History className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700">No watch history</p>
            <p className="text-sm text-gray-400 max-w-xs">
              {search ? 'No videos match your search.' : 'Videos you watch will appear here.'}
            </p>
          </div>
        )}

        {/* ── Grouped list ── */}
        {groups.map(({ date, videos }) => (
          <div key={date} className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{date}</p>
            <div className="flex flex-col gap-2">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 hover:shadow-sm transition group cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden flex-shrink-0"
                    style={{ background: v.gradient }}
                  >
                    <img
                      src={`/api/thumb?seed=${v.id}&w=288&h=162`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Duration badge */}
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                      {v.duration}
                    </span>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                        <Play className="w-3.5 h-3.5 text-gray-900 ml-0.5" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    {v.progress < 100 && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/30">
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${v.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-0.5">
                      {v.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{v.channel}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {v.watchedAt}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {v.views} views
                      </span>
                    </div>
                    {v.progress < 100 && (
                      <p className="text-[11px] text-gray-400 mt-1">{v.progress}% watched</p>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissed((d) => new Set([...d, v.id]));
                    }}
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
