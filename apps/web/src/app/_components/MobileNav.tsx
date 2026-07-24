'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { LogoMark } from '@/components/logo-mark';

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Pricing',      href: '#pricing' },
];

export function MobileNav() {
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef                = useRef<HTMLButtonElement>(null);

  // Only enable the portal after client hydration (document exists).
  useEffect(() => { setMounted(true); }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── Overlay (rendered via portal so backdrop-filter on <header> doesn't
  //    trap position:fixed and collapse the overlay to header height) ──────
  const overlay =
    open && mounted
      ? createPortal(
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-0 flex flex-col px-6 pt-5 pb-8 overflow-y-auto"
            style={{ zIndex: 9999, background: 'linear-gradient(160deg,#8b5cf6 0%,#7c3aed 100%)' }}
          >
            {/* Top row: logo + close button */}
            <div className="flex items-center justify-between mb-10 shrink-0">
              <div className="flex items-center gap-2.5">
                <LogoMark className="w-9 h-9 shrink-0" style={{ borderRadius: '10px' }} />
                <span className="font-bold text-white text-lg tracking-tight">Blueforce</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors touch-manipulation"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Nav links */}
            <nav aria-label="Mobile navigation" className="flex-1">
              <ul className="space-y-1">
                {NAV_LINKS.map(({ label, href }) => (
                  <li key={href}>
                    <a
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center px-4 py-4 rounded-2xl text-white text-xl font-semibold hover:bg-white/10 active:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors touch-manipulation"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* CTA buttons pinned to bottom */}
            <div className="shrink-0 flex flex-col gap-3 pt-8">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="w-full py-4 text-center rounded-2xl text-white font-semibold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors touch-manipulation"
                style={{ border: '1.5px solid rgba(255,255,255,0.35)' }}
              >
                Log in
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="w-full py-4 text-center rounded-2xl bg-white font-bold text-base shadow-lg hover:bg-purple-50 active:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors touch-manipulation"
                style={{ color: '#7C3AED' }}
              >
                Get started free
              </Link>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {/* Hamburger button (always in the header) */}
      <div className="md:hidden">
        <button
          ref={btnRef}
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors touch-manipulation"
        >
          {open ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* Full-screen overlay — portalled to <body> */}
      {overlay}
    </>
  );
}
