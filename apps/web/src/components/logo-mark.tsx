import { useId } from 'react';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sozialzync logo mark — "sync S" icon representing Social + Zync.
 * Renders across every surface. useId() prevents gradient ID collisions.
 */
export function LogoMark({ className, style }: LogoMarkProps) {
  const raw = useId();
  const uid = raw.replace(/:/g, 'lm');

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        {/* Deep violet → rich purple */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#2E0F8C" />
        </linearGradient>
        {/* Top-left inner highlight */}
        <radialGradient id={`${uid}-hl`} cx="28%" cy="22%" r="55%">
          <stop stopColor="white" stopOpacity="0.18" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {/* Glow at the S crossing point */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="40%">
          <stop stopColor="#C4B5FD" stopOpacity="0.25" />
          <stop offset="1" stopColor="#C4B5FD" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-hl)`} />
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-glow)`} />

      {/* Sync-S: S-curve with sync arrowheads at each tip suggesting circular motion */}
      <path
        d="M 26,10 C 31,6 5,8 5,17 C 5,22 35,18 35,23 C 35,32 9,34 14,30"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Top arrowhead — clockwise direction */}
      <path
        d="M 22,7 L 26,10 L 22,13"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Bottom arrowhead — clockwise direction */}
      <path
        d="M 18,27 L 14,30 L 18,33"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
