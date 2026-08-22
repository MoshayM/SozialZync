'use client';
import { useState, useRef, useEffect } from 'react';
import { BookOpen, Loader2, AlertTriangle, Clock, Copy, Check, FolderPlus, Compass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ContentToolbar } from '@/components/result-actions';
import { AiWorkingCard, formatDuration } from '@/components/ai-activity';

interface ContentAngle {
  angle: string;
  hook: string;
  targetAudience?: string;
}

interface ResearchResult {
  topic: string;
  summary: string;
  keyFacts: string[];
  contentAngles: ContentAngle[];
  expertPerspectives?: string[];
  relatedTopics: string[];
  statisticsAndData?: string[];
  controversialPoints?: string[];
  callToAction?: string;
  researchDate?: string;
}

const LANG_OPTIONS = [
  { label: 'English',               value: 'en' },
  { label: 'Spanish',               value: 'es' },
  { label: 'French',                value: 'fr' },
  { label: 'German',                value: 'de' },
  { label: 'Japanese',              value: 'ja' },
  { label: 'Portuguese',            value: 'pt' },
  { label: 'Italian',               value: 'it' },
  { label: 'Dutch',                 value: 'nl' },
  { label: 'Russian',               value: 'ru' },
  { label: 'Korean',                value: 'ko' },
  { label: 'Chinese (Simplified)',  value: 'zh' },
  { label: 'Chinese (Traditional)', value: 'zh-TW' },
  { label: 'Arabic',                value: 'ar' },
  { label: 'Hindi',                 value: 'hi' },
  { label: 'Bengali',               value: 'bn' },
  { label: 'Tamil',                 value: 'ta' },
  { label: 'Telugu',                value: 'te' },
  { label: 'Kannada',               value: 'kn' },
  { label: 'Malayalam',             value: 'ml' },
  { label: 'Marathi',               value: 'mr' },
  { label: 'Gujarati',              value: 'gu' },
  { label: 'Punjabi',               value: 'pa' },
  { label: 'Urdu',                  value: 'ur' },
  { label: 'Indonesian',            value: 'id' },
  { label: 'Malay',                 value: 'ms' },
  { label: 'Vietnamese',            value: 'vi' },
  { label: 'Thai',                  value: 'th' },
  { label: 'Turkish',               value: 'tr' },
  { label: 'Polish',                value: 'pl' },
  { label: 'Swedish',               value: 'sv' },
  { label: 'Norwegian',             value: 'no' },
  { label: 'Danish',                value: 'da' },
  { label: 'Finnish',               value: 'fi' },
  { label: 'Greek',                 value: 'el' },
  { label: 'Czech',                 value: 'cs' },
  { label: 'Romanian',              value: 'ro' },
  { label: 'Hungarian',             value: 'hu' },
  { label: 'Ukrainian',             value: 'uk' },
  { label: 'Hebrew',                value: 'he' },
  { label: 'Swahili',               value: 'sw' },
  { label: 'Filipino (Tagalog)',    value: 'tl' },
  { label: 'Afrikaans',             value: 'af' },
  { label: 'Catalan',               value: 'ca' },
  { label: 'Croatian',              value: 'hr' },
  { label: 'Slovak',                value: 'sk' },
  { label: 'Bulgarian',             value: 'bg' },
  { label: 'Lithuanian',            value: 'lt' },
  { label: 'Latvian',               value: 'lv' },
  { label: 'Estonian',              value: 'et' },
];

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function ResearchPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');
  const [lang, setLang] = useState('en');
  const [langSearch, setLangSearch] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const LS_KEY = 'cf_research';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { result: ResearchResult; savedAt: string };
        setResult(stored.result);
        setSavedAt(stored.savedAt);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!result) return;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSavedAt(ts);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ result, savedAt: ts })); } catch {}
  }, [result]);

  function clearResult() {
    setResult(null);
    setSavedAt(null);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  async function research() {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    const start = Date.now();
    try {
      const res = await apiClient.post('/content/research', {
        topic: topic.trim(),
        niche: niche.trim() || undefined,
        targetLang: lang !== 'en' ? lang : undefined,
      });
      const data = res.data as ResearchResult;
      setResult(data);
      setDurationMs(Date.now() - start);
      setHistory(prev => {
        const next = [topic.trim(), ...prev.filter(h => h !== topic.trim())].slice(0, 3);
        return next;
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        ?? (e as { message?: string })?.message
        ?? 'Research failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const resultText = result
    ? [
        `# Research: ${result.topic}`,
        '',
        `## Summary\n${result.summary}`,
        result.keyFacts?.length ? `\n## Key Facts\n${result.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : '',
        result.contentAngles?.length ? `\n## Content Angles\n${result.contentAngles.map(a => `### ${a.angle}\n${a.hook}${a.targetAudience ? `\nAudience: ${a.targetAudience}` : ''}`).join('\n\n')}` : '',
        result.statisticsAndData?.length ? `\n## Statistics\n${result.statisticsAndData.map(s => `• ${s}`).join('\n')}` : '',
        result.expertPerspectives?.length ? `\n## Expert Perspectives\n${result.expertPerspectives.map(p => `> ${p}`).join('\n')}` : '',
        result.controversialPoints?.length ? `\n## Controversial Points\n${result.controversialPoints.map(p => `• ${p}`).join('\n')}` : '',
        result.relatedTopics?.length ? `\n## Related Topics\n${result.relatedTopics.join(', ')}` : '',
        result.callToAction ? `\n## Call to Action\n${result.callToAction}` : '',
      ].filter(Boolean).join('\n')
    : '';

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7" style={{ color: '#374151' }} />
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Content Research</h1>
            <p className="text-sm text-gray-400 mt-0.5">AI-powered deep research for YouTube videos — facts, angles, hooks, and more</p>
          </div>
        </div>

        {/* Research form */}
        <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
          {history.length > 0 && (
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mr-2">Recent</span>
              {history.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setTopic(h)}
                  className="mr-2 mb-1 px-3 py-1 bg-[#f5f2fd] text-[#6D4AE0] rounded-full text-sm hover:bg-[#ede8fc] transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. The impact of AI on creative jobs in 2025"
              className="w-full bg-white rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
              style={{ border: '1.5px solid #e3e0f0' }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niche / Category <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={niche}
                onChange={e => setNiche(e.target.value)}
                placeholder="e.g. Technology, AI"
                className="w-full bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <div ref={langRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setLangOpen(o => !o); setLangSearch(''); }}
                  className="w-full bg-white rounded-2xl px-4 py-3 text-sm text-left flex items-center justify-between outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
                  style={{ border: '1.5px solid #e3e0f0' }}
                >
                  <span>{LANG_OPTIONS.find(o => o.value === lang)?.label ?? 'English'}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {langOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white rounded-2xl shadow-xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8', maxHeight: '260px' }}>
                    <div className="p-2 border-b border-gray-100">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search language…"
                        value={langSearch}
                        onChange={e => setLangSearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl outline-none bg-gray-50"
                        style={{ border: '1px solid #e3ddf8' }}
                      />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                      {LANG_OPTIONS.filter(o => o.label.toLowerCase().includes(langSearch.toLowerCase())).map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => { setLang(o.value); setLangOpen(false); setLangSearch(''); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f5f2fd] transition-colors"
                          style={{ color: lang === o.value ? '#6D4AE0' : '#374151', fontWeight: lang === o.value ? 700 : 400 }}
                        >
                          {lang === o.value && <span className="mr-2">✓</span>}{o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={() => { void research(); }}
            disabled={loading || !topic.trim()}
            className="w-full py-3 disabled:opacity-50 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            {loading ? 'Researching…' : 'Research with AI'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <AiWorkingCard
            title="Researching topic…"
            hint="Gathering facts, angles, and expert perspectives (~15–30 seconds)"
          />
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-5">
            {durationMs !== null && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                Completed in {formatDuration(durationMs)}
              </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
              <h2 className="font-semibold text-gray-900 mb-3 text-lg">{result.topic}</h2>
              <p className="text-gray-700 leading-relaxed">{result.summary}</p>
              {result.callToAction && (
                <p className="mt-3 text-sm font-medium" style={{ color: '#374151' }}>📢 {result.callToAction}</p>
              )}
            </div>

            {/* Key Facts */}
            {(result.keyFacts ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="font-semibold text-gray-900 mb-3">Key Facts</h2>
                <ol className="space-y-2">
                  {result.keyFacts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="shrink-0 w-5 h-5 bg-[#f5f2fd] text-[#6D4AE0] rounded-full text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="flex-1 px-3 py-1.5 bg-[#faf9ff] rounded-2xl text-sm text-gray-700" style={{ border: '1.5px solid #e3ddf8' }}>{fact}</span>
                      <CopyChip text={fact} />
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Content Angles */}
            {(result.contentAngles ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="font-semibold text-gray-900 mb-3">Content Angles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.contentAngles.map((a, i) => (
                    <div key={i} className="border-l-4 border-[#6D4AE0] bg-[#f5f2fd]/40 rounded-r-2xl pl-4 pr-3 py-3">
                      <p className="font-semibold text-gray-900 text-sm mb-1">{a.angle}</p>
                      <p className="text-gray-600 text-sm leading-relaxed">{a.hook}</p>
                      {a.targetAudience && (
                        <span className="mt-2 inline-block px-2 py-0.5 bg-[#f5f2fd] text-[#6D4AE0] rounded-full text-xs">{a.targetAudience}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats & Data */}
            {(result.statisticsAndData ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="font-semibold text-gray-900 mb-3">Statistics & Data</h2>
                <ul className="space-y-2">
                  {result.statisticsAndData!.map((s, i) => (
                    <li key={i} className="px-3 py-2 bg-blue-50 border-l-2 border-blue-400 rounded-r-lg text-sm text-gray-700">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expert Perspectives */}
            {(result.expertPerspectives ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="font-semibold text-gray-900 mb-3">Expert Perspectives</h2>
                <ul className="space-y-2">
                  {result.expertPerspectives!.map((p, i) => (
                    <li key={i} className="italic text-gray-600 text-sm border-l-2 border-gray-300 pl-3">"{p}"</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Controversial Points */}
            {(result.controversialPoints ?? []).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h2 className="font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Controversial Points
                </h2>
                <ul className="space-y-1">
                  {result.controversialPoints!.map((p, i) => (
                    <li key={i} className="text-sm text-amber-800">• {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Topics */}
            {(result.relatedTopics ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #e3ddf8' }}>
                <h2 className="font-semibold text-gray-900 mb-3">Related Topics</h2>
                <div className="flex flex-wrap gap-2">
                  {result.relatedTopics.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTopic(t)}
                      className="px-3 py-1 bg-[#f5f2fd] text-[#6D4AE0] rounded-full text-sm hover:bg-[#ede8fc] transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ContentToolbar
              text={resultText}
              filename={`research-${result.topic.slice(0, 30).replace(/\s+/g, '-').toLowerCase()}`}
              savedAt={savedAt}
              onNew={clearResult}
            />

            {/* Quick-action links to use research findings */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => { try { localStorage.setItem('cf_new_project_topic', result.topic); } catch {} router.push('/projects'); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6D4AE0, #7c5ae8)' }}
              >
                <FolderPlus className="w-4 h-4" /> Start project from this topic
              </button>
              <button
                type="button"
                onClick={() => { try { localStorage.setItem('cf_discover_topic', result.topic); } catch {} router.push('/discover'); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ background: '#f3f4f6', color: '#374151', border: '1.5px solid #c4b5fd' }}
              >
                <Compass className="w-4 h-4" /> Explore in Discover
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
