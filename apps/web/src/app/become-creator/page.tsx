import Link from 'next/link';
import {
  Zap, Film, Bot, ArrowRight, CheckCircle2, ChevronRight, Sparkles, ShieldCheck,
  Globe2, Star, LineChart, MessageSquare, Target, Users, Calendar,
  FolderOpen, Check, Minus,
} from 'lucide-react';
import { MobileNav } from '../_components/MobileNav';
import { LogoMark } from '@/components/logo-mark';
import { PwaInstallButtonLanding } from '@/components/pwa-install';
import { HeroVideo } from '@/components/hero-video';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Creator · SozialZynk',
  description: 'Join 100,000+ creators using AI to research, script, create, and publish content across every platform. Start free today.',
};

const CAPABILITIES = [
  { icon: Bot,           color: '#9ca3af', bg: 'rgba(156,163,175,.12)', title: 'AI Copilot (Voice)',     desc: 'Voice-enabled robot assistant. Speak to plan, create, and manage your channel — live transcript + chest-panel mic.' },
  { icon: Zap,           color: '#fbbf24', bg: 'rgba(251,191,36,.10)',   title: 'Trend Discovery',         desc: 'Surfaces trending topics before they peak so you create content while the audience is growing.' },
  { icon: Target,        color: '#f472b6', bg: 'rgba(244,114,182,.10)',  title: 'Research & Fact-Check',   desc: 'ResearchAgent gathers source material; FactCheckAgent verifies every claim before it reaches your script.' },
  { icon: Sparkles,      color: '#818cf8', bg: 'rgba(129,140,248,.10)',  title: 'AI Script Writer',        desc: 'Monetization-compliant, fact-checked scripts in your brand voice — with hooks, CTAs, and platform SEO baked in.' },
  { icon: Users,         color: '#22d3ee', bg: 'rgba(34,211,238,.10)',   title: 'Character Studio',        desc: 'Generate original AI characters and avatars for your videos, thumbnails, and brand identity.' },
  { icon: Star,          color: '#f87171', bg: 'rgba(248,113,113,.10)',  title: 'AI Thumbnails & Images',  desc: 'Eye-catching thumbnails and storyboard frames generated in seconds — sized for every platform.' },
  { icon: Globe2,        color: '#34d399', bg: 'rgba(52,211,153,.10)',   title: 'Voice & Audio Studio',    desc: 'Text-to-speech narration, multi-voice synthesis, and AI music — all with your brand voice profile.' },
  { icon: Film,          color: '#60a5fa', bg: 'rgba(96,165,250,.10)',   title: 'Shorts Studio',           desc: 'AI finds the best moments from long videos, adds captions and hooks, and exports viral Shorts.' },
  { icon: ShieldCheck,   color: '#34d399', bg: 'rgba(52,211,153,.10)',   title: 'Compliance Engine',       desc: 'Every piece of content passes copyright, platform monetization policy, and fact-check gates automatically.' },
  { icon: Calendar,      color: '#9ca3af', bg: 'rgba(156,163,175,.12)',  title: 'Publish & Autopilot',     desc: 'Schedule at peak times, review before publish, or let Autopilot handle the full pipeline hands-free.' },
  { icon: LineChart,     color: '#fbbf24', bg: 'rgba(251,191,36,.10)',   title: 'A/B Testing',             desc: 'Test titles and thumbnails on live videos. AI picks the winner — more clicks, better rankings.' },
  { icon: MessageSquare, color: '#22d3ee', bg: 'rgba(34,211,238,.10)',   title: 'Channel Analytics',       desc: 'All your performance metrics in one place. AI recommends what to create next based on what actually works.' },
];

const WORKFLOW = [
  { icon: Target,      label: 'Discover', sub: 'Trending topics and competitor gaps identified' },
  { icon: Globe2,      label: 'Research', sub: 'Sources gathered, facts verified by AI agent' },
  { icon: Sparkles,    label: 'Script',   sub: 'Monetization-compliant script written for you' },
  { icon: Bot,         label: 'Create',   sub: 'Voice, characters, images and video generated' },
  { icon: ShieldCheck, label: 'Comply',   sub: 'Compliance check before anything leaves the platform' },
  { icon: LineChart,   label: 'Publish',  sub: 'Scheduled at optimal time, results tracked' },
];

const STEPS = [
  { n: '1', icon: Target,   title: 'Connect your channels', desc: 'Link YouTube, Instagram, TikTok, and more. SozialZynk handles the rest.' },
  { n: '2', icon: Sparkles, title: 'Describe your idea',    desc: 'Speak or type what you want to create. AI researches, writes, and builds everything.' },
  { n: '3', icon: Globe2,   title: 'Review & publish',      desc: 'Approve in one click or let Autopilot schedule and post at peak times.' },
];

const TESTIMONIALS = [
  { name: 'Marcus Chen',     handle: '@marcustech',  avatar: 'M', color: '#374151', text: "Went from 5K to 150K in 6 months. The AI research finds angles I'd never have thought of.", stat: '150K followers' },
  { name: 'Priya Sharma',    handle: '@priyacooks',  avatar: 'P', color: '#059669', text: 'I publish on 4 platforms now and spend less time on content than when I was on one.', stat: '4× platform reach' },
  { name: 'Jordan Williams', handle: '@jordanlifts', avatar: 'J', color: '#DC2626', text: 'The compliance engine saved me from a demonetization warning. It catches what I miss.', stat: '0 policy strikes' },
];

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Get the App',  href: '#download' },
  { label: 'Pricing',      href: '#pricing' },
];

export default function BecomeCreatorPage() {
  return (
    <>
      <style>{`
        html { scroll-behavior: smooth; }
        .glow-ring { box-shadow: 0 0 0 1px rgba(55,65,81,.2), 0 0 60px rgba(55,65,81,.3), 0 0 120px rgba(55,65,81,.1); }
        @keyframes float-slow { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        .float-slow { animation: float-slow 6s ease-in-out infinite; }
        @keyframes pulse-soft { 0%,100% { opacity:.6; } 50% { opacity:1; } }
        .pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
        @keyframes float-a { 0%,100%{transform:translateY(0) rotateX(0deg) rotateY(0deg)} 33%{transform:translateY(-12px) rotateX(4deg) rotateY(-3deg)} 66%{transform:translateY(-6px) rotateX(-2deg) rotateY(5deg)} }
        @keyframes float-b { 0%,100%{transform:translateY(0) rotateX(0deg) rotateY(0deg)} 40%{transform:translateY(-8px) rotateX(-3deg) rotateY(4deg)} 70%{transform:translateY(-14px) rotateX(5deg) rotateY(-2deg)} }
        @keyframes float-c { 0%,100%{transform:translateY(0) rotateX(2deg) rotateY(0deg)} 50%{transform:translateY(-16px) rotateX(-3deg) rotateY(-4deg)} }
        @keyframes orb-pulse { 0%,100%{transform:scale(1);opacity:.12} 50%{transform:scale(1.12);opacity:.22} }
        @keyframes gradient-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin-slow { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes spin-rev { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
        @keyframes count-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dash-travel { to { stroke-dashoffset: -20; } }
        @keyframes bc-pop { from{opacity:0;transform:translateY(12px) scale(.97)} to{opacity:1;transform:none} }
        .card-3d { transform-style:preserve-3d; transition:transform 0.45s ease,box-shadow 0.45s ease; }
        .card-3d:hover { transform:perspective(900px) rotateX(-5deg) rotateY(7deg) translateZ(10px) scale(1.02); box-shadow:0 32px 64px -12px rgba(55,65,81,0.45); }
        .float-a { animation:float-a 7s ease-in-out infinite; }
        .float-b { animation:float-b 9s ease-in-out infinite; }
        .float-c { animation:float-c 11s ease-in-out infinite; }
        .gradient-animated { background-size:200% 200%; animation:gradient-shift 4s ease infinite; }
        .shimmer-btn { background: linear-gradient(90deg,#9ca3af,#374151,#818cf8,#374151,#9ca3af); background-size:300% 100%; animation:shimmer 3s linear infinite; }
        .orb-pulse { animation:orb-pulse 6s ease-in-out infinite; }
        .spin-slow { animation:spin-slow 30s linear infinite; }
        .spin-rev  { animation:spin-rev  45s linear infinite; }
        .count-up-1 { animation:count-up 0.6s ease forwards 0.2s; opacity:0; }
        .count-up-2 { animation:count-up 0.6s ease forwards 0.4s; opacity:0; }
        .count-up-3 { animation:count-up 0.6s ease forwards 0.6s; opacity:0; }
        .dash-travel { animation:dash-travel 1.2s linear infinite; }
        .bc-pop-1 { animation:bc-pop .5s ease forwards .1s; opacity:0; }
        .bc-pop-2 { animation:bc-pop .5s ease forwards .25s; opacity:0; }
        .bc-pop-3 { animation:bc-pop .5s ease forwards .4s; opacity:0; }
        .glass-card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); backdrop-filter:blur(12px); }
        .glass-card:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.14); }
      `}</style>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl" style={{background:'rgba(14,9,36,.85)'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/explore" className="flex items-center gap-2.5 shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="SozialZynk — Go to public feed">
              <LogoMark className="w-9 h-9 shrink-0" variant="light" />
              <span className="font-bold text-lg leading-none hidden sm:block tracking-[-0.4px]">
                <span className="text-white">Sozial</span><span style={{color:'#d1d5db'}}>Z</span><span className="text-white">ynk</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
              {NAV_LINKS.map(({ label, href }) => (
                <a key={href} href={href} className="px-4 py-2 rounded-lg text-white/70 text-sm font-medium hover:text-white hover:bg-white/8 transition-colors min-h-[44px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  {label}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              <Link href="/login" className="px-4 py-2 rounded-xl text-white/80 text-sm font-semibold hover:text-white hover:bg-white/8 transition-colors min-h-[44px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Log in
              </Link>
              <Link href="/register" className="px-5 py-2 rounded-xl text-sm font-bold shadow-lg min-h-[44px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all hover:opacity-90" style={{background:'linear-gradient(135deg,#9ca3af,#374151)',color:'#fff'}}>
                Get started free
              </Link>
            </div>

            <MobileNav />
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section aria-label="Hero" className="relative overflow-hidden" style={{background:'radial-gradient(ellipse at 20% 50%, #0f172a 0%, #0a0520 50%, #000814 100%)'}}>

          {/* Perspective grid */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden" style={{opacity:.06}}>
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gfade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="1"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
                <mask id="gmask"><rect width="100%" height="100%" fill="url(#gfade)"/></mask>
              </defs>
              <g mask="url(#gmask)" stroke="white" strokeWidth="0.5">
                {[10,20,30,40,50,60,70,80,90].map(x => (
                  <line key={x} x1={`${x}%`} y1="0" x2="50%" y2="100%"/>
                ))}
                {[10,20,30,40,50,60,70,80,90].map((y,i) => (
                  <line key={i} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`}/>
                ))}
              </g>
            </svg>
          </div>

          {/* Animated orbs */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="orb-pulse absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full" style={{background:'radial-gradient(ellipse,#374151 0%,transparent 68%)',filter:'blur(30px)'}} />
            <div className="orb-pulse absolute top-1/3 left-[5%] w-80 h-80 rounded-full" style={{background:'#1e3a5f',filter:'blur(70px)',animationDelay:'2s'}} />
            <div className="orb-pulse absolute top-1/4 right-[5%] w-60 h-60 rounded-full" style={{background:'#374151',filter:'blur(60px)',animationDelay:'4s'}} />
            <div className="orb-pulse absolute bottom-0 right-1/3 w-96 h-96 rounded-full" style={{background:'#1e1b4b',filter:'blur(80px)',animationDelay:'1s'}} />
            <div className="spin-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full" style={{border:'1px solid rgba(156,163,175,.1)'}} />
            <div className="spin-rev absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full" style={{border:'1px solid rgba(55,65,81,.06)'}} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-36 text-center">

            {/* Trust badge */}
            <div className="bc-pop-1 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 mb-8 text-sm font-medium" style={{background:'rgba(55,65,81,.18)',backdropFilter:'blur(12px)',color:'rgba(255,255,255,.85)'}}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Join 100,000+ creators already publishing smarter
            </div>

            {/* Headline */}
            <h1 className="bc-pop-2 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight max-w-5xl mx-auto">
              Turn ideas into content
              <br />
              <span className="gradient-animated" style={{background:'linear-gradient(90deg,#d1d5db,#818cf8,#9ca3af,#d1d5db)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                that grows everywhere
              </span>
            </h1>

            <p className="bc-pop-3 mt-6 text-base sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              SozialZynk runs your entire content creation pipeline — from trend research to compliance-checked multi-platform publishing.{' '}
              <span className="text-white/80">Your AI content team, available 24/7.</span>
            </p>

            {/* Live counter */}
            <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full" style={{background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.25)',color:'rgba(167,243,208,.9)'}}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              12 creators joined in the last hour
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="shimmer-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base shadow-2xl transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{boxShadow:'0 20px 50px -12px rgba(55,65,81,.65)'}}>
                <Zap className="w-4 h-4" />
                Create my free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#workflow" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white text-base transition-all hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{border:'1.5px solid rgba(255,255,255,.2)',backdropFilter:'blur(8px)'}}>
                See how it works
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <p className="mt-4 text-sm" style={{color:'rgba(255,255,255,.35)'}}>Free to start · No credit card required · Cancel any time</p>

            {/* Floating stat cards */}
            <div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-6">
              <div className="float-a count-up-1 px-5 py-3.5 rounded-2xl text-center" style={{background:'rgba(255,255,255,.06)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.12)'}}>
                <p className="text-2xl font-extrabold text-white">100K+</p>
                <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,.5)'}}>Creators building</p>
              </div>
              <div className="float-b count-up-2 px-5 py-3.5 rounded-2xl text-center" style={{background:'rgba(255,255,255,.06)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.12)'}}>
                <p className="text-2xl font-extrabold text-white">5M+</p>
                <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,.5)'}}>Scripts generated</p>
              </div>
              <div className="float-c count-up-3 px-5 py-3.5 rounded-2xl text-center" style={{background:'rgba(255,255,255,.06)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.12)'}}>
                <p className="text-2xl font-extrabold text-white">4.8★</p>
                <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,.5)'}}>Creator rating</p>
              </div>
            </div>

            {/* Platform pills */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs font-medium mr-2" style={{color:'rgba(255,255,255,.35)'}}>Publish to</span>
              {[
                { label: 'YouTube',   bg: '#FF0000',                                                          short: 'YT', border: undefined },
                { label: 'Instagram', bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', short: 'IG', border: undefined },
                { label: 'TikTok',   bg: '#010101',                                                          short: 'TT', border: '1px solid rgba(255,255,255,.15)' },
                { label: 'LinkedIn', bg: '#0A66C2',                                                          short: 'LI', border: undefined },
                { label: 'Twitter',  bg: '#1DA1F2',                                                          short: 'X',  border: undefined },
              ].map(({ label, bg, short, border }) => (
                <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white opacity-70" style={{background:bg, border: border ?? 'none'}}>
                  <span className="opacity-90">{short}</span>
                  <span className="hidden sm:inline opacity-80">{label}</span>
                </span>
              ))}
              <span className="text-xs font-medium ml-1" style={{color:'rgba(255,255,255,.25)'}}>+ more</span>
            </div>

            {/* Hero visual */}
            <div className="mt-10 sm:mt-16 max-w-4xl mx-auto float-slow" style={{filter:'drop-shadow(0 0 60px rgba(55,65,81,.35))'}}>
              <HeroVideo />
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm font-medium">
              {[
                { icon: CheckCircle2, label: 'No credit card required' },
                { icon: ShieldCheck,  label: 'Compliance built in' },
                { icon: Zap,          label: 'Publish in minutes' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2" style={{color:'rgba(255,255,255,.5)'}}>
                  <Icon className="w-4 h-4" style={{color:'#9ca3af'}} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section aria-label="Social proof" style={{background:'rgba(255,255,255,.03)',borderTop:'1px solid rgba(255,255,255,.06)',borderBottom:'1px solid rgba(255,255,255,.06)'}} className="py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { stat: '100K+ Creators', label: 'Publishing with AI' },
                { stat: '10× Faster',     label: 'Than manual research' },
                { stat: '5M+ Scripts',    label: 'AI-generated & published' },
                { stat: 'Zero',           label: 'Manual repurposing needed' },
              ].map(({ stat, label }) => (
                <div key={stat} className="flex flex-col items-center gap-1">
                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{stat}</p>
                  <p className="text-xs mt-1" style={{color:'rgba(255,255,255,.4)'}}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="workflow" aria-labelledby="steps-heading" style={{background:'#060414'}} className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>How it works</p>
              <h2 id="steps-heading" className="text-3xl sm:text-4xl font-extrabold text-white">
                From idea to published in minutes
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map(({ n, icon: Icon, title, desc }) => (
                <div key={n} className="glass-card relative rounded-3xl p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-3xl font-extrabold" style={{color:'rgba(255,255,255,.1)'}}>0{n}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-[17px] mb-1.5">{title}</h3>
                    <p className="text-sm leading-relaxed" style={{color:'rgba(255,255,255,.5)'}}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CAPABILITIES ── */}
        <section id="features" aria-labelledby="features-heading" style={{background:'rgba(255,255,255,.02)'}} className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>Full capability suite</p>
              <h2 id="features-heading" className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Everything you need to grow,
                <br className="hidden sm:block" />
                <span style={{color:'#9ca3af'}}> powered by AI</span>
              </h2>
              <p className="mt-5 text-lg max-w-2xl mx-auto leading-relaxed" style={{color:'rgba(255,255,255,.5)'}}>
                One platform for your entire content stack. From trend discovery to multi-platform publishing — all connected.
              </p>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Platform capabilities">
              {CAPABILITIES.map(({ icon: Icon, color, bg, title, desc }) => (
                <li key={title} className="card-3d glass-card group rounded-2xl p-5 flex flex-col gap-3 transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{background:bg}}>
                    <Icon className="w-5 h-5" style={{color}} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm leading-snug">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed" style={{color:'rgba(255,255,255,.45)'}}>{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── FULL PIPELINE ── */}
        <section aria-labelledby="pipeline-heading" style={{background:'#060414'}} className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>End-to-end AI pipeline</p>
              <h2 id="pipeline-heading" className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                From one idea,
                <span style={{color:'#9ca3af'}}> to a published video</span>
              </h2>
              <p className="mt-5 text-lg max-w-2xl mx-auto" style={{color:'rgba(255,255,255,.5)'}}>
                Tell SozialZynk what you want to create. It researches, writes, checks compliance, and publishes to all your channels.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 sm:gap-4">
              {WORKFLOW.map(({ icon: Icon, label, sub }, idx) => (
                <div key={label} className="relative flex flex-col items-center text-center group">
                  {idx < WORKFLOW.length - 1 && (
                    <div aria-hidden="true" className="hidden lg:block absolute top-8 left-[calc(50%+28px)] right-0 h-3 overflow-hidden">
                      <svg width="100%" height="12" className="absolute inset-0">
                        <line x1="0" y1="6" x2="100%" y2="6" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeDasharray="6 4" className="dash-travel" />
                      </svg>
                    </div>
                  )}

                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4 transition-transform group-hover:scale-110 group-hover:shadow-lg" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                    <Icon className="w-7 h-7 text-white" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.2)'}}>
                      {idx + 1}
                    </div>
                  </div>

                  <h3 className="font-bold text-white text-sm leading-tight mb-1">{label}</h3>
                  <p className="text-xs leading-relaxed max-w-[140px]" style={{color:'rgba(255,255,255,.5)'}}>{sub}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-14">
              <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-2xl" style={{background:'linear-gradient(135deg,#9ca3af,#374151)',boxShadow:'0 16px 40px -10px rgba(55,65,81,.5)'}}>
                <Zap className="w-4 h-4" />
                Start your first AI project
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="mt-3 text-sm" style={{color:'rgba(255,255,255,.35)'}}>Free to start · No credit card required</p>
            </div>
          </div>
        </section>

        {/* ── AI COPILOT DEMO ── */}
        <section aria-label="AI Copilot demo" style={{background:'rgba(255,255,255,.02)'}} className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>Natural language first</p>
                <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  No forms.<br />No menus.<br />
                  <span style={{color:'#9ca3af'}}>Just conversation.</span>
                </h2>
                <p className="mt-6 text-lg leading-relaxed" style={{color:'rgba(255,255,255,.55)'}}>
                  SozialZynk&apos;s AI Copilot works like an experienced content manager. Tell it what you need — it researches trends, writes compliant scripts, generates assets, and gets your content published everywhere.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    { t: 'Full content pipeline',   d: 'One conversation handles research, scripting, visuals, voice, and multi-platform publishing.' },
                    { t: 'Voice & text input',       d: 'Speak or type — the Copilot understands both.' },
                    { t: 'Multi-language support',   d: 'Responds in your language: English, Hindi, Tamil, and 30+ more.' },
                    { t: 'Brand voice memory',        d: 'Remembers your tone and style so every script sounds authentically like you.' },
                  ].map(({ t, d }) => (
                    <li key={t} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background:'rgba(255,255,255,.1)'}}>
                        <CheckCircle2 className="w-3.5 h-3.5" style={{color:'#9ca3af'}} />
                      </div>
                      <div>
                        <span className="font-semibold text-white text-sm">{t}</span>
                        <span className="text-sm" style={{color:'rgba(255,255,255,.5)'}}> — {d}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-10">
                  <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                    Try the AI Copilot <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Copilot visual */}
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl" style={{background:'radial-gradient(ellipse at 50% 50%,rgba(55,65,81,.08) 0%,transparent 70%)'}} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{background:'#1a1033',border:'1px solid rgba(255,255,255,.08)'}}>
                  <div className="p-5 space-y-4">
                    <div className="flex justify-center py-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{background:'linear-gradient(135deg,#9ca3af,#374151)',boxShadow:'0 0 0 12px rgba(55,65,81,.12),0 0 0 24px rgba(55,65,81,.06)'}}>
                          <Bot className="w-9 h-9 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{background:'#10B981',border:'2px solid #1a1033'}}>
                          <div className="w-2 h-2 rounded-full bg-white pulse-soft" />
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-xs font-medium" style={{color:'rgba(255,255,255,.5)'}}>Copilot ready · Listening…</p>

                    <div className="space-y-3 pt-2">
                      {[
                        { role:'ai',  text:"What content would you like to create today?" },
                        { role:'user',text:"Research trending topics and write 3 scripts." },
                        { role:'ai',  text:"ResearchAgent found 8 trending gaps in your niche. Writing 3 fact-checked scripts now." },
                        { role:'user',text:"Great. Add thumbnails and voice narration." },
                        { role:'ai',  text:"Done! 3 scripts, 3 thumbnails, 3 voice tracks — all passed compliance. Ready to schedule?" },
                      ].map(({ role, text }, i) => (
                        <div key={i} className={`flex ${role==='user'?'flex-row-reverse':''} items-end gap-2`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${role==='ai'?'':'opacity-90'}`} style={{background:role==='ai'?'linear-gradient(135deg,#9ca3af,#374151)':'linear-gradient(135deg,#f472b6,#ec4899)',color:'#fff'}}>
                            {role==='ai'?'AI':'U'}
                          </div>
                          <div className="max-w-[76%] px-3 py-2 rounded-xl text-[11px] leading-relaxed" style={{background:role==='ai'?'rgba(156,163,175,.12)':'rgba(255,255,255,.08)',color:role==='ai'?'#e0d7ff':'rgba(255,255,255,.85)',borderRadius:role==='ai'?'18px 18px 18px 4px':'18px 18px 4px 18px'}}>
                            {text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mt-2" style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)'}}>
                      <Globe2 className="w-4 h-4 shrink-0" style={{color:'#9ca3af'}} />
                      <span className="text-xs flex-1" style={{color:'rgba(255,255,255,.35)'}}>Speak or type a message…</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CREATOR TOOLS ── */}
        <section aria-labelledby="tools-heading" style={{background:'#060414'}} className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>Built-in creator tools</p>
              <h2 id="tools-heading" className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Everything in one place,
                <span style={{color:'#9ca3af'}}> nothing to install</span>
              </h2>
              <p className="mt-5 text-lg max-w-2xl mx-auto leading-relaxed" style={{color:'rgba(255,255,255,.5)'}}>
                Three powerful tools work together seamlessly — from trend discovery to published, compliant content.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  Icon: FolderOpen,
                  color: '#9ca3af',
                  bg: 'rgba(156,163,175,.12)',
                  title: 'Projects',
                  badge: 'Step 1',
                  desc: 'Your content command center. Connect your channels, create projects by niche, and let AI run the full research → script → voice → publish pipeline.',
                  steps: ['Connect your channels and platforms', 'Create a project with your niche and goals', 'AI generates the complete content pipeline'],
                },
                {
                  Icon: Sparkles,
                  color: '#22d3ee',
                  bg: 'rgba(34,211,238,.10)',
                  title: 'Creative Studio',
                  badge: 'Step 2',
                  desc: 'All your creation tools in one place. Characters, AI images, voice studio, audio, Shorts, and AI-generated thumbnails — available in every project.',
                  steps: ['Build AI characters for your videos', 'Generate thumbnails, storyboards, and assets', 'Narrate with voice synthesis or your own voice'],
                },
                {
                  Icon: ShieldCheck,
                  color: '#34d399',
                  bg: 'rgba(52,211,153,.10)',
                  title: 'Publish Hub',
                  badge: 'Step 3',
                  desc: 'Review, compliance-check, and publish — or let Autopilot handle it. A/B test titles and thumbnails. Track performance as it grows.',
                  steps: ['Approve or auto-publish when ready', 'A/B test titles and thumbnails live', 'Analytics feed back into the next content cycle'],
                },
              ].map(({ Icon, color, bg, title, badge, desc, steps }) => (
                <div key={title} className="glass-card rounded-3xl p-6 hover:shadow-lg transition-all hover:-translate-y-0.5 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:bg}}>
                      <Icon className="w-6 h-6" style={{color}} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:bg,color}}>
                      {badge}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm leading-relaxed" style={{color:'rgba(255,255,255,.5)'}}>{desc}</p>
                  </div>
                  <ul className="space-y-1.5 mt-auto">
                    {steps.map((s) => (
                      <li key={s} className="flex items-start gap-2 text-xs" style={{color:'rgba(255,255,255,.45)'}}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background:bg}}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{background:color}} />
                        </div>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section aria-labelledby="testimonials-heading" style={{background:'rgba(255,255,255,.02)'}} className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>Creator stories</p>
              <h2 id="testimonials-heading" className="text-3xl sm:text-4xl font-extrabold text-white">
                Real creators, real growth
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map(({ name, handle, avatar, color, text, stat }) => (
                <div key={name} className="glass-card rounded-3xl p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5">
                  <div className="flex gap-0.5" aria-label="5 stars">
                    {[...Array(5)].map((_,i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
                  </div>
                  <p className="text-sm leading-relaxed flex-1" style={{color:'rgba(255,255,255,.65)'}}>&ldquo;{text}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-2" style={{borderTop:'1px solid rgba(255,255,255,.07)'}}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{background:color}}>
                      {avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm leading-none mb-0.5">{name}</div>
                      <div className="text-xs" style={{color:'rgba(255,255,255,.4)'}}>{handle}</div>
                    </div>
                    <div className="ml-auto">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:'rgba(52,211,153,.12)',color:'#34d399'}}>{stat}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" aria-labelledby="pricing-heading" style={{background:'#060414'}} className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,.45)'}}>Simple, transparent pricing</p>
              <h2 id="pricing-heading" className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Start free.
                <span style={{color:'#9ca3af'}}> Scale as you grow.</span>
              </h2>
              <p className="mt-5 text-lg max-w-2xl mx-auto leading-relaxed" style={{color:'rgba(255,255,255,.5)'}}>
                Every plan includes AI-powered content creation, compliance checks, and multi-platform publishing. No hidden fees.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {([
                {
                  name: 'Free',
                  price: '$0',
                  period: 'forever',
                  description: 'Perfect for exploring AI-powered content creation.',
                  cta: 'Start free',
                  popular: false,
                  href: '/register',
                  features: [
                    { text: '50 AI credits / month', included: true },
                    { text: '1 channel', included: true },
                    { text: 'AI Copilot (limited)', included: true },
                    { text: 'Shorts Studio (5 clips/mo)', included: true },
                    { text: 'Auto-publish', included: false },
                    { text: 'A/B Testing', included: false },
                    { text: 'Video Editor', included: false },
                    { text: 'Analytics', included: false },
                  ],
                },
                {
                  name: 'Starter',
                  price: '$19',
                  period: 'per month',
                  description: 'For solo creators ready to publish consistently.',
                  cta: 'Get started',
                  popular: false,
                  href: '/register',
                  features: [
                    { text: '500 AI credits', included: true },
                    { text: '2 channels', included: true },
                    { text: 'Unlimited Copilot', included: true },
                    { text: 'Unlimited Shorts', included: true },
                    { text: 'Auto-publish approved content', included: true },
                    { text: 'A/B Testing', included: false },
                    { text: 'Video Editor', included: false },
                    { text: 'Analytics', included: false },
                  ],
                },
                {
                  name: 'Pro',
                  price: '$49',
                  period: 'per month',
                  description: 'For serious creators who want the full AI pipeline.',
                  cta: 'Go Pro',
                  popular: true,
                  href: '/register',
                  features: [
                    { text: '2,000 AI credits', included: true },
                    { text: '5 channels', included: true },
                    { text: 'Unlimited Copilot', included: true },
                    { text: 'Creative Studio (all tools)', included: true },
                    { text: 'Auto-publish + scheduling', included: true },
                    { text: 'A/B Testing', included: true },
                    { text: 'Autopilot AI pipeline', included: true },
                    { text: 'Analytics dashboard', included: true },
                  ],
                },
                {
                  name: 'Agency',
                  price: '$149',
                  period: 'per month',
                  description: 'For teams managing multiple brands and creators.',
                  cta: 'Contact sales',
                  popular: false,
                  href: '/login',
                  features: [
                    { text: 'Unlimited credits', included: true },
                    { text: 'Unlimited channels', included: true },
                    { text: 'Everything in Pro', included: true },
                    { text: 'Team members & roles', included: true },
                    { text: 'Shared org wallet', included: true },
                    { text: 'White-label', included: true },
                    { text: 'Custom AI training', included: true },
                    { text: 'Dedicated support', included: true },
                  ],
                },
              ] as const).map(({ name, price, period, description, cta, popular, href, features }) => (
                <div
                  key={name}
                  className={`relative flex flex-col rounded-3xl p-6 transition-all ${
                    popular ? 'shadow-2xl ring-2 ring-white/20 scale-[1.02]' : 'glass-card hover:shadow-lg'
                  }`}
                  style={popular ? { background: 'linear-gradient(160deg,#0e0924 0%,#1a0f4a 100%)', border: '1px solid rgba(255,255,255,.2)' } : undefined}
                >
                  {popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                        <Sparkles className="w-3 h-3" /> Most popular
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{color:'rgba(255,255,255,.5)'}}>{name}</p>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold text-white">{price}</span>
                      <span className="text-sm mb-1" style={{color:'rgba(255,255,255,.4)'}}>/{period}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed" style={{color:'rgba(255,255,255,.55)'}}>{description}</p>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map(({ text, included }) => (
                      <li key={text} className={`flex items-start gap-2.5 text-sm`} style={{color: included ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.2)'}}>
                        {included
                          ? <Check className="w-4 h-4 shrink-0 mt-0.5" style={{color:'#9ca3af'}} />
                          : <Minus className="w-4 h-4 shrink-0 mt-0.5 opacity-40" />}
                        {text}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={href}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white text-white"
                    style={popular
                      ? { background: 'linear-gradient(135deg,#9ca3af,#374151)', boxShadow: '0 8px 30px -8px rgba(55,65,81,.6)' }
                      : { background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)' }}
                  >
                    {cta} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm" style={{color:'rgba(255,255,255,.35)'}}>
              All plans include a 14-day free trial · No credit card required to start · Cancel any time
            </p>
          </div>
        </section>

        {/* ── GET THE APP ── */}
        <section id="download" aria-label="Download the app" style={{background:'linear-gradient(160deg,#0e0924 0%,#130a3a 100%)'}}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 mb-6 text-sm font-medium text-white/80" style={{background:'rgba(55,65,81,.15)'}}>
                <span>📲</span> Available everywhere
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
                Take SozialZynk<br />
                <span style={{background:'linear-gradient(90deg,#d1d5db,#9ca3af)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                  wherever you create
                </span>
              </h2>
              <p className="text-white/55 text-base sm:text-lg max-w-xl mx-auto">
                Install as a native app on any device. Works offline, launches in seconds, feels like a real app.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
              <a href="https://sozialzynk.vercel.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3 rounded-2xl font-semibold text-white transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{background:'linear-gradient(135deg,#374151,#1f2937)',border:'1px solid rgba(255,255,255,.15)',minWidth:200,boxShadow:'0 8px 24px -6px rgba(0,0,0,.5)'}}>
                <span className="text-2xl leading-none">🌐</span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-medium opacity-60 uppercase tracking-wider">Open</span>
                  <span className="text-sm font-bold">Web App</span>
                </span>
              </a>

              <a href="https://play.google.com/store/apps/details?id=app.sozialzynk" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3 rounded-2xl font-semibold text-white transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{background:'#1a1a1a',border:'1px solid rgba(255,255,255,.12)',minWidth:200,boxShadow:'0 8px 24px -6px rgba(0,0,0,.5)'}}>
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M8.8 4.3C7.6 5 6.9 6.3 6.9 8v32c0 1.7.7 3 1.9 3.7l.2.1L27.5 24v-.5L9 4.2l-.2.1z" fill="#4FC3F7"/>
                  <path d="M33.8 30.3l-6.3-6.3v-.5l6.3-6.3.1.1 7.5 4.3c2.1 1.2 2.1 3.2 0 4.4l-7.5 4.3h-.1z" fill="#FFCA28"/>
                  <path d="M34 30.2L27.5 24 9 42.7c.7.7 1.8.8 3 .1l22-12.6" fill="#F44336"/>
                  <path d="M34 17.8L12 5.2C10.8 4.5 9.7 4.6 9 5.3L27.5 24 34 17.8z" fill="#4CAF50"/>
                </svg>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-medium opacity-60 uppercase tracking-wider">Get it on</span>
                  <span className="text-sm font-bold">Google Play</span>
                </span>
              </a>

              <a href="https://apps.apple.com/app/sozialzynk/id6740000000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3 rounded-2xl font-semibold text-white transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{background:'#1a1a1a',border:'1px solid rgba(255,255,255,.12)',minWidth:200,boxShadow:'0 8px 24px -6px rgba(0,0,0,.5)'}}>
                <svg width="26" height="26" viewBox="0 0 814 1000" fill="white" aria-hidden="true">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.3 134.8-316.9 267.5-316.9 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.4-49 191.5-49 30.8 0 133.5 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                </svg>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-medium opacity-60 uppercase tracking-wider">Download on the</span>
                  <span className="text-sm font-bold">App Store</span>
                </span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
              <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'rgba(55,65,81,.2)'}}>🌐</div>
                <div>
                  <p className="text-white font-bold text-base mb-1">Web App</p>
                  <p className="text-white/45 text-sm leading-relaxed">Install directly from Chrome, Edge, or Safari. Works on Windows, Mac, and Linux.</p>
                </div>
                <PwaInstallButtonLanding />
              </div>

              <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'rgba(52,168,83,.15)'}}>🤖</div>
                <div>
                  <p className="text-white font-bold text-base mb-1">Android</p>
                  <p className="text-white/45 text-sm leading-relaxed">Download from Google Play or open in Chrome and tap <strong className="text-white/70">Add to Home Screen</strong>.</p>
                </div>
                <a href="https://play.google.com/store/apps/details?id=app.sozialzynk" target="_blank" rel="noopener noreferrer" className="mt-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 w-full" style={{background:'rgba(52,168,83,.12)',border:'1px solid rgba(52,168,83,.28)',color:'rgba(134,239,172,.9)'}}>
                  <svg width="16" height="16" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <path d="M8.8 4.3C7.6 5 6.9 6.3 6.9 8v32c0 1.7.7 3 1.9 3.7l.2.1L27.5 24v-.5L9 4.2l-.2.1z" fill="#4FC3F7"/>
                    <path d="M33.8 30.3l-6.3-6.3v-.5l6.3-6.3.1.1 7.5 4.3c2.1 1.2 2.1 3.2 0 4.4l-7.5 4.3h-.1z" fill="#FFCA28"/>
                    <path d="M34 30.2L27.5 24 9 42.7c.7.7 1.8.8 3 .1l22-12.6" fill="#F44336"/>
                    <path d="M34 17.8L12 5.2C10.8 4.5 9.7 4.6 9 5.3L27.5 24 34 17.8z" fill="#4CAF50"/>
                  </svg>
                  Get on Google Play
                </a>
              </div>

              <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'rgba(0,122,255,.15)'}}>🍎</div>
                <div>
                  <p className="text-white font-bold text-base mb-1">iPhone &amp; iPad</p>
                  <p className="text-white/45 text-sm leading-relaxed">Download from the App Store or open in Safari and tap <strong className="text-white/70">Share → Add to Home Screen</strong>.</p>
                </div>
                <a href="https://apps.apple.com/app/sozialzynk/id6740000000" target="_blank" rel="noopener noreferrer" className="mt-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 w-full" style={{background:'rgba(0,122,255,.1)',border:'1px solid rgba(0,122,255,.28)',color:'rgba(147,197,253,.9)'}}>
                  <svg width="16" height="16" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.3 134.8-316.9 267.5-316.9 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.4-49 191.5-49 30.8 0 133.5 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                  </svg>
                  Download on App Store
                </a>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {['⚡ Instant launch','📴 Works offline','🔔 Push notifications','🔒 Secure & private','🔄 Auto-updates','📱 Native feel'].map((feat) => (
                <span key={feat} className="text-sm font-medium px-4 py-2 rounded-full" style={{background:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.6)',border:'1px solid rgba(255,255,255,.1)'}}>
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section aria-label="Call to action" style={{background:'linear-gradient(160deg,#0e0924 0%,#1a0f4a 50%,#2d1b6e 100%)'}}>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 text-center">
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20" style={{background:'radial-gradient(ellipse,#374151 0%,transparent 70%)',filter:'blur(50px)'}} />
            </div>
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{color:'#9ca3af'}}>Ready to create?</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Your audience is waiting.<br />Start today.
              </h2>
              <p className="mt-5 text-white/60 text-lg max-w-lg mx-auto">
                Free to start. No credit card. Cancel anytime. Your first AI-researched script is ready in under 5 minutes.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register" className="shimmer-btn inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl font-bold text-white text-base shadow-2xl hover:scale-[1.02] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{boxShadow:'0 20px 50px -12px rgba(55,65,81,.6)'}}>
                  <Zap className="w-4 h-4" />
                  Create my free account
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-1.5 px-6 py-4 rounded-2xl font-semibold text-white/70 text-base transition-colors hover:text-white hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{border:'1px solid rgba(255,255,255,.15)'}}>
                  Already have an account? Log in
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
                {['No credit card required','Multi-platform publishing','AI research & scripts'].map(t => (
                  <span key={t} className="flex items-center gap-1.5" style={{color:'rgba(255,255,255,.45)'}}>
                    <CheckCircle2 className="w-4 h-4" style={{color:'#9ca3af'}} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer style={{background:'#07041a',borderTop:'1px solid rgba(255,255,255,.06)'}} className="text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <LogoMark className="w-9 h-9 shrink-0" variant="light" />
              <div>
                <p className="font-bold text-base leading-tight">Sozial<span style={{color:'#d1d5db'}}>Z</span>ynk</p>
                <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,.35)'}}>AI Creator Platform</p>
              </div>
            </div>
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{color:'rgba(255,255,255,.4)'}}>
                {[
                  {label:'Features',href:'#features'},
                  {label:'How it works',href:'#workflow'},
                  {label:'Pricing',href:'#pricing'},
                  {label:'Get the App',href:'#download'},
                  {label:'Log in',href:'/login'},
                  {label:'Privacy',href:'/privacy'},
                  {label:'Terms',href:'/terms'},
                ].map(({label,href}) => (
                  <li key={label}>
                    <a href={href} className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="mt-8 pt-8 text-center text-xs" style={{borderTop:'1px solid rgba(255,255,255,.06)',color:'rgba(255,255,255,.25)'}}>
            &copy; {new Date().getFullYear()} SozialZynk. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
