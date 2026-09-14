'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Cpu, Mail, CreditCard,
  Globe, ShieldAlert, ExternalLink, Zap, Video, Loader2, Wifi,
  Pencil, Trash2, Key, X, Eye, EyeOff, Database, Server,
} from 'lucide-react';
import { api, type AdminProviderHealth } from '@/lib/api';

const MOCK_MODE = process.env['NEXT_PUBLIC_USE_MOCK'] === 'true';

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
  STRIPE_SECRET_KEY:   'stripe.com → Developers → API Keys. Also need: STRIPE_WEBHOOK_SECRET (main webhook), STRIPE_CONNECT_WEBHOOK_SECRET (Connect → Webhooks → platform endpoint at /billing/connect/webhook), STRIPE_STARTER_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_AGENCY_PRICE_ID',
  GOOGLE_CLIENT_ID:    'console.cloud.google.com → Credentials → OAuth 2.0',
  FACEBOOK_APP_ID:     'developers.facebook.com → Your App → Settings → Basic',
  YOUTUBE_API_KEY:     'console.cloud.google.com → APIs → YouTube Data API v3 → Credentials',
};

const MOCK_PROVIDERS: AdminProviderHealth[] = [
  { name: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', configured: true,  status: 'active',       source: 'env', category: 'ai' },
  { name: 'OpenAI (GPT-4)',     envKey: 'OPENAI_API_KEY',    configured: false, status: 'unconfigured', source: 'none', category: 'ai' },
  { name: 'Google Gemini',      envKey: 'GEMINI_API_KEY',    configured: true,  status: 'active',       source: 'env', category: 'ai' },
  { name: 'Groq',               envKey: 'GROQ_API_KEY',      configured: true,  status: 'active',       source: 'db',  category: 'ai' },
  { name: 'Google OAuth',       envKey: 'GOOGLE_CLIENT_ID',  configured: true,  status: 'active',       source: 'env', category: 'ai' },
  { name: 'ElevenLabs (Voice)', envKey: 'ELEVENLABS_API_KEY',configured: true,  status: 'active',       source: 'env', category: 'media' },
  { name: 'PiAPI (Kling/Suno)', envKey: 'PIAPI_API_KEY',     configured: true,  status: 'active',       source: 'env', category: 'media' },
  { name: 'Runway ML',          envKey: 'RUNWAYML_API_SECRET',configured: true, status: 'active',       source: 'env', category: 'media' },
  { name: 'Replicate',          envKey: 'REPLICATE_API_TOKEN',configured: false,status: 'unconfigured', source: 'none', category: 'media' },
  { name: 'Stability AI',       envKey: 'STABILITY_API_KEY', configured: false, status: 'unconfigured', source: 'none', category: 'media' },
  { name: 'Pexels (Stock)',     envKey: 'PEXELS_API_KEY',     configured: true,  status: 'active',       source: 'env', category: 'media' },
  { name: 'Pixabay (Stock)',    envKey: 'PIXABAY_API_KEY',    configured: true,  status: 'active',       source: 'env', category: 'media' },
  { name: 'YouTube Data API',   envKey: 'YOUTUBE_API_KEY',   configured: false, status: 'unconfigured', source: 'none', category: 'media' },
  { name: 'Facebook / Meta',    envKey: 'FACEBOOK_APP_ID',   configured: false, status: 'unconfigured', source: 'none', category: 'media' },
  { name: 'Resend (Email)',      envKey: 'RESEND_API_KEY',    configured: true,  status: 'active',       source: 'env', category: 'email' },
  { name: 'Stripe (Payments)',  envKey: 'STRIPE_SECRET_KEY',  configured: true,  status: 'active',       source: 'env', category: 'payment' },
];

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ai:      <Cpu className="w-4 h-4" />,
  media:   <Video className="w-4 h-4" />,
  email:   <Mail className="w-4 h-4" />,
  payment: <CreditCard className="w-4 h-4" />,
  storage: <Globe className="w-4 h-4" />,
};
const CATEGORY_COLOR: Record<string, string> = {
  ai: '#374151', media: '#7c3aed', email: '#0891b2', payment: '#059669', storage: '#d97706',
};
const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI Providers', media: 'Media Generation', email: 'Email', payment: 'Payment Gateway', storage: 'Storage & APIs',
};
const ORDER = ['ai', 'media', 'email', 'payment', 'storage'];

// ── Edit Key Drawer ─────────────────────────────────────────────────────────

interface EditKeyDrawerProps {
  provider: AdminProviderHealth | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditKeyDrawer({ provider: p, onClose, onSaved }: EditKeyDrawerProps) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'failed'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (p) { setValue(''); setShow(false); setTestState('idle'); setTestMsg(''); setError(''); }
  }, [p]);

  useEffect(() => {
    if (p) setTimeout(() => inputRef.current?.focus(), 50);
  }, [p]);

  if (!p) return null;

  const guide = PROVIDER_GUIDES[p.envKey];

  const handleSave = async () => {
    if (!value.trim()) { setError('Key value cannot be empty'); return; }
    setSaving(true); setError('');
    try {
      await api.admin.upsertProviderKey(p.envKey, value.trim());
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove the database override for ${p.envKey}? It will fall back to the Railway env var.`)) return;
    setDeleting(true); setError('');
    try {
      await api.admin.deleteProviderKey(p.envKey);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove key');
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async () => {
    if (!value.trim() && p.source === 'none') { setError('Enter a key value to test'); return; }
    setTestState('testing'); setTestMsg(''); setError('');
    try {
      // If user typed a value, save it first so the test endpoint can use it
      if (value.trim()) await api.admin.upsertProviderKey(p.envKey, value.trim());
      const res = await api.admin.testProvider(p.envKey);
      const d = res.data as { ok: boolean; message: string };
      setTestState(d.ok ? 'ok' : 'failed');
      setTestMsg(d.message);
      if (value.trim()) onSaved(); // refresh health list
    } catch (e: unknown) {
      setTestState('failed');
      setTestMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Test failed');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${CATEGORY_COLOR[p.category] ?? '#374151'}15`, color: CATEGORY_COLOR[p.category] ?? '#374151' }}>
              <Key className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{p.name}</p>
              <p className="text-[11px] font-mono text-gray-400">{p.envKey}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Current source */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {p.source === 'db'
              ? <><Database className="w-3.5 h-3.5 text-brand-500" /> Stored in database (admin-managed)</>
              : p.source === 'env'
                ? <><Server className="w-3.5 h-3.5 text-green-500" /> Set as Railway environment variable</>
                : <><AlertCircle className="w-3.5 h-3.5 text-red-400" /> Not configured</>}
          </div>

          {/* Key input */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">New key value</label>
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(''); }}
                placeholder={p.configured ? '••••••••  (leave blank to keep current)' : 'Paste key here…'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-200 bg-gray-50"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {guide && (
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                Where to get it: <span className="text-gray-600">{guide}</span>
              </p>
            )}
          </div>

          {/* Test result */}
          {testState !== 'idle' && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${testState === 'ok' ? 'bg-green-50 text-green-700' : testState === 'failed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {testState === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" /> : testState === 'ok' ? <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              {testState === 'testing' ? 'Running live test…' : testMsg}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Info box */}
          <div className="rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed" style={{ background: '#f3f4f6', border: '1px solid #e3ddf8' }}>
            <p className="font-semibold text-gray-700 mb-1">How keys are stored</p>
            <p>Keys saved here are AES-256 encrypted in the database and used immediately by the test endpoint. Platform services (AI agents, video generation) continue reading from Railway env vars — update those too for full effect, or use Test to verify the key works.</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving || !value.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: value.trim() ? 'linear-gradient(135deg,#374151,#7c5ae8)' : '#9ca3af' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Save Key
            </button>
            <button
              onClick={() => void handleTest()}
              disabled={testState === 'testing'}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {testState === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              Test
            </button>
          </div>
          {p.source === 'db' && (
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-100 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Remove DB override (revert to env var)
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Provider Card ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: AdminProviderHealth['source'] }) {
  if (source === 'db') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#ede9fe', color: '#5b21b6' }}>
        <Database className="w-2.5 h-2.5" /> DB
      </span>
    );
  }
  if (source === 'env') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#f0fdf4', color: '#166534' }}>
        <Server className="w-2.5 h-2.5" /> ENV
      </span>
    );
  }
  return null;
}

interface ProviderCardProps {
  p: AdminProviderHealth;
  onEdit: (p: AdminProviderHealth) => void;
}

function ProviderCard({ p, onEdit }: ProviderCardProps) {
  const catColor = CATEGORY_COLOR[p.category] ?? '#374151';
  const catIcon = CATEGORY_ICON[p.category];
  const guide = PROVIDER_GUIDES[p.envKey];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-md"
      style={{ border: p.status === 'unconfigured' ? '1.5px solid #fecaca' : '1.5px solid #e3ddf8' }}
    >
      {/* Header */}
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
          {p.status === 'active' ? (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#ecfdf5', color: '#065f46' }}>
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fff1f2', color: '#9f1239' }}>
              <XCircle className="w-3 h-3" /> Not configured
            </span>
          )}
          {p.source !== 'none' && <SourceBadge source={p.source} />}
        </div>
      </div>

      {/* Note */}
      {p.note && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl">{p.note}</p>
      )}

      {/* Guide for unconfigured */}
      {p.status === 'unconfigured' && guide && (
        <div>
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-red-600 hover:text-red-700">
            {expanded ? 'Hide guide ▲' : 'How to get this key ▼'}
          </button>
          {expanded && <p className="mt-1.5 text-xs text-gray-600 leading-relaxed bg-red-50 rounded-xl px-3 py-2">{guide}</p>}
        </div>
      )}

      {/* Actions */}
      <button
        type="button"
        onClick={() => onEdit(p)}
        className="self-start flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
      >
        <Pencil className="w-3 h-3" />
        {p.configured ? 'Update key' : 'Set key'}
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [editing, setEditing] = useState<AdminProviderHealth | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (MOCK_MODE) {
        setProviders(MOCK_PROVIDERS);
        setLastRefreshed(new Date());
        return;
      }
      const res = await api.admin.providerHealth();
      setProviders(Array.isArray(res.data) ? res.data : []);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) { setError('Admin access required (admin:providers permission).'); return; }
      setError((e as Error)?.message ?? 'Failed to load provider health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unconfigured = providers.filter((p) => p.status === 'unconfigured');
  const dbManaged = providers.filter((p) => p.source === 'db');
  const grouped = providers.reduce<Record<string, AdminProviderHealth[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <EditKeyDrawer provider={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />

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
                Monitor, test, and update platform API integrations
                {lastRefreshed && <span className="text-gray-400"> · {lastRefreshed.toLocaleTimeString()}</span>}
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

        {error && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-2xl px-5 py-3 mb-5" style={{ border: '1.5px solid #fecaca' }}>
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Stats row */}
        {!loading && !error && providers.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total providers', value: providers.length, color: '#374151' },
              { label: 'Configured', value: providers.filter((p) => p.configured).length, color: '#059669' },
              { label: 'Needs attention', value: unconfigured.length, color: unconfigured.length > 0 ? '#dc2626' : '#059669' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl px-4 py-3" style={{ border: '1.5px solid #e3ddf8' }}>
                <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Attention banner */}
        {!loading && !error && unconfigured.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 rounded-2xl px-5 py-3 mb-6" style={{ border: '1.5px solid #fde68a' }}>
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">{unconfigured.length} provider{unconfigured.length !== 1 ? 's' : ''} need{unconfigured.length === 1 ? 's' : ''} attention</p>
              <p className="text-xs text-amber-700 mt-0.5">Missing: {unconfigured.map((p) => p.name).join(', ')}</p>
            </div>
            <button
              onClick={() => setEditing(unconfigured[0] ?? null)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              Set first key
            </button>
          </div>
        )}

        {/* DB-managed notice */}
        {!loading && !error && dbManaged.length > 0 && (
          <div className="flex items-center gap-3 bg-purple-50 rounded-2xl px-5 py-3 mb-6" style={{ border: '1.5px solid #ddd6fe' }}>
            <Database className="w-4 h-4 text-purple-500 shrink-0" />
            <p className="text-xs text-purple-700">
              <span className="font-semibold">{dbManaged.length} key{dbManaged.length !== 1 ? 's' : ''}</span> managed via this UI — stored encrypted in the database.
              {' '}To make them available to AI services, also set them in Railway env vars.
            </p>
            <a
              href="https://railway.com/project/e14b31a5-aa68-4bb5-bc8f-60548712207c"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900"
            >
              <ExternalLink className="w-3 h-3" /> Railway
            </a>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse" style={{ border: '1.5px solid #e3ddf8', height: 104 }} />
            ))}
          </div>
        )}

        {/* Provider grid */}
        {!loading && !error && (
          <div className="space-y-8">
            {ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${CATEGORY_COLOR[cat] ?? '#374151'}15`, color: CATEGORY_COLOR[cat] ?? '#374151' }}>
                    {CATEGORY_ICON[cat]}
                  </div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">{CATEGORY_LABELS[cat] ?? cat}</p>
                  <span className="text-[11px] text-gray-400">({grouped[cat]!.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[cat]!.map((p) => <ProviderCard key={p.envKey} p={p} onEdit={setEditing} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Footer note */}
        {!loading && !error && providers.length > 0 && (
          <div className="mt-8 rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: '#f3f4f6', border: '1.5px solid #e3ddf8' }}>
            <Key className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Two ways to manage keys</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                <strong>This UI</strong> — saves AES-256 encrypted to the database; used by Test endpoint immediately.{' '}
                <strong>Railway dashboard</strong> → Variables tab — read by AI services at runtime (requires redeploy to take effect).{' '}
                Set keys in both places for full coverage.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
