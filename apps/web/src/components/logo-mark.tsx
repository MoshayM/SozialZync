import { useId } from 'react';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sozialzync Z-mark — no background, animated gradient + shimmer.
 * Transparent SVG: works on any surface (light topbar, dark sidebar,
 * auth panels). useId() keeps gradient/clip/animation IDs unique per instance.
 */
export function LogoMark({ className, style }: LogoMarkProps) {
  const raw = useId();
  const id = raw.replace(/:/g, 'lm');

  /* ── Z polygon path ────────────────────────────────────────────────────────
   * Top bar:    y 9–16, x 9–31 (7 px tall)
   * Diagonal:   (31,16)→(17,24) inner · (9,24)→(23,16) outer — 7 px perp width
   * Bottom bar: y 24–31, x 9–31 (7 px tall)
   * ────────────────────────────────────────────────────────────────────────── */
  const Z = 'M 9,9 H 31 V 16 L 17,24 H 31 V 31 H 9 V 24 L 23,16 H 9 Z';

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <defs>
        {/* ── Glow pulse (CSS, uid-scoped so instances don't conflict) ── */}
        <style>{`
          @keyframes ${id}-glow {
            0%,100% {
              filter:
                drop-shadow(0 0 2px rgba(255,255,255,.30))
                drop-shadow(0 0 5px rgba(139,92,246,.55))
                drop-shadow(0 0 12px rgba(109,40,217,.30));
            }
            50% {
              filter:
                drop-shadow(0 0 3px rgba(255,255,255,.50))
                drop-shadow(0 0 9px rgba(167,139,250,.80))
                drop-shadow(0 0 22px rgba(124,58,237,.55));
            }
          }
          .${id}-mark { animation: ${id}-glow 3s ease-in-out infinite; }
        `}</style>

        {/* ── Diagonal gradient: violet → brand purple → deep indigo ── */}
        <linearGradient id={`${id}-g`} x1="9" y1="9" x2="31" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa">
            <animate attributeName="stop-color"
              values="#a78bfa;#c4b5fd;#8B5CF6;#c4b5fd;#a78bfa"
              dur="5s" repeatCount="indefinite"/>
          </stop>
          <stop offset="48%" stopColor="#7C3AED">
            <animate attributeName="stop-color"
              values="#7C3AED;#6D28D9;#5B21B6;#6D28D9;#7C3AED"
              dur="5s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%" stopColor="#3b0764">
            <animate attributeName="stop-color"
              values="#3b0764;#2e1065;#4C1D95;#2e1065;#3b0764"
              dur="5s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>

        {/* ── Clip path — shimmer confined to Z shape ── */}
        <clipPath id={`${id}-c`}>
          <path d={Z}/>
        </clipPath>
      </defs>

      {/* ── Z with glow ── */}
      <g className={`${id}-mark`}>

        {/* Base fill */}
        <path d={Z} fill={`url(#${id}-g)`}
          stroke="rgba(255,255,255,0.18)" strokeWidth="0.6"/>

        {/* Shimmer — tilted stripe sweeps diagonally through the Z ──────────
         * Outer <g> carries the clip (Z-shaped); inner <g> tilts the coord
         * system -28°, so the horizontal translate becomes a diagonal sweep
         * across the Z face when viewed from the outer coordinate space.
         * ──────────────────────────────────────────────────────────────────── */}
        <g clipPath={`url(#${id}-c)`}>
          <g transform="rotate(-28 20 20)">
            <rect x="-22" y="-8" width="13" height="56"
                  fill="white" fillOpacity="0.28">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="-65 0; 85 0; 85 0"
                keyTimes="0; 0.38; 1"
                dur="4s"
                repeatCount="indefinite"
                begin="0.8s"
              />
            </rect>
          </g>
        </g>

      </g>
    </svg>
  );
}
