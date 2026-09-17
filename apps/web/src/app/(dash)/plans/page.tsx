'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Zap, Crown, Infinity as InfinityIcon, X } from 'lucide-react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { usePlanGate, useIsAdmin, type Plan } from '@/components/plan-gate';

// ── Plan definitions ──────────────────────────────────────────────────────────

interface PlanDef {
  id: Plan;
  label: string;
  price: string;
  priceNote: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  features: string[];
  adminFeatures?: string[];
  highlight?: boolean;
  trial?: string;
}

const PLANS: PlanDef[] = [
  {
    id: 'FREE',
    label: 'Free',
    price: '$0',
    priceNote: 'forever',
    icon: <Zap className="w-5 h-5" />,
    color: '#6b7280',
    gradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    features: [
      '3 projects',
      'AI Copilot (10 queries/day)',
      'Shorts Studio (10 edits/month)',
      'SozialZynk feed publishing only',
      'Basic analytics',
    ],
  },
  {
    id: 'PRO',
    label: 'Pro',
    price: '$17',
    priceNote: '/ month',
    icon: <Crown className="w-5 h-5" />,
    color: '#d97706',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    features: [
      'Unlimited projects',
      'Unlimited AI Copilot',
      'Full Creative Studio access',
      '50 external publishes / month',
      'All platforms (YouTube, Instagram, TikTok…)',
      'Ad revenue monetization',
      'Advanced SEO & A/B testing',
      'Export & download files',
      'Priority support',
    ],
    highlight: true,
    trial: '5-day free trial',
  },
  {
    id: 'UNLIMITED',
    label: 'Unlimited',
    price: '$25',
    priceNote: '/ month',
    icon: <InfinityIcon className="w-5 h-5" />,
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    features: [
      'Everything in Pro',
      'Unlimited external publishes',
      'Zero monthly caps on any feature',
      'White-label exports & own branding',
      'Dedicated support & SLA',
    ],
    adminFeatures: [
      'Team collaboration (3 seats)',
    ],
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get('upgraded') === 'true';
  const qc = useQueryClient();
  const currentPlan = usePlanGate();
  const isAdmin = useIsAdmin();
  const [error, setError] = useState<string | null>(null);

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => api.billing.getSubscription().then((r) => r.data as {
      plan: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null;
    }),
    staleTime: 60_000,
    retry: false,
  });

  const cancelAtPeriodEnd = subData?.cancelAtPeriodEnd ?? false;
  const activePlan = (subData?.plan ?? 'FREE') as Plan;

  const changeMut = useMutation({
    mutationFn: (plan: string) => api.billing.changePlan(plan),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['billing-subscription'] }); setError(null); },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const checkoutMut = useMutation({
    mutationFn: (plan: string) => api.billing.createCheckout(plan).then((r) => r.data as { url: string }),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.billing.cancelSubscription(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['billing-subscription'] }); setError(null); },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const resumeMut = useMutation({
    mutationFn: () => api.billing.resumeSubscription(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['billing-subscription'] }); setError(null); },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const portalMut = useMutation({
    mutationFn: () => api.billing.getBillingPortal().then((r) => r.data as { url: string }),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const isMutating = changeMut.isPending || checkoutMut.isPending || cancelMut.isPending || resumeMut.isPending;

  const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, UNLIMITED: 2, ENTERPRISE: 3, AGENCY: 4 };

  function handleSelectPlan(planId: Plan) {
    setError(null);
    if (planId === activePlan) return;
    const hasActivePaidSub = activePlan !== 'FREE' && subData?.status === 'ACTIVE';
    if (hasActivePaidSub) {
      changeMut.mutate(planId);
    } else {
      checkoutMut.mutate(planId);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Plans &amp; Pricing</h1>
        <p className="text-sm text-gray-500">
          Upgrade or downgrade anytime. Changes take effect immediately with pro-rated billing.
        </p>
      </div>

      {/* Success banner */}
      {justUpgraded && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          Plan upgraded successfully! Enjoy your new features.
          <button className="ml-auto" onClick={() => router.replace('/plans')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Cancellation warning */}
      {cancelAtPeriodEnd && subData?.currentPeriodEnd && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <span className="font-medium">Your plan cancels on {new Date(subData.currentPeriodEnd).toLocaleDateString()}.</span>
          <button
            onClick={() => resumeMut.mutate()}
            disabled={resumeMut.isPending}
            className="ml-auto px-3 py-1 rounded-lg text-xs font-bold bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50 transition"
          >
            {resumeMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resume'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <span>{error}</span>
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Plan cards */}
      {subLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isActive = plan.id === activePlan;
            const isFree = plan.id === 'FREE';
            const isUpgrade = PLAN_RANK[plan.id] > PLAN_RANK[activePlan];
            const visibleFeatures = [
              ...plan.features,
              ...(isAdmin && plan.adminFeatures ? plan.adminFeatures : []),
            ];

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border transition-all ${
                  isActive
                    ? 'border-2 shadow-lg'
                    : plan.highlight && !isActive
                    ? 'border border-amber-200 shadow-md'
                    : plan.id === 'UNLIMITED' && !isActive
                    ? 'border border-purple-200 shadow-md'
                    : 'border border-gray-200'
                }`}
                style={{
                  borderColor: isActive ? plan.color : undefined,
                  background: 'white',
                }}
              >
                {/* Badge */}
                {plan.highlight && !isActive && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white"
                    style={{ background: plan.color }}
                  >
                    Most Popular
                  </div>
                )}
                {plan.id === 'UNLIMITED' && !isActive && !plan.highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white"
                    style={{ background: plan.color }}
                  >
                    Best Value
                  </div>
                )}
                {isActive && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white"
                    style={{ background: plan.color }}
                  >
                    Current Plan
                  </div>
                )}

                {/* Header */}
                <div className="p-5 rounded-t-2xl" style={{ background: plan.gradient }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: plan.color }}>
                      {plan.icon}
                    </div>
                    <span className="font-extrabold text-gray-900 text-sm">{plan.label}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-xs text-gray-500 mb-1">{plan.priceNote}</span>
                  </div>
                  {plan.trial && !isActive && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.6)', color: plan.color, border: `1px solid ${plan.color}40` }}>
                      ✦ {plan.trial} — no card needed
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="flex-1 p-5">
                  <ul className="space-y-2">
                    {visibleFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.id === 'UNLIMITED' && !isAdmin && plan.adminFeatures && plan.adminFeatures.length > 0 && (
                    <p className="mt-3 text-[10px] text-gray-400 italic">
                      Team collaboration available for organisation admins.
                    </p>
                  )}
                </div>

                {/* CTA */}
                <div className="p-5 pt-0">
                  {isActive && !isFree && !cancelAtPeriodEnd ? (
                    <button
                      onClick={() => cancelMut.mutate()}
                      disabled={isMutating}
                      className="w-full py-2 rounded-xl text-xs font-semibold border border-gray-300 text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      {cancelMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Cancel plan'}
                    </button>
                  ) : isActive ? (
                    <div className="w-full py-2 rounded-xl text-xs font-semibold text-center text-gray-400 border border-dashed border-gray-300">
                      {cancelAtPeriodEnd ? 'Cancelling…' : 'Your plan'}
                    </div>
                  ) : isFree ? (
                    <div className="w-full py-2 rounded-xl text-xs font-semibold text-center text-gray-400 border border-dashed border-gray-300">
                      Downgrade via cancel
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isMutating}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      style={{ background: `linear-gradient(135deg, ${plan.color} 0%, #7c5ae8 100%)` }}
                    >
                      {(changeMut.isPending || checkoutMut.isPending) ? (
                        <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                      ) : isUpgrade ? (
                        `Upgrade to ${plan.label}`
                      ) : (
                        `Switch to ${plan.label}`
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Publish limit callout */}
      <div className="mt-6 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 text-center">
        Pro publish limit (50/month) resets on your billing date. Unlimited plan has no caps.
        <span className="mx-2 text-gray-300">·</span>
        All plans include unlimited SozialZynk feed posts.
      </div>

      {/* Billing portal link */}
      {activePlan !== 'FREE' && (
        <div className="mt-6 text-center">
          <button
            onClick={() => portalMut.mutate()}
            disabled={portalMut.isPending}
            className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700 transition disabled:opacity-50"
          >
            {portalMut.isPending ? 'Redirecting…' : 'Manage billing & invoices →'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <PlansContent />
    </Suspense>
  );
}
