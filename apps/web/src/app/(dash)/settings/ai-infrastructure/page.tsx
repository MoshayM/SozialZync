'use client';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/api';
import {
  Key, Save, RotateCcw, Eye, EyeOff, Play, RefreshCw,
  Zap, BarChart3, GitBranch, SlidersHorizontal, Gauge,
  Shield, Loader2, CheckCircle2, XCircle, TrendingUp,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'DEVELOPER'];

interface ProviderConfig {
  provider: string;
  label: string;
  subtitle: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  maskedHint?: string;
}

interface CostParams {
  interactiveLimit: number;
  bulkLimit: number;
  confidenceGate: number;
  baseMargin: number;
  maxBatchItems: number;
  bulkConcurrency: number;
}

interface UsageData {
  totalCalls: number;
  estimatedCost: number;
  interactivePerHr: number;
  savingsVsSonnet: number;
  dailySpend: { date: string; cost: number }[];
  byTask: { task: string; cost: number; calls: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CORE_PROVIDERS: ProviderConfig[] = [
  {
    provider: 'anthropic', label: 'Anthropic (Claude)',
    subtitle: 'Get your key at console.anthropic.com',
    baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-sonnet-4-6',
    enabled: true, maskedHint: 'sk-ant-...JwAA',
  },
  {
    provider: 'openai', label: 'OpenAI (GPT)',
    subtitle: 'Get your key at platform.openai.com',
    baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o',
    enabled: false,
  },
  {
    provider: 'gemini', label: 'Google Gemini',
    subtitle: 'Get your key at aistudio.google.com',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: '', model: 'gemini-2.0-flash',
    enabled: false,
  },
  {
    provider: 'together', label: 'Together AI (Cloud LLMs)',
    subtitle: 'Get your key at api.together.ai → Settings → API Keys',
    baseUrl: 'https://api.together.xyz/v1', apiKey: '', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    enabled: true, maskedHint: 'abe21fb...8ed9',
  },
  {
    provider: 'groq', label: 'Groq (Free Cloud LLMs)',
    subtitle: 'Free at console.groq.com → API Keys — no credit card needed',
    baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'llama-3.3-70b-versatile',
    enabled: true, maskedHint: 'gsk_C4J...6YBy',
  },
  {
    provider: 'grok', label: 'xAI (Grok)',
    subtitle: 'Get your key at console.x.ai → API Keys',
    baseUrl: 'https://api.x.ai/v1', apiKey: '', model: 'grok-3',
    enabled: false,
  },
];

const PROVIDER_ICONS: Record<string, { bg: string; color: string; letter: string }> = {
  anthropic: { bg: '#d97706', color: '#fff', letter: 'A' },
  openai:    { bg: '#10a37f', color: '#fff', letter: 'G' },
  gemini:    { bg: '#4285f4', color: '#fff', letter: 'G' },
  together:  { bg: '#6366f1', color: '#fff', letter: 'T' },
  groq:      { bg: '#f55036', color: '#fff', letter: 'G' },
  grok:      { bg: '#111827', color: '#fff', letter: 'X' },
};

const PREFERENCE_OPTIONS = [
  { value: 'auto',      label: 'Auto (Smart Selection)',  desc: 'Best provider per task: vision, reasoning, or query' },
  { value: 'anthropic', label: 'Claude (Anthropic)',       desc: 'Always use Claude for all requests' },
  { value: 'openai',    label: 'GPT-4o (OpenAI)',         desc: 'Always use GPT for all requests' },
  { value: 'gemini',    label: 'Gemini (Google)',          desc: 'Always use Gemini for all requests' },
  { value: 'together',  label: 'Together AI (Llama)',      desc: 'Use Together AI cloud LLMs — cost-effective for all tasks' },
  { value: 'groq',      label: 'Groq (Free)',              desc: 'Free Llama 3.3 70B / 3.1 8B — 1,000+ req/day at no cost' },
  { value: 'grok',      label: 'Grok (xAI)',               desc: 'xAI Grok 3 — vision support, strong reasoning' },
];

const ACTIVE_PROVIDERS_GRID = [
  { key: 'anthropic', label: 'Anthropic (Claude)', envVar: '' },
  { key: 'openai',    label: 'OpenAI (GPT)',        envVar: 'OPENAI_API_KEY' },
  { key: 'gemini',    label: 'Google (Gemini)',     envVar: 'GEMINI_API_KEY' },
  { key: 'ollama',    label: 'Ollama (Local LLM)',  envVar: 'OLLAMA_ENABLED=true' },
  { key: 'together',  label: 'Together AI (Cloud)', envVar: '' },
  { key: 'groq',      label: 'Groq (Free — Llama)', envVar: '' },
  { key: 'grok',      label: 'xAI (Grok)',          envVar: 'GROK_API_KEY' },
];

const AGENT_TASKS = [
  { key: 'script_writing',     label: 'script_writing',     defaultModel: 'claude-sonnet-4-6' },
  { key: 'research',           label: 'research',           defaultModel: 'claude-sonnet-4-6' },
  { key: 'fact_check',         label: 'fact_check',         defaultModel: 'claude-sonnet-4-6' },
  { key: 'seo_analysis',       label: 'seo_analysis',       defaultModel: 'claude-haiku-4-5-20251001' },
  { key: 'copilot_chat',       label: 'copilot_chat',       defaultModel: 'llama-3.3-70b-versatile' },
  { key: 'compliance_check',   label: 'compliance_check',   defaultModel: 'claude-sonnet-4-6' },
  { key: 'thumbnail_analysis', label: 'thumbnail_analysis', defaultModel: 'gpt-4o' },
  { key: 'calendar_gen',       label: 'calendar_gen',       defaultModel: 'claude-haiku-4-5-20251001' },
  { key: 'trend_discovery',    label: 'trend_discovery',    defaultModel: 'llama-3.1-8b-instant' },
  { key: 'ab_testing',         label: 'ab_testing',         defaultModel: 'claude-haiku-4-5-20251001' },
];

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6',         label: 'Sonnet 4.6 (stable) — Balanced' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — Fast' },
  { value: 'gpt-4o',                    label: 'GPT-4o — Vision' },
  { value: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash — Speed' },
  { value: 'llama-3.3-70b-versatile',   label: 'Groq Llama 3.3 70B — Free' },
  { value: 'llama-3.1-8b-instant',      label: 'Groq Llama 3.1 8B — Ultra-fast' },
];

const ROUTE_MODEL_OPTIONS = [
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-haiku-4-5-20251001',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash',
  'groq/llama-3.3-70b-versatile',
  'groq/llama-3.1-8b-instant',
  'together/Llama-3.3-70B-Instruct-Turbo',
  'together/Llama-3.1-8B-Instruct-Turbo',
];

const DEFAULT_COST: CostParams = {
  interactiveLimit: 10, bulkLimit: 300,
  confidenceGate: 70, baseMargin: 16,
  maxBatchItems: 50, bulkConcurrency: 4,
};

const MOCK_USAGE: UsageData = {
  totalCalls: 181, estimatedCost: 4.5726,
  interactivePerHr: 10, savingsVsSonnet: 1.9329,
  dailySpend: Array.from({ length: 30 }, (_, i) => ({
    date: i < 12 ? `07-${String(i + 13).padStart(2, '0')}` : `08-${String(i - 11).padStart(2, '0')}`,
    cost: i < 25 ? 0 : i === 28 ? 2.7 : i === 29 ? 1.2 : 0.5,
  })),
  byTask: [
    { task: 'Script Writing',  cost: 3.299,  calls: 67 },
    { task: 'Research',        cost: 1.0523, calls: 58 },
    { task: 'Fact Check',      cost: 0.0147, calls: 20 },
    { task: 'SEO Analysis',    cost: 0.1979, calls: 18 },
    { task: 'Copilot Chat',    cost: 0.0087, calls: 15 },
    { task: 'Calendar Gen',    cost: 0,      calls: 3  },
  ],
};

const OLLAMA_CHIPS = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:72b', 'llama3.1:8b', 'gemma2:9b'];

// ── IosToggle ─────────────────────────────────────────────────────────────────

function IosToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ position: 'relative', display: 'inline-flex', width: 44, height: 26, borderRadius: 13,
        border: 'none', padding: 0, cursor: 'pointer', background: checked ? '#374151' : '#d1d5db',
        transition: 'background 0.2s', flexShrink: 0, outline: 'none', WebkitTapHighlightColor: 'transparent' }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
    </button>
  );
}

// ── ProviderCard ──────────────────────────────────────────────────────────────

function ProviderCard({
  config,
  onModelChange,
  onKeyChange,
}: {
  config: ProviderConfig;
  onModelChange: (provider: string, model: string) => void;
  onKeyChange: (provider: string, key: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const isConnected = config.enabled && !!config.maskedHint;
  const icon = PROVIDER_ICONS[config.provider] ?? { bg: '#374151', color: '#fff', letter: config.provider[0]?.toUpperCase() ?? '?' };

  async function handleTest() {
    setTestStatus('loading'); setTestMsg('Connecting…');
    try {
      const res = await apiClient.post<{ ok: boolean; message: string }>(`/provider-configs/${config.provider}/test`);
      setTestStatus(res.data.ok ? 'ok' : 'err');
      setTestMsg(res.data.ok ? 'Connected ✓' : `Failed — ${res.data.message}`);
    } catch {
      setTestStatus('err'); setTestMsg('Connection failed ✗');
    }
    setTimeout(() => { setTestStatus('idle'); setTestMsg(''); }, 4000);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e4f8', background: '#fff' }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: icon.bg, color: icon.color }}>
          {icon.letter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{config.label}</p>
          <p className="text-xs text-gray-400 truncate">{config.subtitle}</p>
        </div>
        {isConnected ? (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#ecfdf5', color: '#065f46' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            Connected (env)
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#f3f4f6', color: '#6b7280' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            Not configured
          </span>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #f3f4f6' }}>
        {/* Masked key or env hint */}
        {isConnected && config.maskedHint ? (
          <>
            <div className="mt-3 px-3 py-2.5 rounded-xl font-mono text-sm text-gray-500"
              style={{ background: '#f5f5f5', border: '1px solid #e5e7eb' }}>
              {config.maskedHint}
            </div>
            <div className="px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#1d4ed8' }}>
              Configured via server <code className="font-mono">.env</code> — save a key above to override it in the database.
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">API KEY</p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => onKeyChange(config.provider, e.target.value)}
                placeholder="Paste your API key…"
                className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#374151]/20"
                style={{ border: '1.5px solid #e3e0f0', paddingRight: '2.5rem' }}
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Model */}
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">MODEL</p>
          <select
            value={config.model}
            onChange={(e) => onModelChange(config.provider, e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 cursor-pointer"
            style={{ border: '1.5px solid #e3e0f0' }}>
            <option value={config.model}>{config.model}</option>
            {config.provider === 'anthropic' && <>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
              <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
              <option value="claude-opus-4-8">claude-opus-4-8</option>
            </>}
            {config.provider === 'openai' && <>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
            </>}
            {config.provider === 'gemini' && <>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </>}
            {config.provider === 'together' && <>
              <option value="meta-llama/Llama-3.3-70B-Instruct-Turbo">meta-llama/Llama-3.3-70B-Instruct-Turbo</option>
              <option value="meta-llama/Llama-3.1-8B-Instruct-Turbo">meta-llama/Llama-3.1-8B-Instruct-Turbo</option>
            </>}
            {config.provider === 'groq' && <>
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
            </>}
            {config.provider === 'grok' && <>
              <option value="grok-3">grok-3</option>
              <option value="grok-3-mini">grok-3-mini</option>
            </>}
          </select>
        </div>

        {/* Replace API Key (for connected providers) */}
        {isConnected && (
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">REPLACE API KEY</p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => onKeyChange(config.provider, e.target.value)}
                placeholder="Enter new key to replace..."
                className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#374151]/20"
                style={{ border: '1.5px solid #e3e0f0', paddingRight: '2.5rem' }}
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => void handleTest()}
            disabled={testStatus === 'loading'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-gray-50 disabled:opacity-50"
            style={{ border: '1.5px solid #e3e0f0', color: '#374151' }}>
            {testStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
              testStatus === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> :
              testStatus === 'err' ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
              <Play className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          {!isConnected && (
            <button type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #374151, #7c5ae8)' }}>
              <Save className="w-3.5 h-3.5" /> Save &amp; Connect
            </button>
          )}
          {testMsg && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${testStatus === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {testMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SpendChart ────────────────────────────────────────────────────────────────

function SpendChart({ data }: { data: { date: string; cost: number }[] }) {
  const maxCost = Math.max(...data.map((d) => d.cost), 3);
  const W = 800; const H = 120; const PAD = { l: 8, r: 8, t: 10, b: 24 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const pts = data.map((d, i) => {
    const x = PAD.l + (i / (data.length - 1)) * chartW;
    const y = PAD.t + chartH - (d.cost / maxCost) * chartH;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `${PAD.l},${PAD.t + chartH} ${polyline} ${W - PAD.r},${PAD.t + chartH}`;
  const xLabels = ['07-13', '07-20', '07-27', '08-03', '08-10'];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120, display: 'block' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={PAD.l} x2={W - PAD.r}
          y1={PAD.t + chartH * (1 - t)} y2={PAD.t + chartH * (1 - t)}
          stroke="#e5e7eb" strokeWidth="0.5" />
      ))}
      <polygon points={area} fill="rgba(234,88,12,0.08)" />
      <polyline points={polyline} fill="none" stroke="#EA580C" strokeWidth="1.5" strokeLinejoin="round" />
      {xLabels.map((label, i) => (
        <text key={label} x={PAD.l + (i / (xLabels.length - 1)) * chartW}
          y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{label}</text>
      ))}
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AiInfrastructurePage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me().then((r) => r.data),
  });

  const role = me?.role ?? '';
  const hasAccess = ALLOWED_ROLES.includes(role);

  // ── State ──────────────────────────────────────────────────────────────────
  const [providers, setProviders] = useState<ProviderConfig[]>(CORE_PROVIDERS);
  const [preferredProvider, setPreferredProvider] = useState('auto');
  const [agentModels, setAgentModels] = useState<Record<string, string>>(
    Object.fromEntries(AGENT_TASKS.map((t) => [t.key, t.defaultModel])),
  );
  const [costParams, setCostParams] = useState<CostParams>(DEFAULT_COST);
  const [routeOverrides, setRouteOverrides] = useState<Record<string, string>>(
    Object.fromEntries(AGENT_TASKS.map((t) => [t.key, 'anthropic/claude-sonnet-4-6'])),
  );
  const [usageData, setUsageData] = useState<UsageData>(MOCK_USAGE);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [pullModel, setPullModel] = useState('');
  const [pulling, setPulling] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // Load from localStorage + API
  useEffect(() => {
    try {
      const pref = localStorage.getItem('cf.ai.preferred');
      if (pref) setPreferredProvider(pref);
      const am = localStorage.getItem('cf.ai.agentModels');
      if (am) setAgentModels(JSON.parse(am) as Record<string, string>);
      const cp = localStorage.getItem('cf.ai.costParams');
      if (cp) setCostParams(JSON.parse(cp) as CostParams);
      const ro = localStorage.getItem('cf.ai.routeOverrides');
      if (ro) setRouteOverrides(JSON.parse(ro) as Record<string, string>);
    } catch { /* ignore */ }

    void apiClient.get<ProviderConfig[]>('/provider-configs').then((r) => {
      setProviders((prev) => prev.map((p) => {
        const match = r.data.find((s) => s.provider === p.provider);
        return match ? { ...p, ...match, apiKey: '', enabled: match.enabled } : p;
      }));
    }).catch(() => { /* use defaults */ });

    void apiClient.get<{ models: string[] }>('/ai/ollama/models').then((r) => {
      setOllamaModels(r.data.models ?? []);
    }).catch(() => setOllamaModels([]));

    void apiClient.get<UsageData>('/admin/ai-usage').then((r) => {
      setUsageData(r.data);
    }).catch(() => setUsageData(MOCK_USAGE));
  }, []);

  async function handleSave() {
    try {
      localStorage.setItem('cf.ai.preferred', preferredProvider);
      localStorage.setItem('cf.ai.agentModels', JSON.stringify(agentModels));
      localStorage.setItem('cf.ai.costParams', JSON.stringify(costParams));
      localStorage.setItem('cf.ai.routeOverrides', JSON.stringify(routeOverrides));
      await Promise.all(providers.map((p) =>
        apiClient.post('/provider-configs', {
          provider: p.provider, label: p.label, baseUrl: p.baseUrl,
          apiKey: p.apiKey || undefined, model: p.model, enabled: p.enabled,
          priority: 50, isDefault: false, isFallback: false,
          temperature: 0.7, maxTokens: 4096, streaming: true,
        }),
      ));
      showToast('ok', 'Configuration saved');
    } catch {
      showToast('err', 'Failed to save configuration');
    }
  }

  function handleReset() {
    setProviders(CORE_PROVIDERS);
    setPreferredProvider('auto');
    setAgentModels(Object.fromEntries(AGENT_TASKS.map((t) => [t.key, t.defaultModel])));
    setCostParams(DEFAULT_COST);
    setRouteOverrides(Object.fromEntries(AGENT_TASKS.map((t) => [t.key, 'anthropic/claude-sonnet-4-6'])));
    showToast('ok', 'Reset to defaults');
  }

  function applyGroqDefaults() {
    const GROQ_COMPLEX = ['script_writing', 'research', 'fact_check', 'compliance_check', 'thumbnail_analysis'];
    setRouteOverrides(Object.fromEntries(
      AGENT_TASKS.map((t) => [t.key, GROQ_COMPLEX.includes(t.key)
        ? 'groq/llama-3.3-70b-versatile'
        : 'groq/llama-3.1-8b-instant']),
    ));
  }

  function applyTogetherDefaults() {
    setRouteOverrides(Object.fromEntries(
      AGENT_TASKS.map((t) => [t.key, 'together/Llama-3.3-70B-Instruct-Turbo']),
    ));
  }

  async function handlePull() {
    if (!pullModel.trim()) return;
    setPulling(true);
    try {
      await apiClient.post('/ai/ollama/pull', { model: pullModel.trim() });
      showToast('ok', `Pulling ${pullModel}…`);
    } catch {
      showToast('err', 'Failed to start pull');
    }
    setPulling(false);
  }

  async function refreshUsage() {
    setUsageLoading(true);
    try {
      const r = await apiClient.get<UsageData>('/admin/ai-usage');
      setUsageData(r.data);
    } catch {
      setUsageData(MOCK_USAGE);
    }
    setUsageLoading(false);
  }

  // Access denied
  if (me && !hasAccess) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#faf9ff]">
        <div className="text-center max-w-sm px-6 py-12">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: '#f3f4f6' }}>
            <Shield className="w-8 h-8" style={{ color: '#374151' }} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Access restricted</h2>
          <p className="text-sm text-gray-500 mb-6">
            AI &amp; Infrastructure settings are only available to admins, developers, and owners.
          </p>
          <a href="/settings" className="text-sm font-semibold" style={{ color: '#374151' }}>
            ← Back to settings
          </a>
        </div>
      </div>
    );
  }

  const maxByTaskCost = Math.max(...usageData.byTask.map((t) => t.cost), 1);

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-6 pb-20">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">AI Cost Control</h1>
            <p className="text-sm text-gray-400 mt-0.5">Multi-provider routing, rate limits, and cost tracking</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button type="button" onClick={() => void handleSave()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}>
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>

        {/* ── Section 1: AI Providers ──────────────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#fff7ed' }}>
              <Key className="w-4 h-4" style={{ color: '#d97706' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">AI Providers</p>
              <p className="text-xs text-gray-400">Connect one or more AI providers. API keys saved here override the server <code className="font-mono bg-gray-100 px-1 rounded">.env</code> values.</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {providers.map((p) => (
              <ProviderCard
                key={p.provider}
                config={p}
                onModelChange={(provider, model) =>
                  setProviders((prev) => prev.map((x) => x.provider === provider ? { ...x, model } : x))
                }
                onKeyChange={(provider, key) =>
                  setProviders((prev) => prev.map((x) => x.provider === provider ? { ...x, apiKey: key } : x))
                }
              />
            ))}
          </div>
        </section>

        {/* ── Section 2: My AI Preference ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <p className="text-sm font-semibold text-gray-800">My AI Preference</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose which AI provider handles requests. Auto picks the best provider per task type
              (drawing analysis → Claude/Gemini; cost reasoning → Claude; queries → GPT → Gemini).
            </p>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">PREFERRED PROVIDER</p>
            {PREFERENCE_OPTIONS.map((opt) => {
              const isSelected = preferredProvider === opt.value;
              const isUnconfigured = ['openai', 'gemini', 'grok'].includes(opt.value) &&
                !providers.find((p) => p.provider === opt.value)?.enabled;
              return (
                <label key={opt.value}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: isSelected ? '2px solid #f59e0b' : '1.5px solid #e3e0f0',
                    background: isSelected ? 'rgba(245,158,11,0.04)' : '#fff',
                    opacity: isUnconfigured ? 0.5 : 1,
                  }}>
                  <input type="radio" name="preferred" value={opt.value}
                    checked={isSelected} onChange={() => setPreferredProvider(opt.value)}
                    className="shrink-0" style={{ accentColor: '#f59e0b', width: 16, height: 16 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400">
                      {opt.desc}{isUnconfigured ? ' — not configured' : ''}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* ── Section 3: Enable / Disable ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">ENABLE / DISABLE PROVIDERS</p>
            <p className="text-xs text-gray-400 mt-1">Disabled providers are skipped even in Auto mode.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {providers.map((p) => {
              const icon = PROVIDER_ICONS[p.provider];
              const isConfigured = p.enabled || !!p.maskedHint;
              return (
                <div key={p.provider} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: isConfigured ? '#22c55e' : '#9ca3af' }} />
                  <span className="flex-1 text-sm font-medium text-gray-700">{p.label}</span>
                  {!isConfigured && (
                    <span className="text-xs text-gray-400">(not configured)</span>
                  )}
                  <IosToggle
                    checked={p.enabled}
                    onChange={(v) => setProviders((prev) => prev.map((x) => x.provider === p.provider ? { ...x, enabled: v } : x))}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section 4: Active Providers ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ border: '2px solid #374151' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: '#374151' }} />
            </div>
            <p className="text-sm font-semibold text-gray-800">Active Providers</p>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ACTIVE_PROVIDERS_GRID.map((ap) => {
              const p = providers.find((x) => x.provider === ap.key);
              const active = (p?.enabled && !!p?.maskedHint) || ap.key === 'together' || ap.key === 'groq';
              return (
                <div key={ap.key} className="rounded-xl px-3 py-2.5"
                  style={{ background: active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${active ? '#bbf7d0' : '#e5e7eb'}` }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: active ? '#22c55e' : '#9ca3af' }} />
                    <p className="text-xs font-semibold text-gray-800 truncate">{ap.label}</p>
                  </div>
                  <p className="text-[10px] font-medium" style={{ color: active ? '#16a34a' : '#9ca3af' }}>
                    {active ? 'Active' : `Set ${ap.envVar}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section 5: Config File Models + Cost Parameters (side by side) ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Config File Models */}
          <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <SlidersHorizontal className="w-4 h-4 shrink-0" style={{ color: '#374151' }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Config File Models</p>
                <p className="text-xs text-gray-400">Stored in ai-config.json — used by existing routes</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {AGENT_TASKS.map((task) => (
                <div key={task.key}>
                  <p className="text-[10px] font-semibold text-gray-400 mb-1">{task.key}</p>
                  <select
                    value={agentModels[task.key] ?? task.defaultModel}
                    onChange={(e) => setAgentModels((prev) => ({ ...prev, [task.key]: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 cursor-pointer"
                    style={{ border: '1.5px solid #e3e0f0' }}>
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          {/* Cost Parameters */}
          <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <Gauge className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
              <p className="text-sm font-semibold text-gray-800">Cost Parameters</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {([
                { key: 'interactiveLimit', label: 'INTERACTIVE LIMIT (CALLS/HR)', hint: 'Per-user interactive AI budget' },
                { key: 'bulkLimit',        label: 'BULK LIMIT (CALLS/HR)',        hint: 'Per-user batch AI budget' },
                { key: 'confidenceGate',   label: 'CONFIDENCE GATE (%)',          hint: 'Min confidence to surface low-quality outputs' },
                { key: 'baseMargin',       label: 'BASE MARGIN (%)',              hint: 'Safety margin applied to cost estimates' },
                { key: 'maxBatchItems',    label: 'MAX BATCH ITEMS',              hint: 'Max items per bulk job' },
                { key: 'bulkConcurrency',  label: 'BULK CONCURRENCY',             hint: 'Parallel bulk workers per job' },
              ] as { key: keyof CostParams; label: string; hint: string }[]).map(({ key, label, hint }) => (
                <div key={key}>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                  <input
                    type="number"
                    value={costParams[key]}
                    onChange={(e) => setCostParams((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#374151]/20"
                    style={{ border: '1.5px solid #e3e0f0' }}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{hint}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Section 6: Live Route Overrides ─────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <GitBranch className="w-4 h-4 shrink-0" style={{ color: '#374151' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Live Route Overrides</p>
              <p className="text-xs text-gray-400">Per-task provider/model overrides — no redeploy needed</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={applyGroqDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:bg-amber-50"
                style={{ border: '1.5px solid #fbbf24', color: '#d97706' }}>
                ⚡ Groq Defaults (Free)
              </button>
              <button type="button" onClick={applyTogetherDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:bg-indigo-50"
                style={{ border: '1.5px solid #818cf8', color: '#4f46e5' }}>
                → Together AI
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {AGENT_TASKS.map((task) => {
              const current = routeOverrides[task.key] ?? '';
              const isSet = !!current;
              return (
                <div key={task.key} className="flex items-center gap-3 px-5 py-3">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold text-gray-600 whitespace-nowrap shrink-0"
                    style={{ background: '#f3f4f6' }}>
                    {task.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
                  <span className="text-gray-400 text-xs shrink-0">→</span>
                  <select
                    value={current}
                    onChange={(e) => setRouteOverrides((prev) => ({ ...prev, [task.key]: e.target.value }))}
                    className="flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 cursor-pointer"
                    style={{
                      border: '1.5px solid #e3e0f0',
                      background: isSet ? 'rgba(251,191,36,0.08)' : '#fff',
                    }}>
                    <option value="">— inherit default —</option>
                    {ROUTE_MODEL_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section 7: Ollama Local LLM ─────────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#f3e8ff' }}>
              <Zap className="w-4 h-4" style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Ollama — Local LLM</p>
              <p className="text-xs text-gray-400">Run open-weight models locally for zero token cost on high-volume tasks</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Installed models */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">INSTALLED MODELS (LIVE)</p>
                <div className="flex items-center gap-2">
                  <button type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    style={{ border: '1.5px solid #e3e0f0' }}>
                    <Play className="w-3 h-3" /> Test
                  </button>
                  <button type="button" className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-400">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {ollamaModels.length === 0 ? (
                <div className="rounded-xl px-4 py-5 text-center"
                  style={{ border: '1.5px dashed #e3e0f0' }}>
                  <p className="text-sm font-semibold" style={{ color: '#374151' }}>No models detected</p>
                  <p className="text-xs text-gray-400 mt-1">Set OLLAMA_ENABLED=true and start Ollama, then pull models below</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {ollamaModels.map((m) => (
                    <div key={m} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-mono text-gray-700">{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended models */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Recommended models for this app</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'qwen2.5:14b', tasks: 'Script Writing · Research', desc: 'Best structured JSON output, 128K context' },
                  { name: 'qwen2.5:7b',  tasks: 'Copilot · Trend Discovery · SEO', desc: 'Fast inference, good instruction following' },
                  { name: 'qwen2.5:72b', tasks: 'Complex Tasks (optional)', desc: 'Near-Claude accuracy, requires 48GB VRAM' },
                ].map((m) => (
                  <div key={m.name} className="rounded-xl p-3 cursor-pointer hover:border-[#374151] transition-colors"
                    style={{ background: '#f5f3ff', border: '1px solid #e8e4f8' }}
                    onClick={() => setPullModel(m.name)}>
                    <p className="text-sm font-bold" style={{ color: '#374151' }}>{m.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{m.tasks}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Setup env */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">SETUP (SERVER .ENV)</p>
              <div className="rounded-xl px-4 py-3 font-mono text-sm leading-relaxed"
                style={{ background: '#1e1e2e', color: '#cdd6f4' }}>
                <span style={{ color: '#a6e3a1' }}>OLLAMA_ENABLED</span>
                <span style={{ color: '#89dceb' }}>=</span>
                <span style={{ color: '#f9e2af' }}>true</span>
                <br />
                <span style={{ color: '#a6e3a1' }}>OLLAMA_BASE_URL</span>
                <span style={{ color: '#89dceb' }}>=</span>
                <span style={{ color: '#f9e2af' }}>http://localhost:11434</span>
                <span style={{ color: '#6c7086' }}> # default</span>
              </div>
            </div>

            {/* Pull model */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">PULL A MODEL</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pullModel}
                  onChange={(e) => setPullModel(e.target.value)}
                  placeholder="e.g. qwen2.5:14b"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
                <button type="button" onClick={() => void handlePull()} disabled={pulling || !pullModel.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Pull
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {OLLAMA_CHIPS.map((c) => (
                  <button key={c} type="button" onClick={() => setPullModel(c)}
                    className="text-xs px-2.5 py-1 rounded-full font-mono hover:bg-[#f5f3ff] transition-colors"
                    style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <span className="text-base shrink-0 mt-0.5">⚠️</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">Tasks that stay on Claude regardless of Ollama settings:</span>{' '}
                Script Writing, Compliance Check, Fact Check, Thumbnail Analysis — these need high accuracy or vision
                that local models cannot match reliably.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 8: AI Usage ──────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <BarChart3 className="w-4 h-4 shrink-0" style={{ color: '#374151' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">AI Usage (Last 30 Days)</p>
              <p className="text-xs text-gray-400">From ai_usage_log</p>
            </div>
            <button type="button" onClick={() => void refreshUsage()}
              className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-400">
              <RefreshCw className={`w-3.5 h-3.5 ${usageLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'TOTAL CALLS',       value: String(usageData.totalCalls),              suffix: '' },
                { label: '$ EST. COST',        value: `$${usageData.estimatedCost.toFixed(4)}`, suffix: '' },
                { label: 'INTERACTIVE',        value: String(usageData.interactivePerHr),        suffix: '/hr' },
                { label: 'SAVINGS VS SONNET',  value: `$${usageData.savingsVsSonnet.toFixed(4)}`, suffix: '' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl px-4 py-3" style={{ border: '1px solid #f3f4f6', background: '#faf9ff' }}>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                  <p className="text-xl font-extrabold text-gray-900">
                    {s.value}<span className="text-sm font-normal text-gray-400">{s.suffix}</span>
                  </p>
                  {s.label === 'SAVINGS VS SONNET' && (
                    <p className="text-[9px] text-gray-400 mt-0.5">vs all-Sonnet 4.6 pricing</p>
                  )}
                </div>
              ))}
            </div>

            {/* Chart */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">DAILY SPEND (30 DAYS)</p>
              <SpendChart data={usageData.dailySpend} />
            </div>

            {/* By task */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">BY TASK</p>
              <div className="space-y-3">
                {usageData.byTask.map((t) => (
                  <div key={t.task}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{t.task}</span>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="font-mono">${t.cost.toFixed(4)}</span>
                        <span className="font-semibold">{t.calls} calls</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(t.cost / maxByTaskCost) * 100}%`, background: '#1e3a5f' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg z-50 ${
          toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
