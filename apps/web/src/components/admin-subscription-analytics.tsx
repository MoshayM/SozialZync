'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, Users, DollarSign, BarChart2,
  Target, Activity, Loader2, AlertTriangle, ShieldCheck,
  TrendingDown, Zap,
} from 'lucide-react';
import { StatCard, PastelBars, PastelDonut } from '@/components/stat-card';
import { api, type SubAnalyticsMetrics } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

type SubTab = 'revenue' | 'retention' | 'acquisition' | 'cashflow';

// ── Formatters ──────────────────────────────────────────────────────────────

const c  = (v: number) => `$${(v / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const cK = (v: number) => v >= 100_000 ? `$${((v / 100) / 1000).toFixed(1)}k` : c(v);
const pct  = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const usd  = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mult = (v: number) => `${v.toFixed(1)}×`;
const mo   = (v: number) => v >= 12 ? `${(v / 12).toFixed(1)}y` : `${v.toFixed(1)}mo`;

const MONTH_LABELS = ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last 30d'];
const PLAN_COLORS: Record<string, string> = { FREE: '#e5e7eb', STARTER: '#a78bfa', PRO: '#3b82f6', AGENCY: '#f59e0b' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      {children}
    </section>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-[#fefce8] border border-[#fde68a] rounded-xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">{children}</p>
    </div>
  );
}

// ── Sub-tab panels ───────────────────────────────────────────────────────────

function RevenueTab({ m }: { m: SubAnalyticsMetrics }) {
  const barData = m.revenueByMonth.map((v, i) => ({
    label: MONTH_LABELS[i] ?? `${i + 1}mo`,
    value: v,
    title: `${MONTH_LABELS[i] ?? `Month ${i + 1}`}: ${c(v)}`,
  }));

  const donutSegments = m.planDistribution
    .filter(p => p.plan !== 'FREE' || p.mrr > 0)
    .map(p => ({ label: p.plan, value: p.mrr, color: PLAN_COLORS[p.plan] ?? '#6b7280' }));

  return (
    <div className="space-y-6">
      <Section title="Headline KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard tone="lilac" icon={<BarChart2 className="w-5 h-5" />} label="ARR" value={cK(m.arr)} sub="Annual Recurring Revenue" />
          <StatCard tone="periwinkle" icon={<DollarSign className="w-5 h-5" />} label="MRR" value={cK(m.mrr)} sub="Monthly Recurring Revenue" />
          <StatCard tone="cream" icon={<Target className="w-5 h-5" />} label="ACV" value={cK(m.acv)} sub="Avg Contract Value / customer" />
          <StatCard tone="pink" icon={<TrendingUp className="w-5 h-5" />} label="LTV" value={cK(m.ltv)} sub="Lifetime Value (ARPU ÷ churn)" />
        </div>
      </Section>

      <Section title="Per-Customer Economics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard tone="lilac" icon={<Users className="w-5 h-5" />} label="ARPU" value={c(m.arpu)} sub="Avg Revenue Per User (30d)" />
          <StatCard tone="periwinkle" icon={<Activity className="w-5 h-5" />} label="ARPA" value={c(m.arpa)} sub="Avg Revenue Per Account" />
          <StatCard tone="cream" icon={<BarChart2 className="w-5 h-5" />} label="TCV" value={cK(m.tcv)} sub="Total Contract Value (≈ ACV)" />
          <StatCard tone="pink" icon={<Zap className="w-5 h-5" />} label="Run Rate" value={cK(m.runRate)} sub="ARR annualised run rate" />
        </div>
      </Section>

      <Section title="Customer Mix">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard tone="lilac" icon={<Users className="w-5 h-5" />} label="Total Users" value={m.totalUsers.toLocaleString()} sub="All registered accounts" />
          <StatCard tone="periwinkle" icon={<ShieldCheck className="w-5 h-5" />} label="Paying" value={m.payingUsers.toLocaleString()} sub="Active non-free subscriptions" />
          <StatCard tone="cream" icon={<Users className="w-5 h-5" />} label="Free Tier" value={m.freeUsers.toLocaleString()} sub="Free or unsubscribed" />
          <StatCard tone="pink" icon={<DollarSign className="w-5 h-5" />} label="Paid Mix" value={m.totalUsers > 0 ? pct(m.payingUsers / m.totalUsers) : '—'} sub="Paying ÷ total users" />
        </div>
      </Section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#e3ddf8]">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Monthly Revenue (last 6 months)</p>
          <PastelBars data={barData} maxBars={6} formatValue={cK} />
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#e3ddf8]">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">MRR by Plan</p>
          {donutSegments.length > 0
            ? <PastelDonut segments={donutSegments} />
            : <p className="text-sm text-gray-500 py-8 text-center">No paid subscriptions yet</p>
          }
        </div>
      </div>
    </div>
  );
}

function RetentionTab({ m }: { m: SubAnalyticsMetrics }) {
  const nrrGood = m.nrr >= 1;
  const grrGood = m.grr >= 0.9;

  return (
    <div className="space-y-6">
      <Section title="Churn Metrics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            tone="pink"
            icon={<TrendingDown className="w-5 h-5" />}
            label="Monthly Churn"
            value={pct(m.monthlyChurnRate)}
            sub="Cancelled ÷ (active + cancelled) 30d"
            subClassName={m.monthlyChurnRate > 0.05 ? 'text-red-600 font-bold' : 'text-green-600'}
          />
          <StatCard
            tone="pink"
            icon={<TrendingDown className="w-5 h-5" />}
            label="Annual Churn"
            value={pct(m.annualChurnRate)}
            sub="Annualised from monthly"
            subClassName={m.annualChurnRate > 0.5 ? 'text-red-600 font-bold' : 'text-gray-600'}
          />
          <StatCard
            tone="cream"
            icon={<DollarSign className="w-5 h-5" />}
            label="Revenue Churn"
            value={pct(m.revenueChurnRate)}
            sub="Churned MRR ÷ prior MRR"
            subClassName={m.revenueChurnRate > 0.05 ? 'text-red-600' : 'text-gray-600'}
          />
          <StatCard
            tone="lilac"
            icon={<Activity className="w-5 h-5" />}
            label="Lost (30d)"
            value={m.lostCustomers30d.toLocaleString()}
            sub="Cancelled subscriptions"
          />
        </div>
      </Section>

      <Section title="Retention & Net Revenue">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            tone={nrrGood ? 'periwinkle' : 'pink'}
            icon={<TrendingUp className="w-5 h-5" />}
            label="NRR"
            value={pct(m.nrr)}
            sub="Net Revenue Retention (>100% = expansion)"
            subClassName={nrrGood ? 'text-green-600 font-bold' : 'text-red-600'}
          />
          <StatCard
            tone={grrGood ? 'periwinkle' : 'pink'}
            icon={<ShieldCheck className="w-5 h-5" />}
            label="GRR"
            value={pct(m.grr)}
            sub="Gross Revenue Retention (no upsell)"
            subClassName={grrGood ? 'text-green-600' : 'text-red-600'}
          />
          <StatCard
            tone="lilac"
            icon={<ShieldCheck className="w-5 h-5" />}
            label="Retention Rate"
            value={pct(m.customerRetentionRate)}
            sub="1 − monthly churn"
          />
          <StatCard
            tone="cream"
            icon={<Activity className="w-5 h-5" />}
            label="Avg Lifespan"
            value={mo(m.avgCustomerLifespanMonths)}
            sub="1 ÷ monthly churn rate"
          />
        </div>
      </Section>

      {m.cohortRetention.length > 0 && (
        <Section title="Cohort Retention">
          <div className="bg-white rounded-2xl border border-[#e3ddf8] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#f9fafb]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Cohort</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Signed up</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Still active</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Retention</th>
                </tr>
              </thead>
              <tbody>
                {m.cohortRetention.map((row, i) => (
                  <tr key={row.cohortMonth} className={i % 2 === 0 ? 'bg-white' : 'bg-[#faf9ff]'}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{row.cohortMonth}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{row.initialCount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{row.activeCount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold"
                      style={{ color: row.retentionRate >= 0.8 ? '#16a34a' : row.retentionRate >= 0.5 ? '#d97706' : '#dc2626' }}>
                      {pct(row.retentionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function AcquisitionTab({ m }: { m: SubAnalyticsMetrics }) {
  const goodRatio = m.ltvCacRatio !== null && m.ltvCacRatio >= 3;

  return (
    <div className="space-y-6">
      {!m.marketingSpendConfigured && (
        <InfoNote>
          Set <code className="bg-amber-100 px-1 rounded text-[11px]">MONTHLY_MARKETING_SPEND_USD</code> on the server to unlock
          CAC, CAC Payback Period, and LTV:CAC ratio. Without it these metrics return null.
        </InfoNote>
      )}

      <Section title="Customer Flow (last 30 days)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard tone="periwinkle" icon={<Users className="w-5 h-5" />} label="New Paying" value={m.newCustomers30d.toLocaleString()} sub="New non-free subscriptions" />
          <StatCard tone="pink" icon={<TrendingDown className="w-5 h-5" />} label="Lost Paying" value={m.lostCustomers30d.toLocaleString()} sub="Cancellations" />
          <StatCard
            tone={m.newCustomers30d > m.lostCustomers30d ? 'periwinkle' : 'pink'}
            icon={<Activity className="w-5 h-5" />}
            label="Net Growth"
            value={(m.newCustomers30d - m.lostCustomers30d >= 0 ? '+' : '') + (m.newCustomers30d - m.lostCustomers30d)}
            sub="New minus lost"
          />
          <StatCard tone="lilac" icon={<Users className="w-5 h-5" />} label="Free Tier" value={m.freeUsers.toLocaleString()} sub="Potential upsell pool" />
        </div>
      </Section>

      <Section title="Unit Economics">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            tone="cream"
            icon={<Target className="w-5 h-5" />}
            label="CAC"
            value={m.cac !== null ? usd(m.cac) : '—'}
            sub={m.cac !== null ? 'Marketing spend ÷ new customers' : 'Set MONTHLY_MARKETING_SPEND_USD'}
            subClassName={m.cac === null ? 'text-amber-600' : 'text-gray-600'}
          />
          <StatCard
            tone="cream"
            icon={<Activity className="w-5 h-5" />}
            label="CAC Payback"
            value={m.cacPaybackPeriodMonths !== null ? mo(m.cacPaybackPeriodMonths) : '—'}
            sub="Months to recover acquisition cost"
            subClassName={m.cacPaybackPeriodMonths === null ? 'text-amber-600' : m.cacPaybackPeriodMonths <= 12 ? 'text-green-600' : 'text-red-600'}
          />
          <StatCard
            tone={goodRatio ? 'periwinkle' : 'lilac'}
            icon={<TrendingUp className="w-5 h-5" />}
            label="LTV : CAC"
            value={m.ltvCacRatio !== null ? mult(m.ltvCacRatio) : '—'}
            sub="Target ≥ 3× for healthy unit economics"
            subClassName={m.ltvCacRatio === null ? 'text-amber-600' : goodRatio ? 'text-green-600 font-bold' : 'text-red-600'}
          />
        </div>
      </Section>

      <Section title="Market Sizing (TAM estimate)">
        <div className="bg-white rounded-2xl border border-[#e3ddf8] px-5 py-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            TAM (Total Addressable Market) is a strategic estimate and cannot be computed automatically from subscription data.
            To display TAM, SAM, and SOM figures, set <code className="bg-gray-100 px-1 rounded">MARKET_SIZE_TAM_USD</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">MARKET_SIZE_SAM_USD</code>, and{' '}
            <code className="bg-gray-100 px-1 rounded">MARKET_SIZE_SOM_USD</code> environment variables on the server.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {(['TAM', 'SAM', 'SOM'] as const).map(k => (
              <div key={k} className="rounded-xl bg-[#f9fafb] border border-[#e3ddf8] px-4 py-3 text-center">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{k}</p>
                <p className="text-lg font-extrabold text-gray-300 mt-0.5">—</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {k === 'TAM' ? 'Total Addressable Market' : k === 'SAM' ? 'Serviceable Addressable Market' : 'Serviceable Obtainable Market'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function CashflowTab({ m }: { m: SubAnalyticsMetrics }) {
  const netGrowthGood = m.netMrrGrowthRate > 0;

  const mrrMovements = [
    { label: 'New MRR', value: m.newMrr, color: '#10b981' },
    { label: 'Churned MRR', value: m.churnedMrr, color: '#f43f5e' },
    { label: 'Expansion', value: m.expansionMrr, color: '#3b82f6' },
    { label: 'Contraction', value: m.contractionMrr, color: '#f97316' },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-6">
      <Section title="MRR Movements (last 30 days)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard tone="periwinkle" icon={<TrendingUp className="w-5 h-5" />} label="New MRR" value={cK(m.newMrr)} sub="From new subscribers" />
          <StatCard tone="pink" icon={<TrendingDown className="w-5 h-5" />} label="Churned MRR" value={cK(m.churnedMrr)} sub="From cancellations" />
          <StatCard tone="cream" icon={<Activity className="w-5 h-5" />} label="Expansion MRR" value={cK(m.expansionMrr)} sub="Upsells / upgrades" />
          <StatCard
            tone={netGrowthGood ? 'periwinkle' : 'pink'}
            icon={<BarChart2 className="w-5 h-5" />}
            label="Net MRR Growth"
            value={pct(m.netMrrGrowthRate)}
            sub="(Current MRR − Prior MRR) ÷ Prior MRR"
            subClassName={netGrowthGood ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}
          />
        </div>
      </Section>

      <Section title="Cost & Burn">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard tone="cream" icon={<Zap className="w-5 h-5" />} label="AI Cost (30d)" value={usd(m.aiCostUsd)} sub="Token spend (non-cached)" />
          <StatCard tone="cream" icon={<Activity className="w-5 h-5" />} label="AI Burn Rate" value={usd(m.burnRateUsd)} sub="Variable AI cost component" />
          <StatCard tone="lilac" icon={<DollarSign className="w-5 h-5" />} label="MRR" value={cK(m.mrr)} sub="Current Monthly Recurring Revenue" />
          <StatCard tone="periwinkle" icon={<BarChart2 className="w-5 h-5" />} label="ARR" value={cK(m.arr)} sub="MRR × 12 annualised" />
        </div>
        <InfoNote>
          Burn Rate shown here is the <strong>AI token cost</strong> component only. Total cash burn includes infrastructure,
          salaries, and other opex. Add <code className="bg-amber-100 px-1 rounded text-[11px]">MONTHLY_INFRA_COST_USD</code> and{' '}
          <code className="bg-amber-100 px-1 rounded text-[11px]">MONTHLY_OPEX_USD</code> to the server to compute full burn rate and runway.
        </InfoNote>
      </Section>

      <Section title="Deferred Revenue">
        <div className="bg-white rounded-2xl border border-[#e3ddf8] px-5 py-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Deferred revenue (pre-paid annual contracts, committed but unearned) requires a billing event log
            distinguishing payment date from service period start/end. The current schema uses monthly billing;
            deferred revenue is effectively zero for monthly-only plans.
            Implement annual billing with <code className="bg-gray-100 px-1 rounded">billingCycleAnchor</code> and{' '}
            <code className="bg-gray-100 px-1 rounded">billingPeriod</code> fields on the Subscription model to enable this metric.
          </p>
        </div>
      </Section>

      {mrrMovements.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#e3ddf8]">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">MRR Waterfall</p>
          <PastelDonut segments={mrrMovements} />
        </div>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function AdminSubscriptionAnalytics() {
  const [tab, setTab] = useState<SubTab>('revenue');
  const [metrics, setMetrics] = useState<SubAnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.subscriptionAnalytics();
      setMetrics(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'revenue',     label: 'Revenue & ARR',     icon: <DollarSign className="w-4 h-4" /> },
    { id: 'retention',   label: 'Retention & Churn', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'acquisition', label: 'Acquisition & CAC', icon: <Target className="w-4 h-4" /> },
    { id: 'cashflow',    label: 'Cashflow & Burn',   icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="p-5 lg:p-7 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Subscription Analytics</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            SaaS KPIs — revenue, retention, acquisition efficiency, and cashflow
            {metrics?.dataWindow ? ` · ${metrics.dataWindow}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void load(); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 transition-colors shrink-0"
          style={{ border: '1.5px solid #e3ddf8' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Inner tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-2xl transition-all"
            style={tab === t.id
              ? { background: '#374151', color: '#ffffff', border: '2px solid #374151' }
              : { background: '#faf9ff', color: '#374151', border: '1.5px solid #e3ddf8' }
            }
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading metrics…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Failed to load metrics</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => { void load(); }}
            className="ml-auto text-xs font-semibold text-red-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && metrics && (
        <>
          {tab === 'revenue'     && <RevenueTab m={metrics} />}
          {tab === 'retention'   && <RetentionTab m={metrics} />}
          {tab === 'acquisition' && <AcquisitionTab m={metrics} />}
          {tab === 'cashflow'    && <CashflowTab m={metrics} />}
          <p className="text-[10px] text-gray-400 text-right">
            Last computed: {new Date(metrics.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
