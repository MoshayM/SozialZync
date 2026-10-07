'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Youtube, BarChart2, Lightbulb, FileText, Mic, Music, Clapperboard,
  Play, RefreshCw, Loader2, CheckCircle, ChevronDown, ChevronUp, Save, Pencil, AlertTriangle, X,
  KeyRound, Sparkles, Download, FileVideo, FileAudio, FileImage, FileText as FileTextIcon, ShieldCheck,
  Square, Upload, Plus, ExternalLink, Check,
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
  const [loading, setLoading] = useState(false);
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

  if (!url) {
    return (
      <span className="flex items-center gap-2">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {loading ? 'Loading…' : loadError ? 'Retry' : kind === 'audio' ? 'Play audio' : 'Play video'}
        </button>
        {loadError && <span className="text-[11px] text-red-500">Couldn&rsquo;t load media</span>}
      </span>
    );
  }
  return kind === 'audio'
    // eslint-disable-next-line jsx-a11y/media-has-caption -- AI-generated preview; caption track not produced
    ? <audio controls src={url} className="w-full h-9" />
    // eslint-disable-next-line jsx-a11y/media-has-caption -- AI-generated preview; caption track not produced
    : <video controls src={url} className="w-full rounded-xl max-h-56 bg-black" />;
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
  const [refreshMedia, setRefreshMedia] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
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
  const [scriptDraft, setScriptDraft] = useState<ScriptResult | null>(null);
  const [voiceKey, setVoiceKey] = useState('');
  const [voiceKeySaved, setVoiceKeySaved] = useState(false);
  // Voice mode: 'ai' = AI Voice, 'record' = Your Voice
  const [voiceMode, setVoiceMode] = useState<'ai' | 'record'>('ai');
  const [yourVoiceMode, setYourVoiceMode] = useState<'full' | 'ref'>('full');
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
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyleId>('default');
  const [elevenLabsOpen, setElevenLabsOpen] = useState(false);
  // Pre-render settings dialog
  const [showRenderDialog, setShowRenderDialog] = useState(false);
  const [renderPlatform, setRenderPlatform] = useState<RenderPlatformValue>(() =>
    PLATFORM_TO_RENDER[platform] ?? 'YOUTUBE');
  const [renderVideoType, setRenderVideoType] = useState<typeof VIDEO_TYPES[number]['value']>('long-form');

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

  const cloneAndGenerate = useCallback(async () => {
    if (!refBlob) return;
    setCloneLoading(true);
    setCloneError('');
    try {
      const form = new FormData();
      form.append('audio', refBlob, 'voice-sample.webm');
      const res = await fetch('/api/proxy/voice/clone', {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${localStorage.getItem('cf_token') ?? ''}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Clone failed' })) as { message?: string };
        throw new Error(err.message ?? `Clone failed: ${res.status}`);
      }
      const { voiceId } = await res.json() as { voiceId: string };
      setClonedVoiceId(voiceId);
      enqueue.mutate({ type: 'FULL_PRODUCTION', payload: { scope: 'VOICE', referenceVoiceId: voiceId, lang: targetLang, regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'] } });
    } catch {
      // Cloning unavailable (no server key or missing permissions) — fall back to AI voice
      setCloneError('fallback');
      enqueue.mutate({
        type: 'FULL_PRODUCTION',
        payload: {
          scope: 'VOICE',
          regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'],
          voiceProfile: VOICE_STYLES.find((s) => s.id === voiceStyle)?.voiceProfile,
          lang: targetLang,
        },
      });
    } finally {
      setCloneLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refBlob, targetLang, voiceStyle]);

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
  const musicJob = latest(jobs, 'MUSIC_GENERATE');
  const musicResult = musicJob?.status === 'COMPLETED' ? (musicJob.result as { versionId?: string; provider?: string; durationMs?: number; notes?: string }) : null;
  const musicBrief = latest(jobs, 'MUSIC_BRIEF')?.result as { mood?: string; genre?: string; bpm?: number; prompt?: string; emotionalArc?: string } | undefined;
  const videoJob = latest(jobs, 'VIDEO_GENERATE');
  const videoResult = videoJob?.status === 'COMPLETED' ? (videoJob.result as { videos?: Array<{ sceneId: string; versionId?: string; provider: string }> }) : null;
  const renderJob = latest(jobs, 'RENDER');
  const renderDone = isDone(jobs, 'RENDER');
  const renderResult = renderJob?.status === 'COMPLETED'
    ? (renderJob.result as { versionId?: string; preset?: string; durationSecs?: number } | undefined)
    : undefined;

  const runningFoundation = isRunning(jobs, 'RESEARCH', 'SCRIPT', 'FACT_CHECK', 'COMPLIANCE', 'FULL_PRODUCTION');
  const effectiveTopic = topic || customTopic;

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
        {trends.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {trends.map((t, i) => (
              <button
                key={i}
                onClick={() => chooseTopic(t.topic)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  topic === t.topic ? 'bg-brand-600 text-white border-brand-600' : 'border-brand-200 text-brand-700 hover:bg-brand-50'
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
                  onClick={() => chooseTopic(g.topic)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    topic === g.topic ? 'bg-brand-600 text-white border-brand-600' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {g.topic}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex gap-2">
          <input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="…or write your own topic"
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={() => customTopic.trim() && chooseTopic(customTopic.trim())}
            disabled={!customTopic.trim()}
            className="px-3 py-2 text-xs font-semibold bg-brand-600 text-white rounded-xl disabled:opacity-40"
          >
            Use
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
      </div>
    );
  })();

  const voiceDetail = (
    <div className="space-y-3">
      {/* Mode selector cards */}
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

          {/* Generate button */}
          <button
            onClick={() => enqueue.mutate({
              type: 'FULL_PRODUCTION',
              payload: {
                scope: 'VOICE',
                regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'],
                voiceProfile: VOICE_STYLES.find((s) => s.id === voiceStyle)?.voiceProfile,
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

      {/* Your Voice mode */}
      {voiceMode === 'record' && (
        <div className="space-y-3">
          {/* Sub-mode pills */}
          <div className="flex gap-1.5">
            {([
              ['full', '📖', 'Record Full Script'],
              ['ref', '🎤', 'Voice Reference'],
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
              {recordingError && <p className="text-xs text-red-500">{recordingError}</p>}
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
                  {uploadRecording.isSuccess && (
                    <p className="text-xs text-green-600 font-medium">
                      Uploaded — your recording is now the voice track.
                    </p>
                  )}
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
                  Record or import a short voice sample (5–30 s). AI clones your voice style and generates the full narration with natural emotion and pacing.
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
                {clonedVoiceId && !cloneError && (
                  <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Voice cloned — narration queued
                  </p>
                )}
                {cloneError === 'fallback' && (
                  <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Voice cloning is not available on this server — generating narration with your selected AI voice style instead.
                    </p>
                  </div>
                )}
                <button
                  onClick={cloneAndGenerate}
                  disabled={!refBlob || cloneLoading || busy}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  {cloneLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {cloneLoading ? 'Generating narration…' : (clonedVoiceId || cloneError) ? 'Regenerate' : 'Clone Voice & Generate'}
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

      {/* AI Music Brief — visible/editable once MUSIC_BRIEF has run */}
      {(musicBrief?.prompt || musicPromptOverride !== undefined) && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">AI Music Brief</p>
            <div className="flex items-center gap-1">
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
          </div>
          <textarea
            value={musicPromptDisplay}
            onChange={(e) => setMusicPromptOverride(e.target.value)}
            rows={4}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl resize-y leading-relaxed"
            placeholder="Music prompt will appear here after the brief runs…"
          />
          {musicBrief?.emotionalArc && (
            <p className="text-[11px] text-gray-500 italic leading-snug">{musicBrief.emotionalArc}</p>
          )}
          {musicBrief?.bpm && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">{musicBrief.bpm} BPM</span>
              {musicBrief.mood && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{musicBrief.mood}</span>}
              {musicBrief.genre && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{musicBrief.genre}</span>}
            </div>
          )}
          {musicPromptOverride !== undefined && musicPromptOverride !== musicBrief?.prompt && (
            <p className="text-[11px] text-amber-600">Custom prompt active — will be used on next regenerate (brief re-runs for BPM/instruments, your prompt overrides).</p>
          )}
        </div>
      )}
    </div>
  );

  const videoDetail = (
    <div className="space-y-5">
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

  // Detail panel icon + title map (mirrors card header look)
  const agentMeta: Record<string, { icon: React.ReactNode; title: string }> = {
    analyse:    { icon: <BarChart2 className="w-5 h-5" />,    title: 'Analyse' },
    suggestion: { icon: <Lightbulb className="w-5 h-5" />,    title: 'Suggestion' },
    script:     { icon: <FileText className="w-5 h-5" />,     title: 'Script' },
    voice:      { icon: <Mic className="w-5 h-5" />,          title: 'Voice over' },
    music:      { icon: <Music className="w-5 h-5" />,        title: 'Music' },
    video:      { icon: <Clapperboard className="w-5 h-5" />, title: 'Video' },
  };

  function detailFor(key: string): React.ReactNode {
    switch (key) {
      case 'analyse':    return analyseDetail;
      case 'suggestion': return suggestionDetail;
      case 'script':     return scriptDetail;
      case 'voice':      return voiceDetail;
      case 'music':      return musicDetail;
      case 'video':      return videoDetail;
      default:           return null;
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
            failed={latestFailure(jobs, 'RESEARCH', 'SCRIPT', 'FACT_CHECK', 'COMPLIANCE', 'FULL_PRODUCTION')}
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
                  payload: { scope: 'SCRIPT', topic: effectiveTopic, platform, lang: targetLang, ...(scriptDone ? { regenerate: ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'COMPLIANCE'] } : {}) },
                })}
              />
            }
          />
          {isMobile && expanded === 'script' && (
            <div key="script" className="md:hidden fade-in mt-3 bg-white rounded-2xl p-4 shadow-inner">{detailFor('script')}</div>
          )}
        </div>

        {/* 4 · Voice over */}
        <div>
          <Tile
            icon={<Mic className="w-5 h-5" />}
            title="Voice over"
            subtitle={voiceResult ? `${voiceResult.provider} · ${Math.round((voiceResult.durationMs ?? 0) / 1000)}s` : 'Narrate the script'}
            status={voiceResult ? 'done' : scriptDone ? 'ready' : 'locked'}
            running={isRunning(jobs, 'VOICE_SPEC', 'VOICE_GENERATE')}
            failed={latestFailure(jobs, 'VOICE_SPEC', 'VOICE_GENERATE')}
            updatedAt={completedAt(jobs, 'VOICE_GENERATE')}
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
                  payload: { scope: 'VOICE', lang: targetLang, ...(voiceResult ? { regenerate: ['VOICE_SPEC', 'VOICE_GENERATE'] } : {}) },
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

        {/* 6 · Video */}
        <div>
          <Tile
            icon={<Clapperboard className="w-5 h-5" />}
            title="Video"
            subtitle={videoResult?.videos?.length ? `${videoResult.videos.length} scene(s) · scenes, rendering & final delivery` : 'Scenes, rendering & final delivery'}
            status={videoResult ? 'done' : scriptDone ? 'ready' : 'locked'}
            running={isRunning(jobs, 'VIDEO_SCENE_PLAN', 'IMAGE_BRIEF', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'SUBTITLE_GENERATE', 'THUMBNAIL')}
            failed={latestFailure(jobs, 'VIDEO_SCENE_PLAN', 'IMAGE_BRIEF', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'SUBTITLE_GENERATE', 'THUMBNAIL')}
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
                  payload: { scope: 'VIDEO', ...(videoResult ? { regenerate: ['VIDEO_SCENE_PLAN', 'IMAGE_BRIEF', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'SUBTITLE_GENERATE', 'THUMBNAIL'] } : {}) },
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
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
          <div className="px-5 pt-3 pb-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Video type</p>
            <div className="grid grid-cols-2 gap-1.5">
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

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
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
                    scope: 'FULL',
                    platform: renderPlatform,
                    videoType: renderVideoType,
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
