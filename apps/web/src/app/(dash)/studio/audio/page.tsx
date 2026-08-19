'use client';
import { useState } from 'react';
import { Volume2, Waves, Scissors, CheckCircle, Loader2, AlertCircle, ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface StepResult { label: string; outPath: string; }
interface PipelineResult { steps: StepResult[]; finalPath: string; }

export default function AudioStudioPage() {
  const [inputPath, setInputPath]     = useState('');

  // Step toggles (all on by default for best UX)
  const [trimEnabled,      setTrimEnabled]      = useState(true);
  const [denoiseEnabled,   setDenoiseEnabled]   = useState(true);
  const [normalizeEnabled, setNormalizeEnabled] = useState(true);

  // Step settings
  const [thresholdDb,      setThresholdDb]      = useState(-35);
  const [denoiseStrength,  setDenoiseStrength]  = useState<'light' | 'medium' | 'strong'>('medium');
  const [targetLufs,       setTargetLufs]       = useState(-14);

  // Collapsed state per step
  const [trimOpen,      setTrimOpen]      = useState(true);
  const [denoiseOpen,   setDenoiseOpen]   = useState(true);
  const [normalizeOpen, setNormalizeOpen] = useState(true);

  const [loading,      setLoading]      = useState(false);
  const [activeStep,   setActiveStep]   = useState<'trim' | 'denoise' | 'normalize' | null>(null);
  const [result,       setResult]       = useState<PipelineResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  const enabledCount = [trimEnabled, denoiseEnabled, normalizeEnabled].filter(Boolean).length;

  async function runPipeline() {
    if (!inputPath.trim()) { setError('Enter a file path first'); return; }
    if (enabledCount === 0) { setError('Enable at least one processing step'); return; }
    setLoading(true);
    setResult(null);
    setError(null);
    const steps: StepResult[] = [];
    let current = inputPath.trim();
    try {
      if (trimEnabled) {
        setActiveStep('trim');
        const res = await apiClient.post<{ outPath: string }>('/editor/audio/trim-silence', { inputPath: current, thresholdDb });
        current = res.data.outPath;
        steps.push({ label: 'Silence trimmed', outPath: current });
      }
      if (denoiseEnabled) {
        setActiveStep('denoise');
        const res = await apiClient.post<{ outPath: string }>('/editor/audio/denoise', { inputPath: current, strength: denoiseStrength });
        current = res.data.outPath;
        steps.push({ label: 'Noise removed', outPath: current });
      }
      if (normalizeEnabled) {
        setActiveStep('normalize');
        const res = await apiClient.post<{ outPath: string }>('/editor/audio/normalize', { inputPath: current, targetLufs });
        current = res.data.outPath;
        steps.push({ label: 'Loudness normalized', outPath: current });
      }
      setResult({ steps, finalPath: current });
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Processing failed')
        : 'Processing failed';
      setError(String(msg));
    } finally {
      setLoading(false);
      setActiveStep(null);
    }
  }

  return (
    <div className="p-5 lg:p-7 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Audio Tools</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Toggle the steps you need, adjust settings, then run the whole pipeline in one click.
        </p>
      </div>

      {/* File input */}
      <div className="bg-white rounded-2xl p-4 space-y-2" style={{ border: '1.5px solid #e3ddf8' }}>
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block">Audio / Video File Path</label>
        <input
          type="text"
          value={inputPath}
          onChange={e => { setInputPath(e.target.value); setResult(null); setError(null); }}
          placeholder="/data/sozialzync/projects/my-recording.mp4"
          className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
          style={{ borderColor: '#d4c9f9' }}
        />
        <p className="text-[11px] text-gray-400">Server-side absolute path — the output file is saved alongside with a suffix.</p>
      </div>

      {/* ── Step 1: Silence Trimmer ── */}
      <StepCard
        step={1}
        icon={<Scissors className="w-4 h-4" />}
        label="Silence Trimmer"
        description="Remove long silent gaps from the recording."
        color="#16a34a"
        bg="#f0fdf4"
        borderColor="#bbf7d0"
        enabled={trimEnabled}
        onToggle={() => setTrimEnabled(v => !v)}
        open={trimOpen}
        onOpenToggle={() => setTrimOpen(v => !v)}
        running={activeStep === 'trim'}
        done={!!result?.steps.find(s => s.label === 'Silence trimmed')}
      >
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Silence threshold</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={-60} max={-20} value={thresholdDb}
              onChange={e => setThresholdDb(Number(e.target.value))}
              className="flex-1" disabled={!trimEnabled}
            />
            <span className="text-sm font-bold w-16 text-right" style={{ color: '#16a34a' }}>{thresholdDb} dB</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">-35 dB is a good default for voice recordings.</p>
        </div>
      </StepCard>

      <StepConnector />

      {/* ── Step 2: Noise Removal ── */}
      <StepCard
        step={2}
        icon={<Waves className="w-4 h-4" />}
        label="Noise Removal"
        description="Remove background hiss, hum, and room noise."
        color="#0891b2"
        bg="#ecfeff"
        borderColor="#a5f3fc"
        enabled={denoiseEnabled}
        onToggle={() => setDenoiseEnabled(v => !v)}
        open={denoiseOpen}
        onOpenToggle={() => setDenoiseOpen(v => !v)}
        running={activeStep === 'denoise'}
        done={!!result?.steps.find(s => s.label === 'Noise removed')}
      >
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Reduction strength</label>
          <div className="flex gap-2">
            {(['light', 'medium', 'strong'] as const).map(s => (
              <button
                key={s}
                onClick={() => setDenoiseStrength(s)}
                disabled={!denoiseEnabled}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors capitalize disabled:opacity-40"
                style={denoiseStrength === s
                  ? { background: '#0891b2', color: 'white', borderColor: '#0891b2' }
                  : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </StepCard>

      <StepConnector />

      {/* ── Step 3: Loudness Normalize ── */}
      <StepCard
        step={3}
        icon={<Volume2 className="w-4 h-4" />}
        label="Loudness Normalize"
        description="Set final volume to YouTube standard (-14 LUFS)."
        color="#6D4AE0"
        bg="#f5f2fd"
        borderColor="#ddd6fe"
        enabled={normalizeEnabled}
        onToggle={() => setNormalizeEnabled(v => !v)}
        open={normalizeOpen}
        onOpenToggle={() => setNormalizeOpen(v => !v)}
        running={activeStep === 'normalize'}
        done={!!result?.steps.find(s => s.label === 'Loudness normalized')}
      >
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Target loudness</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={-24} max={-9} value={targetLufs}
              onChange={e => setTargetLufs(Number(e.target.value))}
              className="flex-1" disabled={!normalizeEnabled}
            />
            <span className="text-sm font-bold w-14 text-right" style={{ color: '#6D4AE0' }}>{targetLufs} LUFS</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
            <span>Quiet (-24)</span><span>YouTube (-14) ★</span><span>Loud (-9)</span>
          </div>
        </div>
      </StepCard>

      {/* Run button */}
      <button
        onClick={() => void runPipeline()}
        disabled={loading || enabledCount === 0 || !inputPath.trim()}
        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          : <>{enabledCount === 0 ? 'Enable at least one step' : `Run ${enabledCount} Step${enabledCount > 1 ? 's' : ''}`}</>
        }
      </button>

      {/* Result */}
      {result && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-sm font-bold text-green-800">Pipeline complete — {result.steps.length} step{result.steps.length > 1 ? 's' : ''} applied</p>
          </div>
          <div className="space-y-1.5">
            {result.steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="text-xs font-semibold text-green-800">{s.label}</p>
                  <p className="text-[11px] text-green-700 font-mono break-all">{s.outPath}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-green-200">
            <p className="text-[11px] text-green-700 font-semibold">Final output:</p>
            <p className="text-xs text-green-800 font-mono break-all mt-0.5">{result.finalPath}</p>
          </div>
          <div className="pt-2 border-t border-green-100">
            <a href="/shorts-studio" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: '#6D4AE0' }}>
              Open in Shorts Studio →
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

// ── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({
  step, icon, label, description,
  color, bg, borderColor,
  enabled, onToggle,
  open, onOpenToggle,
  running, done,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  bg: string;
  borderColor: string;
  enabled: boolean;
  onToggle: () => void;
  open: boolean;
  onOpenToggle: () => void;
  running: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: `1.5px solid ${enabled ? borderColor : '#e5e7eb'}`,
        background: enabled ? bg : '#f9fafb',
        opacity: enabled ? 1 : 0.6,
      }}
    >
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Step number */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold"
          style={{ background: enabled ? color : '#d1d5db', color: '#fff' }}
        >
          {done ? <CheckCircle className="w-4 h-4" /> : running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : step}
        </div>
        {/* Icon + label */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0" style={{ color: enabled ? color : '#9ca3af' }}>
          {icon}
          <span className="text-sm font-bold truncate">{label}</span>
        </div>
        {/* Toggle switch */}
        <button
          type="button"
          onClick={onToggle}
          className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
          style={{ background: enabled ? color : '#d1d5db' }}
          aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}
        >
          <span
            className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5"
            style={{ marginLeft: enabled ? '18px' : '2px' }}
          />
        </button>
        {/* Collapse toggle */}
        {enabled && (
          <button
            type="button"
            onClick={onOpenToggle}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={open ? 'Collapse settings' : 'Expand settings'}
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Description + settings */}
      {enabled && open && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor }}>
          <p className="text-xs text-gray-500 pt-3">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Step Connector ─────────────────────────────────────────────────────────────

function StepConnector() {
  return (
    <div className="flex justify-center -my-1">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-0.5 h-3 bg-[#e3ddf8] rounded" />
        <ArrowDown className="w-3.5 h-3.5 text-[#c4b8f0]" />
        <div className="w-0.5 h-3 bg-[#e3ddf8] rounded" />
      </div>
    </div>
  );
}
