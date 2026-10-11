import Image from 'next/image';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
  /** 'dark' = for light backgrounds (default)
   *  'light' = for dark/purple backgrounds */
  variant?: 'dark' | 'light';
}

/**
 * SozialZynk brand mark — renders /icon.svg which is a self-contained SVG
 * with the ZK logo base64-embedded. Works on any surface as a single file.
 */
export function LogoMark({ className, style, variant: _variant = 'dark' }: LogoMarkProps) {
  const src = '/icon.svg';
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
