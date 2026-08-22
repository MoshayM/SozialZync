'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, AlertTriangle, CalendarClock, CheckCircle, Copy,
  Crown, ExternalLink, Gift, Lightbulb, Loader2, PlusCircle, Share2, ShieldCheck, Sparkles,
  Trophy, TrendingDown, TrendingUp, Users, Wallet, X, Zap,
} from 'lucide-react';
import {
  api,
  type BudgetState, type CreditForecast, type CreditLotRow,
  type CreditPackRow, type CreditRecommendation, type EnterpriseMetrics,
  type LeaderboardEntry, type ReferralEarnings,
  type UsageSummary, type WalletTransaction,
} from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { usePlan } from '@/lib/plan';

// ── Locale / currency config ─────────────────────────────────────────────────

interface LocaleConf {
  currency: string; symbol: string; amounts: number[];
  usdRate: number; flag: string; label: string;
}

const LOCALE_CONFIG: Record<string, LocaleConf> = {
  IN:      { currency: 'INR', symbol: '₹',  amounts: [99, 299, 499, 999, 2999], usdRate: 83.5, flag: '🇮🇳', label: 'India' },
  US:      { currency: 'USD', symbol: '$',   amounts: [5, 10, 25, 50, 100],     usdRate: 1,    flag: '🇺🇸', label: 'United States' },
  GB:      { currency: 'GBP', symbol: '£',   amounts: [5, 10, 20, 50, 100],     usdRate: 1.27, flag: '🇬🇧', label: 'United Kingdom' },
  AU:      { currency: 'AUD', symbol: 'A$',  amounts: [10, 20, 50, 100, 200],   usdRate: 0.65, flag: '🇦🇺', label: 'Australia' },
  EU:      { currency: 'EUR', symbol: '€',   amounts: [5, 10, 25, 50, 100],     usdRate: 1.09, flag: '🇪🇺', label: 'Europe' },
  SG:      { currency: 'SGD', symbol: 'S$',  amounts: [10, 20, 50, 100, 200],   usdRate: 0.74, flag: '🇸🇬', label: 'Singapore' },
  DEFAULT: { currency: 'USD', symbol: '$',   amounts: [5, 10, 25, 50, 100],     usdRate: 1,    flag: '🌍', label: 'International' },
};

const EU_CODES = new Set(['DE', 'FR', 'IT', 'ES', 'NL', 'PT', 'BE', 'AT', 'FI', 'IE', 'GR', 'PL', 'CZ', 'RO', 'HU', 'SE', 'DK', 'NO']);

function detectLocaleKey(): string {
  if (typeof navigator === 'undefined') return 'DEFAULT';
  const country = navigator.language.split('-')[1]?.toUpperCase() ?? '';
  if (EU_CODES.has(country)) return 'EU';
  return LOCALE_CONFIG[country] ? country : 'DEFAULT';
}

// ── Access Tiers (credit-based, not subscription) ─────────────────────────────

interface AccessTier {
  id: string;
  name: string;
  color: string;
  unlockLabel: string;
  unlockSub: string;
  features: string[];
  highlight?: boolean;
}

const ACCESS_TIERS: AccessTier[] = [
  {
    id: 'FREE',
    name: 'Free',
    color: '#6B7280',
    unlockLabel: 'Always free',
    unlockSub: 'No top-up needed · 0 credits required',
    features: ['3 projects', '10 AI actions/day', 'Basic analytics', 'Single platform', 'Community support'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    color: '#374151',
    unlockLabel: 'Top up any amount',
    unlockSub: 'Credits > 0 → Pro instantly · pay as you go',
    features: ['Unlimited projects', 'All 6 platforms', 'Priority AI generation', 'Full analytics dashboard', 'Auto-scheduling', 'Short-form editor', 'AI Copilot'],
    highlight: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    color: '#D97706',
    unlockLabel: 'Apply for access',
    unlockSub: 'Reviewed by admin · payment activated on approval',
    features: ['Everything in Pro', 'Team seats & workspaces', 'White-label dashboard', 'Dedicated account manager', 'Custom AI credit budget', 'SLA guarantee'],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }

const TYPE_LABELS: Record<string, string> = {
  USAGE_DEBIT: 'AI usage',
  PURCHASE:    'Top-up',
  TRIAL:       'Trial credits',
  BONUS:       'Bonus credits',
  REFERRAL:    'Referral reward',
  PROMO:       'Promo credits',
  EXPIRY:      'Credits expired',
  REFUND:      'Refund',
};

const TYPE_COLORS: Record<string, string> = {
  USAGE_DEBIT: '#b91c1c', EXPIRY: '#b91c1c',
  PURCHASE: '#059669', TRIAL: '#6b7280', BONUS: '#6b7280',
  REFERRAL: '#0891B2', PROMO: '#6b7280', REFUND: '#1d4ed8',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function groupTxns(txns: WalletTransaction[]): { label: string; items: WalletTransaction[] }[] {
  const now = Date.now();
  const groups: { label: string; items: WalletTransaction[] }[] = [
    { label: 'Today',     items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This week', items: [] },
    { label: 'Earlier',   items: [] },
  ];
  for (const t of txns) {
    const d = now - new Date(t.createdAt).getTime();
    const days = d / 86400000;
    if (days < 1)      groups[0].items.push(t);
    else if (days < 2) groups[1].items.push(t);
    else if (days < 7) groups[2].items.push(t);
    else               groups[3].items.push(t);
  }
  return groups.filter((g) => g.items.length > 0);
}

// ── SVG Usage Ring ─────────────────────────────────────────────────────────

function UsageRing({ pct }: { pct: number }) {
  const r = 40, cx = 50, cy = 50, circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct > 85 ? '#f87171' : pct > 60 ? '#fbbf24' : '#a78bfa';
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="10" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="50" y="54" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: '#fff', fontSize: '18px', fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {pct}%
      </text>
    </svg>
  );
}

// ── 1. Financial Hero ────────────────────────────────────────────────────────

function FinancialHero({ onTopUp, onSetBudget }: { onTopUp: () => void; onSetBudget: () => void }) {
  const { hasCreditsPro, isEnterprise, isSuperAdmin } = usePlan();
  const { data: balance } = useQuery<{ balanceCredits: number; buckets: Record<string, number>; lifetimePurchased: number; lifetimeUsed: number }>({
    queryKey: ['wallet-balance'],
    queryFn: () => api.wallet.balance().then((r) => r.data),
  });
  const { data: budget } = useQuery<BudgetState>({
    queryKey: ['wallet-budget'],
    queryFn: () => api.wallet.budget.get().then((r) => r.data),
  });
  const { data: forecast } = useQuery<CreditForecast>({
    queryKey: ['wallet-forecast'],
    queryFn: () => api.wallet.forecast().then((r) => r.data),
  });
  const { data: sub } = useQuery<{ plan: string; status: string; currentPeriodEnd: string }>({
    queryKey: ['subscription'],
    queryFn: () => api.billing.getSubscription().then((r) => r.data as { plan: string; status: string; currentPeriodEnd: string }),
  });

  const pct = budget && budget.monthlyLimit > 0
    ? Math.min(100, Math.round((budget.spent / budget.monthlyLimit) * 100))
    : 0;

  const daysLeft = forecast?.daysToEmpty != null ? Math.round(forecast.daysToEmpty) : null;

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(145deg, #4f2ec4 0%, #6D4AE0 55%, #7c5ae8 100%)', boxShadow: '0 20px 50px -10px rgba(109,74,224,.45)' }}>
      {/* Main body */}
      <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex-1 min-w-0">
          {/* Plan badge */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
              {isSuperAdmin ? 'Super Admin'
                : isEnterprise ? 'Enterprise'
                : hasCreditsPro ? 'Pro (Credits)'
                : (sub?.plan ?? 'Free')} Plan
            </span>
            {isSuperAdmin ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: '#fef3c7', color: '#92400e' }}>
                <ShieldCheck className="w-3 h-3" /> Full access
              </span>
            ) : isEnterprise ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: '#ecfdf5', color: '#065f46' }}>
                <Crown className="w-3 h-3" /> Enterprise
              </span>
            ) : hasCreditsPro ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: '#fef3c7', color: '#92400e' }}>
                <Zap className="w-3 h-3" /> Credit-powered
              </span>
            ) : sub?.status === 'active' ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#ecfdf5', color: '#065f46' }}>Active</span>
            ) : null}
          </div>
          <div>
            <p className="text-white/90 text-sm font-medium mb-1">AI credits remaining</p>
            <p className="text-5xl sm:text-6xl font-extrabold text-white tabular-nums leading-none">
              {balance ? fmt(balance.balanceCredits) : '—'}
            </p>
          </div>
          {sub?.currentPeriodEnd && (
            <p className="text-white/90 text-xs mt-2">
              Renews {new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          <button
            onClick={onTopUp}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-[.98]"
            style={{ background: '#fff', color: '#374151', boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}
          >
            <PlusCircle className="w-4 h-4" /> Top up credits
          </button>
        </div>

        {/* Usage ring */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          {budget && budget.status !== 'NONE' ? (
            <>
              <UsageRing pct={pct} />
              <p className="text-white/90 text-[11px]">of monthly budget</p>
            </>
          ) : (
            <button onClick={onSetBudget} className="flex flex-col items-center gap-1 group">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/25 flex items-center justify-center group-hover:border-white/50 transition-colors">
                <AlertCircle className="w-8 h-8 text-white/35 group-hover:text-white/60 transition-colors" aria-hidden="true" />
              </div>
              <span className="text-white/90 text-[11px] group-hover:text-white transition-colors">Set budget</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom stat strip */}
      <div className="grid grid-cols-3 divide-x divide-white/10" style={{ background: 'rgba(0,0,0,.18)', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        {[
          { label: 'Spent this month', value: budget ? fmt(budget.spent) : '—', unit: 'credits' },
          { label: 'Daily burn rate', value: forecast?.dailyBurn ? fmt(Math.round(forecast.dailyBurn)) : '—', unit: 'credits/day' },
          {
            label: 'Forecast', unit: 'remaining',
            value: daysLeft != null ? `~${daysLeft}d` : '∞',
            color: daysLeft == null ? '#a78bfa' : daysLeft <= 7 ? '#f87171' : daysLeft <= 30 ? '#fbbf24' : '#86efac',
          },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[10px] text-white/90 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: color ?? '#fff' }}>{value}</p>
            <p className="text-[10px] text-white/90">{unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2. AI Cost Insights ──────────────────────────────────────────────────────

function CostByAction() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery<UsageSummary>({
    queryKey: ['wallet-usage-summary', days],
    queryFn: () => api.wallet.usageSummary(days).then((r) => r.data),
  });

  const total = data?.totalSpent ?? 1;
  const top = data?.byAction.slice(0, 8) ?? [];
  const max = top[0]?.credits ?? 1;

  return (
    <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4" style={{ color: '#374151' }} />
          <span className="text-sm font-semibold text-gray-800">Cost by AI Action</span>
        </div>
        <div className="flex items-center gap-1 rounded-xl p-0.5" style={{ background: '#f0edf9' }}>
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className="px-3 py-1 rounded-[10px] text-xs font-semibold transition-all"
              style={days === d ? { background: '#fff', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,.08)' } : { color: '#374151' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#374151' }} />}

      {data && top.length === 0 && <p className="text-sm text-gray-600 italic py-4 text-center">No usage in this period.</p>}

      <div className="space-y-3">
        {top.map(({ action, credits }) => {
          const pct = Math.round((credits / max) * 100);
          const ofTotal = total > 0 ? Math.round((credits / total) * 100) : 0;
          return (
            <div key={action}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-700 font-medium capitalize">{action.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="text-gray-600 tabular-nums">{fmt(credits)} <span className="text-gray-600">· {ofTotal}%</span></span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #9ca3af, #374151)' }} />
              </div>
            </div>
          );
        })}
      </div>

      {data && data.totalSpent > 0 && (
        <p className="text-xs text-gray-600 pt-1">
          Total: <span className="font-semibold text-gray-700">{fmt(data.totalSpent)} credits</span> in {days} days
        </p>
      )}
    </div>
  );
}

function SpendForecast() {
  const { data: forecast, isLoading } = useQuery<CreditForecast>({
    queryKey: ['wallet-forecast'],
    queryFn: () => api.wallet.forecast().then((r) => r.data),
  });
  const { data: recs = [] } = useQuery<CreditRecommendation[]>({
    queryKey: ['wallet-recommendations'],
    queryFn: () => api.wallet.recommendations().then((r) => r.data),
  });

  const daysLeft = forecast?.daysToEmpty != null ? Math.round(forecast.daysToEmpty) : null;
  const daysColor = daysLeft == null ? '#374151' : daysLeft <= 7 ? '#b91c1c' : daysLeft <= 30 ? '#c2410c' : '#059669';

  return (
    <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4" style={{ color: '#374151' }} />
        <span className="text-sm font-semibold text-gray-800">Spend Forecast</span>
      </div>

      {isLoading && <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#374151' }} />}

      {forecast && forecast.dailyBurn === 0 && (
        <p className="text-sm text-gray-600 italic py-2">No usage yet — nothing to forecast.</p>
      )}

      {forecast && forecast.dailyBurn > 0 && (
        <div className="space-y-3">
          {[
            { label: 'Daily burn rate',     value: `${fmt(Math.round(forecast.dailyBurn))} cr/day`, color: '#374151' },
            { label: 'Balance lasts',        value: daysLeft != null ? `~${daysLeft} days` : 'No limit', color: daysColor },
            { label: 'Month-end projected',  value: `${fmt(forecast.projectedMonthEndSpend)} credits`, color: '#374151' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
            </div>
          ))}

          {/* Smart tip */}
          {daysLeft != null && daysLeft < 30 && forecast.emptyOn && (
            <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5" style={{ background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                At this burn rate, credits run out on <strong>{forecast.emptyOn}</strong>. Top up at least <strong>{fmt(Math.round(forecast.dailyBurn * 30))} credits</strong> to last the month.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inline recommendations */}
      {recs.length > 0 && (
        <ul className="space-y-2 pt-1">
          {recs.slice(0, 2).map((rec) => (
            <li key={rec.type} className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5"
              style={rec.severity === 'warning'
                ? { background: '#fff7ed', border: '1.5px solid #fed7aa', color: '#c2410c' }
                : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }}>
              {rec.severity === 'warning'
                ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />}
              {rec.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 3. Smart Top-Up ──────────────────────────────────────────────────────────

function SmartTopUp() {
  const qc = useQueryClient();
  const { activateCreditPro } = usePlan();
  const [localeKey, setLocaleKey] = useState<string>('DEFAULT');
  const [selected, setSelected] = useState<number | null>(null);
  const [customAmt, setCustomAmt] = useState('');
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((d: { country_code?: string }) => {
        const c = d.country_code ?? '';
        if (EU_CODES.has(c)) setLocaleKey('EU');
        else setLocaleKey(LOCALE_CONFIG[c] ? c : 'DEFAULT');
      })
      .catch(() => setLocaleKey(detectLocaleKey()));
  }, []);

  const conf = LOCALE_CONFIG[localeKey] ?? LOCALE_CONFIG['DEFAULT']!;

  const rechargeMutation = useMutation({
    mutationFn: (amountUsd: number) => api.wallet.recharge(amountUsd),
    onSuccess: (res) => {
      const data = res.data as { checkoutUrl: string | null };
      if (data.checkoutUrl) {
        // Mark credit-pro active before redirecting to Stripe
        activateCreditPro();
        window.location.href = data.checkoutUrl;
      } else {
        // Instant top-up (no checkout redirect)
        activateCreditPro();
        setActivated(true);
        void qc.invalidateQueries({ queryKey: ['wallet-balance'] });
        setTimeout(() => setActivated(false), 4000);
      }
    },
  });

  const buyPacks = useQuery<CreditPackRow[]>({
    queryKey: ['marketplace-packs'],
    queryFn: () => api.marketplace.packs().then((r) => r.data),
  });

  function handleBuy(localAmount: number) {
    const usd = localAmount / conf.usdRate;
    rechargeMutation.mutate(Math.round(usd * 100) / 100);
  }

  const midIndex = Math.floor((conf.amounts.length - 1) / 2);
  const CREDITS_PER_DOLLAR = 1000;

  return (
    <div className="bg-white rounded-2xl p-5 space-y-5" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: '#374151' }} />
          <span className="text-sm font-semibold text-gray-800">Top Up Credits</span>
        </div>

        {/* Auto-detected locale badge */}
        <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl" style={{ background: '#f3f4f6', color: '#374151', border: '1.5px solid #e3ddf8' }}>
          <span>{conf.flag}</span>
          <span>{conf.label}</span>
          <span className="text-[10px] text-gray-400">· auto</span>
        </div>
      </div>

      <p className="text-xs text-gray-600">~{CREDITS_PER_DOLLAR.toLocaleString()} credits per $1 USD</p>

      {/* Amount pills */}
      <div className="grid grid-cols-5 gap-2">
        {conf.amounts.map((amount, i) => {
          const usdEq = amount / conf.usdRate;
          const isBest = i === midIndex;
          const isSelected = selected === i;
          return (
            <button
              key={amount}
              onClick={() => { setSelected(i); handleBuy(amount); }}
              disabled={rechargeMutation.isPending}
              className="relative flex flex-col items-center py-3 px-1 rounded-2xl transition-all hover:scale-105 active:scale-[.98] disabled:opacity-50"
              style={isSelected || isBest
                ? { background: 'linear-gradient(135deg, #9ca3af, #374151)', border: '2px solid #6D4AE0' }
                : { background: '#faf9ff', border: '1.5px solid #e3ddf8' }}
            >
              {isBest && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: '#fbbf24', color: '#78350f' }}>
                  Best
                </span>
              )}
              <span className="text-sm font-bold" style={{ color: (isSelected || isBest) ? '#fff' : '#111827' }}>
                {conf.symbol}{amount}
              </span>
              <span className="text-[10px] mt-0.5" style={{ color: (isSelected || isBest) ? 'rgba(255,255,255,.85)' : '#374151' }}>
                ${usdEq < 1 ? usdEq.toFixed(2) : Math.round(usdEq)} USD
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div className="flex gap-2">
        <div className="flex items-center flex-1 rounded-2xl bg-white" style={{ border: '1.5px solid #e3e0f0' }}>
          <span className="pl-3.5 text-sm font-semibold text-gray-600">{conf.symbol}</span>
          <input
            type="number"
            min={1}
            placeholder="Custom amount"
            value={customAmt}
            onChange={(e) => setCustomAmt(e.target.value)}
            className="flex-1 bg-transparent px-2 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </div>
        <button
          onClick={() => { if (customAmt) handleBuy(Number(customAmt)); }}
          disabled={!customAmt || rechargeMutation.isPending}
          className="px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' }}
        >
          {rechargeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy'}
        </button>
      </div>

      {/* Pro access unlock badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: 'linear-gradient(135deg,#f5f2fd,#ede9fb)', border: '1.5px solid #d8d0f7' }}>
        <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: '#374151' }} />
        <span className="text-xs font-semibold" style={{ color: '#5b21b6' }}>
          Unlocks <span className="font-extrabold">Pro access</span> while credits last — no subscription needed
        </span>
      </div>

      {activated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl animate-pulse" style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">Pro access activated! Enjoy all features while credits last.</span>
        </div>
      )}

      {rechargeMutation.isError && (
        <p className="text-xs text-red-500">{getErrorMessage(rechargeMutation.error) || 'Payment failed'}</p>
      )}

      {/* Credit packs from API */}
      {buyPacks.data && buyPacks.data.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-2">Packs</p>
          <div className="flex flex-wrap gap-2">
            {buyPacks.data.map((pack) => {
              const price = new Intl.NumberFormat(undefined, { style: 'currency', currency: pack.currency.toUpperCase() }).format(pack.priceMinor / 100);
              const buyPackMutation = rechargeMutation;
              return (
                <button key={pack.id}
                  onClick={() => { void api.wallet.rechargePack(pack.id).then((res) => { const d = res.data as { checkoutUrl: string | null }; if (d.checkoutUrl) window.location.href = d.checkoutUrl; }); }}
                  disabled={buyPackMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all hover:opacity-90"
                  style={{ background: '#f3f4f6', color: '#374151', border: '1.5px solid #e3ddf8' }}>
                  <PlusCircle className="w-3 h-3" />
                  {pack.name} · {pack.credits.toLocaleString()} cr · {price}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 4. Plans Grid (credit-based access tiers) ─────────────────────────────────

function PlansGrid() {
  const { plan, credits, hasCreditsPro, isEnterprise, isSuperAdmin } = usePlan();
  const [localeKey, setLocaleKey] = useState<string>('DEFAULT');
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState({ company: '', teamSize: '', useCase: '' });
  const [enterpriseTeamFile, setEnterpriseTeamFile] = useState<File | null>(null);
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);
  const [enterpriseSubmitting, setEnterpriseSubmitting] = useState(false);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((d: { country_code?: string }) => {
        const c = d.country_code ?? '';
        if (EU_CODES.has(c)) setLocaleKey('EU');
        else setLocaleKey(LOCALE_CONFIG[c] ? c : 'DEFAULT');
      })
      .catch(() => setLocaleKey(detectLocaleKey()));
    setEnterpriseSubmitted(localStorage.getItem('cf_enterprise_requested') === 'true');
  }, []);

  const conf = LOCALE_CONFIG[localeKey] ?? LOCALE_CONFIG['DEFAULT']!;
  const minTopUp = conf.amounts[0] ?? 5;

  return (
    <div className="space-y-5">
      {/* Current access level banner */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{
          background: isSuperAdmin || isEnterprise ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : hasCreditsPro ? 'linear-gradient(135deg,#f5f2fd,#ede9fb)' : '#f9fafb',
          border: `1.5px solid ${isSuperAdmin || isEnterprise ? '#fde68a' : hasCreditsPro ? '#d8d0f7' : '#e5e7eb'}`,
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: isSuperAdmin || isEnterprise ? 'linear-gradient(135deg,#d97706,#f59e0b)' : hasCreditsPro ? 'linear-gradient(135deg,#374151,#1f2937)' : '#e5e7eb' }}
        >
          {isSuperAdmin ? <ShieldCheck className="w-5 h-5 text-white" />
            : isEnterprise ? <Crown className="w-5 h-5 text-white" />
            : hasCreditsPro ? <Sparkles className="w-5 h-5 text-white" />
            : <Wallet className="w-5 h-5 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">
            {isSuperAdmin ? 'Super Admin — full platform access'
              : isEnterprise ? 'Enterprise plan — all features unlocked'
              : hasCreditsPro ? 'Pro access — active via credits'
              : 'Free tier'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {isSuperAdmin
              ? 'Owner/developer account · bypasses all plan gates · full access to all features'
              : isEnterprise
              ? `Enterprise features active · ${credits?.toLocaleString() ?? '—'} credits remaining`
              : hasCreditsPro
              ? `${credits?.toLocaleString() ?? '—'} credits remaining · all Pro features unlocked`
              : `Top up AI credits from ${conf.symbol}${minTopUp} to unlock Pro instantly`}
          </p>
        </div>
        {!hasCreditsPro && plan !== 'pro' && (
          <button
            type="button"
            onClick={() => document.getElementById('credits-tab-btn')?.click()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#374151,#1f2937)' }}
          >
            Top Up →
          </button>
        )}
      </div>

      {/* Pay-as-you-go explainer */}
      <div className="rounded-2xl px-4 py-3 flex items-start gap-2.5" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
        <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>No subscription, no monthly charge.</strong> Buy credits whenever you need them — from {conf.symbol}{minTopUp}. Your Pro access stays active as long as your balance is above zero. Credits never expire.
        </p>
      </div>

      {/* Access tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ACCESS_TIERS.map((tier) => {
          const isActive =
            tier.id === 'ENTERPRISE' ? isSuperAdmin || isEnterprise
            : tier.id === 'PRO' ? !isSuperAdmin && !isEnterprise && (hasCreditsPro || plan === 'pro')
            : tier.id === 'FREE' ? !isSuperAdmin && !isEnterprise && plan === 'free' && !hasCreditsPro
            : false;

          return (
            <div
              key={tier.id}
              className="rounded-2xl overflow-hidden flex flex-col bg-white"
              style={{
                border: isActive ? `2px solid ${tier.color}` : '1.5px solid #e3ddf8',
                boxShadow: isActive ? `0 8px 24px -8px ${tier.color}40` : 'none',
              }}
            >
              <div className="h-1.5" style={{ background: tier.color }} />
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{tier.name}</h3>
                    {tier.highlight && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: '#f3f4f6', color: '#374151' }}>
                        Most popular
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${tier.color}18`, color: tier.color }}>
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                {/* Unlock label */}
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: tier.id === 'PRO' ? '#f5f2fd' : tier.id === 'ENTERPRISE' ? '#fffbeb' : '#f9fafb' }}
                >
                  <p className="text-sm font-extrabold" style={{ color: tier.color }}>{tier.unlockLabel}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{tier.unlockSub}</p>
                </div>

                {/* Features */}
                <ul className="space-y-1.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: tier.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {tier.id === 'FREE' && (
                  <div
                    className="mt-auto w-full py-2.5 rounded-2xl text-sm font-bold text-center"
                    style={{ background: '#f3f4f6', color: '#374151' }}
                  >
                    {plan === 'free' && !hasCreditsPro ? 'Current plan' : 'Included'}
                  </div>
                )}

                {tier.id === 'PRO' && (
                  <div className="mt-auto space-y-2">
                    {hasCreditsPro || plan === 'pro' ? (
                      <div
                        className="w-full py-2.5 rounded-2xl text-sm font-bold text-center"
                        style={{ background: '#f3f4f6', color: '#374151' }}
                      >
                        Pro active ✓
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => document.getElementById('credits-tab-btn')?.click()}
                        className="w-full py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98]"
                        style={{ background: 'linear-gradient(135deg,#374151,#1f2937)', boxShadow: '0 4px 16px -4px rgba(0,0,0,.25)' }}
                      >
                        Top up to unlock Pro
                      </button>
                    )}
                    <p className="text-[10px] text-center text-gray-600">
                      From {conf.symbol}{minTopUp} · no subscription · credits never expire
                    </p>
                  </div>
                )}

                {tier.id === 'ENTERPRISE' && (
                  <div className="mt-auto">
                    {enterpriseSubmitted ? (
                      <div
                        className="w-full py-2.5 rounded-2xl text-sm font-bold text-center"
                        style={{ background: '#fef3c7', color: '#b45309' }}
                      >
                        Request Pending · Under review
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowEnterpriseModal(true)}
                        className="w-full py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98]"
                        style={{ background: 'linear-gradient(135deg,#D97706,#b45309)', boxShadow: '0 4px 16px -4px #D9770680' }}
                      >
                        Request Access
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise Request Modal */}
      {showEnterpriseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Request Enterprise Access</h2>
                <p className="text-xs text-gray-600 mt-0.5">Our team will review and activate payment within 24h</p>
              </div>
              <button type="button" onClick={() => setShowEnterpriseModal(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              {(
                [
                  { key: 'company',  label: 'Company / Brand name', placeholder: 'Acme Corp'  },
                  { key: 'teamSize', label: 'Team size',             placeholder: 'e.g. 10–50' },
                ] as { key: keyof typeof enterpriseForm; label: string; placeholder: string }[]
              ).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={enterpriseForm[key]}
                    onChange={(e) => setEnterpriseForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-gray-400"
                  />
                </div>
              ))}

              {/* Team member details PDF upload */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Team Member Details <span className="text-gray-400 font-normal">(PDF — name &amp; email list)</span>
                </label>
                <label
                  className="flex flex-col items-center justify-center gap-2 w-full rounded-xl cursor-pointer transition-all"
                  style={{
                    border: enterpriseTeamFile ? '2px solid #e5e7eb' : '2px dashed #d1d5db',
                    background: enterpriseTeamFile ? '#faf5ff' : '#fafafa',
                    padding: '16px 12px',
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && f.type === 'application/pdf') setEnterpriseTeamFile(f);
                    }}
                  />
                  {enterpriseTeamFile ? (
                    <>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      <span className="text-xs font-semibold text-gray-700 text-center break-all">{enterpriseTeamFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setEnterpriseTeamFile(null); }}
                        className="text-[11px] text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span className="text-xs font-medium text-gray-500">Click to upload PDF</span>
                      <span className="text-[11px] text-gray-400">Include team member names &amp; email addresses</span>
                    </>
                  )}
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Use case / Why enterprise?</label>
                <textarea
                  placeholder="Describe your use case..."
                  rows={3}
                  value={enterpriseForm.useCase}
                  onChange={(e) => setEnterpriseForm((f) => ({ ...f, useCase: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-gray-400 resize-none"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!enterpriseForm.company || !enterpriseForm.useCase || enterpriseSubmitting}
              onClick={() => {
                setEnterpriseSubmitting(true);
                const existing = JSON.parse(localStorage.getItem('cf_enterprise_requests') ?? '[]') as unknown[];
                existing.push({
                  id: Date.now().toString(),
                  userId: localStorage.getItem('cf_user_id') ?? 'anonymous',
                  userName: localStorage.getItem('cf_user_name') ?? 'User',
                  userEmail: localStorage.getItem('cf_user_email') ?? '',
                  ...enterpriseForm,
                  teamMemberFile: enterpriseTeamFile?.name ?? null,
                  status: 'pending',
                  submittedAt: new Date().toISOString(),
                });
                localStorage.setItem('cf_enterprise_requests', JSON.stringify(existing));
                localStorage.setItem('cf_enterprise_requested', 'true');
                setTimeout(() => {
                  setEnterpriseSubmitting(false);
                  setEnterpriseSubmitted(true);
                  setShowEnterpriseModal(false);
                }, 1200);
              }}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#D97706,#b45309)' }}
            >
              {enterpriseSubmitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 5. Owner Intelligence Panel ──────────────────────────────────────────────

function OwnerPanel() {
  const { data: metrics, isLoading } = useQuery<EnterpriseMetrics>({
    queryKey: ['admin-enterprise-metrics'],
    queryFn: () => api.admin.enterpriseMetrics().then((r) => r.data),
  });

  if (isLoading) return (
    <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: '#fefce8', border: '1.5px solid #fde68a' }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#b45309' }} />
      <span className="text-sm text-amber-700">Loading owner intelligence…</span>
    </div>
  );

  if (!metrics) return null;

  const revenueUsd = metrics.mrr / 100;
  const costUsd = metrics.aiCostUsd;
  const margin = revenueUsd > 0 ? Math.round(((revenueUsd - costUsd) / revenueUsd) * 100) : 0;
  const costRatio = revenueUsd > 0 ? costUsd / revenueUsd : 0;
  const arpuUsd = metrics.arpu / 100;

  const insight =
    costRatio > 0.15
      ? `AI costs are ${(costRatio * 100).toFixed(1)}% of revenue — above the 15% target. Consider raising Pro to $39/mo or reducing script-generation model calls.`
      : costRatio < 0.10
      ? `Healthy margins at ${(costRatio * 100).toFixed(1)}% AI cost ratio. You have room to add 500 bonus credits to Pro plan with no profit risk.`
      : `On track — AI cost is ${(costRatio * 100).toFixed(1)}% of revenue. Monitor daily burn vs subscriber growth ratio.`;

  const kpis = [
    { label: 'Platform MRR',     value: `$${revenueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: 'this month',         icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'AI Infra Cost',    value: `$${costUsd.toFixed(2)}`,                                                  sub: 'vs last month',      icon: <Zap className="w-4 h-4" /> },
    { label: 'Gross Margin',     value: `${margin}%`,                                                              sub: 'revenue - AI cost',  icon: <Sparkles className="w-4 h-4" /> },
    { label: 'Revenue per User', value: `$${arpuUsd.toFixed(2)}`,                                                  sub: 'ARPU (30d)',          icon: <Crown className="w-4 h-4" /> },
  ];

  const perUserCosts = [
    { plan: 'Free',       cost: `$${(costUsd * 0.03).toFixed(3)}` },
    { plan: 'Pro',        cost: `$${(costUsd * 0.15).toFixed(2)}` },
    { plan: 'Enterprise', cost: `$${(costUsd * 0.45).toFixed(2)}` },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #fde68a' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)' }}>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5" style={{ color: '#b45309' }} />
          <span className="font-bold text-amber-900">Owner Intelligence</span>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#78350f', color: '#fef3c7' }}>
          Superadmin only
        </span>
      </div>

      <div className="p-5 space-y-5" style={{ background: '#fffbeb' }}>
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, sub, icon }) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={{ background: '#fff', border: '1.5px solid #fde68a' }}>
              <div className="w-8 h-8 rounded-xl mx-auto flex items-center justify-center mb-2" style={{ background: '#fef3c7', color: '#b45309' }}>
                {icon}
              </div>
              <p className="text-xl font-extrabold text-amber-900 tabular-nums">{value}</p>
              <p className="text-[10px] font-semibold text-amber-700 mt-0.5">{label}</p>
              <p className="text-[10px] text-amber-500">{sub}</p>
            </div>
          ))}
        </div>

        {/* AI pricing insight */}
        <div className="rounded-2xl px-4 py-3.5 flex items-start gap-3" style={{ background: '#fef3c7', border: '1.5px solid #fde68a' }}>
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 leading-relaxed">{insight}</p>
        </div>

        {/* Per-user cost */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 mb-2">Avg AI Cost per User</p>
          <div className="grid grid-cols-3 gap-2">
            {perUserCosts.map(({ plan, cost }) => (
              <div key={plan} className="rounded-2xl p-3 text-center" style={{ background: '#fff', border: '1.5px solid #fde68a' }}>
                <p className="text-[10px] text-amber-600 font-semibold">{plan}</p>
                <p className="text-base font-bold text-amber-900 tabular-nums mt-0.5">{cost}</p>
                <p className="text-[10px] text-amber-400">per user</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 6. Transaction History ───────────────────────────────────────────────────

function TransactionHistory() {
  const [showAll, setShowAll] = useState(false);

  const { data: txns = [], isLoading } = useQuery<WalletTransaction[]>({
    queryKey: ['wallet-transactions-full'],
    queryFn: () => api.wallet.transactions(50).then((r) => r.data as WalletTransaction[]),
  });

  const displayed = showAll ? txns : txns.slice(0, 20);
  const groups = groupTxns(displayed);

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0edf9' }}>
        <span className="text-sm font-semibold text-gray-800">Transaction History</span>
        {txns.length > 20 && (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold hover:underline" style={{ color: '#374151' }}>
            {showAll ? 'Show less' : `Show all ${txns.length}`}
          </button>
        )}
      </div>

      {isLoading && <div className="p-5"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#374151' }} /></div>}
      {!isLoading && txns.length === 0 && <p className="px-5 py-8 text-sm text-gray-600 text-center italic">No transactions yet.</p>}

      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-5 py-2" style={{ background: '#f9f7ff', borderBottom: '1px solid #f0edf9', borderTop: '1px solid #f0edf9' }}>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600">{group.label}</span>
          </div>
          {group.items.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#faf9ff] transition-colors" style={{ borderBottom: '1px solid #f9f7ff' }}>
              {/* Dot */}
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[tx.entryType] ?? '#9ca3af' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{TYPE_LABELS[tx.entryType] ?? tx.entryType.replace(/_/g, ' ').toLowerCase()}</p>
                <p className="text-xs text-gray-600">{timeAgo(tx.createdAt)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums" style={{ color: tx.amount >= 0 ? '#059669' : '#b91c1c' }}>
                  {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                </p>
                <p className="text-[11px] text-gray-600 tabular-nums">{fmt(tx.balanceAfter)} after</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 7. Referral Center ────────────────────────────────────────────────────────

function fmtCredits(n: number | undefined | null) {
  return (n ?? 0).toLocaleString();
}

function statusChipStyle(s: string): string {
  switch (s) {
    case 'ACTIVE': return 'bg-[#ecfdf5] text-[#065f46]';
    case 'EXPIRED': return 'bg-red-50 text-red-700 border-red-200';
    case 'CONVERTED': return 'bg-[#f5f2fd] text-[#6D4AE0]';
    case 'PENDING_REVIEW': return 'bg-[#fff7ed] text-[#c2410c]';
    case 'REVOKED': return 'bg-[#f3f4f6] text-[#4b5563]';
    case 'PENDING': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'QUALIFIED': return 'bg-[#ecfdf5] text-[#065f46]';
    case 'REWARDED': return 'bg-[#f5f2fd] text-[#6D4AE0]';
    case 'FLAGGED': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-[#f3f4f6] text-[#4b5563]';
  }
}

function ReferralCenter() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: earnings, isLoading: earningsLoading } = useQuery<ReferralEarnings>({
    queryKey: ['referral-earnings'],
    queryFn: () => api.referral.earnings().then((r) => r.data),
  });

  const { data: leaderboard = [], isLoading: lbLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['referral-leaderboard'],
    queryFn: () => api.referral.leaderboard().then((r) => r.data),
  });

  const { data: codeData, isLoading: codeLoading } = useQuery<{ code: string }>({
    queryKey: ['referral-code'],
    queryFn: () => api.referral.code().then((r) => r.data),
  });

  useEffect(() => {
    const pending = localStorage.getItem('cf.pendingReferralCode');
    if (pending) setRedeemInput(pending);
  }, []);

  const redeemMutation = useMutation({
    mutationFn: (code: string) => api.referral.redeem(code),
    onSuccess: () => {
      setRedeemSuccess(true);
      setRedeemError('');
      localStorage.removeItem('cf.pendingReferralCode');
      void qc.invalidateQueries({ queryKey: ['referral-earnings'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRedeemError(msg ?? getErrorMessage(err) ?? 'Redemption failed');
    },
  });

  const shareUrl = codeData ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${codeData.code}` : '';

  async function copyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (inputRef.current) inputRef.current.select();
    }
  }

  const shareMsg = encodeURIComponent(`Join me on Sozialzynk — the best AI platform for YouTube creators! Use my referral link:`);
  const twitterUrl = codeData ? `https://twitter.com/intent/tweet?text=${shareMsg}&url=${encodeURIComponent(shareUrl)}` : '#';
  const linkedInUrl = codeData ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}` : '#';
  const whatsAppUrl = codeData ? `https://wa.me/?text=${shareMsg}%20${encodeURIComponent(shareUrl)}` : '#';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#6D4AE0]" />
          <span className="text-sm font-semibold text-gray-800">Referral Center</span>
        </div>

        {codeLoading && <Loader2 className="w-5 h-5 animate-spin text-[#6D4AE0]" />}

        {codeData && (
          <>
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Your referral code</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-widest text-[#6D4AE0] font-mono">{codeData.code}</span>
                <button
                  onClick={() => void copyCode(codeData.code)}
                  aria-label="Copy referral code"
                  className="p-1.5 rounded-2xl text-gray-500 hover:text-[#6D4AE0] transition-colors"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-600">Share link</p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 text-xs rounded-2xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
                <button
                  onClick={() => void copyCode(shareUrl)}
                  aria-label="Copy share link"
                  className="px-3 py-2 rounded-2xl text-gray-600 hover:text-[#6D4AE0] transition-colors text-xs font-semibold"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Share via:</span>
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-black text-white hover:bg-gray-800 transition-colors">
                <Share2 className="w-3 h-3" /> X / Twitter
              </a>
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-700 text-white hover:bg-blue-800 transition-colors">
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
              <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-600 text-white hover:bg-green-700 transition-colors">
                <Share2 className="w-3 h-3" /> WhatsApp
              </a>
            </div>
          </>
        )}

        {earningsLoading && <Loader2 className="w-4 h-4 animate-spin text-[#6D4AE0]" />}
        {earnings && (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col bg-gray-50 rounded-2xl px-3 py-2 min-w-[80px]">
              <span className="text-xs text-gray-600">Total earned</span>
              <span className="text-lg font-bold text-gray-800">{fmtCredits(earnings.totalCredits)}</span>
              <span className="text-[10px] text-gray-600">credits</span>
            </div>
            <div className="flex flex-col bg-[#ecfdf5] rounded-2xl px-3 py-2 min-w-[80px]">
              <span className="text-xs text-gray-600">Qualified</span>
              <span className="text-lg font-bold text-[#065f46]">{earnings.qualifiedCount}</span>
            </div>
            <div className="flex flex-col bg-yellow-50 rounded-2xl px-3 py-2 min-w-[80px]">
              <span className="text-xs text-gray-600">Pending</span>
              <span className="text-lg font-bold text-yellow-700">{earnings.pendingCount}</span>
            </div>
            {earnings.flaggedCount > 0 && (
              <div className="flex flex-col bg-red-50 rounded-2xl px-3 py-2 min-w-[80px]">
                <span className="text-xs text-gray-600">Under review</span>
                <span className="text-lg font-bold text-red-600">{earnings.flaggedCount}</span>
              </div>
            )}
          </div>
        )}

        {earnings && earnings.referrals.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-gray-700">
              <thead>
                <tr className="text-gray-600 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {earnings.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 text-gray-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-1.5">
                      <span className={`border rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChipStyle(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-semibold text-green-700">+{fmtCredits(r.reward)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
        <p className="text-sm font-semibold text-gray-800">Have a referral code?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => { setRedeemInput(e.target.value); setRedeemError(''); setRedeemSuccess(false); }}
            placeholder="Enter code"
            aria-label="Referral code input"
            className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
            style={{ border: '1.5px solid #e3e0f0' }}
          />
          <button
            onClick={() => { if (redeemInput.trim()) redeemMutation.mutate(redeemInput.trim()); }}
            disabled={!redeemInput.trim() || redeemMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-white text-sm disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
          >
            {redeemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Apply
          </button>
        </div>
        {redeemError && (
          <p className="text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {redeemError}
          </p>
        )}
        {redeemSuccess && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            Referral code applied successfully!
          </p>
        )}
      </div>

      {!lbLoading && leaderboard.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-800">Referral Leaderboard</span>
            <span className="text-xs text-gray-600">(top 10)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {leaderboard.slice(0, 10).map((entry) => (
              <div key={entry.rank} className={`flex items-center gap-3 px-4 py-2.5 ${entry.userLabel.includes('(you)') ? 'bg-[#f5f2fd]' : ''}`}>
                <span className={`text-sm font-bold w-6 text-center ${entry.rank <= 3 ? 'text-amber-500' : 'text-gray-500'}`}>
                  {entry.rank}
                </span>
                <span className="flex-1 text-sm text-gray-700 truncate">{entry.userLabel}</span>
                <div className="text-right text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">{entry.qualifiedCount} referred</p>
                  <p>{fmtCredits(entry.totalCredits)} credits</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Budget edit (compact inline) ─────────────────────────────────────────────

function BudgetEditor({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: budget } = useQuery<BudgetState>({
    queryKey: ['wallet-budget'],
    queryFn: () => api.wallet.budget.get().then((r) => r.data),
  });

  const [limitDraft, setLimitDraft] = useState('');
  const [thresholdDraft, setThresholdDraft] = useState('80');
  const [hardCapDraft, setHardCapDraft] = useState(false);

  useEffect(() => {
    if (budget) {
      setLimitDraft(String(budget.monthlyLimit));
      setThresholdDraft(String(budget.alertThreshold));
      setHardCapDraft(budget.hardCap);
    }
  }, [budget]);

  const saveMutation = useMutation({
    mutationFn: () => api.wallet.budget.set({
      monthlyLimit: parseInt(limitDraft, 10) || 0,
      alertThreshold: parseInt(thresholdDraft, 10) || 80,
      hardCap: hardCapDraft,
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['wallet-budget'] }); onClose(); },
  });

  return (
    <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" style={{ color: '#374151' }} />
          <span className="text-sm font-semibold text-gray-800">Monthly Budget</span>
        </div>
        <button onClick={onClose} className="text-xs font-semibold text-gray-600 hover:text-gray-800">Cancel</button>
      </div>

      <div>
        <label htmlFor="budget-limit" className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly credit limit (0 = no limit)</label>
        <input
          id="budget-limit"
          type="number" min={0}
          value={limitDraft}
          onChange={(e) => setLimitDraft(e.target.value)}
          placeholder="e.g. 10000"
          className="w-full bg-white rounded-2xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
          style={{ border: '1.5px solid #e3e0f0' }}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alert at {thresholdDraft}% used</label>
        <input type="range" min={1} max={100} value={thresholdDraft}
          onChange={(e) => setThresholdDraft(e.target.value)}
          className="w-full" style={{ accentColor: '#6D4AE0' }} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={hardCapDraft}
          onChange={(e) => setHardCapDraft(e.target.checked)}
          className="rounded" style={{ accentColor: '#6D4AE0' }} />
        <span className="text-sm text-gray-700">Hard cap — block AI when limit reached</span>
      </label>

      {hardCapDraft && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Hard cap stops all AI usage when limit is hit.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' }}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Save budget
        </button>
      </div>
      {saveMutation.isError && <p className="text-xs text-red-500">{getErrorMessage(saveMutation.error) || 'Save failed'}</p>}
    </div>
  );
}

// ── Credit Expiry ─────────────────────────────────────────────────────────────

function CreditExpiry() {
  const { data: lots = [], isLoading } = useQuery<CreditLotRow[]>({
    queryKey: ['wallet-lots'],
    queryFn: () => api.wallet.lots().then((r) => r.data),
  });

  const BUCKET_LABELS: Record<string, string> = {
    trialCredits: 'Trial', promotionalCredits: 'Promo',
    bonusCredits: 'Bonus', referralCredits: 'Referral', purchasedCredits: 'Purchased',
  };

  const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

  if (!isLoading && lots.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #f0edf9' }}>
        <span className="text-sm font-semibold text-gray-800">Credit Expiry</span>
      </div>
      {isLoading && <div className="p-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#374151' }} /></div>}
      {lots.map((lot) => {
        const d = lot.expiresAt ? daysLeft(lot.expiresAt) : null;
        const urgStyle: React.CSSProperties = !d ? { background: '#ecfdf5', color: '#065f46' }
          : d <= 3 ? { background: '#fef2f2', color: '#b91c1c' }
          : d <= 7 ? { background: '#fff7ed', color: '#c2410c' }
          : { background: '#f3f4f6', color: '#4b5563' };
        return (
          <div key={lot.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f9f7ff' }}>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {fmt(lot.remaining)} <span className="text-gray-600 font-normal">of {fmt(lot.amount)}</span>{' '}
                {(BUCKET_LABELS[lot.bucket] ?? lot.bucket).toLowerCase()} credits
              </p>
              <p className="text-[11px] text-gray-600">granted {new Date(lot.createdAt).toLocaleDateString()}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={urgStyle}>
              {d == null ? 'never expires' : d === 0 ? 'expires today' : `${d}d left`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Subscription Manager ─────────────────────────────────────────────────────

function SubscriptionManager() {
  const qc = useQueryClient();
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: sub } = useQuery<{ plan: string; status: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; stripeSubscriptionId?: string }>({
    queryKey: ['subscription'],
    queryFn: () => api.billing.getSubscription().then((r) => r.data as never),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.billing.cancelSubscription(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      setCancelConfirm(false);
    },
  });

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await api.billing.getBillingPortal();
      const { url } = res.data;
      if (url) window.location.href = url;
    } finally {
      setPortalLoading(false);
    }
  }

  const hasSub = sub?.plan && sub.plan !== 'FREE';
  if (!hasSub) return null;

  const endsAt = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0edf9' }}>
        <span className="text-sm font-semibold text-gray-800">Subscription</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#374151' }}>
          {sub?.plan} · {sub?.status}
        </span>
      </div>
      <div className="p-5 space-y-4">
        {endsAt && (
          <p className="text-sm text-gray-600">
            {sub?.cancelAtPeriodEnd ? `Cancels on ${endsAt}` : `Renews ${endsAt}`}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#f3f4f6', color: '#374151', border: '1.5px solid #e3ddf8' }}
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Manage billing
          </button>

          {!sub?.cancelAtPeriodEnd && (
            <>
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-red-600 transition-all hover:bg-red-50"
                  style={{ border: '1.5px solid #fecaca' }}
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Cancel at period end?</span>
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {cancelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-800"
                  >
                    Keep it
                  </button>
                </div>
              )}
            </>
          )}

          {sub?.cancelAtPeriodEnd && (
            <span className="flex items-center gap-1.5 text-xs text-amber-700 px-3 py-1.5 rounded-2xl" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Cancellation scheduled — access until {endsAt}
            </span>
          )}
        </div>

        {cancelMutation.isError && (
          <p className="text-xs text-red-500">{getErrorMessage(cancelMutation.error) || 'Cancellation failed'}</p>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type WalletTab = 'credits' | 'plan' | 'referrals';

function WalletContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<WalletTab>('credits');
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [localeKey, setLocaleKey] = useState<string>('DEFAULT');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isAdmin] = useState(() =>
    typeof window !== 'undefined' &&
    ['superadmin', 'owner', 'admin'].includes(localStorage.getItem('cf_role') ?? '')
  );

  useEffect(() => { setLocaleKey(detectLocaleKey()); }, []);

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setSuccessMsg('Subscription upgraded! Your new plan is now active.');
      setTab('plan');
      router.replace('/wallet');
    } else if (searchParams.get('recharged') === 'true') {
      setSuccessMsg('Payment successful! Your credits have been added.');
      router.replace('/wallet');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-5">

        {/* Success toast */}
        {successMsg && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-2" style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-semibold text-emerald-800">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f0edf9,#e3ddf8)' }}>
            <Wallet className="w-5 h-5" style={{ color: '#374151' }} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Billing &amp; Wallet</h1>
            <p className="text-sm text-gray-600 mt-0.5">Manage your subscription and AI credits separately</p>
          </div>
        </div>

        {/* ── How billing works — shown once, above tabs ─────────────────── */}
        <div className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row gap-4" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
          <div className="flex-1 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f3f4f6' }}>
              <Sparkles className="w-4 h-4" style={{ color: '#374151' }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Subscription Plan</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">Controls which features you can access — projects, platforms, team seats. Billed monthly.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center text-gray-300 font-bold" aria-hidden="true">+</div>
          <div className="flex-1 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f3f4f6' }}>
              <Zap className="w-4 h-4" style={{ color: '#374151' }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">AI Credits</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">Fuel for every AI action — scripts, videos, captions. Your plan includes a monthly allowance; top up anytime for more.</p>
            </div>
          </div>
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 border-b border-[#ede9f8] pb-0">
          {([
            { id: 'credits',   label: 'AI Credits', icon: <Zap className="w-4 h-4" /> },
            { id: 'plan',      label: 'My Plan',    icon: <Sparkles className="w-4 h-4" /> },
            { id: 'referrals', label: 'Referrals',  icon: <Gift className="w-4 h-4" /> },
          ] as { id: WalletTab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button
              key={id}
              id={id === 'credits' ? 'credits-tab-btn' : undefined}
              type="button"
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-t-2xl transition-all -mb-px"
              style={tab === id
                ? { background: '#fff', border: '1.5px solid #ede9f8', borderBottom: '1.5px solid #fff', color: '#374151' }
                : { color: '#374151', border: '1.5px solid transparent' }
              }
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Credits tab ────────────────────────────────────────────────── */}
        {tab === 'credits' && (
          <div className="space-y-5">
            {/* Hero */}
            <FinancialHero
              onTopUp={() => document.getElementById('topup-section')?.scrollIntoView({ behavior: 'smooth' })}
              onSetBudget={() => setShowBudgetEditor(true)}
            />

            {/* Budget editor (inline, triggered from hero) */}
            {showBudgetEditor && (
              <BudgetEditor onClose={() => setShowBudgetEditor(false)} />
            )}

            {/* AI cost insights */}
            <div className="grid sm:grid-cols-2 gap-5">
              <CostByAction />
              <SpendForecast />
            </div>

            {/* Top-up */}
            <div id="topup-section">
              <SmartTopUp />
            </div>

            {/* Credit expiry */}
            <CreditExpiry />

            {/* Transaction history */}
            <TransactionHistory />
          </div>
        )}

        {/* ── Plan tab ───────────────────────────────────────────────────── */}
        {tab === 'plan' && (
          <div className="space-y-5">
            <PlansGrid />
            <SubscriptionManager />
            {isAdmin && <OwnerPanel />}
          </div>
        )}

        {/* ── Referrals tab ──────────────────────────────────────────────── */}
        {tab === 'referrals' && (
          <div className="space-y-5">
            <ReferralCenter />
          </div>
        )}

      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletContent />
    </Suspense>
  );
}
