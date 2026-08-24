'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  Film,
  Download,
  Volume2,
  VolumeX,
  Play,
  Maximize2,
} from 'lucide-react';
import { StatCard, PastelBars, PastelDonut } from '@/components/stat-card';
import { DevicePreview } from '@/components/device-preview';
import { api, apiClient, type AdminProvider, type AdminPublicContent, type AdminUser, type EnterpriseMetrics, type ForecastRow, type ModerationAction } from '@/lib/api';
import { getErrorMessage } from '@/lib/getErrorMessage';

type AdminTab = 'dashboard' | 'device-preview' | 'page-views' | 'users' | 'enterprise-requests' | 'ai-usage' | 'ad-video' | 'moderation' | 'api-keys' | 'ad-revenue' | 'withdrawals';

interface PlatformAdRevenueStats {
  totalViews: number;
  totalCreditsEarned: number;
  totalCreditsPaid: number;
  activeProjects: number;
  cpmCredits: number;
  minPayoutCredits: number;
}

interface SystemProviderHealth {
  name: string;
  envKey: string;
  configured: boolean;
  status: 'active' | 'unconfigured';
  category: 'ai' | 'media' | 'email' | 'payment';
  note?: string;
}

// ── Token usage types (platform-wide, admin only) ─────────────────────────────
interface TokenUsageSummary {
  sinceDays: number;
  totals: { calls: number; tokensIn: number; tokensOut: number; costUsd: number };
  byModel: Array<{ provider: string; model: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  copilot: { turns: number; cacheHits: number; cacheHitRate: number | null };
  byVideo: Array<{ importedVideoId: string; title: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  byDay: Array<{ date: string; costUsd: number; tokensIn: number; tokensOut: number; calls: number }>;
}

function aiProviderColor(p: string): string {
  const key = p.toLowerCase();
  if (key.includes('claude') || key.includes('anthropic')) return '#374151';
  if (key.includes('gemini') || key.includes('google')) return '#4285F4';
  if (key.includes('gpt') || key.includes('openai')) return '#10A37F';
  return '#8b88a0';
}

function aiProviderLabel(p: string): string {
  const map: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', azure: 'Azure', mistral: 'Mistral' };
  return map[p.toLowerCase()] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

function DailyTrendBars({ byDay }: { byDay: TokenUsageSummary['byDay'] | undefined | null }) {
  if (!byDay?.length) return <p className="text-xs text-gray-600 py-4 text-center">No daily data</p>;
  const max = Math.max(...byDay.map((d) => d.costUsd), 0.0001);
  return (
    <div className="flex items-end gap-[3px] h-20 w-full overflow-hidden">
      {byDay.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: $${d.costUsd.toFixed(4)}`}>
          <div className="w-full rounded-t-sm" style={{ height: `${Math.max((d.costUsd / max) * 72, 2)}px`, background: '#374151', opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}

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
    { label: 'Web',     icon: <Globe className="w-4 h-4" />,       color: '#374151', views: { '7d': 12483 } },
    { label: 'Android', icon: <Smartphone className="w-4 h-4" />,  color: '#059669', views: { '7d': 6371 }  },
    { label: 'iOS',     icon: <Apple className="w-4 h-4" />,       color: '#0891B2', views: { '7d': 3204 }  },
    { label: 'macOS',   icon: <Monitor className="w-4 h-4" />,     color: '#DC2626', views: { '7d': 1521 }  },
    { label: 'Windows', icon: <Monitor className="w-4 h-4" />,     color: '#D97706', views: { '7d': 512 }   },
  ],
  '30d': [
    { label: 'Web',     icon: <Globe className="w-4 h-4" />,       color: '#374151', views: { '30d': 45823 } },
    { label: 'Android', icon: <Smartphone className="w-4 h-4" />,  color: '#059669', views: { '30d': 23410 } },
    { label: 'iOS',     icon: <Apple className="w-4 h-4" />,       color: '#0891B2', views: { '30d': 11205 } },
    { label: 'macOS',   icon: <Monitor className="w-4 h-4" />,     color: '#DC2626', views: { '30d': 5621 }  },
    { label: 'Windows', icon: <Monitor className="w-4 h-4" />,     color: '#D97706', views: { '30d': 1876 }  },
  ],
  '90d': [
    { label: 'Web',     icon: <Globe className="w-4 h-4" />,       color: '#374151', views: { '90d': 138249 } },
    { label: 'Android', icon: <Smartphone className="w-4 h-4" />,  color: '#059669', views: { '90d': 70633 }  },
    { label: 'iOS',     icon: <Apple className="w-4 h-4" />,       color: '#0891B2', views: { '90d': 33816 }  },
    { label: 'macOS',   icon: <Monitor className="w-4 h-4" />,     color: '#DC2626', views: { '90d': 16963 }  },
    { label: 'Windows', icon: <Monitor className="w-4 h-4" />,     color: '#D97706', views: { '90d': 5652 }   },
  ],
};

const PLAN_DATA: Record<string, { label: string; color: string; icon: React.ReactNode; views: number }[]> = {
  '7d':  [
    { label: 'Free',       color: '#6B7280', icon: <Users className="w-4 h-4" />,  views: 16714 },
    { label: 'Pro',        color: '#374151', icon: <Star className="w-4 h-4" />,   views: 5982  },
    { label: 'Enterprise', color: '#D97706', icon: <Crown className="w-4 h-4" />,  views: 1395  },
  ],
  '30d': [
    { label: 'Free',       color: '#6B7280', icon: <Users className="w-4 h-4" />,  views: 61230 },
    { label: 'Pro',        color: '#374151', icon: <Star className="w-4 h-4" />,   views: 21965 },
    { label: 'Enterprise', color: '#D97706', icon: <Crown className="w-4 h-4" />,  views: 4740  },
  ],
  '90d': [
    { label: 'Free',       color: '#6B7280', icon: <Users className="w-4 h-4" />,  views: 184690 },
    { label: 'Pro',        color: '#374151', icon: <Star className="w-4 h-4" />,   views: 66200  },
    { label: 'Enterprise', color: '#D97706', icon: <Crown className="w-4 h-4" />,  views: 14423  },
  ],
};


const PLAN_CHIP_STYLES: Record<string, React.CSSProperties> = {
  free:       { background: '#f3f4f6', color: '#4b5563' },
  pro:        { background: '#f3f4f6', color: '#374151' },
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
      <span className="text-xs tabular-nums text-gray-600 w-10 text-right">{pctVal.toFixed(1)}%</span>
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

// ── Ad Video Tab ──────────────────────────────────────────────────────────────

function AdVideoTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => {});
  }, []);

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  function openFullscreen() {
    const v = videoRef.current;
    if (v?.requestFullscreen) void v.requestFullscreen();
  }

  const SCENES = [
    { label: 'Title card',       desc: 'Brand intro with animated gradient and tagline' },
    { label: 'Dashboard',        desc: 'Projects, channels, and pipeline overview' },
    { label: 'AI Copilot',       desc: 'Voice-powered copilot in action' },
    { label: 'Feature grid',     desc: 'All 12 platform capabilities at a glance' },
    { label: 'Discover / Trends',desc: 'Real-time YouTube trend discovery' },
    { label: 'CTA',              desc: 'Sign-up call to action with brand close' },
  ];

  return (
    <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}>
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Platform Ad Video</h1>
            <p className="text-sm text-gray-500 mt-0.5">30-second Sozialzynk promotional video — 6 scenes · 1280×720 · H.264 · 30 fps</p>
          </div>
        </div>
        <a
          href="/sozialzync-ad-30s.mp4"
          download="sozialzync-ad-30s.mp4"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}
        >
          <Download className="w-4 h-4" />
          Download .mp4
        </a>
      </div>

      {/* Video player */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{ background: '#0e0924', border: '1.5px solid rgba(55,65,81,.25)', boxShadow: '0 0 0 1px rgba(55,65,81,.1), 0 0 40px rgba(55,65,81,.15)' }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Chrome bar */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          <div className="flex-1 mx-3 h-5 rounded-md flex items-center px-3" style={{ background: 'rgba(255,255,255,.06)' }}>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,.3)' }}>sozialzync-ad-30s.mp4 · Admin preview</span>
          </div>
          <button
            onClick={toggleMute}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors"
            style={{ color: muted ? 'rgba(255,255,255,.4)' : '#9ca3af', background: muted ? 'transparent' : 'rgba(156,163,175,.1)' }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            <span className="ml-0.5">{muted ? 'Unmute' : 'Sound on'}</span>
          </button>
        </div>

        {/* Video */}
        <div className="relative" style={{ aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            src="/sozialzync-ad-30s.mp4"
            muted
            loop
            playsInline
            autoPlay
            className="w-full h-full object-cover"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          {/* Overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
            style={{ opacity: showControls || !playing ? 1 : 0, background: 'rgba(0,0,0,.1)' }}
          >
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 backdrop-blur-sm"
              style={{ background: 'rgba(55,65,81,.8)', border: '2px solid rgba(255,255,255,.25)' }}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing
                ? <span className="flex gap-0.5"><span className="w-1.5 h-5 rounded-sm bg-white" /><span className="w-1.5 h-5 rounded-sm bg-white" /></span>
                : <Play className="w-6 h-6 text-white ml-0.5" fill="white" />}
            </button>
          </div>

          {/* Bottom bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 transition-opacity duration-200"
            style={{ opacity: showControls ? 1 : 0, background: 'linear-gradient(to top,rgba(0,0,0,.6),transparent)' }}
          >
            <span className="text-[10px] font-semibold text-white/70">30 seconds · 6 scenes · Ken Burns motion</span>
            <button
              onClick={openFullscreen}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,.6)' }}
              aria-label="Full screen"
            >
              <Maximize2 className="w-3 h-3" />
              Full screen
            </button>
          </div>
        </div>
      </div>

      {/* Scene breakdown + production metadata side by side */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* Scene breakdown */}
        <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">Scene Breakdown</p>
          <ol className="space-y-2.5">
            {SCENES.map((s, i) => (
              <li key={s.label} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #9ca3af, #374151)' }}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
                <span className="ml-auto text-[10px] font-bold text-gray-400 shrink-0 mt-1">5s</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Production metadata + deployment notes */}
        <div className="space-y-4">
          <section className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">Production Metadata</p>
            <dl className="space-y-2 text-sm">
              {[
                ['Duration',    '30 seconds'],
                ['Resolution',  '1280 × 720 (HD)'],
                ['Frame rate',  '30 fps'],
                ['Codec',       'H.264 · yuv420p'],
                ['Scenes',      '6 × 5-second scenes'],
                ['Motion',      'Ken Burns zoom/pan · 5 styles'],
                ['Generator',   'make_ad.py · Python/Pillow'],
                ['File size',   '~0.7 MB'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <dt className="text-gray-500 font-medium">{k}</dt>
                  <dd className="font-semibold text-gray-800 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl p-4" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Deployment Suggestions</p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {[
                'Landing page hero — already live at /',
                'YouTube channel trailer — upload directly to your Sozialzynk channel',
                'LinkedIn / Twitter organic post — drives creator sign-ups',
                'Google / Meta video ads — 30s is the optimal ad unit length',
                'App Store / Play Store preview video',
                'Email drip campaign — embed as animated GIF or hosted link',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5" style={{ color: '#374151' }}>·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [metrics, setMetrics] = useState<EnterpriseMetrics | null>(null);
  const [forecasts, setForecasts] = useState<ForecastRow[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [systemProviders, setSystemProviders] = useState<SystemProviderHealth[]>([]);
  const [sysProvidersLoading, setSysProvidersLoading] = useState(false);
  const [sysProvidersLoaded, setSysProvidersLoaded] = useState(false);
  const [adRevenueStats, setAdRevenueStats] = useState<PlatformAdRevenueStats | null>(null);
  const [adRevenueLoading, setAdRevenueLoading] = useState(false);
  const [adRevenueDistributing, setAdRevenueDistributing] = useState(false);
  const [adRevenueError, setAdRevenueError] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- withdrawal stats are dynamic
  const [withdrawalStats, setWithdrawalStats] = useState<any>(null);
  const [withdrawalList, setWithdrawalList] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState('PENDING');
  const [withdrawalActionId, setWithdrawalActionId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
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

  // AI Usage state (platform-wide, lazy-loaded)
  const [aiUsage, setAiUsage] = useState<TokenUsageSummary | null | 'error'>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiUsageLoaded, setAiUsageLoaded] = useState(false);

  // Enterprise Requests state
  const [enterpriseRequests, setEnterpriseRequests] = useState<EnterpriseRequest[]>(SEED_REQUESTS);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Moderation state
  const [modContent, setModContent] = useState<AdminPublicContent[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const [modSearch, setModSearch] = useState('');
  const [modLog, setModLog] = useState<ModerationAction[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<AdminPublicContent['creator'] | null>(null);
  const [removeModal, setRemoveModal] = useState<{ item: AdminPublicContent } | null>(null);
  const [removeNote, setRemoveNote] = useState('');
  const [warnModal, setWarnModal] = useState<{ userId: string; name: string } | null>(null);
  const [warnMsg, setWarnMsg] = useState('');
  const [suspendModal, setSuspendModal] = useState<{ userId: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [modActionLoading, setModActionLoading] = useState(false);

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

  const loadAiUsage = useCallback(async () => {
    if (aiUsageLoaded) return;
    setAiUsageLoading(true);
    try {
      const r = await apiClient.get<TokenUsageSummary>('/token-usage/summary');
      setAiUsage(r.data);
    } catch {
      setAiUsage('error');
    } finally {
      setAiUsageLoading(false);
      setAiUsageLoaded(true);
    }
  }, [aiUsageLoaded]);

  const loadSystemProviders = useCallback(async () => {
    if (sysProvidersLoaded) return;
    setSysProvidersLoading(true);
    try {
      const r = await apiClient.get<SystemProviderHealth[]>('/admin/providers/health');
      setSystemProviders(r.data);
    } catch {
      setSystemProviders([]);
    } finally {
      setSysProvidersLoading(false);
      setSysProvidersLoaded(true);
    }
  }, [sysProvidersLoaded]);

  const loadAdRevenue = useCallback(async () => {
    setAdRevenueLoading(true);
    setAdRevenueError('');
    try {
      const r = await apiClient.get<PlatformAdRevenueStats>('/projects/ad-revenue/platform-stats');
      setAdRevenueStats(r.data);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setAdRevenueError(ax.response?.data?.message ?? 'Failed to load ad revenue stats');
    } finally {
      setAdRevenueLoading(false);
    }
  }, []);

  const loadWithdrawals = useCallback(async (filter?: string) => {
    const f = filter ?? withdrawalFilter;
    setWithdrawalsLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        apiClient.get<any>('/wallet/admin/withdrawals/stats'), // eslint-disable-line @typescript-eslint/no-explicit-any
        apiClient.get<any[]>(`/wallet/admin/withdrawals?status=${f}`), // eslint-disable-line @typescript-eslint/no-explicit-any
      ]);
      setWithdrawalStats(statsRes.data);
      setWithdrawalList(listRes.data);
    } catch { /* non-fatal */ }
    finally { setWithdrawalsLoading(false); }
  }, [withdrawalFilter]);

  const distributeAdRevenue = async () => {
    setAdRevenueDistributing(true);
    setAdRevenueError('');
    try {
      await apiClient.post<{ paid: number; skipped: number }>('/projects/ad-revenue/distribute');
      await loadAdRevenue();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setAdRevenueError(ax.response?.data?.message ?? 'Distribution failed');
    } finally {
      setAdRevenueDistributing(false);
    }
  };

  const loadModeration = useCallback(async () => {
    setModLoading(true);
    try {
      const [c, l] = await Promise.all([
        api.admin.publicContent({ take: 50 }).catch(() => ({ data: { items: [] as AdminPublicContent[], nextCursor: null } })),
        api.admin.moderationLog().catch(() => ({ data: [] as ModerationAction[] })),
      ]);
      setModContent(c.data.items);
      setModLog(l.data);
    } finally {
      setModLoading(false);
    }
  }, []);

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
        <p className="text-xs text-gray-600 mt-1">This dashboard is available to platform owners and super admins.</p>
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
            { id: 'ai-usage',            label: 'AI Usage',             icon: <Cpu className="w-4 h-4" /> },
            { id: 'page-views',          label: 'Page Views',           icon: <Eye className="w-4 h-4" /> },
            { id: 'users',               label: 'User Accounts',        icon: <Users className="w-4 h-4" /> },
            {
              id: 'enterprise-requests',
              label: `Enterprise Requests${enterpriseRequests.filter((r) => r.status === 'pending').length > 0 ? ` (${enterpriseRequests.filter((r) => r.status === 'pending').length})` : ''}`,
              icon: <Building2 className="w-4 h-4" />,
            },
            { id: 'device-preview',      label: 'Device Preview',       icon: <Monitor className="w-4 h-4" /> },
            { id: 'ad-video',            label: 'Platform Ad',          icon: <Film className="w-4 h-4" /> },
            { id: 'moderation',          label: 'Content Moderation',   icon: <ShieldAlert className="w-4 h-4" /> },
            { id: 'api-keys',            label: 'API Keys & Providers',  icon: <Cpu className="w-4 h-4" /> },
            { id: 'ad-revenue',          label: 'Ad Revenue',            icon: <DollarSign className="w-4 h-4" /> },
            { id: 'withdrawals',         label: 'Withdrawals',           icon: <PiggyBank className="w-4 h-4" /> },
          ] as { id: AdminTab; label: string; icon: React.ReactNode }[]
        ).map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setAdminTab(id);
              if (id === 'users') void loadUsers();
              if (id === 'ai-usage') void loadAiUsage();
              if (id === 'moderation') void loadModeration();
              if (id === 'api-keys') void loadSystemProviders();
              if (id === 'ad-revenue') void loadAdRevenue();
              if (id === 'withdrawals') void loadWithdrawals();
            }}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-2xl transition-all"
            style={adminTab === id
              ? { background: '#f3f4f6', border: '2px solid #374151', color: '#374151' }
              : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }
            }
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── Platform Ad Video ───────────────────────────────────────────────── */}
      {adminTab === 'ad-video' && <AdVideoTab />}

      {/* ── Device Preview ──────────────────────────────────────────────────── */}
      {adminTab === 'device-preview' && <DevicePreview />}

      {/* ── AI Usage ────────────────────────────────────────────────────────── */}
      {adminTab === 'ai-usage' && (
        <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">AI Usage — All Users</h1>
              <p className="text-sm text-gray-600 mt-0.5">Platform-wide token spend, model breakdown, and copilot cache health</p>
            </div>
            <button
              type="button"
              onClick={() => { setAiUsageLoaded(false); void loadAiUsage(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
            >
              <RefreshCw className={`w-4 h-4 ${aiUsageLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {aiUsageLoading && (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1.5px solid #e3ddf8' }}>
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: '#374151' }} />
              <p className="text-sm text-gray-600">Loading AI usage data…</p>
            </div>
          )}

          {aiUsage === 'error' && (
            <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3" style={{ border: '1.5px solid #fecaca' }}>
              Failed to load AI usage data. Check that your role has the required permissions.
            </div>
          )}

          {aiUsage && aiUsage !== 'error' && aiUsage.totals.calls === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #f3f4f6, #e3ddf8)' }}>
                <Cpu className="w-8 h-8" style={{ color: '#374151' }} />
              </div>
              <p className="text-base font-extrabold text-gray-900 mb-1">No AI usage yet</p>
              <p className="text-sm text-gray-600">Run the content pipeline to start generating AI usage data.</p>
            </div>
          )}

          {aiUsage && aiUsage !== 'error' && aiUsage.totals.calls > 0 && (() => {
            const providerMap = new Map<string, { costUsd: number; tokensIn: number; tokensOut: number; calls: number }>();
            for (const m of aiUsage.byModel) {
              const ex = providerMap.get(m.provider) ?? { costUsd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
              providerMap.set(m.provider, { costUsd: ex.costUsd + m.costUsd, tokensIn: ex.tokensIn + m.tokensIn, tokensOut: ex.tokensOut + m.tokensOut, calls: ex.calls + m.calls });
            }
            const providerList = Array.from(providerMap.entries())
              .map(([p, d]) => ({ provider: p, label: aiProviderLabel(p), color: aiProviderColor(p), ...d }))
              .sort((a, b) => b.costUsd - a.costUsd);

            const donutSegments = providerList.map((p) => ({ label: p.label, value: p.costUsd, color: p.color }));
            const barData = providerList.map((p) => ({ label: p.label, value: p.costUsd, title: `$${p.costUsd.toFixed(4)}` }));

            return (
              <>
                {/* Summary stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard tone="lilac"      icon={<DollarSign className="w-5 h-5" />} label="Total Cost"  value={`$${aiUsage.totals.costUsd.toFixed(4)}`}                              sub={`last ${aiUsage.sinceDays}d`}   subClassName="text-gray-600" />
                  <StatCard tone="pink"       icon={<Activity className="w-5 h-5" />}   label="API Calls"  value={aiUsage.totals.calls.toLocaleString()}                               sub="provider requests"              subClassName="text-gray-600" />
                  <StatCard tone="cream"      icon={<TrendingUp className="w-5 h-5" />} label="Tokens In"  value={`${(aiUsage.totals.tokensIn / 1000).toFixed(1)}K`}                  sub="prompt tokens"                  subClassName="text-gray-600" />
                  <StatCard tone="periwinkle" icon={<BarChart2 className="w-5 h-5" />}  label="Tokens Out" value={`${(aiUsage.totals.tokensOut / 1000).toFixed(1)}K`}                 sub="completion tokens"              subClassName="text-gray-600" />
                </div>

                {/* Daily trend + Copilot cache */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="sm:col-span-2 bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Daily Cost Trend</p>
                    <DailyTrendBars byDay={aiUsage.byDay} />
                    {(aiUsage.byDay?.length ?? 0) > 0 && (
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-600">{aiUsage.byDay[0]?.date}</span>
                        <span className="text-[10px] text-gray-600">{aiUsage.byDay[aiUsage.byDay.length - 1]?.date}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl p-5 flex flex-col justify-center" style={{ border: '1.5px solid #e3ddf8' }}>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-2">Copilot Cache</p>
                    {aiUsage.copilot.cacheHitRate != null ? (
                      <>
                        <p className="text-3xl font-black" style={{ color: aiUsage.copilot.cacheHitRate >= 0.8 ? '#16a34a' : '#c2410c' }}>
                          {(aiUsage.copilot.cacheHitRate * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs text-gray-600 mt-1">cache-hit rate</p>
                        <p className="text-xs text-gray-600">{aiUsage.copilot.cacheHits} hits / {aiUsage.copilot.turns} turns</p>
                        <p className="text-[10px] text-gray-300 mt-1">target ≥ 80%</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">No copilot turns yet</p>
                    )}
                  </div>
                </div>

                {/* Provider breakdown */}
                {providerList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Cost by Provider</p>
                      <PastelBars data={barData} formatValue={(v) => `$${v.toFixed(4)}`} />
                    </div>
                    <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Provider Share</p>
                      <PastelDonut segments={donutSegments} />
                    </div>
                  </div>
                )}

                {/* Per-model detail table */}
                <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Per Model Breakdown</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Provider / Model</th>
                          <th className="pb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 text-right">Calls</th>
                          <th className="pb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 text-right">Tokens</th>
                          <th className="pb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiUsage.byModel.slice().sort((a, b) => b.costUsd - a.costUsd).map((m) => (
                          <tr key={`${m.provider}:${m.model}`} className="hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: aiProviderColor(m.provider) }} />
                                <span className="font-medium text-gray-800">{aiProviderLabel(m.provider)}</span>
                                <span className="text-gray-600 text-xs truncate max-w-[160px]">{m.model}</span>
                              </div>
                            </td>
                            <td className="py-2 text-right text-gray-600">{m.calls.toLocaleString()}</td>
                            <td className="py-2 text-right text-gray-600">{(m.tokensIn + m.tokensOut).toLocaleString()}</td>
                            <td className="py-2 text-right font-bold text-gray-900">${m.costUsd.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cost by video */}
                {(aiUsage.byVideo ?? []).length > 0 && (
                  <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-3">Cost by Video (top 15)</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-1 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Video</th>
                          <th className="pb-1 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 text-right">Calls</th>
                          <th className="pb-1 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 text-right">Tokens</th>
                          <th className="pb-1 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiUsage.byVideo.map((v) => (
                          <tr key={v.importedVideoId} className="hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td className="py-1.5 text-gray-800 truncate max-w-[280px]" title={v.title}>{v.title}</td>
                            <td className="py-1.5 text-right text-gray-600">{v.calls}</td>
                            <td className="py-1.5 text-right text-gray-600">{(v.tokensIn + v.tokensOut).toLocaleString()}</td>
                            <td className="py-1.5 text-right font-bold text-gray-900">${v.costUsd.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Page Views ─────────────────────────────────────────────────────── */}
      {adminTab === 'page-views' && (
        <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Page Views</h1>
              <p className="text-sm text-gray-600 mt-0.5">Session analytics by platform and subscription plan</p>
            </div>
            {/* Range selector */}
            <div className="flex items-center gap-1 rounded-2xl p-1" style={{ background: '#f3f4f6' }}>
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setViewRange(r)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={viewRange === r
                    ? { background: '#fff', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                    : { color: '#374151' }
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
                <span className="text-xs text-gray-600 tabular-nums">{totalPlatformViews.toLocaleString()} total</span>
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
                <span className="text-xs text-gray-600 tabular-nums">{totalPlanViews.toLocaleString()} total</span>
              </div>
              <div className="divide-y divide-gray-50">
                {planRows.map((row) => (
                  <HBar key={row.label} label={row.label} icon={row.icon} value={row.views} max={planMax} color={row.color} />
                ))}
              </div>
            </section>
          </div>

          {/* Sessions trend note */}
          <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
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
              <p className="text-sm text-gray-600 mt-0.5">Search, filter, and access any user account as superadmin</p>
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
            <div className="flex items-center gap-1 rounded-2xl p-1" style={{ background: '#f3f4f6' }}>
              {(['all', 'free', 'pro', 'enterprise'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlanFilter(p)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize"
                  style={planFilter === p
                    ? { background: '#fff', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                    : { color: '#374151' }
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
                  <tr className="text-left border-b border-[#f3f4f6]">
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">User</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Plan</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 hidden sm:table-cell">Channels</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 hidden md:table-cell">Last seen</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-600 hidden md:table-cell">Status</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f9f7ff]">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-[#374151] mx-auto" />
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-600">
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
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #9ca3af, #374151)' }}>
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{displayName}</p>
                              <p className="text-xs text-gray-600">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><PlanChip plan={plan} /></td>
                        <td className="px-5 py-3.5 hidden sm:table-cell text-gray-600 tabular-nums">{u._count.channels}</td>
                        <td className="px-5 py-3.5 hidden md:table-cell text-gray-600 text-xs">{joined}</td>
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
                              : { background: '#f3f4f6', color: '#374151', border: '1.5px solid #e3ddf8' }
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
            <div className="px-5 py-3 border-t border-[#f3f4f6] flex items-center justify-between">
              <span className="text-xs text-gray-600">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} shown</span>
              <span className="text-xs text-gray-600">Superadmin access · All actions logged</span>
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
            <p className="text-sm text-gray-600 mt-0.5">Review, AI-validate, and approve or reject enterprise tier applications</p>
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
              <p className="text-sm text-gray-600">No enterprise requests yet</p>
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
                        <p className="text-xs text-gray-600 truncate">{req.userEmail}</p>
                        <p className="text-xs font-semibold text-amber-700 mt-0.5">{req.company} · {req.teamSize} people · {req.budget}/mo budget</p>
                      </div>
                    </div>

                    {/* Status + date */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize" style={statusStyles[req.status]}>
                        {statusIcons[req.status]} {req.status}
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(req.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewRequest(req.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#f3f4f6', color: '#374151', border: '1.5px solid #e3ddf8' }}
                      >
                        {isExpanded ? 'Collapse' : 'Review'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#f3f4f6] p-5 space-y-4">
                      {/* Use case */}
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-1">Use Case</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{req.useCase}</p>
                      </div>

                      {/* AI Assessment */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600">AI Validation</p>
                          {!req.aiAssessment && (
                            <button
                              type="button"
                              onClick={() => handleAiValidate(req.id)}
                              disabled={validatingId === req.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-60"
                              style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff' }}
                            >
                              {validatingId === req.id
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
                                : <><Bot className="w-3.5 h-3.5" /> Validate with AI</>
                              }
                            </button>
                          )}
                        </div>

                        {validatingId === req.id && (
                          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500 shrink-0" />
                            <span className="text-sm text-gray-700">AI is analysing company profile, use case patterns, budget signals and platform fit…</span>
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
                                <span className="text-[10px] text-gray-600 mt-1">Risk score</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Bot className="w-4 h-4 text-gray-500" />
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
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 mb-1.5">Signals detected</p>
                              <ul className="space-y-1">
                                {req.aiAssessment.signals.map((s, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                    <span className="mt-0.5 shrink-0" style={{ color: '#374151' }}>·</span>
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
          <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
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
            <p className="text-sm text-gray-600 mt-0.5">Revenue, AI economics, forecasts and provider health</p>
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
          <p className="text-sm text-gray-600 py-16 text-center">Loading enterprise metrics…</p>
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
                  <p className="text-sm text-gray-600 py-8 text-center">No AI usage yet</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {metrics.topModels.map((m) => (
                      <li key={m.model} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{m.model}</p>
                          <p className="text-[11px] text-gray-600 tabular-nums">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold text-[#374151] transition-colors disabled:opacity-50"
                  style={{ border: '1.5px solid #e3ddf8' }}
                >
                  <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Generating…' : 'Generate now'}
                </button>
              </div>
              {forecasts.length === 0 ? (
                <p className="text-sm text-gray-600 py-6 text-center">
                  No forecasts yet — they generate daily, or trigger one now.
                </p>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {forecasts.map((f) => (
                    <div key={f.id} className="bg-[#faf9ff] rounded-2xl p-4" style={{ border: '1.5px solid #e3ddf8' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600">{FORECAST_LABELS[f.metric] ?? f.metric}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
                        {formatForecastValue(f.metric, f.predictedValue)}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-1 tabular-nums">
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
                <p className="text-sm text-gray-600 py-6 text-center">Provider registry unavailable for your role</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Provider</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Status</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Health</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Failure rate</th>
                        <th className="py-2 pr-4 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Quality</th>
                        <th className="py-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-600">Cost ($/1M in · out)</th>
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

      {/* ── Content Moderation ─────────────────────────────────────────── */}
      {adminTab === 'moderation' && (
        <div className="p-5 lg:p-7 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Content Moderation</h1>
              <p className="text-sm text-gray-500 mt-0.5">Review and remove inappropriate public content. All actions are logged.</p>
            </div>
            <button type="button" onClick={() => void loadModeration()}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 border border-[#e3ddf8] hover:bg-gray-50 transition-colors">
              <RefreshCw className={`w-4 h-4 ${modLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white max-w-sm">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="search"
              placeholder="Search content or creator…"
              value={modSearch}
              onChange={e => setModSearch(e.target.value)}
              className="border-none outline-none bg-transparent text-sm flex-1 text-gray-800 placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Content grid — 2/3 */}
            <div className="lg:col-span-2 space-y-3">
              {modLoading ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-500" />
                  <p className="text-sm text-gray-500">Loading public content…</p>
                </div>
              ) : modContent.filter(c =>
                  !modSearch || c.title.toLowerCase().includes(modSearch.toLowerCase()) ||
                  (c.creator.name ?? c.creator.email).toLowerCase().includes(modSearch.toLowerCase())
                ).length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="font-semibold text-gray-700 mb-1">No public content yet</p>
                  <p className="text-sm text-gray-400">When creators publish public content, it appears here for review.</p>
                </div>
              ) : (
                modContent
                  .filter(c =>
                    !modSearch || c.title.toLowerCase().includes(modSearch.toLowerCase()) ||
                    (c.creator.name ?? c.creator.email).toLowerCase().includes(modSearch.toLowerCase())
                  )
                  .map(item => (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 hover:border-gray-100 transition-colors">
                      <div className="w-24 h-16 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                        {item.thumbnailUrl
                          ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          : <Film className="w-5 h-5 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
                        <button
                          type="button"
                          onClick={() => setSelectedCreator(item.creator)}
                          className="text-xs text-gray-600 hover:underline mt-0.5"
                        >
                          {item.creator.name ?? item.creator.email}
                        </button>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{item.type}</span>
                          {item.viewCount != null && <span className="text-xs text-gray-400">{item.viewCount.toLocaleString()} views</span>}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">Public</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setRemoveModal({ item }); setRemoveNote(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCreator(item.creator)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Creator
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Creator panel + Action log — 1/3 */}
            <div className="space-y-4">
              {/* Creator account panel */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-gray-500" /> Creator Account
                </h3>
                {!selectedCreator ? (
                  <p className="text-xs text-gray-400 text-center py-6">Select a creator to view their account</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gray-500 shrink-0">
                        {(selectedCreator.name ?? selectedCreator.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{selectedCreator.name ?? 'Unnamed'}</p>
                        <p className="text-xs text-gray-400 truncate">{selectedCreator.email}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedCreator(null)} className="ml-auto text-gray-300 hover:text-gray-500">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-gray-50 p-2.5">
                        <p className="text-gray-400 mb-0.5">Role</p>
                        <p className="font-semibold text-gray-700">{selectedCreator.role}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-2.5">
                        <p className="text-gray-400 mb-0.5">Joined</p>
                        <p className="font-semibold text-gray-700">{new Date(selectedCreator.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={modActionLoading}
                        onClick={() => { setWarnModal({ userId: selectedCreator.id, name: selectedCreator.name ?? selectedCreator.email }); setWarnMsg(''); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-amber-600 border border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Warn Creator
                      </button>
                      <button
                        type="button"
                        disabled={modActionLoading}
                        onClick={() => { setSuspendModal({ userId: selectedCreator.id, name: selectedCreator.name ?? selectedCreator.email }); setSuspendReason(''); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Suspend Account
                      </button>
                      <button
                        type="button"
                        disabled={modActionLoading}
                        onClick={async () => {
                          setModActionLoading(true);
                          try { await api.admin.reinstateUser(selectedCreator.id); void loadModeration(); }
                          catch { /* non-fatal */ }
                          finally { setModActionLoading(false); }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Reinstate Account
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action log */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-500" /> Action Log
                </h3>
                {modLog.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No actions recorded yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {modLog.slice(0, 20).map(a => (
                      <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: a.actionType === 'REMOVE_CONTENT' ? '#FEF2F2' :
                                        a.actionType === 'WARN_USER' ? '#FFFBEB' :
                                        a.actionType === 'SUSPEND_USER' ? '#FEF2F2' : '#ECFDF5',
                            color: a.actionType === 'REMOVE_CONTENT' ? '#DC2626' :
                                   a.actionType === 'WARN_USER' ? '#D97706' :
                                   a.actionType === 'SUSPEND_USER' ? '#DC2626' : '#059669',
                          }}>
                          <Activity className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{a.actionType.replace(/_/g, ' ')}: {a.targetLabel}</p>
                          <p className="text-[11px] text-gray-400 truncate">{a.note}</p>
                          <p className="text-[10px] text-gray-300">{new Date(a.performedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Remove content modal */}
          {removeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Remove Public Content</h2>
                <p className="text-sm text-gray-500 mb-4">This will hide <strong>&ldquo;{removeModal.item.title}&rdquo;</strong> from the public. A mandatory note is required.</p>
                <textarea
                  placeholder="Reason for removal (required)…"
                  value={removeNote}
                  onChange={e => setRemoveNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                />
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setRemoveModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!removeNote.trim() || modActionLoading}
                    onClick={async () => {
                      if (!removeNote.trim()) return;
                      setModActionLoading(true);
                      try {
                        await api.admin.removeContent(removeModal.item.id, removeNote);
                        setModContent(prev => prev.filter(c => c.id !== removeModal.item.id));
                        setRemoveModal(null);
                        void loadModeration();
                      } catch { /* non-fatal */ }
                      finally { setModActionLoading(false); }
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {modActionLoading ? 'Removing…' : 'Remove Content'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Warn user modal */}
          {warnModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Warn Creator</h2>
                <p className="text-sm text-gray-500 mb-4">Send a warning message to <strong>{warnModal.name}</strong>.</p>
                <textarea
                  placeholder="Warning message (required)…"
                  value={warnMsg}
                  onChange={e => setWarnMsg(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                />
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setWarnModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!warnMsg.trim() || modActionLoading}
                    onClick={async () => {
                      if (!warnMsg.trim()) return;
                      setModActionLoading(true);
                      try {
                        await api.admin.warnUser(warnModal.userId, warnMsg);
                        setWarnModal(null);
                        void loadModeration();
                      } catch { /* non-fatal */ }
                      finally { setModActionLoading(false); }
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {modActionLoading ? 'Sending…' : 'Send Warning'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Suspend account modal */}
          {suspendModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Suspend Account</h2>
                <p className="text-sm text-gray-500 mb-4">Suspend <strong>{suspendModal.name}</strong>. A reason is required.</p>
                <textarea
                  placeholder="Reason for suspension (required)…"
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                />
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setSuspendModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!suspendReason.trim() || modActionLoading}
                    onClick={async () => {
                      if (!suspendReason.trim()) return;
                      setModActionLoading(true);
                      try {
                        await api.admin.suspendUser(suspendModal.userId, suspendReason);
                        setSuspendModal(null);
                        void loadModeration();
                      } catch { /* non-fatal */ }
                      finally { setModActionLoading(false); }
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {modActionLoading ? 'Suspending…' : 'Suspend Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── API Keys & Providers tab ─────────────────────────────────────────── */}
      {adminTab === 'api-keys' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-[#1a1030]">API Keys &amp; Providers</h2>
              <p className="text-sm text-gray-500 mt-0.5">System-level provider keys configured via environment variables.</p>
            </div>
            <button
              type="button"
              onClick={() => { setSysProvidersLoaded(false); void loadSystemProviders(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#e3ddf8] text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {!sysProvidersLoading && systemProviders.some(p => !p.configured) && (
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {systemProviders.filter(p => !p.configured).length} provider{systemProviders.filter(p => !p.configured).length !== 1 ? 's' : ''} need attention
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Configure missing keys on Railway to enable these features.</p>
              </div>
            </div>
          )}

          {sysProvidersLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking providers…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['ai', 'media', 'email', 'payment'] as const).map(cat => {
                const catProviders = systemProviders.filter(p => p.category === cat);
                if (!catProviders.length) return null;
                const catLabel = cat === 'ai' ? 'AI Models' : cat === 'media' ? 'Media Generation' : cat === 'email' ? 'Email' : 'Payments';
                return (
                  <div key={cat} className="rounded-2xl border border-[#e3ddf8] bg-white p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{catLabel}</h3>
                    <div className="space-y-2.5">
                      {catProviders.map(p => (
                        <div key={p.envKey} className="flex items-start gap-3">
                          {p.configured
                            ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#1a1030]">{p.name}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                {p.configured ? 'Active' : 'Missing'}
                              </span>
                            </div>
                            <code className="text-[10px] text-gray-400 font-mono">{p.envKey}</code>
                            {p.note && <p className="text-[11px] text-amber-600 mt-0.5">{p.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 p-4 rounded-2xl bg-[#f9f8ff] border border-[#e3ddf8]">
            <h3 className="text-sm font-bold text-[#374151] mb-2">How to update keys</h3>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
              <li>Go to <strong>railway.com</strong> → Your project → Service → Variables</li>
              <li>Find the env var (e.g. <code className="font-mono bg-gray-100 px-1 rounded">GROQ_API_KEY</code>) and update its value</li>
              <li>Railway auto-redeploys — new key is live within ~2 minutes</li>
              <li>Return here and click <strong>Refresh</strong> to verify status</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Ad Revenue tab ───────────────────────────────────────────────── */}
      {adminTab === 'ad-revenue' && (
        <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Ad Revenue</h1>
              <p className="text-sm text-gray-600 mt-0.5">Platform-wide Browse content monetisation — CPM-based credit distribution</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAdRevenue()}
                disabled={adRevenueLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 transition-colors"
                style={{ border: '1.5px solid #e3ddf8' }}
              >
                <RefreshCw className={`w-4 h-4 ${adRevenueLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void distributeAdRevenue()}
                disabled={adRevenueDistributing || adRevenueLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-colors"
                style={{ background: adRevenueDistributing ? '#d1d5db' : '#374151' }}
              >
                {adRevenueDistributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                Distribute Now
              </button>
            </div>
          </div>

          {adRevenueError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3" style={{ border: '1.5px solid #fecaca' }}>{adRevenueError}</div>
          )}

          {adRevenueLoading && !adRevenueStats ? (
            <p className="text-sm text-gray-500 py-16 text-center">Loading ad revenue stats…</p>
          ) : adRevenueStats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard tone="lilac" icon={<Eye className="w-5 h-5" />}         label="Total Browse Views"     value={(adRevenueStats.totalViews).toLocaleString()}           sub="across all opted-in projects"    subClassName="text-gray-600" />
                <StatCard tone="pink"  icon={<DollarSign className="w-5 h-5" />}  label="Credits Earned (total)" value={(adRevenueStats.totalCreditsEarned).toLocaleString()}   sub="earned since launch"             subClassName="text-gray-600" />
                <StatCard tone="cream" icon={<Activity className="w-5 h-5" />}    label="Credits Paid Out"       value={(adRevenueStats.totalCreditsPaid).toLocaleString()}     sub="distributed to creator wallets"  subClassName="text-gray-600" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 bg-white" style={{ border: '1.5px solid #e3ddf8' }}>
                  <p className="text-xs text-gray-500 mb-1">Active Projects</p>
                  <p className="text-3xl font-extrabold text-gray-900">{adRevenueStats.activeProjects}</p>
                  <p className="text-xs text-gray-400 mt-1">opted into Browse ad revenue</p>
                </div>
                <div className="rounded-2xl p-5 bg-white" style={{ border: '1.5px solid #e3ddf8' }}>
                  <p className="text-xs text-gray-500 mb-1">CPM Rate</p>
                  <p className="text-3xl font-extrabold text-[#9d6ff0]">{adRevenueStats.cpmCredits}</p>
                  <p className="text-xs text-gray-400 mt-1">credits per 1,000 views (env: AD_REVENUE_CPM_CREDITS)</p>
                </div>
              </div>

              <div className="rounded-2xl p-5 bg-[#f9f8ff]" style={{ border: '1.5px solid #e3ddf8' }}>
                <h3 className="text-sm font-bold text-gray-800 mb-3">How it works</h3>
                <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                  <li>Creators opt individual projects into Browse ad revenue from their project page.</li>
                  <li>Every view on the public Browse page increments that project&apos;s view counter.</li>
                  <li>Daily payout: <strong>{adRevenueStats.cpmCredits} credits per 1,000 views</strong> is added to the creator&apos;s bonus credit wallet.</li>
                  <li>Minimum payout threshold: <strong>{adRevenueStats.minPayoutCredits} credits</strong>. Below this, credits accumulate to the next cycle.</li>
                  <li><strong>Distribute Now</strong> triggers an immediate payout for all eligible projects (admin only).</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">Click Refresh to load platform ad revenue stats.</p>
          )}
        </div>
      )}

      {/* ── Withdrawals tab ──────────────────────────────────────────────── */}
      {adminTab === 'withdrawals' && (
        <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Creator Withdrawals</h1>
              <p className="text-sm text-gray-600 mt-0.5">Review and process creator payout requests — platform fee auto-credited to super admin</p>
            </div>
            <button
              type="button"
              onClick={() => void loadWithdrawals()}
              disabled={withdrawalsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
            >
              <RefreshCw className={`w-4 h-4 ${withdrawalsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats row */}
          {withdrawalStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard tone="lilac"      icon={<Clock className="w-5 h-5" />}      label="Pending"            value={String(withdrawalStats.pending)}                                       sub="awaiting review"        subClassName="text-gray-600" />
              <StatCard tone="pink"       icon={<DollarSign className="w-5 h-5" />} label="Platform Earned"    value={`$${(withdrawalStats.totalPlatformEarnedUsd ?? 0).toFixed(2)}`}        sub="fees collected (paid)"  subClassName="text-gray-600" />
              <StatCard tone="cream"      icon={<TrendingUp className="w-5 h-5" />} label="Total Paid Out"     value={`$${(withdrawalStats.totalPaidOutUsd ?? 0).toFixed(2)}`}               sub="to creators (paid)"     subClassName="text-gray-600" />
              <StatCard tone="periwinkle" icon={<PiggyBank className="w-5 h-5" />}  label="Platform Fee"       value={`${withdrawalStats.platformFeePct ?? 20}%`}                            sub="of each withdrawal"     subClassName="text-gray-600" />
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-1 rounded-2xl p-1 self-start" style={{ background: '#f3f4f6' }}>
            {(['PENDING', 'APPROVED', 'PAID', 'REJECTED', 'ALL'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setWithdrawalFilter(f);
                  void loadWithdrawals(f);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={withdrawalFilter === f
                  ? { background: '#fff', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
                  : { color: '#374151' }
                }
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Withdrawals table */}
          {withdrawalsLoading ? (
            <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1.5px solid #e3ddf8' }}>
              <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: '#374151' }} />
            </div>
          ) : withdrawalList.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1.5px solid #e3ddf8' }}>
              <PiggyBank className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {withdrawalStats ? 'No withdrawals match this filter.' : 'Click Refresh to load withdrawal data.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {['Creator', 'Credits', 'You Receive', 'Platform Fee', 'Status', 'Payout Email', 'Date', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalList.map((w: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                      const wStatusStyles: Record<string, React.CSSProperties> = {
                        PENDING:    { background: '#fffbeb', color: '#b45309' },
                        APPROVED:   { background: '#eff6ff', color: '#1d4ed8' },
                        PROCESSING: { background: '#eff6ff', color: '#1d4ed8' },
                        PAID:       { background: '#ecfdf5', color: '#065f46' },
                        REJECTED:   { background: '#fef2f2', color: '#b91c1c' },
                      };
                      return (
                        <>
                          <tr key={w.id} className="hover:bg-[#faf9ff]" style={{ borderBottom: withdrawalActionId === w.id ? 'none' : '1px solid #f9f7ff' }}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800 text-sm">{w.user?.name ?? '—'}</p>
                              <p className="text-xs text-gray-500">{w.user?.email}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800 tabular-nums">{(w.creditsRequested ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 font-bold text-green-700 tabular-nums">${(w.creatorAmountUsd ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-gray-600 tabular-nums">${(w.platformFeeUsd ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={wStatusStyles[w.status] ?? { background: '#f3f4f6', color: '#374151' }}>
                                {w.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{w.payoutEmail ?? '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{new Date(w.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {w.status === 'PENDING' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await apiClient.post(`/wallet/admin/withdrawals/${w.id}/approve`);
                                        void loadWithdrawals();
                                      }}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWithdrawalActionId(withdrawalActionId === w.id ? null : w.id);
                                        setRejectNotes('');
                                      }}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {w.status === 'APPROVED' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await apiClient.post(`/wallet/admin/withdrawals/${w.id}/paid`, {});
                                      void loadWithdrawals();
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Inline reject form */}
                          {withdrawalActionId === w.id && (
                            <tr key={`${w.id}-reject`} style={{ borderBottom: '1px solid #f9f7ff' }}>
                              <td colSpan={8} className="px-4 pb-3">
                                <div className="rounded-xl p-3 space-y-2" style={{ background: '#fff1f2', border: '1px solid #fecaca' }}>
                                  <p className="text-xs font-semibold text-red-700">Rejection reason (required — returned to creator&apos;s balance)</p>
                                  <textarea
                                    value={rejectNotes}
                                    onChange={(e) => setRejectNotes(e.target.value)}
                                    rows={2}
                                    placeholder="E.g. Insufficient verification, payout email not valid…"
                                    className="w-full rounded-xl border border-red-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={!rejectNotes.trim()}
                                      onClick={async () => {
                                        if (!rejectNotes.trim()) return;
                                        await apiClient.post(`/wallet/admin/withdrawals/${w.id}/reject`, { notes: rejectNotes });
                                        setWithdrawalActionId(null);
                                        setRejectNotes('');
                                        void loadWithdrawals();
                                      }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
                                    >
                                      Confirm Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setWithdrawalActionId(null); setRejectNotes(''); }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[#f3f4f6]">
                <span className="text-xs text-gray-600">{withdrawalList.length} withdrawal{withdrawalList.length !== 1 ? 's' : ''} shown</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
