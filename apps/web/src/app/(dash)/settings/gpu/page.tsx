'use client';
import { useState, useEffect, useCallback } from 'react';
import { Cpu, Zap, RefreshCw, Loader2, Thermometer, HardDrive, Activity } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface GpuInfo {
  backend: string;
  name: string;
  vramMb?: number;
  driverVersion?: string;
  utilizationPct?: number;
  memUsedMb?: number;
  temperature?: number;
}

interface SystemStats {
  gpus: GpuInfo[];
  primaryBackend: string;
  cpuModel: string;
  cpuCores: number;
}

const BACKEND_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  cuda:   { bg: '#f0fdf4', color: '#16a34a', label: 'NVIDIA CUDA' },
  rocm:   { bg: '#fff7ed', color: '#ea580c', label: 'AMD ROCm'    },
  metal:  { bg: '#faf5ff', color: '#9333ea', label: 'Apple Metal' },
  intel:  { bg: '#eff6ff', color: '#2563eb', label: 'Intel GPU'   },
  cpu:    { bg: '#f9fafb', color: '#6b7280', label: 'CPU Fallback' },
};

const COMPATIBLE_MODELS: Record<string, string[]> = {
  cuda:  ['Llama 3.x', 'Qwen 2.5', 'DeepSeek', 'Mistral', 'FLUX', 'ComfyUI SDXL', 'Kokoro TTS', 'Coqui XTTS'],
  rocm:  ['Llama 3.x', 'Mistral', 'FLUX (experimental)', 'ComfyUI SDXL'],
  metal: ['Llama 3.x (MLX)', 'Mistral (MLX)', 'Kokoro TTS', 'Stable Diffusion'],
  intel: ['Llama 3.x (OpenVINO)', 'Kokoro TTS'],
  cpu:   ['Llama 3.2 3B (slow)', 'Phi-3 Mini', 'Piper TTS', 'Kokoro TTS (slow)'],
};

export default function GpuPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const r = await apiClient.get<SystemStats>(`/system/stats${forceRefresh ? '?refresh=true' : ''}`);
      setStats(r.data);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const primary = stats?.primaryBackend ?? 'cpu';
  const backendMeta = BACKEND_COLORS[primary] ?? BACKEND_COLORS['cpu']!;

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">GPU &amp; Hardware</h1>
          <p className="text-sm text-gray-400 mt-0.5">Detected compute resources for self-hosted AI</p>
        </div>
        <button
          onClick={() => void load(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Primary backend badge */}
      {stats && (
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: backendMeta.bg, border: `1.5px solid ${backendMeta.color}30` }}>
          <Zap className="w-8 h-8 shrink-0" style={{ color: backendMeta.color }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: backendMeta.color }}>Primary Compute Backend</p>
            <p className="text-xl font-extrabold text-gray-900 mt-0.5">{backendMeta.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">All self-hosted AI models will use this backend by default</p>
          </div>
        </div>
      )}

      {/* GPU list */}
      {loading && !stats ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#6D4AE0]" /></div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Detected GPUs</h2>
          {stats?.gpus.map((gpu, i) => {
            const meta = BACKEND_COLORS[gpu.backend] ?? BACKEND_COLORS['cpu']!;
            const vramPct = gpu.vramMb && gpu.memUsedMb ? Math.round((gpu.memUsedMb / gpu.vramMb) * 100) : null;
            return (
              <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'white', border: '1.5px solid #e3ddf8' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-gray-900">{gpu.name}</p>
                    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                  {gpu.driverVersion && <p className="text-xs text-gray-400 shrink-0">Driver {gpu.driverVersion}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {gpu.vramMb && (
                    <div className="rounded-xl p-3" style={{ background: '#faf9ff', border: '1px solid #e3ddf8' }}>
                      <HardDrive className="w-4 h-4 text-[#6D4AE0] mb-1" />
                      <p className="text-lg font-extrabold text-gray-900">{(gpu.vramMb / 1024).toFixed(1)} GB</p>
                      <p className="text-xs text-gray-400">VRAM Total</p>
                    </div>
                  )}
                  {gpu.utilizationPct !== undefined && (
                    <div className="rounded-xl p-3" style={{ background: '#faf9ff', border: '1px solid #e3ddf8' }}>
                      <Activity className="w-4 h-4 text-blue-500 mb-1" />
                      <p className="text-lg font-extrabold text-gray-900">{gpu.utilizationPct}%</p>
                      <p className="text-xs text-gray-400">GPU Load</p>
                    </div>
                  )}
                  {gpu.temperature !== undefined && (
                    <div className="rounded-xl p-3" style={{ background: '#faf9ff', border: '1px solid #e3ddf8' }}>
                      <Thermometer className="w-4 h-4 text-orange-500 mb-1" />
                      <p className="text-lg font-extrabold text-gray-900">{gpu.temperature}°C</p>
                      <p className="text-xs text-gray-400">Temperature</p>
                    </div>
                  )}
                </div>

                {vramPct !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>VRAM usage</span>
                      <span>{gpu.memUsedMb} MB / {gpu.vramMb} MB ({vramPct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${vramPct}%`, background: vramPct > 85 ? '#ef4444' : vramPct > 60 ? '#f59e0b' : '#6D4AE0' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CPU */}
      {stats && (
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'white', border: '1.5px solid #e3ddf8' }}>
          <Cpu className="w-6 h-6 text-gray-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-gray-900">{stats.cpuModel}</p>
            <p className="text-xs text-gray-400">{stats.cpuCores} logical cores</p>
          </div>
        </div>
      )}

      {/* Compatible models */}
      {stats && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#f5f2fd', border: '1px solid #d4c9f9' }}>
          <p className="text-sm font-bold" style={{ color: '#4c1d95' }}>Compatible self-hosted models for {backendMeta.label}</p>
          <div className="flex flex-wrap gap-2">
            {(COMPATIBLE_MODELS[primary] ?? COMPATIBLE_MODELS['cpu']!).map(m => (
              <span key={m} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'white', color: '#6D4AE0', border: '1px solid #d4c9f9' }}>{m}</span>
            ))}
          </div>
          <p className="text-xs text-gray-500">Configure providers at <a href="/settings/ai-providers" className="text-[#6D4AE0] font-semibold hover:underline">Settings → AI Providers</a></p>
        </div>
      )}
    </div>
  );
}
