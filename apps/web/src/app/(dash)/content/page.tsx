'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  Compass, BookOpen, Wand2, Loader2, AlertCircle, TrendingUp,
  Search, ArrowRightLeft, ListOrdered, Award, Sparkles, Copy,
  Check, Hash, Zap, Lightbulb, Globe, RefreshCw,
} from 'lucide-react';
import { ResultActionBar } from '@/components/result-actions';

// ── Domain types ──────────────────────────────────────────────────────────────

interface ResearchResult {
  topic: string;
  summary: string;
  keyFacts: string[];
  contentAngles: { angle: string; hook: string; targetAudience?: string }[];
  relatedTopics: string[];
  expertPerspectives?: string[];
  statisticsAndData?: string[];
}

interface SeoResult {
  searchKeywords: string[];
  tags: string[];
  optimizedTitle?: string;
  optimizedDescription?: string;
}

interface AudienceResult {
  primaryDemographic?: string;
  interestClusters?: { cluster: string; size?: string; engagement?: string }[];
  contentPreferences?: string[];
  bestPostingTimes?: string[];
  growthTips?: string[];
}

interface SeriesPlanResult {
  seriesTitle: string;
  overview: string;
  episodes: {
    episodeNumber: number;
    title: string;
    hook: string;
    keyPoints: string[];
    callToAction: string;
    estimatedLength: string;
  }[];
  monetizationStrategy?: string;
  targetAudience?: string;
}

interface RepurposeResult {
  platforms: {
    platform: string;
    content: string;
    hashtags?: string[];
    callToAction?: string;
  }[];
}

interface ScoreResult {
  overallScore: number;
  hookScore: number;
  retentionScore: number;
  clarityScore: number;
  cta: { score: number };
  strengths: string[];
  improvements: string[];
  suggestions: string[];
}

interface ContentContext {
  niche: string;
  topic: string;
  lang: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGS = ['EN', 'ES', 'FR', 'DE', 'HI', 'TA', 'ZH', 'AR', 'PT', 'ID'];
const LS_KEY = 'cf_content_ctx';
const PLATFORMS = ['YouTube Shorts', 'Instagram Reels', 'Twitter/X', 'LinkedIn', 'TikTok', 'Newsletter'];
const EPISODE_COUNTS = [3, 5, 7, 10];

// ── Shared sub-components ─────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-xs text-[#6D4AE0] hover:bg-[#ebe6fb] transition-colors"
    >
      {text}
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const inputCls =
  'w-full border border-[#e3ddf8] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D4AE0]/30 focus:border-[#6D4AE0] bg-white';

const primaryBtnCls =
  'rounded-2xl font-bold text-white bg-gradient-to-br from-[#6D4AE0] to-[#7c5ae8] shadow-[0_4px_20px_rgba(109,74,224,0.35)] px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2';

// ── Collapsible list ──────────────────────────────────────────────────────────

function CollapsibleList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="border border-[#e3ddf8] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#faf9ff] text-sm font-semibold text-gray-700 hover:bg-[#f5f2fd] transition-colors"
      >
        <span className="flex items-center gap-2">{icon}{title} ({items.length})</span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-4 py-3 space-y-1.5 bg-white">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-gray-700 flex gap-2">
              <span className="text-[#6D4AE0] shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Score gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg"
        style={{ borderColor: color, color }}
      >
        {score}
      </div>
      {label && <span className="text-xs text-gray-500">{label}</span>}
    </div>
  );
}

// ── Tab 1: Discover ───────────────────────────────────────────────────────────

function DiscoverTab({ ctx }: { ctx: ContentContext }) {
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState('');
  const [audience, setAudience] = useState<AudienceResult | null>(null);

  const [seoTopic, setSeoTopic] = useState(ctx.topic);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoError, setSeoError] = useState('');
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null);

  useEffect(() => { setSeoTopic(ctx.topic); }, [ctx.topic]);

  const findTrends = useCallback(async () => {
    if (!ctx.niche) return;
    setTrendsLoading(true);
    setTrendsError('');
    try {
      // @reason: apiClient returns AxiosResponse<unknown>; we cast via the interface
      const res = await apiClient.post<AudienceResult>('/audience/analyze', { niche: ctx.niche, recentTopics: [] });
      setAudience(res.data);
    } catch (e) {
      setTrendsError(e instanceof Error ? e.message : 'Failed to fetch trends');
    } finally {
      setTrendsLoading(false);
    }
  }, [ctx.niche]);

  const optimizeSeo = useCallback(async () => {
    if (!ctx.niche && !seoTopic) return;
    setSeoLoading(true);
    setSeoError('');
    try {
      // @reason: apiClient returns AxiosResponse<unknown>; we cast via the interface
      const res = await apiClient.post<SeoResult>('/seo/optimize', {
        title: seoTopic || ctx.niche,
        description: '',
        niche: ctx.niche,
      });
      setSeoResult(res.data);
    } catch (e) {
      setSeoError(e instanceof Error ? e.message : 'Failed to optimize SEO');
    } finally {
      setSeoLoading(false);
    }
  }, [ctx.niche, seoTopic]);

  const noNiche = !ctx.niche;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Trending Topics */}
      <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <TrendingUp className="w-5 h-5 text-[#6D4AE0]" />
          Trending Topics
        </div>

        {noNiche ? (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-400 text-sm text-center">
            <Sparkles className="w-8 h-8 text-[#e3ddf8]" />
            Set your niche above to find trends
          </div>
        ) : (
          <>
            <button type="button" onClick={() => void findTrends()} disabled={trendsLoading} className={primaryBtnCls}>
              {trendsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Find Trends
            </button>

            {trendsError && <ErrorBox message={trendsError} />}

            {audience && (
              <div className="space-y-4">
                {audience.interestClusters && audience.interestClusters.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Interest Clusters</p>
                    <div className="flex flex-wrap gap-2">
                      {audience.interestClusters.map((c, i) => (
                        <span key={i} className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-xs text-[#6D4AE0] font-medium">
                          {c.cluster}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {audience.contentPreferences && audience.contentPreferences.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Content Preferences</p>
                    <div className="flex flex-wrap gap-2">
                      {audience.contentPreferences.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {audience.growthTips && audience.growthTips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Growth Tips</p>
                    <ul className="space-y-1.5">
                      {audience.growthTips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <Zap className="w-3.5 h-3.5 text-[#6D4AE0] shrink-0 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <ResultActionBar
                  filename="trends-audience"
                  onRegenerate={() => void findTrends()}
                  text={[
                    audience.primaryDemographic ? `Demographic: ${audience.primaryDemographic}` : '',
                    audience.interestClusters?.length ? `Interest Clusters: ${audience.interestClusters.map((c) => c.cluster).join(', ')}` : '',
                    audience.contentPreferences?.length ? `Preferences: ${audience.contentPreferences.join(', ')}` : '',
                    audience.growthTips?.length ? `Growth Tips:\n${audience.growthTips.map((t) => `• ${t}`).join('\n')}` : '',
                  ].filter(Boolean).join('\n\n')}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Keywords & SEO */}
      <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <Search className="w-5 h-5 text-[#6D4AE0]" />
          Keywords &amp; SEO
        </div>

        <input
          className={inputCls}
          placeholder="Topic or keyword"
          value={seoTopic}
          onChange={(e) => setSeoTopic(e.target.value)}
        />

        <button type="button" onClick={() => void optimizeSeo()} disabled={seoLoading || (!ctx.niche && !seoTopic)} className={primaryBtnCls}>
          {seoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
          Optimize
        </button>

        {seoError && <ErrorBox message={seoError} />}

        {seoResult && (
          <div className="space-y-4">
            {seoResult.optimizedTitle && (
              <div className="p-3 bg-[#f5f2fd] rounded-xl text-sm font-medium text-[#6D4AE0]">
                {seoResult.optimizedTitle}
              </div>
            )}
            {seoResult.optimizedDescription && (
              <p className="text-xs text-gray-600 italic">{seoResult.optimizedDescription}</p>
            )}
            {(seoResult.searchKeywords?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Search Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {(seoResult.searchKeywords ?? []).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {(seoResult.tags?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags (click to copy)</p>
                <div className="flex flex-wrap gap-2">
                  {(seoResult.tags ?? []).map((tag, i) => <CopyChip key={i} text={tag} />)}
                </div>
              </div>
            )}
            <ResultActionBar
              filename="seo-result"
              onRegenerate={() => void optimizeSeo()}
              text={[
                seoResult.optimizedTitle ?? '',
                seoResult.optimizedDescription ?? '',
                (seoResult.searchKeywords?.length ?? 0) > 0 ? `Keywords: ${(seoResult.searchKeywords ?? []).join(', ')}` : '',
                (seoResult.tags?.length ?? 0) > 0 ? `Tags: ${(seoResult.tags ?? []).join(', ')}` : '',
              ].filter(Boolean).join('\n\n')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Research ───────────────────────────────────────────────────────────

function ResearchTab({ ctx, onPlanSeries }: { ctx: ContentContext; onPlanSeries: (topic: string) => void }) {
  const [topic, setTopic] = useState(ctx.topic);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResearchResult | null>(null);

  useEffect(() => { setTopic(ctx.topic); }, [ctx.topic]);

  const runResearch = useCallback(async () => {
    if (!topic && !ctx.niche) return;
    setLoading(true);
    setError('');
    try {
      // @reason: apiClient returns AxiosResponse<unknown>; we cast via the interface
      const res = await apiClient.post<ResearchResult>('/content/research', {
        topic: topic || ctx.niche,
        niche: ctx.niche,
        targetLang: ctx.lang,
      });
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  }, [topic, ctx.niche, ctx.lang]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <BookOpen className="w-5 h-5 text-[#6D4AE0]" />
          Deep Research
        </div>

        <div className="flex gap-2 flex-wrap">
          {ctx.niche && (
            <span className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-xs text-[#6D4AE0] font-medium">
              Niche: {ctx.niche}
            </span>
          )}
          <span className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 font-medium flex items-center gap-1">
            <Globe className="w-3 h-3" /> {ctx.lang}
          </span>
        </div>

        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="What topic do you want to research deeply?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <button type="button" onClick={() => void runResearch()} disabled={loading || (!topic && !ctx.niche)} className={`${primaryBtnCls} w-full justify-center`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          Research Deeply
        </button>

        {error && <ErrorBox message={error} />}
      </div>

      {result && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <p className="text-sm text-gray-700 italic leading-relaxed">{result.summary}</p>
          </div>

          {/* Key Facts */}
          {(result.keyFacts?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-[#e3ddf8] p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Award className="w-4 h-4 text-[#6D4AE0]" /> Key Facts
              </h3>
              <ol className="space-y-2">
                {(result.keyFacts ?? []).map((fact, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#f5f2fd] text-[#6D4AE0] text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {fact}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Content Angles */}
          {(result.contentAngles?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6D4AE0]" /> Content Angles
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(result.contentAngles ?? []).map((angle, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-[#e3ddf8] p-4 space-y-2 flex flex-col">
                    <p className="text-sm font-semibold text-gray-800">{angle.angle}</p>
                    <p className="text-xs text-gray-600 italic flex-1">{angle.hook}</p>
                    {angle.targetAudience && (
                      <p className="text-xs text-[#6D4AE0]">👥 {angle.targetAudience}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onPlanSeries(angle.angle)}
                      className="mt-auto text-xs font-semibold text-[#6D4AE0] hover:underline text-left"
                    >
                      Plan series →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Topics */}
          {(result.relatedTopics?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Related Topics</h3>
              <div className="flex flex-wrap gap-2">
                {(result.relatedTopics ?? []).map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-xs text-[#6D4AE0]">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Expert Perspectives */}
          {result.expertPerspectives && result.expertPerspectives.length > 0 && (
            <CollapsibleList title="Expert Perspectives" items={result.expertPerspectives} icon={<Lightbulb className="w-3.5 h-3.5 text-[#6D4AE0]" />} />
          )}

          {/* Statistics */}
          {result.statisticsAndData && result.statisticsAndData.length > 0 && (
            <CollapsibleList title="Statistics & Data" items={result.statisticsAndData} icon={<TrendingUp className="w-3.5 h-3.5 text-[#6D4AE0]" />} />
          )}

          <ResultActionBar
            filename="research-result"
            onRegenerate={() => void runResearch()}
            text={[
              result.topic,
              result.summary,
              (result.keyFacts?.length ?? 0) > 0 ? `Key Facts:\n${(result.keyFacts ?? []).map((f, i) => `${i + 1}. ${f}`).join('\n')}` : '',
              (result.contentAngles?.length ?? 0) > 0 ? `Content Angles:\n${(result.contentAngles ?? []).map((a) => `• ${a.angle}: ${a.hook}`).join('\n')}` : '',
              (result.relatedTopics?.length ?? 0) > 0 ? `Related Topics: ${(result.relatedTopics ?? []).join(', ')}` : '',
            ].filter(Boolean).join('\n\n')}
          />
        </div>
      )}
    </div>
  );
}

// ── Tab 3 — Series Plan ───────────────────────────────────────────────────────

function SeriesPlanMode({ ctx }: { ctx: ContentContext }) {
  const [episodes, setEpisodes] = useState(5);
  const [audience, setAudience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SeriesPlanResult | null>(null);

  const topic = ctx.topic || ctx.niche;

  const plan = useCallback(async () => {
    if (!topic) return;
    setLoading(true);
    setError('');
    try {
      // @reason: apiClient returns AxiosResponse<unknown>; we cast via the interface
      const res = await apiClient.post<SeriesPlanResult>('/content/series-plan', {
        topic,
        niche: ctx.niche,
        episodes,
        audience,
      });
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Series planning failed');
    } finally {
      setLoading(false);
    }
  }, [topic, ctx.niche, episodes, audience]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6 space-y-4">
        {/* Context chip — shows what's applied from the global bar */}
        {(ctx.niche || ctx.topic) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {ctx.niche && <span className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-[#6D4AE0] font-medium">📌 {ctx.niche}</span>}
            {ctx.topic && <span className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-[#6D4AE0] font-medium">🎯 {ctx.topic}</span>}
          </div>
        )}
        {!ctx.niche && !ctx.topic && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">Set your niche + topic in the bar above and click Apply first.</p>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Episodes</label>
          <div className="flex gap-2 flex-wrap">
            {EPISODE_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEpisodes(n)}
                className={episodes === n
                  ? 'bg-[#6D4AE0] text-white rounded-full px-4 py-1.5 text-sm font-medium'
                  : 'bg-white border border-[#e3ddf8] text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50'}
              >
                {n} eps
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Target Audience (optional)</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="Describe your target audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
        </div>

        <button type="button" onClick={() => void plan()} disabled={loading || !topic} className={`${primaryBtnCls} w-full justify-center`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListOrdered className="w-4 h-4" />}
          Plan Series
        </button>

        {error && <ErrorBox message={error} />}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">{result.seriesTitle}</h2>
            <p className="text-sm text-gray-600">{result.overview}</p>
            {result.targetAudience && (
              <p className="text-xs text-[#6D4AE0] mt-2">👥 {result.targetAudience}</p>
            )}
            {result.monetizationStrategy && (
              <p className="text-xs text-gray-500 mt-2 italic">💰 {result.monetizationStrategy}</p>
            )}
          </div>

          <div className="space-y-3">
            {(result.episodes ?? []).map((ep) => (
              <div key={ep.episodeNumber} className="bg-white rounded-2xl border border-[#e3ddf8] p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#6D4AE0] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {ep.episodeNumber}
                  </span>
                  <h3 className="font-semibold text-gray-800 text-sm">{ep.title}</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{ep.estimatedLength}</span>
                </div>
                <p className="text-xs text-gray-600 italic pl-9">{ep.hook}</p>
                {ep.keyPoints.length > 0 && (
                  <ul className="pl-9 space-y-0.5">
                    {ep.keyPoints.map((pt, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-[#6D4AE0]">•</span>{pt}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs font-medium text-[#6D4AE0] pl-9">CTA: {ep.callToAction}</p>
              </div>
            ))}
          </div>

          <ResultActionBar
            filename="series-plan"
            onRegenerate={() => void plan()}
            text={[
              result.seriesTitle,
              result.overview,
              result.targetAudience ? `Audience: ${result.targetAudience}` : '',
              result.monetizationStrategy ? `Monetization: ${result.monetizationStrategy}` : '',
              `Episodes:\n${(result.episodes ?? []).map((ep) => `${ep.episodeNumber}. ${ep.title}\n   Hook: ${ep.hook}\n   CTA: ${ep.callToAction}`).join('\n')}`,
            ].filter(Boolean).join('\n\n')}
          />
        </div>
      )}
    </div>
  );
}

// ── Tab 3 — Repurpose ─────────────────────────────────────────────────────────

function RepurposeMode() {
  const [title, setTitle] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['YouTube Shorts', 'Instagram Reels']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RepurposeResult | null>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const repurpose = useCallback(async () => {
    if (!scriptText) return;
    setLoading(true);
    setError('');
    try {
      // @reason: apiClient returns AxiosResponse<unknown>; we cast via the interface
      const res = await apiClient.post<RepurposeResult>('/content/repurpose', {
        scriptText,
        title,
        platforms: selectedPlatforms,
      });
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Repurpose failed');
    } finally {
      setLoading(false);
    }
  }, [scriptText, title, selectedPlatforms]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6 space-y-4">
        <input className={inputCls} placeholder="Video title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className={`${inputCls} resize-none`}
          rows={8}
          placeholder="Paste your script here..."
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
        />

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={selectedPlatforms.includes(p)
                  ? 'bg-[#6D4AE0] text-white rounded-full px-3 py-1 text-xs font-medium'
                  : 'bg-white border border-[#e3ddf8] text-gray-600 rounded-full px-3 py-1 text-xs hover:bg-gray-50'}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void repurpose()}
          disabled={loading || !scriptText || selectedPlatforms.length === 0}
          className={`${primaryBtnCls} w-full justify-center`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
          Repurpose Content
        </button>

        {error && <ErrorBox message={error} />}
      </div>

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(result.platforms ?? []).map((p, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e3ddf8] p-5 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">{p.platform}</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{p.content}</p>
              {p.hashtags && p.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.hashtags.map((h, j) => <CopyChip key={j} text={h} />)}
                </div>
              )}
              {p.callToAction && (
                <p className="text-xs font-medium text-[#6D4AE0] italic">{p.callToAction}</p>
              )}
              <ResultActionBar
                filename={`repurpose-${p.platform.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onRegenerate={() => void repurpose()}
                text={[
                  p.platform,
                  p.content,
                  p.hashtags?.length ? p.hashtags.join(' ') : '',
                  p.callToAction ? `CTA: ${p.callToAction}` : '',
                ].filter(Boolean).join('\n\n')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 3 — Script Scorer ─────────────────────────────────────────────────────

function ScriptScorerMode({ ctx }: { ctx: ContentContext }) {
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScoreResult | null>(null);

  const score = useCallback(async () => {
    if (!scriptText) return;
    setLoading(true);
    setError('');
    try {
      // @reason: apiClient returns AxiosResponse<unknown>; we cast via the interface
      const res = await apiClient.post<ScoreResult>('/content/score-script', {
        title: ctx.topic,
        scriptText,
        niche: ctx.niche,
      });
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scoring failed');
    } finally {
      setLoading(false);
    }
  }, [ctx.topic, ctx.niche, scriptText]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6 space-y-4">
        {(ctx.niche || ctx.topic) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {ctx.niche && <span className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-[#6D4AE0] font-medium">📌 {ctx.niche}</span>}
            {ctx.topic && <span className="px-3 py-1 bg-[#f5f2fd] border border-[#e3ddf8] rounded-full text-[#6D4AE0] font-medium">🎯 {ctx.topic}</span>}
          </div>
        )}

        <textarea
          className={`${inputCls} resize-none`}
          rows={8}
          placeholder="Paste your script here..."
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
        />

        <button type="button" onClick={() => void score()} disabled={loading || !scriptText} className={`${primaryBtnCls} w-full justify-center`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
          Score My Script
        </button>

        {error && <ErrorBox message={error} />}
      </div>

      {result && (
        <div className="space-y-5">
          {/* Score gauges */}
          <div className="bg-white rounded-2xl border border-[#e3ddf8] p-6">
            <div className="flex flex-wrap gap-6 justify-center">
              <ScoreGauge score={result.overallScore} label="Overall" />
              <ScoreGauge score={result.hookScore} label="Hook" />
              <ScoreGauge score={result.retentionScore} label="Retention" />
              <ScoreGauge score={result.clarityScore} label="Clarity" />
              <ScoreGauge score={result.cta.score} label="CTA" />
            </div>
          </div>

          {/* Strengths */}
          {(result.strengths?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-[#e3ddf8] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Strengths
              </h3>
              <ul className="space-y-1.5">
                {(result.strengths ?? []).map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-500">✓</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {(result.improvements?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-[#e3ddf8] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-orange-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Improvements
              </h3>
              <ul className="space-y-1.5">
                {(result.improvements ?? []).map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-orange-500">→</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {(result.suggestions?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-[#e3ddf8] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Suggestions
              </h3>
              <ul className="space-y-1.5">
                {(result.suggestions ?? []).map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-blue-500">•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <ResultActionBar
            filename="script-score"
            onRegenerate={() => void score()}
            text={[
              `Overall: ${result.overallScore}/100 | Hook: ${result.hookScore} | Retention: ${result.retentionScore} | Clarity: ${result.clarityScore} | CTA: ${result.cta.score}`,
              (result.strengths?.length ?? 0) > 0 ? `Strengths:\n${(result.strengths ?? []).map((s) => `✓ ${s}`).join('\n')}` : '',
              (result.improvements?.length ?? 0) > 0 ? `Improvements:\n${(result.improvements ?? []).map((s) => `→ ${s}`).join('\n')}` : '',
              (result.suggestions?.length ?? 0) > 0 ? `Suggestions:\n${(result.suggestions ?? []).map((s) => `• ${s}`).join('\n')}` : '',
            ].filter(Boolean).join('\n\n')}
          />
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Create ─────────────────────────────────────────────────────────────

type CreateMode = 'series' | 'repurpose' | 'score';

function CreateTab({ ctx }: { ctx: ContentContext }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams?.get('mode') as CreateMode | null) ?? 'series';

  const setMode = (m: CreateMode) => {
    router.replace(`/content?tab=create&mode=${m}`);
  };

  const pills: { id: CreateMode; label: string; icon: React.ReactNode }[] = [
    { id: 'series', label: 'Series Plan', icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { id: 'repurpose', label: 'Repurpose', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
    { id: 'score', label: 'Script Scorer', icon: <Award className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {pills.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setMode(p.id)}
            className={mode === p.id
              ? 'bg-[#6D4AE0] text-white rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-1.5'
              : 'bg-white border border-[#e3ddf8] text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-1.5'}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      {mode === 'series' && <SeriesPlanMode ctx={ctx} />}
      {mode === 'repurpose' && <RepurposeMode />}
      {mode === 'score' && <ScriptScorerMode ctx={ctx} />}
    </div>
  );
}

// ── Main inner component ──────────────────────────────────────────────────────

function ContentStudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') ?? 'discover';

  // Shared context state
  const [niche, setNiche] = useState('');
  const [topic, setTopic] = useState('');
  const [lang, setLang] = useState('EN');
  const [ctxApplied, setCtxApplied] = useState<ContentContext>({ niche: '', topic: '', lang: 'EN' });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ContentContext>;
        const n = parsed.niche ?? '';
        const t = parsed.topic ?? '';
        const l = parsed.lang ?? 'EN';
        setNiche(n);
        setTopic(t);
        setLang(l);
        setCtxApplied({ niche: n, topic: t, lang: l });
      }
    } catch {
      // ignore corrupt localStorage
    }
  }, []);

  const applyContext = () => {
    const ctx: ContentContext = { niche, topic, lang };
    localStorage.setItem(LS_KEY, JSON.stringify(ctx));
    setCtxApplied(ctx);
  };

  const setTab = (tab: string) => {
    router.replace(`/content?tab=${tab}`);
  };

  // Called from Research tab when user clicks "Plan series →"
  const handlePlanSeries = (seriesTopic: string) => {
    const ctx: ContentContext = { niche, topic: seriesTopic, lang };
    localStorage.setItem(LS_KEY, JSON.stringify(ctx));
    setTopic(seriesTopic);
    setCtxApplied(ctx);
    router.replace('/content?tab=create&mode=series');
  };

  const tabs = [
    { id: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4" /> },
    { id: 'research', label: 'Research', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'create', label: 'Create', icon: <Wand2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#faf9ff]">
      {/* Sticky context bar */}
      <div className="sticky top-0 z-20 bg-[#faf9ff] border-b border-[#e3ddf8] pb-4 pt-2 mb-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#6D4AE0]" />
            <h1 className="text-base font-bold text-gray-900">Content Studio</h1>
            <span className="text-xs text-gray-400 hidden sm:inline">Your unified AI content workspace</span>
          </div>

          {/* Row 1: niche + topic side-by-side on mobile, all inline on desktop */}
          <div className="grid grid-cols-2 sm:flex gap-2">
            <input
              className={`${inputCls} col-span-1`}
              placeholder="Niche, e.g. Tech tutorials"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
            <input
              className={`${inputCls} col-span-1`}
              placeholder="Topic (optional)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <select
              className="col-span-1 border border-[#e3ddf8] rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D4AE0]/30 focus:border-[#6D4AE0] sm:w-24"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button
              type="button"
              onClick={applyContext}
              className="col-span-1 rounded-2xl font-bold text-white bg-gradient-to-br from-[#6D4AE0] to-[#7c5ae8] shadow-[0_4px_20px_rgba(109,74,224,0.35)] px-5 py-3 text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Apply
            </button>
          </div>

          {/* Tabs — horizontally scrollable on mobile, no wrap */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 shrink-0 text-sm font-semibold transition-all"
                style={
                  activeTab === t.id
                    ? { background: '#f5f2fd', border: '2px solid #6D4AE0', color: '#6D4AE0', borderRadius: '0.75rem', padding: '0.5rem 1rem' }
                    : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151', borderRadius: '0.75rem', padding: '0.5rem 1rem' }
                }
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {activeTab === 'discover' && <DiscoverTab ctx={ctxApplied} />}
        {activeTab === 'research' && <ResearchTab ctx={ctxApplied} onPlanSeries={handlePlanSeries} />}
        {activeTab === 'create' && <CreateTab ctx={ctxApplied} />}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentStudioInner />
    </Suspense>
  );
}
