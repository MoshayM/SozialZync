'use client';

import { useState } from 'react';
import {
  RefreshCw,
  Search,
  ChevronDown,
  Play,
  Eye,
  ThumbsUp,
  MessageCircle,
  MoreVertical,
  Users,
  FileEdit,
  Image as ImageIcon,
  Music,
  FileVideo,
  ListVideo,
  PlusCircle,
  Layers,
  Film,
} from 'lucide-react';

// ─────────────────────────── Data shapes ───────────────────────────

type Visibility = 'Public' | 'Private' | 'Unlisted';
type DraftStatus = 'Scripted' | 'Filmed' | 'Edited';
type AssetType = 'Image' | 'Audio' | 'Clip';

interface Video {
  id: string;
  title: string;
  duration: string;
  views: string;
  likes: string;
  comments: string;
  uploadDate: string;
  visibility: Visibility;
  gradient: string;
}

interface Playlist {
  id: string;
  title: string;
  videoCount: number;
  totalViews: string;
  gradients: [string, string, string];
}

interface Draft {
  id: string;
  title: string;
  status: DraftStatus;
  type: string;
  lastEdited: string;
}

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  meta: string;
  gradient: string;
}

interface Channel {
  id: string;
  label: string;
  platform: 'YouTube' | 'Instagram' | 'TikTok';
  handle: string;
  subscribers: string;
}

// ─────────────────────────── Mock data ───────────────────────────

const CHANNELS: Channel[] = [
  { id: 'yt-main', label: 'My Tech Channel', platform: 'YouTube', handle: '@mytechchannel', subscribers: '24,830' },
  { id: 'ig-main', label: 'TechWithMe', platform: 'Instagram', handle: '@techwithme', subscribers: '11,200' },
  { id: 'tt-main', label: 'QuickTech Tips', platform: 'TikTok', handle: '@quicktechtips', subscribers: '38,500' },
];

const VIDEOS: Video[] = [
  {
    id: 'v1',
    title: 'Top 5 AI Tools for Content Creators in 2026',
    duration: '18:42',
    views: '34.8K',
    likes: '2.1K',
    comments: '342',
    uploadDate: 'Aug 5, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#3730a3 100%)',
  },
  {
    id: 'v2',
    title: 'ChatGPT vs Claude: An Honest Side-by-Side Review',
    duration: '14:28',
    views: '28.3K',
    likes: '1.8K',
    comments: '219',
    uploadDate: 'Jul 28, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
  },
  {
    id: 'v3',
    title: 'The Creator Morning Routine That Grew My Channel 3×',
    duration: '9:15',
    views: '21.1K',
    likes: '1.4K',
    comments: '178',
    uploadDate: 'Jul 21, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)',
  },
  {
    id: 'v4',
    title: 'Tech Review: M4 MacBook Pro — Is It Worth It for Creators?',
    duration: '22:10',
    views: '18.2K',
    likes: '1.1K',
    comments: '143',
    uploadDate: 'Jul 14, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
  },
  {
    id: 'v5',
    title: 'YouTube SEO Guide 2026: Rank Every Video You Upload',
    duration: '16:55',
    views: '14.1K',
    likes: '987',
    comments: '96',
    uploadDate: 'Jul 7, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
  },
  {
    id: 'v6',
    title: "Beginner's Guide to AI-Assisted Content Creation",
    duration: '11:30',
    views: '11.4K',
    likes: '823',
    comments: '74',
    uploadDate: 'Jun 30, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)',
  },
  {
    id: 'v7',
    title: 'How I Script 30 Videos in One Weekend with AI',
    duration: '13:08',
    views: '9.7K',
    likes: '711',
    comments: '58',
    uploadDate: 'Jun 22, 2026',
    visibility: 'Unlisted',
    gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)',
  },
  {
    id: 'v8',
    title: 'Building a $10K/Month YouTube Business — Full Breakdown',
    duration: '27:44',
    views: '7.3K',
    likes: '612',
    comments: '91',
    uploadDate: 'Jun 15, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 50%,#2563eb 100%)',
  },
  {
    id: 'v9',
    title: 'Notion Setup for YouTube Creators (2026 Template)',
    duration: '8:52',
    views: '5.9K',
    likes: '491',
    comments: '43',
    uploadDate: 'Jun 8, 2026',
    visibility: 'Private',
    gradient: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
  },
  {
    id: 'v10',
    title: 'Monetize Faster: The Channel Audit That Changed Everything',
    duration: '19:20',
    views: '4.1K',
    likes: '378',
    comments: '29',
    uploadDate: 'Jun 1, 2026',
    visibility: 'Public',
    gradient: 'linear-gradient(135deg,#450a0a 0%,#7f1d1d 50%,#b91c1c 100%)',
  },
];

const PLAYLISTS: Playlist[] = [
  {
    id: 'pl1',
    title: 'AI & Machine Learning Series',
    videoCount: 12,
    totalViews: '184.3K',
    gradients: [
      'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
      'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#3730a3 100%)',
      'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
    ],
  },
  {
    id: 'pl2',
    title: 'Creator Productivity Hacks',
    videoCount: 8,
    totalViews: '97.6K',
    gradients: [
      'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)',
      'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
      'linear-gradient(135deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)',
    ],
  },
  {
    id: 'pl3',
    title: 'Tech Reviews & Unboxings',
    videoCount: 15,
    totalViews: '241.8K',
    gradients: [
      'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
      'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
      'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#3730a3 100%)',
    ],
  },
  {
    id: 'pl4',
    title: 'YouTube Growth Masterclass',
    videoCount: 10,
    totalViews: '158.4K',
    gradients: [
      'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)',
      'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)',
      'linear-gradient(135deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)',
    ],
  },
];

const DRAFTS: Draft[] = [
  {
    id: 'd1',
    title: 'How to Build a YouTube Automation System',
    status: 'Scripted',
    type: 'Script',
    lastEdited: '3 hours ago',
  },
  {
    id: 'd2',
    title: 'Top 10 Productivity Apps for Creators — 2026 Edition',
    status: 'Filmed',
    type: 'Video',
    lastEdited: '1 day ago',
  },
  {
    id: 'd3',
    title: 'Why Every Creator Needs AI in Their Workflow',
    status: 'Scripted',
    type: 'Script',
    lastEdited: '2 days ago',
  },
  {
    id: 'd4',
    title: 'Thumbnail Batch — Tech Review Series (6 designs)',
    status: 'Edited',
    type: 'Thumbnail',
    lastEdited: '3 days ago',
  },
  {
    id: 'd5',
    title: 'Beginner Investing with AI Tools — Full Guide',
    status: 'Scripted',
    type: 'Script',
    lastEdited: '5 days ago',
  },
];

const ASSETS: Asset[] = [
  { id: 'a1', name: 'channel-banner-v3.png', type: 'Image', meta: '2560×1440 · 1.2 MB', gradient: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#3730a3 100%)' },
  { id: 'a2', name: 'intro-music-upbeat.mp3', type: 'Audio', meta: 'Audio · 2:34 · 4.8 MB', gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)' },
  { id: 'a3', name: 'outro-animation-v2.mp4', type: 'Clip', meta: 'Video · 0:10 · 18.4 MB', gradient: 'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)' },
  { id: 'a4', name: 'logo-transparent.png', type: 'Image', meta: '1024×1024 · 340 KB', gradient: 'linear-gradient(135deg,#1c1917 0%,#292524 50%,#44403c 100%)' },
  { id: 'a5', name: 'lower-third-template.png', type: 'Image', meta: '1920×1080 · 890 KB', gradient: 'linear-gradient(135deg,#7c2d12 0%,#9a3412 50%,#c2410c 100%)' },
  { id: 'a6', name: 'background-loop-dark.mp4', type: 'Clip', meta: 'Video · 0:30 · 42.1 MB', gradient: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)' },
  { id: 'a7', name: 'ambient-cinematic.mp3', type: 'Audio', meta: 'Audio · 3:15 · 6.2 MB', gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)' },
  { id: 'a8', name: 'thumbnail-overlay-pack.png', type: 'Image', meta: '3000×2000 · 2.8 MB', gradient: 'linear-gradient(135deg,#312e81 0%,#4338ca 50%,#6366f1 100%)' },
];

// ─────────────────────────── Helper components ───────────────────────────

const SORT_OPTIONS = ['Newest', 'Oldest', 'Most Viewed', 'A–Z'];

type TabId = 'videos' | 'playlists' | 'drafts' | 'assets';

const TABS: { id: TabId; label: string; count?: number }[] = [
  { id: 'videos', label: 'Videos', count: 47 },
  { id: 'playlists', label: 'Playlists', count: 4 },
  { id: 'drafts', label: 'Drafts', count: 5 },
  { id: 'assets', label: 'Assets' },
];

function visibilityStyle(v: Visibility): { dot: string; label: string } {
  switch (v) {
    case 'Public':   return { dot: 'bg-emerald-500', label: 'text-emerald-700' };
    case 'Private':  return { dot: 'bg-gray-400',    label: 'text-gray-600'    };
    case 'Unlisted': return { dot: 'bg-amber-500',   label: 'text-amber-700'   };
  }
}

function draftStatusStyle(s: DraftStatus): { bg: string; text: string; border: string } {
  switch (s) {
    case 'Scripted': return { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-100' };
    case 'Filmed':   return { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100'  };
    case 'Edited':   return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' };
  }
}

function draftIconStyle(type: string): { bg: string; icon: React.ReactNode } {
  switch (type) {
    case 'Video':
      return {
        bg: 'bg-blue-50 border-blue-100',
        icon: <Film className="w-5 h-5 text-blue-500" />,
      };
    case 'Thumbnail':
      return {
        bg: 'bg-gray-50 border-gray-100',
        icon: <ImageIcon className="w-5 h-5 text-gray-600" />,
      };
    default:
      return {
        bg: 'bg-amber-50 border-amber-100',
        icon: <FileEdit className="w-5 h-5 text-amber-500" />,
      };
  }
}

function assetIcon(type: AssetType): React.ReactNode {
  switch (type) {
    case 'Audio': return <Music className="w-8 h-8 text-white/40" />;
    case 'Clip':  return <FileVideo className="w-8 h-8 text-white/40" />;
    default:      return <ImageIcon className="w-8 h-8 text-white/40" />;
  }
}

function assetBadge(type: AssetType): string {
  switch (type) {
    case 'Audio': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'Clip':  return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    default:      return 'bg-gray-50 text-gray-600 border-gray-100';
  }
}

const PLATFORM_COLORS: Record<string, string> = {
  YouTube:   'bg-red-50 text-red-600 border-red-100',
  Instagram: 'bg-pink-50 text-pink-600 border-pink-100',
  TikTok:    'bg-gray-900 text-white border-gray-700',
};

// ─────────────────────────── Page ───────────────────────────

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const [activeChannel, setActiveChannel] = useState<string>(CHANNELS[0].id);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const channel = CHANNELS.find((c) => c.id === activeChannel) ?? CHANNELS[0];

  const filteredVideos = VIDEOS.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#F4F3FB]">
      <div className="p-4 sm:p-6 pb-24 lg:pb-8">

        {/* ── Header row ── */}
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">My Library</h1>
            <p className="text-sm text-gray-500 mt-0.5">All your content, assets, and drafts in one place.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 h-9 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 w-40 transition"
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                {sort}
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-10 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[130px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setSort(opt); setSortOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition hover:bg-gray-50 ${
                        sort === opt ? 'font-semibold text-gray-700' : 'text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sync button */}
            <button className="flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-gray-600 rounded-xl hover:bg-gray-700 transition shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" />
              Sync with YouTube
            </button>
          </div>
        </div>

        {/* ── Channel selector chips ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
                    activeChannel === ch.id
                      ? 'bg-gray-600 text-white border-gray-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                      activeChannel === ch.id
                        ? 'bg-white/20 text-white border-white/30'
                        : PLATFORM_COLORS[ch.platform]
                    }`}
                  >
                    {ch.platform === 'YouTube' ? 'YT' : ch.platform === 'Instagram' ? 'IG' : 'TT'}
                  </span>
                  {ch.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {channel.subscribers} subscribers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow shadow-emerald-300" />
                Synced 2 min ago
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="border-b border-gray-200 mb-5 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 mr-5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'text-gray-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={`ml-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-600 rounded-t-sm" />
              )}
            </button>
          ))}
        </div>

        {/* ════════════ VIDEOS TAB ════════════ */}
        {activeTab === 'videos' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVideos.map((video) => {
                const vis = visibilityStyle(video.visibility);
                return (
                  <div
                    key={video.id}
                    className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video relative overflow-hidden" style={{ background: video.gradient }}>
                      <img src={`/api/thumb?seed=${video.id}&w=640&h=360`} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      {/* Duration badge */}
                      <span className="absolute bottom-2 right-2 z-10 bg-black/70 text-white text-[11px] font-medium px-2 py-0.5 rounded">
                        {video.duration}
                      </span>
                      {/* Hover play overlay */}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-3">
                      {/* Title */}
                      <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-1.5">
                        {video.title}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {video.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {video.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {video.comments}
                        </span>
                      </div>

                      {/* Date + visibility */}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-gray-400">{video.uploadDate}</span>
                        <span className={`flex items-center gap-1 text-[11px] font-medium ${vis.label}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${vis.dot}`} />
                          {video.visibility}
                        </span>
                      </div>

                      {/* Action row */}
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50">
                        <button className="text-[11px] font-600 px-2.5 py-1 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold">
                          Edit
                        </button>
                        <button className="text-[11px] font-semibold px-2.5 py-1 border border-gray-200 text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                          Repurpose
                        </button>
                        <div className="relative ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(openMenu === video.id ? null : video.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {openMenu === video.id && (
                            <div className="absolute right-0 bottom-8 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[130px]">
                              {['View on YouTube', 'Download', 'Duplicate', 'Delete'].map((action) => (
                                <button
                                  key={action}
                                  onClick={() => setOpenMenu(null)}
                                  className={`w-full text-left px-4 py-2 text-xs transition hover:bg-gray-50 ${
                                    action === 'Delete' ? 'text-red-500' : 'text-gray-700'
                                  }`}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            <div className="flex justify-center mt-6">
              <button className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-gray-600 border-2 border-gray-200 rounded-xl hover:border-gray-400 hover:text-gray-700 bg-white transition">
                <RefreshCw className="w-4 h-4" />
                Load more videos
              </button>
            </div>
          </>
        )}

        {/* ════════════ PLAYLISTS TAB ════════════ */}
        {activeTab === 'playlists' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {PLAYLISTS.map((pl) => (
              <div
                key={pl.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Stacked playlist cover */}
                <div className="relative w-20 h-14 flex-shrink-0">
                  {/* Layer 3 — back */}
                  <div
                    className="absolute inset-0 rounded-lg opacity-40"
                    style={{
                      background: pl.gradients[0],
                      transform: 'rotate(-4deg) translateX(-4px)',
                    }}
                  />
                  {/* Layer 2 — middle */}
                  <div
                    className="absolute inset-0 rounded-lg opacity-65"
                    style={{
                      background: pl.gradients[1],
                      transform: 'rotate(-2deg) translateX(-2px)',
                    }}
                  />
                  {/* Layer 1 — front */}
                  <div
                    className="absolute inset-0 rounded-lg flex items-end justify-end p-1"
                    style={{ background: pl.gradients[2] }}
                  >
                    <span className="bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                      {pl.videoCount}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{pl.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pl.videoCount} videos · {pl.totalViews} total views
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button className="text-[11px] font-semibold px-2.5 py-1 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      Manage
                    </button>
                    <button className="text-[11px] font-semibold px-2.5 py-1 border border-gray-200 text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center gap-1">
                      <PlusCircle className="w-3 h-3" />
                      Add Video
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add playlist card */}
            <button className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-4 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all cursor-pointer h-[102px]">
              <PlusCircle className="w-5 h-5" />
              <span className="text-xs font-medium">New playlist</span>
            </button>
          </div>
        )}

        {/* ════════════ DRAFTS TAB ════════════ */}
        {activeTab === 'drafts' && (
          <div className="flex flex-col gap-3 max-w-3xl">
            {DRAFTS.map((draft) => {
              const statusStyle = draftStatusStyle(draft.status);
              const iconStyle = draftIconStyle(draft.type);
              return (
                <div
                  key={draft.id}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-sm transition cursor-pointer group"
                >
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconStyle.bg}`}
                  >
                    {iconStyle.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{draft.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {draft.type} · Last edited {draft.lastEdited}
                    </p>
                  </div>

                  {/* Status + action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      {draft.status}
                    </span>
                    <button className="text-[11px] font-semibold px-3 py-1 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                      Continue
                    </button>
                    <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Empty new draft */}
            <button className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-4 flex items-center gap-3 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition cursor-pointer">
              <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center flex-shrink-0">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Start a new draft</span>
            </button>
          </div>
        )}

        {/* ════════════ ASSETS TAB ════════════ */}
        {activeTab === 'assets' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {ASSETS.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition cursor-pointer group"
                >
                  {/* Preview */}
                  <div
                    className="aspect-video relative flex items-center justify-center overflow-hidden"
                    style={{ background: asset.gradient }}
                  >
                    {asset.type === 'Audio' ? (
                      <>
                        {/* Waveform visual */}
                        <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-6 opacity-40">
                          {Array.from({ length: 28 }, (_, i) => (
                            <div key={i} className="flex-1 rounded-full bg-white"
                              style={{ height: `${20 + Math.sin(i * 1.3) * 14 + Math.cos(i * 0.7) * 10}%` }} />
                          ))}
                        </div>
                        {/* Inline audio player */}
                        <audio
                          controls
                          src={`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(parseInt(asset.id.replace(/\D/g, '')) % 5) + 1}.mp3`}
                          className="absolute bottom-0 left-0 right-0 w-full"
                          style={{ height: '32px' }}
                          preload="none"
                        />
                      </>
                    ) : (
                      <img src={`/api/thumb?seed=${asset.id}&w=640&h=360${asset.type === 'Image' ? '&kind=image' : ''}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {asset.type !== 'Audio' && assetIcon(asset.type)}
                    {/* Type badge */}
                    <span
                      className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${assetBadge(asset.type)}`}
                    >
                      {asset.type}
                    </span>
                    {/* Hover overlay — only for non-audio */}
                    {asset.type !== 'Audio' && (
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ListVideo className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-gray-800 truncate">{asset.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{asset.meta}</p>
                  </div>
                </div>
              ))}

              {/* Upload new asset */}
              <button className="bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition cursor-pointer aspect-video">
                <PlusCircle className="w-5 h-5" />
                <span className="text-xs font-medium">Upload asset</span>
              </button>
            </div>
          </>
        )}

      </div>

      {/* Click-away handler for dropdowns */}
      {(sortOpen || openMenu !== null) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setSortOpen(false); setOpenMenu(null); }}
        />
      )}
    </div>
  );
}
