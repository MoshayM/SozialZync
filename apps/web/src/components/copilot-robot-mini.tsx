'use client';
import { useEffect, useState } from 'react';

/**
 * Compact robot head used wherever a "copilot" affordance appears in the app
 * (Quick Actions card, nav hints, etc.).  Self-contained — injects its own
 * keyframes so it works without the full CopilotPanel mounted.
 */
export function CopilotRobotMini({ size = 52 }: { size?: number }) {
  const [mounted, setMounted] = useState(false);
  const [pupilOff, setPupilOff] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    const POS: [number, number][] = [[0,0],[0,0],[0,0],[-1.5,0],[1.5,0],[0,-1],[1,-0.8],[-1,0.6]];
    const id = setInterval(() => {
      const p = POS[Math.floor(Math.random() * POS.length)]!;
      setPupilOff({ x: p[0], y: p[1] });
    }, 1900);
    return () => clearInterval(id);
  }, []);

  // SVG viewBox: 0 0 80 88  (head 76×58 + antenna 28px on top + 2px margin)
  // Scaled to `size` pixels wide; height is proportional.
  const h = Math.round(size * (88 / 80));

  const W = '#ede8ff';
  const S = '#b0a4e8';
  const eyeCol = '#60A5FA';

  return (
    <>
      {/* Keyframes — scoped names so they don't clash with copilot-panel's cf* names */}
      <style>{`
        @keyframes cfmFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes cfmBlink { 0%,88%,92%,100%{transform:scaleY(1) scaleX(1)} 90%{transform:scaleY(0.05) scaleX(1)} }
        @keyframes cfmPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div
        style={{
          display: 'inline-block',
          width: size,
          height: h,
          animation: mounted ? 'cfmFloat 3s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 80 88"
          width={size}
          height={h}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="cfmBody" x1="0" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f2efff" />
              <stop offset="50%" stopColor={W} />
              <stop offset="100%" stopColor={S} />
            </linearGradient>
            <radialGradient id="cfmEye" cx="35%" cy="30%" r="65%" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="#7EEEFF" />
              <stop offset="40%" stopColor={eyeCol} />
              <stop offset="100%" stopColor="#001824" />
            </radialGradient>
            <filter id="cfmShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.28)" />
            </filter>
          </defs>

          {/* ── Antenna ── */}
          {/* Stick */}
          <rect x="38" y="14" width="4" height="18" rx="2"
            fill={`url(#cfmBody)`} />
          {/* Glow dot */}
          <circle cx="40" cy="10" r="7"
            fill={eyeCol}
            style={{ animation: mounted ? 'cfmPulse 1.5s ease-in-out infinite' : 'none' }}
          />
          <circle cx="40" cy="10" r="7" fill="none"
            stroke={eyeCol} strokeWidth="5" strokeOpacity="0.25"
            style={{ animation: mounted ? 'cfmPulse 1.5s ease-in-out 0.3s infinite' : 'none' }}
          />

          {/* ── Head ── */}
          <rect x="2" y="30" width="76" height="56" rx="14"
            fill="url(#cfmBody)"
            filter="url(#cfmShadow)"
          />
          {/* Highlight edge */}
          <rect x="2" y="30" width="76" height="56" rx="14"
            fill="none"
            stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
          />

          {/* ── Visor / eye strip ── */}
          <rect x="10" y="44" width="60" height="22" rx="8"
            fill="#090920"
          />
          <rect x="10" y="44" width="60" height="22" rx="8"
            fill="none"
            stroke="rgba(255,255,255,0.07)" strokeWidth="1"
          />

          {/* Left eye */}
          <g style={{
            transformOrigin: '25px 55px',
            transformBox: 'fill-box',
            animation: mounted ? 'cfmBlink 4.5s ease-in-out 0.3s infinite' : 'none',
          }}>
            <circle cx="25" cy="55" r="9" fill="#0C1A38" />
            <circle cx="25" cy="55" r="8" fill="url(#cfmEye)" />
            <circle cx="25" cy="55" r="3.5" fill="#040C20"
              style={{ transform:`translate(${mounted ? pupilOff.x : 0}px,${mounted ? pupilOff.y : 0}px)`, transition:'transform 0.45s cubic-bezier(.4,0,.2,1)', transformOrigin:'25px 55px', transformBox:'fill-box' }}
            />
            <circle cx="21.5" cy="51.5" r="2.5" fill="rgba(255,255,255,0.9)" />
          </g>

          {/* Right eye */}
          <g style={{
            transformOrigin: '55px 55px',
            transformBox: 'fill-box',
            animation: mounted ? 'cfmBlink 4.5s ease-in-out 0.55s infinite' : 'none',
          }}>
            <circle cx="55" cy="55" r="9" fill="#0C1A38" />
            <circle cx="55" cy="55" r="8" fill="url(#cfmEye)" />
            <circle cx="55" cy="55" r="3.5" fill="#040C20"
              style={{ transform:`translate(${mounted ? pupilOff.x : 0}px,${mounted ? pupilOff.y : 0}px)`, transition:'transform 0.45s cubic-bezier(.4,0,.2,1)', transformOrigin:'55px 55px', transformBox:'fill-box' }}
            />
            <circle cx="51.5" cy="51.5" r="2.5" fill="rgba(255,255,255,0.9)" />
          </g>

          {/* Chin detail — small mouth indicator */}
          <rect x="30" y="74" width="20" height="5" rx="2.5"
            fill="rgba(255,255,255,0.12)"
          />
        </svg>
      </div>
    </>
  );
}
