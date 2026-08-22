'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Bell, Menu, X, ChevronRight, Play, Clock, History,
  ListVideo, Plus, TrendingUp, Zap, Film, ImageIcon,
  SlidersHorizontal, MoreVertical, Eye, Bookmark, ChevronDown,
  ChevronLeft, Grid3X3, LayoutList, Compass, Heart, Share2,
  Flame, Star,
} from 'lucide-react';
import { LogoMark } from '@/components/logo-mark';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoCard {
  id: string; title: string; creator: string; views: string;
  time: string; duration: string; category: string; gi: number;
}
interface ShortCard {
  id: string; title: string; creator: string; views: string; duration: string; gi: number;
}
interface PlaylistItem {
  id: string; name: string; count: number; color: string; emoji: string;
}
interface HistoryCard {
  id: string; title: string; creator: string; progress: number;
  duration: string; time: string; gi: number;
}

// ── Placeholder data ──────────────────────────────────────────────────────────

const G = [
  'linear-gradient(135deg,#1a0845 0%,#4c1d95 100%)',
  'linear-gradient(135deg,#0c1445 0%,#1e3a8a 100%)',
  'linear-gradient(135deg,#0a2a1a 0%,#065f46 100%)',
  'linear-gradient(135deg,#2a0a1a 0%,#9d174d 100%)',
  'linear-gradient(135deg,#1a1a0a 0%,#78350f 100%)',
  'linear-gradient(135deg,#0a1a2a 0%,#075985 100%)',
  'linear-gradient(135deg,#1a0a1a 0%,#701a75 100%)',
  'linear-gradient(135deg,#0a0a1a 0%,#3730a3 100%)',
];

const VIDEOS: VideoCard[] = [
  { id:'v1',  title:'How to Grow to 100K Followers',         creator:'@CreatorPro',    views:'2.4M',  time:'3 days ago',  duration:'14:32', category:'growth',   gi:0 },
  { id:'v2',  title:'Top 10 AI Tools for Creators 2025',    creator:'@AIWeekly',      views:'1.9M',  time:'1 week ago',  duration:'8:18',  category:'ai',       gi:1 },
  { id:'v3',  title:'Social Media Algorithm Breakdown',      creator:'@GrowthHacks',   views:'876K',  time:'5 days ago',  duration:'11:05', category:'growth',   gi:2 },
  { id:'v4',  title:'From 0 to $10K/month as a Creator',    creator:'@Monetize8',     views:'654K',  time:'2 weeks ago', duration:'19:44', category:'finance',  gi:3 },
  { id:'v5',  title:'Social Media SEO Secrets 2025',        creator:'@SEOKing',       views:'432K',  time:'4 days ago',  duration:'7:22',  category:'growth',   gi:4 },
  { id:'v6',  title:'AI Voice Generation — Full Guide',     creator:'@VoiceTech',     views:'328K',  time:'6 days ago',  duration:'13:11', category:'ai',       gi:5 },
  { id:'v7',  title:'Monetisation Masterclass 2025',        creator:'@MoneyTube',     views:'258K',  time:'1 week ago',  duration:'16:55', category:'finance',  gi:6 },
  { id:'v8',  title:'Perfect Thumbnail Formula',            creator:'@ClickMaster',   views:'189K',  time:'2 weeks ago', duration:'9:30',  category:'creative', gi:7 },
  { id:'v9',  title:'YouTube Analytics Deep Dive',          creator:'@DataCreator',   views:'156K',  time:'3 days ago',  duration:'18:22', category:'growth',   gi:0 },
  { id:'v10', title:'Build Your Brand with AI in 30 Days',  creator:'@BrandAI',       views:'134K',  time:'1 week ago',  duration:'22:15', category:'ai',       gi:1 },
  { id:'v11', title:'Gaming Channel Growth Blueprint',      creator:'@GamingGuru',    views:'112K',  time:'2 weeks ago', duration:'15:40', category:'gaming',   gi:2 },
  { id:'v12', title:'Creative Direction for YouTube',       creator:'@CreativeHQ',    views:'98K',   time:'4 days ago',  duration:'11:28', category:'creative', gi:3 },
];

const SHORTS: ShortCard[] = [
  { id:'s1', title:'3 AI Tools That Changed My Life',        creator:'@TechDaily',    views:'4.2M', duration:'0:58', gi:4 },
  { id:'s2', title:'Content Hack That Works Every Time',     creator:'@GrowthPro',    views:'3.1M', duration:'0:45', gi:5 },
  { id:'s3', title:'How I Made $1000 This Week',             creator:'@MoneyMind',    views:'2.8M', duration:'0:52', gi:6 },
  { id:'s4', title:'YouTube Formula Nobody Talks About',     creator:'@TubeSecrets',  views:'2.1M', duration:'0:49', gi:7 },
  { id:'s5', title:'My Viral Thumbnail Secret',              creator:'@ClickRate',    views:'1.9M', duration:'0:44', gi:0 },
  { id:'s6', title:'Stop Making These Mistakes',             creator:'@CreatorCoach', views:'1.7M', duration:'0:55', gi:1 },
];

const PLAYLISTS: PlaylistItem[] = [
  { id:'p1', name:'AI Tools Collection',  count:12, color:'#7C3AED', emoji:'🤖' },
  { id:'p2', name:'Growth Strategies',    count:8,  color:'#0891B2', emoji:'📈' },
  { id:'p3', name:'Monetization Tips',    count:15, color:'#059669', emoji:'💰' },
  { id:'p4', name:'Creative Inspo',       count:6,  color:'#DC2626', emoji:'🎨' },
];

const HISTORY: HistoryCard[] = [
  { id:'h1', title:'How to Script Videos with AI',     creator:'@ScriptMaster', progress:65, duration:'12:30', time:'2h ago',   gi:2 },
  { id:'h2', title:'Complete Guide to YouTube SEO',    creator:'@SEOPro',       progress:30, duration:'18:45', time:'Yesterday', gi:3 },
  { id:'h3', title:'AI Thumbnail Generation Tutorial', creator:'@ThumbnailAI',  progress:90, duration:'9:15',  time:'2 days ago',gi:4 },
  { id:'h4', title:'Viral Hooks That Get Clicks',      creator:'@HookMaster',   progress:45, duration:'14:20', time:'3 days ago',gi:5 },
];

// ── Filter config ─────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id:'all',    label:'All Videos', Icon:Grid3X3 },
  { id:'shorts', label:'Shorts',     Icon:Zap },
  { id:'reels',  label:'Reels',      Icon:Film },
  { id:'images', label:'Images',     Icon:ImageIcon },
];

const CATEGORIES = [
  { id:'all',      label:'All',       emoji:'✨' },
  { id:'ai',       label:'AI & Tech', emoji:'🤖' },
  { id:'growth',   label:'Growth',    emoji:'📈' },
  { id:'gaming',   label:'Gaming',    emoji:'🎮' },
  { id:'finance',  label:'Finance',   emoji:'💰' },
  { id:'fitness',  label:'Fitness',   emoji:'💪' },
  { id:'creative', label:'Creative',  emoji:'🎨' },
];

const SORT_OPTIONS = ['Trending', 'Latest', 'Most Viewed', 'Top Rated'];

// ── Sub-components ────────────────────────────────────────────────────────────

function VideoThumb({ gi, duration, size = 'md' }: { gi: number; duration: string; size?: 'md' | 'sm' }) {
  const h = size === 'sm' ? 'h-20' : 'h-40';
  return (
    <div className={`relative w-full ${h} rounded-xl overflow-hidden group-hover:brightness-90 transition-all`}
      style={{ background: G[gi % G.length] }}>
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <Play className="w-8 h-8 text-white fill-white" />
      </div>
      <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
        {duration}
      </span>
    </div>
  );
}

function ShortThumb({ gi, duration }: { gi: number; duration: string }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden group-hover:brightness-90 transition-all"
      style={{ background: G[gi % G.length], aspectRatio: '9/16' }}>
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <Play className="w-6 h-6 text-white fill-white" />
      </div>
      <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
        {duration}
      </span>
    </div>
  );
}

function SectionHeader({ title, icon: Icon, onViewAll }: { title: string; icon?: React.ComponentType<{className?: string}>; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-purple-600" />}
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
      </div>
      {onViewAll && (
        <button onClick={onViewAll} className="text-[12px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors">
          View All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName]     = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contentType, setContentType] = useState('all');
  const [category, setCategory]       = useState('all');
  const [sort, setSort]               = useState('Trending');
  const [sortOpen, setSortOpen]       = useState(false);
  const [search, setSearch]           = useState('');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName]       = useState('');
  const [localPlaylists, setLocalPlaylists] = useState<PlaylistItem[]>(PLAYLISTS);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [viewMode, setViewMode]       = useState<'grid'|'list'>('grid');
  const [page, setPage]               = useState(1);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('cf_token');
      if (token) {
        setIsLoggedIn(true);
        const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
        setUserName(payload.name ?? payload.email?.split('@')[0] ?? 'You');
      }
    } catch { /* guest */ }
  }, []);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter videos
  const filteredVideos = VIDEOS.filter(v => {
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.creator.toLowerCase().includes(search.toLowerCase());
    const matchCat    = category === 'all' || v.category === category;
    return matchSearch && matchCat;
  }).slice(0, page * 8);

  const visibleHistory = showAllHistory ? HISTORY : HISTORY.slice(0, 3);

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const colors = ['#7C3AED','#0891B2','#059669','#DC2626','#D97706'];
    const emojis = ['📋','🎯','⭐','🔖','📂'];
    const idx = localPlaylists.length % colors.length;
    setLocalPlaylists(prev => [
      ...prev,
      { id: `new-${Date.now()}`, name: newPlaylistName.trim(), count: 0, color: colors[idx], emoji: emojis[idx] },
    ]);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
  };

  // Determine main heading
  const activeType = CONTENT_TYPES.find(t => t.id === contentType);
  const activeCat  = CATEGORIES.find(c => c.id === category);
  const heading    = category !== 'all'
    ? `${activeCat?.emoji} ${activeCat?.label} ${activeType?.label ?? 'Content'}`
    : `All Public ${activeType?.label ?? 'Videos'}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Sticky header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Logo */}
          <Link href="/explore" className="flex items-center gap-2 shrink-0 mr-1">
            <LogoMark className="w-8 h-8" variant="dark" />
            <span className="font-bold text-[15px] hidden sm:block tracking-tight">
              <span className="text-gray-900">Sozial</span><span style={{color:'#7C3AED'}}>Z</span><span className="text-gray-900">ynk</span>
            </span>
          </Link>

          {/* Hamburger (mobile) */}
          <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            onClick={() => setSidebarOpen(v => !v)}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search videos, creators, topics…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-full border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {isLoggedIn ? (
              <>
                <button className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                  <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </button>
                <Link href="/home" className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{background:'linear-gradient(135deg,#7C3AED,#0891B2)'}}>
                    {userName.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700 hidden sm:block">{userName}</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="px-3.5 py-1.5 text-[13px] font-semibold text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
                  Sign In
                </Link>
                <Link href="/welcome" className="px-3.5 py-1.5 text-[13px] font-bold text-white rounded-full transition-all hover:opacity-90"
                  style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                  🚀 Start Creating
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ── Sidebar backdrop (mobile) */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Left sidebar ──────────────────────────────────────────────────────── */}
        <aside className={`
          fixed lg:sticky top-14 z-30 lg:z-auto h-[calc(100vh-56px)] w-56 bg-white border-r border-gray-200
          overflow-y-auto flex-shrink-0 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4 space-y-6">

            {/* Close on mobile */}
            <div className="flex items-center justify-between lg:hidden">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Browse</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content type */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Content Type</p>
              <ul className="space-y-0.5">
                {CONTENT_TYPES.map(({ id, label, Icon }) => (
                  <li key={id}>
                    <button
                      onClick={() => { setContentType(id); setPage(1); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors text-left ${
                        contentType === id
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Category</p>
              <ul className="space-y-0.5">
                {CATEGORIES.map(({ id, label, emoji }) => (
                  <li key={id}>
                    <button
                      onClick={() => { setCategory(id); setPage(1); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors text-left ${
                        category === id
                          ? 'bg-purple-50 text-purple-700 font-bold'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span>{emoji}</span>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* My Library (logged-in only) */}
            {isLoggedIn && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">My Library</p>
                <ul className="space-y-0.5">
                  {[
                    { label:'Watch History',  icon:History,   action:() => { document.getElementById('history-section')?.scrollIntoView({behavior:'smooth'}); setSidebarOpen(false); } },
                    { label:'My Playlists',   icon:ListVideo, action:() => { document.getElementById('playlists-section')?.scrollIntoView({behavior:'smooth'}); setSidebarOpen(false); } },
                    { label:'Continue Watching', icon:Play,   action:() => { document.getElementById('continue-section')?.scrollIntoView({behavior:'smooth'}); setSidebarOpen(false); } },
                  ].map(({ label, icon: Icon, action }) => (
                    <li key={label}>
                      <button onClick={action}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left font-medium">
                        <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sign in CTA for guests */}
            {!isLoggedIn && (
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <p className="text-[12px] font-bold text-gray-800 mb-1">Create your space</p>
                <p className="text-[11px] text-gray-500 mb-3">Save playlists, track history & publish your own content.</p>
                <Link href="/welcome" className="block w-full text-center text-[12px] font-bold text-white py-2 rounded-lg transition-all hover:opacity-90"
                  style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                  Get Started Free
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-8">

            {/* ── Continue Watching (logged-in) ───────────────────────────────── */}
            {isLoggedIn && (
              <section id="continue-section">
                <SectionHeader title="Continue Watching" icon={Play}
                  onViewAll={() => setShowAllHistory(true)} />
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {HISTORY.map(item => (
                    <div key={item.id}
                      className="group flex-none w-52 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer">
                      <div className="relative h-28" style={{background: G[item.gi % G.length]}}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-25">
                          <Play className="w-7 h-7 text-white fill-white" />
                        </div>
                        <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          {item.duration}
                        </span>
                        {/* Progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                          <div className="h-full bg-purple-500" style={{width: `${item.progress}%`}} />
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[12px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{item.title}</p>
                        <p className="text-[10px] text-gray-400">{item.creator} · {item.time}</p>
                        <p className="text-[10px] text-purple-600 font-semibold mt-1">{item.progress}% watched</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── My Playlists (logged-in) ────────────────────────────────────── */}
            {isLoggedIn && (
              <section id="playlists-section">
                <SectionHeader title="My Playlists" icon={ListVideo}
                  onViewAll={() => setShowAllHistory(true)} />

                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {/* Create new playlist */}
                  <button
                    onClick={() => setShowCreatePlaylist(true)}
                    className="flex-none w-40 h-28 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-purple-600 transition-all group">
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[12px] font-semibold">New Playlist</span>
                  </button>

                  {localPlaylists.map(pl => (
                    <div key={pl.id}
                      className="group flex-none w-40 rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-md transition-all cursor-pointer">
                      <div className="h-20 flex items-center justify-center text-3xl"
                        style={{background: `${pl.color}18`, borderBottom: `3px solid ${pl.color}30`}}>
                        {pl.emoji}
                      </div>
                      <div className="p-3">
                        <p className="text-[12px] font-bold text-gray-900 truncate">{pl.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{pl.count} videos</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create playlist modal */}
                {showCreatePlaylist && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreatePlaylist(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-gray-900 text-base">Create New Playlist</h3>
                        <button onClick={() => setShowCreatePlaylist(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Playlist name…"
                        value={newPlaylistName}
                        onChange={e => setNewPlaylistName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                      />
                      <div className="flex gap-3 mt-4">
                        <button onClick={() => setShowCreatePlaylist(false)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                          Cancel
                        </button>
                        <button onClick={handleCreatePlaylist}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                          style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                          Create
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Watch History (logged-in) ────────────────────────────────────── */}
            {isLoggedIn && (
              <section id="history-section">
                <SectionHeader title="Watch History" icon={History}
                  onViewAll={() => setShowAllHistory(v => !v)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visibleHistory.map(item => (
                    <div key={item.id}
                      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer flex gap-3 p-2.5">
                      <div className="relative w-24 h-16 rounded-xl flex-none overflow-hidden" style={{background: G[item.gi % G.length]}}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-25">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                        <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                          {item.duration}
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                          <div className="h-full bg-purple-500" style={{width:`${item.progress}%`}} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[12px] font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.creator}</p>
                        <p className="text-[10px] text-gray-400">{item.time} · {item.progress}% watched</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!showAllHistory && HISTORY.length > 3 && (
                  <button onClick={() => setShowAllHistory(true)}
                    className="mt-3 text-[13px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors">
                    Show {HISTORY.length - 3} more <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </section>
            )}

            {/* ── Public Content: filter bar + grid ───────────────────────────── */}
            <section>
              {/* Filter / sort bar */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[15px] font-bold text-gray-900">{heading}</h2>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">Public only</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors ${viewMode==='grid'?'bg-white shadow-sm text-purple-600':'text-gray-400'}`}>
                      <Grid3X3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors ${viewMode==='list'?'bg-white shadow-sm text-purple-600':'text-gray-400'}`}>
                      <LayoutList className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Sort dropdown */}
                  <div ref={sortRef} className="relative">
                    <button onClick={() => setSortOpen(v => !v)}
                      className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-purple-300 transition-colors">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                      Sort: {sort}
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${sortOpen?'rotate-180':''}`} />
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 min-w-[160px] py-1 overflow-hidden">
                        {SORT_OPTIONS.map(opt => (
                          <button key={opt} onClick={() => { setSort(opt); setSortOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-purple-50 transition-colors ${sort===opt?'text-purple-700 bg-purple-50 font-bold':'text-gray-700'}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid view */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredVideos.length > 0 ? filteredVideos.map(v => (
                    <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                      <VideoThumb gi={v.gi} duration={v.duration} />
                      <div className="p-3">
                        <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1.5">{v.title}</p>
                        <p className="text-[11px] text-gray-500 font-medium">{v.creator}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{v.views} views · {v.time}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                      <Search className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm font-medium">No videos found</p>
                      <p className="text-xs mt-1">Try a different filter or search term</p>
                    </div>
                  )}
                </div>
              )}

              {/* List view */}
              {viewMode === 'list' && (
                <div className="space-y-3">
                  {filteredVideos.map(v => (
                    <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer flex gap-4 p-3">
                      <div className="flex-none w-36">
                        <VideoThumb gi={v.gi} duration={v.duration} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[14px] font-bold text-gray-900 line-clamp-2">{v.title}</p>
                        <p className="text-[12px] text-gray-500 mt-1">{v.creator}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{v.views} views · {v.time}</p>
                      </div>
                      <button className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-400 self-start transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Load more */}
              {filteredVideos.length >= page * 8 && filteredVideos.length < VIDEOS.length && (
                <div className="flex justify-center mt-8">
                  <button onClick={() => setPage(p => p + 1)}
                    className="px-8 py-3 rounded-xl text-[14px] font-bold border-2 border-gray-200 text-gray-700 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-all">
                    Load more →
                  </button>
                </div>
              )}
            </section>

            {/* ── Popular Shorts ───────────────────────────────────────────────── */}
            {contentType === 'all' || contentType === 'shorts' ? (
              <section>
                <SectionHeader title="Popular Shorts" icon={Zap} onViewAll={() => setContentType('shorts')} />
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {SHORTS.map(s => (
                    <div key={s.id} className="group cursor-pointer">
                      <ShortThumb gi={s.gi} duration={s.duration} />
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{s.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.creator}</p>
                        <p className="text-[10px] text-gray-400">{s.views} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── Creator CTA ─────────────────────────────────────────────────── */}
            {!isLoggedIn && (
              <section className="rounded-2xl p-7 flex items-center gap-5"
                style={{background:'linear-gradient(135deg,rgba(124,58,237,0.10),rgba(6,182,212,0.06))',border:'1px solid rgba(124,58,237,0.2)'}}>
                <div className="text-4xl">🚀</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-gray-900 mb-1">Ready to publish YOUR content here?</p>
                  <p className="text-[12px] text-gray-500">Join thousands of creators using SozialZynk's AI to script, produce and publish videos automatically.</p>
                </div>
                <Link href="/welcome"
                  className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 hover:scale-105"
                  style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                  Start Creating Free →
                </Link>
              </section>
            )}

            {/* Bottom padding */}
            <div className="h-6" />
          </div>
        </main>
      </div>

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      `}</style>
    </div>
  );
}
