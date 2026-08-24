'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo-mark';
import {
  Search, Bell, Menu, X, ChevronRight, Play, History, Plus, Film, Scissors,
  ImageIcon, Grid3X3, LayoutList, SlidersHorizontal, ChevronDown, MoreVertical,
  Heart, MessageCircle, TrendingUp, Eye, EyeOff, Trash2, Share2, Settings, LogOut,
  Bookmark, Sparkles, Clock,
} from 'lucide-react';

// ── Demo projects (from API) ───────────────────────────────────────────────────

interface DemoProject {
  id: string; title: string; description?: string | null;
  contentFormat?: string | null; niche?: string | null;
  updatedAt: string;
  channel?: { title: string; thumbnailUrl?: string | null } | null;
  videos?: Array<{ id: string; title?: string | null; duration?: number | null; thumbnailUrl?: string | null; videoUrl?: string | null }>;
}

function useDemoProjects(): DemoProject[] {
  const [projects, setProjects] = useState<DemoProject[]>([]);
  useEffect(() => {
    const base = typeof window !== 'undefined' ? '/api/proxy' : (process.env['NEXT_PUBLIC_API_URL'] ?? '');
    fetch(`${base}/projects/browse?limit=6`)
      .then(r => r.ok ? r.json() as Promise<DemoProject[]> : Promise.resolve([]))
      .then(data => { if (Array.isArray(data)) setProjects(data); })
      .catch(() => { /* silently skip — static content still shown */ });
  }, []);
  return projects;
}

function DemoFeatured({ projects, onPlay }: { projects: DemoProject[]; onPlay: (p: { id: string; title: string; creator: string; gi: number; duration?: string; kind: 'video' }) => void }) {
  if (projects.length === 0) return null;

  const gradients = [
    'linear-gradient(135deg,#0c1445,#1e3a8a)',
    'linear-gradient(135deg,#1a0845,#4c1d95)',
    'linear-gradient(135deg,#0a2a1a,#065f46)',
  ];

  function fmtDuration(secs?: number | null): string {
    if (!secs) return '12:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-bold" style={{ background: 'linear-gradient(135deg,#374151,#111827)' }}>
          <Sparkles className="w-3 h-3" />
          Featured by SozialZynk
        </div>
        <span className="text-[11px] text-gray-400 font-medium">Platform showcase · Public</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((p, i) => {
          const gi = i % gradients.length;
          const firstVideo = p.videos?.[0];
          const duration = fmtDuration(firstVideo?.duration ?? (p.contentFormat === 'DOCUMENTARY' ? 720 : undefined));
          return (
            <div
              key={p.id}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => onPlay({ id: p.id, title: p.title, creator: '@SozialZynk', gi, duration, kind: 'video' })}
            >
              {/* Thumbnail */}
              <div className="relative w-full h-44 overflow-hidden" style={{ background: gradients[gi] }}>
                {firstVideo?.thumbnailUrl ? (
                  <img src={firstVideo.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                    <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white fill-white translate-x-0.5" />
                    </div>
                    <p className="text-white/70 text-[11px] font-medium text-center line-clamp-2">{p.title}</p>
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-7 h-7 text-white fill-white translate-x-0.5" />
                  </div>
                </div>
                {/* Duration */}
                <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{duration}</span>
                {/* Demo badge */}
                <span className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />AD
                </span>
              </div>
              <div className="p-3.5">
                <p className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug mb-1.5">{p.title}</p>
                {p.description && <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed mb-2">{p.description}</p>}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />{duration}
                  </span>
                  {p.niche && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.niche}</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">@SozialZynk</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoItem {
  id: string; title: string; creator: string; views: string; time: string;
  duration: string; gi: number; likes: string; comments: string; shares: string;
  isOwn: boolean;
}
interface ShortItem {
  id: string; title: string; creator: string; views: string; duration: string;
  gi: number; likes: string; comments: string; shares: string; isOwn: boolean;
}
interface ImageItem {
  id: string; title: string; creator: string; views: string;
  gi: number; likes: string; isOwn: boolean;
}
interface Group { id: string; name: string; count: number; color: string; emoji: string; }
interface HistoryItem { id: string; title: string; creator: string; progress: number; duration: string; time: string; gi: number; }
interface Notif { id: string; type: string; msg: string; time: string; read: boolean; icon: React.ElementType; }

// ── Data ──────────────────────────────────────────────────────────────────────

const VIDEOS: VideoItem[] = [
  { id:'v1',  title:'How to Grow to 100K Followers',        creator:'@CreatorPro',   views:'2.4M', time:'3 days ago',  duration:'14:32', gi:0, likes:'18.2K', comments:'432', shares:'204', isOwn:true  },
  { id:'v2',  title:'Top 10 AI Tools for Creators 2025',   creator:'@AIWeekly',     views:'1.9M', time:'1 week ago',  duration:'8:18',  gi:1, likes:'14.1K', comments:'318', shares:'157', isOwn:false },
  { id:'v3',  title:'Social Media Algorithm Breakdown',     creator:'@GrowthHacks',  views:'876K', time:'5 days ago',  duration:'11:05', gi:2, likes:'7.8K',  comments:'189', shares:'93',  isOwn:false },
  { id:'v4',  title:'From 0 to $10K/month as a Creator',   creator:'@Monetize8',    views:'654K', time:'2 weeks ago', duration:'19:44', gi:3, likes:'6.2K',  comments:'274', shares:'112', isOwn:true  },
  { id:'v5',  title:'Social Media SEO Secrets 2025',       creator:'@SEOKing',      views:'432K', time:'4 days ago',  duration:'7:22',  gi:4, likes:'4.1K',  comments:'97',  shares:'58',  isOwn:false },
  { id:'v6',  title:'AI Voice Generation — Full Guide',    creator:'@VoiceTech',    views:'328K', time:'6 days ago',  duration:'13:11', gi:5, likes:'3.3K',  comments:'81',  shares:'42',  isOwn:false },
  { id:'v7',  title:'Monetisation Masterclass 2025',       creator:'@MoneyTube',    views:'258K', time:'1 week ago',  duration:'16:55', gi:6, likes:'2.8K',  comments:'64',  shares:'31',  isOwn:false },
  { id:'v8',  title:'Perfect Thumbnail Formula',           creator:'@ClickMaster',  views:'189K', time:'2 weeks ago', duration:'9:30',  gi:7, likes:'1.9K',  comments:'47',  shares:'22',  isOwn:false },
  { id:'v9',  title:'YouTube Analytics Deep Dive',         creator:'@DataCreator',  views:'156K', time:'3 days ago',  duration:'18:22', gi:0, likes:'1.5K',  comments:'38',  shares:'19',  isOwn:false },
  { id:'v10', title:'Build Your Brand with AI in 30 Days', creator:'@BrandAI',      views:'134K', time:'1 week ago',  duration:'22:15', gi:1, likes:'1.3K',  comments:'29',  shares:'15',  isOwn:false },
  { id:'v11', title:'Gaming Channel Growth Blueprint',     creator:'@GamingGuru',   views:'112K', time:'2 weeks ago', duration:'15:40', gi:2, likes:'1.1K',  comments:'23',  shares:'11',  isOwn:false },
  { id:'v12', title:'Creative Direction for YouTube',      creator:'@CreativeHQ',   views:'98K',  time:'4 days ago',  duration:'11:28', gi:3, likes:'980',   comments:'18',  shares:'9',   isOwn:false },
];

const SHORTS: ShortItem[] = [
  { id:'s1', title:'3 AI Tools That Changed My Life',       creator:'@TechDaily',    views:'4.2M', duration:'0:58', gi:4, likes:'32.1K', comments:'891', shares:'445', isOwn:true  },
  { id:'s2', title:'Content Hack That Works Every Time',    creator:'@GrowthPro',    views:'3.1M', duration:'0:45', gi:5, likes:'24.3K', comments:'634', shares:'312', isOwn:false },
  { id:'s3', title:'How I Made $1000 This Week',            creator:'@MoneyMind',    views:'2.8M', duration:'0:52', gi:6, likes:'20.1K', comments:'512', shares:'256', isOwn:false },
  { id:'s4', title:'YouTube Formula Nobody Talks About',    creator:'@TubeSecrets',  views:'2.1M', duration:'0:49', gi:7, likes:'17.2K', comments:'421', shares:'211', isOwn:false },
  { id:'s5', title:'My Viral Thumbnail Secret',             creator:'@ClickRate',    views:'1.9M', duration:'0:44', gi:0, likes:'14.8K', comments:'367', shares:'184', isOwn:false },
  { id:'s6', title:'Stop Making These Mistakes',            creator:'@CreatorCoach', views:'1.7M', duration:'0:55', gi:1, likes:'12.9K', comments:'318', shares:'159', isOwn:false },
  { id:'s7', title:'ChatGPT Prompt That Writes Scripts',    creator:'@PromptKing',   views:'1.5M', duration:'0:48', gi:2, likes:'11.4K', comments:'284', shares:'142', isOwn:false },
  { id:'s8', title:'Editing Trick Gets 10× Watch Time',     creator:'@EditPro',      views:'1.3M', duration:'0:38', gi:3, likes:'9.8K',  comments:'241', shares:'121', isOwn:false },
  { id:'s9', title:'AI Thumbnail in 60 Seconds',            creator:'@ThumbAI',      views:'1.1M', duration:'0:52', gi:4, likes:'8.2K',  comments:'204', shares:'102', isOwn:false },
  { id:'s10',title:'Script Any Video With One Prompt',      creator:'@ScriptBot',    views:'980K', duration:'0:41', gi:5, likes:'7.1K',  comments:'178', shares:'89',  isOwn:false },
  { id:'s11',title:'This Hook Formula Went Viral',          creator:'@HookLab',      views:'870K', duration:'0:35', gi:6, likes:'6.3K',  comments:'156', shares:'78',  isOwn:false },
  { id:'s12',title:'Fix Your CTR in Under 1 Minute',        creator:'@CTRGenius',    views:'760K', duration:'0:44', gi:7, likes:'5.4K',  comments:'134', shares:'67',  isOwn:false },
];

const REELS: ShortItem[] = [
  { id:'r1', title:'Brand Storytelling in 30 Seconds',     creator:'@BrandReel',    views:'3.8M', duration:'0:28', gi:3, likes:'28.4K', comments:'712', shares:'356', isOwn:false },
  { id:'r2', title:'Cinematic Travel Reel — AI Edit',      creator:'@WanderAI',     views:'2.9M', duration:'0:22', gi:4, likes:'22.1K', comments:'541', shares:'271', isOwn:false },
  { id:'r3', title:'Day in the Life of an AI Creator',     creator:'@CreatorDay',   views:'2.1M', duration:'0:35', gi:5, likes:'15.8K', comments:'389', shares:'195', isOwn:false },
  { id:'r4', title:'AI Voice Cover — Sounds Real',         creator:'@VoiceClone',   views:'1.8M', duration:'0:30', gi:6, likes:'13.2K', comments:'324', shares:'162', isOwn:false },
  { id:'r5', title:'Behind the Scenes: Video Production',  creator:'@BehindCam',    views:'1.4M', duration:'0:42', gi:7, likes:'10.1K', comments:'249', shares:'125', isOwn:false },
  { id:'r6', title:'Trending Sound + AI Clips = Viral',    creator:'@ViralMix',     views:'1.2M', duration:'0:25', gi:0, likes:'8.7K',  comments:'214', shares:'107', isOwn:false },
  { id:'r7', title:'5-Second Hook Formula',                creator:'@HookReel',     views:'1.0M', duration:'0:18', gi:1, likes:'7.4K',  comments:'183', shares:'92',  isOwn:false },
  { id:'r8', title:'Colour Grade That Hits Every Time',    creator:'@GradeAI',      views:'870K', duration:'0:32', gi:2, likes:'6.2K',  comments:'153', shares:'77',  isOwn:false },
  { id:'r9', title:'Comment Reply Strategy That Works',    creator:'@EngagePro',    views:'760K', duration:'0:27', gi:3, likes:'5.4K',  comments:'134', shares:'67',  isOwn:false },
  { id:'r10',title:'AI Subtitles in Under 60s',            creator:'@SubsBot',      views:'650K', duration:'0:48', gi:4, likes:'4.7K',  comments:'116', shares:'58',  isOwn:false },
  { id:'r11',title:'Transition Trick Everyone is Copying', creator:'@TransitionKing',views:'580K',duration:'0:21', gi:5, likes:'4.1K',  comments:'101', shares:'51',  isOwn:false },
  { id:'r12',title:'Lighting Setup for Phone Creators',    creator:'@LightUp',      views:'490K', duration:'0:38', gi:6, likes:'3.5K',  comments:'86',  shares:'43',  isOwn:false },
];

const IMAGES: ImageItem[] = [
  { id:'i1', title:'AI-Generated YouTube Thumbnail Pack',  creator:'@ThumbPro',     views:'654K', gi:0, likes:'8.2K', isOwn:false },
  { id:'i2', title:'Channel Banner Template 2025',         creator:'@BannerAI',     views:'421K', gi:1, likes:'5.4K', isOwn:false },
  { id:'i3', title:'Creator Studio Desk Setup Inspo',      creator:'@SetupGoals',   views:'389K', gi:2, likes:'4.9K', isOwn:false },
  { id:'i4', title:'AI Portrait — Creator Avatar Style',   creator:'@AvatarAI',     views:'312K', gi:3, likes:'4.1K', isOwn:false },
  { id:'i5', title:'Infographic: YouTube Algorithm Map',   creator:'@AlgoViz',      views:'298K', gi:4, likes:'3.8K', isOwn:false },
  { id:'i6', title:'Brand Color Palette for Creators',     creator:'@BrandKit',     views:'245K', gi:5, likes:'3.2K', isOwn:false },
  { id:'i7', title:'Social Media Size Cheat Sheet 2025',   creator:'@SizeGuide',    views:'198K', gi:6, likes:'2.5K', isOwn:false },
  { id:'i8', title:'AI Character Design — Tutorial',       creator:'@CharacterAI',  views:'167K', gi:7, likes:'2.1K', isOwn:false },
];

const INITIAL_GROUPS: Group[] = [
  { id:'g1', name:'My Favorites',   count:12, color:'#374151', emoji:'⭐' },
  { id:'g2', name:'Watch Later',    count:8,  color:'#0891B2', emoji:'🕐' },
  { id:'g3', name:'Saved for Work', count:15, color:'#059669', emoji:'💼' },
  { id:'g4', name:'Loved Shorts',   count:6,  color:'#DC2626', emoji:'❤️' },
];

const HISTORY_ITEMS: HistoryItem[] = [
  { id:'h1', title:'How to Script Videos with AI',     creator:'@ScriptMaster', progress:65, duration:'12:30', time:'2h ago',    gi:2 },
  { id:'h2', title:'Complete Guide to YouTube SEO',    creator:'@SEOPro',       progress:30, duration:'18:45', time:'Yesterday', gi:3 },
  { id:'h3', title:'AI Thumbnail Generation Tutorial', creator:'@ThumbnailAI',  progress:90, duration:'9:15',  time:'2 days ago',gi:4 },
  { id:'h4', title:'Viral Hooks That Get Clicks',      creator:'@HookMaster',   progress:45, duration:'14:20', time:'3 days ago',gi:5 },
];

const INITIAL_NOTIFS: Notif[] = [
  { id:'n1', type:'like',       icon: Heart,          msg:'@TechDaily liked your video "AI Tools That Changed…"', time:'2m ago',  read:false },
  { id:'n2', type:'comment',    icon: MessageCircle,  msg:'@GrowthPro commented: "This is gold!"',                time:'15m ago', read:false },
  { id:'n3', type:'milestone',  icon: TrendingUp,     msg:'Your Short hit 1,000 views!',                          time:'1h ago',  read:false },
  { id:'n4', type:'visibility', icon: Eye,            msg:'Your video is now public',                              time:'3h ago',  read:true  },
  { id:'n5', type:'removed',    icon: Trash2,         msg:'Admin removed "Content Title" for policy violation',   time:'1d ago',  read:true  },
];

const SORT_OPTIONS = ['Trending', 'Latest', 'Most Viewed', 'Top Rated'] as const;
type SortOption = typeof SORT_OPTIONS[number];
type ContentType = 'all' | 'videos' | 'shorts' | 'reels' | 'images';

interface PlayItem { id: string; title: string; creator: string; gi: number; duration?: string; kind: 'video'|'short'|'reel'|'image'; views?: string; likes?: string; comments?: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchSearch(title: string, creator: string, q: string): boolean {
  if (!q.trim()) return true;
  const lq = q.toLowerCase();
  return title.toLowerCase().includes(lq) || creator.toLowerCase().includes(lq);
}

// ── Thumbnail components ──────────────────────────────────────────────────────

function LandscapeThumb({ gi, duration, size = 'md' }: { gi: number; duration: string; size?: 'md' | 'sm' }) {
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

function SquareThumb({ gi }: { gi: number }) {
  return (
    <div className="relative w-full rounded-xl overflow-hidden group-hover:brightness-90 transition-all"
      style={{ background: G[gi % 8], aspectRatio: '4/3' }}>
      <ImageIcon className="absolute inset-0 m-auto w-8 h-8 text-white/20" />
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ views, likes, comments, shares, hidden }: {
  views: string; likes: string; comments: string; shares?: string; hidden: boolean;
}) {
  if (hidden) {
    return <p className="text-[10px] text-gray-400 mt-1 italic">Stats hidden</p>;
  }
  return (
    <div className="flex items-center gap-2.5 mt-1 flex-wrap">
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
        <Eye className="w-3 h-3" />{views}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
        <Heart className="w-3 h-3" />{likes}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
        <MessageCircle className="w-3 h-3" />{comments}
      </span>
      {shares && (
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <Share2 className="w-3 h-3" />{shares}
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const demoProjects = useDemoProjects();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contentType, setContentType] = useState<ContentType>('all');
  const [sort, setSort] = useState<SortOption>('Trending');
  const [sortOpen, setSortOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [saveToGroupVideoId, setSaveToGroupVideoId] = useState<string | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [statsHidden, setStatsHidden] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState<PlayItem | null>(null);

  const sortRef    = useRef<HTMLDivElement>(null);
  const bellRef    = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // Auth detection
  useEffect(() => {
    try {
      const token = localStorage.getItem('cf_token');
      if (token) {
        setIsLoggedIn(true);
        const p = JSON.parse(atob(token.split('.')[1] ?? '{}')) as { name?: string; email?: string };
        setUserName(p.name ?? p.email?.split('@')[0] ?? 'Creator');
        setUserEmail(p.email ?? '');
      }
      const hist = localStorage.getItem('cf_search_history');
      if (hist) setSearchHistory(JSON.parse(hist) as string[]);
    } catch { /* guest */ }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
        setShowSearchHistory(false);
      }
      if (saveToGroupVideoId && !(e.target as Element).closest?.('.cf-save-group-panel')) {
        setSaveToGroupVideoId(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keyboard: '/' focuses search
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

  const switchType = useCallback((id: ContentType) => {
    setContentType(id);
    setSearch('');
    setFadeKey(k => k + 1);
    setSidebarOpen(false);
  }, []);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setFadeKey(k => k + 1);
  }, []);

  const saveSearchHistory = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !isLoggedIn) return;
    setSearchHistory(prev => {
      const deduped = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 10);
      try { localStorage.setItem('cf_search_history', JSON.stringify(deduped)); } catch { /* noop */ }
      return deduped;
    });
  }, [isLoggedIn]);

  const markAllRead = useCallback(() => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const toggleStats = useCallback((id: string) => {
    setStatsHidden(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCreateGroup = useCallback(() => {
    if (!newGroupName.trim()) return;
    const colors = ['#374151','#0891B2','#059669','#DC2626','#D97706'];
    const emojis = ['⭐','🕐','💼','❤️','📌'];
    const idx = groups.length % colors.length;
    setGroups(prev => [...prev, { id:`g-${Date.now()}`, name:newGroupName.trim(), count:0, color:colors[idx], emoji:emojis[idx] }]);
    setNewGroupName('');
    setShowCreateGroup(false);
  }, [newGroupName, groups.length]);

  const handleSaveToGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, count: g.count + 1 } : g));
    setSaveToGroupVideoId(null);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user_role');
    window.location.href = '/browse';
  }, []);

  const unreadCount = notifs.filter(n => !n.read).length;

  // Filtered content
  const q = search.trim();
  const filteredVideos = VIDEOS.filter(v => matchSearch(v.title, v.creator, q));
  const filteredShorts = SHORTS.filter(s => matchSearch(s.title, s.creator, q));
  const filteredReels  = REELS.filter(r  => matchSearch(r.title, r.creator, q));
  const filteredImages = IMAGES.filter(i => matchSearch(i.title, i.creator, q));

  const activeLabel = (() => {
    switch (contentType) {
      case 'videos': return 'Videos';
      case 'shorts': return 'Shorts';
      case 'reels':  return 'Reels';
      case 'images': return 'Images';
      default:       return 'All Videos';
    }
  })();

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm h-14 flex items-center px-4 gap-3">
        {/* Logo */}
        <Link href="/browse" className="flex items-center gap-2 shrink-0">
          <LogoMark className="w-8 h-8" variant="dark" />
          <span className="font-bold text-[15px] hidden sm:block tracking-tight select-none">
            <span className="text-gray-900">Sozial</span><span style={{ color:'#374151' }}>Z</span><span className="text-gray-900">ynk</span>
          </span>
        </Link>

        {/* Hamburger */}
        <button
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <form
          className="flex-1 max-w-lg relative"
          onSubmit={e => { e.preventDefault(); saveSearchHistory(search); }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            placeholder={`Search ${activeLabel.toLowerCase()}… (press /)`}
            value={search}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveSearchHistory(search); }}
            className="w-full pl-9 pr-9 py-2 text-sm rounded-full border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400 transition-all placeholder:text-gray-400"
          />
          {search && (
            <button type="button" onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Right: auth-aware icons */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {isLoggedIn ? (
            <>
              {/* Bell */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => { setBellOpen(o => !o); setAccountOpen(false); }}
                  className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-[19px] h-[19px] text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white bg-red-500">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <span className="text-[13px] font-bold text-gray-900">Creator Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[11px] font-bold text-gray-700 hover:text-gray-900">
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifs.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-[12px] text-gray-400">No notifications yet</p>
                      </div>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto">
                        {notifs.map(n => {
                          const Icon = n.icon;
                          return (
                            <li key={n.id}
                              className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${n.read ? '' : 'bg-gray-50'}`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                n.type === 'removed' ? 'bg-red-100' : 'bg-gray-100'
                              }`}>
                                <Icon className={`w-3.5 h-3.5 ${n.type === 'removed' ? 'text-red-500' : 'text-gray-700'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11.5px] text-gray-700 leading-snug font-medium">{n.msg}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{n.time}</p>
                              </div>
                              {!n.read && <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0 mt-1.5" />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Account avatar */}
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => { setAccountOpen(o => !o); setBellOpen(false); }}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Account menu"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background:'linear-gradient(135deg,#374151,#0891B2)' }}>
                    {userName.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700 hidden sm:block max-w-[80px] truncate">{userName}</span>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                    {/* User info */}
                    <div className="px-4 py-3.5 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0"
                          style={{ background:'linear-gradient(135deg,#374151,#0891B2)' }}>
                          {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 truncate">{userName}</p>
                          {userEmail && <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>}
                        </div>
                      </div>
                    </div>
                    {/* Links */}
                    <div className="p-2">
                      <Link href="/account"
                        onClick={() => setAccountOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left font-medium"
                      >
                        <History className="w-4 h-4 text-gray-400 shrink-0" />
                        Watch History
                      </Link>
                      {/* Search History */}
                      <button
                        onClick={() => setShowSearchHistory(v => !v)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left font-medium"
                      >
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        Search History
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-auto transition-transform ${showSearchHistory ? 'rotate-180' : ''}`} />
                      </button>
                      {showSearchHistory && (
                        <div className="ml-9 mb-1 space-y-0.5">
                          {searchHistory.length === 0 ? (
                            <p className="text-[11px] text-gray-400 px-2 py-1">No recent searches</p>
                          ) : (
                            searchHistory.slice(0, 5).map((s, i) => (
                              <button
                                key={i}
                                onClick={() => { handleSearch(s); setAccountOpen(false); }}
                                className="w-full text-left px-2 py-1 rounded-lg text-[11px] text-gray-600 hover:bg-gray-100 transition-colors truncate"
                              >
                                {s}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      <div className="h-px bg-gray-100 my-1.5 mx-2" />
                      <Link href="/settings"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <Settings className="w-4 h-4 text-gray-400 shrink-0" />
                        Settings
                      </Link>
                      <Link href="/home"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        Creator Dashboard
                      </Link>
                    </div>
                    <div className="p-2 pt-0">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors text-left font-medium border-t border-gray-100"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login"
                className="px-3.5 py-1.5 text-[13px] font-semibold text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors hidden sm:flex">
                Sign In
              </Link>
              <Link href="/become-creator"
                className="px-3.5 py-1.5 text-[13px] font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-95"
                style={{ background:'linear-gradient(135deg,#374151,#111827)' }}>
                Start Creating
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1">

        {/* Backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/25 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className={`
          fixed lg:sticky top-14 z-30 lg:z-auto h-[calc(100vh-56px)] w-52 bg-white border-r border-gray-200
          shrink-0 overflow-y-auto transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="p-3 space-y-0.5">
            {/* Mobile close */}
            <div className="flex items-center justify-between mb-3 lg:hidden">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Browse</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Type */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pb-1">Content Type</p>
            {([
              { id:'all',    label:'All Videos', Icon:Grid3X3  },
              { id:'videos', label:'Videos',     Icon:Play     },
              { id:'shorts', label:'Shorts',     Icon:Scissors },
              { id:'reels',  label:'Reels',      Icon:Film     },
              { id:'images', label:'Images',     Icon:ImageIcon},
            ] as { id:ContentType; label:string; Icon:React.ElementType }[]).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => switchType(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 text-left group ${
                  contentType === id
                    ? 'bg-gray-800 text-white shadow-md shadow-gray-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${contentType === id ? 'scale-110' : 'group-hover:scale-105'}`} />
                {label}
              </button>
            ))}

            {/* My Video Groups — logged-in only */}
            {isLoggedIn && (
              <div className="pt-3">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">My Video Groups</p>
                  <button
                    onClick={() => setShowCreateGroup(v => !v)}
                    className="text-[10px] font-bold text-gray-700 hover:text-gray-900 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />New
                  </button>
                </div>
                {showCreateGroup && (
                  <div className="mx-2 mb-2 flex gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowCreateGroup(false); }}
                      placeholder="e.g. My Favorites, Watch Later…"
                      className="flex-1 min-w-0 text-[11px] border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                    />
                    <button onClick={handleCreateGroup} className="px-2 py-1 rounded-lg bg-gray-800 text-white text-[11px] font-bold shrink-0">
                      Add
                    </button>
                  </div>
                )}
                <div className="space-y-0.5">
                  {groups.length === 0 ? (
                    <p className="text-[11px] text-gray-400 px-3 py-2 leading-relaxed">
                      Save videos to your first group using the <Bookmark className="w-3 h-3 inline-block" /> on any video.
                    </p>
                  ) : groups.map(g => (
                    <button
                      key={g.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
                    >
                      <span className="text-base leading-none shrink-0">{g.emoji}</span>
                      <span className="flex-1 truncate font-medium">{g.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{g.count}</span>
                    </button>
                  ))}
                </div>
                <div className="h-px bg-gray-100 my-2 mx-2" />
                <Link href="/account"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors text-left font-medium"
                  onClick={() => setSidebarOpen(false)}>
                  <History className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  My Library
                </Link>
              </div>
            )}

            {/* Guest CTA */}
            {!isLoggedIn && (
              <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-[12px] font-bold text-gray-800 mb-1">Create your space</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">Save groups, track history & publish your content.</p>
                <Link href="/become-creator"
                  className="block text-center text-[12px] font-bold text-white py-2 rounded-lg transition-all hover:opacity-90"
                  style={{ background:'linear-gradient(135deg,#374151,#111827)' }}>
                  Get Started Free
                </Link>
              </div>
            )}
          </nav>
        </aside>

        {/* ── Main ──────────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 space-y-8">

          {/* ── Demo / Featured Projects (from API) ────────────────────────── */}
          <DemoFeatured projects={demoProjects} onPlay={item => setPlaying(item)} />

          {/* ── Public content grid ────────────────────────────────────────── */}
          <section key={fadeKey} style={{ animation:'fadeIn 0.2s ease-out' }}>
            <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

            {/* Sort bar */}
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
                {(contentType === 'all' || contentType === 'videos') && (
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {(['grid','list'] as const).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)}
                        className={`p-1.5 rounded-md transition-colors ${viewMode===mode?'bg-white shadow-sm text-gray-700':'text-gray-400 hover:text-gray-600'}`}>
                        {mode === 'grid' ? <Grid3X3 className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={sortRef} className="relative">
                  <button onClick={() => setSortOpen(v => !v)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300 transition-colors">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    {sort}
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${sortOpen?'rotate-180':''}`} />
                  </button>
                  {sortOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 min-w-[150px] py-1 overflow-hidden">
                      {SORT_OPTIONS.map(opt => (
                        <button key={opt} onClick={() => { setSort(opt); setSortOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 transition-colors ${sort===opt?'text-gray-900 font-bold bg-gray-50':'text-gray-700 font-medium'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ALL */}
            {contentType === 'all' && (
              <div className="space-y-10">
                {filteredVideos.length > 0 && (
                  <div>
                    {!search && <h3 className="text-[15px] font-bold text-gray-900 mb-4">Videos</h3>}
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredVideos.map(v => (
                          <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative" onClick={() => setPlaying({ id: v.id, title: v.title, creator: v.creator, gi: v.gi, duration: v.duration, kind: 'video', views: v.views, likes: v.likes, comments: v.comments })}>
                            <LandscapeThumb gi={v.gi} duration={v.duration} />
                            {isLoggedIn && v.isOwn && (
                              <button
                                onClick={e => { e.stopPropagation(); toggleStats(v.id); }}
                                className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title={statsHidden[v.id] ? 'Show stats' : 'Hide stats'}
                              >
                                {statsHidden[v.id] ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-white" />}
                              </button>
                            )}
                            {isLoggedIn && (
                              <div className="cf-save-group-panel absolute top-2 right-2 z-10">
                                <button
                                  onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(saveToGroupVideoId === v.id ? null : v.id); }}
                                  className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Save to Video Group"
                                >
                                  <Bookmark className="w-3.5 h-3.5 text-white" />
                                </button>
                                {saveToGroupVideoId === v.id && (
                                  <div className="cf-save-group-panel absolute right-0 top-8 bg-white rounded-xl shadow-2xl border border-gray-100 w-48 py-1 overflow-hidden">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1">Add to Video Group</p>
                                    {groups.map(g => (
                                      <button key={g.id} onClick={e => { e.stopPropagation(); handleSaveToGroup(g.id); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors">
                                        <span className="text-sm leading-none">{g.emoji}</span>
                                        <span className="text-[12px] font-medium text-gray-700 truncate flex-1">{g.name}</span>
                                        <span className="text-[10px] text-gray-400 shrink-0">{g.count}</span>
                                      </button>
                                    ))}
                                    <div className="h-px bg-gray-100 mx-2 my-1" />
                                    <button onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(null); setShowCreateGroup(true); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-[12px] font-semibold text-gray-700 transition-colors">
                                      <Plus className="w-3.5 h-3.5" />New Video Group
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="p-3">
                              <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{v.title}</p>
                              <p className="text-[11px] text-gray-500">{v.creator} · {v.time}</p>
                              <StatsBar views={v.views} likes={v.likes} comments={v.comments} shares={v.shares} hidden={!!statsHidden[v.id]} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredVideos.map(v => (
                          <div key={v.id} className="group bg-white rounded-xl border border-gray-100 flex gap-3 p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => setPlaying({ id: v.id, title: v.title, creator: v.creator, gi: v.gi, duration: v.duration, kind: 'video', views: v.views, likes: v.likes, comments: v.comments })}>
                            <div className="flex-none w-32"><LandscapeThumb gi={v.gi} duration={v.duration} size="sm" /></div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="text-[13px] font-bold text-gray-900 line-clamp-2">{v.title}</p>
                              <p className="text-[11px] text-gray-500 mt-1">{v.creator} · {v.time}</p>
                              <StatsBar views={v.views} likes={v.likes} comments={v.comments} shares={v.shares} hidden={!!statsHidden[v.id]} />
                            </div>
                            {isLoggedIn && v.isOwn && (
                              <button onClick={e => { e.stopPropagation(); toggleStats(v.id); }}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 self-start shrink-0"
                                title={statsHidden[v.id] ? 'Show stats' : 'Hide stats'}>
                                {statsHidden[v.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                            {isLoggedIn && (
                              <div className="cf-save-group-panel relative self-start shrink-0">
                                <button onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(saveToGroupVideoId === v.id ? null : v.id); }}
                                  className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
                                  title="Save to Video Group">
                                  <Bookmark className="w-4 h-4" />
                                </button>
                                {saveToGroupVideoId === v.id && (
                                  <div className="cf-save-group-panel absolute right-0 top-9 bg-white rounded-xl shadow-2xl border border-gray-100 w-48 py-1 overflow-hidden z-20">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1">Add to Video Group</p>
                                    {groups.map(g => (
                                      <button key={g.id} onClick={e => { e.stopPropagation(); handleSaveToGroup(g.id); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors">
                                        <span className="text-sm leading-none">{g.emoji}</span>
                                        <span className="text-[12px] font-medium text-gray-700 truncate flex-1">{g.name}</span>
                                        <span className="text-[10px] text-gray-400 shrink-0">{g.count}</span>
                                      </button>
                                    ))}
                                    <div className="h-px bg-gray-100 mx-2 my-1" />
                                    <button onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(null); setShowCreateGroup(true); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-[12px] font-semibold text-gray-700 transition-colors">
                                      <Plus className="w-3.5 h-3.5" />New Video Group
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {filteredShorts.length > 0 && (
                  <div>
                    {!search && <h3 className="text-[15px] font-bold text-gray-900 mb-4">Shorts</h3>}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredShorts.map(s => (
                        <div key={s.id} className="group cursor-pointer relative" onClick={() => setPlaying({ id: s.id, title: s.title, creator: s.creator, gi: s.gi, duration: s.duration, kind: 'short', views: s.views, likes: s.likes, comments: s.comments })}>
                          <PortraitThumb gi={s.gi} duration={s.duration} />
                          {isLoggedIn && s.isOwn && (
                            <button onClick={e => { e.stopPropagation(); toggleStats(s.id); }}
                              className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              title={statsHidden[s.id] ? 'Show stats' : 'Hide stats'}>
                              {statsHidden[s.id] ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-white" />}
                            </button>
                          )}
                          {isLoggedIn && (
                            <div className="cf-save-group-panel absolute top-2 right-2 z-10">
                              <button onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(saveToGroupVideoId === s.id ? null : s.id); }}
                                className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Save to Video Group">
                                <Bookmark className="w-3.5 h-3.5 text-white" />
                              </button>
                              {saveToGroupVideoId === s.id && (
                                <div className="cf-save-group-panel absolute right-0 top-8 bg-white rounded-xl shadow-2xl border border-gray-100 w-48 py-1 overflow-hidden">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1">Add to Video Group</p>
                                  {groups.map(g => (
                                    <button key={g.id} onClick={e => { e.stopPropagation(); handleSaveToGroup(g.id); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors">
                                      <span className="text-sm leading-none">{g.emoji}</span>
                                      <span className="text-[12px] font-medium text-gray-700 truncate flex-1">{g.name}</span>
                                      <span className="text-[10px] text-gray-400 shrink-0">{g.count}</span>
                                    </button>
                                  ))}
                                  <div className="h-px bg-gray-100 mx-2 my-1" />
                                  <button onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(null); setShowCreateGroup(true); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-[12px] font-semibold text-gray-700 transition-colors">
                                    <Plus className="w-3.5 h-3.5" />New Video Group
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="mt-2 text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{s.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{s.creator}</p>
                          <StatsBar views={s.views} likes={s.likes} comments={s.comments} hidden={!!statsHidden[s.id]} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {filteredReels.length > 0 && (
                  <div>
                    {!search && <h3 className="text-[15px] font-bold text-gray-900 mb-4">Reels</h3>}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredReels.map(r => (
                        <div key={r.id} className="group cursor-pointer" onClick={() => setPlaying({ id: r.id, title: r.title, creator: r.creator, gi: r.gi, duration: r.duration, kind: 'reel', views: r.views, likes: r.likes, comments: r.comments })}>
                          <PortraitThumb gi={r.gi} duration={r.duration} />
                          <p className="mt-2 text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{r.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{r.creator}</p>
                          <StatsBar views={r.views} likes={r.likes} comments={r.comments} hidden={!!statsHidden[r.id]} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {filteredImages.length > 0 && (
                  <div>
                    {!search && <h3 className="text-[15px] font-bold text-gray-900 mb-4">Images</h3>}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredImages.map(i => (
                        <div key={i.id} className="group cursor-pointer" onClick={() => setPlaying({ id: i.id, title: i.title, creator: i.creator, gi: i.gi, kind: 'image', views: i.views, likes: i.likes })}>
                          <SquareThumb gi={i.gi} />
                          <p className="mt-2 text-[12px] font-semibold text-gray-900 line-clamp-2">{i.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{i.creator}</p>
                          <StatsBar views={i.views} likes={i.likes} comments="—" hidden={!!statsHidden[i.id]} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {filteredVideos.length === 0 && filteredShorts.length === 0 && filteredReels.length === 0 && filteredImages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Search className="w-10 h-10 mb-3 opacity-25" />
                    <p className="text-sm font-semibold text-gray-500">No results for &quot;{search}&quot;</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
            )}

            {/* VIDEOS */}
            {contentType === 'videos' && (
              <div>
                {filteredVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Search className="w-10 h-10 mb-3 opacity-25" />
                    <p className="text-sm font-semibold text-gray-500">No videos found</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredVideos.map(v => (
                      <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative" onClick={() => setPlaying({ id: v.id, title: v.title, creator: v.creator, gi: v.gi, duration: v.duration, kind: 'video', views: v.views, likes: v.likes, comments: v.comments })}>
                        <LandscapeThumb gi={v.gi} duration={v.duration} />
                        {isLoggedIn && v.isOwn && (
                          <button onClick={e => { e.stopPropagation(); toggleStats(v.id); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title={statsHidden[v.id] ? 'Show stats' : 'Hide stats'}>
                            {statsHidden[v.id] ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-white" />}
                          </button>
                        )}
                        <div className="p-3">
                          <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{v.title}</p>
                          <p className="text-[11px] text-gray-500">{v.creator} · {v.time}</p>
                          <StatsBar views={v.views} likes={v.likes} comments={v.comments} shares={v.shares} hidden={!!statsHidden[v.id]} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredVideos.map(v => (
                      <div key={v.id} className="group bg-white rounded-xl border border-gray-100 flex gap-3 p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => setPlaying({ id: v.id, title: v.title, creator: v.creator, gi: v.gi, duration: v.duration, kind: 'video', views: v.views, likes: v.likes, comments: v.comments })}>
                        <div className="flex-none w-32"><LandscapeThumb gi={v.gi} duration={v.duration} size="sm" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 line-clamp-2">{v.title}</p>
                          <p className="text-[11px] text-gray-500 mt-1">{v.creator} · {v.time}</p>
                          <StatsBar views={v.views} likes={v.likes} comments={v.comments} shares={v.shares} hidden={!!statsHidden[v.id]} />
                        </div>
                        {isLoggedIn && v.isOwn && (
                          <button onClick={e => { e.stopPropagation(); toggleStats(v.id); }}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 self-start shrink-0">
                            {statsHidden[v.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SHORTS */}
            {contentType === 'shorts' && (
              filteredShorts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Search className="w-10 h-10 mb-3 opacity-25" />
                  <p className="text-sm font-semibold text-gray-500">No Shorts found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredShorts.map(s => (
                    <div key={s.id} className="group cursor-pointer relative" onClick={() => setPlaying({ id: s.id, title: s.title, creator: s.creator, gi: s.gi, duration: s.duration, kind: 'short', views: s.views, likes: s.likes, comments: s.comments })}>
                      <PortraitThumb gi={s.gi} duration={s.duration} />
                      {isLoggedIn && s.isOwn && (
                        <button onClick={e => { e.stopPropagation(); toggleStats(s.id); }}
                          className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title={statsHidden[s.id] ? 'Show stats' : 'Hide stats'}>
                          {statsHidden[s.id] ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-white" />}
                        </button>
                      )}
                      <p className="mt-2 text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{s.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.creator}</p>
                      <StatsBar views={s.views} likes={s.likes} comments={s.comments} hidden={!!statsHidden[s.id]} />
                    </div>
                  ))}
                </div>
              )
            )}

            {/* REELS */}
            {contentType === 'reels' && (
              filteredReels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Search className="w-10 h-10 mb-3 opacity-25" />
                  <p className="text-sm font-semibold text-gray-500">No Reels found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredReels.map(r => (
                    <div key={r.id} className="group cursor-pointer" onClick={() => setPlaying({ id: r.id, title: r.title, creator: r.creator, gi: r.gi, duration: r.duration, kind: 'reel', views: r.views, likes: r.likes, comments: r.comments })}>
                      <PortraitThumb gi={r.gi} duration={r.duration} />
                      <p className="mt-2 text-[11px] font-semibold text-gray-900 line-clamp-2 leading-snug">{r.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.creator}</p>
                      <StatsBar views={r.views} likes={r.likes} comments={r.comments} hidden={!!statsHidden[r.id]} />
                    </div>
                  ))}
                </div>
              )
            )}

            {/* IMAGES */}
            {contentType === 'images' && (
              filteredImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Search className="w-10 h-10 mb-3 opacity-25" />
                  <p className="text-sm font-semibold text-gray-500">No Images found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredImages.map(i => (
                    <div key={i.id} className="group cursor-pointer" onClick={() => setPlaying({ id: i.id, title: i.title, creator: i.creator, gi: i.gi, kind: 'image', views: i.views, likes: i.likes })}>
                      <SquareThumb gi={i.gi} />
                      <p className="mt-2 text-[12px] font-semibold text-gray-900 line-clamp-2">{i.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{i.creator}</p>
                      <StatsBar views={i.views} likes={i.likes} comments="—" hidden={!!statsHidden[i.id]} />
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        </main>
      </div>

      {/* ── Player modal ───────────────────────────────────────────────── */}
      {playing && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4" onClick={() => setPlaying(null)}>
          <div className={`relative rounded-2xl overflow-hidden shadow-2xl bg-white ${playing.kind === 'short' || playing.kind === 'reel' ? 'w-full max-w-xs' : 'w-full max-w-2xl'}`} onClick={e => e.stopPropagation()}>
            <div className="relative" style={{ background: G[playing.gi % 8], aspectRatio: (playing.kind === 'short' || playing.kind === 'reel') ? '9/16' : playing.kind === 'image' ? '4/3' : '16/9' }}>
              {playing.kind !== 'image' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm" style={{ animation:'cfPulse 2s ease-in-out infinite' }}>
                    <Play className="w-8 h-8 text-white fill-white translate-x-0.5" />
                  </div>
                </div>
              )}
              {playing.kind === 'image' && <ImageIcon className="absolute inset-0 m-auto w-16 h-16 text-white/20" />}
              <button onClick={() => setPlaying(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 z-10 transition-colors"><X className="w-4 h-4" /></button>
              {playing.duration && <span className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded">{playing.duration}</span>}
            </div>
            <div className="p-4">
              <p className="font-bold text-gray-900 text-[15px] leading-snug mb-1">{playing.title}</p>
              <p className="text-[12px] text-gray-500 mb-3">{playing.creator}</p>
              {(playing.views || playing.likes) && (
                <div className="flex items-center gap-3 mb-3">
                  {playing.views && <span className="flex items-center gap-1 text-[11px] text-gray-400"><Eye className="w-3 h-3" />{playing.views}</span>}
                  {playing.likes && <span className="flex items-center gap-1 text-[11px] text-gray-400"><Heart className="w-3 h-3" />{playing.likes}</span>}
                  {playing.comments && <span className="flex items-center gap-1 text-[11px] text-gray-400"><MessageCircle className="w-3 h-3" />{playing.comments}</span>}
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-xl text-[12px] text-gray-500 text-center">
                Connect your YouTube channel in <strong className="text-gray-700">Settings → Channels</strong> to stream real content.
              </div>
            </div>
          </div>
          <style>{`@keyframes cfPulse{0%,100%{opacity:0.7;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}`}</style>
        </div>
      )}
    </div>
  );
}
