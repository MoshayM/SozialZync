'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Loader2, CheckCircle2, AlertCircle, Calendar, Globe, Subtitles,
  Hash, ChevronDown, ChevronUp, Zap, Upload, Info,
  Sparkles, ImagePlus, Clock, CalendarClock, RefreshCw, Image,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Platform specs ────────────────────────────────────────────────────────────

interface PlatformSpec {
  name: string;
  color: string;
  maxTitleChars: number;
  maxCaptionChars: number;
  maxHashtags: number;
  titleLabel: string;
  captionLabel: string;
  tips: string[];
}

const PLATFORM: Record<string, PlatformSpec> = {
  YOUTUBE_SHORTS: {
    name: 'YouTube Shorts',
    color: '#FF0000',
    maxTitleChars: 100,
    maxCaptionChars: 5000,
    maxHashtags: 15,
    titleLabel: 'Video title',
    captionLabel: 'Description',
    tips: [
      'Add #Shorts to the title so YouTube places it in the Shorts feed',
      'Front-load the most important keyword in the first 3 words',
      'Hook viewers in the first 3 seconds — the algorithm watches completion rate',
    ],
  },
  INSTAGRAM_REELS: {
    name: 'Instagram Reels',
    color: '#E1306C',
    maxTitleChars: 2200,
    maxCaptionChars: 2200,
    maxHashtags: 30,
    titleLabel: 'Caption headline',
    captionLabel: 'Caption',
    tips: [
      '3-7 targeted hashtags beat 30 random ones for reach',
      'Put hashtags at the end of the caption to keep it clean',
      'The first 125 chars show before "more" — make them hook',
    ],
  },
  TIKTOK: {
    name: 'TikTok',
    color: '#010101',
    maxTitleChars: 2200,
    maxCaptionChars: 2200,
    maxHashtags: 30,
    titleLabel: 'Caption',
    captionLabel: 'Caption',
    tips: [
      'First 1-3 seconds decide if people swipe — make them unavoidable',
      'Trending sounds + original content boosts distribution',
      'Use 3-5 niche hashtags + 1-2 broad ones',
    ],
  },
  LINKEDIN_CLIPS: {
    name: 'LinkedIn',
    color: '#0077B5',
    maxTitleChars: 200,
    maxCaptionChars: 3000,
    maxHashtags: 5,
    titleLabel: 'Post headline',
    captionLabel: 'Post body',
    tips: [
      'Insights + professional lessons outperform entertainment here',
      'Tag relevant companies or collaborators for extra reach',
      'Best length: 1-3 min clips showing clear expertise',
    ],
  },
  FACEBOOK_REELS: {
    name: 'Facebook Reels',
    color: '#1877F2',
    maxTitleChars: 255,
    maxCaptionChars: 2200,
    maxHashtags: 30,
    titleLabel: 'Reel title',
    captionLabel: 'Description',
    tips: [
      'Native uploads get more reach than cross-posted Instagram Reels',
      'Share to relevant Facebook Groups after posting for organic amplification',
      'Keep captions short — Facebook audiences scroll fast',
    ],
  },
  PODCAST_HIGHLIGHTS: {
    name: 'Podcast Highlight',
    color: '#8B5CF6',
    maxTitleChars: 255,
    maxCaptionChars: 5000,
    maxHashtags: 10,
    titleLabel: 'Episode title',
    captionLabel: 'Show notes',
    tips: [
      'Include episode number and guest name for discoverability',
      'Add a CTA to listen to the full episode',
      'Timestamps in show notes drive engagement and time-spent',
    ],
  },
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'auto', label: 'Auto-detect' },
];

// ── Hashtag chip input ────────────────────────────────────────────────────────

function HashtagInput({ tags, onChange, max }: { tags: string[]; onChange: (t: string[]) => void; max: number }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const clean = raw.trim().replace(/^#+/, '').replace(/\s+/g, '').toLowerCase();
    if (!clean || tags.includes(clean) || tags.length >= max) return;
    onChange([...tags, clean]);
    setInput('');
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  return (
    <div
      className="flex flex-wrap gap-1.5 border border-gray-200 rounded-lg p-2 cursor-text min-h-[48px]"
      onClick={() => inputRef.current?.focus()}
      role="presentation"
    >
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium">
          #{t}
          <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(t); }} className="hover:text-brand-900">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {tags.length < max && (
        <input
          ref={inputRef}
          value={input}
          placeholder={tags.length === 0 ? 'Type hashtag and press Enter…' : '+'}
          className="flex-1 min-w-[80px] text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
              e.preventDefault();
              addTag(input);
            }
            if (e.key === 'Backspace' && !input && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => { if (input.trim()) addTag(input); }}
        />
      )}
    </div>
  );
}

// ── Char counter ──────────────────────────────────────────────────────────────

function CharCounter({ val, max }: { val: string; max: number }) {
  const len = val.length;
  const pct = len / max;
  const color = pct >= 1 ? 'text-red-500' : pct >= 0.85 ? 'text-amber-500' : 'text-gray-400';
  return <span className={`text-[10px] tabular-nums ${color}`}>{len}/{max}</span>;
}

// ── Thumbnail section (Issue 1) ───────────────────────────────────────────────

type ThumbMode = 'keep' | 'ai' | 'upload';

interface Thumbnail { id: string; url: string; isPrimary: boolean; }

function ThumbnailSection({
  clipId,
  selectedId,
  onSelect,
}: {
  clipId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<ThumbMode>('keep');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: thumbs = [], isLoading: thumbsLoading, refetch: refetchThumbs } = useQuery({
    queryKey: ['thumbnails', clipId],
    queryFn: () => api.shortsStudio.thumbnails(clipId).then((r) => r.data as Thumbnail[]),
    staleTime: 30 * 1000,
  });

  const generate = useMutation({
    mutationFn: () => api.shortsStudio.generateThumbnails(clipId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['thumbnails', clipId] });
      void refetchThumbs();
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.shortsStudio.uploadThumbnail(clipId, file),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['thumbnails', clipId] });
      void refetchThumbs();
      onSelect((res.data as { id: string }).id);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPreview(URL.createObjectURL(file));
    upload.mutate(file);
  };

  const ModeBtn = ({ m, label, Icon }: { m: ThumbMode; label: string; Icon: React.ComponentType<{ className?: string }> }) => (
    <button
      type="button"
      onClick={() => { setMode(m); if (m === 'keep') onSelect(null); }}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
        mode === m
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
      ].join(' ')}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <ModeBtn m="keep" label="Keep Default" Icon={Image} />
        <ModeBtn m="ai" label="AI Generate" Icon={Sparkles} />
        <ModeBtn m="upload" label="Upload" Icon={ImagePlus} />
      </div>

      {mode === 'keep' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-gray-600">Default video frame will be used.</p>
        </div>
      )}

      {mode === 'ai' && (
        <div className="space-y-2">
          {thumbsLoading ? (
            <div className="flex items-center justify-center h-24 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : thumbs.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-gray-500">No thumbnails generated yet.</p>
              <button
                type="button"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="flex items-center gap-2 mx-auto px-4 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generate.isPending ? 'Generating…' : 'Generate AI Thumbnails'}
              </button>
              {generate.isError && (
                <p className="text-[11px] text-red-500">
                  {(generate.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Thumbnail generation failed — please try again.'}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {thumbs.map((t) => {
                  const active = selectedId === t.id || (!selectedId && t.isPrimary);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelect(t.id)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${active ? 'border-brand-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.url} alt="Thumbnail" className="w-full aspect-[9/16] object-cover" />
                      {active && (
                        <div className="absolute inset-0 bg-brand-600/10 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-brand-600 drop-shadow" />
                        </div>
                      )}
                      {t.isPrimary && !active && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded">AI pick</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${generate.isPending ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          {upload.isPending ? (
            <div className="flex items-center gap-2 justify-center h-24 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Uploading…</span>
            </div>
          ) : uploadPreview ? (
            <div className="flex items-center gap-3">
              <div className="relative w-20 rounded-lg overflow-hidden border-2 border-brand-500 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadPreview} alt="Custom thumbnail" className="w-full aspect-[9/16] object-cover" />
                <div className="absolute inset-0 bg-brand-600/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-brand-600" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-5 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
            >
              <ImagePlus className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-500">Click to upload JPEG / PNG / WebP · Max 10 MB</span>
            </button>
          )}
          {upload.isError && (
            <p className="text-[11px] text-red-500">Upload failed — check file type and size.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Schedule section (Issue 3) ───────────────────────────────────────────────

type SchedMode = 'now' | 'suggested' | 'custom';

/** Platform-specific peak engagement time slots — used as client-side fallback. */
function getPlatformSuggestions(clipType: string): Array<{ label: string; iso: string }> {
  const SLOTS: Record<string, Array<{ dayOfWeek: number; hour: number; reason: string }>> = {
    YOUTUBE_SHORTS: [
      { dayOfWeek: 2, hour: 18, reason: 'Wed 6 PM · peak Shorts feed browsing' },
      { dayOfWeek: 5, hour: 17, reason: 'Fri 5 PM · end-of-week engagement spike' },
      { dayOfWeek: 6, hour: 15, reason: 'Sat 3 PM · weekend discovery window' },
      { dayOfWeek: 0, hour: 11, reason: 'Sun 11 AM · morning scrolling peak' },
    ],
    TIKTOK: [
      { dayOfWeek: 2, hour: 9,  reason: 'Tue 9 AM · For You Page morning push' },
      { dayOfWeek: 4, hour: 19, reason: 'Thu 7 PM · prime-time For You window' },
      { dayOfWeek: 6, hour: 11, reason: 'Sat 11 AM · weekend top engagement' },
    ],
    INSTAGRAM_REELS: [
      { dayOfWeek: 1, hour: 9,  reason: 'Mon 9 AM · Reels morning distribution' },
      { dayOfWeek: 3, hour: 12, reason: 'Wed 12 PM · lunch-break scroll' },
      { dayOfWeek: 5, hour: 19, reason: 'Fri 7 PM · pre-weekend ramp-up' },
    ],
    LINKEDIN_CLIPS: [
      { dayOfWeek: 2, hour: 8,  reason: 'Tue 8 AM · professional feed open' },
      { dayOfWeek: 3, hour: 12, reason: 'Wed 12 PM · lunch-hour decision makers' },
      { dayOfWeek: 4, hour: 9,  reason: 'Thu 9 AM · peak LinkedIn engagement' },
    ],
    FACEBOOK_REELS: [
      { dayOfWeek: 3, hour: 13, reason: 'Wed 1 PM · mid-week peak reach' },
      { dayOfWeek: 5, hour: 14, reason: 'Fri 2 PM · weekend warm-up window' },
      { dayOfWeek: 6, hour: 12, reason: 'Sat 12 PM · family browsing peak' },
    ],
  };

  const now = new Date();
  const slots = SLOTS[clipType] ?? SLOTS['YOUTUBE_SHORTS']!;
  const results: Array<{ label: string; iso: string; ts: number }> = [];

  for (const { dayOfWeek, hour, reason } of slots) {
    const d = new Date(now);
    d.setHours(hour, 0, 0, 0);
    const diff = (dayOfWeek - now.getDay() + 7) % 7;
    // If same day but time already passed (or within 30 min), push to next week
    if (diff === 0 && d.getTime() <= now.getTime() + 30 * 60 * 1000) {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + diff);
    }
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    results.push({ label: `${dayStr} at ${timeStr} · ${reason}`, iso: d.toISOString(), ts: d.getTime() });
  }

  return results
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 3)
    .map(({ label, iso }) => ({ label, iso }));
}

function ScheduleSection({
  clipId,
  platform,
  onChange,
}: {
  clipId: string;
  platform: string;
  onChange: (iso: string | undefined) => void;
}) {
  const [mode, setMode] = useState<SchedMode>('now');
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>();
  const [customVal, setCustomVal] = useState('');

  const { data: apiSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['schedule-slots', clipId],
    queryFn: () => api.shortsStudio.scheduleSlots(clipId).then((r) => r.data as Array<{ label: string; iso: string }>),
    staleTime: 10 * 60 * 1000,
    enabled: mode === 'suggested',
  });

  // Use API slots if available, otherwise fall back to client-side platform suggestions
  const slots = apiSlots.length > 0 ? apiSlots : getPlatformSuggestions(platform);
  const usingFallback = !slotsLoading && apiSlots.length === 0;

  const handleModeChange = (m: SchedMode) => {
    setMode(m);
    if (m === 'now') { onChange(undefined); }
    else if (m === 'suggested') { onChange(selectedSlot); }
    else { onChange(customVal ? new Date(customVal).toISOString() : undefined); }
  };

  const ModeBtn = ({ m, label, Icon }: { m: SchedMode; label: string; Icon: React.ComponentType<{ className?: string }> }) => (
    <button
      type="button"
      onClick={() => handleModeChange(m)}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
        mode === m
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
      ].join(' ')}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <ModeBtn m="now" label="Publish Now" Icon={Clock} />
        <ModeBtn m="suggested" label="Best Time" Icon={Sparkles} />
        <ModeBtn m="custom" label="Custom" Icon={CalendarClock} />
      </div>

      {mode === 'now' && (
        <p className="text-[11px] text-gray-400 px-1">Publishes immediately after compliance check.</p>
      )}

      {mode === 'suggested' && (
        <div className="space-y-1.5">
          {slotsLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Analysing your calendar…
            </div>
          ) : (
            slots.map((s) => (
              <button
                key={s.iso}
                type="button"
                onClick={() => { setSelectedSlot(s.iso); onChange(s.iso); }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                  selectedSlot === s.iso
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                ].join(' ')}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                {s.label}
                {selectedSlot === s.iso && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-brand-500" />}
              </button>
            ))
          )}
          <p className="text-[10px] text-gray-400 px-1">
            {usingFallback ? 'AI-suggested times based on platform peak engagement.' : 'AI-suggested times based on peak engagement & your channel analytics.'}
          </p>
        </div>
      )}

      {mode === 'custom' && (
        <input
          type="datetime-local"
          value={customVal}
          min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
          onChange={(e) => { setCustomVal(e.target.value); onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined); }}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200"
        />
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface PublishMeta {
  title: string;
  description: string;
  tags: string[];
  originalLanguage: string | null;
  clipType: string;
}

interface PublishConfirmModalProps {
  clipId: string;
  clipTitle: string;
  onClose: () => void;
  onPublished: (clipId: string) => void;
}

export function PublishConfirmModal({ clipId, clipTitle, onClose, onPublished }: PublishConfirmModalProps) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState('en');
  const [subtitleLang, setSubtitleLang] = useState('auto');
  const [scheduledAt, setScheduledAt] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [selectedThumbId, setSelectedThumbId] = useState<string | null>(null);

  const { data: meta, isLoading: metaLoading, isError: metaError } = useQuery({
    queryKey: ['publish-meta', clipId],
    queryFn: () => api.shortsStudio.publishMeta(clipId).then((r) => r.data as PublishMeta),
    staleTime: 60 * 1000,
  });

  const spec: PlatformSpec = PLATFORM[meta?.clipType ?? 'YOUTUBE_SHORTS'] ?? PLATFORM['YOUTUBE_SHORTS']!;

  useEffect(() => {
    if (!meta) return;
    setTitle(meta.title);
    setCaption(meta.description);
    setTags(meta.tags.slice(0, spec.maxHashtags));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const publish = useMutation({
    mutationFn: () =>
      api.shortsStudio.quickPublish(clipId, {
        title: title.trim() || undefined,
        description: caption.trim() || undefined,
        tags: tags.length ? tags : undefined,
        language,
        subtitleLanguage: subtitleLang,
        scheduledAt,
        thumbnailId: selectedThumbId ?? undefined,
      }),
    onSuccess: () => {
      onPublished(clipId);
      onClose();
    },
  });

  const titleLen = title.length;
  const captionLen = caption.length;
  const titleOver = titleLen > spec.maxTitleChars;
  const captionOver = captionLen > spec.maxCaptionChars;
  const canSubmit = confirmed && !titleOver && !captionOver && !publish.isPending;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: spec.color }} />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Publish to {spec.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{clipTitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {metaLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
              <span className="ml-2 text-sm text-gray-500">Loading AI metadata…</span>
            </div>
          ) : metaError ? (
            <div className="flex items-center justify-center py-20 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm">Failed to load metadata — you can still edit below.</span>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">

              {/* Left column: thumbnail + schedule */}
              <div className="md:w-64 shrink-0 p-5 space-y-5">

                {/* Thumbnail (Issue 1) */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> Thumbnail
                  </p>
                  <ThumbnailSection
                    clipId={clipId}
                    selectedId={selectedThumbId}
                    onSelect={setSelectedThumbId}
                  />
                </div>

                {/* Schedule (Issue 4) */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> When to publish
                  </p>
                  <ScheduleSection clipId={clipId} platform={meta?.clipType ?? 'YOUTUBE_SHORTS'} onChange={setScheduledAt} />
                </div>

                {meta?.originalLanguage && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Original video language</p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5">
                      {LANGUAGES.find((l) => l.code === meta.originalLanguage)?.label ?? meta.originalLanguage}
                    </p>
                  </div>
                )}

                <div className="text-[11px] text-gray-400 space-y-1">
                  <p className="flex items-center gap-1"><Info className="w-3 h-3" /> Platform: {spec.name}</p>
                  <p className="flex items-center gap-1"><Hash className="w-3 h-3" /> Max {spec.maxHashtags} hashtags</p>
                </div>
              </div>

              {/* Right column: editable fields */}
              <div className="flex-1 p-5 space-y-4 min-w-0">

                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">{spec.titleLabel}</label>
                    <CharCounter val={title} max={spec.maxTitleChars} />
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Clip title…"
                    className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 transition-colors ${titleOver ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-200'}`}
                  />
                  {titleOver && <p className="text-[10px] text-red-500 mt-0.5">Title exceeds {spec.maxTitleChars} chars — trim to continue.</p>}
                </div>

                {/* Caption / Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">{spec.captionLabel}</label>
                    <CharCounter val={caption} max={spec.maxCaptionChars} />
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Description / caption…"
                    rows={5}
                    className={`w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 resize-none transition-colors ${captionOver ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-200'}`}
                  />
                  {captionOver && <p className="text-[10px] text-red-500 mt-0.5">Caption exceeds {spec.maxCaptionChars} chars — trim to continue.</p>}
                </div>

                {/* Hashtags */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">Hashtags</label>
                    <span className="text-[10px] text-gray-400">{tags.length}/{spec.maxHashtags}</span>
                  </div>
                  <HashtagInput tags={tags} onChange={setTags} max={spec.maxHashtags} />
                  <p className="text-[10px] text-gray-400 mt-1">Press Enter or comma to add · Backspace to remove last</p>
                </div>

                {/* Language row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                      <Globe className="w-3.5 h-3.5" /> Content language
                    </label>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200 appearance-none bg-white pr-8"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                      <Subtitles className="w-3.5 h-3.5" /> Subtitles language
                    </label>
                    <div className="relative">
                      <select
                        value={subtitleLang}
                        onChange={(e) => setSubtitleLang(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200 appearance-none bg-white pr-8"
                      >
                        <option value="auto">Auto (match content)</option>
                        {LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
                          <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                        <option value="none">No subtitles</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Platform tips */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTipsOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-500" /> {spec.name} best practices</span>
                    {tipsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {tipsOpen && (
                    <ul className="px-4 pb-3 space-y-1.5 border-t border-gray-50">
                      {spec.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-[11px] text-gray-600">
                          <span className="mt-0.5 text-brand-400">•</span> {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 space-y-3">
          {publish.isError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {(publish.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Publish failed — check Publish Hub for details.'}
            </p>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-brand-600"
            />
            <span className="text-xs text-gray-700">
              I confirm this content complies with <strong>{spec.name}</strong> community guidelines and copyright policies, and I have the rights to publish it.
            </span>
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => publish.mutate()}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: canSubmit ? spec.color : '#9ca3af' }}
              >
                {publish.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {scheduledAt ? 'Schedule' : 'Confirm & Publish'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center">
              {scheduledAt
                ? `Scheduled for ${new Date(scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                : 'Publishes immediately after compliance check'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
