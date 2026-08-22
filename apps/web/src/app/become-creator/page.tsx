import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, Sparkles, ShieldCheck, Target, LineChart,
  Star, Bot, Globe2, Zap, Film,
} from 'lucide-react';
import { LogoMark } from '@/components/logo-mark';
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

const BENEFITS = [
  { icon: Target,      color: '#374151', bg: '#F3EEFF', title: 'AI Research Engine',       desc: 'Surface trending topics before they peak. Every script backed by real sources.' },
  { icon: Sparkles,    color: '#0891B2', bg: '#ECFEFF', title: 'Script Writer',             desc: 'Brand-voice scripts with hooks, CTAs, and platform SEO — in minutes, not hours.' },
  { icon: Star,        color: '#DC2626', bg: '#FFF1F1', title: 'Thumbnail Generator',       desc: 'Eye-catching thumbnails sized for every platform, generated in seconds.' },
  { icon: Globe2,      color: '#059669', bg: '#ECFDF5', title: 'Voice & Audio Studio',      desc: 'Natural text-to-speech, multi-voice synthesis, and AI music tracks.' },
  { icon: ShieldCheck, color: '#059669', bg: '#ECFDF5', title: 'Compliance Built In',       desc: 'Copyright, monetization, and fact-check gates run automatically before publish.' },
  { icon: LineChart,   color: '#D97706', bg: '#FFFBEB', title: 'Analytics & Growth',        desc: 'Track performance across all platforms. AI recommends your next winning topic.' },
  { icon: Film,        color: '#1D4ED8', bg: '#EFF6FF', title: 'Shorts & Clips Studio',     desc: 'Auto-find viral moments, add captions, and export Shorts with one click.' },
  { icon: Bot,         color: '#374151', bg: '#F3EEFF', title: 'AI Autopilot',              desc: 'Schedule at peak times or let Autopilot run the full pipeline hands-free.' },
];

const STEPS = [
  { n: '1', icon: Target,   title: 'Connect your channels', desc: 'Link YouTube, Instagram, TikTok, and more. SozialZynk handles the rest.' },
  { n: '2', icon: Sparkles, title: 'Describe your idea',    desc: 'Speak or type what you want to create. AI researches, writes, and builds everything.' },
  { n: '3', icon: Globe2,   title: 'Review & publish',      desc: 'Approve in one click or let Autopilot schedule and post at peak times.' },
];

const TESTIMONIALS = [
  { name: 'Marcus Chen',     handle: '@marcustech',  avatar: 'M', color: '#374151', text: 'Went from 5K to 150K in 6 months. The AI research finds angles I\'d never have thought of.', stat: '150K followers' },
  { name: 'Priya Sharma',    handle: '@priyacooks',  avatar: 'P', color: '#059669', text: 'I publish on 4 platforms now and spend less time on content than when I was on one.', stat: '4× platform reach' },
  { name: 'Jordan Williams', handle: '@jordanlifts', avatar: 'J', color: '#DC2626', text: 'The compliance engine saved me from a demonetization warning. It catches what I miss.', stat: '0 policy strikes' },
];

export default function BecomeCreatorPage() {
  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes bc-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes bc-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes bc-pop { from{opacity:0;transform:translateY(12px) scale(.97)} to{opacity:1;transform:none} }
        .bc-float { animation:bc-float 6s ease-in-out infinite; }
        .bc-pop-1 { animation:bc-pop .5s ease forwards .1s; opacity:0; }
        .bc-pop-2 { animation:bc-pop .5s ease forwards .25s; opacity:0; }
        .bc-pop-3 { animation:bc-pop .5s ease forwards .4s; opacity:0; }
        .bc-shimmer-btn { background:linear-gradient(90deg,#9ca3af,#374151,#818cf8,#374151,#9ca3af); background-size:300% 100%; animation:bc-shimmer 3s linear infinite; }
        .bc-card { transition:transform .3s ease,box-shadow .3s ease; }
        .bc-card:hover { transform:translateY(-3px); box-shadow:0 12px 28px -8px rgba(55,65,81,.18); }
      `}</style>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#374151] rounded-lg">
            <LogoMark className="w-8 h-8 shrink-0" />
            <span className="font-bold text-[17px] leading-none tracking-tight hidden sm:block">
              <span style={{color:'#111827'}}>Sozial</span><span style={{color:'#374151'}}>Z</span><span style={{color:'#111827'}}>ynk</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#F9F7FF] to-white pt-16 pb-20 sm:pt-24 sm:pb-28">
          {/* Background orbs */}
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-20" style={{background:'radial-gradient(ellipse,#374151 0%,transparent 70%)',filter:'blur(60px)'}} />
            <div className="absolute top-20 left-[8%] w-48 h-48 rounded-full opacity-10" style={{background:'#374151',filter:'blur(50px)'}} />
            <div className="absolute top-32 right-[5%] w-40 h-40 rounded-full opacity-10" style={{background:'#0891B2',filter:'blur(50px)'}} />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Trust badge */}
            <div className="bc-pop-1 inline-flex items-center gap-2 rounded-full border border-gray-100 px-4 py-1.5 mb-7 text-sm font-semibold" style={{background:'rgba(55,65,81,.06)',color:'#374151'}}>
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

            {/* Platform pills */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-gray-400 mr-1">Publish to</span>
              {PLATFORMS.map(p => (
                <span
                  key={p.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                  style={{background:p.color, border: p.border ? '1px solid rgba(0,0,0,.15)' : 'none'}}
                >
                  {p.short} <span className="hidden sm:inline opacity-90">{p.name}</span>
                </span>
              ))}
              <span className="text-xs font-medium text-gray-400">+ more</span>
            </div>

            {/* Primary CTA */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="bc-shimmer-btn inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl font-bold text-white text-base shadow-lg hover:scale-[1.02] hover:shadow-purple-300/60 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#374151]"
              >
                <Zap className="w-4 h-4" />
                Create my free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-4 rounded-2xl font-semibold text-gray-600 text-base border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Already have an account? Log in
              </Link>
            </div>

            <p className="mt-4 text-sm text-gray-400">Free to start · No credit card required · Cancel any time</p>

            {/* Social proof mini-stats */}
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-sm mx-auto">
              {[
                { value: '100K+', label: 'Creators' },
                { value: '5M+',   label: 'Scripts' },
                { value: '4.8★',  label: 'Rating' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-extrabold tracking-tight" style={{color:'#374151'}}>{s.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
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

        {/* ── BENEFITS GRID ── */}
        <section className="py-20 sm:py-28 border-t border-gray-50" style={{background:'#F9F7FF'}}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Everything you need</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                Your full creator toolkit,<br className="hidden sm:block" /> powered by AI
              </h2>
              <p className="mt-4 text-gray-500 max-w-xl mx-auto">
                One workspace replaces every standalone tool. Research, write, create, and publish — without switching apps.
              </p>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BENEFITS.map(({ icon: Icon, color, bg, title, desc }) => (
                <li key={title} className="bc-card bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-3">
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

        {/* ── SOCIAL PROOF ── */}
        <section className="bg-white py-20 sm:py-28 border-t border-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Creator stories</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                Real creators, real growth
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map(({ name, handle, avatar, color, text, stat }) => (
                <div key={name} className="bc-card bg-white border border-gray-100 rounded-3xl p-6 flex flex-col gap-4">
                  <div className="flex gap-0.5" aria-label="5 stars">
                    {[...Array(5)].map((_,i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
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

        {/* ── FINAL CTA ── */}
        <section className="py-20 sm:py-28 border-t border-gray-50" style={{background:'linear-gradient(160deg,#0e0924 0%,#1a0f4a 50%,#2d1b6e 100%)'}}>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-25" style={{background:'radial-gradient(ellipse,#374151 0%,transparent 70%)',filter:'blur(50px)'}} />
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
                <Link
                  href="/login"
                  className="bc-shimmer-btn inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl font-bold text-white text-base shadow-2xl hover:scale-[1.02] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{boxShadow:'0 20px 50px -12px rgba(55,65,81,.6)'}}
                >
                  <Zap className="w-4 h-4" />
                  Create my free account
                  <ArrowRight className="w-4 h-4" />
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
      <footer style={{background:'#07041a',borderTop:'1px solid rgba(255,255,255,.06)'}} className="py-8 text-center text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark className="w-7 h-7 shrink-0" variant="light" />
            <span className="font-bold text-sm text-white">Sozial<span style={{color:'#d1d5db'}}>Z</span>ynk</span>
          </div>
          <p style={{color:'rgba(255,255,255,.25)'}}>
            &copy; {new Date().getFullYear()} SozialZynk · <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link> · <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
          </p>
          <Link href="/login" className="text-sm font-medium hover:text-white/80 transition-colors" style={{color:'rgba(255,255,255,.45)'}}>
            Already a creator? Log in →
          </Link>
        </div>
      </footer>
    </div>
  );
}
