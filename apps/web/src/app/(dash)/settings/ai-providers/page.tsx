'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Cloud,
  Cpu,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Settings2,
  Save,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

type ProviderTier = 'local' | 'self-hosted' | 'cloud' | 'custom';

interface ProviderConfig {
  provider: string; // API schema uses 'provider' instead of 'id'
  label: string; // API schema uses 'label' instead of 'name'
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority?: number;
  isDefault?: boolean;
  isFallback?: boolean;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
  // Metadata fields for UI display (not sent to API)
  tier?: ProviderTier;
  requiresKey?: boolean;
  defaultBaseUrl?: string;
}

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface TestState {
  status: TestStatus;
  message: string;
}

// ── Default provider definitions ────────────────────────────────────────────

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    provider: 'ollama',
    label: 'Ollama',
    tier: 'local',
    defaultBaseUrl: 'http://localhost:11434',
    requiresKey: false,
    enabled: false,
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'lmstudio',
    label: 'LM Studio',
    tier: 'local',
    defaultBaseUrl: 'http://localhost:1234/v1',
    requiresKey: false,
    enabled: false,
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    model: 'local-model',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'localai',
    label: 'LocalAI',
    tier: 'self-hosted',
    defaultBaseUrl: 'http://localhost:8080/v1',
    requiresKey: false,
    enabled: false,
    baseUrl: 'http://localhost:8080/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'vllm',
    label: 'vLLM',
    tier: 'self-hosted',
    defaultBaseUrl: 'http://localhost:8000/v1',
    requiresKey: false,
    enabled: false,
    baseUrl: 'http://localhost:8000/v1',
    apiKey: '',
    model: 'meta-llama/Llama-3.1-8B-Instruct',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    tier: 'cloud',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    enabled: false,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    tier: 'cloud',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    tier: 'cloud',
    defaultBaseUrl: 'https://api.anthropic.com',
    requiresKey: true,
    enabled: false,
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-3-5-haiku-20241022',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'gemini',
    label: 'Google Gemini',
    tier: 'cloud',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresKey: true,
    enabled: false,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    model: 'gemini-1.5-flash',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
  {
    provider: 'openai-compatible',
    label: 'OpenAI Compatible',
    tier: 'custom',
    defaultBaseUrl: '',
    requiresKey: false,
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  },
];

// ── IosToggle ────────────────────────────────────────────────────────────────

function IosToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 44,
        height: 26,
        borderRadius: 13,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: checked ? '#6D4AE0' : '#d1d5db',
        transition: 'background 0.2s',
        flexShrink: 0,
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ── Tier badge + icon helpers ────────────────────────────────────────────────

function TierIcon({ tier }: { tier: ProviderTier }) {
  if (tier === 'local') return <Cpu className="w-3.5 h-3.5" />;
  if (tier === 'self-hosted') return <Server className="w-3.5 h-3.5" />;
  if (tier === 'cloud') return <Cloud className="w-3.5 h-3.5" />;
  return <Settings2 className="w-3.5 h-3.5" />;
}

const TIER_STYLES: Record<ProviderTier, { bg: string; color: string; label: string }> = {
  local: { bg: '#ecfdf5', color: '#065f46', label: 'Local' },
  'self-hosted': { bg: '#eff6ff', color: '#1e40af', label: 'Self-hosted' },
  cloud: { bg: '#f5f2fd', color: '#6D4AE0', label: 'Cloud' },
  custom: { bg: '#fef9ee', color: '#92400e', label: 'Custom' },
};

function ProviderIcon({ provider }: { provider: string }) {
  // Simple letter-based icons with brand colors
  const icons: Record<string, { bg: string; color: string; letter: string }> = {
    ollama: { bg: '#1a1a2e', color: '#fff', letter: 'O' },
    lmstudio: { bg: '#2563eb', color: '#fff', letter: 'L' },
    localai: { bg: '#059669', color: '#fff', letter: 'A' },
    vllm: { bg: '#7c3aed', color: '#fff', letter: 'V' },
    openrouter: { bg: '#111827', color: '#fff', letter: 'R' },
    openai: { bg: '#10a37f', color: '#fff', letter: 'G' },
    anthropic: { bg: '#d97706', color: '#fff', letter: 'C' },
    gemini: { bg: '#4285f4', color: '#fff', letter: 'G' },
    'openai-compatible': { bg: '#6b7280', color: '#fff', letter: '~' },
  };
  const cfg = icons[provider] ?? { bg: '#6D4AE0', color: '#fff', letter: provider[0]?.toUpperCase() ?? '?' };
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 select-none"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.letter}
    </div>
  );
}

// ── ImageProviderCard ────────────────────────────────────────────────────────

interface ImageProviderDef {
  key: string;
  label: string;
  desc: string;
  defaultUrl: string;
  envVar: string;
}

function ImageProviderCard({ provider }: { provider: ImageProviderDef }) {
  const storageKey = `cf_image_${provider.key}_url`;
  const [url, setUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return provider.defaultUrl;
    return localStorage.getItem(storageKey) ?? provider.defaultUrl;
  });
  const [testState, setTestState] = useState<TestState>({ status: 'idle', message: '' });

  function handleUrlChange(next: string) {
    setUrl(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // ignore storage errors
    }
  }

  async function handleTest() {
    setTestState({ status: 'loading', message: 'Connecting…' });
    const base = url.replace(/\/$/, '');
    const testEndpoint =
      provider.key === 'comfyui' ? `${base}/system_stats` : `${base}/sdapi/v1/sd-models`;
    try {
      const resp = await fetch(testEndpoint, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        setTestState({ status: 'success', message: 'Connected ✓' });
      } else {
        setTestState({ status: 'error', message: `HTTP ${resp.status} ✗` });
      }
    } catch {
      setTestState({ status: 'error', message: 'Unreachable ✗' });
    }
    setTimeout(() => setTestState({ status: 'idle', message: '' }), 4000);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3e0f0', background: '#faf9fe' }}>
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-800">{provider.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{provider.desc}</p>
      </div>
      <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #f0edf9' }}>
        <div className="pt-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Base URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={provider.defaultUrl}
            className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
            style={{ border: '1.5px solid #e3e0f0' }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testState.status === 'loading'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ border: '1.5px solid #6D4AE0', color: '#6D4AE0', background: '#fff' }}
          >
            {testState.status === 'loading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : testState.status === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            ) : testState.status === 'error' ? (
              <XCircle className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Test
          </button>
          {testState.message && (
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                testState.status === 'success'
                  ? 'bg-green-50 text-green-700'
                  : testState.status === 'error'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-[#f5f2fd] text-[#6D4AE0]'
              }`}
            >
              {testState.message}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400">
          Set <code className="font-mono bg-gray-100 px-1 rounded">{provider.envVar}</code> on the API
          server to activate this provider for image generation.
        </p>
      </div>
    </div>
  );
}

// ── ProviderCard ─────────────────────────────────────────────────────────────

interface ProviderCardProps {
  config: ProviderConfig;
  onChange: (updated: ProviderConfig) => void;
}

function ProviderCard({ config, onChange }: ProviderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: 'idle', message: '' });
  const tierStyle = TIER_STYLES[config.tier];

  function update(patch: Partial<ProviderConfig>) {
    onChange({ ...config, ...patch });
  }

  async function handleTestConnection() {
    setTestState({ status: 'loading', message: 'Connecting…' });
    try {
      const res = await apiClient.post<{ ok: boolean; message: string; models?: string[] }>(
        `/provider-configs/${config.provider}/test`,
      );
      if (res.data.ok) {
        setTestState({ status: 'success', message: 'Connected ✓' });
      } else {
        setTestState({ status: 'error', message: `Failed ✗ — ${res.data.message}` });
      }
    } catch (err) {
      const msg = (err as any)?.response?.data?.message ?? 'Connection failed';
      setTestState({ status: 'error', message: `Failed ✗ — ${msg}` });
    }
    setTimeout(() => setTestState({ status: 'idle', message: '' }), 4000);
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <ProviderIcon provider={config.provider} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{config.label}</span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: tierStyle.bg, color: tierStyle.color }}
            >
              <TierIcon tier={config.tier} />
              {tierStyle.label}
            </span>
            {config.enabled && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#ecfdf5', color: '#065f46' }}
              >
                Active
              </span>
            )}
          </div>
          {config.enabled && config.model && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{config.model}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <IosToggle
            checked={config.enabled}
            onChange={(v) => update({ enabled: v })}
          />
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-xl hover:bg-[#f5f2fd] transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded config panel */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid #f0edf9' }}>
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Base URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Base URL
                {config.tier !== 'cloud' && (
                  <span className="ml-1 text-gray-400 font-normal">(required)</span>
                )}
              </label>
              <input
                type="url"
                value={config.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder={config.defaultBaseUrl || 'https://your-endpoint/v1'}
                className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
            </div>

            {/* API Key */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                API Key
                {config.requiresKey ? (
                  <span className="ml-1 text-red-400 font-normal">(required)</span>
                ) : (
                  <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                )}
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder={config.requiresKey ? 'Paste your API key…' : 'Leave blank for local providers'}
                className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
                style={{ border: '1.5px solid #e3e0f0' }}
                autoComplete="off"
              />
            </div>

            {/* Model */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder="e.g. gpt-4o-mini, llama3.2, claude-3-5-haiku-20241022"
                className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Temperature
                <span className="ml-1.5 font-mono text-[#6D4AE0]">{config.temperature.toFixed(1)}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.temperature}
                  onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: '#6D4AE0' }}
                />
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.temperature}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0 && v <= 2) update({ temperature: v });
                  }}
                  className="w-16 bg-white rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Tokens</label>
              <input
                type="number"
                min={1}
                max={200000}
                step={256}
                value={config.maxTokens}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v > 0) update({ maxTokens: v });
                }}
                className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
            </div>

            {/* Streaming */}
            <div className="sm:col-span-2 flex items-center gap-3">
              <IosToggle
                checked={config.streaming}
                onChange={(v) => update({ streaming: v })}
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Streaming</p>
                <p className="text-xs text-gray-500">Stream tokens as they are generated for faster perceived response.</p>
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={testState.status === 'loading'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ border: '1.5px solid #6D4AE0', color: '#6D4AE0', background: '#fff' }}
            >
              {testState.status === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : testState.status === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              ) : testState.status === 'error' ? (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              Test Connection
            </button>
            {testState.message && (
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                  testState.status === 'success'
                    ? 'bg-green-50 text-green-700'
                    : testState.status === 'error'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-[#f5f2fd] text-[#6D4AE0]'
                }`}
              >
                {testState.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AIProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [defaultProvider, setDefaultProvider] = useState<string>('');
  const [fallbackProvider, setFallbackProvider] = useState<string>('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Load from API on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<ProviderConfig[]>('/provider-configs');
        const saved = res.data;
        // Merge API data with defaults — keep the UI metadata from defaults
        setProviders((prev) =>
          prev.map((p) => {
            const match = saved.find((s) => s.provider === p.provider);
            return match
              ? { ...p, ...match, apiKey: '' } // never show apiKey back from API
              : p;
          }),
        );
      } catch {
        // Non-fatal — use defaults
      }
    }
    void load();
  }, []);

  const enabledProviders = providers.filter((p) => p.enabled);

  const handleProviderChange = useCallback((updated: ProviderConfig) => {
    setProviders((prev) => prev.map((p) => (p.provider === updated.provider ? updated : p)));
  }, []);

  async function handleSave() {
    try {
      // Save all providers sequentially
      await Promise.all(
        providers.map((provider) =>
          apiClient.post('/provider-configs', {
            provider: provider.provider,
            label: provider.label,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey || undefined,
            model: provider.model,
            enabled: provider.enabled,
            priority: provider.priority ?? 50,
            isDefault: provider.isDefault ?? false,
            isFallback: provider.isFallback ?? false,
            temperature: provider.temperature,
            maxTokens: provider.maxTokens,
            streaming: provider.streaming ?? true,
          }),
        ),
      );
      setBanner({ type: 'success', msg: 'Configuration saved successfully' });
      setTimeout(() => setBanner(null), 3000);
    } catch {
      setBanner({ type: 'error', msg: 'Failed to save provider configuration' });
    }
  }

  return (
    <div className="min-h-full bg-[#F4F3FB]">
      <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-5">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5" style={{ color: '#6D4AE0' }} />
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">AI Providers</h1>
          </div>
          <p className="text-sm text-gray-500">
            Configure your LLM providers. Local providers take priority over cloud APIs.
          </p>
        </div>

        {/* ── Priority order banner ────────────────────────────────────────── */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}
        >
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Priority order</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: '#ecfdf5', color: '#065f46' }}
            >
              <Cpu className="w-3 h-3" /> Local
            </span>
            <span className="text-gray-400 text-xs font-bold">→</span>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: '#eff6ff', color: '#1e40af' }}
            >
              <Server className="w-3 h-3" /> Self-hosted
            </span>
            <span className="text-gray-400 text-xs font-bold">→</span>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: '#f5f2fd', color: '#6D4AE0' }}
            >
              <Cloud className="w-3 h-3" /> Cloud
            </span>
          </div>
          <p className="text-xs text-gray-500 w-full mt-0.5">
            When multiple providers are enabled, local providers are tried first to reduce cost and latency.
          </p>
        </div>

        {/* ── Local providers ──────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Local Providers
          </p>
          <div className="space-y-3">
            {providers.filter((p) => p.tier === 'local').map((p) => (
              <ProviderCard key={p.provider} config={p} onChange={handleProviderChange} />
            ))}
          </div>
        </section>

        {/* ── Self-hosted providers ────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Self-hosted Providers
          </p>
          <div className="space-y-3">
            {providers.filter((p) => p.tier === 'self-hosted').map((p) => (
              <ProviderCard key={p.provider} config={p} onChange={handleProviderChange} />
            ))}
          </div>
        </section>

        {/* ── Cloud providers ──────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Cloud Providers
          </p>
          <div className="space-y-3">
            {providers.filter((p) => p.tier === 'cloud').map((p) => (
              <ProviderCard key={p.provider} config={p} onChange={handleProviderChange} />
            ))}
          </div>
        </section>

        {/* ── Custom / compatible ──────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Custom / Compatible
          </p>
          <div className="space-y-3">
            {providers.filter((p) => p.tier === 'custom').map((p) => (
              <ProviderCard key={p.provider} config={p} onChange={handleProviderChange} />
            ))}
          </div>
        </section>

        {/* ── Image Generation ─────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Image Generation
          </p>
          <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid #e3ddf8', padding: '24px' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-4">
              Self-hosted Providers
            </p>
            <div className="space-y-4">
              {(
                [
                  {
                    key: 'comfyui',
                    label: 'ComfyUI',
                    desc: 'ComfyUI node-based workflow engine',
                    defaultUrl: 'http://localhost:8188',
                    envVar: 'COMFYUI_URL',
                  },
                  {
                    key: 'a1111',
                    label: 'Automatic1111 / Forge',
                    desc: 'SD WebUI compatible endpoint',
                    defaultUrl: 'http://localhost:7860',
                    envVar: 'A1111_URL',
                  },
                ] as ImageProviderDef[]
              ).map((provider) => (
                <ImageProviderCard key={provider.key} provider={provider} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Video Generation ─────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Video Generation
          </p>
          <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid #e3ddf8', padding: '24px' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-4">
              Self-hosted Providers
            </p>
            <div className="space-y-3">
              <div style={{ background: '#f9f8ff', borderRadius: 12, padding: '16px', border: '1px solid #e3ddf8' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">ComfyUI Video</p>
                    <p className="text-xs text-gray-500">Stable Video Diffusion, WAN Video, CogVideo via ComfyUI workflows</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#f0fdf4', color: '#16a34a' }}>LOCAL</span>
                </div>
                <p className="text-[11px] text-gray-400">Set <code className="bg-gray-100 px-1 rounded">COMFYUI_URL</code> environment variable on the API server to enable</p>
              </div>
              <div style={{ background: '#f9f8ff', borderRadius: 12, padding: '16px', border: '1px solid #e3ddf8' }}>
                <p className="text-sm font-semibold text-gray-800 mb-1">More providers coming soon</p>
                <p className="text-xs text-gray-500">WAN Video standalone, Mochi, LTX Video, Hunyuan Video, SkyReels</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Default & Fallback dropdowns ─────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Routing
          </p>
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="w-4 h-4" style={{ color: '#6D4AE0' }} />
              <span className="text-sm font-semibold text-gray-800">Provider Routing</span>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Select which enabled provider to use by default, and which to fall back to if the primary fails.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Default provider */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Default Provider</label>
                <select
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all cursor-pointer"
                  style={{ border: '1.5px solid #e3e0f0' }}
                >
                  <option value="">— Auto (highest priority) —</option>
                  {enabledProviders.map((p) => (
                    <option key={p.provider} value={p.provider}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {enabledProviders.length === 0
                    ? 'Enable at least one provider above.'
                    : 'Used for all AI agent requests by default.'}
                </p>
              </div>

              {/* Fallback provider */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fallback Provider</label>
                <select
                  value={fallbackProvider}
                  onChange={(e) => setFallbackProvider(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all cursor-pointer"
                  style={{ border: '1.5px solid #e3e0f0' }}
                >
                  <option value="">— None —</option>
                  {enabledProviders
                    .filter((p) => p.provider !== defaultProvider)
                    .map((p) => (
                      <option key={p.provider} value={p.provider}>
                        {p.label}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Used automatically when the default provider fails or rate-limits.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Banner notification ─────────────────────────────────────────── */}
        {banner && (
          <div
            className={`fixed top-4 right-4 px-4 py-3 rounded-xl text-sm font-semibold ${
              banner.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}
          >
            {banner.msg}
          </div>
        )}

        {/* ── Save button ──────────────────────────────────────────────────── */}
        <div className="flex justify-end pb-8">
          <button
            type="button"
            onClick={() => void handleSave()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            style={{
              background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
              boxShadow: '0 4px 20px rgba(109,74,224,0.35)',
            }}
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
