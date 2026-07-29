'use client';
import Link from 'next/link';
import { Server, Cpu, Zap, HardDrive, Puzzle, ArrowRight, CheckCircle } from 'lucide-react';

interface Section {
  icon: React.ElementType;
  title: string;
  color: string;
  bg: string;
  content: React.ReactNode;
}

export default function SelfHostedGuidePage() {
  const sections: Section[] = [
    {
      icon: Server,
      title: 'AI Provider Architecture',
      color: '#6D4AE0',
      bg: '#f5f2fd',
      content: (
        <div className="space-y-3 text-sm text-gray-600">
          <p>The platform uses a <strong>provider-first</strong> architecture. Every AI feature routes through a provider registry that tries local/self-hosted options before falling back to cloud APIs.</p>
          <p className="font-semibold text-gray-700">Priority order:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Local models (Ollama, LM Studio, vLLM)</li>
            <li>Self-hosted instances (LocalAI, Text Generation WebUI)</li>
            <li>OpenRouter (any model via unified API)</li>
            <li>Cloud APIs (OpenAI, Anthropic, Gemini) — optional</li>
          </ol>
          <p>Configure providers at <Link href="/settings/ai-providers" className="text-[#6D4AE0] font-semibold hover:underline">Settings → AI Providers →</Link></p>
        </div>
      ),
    },
    {
      icon: Cpu,
      title: 'GPU Detection & Backends',
      color: '#16a34a',
      bg: '#f0fdf4',
      content: (
        <div className="space-y-3 text-sm text-gray-600">
          <p>The system automatically detects your compute hardware at startup and selects the best backend:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { backend: 'NVIDIA CUDA', cmd: 'nvidia-smi', desc: 'Best performance, all models' },
              { backend: 'AMD ROCm', cmd: 'rocm-smi', desc: 'Most models supported' },
              { backend: 'Apple Metal', cmd: 'system_profiler', desc: 'MLX-optimised models' },
              { backend: 'CPU fallback', cmd: 'auto', desc: 'Small models only, slow' },
            ].map(b => (
              <div key={b.backend} className="rounded-xl p-3" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                <p className="font-bold text-gray-900 text-xs">{b.backend}</p>
                <p className="text-gray-400 text-[11px]">{b.desc}</p>
              </div>
            ))}
          </div>
          <p>View current hardware at <Link href="/settings/gpu" className="text-[#6D4AE0] font-semibold hover:underline">Settings → GPU &amp; Hardware →</Link></p>
        </div>
      ),
    },
    {
      icon: Zap,
      title: 'Quick Start — Local LLM',
      color: '#d97706',
      bg: '#fffbeb',
      content: (
        <div className="space-y-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-700">Option A — Ollama (recommended)</p>
          <div className="rounded-xl p-3 font-mono text-xs" style={{ background: '#1e1b2e', color: '#a78bfa' }}>
            <p># Install Ollama</p>
            <p>curl -fsSL https://ollama.ai/install.sh | sh</p>
            <p className="mt-2"># Pull a model</p>
            <p>ollama pull llama3.2</p>
            <p className="mt-2"># Ollama runs on http://localhost:11434</p>
          </div>
          <p>Then add <code className="bg-gray-100 px-1 rounded text-xs">OLLAMA_URL=http://localhost:11434</code> to your <code className="bg-gray-100 px-1 rounded text-xs">.env</code> and configure at <Link href="/settings/ai-providers" className="text-[#6D4AE0] font-semibold hover:underline">AI Providers →</Link></p>
          <p className="font-semibold text-gray-700">Option B — LM Studio</p>
          <p>Download LM Studio, load any GGUF model, start the local server on port 1234. Set <code className="bg-gray-100 px-1 rounded text-xs">LM_STUDIO_URL=http://localhost:1234</code>.</p>
        </div>
      ),
    },
    {
      icon: HardDrive,
      title: 'Quick Start — Image & Video Generation',
      color: '#0891b2',
      bg: '#ecfeff',
      content: (
        <div className="space-y-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-700">ComfyUI (recommended for both image + video)</p>
          <div className="rounded-xl p-3 font-mono text-xs" style={{ background: '#1e1b2e', color: '#67e8f9' }}>
            <p>git clone https://github.com/comfyanonymous/ComfyUI</p>
            <p>cd ComfyUI && pip install -r requirements.txt</p>
            <p>python main.py --listen 0.0.0.0 --port 8188</p>
          </div>
          <p>Set <code className="bg-gray-100 px-1 rounded text-xs">COMFYUI_URL=http://localhost:8188</code>. Download SDXL or FLUX checkpoints to <code className="bg-gray-100 px-1 rounded text-xs">models/checkpoints/</code>.</p>
          <p className="font-semibold text-gray-700">Automatic1111 (image only)</p>
          <p>Set <code className="bg-gray-100 px-1 rounded text-xs">A1111_URL=http://localhost:7860</code> after starting with <code className="bg-gray-100 px-1 rounded text-xs">--api</code> flag.</p>
        </div>
      ),
    },
    {
      icon: Puzzle,
      title: 'Plugin System',
      color: '#be185d',
      bg: '#fdf2f8',
      content: (
        <div className="space-y-3 text-sm text-gray-600">
          <p>The plugin registry lets you hook into content generation and publishing events without modifying core code.</p>
          <p className="font-semibold text-gray-700">Available hooks:</p>
          <div className="flex flex-wrap gap-2">
            {['before:generate', 'after:generate', 'before:publish', 'after:publish', 'on:error'].map(h => (
              <code key={h} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'white', border: '1px solid #fbcfe8', color: '#be185d' }}>{h}</code>
            ))}
          </div>
          <p>Implement the <code className="bg-gray-100 px-1 rounded text-xs">IPlugin</code> interface from <code className="bg-gray-100 px-1 rounded text-xs">apps/api/src/modules/plugins/plugin.types.ts</code> and register via <code className="bg-gray-100 px-1 rounded text-xs">PluginRegistryService.register()</code>.</p>
          <p>Active plugins: <Link href="/api/v1/plugins" className="text-[#6D4AE0] font-semibold hover:underline">GET /api/v1/plugins →</Link></p>
        </div>
      ),
    },
  ];

  const checks = [
    'Ollama running on localhost:11434',
    'OLLAMA_URL set in .env',
    'At least one model pulled (ollama pull llama3.2)',
    'COMFYUI_URL set if using image generation',
    'KOKORO_URL or PIPER_URL set for local TTS',
    'Provider configured at Settings → AI Providers',
    'Connection tested (green status)',
  ];

  return (
    <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Self-Hosted AI Guide</h1>
        <p className="text-sm text-gray-400 mt-0.5">Run AI generation locally — no cloud API required</p>
      </div>

      {/* Quick status checklist */}
      <div className="rounded-2xl p-5" style={{ background: '#f5f2fd', border: '1.5px solid #d4c9f9' }}>
        <p className="text-sm font-bold mb-3" style={{ color: '#4c1d95' }}>Setup checklist</p>
        <div className="space-y-1.5">
          {checks.map(c => (
            <div key={c} className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-[#6D4AE0] shrink-0" />
              <p className="text-xs text-gray-600">{c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map(({ icon: Icon, title, color, bg, content }) => (
          <div key={title} className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: bg }}>
              <Icon className="w-5 h-5 shrink-0" style={{ color }} />
              <p className="font-bold text-gray-900">{title}</p>
            </div>
            <div className="px-5 py-4 bg-white">{content}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/settings/ai-providers" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#6D4AE0' }}>
          Configure AI Providers <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/settings/gpu" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
          View GPU Hardware <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
