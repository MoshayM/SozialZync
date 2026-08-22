'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Bell, Menu, X, ChevronRight, Play, History, ListVideo,
  Plus, Zap, Film, ImageIcon, SlidersHorizontal, ChevronDown,
  Grid3X3, LayoutList, MoreVertical,
} from 'lucide-react';
import { LogoMark } from '@/components/logo-mark';

// ── Gradients ─────────────────────────────────────────────────────────────────

const G = [
  'linear-gradient(135deg,#1a0845,#4c1d95)',
  'linear-gradient(135deg,#0c1445,#1e3a8a)',
  'linear-gradient(135deg,#0a2a1a,#065f46)',
  'linear-gradient(135deg,#2a0a1a,#9d174d)',
  'linear-gradient(135deg,#1a1a0a,#78350f)',
  'linear-gradient(135deg,#0a1a2a,#075985)',
  'linear-gradient(135deg,#1a0a1a,#701a75)',
  'linear-gradient(135deg,#0a0a1a,#3730a3)',
];

// ── Data ──────────────────────────────────────────────────────────────────────

const VIDEOS = [
  { id:'v1',  title:'How to Grow to 100K Followers',        creator:'@CreatorPro',   views:'2.4M', time:'3 days ago',  duration:'14:32', gi:0 },
  { id:'v2',  title:'Top 10 AI Tools for Creators 2025',   creator:'@AIWeekly',     views:'1.9M', time:'1 week ago',  duration:'8:18',  gi:1 },
  { id:'v3',  title:'Social Media Algorithm Breakdown',     creator:'@GrowthHacks',  views:'876K', time:'5 days ago',  duration:'11:05', gi:2 },
  { id:'v4',  title:'From 0 to $10K/month as a Creator',   creator:'@Monetize8',    views:'654K', time:'2 weeks ago', duration:'19:44', gi:3 },
  { id:'v5',  title:'Social Media SEO Secrets 2025',       creator:'@SEOKing',      views:'432K', time:'4 days ago',  duration:'7:22',  gi:4 },
  { id:'v6',  title:'AI Voice Generation — Full Guide',    creator:'@VoiceTech',    views:'328K', time:'6 days ago',  duration:'13:11', gi:5 },
  { id:'v7',  title:'Monetisation Masterclass 2025',       creator:'@MoneyTube',    views:'258K', time:'1 week ago',  duration:'16:55', gi:6 },
  { id:'v8',  title:'Perfect Thumbnail Formula',           creator:'@ClickMaster',  views:'189K', time:'2 weeks ago', duration:'9:30',  gi:7 },
  { id:'v9',  title:'YouTube Analytics Deep Dive',         creator:'@DataCreator',  views:'156K', time:'3 days ago',  duration:'18:22', gi:0 },
  { id:'v10', title:'Build Your Brand with AI in 30 Days', creator:'@BrandAI',      views:'134K', time:'1 week ago',  duration:'22:15', gi:1 },
  { id:'v11', title:'Gaming Channel Growth Blueprint',     creator:'@GamingGuru',   views:'112K', time:'2 weeks ago', duration:'15:40', gi:2 },
  { id:'v12', title:'Creative Direction for YouTube',      creator:'@CreativeHQ',   views:'98K',  time:'4 days ago',  duration:'11:28', gi:3 },
];

const SHORTS = [
  { id:'s1', title:'3 AI Tools That Changed My Life',       creator:'@TechDaily',    views:'4.2M', duration:'0:58', gi:4 },
  { id:'s2', title:'Content Hack That Works Every Time',    creator:'@GrowthPro',    views:'3.1M', duration:'0:45', gi:5 },
  { id:'s3', title:'How I Made $1000 This Week',            creator:'@MoneyMind',    views:'2.8M', duration:'0:52', gi:6 },
  { id:'s4', title:'YouTube Formula Nobody Talks About',    creator:'@TubeSecrets',  views:'2.1M', duration:'0:49', gi:7 },
  { id:'s5', title:'My Viral Thumbnail Secret',             creator:'@ClickRate',    views:'1.9M', duration:'0:44', gi:0 },
  { id:'s6', title:'Stop Making These Mistakes',            creator:'@CreatorCoach', views:'1.7M', duration:'0:55', gi:1 },
  { id:'s7', title:'ChatGPT Prompt That Writes Scripts',    creator:'@PromptKing',   views:'1.5M', duration:'0:48', gi:2 },
  { id:'s8', title:'Editing Trick Gets 10× Watch Time',     creator:'@EditPro',      views:'1.3M', duration:'0:38', gi:3 },
  { id:'s9', title:'AI Thumbnail in 60 Seconds',            creator:'@ThumbAI',      views:'1.1M', duration:'0:52', gi:4 },
  { id:'s10',title:'Script Any Video With One Prompt',      creator:'@ScriptBot',    views:'980K', duration:'0:41', gi:5 },
  { id:'s11',title:'This Hook Formula Went Viral',          creator:'@HookLab',      views:'870K', duration:'0:35', gi:6 },
  { id:'s12',title:'Fix Your CTR in Under 1 Minute',        creator:'@CTRGenius',    views:'760K', duration:'0:44', gi:7 },
];

const REELS = [
  { id:'r1', title:'Brand Storytelling in 30 Seconds',     creator:'@BrandReel',    views:'3.8M', duration:'0:28', gi:3 },
  { id:'r2', title:'Cinematic Travel Reel — AI Edit',      creator:'@WanderAI',     views:'2.9M', duration:'0:22', gi:4 },
  { id:'r3', title:'Day in the Life of an AI Creator',     creator:'@CreatorDay',   views:'2.1M', duration:'0:35', gi:5 },
  { id:'r4', title:'AI Voice Cover — Sounds Real',         creator:'@VoiceClone',   views:'1.8M', duration:'0:30', gi:6 },
  { id:'r5', title:'Behind the Scenes: Video Production',  creator:'@BehindCam',    views:'1.4M', duration:'0:42', gi:7 },
  { id:'r6', title:'Trending Sound + AI Clips = Viral',    creator:'@ViralMix',     views:'1.2M', duration:'0:25', gi:0 },
  { id:'r7', title:'5-Second Hook Formula',                creator:'@HookReel',     views:'1.0M', duration:'0:18', gi:1 },
  { id:'r8', title:'Colour Grade That Hits Every Time',    creator:'@GradeAI',      views:'870K', duration:'0:32', gi:2 },
  { id:'r9', title:'Comment Reply Strategy That Works',    creator:'@EngagePro',    views:'760K', duration:'0:27', gi:3 },
  { id:'r10',title:'AI Subtitles in Under 60s',             creator:'@SubsBot',      views:'650K', duration:'0:48', gi:4 },
  { id:'r11',title:'Transition Trick Everyone is Copying', creator:'@TransitionKing',views:'580K',duration:'0:21', gi:5 },
  { id:'r12',title:'Lighting Setup for Phone Creators',    creator:'@LightUp',      views:'490K', duration:'0:38', gi:6 },
];

const IMAGES = [
  { id:'i1', title:'AI-Generated YouTube Thumbnail Pack',  creator:'@ThumbPro',     views:'654K', gi:0 },
  { id:'i2', title:'Channel Banner Template 2025',         creator:'@BannerAI',     views:'421K', gi:1 },
  { id:'i3', title:'Creator Studio Desk Setup Inspo',      creator:'@SetupGoals',   views:'389K', gi:2 },
  { id:'i4', title:'AI Portrait — Creator Avatar Style',   creator:'@AvatarAI',     views:'312K', gi:3 },
  { id:'i5', title:'Infographic: YouTube Algorithm Map',   creator:'@AlgoViz',      views:'298K', gi:4 },
  { id:'i6', title:'Brand Color Palette for Creators',     creator:'@BrandKit',     views:'245K', gi:5 },
  { id:'i7', title:'Social Media Size Cheat Sheet 2025',   creator:'@SizeGuide',    views:'198K', gi:6 },
  { id:'i8', title:'AI Character Design — Tutorial',       creator:'@CharacterAI',  views:'167K', gi:7 },
];

const PLAYLISTS = [
  { id:'p1', name:'AI Tools Collection',  count:12, color:'#7C3AED', emoji:'🤖' },
  { id:'p2', name:'Growth Strategies',    count:8,  color:'#0891B2', emoji:'📈' },
  { id:'p3', name:'Monetization Tips',    count:15, color:'#059669', emoji:'💰' },
  { id:'p4', name:'Creative Inspo',       count:6,  color:'#DC2626', emoji:'🎨' },
];

const HISTORY = [
  { id:'h1', title:'How to Script Videos with AI',     creator:'@ScriptMaster', progress:65, duration:'12:30', time:'2h ago',    gi:2 },
  { id:'h2', title:'Complete Guide to YouTube SEO',    creator:'@SEOPro',       progress:30, duration:'18:45', time:'Yesterday', gi:3 },
  { id:'h3', title:'AI Thumbnail Generation Tutorial', creator:'@ThumbnailAI',  progress:90, duration:'9:15',  time:'2 days ago',gi:4 },
  { id:'h4', title:'Viral Hooks That Get Clicks',      creator:'@HookMaster',   progress:45, duration:'14:20', time:'3 days ago',gi:5 },
];

// ── Sidebar content types ─────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id:'all',    label:'All Videos', Icon:Grid3X3 },
  { id:'videos', label:'Videos',     Icon:Play    },
  { id:'shorts', label:'Shorts',     Icon:Zap     },
  { id:'reels',  label:'Reels',      Icon:Film    },
  { id:'images', label:'Images',     Icon:ImageIcon},
];

const SORT_OPTIONS = ['Trending', 'Latest', 'Most Viewed', 'Top Rated'];

// ── Thumbnail helpers ─────────────────────────────────────────────────────────

function LandscapeThumb({ gi, duration, size = 'md' }: { gi: number; duration: string; size?: 'md'|'sm' }) {
  return (
    <div className={`relative w-full ${size === 'sm' ? 'h-20' : 'h-40'} rounded-xl overflow-hidden`}
      style={{ background: G[gi % 8] }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
        </div>
      </div>
      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide">
        {duration}
      </span>
    </div>
  );
}

function PortraitThumb({ gi, duration }: { gi: number; duration: string }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ background: G[gi % 8], aspectRatio: '9/16' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
        </div>
      </div>
      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
        {duration}
      </span>
    </div>
  );
}

function ImageThumb({ gi }: { gi: number }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden group-hover:brightness-90 transition-all"
      style={{ background: G[gi % 8], aspectRatio: '4/3' }}>
      <ImageIcon className="absolute inset-0 m-auto w-8 h-8 text-white/20" />
    </div>
  );
}

// ── Search helper ─────────────────────────────────────────────────────────────

function matchSearch(title: string, creator: string, q: string) {
  if (!q.trim()) return true;
  const lq = q.toLowerCase();
  return title.toLowerCase().includes(lq) || creator.toLowerCase().includes(lq);
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return <h2 className="text-[15px] font-bold text-gray-900 mb-4">{label}</h2>;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 select-none">
      <Search className="w-10 h-10 mb-3 opacity-25" />
      <p className="text-sm font-semibold text-gray-500">
        {query ? `No results for "${query}"` : 'Nothing here yet'}
      </p>
      <p className="text-xs mt-1 text-gray-400">Try a different search term</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [isLoggedIn, setIsLoggedIn]           = useState(false);
  const [userName, setUserName]               = useState('');
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [contentType, setContentType]         = useState('all');
  const [sort, setSort]                       = useState('Trending');
  const [sortOpen, setSortOpen]               = useState(false);
  const [search, setSearch]                   = useState('');
  const [viewMode, setViewMode]               = useState<'grid'|'list'>('grid');
  const [showAllHistory, setShowAllHistory]   = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlists, setPlaylists]             = useState(PLAYLISTS);
  const [fadeKey, setFadeKey]                 = useState(0);
  const sortRef    = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // Auth detection
  useEffect(() => {
    try {
      const token = localStorage.getItem('cf_token');
      if (token) {
        setIsLoggedIn(true);
        const payload = JSON.parse(atob(token.split('.')[1] ?? '{}'));
        setUserName(payload.name ?? payload.email?.split('@')[0] ?? 'You');
      }
    } catch { /* guest */ }
  }, []);

  // Close sort dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Fade animation when switching content type
  const switchType = useCallback((id: string) => {
    setContentType(id);
    setSearch('');
    setFadeKey(k => k + 1);
    setSidebarOpen(false);
  }, []);

  // Keyboard shortcut: / focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    setFadeKey(k => k + 1);
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const colors  = ['#7C3AED','#0891B2','#059669','#DC2626','#D97706','#0891B2'];
    const emojis  = ['📋','🎯','⭐','🔖','📂','💡'];
    const idx = playlists.length % colors.length;
    setPlaylists(p => [...p, { id:`pl-${Date.now()}`, name:newPlaylistName.trim(), count:0, color:colors[idx], emoji:emojis[idx] }]);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
  };

  // Derived filtered lists
  const q = search.trim();
  const filteredVideos = VIDEOS.filter(v => matchSearch(v.title, v.creator, q));
  const filteredShorts = SHORTS.filter(s => matchSearch(s.title, s.creator, q));
  const filteredReels  = REELS.filter(r  => matchSearch(r.title, r.creator, q));
  const filteredImages = IMAGES.filter(i => matchSearch(i.title, i.creator, q));

  const activeLabel = CONTENT_TYPES.find(t => t.id === contentType)?.label ?? 'All Videos';

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col">

      {/* ── Sticky header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm h-14 flex items-center px-4 gap-3">
        {/* Logo */}
        <Link href="/explore" className="flex items-center gap-2 shrink-0">
          <LogoMark className="w-8 h-8" variant="dark" />
          <span className="font-bold text-[15px] hidden sm:block tracking-tight select-none">
            <span className="text-gray-900">Sozial</span><span style={{color:'#7C3AED'}}>Z</span><span className="text-gray-900">ynk</span>
          </span>
        </Link>

        {/* Hamburger (mobile) */}
        <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle menu">
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-lg relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            placeholder={`Search ${activeLabel.toLowerCase()}…`}
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-10 py-2 text-sm rounded-full border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {isLoggedIn ? (
            <>
              <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Notifications">
                <Bell className="w-[18px] h-[18px] text-gray-500" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
              <Link href="/home" className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-gray-100 transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{background:'linear-gradient(135deg,#7C3AED,#0891B2)'}}>
                  {userName.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-[12px] font-semibold text-gray-700 hidden sm:block">{userName}</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login"
                className="px-3.5 py-1.5 text-[13px] font-semibold text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors hidden sm:flex">
                Sign In
              </Link>
              <Link href="/welcome"
                className="px-3.5 py-1.5 text-[13px] font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-95"
                style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                Start Creating
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1">

        {/* ── Sidebar backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/25 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        <aside className={`
          fixed lg:sticky top-14 z-30 lg:z-auto h-[calc(100vh-56px)] w-52 bg-white border-r border-gray-200
          flex-shrink-0 overflow-y-auto transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="p-4 space-y-1">
            {/* Mobile close row */}
            <div className="flex items-center justify-between mb-3 lg:hidden">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Browse</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pb-1">Content Type</p>

            {CONTENT_TYPES.map(({ id, label, Icon }) => (
              <button key={id}
                onClick={() => switchType(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 text-left group ${
                  contentType === id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${contentType === id ? 'scale-110' : 'group-hover:scale-105'}`} />
                {label}
              </button>
            ))}

            {/* Library (logged-in) */}
            {isLoggedIn && (
              <>
                <div className="pt-4 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">My Library</p>
                </div>
                {[
                  { label:'Watch History',     Icon:History,   id:'history-section'   },
                  { label:'My Playlists',       Icon:ListVideo, id:'playlists-section' },
                  { label:'Continue Watching',  Icon:Play,      id:'continue-section'  },
                ].map(({ label, Icon, id }) => (
                  <button key={id}
                    onClick={() => { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); setSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors text-left font-medium">
                    <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                    {label}
                  </button>
                ))}
              </>
            )}

            {/* Guest CTA */}
            {!isLoggedIn && (
              <div className="mt-4 bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-[12px] font-bold text-gray-800 mb-1">Create your space</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">Save playlists, track history & publish your content.</p>
                <Link href="/welcome"
                  className="block text-center text-[12px] font-bold text-white py-2 rounded-lg transition-all hover:opacity-90"
                  style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                  Get Started Free
                </Link>
              </div>
            )}
          </nav>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 space-y-8">

          {/* ── Personal sections (logged-in) ──────────────────────────────────── */}
          {isLoggedIn && (
            <>
              {/* Continue Watching */}
              <section id="continue-section">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-bold text-gray-900">Continue Watching</h2>
                  <button onClick={() => setShowAllHistory(v => !v)}
                    className="text-[12px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors">
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {HISTORY.map(item => (
                    <div key={item.id}
                      className="group flex-none w-48 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                      <div className="relative h-[108px]" style={{background: G[item.gi % 8]}}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">{item.duration}</span>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                          <div className="h-full bg-purple-500 transition-all" style={{width:`${item.progress}%`}} />
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[12px] font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{item.creator} · {item.time}</p>
                        <p className="text-[10px] text-purple-600 font-semibold mt-0.5">{item.progress}% watched</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* My Playlists */}
              <section id="playlists-section">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-bold text-gray-900">My Playlists</h2>
                  <button onClick={() => setShowCreatePlaylist(true)}
                    className="text-[12px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> New Playlist
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {/* Create card */}
                  <button onClick={() => setShowCreatePlaylist(true)}
                    className="flex-none w-36 h-24 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-purple-600 transition-all group shrink-0">
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold">New Playlist</span>
                  </button>
                  {playlists.map(pl => (
                    <div key={pl.id}
                      className="group flex-none w-36 rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer shrink-0">
                      <div className="h-16 flex items-center justify-center text-2xl"
                        style={{background:`${pl.color}15`, borderBottom:`2px solid ${pl.color}25`}}>
                        {pl.emoji}
                      </div>
                      <div className="p-2.5">
                        <p className="text-[12px] font-bold text-gray-900 truncate">{pl.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{pl.count} videos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Watch History compact */}
              <section id="history-section">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-bold text-gray-900">Watch History</h2>
                  <button onClick={() => setShowAllHistory(v => !v)}
                    className="text-[12px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors">
                    {showAllHistory ? 'Show less' : 'View All'} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {(showAllHistory ? HISTORY : HISTORY.slice(0, 3)).map(item => (
                    <div key={item.id}
                      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer flex gap-3 p-2.5">
                      <div className="relative w-24 h-[54px] rounded-lg flex-none overflow-hidden" style={{background: G[item.gi % 8]}}>
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 py-0.5 rounded">{item.duration}</span>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
                          <div className="h-full bg-purple-500" style={{width:`${item.progress}%`}} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.time} · {item.progress}% done</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── Content area (animated on type/search change) ────────────────── */}
          <section key={fadeKey} className="content-fade">

            {/* Sort / view bar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-gray-900">
                  {search ? `Results for "${search}"` : activeLabel}
                </h2>
                {!search && (
                  <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Public only</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Grid/list toggle */}
                {(contentType === 'all' || contentType === 'videos') && (
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {(['grid','list'] as const).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)}
                        className={`p-1.5 rounded-md transition-colors ${viewMode===mode?'bg-white shadow-sm text-purple-600':'text-gray-400 hover:text-gray-600'}`}>
                        {mode === 'grid' ? <Grid3X3 className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
                {/* Sort */}
                <div ref={sortRef} className="relative">
                  <button onClick={() => setSortOpen(v => !v)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-purple-300 transition-colors">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    {sort}
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${sortOpen?'rotate-180':''}`} />
                  </button>
                  {sortOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 min-w-[150px] py-1 overflow-hidden">
                      {SORT_OPTIONS.map(opt => (
                        <button key={opt} onClick={() => { setSort(opt); setSortOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-[13px] hover:bg-purple-50 transition-colors ${sort===opt?'text-purple-700 font-bold bg-purple-50':'text-gray-700 font-medium'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── ALL ── */}
            {contentType === 'all' && (
              <div className="space-y-10">
                {/* Videos */}
                {filteredVideos.length > 0 && (
                  <div>
                    {search ? null : <SectionHead label="Videos" />}
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredVideos.map(v => (
                          <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                            <LandscapeThumb gi={v.gi} duration={v.duration} />
                            <div className="p-3">
                              <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{v.title}</p>
                              <p className="text-[11px] text-gray-500">{v.creator}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{v.views} views · {v.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredVideos.map(v => (
                          <div key={v.id} className="group bg-white rounded-xl border border-gray-100 flex gap-3 p-3 hover:shadow-md transition-all cursor-pointer">
                            <div className="flex-none w-32"><LandscapeThumb gi={v.gi} duration={v.duration} size="sm" /></div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="text-[13px] font-bold text-gray-900 line-clamp-2">{v.title}</p>
                              <p className="text-[11px] text-gray-500 mt-1">{v.creator}</p>
                              <p className="text-[11px] text-gray-400">{v.views} views · {v.time}</p>
                            </div>
                            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 self-start shrink-0"><MoreVertical className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Shorts */}
                {filteredShorts.length > 0 && (
                  <div>
                    {search ? null : <SectionHead label="Shorts" />}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredShorts.map(s => (
                        <div key={s.id} className="group cursor-pointer">
                          <PortraitThumb gi={s.gi} duration={s.duration} />
                          <p className="mt-2 text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{s.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{s.creator}</p>
                          <p className="text-[10px] text-gray-400">{s.views} views</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reels */}
                {filteredReels.length > 0 && (
                  <div>
                    {search ? null : <SectionHead label="Reels" />}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredReels.map(r => (
                        <div key={r.id} className="group cursor-pointer">
                          <PortraitThumb gi={r.gi} duration={r.duration} />
                          <p className="mt-2 text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{r.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{r.creator}</p>
                          <p className="text-[10px] text-gray-400">{r.views} views</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No results at all */}
                {filteredVideos.length === 0 && filteredShorts.length === 0 && filteredReels.length === 0 && (
                  <Empty query={q} />
                )}
              </div>
            )}

            {/* ── VIDEOS only ── */}
            {contentType === 'videos' && (
              filteredVideos.length === 0 ? <Empty query={q} /> :
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredVideos.map(v => (
                    <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                      <LandscapeThumb gi={v.gi} duration={v.duration} />
                      <div className="p-3">
                        <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{v.title}</p>
                        <p className="text-[11px] text-gray-500">{v.creator}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{v.views} views · {v.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredVideos.map(v => (
                    <div key={v.id} className="group bg-white rounded-xl border border-gray-100 flex gap-3 p-3 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex-none w-32"><LandscapeThumb gi={v.gi} duration={v.duration} size="sm" /></div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[13px] font-bold text-gray-900 line-clamp-2">{v.title}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{v.creator}</p>
                        <p className="text-[11px] text-gray-400">{v.views} views · {v.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── SHORTS only ── */}
            {contentType === 'shorts' && (
              filteredShorts.length === 0 ? <Empty query={q} /> : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {filteredShorts.map(s => (
                    <div key={s.id} className="group cursor-pointer">
                      <PortraitThumb gi={s.gi} duration={s.duration} />
                      <p className="mt-2 text-[12px] font-semibold text-gray-900 line-clamp-2 leading-snug">{s.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{s.creator}</p>
                      <p className="text-[11px] text-gray-400">{s.views} views</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── REELS only ── */}
            {contentType === 'reels' && (
              filteredReels.length === 0 ? <Empty query={q} /> : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {filteredReels.map(r => (
                    <div key={r.id} className="group cursor-pointer">
                      <PortraitThumb gi={r.gi} duration={r.duration} />
                      <p className="mt-2 text-[12px] font-semibold text-gray-900 line-clamp-2 leading-snug">{r.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{r.creator}</p>
                      <p className="text-[11px] text-gray-400">{r.views} views</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── IMAGES only ── */}
            {contentType === 'images' && (
              filteredImages.length === 0 ? <Empty query={q} /> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredImages.map(i => (
                    <div key={i.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                      <ImageThumb gi={i.gi} />
                      <div className="p-3">
                        <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{i.title}</p>
                        <p className="text-[11px] text-gray-500">{i.creator}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{i.views} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </section>

          {/* ── Creator CTA (guests) ──────────────────────────────────────────── */}
          {!isLoggedIn && (
            <section className="rounded-2xl p-6 flex items-center gap-5"
              style={{background:'linear-gradient(135deg,rgba(124,58,237,.08),rgba(8,145,178,.05))',border:'1px solid rgba(124,58,237,.18)'}}>
              <div className="text-4xl select-none">🚀</div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-extrabold text-gray-900 mb-1">Ready to publish YOUR content here?</p>
                <p className="text-[12px] text-gray-500">Join thousands of creators using SozialZynk's AI to script, produce and publish videos automatically.</p>
              </div>
              <Link href="/welcome"
                className="shrink-0 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{background:'linear-gradient(135deg,#7C3AED,#6D28D9)'}}>
                Start Creating →
              </Link>
            </section>
          )}

          <div className="h-8" />
        </main>
      </div>

      {/* ── Create Playlist modal ──────────────────────────────────────────────── */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowCreatePlaylist(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Create New Playlist</h3>
              <button onClick={() => setShowCreatePlaylist(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input autoFocus type="text" placeholder="Playlist name…"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" />
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

      <style>{`
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .content-fade { animation: fadeIn 0.2s ease-out both; }
      `}</style>
    </div>
  );
}
