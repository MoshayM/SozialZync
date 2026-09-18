'use client';
import React from 'react';
import Link from 'next/link';
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

const LOGIN_BENEFITS = [
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
        <path d="M10 2C6.134 2 3 5.134 3 9c0 2.386 1.173 4.496 2.977 5.795L5 18h10l-.977-3.205C15.827 13.496 17 11.386 17 9c0-3.866-3.134-7-7-7z" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="10" cy="9" r="2" fill="rgba(255,255,255,0.8)"/>
      </svg>
    ),
    title: 'AI Research & Scripting',
    desc: 'Trend discovery, fact-checked scripts, and SEO copy — in minutes.',
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
        <rect x="2" y="4" width="16" height="12" rx="2" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"/>
        <path d="M8 8l4 2-4 2V8z" fill="rgba(255,255,255,0.8)"/>
      </svg>
    ),
    title: 'Multi-Platform Publishing',
    desc: 'YouTube, Instagram, TikTok, LinkedIn — one click, everywhere.',
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
        <path d="M10 2l2.39 4.845L18 7.639l-4 3.9.944 5.506L10 14.5l-4.944 2.545L6 11.539 2 7.639l5.61-.794L10 2z" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Compliance & Monetization',
    desc: 'Built-in compliance checks. Every video ready to earn from day one.',
  },
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
        @keyframes lf-spin   { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes lf-spin-r { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
        @keyframes lf-grad   { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes lf-in     { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .lf-spin   { animation:lf-spin 28s linear infinite; }
        .lf-spin-r { animation:lf-spin-r 40s linear infinite; }
        .lf-in-1   { animation:lf-in .5s ease forwards .05s; opacity:0; }
        .lf-in-2   { animation:lf-in .5s ease forwards .15s; opacity:0; }
        .lf-in-3   { animation:lf-in .5s ease forwards .25s; opacity:0; }
        .lf-in-4   { animation:lf-in .5s ease forwards .35s; opacity:0; }
      `}</style>

      {/* ── Left: Brand panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(150deg, #0f172a 0%, #1e293b 60%, #1e3a5f 100%)' }}
      >
        {/* Subtle ambient glow — top-left and bottom-right */}
        <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'rgba(99,102,241,0.08)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-24 -right-12 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(59,130,246,0.07)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <div className="lf-spin absolute inset-[-8px] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
            <div className="lf-spin-r absolute inset-[-16px] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.07)' }} />
            <LogoMark className="absolute inset-0 w-full h-full" variant="light" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#94a3b8' }}>Z</span><span className="text-white">ynk</span>
            </div>
            <div className="text-white/40 text-xs mt-0.5 font-medium">AI Creator Platform</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-10">
          {/* Status pill */}
          <div className="lf-in-1 inline-flex items-center gap-2 text-white/70 text-xs font-semibold px-4 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            All systems operational
          </div>

          {/* Headline */}
          <div className="lf-in-2">
            <h1 className="text-[2.75rem] xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight mb-4">
              Research. Script.<br />
              <span style={{
                WebkitTextFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                backgroundImage: 'linear-gradient(90deg, #e2e8f0 0%, #ffffff 40%, #cbd5e1 100%)',
                backgroundClip: 'text',
                backgroundSize: '200% 100%',
                animation: 'lf-grad 5s ease infinite',
              }}>
                Publish Everywhere.
              </span>
            </h1>
            <p className="text-white/50 text-base leading-relaxed max-w-xs">
              Your complete AI content team — from research to publishing, across every platform.
            </p>
          </div>

          {/* Benefits */}
          <div className="lf-in-3 space-y-5">
            {LOGIN_BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {b.icon}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold leading-tight mb-0.5">{b.title}</div>
                  <div className="text-white/45 text-xs leading-relaxed">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Minimal stats */}
          <div className="lf-in-4 flex items-center gap-8 pt-2">
            <div>
              <div className="text-2xl font-extrabold text-white tracking-tight">Free</div>
              <div className="text-white/40 text-xs mt-0.5">to get started</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-2xl font-extrabold text-white tracking-tight">15+</div>
              <div className="text-white/40 text-xs mt-0.5">AI agents</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-2xl font-extrabold text-white tracking-tight">24/7</div>
              <div className="text-white/40 text-xs mt-0.5">always on</div>
            </div>
          </div>
        </div>

        {/* Bottom brand line */}
        <div className="relative z-10">
          <div className="h-px bg-white/8 mb-6" />
          <p className="text-white/25 text-xs">
            Trusted by creators on YouTube, Instagram, TikTok, LinkedIn &amp; more.
          </p>
        </div>
      </div>

      {/* ── Right: Form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 sm:px-10 py-12 overflow-y-auto">
        <div className="w-full max-w-[370px]">
          {/* Mobile brand */}
          <Link href="/browse" className="flex items-center gap-2.5 mb-10 lg:hidden hover:opacity-80 transition-opacity">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </Link>

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
      <style>{`@keyframes sh-grad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}} @keyframes sh-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} @keyframes sh-spin-r{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}} @keyframes sh-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      {/* ── Left: Brand panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-18 py-14"
        style={{ background: 'linear-gradient(145deg, #111827 0%, #1f2937 45%, #374151 100%)' }}
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
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <div style={{ animation:'sh-spin 28s linear infinite', position:'absolute', inset:'-8px', borderRadius:'50%', border:'1px solid rgba(156,163,175,.35)' }} />
            <div style={{ animation:'sh-spin-r 40s linear infinite', position:'absolute', inset:'-16px', borderRadius:'50%', border:'1px solid rgba(255,255,255,.1)' }} />
            <LogoMark className="absolute inset-0 w-full h-full" variant="light" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI Content Creator Platform</div>
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
            Create &amp; Grow<br />
            <span
              style={{
                WebkitTextFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                backgroundImage: 'linear-gradient(90deg, #d1d5db 0%, #ffffff 50%, #d1d5db 100%)',
                backgroundClip: 'text',
                backgroundSize: '200% 100%',
                animation: 'sh-grad 4s ease infinite',
              }}
            >
              With AI
            </span>
            <br />on Every Platform
          </h1>

          <p className="text-white/65 text-base leading-relaxed max-w-xs mb-8">
            Your complete AI creator platform — research, scripts, characters, voice, thumbnails, and multi-platform publishing in one place.
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
      <style>{`@keyframes sh-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} @keyframes sh-spin-r{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}} @keyframes sh-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(145deg, #111827 0%, #1f2937 45%, #374151 100%)' }}
      >
        <div className="absolute -top-40 -left-28 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(90px)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <div style={{ animation:'sh-spin 28s linear infinite', position:'absolute', inset:'-8px', borderRadius:'50%', border:'1px solid rgba(156,163,175,.35)' }} />
            <div style={{ animation:'sh-spin-r 40s linear infinite', position:'absolute', inset:'-16px', borderRadius:'50%', border:'1px solid rgba(255,255,255,.1)' }} />
            <LogoMark className="absolute inset-0 w-full h-full" variant="light" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI Content Creator Platform</div>
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
          <Link href="/browse" className="flex items-center gap-2.5 mb-10 lg:hidden hover:opacity-80 transition-opacity">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </Link>
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
      <style>{`@keyframes sh-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} @keyframes sh-spin-r{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}`}</style>
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(145deg, #111827 0%, #1f2937 45%, #374151 100%)' }}
      >
        <div className="absolute -top-40 -left-28 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(90px)' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'rgba(0,0,0,.18)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <div style={{ animation:'sh-spin 28s linear infinite', position:'absolute', inset:'-8px', borderRadius:'50%', border:'1px solid rgba(156,163,175,.35)' }} />
            <div style={{ animation:'sh-spin-r 40s linear infinite', position:'absolute', inset:'-16px', borderRadius:'50%', border:'1px solid rgba(255,255,255,.1)' }} />
            <LogoMark className="absolute inset-0 w-full h-full" variant="light" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#d1d5db' }}>Zync</span>
            </div>
            <div className="text-white/50 text-xs mt-0.5">AI Content Creator Platform</div>
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
          <Link href="/browse" className="flex items-center gap-2.5 mb-10 lg:hidden hover:opacity-80 transition-opacity">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </Link>
          {children}
          <p className="text-center text-sm text-gray-600 mt-8">{footer}</p>
        </div>
      </div>
    </div>
  );
}

// ─── OAuth callback shell — calm brand panel ─────────────────────────────────

const OAUTH_TRUST = [
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-4.5 h-4.5" aria-hidden>
        <path d="M10 2L4 5v5c0 3.55 2.57 6.87 6 7.67C13.43 16.87 16 13.55 16 10V5l-6-3z" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M7.5 10l2 2 3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'OAuth 2.0 secured',
    desc: 'We never store your Google password.',
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-4.5 h-4.5" aria-hidden>
        <rect x="3" y="9" width="14" height="9" rx="2" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"/>
        <path d="M7 9V6a3 3 0 016 0v3" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'End-to-end encrypted',
    desc: 'All tokens are encrypted at rest and in transit.',
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-4.5 h-4.5" aria-hidden>
        <circle cx="10" cy="10" r="7" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"/>
        <path d="M10 7v3l2 2" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Session ready instantly',
    desc: 'Your workspace loads in seconds after sign-in.',
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
      <style>{`
        @keyframes oc-spin  { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes oc-spinr { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
        @keyframes oc-in    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        .oc-spin  { animation:oc-spin 28s linear infinite; }
        .oc-spinr { animation:oc-spinr 40s linear infinite; }
        .oc-in-1  { animation:oc-in .5s ease forwards .05s; opacity:0; }
        .oc-in-2  { animation:oc-in .5s ease forwards .15s; opacity:0; }
        .oc-in-3  { animation:oc-in .5s ease forwards .25s; opacity:0; }
      `}</style>

      {/* ── Left: Brand panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-14"
        style={{ background: 'linear-gradient(150deg, #0f172a 0%, #1e293b 60%, #1e3a5f 100%)' }}
      >
        {/* Ambient glows */}
        <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'rgba(99,102,241,0.08)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-24 -right-12 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(59,130,246,0.07)', filter: 'blur(70px)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-12 h-12 shrink-0">
            <div className="oc-spin absolute inset-[-8px] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
            <div className="oc-spinr absolute inset-[-16px] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.07)' }} />
            <LogoMark className="absolute inset-0 w-full h-full" variant="light" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-[-0.5px] leading-none">
              <span className="text-white">Sozial</span><span style={{ color: '#94a3b8' }}>Z</span><span className="text-white">ynk</span>
            </div>
            <div className="text-white/40 text-xs mt-0.5 font-medium">AI Creator Platform</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-10">
          <div className="oc-in-1">
            <h1 className="text-[2.75rem] xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight mb-4">
              Connecting<br />
              <span style={{
                WebkitTextFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                backgroundImage: 'linear-gradient(90deg, #e2e8f0 0%, #ffffff 40%, #cbd5e1 100%)',
                backgroundClip: 'text',
              }}>
                securely.
              </span>
            </h1>
            <p className="text-white/50 text-base leading-relaxed max-w-xs">
              Your sign-in is being verified. This only takes a moment.
            </p>
          </div>

          {/* Trust items */}
          <div className="oc-in-2 space-y-5">
            {OAUTH_TRUST.map((t) => (
              <div key={t.title} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  {t.icon}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold leading-tight mb-0.5">{t.title}</div>
                  <div className="text-white/45 text-xs leading-relaxed">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy note */}
          <div
            className="oc-in-3 rounded-2xl px-5 py-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <p className="text-white/40 text-xs leading-relaxed">
              SozialZynk only requests the permissions you approved. You can review or revoke access at any time from your Google Account security settings.
            </p>
          </div>
        </div>

        {/* Bottom brand line */}
        <div className="relative z-10">
          <div className="h-px bg-white/8 mb-6" />
          <p className="text-white/25 text-xs">
            Trusted by creators on YouTube, Instagram, TikTok, LinkedIn &amp; more.
          </p>
        </div>
      </div>

      {/* ── Right: Status panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 sm:px-10 py-12 overflow-y-auto">
        <div className="w-full max-w-[360px]">
          {/* Mobile brand */}
          <Link href="/browse" className="flex items-center gap-2.5 mb-10 lg:hidden hover:opacity-80 transition-opacity">
            <LogoMark className="w-9 h-9 shrink-0" />
            <span className="font-bold text-lg tracking-[-0.4px]">
              <span style={{ color: '#1E1B2E' }}>Sozial</span><span style={{ color: '#374151' }}>Z</span><span style={{ color: '#1E1B2E' }}>ynk</span>
            </span>
          </Link>

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
  // Default to enabled — only disable if backend explicitly returns google:false.
  // If the /auth/providers call fails entirely, we still show the button and
  // let the click fail with a user-facing error rather than silently hiding it.
  const googleEnabled = providers?.['google'] !== false;

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
