import { useId } from 'react';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
  /** 'dark' = dark Z + violet k, for light backgrounds (default)
   *  'light' = white Z + pale violet k, for dark/purple backgrounds */
  variant?: 'dark' | 'light';
}

/**
 * SozialZynk Zk mark — two-stroke SVG with staggered draw animation.
 * No background; works on any surface. Pass variant="light" for dark panels.
 */
export function LogoMark({ className, style, variant = 'dark' }: LogoMarkProps) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9]/g, 'x');

  const zColor = variant === 'light' ? '#FFFFFF' : '#1F2937';
  const kColor = variant === 'light' ? '#C4B5FD' : '#7C3AED';

  return (
    <svg
      viewBox="0 0 32 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <defs>
        <style>{`
          .${id}z {
            stroke-dasharray: 44;
            stroke-dashoffset: 44;
            animation: ${id}draw 0.5s cubic-bezier(0.4,0,0.2,1) 0.08s forwards;
          }
          .${id}k {
            stroke-dasharray: 42;
            stroke-dashoffset: 42;
            animation: ${id}draw 0.42s cubic-bezier(0.4,0,0.2,1) 0.38s forwards;
          }
          @keyframes ${id}draw { to { stroke-dashoffset: 0; } }
        `}</style>
      </defs>
      <path
        className={`${id}z`}
        d="M2 4H13L2 20H13"
        stroke={zColor}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className={`${id}k`}
        d="M17 4V20M17 12L24 4M17 12L24 20"
        stroke={kColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
