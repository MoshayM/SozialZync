'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Sparkles, ListTree, Trophy, Scissors, CheckCircle2, Clapperboard, Pencil, Upload, ShieldCheck, ExternalLink, XCircle, ChevronDown, ChevronRight, BookOpen, Check, Search, Share2, Copy, Image as ImageIcon, Play, FolderDown, X, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { JobErrorCard } from '@/components/job-error-card';
import { usePlanGate, useIsAdmin, planAtLeast, triggerUpgradeSheet } from '@/components/plan-gate';

interface Topic {
  id: string;
  startMs: number;
  endMs: number;
  category: string;
  title: string;
  summary: string;
  confidence: number;
  highlight: { id: string; finalScore: number } | null;
}

interface Chapter {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
  summary: string;
  keyPoints: string[];
  confidence: number;
  editedByUser: boolean;
  bibleRefs: string[];
  discussionQuestions: string[];
  devotional: string | null;
}

interface SocialPiece {
  id: string;
  kind: 'QUOTE_CARD' | 'CAROUSEL' | 'BLOG_POST' | 'NEWSLETTER';
  title: string;
  content: {
    quote?: string;
    attribution?: string | null;
    startMs?: number;
    slides?: Array<{ heading: string; body: string }>;
    subject?: string;
    markdown?: string;
  };
}

interface SearchResponse {
  query: string;
  results: Array<{ segmentId: string; startMs: number; endMs: number; text: string; score: number; chapter: string | null }>;
  embeddedSegments: number;
  totalSegments: number;
  needsEmbeddings: boolean;
}

interface Clip {
  id: string;
  clipType: string;
  status: string;
  sourceStartMs: number;
  sourceEndMs: number;
  topicSegment: { title: string; highlight: { titleSuggestion: string; finalScore: number } | null } | null;
  chapter: { title: string } | null;
  timeline: { id: string; durationMs: number; _count: { captions: number } } | null;
  renderAsset: { id: string; versions: Array<{ id: string; durationMs: number | null }> } | null;
}

interface Channel {
  id: string;
  title: string;
  platform: string;
  thumbnailUrl?: string | null;
  connected?: boolean;
}

interface Highlight {
  id: string;
  finalScore: number;
  reason: string;
  titleSuggestion: string;
  keywords: string[];
  virality: number;
  emotion: number;
  retention: number;
  hookStrength: number;
  education: number;
  entertainment: number;
  confidence: number;
  trendPotential: number;
  shortSuitability: number;
  topicSegment: { id: string; startMs: number; endMs: number; category: string; title: string };
}

const DIMENSIONS: Array<{ key: keyof Highlight; label: string }> = [
  { key: 'virality', label: 'Virality' },
  { key: 'emotion', label: 'Emotion' },
  { key: 'retention', label: 'Retention' },
  { key: 'hookStrength', label: 'Hook' },
  { key: 'education', label: 'Education' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'trendPotential', label: 'Trend' },
  { key: 'shortSuitability', label: 'Short fit' },
];

const CLIP_TYPES = [
  { value: 'YOUTUBE_SHORTS',    label: 'YouTube Shorts' },
  { value: 'TIKTOK',           label: 'TikTok' },
  { value: 'INSTAGRAM_REELS',  label: 'Instagram Reels' },
  { value: 'FACEBOOK_REELS',   label: 'Facebook Reels' },
  { value: 'LINKEDIN_CLIPS',   label: 'LinkedIn' },
  { value: 'PODCAST_HIGHLIGHTS', label: 'Podcast Highlight' },
];

const CATEGORY_COLORS: Record<string, string> = {
  HOOK: 'bg-pink-100 text-pink-700',
  STORY: 'bg-amber-100 text-amber-700',
  TIP: 'bg-green-100 text-green-700',
  TUTORIAL_STEP: 'bg-blue-100 text-blue-700',
  FUNNY_MOMENT: 'bg-purple-100 text-purple-700',
  STATISTIC: 'bg-cyan-100 text-cyan-700',
  CALL_TO_ACTION: 'bg-red-100 text-red-700',
};

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function scoreColor(v: number): string {
  if (v >= 70) return 'text-green-600';
  if (v >= 40) return 'text-amber-600';
  return 'text-gray-500';
}

type FlowPhase =
  | { step: 'idle' }
  | { step: 'working'; label: string }
  | { step: 'awaiting-approval' }
  | { step: 'published'; url: string }
  | { step: 'error'; message: string };

/**
 * One-click publish: clip → captions → render → export → approval request,
 * then auto-publishes the moment the review is approved on /approvals.
 * Every backend stage self-skips when already satisfied, so re-clicking
 * resumes an interrupted flow instead of redoing work.
 */
function usePublishFlow(highlightId: string, types: string[], qc: ReturnType<typeof useQueryClient>) {
  const [phase, setPhase] = useState<FlowPhase>({ step: 'idle' });
  const cancelled = useRef(false);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const waitJob = useCallback(async (jobId: string, label: string) => {
    setPhase({ step: 'working', label });
    for (;;) {
      if (cancelled.current) throw new Error('cancelled');
      const job = (await api.jobs.get(jobId)).data as { status: string; error?: string; errorCode?: string | null; retryable?: boolean };
      if (job.status === 'COMPLETED') return;
      if (job.status === 'FAILED') throw new Error(job.error ?? `${label} failed`);
      await sleep(4000);
    }
  }, []);

  const run = useCallback(async () => {
    cancelled.current = false;
    // Use the first selected type for the publish pipeline; default to YOUTUBE_SHORTS if none selected.
    const primaryType = types[0] ?? 'YOUTUBE_SHORTS';
    try {
      setPhase({ step: 'working', label: 'Creating clip…' });
      const clips = (await api.shortsStudio.generateClips(highlightId, types.length > 0 ? types : ['YOUTUBE_SHORTS'])).data as Array<{ id: string }>;
      // Prefer the clip that matches the primary platform type
      const clipId = (clips[0])!.id;
      void qc.invalidateQueries({ queryKey: ['shorts-clips'] });

      const captionJob = (await api.shortsStudio.generateCaptions(clipId)).data as { id: string };
      await waitJob(captionJob.id, 'Generating captions…');

      const renderJob = (await api.shortsStudio.render(clipId)).data as { id: string };
      await waitJob(renderJob.id, `Rendering ${primaryType.replace(/_/g, ' ').toLowerCase()}…`);

      const exportJob = (await api.shortsStudio.exportClip(clipId)).data as { id: string };
      await waitJob(exportJob.id, 'Building export package…');

      await api.shortsStudio.requestPublish(clipId);
      setPhase({ step: 'awaiting-approval' });

      // Poll the approval; auto-publish once the human review lands
      for (;;) {
        if (cancelled.current) throw new Error('cancelled');
        const s = (await api.shortsStudio.publishStatus(clipId)).data as {
          approval: { status: string } | null;
          publishJob: { status: string; result?: { url?: string } } | null;
        };
        if (s.publishJob?.status === 'COMPLETED' && s.publishJob.result?.url) {
          setPhase({ step: 'published', url: s.publishJob.result.url });
          void qc.invalidateQueries({ queryKey: ['shorts-clips'] });
          return;
        }
        if (s.approval?.status === 'REJECTED') throw new Error('Review was rejected on the Approvals page');
        if (s.approval?.status === 'APPROVED' && (!s.publishJob || s.publishJob.status === 'FAILED')) {
          const pub = (await api.shortsStudio.publish(clipId)).data as { id: string };
          await waitJob(pub.id, 'Publishing…');
          const done = (await api.shortsStudio.publishStatus(clipId)).data as { publishJob: { result?: { url?: string } } | null };
          setPhase({ step: 'published', url: done.publishJob?.result?.url ?? '' });
          void qc.invalidateQueries({ queryKey: ['shorts-clips'] });
          return;
        }
        setPhase({ step: 'awaiting-approval' });
        await sleep(8000);
      }
    } catch (err) {
      if ((err as Error).message !== 'cancelled') {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setPhase({ step: 'error', message: e.response?.data?.message ?? e.message ?? 'Publish flow failed' });
      }
    }
  }, [highlightId, types, qc, waitJob]);

  return { phase, run };
}

/** Lightweight video preview modal for a rendered clip. */
function VideoPreviewModal({ clipId, title, onClose }: { clipId: string; title: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['clip-preview-url', clipId],
    queryFn: () => api.shortsStudio.previewUrl(clipId).then((r) => r.data),
    staleTime: 50 * 60 * 1000, // 50 min — URL TTL is 60 min
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? '';

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-900 text-sm truncate flex-1">{title}</p>
          <button type="button" onClick={onClose} className="ml-2 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="aspect-[9/16] bg-black flex items-center justify-center" style={{ maxHeight: '70vh' }}>
          {isLoading && <Loader2 className="w-8 h-8 text-white animate-spin" />}
          {isError && (
            <div className="text-center text-white px-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm">Clip not rendered yet. Run the Publish flow to render it first.</p>
            </div>
          )}
          {data?.url && (
            <video
              src={`${apiBase}${data.url}`}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              style={{ maxHeight: '70vh' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Clips list with Preview, Re-edit, Save to Private, Export actions. */
function ClipsList({ clips, qc }: { clips: Clip[]; qc: ReturnType<typeof useQueryClient> }) {
  const [openClips, setOpenClips] = useState<Set<string>>(new Set());
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);

  const saveToPrivate = useMutation({
    mutationFn: (clipId: string) => api.shortsStudio.saveToPrivate(clipId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-content'] }),
  });

  const previewClip = previewClipId ? clips.find((c) => c.id === previewClipId) : null;

  return (
    <>
      {previewClipId && previewClip && (
        <VideoPreviewModal
          clipId={previewClipId}
          title={previewClip.topicSegment?.highlight?.titleSuggestion ?? previewClip.topicSegment?.title ?? previewClip.chapter?.title ?? 'Clip'}
          onClose={() => setPreviewClipId(null)}
        />
      )}
      {clips.length > 0 && (
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setOpenClips((prev) => prev.size === clips.length ? new Set() : new Set(clips.map((c) => c.id)))}
            className="text-xs text-brand-600 hover:underline"
          >
            {openClips.size === clips.length ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}
      <div className="space-y-2">
        {clips.map((c) => {
          const open = openClips.has(c.id);
          const toggle = () => setOpenClips((prev) => {
            const next = new Set(prev);
            if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
            return next;
          });
          const published = c.status === 'PUBLISHED';
          const isRendered = !!c.renderAsset?.versions[0];
          const statusColors: Record<string, string> = {
            PUBLISHED: 'bg-green-100 text-green-700',
            RENDERED: 'bg-blue-100 text-blue-700',
            RENDERING: 'bg-amber-100 text-amber-700',
            CANDIDATE: 'bg-gray-100 text-gray-600',
          };
          const statusColor = statusColors[c.status] ?? 'bg-gray-100 text-gray-600';
          return (
            <div key={c.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div
                onClick={toggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {open ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">
                  {c.topicSegment?.highlight?.titleSuggestion ?? c.topicSegment?.title ?? c.chapter?.title ?? 'Clip'}
                </p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusColor}`}>
                  {c.status.replace(/_/g, ' ').toLowerCase()}
                </span>
                <span className="text-[11px] text-gray-500 shrink-0">{c.timeline ? fmt(c.timeline.durationMs) : '—'}</span>
              </div>
              {open && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-50">
                  <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                    <p><span className="text-gray-500">Platform:</span> <span className="font-medium text-gray-700">{CLIP_TYPES.find((t) => t.value === c.clipType)?.label ?? c.clipType.replace(/_/g, ' ')}</span></p>
                    <p><span className="text-gray-500">Source range:</span> {fmt(c.sourceStartMs)}–{fmt(c.sourceEndMs)}</p>
                    <p><span className="text-gray-500">Captions:</span> {c.timeline?._count.captions ? `${c.timeline._count.captions} lines` : 'none yet'}</p>
                    {c.topicSegment?.highlight && (
                      <p><span className="text-gray-500">Highlight score:</span> {Math.round(c.topicSegment.highlight.finalScore)}</p>
                    )}
                    {c.chapter && <p><span className="text-gray-500">From chapter:</span> {c.chapter.title}</p>}
                    {isRendered && <p className="text-green-600 font-medium">✓ Rendered — ready to preview</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {isRendered && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreviewClipId(c.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700"
                      >
                        <Play className="w-3.5 h-3.5" /> Preview
                      </button>
                    )}
                    <Link
                      href={`/shorts-studio/clips/${c.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-200 text-brand-700 rounded-lg text-xs hover:bg-brand-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Re-edit
                    </Link>
                    {isRendered && (
                      <button
                        type="button"
                        disabled={saveToPrivate.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (saveToPrivate.variables === c.id && saveToPrivate.isSuccess) return;
                          saveToPrivate.mutate(c.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                        title="Save rendered short to My Content → Private"
                      >
                        {saveToPrivate.isPending && saveToPrivate.variables === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : saveToPrivate.isSuccess && saveToPrivate.variables === c.id
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          : <FolderDown className="w-3.5 h-3.5" />}
                        {saveToPrivate.isSuccess && saveToPrivate.variables === c.id ? 'Saved!' : 'Save to Private'}
                      </button>
                    )}
                    <Link
                      href={`/shorts-studio/clips/${c.id}/export`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                    >
                      <Clapperboard className="w-3.5 h-3.5" /> Export
                    </Link>
                  </div>
                  {saveToPrivate.isError && saveToPrivate.variables === c.id && (
                    <p className="text-xs text-red-600 mt-2">
                      {(saveToPrivate.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to save to private'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Tiny status chip shown in the collapsed row while a publish flow runs. */
function PhaseChip({ phase }: { phase: FlowPhase }) {
  if (phase.step === 'working') {
    return <span className="flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-[11px] shrink-0"><Loader2 className="w-3 h-3 animate-spin" /> {phase.label}</span>;
  }
  if (phase.step === 'awaiting-approval') {
    return <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] shrink-0"><ShieldCheck className="w-3 h-3" /> awaiting review</span>;
  }
  if (phase.step === 'published') {
    return <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] shrink-0"><CheckCircle2 className="w-3 h-3" /> published</span>;
  }
  if (phase.step === 'error') {
    return <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[11px] shrink-0"><XCircle className="w-3 h-3" /> failed</span>;
  }
  return null;
}

function HighlightCard({ h, open, onToggle }: { h: Highlight; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient();
  const [types, setTypes] = useState<string[]>(['YOUTUBE_SHORTS']);
  const [generated, setGenerated] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const { phase, run } = usePublishFlow(h.id, types, qc);
  const userPlan = usePlanGate();
  const isAdmin = useIsAdmin();
  const canPublish = isAdmin || planAtLeast(userPlan, 'PRO');

  const { data: channelsRaw } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Channel[]),
    staleTime: 5 * 60 * 1000,
  });
  const channels = Array.isArray(channelsRaw) ? channelsRaw : [];

  const generate = useMutation({
    mutationFn: () => api.shortsStudio.generateClips(h.id, types),
    onSuccess: () => {
      setGenerated(true);
      void qc.invalidateQueries({ queryKey: ['shorts-clips'] });
    },
  });

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {/* Collapsed header — always visible, click to enlarge */}
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
        <span className="text-lg font-bold text-brand-700 shrink-0 w-8 text-center">{Math.round(h.finalScore)}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${CATEGORY_COLORS[h.topicSegment.category] ?? 'bg-gray-100 text-gray-600'}`}>
          {h.topicSegment.category.replace(/_/g, ' ')}
        </span>
        <p className="font-semibold text-gray-900 text-sm truncate flex-1 min-w-0">{h.titleSuggestion}</p>
        <PhaseChip phase={phase} />
        <span className="text-xs text-gray-500 shrink-0">{fmt(h.topicSegment.startMs)}–{fmt(h.topicSegment.endMs)}</span>
      </div>

      {!open ? null : (
      <div className="px-5 pb-5 border-t border-gray-50 pt-3">
      <p className="text-sm text-gray-500">{h.reason}</p>
      {h.keywords.length > 0 && (
        <p className="text-[11px] text-gray-500 mt-1.5 truncate">{h.keywords.map((k) => `#${k.replace(/\s+/g, '')}`).join(' ')}</p>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 mt-4">
        {DIMENSIONS.map(({ key, label }) => (
          <div key={key} className="text-center">
            <p className={`text-sm font-bold ${scoreColor(h[key] as number)}`}>{Math.round(h[key] as number)}</p>
            <p className="text-[10px] text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50 flex-wrap">
        {CLIP_TYPES.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={types.includes(value)}
              onChange={(e) => setTypes((t) => (e.target.checked ? [...t, value] : t.filter((x) => x !== value)))}
              className="rounded border-gray-300"
            />
            {label}
          </label>
        ))}
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending || types.length === 0 || generated}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-brand-200 text-brand-700 rounded-lg text-xs hover:bg-brand-50 disabled:opacity-50"
        >
          {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : generated ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <Scissors className="w-3.5 h-3.5" />}
          {generated ? 'Clips created' : 'Generate clips'}
        </button>
        {canPublish ? (
          <button
            onClick={() => setConfirmPublish(true)}
            disabled={phase.step === 'working' || phase.step === 'awaiting-approval' || phase.step === 'published' || types.length === 0}
            title="Select platform(s) above, then confirm which account to publish to"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700 disabled:opacity-50"
          >
            {phase.step === 'working' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Publish
          </button>
        ) : (
          <button
            onClick={() => triggerUpgradeSheet({ feature: 'Publish to Platforms', plan: 'PRO' })}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg text-xs hover:bg-gray-50"
            title="Pro plan required to publish to external platforms"
          >
            <Upload className="w-3.5 h-3.5" /> Publish
          </button>
        )}

        {/* Publish confirmation: show connected channel & confirm */}
        {confirmPublish && (
          <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmPublish(false); }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Confirm publish</h3>
                <button type="button" onClick={() => setConfirmPublish(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-600" /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Platforms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-[11px] font-medium">
                        {CLIP_TYPES.find((c) => c.value === t)?.label ?? t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Publish to</p>
                  {channels.length > 0 ? (
                    <div className="space-y-1.5">
                      {channels.slice(0, 3).map((ch) => (
                        <div key={ch.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
                          {ch.thumbnailUrl && <img src={ch.thumbnailUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{ch.title}</p>
                            <p className="text-[10px] text-gray-500">{ch.platform}</p>
                          </div>
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No channels connected — <Link href="/settings/channels" className="text-brand-600 underline">connect one first</Link></p>
                  )}
                </div>
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2 flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Video will go through render → compliance check → your approval before it's published.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
                <button type="button" onClick={() => setConfirmPublish(false)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button
                  type="button"
                  onClick={() => { setConfirmPublish(false); void run(); }}
                  disabled={channels.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" /> Start publish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {phase.step === 'working' && (
        <p className="text-xs text-brand-700 mt-2 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {phase.label}
        </p>
      )}
      {phase.step === 'awaiting-approval' && (
        <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Ready — waiting for your review on the{' '}
          <Link href="/approvals" className="underline font-medium">Approvals page</Link>. Publishes automatically once approved.
        </p>
      )}
      {phase.step === 'published' && (
        <p className="text-xs text-green-700 mt-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Published!
          {phase.url && (
            <a href={phase.url} target="_blank" rel="noreferrer" className="underline font-medium flex items-center gap-0.5">
              Watch on YouTube <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      )}
      {phase.step === 'error' && (
        <JobErrorCard
          error={`${phase.message} — click Publish to resume (finished steps are skipped).`}
          errorCode="JOB_FAILED"
          onRetry={() => void run()}
          className="mt-2"
        />
      )}
      {generate.isError && (
        <JobErrorCard
          error={(generate.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to generate clips'}
          errorCode="JOB_FAILED"
          onRetry={() => generate.mutate()}
          className="mt-2"
        />
      )}
      </div>
      )}
    </div>
  );
}

export default function ShortsVideoDetailPage() {
  const { importedVideoId } = useParams<{ importedVideoId: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'highlights' | 'topics' | 'chapters' | 'search' | 'social'>('highlights');
  const [searchQuery, setSearchQuery] = useState('');
  const [openHighlights, setOpenHighlights] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterTitleDraft, setChapterTitleDraft] = useState('');
  const [clipsOpen, setClipsOpen] = useState(true);

  const { data: topics = [], isLoading: loadingTopics } = useQuery<Topic[]>({
    queryKey: ['shorts-topics', importedVideoId],
    queryFn: () => api.shortsStudio.topics(importedVideoId).then((r) => r.data as Topic[]),
  });
  const { data: chapters = [] } = useQuery<Chapter[]>({
    queryKey: ['shorts-chapters', importedVideoId],
    queryFn: () => api.shortsStudio.chapters(importedVideoId).then((r) => r.data as Chapter[]),
  });
  const detectChapters = useMutation({
    mutationFn: () => api.shortsStudio.detectChapters(importedVideoId),
  });
  const { data: socialPieces = [] } = useQuery<SocialPiece[]>({
    queryKey: ['shorts-social', importedVideoId],
    queryFn: () => api.shortsStudio.socialContent(importedVideoId).then((r) => r.data as SocialPiece[]),
  });
  const generateSocial = useMutation({
    mutationFn: () => api.shortsStudio.generateSocialContent(importedVideoId),
  });
  const syncChapters = useMutation({
    mutationFn: () => api.shortsStudio.syncChapters(importedVideoId).then((r) => r.data as { chapters: number }),
  });
  const generateSmallVideos = useMutation({
    mutationFn: () => api.shortsStudio.generateSmallVideos(importedVideoId).then((r) => r.data as { created: number; reused: number; skippedTooShort: number }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shorts-clips', importedVideoId] }),
  });
  const searchVideo = useMutation({
    mutationFn: (q: string) => api.shortsStudio.searchVideo(importedVideoId, q).then((r) => r.data as SearchResponse),
  });
  const generateEmbeddings = useMutation({
    mutationFn: () => api.shortsStudio.generateEmbeddings(importedVideoId),
  });
  const renameChapter = useMutation({
    mutationFn: ({ chapterId, title }: { chapterId: string; title: string }) =>
      api.shortsStudio.updateChapter(chapterId, { title }),
    onSuccess: () => {
      setEditingChapterId(null);
      void qc.invalidateQueries({ queryKey: ['shorts-chapters', importedVideoId] });
    },
  });
  const { data: highlights = [], isLoading: loadingHighlights } = useQuery<Highlight[]>({
    queryKey: ['shorts-highlights', importedVideoId],
    queryFn: () => api.shortsStudio.highlights(importedVideoId).then((r) => r.data as Highlight[]),
  });
  const { data: clips = [] } = useQuery<Clip[]>({
    queryKey: ['shorts-clips', importedVideoId],
    queryFn: () => api.shortsStudio.videoClips(importedVideoId).then((r) => r.data as Clip[]),
  });

  const loading = loadingTopics || loadingHighlights;

  return (
    <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto">
      <Link href="/shorts-studio" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Shorts Studio
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" /> Analysis results
        </h1>
        <div className="flex flex-wrap rounded-xl bg-gray-100 p-1 text-sm gap-0.5">
          <button
            onClick={() => setTab('highlights')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg whitespace-nowrap ${tab === 'highlights' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            <Trophy className="w-4 h-4" /> Highlights ({highlights.length})
          </button>
          <button
            onClick={() => setTab('topics')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg whitespace-nowrap ${tab === 'topics' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            <ListTree className="w-4 h-4" /> Topics ({topics.length})
          </button>
          <button
            onClick={() => setTab('chapters')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg whitespace-nowrap ${tab === 'chapters' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            <BookOpen className="w-4 h-4" /> Chapters ({chapters.length})
          </button>
          <button
            onClick={() => setTab('search')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg whitespace-nowrap ${tab === 'search' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            <Search className="w-4 h-4" /> Search
          </button>
          <button
            onClick={() => setTab('social')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg whitespace-nowrap ${tab === 'social' ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            <Share2 className="w-4 h-4" /> Social ({socialPieces.length})
          </button>
        </div>
      </div>

      {clips.length > 0 && (
        <section className="mb-6">
          <div
            onClick={() => setClipsOpen((o) => !o)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setClipsOpen((o) => !o); } }}
            className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            {clipsOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <Clapperboard className="w-4 h-4" /> Clips
            </h2>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium">{clips.length}</span>
          </div>
          {clipsOpen && (
            <ClipsList clips={clips} qc={qc} />
          )}
        </section>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading analysis…
        </div>
      )}

      {!loading && tab === 'highlights' && (
        <div className="space-y-4">
          {highlights.length === 0 && (
            <p className="text-center text-gray-500 py-16">
              No highlights yet — run Analyze from the Shorts Studio page and wait for the pipeline to finish.
            </p>
          )}
          {highlights.length > 0 && (
            <div className="flex justify-end -mb-2">
              <button
                onClick={() => setOpenHighlights((prev) => prev.size === highlights.length ? new Set() : new Set(highlights.map((h) => h.id)))}
                className="text-xs text-brand-600 hover:underline"
              >
                {openHighlights.size === highlights.length ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          )}
          {highlights.map((h) => (
            <HighlightCard
              key={h.id}
              h={h}
              open={openHighlights.has(h.id)}
              onToggle={() => setOpenHighlights((prev) => {
                const next = new Set(prev);
                if (next.has(h.id)) next.delete(h.id); else next.add(h.id);
                return next;
              })}
            />
          ))}
        </div>
      )}

      {!loading && tab === 'topics' && (
        <div className="space-y-2">
          {topics.length === 0 && (
            <p className="text-center text-gray-500 py-16">No topics yet — run Analyze from the Shorts Studio page.</p>
          )}
          {topics.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setOpenTopics((prev) => prev.size === topics.length ? new Set() : new Set(topics.map((t) => t.id)))}
                className="text-xs text-brand-600 hover:underline"
              >
                {openTopics.size === topics.length ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          )}
          {topics.map((t) => {
            const open = openTopics.has(t.id);
            const toggle = () => setOpenTopics((prev) => {
              const next = new Set(prev);
              if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
              return next;
            });
            return (
              <div key={t.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div
                  onClick={toggle}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                  <span className="text-xs text-gray-500 font-mono shrink-0 w-20">{fmt(t.startMs)}–{fmt(t.endMs)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {t.category.replace(/_/g, ' ')}
                  </span>
                  <p className="font-medium text-gray-900 truncate text-sm flex-1 min-w-0">{t.title}</p>
                  {t.highlight && (
                    <span className="text-sm font-bold text-brand-700 shrink-0" title="Highlight score">
                      {Math.round(t.highlight.finalScore)}
                    </span>
                  )}
                </div>
                {open && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-50">
                    <p className="text-sm text-gray-600">{t.summary}</p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      {fmt(t.startMs)}–{fmt(t.endMs)} · {Math.round((t.endMs - t.startMs) / 1000)}s · confidence {(t.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'chapters' && (
        <div className="space-y-2">
          {chapters.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">No chapters yet.</p>
              <button
                onClick={() => detectChapters.mutate()}
                disabled={detectChapters.isPending || detectChapters.isSuccess || topics.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {detectChapters.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                {detectChapters.isSuccess ? 'Detecting — check back shortly' : 'Detect chapters'}
              </button>
              {topics.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">Chapters are derived from topics — run Analyze first.</p>
              )}
            </div>
          )}
          {chapters.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <button
                  onClick={() => generateSmallVideos.mutate()}
                  disabled={generateSmallVideos.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700 disabled:opacity-50"
                  title="One horizontal 1–10 min video candidate per chapter — edit and render from the Clips list"
                >
                  {generateSmallVideos.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clapperboard className="w-3.5 h-3.5" />}
                  Generate small videos
                </button>
                {/* Church pack stays backend-only (POST /shorts-studio/videos/:id/church-pack) — no UI trigger by design */}
                <button
                  onClick={() => {
                    if (window.confirm('Publish these chapter timestamps into the video’s YouTube description? This edits the live video.')) {
                      syncChapters.mutate();
                    }
                  }}
                  disabled={syncChapters.isPending || chapters.length < 3}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-200 text-brand-700 rounded-lg text-xs hover:bg-brand-50 disabled:opacity-50"
                  title={chapters.length < 3 ? 'YouTube needs at least 3 chapters' : 'Publish the chapter block into the YouTube description'}
                >
                  {syncChapters.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {syncChapters.isSuccess ? `Synced ${syncChapters.data.chapters} ✓` : 'Sync to YouTube'}
                </button>
                {syncChapters.isError && (
                  <JobErrorCard
                    error={(syncChapters.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Sync failed'}
                    errorCode="CHAPTER_SYNC_FAILED"
                    onRetry={() => {
                      if (window.confirm('Publish these chapter timestamps into the video\'s YouTube description? This edits the live video.')) {
                        syncChapters.mutate();
                      }
                    }}
                  />
                )}
              </span>
              <span className="flex items-center gap-3">
                {generateSmallVideos.data && (
                  <span className="text-xs text-gray-500">
                    {generateSmallVideos.data.created} new · {generateSmallVideos.data.reused} existing
                    {generateSmallVideos.data.skippedTooShort > 0 && <> · {generateSmallVideos.data.skippedTooShort} too short</>}
                  </span>
                )}
                <button
                  onClick={() => setOpenChapters((prev) => prev.size === chapters.length ? new Set() : new Set(chapters.map((c) => c.id)))}
                  className="text-xs text-brand-600 hover:underline"
                >
                  {openChapters.size === chapters.length ? 'Collapse all' : 'Expand all'}
                </button>
              </span>
            </div>
          )}
          {chapters.map((c, i) => {
            const open = openChapters.has(c.id);
            const editing = editingChapterId === c.id;
            const toggle = () => setOpenChapters((prev) => {
              const next = new Set(prev);
              if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
              return next;
            });
            const saveTitle = () => {
              const title = chapterTitleDraft.trim();
              if (title && title !== c.title) renameChapter.mutate({ chapterId: c.id, title });
              else setEditingChapterId(null);
            };
            return (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div
                  onClick={editing ? undefined : toggle}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (!editing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                  <span className="text-xs text-gray-500 font-mono shrink-0 w-24">{fmt(c.startMs)}–{fmt(c.endMs)}</span>
                  <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-[11px] font-medium shrink-0">Ch. {i + 1}</span>
                  {editing ? (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- wrapper exists only to stop click propagation to the row toggle
                    <span className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={(el) => el?.focus()}
                        value={chapterTitleDraft}
                        onChange={(e) => setChapterTitleDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingChapterId(null); }}
                        className="flex-1 min-w-0 text-sm border border-brand-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      />
                      <button onClick={saveTitle} disabled={renameChapter.isPending} className="text-brand-600 hover:text-brand-800 shrink-0">
                        {renameChapter.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                    </span>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900 truncate text-sm flex-1 min-w-0">
                        {c.title}
                        {c.editedByUser && <span className="ml-1.5 text-[10px] text-gray-500" title="Edited by you">✎</span>}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingChapterId(c.id); setChapterTitleDraft(c.title); }}
                        className="text-gray-300 hover:text-brand-600 shrink-0"
                        title="Rename chapter"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <span className="text-[11px] text-gray-500 shrink-0">{Math.round((c.endMs - c.startMs) / 1000)}s</span>
                </div>
                {open && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-50">
                    <p className="text-sm text-gray-600">{c.summary}</p>
                    {c.keyPoints.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {c.keyPoints.map((kp, j) => (
                          <li key={j} className="text-xs text-gray-500 flex gap-1.5">
                            <span className="text-brand-400">•</span> {kp}
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Church-pack fields (scripture/devotional/questions) stay backend-only — intentionally not rendered */}
                    <p className="text-[11px] text-gray-500 mt-2">
                      {fmt(c.startMs)}–{fmt(c.endMs)} · confidence {(c.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'search' && (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) searchVideo.mutate(searchQuery.trim());
            }}
            className="flex gap-2 mb-4"
          >
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by meaning — e.g. "find John 3:16", "where do they talk about grace"'
              className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white shadow-sm"
            />
            <button
              type="submit"
              disabled={searchVideo.isPending || !searchQuery.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {searchVideo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          {searchVideo.data?.needsEmbeddings && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">This video has no embeddings yet — search needs them.</p>
              <button
                onClick={() => generateEmbeddings.mutate()}
                disabled={generateEmbeddings.isPending || generateEmbeddings.isSuccess}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {generateEmbeddings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generateEmbeddings.isSuccess ? 'Generating — try searching again shortly' : 'Generate embeddings'}
              </button>
            </div>
          )}

          {searchVideo.isError && (
            <JobErrorCard
              error={(searchVideo.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Search failed'}
              errorCode="JOB_FAILED"
              onRetry={() => { if (searchQuery.trim()) searchVideo.mutate(searchQuery.trim()); }}
              className="my-4"
            />
          )}

          {searchVideo.data && !searchVideo.data.needsEmbeddings && (
            <div className="space-y-2">
              {searchVideo.data.results.length === 0 && (
                <p className="text-center text-gray-500 py-12">No close matches for “{searchVideo.data.query}”.</p>
              )}
              {searchVideo.data.results.map((r) => (
                <div key={r.segmentId} className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3 flex items-start gap-3">
                  <span className="text-xs text-brand-700 font-mono font-semibold bg-brand-50 rounded-lg px-2 py-1 shrink-0">
                    {fmt(r.startMs)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{r.text}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {r.chapter ? <>chapter: {r.chapter} · </> : null}match {(r.score * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
              {searchVideo.data.results.length > 0 && searchVideo.data.embeddedSegments < searchVideo.data.totalSegments && (
                <p className="text-[11px] text-gray-500 text-center pt-2">
                  Searched {searchVideo.data.embeddedSegments}/{searchVideo.data.totalSegments} segments — embedding run incomplete.
                </p>
              )}
            </div>
          )}

          {!searchVideo.data && !searchVideo.isPending && !searchVideo.isError && (
            <p className="text-center text-gray-500 py-12">Type a phrase to jump to the moment it's spoken.</p>
          )}
        </div>
      )}

      {!loading && tab === 'social' && (
        <SocialTab
          pieces={socialPieces}
          onGenerate={() => generateSocial.mutate()}
          generating={generateSocial.isPending}
          queued={generateSocial.isSuccess}
        />
      )}
    </div>
  );
}

function SocialTab({ pieces, onGenerate, generating, queued }: {
  pieces: SocialPiece[];
  onGenerate: () => void;
  generating: boolean;
  queued: boolean;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const downloadCard = async (piece: SocialPiece) => {
    setRenderingId(piece.id);
    try {
      const { data } = await api.shortsStudio.renderQuoteCard(piece.id);
      const { versionId } = data as { versionId: string };
      const file = await api.shortsStudio.mediaVersionFile(versionId);
      const url = URL.createObjectURL(file.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-card-${piece.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setRenderingId(null);
    }
  };
  const copy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    });
  };
  const CopyBtn = ({ id, text }: { id: string; text: string }) => (
    <button
      onClick={() => copy(id, text)}
      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 shrink-0"
      title="Copy to clipboard"
    >
      {copiedId === id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiedId === id ? 'Copied' : 'Copy'}
    </button>
  );

  if (pieces.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">No social content yet.</p>
        <button
          onClick={onGenerate}
          disabled={generating || queued}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          {queued ? 'Generating — check back shortly' : 'Generate social pack'}
        </button>
        <p className="text-xs text-gray-500 mt-2">Quote cards, a carousel, a blog post, and a newsletter — one batched AI call.</p>
      </div>
    );
  }

  const quotes = pieces.filter((p) => p.kind === 'QUOTE_CARD');
  const carousel = pieces.find((p) => p.kind === 'CAROUSEL');
  const blog = pieces.find((p) => p.kind === 'BLOG_POST');
  const newsletter = pieces.find((p) => p.kind === 'NEWSLETTER');

  return (
    <div className="space-y-6">
      {quotes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Quote cards</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {quotes.map((q) => (
              <div key={q.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-800 italic">“{q.content.quote}”</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-gray-500">
                    {q.content.attribution ? `${q.content.attribution} · ` : ''}{q.content.startMs != null ? fmt(q.content.startMs) : ''}
                  </p>
                  <span className="flex items-center gap-3">
                    <button
                      onClick={() => void downloadCard(q)}
                      disabled={renderingId === q.id}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50"
                      title="Render and download a 1080×1080 PNG"
                    >
                      {renderingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                      PNG
                    </button>
                    <CopyBtn id={q.id} text={q.content.quote ?? ''} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {carousel?.content.slides && (
        <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Carousel — {carousel.title}</h2>
            <CopyBtn id={carousel.id} text={carousel.content.slides.map((s, i) => `${i + 1}. ${s.heading}\n${s.body}`).join('\n\n')} />
          </div>
          <ol className="space-y-2">
            {carousel.content.slides.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-gray-900">{i + 1}. {s.heading}</span>
                <p className="text-gray-600 text-xs mt-0.5">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {blog && (
        <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Blog post — {blog.title}</h2>
            <CopyBtn id={blog.id} text={blog.content.markdown ?? ''} />
          </div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">{blog.content.markdown}</pre>
        </section>
      )}

      {newsletter && (
        <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Newsletter — {newsletter.content.subject}</h2>
            <CopyBtn id={newsletter.id} text={newsletter.content.markdown ?? ''} />
          </div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">{newsletter.content.markdown}</pre>
        </section>
      )}
    </div>
  );
}
