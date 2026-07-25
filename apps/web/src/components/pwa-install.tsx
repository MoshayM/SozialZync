'use client';
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

    setIsIOS(ios);
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setPrompt(null);
    return outcome === 'accepted';
  };

  return { prompt, install, isInstalled, isIOS, isStandalone, canInstall: !!prompt && !isStandalone };
}

// ── Landing page install button ───────────────────────────────────────────────

export function PwaInstallButtonLanding() {
  const { canInstall, install, isIOS, isStandalone, isInstalled } = usePwaInstall();
  const [done, setDone] = useState(false);

  if (isInstalled || done) {
    return (
      <div className="mt-auto flex items-center gap-2 text-sm font-semibold" style={{ color: '#4ADE80' }}>
        <span>✓</span> App installed!
      </div>
    );
  }

  if (isStandalone) {
    return (
      <div className="mt-auto flex items-center gap-2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <span>✓</span> Running as app
      </div>
    );
  }

  if (canInstall) {
    return (
      <button
        onClick={async () => { const ok = await install(); if (ok) setDone(true); }}
        className="mt-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-105"
        style={{ background: 'linear-gradient(135deg,#a78bfa,#7C3AED)', boxShadow: '0 8px 24px -6px rgba(124,58,237,.5)' }}
      >
        Install Now
      </button>
    );
  }

  if (isIOS) {
    return (
      <div className="mt-auto text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
        Open in Safari → tap <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Share</strong> →{' '}
        <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Add to Home Screen</strong>
      </div>
    );
  }

  return (
    <div className="mt-auto text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
      Open in Chrome or Edge to install
    </div>
  );
}

// ── Floating install banner ───────────────────────────────────────────────────

export function PwaInstallBanner() {
  const { canInstall, install, isIOS, isStandalone, isInstalled } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  if (isStandalone || isInstalled || dismissed) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-pop-in"
      style={{ width: 'min(360px, calc(100vw - 24px))' }}
    >
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg,#1a0f4a,#2d1b6e)',
          border: '1px solid rgba(167,139,250,0.3)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#a78bfa,#7C3AED)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-none mb-0.5">Install Blueforce</p>
          {isIOS && iosHint ? (
            <p className="text-purple-300 text-xs">Tap Share → &ldquo;Add to Home Screen&rdquo;</p>
          ) : (
            <p className="text-purple-300 text-xs">Get the full app experience</p>
          )}
        </div>

        {canInstall ? (
          <button
            onClick={() => void install()}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#a78bfa,#7C3AED)' }}
          >
            Install
          </button>
        ) : isIOS ? (
          <button
            onClick={() => setIosHint(!iosHint)}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#a78bfa,#7C3AED)' }}
          >
            How?
          </button>
        ) : null}

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-purple-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
