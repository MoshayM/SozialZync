'use client';
import React from 'react';
import { LogoMark } from '@/components/logo-mark';

// ─── Legacy shell — used by register / forgot-password / reset-password ───────

export function AuthShell({
  brand,
  title,
  subtitle,
  mascot,
  children,
  footer,
}: {
  brand: string;
  title: string;
  subtitle: string;
  mascot: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-200 relative overflow-hidden py-10 px-4">
      <div className="absolute top-16 left-[12%] w-24 h-10 bg-white/80 rounded-full blur-[1px]" />
      <div className="absolute top-24 left-[16%] w-14 h-8 bg-white/70 rounded-full" />
      <div className="absolute top-32 right-[14%] w-28 h-11 bg-white/80 rounded-full blur-[1px]" />
      <div className="absolute bottom-24 left-[8%] w-40 h-40 bg-gray-400/60 rounded-full" />
      <div className="absolute bottom-10 right-[6%] w-56 h-56 bg-gray-300/50 rounded-full" />

      <div className="relative w-full max-w-md bg-gray-50 rounded-[3rem] shadow-2xl px-6 pt-10 pb-8">
        <p className="text-center text-[11px] font-semibold tracking-[0.25em] uppercase text-gray-600 mb-3">{brand}</p>
        <div className="text-center">
          <span className="text-lg" aria-hidden>💜</span>
          <h1 className="text-3xl font-extrabold text-gray-800 mt-1">
            <span className="text-[#e8c14d] mr-2" aria-hidden>✦</span>
            {title}
            <span className="text-[#e8c14d] ml-2" aria-hidden>✦</span>
          </h1>
          <p className="text-sm text-gray-600 mt-2">{subtitle}</p>
        </div>
        <div className="relative z-10 flex justify-center -mb-9 mt-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-b from-gray-300 to-gray-400 shadow-lg flex items-center justify-center text-5xl select-none" aria-hidden>
            {mascot}
          </div>
        </div>
        <div className="bg-white rounded-[2rem] shadow-xl px-5 pb-6 pt-14">
          {children}
        </div>
        <div className="text-center text-sm text-gray-600 mt-5">{footer}</div>
      </div>
    </div>
  );
}

export function AuthPillInput({
  icon,
  ...inputProps
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center bg-white border border-gray-200 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)] pr-3 focus-within:ring-2 focus-within:ring-gray-400">
      <span className="w-10 h-10 m-1 rounded-full bg-gray-600 text-white flex items-center justify-center shrink-0">
        {icon}
      </span>
      <input
        {...inputProps}
        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
      />
    </div>
  );
}

// ─── Split-screen login shell ──────────────────────────────────────────────────

const LOGIN_FEATURES = [
  { icon: '🤖', text: 'Voice AI Copilot' },
  { icon: '🔬', text: 'Research & Fact-Check' },
  { icon: '📝', text: 'AI Script Writer' },
  { icon: '🎭', text: 'Character Studio' },
  { icon: '✅', text: 'Compliance Engine' },
  { icon: '🚀', text: 'Multi-Platform Publishing' },
];

const LOGIN_STATS = [
  { value: '100K+', label: 'Creators' },
  { value: '5M+', label: 'Scripts Generated' },
  { value: '4.8★', label: 'Rating' },
];

export function LoginShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <style>{`
        @keyframes lf-float-a { 0%,100%{transform:translateY(0) rotateX(0deg)} 50%{transform:translateY(-10px) rotateX(4deg)} }
        @keyframes lf-float-b { 0%,100%{transform:translateY(0) rotateX(0deg)} 50%{transform:translateY(-14px) rotateX(-3deg)} }
        @keyframes lf-float-c { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes lf-spin   { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes lf-spin-r { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
        @keyframes lf-count  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lf-grad   { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes lf-shimmer{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes lf-rp-shift{ 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        .lf-float-a { animation:lf-float-a 7s ease-in-out infinite; }
        .lf-float-b { animation:lf-float-b 9s ease-in-out infinite; }
        .lf-float-c { animation:lf-float-c 5s ease-in-out infinite; }
        .lf-spin    { animation:lf-spin 28s linear infinite; }
        .lf-spin-r  { animation:lf-spin-r 40s linear infinite; }
        .lf-count-1 { animation:lf-count .6s ease forwards .1s; opacity:0; }
        .lf-count-2 { animation:lf-count .6s ease forwards .3s; opacity:0; }
        .lf-count-3 { animation:lf-count .6s ease forwards .5s; opacity:0; }
        .lf-card { transform-style:preserve-3d; }
        .lf-card:hover { transform:perspective(800px) rotateX(-4deg) rotateY(6deg) translateZ(8px) scale(1.02); transition:transform .4s ease,box-shadow .4s ease; box-shadow:0 24px 48px -8px rgba(0,0,0,.25); }
        .lf-shimmer-btn { background:linear-gradient(90deg,#9ca3af,#374151,#6b7280,#374151,#9ca3af); background-size:300% 100%; animation:lf-shimmer 3s linear infinite; }
        .lf-rp { background:linear-gradient(135deg,#fafafa 0%,#f3f4f6 40%,#e5e7eb 100%); background-size:200% 200%; animation:lf-rp-shift 8s ease infinite; }
      `}</style>

      {/* ── Left: Brand panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[58%] xl:w-[60%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'radial-gradient(ellipse at 30% 40%, #0f172a 0%, #020617 55%, #030712 100%)' }}
      >
        {/* Deep space ambient orbs */}
        <div className="absolute -top-40 -left-20 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.15)', filter: 'blur(80px)' }} />
        <div className="absolute top-1/2 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.25)', filter: 'blur(70px)' }} />

        {/* Perspective grid overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{opacity:.05}}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lg-gfade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="1"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </linearGradient>
              <mask id="lg-gmask"><rect width="100%" height="100%" fill="url(#lg-gfade)"/></mask>
            </defs>
            <g mask="url(#lg-gmask)" stroke="white" strokeWidth="0.5">
              {[10,20,30,40,50,60,70,80,90].map(x => <line key={x} x1={`${x}%`} y1="0" x2="50%" y2="100%"/>)}
              {[15,30,45,60,75,90].map((y,i) => <line key={i} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`}/>)}
            </g>
          </svg>
        </div>

        {/* Floating 3D dashboard mini-cards */}
        <div className="absolute top-[18%] right-12 lf-float-a lf-card z-20 pointer-events-none">
          <div className="px-4 py-3 rounded-2xl" style={{background:'rgba(255,255,255,.08)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,.14)'}}>
            <div className="text-white/50 text-[10px] mb-1">Subscribers gained today</div>
            <div className="text-white font-extrabold text-lg">+2,847</div>
            <div className="text-emerald-400 text-[10px] font-semibold mt-0.5">▲ 12.4%</div>
          </div>
        </div>

        <div className="absolute top-[42%] right-8 lf-float-b lf-card z-20 pointer-events-none">
          <div className="px-4 py-3 rounded-2xl" style={{background:'rgba(255,255,255,.08)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,.14)'}}>
            <div className="text-white/50 text-[10px] mb-1">Compliance check</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white font-bold text-sm">Passed</span>
            </div>
            <div className="text-white/40 text-[10px] mt-0.5">3 checks ran</div>
          </div>
        </div>

        <div className="absolute bottom-[28%] right-16 lf-float-c lf-card z-20 pointer-events-none">
          <div className="px-4 py-3 rounded-2xl" style={{background:'rgba(255,255,255,.08)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,.14)'}}>
            <div className="text-white/50 text-[10px] mb-1">Click-through rate</div>
            <div className="text-white font-extrabold text-lg">8.2%</div>
            <div className="text-amber-400 text-[10px] font-semibold mt-0.5">▲ Above avg.</div>
          </div>
        </div>

        {/* Logo with orbital ring */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            {/* Orbital rings */}
            <div className="lf-spin absolute inset-[-8px] rounded-full" style={{border:'1px solid rgba(156,163,175,.35)'}} />
            <div className="lf-spin-r absolute inset-[-16px] rounded-full" style={{border:'1px solid rgba(0,0,0,.15)'}} />
            <LogoMark className="absolute inset-0 w-full h-full" variant="light" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Z</span><span className="text-white">ynk</span>
            </div>
            <div className="text-white/45 text-xs mt-0.5">AI Creator Platform</div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 text-white/80 text-xs font-semibold px-4 py-1.5 rounded-full mb-8" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)',border:'1px solid rgba(255,255,255,.12)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            AI Creator Platform
          </div>

          <h1 className="text-5xl xl:text-[3.4rem] font-extrabold text-white leading-[1.1] mb-5">
            Research. Script.<br />
            <span style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg,#ffffff,#d1d5db,#e5e7eb,#ffffff)', backgroundClip: 'text', backgroundSize:'200% 100%', animation:'lf-grad 4s ease infinite' }}>
              Publish Everywhere.
            </span>
          </h1>

          <p className="text-white/60 text-[1.05rem] leading-relaxed max-w-sm mb-10">
            Your full content creation pipeline — from trend research and AI scripts to compliance-checked publishing across all your channels. Available 24/7.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2.5 mb-12">
            {LOGIN_FEATURES.map((f) => (
              <span key={f.text} className="inline-flex items-center gap-1.5 text-sm text-white/80 font-medium px-3.5 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)', border:'1px solid rgba(255,255,255,.1)' }}>
                <span aria-hidden>{f.icon}</span> {f.text}
              </span>
            ))}
          </div>

          {/* Animated stats */}
          <div className="flex items-center gap-8">
            {LOGIN_STATS.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="w-px h-10 bg-white/15" />}
                <div className={`lf-count-${i + 1}`}>
                  <div className="text-2xl font-extrabold text-white">{s.value}</div>
                  <div className="text-white/45 text-xs mt-0.5">{s.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex gap-0.5 mb-3" role="img" aria-label="5 stars">
            {[...Array(5)].map((_, i) => <span key={i} className="text-[#f0c14d] text-sm" aria-hidden>★</span>)}
          </div>
          <p className="text-white/75 text-sm leading-relaxed mb-4">
            &ldquo;SozialZynk helped me grow from 5K to 150K subscribers in 6 months. The AI research and multi-platform publishing saved me so much time.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f0c14d] to-[#f5a623] flex items-center justify-center text-sm font-bold text-gray-800 shrink-0">M</div>
            <div>
              <div className="text-white text-sm font-semibold leading-none mb-0.5">Marcus Chen</div>
              <div className="text-white/45 text-xs">Tech Creator · 150K subscribers</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Form panel (gradient animated) ────────────────────────── */}
      <div className="lf-rp flex-1 flex items-center justify-center px-6 sm:px-10 py-12 overflow-y-auto">
        <div className="w-full max-w-[370px]">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-[1.9rem] font-extrabold text-gray-900 leading-tight mb-1.5">Welcome back</h2>
            <p className="text-gray-500 text-sm">Sign in to continue to your dashboard</p>
          </div>

          {children}

          <div className="text-center text-sm text-gray-500 mt-8">{footer}</div>
        </div>
      </div>
    </div>
  );
}

/** Clean rectangular input for the login page */
export function LoginInput({
  icon,
  label,
  rightElement,
  ...inputProps
}: {
  icon?: React.ReactNode;
  label?: string;
  rightElement?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      )}
      <div
        className="flex items-center bg-white rounded-2xl transition-all focus-within:ring-2 focus-within:ring-gray-300 focus-within:border-gray-400"
        style={{ border: '1.5px solid #e5e7eb' }}
      >
        {icon && (
          <span className="pl-3.5 text-gray-600 shrink-0">{icon}</span>
        )}
        <input
          {...inputProps}
          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-sm text-gray-800 placeholder-gray-600 focus:outline-none"
        />
        {rightElement && (
          <span className="pr-2 shrink-0">{rightElement}</span>
        )}
      </div>
    </div>
  );
}

// ─── Split-screen register shell ──────────────────────────────────────────────

const REGISTER_PERKS = [
  { icon: '🧠', text: 'AI video ideas & script writing' },
  { icon: '📈', text: 'SEO optimization & thumbnail copy' },
  { icon: '🎯', text: 'Trend & competitor discovery' },
  { icon: '🚀', text: 'One-click YouTube publishing' },
  { icon: '📊', text: 'Channel analytics dashboard' },
  { icon: '✅', text: 'Compliance & monetization check' },
];

export function RegisterShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: Brand panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-18 py-14"
        style={{ background: 'linear-gradient(145deg, #1f2937 0%, #374151 55%, #4b5563 100%)' }}
      >
        {/* Ambient orbs */}
        <div
          className="absolute -top-40 -left-28 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(90px)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(70px)' }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'rgba(0,0,0,.25)', filter: 'blur(80px)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <LogoMark className="w-12 h-12 shrink-0" />
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI YouTube Content OS</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 text-white/80 text-xs font-semibold px-4 py-1.5 rounded-full mb-8"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Free forever plan · No credit card needed
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] mb-4">
            Launch Your<br />
            <span
              style={{
                WebkitTextFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                backgroundImage: 'linear-gradient(90deg, #f0c14d 0%, #ffd966 100%)',
                backgroundClip: 'text',
              }}
            >
              YouTube Channel
            </span>
            <br />with AI
          </h1>

          <p className="text-white/65 text-base leading-relaxed max-w-xs mb-8">
            Your full YouTube content OS — research, scripts, characters, voice, thumbnails, and publishing in one place.
          </p>

          {/* Perks list */}
          <div className="space-y-3 mb-10">
            {REGISTER_PERKS.map((p) => (
              <div key={p.text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                  style={{ background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(8px)' }}
                >
                  {p.icon}
                </div>
                <span className="text-white/85 text-sm font-medium">{p.text}</span>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: '🔒', text: 'SOC 2 compliant' },
              { icon: '⚡', text: 'Setup in 2 minutes' },
              { icon: '🎁', text: 'Free plan forever' },
            ].map((b) => (
              <span
                key={b.text}
                className="inline-flex items-center gap-1.5 text-xs text-white/75 font-medium px-3.5 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)' }}
              >
                <span aria-hidden>{b.icon}</span> {b.text}
              </span>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div
          className="relative z-10 rounded-2xl p-5"
          style={{
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <div className="flex gap-0.5 mb-3" role="img" aria-label="5 stars">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-[#f0c14d] text-sm" aria-hidden>★</span>
            ))}
          </div>
          <p className="text-white/80 text-sm leading-relaxed mb-4">
            &ldquo;I was spending 20+ hours a week on content research. Sozialzynk cut that to under 2 hours. The research agent and fact-checker alone are worth it.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f0c14d] to-[#f5a623] flex items-center justify-center text-sm font-bold text-gray-800 shrink-0">
              S
            </div>
            <div>
              <div className="text-white text-sm font-semibold leading-none mb-0.5">Sofia Martinez</div>
              <div className="text-white/50 text-xs">Lifestyle Creator · 85K subscribers</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 sm:px-10 py-10 overflow-y-auto">
        <div className="w-full max-w-[380px]">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </div>

          <div className="mb-7">
            <h2 className="text-[1.75rem] font-extrabold text-gray-900 leading-tight mb-1.5">Create your account</h2>
            <p className="text-gray-600 text-sm">Free forever · No credit card required</p>
          </div>

          {children}

          <p className="text-center text-sm text-gray-600 mt-7">{footer}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Forgot-password shell ────────────────────────────────────────────────────

const RECOVERY_STEPS = [
  {
    n: '1',
    icon: '📧',
    title: 'Enter your email',
    desc: "We'll verify it's registered with Sozialzynk",
  },
  {
    n: '2',
    icon: '📬',
    title: 'Check your inbox',
    desc: 'Look for an email from Sozialzynk (check spam too)',
  },
  {
    n: '3',
    icon: '🔑',
    title: 'Set a new password',
    desc: 'Click the secure link and choose a strong password',
  },
];

export function ForgotPasswordShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(145deg, #1f2937 0%, #374151 55%, #4b5563 100%)' }}
      >
        <div className="absolute -top-40 -left-28 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(90px)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <LogoMark className="w-12 h-12 shrink-0" />
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI YouTube Content OS</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          {/* Lock icon */}
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-8" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
            🔒
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] mb-4">
            Account<br />
            <span style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg, #f0c14d 0%, #ffd966 100%)', backgroundClip: 'text' }}>
              Recovery
            </span>
          </h1>
          <p className="text-white/65 text-base leading-relaxed max-w-xs mb-10">
            Regain access to your account in three simple steps. Your data is safe and waiting for you.
          </p>

          {/* Steps */}
          <div className="space-y-5">
            {RECOVERY_STEPS.map((s, i) => (
              <div key={s.n} className="flex items-start gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-extrabold text-gray-800 bg-[#f0c14d] shrink-0">
                    {s.n}
                  </div>
                  {i < RECOVERY_STEPS.length - 1 && (
                    <div className="w-px h-5 mt-1 bg-white/20" />
                  )}
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span aria-hidden>{s.icon}</span>
                    <span className="text-white font-semibold text-sm">{s.title}</span>
                  </div>
                  <p className="text-white/55 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security note */}
        <div className="relative z-10 rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span className="text-xl shrink-0 mt-0.5" aria-hidden>🛡️</span>
          <div>
            <div className="text-white text-sm font-semibold mb-0.5">Secure reset link</div>
            <p className="text-white/60 text-xs leading-relaxed">Reset links expire after 1 hour and can only be used once. We&apos;ll never ask for your password over email.</p>
          </div>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 sm:px-10 py-12 overflow-y-auto">
        <div className="w-full max-w-[370px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </div>
          {children}
          <p className="text-center text-sm text-gray-600 mt-8">{footer}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Reset-password shell ─────────────────────────────────────────────────────

const PASSWORD_TIPS = [
  { icon: '📏', text: 'At least 8 characters long' },
  { icon: '🔠', text: 'Mix uppercase and lowercase letters' },
  { icon: '🔢', text: 'Include at least one number' },
  { icon: '✳️', text: 'Add a special character (!@#$%^&*)' },
  { icon: '🚫', text: "Don't reuse a previous password" },
];

export function ResetPasswordShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(145deg, #1f2937 0%, #374151 55%, #4b5563 100%)' }}
      >
        <div className="absolute -top-40 -left-28 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(90px)' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <LogoMark className="w-12 h-12 shrink-0" />
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI YouTube Content OS</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-8" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
            🛡️
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] mb-4">
            Almost<br />
            <span style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg, #f0c14d 0%, #ffd966 100%)', backgroundClip: 'text' }}>
              There
            </span>
          </h1>
          <p className="text-white/65 text-base leading-relaxed max-w-xs mb-10">
            Create a strong new password to keep your creator account secure.
          </p>

          {/* Tips */}
          <div className="mb-10">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">Strong password tips</p>
            <div className="space-y-3.5">
              {PASSWORD_TIPS.map((t) => (
                <div key={t.text} className="flex items-center gap-3">
                  <span className="text-base shrink-0" aria-hidden>{t.icon}</span>
                  <span className="text-white/80 text-sm">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pro tip */}
        <div className="relative z-10 rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span className="text-xl shrink-0 mt-0.5" aria-hidden>💡</span>
          <div>
            <div className="text-white text-sm font-semibold mb-0.5">Pro tip</div>
            <p className="text-white/60 text-xs leading-relaxed">Use a passphrase like &ldquo;Coffee!Makes3Videos&rdquo; — easy to remember, hard to crack.</p>
          </div>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 sm:px-10 py-12 overflow-y-auto">
        <div className="w-full max-w-[370px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </div>
          {children}
          <p className="text-center text-sm text-gray-600 mt-8">{footer}</p>
        </div>
      </div>
    </div>
  );
}

// ─── OAuth callback shell — Short Studio showcase ────────────────────────────

const SHORT_FEATURES = [
  { icon: '✂️', text: 'AI Auto-Edit' },
  { icon: '📱', text: 'Vertical Format' },
  { icon: '🎯', text: 'Hook Generator' },
  { icon: '🎵', text: 'Music Sync' },
  { icon: '💬', text: 'Auto Captions' },
  { icon: '🚀', text: 'Multi-Platform' },
];

const MOCK_SHORTS = [
  {
    bg: 'linear-gradient(175deg, #1f2937 0%, #111827 100%)',
    emoji: '🤖',
    title: '5 AI Hacks',
    views: '2.3M',
    badge: '#9ca3af',
  },
  {
    bg: 'linear-gradient(175deg, #e11d48 0%, #7f1d1d 100%)',
    emoji: '😱',
    title: 'Wait for it',
    views: '4.1M',
    badge: '#fca5a5',
  },
  {
    bg: 'linear-gradient(175deg, #0891b2 0%, #1e3a8a 100%)',
    emoji: '📈',
    title: 'Grow to 100K',
    views: '1.8M',
    badge: '#7dd3fc',
  },
];

export function OAuthCallbackShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: Short Studio showcase ────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[55%] xl:w-[56%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(145deg, #1f2937 0%, #374151 55%, #4b5563 100%)' }}
      >
        {/* Orbs */}
        <div className="absolute -top-40 -left-28 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(90px)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <LogoMark className="w-12 h-12 shrink-0" />
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI YouTube Content OS</div>
          </div>
        </div>

        {/* Hero — Short Studio */}
        <div className="relative z-10">
          {/* NEW badge */}
          <div className="inline-flex items-center gap-2 mb-5">
            <span
              className="text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-full"
              style={{ background: '#f0c14d', color: '#3b1f00' }}
            >
              NEW
            </span>
            <span className="text-white/60 text-xs font-medium">Now live in your dashboard</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              ✂️
            </div>
            <div>
              <div className="text-white font-extrabold text-2xl leading-tight">Short Studio</div>
              <div className="text-white/50 text-xs">AI-powered short-form video creation</div>
            </div>
          </div>

          <h1 className="text-4xl xl:text-[2.8rem] font-extrabold text-white leading-[1.1] mb-4">
            Create Viral<br />
            <span style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg, #f0c14d 0%, #ffd966 100%)', backgroundClip: 'text' }}>
              Shorts in Minutes
            </span>
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs mb-8">
            From idea to published short — AI handles scripting, editing, captions, and multi-platform publishing for you.
          </p>

          {/* Mock video cards */}
          <div className="flex gap-3 mb-8">
            {MOCK_SHORTS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl overflow-hidden flex-1 flex flex-col justify-between relative"
                style={{ background: s.bg, aspectRatio: '9/16', maxWidth: 96 }}
              >
                {/* Top bar */}
                <div className="flex items-center justify-between px-2 pt-2">
                  <div className="w-4 h-0.5 rounded-full bg-white/60" />
                  <div
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: s.badge, color: '#1e0040' }}
                  >
                    #shorts
                  </div>
                </div>
                {/* Emoji */}
                <div className="flex-1 flex items-center justify-center text-3xl" aria-hidden>
                  {s.emoji}
                </div>
                {/* Bottom */}
                <div className="px-2 pb-2.5">
                  <p className="text-white text-[10px] font-bold leading-tight mb-1 drop-shadow">{s.title}</p>
                  <div className="flex items-center gap-1 text-white/70 text-[9px]">
                    <span>▶</span>
                    <span>{s.views}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-3 gap-2">
            {SHORT_FEATURES.map((f) => (
              <div
                key={f.text}
                className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-center"
                style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)' }}
              >
                <span className="text-lg" aria-hidden>{f.icon}</span>
                <span className="text-white/80 text-[10px] font-semibold leading-tight">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 flex items-center gap-6">
          {[
            { value: '60s', label: 'Avg. creation time' },
            { value: '10M+', label: 'Shorts published' },
            { value: '3×', label: 'More views with AI hooks' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className="w-px h-8 bg-white/20" />}
              <div>
                <div className="text-xl font-extrabold text-white">{s.value}</div>
                <div className="text-white/45 text-[10px] mt-0.5">{s.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Right: Status panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 sm:px-10 py-12 overflow-y-auto">
        <div className="w-full max-w-[360px]">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </div>

          {children}

          <p className="text-center text-sm text-gray-600 mt-8">{footer}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Google sign-in (shared) ──────────────────────────────────────────────────

export type OAuthProviderName = 'google';

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5H1.3v3C3.3 21.3 7.3 24 12 24z" />
    <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4v-3H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
    <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C16.9 1 14.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z" />
  </svg>
);

export function SocialRow({
  providers,
  onProviderClick,
}: {
  providers?: Record<string, boolean>;
  onProviderClick?: (provider: OAuthProviderName) => void;
}) {
  const googleEnabled = providers ? providers['google'] : false;

  return (
    <div className="mt-5">
      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium tracking-wide">or</span>
        <span className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Google button — full width, Google brand style */}
      <button
        type="button"
        disabled={!googleEnabled}
        onClick={googleEnabled && onProviderClick ? () => onProviderClick('google') : undefined}
        aria-label="Continue with Google"
        className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl font-medium text-sm transition-all select-none ${
          googleEnabled
            ? 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md active:scale-[0.99] cursor-pointer'
            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
        }`}
        style={{
          border: '1.5px solid #e2e8f0',
          boxShadow: googleEnabled ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        <GoogleLogo />
        <span>Continue with Google</span>
      </button>
    </div>
  );
}
