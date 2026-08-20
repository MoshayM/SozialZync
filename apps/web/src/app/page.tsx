import Link from 'next/link';
import {
  Zap, Film, Bot, ArrowRight, CheckCircle2, ChevronRight, Sparkles, ShieldCheck,
  Globe2, Repeat2, Clock, Star, Hash, LineChart, MessageSquare, Target, Users, Calendar,
  FolderOpen, Scissors, Check, Minus,
} from 'lucide-react';
import { MobileNav } from './_components/MobileNav';
import { LogoMark } from '@/components/logo-mark';
import { PwaInstallButtonLanding } from '@/components/pwa-install';
import { AppStoreNotify } from '@/components/app-store-notify';
import { HeroVideo } from '@/components/hero-video';

// ── Capabilities ──────────────────────────────────────────────────────────────

const CAPABILITIES = [
  { icon: Bot,           color: '#7C3AED', bg: '#F3EEFF', title: 'AI Copilot (Voice)',      desc: 'Voice-enabled robot assistant. Speak to plan, create, and manage your channel — live transcript + chest-panel mic.' },
  { icon: Zap,           color: '#D97706', bg: '#FFFBEB', title: 'Trend Discovery',          desc: 'Surfaces trending YouTube topics before they peak so you create content while the audience is growing.' },
  { icon: Target,        color: '#BE185D', bg: '#FDF2F8', title: 'Research & Fact-Check',    desc: 'ResearchAgent gathers source material; FactCheckAgent verifies every claim before it reaches your script.' },
  { icon: Sparkles,      color: '#7C3AED', bg: '#F3EEFF', title: 'AI Script Writer',         desc: 'Monetization-compliant, fact-checked scripts in your brand voice — with hooks, CTAs, and YouTube SEO baked in.' },
  { icon: Users,         color: '#0891B2', bg: '#ECFEFF', title: 'Character Studio',         desc: 'Generate original AI characters and avatars for your videos, thumbnails, and brand identity.' },
  { icon: Star,          color: '#DC2626', bg: '#FFF1F1', title: 'AI Thumbnails & Images',  desc: 'Eye-catching thumbnails and storyboard frames generated in seconds — sized perfectly for YouTube.' },
  { icon: Globe2,        color: '#059669', bg: '#ECFDF5', title: 'Voice & Audio Studio',     desc: 'Text-to-speech narration, multi-voice synthesis, and AI music — all with your brand voice profile.' },
  { icon: Film,          color: '#1D4ED8', bg: '#EFF6FF', title: 'Shorts Studio',            desc: 'AI finds the best moments from long videos, adds captions and hooks, and exports viral Shorts.' },
  { icon: ShieldCheck,   color: '#059669', bg: '#ECFDF5', title: 'Compliance Engine',        desc: 'Every piece of content passes copyright, YouTube monetization policy, and fact-check gates automatically.' },
  { icon: Calendar,      color: '#7C3AED', bg: '#F3EEFF', title: 'Publish & Autopilot',      desc: 'Schedule at peak times, review before publish, or let Autopilot handle the full pipeline hands-free.' },
  { icon: LineChart,     color: '#D97706', bg: '#FFFBEB', title: 'A/B Testing',              desc: 'Test titles and thumbnails on live videos. AI picks the winner — more clicks, better rankings.' },
  { icon: MessageSquare, color: '#0891B2', bg: '#ECFEFF', title: 'Channel Analytics',        desc: 'All your performance metrics in one place. AI recommends what to create next based on what actually works.' },
];

// ── Workflow steps ─────────────────────────────────────────────────────────────

const WORKFLOW = [
  { icon: Target,      label: 'Discover', sub: 'Trending topics and competitor gaps identified' },
  { icon: Globe2,      label: 'Research', sub: 'Sources gathered, facts verified by AI agent' },
  { icon: Sparkles,    label: 'Script',   sub: 'Monetization-compliant script written for you' },
  { icon: Bot,         label: 'Create',   sub: 'Voice, characters, images and video generated' },
  { icon: ShieldCheck, label: 'Comply',   sub: 'Compliance check before anything leaves the platform' },
  { icon: LineChart,   label: 'Publish',  sub: 'Scheduled at optimal time, results tracked' },
];

// ── Nav links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Get the App',  href: '#download' },
  { label: 'Pricing',      href: '#pricing' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <style>{`
        html { scroll-behavior: smooth; }
        .glow-ring { box-shadow: 0 0 0 1px rgba(124,58,237,.2), 0 0 60px rgba(124,58,237,.3), 0 0 120px rgba(124,58,237,.1); }
        @keyframes float-slow { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        .float-slow { animation: float-slow 6s ease-in-out infinite; }
        @keyframes pulse-soft { 0%,100% { opacity:.6; } 50% { opacity:1; } }
        .pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
        @keyframes fade-out { 0%,60% { opacity:1; } 100% { opacity:0; } }
        .animate-fade-out { animation: fade-out 4s ease-out forwards; }
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
        .card-3d { transform-style:preserve-3d; transition:transform 0.45s ease,box-shadow 0.45s ease; }
        .card-3d:hover { transform:perspective(900px) rotateX(-5deg) rotateY(7deg) translateZ(10px) scale(1.02); box-shadow:0 32px 64px -12px rgba(124,58,237,0.45); }
        .float-a { animation:float-a 7s ease-in-out infinite; }
        .float-b { animation:float-b 9s ease-in-out infinite; }
        .float-c { animation:float-c 11s ease-in-out infinite; }
        .gradient-animated { background-size:200% 200%; animation:gradient-shift 4s ease infinite; }
        .shimmer-btn { background: linear-gradient(90deg,#a78bfa,#7C3AED,#818cf8,#7C3AED,#a78bfa); background-size:300% 100%; animation:shimmer 3s linear infinite; }
        .orb-pulse { animation:orb-pulse 6s ease-in-out infinite; }
        .spin-slow { animation:spin-slow 30s linear infinite; }
        .spin-rev  { animation:spin-rev  45s linear infinite; }
        .count-up-1 { animation:count-up 0.6s ease forwards 0.2s; opacity:0; }
        .count-up-2 { animation:count-up 0.6s ease forwards 0.4s; opacity:0; }
        .count-up-3 { animation:count-up 0.6s ease forwards 0.6s; opacity:0; }
        .dash-travel { animation:dash-travel 1.2s linear infinite; }
      `}</style>

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl" style={{background:'rgba(14,9,36,.85)'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Sozialzync">
              <LogoMark className="w-9 h-9 shrink-0" style={{borderRadius:'10px'}} />
              <span className="font-bold text-lg leading-none hidden sm:block tracking-[-0.4px]">
                <span className="text-white">Sozial</span><span style={{ color: '#c4b5fd' }}>Zync</span>
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
              <Link href="/login" className="px-5 py-2 rounded-xl text-sm font-bold shadow-lg min-h-[44px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all hover:opacity-90" style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)',color:'#fff'}}>
                Get started free
              </Link>
            </div>

            <MobileNav />
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────────────── */}
        <section aria-label="Hero" className="relative overflow-hidden" style={{background:'radial-gradient(ellipse at 20% 50%, #1a0845 0%, #0a0520 50%, #000814 100%)'}}>

          {/* ── Background layer: perspective grid ── */}
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

          {/* ── Animated orbs ── */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="orb-pulse absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full" style={{background:'radial-gradient(ellipse,#7C3AED 0%,transparent 68%)',filter:'blur(30px)'}} />
            <div className="orb-pulse absolute top-1/3 left-[5%] w-80 h-80 rounded-full" style={{background:'#4f2ec4',filter:'blur(70px)',animationDelay:'2s'}} />
            <div className="orb-pulse absolute top-1/4 right-[5%] w-60 h-60 rounded-full" style={{background:'#6d28d9',filter:'blur(60px)',animationDelay:'4s'}} />
            <div className="orb-pulse absolute bottom-0 right-1/3 w-96 h-96 rounded-full" style={{background:'#1e1b4b',filter:'blur(80px)',animationDelay:'1s'}} />
            {/* Rotating ring */}
            <div className="spin-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full" style={{border:'1px solid rgba(167,139,250,.1)'}} />
            <div className="spin-rev absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full" style={{border:'1px solid rgba(124,58,237,.06)'}} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-36 text-center">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 mb-8 text-sm font-medium" style={{background:'rgba(124,58,237,.18)',backdropFilter:'blur(12px)',color:'rgba(255,255,255,.85)'}}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              AI YouTube Content Operating System
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight max-w-5xl mx-auto">
              Research. Script.
              <br />
              <span className="gradient-animated" style={{background:'linear-gradient(90deg,#c4b5fd,#818cf8,#a78bfa,#c4b5fd)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                Publish to YouTube.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Sozialzync runs your entire YouTube content pipeline — from trend research to compliance-checked publishing.{' '}
              <span className="text-white/80">Your AI content team, available 24/7. No burnout. No guesswork.</span>
            </p>

            {/* Live counter nudge */}
            <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full" style={{background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.25)',color:'rgba(167,243,208,.9)'}}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              12 creators joined in the last hour
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login" className="shimmer-btn inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base shadow-2xl transition-all hover:scale-105 hover:shadow-purple-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{boxShadow:'0 20px 50px -12px rgba(124,58,237,.65)'}}>
                <Zap className="w-4 h-4" />
                Start creating free
              </Link>
              <a href="#workflow" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white text-base transition-all hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{border:'1.5px solid rgba(255,255,255,.2)',backdropFilter:'blur(8px)'}}>
                See how it works
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {/* Floating stat cards */}
            <div className="mt-12 flex flex-wrap justify-center gap-4 sm:gap-6">
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

            {/* Platform logos */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs font-medium mr-2" style={{color:'rgba(255,255,255,.35)'}}>Primary platform</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'#FF0000'}}>
                <span className="text-[10px] opacity-90">YT</span>
                <span className="opacity-80">YouTube</span>
              </span>
              <span className="text-xs font-medium mx-1" style={{color:'rgba(255,255,255,.25)'}}>Also publishes to:</span>
              {[
                { label: 'Instagram', bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', short: 'IG', border: undefined },
                { label: 'TikTok',   bg: '#010101',                                                          short: 'TT', border: '1px solid rgba(255,255,255,.15)' },
                { label: 'LinkedIn', bg: '#0A66C2',                                                          short: 'LI', border: undefined },
              ].map(({ label, bg, short, border }) => (
                <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white opacity-60" style={{background:bg, border: border ?? 'none'}}>
                  <span className="opacity-90">{short}</span>
                  <span className="hidden sm:inline opacity-80">{label}</span>
                </span>
              ))}
            </div>

            {/* Hero visual — product demo video */}
            <div className="mt-10 sm:mt-16 max-w-4xl mx-auto float-slow" style={{filter:'drop-shadow(0 0 60px rgba(124,58,237,.35))'}}>
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
                  <Icon className="w-4 h-4" style={{color:'#a78bfa'}} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────────────────────── */}
        <section aria-label="Social proof" className="bg-white border-y border-gray-100 py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { stat: '100K+ Creators', label: 'Building on YouTube' },
                { stat: '10× Faster',     label: 'Than manual research' },
                { stat: '5M+ Scripts',    label: 'AI-generated & published' },
                { stat: 'Zero',           label: 'Manual repurposing needed' },
              ].map(({ stat, label }) => (
                <div key={stat} className="flex flex-col items-center gap-1">
                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{color:'#7C3AED'}}>{stat}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CAPABILITIES ─────────────────────────────────────────────────────── */}
        <section id="features" aria-labelledby="features-heading" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#7C3AED'}}>Full capability suite</p>
              <h2 id="features-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                Everything you need to grow your channel,
                <br className="hidden sm:block" />
                <span style={{color:'#7C3AED'}}> powered by AI</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                One platform replaces your entire YouTube content stack. From trend discovery to analytics — all connected.
              </p>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Platform capabilities">
              {CAPABILITIES.map(({ icon: Icon, color, bg, title, desc }) => (
                <li key={title} className="card-3d group bg-white border border-gray-100 hover:border-purple-200 rounded-2xl p-5 flex flex-col gap-3 transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{background:bg}}>
                    <Icon className="w-5 h-5" style={{color}} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-snug">{title}</h3>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── WORKFLOW ─────────────────────────────────────────────────────────── */}
        <section id="workflow" aria-labelledby="workflow-heading" style={{background:'#f8f5ff'}} className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#7C3AED'}}>End-to-end AI pipeline</p>
              <h2 id="workflow-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                From one idea,
                <span style={{color:'#7C3AED'}}> to a published video</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
                Tell Sozialzync what you want to create. It researches, writes, checks compliance, and publishes to your YouTube channel.
              </p>
            </div>

            {/* Step grid — 6 columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 sm:gap-4">
              {WORKFLOW.map(({ icon: Icon, label, sub }, idx) => (
                <div key={label} className="relative flex flex-col items-center text-center group">
                  {/* Animated dashed connector */}
                  {idx < WORKFLOW.length - 1 && (
                    <div aria-hidden="true" className="hidden lg:block absolute top-8 left-[calc(50%+28px)] right-0 h-3 overflow-hidden">
                      <svg width="100%" height="12" className="absolute inset-0">
                        <line x1="0" y1="6" x2="100%" y2="6" stroke="#c4b5fd" strokeWidth="1.5" strokeDasharray="6 4" className="dash-travel" />
                      </svg>
                    </div>
                  )}

                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4 transition-transform group-hover:scale-110 group-hover:shadow-lg" style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)'}}>
                    <Icon className="w-7 h-7 text-white" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{background:'#5B21B6'}}>
                      {idx + 1}
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">{label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-[140px]">{sub}</p>
                </div>
              ))}
            </div>

            {/* CTA below workflow */}
            <div className="text-center mt-14">
              <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 shadow-2xl" style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)',boxShadow:'0 16px 40px -10px rgba(124,58,237,.5)'}}>
                <Zap className="w-4 h-4" />
                Start your first AI project
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="mt-3 text-sm text-gray-500">Free to start · No credit card required</p>
            </div>
          </div>
        </section>

        {/* ── AI CONVERSATION DEMO ─────────────────────────────────────────────── */}
        <section aria-label="AI Copilot demo" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#7C3AED'}}>Natural language first</p>
                <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  No forms.<br />No menus.<br />
                  <span style={{color:'#7C3AED'}}>Just conversation.</span>
                </h2>
                <p className="mt-6 text-lg text-gray-500 leading-relaxed">
                  Sozialzync&apos;s AI Copilot works like an experienced YouTube content manager. Tell it what you need — it researches trends, writes compliant scripts, generates assets, and gets your video published.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    { t: 'Full YouTube pipeline',   d: 'One conversation handles research, scripting, visuals, voice, and publishing.' },
                    { t: 'Voice & text input',       d: 'Speak or type — the Copilot understands both.' },
                    { t: 'Multi-language support',   d: 'Responds in your language: English, Hindi, Tamil, and 30+ more.' },
                    { t: 'Brand voice memory',        d: 'Remembers your tone and style so every script sounds authentically like you.' },
                  ].map(({ t, d }) => (
                    <li key={t} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background:'#EDE9FE'}}>
                        <CheckCircle2 className="w-3.5 h-3.5" style={{color:'#7C3AED'}} />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">{t}</span>
                        <span className="text-gray-500 text-sm"> — {d}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-10">
                  <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)'}}>
                    Try the AI Copilot <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Copilot visual */}
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl" style={{background:'radial-gradient(ellipse at 50% 50%,rgba(124,58,237,.08) 0%,transparent 70%)'}} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{background:'#1a1033',border:'1px solid rgba(255,255,255,.08)'}}>
                  <div className="p-5 space-y-4">
                    {/* Orb */}
                    <div className="flex justify-center py-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)',boxShadow:'0 0 0 12px rgba(124,58,237,.12),0 0 0 24px rgba(124,58,237,.06)'}}>
                          <Bot className="w-9 h-9 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{background:'#10B981',border:'2px solid #1a1033'}}>
                          <div className="w-2 h-2 rounded-full bg-white pulse-soft" />
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-xs font-medium" style={{color:'rgba(255,255,255,.5)'}}>Copilot ready · Listening…</p>

                    {/* Chat messages */}
                    <div className="space-y-3 pt-2">
                      {[
                        { role:'ai',  text:"What would you like to create for your YouTube channel today?" },
                        { role:'user',text:"Research trending topics and write 3 scripts." },
                        { role:'ai',  text:"ResearchAgent found 8 trending gaps in your niche. Writing 3 fact-checked scripts now." },
                        { role:'user',text:"Great. Add thumbnails and voice narration." },
                        { role:'ai',  text:"Done! 3 scripts, 3 thumbnails, 3 voice tracks — all passed compliance. Ready to schedule?" },
                      ].map(({ role, text }, i) => (
                        <div key={i} className={`flex ${role==='user'?'flex-row-reverse':''} items-end gap-2`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${role==='ai'?'':'opacity-90'}`} style={{background:role==='ai'?'linear-gradient(135deg,#a78bfa,#7C3AED)':'linear-gradient(135deg,#f472b6,#ec4899)',color:'#fff'}}>
                            {role==='ai'?'AI':'U'}
                          </div>
                          <div className="max-w-[76%] px-3 py-2 rounded-xl text-[11px] leading-relaxed" style={{background:role==='ai'?'rgba(167,139,250,.12)':'rgba(255,255,255,.08)',color:role==='ai'?'#e0d7ff':'rgba(255,255,255,.85)',borderRadius:role==='ai'?'18px 18px 18px 4px':'18px 18px 4px 18px'}}>
                            {text}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mt-2" style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)'}}>
                      <Globe2 className="w-4 h-4 shrink-0" style={{color:'#a78bfa'}} />
                      <span className="text-xs flex-1" style={{color:'rgba(255,255,255,.35)'}}>Speak or type a message…</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CREATOR TOOLS ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="tools-heading" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#7C3AED'}}>Built-in creator tools</p>
              <h2 id="tools-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                Everything in one place,
                <span style={{color:'#7C3AED'}}> nothing to install</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Three powerful tools work together seamlessly — from trend discovery to a published, compliant YouTube video.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  Icon: FolderOpen,
                  color: '#7C3AED',
                  bg: '#F3EEFF',
                  title: 'Projects',
                  badge: 'Step 1',
                  desc: 'Your content command center. Connect your YouTube channel, create projects by niche, and let AI run the full research → script → voice → publish pipeline.',
                  steps: ['Connect your YouTube channel', 'Create a project with your niche and goals', 'AI generates the complete content pipeline'],
                },
                {
                  Icon: Sparkles,
                  color: '#0891B2',
                  bg: '#ECFEFF',
                  title: 'Creative Studio',
                  badge: 'Step 2',
                  desc: 'All your creation tools in one place. Characters, AI images, voice studio, audio, Shorts, and AI-generated thumbnails — available in every project.',
                  steps: ['Build AI characters for your videos', 'Generate thumbnails, storyboards, and assets', 'Narrate with voice synthesis or your own voice'],
                },
                {
                  Icon: ShieldCheck,
                  color: '#059669',
                  bg: '#ECFDF5',
                  title: 'Publish Hub',
                  badge: 'Step 3',
                  desc: 'Review, compliance-check, and publish — or let Autopilot handle it. A/B test titles and thumbnails. Track performance as it grows.',
                  steps: ['Approve or auto-publish when ready', 'A/B test titles and thumbnails live', 'Analytics feed back into the next content cycle'],
                },
              ].map(({ Icon, color, bg, title, badge, desc, steps }) => (
                <div key={title} className="border border-gray-100 rounded-3xl p-6 hover:shadow-lg transition-all hover:-translate-y-0.5 flex flex-col gap-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:bg}}>
                      <Icon className="w-6 h-6" style={{color}} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:bg,color}}>
                      {badge}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                  <ul className="space-y-1.5 mt-auto">
                    {steps.map((s) => (
                      <li key={s} className="flex items-start gap-2 text-xs text-gray-500">
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

        {/* ── PRICING ──────────────────────────────────────────────────────────── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#7C3AED'}}>Simple, transparent pricing</p>
              <h2 id="pricing-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                Start free.
                <span style={{color:'#7C3AED'}}> Scale as you grow.</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Every plan includes AI-powered content creation, compliance checks, and YouTube publishing. No hidden fees.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {([
                {
                  name: 'Free',
                  price: '$0',
                  period: 'forever',
                  description: 'Perfect for exploring AI-powered YouTube content creation.',
                  cta: 'Start free',
                  popular: false,
                  features: [
                    { text: '50 AI credits / month', included: true },
                    { text: '1 YouTube channel', included: true },
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
              ] as const).map(({ name, price, period, description, cta, popular, features }) => (
                <div
                  key={name}
                  className={`relative flex flex-col rounded-3xl p-6 ${
                    popular
                      ? 'shadow-2xl ring-2 ring-[#7C3AED] scale-[1.02]'
                      : 'border border-gray-100 hover:border-gray-200 hover:shadow-lg'
                  } transition-all`}
                  style={popular ? { background: 'linear-gradient(160deg,#0e0924 0%,#1a0f4a 100%)' } : { background: '#fff' }}
                >
                  {popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white"
                        style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)'}}>
                        <Sparkles className="w-3 h-3" /> Most popular
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <p className={`text-sm font-bold uppercase tracking-widest mb-2 ${popular ? 'text-purple-300' : 'text-gray-500'}`}>{name}</p>
                    <div className="flex items-end gap-1">
                      <span className={`text-4xl font-extrabold ${popular ? 'text-white' : 'text-gray-900'}`}>{price}</span>
                      <span className={`text-sm mb-1 ${popular ? 'text-purple-300' : 'text-gray-400'}`}>/{period}</span>
                    </div>
                    <p className={`mt-2 text-sm leading-relaxed ${popular ? 'text-purple-200' : 'text-gray-500'}`}>{description}</p>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map(({ text, included }) => (
                      <li key={text} className={`flex items-start gap-2.5 text-sm ${
                        included
                          ? (popular ? 'text-white' : 'text-gray-700')
                          : (popular ? 'text-purple-400/50' : 'text-gray-300')
                      }`}>
                        {included
                          ? <Check className={`w-4 h-4 shrink-0 mt-0.5 ${popular ? 'text-purple-300' : 'text-[#7C3AED]'}`} />
                          : <Minus className="w-4 h-4 shrink-0 mt-0.5 opacity-40" />}
                        {text}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/login"
                    className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                      popular ? 'text-white' : 'text-white'
                    }`}
                    style={popular
                      ? { background: 'linear-gradient(135deg,#a78bfa,#7C3AED)', boxShadow: '0 8px 30px -8px rgba(124,58,237,.6)' }
                      : { background: 'linear-gradient(135deg,#6D4AE0,#7C3AED)' }}
                  >
                    {cta} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm text-gray-400">
              All plans include a 14-day free trial · No credit card required to start · Cancel any time
            </p>
          </div>
        </section>

        {/* ── GET THE APP ───────────────────────────────────────────────────────── */}
        <section id="download" aria-label="Download the app" style={{background:'linear-gradient(160deg,#0e0924 0%,#130a3a 100%)'}}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 mb-6 text-sm font-medium text-white/80" style={{background:'rgba(124,58,237,.15)'}}>
                <span>📲</span> Available everywhere
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
                Take Sozialzync<br />
                <span style={{background:'linear-gradient(90deg,#c4b5fd,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                  wherever you create
                </span>
              </h2>
              <p className="text-white/55 text-base sm:text-lg max-w-xl mx-auto">
                Install as a native app on any device. Works offline, launches in seconds, feels like a real app.
              </p>
            </div>

            {/* Platform cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
              {/* Web / Desktop */}
              <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'rgba(124,58,237,.2)'}}>🌐</div>
                <div>
                  <p className="text-white font-bold text-base mb-1">Web App</p>
                  <p className="text-white/45 text-sm leading-relaxed">Install directly from Chrome, Edge, or Safari. Works on Windows, Mac, and Linux.</p>
                </div>
                <PwaInstallButtonLanding />
              </div>

              {/* Android */}
              <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'rgba(52,168,83,.15)'}}>🤖</div>
                <div>
                  <p className="text-white font-bold text-base mb-1">Android</p>
                  <p className="text-white/45 text-sm leading-relaxed">Full native app coming to Google Play. Install the web app above for full offline support right now.</p>
                </div>
                <AppStoreNotify platform="android" />
              </div>

              {/* iOS */}
              <div className="rounded-2xl p-6 flex flex-col gap-4" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)'}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'rgba(0,122,255,.15)'}}>🍎</div>
                <div>
                  <p className="text-white font-bold text-base mb-1">iPhone &amp; iPad</p>
                  <p className="text-white/45 text-sm leading-relaxed">App Store listing coming soon. For now, open in Safari and tap Share → Add to Home Screen.</p>
                </div>
                <AppStoreNotify platform="ios" />
              </div>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3">
              {[
                '⚡ Instant launch',
                '📴 Works offline',
                '🔔 Push notifications',
                '🔒 Secure & private',
                '🔄 Auto-updates',
                '📱 Native feel',
              ].map((feat) => (
                <span
                  key={feat}
                  className="text-sm font-medium px-4 py-2 rounded-full"
                  style={{background:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.6)',border:'1px solid rgba(255,255,255,.1)'}}
                >
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
        <section aria-label="Call to action" style={{background:'linear-gradient(160deg,#0e0924 0%,#1a0f4a 50%,#2d1b6e 100%)'}}>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 text-center">
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20" style={{background:'radial-gradient(ellipse,#7C3AED 0%,transparent 70%)',filter:'blur(50px)'}} />
            </div>
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{color:'#a78bfa'}}>Start today</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Your YouTube channel,<br />on autopilot.
              </h2>
              <p className="mt-6 text-lg text-white/60 max-w-xl mx-auto">
                Join 100,000+ YouTube creators who use AI to research, create, and publish smarter. Free to start — no credit card required.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login" className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl font-bold text-white text-base shadow-2xl transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{background:'linear-gradient(135deg,#a78bfa,#7C3AED)',boxShadow:'0 20px 50px -12px rgba(124,58,237,.6)'}}>
                  <Zap className="w-5 h-5" />
                  Get started free
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
                {['No credit card required','YouTube publishing included','14-day free trial'].map(t => (
                  <span key={t} className="flex items-center gap-1.5" style={{color:'rgba(255,255,255,.45)'}}>
                    <CheckCircle2 className="w-4 h-4" style={{color:'#a78bfa'}} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer style={{background:'#07041a',borderTop:'1px solid rgba(255,255,255,.06)'}} className="text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <LogoMark className="w-9 h-9 shrink-0" style={{borderRadius:'10px'}} />
              <div>
                <p className="font-bold text-base leading-tight">Sozialzync</p>
                <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,.35)'}}>AI YouTube Content OS</p>
              </div>
            </div>
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{color:'rgba(255,255,255,.4)'}}>
                {[{label:'Features',href:'#features'},{label:'Workflow',href:'#workflow'},{label:'Log in',href:'/login'}].map(({label,href}) => (
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
            &copy; {new Date().getFullYear()} Sozialzync. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
