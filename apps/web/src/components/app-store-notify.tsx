'use client';
import { useState } from 'react';

interface Props {
  platform: 'android' | 'ios';
}

type State = 'idle' | 'open' | 'loading' | 'done' | 'error';

const PLATFORM_CONFIG = {
  android: {
    label: 'Google Play',
    color: 'rgba(52,168,83,1)',
    dimColor: 'rgba(52,168,83,.7)',
    bg: 'rgba(52,168,83,.1)',
    border: 'rgba(52,168,83,.25)',
    textColor: 'rgba(134,239,172,.9)',
    inputBorder: 'rgba(52,168,83,.4)',
    btnBg: 'rgba(52,168,83,.85)',
  },
  ios: {
    label: 'App Store',
    color: 'rgba(0,122,255,1)',
    dimColor: 'rgba(0,122,255,.7)',
    bg: 'rgba(0,122,255,.1)',
    border: 'rgba(0,122,255,.25)',
    textColor: 'rgba(147,197,253,.9)',
    inputBorder: 'rgba(0,122,255,.4)',
    btnBg: 'rgba(0,122,255,.85)',
  },
} as const;

export function AppStoreNotify({ platform }: Props) {
  const [state, setState] = useState<State>('idle');
  const [email, setEmail] = useState('');
  const cfg = PLATFORM_CONFIG[platform];

  async function submit() {
    if (!email || state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/app-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, platform }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div
        className="mt-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.textColor }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        You&apos;ll be notified at launch!
      </div>
    );
  }

  if (state === 'open' || state === 'loading' || state === 'error') {
    return (
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="your@email.com"
            disabled={state === 'loading'}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${cfg.inputBorder}`,
            }}
            autoFocus
          />
          <button
            onClick={() => void submit()}
            disabled={state === 'loading' || !email}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: cfg.btnBg }}
          >
            {state === 'loading' ? '…' : 'Notify'}
          </button>
        </div>
        {state === 'error' && (
          <p className="text-xs text-red-400">Something went wrong — try again.</p>
        )}
        <button
          onClick={() => setState('idle')}
          className="text-xs text-white/30 hover:text-white/60 transition-colors text-left"
        >
          Cancel
        </button>
      </div>
    );
  }

  // idle
  return (
    <button
      onClick={() => setState('open')}
      className="mt-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 w-full"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.textColor,
        cursor: 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      Notify me — {cfg.label}
    </button>
  );
}
