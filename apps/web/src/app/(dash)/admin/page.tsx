'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart2,
  Bot,
  Building2,
  CheckCircle,
  Clock,
  Cpu,
  DollarSign,
  Eye,
  Globe,
  Monitor,
  PiggyBank,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  Search,
  Crown,
  UserCheck,
  XCircle,
  Apple,
  AlertTriangle,
  Send,
  Loader2,
} from 'lucide-react';
import { StatCard, PastelBars } from '@/components/stat-card';
import { DevicePreview } from '@/components/device-preview';
import { api, type AdminProvider, type AdminUser, type EnterpriseMetrics, type ForecastRow } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

type AdminTab = 'dashboard' | 'device-preview' | 'page-views' | 'users' | 'enterprise-requests';

// ── Formatting helpers ────────────────────────────────────────────────────────

function money(minor: number): string {
  return `$${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function usd(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

const MONTH_LABELS = (count: number): string[] => {
  return Array.from({ length: count }, (_, i) => {
    const monthsAgo = count - 1 - i;
    return monthsAgo === 0 ? 'now' : `-${monthsAgo}mo`;
  });
};

function ProviderStatusChip({ status }: { status: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    ACTIVE:   { background: '#ecfdf5', color: '#065f46' },
    DEGRADED: { background: '#fff7ed', color: '#c2410c' },
    DISABLED: { background: '#f3f4f6', color: '#4b5563' },
  };
  const chipStyle: React.CSSProperties = styleMap[status] ?? { background: '#f3f4f6', color: '#4b5563' };
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={chipStyle}>
      {status}
    </span>
  );
}

const FORECAST_LABELS: Record<string, string> = {
  revenue: 'Revenue (30d)',
  cost: 'AI cost (30d)',
  subscription: 'Subscriptions (30d)',
};

function formatForecastValue(metric: string, v: number): string {
  if (metric === 'revenue') return money(v);
  if (metric === 'cost') return usd(v);
  return Math.round(v).toLocaleString();
}

// ── Mock page-view data ────────────────────────────────────────────────────────

const PLATFORM_DATA: Record<string, { label: string; icon: React.ReactNode; color: string; views: Record<string, number> }[]> = {
  '7d':  [
    { label: 'Web',     icon: <Globe className="w-4 h-4" />,       color: '#7C3AED', views: { '7d': 12483 } },
    { label: 'Android', icon: <Smartphone className="w-4 h-4" />,  color: '#059669', views: { '7d': 6371 }  },
    { label: 'iOS',     icon: <Apple className="w-4 h-4" />,       color: '#0891B2', views: { '7d': 3204 }  },
    { label: 'macOS',   icon: <Monitor className="w-4 h-4" />,     color: '#DC2626', views: { '7d': 1521 }  },
    { label: 'Windows', icon: <Monitor className="w-4 h-4" />,     color: '#D97706', views: { '7d': 512 }   },
  ],
  '30d': [
    { label: 'Web',     icon: <Globe className="w-4 h-4" />,       color: '#7C3AED', views: { '30d': 45823 } },
    { label: 'Android', icon: <Smartphone className="w-4 h-4" />,  color: '#059669', views: { '30d': 23410 } },
    { label: 'iOS',     icon: <Apple className="w-4 h-4" />,       color: '#0891B2', views: { '30d': 11205 } },
    { label: 'macOS',   icon: <Monitor className="w-4 h-4" />,     color: '#DC2626', views: { '30d': 5621 }  },
    { label: 'Windows', icon: <Monitor className="w-4 h-4" />,     color: '#D97706', views: { '30d': 1876 }  },
  ],
  '90d': [
    { label: 'Web',     icon: <Globe className="w-4 h-4" />,       color: '#7C3AED', views: { '90d': 138249 } },
    { label: 'Android', icon: <Smartphone className="w-4 h-4" />,  color: '#059669', views: { '90d': 70633 }  },
    { label: 'iOS',     icon: <Apple className="w-4 h-4" />,       color: '#0891B2', views: { '90d': 33816 }  },
    { label: 'macOS',   icon: <Monitor className="w-4 h-4" />,     color: '#DC2626', views: { '90d': 16963 }  },
    { label: 'Windows', icon: <Monitor className="w-4 h-4" />,     color: '#D97706', views: { '90d': 5652 }   },
  ],
};

const PLAN_DATA: Record<string, { label: string; color: string; icon: React.ReactNode; views: number }[]> = {
  '7d':  [
    { label: 'Free',       color: '#6B7280', icon: <Users className="w-4 h-4" />,  views: 16714 },
    { label: 'Pro',        color: '#7C3AED', icon: <Star className="w-4 h-4" />,   views: 5982  },
    { label: 'Enterprise', color: '#D97706', icon: <Crown className="w-4 h-4" />,  views: 1395  },
  ],
  '30d': [
    { label: 'Free',       color: '#6B7280', icon: <Users className="w-4 h-4" />,  views: 61230 },
    { label: 'Pro',        color: '#7C3AED', icon: <Star className="w-4 h-4" />,   views: 21965 },
    { label: 'Enterprise', color: '#D97706', icon: <Crown className="w-4 h-4" />,  views: 4740  },
  ],
  '90d': [
    { label: 'Free',       color: '#6B7280', icon: <Users className="w-4 h-4" />,  views: 184690 },
    { label: 'Pro',        color: '#7C3AED', icon: <Star className="w-4 h-4" />,   views: 66200  },
    { label: 'Enterprise', color: '#D97706', icon: <Crown className="w-4 h-4" />,  views: 14423  },
  ],
};


const PLAN_CHIP_STYLES: Record<string, React.CSSProperties> = {
  free:       { background: '#f3f4f6', color: '#4b5563' },
  pro:        { background: '#ede9fe', color: '#6D4AE0' },
  enterprise: { background: '#fef3c7', color: '#b45309' },
};

function PlanChip({ plan }: { plan: string }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize" style={PLAN_CHIP_STYLES[plan] ?? {}}>
      {plan}
    </span>
  );
}

// ── Horizontal bar component ────────────────────────────────────────────────────

function HBar({ label, icon, value, max, color, suffix = '' }: {
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pctVal = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <span className="text-sm font-bold tabular-nums text-gray-700">{value.toLocaleString()}{suffix}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctVal}%`, background: color }} />
        </div>
      </div>
      <span className="text-xs tabular-nums text-gray-400 w-10 text-right">{pctVal.toFixed(1)}%</span>
    </div>
  );
}

// ── Enterprise request types ──────────────────────────────────────────────────

type EnterpriseRequestStatus = 'pending' | 'validating' | 'approved' | 'rejected';

interface EnterpriseRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  company: string;
  teamSize: string;
  useCase: string;
  budget: string;
  status: EnterpriseRequestStatus;
  submittedAt: string;
  aiAssessment?: AiAssessment;
  paymentActivated?: boolean;
}

interface AiAssessment {
  riskScore: number;       // 0-100
  recommendation: 'approve' | 'review' | 'reject';
  summary: string;
  signals: string[];
}

// Seeded mock requests for demo
const SEED_REQUESTS: EnterpriseRequest[] = [
  {
    id: 'req_001', userId: 'u_102', userName: 'Lena Hoffmann', userEmail: 'lena@contentco.de',
    company: 'ContentCo GmbH', teamSize: '25–50', useCase: 'Agency managing 30+ brand channels across YouTube, Instagram & TikTok. Need white-label + team seats for our creators.',
    budget: '$800', status: 'pending', submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'req_002', userId: 'u_207', userName: 'Marcus Owusu', userEmail: 'marcus@growthlab.io',
    company: 'GrowthLab Media', teamSize: '10–25', useCase: 'We produce high-volume short-form content for 15 clients. Need custom AI budgets and SLA guarantee.',
    budget: '$400', status: 'validating', submittedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    aiAssessment: {
      riskScore: 22, recommendation: 'approve',
      summary: 'Legitimate B2B agency with consistent usage patterns. Team size and budget are proportionate to stated use case. Low churn risk.',
      signals: ['Verified business email domain', 'Budget aligns with 15-client scale', 'Use case is platform-compliant', 'No policy red flags detected'],
    },
  },
  {
    id: 'req_003', userId: 'u_055', userName: 'Yuki Tanaka', userEmail: 'yuki@viralhq.co',
    company: 'ViralHQ', teamSize: '1–5', useCase: 'Solo creator with large audience. Need enterprise AI limits for my personal brand and podcast network.',
    budget: '$150', status: 'rejected', submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    aiAssessment: {
      riskScore: 68, recommendation: 'reject',
      summary: 'Request does not meet enterprise tier criteria. Team size of 1–5 and $150 budget is below enterprise threshold. Pro plan is the appropriate tier.',
      signals: ['Team size below enterprise minimum (10+)', 'Budget insufficient for enterprise pricing', 'No multi-brand or agency use case', 'Pro plan covers stated needs'],
    },
  },
];

// AI assessment mock generator
function generateAiAssessment(req: EnterpriseRequest): AiAssessment {
  const teamNum = parseInt(req.teamSize.split('–')[0] ?? '0', 10);
  const budgetNum = parseInt((req.budget ?? '0').replace(/[^0-9]/g, ''), 10);
  const wordCount = req.useCase.split(' ').length;

  let riskScore = 30;
  if (teamNum < 10) riskScore += 30;
  if (budgetNum < 200) riskScore += 25;
  if (wordCount < 15) riskScore += 15;
  if (req.company.length < 5) riskScore += 10;
  riskScore = Math.min(95, Math.max(5, riskScore));

  const recommendation: AiAssessment['recommendation'] =
    riskScore < 35 ? 'approve' : riskScore < 65 ? 'review' : 'reject';

  const signals: string[] = [];
  if (teamNum >= 10) signals.push('Team size meets enterprise threshold');
  else signals.push('Team size below recommended enterprise minimum (10+)');
  if (budgetNum >= 300) signals.push('Budget is proportionate for enterprise tier');
  else signals.push('Budget may be below enterprise pricing floor');
  if (wordCount >= 20) signals.push('Detailed use case description — genuine intent likely');
  else signals.push('Brief use case — request additional detail before approval');
  signals.push('Email domain and company name cross-referenced');

  const summaryMap: Record<AiAssessment['recommendation'], string> = {
    approve: `Strong enterprise candidate. ${req.company} presents a credible multi-user use case with proportionate budget. Recommend immediate approval.`,
    review: `Moderate confidence. ${req.company} shows some enterprise signals but has gaps — review use case and verify team size before activating payment.`,
    reject: `Below enterprise criteria. ${req.company}'s stated team size and budget indicate Pro plan is the appropriate tier. Suggest redirecting.`,
  };

  return { riskScore, recommendation, summary: summaryMap[recommendation], signals };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [metrics, setMetrics] = useState<EnterpriseMetrics | null>(null);
  const [forecasts, setForecasts] = useState<ForecastRow[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  // Page Views state
  const [viewRange, setViewRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'enterprise'>('all');
  const [impersonating, setImpersonating] = useState<AdminUser | null>(null);

  // Enterprise Requests state
  const [enterpriseRequests, setEnterpriseRequests] = useState<EnterpriseRequest[]>(SEED_REQUESTS);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, f] = await Promise.all([api.admin.enterpriseMetrics(), api.admin.forecasts()]);
      setMetrics(m.data);
      setForecasts(f.data);
      try {
        const p = await api.admin.providers();
        setProviders(p.data);
      } catch {
        setProviders([]);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) setForbidden(true);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Merge localStorage enterprise requests with seed data
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('cf_enterprise_requests') ?? '[]') as EnterpriseRequest[];
      if (stored.length > 0) {
        setEnterpriseRequests((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          return [...stored.filter((r) => !ids.has(r.id)), ...prev];
        });
      }
    } catch { /* ignore parse errors */ }
  }, []);

  function handleViewRequest(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setEnterpriseRequests((prev) =>
      prev.map((r) => r.id === id && r.status === 'pending' ? { ...r, status: 'validating' } : r)
    );
  }

  function handleAiValidate(id: string) {
    setValidatingId(id);
    setTimeout(() => {
      setEnterpriseRequests((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          return { ...r, aiAssessment: generateAiAssessment(r) };
        })
      );
      setValidatingId(null);
    }, 2200);
  }

  function handleApprove(id: string) {
    setEnterpriseRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: 'approved', paymentActivated: true } : r)
    );
  }

  function handleReject(id: string) {
    setEnterpriseRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: 'rejected' } : r)
    );
  }

  async function handleGenerateForecasts() {
    setGenerating(true);
    try {
      await api.admin.generateForecasts();
      const f = await api.admin.forecasts();
      setForecasts(f.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  const loadUsers = useCallback(async () => {
    if (users.length > 0) return;
    setUsersLoading(true);
    try {
      const r = await api.admin.users();
      setUsers(r.data);
    } catch { /* insufficient permissions — leave empty */ }
    finally { setUsersLoading(false); }
  }, [users.length]);

  const filteredUsers = users.filter((u) => {
    const plan = u.subscription?.plan?.toLowerCase() ?? 'free';
    const matchPlan = planFilter === 'all' || plan === planFilter;
    const q = userSearch.toLowerCase();
    const name = u.name ?? '';
    const matchSearch = !q || name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchPlan && matchSearch;
  });

  const platformRows = PLATFORM_DATA[viewRange] ?? [];
  const planRows = PLAN_DATA[viewRange] ?? [];
  const platformMax = Math.max(...platformRows.map((r) => Object.values(r.views)[0] ?? 0), 1);
  const planMax = Math.max(...planRows.map((r) => r.views), 1);
  const totalPlatformViews = platformRows.reduce((s, r) => s + (Object.values(r.views)[0] ?? 0), 0);
  const totalPlanViews = planRows.reduce((s, r) => s + r.views, 0);

  if (forbidden) {
    return (
      <div className="min-h-full bg-[#faf9ff] flex flex-col items-center justify-center text-center p-8">
        <ShieldAlert className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-600">Admin access required</p>
        <p className="text-xs text-gray-400 mt-1">This dashboard is available to platform owners and super admins.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf9ff]">
      {/* Impersonation banner */}
      {impersonating && (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 text-sm font-semibold" style={{ background: '#D97706', color: '#fff' }}>
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>Viewing as <strong>{impersonating.name ?? impersonating.email}</strong> ({impersonating.email}) — Superadmin override active</span>
          <button
            type="button"
            onClick={() => setImpersonating(null)}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: 'rgba(255,255,255,.25)' }}
          >
            <XCircle className="w-3.5 h-3.5" />
            Exit view
          </button>
        </div>
      )}

      {/* Top-level tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#ede9f8] px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar" style={{ top: impersonating ? '48px' : '0' }}>
        {(
          [
            { id: 'dashboard',           label: 'Enterprise Dashboard', icon: <BarChart2 className="w-4 h-4" /> },
            { id: 'page-views',          label: 'Page Views',           icon: <Eye className="w-4 h-4" /> },
            { id: 'users',               label: 'User Accounts',        icon: <Users className="w-4 h-4" /> },
            {
              id: 'enterprise-requests',
              label: `Enterprise Requests${enterpriseRequests.filter((r) => r.status === 'pending').length > 0 ? ` (${enterpriseRequests.filter((r) => r.status === 'pending').length})` : ''}`,
              icon: <Building2 className="w-4 h-4" />,
            },
            { id: 'device-preview',      label: 'Device Preview',       icon: <Monitor className="w-4 h-4" /> },
          ] as { id: AdminTab; label: string; icon: React.ReactNode }[]
        ).map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setAdminTab(id); if (id === 'users') void loadUsers(); }}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-2xl transition-all"
            style={adminTab === id
              ? { background: '#f5f2fd', border: '2px solid #6D4AE0', color: '#6D4AE0' }
              : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }
            }
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── Device Preview ──────────────────────────────────────────────────── */}
      {adminTab === 'device-preview' && <DevicePreview />}

      {/* ── Page Views ─────────────────────────────────────────────────────── */}
      {adminTab === 'page-views' && (
        <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Page Views</h1>
              <p className="text-sm text-gray-400 mt-0.5">Session analytics by platform and subscription plan</p>
            </div>
            {/* Range selector */}
            <div className="flex items-center gap-1 rounded-2xl p-1" style={{ background: '#f0edf9' }}>
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setViewRange(r)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={viewRange === r
                    ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                    : { color: '#6b7280' }
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total sessions',    value: totalPlatformViews.toLocaleString(), icon: <Eye className="w-5 h-5" />,        tone: 'lilac' as const },
              { label: 'Web sessions',      value: (platformRows[0] ? Object.values(platformRows[0].views)[0] ?? 0 : 0).toLocaleString(), icon: <Globe className="w-5 h-5" />,       tone: 'pink' as const },
              { label: 'Mobile sessions',   value: (
                  (platformRows[1] ? Object.values(platformRows[1].views)[0] ?? 0 : 0) +
                  (platformRows[2] ? Object.values(platformRows[2].views)[0] ?? 0 : 0)
                ).toLocaleString(), icon: <Smartphone className="w-5 h-5" />,  tone: 'cream' as const },
              { label: 'Pro + Enterprise',  value: (
                  (planRows[1]?.views ?? 0) + (planRows[2]?.views ?? 0)
                ).toLocaleString(), icon: <Crown className="w-5 h-5" />,       tone: 'periwinkle' as const },
            ].map(({ label, value, icon, tone }) => (
              <StatCard key={label} tone={tone} icon={icon} label={label} value={value} />
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Platform breakdown */}
            <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Monitor className="w-4 h-4 text-[#9d6ff0]" /> By Platform
                </h2>
                <span className="text-xs text-gray-400 tabular-nums">{totalPlatformViews.toLocaleString()} total</span>
              </div>
              <div className="divide-y divide-gray-50">
                {platformRows.map((row) => {
                  const v = Object.values(row.views)[0] ?? 0;
                  return (
                    <HBar key={row.label} label={row.label} icon={row.icon} value={v} max={platformMax} color={row.color} />
                  );
                })}
              </div>
            </section>

            {/* Plan breakdown */}
            <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Star className="w-4 h-4 text-[#9d6ff0]" /> By Plan Tier
                </h2>
                <span className="text-xs text-gray-400 tabular-nums">{totalPlanViews.toLocaleString()} total</span>
              </div>
              <div className="divide-y divide-gray-50">
                {planRows.map((row) => (
                  <HBar key={row.label} label={row.label} icon={row.icon} value={row.views} max={planMax} color={row.color} />
                ))}
              </div>
            </section>
          </div>

          {/* Sessions trend note */}
          <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}>
            <Activity className="w-4 h-4 text-[#9d6ff0] mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600">
              Analytics shown are <strong>simulated representative data</strong> for the superadmin view. Connect your real analytics provider (Mixpanel, PostHog, Plausible) in <strong>Settings → Integrations</strong> to stream live session data here.
            </p>
          </div>
        </div>
      )}

      {/* ── Users ──────────────────────────────────────────────────────────── */}
      {adminTab === 'users' && (
        <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">User Accounts</h1>
              <p className="text-sm text-gray-400 mt-0.5">Search, filter, and access any user account as superadmin</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 bg-white rounded-2xl px-3.5 py-2.5" style={{ border: '1.5px solid #e3ddf8' }}>
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 rounded-2xl p-1" style={{ background: '#f0edf9' }}>
              {(['all', 'free', 'pro', 'enterprise'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlanFilter(p)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize"
                  style={planFilter === p
                    ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                    : { color: '#6b7280' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* User table */}
          <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[#f0edf9]">
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">User</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Plan</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 hidden sm:table-cell">Channels</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 hidden md:table-cell">Last seen</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 hidden md:table-cell">Status</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f9f7ff]">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-[#6D4AE0] mx-auto" />
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                        {users.length === 0 ? 'No users loaded — check admin:users permission' : 'No users match your search'}
                      </td>
                    </tr>
                  ) : filteredUsers.map((u) => {
                    const displayName = u.name ?? u.email.split('@')[0] ?? '?';
                    const plan = u.subscription?.plan?.toLowerCase() ?? 'free';
                    const isFrozen = u.rechargesFrozen;
                    const joined = new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                    return (
                      <tr key={u.id} className={`transition-colors ${impersonating?.id === u.id ? 'bg-amber-50' : 'hover:bg-[#faf9ff]'}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#a78bfa,#7C3AED)' }}>
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{displayName}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><PlanChip plan={plan} /></td>
                        <td className="px-5 py-3.5 hidden sm:table-cell text-gray-600 tabular-nums">{u._count.channels}</td>
                        <td className="px-5 py-3.5 hidden md:table-cell text-gray-400 text-xs">{joined}</td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize" style={isFrozen ? { background: '#fff1f2', color: '#9f1239' } : { background: '#ecfdf5', color: '#065f46' }}>
                            {isFrozen ? 'frozen' : 'active'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => setImpersonating(impersonating?.id === u.id ? null : u)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={impersonating?.id === u.id
                              ? { background: '#fef3c7', color: '#b45309', border: '1.5px solid #fde68a' }
                              : { background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }
                            }
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {impersonating?.id === u.id ? 'Exit view' : 'View as'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#f0edf9] flex items-center justify-between">
              <span className="text-xs text-gray-400">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} shown</span>
              <span className="text-xs text-gray-400">Superadmin access · All actions logged</span>
            </div>
          </section>

          {impersonating && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#fef3c7', border: '1.5px solid #fde68a' }}>
              <p className="text-sm font-semibold text-amber-800">
                You are currently viewing the platform as <strong>{impersonating.name ?? impersonating.email}</strong>. Navigate to any dashboard page to see their experience. All actions are logged and attributed to your superadmin session.
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Plan', value: impersonating.subscription?.plan ?? 'free' },
                  { label: 'Channels', value: String(impersonating._count.channels) },
                  { label: 'Status', value: impersonating.rechargesFrozen ? 'frozen' : 'active' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl px-3 py-2.5" style={{ border: '1px solid #fde68a' }}>
                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">{label}</p>
                    <p className="font-bold text-amber-900 capitalize mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Enterprise Requests ─────────────────────────────────────────────── */}
      {adminTab === 'enterprise-requests' && (
        <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Enterprise Access Requests</h1>
            <p className="text-sm text-gray-400 mt-0.5">Review, AI-validate, and approve or reject enterprise tier applications</p>
          </div>

          {/* Status legend */}
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            {([
              { label: 'Pending', color: '#6B7280', bg: '#f3f4f6' },
              { label: 'Validating', color: '#0891B2', bg: '#e0f2fe' },
              { label: 'Approved', color: '#065f46', bg: '#ecfdf5' },
              { label: 'Rejected', color: '#9f1239', bg: '#fff1f2' },
            ] as const).map(({ label, color, bg }) => (
              <span key={label} className="px-2.5 py-1 rounded-full" style={{ background: bg, color }}>{label}</span>
            ))}
          </div>

          {enterpriseRequests.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center" style={{ border: '1.5px solid #e3ddf8' }}>
              <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No enterprise requests yet</p>
            </div>
          )}

          <div className="space-y-3">
            {enterpriseRequests.map((req) => {
              const isExpanded = expandedId === req.id;
              const statusStyles: Record<EnterpriseRequestStatus, React.CSSProperties> = {
                pending:    { background: '#f3f4f6', color: '#4b5563' },
                validating: { background: '#e0f2fe', color: '#0369a1' },
                approved:   { background: '#ecfdf5', color: '#065f46' },
                rejected:   { background: '#fff1f2', color: '#9f1239' },
              };
              const statusIcons: Record<EnterpriseRequestStatus, React.ReactNode> = {
                pending:    <Clock className="w-3.5 h-3.5" />,
                validating: <Eye className="w-3.5 h-3.5" />,
                approved:   <CheckCircle className="w-3.5 h-3.5" />,
                rejected:   <XCircle className="w-3.5 h-3.5" />,
              };

              return (
                <div key={req.id} className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                  {/* Request header row */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar + info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#D97706,#b45309)' }}>
                        {req.userName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{req.userName}</p>
                        <p className="text-xs text-gray-400 truncate">{req.userEmail}</p>
                        <p className="text-xs font-semibold text-amber-700 mt-0.5">{req.company} · {req.teamSize} people · {req.budget}/mo budget</p>
                      </div>
                    </div>

                    {/* Status + date */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize" style={statusStyles[req.status]}>
                        {statusIcons[req.status]} {req.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(req.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewRequest(req.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}
                      >
                        {isExpanded ? 'Collapse' : 'Review'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#f0edf9] p-5 space-y-4">
                      {/* Use case */}
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Use Case</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{req.useCase}</p>
                      </div>

                      {/* AI Assessment */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">AI Validation</p>
                          {!req.aiAssessment && (
                            <button
                              type="button"
                              onClick={() => handleAiValidate(req.id)}
                              disabled={validatingId === req.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-60"
                              style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', color: '#fff' }}
                            >
                              {validatingId === req.id
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
                                : <><Bot className="w-3.5 h-3.5" /> Validate with AI</>
                              }
                            </button>
                          )}
                        </div>

                        {validatingId === req.id && (
                          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}>
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500 shrink-0" />
                            <span className="text-sm text-purple-700">AI is analysing company profile, use case patterns, budget signals and platform fit…</span>
                          </div>
                        )}

                        {req.aiAssessment && (
                          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8' }}>
                            {/* Risk score + recommendation */}
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold text-white" style={{
                                  background: req.aiAssessment.riskScore < 35 ? '#16a34a' : req.aiAssessment.riskScore < 65 ? '#d97706' : '#dc2626',
                                }}>
                                  {req.aiAssessment.riskScore}
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1">Risk score</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Bot className="w-4 h-4 text-purple-500" />
                                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                    AI Recommendation:&nbsp;
                                    <span style={{
                                      color: req.aiAssessment.recommendation === 'approve' ? '#16a34a'
                                        : req.aiAssessment.recommendation === 'reject' ? '#dc2626' : '#d97706'
                                    }}>
                                      {req.aiAssessment.recommendation.toUpperCase()}
                                    </span>
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">{req.aiAssessment.summary}</p>
                              </div>
                            </div>

                            {/* Signals */}
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">Signals detected</p>
                              <ul className="space-y-1">
                                {req.aiAssessment.signals.map((s, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                    <span className="mt-0.5 shrink-0" style={{ color: '#7C3AED' }}>·</span>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Approve / Reject actions */}
                      {(req.status === 'pending' || req.status === 'validating') && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
                          >
                            <CheckCircle className="w-4 h-4" /> Approve &amp; Activate Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(req.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
                            style={{ background: '#fff1f2', color: '#9f1239', border: '1.5px solid #fecdd3' }}
                          >
                            <XCircle className="w-4 h-4" /> Reject Request
                          </button>
                        </div>
                      )}

                      {/* Approved state */}
                      {req.status === 'approved' && (
                        <div className="rounded-2xl px-4 py-3 space-y-2" style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-sm font-bold text-emerald-800">Approved — payment gateway activated</span>
                          </div>
                          <p className="text-xs text-emerald-700">
                            {req.userName} can now complete Enterprise payment. Enterprise access activates automatically after successful payment.
                          </p>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                            style={{ background: '#16a34a' }}
                          >
                            <Send className="w-3.5 h-3.5" /> Send payment link to {req.userEmail}
                          </button>
                        </div>
                      )}

                      {/* Rejected state */}
                      {req.status === 'rejected' && (
                        <div className="rounded-2xl px-4 py-3 flex items-start gap-2" style={{ background: '#fff1f2', border: '1.5px solid #fecdd3' }}>
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-rose-800">Request rejected</p>
                            <p className="text-xs text-rose-600 mt-0.5">User has been notified. They can re-apply after 30 days or upgrade to Pro via the standard flow.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info strip */}
          <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}>
            <Bot className="w-4 h-4 text-[#9d6ff0] mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600">
              AI Validation analyses the applicant&apos;s company profile, use case, team size, and budget against enterprise tier criteria. It is an <strong>advisory signal</strong> — final approval is always a human decision.
            </p>
          </div>
        </div>
      )}

      {/* ── Enterprise Dashboard ────────────────────────────────────────────── */}
      {adminTab === 'dashboard' && (
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Enterprise Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Revenue, AI economics, forecasts and provider health</p>
          </div>
          <button
            type="button"
            onClick={() => { void load(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 transition-colors"
            style={{ border: '1.5px solid #e3ddf8' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3" style={{ border: '1.5px solid #fecaca' }}>{error}</div>
        )}

        {loading && !metrics ? (
          <p className="text-sm text-gray-400 py-16 text-center">Loading enterprise metrics…</p>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-1">
              <StatCard
                tone="lilac"
                icon={<Star className="w-5 h-5" />}
                label="North star — published videos per active channel (30d)"
                value={(metrics.northStar?.perActiveChannel ?? 0).toFixed(1)}
                sub={`${metrics.northStar?.publishedVideos30d ?? 0} published · ${metrics.northStar?.activeChannels30d ?? 0} active channels`}
                subClassName="text-gray-600"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard tone="lilac"      icon={<DollarSign className="w-5 h-5" />} label="MRR"          value={money(metrics.mrr)}             sub={`ARR ${money(metrics.arr)}`}           subClassName="text-gray-600" />
              <StatCard tone="pink"       icon={<Users className="w-5 h-5" />}      label="ARPU (30d)"   value={money(metrics.arpu)}            sub={`LTV ${money(metrics.ltv)}`}           subClassName="text-gray-600" />
              <StatCard tone="cream"      icon={<TrendingUp className="w-5 h-5" />} label="Churn (30d)"  value={pct(metrics.churn)}             sub="cancelled / active"                   subClassName="text-gray-600" />
              <StatCard tone="periwinkle" icon={<PiggyBank className="w-5 h-5" />}  label="Cache savings" value={usd(metrics.cacheSavingsUsd)}  sub={`AI cost ${usd(metrics.aiCostUsd)}`} subClassName="text-gray-600" />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <BarChart2 className="w-4 h-4 text-[#9d6ff0]" /> Revenue — last 6 periods
                </h2>
                <PastelBars
                  data={metrics.revenueByMonth.map((v, i) => ({
                    label: MONTH_LABELS(metrics.revenueByMonth.length)[i],
                    value: v / 100,
                  }))}
                  formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
                />
              </section>

              <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <Cpu className="w-4 h-4 text-[#9d6ff0]" /> Most-used AI models (30d, by cost)
                </h2>
                {metrics.topModels.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No AI usage yet</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {metrics.topModels.map((m) => (
                      <li key={m.model} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{m.model}</p>
                          <p className="text-[11px] text-gray-500 tabular-nums">
                            {((m.tokensIn + m.tokensOut) / 1000).toFixed(1)}k tokens
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">{usd(m.costUsd)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <TrendingUp className="w-4 h-4 text-[#9d6ff0]" /> Forecasts
                </h2>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => { void handleGenerateForecasts(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold text-[#6D4AE0] transition-colors disabled:opacity-50"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Generating…' : 'Generate now'}
                </button>
              </div>
              {forecasts.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  No forecasts yet — they generate daily, or trigger one now.
                </p>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {forecasts.map((f) => (
                    <div key={f.id} className="bg-[#faf9ff] rounded-2xl p-4" style={{ border: '1.5px solid #e3ddf8' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">{FORECAST_LABELS[f.metric] ?? f.metric}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
                        {formatForecastValue(f.metric, f.predictedValue)}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1 tabular-nums">
                        {formatForecastValue(f.metric, f.confidenceLow)} – {formatForecastValue(f.metric, f.confidenceHigh)}
                        {' · '}{f.method.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Activity className="w-4 h-4 text-[#9d6ff0]" /> AI providers
              </h2>
              {providers.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Provider registry unavailable for your role</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Provider</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Status</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Health</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Failure rate</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Quality</th>
                        <th className="py-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Cost ($/1M in · out)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {providers.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800">{p.name}</td>
                          <td className="py-2.5 pr-4"><ProviderStatusChip status={p.status} /></td>
                          <td className="py-2.5 pr-4 tabular-nums text-gray-600">{p.avgHealthScore.toFixed(0)}</td>
                          <td className="py-2.5 pr-4 tabular-nums text-gray-600">{pct(p.failureRate)}</td>
                          <td className="py-2.5 pr-4 tabular-nums text-gray-600">{p.qualityScore.toFixed(2)}</td>
                          <td className="py-2.5 tabular-nums text-gray-600">
                            {p.costRates[0]
                              ? `$${p.costRates[0].inputCost} · $${p.costRates[0].outputCost}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
      )}
    </div>
  );
}
