'use client';
import { useState, useEffect, useCallback } from 'react';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Cpu, Music2, Mail, CreditCard,
  Globe, ShieldAlert, ExternalLink, Zap, Video, Mic2, Loader2, Wifi,
} from 'lucide-react';

interface ProviderHealth {
  name: string;
  envKey: string;
  configured: boolean;
  status: 'active' | 'unconfigured' | 'unknown';
  category: 'ai' | 'media' | 'email' | 'payment' | 'storage';
  note?: string;
}

type TestState = 'idle' | 'testing' | 'ok' | 'failed';

const PROVIDER_GUIDES: Record<string, string> = {
  ANTHROPIC_API_KEY:   'console.anthropic.com → API Keys',
  OPENAI_API_KEY:      'platform.openai.com → API Keys',
  GEMINI_API_KEY:      'aistudio.google.com → Get API Key',
  GROQ_API_KEY:        'Free at console.groq.com → API Keys',
  ELEVENLABS_API_KEY:  'elevenlabs.io → Profile → API Key',
  PIAPI_API_KEY:       'piapi.ai → Dashboard → API Keys (covers Kling video, Suno/Udio music)',
  RUNWAYML_API_SECRET: 'app.runwayml.com → Settings → API Keys',
  REPLICATE_API_TOKEN: 'replicate.com → Account → API Tokens',
  STABILITY_API_KEY:   'stability.ai → Account → API Keys',
  PEXELS_API_KEY:      'pexels.com/api → Your API Key',
  PIXABAY_API_KEY:     'pixabay.com/api/docs → API Key',
  RESEND_API_KEY:      'resend.com → API Keys',
  STRIPE_SECRET_KEY:   'stripe.com → Developers → API Keys. Also need: STRIPE_WEBHOOK_SECRET, STRIPE_STARTER_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_AGENCY_PRICE_ID',
  GOOGLE_CLIENT_ID:    'console.cloud.google.com → Credentials → OAuth 2.0',
  FACEBOOK_APP_ID:     'developers.facebook.com → Your App → Settings → Basic',
  YOUTUBE_API_KEY:     'console.cloud.google.com → APIs → YouTube Data API v3 → Credentials',
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ai:      <Cpu className="w-4 h-4" />,
  media:   <Video className="w-4 h-4" />,
  email:   <Mail className="w-4 h-4" />,
  payment: <CreditCard className="w-4 h-4" />,
  storage: <Globe className="w-4 h-4" />,
};

const CATEGORY_COLOR: Record<string, string> = {
  ai:      '#374151',
  media:   '#7c3aed',
  email:   '#0891b2',
  payment: '#059669',
  storage: '#d97706',
};

// Shown in mock/demo mode — reflects the keys known to be configured on Railway
const MOCK_PROVIDERS: ProviderHealth[] = [
  { name: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', configured: true,  status: 'active',        category: 'ai' },
  { name: 'OpenAI (GPT-4)',     envKey: 'OPENAI_API_KEY',    configured: false, status: 'unconfigured',  category: 'ai' },
  { name: 'Google Gemini',      envKey: 'GEMINI_API_KEY',    configured: true,  status: 'active',        category: 'ai' },
  { name: 'Groq',               envKey: 'GROQ_API_KEY',      configured: true,  status: 'active',        category: 'ai' },
  { name: 'Google OAuth',       envKey: 'GOOGLE_CLIENT_ID',  configured: true,  status: 'active',        category: 'ai' },
  { name: 'ElevenLabs (Voice)', envKey: 'ELEVENLABS_API_KEY',configured: true,  status: 'active',        category: 'media' },
  { name: 'PiAPI (Kling/Suno)', envKey: 'PIAPI_API_KEY',     configured: true,  status: 'active',        category: 'media' },
  { name: 'Runway ML',          envKey: 'RUNWAYML_API_SECRET',configured: true, status: 'active',        category: 'media' },
  { name: 'Replicate',          envKey: 'REPLICATE_API_TOKEN',configured: false,status: 'unconfigured',  category: 'media' },
  { name: 'Stability AI',       envKey: 'STABILITY_API_KEY', configured: false, status: 'unconfigured',  category: 'media' },
  { name: 'Pexels (Stock)',      envKey: 'PEXELS_API_KEY',    configured: true,  status: 'active',        category: 'media' },
  { name: 'Pixabay (Stock)',     envKey: 'PIXABAY_API_KEY',   configured: true,  status: 'active',        category: 'media' },
  { name: 'YouTube Data API',   envKey: 'YOUTUBE_API_KEY',   configured: false, status: 'unconfigured',  category: 'media' },
  { name: 'Facebook / Meta',    envKey: 'FACEBOOK_APP_ID',   configured: false, status: 'unconfigured',  category: 'media' },
  { name: 'Resend (Email)',      envKey: 'RESEND_API_KEY',    configured: true,  status: 'active',        category: 'email' },
  { name: 'Stripe (Payments)',   envKey: 'STRIPE_SECRET_KEY', configured: true,  status: 'active',        category: 'payment' },
];

function StatusBadge({ status }: { status: ProviderHealth['status'] }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#ecfdf5', color: '#065f46' }}>
        <CheckCircle2 className="w-3 h-3" /> Active
      </span>
    );
  }
  if (status === 'unconfigured') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fff1f2', color: '#9f1239' }}>
        <XCircle className="w-3 h-3" /> Not configured
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fef3c7', color: '#b45309' }}>
      <AlertCircle className="w-3 h-3" /> Unknown
    </span>
  );
}

function TestBadge({ state, message }: { state: TestState; message: string }) {
  if (state === 'idle') return null;
  if (state === 'testing') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#eff6ff', color: '#1e40af' }}>
        <Loader2 className="w-3 h-3 animate-spin" /> Testing…
      </span>
    );
  }
  if (state === 'ok') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#ecfdf5', color: '#065f46' }} title={message}>
        <Wifi className="w-3 h-3" /> Live OK
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fff1f2', color: '#9f1239' }} title={message}>
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
}

function ProviderCard({ p }: { p: ProviderHealth }) {
  const [expanded, setExpanded] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMsg, setTestMsg] = useState('');
  const guide = PROVIDER_GUIDES[p.envKey];
  const catColor = CATEGORY_COLOR[p.category] ?? '#374151';
  const catIcon = CATEGORY_ICON[p.category];

  const runTest = async () => {
    setTestState('testing');
    setTestMsg('');
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('cf_token') ?? '') : '';
      const res = await fetch('/api/proxy/admin/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ envKey: p.envKey }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestState(data.ok ? 'ok' : 'failed');
      setTestMsg(data.message ?? '');
    } catch (e) {
      setTestState('failed');
      setTestMsg(e instanceof Error ? e.message : 'Request failed');
    }
  };

  return (
    <div
      className="bg-white rounded-2xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-md"
      style={{ border: p.status === 'unconfigured' ? '1.5px solid #fecaca' : '1.5px solid #e3ddf8' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${catColor}15`, color: catColor }}>
            {catIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">{p.name}</p>
            <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">{p.envKey}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={p.status} />
          {testState !== 'idle' && <TestBadge state={testState} message={testMsg} />}
        </div>
      </div>

      {/* Note */}
      {p.note && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl">{p.note}</p>
      )}

      {/* Test result message */}
      {testState === 'failed' && testMsg && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-xl">{testMsg}</p>
      )}
      {testState === 'ok' && testMsg && (
        <p className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-xl">{testMsg}</p>
      )}

      {/* Guide for unconfigured */}
      {p.status === 'unconfigured' && guide && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
          >
            {expanded ? 'Hide guide ▲' : 'How to get this key ▼'}
          </button>
          {expanded && (
            <p className="mt-1.5 text-xs text-gray-600 leading-relaxed bg-red-50 rounded-xl px-3 py-2">
              {guide}
            </p>
          )}
        </div>
      )}

      {/* Test button */}
      <button
        type="button"
        onClick={() => { void runTest(); }}
        disabled={testState === 'testing'}
        className="self-start flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
        style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
      >
        {testState === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
        {testState === 'testing' ? 'Testing…' : 'Test connection'}
      </button>
    </div>
  );
}

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (MOCK_MODE) {
        setProviders(MOCK_PROVIDERS);
        setLastRefreshed(new Date());
        return;
      }
      const res = await fetch('/api/proxy/admin/providers/health', {
        headers: { Authorization: `Bearer ${localStorage.getItem('cf_token') ?? ''}` },
      });
      if (!res.ok) {
        if (res.status === 403) { setError('Admin access required (admin:providers permission).'); return; }
        throw new Error(res.status >= 500 ? 'Server temporarily unavailable — please try again.' : 'Failed to load provider health.');
      }
      const data = (await res.json()) as ProviderHealth[];
      setProviders(Array.isArray(data) ? data : []);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load provider health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unconfigured = providers.filter((p) => p.status === 'unconfigured');
  const grouped = providers.reduce<Record<string, ProviderHealth[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const CATEGORY_LABELS: Record<string, string> = {
    ai: 'AI Providers', media: 'Media Generation', email: 'Email', payment: 'Payment Gateway', storage: 'Storage & APIs',
  };
  const ORDER = ['ai', 'media', 'email', 'payment', 'storage'];

  return (
    <div className="min-h-full bg-[#faf9ff] p-5 lg:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">AI Provider Keys</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Monitor and test platform API integrations
              {lastRefreshed && (
                <span className="text-gray-400"> · Checked {lastRefreshed.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60"
          style={{ border: '1.5px solid #e3ddf8', background: '#fff' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-2xl px-5 py-3 mb-5" style={{ border: '1.5px solid #fecaca' }}>
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Attention banner */}
      {!loading && !error && unconfigured.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 rounded-2xl px-5 py-3 mb-6" style={{ border: '1.5px solid #fde68a' }}>
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">{unconfigured.length} provider{unconfigured.length !== 1 ? 's' : ''} need{unconfigured.length === 1 ? 's' : ''} attention</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Missing keys: {unconfigured.map((p) => p.name).join(', ')}
            </p>
          </div>
          <a
            href="https://railway.com/project/a2aabe12-c1fa-4fde-ab33-4b39d3557af9"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Railway Dashboard
          </a>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse" style={{ border: '1.5px solid #e3ddf8', height: 100 }} />
          ))}
        </div>
      )}

      {/* Provider grid grouped by category */}
      {!loading && !error && (
        <div className="space-y-8">
          {ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${CATEGORY_COLOR[cat] ?? '#374151'}15`, color: CATEGORY_COLOR[cat] ?? '#374151' }}>
                  {CATEGORY_ICON[cat]}
                </div>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">{CATEGORY_LABELS[cat] ?? cat}</p>
                <span className="text-[11px] text-gray-400">({grouped[cat]!.length} provider{grouped[cat]!.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[cat]!.map((p) => <ProviderCard key={p.envKey} p={p} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Railway note */}
      {!loading && !error && providers.length > 0 && (
        <div className="mt-8 rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
          <Mic2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-700">How to add or update a key</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Set environment variables in the{' '}
              <a
                href="https://railway.com/project/a2aabe12-c1fa-4fde-ab33-4b39d3557af9"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gray-700 underline hover:text-gray-900"
              >
                Railway dashboard
              </a>
              {' '}→ Variables tab, then redeploy. Keys are never stored in the frontend — they live only in the Railway environment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
