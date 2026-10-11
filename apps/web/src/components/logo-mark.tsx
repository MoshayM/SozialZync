import Image from 'next/image';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
  /** 'dark' = for light backgrounds (default)
   *  'light' = for dark/purple backgrounds */
  variant?: 'dark' | 'light';
}

/**
 * SozialZynk brand mark — always renders /icon.svg which carries its own
 * white background, so it displays correctly on any surface.
 */
export function LogoMark({ className, style, variant: _variant = 'dark' }: LogoMarkProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      <Image
        src="/icon.svg"
        alt="SozialZynk"
        width={96}
        height={96}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        priority
      />
    </span>
  );
}
