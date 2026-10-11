import Image from 'next/image';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
  /** 'dark' = for light backgrounds (default)
   *  'light' = for dark/purple backgrounds */
  variant?: 'dark' | 'light';
}

/**
 * SozialZynk brand mark — renders the ZK mountain logo JPEG.
 * 'dark' variant (white bg logo) for light surfaces; 'light' variant (dark bg logo) for dark surfaces.
 * Note: SVGs with embedded <image> refs don't load when used as <img> src (browser security),
 * so we use the JPEG directly.
 */
export function LogoMark({ className, style, variant = 'dark' }: LogoMarkProps) {
  const src = variant === 'light' ? '/logo-dark.jpeg' : '/logo.jpeg';
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
        src={src}
        alt="SozialZynk"
        width={96}
        height={96}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        priority
      />
    </span>
  );
}
