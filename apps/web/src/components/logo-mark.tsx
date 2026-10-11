import Image from 'next/image';

interface LogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
  /** 'dark' = for light backgrounds (default)
   *  'light' = for dark/purple backgrounds — adds white backing so logo is visible */
  variant?: 'dark' | 'light';
}

export function LogoMark({ className, style, variant = 'dark' }: LogoMarkProps) {
  if (variant === 'light') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
          borderRadius: '10px',
          padding: '2px',
          overflow: 'hidden',
          ...style,
        }}
      >
        <Image
          src="/logo.jpeg"
          alt="SozialZynk"
          width={96}
          height={96}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          priority
        />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style }}
    >
      <Image
        src="/logo.jpeg"
        alt="SozialZynk"
        width={96}
        height={96}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        priority
      />
    </span>
  );
}
