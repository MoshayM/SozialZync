'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo-mark';
import {
  Search, Bell, Menu, X, ChevronRight, Play, History, Plus, Film, Scissors,
  ImageIcon, Grid3X3, LayoutList, SlidersHorizontal, ChevronDown, ChevronUp,
  Heart, MessageCircle, TrendingUp, Eye, EyeOff, Trash2, Share2, Settings,
  LogOut, Bookmark, Clock, Mic, Volume2, VolumeX,
} from 'lucide-react';

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
  isOwn: boolean; videoUrl?: string;
}
interface ShortItem {
  id: string; title: string; creator: string; views: string; duration: string;
  gi: number; likes: string; comments: string; shares: string; isOwn: boolean; videoUrl?: string;
}
interface ImageItem {
  id: string; title: string; creator: string; views: string;
  gi: number; likes: string; isOwn: boolean;
}
interface FeedItem {
  id: string; title: string; creator: string; gi: number; duration?: string;
  kind: 'video' | 'short' | 'reel' | 'image';
  views: string; likes: string; comments?: string; shares?: string;
  videoUrl?: string;
}
interface Group { id: string; name: string; count: number; color: string; emoji: string; }
interface HistoryItem { id: string; title: string; creator: string; progress: number; duration: string; time: string; gi: number; }
interface Notif { id: string; type: string; msg: string; time: string; read: boolean; icon: React.ElementType; }

// ── Data ──────────────────────────────────────────────────────────────────────

// Public domain sample videos (Google sample bucket — no auth required)
const V = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

const VIDEOS: VideoItem[] = [
  { id:'v1',  title:'How to Grow to 100K Followers',        creator:'@CreatorPro',   views:'2.4M', time:'3 days ago',  duration:'14:32', gi:0, likes:'18.2K', comments:'432', shares:'204', isOwn:true,  videoUrl: V+'ForBiggerBlazes.mp4'              },
  { id:'v2',  title:'Top 10 AI Tools for Creators 2025',   creator:'@AIWeekly',     views:'1.9M', time:'1 week ago',  duration:'8:18',  gi:1, likes:'14.1K', comments:'318', shares:'157', isOwn:false, videoUrl: V+'BigBuckBunny.mp4'                 },
  { id:'v3',  title:'Social Media Algorithm Breakdown',     creator:'@GrowthHacks',  views:'876K', time:'5 days ago',  duration:'11:05', gi:2, likes:'7.8K',  comments:'189', shares:'93',  isOwn:false, videoUrl: V+'ElephantsDream.mp4'               },
  { id:'v4',  title:'From 0 to $10K/month as a Creator',   creator:'@Monetize8',    views:'654K', time:'2 weeks ago', duration:'19:44', gi:3, likes:'6.2K',  comments:'274', shares:'112', isOwn:true,  videoUrl: V+'ForBiggerEscapes.mp4'             },
  { id:'v5',  title:'Social Media SEO Secrets 2025',       creator:'@SEOKing',      views:'432K', time:'4 days ago',  duration:'7:22',  gi:4, likes:'4.1K',  comments:'97',  shares:'58',  isOwn:false, videoUrl: V+'SubaruOutbackOnStreetAndDirt.mp4' },
  { id:'v6',  title:'AI Voice Generation — Full Guide',    creator:'@VoiceTech',    views:'328K', time:'6 days ago',  duration:'13:11', gi:5, likes:'3.3K',  comments:'81',  shares:'42',  isOwn:false, videoUrl: V+'TearsOfSteel.mp4'                 },
  { id:'v7',  title:'Monetisation Masterclass 2025',       creator:'@MoneyTube',    views:'258K', time:'1 week ago',  duration:'16:55', gi:6, likes:'2.8K',  comments:'64',  shares:'31',  isOwn:false, videoUrl: V+'VolkswagenGTIReview.mp4'          },
  { id:'v8',  title:'Perfect Thumbnail Formula',           creator:'@ClickMaster',  views:'189K', time:'2 weeks ago', duration:'9:30',  gi:7, likes:'1.9K',  comments:'47',  shares:'22',  isOwn:false, videoUrl: V+'WeAreGoingOnBullrun.mp4'          },
  { id:'v9',  title:'YouTube Analytics Deep Dive',         creator:'@DataCreator',  views:'156K', time:'3 days ago',  duration:'18:22', gi:0, likes:'1.5K',  comments:'38',  shares:'19',  isOwn:false, videoUrl: V+'WhatCarCanYouGetForAGrand.mp4'    },
  { id:'v10', title:'Build Your Brand with AI in 30 Days', creator:'@BrandAI',      views:'134K', time:'1 week ago',  duration:'22:15', gi:1, likes:'1.3K',  comments:'29',  shares:'15',  isOwn:false, videoUrl: V+'Sintel.mp4'                       },
  { id:'v11', title:'Gaming Channel Growth Blueprint',     creator:'@GamingGuru',   views:'112K', time:'2 weeks ago', duration:'15:40', gi:2, likes:'1.1K',  comments:'23',  shares:'11',  isOwn:false, videoUrl: V+'ForBiggerFun.mp4'                 },
  { id:'v12', title:'Creative Direction for YouTube',      creator:'@CreativeHQ',   views:'98K',  time:'4 days ago',  duration:'11:28', gi:3, likes:'980',   comments:'18',  shares:'9',   isOwn:false, videoUrl: V+'ForBiggerJoyrides.mp4'            },
];

const SHORTS: ShortItem[] = [
  { id:'s1', title:'3 AI Tools That Changed My Life',       creator:'@TechDaily',    views:'4.2M', duration:'0:58', gi:4, likes:'32.1K', comments:'891', shares:'445', isOwn:true,  videoUrl: V+'ForBiggerMeltdowns.mp4'          },
  { id:'s2', title:'Content Hack That Works Every Time',    creator:'@GrowthPro',    views:'3.1M', duration:'0:45', gi:5, likes:'24.3K', comments:'634', shares:'312', isOwn:false, videoUrl: V+'ForBiggerBlazes.mp4'              },
  { id:'s3', title:'How I Made $1000 This Week',            creator:'@MoneyMind',    views:'2.8M', duration:'0:52', gi:6, likes:'20.1K', comments:'512', shares:'256', isOwn:false, videoUrl: V+'ForBiggerEscapes.mp4'             },
  { id:'s4', title:'YouTube Formula Nobody Talks About',    creator:'@TubeSecrets',  views:'2.1M', duration:'0:49', gi:7, likes:'17.2K', comments:'421', shares:'211', isOwn:false, videoUrl: V+'ForBiggerFun.mp4'                 },
  { id:'s5', title:'My Viral Thumbnail Secret',             creator:'@ClickRate',    views:'1.9M', duration:'0:44', gi:0, likes:'14.8K', comments:'367', shares:'184', isOwn:false, videoUrl: V+'ForBiggerJoyrides.mp4'            },
  { id:'s6', title:'Stop Making These Mistakes',            creator:'@CreatorCoach', views:'1.7M', duration:'0:55', gi:1, likes:'12.9K', comments:'318', shares:'159', isOwn:false, videoUrl: V+'BigBuckBunny.mp4'                 },
  { id:'s7', title:'ChatGPT Prompt That Writes Scripts',    creator:'@PromptKing',   views:'1.5M', duration:'0:48', gi:2, likes:'11.4K', comments:'284', shares:'142', isOwn:false, videoUrl: V+'ElephantsDream.mp4'               },
  { id:'s8', title:'Editing Trick Gets 10× Watch Time',     creator:'@EditPro',      views:'1.3M', duration:'0:38', gi:3, likes:'9.8K',  comments:'241', shares:'121', isOwn:false, videoUrl: V+'SubaruOutbackOnStreetAndDirt.mp4' },
  { id:'s9', title:'AI Thumbnail in 60 Seconds',            creator:'@ThumbAI',      views:'1.1M', duration:'0:52', gi:4, likes:'8.2K',  comments:'204', shares:'102', isOwn:false, videoUrl: V+'TearsOfSteel.mp4'                 },
  { id:'s10',title:'Script Any Video With One Prompt',      creator:'@ScriptBot',    views:'980K', duration:'0:41', gi:5, likes:'7.1K',  comments:'178', shares:'89',  isOwn:false, videoUrl: V+'VolkswagenGTIReview.mp4'          },
  { id:'s11',title:'This Hook Formula Went Viral',          creator:'@HookLab',      views:'870K', duration:'0:35', gi:6, likes:'6.3K',  comments:'156', shares:'78',  isOwn:false, videoUrl: V+'WeAreGoingOnBullrun.mp4'          },
  { id:'s12',title:'Fix Your CTR in Under 1 Minute',        creator:'@CTRGenius',    views:'760K', duration:'0:44', gi:7, likes:'5.4K',  comments:'134', shares:'67',  isOwn:false, videoUrl: V+'WhatCarCanYouGetForAGrand.mp4'    },
];

const REELS: ShortItem[] = [
  { id:'r1', title:'Brand Storytelling in 30 Seconds',     creator:'@BrandReel',    views:'3.8M', duration:'0:28', gi:3, likes:'28.4K', comments:'712', shares:'356', isOwn:false, videoUrl: V+'Sintel.mp4'                       },
  { id:'r2', title:'Cinematic Travel Reel — AI Edit',      creator:'@WanderAI',     views:'2.9M', duration:'0:22', gi:4, likes:'22.1K', comments:'541', shares:'271', isOwn:false, videoUrl: V+'ForBiggerBlazes.mp4'              },
  { id:'r3', title:'Day in the Life of an AI Creator',     creator:'@CreatorDay',   views:'2.1M', duration:'0:35', gi:5, likes:'15.8K', comments:'389', shares:'195', isOwn:false, videoUrl: V+'BigBuckBunny.mp4'                 },
  { id:'r4', title:'AI Voice Cover — Sounds Real',         creator:'@VoiceClone',   views:'1.8M', duration:'0:30', gi:6, likes:'13.2K', comments:'324', shares:'162', isOwn:false, videoUrl: V+'ForBiggerMeltdowns.mp4'           },
  { id:'r5', title:'Behind the Scenes: Video Production',  creator:'@BehindCam',    views:'1.4M', duration:'0:42', gi:7, likes:'10.1K', comments:'249', shares:'125', isOwn:false, videoUrl: V+'ElephantsDream.mp4'               },
  { id:'r6', title:'Trending Sound + AI Clips = Viral',    creator:'@ViralMix',     views:'1.2M', duration:'0:25', gi:0, likes:'8.7K',  comments:'214', shares:'107', isOwn:false, videoUrl: V+'ForBiggerEscapes.mp4'             },
  { id:'r7', title:'5-Second Hook Formula',                creator:'@HookReel',     views:'1.0M', duration:'0:18', gi:1, likes:'7.4K',  comments:'183', shares:'92',  isOwn:false, videoUrl: V+'ForBiggerFun.mp4'                 },
  { id:'r8', title:'Colour Grade That Hits Every Time',    creator:'@GradeAI',      views:'870K', duration:'0:32', gi:2, likes:'6.2K',  comments:'153', shares:'77',  isOwn:false, videoUrl: V+'TearsOfSteel.mp4'                 },
  { id:'r9', title:'Comment Reply Strategy That Works',    creator:'@EngagePro',    views:'760K', duration:'0:27', gi:3, likes:'5.4K',  comments:'134', shares:'67',  isOwn:false, videoUrl: V+'ForBiggerJoyrides.mp4'            },
  { id:'r10',title:'AI Subtitles in Under 60s',            creator:'@SubsBot',      views:'650K', duration:'0:48', gi:4, likes:'4.7K',  comments:'116', shares:'58',  isOwn:false, videoUrl: V+'SubaruOutbackOnStreetAndDirt.mp4' },
  { id:'r11',title:'Transition Trick Everyone is Copying', creator:'@TransitionKing',views:'580K',duration:'0:21', gi:5, likes:'4.1K',  comments:'101', shares:'51',  isOwn:false, videoUrl: V+'VolkswagenGTIReview.mp4'          },
  { id:'r12',title:'Lighting Setup for Phone Creators',    creator:'@LightUp',      views:'490K', duration:'0:38', gi:6, likes:'3.5K',  comments:'86',  shares:'43',  isOwn:false, videoUrl: V+'WeAreGoingOnBullrun.mp4'          },
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

const INITIAL_NOTIFS: Notif[] = [
  { id:'n1', type:'like',       icon: Heart,         msg:'@TechDaily liked your video "AI Tools That Changed…"', time:'2m ago',  read:false },
  { id:'n2', type:'comment',    icon: MessageCircle, msg:'@GrowthPro commented: "This is gold!"',                time:'15m ago', read:false },
  { id:'n3', type:'milestone',  icon: TrendingUp,    msg:'Your Short hit 1,000 views!',                          time:'1h ago',  read:false },
  { id:'n4', type:'visibility', icon: Eye,           msg:'Your video is now public',                              time:'3h ago',  read:true  },
  { id:'n5', type:'removed',    icon: Trash2,        msg:'Admin removed "Content Title" for policy violation',   time:'1d ago',  read:true  },
];

const SORT_OPTIONS = ['Trending', 'Latest', 'Most Viewed', 'Top Rated'] as const;
type SortOption = typeof SORT_OPTIONS[number];
type ContentType = 'all' | 'videos' | 'shorts' | 'reels' | 'images';

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

function StatsBar({ views, likes, comments, shares, hidden }: {
  views: string; likes: string; comments: string; shares?: string; hidden: boolean;
}) {
  if (hidden) return <p className="text-[10px] text-gray-400 mt-1 italic">Stats hidden</p>;
  return (
    <div className="flex items-center gap-2.5 mt-1 flex-wrap">
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Eye className="w-3 h-3" />{views}</span>
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Heart className="w-3 h-3" />{likes}</span>
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><MessageCircle className="w-3 h-3" />{comments}</span>
      {shares && <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Share2 className="w-3 h-3" />{shares}</span>}
    </div>
  );
}

// ── FeedSlide component ───────────────────────────────────────────────────────

function FeedSlide({
  item, isActive, isLiked, isSaved, currentIdx, totalCount,
  onClose, onLike, onSave, onNext, onPrev,
}: {
  item: FeedItem; isActive: boolean; isLiked: boolean; isSaved: boolean;
  currentIdx: number; totalCount: number;
  onClose: () => void; onLike: (id: string, kind: string) => void;
  onSave: (id: string, kind: string) => void;
  onNext: () => void; onPrev: () => void;
}) {
  const isPortrait = item.kind === 'short' || item.kind === 'reel';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isActive]);

  return (
    <div
      data-slide="true"
      data-idx={String(currentIdx)}
      className="relative w-full shrink-0 flex items-center justify-center overflow-hidden select-none"
      style={{ height: '100dvh', scrollSnapAlign: 'start', background: G[item.gi % 8] }}
    >
      {/* Ambient vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)' }} />

      {/* Content */}
      {isPortrait ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ height: '85dvh', aspectRatio: '9/16', maxWidth: '380px' }}>
            <div className="absolute inset-0" style={{ background: G[item.gi % 8] }} />
            {item.videoUrl ? (
              <video
                ref={videoRef}
                key={item.videoUrl}
                src={item.videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                muted={muted}
                playsInline
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-50 scale-90'}`}
                  style={isActive ? { animation: 'cfPulse 2.5s ease-in-out infinite' } : {}}>
                  <Play className="w-8 h-8 text-white fill-white translate-x-1" />
                </div>
              </div>
            )}
            {item.duration && (
              <span className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{item.duration}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-10">
          <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: '860px', aspectRatio: item.kind === 'image' ? '4/3' : '16/9' }}>
            <div className="absolute inset-0" style={{ background: G[item.gi % 8] }} />
            {item.videoUrl ? (
              <video
                ref={videoRef}
                key={item.videoUrl}
                src={item.videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                muted={muted}
                playsInline
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                {item.kind !== 'image' ? (
                  <div className={`w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-50 scale-90'}`}
                    style={isActive ? { animation: 'cfPulse 2.5s ease-in-out infinite' } : {}}>
                    <Play className="w-10 h-10 text-white fill-white translate-x-1" />
                  </div>
                ) : (
                  <ImageIcon className="w-16 h-16 text-white/30" />
                )}
              </div>
            )}
            {item.duration && (
              <span className="absolute bottom-3 right-3 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{item.duration}</span>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-16 px-4 flex items-center justify-between z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)' }}>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-[11px] font-medium bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
            {currentIdx + 1} / {totalCount}
          </span>
          {item.videoUrl && (
            <button
              onClick={() => setMuted(m => !m)}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
          aria-label="Close feed"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Right action column */}
      <div className="absolute right-3 sm:right-5 bottom-24 flex flex-col items-center gap-4 z-10">
        <button onClick={() => onLike(item.id, item.kind)} className="flex flex-col items-center gap-1" aria-label={isLiked ? 'Unlike' : 'Like'}>
          <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-all ${isLiked ? 'bg-red-500/90 scale-110' : 'bg-black/40 hover:bg-black/60'}`}>
            <Heart className={`w-5 h-5 ${isLiked ? 'text-white fill-white' : 'text-white'}`} />
          </div>
          <span className="text-white text-[10px] font-bold drop-shadow-md">{item.likes}</span>
        </button>

        <button className="flex flex-col items-center gap-1" aria-label="Comments">
          <div className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur-sm transition-colors">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-bold drop-shadow-md">{item.comments ?? '—'}</span>
        </button>

        <button className="flex flex-col items-center gap-1" aria-label="Share">
          <div className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur-sm transition-colors">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-bold drop-shadow-md">{item.shares ?? 'Share'}</span>
        </button>

        <button onClick={() => onSave(item.id, item.kind)} className="flex flex-col items-center gap-1" aria-label={isSaved ? 'Unsave' : 'Save'}>
          <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-all ${isSaved ? 'bg-amber-400/90 scale-110' : 'bg-black/40 hover:bg-black/60'}`}>
            <Bookmark className={`w-5 h-5 ${isSaved ? 'text-white fill-white' : 'text-white'}`} />
          </div>
          <span className="text-white text-[10px] font-bold drop-shadow-md">{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Bottom info overlay */}
      <div
        className="absolute bottom-0 left-0 right-14 sm:right-20 p-4 sm:p-5 z-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 65%, transparent 100%)' }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white bg-white/20 backdrop-blur-sm shrink-0">
            {(item.creator.charAt(1) ?? 'C').toUpperCase()}
          </div>
          <span className="text-white text-[13px] font-bold">{item.creator}</span>
          <span className="ml-auto capitalize text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/80 backdrop-blur-sm">{item.kind}</span>
        </div>
        <p className="text-white font-bold text-[15px] sm:text-[17px] leading-snug mb-1.5 line-clamp-2">{item.title}</p>
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-[11px] flex items-center gap-1"><Eye className="w-3 h-3" />{item.views}</span>
          {item.duration && <span className="text-white/60 text-[11px] flex items-center gap-1"><Clock className="w-3 h-3" />{item.duration}</span>}
        </div>
      </div>

      {/* Desktop up/down arrows */}
      {currentIdx > 0 && (
        <button onClick={onPrev} className="hidden lg:flex absolute left-6 top-1/2 -translate-y-8 w-10 h-10 rounded-full bg-black/40 items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors z-10" aria-label="Previous">
          <ChevronUp className="w-5 h-5 text-white" />
        </button>
      )}
      {currentIdx < totalCount - 1 && (
        <button onClick={onNext} className="hidden lg:flex absolute left-6 bottom-24 w-10 h-10 rounded-full bg-black/40 items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors z-10" aria-label="Next">
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Mobile swipe hint */}
      {currentIdx === 0 && totalCount > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 lg:hidden z-10">
          <p className="text-white/40 text-[10px] font-medium" style={{ animation: 'cfBounce 1.5s ease-in-out infinite' }}>Swipe up for next</p>
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes cfPulse{0%,100%{opacity:0.75;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes cfBounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-4px)}}
      `}</style>
    </div>
  );
}

// ── FeedView component ────────────────────────────────────────────────────────

function FeedView({
  items, startIndex, onClose,
}: {
  items: FeedItem[]; startIndex: number; onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(startIndex);
  const [likedKeys, setLikedKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // Scroll to start on mount (instant)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.querySelector(`[data-idx="${startIndex}"]`) as HTMLElement | null;
    if (slide) container.scrollTop = slide.offsetTop;
  }, [startIndex]);

  // IntersectionObserver — track active slide
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            setActiveIdx(parseInt((entry.target as HTMLElement).dataset['idx'] ?? '0', 10));
          }
        });
      },
      { root: container, threshold: 0.55 },
    );
    const slides = container.querySelectorAll('[data-slide]');
    slides.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); navigateTo(Math.min(activeIdx + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); navigateTo(Math.max(activeIdx - 1, 0)); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, items.length, onClose]);

  function navigateTo(idx: number) {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null;
    slide?.scrollIntoView({ behavior: 'smooth' });
  }

  function toggleLike(id: string, kind: string) {
    const k = `${id}-${kind}`;
    setLikedKeys(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  function toggleSave(id: string, kind: string) {
    const k = `${id}-${kind}`;
    setSavedKeys(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-[250] bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-lg font-bold mb-2">No content to show</p>
          <button onClick={onClose} className="text-sm text-white/60 hover:text-white underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[250] bg-black" role="dialog" aria-label="Content feed">
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {items.map((item, idx) => (
          <FeedSlide
            key={`${item.id}-${item.kind}`}
            item={item}
            isActive={activeIdx === idx}
            isLiked={likedKeys.has(`${item.id}-${item.kind}`)}
            isSaved={savedKeys.has(`${item.id}-${item.kind}`)}
            currentIdx={idx}
            totalCount={items.length}
            onClose={onClose}
            onLike={toggleLike}
            onSave={toggleSave}
            onNext={() => navigateTo(Math.min(idx + 1, items.length - 1))}
            onPrev={() => navigateTo(Math.max(idx - 1, 0))}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const [authChecked, setAuthChecked] = useState(false);
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
  // Feed mode
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartIdx, setFeedStartIdx] = useState(0);
  // Voice search
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const sortRef    = useRef<HTMLDivElement>(null);
  const bellRef    = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // useLayoutEffect fires synchronously before the browser paints → eliminates
  // the auth state flash (guest UI briefly visible before logged-in UI) on mobile.
  useLayoutEffect(() => {
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
    setAuthChecked(true);
    setVoiceSupported(
      typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    );
  }, []);

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
  }, [saveToGroupVideoId]);

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
    setGroups(prev => [...prev, { id:`g-${Date.now()}`, name:newGroupName.trim(), count:0, color:colors[idx]!, emoji:emojis[idx]! }]);
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

  // Voice search
  const startVoiceSearch = useCallback(() => {
    const SR = (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) return;
    // @reason: dynamic browser API, no TS type available without webkitSpeechRecognition lib
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setVoiceActive(true);
    recognition.onresult = (e: { results: { [0]: { [0]: { transcript: string } } } }) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        handleSearch(transcript);
        saveSearchHistory(transcript);
        if (searchRef.current) searchRef.current.value = transcript;
      }
      setVoiceActive(false);
    };
    recognition.onerror = () => setVoiceActive(false);
    recognition.onend = () => setVoiceActive(false);
    recognition.start();
  }, [handleSearch, saveSearchHistory]);

  const unreadCount = notifs.filter(n => !n.read).length;

  // Filtered content
  const q = search.trim();
  const filteredVideos = VIDEOS.filter(v => matchSearch(v.title, v.creator, q));
  const filteredShorts = SHORTS.filter(s => matchSearch(s.title, s.creator, q));
  const filteredReels  = REELS.filter(r  => matchSearch(r.title, r.creator, q));
  const filteredImages = IMAGES.filter(i => matchSearch(i.title, i.creator, q));

  // Feed items — order: shorts/reels first (portrait), then videos, then images
  const feedItems = useMemo<FeedItem[]>(() => [
    ...filteredShorts.map(s => ({ id:s.id, title:s.title, creator:s.creator, gi:s.gi, duration:s.duration, kind:'short' as const, views:s.views, likes:s.likes, comments:s.comments, shares:s.shares, videoUrl:s.videoUrl })),
    ...filteredReels.map(r  => ({ id:r.id, title:r.title, creator:r.creator, gi:r.gi, duration:r.duration, kind:'reel'  as const, views:r.views, likes:r.likes, comments:r.comments, shares:r.shares, videoUrl:r.videoUrl })),
    ...filteredVideos.map(v => ({ id:v.id, title:v.title, creator:v.creator, gi:v.gi, duration:v.duration, kind:'video' as const, views:v.views, likes:v.likes, comments:v.comments, shares:v.shares, videoUrl:v.videoUrl })),
    ...filteredImages.map(i => ({ id:i.id, title:i.title, creator:i.creator, gi:i.gi, kind:'image' as const, views:i.views, likes:i.likes })),
  ], [filteredShorts, filteredReels, filteredVideos, filteredImages]);

  function openFeed(itemId: string, kind: FeedItem['kind']) {
    const idx = feedItems.findIndex(f => f.id === itemId && f.kind === kind);
    setFeedStartIdx(idx >= 0 ? idx : 0);
    setFeedOpen(true);
  }

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

      {/* ── Header ────────────────────────────────────────────────────────────── */}
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

        {/* Search + Voice */}
        <form
          className="flex-1 max-w-lg relative"
          onSubmit={e => { e.preventDefault(); saveSearchHistory(search); }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            placeholder={voiceActive ? 'Listening…' : `Search ${activeLabel.toLowerCase()}… (press /)`}
            value={search}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveSearchHistory(search); }}
            className={`w-full pl-9 py-2 text-sm rounded-full border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400 transition-all placeholder:text-gray-400 ${voiceActive ? 'border-red-400 bg-red-50' : 'border-gray-200'} ${(search || voiceSupported) ? 'pr-16' : 'pr-4'}`}
          />
          {/* Clear */}
          {search && (
            <button type="button" onClick={() => handleSearch('')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Voice search */}
          {voiceSupported && (
            <button
              type="button"
              onClick={startVoiceSearch}
              disabled={voiceActive}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${voiceActive ? 'text-red-500 bg-red-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              aria-label="Voice search"
              title="Search by voice"
            >
              <Mic className={`w-3.5 h-3.5 ${voiceActive ? 'animate-pulse' : ''}`} />
            </button>
          )}
        </form>

        {/* Voice indicator */}
        {voiceActive && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-red-600">Listening…</span>
          </div>
        )}

        {/* Right: auth icons */}
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
                        <button onClick={markAllRead} className="text-[11px] font-bold text-gray-700 hover:text-gray-900">Mark all read</button>
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
                            <li key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${n.read ? '' : 'bg-gray-50'}`}>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.type === 'removed' ? 'bg-red-100' : 'bg-gray-100'}`}>
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background:'linear-gradient(135deg,#374151,#0891B2)' }}>
                    {userName.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700 hidden sm:block max-w-[80px] truncate">{userName}</span>
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                    <div className="px-4 py-3.5 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0" style={{ background:'linear-gradient(135deg,#374151,#0891B2)' }}>
                          {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 truncate">{userName}</p>
                          {userEmail && <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <Link href="/account" onClick={() => setAccountOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left font-medium">
                        <History className="w-4 h-4 text-gray-400 shrink-0" />Watch History
                      </Link>
                      <button onClick={() => setShowSearchHistory(v => !v)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left font-medium">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />Search History
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-auto transition-transform ${showSearchHistory ? 'rotate-180' : ''}`} />
                      </button>
                      {showSearchHistory && (
                        <div className="ml-9 mb-1 space-y-0.5">
                          {searchHistory.length === 0 ? (
                            <p className="text-[11px] text-gray-400 px-2 py-1">No recent searches</p>
                          ) : (
                            searchHistory.slice(0, 5).map((s, i) => (
                              <button key={i} onClick={() => { handleSearch(s); setAccountOpen(false); }}
                                className="w-full text-left px-2 py-1 rounded-lg text-[11px] text-gray-600 hover:bg-gray-100 transition-colors truncate">
                                {s}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      <div className="h-px bg-gray-100 my-1.5 mx-2" />
                      <Link href="/settings" onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                        <Settings className="w-4 h-4 text-gray-400 shrink-0" />Settings
                      </Link>
                      <Link href="/home" onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        Creator Dashboard
                      </Link>
                    </div>
                    <div className="p-2 pt-0">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors text-left font-medium border-t border-gray-100">
                        <LogOut className="w-4 h-4 shrink-0" />Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Create icon — opens become-creator flow */}
              <Link href="/become-creator"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Start creating"
                title="Start Creating"
              >
                <Plus className="w-[18px] h-[18px] text-gray-600" />
              </Link>
              {/* Account / login icon */}
              <Link href="/login?from=app"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Sign in"
                title="Sign In"
              >
                <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
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
            <div className="flex items-center justify-between mb-3 lg:hidden">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Browse</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pb-1">Content Type</p>
            {([
              { id:'all',    label:'All Videos', Icon:Grid3X3   },
              { id:'videos', label:'Videos',     Icon:Play      },
              { id:'shorts', label:'Shorts',     Icon:Scissors  },
              { id:'reels',  label:'Reels',      Icon:Film      },
              { id:'images', label:'Images',     Icon:ImageIcon },
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

            {isLoggedIn && (
              <div className="pt-3">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">My Video Groups</p>
                  <button onClick={() => setShowCreateGroup(v => !v)}
                    className="text-[10px] font-bold text-gray-700 hover:text-gray-900 flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />New
                  </button>
                </div>
                {showCreateGroup && (
                  <div className="mx-2 mb-2 flex gap-1.5">
                    <input
                      autoFocus type="text" value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowCreateGroup(false); }}
                      placeholder="e.g. My Favorites…"
                      className="flex-1 min-w-0 text-[11px] border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                    />
                    <button onClick={handleCreateGroup} className="px-2 py-1 rounded-lg bg-gray-800 text-white text-[11px] font-bold shrink-0">Add</button>
                  </div>
                )}
                <div className="space-y-0.5">
                  {groups.length === 0 ? (
                    <p className="text-[11px] text-gray-400 px-3 py-2 leading-relaxed">
                      Save videos to your first group using the <Bookmark className="w-3 h-3 inline-block" /> on any video.
                    </p>
                  ) : groups.map(g => (
                    <button key={g.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left">
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
                  <History className="w-3.5 h-3.5 shrink-0 text-gray-400" />My Library
                </Link>
              </div>
            )}

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

          {/* ── Sponsored / Ad Videos ─────────────────────────────────────────── */}
          <section className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">Sponsored</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { gi:0, title:'Grow your YouTube channel 10x faster with AI', label:'SozialZynk Pro', duration:'2:30', tag:'AI Tools' },
                { gi:1, title:'How top creators monetize in 2025 — the playbook', label:'Creator Academy', duration:'8:15', tag:'Monetization' },
                { gi:2, title:'Zero to 100K subscribers: step-by-step blueprint', label:'CreatorForce', duration:'12:00', tag:'Growth' },
              ] as { gi:number; title:string; label:string; duration:string; tag:string }[]).map((ad, i) => (
                <Link
                  key={i}
                  href="/become-creator"
                  className="group relative rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer block"
                >
                  <div className="relative h-36" style={{ background: ['linear-gradient(135deg,#0c1445,#1e3a8a)','linear-gradient(135deg,#1a0845,#4c1d95)','linear-gradient(135deg,#0a2a1a,#065f46)'][ad.gi] }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{ad.duration}</span>
                    <span className="absolute top-2 left-2 bg-amber-400/90 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Ad</span>
                  </div>
                  <div className="bg-white p-3">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{ad.tag}</span>
                    <p className="text-[12px] font-semibold text-gray-900 leading-snug mt-0.5 line-clamp-2">{ad.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{ad.label}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

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
                {/* Feed mode toggle */}
                <button
                  onClick={() => { setFeedStartIdx(0); setFeedOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#374151,#1e3a8a)' }}
                  title="Watch as feed"
                >
                  <Play className="w-3 h-3 fill-white" />
                  Watch Feed
                </button>
                {/* Grid/List toggle */}
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
                {/* Sort */}
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
                          <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative"
                            onClick={() => openFeed(v.id, 'video')}>
                            <LandscapeThumb gi={v.gi} duration={v.duration} />
                            {isLoggedIn && v.isOwn && (
                              <button onClick={e => { e.stopPropagation(); toggleStats(v.id); }}
                                className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title={statsHidden[v.id] ? 'Show stats' : 'Hide stats'}>
                                {statsHidden[v.id] ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-white" />}
                              </button>
                            )}
                            {isLoggedIn && (
                              <div className="cf-save-group-panel absolute top-2 right-2 z-10">
                                <button onClick={e => { e.stopPropagation(); setSaveToGroupVideoId(saveToGroupVideoId === v.id ? null : v.id); }}
                                  className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Save to Video Group">
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
                          <div key={v.id} className="group bg-white rounded-xl border border-gray-100 flex gap-3 p-3 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => openFeed(v.id, 'video')}>
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
                                  className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors" title="Save to Video Group">
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
                        <div key={s.id} className="group cursor-pointer relative" onClick={() => openFeed(s.id, 'short')}>
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
                  </div>
                )}

                {filteredReels.length > 0 && (
                  <div>
                    {!search && <h3 className="text-[15px] font-bold text-gray-900 mb-4">Reels</h3>}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredReels.map(r => (
                        <div key={r.id} className="group cursor-pointer" onClick={() => openFeed(r.id, 'reel')}>
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
                        <div key={i.id} className="group cursor-pointer" onClick={() => openFeed(i.id, 'image')}>
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
                    <p className="text-sm font-semibold text-gray-500">No content found for &quot;{search}&quot;</p>
                    <button onClick={() => handleSearch('')} className="mt-3 text-[12px] text-gray-500 underline hover:text-gray-700">Clear search</button>
                  </div>
                )}
              </div>
            )}

            {/* VIDEOS only */}
            {contentType === 'videos' && (
              filteredVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Search className="w-10 h-10 mb-3 opacity-25" />
                  <p className="text-sm font-semibold text-gray-500">No Videos found</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredVideos.map(v => (
                    <div key={v.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                      onClick={() => openFeed(v.id, 'video')}>
                      <LandscapeThumb gi={v.gi} duration={v.duration} />
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
                    <div key={v.id} className="group bg-white rounded-xl border border-gray-100 flex gap-3 p-3 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => openFeed(v.id, 'video')}>
                      <div className="flex-none w-32"><LandscapeThumb gi={v.gi} duration={v.duration} size="sm" /></div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[13px] font-bold text-gray-900 line-clamp-2">{v.title}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{v.creator} · {v.time}</p>
                        <StatsBar views={v.views} likes={v.likes} comments={v.comments} shares={v.shares} hidden={!!statsHidden[v.id]} />
                      </div>
                    </div>
                  ))}
                </div>
              )
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
                    <div key={s.id} className="group cursor-pointer relative" onClick={() => openFeed(s.id, 'short')}>
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
                    <div key={r.id} className="group cursor-pointer" onClick={() => openFeed(r.id, 'reel')}>
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
                    <div key={i.id} className="group cursor-pointer" onClick={() => openFeed(i.id, 'image')}>
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

      {/* ── Feed View (TikTok/Reels-style) ──────────────────────────────────── */}
      {feedOpen && (
        <FeedView
          items={feedItems}
          startIndex={feedStartIdx}
          onClose={() => setFeedOpen(false)}
        />
      )}

    </div>
  );
}
