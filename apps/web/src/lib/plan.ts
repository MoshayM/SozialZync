'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export type Plan = 'free' | 'pro' | 'unlimited' | 'enterprise';

export const FREE_LIMITS = {
  maxProjects: 3,
  maxOutputsPerProject: 5,
  copilotQueriesPerDay: 10,
  shortsEditsPerMonth: 10,
  externalPublishesPerMonth: 0,
} as const;

export const PRO_LIMITS = {
  maxProjects: Infinity,
  maxOutputsPerProject: Infinity,
  copilotQueriesPerDay: Infinity,
  shortsEditsPerMonth: Infinity,
  externalPublishesPerMonth: 50,
} as const;

export const UNLIMITED_LIMITS = {
  maxProjects: Infinity,
  maxOutputsPerProject: Infinity,
  copilotQueriesPerDay: Infinity,
  shortsEditsPerMonth: Infinity,
  externalPublishesPerMonth: Infinity,
} as const;

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
  const router = useRouter();
  const [storedPlan, setStoredPlan] = useState<Plan>('free');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('cf_plan') as Plan | null;
    if (stored === 'enterprise') setStoredPlan('enterprise');
    else if (stored === 'unlimited') setStoredPlan('unlimited');
    else if (stored === 'pro') setStoredPlan('pro');
    setIsAdmin(isAdminFromToken());
  }, []);

  const plan: Plan = isAdmin || storedPlan === 'enterprise'
    ? 'enterprise'
    : storedPlan === 'unlimited'
    ? 'unlimited'
    : storedPlan === 'pro'
    ? 'pro'
    : 'free';

  function upgradeToPro() {
    router.push('/plans');
  }

  function downgradeToFree() {
    localStorage.setItem('cf_plan', 'free');
    setStoredPlan('free');
  }

  function upgradeToEnterprise() {
    localStorage.setItem('cf_plan', 'enterprise');
    setStoredPlan('enterprise');
  }

  function upgradeToUnlimited() {
    localStorage.setItem('cf_plan', 'unlimited');
    setStoredPlan('unlimited');
  }

  const limits = plan === 'free' ? FREE_LIMITS : plan === 'unlimited' || plan === 'enterprise' ? UNLIMITED_LIMITS : PRO_LIMITS;

  return {
    plan,
    isFreeTier: plan === 'free',
    isPro: plan === 'pro' || plan === 'unlimited' || plan === 'enterprise',
    isUnlimited: plan === 'unlimited' || plan === 'enterprise',
    isEnterprise: plan === 'enterprise',
    isSuperAdmin: isAdmin,
    limits,
    upgradeToPro,
    upgradeToUnlimited,
    upgradeToEnterprise,
    downgradeToFree,
  };
}
