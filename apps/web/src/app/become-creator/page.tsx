import Link from 'next/link';
import {
  Zap, Film, Bot, ArrowRight, CheckCircle2, Sparkles, ShieldCheck,
  Globe2, LineChart, Target, Star, Users, Calendar, FolderOpen,
  Check, Minus, MessageSquare,
} from 'lucide-react';
import { LogoMark } from '@/components/logo-mark';
import { PwaInstallButtonLanding } from '@/components/pwa-install';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Creator · SozialZynk',
  description: 'Join 100,000+ creators using AI to research, script, create, and publish content across every platform. Start free today.',
};

const PLATFORMS = [
  { name: 'YouTube',   color: '#FF0000', short: 'YT' },
  { name: 'Instagram', color: '#E1306C', short: 'IG' },
  { name: 'TikTok',   color: '#010101', short: 'TT', border: true },
  { name: 'LinkedIn', color: '#0A66C2', short: 'LI' },
  { name: 'Twitter',  color: '#1DA1F2', short: 'X' },
];

const CAPABILITIES = [
  { icon: Bot,           color: '#374151', bg: '#F3EEFF', title: 'AI Copilot (Voice)',      desc: 'Voice-enabled robot assistant. Speak to plan, create, and manage your channel — live transcript + chest-panel mic.' },
  { icon: Zap,           color: '#D97706', bg: '#FFFBEB', title: 'Trend Discovery',          desc: 'Surfaces trending topics before they peak so you create content while the audience is growing.' },
  { icon: Target,        color: '#BE185D', bg: '#FDF2F8', title: 'Research & Fact-Check',    desc: 'ResearchAgent gathers source material; FactCheckAgent verifies every claim before it reaches your script.' },
  { icon: Sparkles,      color: '#374151', bg: '#F3EEFF', title: 'AI Script Writer',         desc: 'Monetization-compliant, fact-checked scripts in your brand voice — with hooks, CTAs, and platform SEO baked in.' },
  { icon: Users,         color: '#0891B2', bg: '#ECFEFF', title: 'Character Studio',         desc: 'Generate original AI characters and avatars for your videos, thumbnails, and brand identity.' },
  { icon: Star,          color: '#DC2626', bg: '#FFF1F1', title: 'AI Thumbnails & Images',   desc: 'Eye-catching thumbnails and storyboard frames generated in seconds — sized for every platform.' },
  { icon: Globe2,        color: '#059669', bg: '#ECFDF5', title: 'Voice & Audio Studio',     desc: 'Text-to-speech narration, multi-voice synthesis, and AI music — all with your brand voice profile.' },
  { icon: Film,          color: '#1D4ED8', bg: '#EFF6FF', title: 'Shorts Studio',            desc: 'AI finds the best moments from long videos, adds captions and hooks, and exports viral Shorts.' },
  { icon: ShieldCheck,   color: '#059669', bg: '#ECFDF5', title: 'Compliance Engine',        desc: 'Every piece of content passes copyright, platform monetization policy, and fact-check gates automatically.' },
  { icon: Calendar,      color: '#374151', bg: '#F3EEFF', title: 'Publish & Autopilot',      desc: 'Schedule at peak times, review before publish, or let Autopilot handle the full pipeline hands-free.' },
  { icon: LineChart,     color: '#D97706', bg: '#FFFBEB', title: 'A/B Testing',              desc: 'Test titles and thumbnails on live videos. AI picks the winner — more clicks, better rankings.' },
  { icon: MessageSquare, color: '#0891B2', bg: '#ECFEFF', title: 'Ad Revenue (Pro)',         desc: 'Pro creators earn platform ad credits for every view on the public Browse feed — 50 credits per 1,000 views, paid daily.' },
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

const PLANS = [
  {
    name: 'Free', price: '$0', period: 'forever', popular: false,
    description: 'Start creating with AI. No credit card required.',
    cta: 'Start free', href: '/register',
    features: [
      { text: '2,000 AI credits / month', ok: true },
      { text: 'Unlimited channels connected', ok: true },
      { text: 'Unlimited AI Copilot queries', ok: true },
      { text: 'Unlimited Shorts Studio', ok: true },
      { text: 'Publish to SozialZynk feed', ok: true },
      { text: 'Publish to YouTube / Instagram', ok: false },
      { text: 'Export / download files', ok: false },
      { text: 'Ad revenue monetization', ok: false },
    ],
  },
  {
    name: 'Pro', price: '$17', period: 'per month', popular: true,
    description: 'Unlimited power to grow and monetize your channel.',
    cta: 'Go Pro', href: '/register',
    features: [
      { text: 'Unlimited AI credits', ok: true },
      { text: 'Unlimited channels', ok: true },
      { text: 'Unlimited AI Copilot', ok: true },
      { text: 'Full Creative Studio (all tools)', ok: true },
      { text: 'Publish to YouTube, Instagram & more', ok: true },
      { text: 'Export / download files', ok: true },
      { text: 'A/B Testing + Analytics', ok: true },
      { text: 'Ad revenue monetization', ok: true },
      { text: 'Own branding (white-label)', ok: true },
      { text: 'Dedicated SLA & support', ok: true },
    ],
  },
];

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Pricing',      href: '#pricing' },
  { label: 'Get the App',  href: '#download' },
];

export default function BecomeCreatorPage() {
  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes bc-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes bc-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes bc-pop { from{opacity:0;transform:translateY(12px) scale(.97)} to{opacity:1;transform:none} }
        @keyframes bc-orb-pulse { 0%,100%{transform:scale(1);opacity:.12} 50%{transform:scale(1.1);opacity:.2} }
        @keyframes bc-dash { to{stroke-dashoffset:-20} }
        @keyframes bc-count { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes bc-pulse-soft { 0%,100%{opacity:.6} 50%{opacity:1} }
        .bc-float { animation:bc-float 6s ease-in-out infinite; }
        .bc-pop-1 { animation:bc-pop .5s ease forwards .1s; opacity:0; }
        .bc-pop-2 { animation:bc-pop .5s ease forwards .25s; opacity:0; }
        .bc-pop-3 { animation:bc-pop .5s ease forwards .4s; opacity:0; }
        .bc-shimmer-btn { background:linear-gradient(90deg,#9ca3af,#374151,#6b7280,#374151,#9ca3af); background-size:300% 100%; animation:bc-shimmer 3s linear infinite; }
        .bc-card { transition:transform .3s ease,box-shadow .3s ease; }
        .bc-card:hover { transform:translateY(-3px); box-shadow:0 12px 28px -8px rgba(55,65,81,.15); }
        .bc-orb { animation:bc-orb-pulse 6s ease-in-out infinite; }
        .bc-count-1 { animation:bc-count .6s ease forwards .2s; opacity:0; }
        .bc-count-2 { animation:bc-count .6s ease forwards .4s; opacity:0; }
        .bc-count-3 { animation:bc-count .6s ease forwards .6s; opacity:0; }
        .bc-dash { animation:bc-dash 1.2s linear infinite; }
        .bc-pulse { animation:bc-pulse-soft 3s ease-in-out infinite; }
      `}</style>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/browse" className="flex items-center gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#374151] rounded-lg" aria-label="SozialZynk home">
            <LogoMark className="w-8 h-8 shrink-0" />
            <span className="font-bold text-[17px] leading-none tracking-tight hidden sm:block">
              <span style={{color:'#111827'}}>Sozial</span><span style={{color:'#374151'}}>Z</span><span style={{color:'#111827'}}>ynk</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={href} href={href} className="px-4 py-2 rounded-lg text-gray-500 text-sm font-medium hover:text-gray-900 hover:bg-gray-50 transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login" className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              Log in
            </Link>
            <Link href="/register" className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 bc-shimmer-btn">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#F9F7FF] to-white pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="bc-orb absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full" style={{background:'radial-gradient(ellipse,rgba(55,65,81,.12) 0%,transparent 70%)',filter:'blur(60px)'}} />
            <div className="bc-orb absolute top-20 left-[8%] w-48 h-48 rounded-full" style={{background:'rgba(55,65,81,.08)',filter:'blur(50px)',animationDelay:'2s'}} />
            <div className="bc-orb absolute top-32 right-[5%] w-40 h-40 rounded-full" style={{background:'rgba(8,145,178,.08)',filter:'blur(50px)',animationDelay:'4s'}} />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bc-pop-1 inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-1.5 mb-7 text-sm font-semibold" style={{background:'rgba(55,65,81,.05)',color:'#374151'}}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Join 100,000+ creators already publishing smarter
            </div>

            <h1 className="bc-pop-2 text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight">
              Turn ideas into content<br />
              <span style={{background:'linear-gradient(90deg,#374151,#0891B2)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                that grows everywhere
              </span>
            </h1>

            <p className="bc-pop-3 mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              SozialZynk is your AI content team. Research topics, write scripts, generate visuals, and publish to every platform — all from one workspace.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-gray-400 mr-1">Publish to</span>
              {PLATFORMS.map(p => (
                <span key={p.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{background:p.color,border:p.border?'1px solid rgba(0,0,0,.15)':'none'}}>
                  {p.short} <span className="hidden sm:inline opacity-90">{p.name}</span>
                </span>
              ))}
              <span className="text-xs font-medium text-gray-400">+ more</span>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="bc-shimmer-btn inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl font-bold text-white text-base shadow-lg hover:scale-[1.02] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#374151]">
                <Zap className="w-4 h-4" />
                Create my free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center gap-1.5 px-6 py-4 rounded-2xl font-semibold text-gray-600 text-base border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors">
                Already have an account? Log in
              </Link>
            </div>

            <p className="mt-4 text-sm text-gray-400">Free to start · No credit card required · Cancel any time</p>

            <div className="mt-12 grid grid-cols-3 gap-4 max-w-sm mx-auto">
              {[
                { value: '100K+', label: 'Creators' },
                { value: '5M+',   label: 'Scripts' },
                { value: '4.8★',  label: 'Rating' },
              ].map((s, i) => (
                <div key={s.label} className={`text-center bc-count-${i+1}`}>
                  <div className="text-2xl font-extrabold tracking-tight" style={{color:'#374151'}}>{s.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section aria-label="Social proof" className="bg-white border-y border-gray-100 py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { stat: '100K+ Creators', label: 'Publishing with AI' },
                { stat: '10× Faster',     label: 'Than manual research' },
                { stat: '5M+ Scripts',    label: 'AI-generated & published' },
                { stat: 'Zero',           label: 'Manual repurposing needed' },
              ].map(({ stat, label }) => (
                <div key={stat} className="flex flex-col items-center gap-1">
                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{color:'#374151'}}>{stat}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="bg-white py-20 sm:py-28 border-t border-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">How it works</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                From idea to published in minutes
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map(({ n, icon: Icon, title, desc }) => (
                <div key={n} className="bc-card relative bg-white border border-gray-100 rounded-3xl p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-3xl font-extrabold" style={{color:'#E5E7EB'}}>0{n}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-[17px] mb-1.5">{title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CAPABILITIES ── */}
        <section id="features" aria-labelledby="features-heading" className="py-24 lg:py-32" style={{background:'#f9fafb'}}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#374151'}}>Full capability suite</p>
              <h2 id="features-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                Everything you need to grow your channel,
                <br className="hidden sm:block" />
                <span style={{color:'#374151'}}> powered by AI</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                One platform for your entire content stack. From trend discovery to multi-platform publishing — all connected.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Platform capabilities">
              {CAPABILITIES.map(({ icon: Icon, color, bg, title, desc }) => (
                <li key={title} className="bc-card bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:bg}}>
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

        {/* ── WORKFLOW PIPELINE ── */}
        <section id="workflow" aria-labelledby="workflow-heading" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#374151'}}>End-to-end AI pipeline</p>
              <h2 id="workflow-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                From one idea,
                <span style={{color:'#374151'}}> to a published video</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
                Tell SozialZynk what you want to create. It researches, writes, checks compliance, and publishes to all your channels.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 sm:gap-4">
              {WORKFLOW.map(({ icon: Icon, label, sub }, idx) => (
                <div key={label} className="relative flex flex-col items-center text-center group">
                  {idx < WORKFLOW.length - 1 && (
                    <div aria-hidden="true" className="hidden lg:block absolute top-8 left-[calc(50%+28px)] right-0 h-3 overflow-hidden">
                      <svg width="100%" height="12" className="absolute inset-0">
                        <line x1="0" y1="6" x2="100%" y2="6" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="6 4" className="bc-dash" />
                      </svg>
                    </div>
                  )}
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4 transition-transform group-hover:scale-110 group-hover:shadow-lg" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                    <Icon className="w-7 h-7 text-white" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{background:'#1f2937'}}>
                      {idx + 1}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">{label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-[140px]">{sub}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-14">
              <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base transition-all hover:opacity-90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 shadow-xl" style={{background:'linear-gradient(135deg,#374151,#1f2937)',boxShadow:'0 16px 40px -10px rgba(55,65,81,.4)'}}>
                <Zap className="w-4 h-4" />
                Start your first AI project
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="mt-3 text-sm text-gray-500">Free to start · No credit card required</p>
            </div>
          </div>
        </section>

        {/* ── AI COPILOT DEMO ── */}
        <section aria-label="AI Copilot demo" className="py-24 lg:py-32" style={{background:'#f9fafb'}}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#374151'}}>Natural language first</p>
                <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  No forms.<br />No menus.<br />
                  <span style={{color:'#374151'}}>Just conversation.</span>
                </h2>
                <p className="mt-6 text-lg text-gray-500 leading-relaxed">
                  SozialZynk&apos;s AI Copilot works like an experienced content manager. Tell it what you need — it researches, writes, generates assets, and gets your content published everywhere.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    { t: 'Full content pipeline',  d: 'One conversation handles research, scripting, visuals, voice, and multi-platform publishing.' },
                    { t: 'Voice & text input',      d: 'Speak or type — the Copilot understands both.' },
                    { t: 'Multi-language support',  d: 'Responds in your language: English, Hindi, Tamil, and 30+ more.' },
                    { t: 'Brand voice memory',       d: 'Remembers your tone and style so every script sounds authentically like you.' },
                  ].map(({ t, d }) => (
                    <li key={t} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{background:'#f3f4f6'}}>
                        <CheckCircle2 className="w-3.5 h-3.5" style={{color:'#374151'}} />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">{t}</span>
                        <span className="text-gray-500 text-sm"> — {d}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-10">
                  <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90" style={{background:'linear-gradient(135deg,#374151,#1f2937)'}}>
                    Try the AI Copilot <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 rounded-3xl" style={{background:'radial-gradient(ellipse at 50% 50%,rgba(55,65,81,.06) 0%,transparent 70%)'}} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{background:'#1a1033',border:'1px solid rgba(255,255,255,.08)'}}>
                  <div className="p-5 space-y-4">
                    <div className="flex justify-center py-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{background:'linear-gradient(135deg,#9ca3af,#374151)',boxShadow:'0 0 0 12px rgba(55,65,81,.12),0 0 0 24px rgba(55,65,81,.06)'}}>
                          <Bot className="w-9 h-9 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{background:'#10B981',border:'2px solid #1a1033'}}>
                          <div className="w-2 h-2 rounded-full bg-white bc-pulse" />
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-xs font-medium" style={{color:'rgba(255,255,255,.5)'}}>Copilot ready · Listening…</p>
                    <div className="space-y-3 pt-2">
                      {[
                        { role:'ai',  text:'What content would you like to create today?' },
                        { role:'user',text:'Research trending topics and write 3 scripts.' },
                        { role:'ai',  text:'ResearchAgent found 8 trending gaps in your niche. Writing 3 fact-checked scripts now.' },
                        { role:'user',text:'Great. Add thumbnails and voice narration.' },
                        { role:'ai',  text:'Done! 3 scripts, 3 thumbnails, 3 voice tracks — all passed compliance. Ready to schedule?' },
                      ].map(({ role, text }, i) => (
                        <div key={i} className={`flex ${role==='user'?'flex-row-reverse':''} items-end gap-2`}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 text-white" style={{background:role==='ai'?'linear-gradient(135deg,#9ca3af,#374151)':'linear-gradient(135deg,#f472b6,#ec4899)'}}>
                            {role==='ai'?'AI':'U'}
                          </div>
                          <div className="max-w-[76%] px-3 py-2 text-[11px] leading-relaxed" style={{background:role==='ai'?'rgba(156,163,175,.12)':'rgba(255,255,255,.08)',color:role==='ai'?'#e0d7ff':'rgba(255,255,255,.85)',borderRadius:role==='ai'?'18px 18px 18px 4px':'18px 18px 4px 18px'}}>
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
        <section aria-labelledby="tools-heading" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#374151'}}>Built-in creator tools</p>
              <h2 id="tools-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                Everything in one place,
                <span style={{color:'#374151'}}> nothing to install</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Three powerful tools work together seamlessly — from trend discovery to published, compliant content.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  Icon: FolderOpen, color: '#374151', bg: '#F3EEFF', title: 'Projects', badge: 'Step 1',
                  desc: 'Your content command center. Connect channels, create projects by niche, and let AI run the full pipeline.',
                  steps: ['Connect your channels and platforms','Create a project with your niche and goals','AI generates the complete content pipeline'],
                },
                {
                  Icon: Sparkles, color: '#0891B2', bg: '#ECFEFF', title: 'Creative Studio', badge: 'Step 2',
                  desc: 'All creation tools in one place. Characters, AI images, voice studio, audio, Shorts, and AI thumbnails.',
                  steps: ['Build AI characters for your videos','Generate thumbnails, storyboards, and assets','Narrate with voice synthesis or your own voice'],
                },
                {
                  Icon: ShieldCheck, color: '#059669', bg: '#ECFDF5', title: 'Publish Hub', badge: 'Step 3',
                  desc: 'Review, compliance-check, and publish — or let Autopilot handle it. A/B test. Track performance.',
                  steps: ['Approve or auto-publish when ready','A/B test titles and thumbnails live','Analytics feed back into the next content cycle'],
                },
              ].map(({ Icon, color, bg, title, badge, desc, steps }) => (
                <div key={title} className="bc-card border border-gray-100 rounded-3xl p-6 hover:shadow-lg transition-all flex flex-col gap-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:bg}}>
                      <Icon className="w-6 h-6" style={{color}} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{background:bg,color}}>{badge}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                  <ul className="space-y-1.5 mt-auto">
                    {steps.map(s => (
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

        {/* ── TESTIMONIALS ── */}
        <section className="py-20 sm:py-28 border-t border-gray-50" style={{background:'#f9fafb'}}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Creator stories</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Real creators, real growth</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map(({ name, handle, avatar, color, text, stat }) => (
                <div key={name} className="bc-card bg-white border border-gray-100 rounded-3xl p-6 flex flex-col gap-4">
                  <div className="flex gap-0.5" aria-label="5 stars">
                    {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1">&ldquo;{text}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{background:color}}>
                      {avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm leading-none mb-0.5">{name}</div>
                      <div className="text-xs text-gray-400">{handle}</div>
                    </div>
                    <div className="ml-auto">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:'#F0FDF4',color:'#059669'}}>{stat}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="bg-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#374151'}}>Simple, transparent pricing</p>
              <h2 id="pricing-heading" className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                Start free. <span style={{color:'#374151'}}>Scale as you grow.</span>
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Every plan includes AI-powered content creation, compliance checks, and multi-platform publishing. No hidden fees.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {PLANS.map(({ name, price, period, description, cta, href, popular, features }) => (
                <div key={name} className={`relative flex flex-col rounded-3xl p-6 transition-all ${popular?'shadow-2xl ring-2 ring-[#374151] scale-[1.02]':'border border-gray-100 hover:border-gray-200 hover:shadow-lg'}`} style={popular?{background:'linear-gradient(160deg,#0e0924 0%,#1a0f4a 100%)'}:{background:'#fff'}}>
                  {popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#9ca3af,#374151)'}}>
                        <Sparkles className="w-3 h-3" /> Most popular
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className={`text-sm font-bold uppercase tracking-widest mb-2 ${popular?'text-gray-300':'text-gray-500'}`}>{name}</p>
                    <div className="flex items-end gap-1">
                      <span className={`text-4xl font-extrabold ${popular?'text-white':'text-gray-900'}`}>{price}</span>
                      <span className={`text-sm mb-1 ${popular?'text-gray-300':'text-gray-400'}`}>/{period}</span>
                    </div>
                    <p className={`mt-2 text-sm leading-relaxed ${popular?'text-gray-200':'text-gray-500'}`}>{description}</p>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {features.map(({ text, ok }) => (
                      <li key={text} className={`flex items-start gap-2.5 text-sm ${ok?(popular?'text-white':'text-gray-700'):(popular?'text-gray-400/50':'text-gray-300')}`}>
                        {ok
                          ? <Check className={`w-4 h-4 shrink-0 mt-0.5 ${popular?'text-gray-300':'text-[#374151]'}`} />
                          : <Minus className="w-4 h-4 shrink-0 mt-0.5 opacity-40" />}
                        {text}
                      </li>
                    ))}
                  </ul>
                  <Link href={href} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 text-white" style={popular?{background:'linear-gradient(135deg,#9ca3af,#374151)',boxShadow:'0 8px 30px -8px rgba(55,65,81,.6)'}:{background:'linear-gradient(135deg,#374151,#1f2937)'}}>
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

        {/* ── DOWNLOAD ── */}
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
              {['⚡ Instant launch','📴 Works offline','🔔 Push notifications','🔒 Secure & private','🔄 Auto-updates','📱 Native feel'].map(feat => (
                <span key={feat} className="text-sm font-medium px-4 py-2 rounded-full" style={{background:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.6)',border:'1px solid rgba(255,255,255,.1)'}}>
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-20 sm:py-28" style={{background:'linear-gradient(160deg,#0e0924 0%,#1a0f4a 50%,#2d1b6e 100%)'}}>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-20" style={{background:'radial-gradient(ellipse,#374151 0%,transparent 70%)',filter:'blur(50px)'}} />
            </div>
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{color:'#9ca3af'}}>Ready to create?</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Your audience is waiting.<br />Start today.
              </h2>
              <p className="mt-6 text-lg text-white/60 max-w-xl mx-auto">
                Join 100,000+ creators using AI to research, create, and publish smarter. Free to start — no credit card required.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register" className="bc-shimmer-btn inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl font-bold text-white text-base shadow-2xl transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <Zap className="w-5 h-5" />
                  Create my free account
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white/80 text-base transition-all hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{border:'1.5px solid rgba(255,255,255,.2)'}}>
                  Log in to existing account
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
                {['No credit card required','Multi-platform publishing','14-day free trial'].map(t => (
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
                  { label: 'Features',  href: '#features' },
                  { label: 'Workflow',  href: '#workflow' },
                  { label: 'Pricing',   href: '#pricing' },
                  { label: 'Download',  href: '#download' },
                  { label: 'Log in',    href: '/login' },
                ].map(({ label, href }) => (
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
    </div>
  );
}
