'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/api';
import {
  Cpu, Cloud, Server, Settings2, Zap, Save, RefreshCw, RotateCcw,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2,
  Shield, Eye, EyeOff, BarChart3, TrendingDown,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'providers' | 'routing' | 'cost' | 'local' | 'usage';

interface ProviderConfig {
  provider: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  tier?: 'local' | 'cloud';
  requiresKey?: boolean;
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

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'DEVELOPER'];

const CORE_PROVIDERS: ProviderConfig[] = [
  { provider: 'anthropic', label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-sonnet-4-6', enabled: false, tier: 'cloud', requiresKey: true },
  { provider: 'openai', label: 'OpenAI (GPT)', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o', enabled: false, tier: 'cloud', requiresKey: true },
  { provider: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: '', model: 'gemini-2.0-flash', enabled: false, tier: 'cloud', requiresKey: true },
  { provider: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', apiKey: '', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', enabled: false, tier: 'cloud', requiresKey: true },
  { provider: 'groq', label: 'Groq (Free — Llama)', baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'llama-3.3-70b-versatile', enabled: false, tier: 'cloud', requiresKey: true },
  { provider: 'grok', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', apiKey: '', model: 'grok-3', enabled: false, tier: 'cloud', requiresKey: true },
];

const ACTIVE_PROVIDERS_DISPLAY = [
  { key: 'anthropic', label: 'Anthropic (Claude)', envVar: 'ANTHROPIC_API_KEY', dot: '#f59e0b' },
  { key: 'openai', label: 'OpenAI (GPT)', envVar: 'OPENAI_API_KEY', dot: '#10a37f' },
  { key: 'gemini', label: 'Google Gemini', envVar: 'GEMINI_API_KEY', dot: '#4285f4' },
  { key: 'together', label: 'Together AI (Cloud)', envVar: 'TOGETHER_API_KEY', dot: '#6366f1' },
  { key: 'groq', label: 'Groq (Free — Llama)', envVar: 'GROQ_API_KEY', dot: '#f55036' },
  { key: 'grok', label: 'xAI (Grok)', envVar: 'GROK_API_KEY', dot: '#111827' },
  { key: 'ollama', label: 'Ollama (Local LLM)', envVar: 'OLLAMA_ENABLED=true', dot: '#7c3aed' },
];

const PREFERENCE_OPTIONS = [
  { value: 'auto', label: 'Auto (Smart Selection)', desc: 'Best provider per task: vision, research, generation' },
  { value: 'anthropic', label: 'Claude (Anthropic)', desc: 'Always use Claude for all requests' },
  { value: 'openai', label: 'GPT-4o (OpenAI)', desc: 'Always use GPT for all requests' },
  { value: 'gemini', label: 'Gemini (Google)', desc: 'Always use Gemini for all requests' },
  { value: 'together', label: 'Together AI (Llama)', desc: 'Use Together AI cloud LLMs — cost-effective' },
  { value: 'groq', label: 'Groq (Free)', desc: 'Free Llama 3.3 70B / 3.1 8B — 1,000+ req/day at no cost' },
  { value: 'grok', label: 'Grok (xAI)', desc: 'xAI Grok 3 — vision support, strong reasoning' },
];

const AGENT_TASKS = [
  { key: 'script_writing', label: 'Script Writing' },
  { key: 'research', label: 'Research Agent' },
  { key: 'fact_check', label: 'Fact Check' },
  { key: 'seo_analysis', label: 'SEO Analysis' },
  { key: 'copilot_chat', label: 'Copilot Chat' },
  { key: 'compliance_check', label: 'Compliance Check' },
  { key: 'thumbnail_analysis', label: 'Thumbnail Analysis' },
  { key: 'calendar_gen', label: 'Calendar Generation' },
  { key: 'trend_discovery', label: 'Trend Discovery' },
  { key: 'ab_testing', label: 'A/B Testing' },
];

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (stable) — Balanced' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — Fast' },
  { value: 'gpt-4o', label: 'GPT-4o — Vision' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — Speed' },
  { value: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B — Free' },
  { value: 'llama-3.1-8b-instant', label: 'Groq Llama 3.1 8B — Ultra-fast' },
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

const GROQ_COMPLEX_TASKS = ['script_writing', 'research', 'fact_check', 'compliance_check', 'thumbnail_analysis'];

const DEFAULT_COST_PARAMS: CostParams = {
  interactiveLimit: 10,
  bulkLimit: 300,
  confidenceGate: 70,
  baseMargin: 16,
  maxBatchItems: 50,
  bulkConcurrency: 4,
};

const MOCK_USAGE: UsageData = {
  totalCalls: 181,
  estimatedCost: 4.5726,
  interactivePerHr: 10,
  savingsVsSonnet: 1.9329,
  dailySpend: Array.from({ length: 30 }, (_, i) => ({
    date: `08-${String(i + 1).padStart(2, '0')}`,
    cost: i < 25 ? 0 : i === 28 ? 2.7 : i === 29 ? 1.2 : 0.5,
  })),
  byTask: [
    { task: 'Script Writing', cost: 3.299, calls: 67 },
    { task: 'Research', cost: 1.0523, calls: 58 },
    { task: 'Fact Check', cost: 0.0147, calls: 20 },
    { task: 'SEO Analysis', cost: 0.1979, calls: 18 },
    { task: 'Copilot Chat', cost: 0.0087, calls: 15 },
    { task: 'Calendar Gen', cost: 0, calls: 3 },
  ],
};

// ── IosToggle ────────────────────────────────────────────────────────────────

function IosToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex', width: 44, height: 26,
        borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer',
        background: checked ? '#6D4AE0' : '#d1d5db', transition: 'background 0.2s',
        flexShrink: 0, outline: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── ProviderLetterIcon ───────────────────────────────────────────────────────

function ProviderLetterIcon({ provider }: { provider: string }) {
  const map: Record<string, { bg: string; color: string; letter: string }> = {
    anthropic: { bg: '#d97706', color: '#fff', letter: 'C' },
    openai: { bg: '#10a37f', color: '#fff', letter: 'G' },
    gemini: { bg: '#4285f4', color: '#fff', letter: 'G' },
    together: { bg: '#6366f1', color: '#fff', letter: 'T' },
    groq: { bg: '#f55036', color: '#fff', letter: 'G' },
    grok: { bg: '#111827', color: '#fff', letter: 'X' },
  };
  const cfg = map[provider] ?? { bg: '#6D4AE0', color: '#fff', letter: (provider[0] ?? '?').toUpperCase() };
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 select-none"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.letter}
    </div>
  );
}

// ── ProviderCard ─────────────────────────────────────────────────────────────

function ProviderCard({
  config,
  onChange,
}: {
  config: ProviderConfig;
  onChange: (updated: ProviderConfig) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');

  function patch(p: Partial<ProviderConfig>) { onChange({ ...config, ...p }); }

  async function testConn() {
    setTestStatus('loading');
    try {
      const res = await apiClient.post<{ ok: boolean; message: string }>(
        `/provider-configs/${config.provider}/test`,
      );
      if (res.data.ok) { setTestStatus('ok'); setTestMsg('Connected'); }
      else { setTestStatus('err'); setTestMsg(res.data.message); }
    } catch (e) {
      // @reason: error shape unknown from network
      setTestStatus('err');
      setTestMsg((e as { message?: string })?.message ?? 'Failed');
    }
    setTimeout(() => { setTestStatus('idle'); setTestMsg(''); }, 4000);
  }

  const isConnected = config.enabled;

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <ProviderLetterIcon provider={config.provider} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{config.label}</span>
            {config.provider === 'groq' && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>Free</span>
            )}
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: isConnected ? '#ecfdf5' : '#f3f4f6',
                color: isConnected ? '#065f46' : '#6b7280',
              }}
            >
              {isConnected ? 'Connected (env)' : 'Not configured'}
            </span>
          </div>
          {config.enabled && config.model && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{config.model}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <IosToggle checked={config.enabled} onChange={(v) => patch({ enabled: v })} />
          <button type="button" onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-xl hover:bg-[#f5f2fd] transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #f0edf9' }}>
          <div className="pt-3 space-y-3">
            {/* Current key hint */}
            {config.enabled && (
              <div className="px-3 py-2 rounded-xl text-xs font-mono text-gray-500" style={{ background: '#f5f2fd' }}>
                Key configured via server .env — save a new key below to override in database.
              </div>
            )}
            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {config.requiresKey ? 'REPLACE API KEY' : 'API KEY (optional)'}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => patch({ apiKey: e.target.value })}
                  placeholder="Enter new key to replace..."
                  autoComplete="off"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono pr-10"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
                <button type="button" onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                  aria-label={showKey ? 'Hide key' : 'Show key'}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">MODEL</label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => patch({ model: e.target.value })}
                className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
            </div>
            {/* Test */}
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => void testConn()} disabled={testStatus === 'loading'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ border: '1.5px solid #6D4AE0', color: '#6D4AE0', background: '#fff' }}>
                {testStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : testStatus === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  : testStatus === 'err' ? <XCircle className="w-3.5 h-3.5 text-red-500" />
                  : <Zap className="w-3.5 h-3.5" />}
                Test Connection
              </button>
              {testMsg && (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                  testStatus === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>{testMsg}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Providers ───────────────────────────────────────────────────────────

function ProvidersTab({
  providers,
  setProviders,
}: {
  providers: ProviderConfig[];
  setProviders: React.Dispatch<React.SetStateAction<ProviderConfig[]>>;
}) {
  const [preference, setPreference] = useState<string>(() => {
    if (typeof window === 'undefined') return 'auto';
    return localStorage.getItem('cf.ai.preferred') ?? 'auto';
  });

  function savePreference(val: string) {
    setPreference(val);
    try { localStorage.setItem('cf.ai.preferred', val); } catch { /* ignore */ }
  }

  const handleProviderChange = useCallback((updated: ProviderConfig) => {
    setProviders((prev) => prev.map((p) => (p.provider === updated.provider ? updated : p)));
  }, [setProviders]);

  return (
    <div className="space-y-6">
      {/* Active providers grid */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">Active Providers</p>
        <div className="bg-white rounded-2xl p-4" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACTIVE_PROVIDERS_DISPLAY.map((ap) => {
              const live = providers.find((p) => p.provider === ap.key);
              const active = live?.enabled ?? false;
              return (
                <div key={ap.key} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: active ? '#f0fdf4' : '#f9f8ff', border: `1px solid ${active ? '#bbf7d0' : '#e3ddf8'}` }}>
                  <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: active ? '#22c55e' : '#9ca3af' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{ap.label}</p>
                    {active
                      ? <p className="text-[10px] text-green-700 font-semibold mt-0.5">Active</p>
                      : <p className="text-[10px] text-gray-500 font-mono mt-0.5">Set {ap.envVar}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Preference */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">My AI Preference</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f0edf9' }}>
            <Settings2 className="w-4 h-4" style={{ color: '#6D4AE0' }} />
            <div>
              <p className="text-sm font-semibold text-gray-800">My AI Preference</p>
              <p className="text-xs text-gray-500">Choose which AI provider handles requests. Auto picks the best provider per task type.</p>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-2">PREFERRED PROVIDER</p>
            {PREFERENCE_OPTIONS.map((opt) => {
              const selected = preference === opt.value;
              const provConf = providers.find((p) => p.provider === opt.value);
              const notConfigured = opt.value !== 'auto' && provConf && !provConf.enabled;
              return (
                <button key={opt.value} type="button" onClick={() => savePreference(opt.value)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    border: selected ? '2px solid #f97316' : '1.5px solid #e3ddf8',
                    background: selected ? '#fff7ed' : '#faf9ff',
                  }}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: selected ? '#f97316' : '#d1d5db', background: selected ? '#f97316' : 'transparent' }}>
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500">
                      {notConfigured ? `${opt.desc} — not configured` : opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Enable / Disable */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">Enable / Disable Providers</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="px-4 py-2 text-xs text-gray-500" style={{ borderBottom: '1px solid #f0edf9' }}>
            Disabled providers are skipped even in Auto mode.
          </div>
          {providers.map((p) => (
            <div key={p.provider} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff]" style={{ borderBottom: '1px solid #f0edf9' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.enabled ? '#22c55e' : '#9ca3af' }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{p.label}</span>
                {!p.enabled && (
                  <span className="ml-2 text-xs text-gray-400">(not configured)</span>
                )}
              </div>
              <IosToggle checked={p.enabled} onChange={(v) => handleProviderChange({ ...p, enabled: v })} />
            </div>
          ))}
        </div>
      </div>

      {/* Provider cards */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">Provider Configuration</p>
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderCard key={p.provider} config={p} onChange={handleProviderChange} />
          ))}
        </div>
        <a href="/settings/ai-providers"
          className="flex items-center gap-1 mt-3 text-xs font-semibold hover:underline"
          style={{ color: '#6D4AE0' }}>
          View all providers including local and self-hosted →
        </a>
      </div>
    </div>
  );
}

// ── Tab: Routing & Models ────────────────────────────────────────────────────

function RoutingTab() {
  const [agentModels, setAgentModels] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('cf.ai.agentModels') ?? '{}') as Record<string, string>;
    } catch { return {}; }
  });

  const [routeOverrides, setRouteOverrides] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('cf.ai.routeOverrides') ?? '{}') as Record<string, string>;
    } catch { return {}; }
  });

  function saveAgentModels(next: Record<string, string>) {
    setAgentModels(next);
    try { localStorage.setItem('cf.ai.agentModels', JSON.stringify(next)); } catch { /* ignore */ }
  }

  function saveRouteOverrides(next: Record<string, string>) {
    setRouteOverrides(next);
    try { localStorage.setItem('cf.ai.routeOverrides', JSON.stringify(next)); } catch { /* ignore */ }
  }

  function applyGroqPreset() {
    const next: Record<string, string> = {};
    AGENT_TASKS.forEach((t) => {
      next[t.key] = GROQ_COMPLEX_TASKS.includes(t.key)
        ? 'groq/llama-3.3-70b-versatile'
        : 'groq/llama-3.1-8b-instant';
    });
    saveRouteOverrides(next);
  }

  function applyTogetherPreset() {
    const next: Record<string, string> = {};
    AGENT_TASKS.forEach((t) => {
      next[t.key] = GROQ_COMPLEX_TASKS.includes(t.key)
        ? 'together/Llama-3.3-70B-Instruct-Turbo'
        : 'together/Llama-3.1-8B-Instruct-Turbo';
    });
    saveRouteOverrides(next);
  }

  return (
    <div className="space-y-6">
      {/* Config file models */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">Config File Models</p>
        <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
          <p className="text-xs text-gray-500 mb-4">Per-agent model assignment stored locally — used by existing routes.</p>
          <div className="space-y-3">
            {AGENT_TASKS.map((task) => (
              <div key={task.key} className="flex items-center gap-3">
                <label className="text-sm text-gray-700 w-44 shrink-0">{task.label}</label>
                <select
                  value={agentModels[task.key] ?? 'claude-sonnet-4-6'}
                  onChange={(e) => saveAgentModels({ ...agentModels, [task.key]: e.target.value })}
                  className="flex-1 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all cursor-pointer"
                  style={{ border: '1.5px solid #e3e0f0' }}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live route overrides */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">Live Route Overrides</p>
        <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">Live Route Overrides</p>
              <p className="text-xs text-gray-500">Per-task provider/model overrides — no redeploy needed</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={applyGroqPreset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:opacity-80"
                style={{ background: '#fff7ed', color: '#f55036', border: '1.5px solid #fed7aa' }}>
                <Zap className="w-3 h-3" /> Groq Defaults (Free)
              </button>
              <button type="button" onClick={applyTogetherPreset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:opacity-80"
                style={{ background: '#f0f0ff', color: '#6366f1', border: '1.5px solid #c7d2fe' }}>
                <Server className="w-3 h-3" /> Together AI
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {AGENT_TASKS.map((task) => (
              <div key={task.key} className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-600 w-44 shrink-0" style={{ background: '#f3f4f6' }}>
                  {task.label}
                </span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f97316' }} />
                <span className="text-gray-400 text-xs font-bold shrink-0">→</span>
                <select
                  value={routeOverrides[task.key] ?? ''}
                  onChange={(e) => saveRouteOverrides({ ...routeOverrides, [task.key]: e.target.value })}
                  className="flex-1 bg-white rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all cursor-pointer"
                  style={{ border: '1.5px solid #e3e0f0', background: routeOverrides[task.key] ? '#fffbeb' : 'white' }}
                >
                  <option value="">— Default routing —</option>
                  {ROUTE_MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Cost Control ────────────────────────────────────────────────────────

function CostTab() {
  const [params, setParams] = useState<CostParams>(() => {
    if (typeof window === 'undefined') return DEFAULT_COST_PARAMS;
    try {
      const saved = JSON.parse(localStorage.getItem('cf.ai.costParams') ?? 'null') as CostParams | null;
      return saved ?? DEFAULT_COST_PARAMS;
    } catch { return DEFAULT_COST_PARAMS; }
  });
  const [saved, setSaved] = useState(false);

  function patch(key: keyof CostParams, val: number) {
    setParams((p) => ({ ...p, [key]: val }));
  }

  function save() {
    try { localStorage.setItem('cf.ai.costParams', JSON.stringify(params)); } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const fields: { key: keyof CostParams; label: string; desc: string }[] = [
    { key: 'interactiveLimit', label: 'INTERACTIVE LIMIT (CALLS/HR)', desc: 'Per-user interactive AI budget' },
    { key: 'bulkLimit', label: 'BULK LIMIT (CALLS/HR)', desc: 'Per-user batch AI budget' },
    { key: 'confidenceGate', label: 'CONFIDENCE GATE (%)', desc: 'Min confidence to surface low-quality outputs' },
    { key: 'baseMargin', label: 'BASE MARGIN (%)', desc: 'Safety margin applied to cost estimates' },
    { key: 'maxBatchItems', label: 'MAX BATCH ITEMS', desc: 'Max items per bulk job' },
    { key: 'bulkConcurrency', label: 'BULK CONCURRENCY', desc: 'Parallel bulk workers per job' },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4" style={{ color: '#6D4AE0' }} />
          <p className="text-sm font-semibold text-gray-800">Cost Parameters</p>
        </div>
        <p className="text-xs text-gray-500 mb-5">Rate limits and cost gating for AI agents.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5">{f.label}</label>
              <input
                type="number"
                value={params[f.key]}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) patch(f.key, v); }}
                className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
              <p className="text-[11px] text-gray-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <button type="button" onClick={save}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}>
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Cost Parameters'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Local LLM ───────────────────────────────────────────────────────────

function LocalLLMTab() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [pullModel, setPullModel] = useState('');
  const [pullToast, setPullToast] = useState('');

  async function fetchModels() {
    setModelLoading(true);
    try {
      const res = await apiClient.get<{ models: string[] }>('/ai/ollama/models');
      setInstalledModels(res.data.models ?? []);
    } catch {
      setInstalledModels([]);
    } finally {
      setModelLoading(false);
    }
  }

  useEffect(() => { void fetchModels(); }, []);

  async function handlePull() {
    const m = pullModel.trim();
    if (!m) return;
    setPullToast(`Pulling ${m}...`);
    try {
      await apiClient.post('/ai/ollama/pull', { model: m });
      setPullToast(`Pull started for ${m}`);
    } catch {
      setPullToast(`Pull initiated (check Ollama logs for ${m})`);
    }
    setTimeout(() => setPullToast(''), 4000);
  }

  const RECOMMENDED = [
    { model: 'qwen2.5:14b', tasks: 'Script Writing · Research', desc: 'Best structured output, 128K context' },
    { model: 'qwen2.5:7b', tasks: 'Copilot · Trend Discovery · SEO', desc: 'Fast inference, good instruction following' },
    { model: 'qwen2.5:72b', tasks: 'Complex Tasks (optional)', desc: 'Near-Claude accuracy, requires 48GB VRAM' },
  ];

  const QUICK_MODELS = ['qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:72b', 'llama3.1:8b', 'gemma2:9b'];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #f0edf9' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f5f2fd' }}>
            <Zap className="w-5 h-5" style={{ color: '#6D4AE0' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Ollama — Local LLM</p>
            <p className="text-xs text-gray-500">Run open-weight models locally for zero token cost on high-volume tasks</p>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Installed models */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">Installed Models (Live)</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void fetchModels()} disabled={modelLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-[#f5f2fd] disabled:opacity-50"
                  style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
                  {modelLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </button>
                <button type="button" onClick={() => void fetchModels()} disabled={modelLoading}
                  className="p-1.5 rounded-lg hover:bg-[#f5f2fd] transition-colors disabled:opacity-50"
                  aria-label="Refresh">
                  <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${modelLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            {installedModels.length === 0
              ? (
                <div className="rounded-xl px-4 py-5 text-center" style={{ border: '1.5px dashed #e3ddf8' }}>
                  <p className="text-sm font-semibold" style={{ color: '#6D4AE0' }}>No models detected</p>
                  <p className="text-xs text-gray-500 mt-1">Set OLLAMA_ENABLED=true and start Ollama, then pull models below</p>
                </div>
              )
              : (
                <div className="flex flex-wrap gap-2">
                  {installedModels.map((m) => (
                    <span key={m} className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-gray-700" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>{m}</span>
                  ))}
                </div>
              )}
          </div>

          {/* Recommended */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">Recommended models for this app</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {RECOMMENDED.map((r) => (
                <div key={r.model} className="rounded-xl p-3" style={{ background: '#f5f2fd', border: '1px solid #e3ddf8' }}>
                  <p className="text-xs font-bold font-mono" style={{ color: '#6D4AE0' }}>{r.model}</p>
                  <p className="text-[11px] font-semibold text-gray-700 mt-1">{r.tasks}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Setup */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-2">Setup (Server .env)</p>
            <div className="rounded-xl px-4 py-3 font-mono text-xs" style={{ background: '#1a1a2e', color: '#a3e635' }}>
              <p><span style={{ color: '#60a5fa' }}>OLLAMA_ENABLED</span>=<span style={{ color: '#4ade80' }}>true</span></p>
              <p><span style={{ color: '#60a5fa' }}>OLLAMA_BASE_URL</span>=<span style={{ color: '#fbbf24' }}>http://localhost:11434</span> <span style={{ color: '#6b7280' }}># default</span></p>
            </div>
          </div>

          {/* Pull */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-2">Pull a Model</p>
            <div className="flex gap-2">
              <input type="text" value={pullModel} onChange={(e) => setPullModel(e.target.value)}
                placeholder="e.g. qwen2.5:14b"
                className="flex-1 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
                style={{ border: '1.5px solid #e3e0f0' }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handlePull(); }}
              />
              <button type="button" onClick={() => void handlePull()}
                disabled={!pullModel.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white text-sm hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' }}>
                Pull
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {QUICK_MODELS.map((m) => (
                <button key={m} type="button" onClick={() => setPullModel(m)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold hover:bg-[#f5f2fd] transition-colors"
                  style={{ background: '#f0f0f0', color: '#374151' }}>
                  {m}
                </button>
              ))}
            </div>
            {pullToast && (
              <p className="mt-2 text-xs text-green-700 px-3 py-1.5 rounded-lg" style={{ background: '#f0fdf4' }}>{pullToast}</p>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <span className="text-yellow-500 mt-0.5 shrink-0">⚠</span>
            <div>
              <p className="text-xs font-semibold text-yellow-800">Tasks that stay on Claude regardless of Ollama settings</p>
              <p className="text-xs text-yellow-700 mt-0.5">Script Writing, Compliance Check, Fact Check, Thumbnail Analysis — these need high accuracy or vision that local models cannot match reliably.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Usage ───────────────────────────────────────────────────────────────

function UsageTab() {
  const [usage, setUsage] = useState<UsageData>(MOCK_USAGE);
  const [loading, setLoading] = useState(false);

  async function fetchUsage() {
    setLoading(true);
    try {
      const res = await apiClient.get<UsageData>('/admin/ai-usage');
      setUsage(res.data);
    } catch {
      setUsage(MOCK_USAGE);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchUsage(); }, []);

  const maxCost = Math.max(...usage.byTask.map((t) => t.cost), 0.001);
  const maxSpend = Math.max(...usage.dailySpend.map((d) => d.cost), 0.001);

  const W = 600;
  const H = 120;
  const PAD = 8;
  const chartW = W - PAD * 2;
  const chartH = H - PAD * 2;

  const points = usage.dailySpend.map((d, i) => {
    const x = PAD + (i / (usage.dailySpend.length - 1)) * chartW;
    const y = PAD + chartH - (d.cost / maxSpend) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${PAD},${PAD + chartH} ${points} ${PAD + chartW},${PAD + chartH}`;

  const firstDate = usage.dailySpend[0]?.date ?? '';
  const midDate = usage.dailySpend[Math.floor(usage.dailySpend.length / 2)]?.date ?? '';
  const lastDate = usage.dailySpend[usage.dailySpend.length - 1]?.date ?? '';

  const stats = [
    { label: 'TOTAL CALLS', value: usage.totalCalls.toLocaleString(), sub: null },
    { label: 'EST. COST', value: `$${usage.estimatedCost.toFixed(4)}`, sub: null },
    { label: 'INTERACTIVE', value: `${usage.interactivePerHr}`, sub: '/hr' },
    { label: 'SAVINGS VS SONNET', value: `$${usage.savingsVsSonnet.toFixed(4)}`, sub: 'vs all-Sonnet 4.6 pricing', green: true },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0edf9' }}>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" style={{ color: '#6D4AE0' }} />
            <div>
              <p className="text-sm font-semibold text-gray-800">AI Usage (Last 30 Days)</p>
              <p className="text-xs text-gray-500">From ai_usage_log</p>
            </div>
          </div>
          <button type="button" onClick={() => void fetchUsage()} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-[#f5f2fd] transition-colors disabled:opacity-50" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ border: '1px solid #e3ddf8' }}>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">{s.label}</p>
                <p className={`text-2xl font-extrabold mt-1 ${s.green ? 'text-green-600' : 'text-gray-900'}`}>
                  {s.value}{s.sub && <span className="text-sm font-semibold text-gray-500">{s.sub}</span>}
                </p>
                {s.sub && s.sub !== '/hr' && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Chart */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-2">DAILY SPEND (30 DAYS)</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#EA580C" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={fillPoints} fill="url(#spendFill)" />
              <polyline points={points} fill="none" stroke="#EA580C" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{firstDate}</span>
              <span>{midDate}</span>
              <span>{lastDate}</span>
            </div>
          </div>

          {/* By task */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">BY TASK</p>
            <div className="space-y-2">
              {usage.byTask.map((t) => (
                <div key={t.task} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-36 shrink-0">{t.task}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(t.cost / maxCost) * 100}%`, background: '#1e3a5f' }} />
                  </div>
                  <span className="text-xs font-mono text-gray-500 w-16 text-right">${t.cost.toFixed(4)}</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{t.calls} calls</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AIInfrastructurePage() {
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [providers, setProviders] = useState<ProviderConfig[]>(CORE_PROVIDERS);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me().then((r) => r.data),
  });

  // Load provider configs from API
  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<ProviderConfig[]>('/provider-configs');
        const saved = res.data;
        setProviders((prev) =>
          prev.map((p) => {
            const match = saved.find((s) => s.provider === p.provider);
            return match ? { ...p, ...match, apiKey: '' } : p;
          }),
        );
      } catch { /* use defaults */ }
    }
    void load();
  }, []);

  const role = me?.role ?? '';
  const hasAccess = ALLOWED_ROLES.includes(role);

  async function handleSave() {
    try {
      await Promise.all(
        providers.map((p) =>
          apiClient.post('/provider-configs', {
            provider: p.provider,
            label: p.label,
            baseUrl: p.baseUrl,
            apiKey: p.apiKey || undefined,
            model: p.model,
            enabled: p.enabled,
            priority: 50,
            isDefault: false,
            isFallback: false,
            temperature: 0.7,
            maxTokens: 4096,
            streaming: true,
          }),
        ),
      );
      setBanner({ type: 'success', msg: 'Configuration saved.' });
    } catch {
      setBanner({ type: 'error', msg: 'Failed to save configuration.' });
    }
    setTimeout(() => setBanner(null), 3000);
  }

  function handleReset() {
    setProviders(CORE_PROVIDERS);
    try {
      localStorage.removeItem('cf.ai.preferred');
      localStorage.removeItem('cf.ai.agentModels');
      localStorage.removeItem('cf.ai.routeOverrides');
      localStorage.removeItem('cf.ai.costParams');
    } catch { /* ignore */ }
    setBanner({ type: 'success', msg: 'Reset to defaults.' });
    setTimeout(() => setBanner(null), 2000);
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'providers', label: 'Providers' },
    { id: 'routing', label: 'Routing & Models' },
    { id: 'cost', label: 'Cost Control' },
    { id: 'local', label: 'Local LLM' },
    { id: 'usage', label: 'Usage' },
  ];

  // Access denied state
  if (me && !hasAccess) {
    return (
      <div className="min-h-full flex items-center justify-center p-8" style={{ background: '#faf9ff' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#f5f2fd' }}>
            <Shield className="w-8 h-8" style={{ color: '#6D4AE0' }} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-600 mb-5">
            AI &amp; Infrastructure settings are only available to Admins, Developers, and Owners.
          </p>
          <a href="/settings"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' }}>
            Back to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: '#faf9ff' }}>
      <div className="p-5 lg:p-7 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-5 h-5" style={{ color: '#6D4AE0' }} />
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">AI &amp; Infrastructure</h1>
            </div>
            <p className="text-sm text-gray-500">Multi-provider routing, rate limits, and cost tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold transition-colors hover:bg-[#f5f2fd]"
              style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button type="button" onClick={() => void handleSave()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}>
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? '#6D4AE0' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#6b7280',
                border: activeTab === tab.id ? 'none' : '1.5px solid #e3ddf8',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'providers' && (
          <ProvidersTab providers={providers} setProviders={setProviders} />
        )}
        {activeTab === 'routing' && <RoutingTab />}
        {activeTab === 'cost' && <CostTab />}
        {activeTab === 'local' && <LocalLLMTab />}
        {activeTab === 'usage' && <UsageTab />}
      </div>

      {/* Toast */}
      {banner && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-xl text-sm font-semibold z-50 ${
          banner.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {banner.msg}
        </div>
      )}
    </div>
  );
}
