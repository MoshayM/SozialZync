'use client';
import { usePlan } from '@/lib/plan';

interface ProGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
  /** overlay: blurs children and shows card on top; replace: replaces children with card */
  mode?: 'overlay' | 'replace';
}

export function ProGate({ feature, description, children, mode = 'replace' }: ProGateProps) {
  const { isFreeTier, upgradeToPro } = usePlan();

  if (!isFreeTier) return <>{children}</>;

  if (mode === 'overlay') {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none" style={{ filter: 'blur(3px)', opacity: 0.4 }}>
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <ProUpgradeCard feature={feature} description={description} onUpgrade={upgradeToPro} />
        </div>
      </div>
    );
  }

  return <ProUpgradeCard feature={feature} description={description} onUpgrade={upgradeToPro} />;
}

interface ProBannerProps {
  feature: string;
  description?: string;
  className?: string;
}

export function ProBanner({ feature, description, className = '' }: ProBannerProps) {
  const { isFreeTier, upgradeToPro } = usePlan();
  if (!isFreeTier) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}
      style={{
        background: 'linear-gradient(135deg,rgba(55,65,81,.08),rgba(156,163,175,.12))',
        border: '1px solid rgba(55,65,81,.2)',
      }}
    >
      <span className="text-xl shrink-0">⭐</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white/90">{feature} · Pro Feature</p>
        {description && <p className="text-xs leading-snug mt-0.5 text-white/65">{description}</p>}
      </div>
      <button
        type="button"
        onClick={upgradeToPro}
        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#9ca3af,#374151)' }}
      >
        Upgrade
      </button>
    </div>
  );
}

function ProUpgradeCard({
  feature,
  description,
  onUpgrade,
}: {
  feature: string;
  description?: string;
  onUpgrade: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center text-center gap-4 max-w-sm mx-auto w-full"
      style={{
        background: 'rgba(255,255,255,.05)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.08)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,.4)',
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
        style={{ background: 'linear-gradient(135deg,rgba(156,163,175,.2),rgba(55,65,81,.15))' }}
      >
        ⭐
      </div>
      <div>
        <p className="font-extrabold text-white text-base mb-1">{feature}</p>
        <p className="text-sm text-white/55 leading-relaxed">
          {description ?? 'This feature is available on the Pro plan. Upgrade to unlock it.'}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button
          type="button"
          onClick={onUpgrade}
          className="w-full py-3 rounded-2xl text-white font-bold text-sm transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg,#9ca3af,#374151)',
            boxShadow: '0 4px 16px -4px rgba(55,65,81,.5)',
          }}
        >
          Upgrade to Pro
        </button>
        <p className="text-[11px] text-white/45">No credit card required to explore</p>
      </div>
    </div>
  );
}

/** Inline badge for nav items or buttons */
export function ProLockBadge() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0"
      style={{ background: 'linear-gradient(135deg,#9ca3af,#374151)', color: 'white' }}
    >
      Pro
    </span>
  );
}
