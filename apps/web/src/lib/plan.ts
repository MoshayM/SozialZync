'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type Plan = 'free' | 'pro' | 'enterprise';

export const FREE_LIMITS = {
  maxProjects: 3,
  maxOutputsPerProject: 5,
  copilotQueriesPerDay: 10,
  shortsEditsPerMonth: 10,
} as const;

/** Credits below this trigger a "running low" warning. */
const LOW_CREDIT_THRESHOLD = 500;

/** localStorage key that marks a user as having actively topped up credits. */
const CREDIT_PRO_KEY = 'cf_credit_pro_active';

function isAdminFromToken(): boolean {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cf_token') : null;
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { role?: string };
    return payload.role === 'SUPER_ADMIN' || payload.role === 'OWNER';
  } catch {
    return false;
  }
}

export function usePlan() {
  const [storedPlan, setStoredPlan] = useState<Plan>('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [creditProWasActive, setCreditProWasActive] = useState(false);

  // Fetch live credit balance — deduplicates with wallet page query via shared key.
  const { data: balance } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => api.wallet.balance().then((r) => r.data),
    staleTime: 2 * 60_000,
    retry: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem('cf_plan') as Plan | null;
    if (stored === 'enterprise') setStoredPlan('enterprise');
    else if (stored === 'pro') setStoredPlan('pro');
    setCreditProWasActive(localStorage.getItem(CREDIT_PRO_KEY) === 'true');
    setIsAdmin(isAdminFromToken());
  }, []);

  const credits = balance?.balanceCredits ?? null;
  const hasCreditBalance = credits !== null && credits > 0;

  // SUPER_ADMIN / OWNER always get Enterprise access.
  // Enterprise stored plan stays enterprise regardless of credit balance.
  // Credits > 0 grants Pro access on top of any subscription plan.
  const plan: Plan = isAdmin || storedPlan === 'enterprise'
    ? 'enterprise'
    : storedPlan === 'pro' || hasCreditBalance
    ? 'pro'
    : 'free';

  // True when user topped up before but credits are now gone and no subscription.
  const creditsExhausted = storedPlan !== 'pro' && credits !== null && credits === 0 && creditProWasActive;

  const lowCredits = hasCreditBalance && credits !== null && credits < LOW_CREDIT_THRESHOLD;

  // Pro access granted specifically via credits (not a paid subscription).
  const hasCreditsPro = hasCreditBalance && storedPlan !== 'pro';

  /** Call after a successful top-up to mark that credit-based Pro is active. */
  function activateCreditPro() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CREDIT_PRO_KEY, 'true');
      setCreditProWasActive(true);
    }
  }

  /** Dismiss the exhausted banner — clears the flag so it won't re-show until next top-up. */
  function clearCreditProFlag() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CREDIT_PRO_KEY);
      setCreditProWasActive(false);
    }
  }

  function upgradeToPro() {
    localStorage.setItem('cf_plan', 'pro');
    setStoredPlan('pro');
  }

  function downgradeToFree() {
    localStorage.setItem('cf_plan', 'free');
    setStoredPlan('free');
  }

  function upgradeToEnterprise() {
    localStorage.setItem('cf_plan', 'enterprise');
    setStoredPlan('enterprise');
  }

  return {
    plan,
    isFreeTier: plan === 'free',
    isPro: plan === 'pro' || plan === 'enterprise',
    isEnterprise: plan === 'enterprise',
    isSuperAdmin: isAdmin,
    hasCreditsPro,
    creditsExhausted,
    lowCredits,
    credits,
    limits: FREE_LIMITS,
    upgradeToPro,
    upgradeToEnterprise,
    downgradeToFree,
    activateCreditPro,
    clearCreditProFlag,
  };
}
