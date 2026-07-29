'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Activity,
  Loader2,
  GitBranch,
  ChevronRight,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProviderConfig {
  provider: string;
  label: string;
  enabled: boolean;
}

interface ProviderHealth {
  provider: string;
  label: string;
  score: number; // 0-100
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs?: number;
  lastChecked?: string;
  consecutiveFailures: number;
  successCount: number;
  failureCount: number;
  cooldownUntil?: number;
  inCooldown: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function testProvider(
  provider: string,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    const r = await apiClient.post<{ ok: boolean; message: string }>(
      `/provider-configs/${provider}/test`,
    );
    return { ok: r.data.ok, latencyMs: Date.now() - start, message: r.data.message };
  } catch {
    return { ok: false, latencyMs: Date.now() - start, message: 'Connection failed' };
  }
}

function scoreFromResult(ok: boolean, latencyMs: number): number {
  if (!ok) return 0;
  if (latencyMs < 500) return 100;
  if (latencyMs < 1000) return 80;
  if (latencyMs < 2000) return 60;
  return 40;
}

function statusFromScore(score: number): ProviderHealth['status'] {
  if (score >= 80) return 'healthy';
  if (score >= 40) return 'degraded';
  if (score > 0) return 'degraded';
  return 'down';
}

function latencyColor(ms: number): string {
  if (ms < 500) return '#16a34a';
  if (ms <= 2000) return '#ca8a04';
  return '#dc2626';
}

function relativeSeconds(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 1000);
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProviderHealth['status'] }) {
  const map: Record<
    ProviderHealth['status'],
    { label: string; bg: string; color: string; border: string }
  > = {
    healthy: { label: 'Online',    bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    degraded: { label: 'Slow',     bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
    down:     { label: 'Offline',  bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    unknown:  { label: 'Unchecked', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}
    >
      {status === 'healthy'  && <CheckCircle className="w-3 h-3" />}
      {status === 'degraded' && <AlertCircle className="w-3 h-3" />}
      {status === 'down'     && <XCircle className="w-3 h-3" />}
      {status === 'unknown'  && <Clock className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

// ── Summary banner ───────────────────────────────────────────────────────────

function SummaryBanner({ providers }: { providers: ProviderHealth[] }) {
  const total = providers.length;
  if (total === 0) return null;

  const online = providers.filter(p => p.status === 'healthy' || p.status === 'degraded').length;
  const allHealthy = providers.every(p => p.status === 'healthy');
  const allDown = providers.every(p => p.status === 'down');

  let bg: string, border: string, color: string, text: string;
  if (allHealthy) {
    bg = '#f0fdf4'; border = '#bbf7d0'; color = '#166534';
    text = `All ${total} providers online`;
  } else if (allDown) {
    bg = '#fef2f2'; border = '#fecaca'; color = '#991b1b';
    text = 'No providers available — check connections';
  } else {
    bg = '#fefce8'; border = '#fde68a'; color = '#854d0e';
    text = `${online} of ${total} providers available`;
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6"
      style={{ background: bg, border: `1.5px solid ${border}`, color }}
    >
      <Activity className="w-5 h-5 shrink-0" />
      <span className="text-sm font-semibold">{text}</span>
    </div>
  );
}

// ── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  health,
  onTest,
  testing,
}: {
  health: ProviderHealth;
  onTest: () => void;
  testing: boolean;
}) {
  const now = Date.now();
  const cooldownRemaining =
    health.inCooldown && health.cooldownUntil
      ? Math.max(0, Math.round((health.cooldownUntil - now) / 1000))
      : 0;

  return (
    <div
      className="bg-white rounded-2xl p-5 space-y-4"
      style={{ border: '1.5px solid #e3ddf8' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 capitalize">{health.label}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{health.provider}</p>
        </div>
        <StatusBadge status={health.status} />
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 flex-wrap">
        {health.latencyMs !== undefined ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold" style={{ color: latencyColor(health.latencyMs) }}>
              {health.latencyMs}ms
            </span>
            <span className="text-xs text-gray-400">latency</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—ms</span>
        )}

        <div className="flex items-center gap-1 text-xs">
          <span className="font-semibold text-green-600">{health.successCount}</span>
          <span className="text-gray-400">ok</span>
          <span className="text-gray-300 mx-0.5">/</span>
          <span className="font-semibold text-red-500">{health.failureCount}</span>
          <span className="text-gray-400">fail</span>
        </div>

        {health.lastChecked && (
          <span className="text-xs text-gray-400">
            {relativeSeconds(health.lastChecked)}s ago
          </span>
        )}
      </div>

      {/* Cooldown badge */}
      {health.inCooldown && cooldownRemaining > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa' }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Cooldown: {cooldownRemaining}s remaining
        </div>
      )}

      {/* Test button */}
      <button
        type="button"
        onClick={onTest}
        disabled={testing || health.inCooldown}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 w-full justify-center"
        style={{ border: '1.5px solid #6D4AE0', color: '#6D4AE0', background: '#fff' }}
      >
        {testing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Testing…
          </>
        ) : (
          <>
            <Activity className="w-3.5 h-3.5" />
            Test Now
          </>
        )}
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;

export default function ProviderHealthPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const [providerError, setProviderError] = useState<string | null>(null);

  // Fetch configured providers
  useEffect(() => {
    setLoadingProviders(true);
    apiClient
      .get<ProviderConfig[]>('/provider-configs')
      .then((r) => {
        setProviders(r.data ?? []);
        setProviderError(null);
      })
      .catch(() => {
        setProviderError('Could not load provider configs');
      })
      .finally(() => setLoadingProviders(false));
  }, []);

  // Run all tests sequentially
  const runAllTests = useCallback(async (providerList: ProviderConfig[]) => {
    if (providerList.length === 0) return;
    setLoading(true);
    for (const p of providerList) {
      const result = await testProvider(p.provider);
      const score = scoreFromResult(result.ok, result.latencyMs);
      const status = statusFromScore(score);
      setHealth((prev) => {
        const prev_h = prev[p.provider];
        return {
          ...prev,
          [p.provider]: {
            provider: p.provider,
            label: p.label,
            score,
            status,
            latencyMs: result.latencyMs,
            lastChecked: new Date().toISOString(),
            consecutiveFailures: result.ok ? 0 : (prev_h?.consecutiveFailures ?? 0) + 1,
            successCount: (prev_h?.successCount ?? 0) + (result.ok ? 1 : 0),
            failureCount: (prev_h?.failureCount ?? 0) + (result.ok ? 0 : 1),
            inCooldown: false,
          },
        };
      });
    }
    setLastChecked(new Date().toISOString());
    setCountdown(POLL_INTERVAL_MS / 1000);
    setLoading(false);
  }, []);

  // Auto-run when providers load
  useEffect(() => {
    if (!loadingProviders && providers.length > 0) {
      void runAllTests(providers);
    }
  }, [loadingProviders, providers, runAllTests]);

  // Auto-poll countdown
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          void runAllTests(providers);
          return POLL_INTERVAL_MS / 1000;
        }
        return c - 1;
      });
    }, 1_000);
    return () => clearInterval(tick);
  }, [providers, runAllTests]);

  // Test a single provider
  async function handleTestOne(provider: string, label: string) {
    setTestingProvider(provider);
    const result = await testProvider(provider);
    const score = scoreFromResult(result.ok, result.latencyMs);
    const status = statusFromScore(score);
    setHealth((prev) => {
      const prev_h = prev[provider];
      return {
        ...prev,
        [provider]: {
          provider,
          label,
          score,
          status,
          latencyMs: result.latencyMs,
          lastChecked: new Date().toISOString(),
          consecutiveFailures: result.ok ? 0 : (prev_h?.consecutiveFailures ?? 0) + 1,
          successCount: (prev_h?.successCount ?? 0) + (result.ok ? 1 : 0),
          failureCount: (prev_h?.failureCount ?? 0) + (result.ok ? 0 : 1),
          inCooldown: false,
        },
      };
    });
    setTestingProvider(null);
  }

  const healthList = providers.map((p) => health[p.provider] ?? ({
    provider: p.provider,
    label: p.label,
    score: 0,
    status: 'unknown' as const,
    consecutiveFailures: 0,
    successCount: 0,
    failureCount: 0,
    inCooldown: false,
  }));

  return (
    <div className="min-h-full bg-[#F4F3FB]">
      <div className="px-4 py-6 sm:p-8 max-w-4xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5" style={{ color: '#6D4AE0' }} />
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                Provider Health
              </h1>
            </div>
            <p className="text-sm text-gray-500">
              {lastChecked
                ? `Last checked: ${relativeSeconds(lastChecked)}s ago · Next check in ${countdown}s`
                : 'Checking providers…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runAllTests(providers)}
            disabled={loading || providers.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ border: '1.5px solid #6D4AE0', color: '#6D4AE0', background: '#fff' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-check All
          </button>
        </div>

        {/* ── Summary banner ──────────────────────────────────────────────── */}
        {healthList.length > 0 && <SummaryBanner providers={healthList} />}

        {/* ── Loading / error / empty states ──────────────────────────────── */}
        {loadingProviders ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading providers…</span>
          </div>
        ) : providerError ? (
          <div
            className="flex items-start gap-3 px-4 py-4 rounded-2xl"
            style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}
          >
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">{providerError}</p>
              <p className="text-xs text-red-600 mt-0.5">
                Check that the backend is running and you are authenticated.
              </p>
            </div>
          </div>
        ) : providers.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl" style={{ border: '1.5px solid #e3ddf8' }}>
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">No providers configured yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Set up at least one AI provider to monitor its health.
            </p>
            <a
              href="/settings/ai-providers"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' }}
            >
              Configure AI Providers →
            </a>
          </div>
        ) : (
          /* ── Provider grid ──────────────────────────────────────────────── */
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
              Provider Status
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => {
                const h = health[p.provider] ?? {
                  provider: p.provider,
                  label: p.label,
                  score: 0,
                  status: 'unknown' as const,
                  consecutiveFailures: 0,
                  successCount: 0,
                  failureCount: 0,
                  inCooldown: false,
                };
                return (
                  <ProviderCard
                    key={p.provider}
                    health={h}
                    testing={testingProvider === p.provider || (loading && !health[p.provider])}
                    onTest={() => void handleTestOne(p.provider, p.label)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Fallback chain reference */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-900">Provider Fallback Chain</p>
          </div>
          <p className="text-xs text-amber-700">When a provider fails, the system automatically tries the next available provider in order:</p>
          <div className="flex flex-wrap items-center gap-2">
            {['Ollama (local)', 'LM Studio', 'vLLM', 'LocalAI', 'OpenRouter', 'OpenAI', 'Anthropic', 'Gemini'].map((p, i, arr) => (
              <React.Fragment key={p}>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'white', border: '1px solid #fde68a', color: '#92400e' }}>{p}</span>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-amber-400 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
          <p className="text-[11px] text-amber-600">All fallback events are logged via the structured trace system. Check your API server logs for <code className="bg-amber-100 px-1 rounded">provider.fallback</code> events.</p>
        </div>

      </div>
    </div>
  );
}
