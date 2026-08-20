import { useId } from 'react';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sozialzync mark — geometric "Z" for Zync.
 * Bold, reads at 16 px favicon. useId() prevents gradient ID collisions.
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
        {/* Rich violet → deep indigo */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#6D28D9" />
          <stop offset="1" stopColor="#1e0a6e" />
        </linearGradient>
        {/* Top-left glass highlight */}
        <radialGradient id={`${uid}-hl`} cx="30%" cy="18%" r="58%" gradientUnits="objectBoundingBox">
          <stop stopColor="white" stopOpacity="0.22" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background tile */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-hl)`} />

      {/*
        Bold geometric Z — strokeLinecap="square" gives flat bar ends that
        read as solid rectangles; strokeLinejoin="round" keeps the diagonal
        joins smooth so they don't spike outside the tile at any size.
        strokeWidth 6.5 at 40 px ≈ a heavy-weight letterform.
      */}
      <path
        d="M 10.5,13 H 29.5 L 10.5,27 H 29.5"
        stroke="white"
        strokeWidth="6.5"
        strokeLinecap="square"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
