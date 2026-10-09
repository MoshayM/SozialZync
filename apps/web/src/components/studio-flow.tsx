'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Youtube, BarChart2, Lightbulb, FileText, Mic, Music, Clapperboard,
  Play, RefreshCw, Loader2, CheckCircle, ChevronDown, ChevronUp, Save, Pencil, AlertTriangle, X,
  KeyRound, Sparkles, Download, FileVideo, FileAudio, FileImage, FileText as FileTextIcon, ShieldCheck,
  Square, Upload, Plus, ExternalLink, Check, Image as ImageIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ElapsedBadge, formatElapsed } from '@/components/ai-activity';
import { getErrorMessage } from '@/lib/getErrorMessage';

/**
 * Guided in-project production flow (design refs: image.png layout —
 * channel → Analyse / Suggestion / Script / Voice over / Music / Video —
 * with project.PNG's soft lavender clay tiles). Every tile wraps the
 * compliance-gated pipeline with resume, and every stage result is editable:
 * edits persist via the stage-override endpoint so downstream stages use
 * the edited version.
 */

export interface PipelineProgress {
  stage: string;
  index: number;
  count: number;
  etaSecs: number;
}

interface Job {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  result?: unknown;
  error?: string | null;
}

interface ScriptResult {
  title: string;
  hook: string;
  sections: Array<{ heading: string; content: string; durationEstimateSecs?: number }>;
  callToAction: string;
  totalWordCount?: number;
  estimatedDurationMins?: number;
  sources?: string[];
}

interface Props {
  projectId: string;
  channel: { id?: string; title: string; youtubeChannelId: string } | null;
  jobs: Job[];
  anyPipelineRunning: boolean;
  progress: PipelineProgress | null;
  runningPipeline: { id: string; startedAt?: string | null; createdAt: string } | null;
}

const RUNNING_STATES = ['PENDING', 'QUEUED', 'RUNNING'];

// Target distribution platform — shapes research/script tone and format
const PLATFORMS = ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'Podcast', 'Custom'] as const;

const PRESETS = [
  { value: 'LANDSCAPE', label: 'Landscape 16:9' },
  { value: 'VERTICAL',  label: 'Vertical 9:16' },
  { value: 'SQUARE',    label: 'Square 1:1' },
] as const;

// Platform-specific render profiles sent to the backend RENDER stage.
// Each entry maps to a PLATFORM_PROFILES entry in supervisor.worker.ts.
const RENDER_PLATFORMS = [
  { value: 'YOUTUBE',         label: 'YouTube',            format: '16:9 · 1920×1080', icon: '▶', quality: 'CRF 18 · 8 Mbps · 192 kbps AAC 48 kHz' },
  { value: 'YOUTUBE_SHORTS',  label: 'YouTube Shorts',     format: '9:16 · 1080×1920', icon: '▶', quality: 'CRF 20 · 3.5 Mbps · 128 kbps AAC' },
  { value: 'INSTAGRAM_REELS', label: 'Instagram Reels',    format: '9:16 · 1080×1920', icon: '◉', quality: 'CRF 20 · 3.5 Mbps · 128 kbps AAC' },
  { value: 'INSTAGRAM_FEED',  label: 'Instagram Feed',     format: '1:1 · 1080×1080',  icon: '◉', quality: 'CRF 20 · 3.5 Mbps · 128 kbps AAC' },
  { value: 'TIKTOK',          label: 'TikTok',             format: '9:16 · 1080×1920', icon: '♪', quality: 'CRF 20 · 3.5 Mbps · 128 kbps AAC' },
  { value: 'FACEBOOK',        label: 'Facebook',           format: '16:9 · 1920×1080', icon: 'f', quality: 'CRF 20 · 8 Mbps · 192 kbps AAC 48 kHz' },
  { value: 'TWITTER_X',       label: 'Twitter / X',        format: '16:9 · 1920×1080', icon: 'X', quality: 'CRF 20 · 5 Mbps · 128 kbps AAC' },
  { value: 'LINKEDIN',        label: 'LinkedIn',           format: '16:9 · 1920×1080', icon: 'in', quality: 'CRF 20 · 5 Mbps · 128 kbps AAC' },
  { value: 'BROADCAST',       label: 'Broadcast / Archive', format: '16:9 · 1920×1080', icon: '◈', quality: 'CRF 14 · 25 Mbps · 320 kbps AAC 48 kHz' },
] as const;

type RenderPlatformValue = typeof RENDER_PLATFORMS[number]['value'];

const VIDEO_TYPES = [
  { value: 'long-form',    label: 'Long-form video',  hint: 'Tutorial, documentary, review — any length' },
  { value: 'short',        label: 'Short / Reels',    hint: '15–90 seconds for Shorts, Reels, TikTok' },
  { value: 'ad',           label: 'Advertisement',    hint: '15–60 second promo or product ad' },
  { value: 'tutorial',     label: 'Tutorial / How-to', hint: 'Step-by-step instructional content' },
] as const;

// Map the coarse research platform to a sensible render-platform default
const PLATFORM_TO_RENDER: Record<string, RenderPlatformValue> = {
  YouTube:   'YOUTUBE',
  Facebook:  'FACEBOOK',
  Instagram: 'INSTAGRAM_REELS',
  TikTok:    'TIKTOK',
  LinkedIn:  'LINKEDIN',
  Podcast:   'YOUTUBE',
  Custom:    'YOUTUBE',
};

const FULL_MEDIA_REGENERATE = ['VOICE_GENERATE', 'IMAGE_GENERATE', 'MUSIC_GENERATE', 'VIDEO_GENERATE', 'EDIT_PLAN', 'RENDER'] as const;

// Ordered by global speaker population so the most-used languages appear first.
const CONTENT_LANGS = [
  { code: 'en',    name: 'English',             nativeName: 'English',          flag: '🇺🇸' },
  { code: 'zh',    name: 'Chinese',             nativeName: '中文',              flag: '🇨🇳' },
  { code: 'hi',    name: 'Hindi',               nativeName: 'हिन्दी',           flag: '🇮🇳' },
  { code: 'es',    name: 'Spanish',             nativeName: 'Español',          flag: '🇪🇸' },
  { code: 'ar',    name: 'Arabic',              nativeName: 'العربية',          flag: '🇸🇦' },
  { code: 'bn',    name: 'Bengali',             nativeName: 'বাংলা',            flag: '🇧🇩' },
  { code: 'fr',    name: 'French',              nativeName: 'Français',         flag: '🇫🇷' },
  { code: 'pt',    name: 'Portuguese',          nativeName: 'Português',        flag: '🇧🇷' },
  { code: 'ru',    name: 'Russian',             nativeName: 'Русский',          flag: '🇷🇺' },
  { code: 'ur',    name: 'Urdu',                nativeName: 'اردو',             flag: '🇵🇰' },
  { code: 'id',    name: 'Indonesian',          nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'de',    name: 'German',              nativeName: 'Deutsch',          flag: '🇩🇪' },
  { code: 'ja',    name: 'Japanese',            nativeName: '日本語',            flag: '🇯🇵' },
  { code: 'te',    name: 'Telugu',              nativeName: 'తెలుగు',           flag: '🇮🇳' },
  { code: 'mr',    name: 'Marathi',             nativeName: 'मराठी',            flag: '🇮🇳' },
  { code: 'ta',    name: 'Tamil',               nativeName: 'தமிழ்',            flag: '🇮🇳' },
  { code: 'ko',    name: 'Korean',              nativeName: '한국어',            flag: '🇰🇷' },
  { code: 'vi',    name: 'Vietnamese',          nativeName: 'Tiếng Việt',       flag: '🇻🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文',        flag: '🇹🇼' },
  { code: 'tr',    name: 'Turkish',             nativeName: 'Türkçe',           flag: '🇹🇷' },
  { code: 'it',    name: 'Italian',             nativeName: 'Italiano',         flag: '🇮🇹' },
  { code: 'th',    name: 'Thai',                nativeName: 'ภาษาไทย',          flag: '🇹🇭' },
  { code: 'gu',    name: 'Gujarati',            nativeName: 'ગુજરાતી',          flag: '🇮🇳' },
  { code: 'kn',    name: 'Kannada',             nativeName: 'ಕನ್ನಡ',            flag: '🇮🇳' },
  { code: 'ml',    name: 'Malayalam',           nativeName: 'മലയാളം',           flag: '🇮🇳' },
  { code: 'pa',    name: 'Punjabi',             nativeName: 'ਪੰਜਾਬੀ',           flag: '🇮🇳' },
  { code: 'ms',    name: 'Malay',               nativeName: 'Bahasa Melayu',    flag: '🇲🇾' },
  { code: 'tl',    name: 'Filipino',            nativeName: 'Filipino',         flag: '🇵🇭' },
  { code: 'pl',    name: 'Polish',              nativeName: 'Polski',           flag: '🇵🇱' },
  { code: 'nl',    name: 'Dutch',               nativeName: 'Nederlands',       flag: '🇳🇱' },
  { code: 'sv',    name: 'Swedish',             nativeName: 'Svenska',          flag: '🇸🇪' },
  { code: 'no',    name: 'Norwegian',           nativeName: 'Norsk',            flag: '🇳🇴' },
  { code: 'da',    name: 'Danish',              nativeName: 'Dansk',            flag: '🇩🇰' },
  { code: 'fi',    name: 'Finnish',             nativeName: 'Suomi',            flag: '🇫🇮' },
  { code: 'el',    name: 'Greek',               nativeName: 'Ελληνικά',        flag: '🇬🇷' },
  { code: 'he',    name: 'Hebrew',              nativeName: 'עברית',            flag: '🇮🇱' },
  { code: 'cs',    name: 'Czech',               nativeName: 'Čeština',         flag: '🇨🇿' },
  { code: 'ro',    name: 'Romanian',            nativeName: 'Română',          flag: '🇷🇴' },
  { code: 'hu',    name: 'Hungarian',           nativeName: 'Magyar',           flag: '🇭🇺' },
  { code: 'uk',    name: 'Ukrainian',           nativeName: 'Українська',      flag: '🇺🇦' },
  { code: 'sw',    name: 'Swahili',             nativeName: 'Kiswahili',        flag: '🇰🇪' },
];

type VoiceStyleId = 'default' | 'male' | 'female' | 'storyteller' | 'deep' | 'warm';
const VOICE_STYLES: Array<{ id: VoiceStyleId; label: string; icon: string; desc: string; voiceProfile: Record<string, string> }> = [
  { id: 'default',     label: 'Default',     icon: '🎙️', desc: 'AI auto-selects best voice',         voiceProfile: { gender: 'neutral', style: 'conversational', tone: 'engaging',     pace: 'moderate' } },
  { id: 'male',        label: 'Male',         icon: '👨', desc: 'Clear confident male voice',          voiceProfile: { gender: 'male',    style: 'professional',  tone: 'confident',    pace: 'moderate' } },
  { id: 'female',      label: 'Female',       icon: '👩', desc: 'Friendly energetic female voice',     voiceProfile: { gender: 'female',  style: 'friendly',      tone: 'warm',         pace: 'moderate' } },
  { id: 'storyteller', label: 'Storyteller',  icon: '📖', desc: 'Warm narrative storytelling tone',    voiceProfile: { gender: 'neutral', style: 'narrative',     tone: 'dramatic',     pace: 'slow'     } },
  { id: 'deep',        label: 'Deep',         icon: '🎚️', desc: 'Rich authoritative deep voice',       voiceProfile: { gender: 'male',    style: 'authoritative', tone: 'serious',      pace: 'slow'     } },
  { id: 'warm',        label: 'Warm',         icon: '✨', desc: 'Soft expressive female voice',        voiceProfile: { gender: 'female',  style: 'expressive',    tone: 'soft',         pace: 'gentle'   } },
];

const SONG_STYLES = [
  { id: 'pop',        label: 'Pop',        icon: '🎵' },
  { id: 'hip-hop',    label: 'Hip-Hop',    icon: '🎤' },
  { id: 'rnb',        label: 'R&B',        icon: '🎸' },
  { id: 'rock',       label: 'Rock',       icon: '🥁' },
  { id: 'electronic', label: 'Electronic', icon: '🎛️' },
  { id: 'country',    label: 'Country',    icon: '🤠' },
] as const;

const VOCAL_TYPES = [
  { id: 'solo-female', label: 'Female Solo', icon: '👩' },
  { id: 'solo-male',   label: 'Male Solo',   icon: '👨' },
  { id: 'duet',        label: 'Duet',        icon: '👥' },
  { id: 'group',       label: 'Group Choir', icon: '🎭' },
] as const;

const CHARACTER_COLORS = [
  { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    chip: 'bg-blue-100 text-blue-700'    },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', chip: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-800',  chip: 'bg-violet-100 text-violet-700'  },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   chip: 'bg-amber-100 text-amber-700'    },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-800',    chip: 'bg-rose-100 text-rose-700'      },
  { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-800',    chip: 'bg-cyan-100 text-cyan-700'      },
] as const;

function latest(jobs: Job[], type: string): Job | undefined {
  return jobs
    .filter((j) => j.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function isDone(jobs: Job[], type: string): boolean {
  return latest(jobs, type)?.status === 'COMPLETED';
}

function isRunning(jobs: Job[], ...types: string[]): Job | undefined {
  return jobs
    .filter((j) => types.includes(j.type) && RUNNING_STATES.includes(j.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

/** Latest FAILED job of the given types, unless a newer success/run supersedes it. */
function latestFailure(jobs: Job[], ...types: string[]): Job | undefined {
  const relevant = jobs
    .filter((j) => types.includes(j.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return relevant[0]?.status === 'FAILED' ? relevant[0] : undefined;
}

function completedAt(jobs: Job[], type: string): string | undefined {
  const j = latest(jobs, type);
  return j?.status === 'COMPLETED' ? (j.completedAt ?? undefined) : undefined;
}

// ── File helpers (for exports grid) ──────────────────────────────────────────

function fileIcon(name: string) {
  if (/\.(mp4|mov|webm)$/i.test(name)) return <FileVideo className="w-4 h-4 text-brand-600" />;
  if (/\.(mp3|wav)$/i.test(name)) return <FileAudio className="w-4 h-4 text-purple-600" />;
  if (/\.(png|jpg|jpeg)$/i.test(name)) return <FileImage className="w-4 h-4 text-green-600" />;
  return <FileTextIcon className="w-4 h-4 text-gray-500" />;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

async function downloadBlob(res: { data: unknown }, name: string) {
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ state, updatedAt }: { state: 'done' | 'running' | 'failed' | 'notStarted'; updatedAt?: string }) {
  if (state === 'running') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-brand-700">
        <Loader2 className="w-3 h-3 animate-spin" /> In progress
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
        <AlertTriangle className="w-3 h-3" /> Failed
      </span>
    );
  }
  if (state === 'done') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-green-600" title={updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : undefined}>
        <CheckCircle className="w-3 h-3" />
        Completed{updatedAt ? ` · ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
      <span className="w-2 h-2 rounded-full bg-gray-300" /> Not started
    </span>
  );
}

// ── Small blob-backed media player (auth header needed, so no direct <audio src>) ──

function MediaPlayer({ versionId, kind }: { versionId: string; kind: 'audio' | 'video' }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retries, setRetries] = useState(0);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.media.versionFile(versionId);
      setUrl(URL.createObjectURL(res.data as Blob));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount and retry once after a short delay (handles cold-start
  // race where the file is being written to disk for the first time).
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loadError || retries >= 1) return;
    const t = setTimeout(() => { setRetries((r) => r + 1); void load(); }, 1500);
    return () => clearTimeout(t);
  }, [loadError]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!url) {
    return (
      <span className="flex items-center gap-2">
        <button
          onClick={() => { setRetries(0); void load(); }}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {loading ? 'Loading…' : loadError ? 'Retry' : kind === 'audio' ? 'Play audio' : 'Play video'}
        </button>
        {loadError && retries >= 1 && (
          <span className="text-[11px] text-amber-600">File not available — click Regenerate to rebuild it</span>
        )}
      </span>
    );
  }
  return kind === 'audio'
    // eslint-disable-next-line jsx-a11y/media-has-caption -- AI-generated preview; caption track not produced
    ? <audio controls src={url} className="w-full h-9" />
    // eslint-disable-next-line jsx-a11y/media-has-caption -- AI-generated preview; caption track not produced
    : <video controls src={url} className="w-full rounded-xl max-h-56 bg-black" />;
}

// ── Image preview (blob-backed, auth header needed) ────────────────────────

function ImagePreview({ versionId }: { versionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    api.media.versionFile(versionId)
      .then((res) => { if (!cancelled) setUrl(URL.createObjectURL(res.data as Blob)); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [versionId]);

  if (loading) return <div className="w-full aspect-video bg-gray-100 rounded-xl animate-pulse" />;
  if (loadError || !url) return (
    <div className="w-full aspect-video bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
      <span className="text-[11px] text-gray-400">Preview unavailable</span>
    </div>
  );
  return <img src={url} alt="" className="w-full rounded-xl aspect-video object-cover" />;
}

// ── Tile shell ────────────────────────────────────────────────────────────────

function Tile({
  icon, title, subtitle, status, running, failed, updatedAt, selected, hasDetail, onToggle, action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: 'done' | 'ready' | 'locked';
  running?: Job;
  failed?: Job;
  updatedAt?: string;
  selected: boolean;
  hasDetail: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  const badgeState = running ? 'running' : failed ? 'failed' : status === 'done' ? 'done' : 'notStarted';
  const expandable = hasDetail && status !== 'locked';
  return (
    <div className={`rounded-3xl p-5 transition-all duration-200 ${
      status === 'locked'
        ? 'bg-[#f3effb] opacity-70'
        : 'bg-[#efe8fb] shadow-sm hover:shadow-lg hover:-translate-y-0.5'
    }${selected ? ' ring-2 ring-[#8b74d8] shadow-md' : ''}`}>
      <div
        className={`flex items-start gap-3 ${expandable ? 'cursor-pointer' : ''}`}
        onClick={expandable ? onToggle : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      >
        <div className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-600 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{title}</p>
            {running && <ElapsedBadge since={running.startedAt ?? running.createdAt} />}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        {expandable && (
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-gray-500 hover:text-gray-600 p-1 shrink-0" aria-label={`${selected ? 'Collapse' : 'Expand'} ${title}`}>
            {selected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-3.5">
        <StatusBadge state={badgeState} updatedAt={updatedAt} />
        {action}
      </div>
      {failed && !running && (
        <p className="text-[11px] text-red-500 mt-2 line-clamp-2" title={(failed as { error?: string }).error ?? ''}>
          {(failed as { error?: string }).error ?? 'The last run failed — try again.'}
        </p>
      )}
    </div>
  );
}

function RunButton({ label, onClick, disabled, rerun }: { label: string; onClick: () => void; disabled: boolean; rerun: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 ${
        rerun ? 'border border-brand-300 text-brand-700 hover:bg-brand-50' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
      }`}
    >
      {rerun ? <RefreshCw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StudioFlow({ projectId, channel, jobs, anyPipelineRunning, progress, runningPipeline }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  // Mount the detail content exactly once: inline below the card on mobile,
  // in the full-width panel on md+ (CSS-only hiding would duplicate labeled
  // inputs in the DOM).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(`cf_topic_${projectId}`) ?? '' : '');
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem(`cf_platform_${projectId}`) : null) as (typeof PLATFORMS)[number] | null ?? 'YouTube');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['value']>(() =>
    (typeof window !== 'undefined' ? (localStorage.getItem(`cf_preset_${projectId}`) as (typeof PRESETS)[number]['value'] | null) : null) ?? 'LANDSCAPE');
  // Production mode set during New Project wizard (CHARACTER_STORY, SONG, or FULL default)
  const productionMode = typeof window !== 'undefined'
    ? (localStorage.getItem(`cf_prodmode_${projectId}`) ?? 'FULL')
    : 'FULL';
  const [refreshMedia, setRefreshMedia] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [pendingTopic, setPendingTopic] = useState('');
  const [targetLang, setTargetLang] = useState<string>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem(`cf_lang_${projectId}`) : null) ?? 'en'
  );
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  // Batch project creation
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchChecked, setBatchChecked] = useState<Set<string>>(new Set());
  const [batchCreating, setBatchCreating] = useState(false);
  type BatchStatus = { status: 'creating' | 'done' | 'error'; projectId?: string; error?: string };
  const [batchResults, setBatchResults] = useState<Map<string, BatchStatus>>(new Map());
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState('');
  const [musicPromptOverride, setMusicPromptOverride] = useState<string | undefined>(undefined);
  const [briefOpen, setBriefOpen] = useState(false);
  // AI Voice sub-tabs: narration · character cast · audio song
  const [aiVoiceTab, setAiVoiceTab] = useState<'narration' | 'character' | 'song'>('narration');
  const [songStyle, setSongStyle] = useState<typeof SONG_STYLES[number]['id']>('pop');
  const [vocalType, setVocalType] = useState<typeof VOCAL_TYPES[number]['id']>('solo-female');
  const [songLyrics, setSongLyrics] = useState('');
  // 'smart' = free narration+music FFmpeg mix; 'song' = AI vocal song via Suno
  const [mixMode, setMixMode] = useState<'smart' | 'song'>('smart');
  const [scriptDraft, setScriptDraft] = useState<ScriptResult | null>(null);
  const [voiceKey, setVoiceKey] = useState('');
  const [voiceKeySaved, setVoiceKeySaved] = useState(false);
  // Voice mode: 'ai' = AI Voice, 'record' = Your Voice
  const [voiceMode, setVoiceMode] = useState<'ai' | 'record'>('ai');
  const [yourVoiceMode, setYourVoiceMode] = useState<'full' | 'character' | 'ref'>('full');
  // Full-script recording
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingError, setRecordingError] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobEvent['data'][]>([]);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  // Voice Reference recording
  const [refRecording, setRefRecording] = useState(false);
  const [refBlob, setRefBlob] = useState<Blob | null>(null);
  const [refPreviewPlaying, setRefPreviewPlaying] = useState(false);
  const refMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const refAudioChunksRef = useRef<BlobEvent['data'][]>([]);
  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [cloneAvailability, setCloneAvailability] = useState<{ available: boolean; reason?: string; provider?: string } | null>(null);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyleId>('default');
  const [elevenLabsOpen, setElevenLabsOpen] = useState(false);
  // Pre-render settings dialog
  const [showRenderDialog, setShowRenderDialog] = useState(false);
  const [renderPlatform, setRenderPlatform] = useState<RenderPlatformValue>(() =>
    PLATFORM_TO_RENDER[platform] ?? 'YOUTUBE');
  const [renderVideoType, setRenderVideoType] = useState<typeof VIDEO_TYPES[number]['value']>('long-form');

  // ── Creative Preferences (optional pre-script user guidance) ─────────────
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [creativePrefs, setCreativePrefs] = useState<{
    scriptStyle: string; videoStyle: string; tone: string;
    targetAudience: string; titleFeedback: string; notes: string;
  }>(() => {
    try {
      const stored = localStorage.getItem(`cf_prefs_${projectId}`);
      return stored ? JSON.parse(stored) as { scriptStyle: string; videoStyle: string; tone: string; targetAudience: string; titleFeedback: string; notes: string } : { scriptStyle: '', videoStyle: '', tone: '', targetAudience: '', titleFeedback: '', notes: '' };
    } catch { return { scriptStyle: '', videoStyle: '', tone: '', targetAudience: '', titleFeedback: '', notes: '' }; }
  });

  function savePrefs(next: typeof creativePrefs) {
    setCreativePrefs(next);
    localStorage.setItem(`cf_prefs_${projectId}`, JSON.stringify(next));
  }

  const hasPrefs = Object.values(creativePrefs).some(v => v.trim().length > 0);
  const prefsPayload = hasPrefs ? { creativePrefs } : {};

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Array<{ id: string; title: string; youtubeChannelId: string }>),
  });

  const { data: exportFiles = [] } = useQuery({
    queryKey: ['exports', projectId],
    queryFn: () => api.media.listExports(projectId).then((r) => r.data),
    refetchInterval: runningPipeline ? 15_000 : false,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['project', projectId] });

  const enqueue = useMutation({
    mutationFn: ({ type, payload }: { type: string; payload?: Record<string, unknown> }) =>
      api.jobs.enqueue(projectId, type, payload),
    onMutate: () => setError(''),
    onError: (err: unknown) => setError(getErrorMessage(err) || 'Failed to start'),
    onSettled: invalidate,
  });

  const switchChannel = useMutation({
    mutationFn: (channelId: string) => api.projects.update(projectId, { channelId }),
    onSettled: invalidate,
  });

  const saveScript = useMutation({
    mutationFn: (result: ScriptResult) => {
      const words = [result.hook, ...result.sections.map((s) => s.content), result.callToAction]
        .join(' ').trim().split(/\s+/).length;
      return api.jobs.overrideResult(projectId, 'SCRIPT', { ...result, totalWordCount: words });
    },
    onSuccess: () => { setScriptDraft(null); invalidate(); },
    onError: (err: unknown) => setError(getErrorMessage(err) || 'Failed to save script'),
  });

  const saveVoiceKey = useMutation({
    mutationFn: (key: string) => api.settings.updateApiKeys({ ELEVENLABS_API_KEY: key.trim() }),
    onSuccess: () => { setVoiceKeySaved(true); setVoiceKey(''); },
    onError: (err: unknown) => setError(getErrorMessage(err) || 'Failed to save the voice key'),
  });

  const uploadRecording = useMutation({
    mutationFn: (blob: Blob) => api.media.uploadVoice(projectId, blob),
    onError: (err: unknown) => setRecordingError(getErrorMessage(err) || 'Upload failed'),
  });

  const startRecording = useCallback(async () => {
    setRecordingError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setRecordingError('Microphone access denied — please allow microphone in your browser settings.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const previewRecording = useCallback(() => {
    if (!recordedBlob) return;
    if (previewPlaying && recordedAudioRef.current) {
      recordedAudioRef.current.pause();
      recordedAudioRef.current.currentTime = 0;
      setPreviewPlaying(false);
      return;
    }
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    recordedAudioRef.current = audio;
    audio.onended = () => setPreviewPlaying(false);
    void audio.play();
    setPreviewPlaying(true);
  }, [recordedBlob, previewPlaying]);

  const startRefRecording = useCallback(async () => {
    setCloneError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      refAudioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) refAudioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(refAudioChunksRef.current, { type: 'audio/webm' });
        setRefBlob(blob);
        setClonedVoiceId(null);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      refMediaRecorderRef.current = mr;
      setRefRecording(true);
    } catch {
      setCloneError('Microphone access denied.');
    }
  }, []);

  const stopRefRecording = useCallback(() => {
    refMediaRecorderRef.current?.stop();
    setRefRecording(false);
  }, []);

  const previewRef = useCallback(() => {
    if (!refBlob) return;
    if (refPreviewPlaying && refAudioRef.current) {
      refAudioRef.current.pause();
      refAudioRef.current.currentTime = 0;
      setRefPreviewPlaying(false);
      return;
    }
    const url = URL.createObjectURL(refBlob);
    const audio = new Audio(url);
    refAudioRef.current = audio;
    audio.onended = () => setRefPreviewPlaying(false);
    void audio.play();
    setRefPreviewPlaying(true);
  }, [refBlob, refPreviewPlaying]);

  useEffect(() => {
    const token = localStorage.getItem('cf_token') ?? '';
    fetch('/api/proxy/voice/clone-available', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setCloneAvailability(data as { available: boolean; reason?: string; provider?: string }))
      .catch(() => setCloneAvailability({ available: false, reason: 'Could not check voice cloning availability.' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cloneAndGenerate = useCallback(async () => {
    if (!refBlob) return;
    setCloneLoading(true);
    setCloneError('');
    try {
      const form = new FormData();
      form.append('audio', refBlob, 'voice-sample.webm');
      const res = await fetch(`/api/proxy/voice/clone?projectId=${encodeURIComponent(projectId)}`, {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${localStorage.getItem('cf_token') ?? ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; statusCode?: number };
        throw new Error(body.message ?? `Clone failed (${res.status})`);
      }
      const { voiceId } = await res.json() as { voiceId: string };
      setClonedVoiceId(voiceId);
      enqueue.mutate({ type: 'FULL_PRODUCTION', payload: { scope: 'VOICE', referenceVoiceId: voiceId, lang: targetLang, regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'] } });
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : 'Voice cloning failed. Try again or use an AI voice style below.');
    } finally {
      setCloneLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refBlob, targetLang]);

  function chooseTopic(t: string) {
    setTopic(t);
    localStorage.setItem(`cf_topic_${projectId}`, t);
  }

  function setLang(code: string) {
    setTargetLang(code);
    localStorage.setItem(`cf_lang_${projectId}`, code);
  }

  const handleBatchCreate = useCallback(async (topics: string[]) => {
    if (!topics.length) return;
    setBatchCreating(true);
    setBatchResults(new Map(topics.map((t) => [t, { status: 'creating' }])));
    await Promise.allSettled(
      topics.map(async (t) => {
        try {
          const res = await api.projects.create({ title: t, channelId: channel?.id || undefined });
          const newId = (res.data as { id: string }).id;
          localStorage.setItem(`cf_topic_${newId}`, t);
          setBatchResults((prev) => { const m = new Map(prev); m.set(t, { status: 'done', projectId: newId }); return m; });
        } catch (e) {
          const err = e as { response?: { data?: { message?: string } } };
          setBatchResults((prev) => { const m = new Map(prev); m.set(t, { status: 'error', error: err.response?.data?.message ?? 'Failed' }); return m; });
        }
      }),
    );
    setBatchCreating(false);
  }, [channel?.id]);

  function choosePlatform(p: (typeof PLATFORMS)[number]) {
    setPlatform(p);
    localStorage.setItem(`cf_platform_${projectId}`, p);
  }

  function choosePreset(p: (typeof PRESETS)[number]['value']) {
    setPreset(p);
    localStorage.setItem(`cf_preset_${projectId}`, p);
  }

  const busy = enqueue.isPending || anyPipelineRunning;

  // Stage state
  const analyseJob = latest(jobs, 'TREND_ANALYSIS');
  const analyseDone = isDone(jobs, 'TREND_ANALYSIS');
  const trends = (analyseJob?.result as { trending?: Array<{ topic: string; score: number }> } | undefined)?.trending ?? [];
  const scriptJob = latest(jobs, 'SCRIPT');
  const scriptDone = isDone(jobs, 'SCRIPT');
  const script = scriptJob?.status === 'COMPLETED' ? (scriptJob.result as ScriptResult) : null;
  const voiceJob = latest(jobs, 'VOICE_GENERATE');
  const voiceResult = voiceJob?.status === 'COMPLETED' ? (voiceJob.result as { versionId?: string; provider?: string; durationMs?: number; notes?: string }) : null;
  const specJob = latest(jobs, 'VOICE_SPEC');
  type DetectedCharacter = { name: string; gender?: string; style?: string; tone?: string; pace?: string; description?: string };
  const detectedCharacters: DetectedCharacter[] = (specJob?.status === 'COMPLETED'
    ? ((specJob.result as { characters?: DetectedCharacter[] })?.characters ?? [])
    : []);
  // Character Story pipeline
  const castJob = latest(jobs, 'CHARACTER_CAST');
  type CastCharacter = { name: string; role: string; gender: string; ageGroup: string; personality: string; voiceStyle: { voiceId: string; emotion: string; speed: number }; visualDescription: string };
  const castResult = castJob?.status === 'COMPLETED'
    ? (castJob.result as { characters?: CastCharacter[]; totalCharacters?: number; narrativeStyle?: string }) : null;
  const portraitJob = latest(jobs, 'CHARACTER_IMAGE_GENERATE');
  type Portrait = { name: string; assetId?: string; versionId?: string; key?: string; provider?: string };
  const portraits: Portrait[] = portraitJob?.status === 'COMPLETED'
    ? ((portraitJob.result as { portraits?: Portrait[] })?.portraits ?? []) : [];
  const musicJob = latest(jobs, 'MUSIC_GENERATE');
  const musicResult = musicJob?.status === 'COMPLETED' ? (musicJob.result as { versionId?: string; provider?: string; durationMs?: number; notes?: string }) : null;
  const songJob = latest(jobs, 'SONG_GENERATE');
  const songResult = songJob?.status === 'COMPLETED' ? (songJob.result as { versionId?: string; provider?: string; durationMs?: number; notes?: string; songStyle?: string; vocalType?: string }) : null;
  // Image pipeline results
  const imageBriefJob = latest(jobs, 'IMAGE_BRIEF');
  type ImageBriefItem = { sceneId: string; sectionHeading: string; prompt: string; style: string; aspectRatio: string };
  const imageBriefResult = imageBriefJob?.status === 'COMPLETED' ? (imageBriefJob.result as { briefs?: ImageBriefItem[] }) : null;
  const imageGenJob = latest(jobs, 'IMAGE_GENERATE');
  type ImageGenItem = { sceneId: string; assetId: string; versionId?: string; provider: string };
  const imageGenResult = imageGenJob?.status === 'COMPLETED' ? (imageGenJob.result as { images?: ImageGenItem[] }) : null;
  // Smart Mix: find the latest FULL_PRODUCTION job with scope=SMART_MIX that has an audioMix result
  const smartMixJob = [...jobs]
    .filter((j) => j.type === 'FULL_PRODUCTION' && (j.result as { scope?: string } | null)?.scope === 'SMART_MIX')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const mixResult = smartMixJob?.status === 'COMPLETED' ? (smartMixJob.result as { audioMix?: { versionId?: string; durationMs?: number } | null })?.audioMix : null;
  const musicBrief = latest(jobs, 'MUSIC_BRIEF')?.result as { mood?: string; genre?: string; bpm?: number; prompt?: string; emotionalArc?: string } | undefined;
  const videoJob = latest(jobs, 'VIDEO_GENERATE');
  const videoResult = videoJob?.status === 'COMPLETED' ? (videoJob.result as { videos?: Array<{ sceneId: string; versionId?: string; provider: string }> }) : null;
  const renderJob = latest(jobs, 'RENDER');
  const renderDone = isDone(jobs, 'RENDER');
  const renderResult = renderJob?.status === 'COMPLETED'
    ? (renderJob.result as { versionId?: string; preset?: string; durationSecs?: number } | undefined)
    : undefined;

  const runningFoundation = isRunning(jobs, 'RESEARCH', 'SCRIPT', 'FACT_CHECK', 'COMPLIANCE', 'FULL_PRODUCTION');
  const effectiveTopic = topic || pendingTopic || customTopic;

  const toggle = (key: string) => setExpanded((e) => (e === key ? null : key));

  // Progress bar pct for rendering section
  const pct = progress && progress.count > 0 ? Math.round((progress.index / progress.count) * 100) : 0;

  // ── Detail content variables ──────────────────────────────────────────────

  // Compliance info for analyse detail
  const complianceJob = latest(jobs, 'COMPLIANCE');
  const complianceDone = complianceJob?.status === 'COMPLETED';
  const complianceResult = complianceDone
    ? (complianceJob?.result as { passed?: boolean; score?: number } | undefined)
    : undefined;

  const analyseDetail = (
    <>
      {trends.length ? (
        <ul className="space-y-1.5">
          {trends.map((t, i) => (
            <li key={i} className="flex items-center justify-between text-sm text-gray-700">
              <span className="truncate">{t.topic}</span>
              <span className="text-xs font-bold text-brand-600 shrink-0 ml-2">{t.score}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-gray-500">Run the analysis to see trending topics.</p>}

      {/* Channel intelligence rows */}
      <div className="mt-4 border-t border-gray-100 pt-3 space-y-2">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Channel intelligence</p>

        {/* Audience row */}
        {(() => {
          const audienceJob = latest(jobs, 'AUDIENCE_ANALYSIS');
          const audienceDone = isDone(jobs, 'AUDIENCE_ANALYSIS');
          const audienceRunning = isRunning(jobs, 'AUDIENCE_ANALYSIS');
          const audienceFailed = latestFailure(jobs, 'AUDIENCE_ANALYSIS');
          const audienceResult = audienceDone
            ? (audienceJob?.result as {
                primaryDemographic?: string;
                ageRange?: string;
                interests?: string[];
                peakEngagementTimes?: string[];
                contentPreferences?: string[];
                recommendations?: string[];
              } | undefined)
            : undefined;
          return (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-700">Audience</span>
                <button
                  onClick={() => enqueue.mutate({ type: 'AUDIENCE_ANALYSIS' })}
                  disabled={busy}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                >
                  {audienceDone ? <RefreshCw className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  {audienceDone ? 'Re-run' : 'Run'}
                </button>
              </div>
              {audienceRunning && (
                <span className="flex items-center gap-1 text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Running…</span>
              )}
              {audienceFailed && !audienceRunning && (
                <p className="text-red-500 text-[10px]">{(audienceFailed as { error?: string }).error ?? 'Last run failed — try again.'}</p>
              )}
              {audienceResult && !audienceRunning && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-2.5 space-y-2">
                  {audienceResult.primaryDemographic && (
                    <div>
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-0.5">Primary Audience</p>
                      <p className="text-gray-800 font-medium leading-snug">{audienceResult.primaryDemographic}</p>
                      {audienceResult.ageRange && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-medium">Age {audienceResult.ageRange}</span>
                      )}
                    </div>
                  )}
                  {audienceResult.interests && audienceResult.interests.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-0.5">Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {audienceResult.interests.map((interest, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-white border border-violet-100 text-gray-600 rounded text-[10px]">{interest}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {audienceResult.peakEngagementTimes && audienceResult.peakEngagementTimes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-0.5">Peak Times</p>
                      <ul className="space-y-0.5 text-gray-600">
                        {audienceResult.peakEngagementTimes.map((t, i) => (
                          <li key={i}>· {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {audienceResult.contentPreferences && audienceResult.contentPreferences.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-0.5">Content Preferences</p>
                      <ul className="space-y-0.5 text-gray-600">
                        {audienceResult.contentPreferences.map((p, i) => (
                          <li key={i}>· {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {audienceResult.recommendations && audienceResult.recommendations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-0.5">Recommendations</p>
                      <ul className="space-y-0.5 text-gray-600">
                        {audienceResult.recommendations.map((r, i) => (
                          <li key={i}>· {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Channel report row */}
        {(() => {
          const analyticsJob = latest(jobs, 'ANALYTICS');
          const analyticsDone = isDone(jobs, 'ANALYTICS');
          const analyticsRunning = isRunning(jobs, 'ANALYTICS');
          const analyticsFailed = latestFailure(jobs, 'ANALYTICS');
          const analyticsResult = analyticsDone
            ? (analyticsJob?.result as {
                overallScore?: number;
                summary?: string;
                insights?: Array<{ finding: string; metric?: string; suggestion?: string; impact?: string }>;
                retentionIssues?: Array<{ diagnosis: string; dropOffPct?: number }>;
              } | undefined)
            : undefined;
          return (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-700">Channel report</span>
                <button
                  onClick={() => enqueue.mutate({ type: 'ANALYTICS' })}
                  disabled={busy || !channel}
                  title={!channel ? 'Connect a YouTube channel first' : undefined}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {analyticsDone ? <RefreshCw className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  {analyticsDone ? 'Re-run' : 'Run'}
                </button>
              </div>
              {!channel && !analyticsDone && (
                <p className="text-amber-500 text-[10px]">Connect a YouTube channel to enable this step</p>
              )}
              {analyticsRunning && (
                <span className="flex items-center gap-1 text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Running…</span>
              )}
              {analyticsFailed && !analyticsRunning && (
                <p className="text-red-500 text-[10px]">{(analyticsFailed as { error?: string }).error ?? 'Last run failed — try again.'}</p>
              )}
              {analyticsDone && analyticsResult && !analyticsRunning && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 space-y-2">
                  {analyticsResult.overallScore != null && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-600 text-sm">{analyticsResult.overallScore}/100</span>
                      <span className="text-gray-500">channel score</span>
                    </div>
                  )}
                  {analyticsResult.summary && (
                    <p className="text-gray-600 leading-snug">{analyticsResult.summary}</p>
                  )}
                  {analyticsResult.insights && analyticsResult.insights.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Insights</p>
                      <ul className="space-y-1.5 text-gray-600">
                        {analyticsResult.insights.map((ins, i) => (
                          <li key={i} className="leading-snug">
                            <span className="font-medium">{ins.finding}</span>
                            {ins.suggestion && <span className="text-gray-400"> — {ins.suggestion}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analyticsResult.retentionIssues && analyticsResult.retentionIssues.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Retention Issues</p>
                      <ul className="space-y-0.5 text-gray-600">
                        {analyticsResult.retentionIssues.map((iss, i) => (
                          <li key={i} className="leading-snug">· {iss.diagnosis}{iss.dropOffPct != null ? ` (${iss.dropOffPct}% drop)` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Growth ideas row */}
        {(() => {
          const growthJob = latest(jobs, 'GROWTH_REPORT');
          const growthDone = isDone(jobs, 'GROWTH_REPORT');
          const growthRunning = isRunning(jobs, 'GROWTH_REPORT');
          const growthFailed = latestFailure(jobs, 'GROWTH_REPORT');
          const analyticsDone = isDone(jobs, 'ANALYTICS');
          const growthResult = growthDone
            ? (growthJob?.result as {
                summary?: string;
                nextTopics?: Array<{ topic: string; rationale?: string; opportunityScore?: number }>;
                optimizationActions?: Array<{ action: string; expectedImpact?: string }>;
              } | undefined)
            : undefined;
          const growthTopics = growthResult?.nextTopics ?? [];
          const locked = !analyticsDone || !channel;
          return (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-700">Growth ideas</span>
                <button
                  onClick={() => enqueue.mutate({ type: 'GROWTH_REPORT' })}
                  disabled={busy || locked}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {growthDone ? <RefreshCw className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  {growthDone ? 'Re-run' : 'Run'}
                </button>
              </div>
              {!analyticsDone && !growthDone && (
                <p className="text-gray-400 text-[10px]">Run Channel report first to unlock</p>
              )}
              {growthRunning && (
                <span className="flex items-center gap-1 text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Running…</span>
              )}
              {growthFailed && !growthRunning && (
                <p className="text-red-500 text-[10px]">{(growthFailed as { error?: string }).error ?? 'Last run failed — try again.'}</p>
              )}
              {growthResult && !growthRunning && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-2.5 space-y-2">
                  {growthResult.summary && (
                    <p className="text-gray-600 leading-snug">{growthResult.summary}</p>
                  )}
                  {growthTopics.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1">Next Video Topics</p>
                      <ul className="space-y-1.5 text-gray-600">
                        {growthTopics.map((t, i) => (
                          <li key={i} className="leading-snug">
                            <span className="font-medium">{t.topic}</span>
                            {t.opportunityScore != null && (
                              <span className="ml-1 text-[10px] text-green-600 font-semibold">{t.opportunityScore}/100</span>
                            )}
                            {t.rationale && <span className="text-gray-400 block text-[10px]">{t.rationale}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {growthResult.optimizationActions && growthResult.optimizationActions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1">Optimisations</p>
                      <ul className="space-y-0.5 text-gray-600">
                        {growthResult.optimizationActions.map((a, i) => (
                          <li key={i} className="leading-snug">· {a.action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Production settings */}
      <div className="mt-4 border-t border-gray-100 pt-3 space-y-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Production settings</p>

        <div className="space-y-2">
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-gray-700 shrink-0">Platform</span>
            <select
              value={platform}
              onChange={(e) => choosePlatform(e.target.value as (typeof PLATFORMS)[number])}
              aria-label="Target platform"
              className="border border-gray-200 bg-white rounded-full px-3 py-1.5 text-xs font-medium text-gray-700"
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-gray-700 shrink-0">Output format</span>
            <select
              value={preset}
              onChange={(e) => choosePreset(e.target.value as (typeof PRESETS)[number]['value'])}
              aria-label="Output format"
              className="border border-gray-200 bg-white rounded-full px-3 py-1.5 text-xs font-medium text-gray-700"
            >
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={refreshMedia}
              onChange={(e) => setRefreshMedia(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Regenerate media on next render</span>
          </label>
          <p className="text-[11px] text-gray-500 pl-5">Ignores cached voice/music/images when rendering.</p>
        </div>

        {/* Compliance status */}
        <div className="flex items-center gap-2 text-xs pt-1">
          {complianceDone && complianceResult ? (
            complianceResult.passed ? (
              <span className="flex items-center gap-1.5 text-green-700">
                <CheckCircle className="w-3.5 h-3.5" />
                Compliance passed · score {complianceResult.score ?? '?'}/100
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                Compliance failed · score {complianceResult.score ?? '?'}/100
              </span>
            )
          ) : (
            <span className="flex items-center gap-1.5 text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              Runs automatically before any media generation
            </span>
          )}
        </div>

        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 shrink-0" />
          Compliance-gated · publishing always needs your approval
        </p>
      </div>
    </>
  );

  const suggestionDetail = (() => {
    const growthJob = latest(jobs, 'GROWTH_REPORT');
    const growthTopics = (growthJob?.status === 'COMPLETED'
      ? (growthJob.result as { nextTopics?: Array<{ topic: string }> } | undefined)?.nextTopics
      : undefined) ?? [];

    // AI recommendations from TREND_ANALYSIS + GROWTH_REPORT
    const trendRecs = (analyseJob?.status === 'COMPLETED'
      ? (analyseJob.result as { recommendations?: string[] } | undefined)?.recommendations
      : undefined) ?? [];
    const growthActions = (growthJob?.status === 'COMPLETED'
      ? (growthJob.result as { optimizationActions?: Array<{ priority: string; action: string }> } | undefined)?.optimizationActions
      : undefined) ?? [];
    const hasAiRecs = trendRecs.length > 0 || growthActions.length > 0;

    return (
      <div className="space-y-3">
        {topic && (
          <div className="flex items-center justify-between gap-2 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="w-4 h-4 text-brand-600 shrink-0" />
              <p className="text-xs font-semibold text-brand-800 truncate">{topic}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setTopic(''); localStorage.removeItem(`cf_topic_${projectId}`); }}
                className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded"
              >
                ✕ Clear
              </button>
              <button
                onClick={() => setExpanded('script')}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-full px-3 py-1.5 transition-colors"
              >
                Write Script →
              </button>
            </div>
          </div>
        )}
        {trends.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {trends.map((t, i) => (
              <button
                key={i}
                onClick={() => setPendingTopic((p) => p === t.topic ? '' : t.topic)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  (pendingTopic === t.topic || (topic === t.topic && !pendingTopic)) ? 'bg-brand-600 text-white border-brand-600' : 'border-brand-200 text-brand-700 hover:bg-brand-50'
                }`}
              >
                {t.topic}
              </button>
            ))}
          </div>
        )}
        {growthTopics.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">From growth analysis</p>
            <div className="flex flex-wrap gap-1.5">
              {growthTopics.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setPendingTopic((p) => p === g.topic ? '' : g.topic)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    (pendingTopic === g.topic || (topic === g.topic && !pendingTopic)) ? 'bg-brand-600 text-white border-brand-600' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {g.topic}
                </button>
              ))}
            </div>
          </>
        )}
        {pendingTopic && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-brand-600 font-semibold uppercase tracking-wide mb-0.5">Selected topic</p>
              <p className="text-xs font-medium text-brand-900 truncate">{pendingTopic}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setPendingTopic('')}
                className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded"
              >
                ✕
              </button>
              <button
                onClick={() => { chooseTopic(pendingTopic); setPendingTopic(''); setExpanded('script'); }}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-full px-3 py-1.5 transition-colors"
              >
                Use this topic →
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customTopic.trim()) {
                chooseTopic(customTopic.trim());
                setPendingTopic('');
                setCustomTopic('');
              }
            }}
            placeholder="…or write your own topic"
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={() => {
              if (!customTopic.trim()) return;
              chooseTopic(customTopic.trim());
              setPendingTopic('');
              setCustomTopic('');
              setExpanded('script');
            }}
            disabled={!customTopic.trim()}
            className="px-3 py-2 text-xs font-semibold bg-brand-600 text-white rounded-xl disabled:opacity-40"
          >
            Use →
          </button>
        </div>

        {hasAiRecs && (
          <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">AI recommendations</p>
            {trendRecs.slice(0, 3).map((rec, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-700">
                <span className="text-brand-500 font-bold shrink-0">•</span>
                <span>{rec}</span>
              </div>
            ))}
            {growthActions.slice(0, 2).map((a, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-700">
                <span className="text-indigo-500 font-bold shrink-0 uppercase text-[10px] mt-0.5">{a.priority}</span>
                <span>{a.action}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Batch project creation ── */}
        {(trends.length > 0 || growthTopics.length > 0) && (() => {
          const allTopics = [
            ...trends.map((t) => t.topic),
            ...growthTopics.map((g) => g.topic),
          ].filter((t, i, arr) => arr.indexOf(t) === i); // dedupe

          const toggleTopic = (t: string) => {
            setBatchChecked((prev) => {
              const next = new Set(prev);
              next.has(t) ? next.delete(t) : next.add(t);
              return next;
            });
          };

          const checkedTopics = allTopics.filter((t) => batchChecked.has(t));
          const allSelected = allTopics.every((t) => batchChecked.has(t));
          const hasResults = batchResults.size > 0;

          return (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <button
                onClick={() => { setBatchOpen((o) => !o); if (!batchOpen) { setBatchResults(new Map()); } }}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create separate projects per topic
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${batchOpen ? 'rotate-180' : ''}`} />
              </button>

              {batchOpen && (
                <div className="mt-3 space-y-2.5">
                  {/* Select-all / clear row */}
                  {!hasResults && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setBatchChecked(allSelected ? new Set() : new Set(allTopics))}
                        className="text-[10px] text-gray-500 hover:text-gray-700 underline"
                      >
                        {allSelected ? 'Clear all' : 'Select all'}
                      </button>
                      <span className="text-[10px] text-gray-400">{batchChecked.size} selected</span>
                    </div>
                  )}

                  {/* Topic checklist */}
                  {!hasResults && (
                    <div className="flex flex-wrap gap-1.5">
                      {allTopics.map((t) => (
                        <button
                          key={t}
                          onClick={() => toggleTopic(t)}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                            batchChecked.has(t)
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50'
                          }`}
                        >
                          {batchChecked.has(t) && <Check className="w-2.5 h-2.5 shrink-0" />}
                          {t}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create button */}
                  {!hasResults && (
                    <button
                      onClick={() => handleBatchCreate(checkedTopics)}
                      disabled={checkedTopics.length === 0 || batchCreating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors"
                    >
                      {batchCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {batchCreating
                        ? 'Creating projects…'
                        : checkedTopics.length === 0
                        ? 'Select topics above'
                        : `Create ${checkedTopics.length} Project${checkedTopics.length > 1 ? 's' : ''}`}
                    </button>
                  )}

                  {/* Per-topic results */}
                  {hasResults && (
                    <div className="space-y-1.5">
                      {[...batchResults.entries()].map(([t, r]) => (
                        <div key={t} className="flex items-center gap-2 text-xs">
                          {r.status === 'creating' && <Loader2 className="w-3 h-3 animate-spin text-brand-500 shrink-0" />}
                          {r.status === 'done' && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                          {r.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                          <span className="flex-1 truncate text-gray-700">{t}</span>
                          {r.status === 'done' && r.projectId && (
                            <Link
                              href={`/projects/${r.projectId}`}
                              className="shrink-0 flex items-center gap-0.5 text-brand-600 hover:underline font-medium"
                            >
                              Open <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                          {r.status === 'error' && (
                            <span className="shrink-0 text-red-500">{r.error}</span>
                          )}
                        </div>
                      ))}
                      {!batchCreating && (
                        <button
                          onClick={() => { setBatchResults(new Map()); setBatchChecked(new Set()); }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 underline mt-1"
                        >
                          Start over
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  })();

  const scriptDetail = (() => {
    // Publishing content from METADATA + SEO_OPTIMIZATION
    const metaJob = latest(jobs, 'METADATA');
    const metaResult = metaJob?.status === 'COMPLETED'
      ? (metaJob.result as { metadata?: { title?: string; description?: string; tags?: string[] } } | undefined)?.metadata
      : undefined;
    const seoJob = latest(jobs, 'SEO_OPTIMIZATION');
    const seoResult = seoJob?.status === 'COMPLETED'
      ? (seoJob.result as { title?: string; description?: string; tags?: string[] } | undefined)
      : undefined;

    // Chapters from script sections
    const chapters = script
      ? (() => {
          let cumSecs = 0;
          return script.sections.map((s) => {
            const mm = Math.floor(cumSecs / 60).toString().padStart(2, '0');
            const ss = (cumSecs % 60).toString().padStart(2, '0');
            const line = `${mm}:${ss} ${s.heading}`;
            cumSecs += s.durationEstimateSecs ?? 30;
            return line;
          });
        })()
      : [];

    const hasPublishing = !!(metaResult || seoResult);

    return (
      <div className="space-y-3">
        <div>
          <label htmlFor="studio-script-topic" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Script topic</label>
          <input
            id="studio-script-topic"
            value={effectiveTopic}
            onChange={(e) => chooseTopic(e.target.value)}
            placeholder="Pick a topic in Suggestion or type one here"
            aria-label="Script topic"
            className="mt-1 w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-[11px] text-gray-500 mt-1">Selected suggestions appear here automatically — edit freely before running.</p>
        </div>
        {/* Content language picker */}
        {(() => {
          const activeLang = CONTENT_LANGS.find(l => l.code === targetLang) ?? CONTENT_LANGS[0]!;
          const q = langSearch.trim().toLowerCase();
          const filtered = q
            ? CONTENT_LANGS.filter(l =>
                l.name.toLowerCase().includes(q) ||
                l.nativeName.toLowerCase().includes(q) ||
                l.code.toLowerCase().includes(q)
              )
            : CONTENT_LANGS;
          return (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Content Language</label>
              <p className="text-[11px] text-gray-500 mt-0.5 mb-2">Script, voice-over, and captions will be generated in this language.</p>

              {/* Trigger button — shows selected language */}
              <button
                type="button"
                onClick={() => { setLangPickerOpen(o => !o); setLangSearch(''); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-sm"
                style={{
                  border: langPickerOpen ? '1.5px solid #8b5cf6' : '1px solid #e5e7eb',
                  background: langPickerOpen ? '#faf5ff' : '#fff',
                  boxShadow: langPickerOpen ? '0 0 0 3px rgba(139,92,246,.12)' : 'none',
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{activeLang.flag}</span>
                <span style={{ flex: '1 1 auto', fontWeight: 600, color: '#374151', textAlign: 'left' }}>{activeLang.name}</span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{activeLang.nativeName}</span>
                <ChevronDown
                  className="w-4 h-4 shrink-0"
                  style={{ color: '#9ca3af', transform: langPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
                />
              </button>

              {/* Expanded picker panel */}
              {langPickerOpen && (
                <div
                  className="mt-1.5 rounded-xl border overflow-hidden"
                  style={{ border: '1px solid #e5e7eb', boxShadow: '0 4px 16px -4px rgba(0,0,0,.12)' }}
                >
                  {/* Search input */}
                  <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #f3f4f6', position: 'relative' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                      style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M10 10L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search language…"
                      value={langSearch}
                      onChange={e => setLangSearch(e.target.value)}
                      className="w-full text-sm rounded-lg"
                      style={{
                        paddingLeft: '30px', paddingRight: langSearch ? '28px' : '10px',
                        paddingTop: '7px', paddingBottom: '7px',
                        border: '1px solid #e5e7eb', outline: 'none',
                        background: '#f9fafb', color: '#374151',
                        fontFamily: 'inherit',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9fafb'; }}
                    />
                    {langSearch && (
                      <button
                        type="button"
                        onClick={() => setLangSearch('')}
                        style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', display: 'flex' }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Language list */}
                  <div style={{ maxHeight: '232px', overflowY: 'auto', padding: '6px' }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                        No language found for &ldquo;{langSearch}&rdquo;
                      </div>
                    ) : filtered.map((l, idx) => {
                      const isActive = l.code === targetLang;
                      // "Popular" divider before less-common languages (after index 12)
                      const showDivider = !q && idx === 13;
                      return (
                        <div key={l.code}>
                          {showDivider && (
                            <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#9ca3af', letterSpacing: '.05em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
                              More languages
                            </p>
                          )}
                          {idx === 0 && !q && (
                            <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#9ca3af', letterSpacing: '.05em', textTransform: 'uppercase', padding: '2px 8px 4px' }}>
                              Popular
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => { setLang(l.code); setLangPickerOpen(false); setLangSearch(''); }}
                            className="flex items-center w-full border-none cursor-pointer"
                            style={{
                              gap: '10px', padding: '8px 10px', borderRadius: '10px',
                              background: isActive ? '#ede9fe' : 'transparent',
                              color: isActive ? '#6d28d9' : '#374151',
                              fontFamily: 'inherit', textAlign: 'left',
                              transition: 'background 100ms ease',
                            }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f5f3ff'; }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{l.flag}</span>
                            <span style={{ flex: '1 1 auto', fontSize: '13px', fontWeight: isActive ? 700 : 500 }}>{l.name}</span>
                            <span style={{ fontSize: '11.5px', color: isActive ? '#a78bfa' : '#9ca3af', flexShrink: 0 }}>{l.nativeName}</span>
                            {isActive && (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                                <path d="M2.5 7L6 10.5L11.5 4" stroke="#6d28d9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {script ? (
          scriptDraft ? (
            <div className="space-y-3">
              <input
                value={scriptDraft.title}
                onChange={(e) => setScriptDraft({ ...scriptDraft, title: e.target.value })}
                aria-label="Script title"
                className="w-full text-sm font-semibold px-3 py-2 border border-gray-200 rounded-xl"
              />
              <textarea
                value={scriptDraft.hook}
                onChange={(e) => setScriptDraft({ ...scriptDraft, hook: e.target.value })}
                aria-label="Hook"
                rows={2}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl"
              />
              {scriptDraft.sections.map((s, i) => (
                <div key={i}>
                  <input
                    value={s.heading}
                    onChange={(e) => setScriptDraft({ ...scriptDraft, sections: scriptDraft.sections.map((x, j) => j === i ? { ...x, heading: e.target.value } : x) })}
                    aria-label={`Section ${i + 1} heading`}
                    className="w-full text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-t-xl"
                  />
                  <textarea
                    value={s.content}
                    onChange={(e) => setScriptDraft({ ...scriptDraft, sections: scriptDraft.sections.map((x, j) => j === i ? { ...x, content: e.target.value } : x) })}
                    aria-label={`Section ${i + 1} content`}
                    rows={4}
                    className="w-full text-sm px-3 py-2 border border-t-0 border-gray-200 rounded-b-xl"
                  />
                </div>
              ))}
              <textarea
                value={scriptDraft.callToAction}
                onChange={(e) => setScriptDraft({ ...scriptDraft, callToAction: e.target.value })}
                aria-label="Call to action"
                rows={2}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveScript.mutate(scriptDraft)}
                  disabled={saveScript.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-full disabled:opacity-50"
                >
                  {saveScript.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save edits
                </button>
                <button onClick={() => setScriptDraft(null)} className="px-4 py-2 text-xs text-gray-500">Cancel</button>
              </div>
              <p className="text-xs text-gray-500">Saved edits flow into voice, subtitles, and video automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{script.totalWordCount ?? '?'} words · {script.sections.length} sections</p>
                <button
                  onClick={() => setScriptDraft(JSON.parse(JSON.stringify(script)) as ScriptResult)}
                  className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  <Pencil className="w-3 h-3" /> Edit script
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-800">{script.title}</p>
              <p className="text-sm text-gray-600 italic">&ldquo;{script.hook}&rdquo;</p>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {script.sections.map((s, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-gray-500 uppercase">{s.heading}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : <p className="text-sm text-gray-500">Pick a topic, then run — includes fact-check and the compliance gate.</p>}

        {/* Publishing content section */}
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Publishing content</p>
          {hasPublishing ? (
            <div className="space-y-3">
              {(metaResult?.title ?? seoResult?.title) && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">SEO Title</p>
                  <p className="text-sm text-gray-800 font-medium">{metaResult?.title ?? seoResult?.title}</p>
                </div>
              )}
              {(metaResult?.description ?? seoResult?.description) && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Description</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {((metaResult?.description ?? seoResult?.description) ?? '').slice(0, 200)}
                    {((metaResult?.description ?? seoResult?.description) ?? '').length > 200 ? '…' : ''}
                  </p>
                </div>
              )}
              {((metaResult?.tags ?? seoResult?.tags) ?? []).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {((metaResult?.tags ?? seoResult?.tags) ?? []).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-brand-50 text-brand-700 text-xs rounded-full">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {chapters.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Chapters</p>
                  <div className="font-mono text-[11px] text-gray-600 space-y-0.5">
                    {chapters.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Generated during the Video stage.</p>
          )}
        </div>

        {/* Creative Brief — optional pre-script user preferences */}
        <div className="border-t border-gray-100 pt-4">
          <button
            className="w-full flex items-center justify-between text-left group"
            onClick={() => setPrefsOpen(!prefsOpen)}
          >
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Creative Brief</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {hasPrefs ? 'Preferences set — AI will follow these' : 'Optional: guide the AI before running'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasPrefs && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">Active</span>}
              {prefsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {prefsOpen && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] font-medium text-gray-600 mb-1">What do you think about this title?</p>
                <textarea
                  rows={2}
                  placeholder="e.g. Make it more attention-grabbing, focus on the surprise factor…"
                  value={creativePrefs.titleFeedback}
                  onChange={e => savePrefs({ ...creativePrefs, titleFeedback: e.target.value })}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-600 mb-1.5">Script style</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Educational', 'Storytelling', 'Tutorial', 'Commentary', 'Listicle', 'Review'].map(s => (
                    <button
                      key={s}
                      onClick={() => savePrefs({ ...creativePrefs, scriptStyle: creativePrefs.scriptStyle === s.toLowerCase() ? '' : s.toLowerCase() })}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        creativePrefs.scriptStyle === s.toLowerCase()
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-gray-200 text-gray-600 hover:border-brand-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-600 mb-1.5">Video style</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Talking Head', 'Cinematic', 'Screencast', 'Animated', 'Vlog'].map(s => (
                    <button
                      key={s}
                      onClick={() => savePrefs({ ...creativePrefs, videoStyle: creativePrefs.videoStyle === s.toLowerCase().replace(' ', '-') ? '' : s.toLowerCase().replace(' ', '-') })}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        creativePrefs.videoStyle === s.toLowerCase().replace(' ', '-')
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-gray-200 text-gray-600 hover:border-brand-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-600 mb-1.5">Tone</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Professional', 'Casual', 'Energetic', 'Calm', 'Humorous'].map(s => (
                    <button
                      key={s}
                      onClick={() => savePrefs({ ...creativePrefs, tone: creativePrefs.tone === s.toLowerCase() ? '' : s.toLowerCase() })}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        creativePrefs.tone === s.toLowerCase()
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-gray-200 text-gray-600 hover:border-brand-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-600 mb-1">Target audience</p>
                <input
                  type="text"
                  placeholder="e.g. Tech enthusiasts aged 25-35, beginners, parents…"
                  value={creativePrefs.targetAudience}
                  onChange={e => savePrefs({ ...creativePrefs, targetAudience: e.target.value })}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>

              <div>
                <p className="text-[11px] font-medium text-gray-600 mb-1">Any other notes for the AI?</p>
                <textarea
                  rows={2}
                  placeholder="e.g. Include real examples, avoid technical jargon, end with a strong hook for part 2…"
                  value={creativePrefs.notes}
                  onChange={e => savePrefs({ ...creativePrefs, notes: e.target.value })}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>

              {hasPrefs && (
                <button
                  onClick={() => savePrefs({ scriptStyle: '', videoStyle: '', tone: '', targetAudience: '', titleFeedback: '', notes: '' })}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear preferences
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  })();

  const voiceDetail = (
    <div className="space-y-3">
      {/* Top-level mode selector: AI Voice / Your Voice */}
      <div className="grid grid-cols-2 gap-2">
        {([
          ['ai', Sparkles, 'AI Voice', 'Let AI generate narration from your script'],
          ['record', Mic, 'Your Voice', 'Record yourself or clone your voice style'],
        ] as const).map(([mode, Icon, label, desc]) => (
          <button
            key={mode}
            onClick={() => setVoiceMode(mode)}
            className={`flex flex-col items-start gap-1.5 p-3 rounded-2xl border-2 transition-all text-left ${
              voiceMode === mode
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
            }`}
          >
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${voiceMode === mode ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
              <Icon className="w-4 h-4" />
            </span>
            <span className={`text-xs font-semibold ${voiceMode === mode ? 'text-brand-800' : 'text-gray-700'}`}>{label}</span>
            <span className="text-[10px] text-gray-500 leading-snug">{desc}</span>
          </button>
        ))}
      </div>

      {/* AI Voice mode */}
      {voiceMode === 'ai' && (
        <div className="space-y-3">
          {/* AI sub-tab switcher */}
          <div className="flex gap-0.5 p-1 bg-gray-100 rounded-xl">
            {([
              ['narration', '🎙️', 'AI Narration'],
              ['character', '🎭', 'Character Cast'],
              ['song',      '🎵', 'Audio Song'],
            ] as const).map(([tab, emoji, label]) => (
              <button
                key={tab}
                onClick={() => setAiVoiceTab(tab)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold flex-1 justify-center transition-all ${
                  aiVoiceTab === tab
                    ? 'bg-white text-brand-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{emoji}</span>{label}
              </button>
            ))}
          </div>

          {/* ── AI Narration tab ── */}
          {aiVoiceTab === 'narration' && (
            <div className="space-y-3">
              {voiceResult?.versionId && (
                <div className="flex items-center gap-2">
                  <MediaPlayer versionId={voiceResult.versionId} kind="audio" />
                  <button
                    onClick={async () => {
                      const res = await api.media.versionFile(voiceResult.versionId!);
                      await downloadBlob(res, 'voice-narration');
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 shrink-0"
                    title="Download narration"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              )}
              {voiceResult?.notes && <p className="text-xs text-amber-600">{voiceResult.notes}</p>}

              {/* Voice Timeline — section-by-section word-count bars */}
              {voiceResult?.versionId && script?.sections?.length ? (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Voice Timeline</p>
                  <div className="space-y-1">
                    {(() => {
                      const SEG_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#9333ea'];
                      const totalWords = script.sections.reduce((sum, s) => sum + s.content.split(/\s+/).length, 0) || 1;
                      return script.sections.map((sec, i) => {
                        const words = sec.content.split(/\s+/).length;
                        const pct = Math.max(6, Math.round((words / totalWords) * 100));
                        const color = SEG_COLORS[i % SEG_COLORS.length]!;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <p className="w-16 shrink-0 text-right text-[9px] text-gray-400 truncate">{sec.heading.slice(0, 10)}</p>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500 opacity-75" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                            <p className="w-6 text-[9px] text-gray-400 tabular-nums shrink-0">{words}w</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <p className="text-[9px] text-gray-300">Bar width = word count per section</p>
                </div>
              ) : null}

              {/* Voice style selector */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Voice Style</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {VOICE_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setVoiceStyle(s.id)}
                      title={s.desc}
                      className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border text-center transition-all ${
                        voiceStyle === s.id
                          ? 'border-brand-500 bg-brand-50 shadow-sm'
                          : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className={`text-[10px] font-semibold ${voiceStyle === s.id ? 'text-brand-700' : 'text-gray-600'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">{VOICE_STYLES.find((s) => s.id === voiceStyle)?.desc}</p>
              </div>

              <button
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: {
                    scope: 'VOICE',
                    ...prefsPayload,
                    regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'],
                    voiceProfile: VOICE_STYLES.find((s) => s.id === voiceStyle)?.voiceProfile,
                    characterVoices: false,
                  },
                })}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {voiceResult?.versionId ? 'Regenerate AI Narration' : 'Generate AI Narration'}
              </button>

              {/* ElevenLabs optional collapsible */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setElevenLabsOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                    ElevenLabs — optional premium voices (your own API key)
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${elevenLabsOpen ? 'rotate-180' : ''}`} />
                </button>
                {elevenLabsOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-100">
                    <p className="text-[11px] text-gray-500">Your key unlocks ElevenLabs premium voices. Leave blank to use free built-in voices (OpenAI TTS · Kokoro · Piper).</p>
                    {!voiceKeySaved ? (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={voiceKey}
                          onChange={(e) => setVoiceKey(e.target.value)}
                          placeholder="sk-... ElevenLabs API key"
                          aria-label="ElevenLabs API key"
                          className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                        <button
                          onClick={() => saveVoiceKey.mutate(voiceKey)}
                          disabled={!voiceKey.trim() || saveVoiceKey.isPending}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-brand-600 text-white rounded-xl disabled:opacity-40"
                        >
                          {saveVoiceKey.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        ElevenLabs key saved — your next generation will use it.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Character Cast tab ── */}
          {aiVoiceTab === 'character' && (
            <div className="space-y-3">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                AI detects characters in your script and assigns each a distinct voice — different gender, tone, energy, and pacing. Generates character dialogue that sounds like a real conversation.
              </p>

              {/* Character map (populated after VOICE_SPEC runs) */}
              {detectedCharacters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Detected Characters ({detectedCharacters.length})
                  </p>
                  <div className="space-y-1.5">
                    {detectedCharacters.map((char, i) => {
                      const color = CHARACTER_COLORS[i % CHARACTER_COLORS.length]!;
                      return (
                        <div key={char.name} className={`${color.bg} ${color.border} border rounded-xl px-3 py-2.5 flex items-start gap-2`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color.chip}`}>
                            <span className="text-xs font-bold">{char.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${color.text}`}>{char.name}</p>
                            {char.description && (
                              <p className="text-[10px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{char.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {char.gender && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color.chip}`}>{char.gender}</span>}
                              {char.style && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color.chip}`}>{char.style}</span>}
                              {char.tone && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color.chip}`}>{char.tone}</span>}
                              {char.pace && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color.chip}`}>{char.pace} pace</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : specJob?.status === 'COMPLETED' ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[11px] text-amber-700">No named characters detected in this script. AI will generate with context-aware voice variation instead.</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[11px] text-gray-500">Generate once to detect characters — character cards appear here after the first run.</p>
                </div>
              )}

              {voiceResult?.versionId && (
                <div className="flex items-center gap-2">
                  <MediaPlayer versionId={voiceResult.versionId} kind="audio" />
                  <button
                    onClick={async () => {
                      const res = await api.media.versionFile(voiceResult.versionId!);
                      await downloadBlob(res, 'voice-character-cast');
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 shrink-0"
                    title="Download narration"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              )}

              <button
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: {
                    scope: 'VOICE',
                    ...prefsPayload,
                    regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'],
                    characterVoices: true,
                  },
                })}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {specJob?.status === 'COMPLETED' ? 'Regenerate Character Cast' : 'Generate Character Cast'}
              </button>
            </div>
          )}

          {/* ── Audio Song tab ── */}
          {aiVoiceTab === 'song' && (
            <div className="space-y-3">
              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMixMode('smart')}
                  className={`flex flex-col items-start gap-0.5 p-3 rounded-xl border text-left transition-all ${
                    mixMode === 'smart'
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">🎙️</span>
                  <span className={`text-[10px] font-semibold ${mixMode === 'smart' ? 'text-emerald-700' : 'text-gray-700'}`}>Smart Mix</span>
                  <span className="text-[9px] text-gray-400">Narration + music · Free</span>
                </button>
                <button
                  onClick={() => setMixMode('song')}
                  className={`flex flex-col items-start gap-0.5 p-3 rounded-xl border text-left transition-all ${
                    mixMode === 'song'
                      ? 'border-violet-500 bg-violet-50 shadow-sm'
                      : 'border-gray-200 hover:border-violet-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">🎤</span>
                  <span className={`text-[10px] font-semibold ${mixMode === 'song' ? 'text-violet-700' : 'text-gray-700'}`}>AI Vocals</span>
                  <span className="text-[9px] text-gray-400">Suno · Requires API key</span>
                </button>
              </div>

              {/* Smart Mix mode */}
              {mixMode === 'smart' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Generates AI narration from your script and adds a matching royalty-free background music track. Mixed with FFmpeg — works without any external API key.
                  </p>

                  {/* Music style for the background track */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Background Music Style</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SONG_STYLES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSongStyle(s.id)}
                          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border text-center transition-all ${
                            songStyle === s.id
                              ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                              : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-base">{s.icon}</span>
                          <span className={`text-[10px] font-semibold ${songStyle === s.id ? 'text-emerald-700' : 'text-gray-600'}`}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mix result player */}
                  {mixResult?.versionId && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-emerald-700">Mix ready · narration + {songStyle} background</p>
                      <div className="flex items-center gap-2">
                        <MediaPlayer versionId={mixResult.versionId} kind="audio" />
                        <button
                          onClick={async () => {
                            const res = await api.media.versionFile(mixResult.versionId!);
                            await downloadBlob(res, 'narration-mix');
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-full px-3 py-1.5 hover:bg-emerald-50 shrink-0"
                          title="Download mix"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => enqueue.mutate({
                      type: 'FULL_PRODUCTION',
                      payload: {
                        scope: 'SMART_MIX',
                        ...prefsPayload,
                        regenerate: ['VOICE_GENERATE', 'MUSIC_GENERATE', 'AUDIO_MIX'],
                        genre: songStyle,
                      },
                    })}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
                    {mixResult?.versionId ? 'Regenerate Smart Mix' : 'Generate Smart Mix (Free)'}
                  </button>
                  <p className="text-[10px] text-gray-400">Free · narration from script + in-app music synthesis · FFmpeg-mixed · no API key needed</p>
                </div>
              )}

              {/* AI Vocals (Suno) mode */}
              {mixMode === 'song' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    AI generates a fully sung vocal track from your script using Suno. Requires a Suno API key (set SUNO_API_KEY in settings).
                  </p>

                  {/* Song style */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Song Style</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SONG_STYLES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSongStyle(s.id)}
                          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border text-center transition-all ${
                            songStyle === s.id
                              ? 'border-brand-500 bg-brand-50 shadow-sm'
                              : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-base">{s.icon}</span>
                          <span className={`text-[10px] font-semibold ${songStyle === s.id ? 'text-brand-700' : 'text-gray-600'}`}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vocal type */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Vocal Type</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {VOCAL_TYPES.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setVocalType(v.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-left transition-all ${
                            vocalType === v.id
                              ? 'border-brand-500 bg-brand-50 shadow-sm'
                              : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-sm">{v.icon}</span>
                          <span className={`text-[10px] font-semibold ${vocalType === v.id ? 'text-brand-700' : 'text-gray-600'}`}>{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional lyrics override */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Lyrics (optional)</p>
                    <textarea
                      value={songLyrics}
                      onChange={(e) => setSongLyrics(e.target.value)}
                      placeholder={"Leave blank — AI generates lyrics from your script\n\nOr paste your own:\n[Verse 1]\nYour lyrics here...\n\n[Chorus]\n..."}
                      rows={5}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
                    />
                    <p className="text-[10px] text-gray-400">Leave blank for AI-generated lyrics. Add [Verse], [Chorus], [Bridge] tags for structure.</p>
                  </div>

                  {/* Song result player */}
                  {songResult?.versionId && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-green-700">
                        Song ready · {songResult.songStyle ?? songStyle} · {songResult.vocalType ?? vocalType}
                      </p>
                      <div className="flex items-center gap-2">
                        <MediaPlayer versionId={songResult.versionId} kind="audio" />
                        <button
                          onClick={async () => {
                            const res = await api.media.versionFile(songResult.versionId!);
                            await downloadBlob(res, 'audio-song');
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 shrink-0"
                          title="Download song"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                      {songResult.notes && <p className="text-[10px] text-gray-400">{songResult.notes}</p>}
                    </div>
                  )}

                  <button
                    onClick={() => enqueue.mutate({
                      type: 'FULL_PRODUCTION',
                      payload: {
                        scope: 'SONG',
                        ...prefsPayload,
                        regenerate: ['SONG_GENERATE'],
                        songStyle,
                        vocalType,
                        lyrics: songLyrics.trim() || undefined,
                      },
                    })}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-violet-600 text-white rounded-full hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
                    {songResult?.versionId ? 'Regenerate AI Song' : 'Generate AI Song (Suno)'}
                  </button>
                  <p className="text-[10px] text-gray-400">Requires SUNO_API_KEY · AI-sung vocal track with melody</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Your Voice mode */}
      {voiceMode === 'record' && (
        <div className="space-y-3">
          {/* Sub-mode pills */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              ['full',      '📖', 'Record Full Script'],
              ['character', '🎭', 'Per Character'],
              ['ref',       '🎤', 'Voice Reference'],
            ] as const).map(([sub, emoji, label]) => (
              <button
                key={sub}
                onClick={() => setYourVoiceMode(sub)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  yourVoiceMode === sub
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{emoji}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Record Full Script */}
          {yourVoiceMode === 'full' && (
            <div className="space-y-3">
              <p className="text-[11px] text-gray-500">
                Record yourself reading the full script. Your voice becomes the narration track.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-800 text-white rounded-full animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop Recording
                  </button>
                )}
                {recordedBlob && !recording && (
                  <button
                    onClick={previewRecording}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full ${
                      previewPlaying
                        ? 'bg-gray-800 text-white'
                        : 'text-brand-700 border border-brand-200 hover:bg-brand-50'
                    }`}
                  >
                    {previewPlaying
                      ? <><Square className="w-3.5 h-3.5 fill-current" />Stop</>
                      : <><Play className="w-3.5 h-3.5" />Preview</>}
                  </button>
                )}
              </div>
              {recordingError && !uploadRecording.isError && <p className="text-xs text-red-500">{recordingError}</p>}
              {recordedBlob && !recording && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500">
                    Recording ready ({(recordedBlob.size / 1024).toFixed(0)} KB).
                  </p>
                  <button
                    onClick={() => uploadRecording.mutate(recordedBlob)}
                    disabled={uploadRecording.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-brand-600 text-white rounded-full disabled:opacity-40"
                  >
                    {uploadRecording.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Use as Narration
                  </button>
                  {uploadRecording.isError && (
                    <p className="text-xs text-red-500">
                      {uploadRecording.error instanceof Error
                        ? uploadRecording.error.message.includes('Project not found')
                          ? 'Upload failed — project not found. Try refreshing the page and recording again.'
                          : uploadRecording.error.message
                        : 'Upload failed. Please try again.'}
                    </p>
                  )}
                  {uploadRecording.isSuccess && uploadRecording.data?.data?.versionId && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-green-700">Your narration is ready</p>
                      <div className="flex items-center gap-2">
                        <MediaPlayer versionId={uploadRecording.data.data.versionId} kind="audio" />
                        <button
                          onClick={async () => {
                            const res = await api.media.versionFile(uploadRecording.data!.data!.versionId);
                            await downloadBlob(res, 'my-narration');
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 shrink-0"
                          title="Download narration"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Per Character recording */}
          {yourVoiceMode === 'character' && (
            <div className="space-y-3">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Record yourself speaking as each character. AI uses your voice for that character&apos;s dialogue throughout the narration.
              </p>
              {detectedCharacters.length > 0 ? (
                <div className="space-y-2">
                  {detectedCharacters.map((char, i) => {
                    const color = CHARACTER_COLORS[i % CHARACTER_COLORS.length]!;
                    return (
                      <div key={char.name} className={`${color.bg} ${color.border} border rounded-xl p-3 space-y-2`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color.chip}`}>
                            <span className="text-xs font-bold">{char.name[0]}</span>
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${color.text}`}>{char.name}</p>
                            {char.description && <p className="text-[10px] text-gray-500">{char.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-full hover:bg-red-600"
                            onClick={() => { void startRecording(); }}
                          >
                            <Mic className="w-3 h-3" />
                            Record as {char.name}
                          </button>
                          <p className="text-[10px] text-gray-400">Read {char.name}&apos;s lines in your natural voice</p>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-gray-400">
                    After recording each character, use &ldquo;Record Full Script&rdquo; tab to record the full narration with all characters.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800">Run Character Cast first</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Switch to AI Voice &rarr; Character Cast and generate once. Character cards appear here after AI detects the characters in your script.
                  </p>
                  <button
                    onClick={() => { setVoiceMode('ai'); setAiVoiceTab('character'); }}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
                  >
                    Go to Character Cast &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Voice Reference */}
          {yourVoiceMode === 'ref' && (
            <div className="space-y-3">
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-violet-800">How it works</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  {cloneAvailability?.provider === 'in-app'
                    ? 'Record a 10–30 s voice sample. The AI analyses your pitch and style, generates the full narration, then pitch-matches it to your voice — no external API needed.'
                    : 'Record or import a short voice sample (5–30 s). AI clones your voice style and generates the full narration with natural emotion and pacing.'}
                </p>
              </div>

              {/* Step 1: Record sample */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">1. Voice sample</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {!refRecording ? (
                    <button
                      onClick={startRefRecording}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Record Sample
                    </button>
                  ) : (
                    <button
                      onClick={stopRefRecording}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-800 text-white rounded-full animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop
                    </button>
                  )}
                  {refBlob && !refRecording && (
                    <button
                      onClick={previewRef}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full ${
                        refPreviewPlaying
                          ? 'bg-gray-800 text-white'
                          : 'text-brand-700 border border-brand-200 hover:bg-brand-50'
                      }`}
                    >
                      {refPreviewPlaying
                        ? <><Square className="w-3.5 h-3.5 fill-current" />Stop</>
                        : <><Play className="w-3.5 h-3.5" />Preview</>}
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-brand-700 hover:underline">
                  <Upload className="w-3.5 h-3.5" />
                  Import audio file instead
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setRefBlob(file); setClonedVoiceId(null); setCloneError(''); }
                    }}
                  />
                </label>
                {refBlob && !refRecording && (
                  <p className="text-[11px] text-gray-500">Sample ready ({(refBlob.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>

              {/* Step 2: Clone & Generate */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">2. Generate in your voice</p>
                {cloneAvailability !== null && !cloneAvailability.available && (
                  <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-relaxed">{cloneAvailability.reason}</p>
                  </div>
                )}
                {clonedVoiceId && !cloneError && (
                  <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {cloneAvailability?.provider === 'in-app' ? 'Voice sample uploaded — narration queued' : 'Voice cloned — narration queued'}
                  </p>
                )}
                {cloneError && (
                  <div className="flex items-start gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-[11px] text-red-700 leading-relaxed">{cloneError}</p>
                      <button
                        onClick={() => {
                          setCloneError('');
                          enqueue.mutate({
                            type: 'FULL_PRODUCTION',
                            payload: {
                              scope: 'VOICE',
                              ...prefsPayload,
                              regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'],
                              voiceProfile: VOICE_STYLES.find((s) => s.id === voiceStyle)?.voiceProfile,
                              lang: targetLang,
                            },
                          });
                        }}
                        className="text-[11px] text-brand-600 underline"
                      >
                        Use AI voice instead
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={cloneAndGenerate}
                  disabled={!refBlob || cloneLoading || busy || cloneAvailability?.available === false}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  {cloneLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {cloneLoading ? 'Generating narration…' : (clonedVoiceId && !cloneError) ? 'Regenerate' : cloneAvailability?.provider === 'in-app' ? 'Match My Voice & Generate' : 'Clone Voice & Generate'}
                </button>
                {!refBlob && (
                  <p className="text-[11px] text-gray-400">Record or import a sample above first</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const musicPromptDisplay = musicPromptOverride ?? musicBrief?.prompt ?? '';

  const musicDetail = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder={`Mood${musicBrief?.mood ? ` (current: ${musicBrief.mood})` : ' — e.g. uplifting'}`}
          aria-label="Music mood"
          className="text-xs px-3 py-2 border border-gray-200 rounded-xl"
        />
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder={`Genre${musicBrief?.genre ? ` (current: ${musicBrief.genre})` : ' — e.g. cinematic'}`}
          aria-label="Music genre"
          className="text-xs px-3 py-2 border border-gray-200 rounded-xl"
        />
      </div>
      {musicResult?.versionId ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MediaPlayer versionId={musicResult.versionId} kind="audio" />
            <button
              onClick={async () => {
                const res = await api.media.versionFile(musicResult.versionId!);
                await downloadBlob(res, 'background-music');
              }}
              className="flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 shrink-0"
              title="Download music"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
          {musicResult.notes && <p className="text-xs text-amber-600">{musicResult.notes}</p>}
        </div>
      ) : <p className="text-xs text-gray-500">Set a mood/genre (or leave blank for AI&rsquo;s pick) and run.</p>}

      {/* AI Music Brief — collapsible, appears once MUSIC_BRIEF has run */}
      {(musicBrief?.prompt || musicPromptOverride !== undefined) && (
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => setBriefOpen((o) => !o)}
            className="flex items-center justify-between w-full group"
          >
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide group-hover:text-brand-600 transition-colors">
              AI Music Brief
              {musicPromptOverride !== undefined && musicPromptOverride !== musicBrief?.prompt && (
                <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full normal-case font-medium">custom</span>
              )}
            </p>
            <div className="flex items-center gap-1 text-gray-400 group-hover:text-brand-600 transition-colors">
              {!briefOpen && musicBrief?.bpm && (
                <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium mr-1">{musicBrief.bpm} BPM</span>
              )}
              {briefOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>
          {!briefOpen && musicBrief?.emotionalArc && (
            <p className="text-[11px] text-gray-400 italic leading-snug mt-1 line-clamp-1">{musicBrief.emotionalArc}</p>
          )}

          {briefOpen && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(musicPromptDisplay)}
                  className="text-[11px] text-gray-400 hover:text-brand-600 px-2 py-0.5 rounded"
                  title="Copy prompt"
                >
                  Copy
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([musicPromptDisplay], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'music-brief.txt'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-brand-600 px-2 py-0.5 rounded"
                  title="Download brief as text"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
              <textarea
                value={musicPromptDisplay}
                onChange={(e) => setMusicPromptOverride(e.target.value)}
                rows={4}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl resize-y leading-relaxed"
                placeholder="Music prompt will appear here after the brief runs…"
              />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Emotional Arc</p>
                <p className="text-[11px] text-gray-600 italic leading-snug">
                  {musicBrief?.emotionalArc ?? <span className="text-gray-400 not-italic">— run Music stage to generate</span>}
                </p>
              </div>
              {musicBrief?.bpm && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">{musicBrief.bpm} BPM</span>
                  {musicBrief.mood && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{musicBrief.mood}</span>}
                  {musicBrief.genre && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{musicBrief.genre}</span>}
                </div>
              )}
              {musicPromptOverride !== undefined && musicPromptOverride !== musicBrief?.prompt && (
                <p className="text-[11px] text-amber-600">Custom prompt active — will be used on next regenerate.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const videoDetail = (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Scenes */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Scenes</p>
        {videoResult?.videos?.length ? (
          <div className="space-y-2">
            {/* sceneId comes from the LLM scene plan and is not guaranteed unique */}
            {videoResult.videos.map((v, i) => (
              <div key={`${v.sceneId}-${i}`} className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-600 truncate">Scene {i + 1} · {v.provider}</p>
                {v.versionId && <MediaPlayer versionId={v.versionId} kind="video" />}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Run to storyboard the script and generate every scene.</p>
        )}
      </div>

      {/* Rendering */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Rendering</p>
        {runningPipeline ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-gray-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                {progress ? progress.stage : 'Starting pipeline…'}
              </span>
              <span className="flex items-center gap-3 text-gray-500 tabular-nums">
                <ElapsedBadge since={runningPipeline.startedAt ?? runningPipeline.createdAt} />
                {progress && progress.etaSecs > 0 && <span>~{formatElapsed(progress.etaSecs)} remaining</span>}
                {progress && <span>{progress.index}/{progress.count} stages</span>}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(pct, 3)}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setRenderPlatform(PLATFORM_TO_RENDER[platform] ?? 'YOUTUBE');
              setShowRenderDialog(true);
            }}
            disabled={busy || !scriptDone}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 ${
              renderDone
                ? 'border border-brand-300 text-brand-700 hover:bg-brand-50'
                : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
            }`}
          >
            {renderDone ? <RefreshCw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {renderDone ? 'Re-render' : 'Render final video'}
          </button>
        )}
      </div>

      {/* Final video */}
      {renderResult?.versionId && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Final video</p>
          <MediaPlayer versionId={renderResult.versionId} kind="video" />
          {(renderResult.preset ?? renderResult.durationSecs) && (
            <p className="text-[11px] text-gray-500 mt-1">
              {renderResult.preset}{renderResult.durationSecs ? ` · ${Math.round(renderResult.durationSecs)}s` : ''}
            </p>
          )}
        </div>
      )}

      {/* Downloads · Upload package */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Downloads · Upload package</p>
        {exportFiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {exportFiles.map((f) => (
              <button
                key={f.name}
                onClick={() => void api.media.downloadExport(projectId, f.name).then((res) => downloadBlob(res, f.name))}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-left text-sm text-gray-800 transition-colors"
              >
                {fileIcon(f.name)}
                <span className="flex-1 truncate text-xs">{f.name}</span>
                <span className="text-[11px] text-gray-500 shrink-0">{formatSize(f.sizeBytes)}</span>
                <Download className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Render the final video to generate the upload-ready package.</p>
        )}
        <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 shrink-0" />
          Publishing to YouTube requires your approval in Approvals.
        </p>
      </div>
    </div>
  );

  // ── Image detail ─────────────────────────────────────────────────────────────
  const imageDetail = (
    <div className="space-y-4">
      {/* Scene Briefs */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Scene Briefs</p>
        {imageBriefResult?.briefs?.length ? (
          <div className="space-y-2">
            {imageBriefResult.briefs.map((brief, i) => (
              <div key={brief.sceneId} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">Scene {i + 1}</span>
                  <span className="text-[10px] text-gray-400">{brief.style} · {brief.aspectRatio}</span>
                </div>
                <p className="text-xs text-gray-700 line-clamp-3">{brief.prompt}</p>
                {brief.sectionHeading && (
                  <p className="text-[10px] text-gray-400 mt-1 italic">{brief.sectionHeading}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Run Images to generate scene briefs.</p>
        )}
      </div>

      {/* Generated Images */}
      {imageGenResult?.images?.length ? (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Generated Images</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {imageGenResult.images.map((img, i) => (
              <div key={img.sceneId} className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                {img.versionId ? (
                  <ImagePreview versionId={img.versionId} />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                <p className="text-[10px] text-gray-500 px-2 py-1.5 truncate">Scene {i + 1} · {img.provider}</p>
              </div>
            ))}
          </div>
        </div>
      ) : imageBriefResult?.briefs?.length ? (
        <p className="text-xs text-gray-500">Briefs ready — tap <strong>Run</strong> to generate images.</p>
      ) : null}
    </div>
  );

  // Detail panel icon + title map (mirrors card header look)
  const agentMeta: Record<string, { icon: React.ReactNode; title: string }> = {
    analyse:        { icon: <BarChart2 className="w-5 h-5" />,    title: 'Analyse' },
    suggestion:     { icon: <Lightbulb className="w-5 h-5" />,    title: 'Suggestion' },
    script:         { icon: <FileText className="w-5 h-5" />,     title: 'Script' },
    character_cast: { icon: <span style={{ fontSize: 18 }}>🎭</span>, title: 'Character Cast' },
    voice:          { icon: <Mic className="w-5 h-5" />,          title: 'Voice over' },
    music:          { icon: <Music className="w-5 h-5" />,        title: 'Music' },
    images:         { icon: <ImageIcon className="w-5 h-5" />,    title: 'Images' },
    video:          { icon: <Clapperboard className="w-5 h-5" />, title: 'Video' },
  };

  const characterCastDetail = castResult?.characters && castResult.characters.length > 0 ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-gray-700">Character Roster</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ede9fe', color: '#7c3aed' }}>{castResult.narrativeStyle}</span>
      </div>
      {castResult.characters.map((char, i) => {
        const portrait = portraits.find((p) => p.name === char.name);
        return (
          <div key={i} className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: '#faf9ff', border: '1.5px solid #e9e5f8' }}>
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: '#ede9fe' }}>
              {portrait?.assetId ? (
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 800 }}>✓ Generated</span>
              ) : (
                <span style={{ fontSize: 26 }}>{char.gender === 'female' ? '👩' : char.gender === 'male' ? '👨' : '🧑'}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-extrabold text-gray-900">{char.name}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: '#ede9fe', color: '#7c3aed' }}>{char.role}</span>
                <span className="text-[10px] text-gray-400">{char.ageGroup}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">{char.personality}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#15803d' }}>🎙️ voice: {char.voiceStyle.voiceId}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#c2410c' }}>💫 {char.voiceStyle.emotion}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f0f9ff', color: '#0369a1' }}>⚡ {char.voiceStyle.speed}x</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  function detailFor(key: string): React.ReactNode {
    switch (key) {
      case 'analyse':        return analyseDetail;
      case 'suggestion':     return suggestionDetail;
      case 'script':         return scriptDetail;
      case 'character_cast': return characterCastDetail;
      case 'voice':          return voiceDetail;
      case 'music':          return musicDetail;
      case 'images':         return imageDetail;
      case 'video':          return videoDetail;
      default:               return null;
    }
  }

  return (
    <>
    <div className="mb-6">
      {/* Content Pipeline header (design ref: 1.png) */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Content Pipeline</h2>
          <p className="text-xs text-gray-500">Create content step-by-step with AI</p>
        </div>
      </div>

      {/* Channel strip (image.png: channel first) */}
      <div className="bg-[#e6dcf8] rounded-3xl px-6 py-4 mb-4 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
          <Youtube className="w-5 h-5 text-red-500" />
        </div>
        {channel ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Producing for channel</p>
              <p className="font-bold text-gray-900 truncate">{channel.title}</p>
            </div>
            {channels.length > 1 && (
              <select
                value={channels.find((c) => c.youtubeChannelId === channel.youtubeChannelId)?.id ?? ''}
                onChange={(e) => switchChannel.mutate(e.target.value)}
                disabled={switchChannel.isPending || busy}
                aria-label="Switch channel"
                className="border border-white bg-white/70 rounded-full px-3 py-1.5 text-xs text-gray-700"
              >
                {channels.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
          </>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Producing for</p>
            <p className="text-xs italic" style={{ color: '#374151' }}>No account linked · connect anytime</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1 · Analyse */}
        <div>
          <Tile
            icon={<BarChart2 className="w-5 h-5" />}
            title="Analyse"
            subtitle="Trends, audience & channel intelligence"
            status={analyseDone ? 'done' : 'ready'}
            running={isRunning(jobs, 'TREND_ANALYSIS')}
            failed={latestFailure(jobs, 'TREND_ANALYSIS')}
            updatedAt={completedAt(jobs, 'TREND_ANALYSIS')}
            selected={expanded === 'analyse'}
            hasDetail={true}
            onToggle={() => toggle('analyse')}
            action={<RunButton label={analyseDone ? 'Re-run' : 'Run'} rerun={analyseDone} disabled={busy} onClick={() => enqueue.mutate({ type: 'TREND_ANALYSIS' })} />}
          />
          {isMobile && expanded === 'analyse' && (
            <div key="analyse" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('analyse')}</div>
          )}
        </div>

        {/* 2 · Suggestion */}
        <div>
          <Tile
            icon={<Lightbulb className="w-5 h-5" />}
            title="Suggestion"
            subtitle={effectiveTopic ? `Topic: ${effectiveTopic.slice(0, 40)}${effectiveTopic.length > 40 ? '…' : ''}` : 'Pick or write your video topic'}
            status={effectiveTopic ? 'done' : analyseDone ? 'ready' : 'locked'}
            selected={expanded === 'suggestion'}
            hasDetail={true}
            onToggle={() => toggle('suggestion')}
          />
          {isMobile && expanded === 'suggestion' && (
            <div key="suggestion" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('suggestion')}</div>
          )}
        </div>

        {/* 3 · Script */}
        <div>
          <Tile
            icon={<FileText className="w-5 h-5" />}
            title="Script"
            subtitle={script ? `"${script.title.slice(0, 40)}…"` : effectiveTopic ? `Topic: ${effectiveTopic.slice(0, 40)}${effectiveTopic.length > 40 ? '…' : ''}` : 'Research the topic and write the script'}
            status={scriptDone ? 'done' : effectiveTopic ? 'ready' : 'locked'}
            running={runningFoundation}
            failed={latestFailure(jobs, 'RESEARCH', 'SCRIPT', 'FACT_CHECK', 'COMPLIANCE')}
            updatedAt={completedAt(jobs, 'SCRIPT')}
            selected={expanded === 'script'}
            hasDetail={true}
            onToggle={() => toggle('script')}
            action={
              <RunButton
                label={scriptDone ? 'Re-run' : 'Run'}
                rerun={scriptDone}
                disabled={busy || !effectiveTopic}
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: { scope: 'SCRIPT', topic: effectiveTopic, platform, lang: targetLang, ...prefsPayload, ...(scriptDone ? { regenerate: ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'COMPLIANCE'] } : {}) },
                })}
              />
            }
          />
          {isMobile && expanded === 'script' && (
            <div key="script" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('script')}</div>
          )}
        </div>

        {/* 3.5 · Character Cast (CHARACTER_STORY mode only) */}
        {productionMode === 'CHARACTER_STORY' && (
          <div>
            <Tile
              icon={<span style={{ fontSize: 18 }}>🎭</span>}
              title="Character Cast"
              subtitle={
                castResult
                  ? `${castResult.totalCharacters ?? castResult.characters?.length ?? 0} character(s) · ${castResult.narrativeStyle ?? 'narrated'}`
                  : 'Extract characters, voices & portraits'
              }
              status={castResult ? 'done' : scriptDone ? 'ready' : 'locked'}
              running={isRunning(jobs, 'CHARACTER_CAST', 'CHARACTER_IMAGE_GENERATE')}
              failed={latestFailure(jobs, 'CHARACTER_CAST', 'CHARACTER_IMAGE_GENERATE')}
              updatedAt={completedAt(jobs, 'CHARACTER_CAST')}
              selected={expanded === 'character_cast'}
              hasDetail={!!castResult}
              onToggle={() => toggle('character_cast')}
              action={
                <RunButton
                  label={castResult ? 'Regenerate' : 'Run'}
                  rerun={!!castResult}
                  disabled={busy || !scriptDone}
                  onClick={() => enqueue.mutate({
                    type: 'FULL_PRODUCTION',
                    payload: { scope: 'CHARACTER_STORY', lang: targetLang, ...prefsPayload, ...(castResult ? { regenerate: ['CHARACTER_CAST', 'CHARACTER_IMAGE_GENERATE'] } : {}) },
                  })}
                />
              }
            />
            {isMobile && expanded === 'character_cast' && (
              <div key="character_cast" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">
                {castResult?.characters && castResult.characters.length > 0 ? (
                  <div className="space-y-3">
                    {castResult.characters.map((char, i) => {
                      const portrait = portraits.find((p) => p.name === char.name);
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: '#faf9ff', border: '1.5px solid #e9e5f8' }}>
                          <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: '#ede9fe' }}>
                            {portrait?.assetId ? (
                              <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>✓</span>
                            ) : (
                              <span style={{ fontSize: 22 }}>{char.gender === 'female' ? '👩' : char.gender === 'male' ? '👨' : '🧑'}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-extrabold text-gray-900 truncate">{char.name}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ede9fe', color: '#7c3aed' }}>{char.role}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate mb-1">{char.personality}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#15803d' }}>🎙️ {char.voiceStyle.voiceId}</span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#c2410c' }}>⚡ {char.voiceStyle.emotion}</span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#f0f9ff', color: '#0369a1' }}>🚀 {char.voiceStyle.speed}x</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Run Character Cast to see characters here.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4 · Voice over */}
        <div>
          <Tile
            icon={<Mic className="w-5 h-5" />}
            title="Voice over"
            subtitle={voiceResult ? `${voiceResult.provider} · ${Math.round((voiceResult.durationMs ?? 0) / 1000)}s` : 'Narrate the script'}
            status={voiceResult ? 'done' : scriptDone ? 'ready' : 'locked'}
            running={isRunning(jobs, 'VOICE_SPEC', 'VOICE_GENERATE', 'SONG_GENERATE')}
            failed={latestFailure(jobs, 'VOICE_SPEC', 'VOICE_GENERATE', 'SONG_GENERATE')}
            updatedAt={completedAt(jobs, 'VOICE_GENERATE') ?? completedAt(jobs, 'SONG_GENERATE')}
            selected={expanded === 'voice'}
            hasDetail={true}
            onToggle={() => toggle('voice')}
            action={
              <RunButton
                label={voiceResult ? 'Regenerate' : 'Run'}
                rerun={!!voiceResult}
                disabled={busy || !scriptDone}
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: { scope: 'VOICE', lang: targetLang, ...prefsPayload, ...(voiceResult ? { regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'] } : {}) },
                })}
              />
            }
          />
          {isMobile && expanded === 'voice' && (
            <div key="voice" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('voice')}</div>
          )}
        </div>

        {/* 5 · Music */}
        <div>
          <Tile
            icon={<Music className="w-5 h-5" />}
            title="Music"
            subtitle={musicResult ? `${musicResult.provider} · ${Math.round((musicResult.durationMs ?? 0) / 1000)}s` : 'Background music for the video'}
            status={musicResult ? 'done' : scriptDone ? 'ready' : 'locked'}
            running={isRunning(jobs, 'MUSIC_BRIEF', 'MUSIC_GENERATE')}
            failed={latestFailure(jobs, 'MUSIC_BRIEF', 'MUSIC_GENERATE')}
            updatedAt={completedAt(jobs, 'MUSIC_GENERATE')}
            selected={expanded === 'music'}
            hasDetail={true}
            onToggle={() => toggle('music')}
            action={
              <RunButton
                label={musicResult ? 'Regenerate' : 'Run'}
                rerun={!!musicResult}
                disabled={busy || !scriptDone}
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: {
                    scope: 'MUSIC',
                    ...prefsPayload,
                    ...(mood.trim() ? { mood: mood.trim() } : {}),
                    ...(genre.trim() ? { genre: genre.trim() } : {}),
                    ...(musicPromptOverride ? { musicPrompt: musicPromptOverride } : {}),
                    ...(musicResult ? { regenerate: musicPromptOverride ? ['MUSIC_GENERATE'] : ['MUSIC_BRIEF', 'MUSIC_GENERATE'] } : {}),
                  },
                })}
              />
            }
          />
          {isMobile && expanded === 'music' && (
            <div key="music" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('music')}</div>
          )}
        </div>

        {/* 6 · Images */}
        <div>
          <Tile
            icon={<ImageIcon className="w-5 h-5" />}
            title="Images"
            subtitle={
              imageGenResult?.images?.length
                ? `${imageGenResult.images.length} scene image(s) generated`
                : imageBriefResult?.briefs?.length
                ? `${imageBriefResult.briefs.length} brief(s) ready — tap Run to generate`
                : 'Generate scene image briefs & stills'
            }
            status={imageGenResult ? 'done' : scriptDone ? 'ready' : 'locked'}
            running={isRunning(jobs, 'IMAGE_BRIEF', 'IMAGE_GENERATE')}
            failed={latestFailure(jobs, 'IMAGE_BRIEF', 'IMAGE_GENERATE')}
            updatedAt={completedAt(jobs, 'IMAGE_GENERATE') ?? completedAt(jobs, 'IMAGE_BRIEF')}
            selected={expanded === 'images'}
            hasDetail={true}
            onToggle={() => toggle('images')}
            action={
              <RunButton
                label={imageGenResult ? 'Regenerate' : 'Run'}
                rerun={!!imageGenResult}
                disabled={busy || !scriptDone}
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: {
                    scope: 'IMAGES',
                    ...prefsPayload,
                    ...(imageGenResult
                      ? { regenerate: ['IMAGE_BRIEF', 'IMAGE_GENERATE'] }
                      : imageBriefResult
                      ? { regenerate: ['IMAGE_GENERATE'] }
                      : {}),
                  },
                })}
              />
            }
          />
          {isMobile && expanded === 'images' && (
            <div key="images" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('images')}</div>
          )}
        </div>

        {/* 7 · Video */}
        <div>
          <Tile
            icon={<Clapperboard className="w-5 h-5" />}
            title="Video"
            subtitle={videoResult?.videos?.length ? `${videoResult.videos.length} scene(s) · scenes, rendering & final delivery` : 'Scenes, rendering & final delivery'}
            status={videoResult ? 'done' : scriptDone ? 'ready' : 'locked'}
            running={isRunning(jobs, 'VIDEO_SCENE_PLAN', 'IMAGE_BRIEF', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'SUBTITLE_GENERATE', 'THUMBNAIL')}
            failed={latestFailure(jobs, 'VIDEO_SCENE_PLAN', 'VIDEO_GENERATE', 'SUBTITLE_GENERATE', 'THUMBNAIL')}
            updatedAt={completedAt(jobs, 'VIDEO_GENERATE')}
            selected={expanded === 'video'}
            hasDetail={true}
            onToggle={() => toggle('video')}
            action={
              <RunButton
                label={videoResult ? 'Regenerate' : 'Run'}
                rerun={!!videoResult}
                disabled={busy || !scriptDone}
                onClick={() => enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: { scope: 'VIDEO', ...prefsPayload, ...(videoResult ? { regenerate: ['VIDEO_SCENE_PLAN', 'IMAGE_BRIEF', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'SUBTITLE_GENERATE', 'THUMBNAIL'] } : {}) },
                })}
              />
            }
          />
          {isMobile && expanded === 'video' && (
            <div key="video" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('video')}</div>
          )}
        </div>
      </div>

      {/* Agent detail panel — desktop/tablet only (mobile renders inline below the card) */}
      {!isMobile && expanded && agentMeta[expanded] && (
        <div key={expanded} className="hidden md:block fade-in mt-4 bg-[#efe8fb] rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-brand-600 shrink-0">
              {agentMeta[expanded].icon}
            </div>
            <p className="font-semibold text-gray-900">{agentMeta[expanded].title}</p>
            <button
              onClick={() => setExpanded(null)}
              aria-label="Close details"
              className="ml-auto text-gray-500 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-inner">{detailFor(expanded)}</div>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center mt-4">
        Complete each step in order for the best results.
      </p>
    </div>

    {/* ── Pre-render settings dialog ──────────────────────────────────────── */}
    {showRenderDialog && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Render settings</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Choose where this video will be published</p>
            </div>
            <button onClick={() => setShowRenderDialog(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Platform grid */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Target platform</p>
              <div className="grid grid-cols-1 gap-1.5">
                {RENDER_PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setRenderPlatform(p.value)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      renderPlatform === p.value
                        ? 'border-brand-500 bg-brand-50 text-brand-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md bg-gray-100 shrink-0">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{p.label}</span>
                        <span className="text-[10px] text-gray-500 ml-2 shrink-0">{p.format}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{p.quality}</p>
                    </div>
                    {renderPlatform === p.value && (
                      <CheckCircle className="w-4 h-4 text-brand-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Video type */}
            <div className="px-5 pt-3 pb-4">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Video type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {VIDEO_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setRenderVideoType(t.value)}
                    className={`flex flex-col px-3 py-2 rounded-xl border text-left transition-colors ${
                      renderVideoType === t.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-gray-900">{t.label}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 pb-8 sm:pb-4 border-t border-gray-100 flex gap-2 justify-end shrink-0">
            <button
              onClick={() => setShowRenderDialog(false)}
              className="px-4 py-2 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowRenderDialog(false);
                enqueue.mutate({
                  type: 'FULL_PRODUCTION',
                  payload: {
                    scope: productionMode,
                    platform: renderPlatform,
                    videoType: renderVideoType,
                    ...prefsPayload,
                    ...(refreshMedia
                      ? { regenerate: [...FULL_MEDIA_REGENERATE] }
                      : renderDone
                        ? { regenerate: ['RENDER'] }
                        : {}),
                  },
                });
              }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
            >
              <Play className="w-3 h-3" />
              {renderDone ? 'Re-render' : 'Start rendering'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
