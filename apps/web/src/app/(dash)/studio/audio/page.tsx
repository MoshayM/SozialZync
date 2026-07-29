'use client';
import { useState } from 'react';
import { Volume2, Waves, Scissors, CheckCircle, Loader2, AlertCircle, Upload } from 'lucide-react';
import { apiClient } from '@/lib/api';

type Tool = 'normalize' | 'denoise' | 'trim';

const TOOLS: { id: Tool; icon: React.ElementType; label: string; description: string; color: string; bg: string }[] = [
  {
    id: 'normalize',
    icon: Volume2,
    label: 'Loudness Normalize',
    description: 'Normalize audio to -14 LUFS (YouTube standard). Fixes audio that is too loud or too quiet.',
    color: '#6D4AE0',
    bg: '#f5f2fd',
  },
  {
    id: 'denoise',
    icon: Waves,
    label: 'Noise Removal',
    description: 'Remove background hiss, hum, and room noise using AI-based filtering.',
    color: '#0891b2',
    bg: '#ecfeff',
  },
  {
    id: 'trim',
    icon: Scissors,
    label: 'Silence Trimmer',
    description: 'Remove long silent gaps from a recording. Great for raw voiceovers and podcasts.',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
];

export default function AudioStudioPage() {
  const [activeTool, setActiveTool] = useState<Tool>('normalize');
  const [inputPath, setInputPath] = useState('');
  const [denoiseStrength, setDenoiseStrength] = useState<'light' | 'medium' | 'strong'>('medium');
  const [thresholdDb, setThresholdDb] = useState(-35);
  const [targetLufs, setTargetLufs] = useState(-14);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ outPath: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toolMeta = TOOLS.find(t => t.id === activeTool)!;

  async function run() {
    if (!inputPath.trim()) { setError('Enter a file path to process'); return; }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let res: { data: { outPath: string } };
      if (activeTool === 'normalize') {
        res = await apiClient.post('/editor/audio/normalize', { inputPath, targetLufs });
      } else if (activeTool === 'denoise') {
        res = await apiClient.post('/editor/audio/denoise', { inputPath, strength: denoiseStrength });
      } else {
        res = await apiClient.post('/editor/audio/trim-silence', { inputPath, thresholdDb });
      }
      setResult(res.data);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Processing failed')
        : 'Processing failed';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Audio Studio</h1>
        <p className="text-sm text-gray-400 mt-0.5">FFmpeg-powered audio processing — runs locally, no cloud required</p>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-3 gap-3">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setActiveTool(tool.id); setResult(null); setError(null); }}
              className="rounded-2xl p-4 text-left transition-all"
              style={{
                background: active ? tool.bg : 'white',
                border: `1.5px solid ${active ? tool.color : '#e3ddf8'}`,
                boxShadow: active ? `0 0 0 2px ${tool.color}20` : 'none',
              }}
            >
              <Icon className="w-5 h-5 mb-2" style={{ color: tool.color }} />
              <p className="text-sm font-bold text-gray-900">{tool.label}</p>
            </button>
          );
        })}
      </div>

      {/* Active tool card */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: toolMeta.bg, border: `1.5px solid ${toolMeta.color}30` }}>
        <div className="flex items-start gap-3">
          <toolMeta.icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: toolMeta.color }} />
          <p className="text-sm text-gray-600">{toolMeta.description}</p>
        </div>

        {/* File path input */}
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Input file path (server-side absolute path)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputPath}
              onChange={e => setInputPath(e.target.value)}
              placeholder="/data/sozialzync/projects/my-video.mp4"
              className="flex-1 px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2"
              style={{ borderColor: '#d4c9f9', '--tw-ring-color': toolMeta.color } as React.CSSProperties}
            />
            <Upload className="w-4 h-4 text-gray-400 self-center shrink-0" />
          </div>
        </div>

        {/* Tool-specific options */}
        {activeTool === 'normalize' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Target LUFS</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-24}
                max={-9}
                value={targetLufs}
                onChange={e => setTargetLufs(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold w-12 text-right" style={{ color: toolMeta.color }}>{targetLufs} LUFS</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
              <span>Quiet (-24)</span>
              <span>YouTube (-14) ★</span>
              <span>Loud (-9)</span>
            </div>
          </div>
        )}

        {activeTool === 'denoise' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Noise reduction strength</label>
            <div className="flex gap-2">
              {(['light', 'medium', 'strong'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setDenoiseStrength(s)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors capitalize"
                  style={denoiseStrength === s
                    ? { background: toolMeta.color, color: 'white', borderColor: toolMeta.color }
                    : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTool === 'trim' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Silence threshold (dB)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-60}
                max={-20}
                value={thresholdDb}
                onChange={e => setThresholdDb(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold w-16 text-right" style={{ color: toolMeta.color }}>{thresholdDb} dB</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Gaps quieter than this threshold are removed. -35 dB is a good default for voice recordings.</p>
          </div>
        )}

        <button
          onClick={() => void run()}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity"
          style={{ background: loading ? '#9ca3af' : toolMeta.color }}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <>Process Audio</>}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">Done!</p>
            <p className="text-xs text-green-700 font-mono mt-1 break-all">{result.outPath}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <p className="font-semibold text-gray-700">How it works</p>
        <p>Processing runs on the API server using FFmpeg. The output file is saved alongside the input with a suffix (_normalized, _denoised, _trimmed). No data leaves your server.</p>
        <p>For batch processing, use the API directly: <code className="bg-gray-100 px-1 rounded">POST /api/v1/editor/audio/normalize</code></p>
      </div>
    </div>
  );
}
