'use client';
import React, { useState } from 'react';
import { Sparkles, Loader2, Download, RefreshCw, Palette, Layout, Image as ImageIcon } from 'lucide-react';

interface ThumbnailPromptVariant {
  style: string;
  prompt: string;
  negativePrompt?: string;
  reasoning: string;
}

interface ThumbnailResult {
  prompts: ThumbnailPromptVariant[];
  suggestedTitle: string;
  suggestedSubtitle?: string;
  colorPalette?: string[];
  imageUrls: string[];
}

const STYLE_OPTIONS = [
  { value: 'bold', label: 'Bold & Vibrant', desc: 'High contrast, eye-catching' },
  { value: 'minimal', label: 'Minimal', desc: 'Clean and professional' },
  { value: 'dramatic', label: 'Dramatic', desc: 'Cinematic and intense' },
  { value: 'educational', label: 'Educational', desc: 'Clear and informative' },
  { value: 'vlog', label: 'Vlog Style', desc: 'Personal and authentic' },
];

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

interface ThumbnailGeneratorProps {
  initialTitle?: string;
  initialScript?: string;
  channelTopic?: string;
}

export function ThumbnailGenerator({ initialTitle = '', initialScript = '', channelTopic = 'YouTube' }: ThumbnailGeneratorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [script, setScript] = useState(initialScript);
  const [style, setStyle] = useState<'bold' | 'minimal' | 'dramatic' | 'educational' | 'vlog'>('bold');
  const [generateImages, setGenerateImages] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThumbnailResult | null>(null);
  const [activePrompt, setActivePrompt] = useState(0);

  async function generate() {
    if (!title.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/v1/media-library/thumbnail/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          videoTitle: title.trim(),
          scriptExcerpt: script.trim(),
          channelTopic,
          style,
          generateImages,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json() as ThumbnailResult);
    } catch (err) { setError(err instanceof Error ? err.message : 'Generation failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      {/* Input form */}
      <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">AI Thumbnail Generator</p>
            <p className="text-xs text-gray-400">Get 3-4 professional thumbnail concepts instantly</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Video title <span className="text-red-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 5 Productivity Hacks That Changed My Life"
              className="w-full bg-[#faf9ff] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
              style={{ border: '1.5px solid #e3ddf8' }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Script excerpt (optional — improves accuracy)</label>
            <textarea value={script} onChange={e => setScript(e.target.value)} rows={3}
              placeholder="Paste the first paragraph or hook of your script…"
              className="w-full bg-[#faf9ff] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 resize-none"
              style={{ border: '1.5px solid #e3ddf8' }} />
          </div>
        </div>

        {/* Style picker */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Thumbnail style</p>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setStyle(o.value as typeof style)}
                className="flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all"
                style={style === o.value
                  ? { background: '#f5f2fd', border: '1.5px solid #6D4AE0', color: '#6D4AE0' }
                  : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }}>
                <span className="text-xs font-semibold">{o.label}</span>
                <span className="text-[10px] text-gray-400">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)}
              className="rounded" />
            <span className="text-xs text-gray-600">Generate AI images <span className="text-gray-400">(uses DALL-E 3 credits)</span></span>
          </label>
          <button onClick={() => void generate()} disabled={loading || !title.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.35)' }}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : result ? <><RefreshCw className="w-4 h-4" /> Regenerate</> : <><Sparkles className="w-4 h-4" /> Generate</>}
          </button>
        </div>
        {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>{error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Suggested title + palette */}
          <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4" style={{ color: '#6D4AE0' }} />
              <p className="text-sm font-bold text-gray-800">AI Suggested Title</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8' }}>
              <p className="text-base font-extrabold text-gray-900">{result.suggestedTitle}</p>
              {result.suggestedSubtitle && <p className="text-sm text-gray-500 mt-1">{result.suggestedSubtitle}</p>}
            </div>
            {result.colorPalette && result.colorPalette.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500">Suggested color palette</p>
                </div>
                <div className="flex gap-2">
                  {result.colorPalette.map(color => (
                    <div key={color} className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-lg shadow-sm" style={{ background: color }} />
                      <span className="text-[10px] font-mono text-gray-400">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generated images */}
          {result.imageUrls.length > 0 && (
            <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" style={{ color: '#6D4AE0' }} />
                <p className="text-sm font-bold text-gray-800">Generated Thumbnails</p>
                <span className="text-[11px] text-gray-400">(AI generated — add text overlay in editor)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.imageUrls.map((url, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                    <img src={url} alt={`Thumbnail variant ${i + 1}`} className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a href={url} download target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-gray-800">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt variants */}
          <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
            <p className="text-sm font-bold text-gray-800">Thumbnail Concepts ({result.prompts.length})</p>
            <div className="flex gap-2 flex-wrap">
              {result.prompts.map((_, i) => (
                <button key={i} onClick={() => setActivePrompt(i)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={activePrompt === i ? { background: '#6D4AE0', color: '#fff' } : { background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}>
                  Concept {i + 1}
                </button>
              ))}
            </div>
            {result.prompts[activePrompt] && (
              <div className="space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-purple-600">{result.prompts[activePrompt].style}</span>
                  <p className="text-xs text-gray-500 mt-1 italic leading-relaxed">"{result.prompts[activePrompt].reasoning}"</p>
                </div>
                <div className="rounded-xl p-3 space-y-2" style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8' }}>
                  <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Image prompt</p>
                  <p className="text-xs text-gray-700 leading-relaxed font-mono">{result.prompts[activePrompt].prompt}</p>
                </div>
                <button
                  onClick={() => { void navigator.clipboard.writeText(result.prompts[activePrompt].prompt); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}>
                  Copy prompt
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
