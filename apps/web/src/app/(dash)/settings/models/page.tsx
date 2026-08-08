'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Download, Trash2, HardDrive, CheckCircle2, XCircle, Cpu, MemoryStick } from 'lucide-react';
import { apiClient } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface GpuInfo {
  backend: string;
  name: string;
  vramMb?: number;
  memUsedMb?: number;
  memTotalMb?: number;
  utilizationPct?: number;
  temperature?: number;
}

interface SystemStats {
  gpus: GpuInfo[];
  primaryBackend: string;
  cpuModel: string;
  cpuCores: number;
  totalRamMb: number;
  freeRamMb: number;
}

interface OllamaModel {
  name: string;
  size: number;
  modified: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mbToGb(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Suggested models ─────────────────────────────────────────────────────────

const SUGGESTED_MODELS = [
  // Llama family (Meta)
  'llama3.3:70b',
  'llama3.3:latest',
  'llama3.2:3b',
  'llama3.2:1b',
  'llama3.1:70b',
  'llama3.1:8b',
  // Gemma family (Google)
  'gemma3:27b',
  'gemma3:12b',
  'gemma3:4b',
  'gemma3:1b',
  'gemma2:27b',
  'gemma2:9b',
  // DeepSeek
  'deepseek-r1:70b',
  'deepseek-r1:32b',
  'deepseek-r1:14b',
  'deepseek-r1:7b',
  'deepseek-v3:latest',
  // Qwen (Alibaba)
  'qwen2.5:72b',
  'qwen2.5:32b',
  'qwen2.5:14b',
  'qwen2.5:7b',
  'qwq:32b',
  // Mistral
  'mistral:7b',
  'mixtral:8x7b',
  // Small/Fast models
  'phi4:latest',
  'phi3.5:mini',
  'smollm2:1.7b',
  // Vision models
  'llava:34b',
  'llava:13b',
  'moondream:latest',
  // Code models
  'codellama:70b',
  'codellama:13b',
  'codegemma:7b',
  // Embedding models
  'nomic-embed-text:latest',
  'mxbai-embed-large:latest',
];

// ── Task routing reference ────────────────────────────────────────────────────

interface TaskModelRecommendation {
  task: string;
  description: string;
  localModel: string;
  freeCloudModel: string;
  bestModel: string;
}

const TASK_MODEL_RECOMMENDATIONS: TaskModelRecommendation[] = [
  {
    task: 'Title & Tags',
    description: 'Generate video titles and SEO keywords',
    localModel: 'llama3.2:3b / gemma3:4b',
    freeCloudModel: 'Groq llama-3.1-8b-instant',
    bestModel: 'DeepSeek Chat',
  },
  {
    task: 'Script Outline',
    description: 'Create structured video script outlines',
    localModel: 'llama3.3:70b / qwen2.5:32b',
    freeCloudModel: 'Groq llama-3.3-70b-versatile',
    bestModel: 'DeepSeek Chat',
  },
  {
    task: 'Full Script',
    description: 'Write complete 10-15 min video scripts',
    localModel: 'llama3.3:70b / deepseek-r1:32b',
    freeCloudModel: 'Cerebras llama3.1-70b',
    bestModel: 'Claude Sonnet / DeepSeek',
  },
  {
    task: 'Research',
    description: 'Deep topic research and summarization',
    localModel: 'deepseek-r1:70b / qwen2.5:72b',
    freeCloudModel: 'Perplexity Sonar Online',
    bestModel: 'Claude Sonnet / GPT-4o',
  },
  {
    task: 'Fact Check',
    description: 'Verify claims with web sources',
    localModel: 'Not recommended (no web access)',
    freeCloudModel: 'Perplexity Sonar Online',
    bestModel: 'Perplexity Sonar Pro',
  },
  {
    task: 'Compliance',
    description: 'YouTube policy compliance gate',
    localModel: 'Not recommended',
    freeCloudModel: 'Not recommended',
    bestModel: 'Claude Sonnet (required)',
  },
  {
    task: 'AI Copilot Chat',
    description: 'Real-time creator assistant',
    localModel: 'llama3.3:70b / gemma3:12b',
    freeCloudModel: 'Groq llama-3.3-70b-versatile',
    bestModel: 'Claude Haiku / Gemini Flash',
  },
  {
    task: 'Image Captions',
    description: 'Describe images for thumbnails/storyboards',
    localModel: 'llava:13b / moondream:latest',
    freeCloudModel: 'Groq llama-3.2-90b-vision',
    bestModel: 'GPT-4o Vision',
  },
];

// ── Main page ────────────────────────────────────────────────────────────────

export default function ModelManagerPage() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullInput, setPullInput] = useState('');
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullSuccess, setPullSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setPullError(null);
    setDeleteError(null);
    try {
      const res = await apiClient.get<{ name: string; size: number; modified: string }[]>(
        '/provider-configs/ollama/models',
      );
      setModels(res.data ?? []);
      setOllamaConnected(true);
    } catch {
      setOllamaConnected(false);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    setSystemLoading(true);
    apiClient
      .get<SystemStats>('/system/stats')
      .then(r => setSystemStats(r.data))
      .catch(() => {})
      .finally(() => setSystemLoading(false));
  }, []);

  async function handlePull() {
    const modelName = pullInput.trim();
    if (!modelName) return;
    setPulling(modelName);
    setPullError(null);
    setPullSuccess(null);
    try {
      await apiClient.post<{ ok: boolean; message: string }>('/provider-configs/ollama/pull', {
        model: modelName,
      });
      setPullSuccess(modelName);
      setPullInput('');
      await fetchModels();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to pull model. Check that Ollama is running and the model name is correct.';
      setPullError(message);
    } finally {
      setPulling(null);
    }
  }

  async function handleDelete(modelName: string) {
    setDeletingModel(modelName);
    setConfirmDelete(null);
    setDeleteError(null);
    try {
      await apiClient.delete<{ ok: boolean; message: string }>(
        `/provider-configs/ollama/models/${encodeURIComponent(modelName)}`,
      );
      setModels((prev) => prev.filter((m) => m.name !== modelName));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete model.';
      setDeleteError(message);
    } finally {
      setDeletingModel(null);
    }
  }

  return (
    <div className="min-h-full bg-[#F4F3FB]">
      <div className="px-4 py-6 sm:p-8 max-w-4xl mx-auto space-y-6">

        {/* ── System Stats ────────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            System Hardware
          </p>
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
            {systemLoading && !systemStats ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Detecting hardware…</span>
              </div>
            ) : systemStats ? (
              <>
                {/* Primary backend pill */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-700">Compute Backend:</span>
                  {(() => {
                    const backend = systemStats.primaryBackend;
                    const styles: Record<string, { bg: string; color: string; border: string }> = {
                      cuda:  { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                      metal: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
                      rocm:  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
                      intel: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                      cpu:   { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
                    };
                    const s = styles[backend] ?? styles['cpu']!;
                    return (
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide"
                        style={{ background: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}
                      >
                        {backend}
                      </span>
                    );
                  })()}
                </div>

                {/* GPU rows */}
                {systemStats.gpus.length > 0 && (
                  <div className="space-y-2">
                    {systemStats.gpus.map((gpu, i) => (
                      <div
                        key={i}
                        className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-3 py-2.5 rounded-xl"
                        style={{ background: '#faf9ff', border: '1px solid #f0edf9' }}
                      >
                        <span className="text-sm font-semibold text-gray-800 flex-1 truncate" title={gpu.name}>
                          {gpu.name}
                        </span>
                        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 font-medium shrink-0">
                          {gpu.memUsedMb != null && gpu.memTotalMb != null && (
                            <span>
                              VRAM {mbToGb(gpu.memUsedMb)} / {mbToGb(gpu.memTotalMb)}
                            </span>
                          )}
                          {gpu.utilizationPct != null && (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: '#ede9fb', color: '#6D4AE0' }}
                            >
                              {gpu.utilizationPct}% util
                            </span>
                          )}
                          {gpu.temperature != null && (
                            <span className="text-orange-500 font-semibold">{gpu.temperature}°C</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CPU + RAM row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div
                    className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl"
                    style={{ background: '#faf9ff', border: '1px solid #f0edf9' }}
                  >
                    <Cpu className="w-4 h-4 shrink-0" style={{ color: '#6D4AE0' }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate" title={systemStats.cpuModel}>
                        {systemStats.cpuModel}
                      </p>
                      <p className="text-xs text-gray-500">{systemStats.cpuCores} logical cores</p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 sm:w-48 px-3 py-2.5 rounded-xl"
                    style={{ background: '#faf9ff', border: '1px solid #f0edf9' }}
                  >
                    <MemoryStick className="w-4 h-4 shrink-0" style={{ color: '#6D4AE0' }} />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">System RAM</p>
                      <p className="text-xs text-gray-500">
                        {mbToGb(systemStats.totalRamMb - systemStats.freeRamMb)} used /{' '}
                        {mbToGb(systemStats.totalRamMb)} total
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">Hardware info unavailable.</p>
            )}
          </div>
        </section>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-5 h-5" style={{ color: '#6D4AE0' }} />
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Model Manager</h1>
            </div>
            <p className="text-sm text-gray-500">
              Download and manage local AI models. Requires Ollama to be running.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Ollama status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white" style={{ border: '1.5px solid #e3ddf8' }}>
              {ollamaConnected === null ? (
                <span className="w-2 h-2 rounded-full bg-gray-300" />
              ) : ollamaConnected ? (
                <span className="w-2 h-2 rounded-full bg-green-500" style={{ boxShadow: '0 0 0 2px #dcfce7' }} />
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-500" style={{ boxShadow: '0 0 0 2px #fee2e2' }} />
              )}
              <span className="text-xs font-semibold text-gray-600">
                {ollamaConnected === null
                  ? 'Checking…'
                  : ollamaConnected
                  ? 'Ollama connected'
                  : 'Ollama offline'}
              </span>
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => void fetchModels()}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ border: '1.5px solid #6D4AE0', color: '#6D4AE0', background: '#fff' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Ollama offline banner */}
        {ollamaConnected === false && (
          <div
            className="rounded-2xl px-4 py-4 flex items-start gap-3"
            style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}
          >
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Ollama is not running</p>
              <p className="text-xs text-red-600 mt-0.5">
                Start Ollama locally (<code className="bg-red-50 px-1 rounded">ollama serve</code>) then click
                Refresh to connect. Install from{' '}
                <a
                  href="https://ollama.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  ollama.ai
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* ── Installed models ─────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Installed Models
          </p>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            {loading && models.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading models…</span>
              </div>
            ) : models.length === 0 ? (
              <div className="py-12 text-center">
                <HardDrive className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No models installed yet.</p>
                <p className="text-xs text-gray-400 mt-1">Pull a model below to get started.</p>
              </div>
            ) : (
              models.map((model, idx) => {
                const isDeleting = deletingModel === model.name;
                const isConfirming = confirmDelete === model.name;

                return (
                  <div
                    key={model.name}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-[#faf9ff] transition-colors"
                    style={{ borderBottom: idx < models.length - 1 ? '1px solid #f0edf9' : 'none' }}
                  >
                    {/* Model icon */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: '#1a1a2e' }}
                    >
                      <span className="text-sm font-bold text-white select-none">O</span>
                    </div>

                    {/* Model info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 font-mono truncate">{model.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatSize(model.size)}
                        {model.modified && (
                          <> &middot; Modified {formatDate(model.modified)}</>
                        )}
                      </p>
                    </div>

                    {/* Delete action */}
                    {isConfirming ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500 hidden sm:block">Delete?</span>
                        <button
                          type="button"
                          onClick={() => void handleDelete(model.name)}
                          disabled={isDeleting}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-1 font-semibold"
                        >
                          {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1 text-xs rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                          style={{ border: '1.5px solid #e3ddf8' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(model.name)}
                        disabled={isDeleting || !!deletingModel}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 text-xs rounded-xl hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-40 font-semibold shrink-0"
                        style={{ border: '1.5px solid #e3ddf8' }}
                        aria-label={`Delete ${model.name}`}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {deleteError && (
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid #fee2e2', background: '#fef2f2' }}>
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{deleteError}</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Pull a new model ─────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-3">
            Pull a New Model
          </p>
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4" style={{ color: '#6D4AE0' }} />
              <span className="text-sm font-semibold text-gray-800">Download from Ollama Registry</span>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Enter a model name from{' '}
              <a
                href="https://ollama.ai/library"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: '#6D4AE0' }}
              >
                ollama.ai/library
              </a>
              . Large models may take several minutes to download.
            </p>

            {/* Input + button */}
            <div className="flex gap-2">
              <input
                type="text"
                value={pullInput}
                onChange={(e) => {
                  setPullInput(e.target.value);
                  setPullError(null);
                  setPullSuccess(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handlePull(); }}
                placeholder="e.g. llama3.2, mistral:7b, qwen2.5:14b"
                disabled={!!pulling}
                className="flex-1 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono disabled:opacity-50"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
              <button
                type="button"
                onClick={() => void handlePull()}
                disabled={!!pulling || !pullInput.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)',
                  boxShadow: '0 4px 20px rgba(109,74,224,0.35)',
                }}
              >
                {pulling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Pulling…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Pull Model
                  </>
                )}
              </button>
            </div>

            {/* Progress indicator while pulling */}
            {pulling && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}
              >
                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: '#6D4AE0' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#6D4AE0' }}>
                    Pulling model…
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{pulling}</p>
                </div>
              </div>
            )}

            {/* Success message */}
            {pullSuccess && !pulling && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}
              >
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-700">
                  <span className="font-semibold font-mono">{pullSuccess}</span> pulled successfully.
                </p>
              </div>
            )}

            {/* Error message */}
            {pullError && (
              <div
                className="flex items-start gap-2 px-4 py-3 rounded-xl"
                style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}
              >
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{pullError}</p>
              </div>
            )}

            {/* Suggested model chips */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Popular models</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_MODELS.map((name) => {
                  const isInstalled = models.some((m) => m.name === name);
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={!!pulling || isInstalled}
                      onClick={() => {
                        setPullInput(name);
                        setPullError(null);
                        setPullSuccess(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80 active:scale-[0.97] disabled:opacity-50 disabled:cursor-default font-mono"
                      style={{
                        background: isInstalled ? '#f0fdf4' : '#f5f2fd',
                        color: isInstalled ? '#16a34a' : '#6D4AE0',
                        border: `1.5px solid ${isInstalled ? '#bbf7d0' : '#e3ddf8'}`,
                      }}
                      title={isInstalled ? 'Already installed' : `Click to select ${name}`}
                    >
                      {isInstalled && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Task Routing Reference */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #ece8f8', overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #ece8f8' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e1b4b', margin: 0 }}>Task → Model Routing Guide</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Which model the platform auto-selects per task type. Local models = $0/token.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9f8ff' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #ece8f8' }}>Task</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #ece8f8' }}>Local (Ollama)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#059669', borderBottom: '1px solid #ece8f8' }}>Free Cloud</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6D4AE0', borderBottom: '1px solid #ece8f8' }}>Best Quality</th>
                </tr>
              </thead>
              <tbody>
                {TASK_MODEL_RECOMMENDATIONS.map((row, i) => (
                  <tr key={row.task} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 600, color: '#1e1b4b' }}>{row.task}</div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{row.description}</div>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 12 }}>{row.localModel}</td>
                    <td style={{ padding: '10px 16px', color: '#059669', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 12 }}>{row.freeCloudModel}</td>
                    <td style={{ padding: '10px 16px', color: '#6D4AE0', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 12 }}>{row.bestModel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
