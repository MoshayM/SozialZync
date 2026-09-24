'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X, Loader2, CheckCircle2, AlertCircle, Calendar, Globe, Subtitles,
  Hash, ChevronDown, ChevronUp, Zap, Upload, Info,
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

// ── Thumbnail grid ────────────────────────────────────────────────────────────

interface Thumbnail { id: string; url: string; isPrimary: boolean; timestamp?: number }

function ThumbnailPicker({ clipId, selectedId, onSelect }: { clipId: string; selectedId: string | null; onSelect: (id: string, url: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['thumbnails', clipId],
    queryFn: () => api.shortsStudio.thumbnails(clipId).then((r) => r.data as Thumbnail[]),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!data?.length) return <p className="text-xs text-gray-500 italic">No thumbnails generated yet — default frame will be used.</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {data.map((t) => {
        const active = selectedId ? selectedId === t.id : t.isPrimary;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id, t.url)}
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
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [selectedThumbId, setSelectedThumbId] = useState<string | null>(null);
  const [selectedThumbUrl, setSelectedThumbUrl] = useState<string | null>(null);

  // Fetch AI-generated metadata
  const { data: meta, isLoading: metaLoading, isError: metaError } = useQuery({
    queryKey: ['publish-meta', clipId],
    queryFn: () => api.shortsStudio.publishMeta(clipId).then((r) => r.data as PublishMeta),
    staleTime: 60 * 1000,
  });

  // Populate form fields once meta loads
  useEffect(() => {
    if (!meta) return;
    setTitle(meta.title);
    setCaption(meta.description);
    setTags(meta.tags.slice(0, spec.maxHashtags));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const spec: PlatformSpec = PLATFORM[meta?.clipType ?? 'YOUTUBE_SHORTS'] ?? PLATFORM['YOUTUBE_SHORTS']!;

  // Escape key
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
        scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
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

              {/* Left: thumbnail + original info */}
              <div className="md:w-56 shrink-0 p-5 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Thumbnail</p>
                  <ThumbnailPicker
                    clipId={clipId}
                    selectedId={selectedThumbId}
                    onSelect={(id, url) => { setSelectedThumbId(id); setSelectedThumbUrl(url); }}
                  />
                </div>
                {selectedThumbUrl && (
                  <p className="text-[10px] text-brand-600">✓ Thumbnail selected</p>
                )}
                {meta?.originalLanguage && (
                  <div className="pt-1">
                    <p className="text-xs font-medium text-gray-600 mb-1">Original video language</p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5">
                      {LANGUAGES.find((l) => l.code === meta.originalLanguage)?.label ?? meta.originalLanguage}
                    </p>
                  </div>
                )}
                <div className="pt-1 text-[11px] text-gray-400 space-y-1">
                  <p className="flex items-center gap-1"><Info className="w-3 h-3" /> Platform: {spec.name}</p>
                  <p className="flex items-center gap-1"><Hash className="w-3 h-3" /> Max {spec.maxHashtags} hashtags</p>
                </div>
              </div>

              {/* Right: editable fields */}
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

                {/* Schedule */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Schedule
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleEnabled}
                        onChange={(e) => setScheduleEnabled(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-brand-600"
                      />
                      <span className="text-xs text-gray-600">Publish at a specific time</span>
                    </label>
                  </div>
                  {scheduleEnabled && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  )}
                  {!scheduleEnabled && (
                    <p className="text-[11px] text-gray-400">Will publish immediately after compliance check.</p>
                  )}
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
          <div className="flex items-center justify-end gap-3">
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
              style={{ background: canSubmit ? spec.color : undefined, backgroundColor: canSubmit ? undefined : '#9ca3af' }}
            >
              {publish.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {scheduleEnabled ? 'Schedule' : 'Confirm & Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
