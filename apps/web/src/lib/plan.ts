'use client';
import { useState, useEffect } from 'react';

export type Plan = 'free' | 'pro';

export const FREE_LIMITS = {
  maxProjects: 3,
  maxOutputsPerProject: 5,
  copilotQueriesPerDay: 10,
  shortsEditsPerMonth: 10,
} as const;

export function usePlan() {
  const [plan, setPlan] = useState<Plan>('free');

  useEffect(() => {
    const stored = localStorage.getItem('cf_plan') as Plan | null;
    if (stored === 'pro') setPlan('pro');
  }, []);

  const upgradeToPro = () => {
    // Production: open Stripe checkout. Demo: simulate upgrade.
    localStorage.setItem('cf_plan', 'pro');
    setPlan('pro');
  };

  const downgradeToFree = () => {
    localStorage.setItem('cf_plan', 'free');
    setPlan('free');
  };

  return {
    plan,
    isFreeTier: plan === 'free',
    isPro: plan === 'pro',
    limits: FREE_LIMITS,
    upgradeToPro,
    downgradeToFree,
  };
}
