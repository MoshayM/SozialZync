'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Lock, Crown, Check, X, Sparkles, Zap } from 'lucide-react';

// ── Tier definitions ──────────────────────────────────────────────────────────

export type Plan = 'FREE' | 'PRO' | 'UNLIMITED' | 'ENTERPRISE' | 'AGENCY';

const PLAN_ORDER: Record<Plan, number> = {
  FREE: 0, PRO: 1, UNLIMITED: 2, ENTERPRISE: 3, AGENCY: 4,
};
const PLAN_LABEL: Record<Plan, string> = {
  FREE: 'Free', PRO: 'Pro', UNLIMITED: 'Unlimited', ENTERPRISE: 'Enterprise', AGENCY: 'Agency',
};
const PLAN_PRICE: Record<Plan, string> = {
  FREE: '', PRO: '$17/mo', UNLIMITED: '$25/mo', ENTERPRISE: 'Custom', AGENCY: 'Custom',
};
const PLAN_DESC: Record<Plan, string> = {
  FREE: 'You\'re on the Free plan — 3 projects, 10 AI queries/day, SozialZynk feed publishing only.',
  PRO: 'Go Pro for $17/month — unlimited projects, AI Copilot & Studio, up to 50 external publishes per month across all platforms.',
  UNLIMITED: 'Go Unlimited for $25/month — zero publish caps, everything in Pro with unrestricted external publishing.',
  ENTERPRISE: 'Admin-managed — organisation features, custom AI model training, and dedicated SLA.',
  AGENCY: 'Admin-managed — organisation features, custom AI model training, and dedicated SLA.',
};
const PLAN_BENEFITS: Record<Plan, string[]> = {
  FREE: [],
  PRO: [
    'Export & download videos in Full HD',
    'Publish to YouTube, TikTok & Instagram',
    '80 AI content generations / hour',
    'Unlimited projects & working files',
    'Priority render queue',
  ],
  UNLIMITED: [
    'Zero publish caps — post everywhere, always',
    'Everything in Pro with no throttling',
    'Fastest rendering priority',
    'Unlimited AI quota',
  ],
  ENTERPRISE: [
    'Team workspaces with role management',
    'Custom AI model training',
    'Dedicated SLA & support',
    'Organisation-level billing',
  ],
  AGENCY: [
    'Multi-client workspace management',
    'White-label outputs',
    'Custom AI model training',
    'Agency billing & SLA',
  ],
};

// ── Role helpers ──────────────────────────────────────────────────────────────

function parseToken(): { plan?: string; role?: string } {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null;
    if (!token) return {};
    return JSON.parse(atob(token.split('.')[1] ?? '')) as { plan?: string; role?: string };
  } catch {
    return {};
  }
}

export function isAdminRole(): boolean {
  const { role } = parseToken();
  if (role) return role === 'SUPER_ADMIN' || role === 'OWNER';
  const cached = typeof window !== 'undefined' ? localStorage.getItem('cf_user_role') : null;
  return cached === 'SUPER_ADMIN' || cached === 'OWNER';
}

export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => { setAdmin(isAdminRole()); }, []);
  return admin;
}

// ── Plan hook ─────────────────────────────────────────────────────────────────

export function planFromToken(): Plan {
  const { plan } = parseToken();
  const p = (plan ?? 'FREE').toUpperCase() as Plan;
  return p in PLAN_ORDER ? p : 'FREE';
}

export function usePlanGate(): Plan {
  const [plan, setPlan] = useState<Plan>('FREE');
  useEffect(() => { setPlan(planFromToken()); }, []);
  return plan;
}

export const usePlan = usePlanGate;

export function planAtLeast(userPlan: Plan, required: Plan): boolean {
  return PLAN_ORDER[userPlan] >= PLAN_ORDER[required];
}

// ── Upgrade sheet (global bottom sheet / modal) ───────────────────────────────

interface SheetDetail {
  feature?: string;
  plan?: Plan;
}

/** Call from anywhere to pop the upgrade sheet without navigating away. */
export function triggerUpgradeSheet(opts: SheetDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('zk:upgrade-sheet', { detail: opts }));
}

/**
 * Mount once in the dash layout. Listens for `zk:upgrade-sheet` events and
 * renders a bottom sheet (mobile) / centered modal (desktop).
 */
export function UpgradeSheet() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SheetDetail>({});
  const userPlan = usePlanGate();

  useEffect(() => {
    const handler = (e: Event) => {
      setDetail((e as CustomEvent<SheetDetail>).detail ?? {});
      setOpen(true);
    };
    window.addEventListener('zk:upgrade-sheet', handler);
    return () => window.removeEventListener('zk:upgrade-sheet', handler);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const plan: Plan = detail.plan ?? 'PRO';
  const benefits = PLAN_BENEFITS[plan];
  const price = PLAN_PRICE[plan];
  const label = PLAN_LABEL[plan];
  const PlanIcon = plan === 'UNLIMITED' ? Sparkles : plan === 'ENTERPRISE' || plan === 'AGENCY' ? Zap : Crown;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        style={{ backdropFilter: 'blur(2px)' }}
        onClick={close}
      />

      {/* Sheet — slides up from bottom on mobile, centered card on desktop */}
      <div
        className="fixed z-[9999] w-full sm:w-auto sm:min-w-[360px] sm:max-w-md
                   bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2
                   sm:-translate-x-1/2 sm:-translate-y-1/2
                   rounded-t-3xl sm:rounded-3xl overflow-hidden
                   animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
        style={{ background: '#fff', boxShadow: '0 -4px 40px rgba(0,0,0,0.18)' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-4 pb-8">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #374151, #7c5ae8)' }}
          >
            <PlanIcon className="w-7 h-7 text-white" />
          </div>

          {/* Headline */}
          <p className="text-center text-[17px] font-extrabold text-gray-900 mb-1 leading-snug">
            {detail.feature ? `Unlock ${detail.feature}` : `Upgrade to ${label}`}
          </p>
          <p className="text-center text-sm text-gray-500 mb-5">
            {label}{price ? ` · ${price}` : ''} — billed monthly, cancel anytime
          </p>

          {/* Benefits */}
          {benefits.length > 0 && (
            <ul className="space-y-2.5 mb-6">
              {benefits.map(b => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span
                    className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          )}

          {/* CTA */}
          <Link
            href={`/plans?feature=${encodeURIComponent(detail.feature ?? '')}&plan=${plan}`}
            onClick={close}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)',
              boxShadow: '0 4px 20px rgba(55,65,81,0.30)',
            }}
          >
            <PlanIcon className="w-4 h-4" />
            Upgrade to {label}
            {price && <span className="opacity-75 font-medium text-xs">— {price}</span>}
          </Link>

          <button
            onClick={close}
            className="block w-full text-center text-xs text-gray-400 mt-3 hover:text-gray-600 transition-colors py-1"
          >
            Maybe later — keep using Free
          </button>

          <p className="text-center text-[11px] text-gray-400 mt-2">
            Current plan: <span className="font-semibold">{PLAN_LABEL[userPlan]}</span>
          </p>
        </div>
      </div>
    </>
  );
}

// ── PlanGate component ────────────────────────────────────────────────────────

interface PlanGateProps {
  requiredPlan: Plan;
  children?: React.ReactNode;
  featureLabel?: string;
  preview?: boolean;
}

export function PlanGate({ requiredPlan, children, featureLabel, preview = true }: PlanGateProps) {
  const userPlan = usePlanGate();
  const isAdmin  = useIsAdmin();
  const allowed = isAdmin || planAtLeast(userPlan, requiredPlan);

  if (allowed) return <>{children}</>;

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {preview && (
        <div className="opacity-25 pointer-events-none select-none blur-[2px]">
          {children}
        </div>
      )}
      <div
        className={`${preview ? 'absolute inset-0' : 'py-16'} flex flex-col items-center justify-center z-10`}
        style={{
          background: preview ? 'rgba(250,249,255,0.88)' : 'white',
          backdropFilter: preview ? 'blur(4px)' : undefined,
          border: preview ? undefined : '1.5px dashed #d1d5db',
          borderRadius: preview ? undefined : 16,
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #f3f4f6, #e3ddf8)' }}
        >
          <Lock className="w-6 h-6" style={{ color: '#374151' }} />
        </div>

        <p className="text-sm font-extrabold text-gray-900 mb-1 text-center px-6">
          {featureLabel ? `${featureLabel} requires ` : 'Requires '}
          <span style={{ color: '#374151' }}>{PLAN_LABEL[requiredPlan]}</span>
          {PLAN_PRICE[requiredPlan] && (
            <span className="text-gray-600 font-medium"> ({PLAN_PRICE[requiredPlan]})</span>
          )}
        </p>
        <p className="text-xs text-gray-600 mb-5 text-center px-10 leading-relaxed">
          {PLAN_DESC[requiredPlan]}
        </p>

        <button
          onClick={() => triggerUpgradeSheet({ feature: featureLabel, plan: requiredPlan })}
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)',
            boxShadow: '0 4px 16px rgba(55,65,81,0.30)',
          }}
        >
          Upgrade to {PLAN_LABEL[requiredPlan]}
        </button>

        <p className="text-[11px] text-gray-600 mt-3">
          Current plan: <span className="font-semibold">{PLAN_LABEL[userPlan]}</span>
        </p>
      </div>
    </div>
  );
}
