'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

// ── Tier definitions ──────────────────────────────────────────────────────────

export type Plan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' | 'AGENCY';

const PLAN_ORDER: Record<Plan, number> = {
  FREE: 0, STARTER: 1, PRO: 2, ENTERPRISE: 3, AGENCY: 4,
};
const PLAN_LABEL: Record<Plan, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise', AGENCY: 'Agency',
};
const PLAN_PRICE: Record<Plan, string> = {
  FREE: '', STARTER: '$29/mo', PRO: '$79/mo', ENTERPRISE: '$199/mo', AGENCY: '$399/mo',
};
const PLAN_DESC: Record<Plan, string> = {
  FREE: 'Start with 3 projects, basic AI tools, and 10 Copilot queries/day.',
  STARTER: 'Unlock AI agent workflows, 5 videos/month, and basic analytics.',
  PRO: 'Unlock all 15 AI agents, unlimited publishing, and full SEO suite.',
  ENTERPRISE: 'Unlimited everything, advanced analytics, multi-channel, priority support.',
  AGENCY: 'Team seats, white-label, client workspaces, and dedicated SLA.',
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

/** Returns true if the current user is a SUPER_ADMIN or OWNER — bypasses all plan gates. */
export function isAdminRole(): boolean {
  const { role } = parseToken();
  if (role) return role === 'SUPER_ADMIN' || role === 'OWNER';
  // Fallback: role cached by DashLayout from /me API response
  const cached = typeof window !== 'undefined' ? localStorage.getItem('cf_user_role') : null;
  return cached === 'SUPER_ADMIN' || cached === 'OWNER';
}

/** Hook version — safe for SSR (reads after mount). */
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

/** Backward-compat alias used by analytics and other pages. */
export const usePlan = usePlanGate;

export function planAtLeast(userPlan: Plan, required: Plan): boolean {
  return PLAN_ORDER[userPlan] >= PLAN_ORDER[required];
}

// ── PlanGate component ────────────────────────────────────────────────────────

interface PlanGateProps {
  requiredPlan: Plan;
  children?: React.ReactNode;
  featureLabel?: string;
  /** Blur + dim the children when locked (default true). */
  preview?: boolean;
}

/**
 * Shows a locked overlay for users below the required plan tier.
 * SUPER_ADMIN / OWNER bypass all gates — they see everything.
 * The API always enforces the real gate; this is a UI affordance only.
 */
export function PlanGate({ requiredPlan, children, featureLabel, preview = true }: PlanGateProps) {
  const userPlan = usePlanGate();
  const isAdmin  = useIsAdmin();

  // Super Admin and Owner always have full access
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
          border: preview ? undefined : '1.5px dashed #c4b5fd',
          borderRadius: preview ? undefined : 16,
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #f0edf9, #e3ddf8)' }}
        >
          <Lock className="w-6 h-6" style={{ color: '#6D4AE0' }} />
        </div>

        <p className="text-sm font-extrabold text-gray-900 mb-1 text-center px-6">
          {featureLabel ? `${featureLabel} requires ` : 'Requires '}
          <span style={{ color: '#6D4AE0' }}>{PLAN_LABEL[requiredPlan]}</span>
          {PLAN_PRICE[requiredPlan] && (
            <span className="text-gray-600 font-medium"> ({PLAN_PRICE[requiredPlan]})</span>
          )}
        </p>
        <p className="text-xs text-gray-600 mb-5 text-center px-10 leading-relaxed">
          {PLAN_DESC[requiredPlan]}
        </p>

        <Link
          href="/wallet"
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
            boxShadow: '0 4px 16px rgba(109,74,224,0.30)',
          }}
        >
          Upgrade to {PLAN_LABEL[requiredPlan]}
        </Link>

        <p className="text-[11px] text-gray-600 mt-3">
          Current plan: <span className="font-semibold">{PLAN_LABEL[userPlan]}</span>
        </p>
      </div>
    </div>
  );
}
