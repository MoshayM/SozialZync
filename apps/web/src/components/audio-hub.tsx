'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Loader2, Trash2, Music, Plus, X, Play, Pause, Download, Search, TrendingUp,
  ChevronDown, Sparkles, Mic, Waves, Volume2, Scissors,
  CheckCircle, AlertCircle, ChevronUp, ArrowDown, Headphones,
} from 'lucide-react';
import { AiMediaPicker } from '@/components/ai-media-picker';
import { apiClient } from '@/lib/api';

// ── Shared helpers ────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

// ── Voice types & constants ───────────────────────────────────────────────────

interface Voice {
  id: string;
  source: 'elevenlabs' | 'openai';
  name: string;
  description: string;
  previewUrl: string | null;
  labels: Record<string, string>;
  gender?: string;
  accent?: string;
  age?: string;
  useCase?: string;
}

interface VoiceLibraryResponse { voices: Voice[]; }

const GENDER_OPTIONS = ['All', 'male', 'female', 'neutral'];
const USE_CASE_OPTIONS = ['All', 'narration', 'conversational', 'news', 'meditation', 'characters'];
const VOICE_SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'openai', label: 'OpenAI TTS' },
];
const ACCENT_COLORS: Record<string, string> = {
  american: '#2563eb', british: '#7c3aed', australian: '#d97706',
  indian: '#dc2626', irish: '#16a34a',
};

// ── Music types & constants ───────────────────────────────────────────────────

interface MusicTrack {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  duration: number;
  bpm?: number | null;
  mood: string[];
  genre: string[];
  license: string;
  licenseUrl?: string | null;
  source?: string | null;
  attribution?: string | null;
  fileUrl: string;
  previewUrl?: string | null;
  imageUrl?: string | null;
  isAiGenerated: boolean;
  createdAt: string;
}

interface ExternalTrack {
  externalId: string;
  source: 'jamendo' | 'pixabay';
  title: string;
  artist: string;
  album?: string;
  duration: number;
  bpm?: number;
  mood: string[];
  genre: string[];
  license: string;
  licenseUrl: string;
  audioUrl: string;
  previewUrl: string;
  imageUrl?: string;
  attribution: string;
  externalUrl: string;
}

interface TrackListResponse { tracks: MusicTrack[]; total: number; }

interface CreateTrackForm {
  title: string; artist: string; fileUrl: string; duration: string;
  license: string; source: string; attribution: string; mood: string; genre: string;
}

const LICENSE_OPTIONS = [
  { value: 'cc0', label: 'CC0 (Public Domain)' }, { value: 'cc-by', label: 'CC BY' },
  { value: 'cc-by-sa', label: 'CC BY-SA' }, { value: 'royalty-free', label: 'Royalty-Free' },
  { value: 'custom', label: 'Custom' },
];
const LICENSE_FILTER_CHIPS = [
  { value: '', label: 'All' }, { value: 'cc0', label: 'CC0' },
  { value: 'cc-by', label: 'CC BY' }, { value: 'cc-by-sa', label: 'CC BY-SA' },
  { value: 'royalty-free', label: 'Royalty-Free' },
];
const GENRE_OPTIONS = ['electronic', 'ambient', 'cinematic', 'jazz', 'classical', 'hiphop', 'pop', 'rock', 'acoustic', 'lofi'];
const MOOD_OPTIONS = ['energetic', 'calm', 'happy', 'sad', 'dramatic', 'romantic', 'tense', 'inspirational', 'playful', 'dark'];
const MUSIC_SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' }, { value: 'jamendo', label: 'Jamendo (CC)' },
  { value: 'pixabay', label: 'Pixabay (Free)' },
];
const LICENSE_COLORS: Record<string, string> = {
  'cc0': '#16a34a', 'cc-by': '#2563eb', 'cc-by-sa': '#7c3aed',
  'cc-by-nc': '#9333ea', 'cc-by-nc-sa': '#6d28d9', 'royalty-free': '#d97706', 'custom': '#6b7280',
};
const LICENSE_BG: Record<string, string> = {
  'cc0': '#f0fdf4', 'cc-by': '#eff6ff', 'cc-by-sa': '#f5f3ff',
  'cc-by-nc': '#faf5ff', 'cc-by-nc-sa': '#f5f3ff', 'royalty-free': '#fffbeb', 'custom': '#f9fafb',
};
const LICENSE_BORDER: Record<string, string> = {
  'cc0': '#bbf7d0', 'cc-by': '#bfdbfe', 'cc-by-sa': '#ddd6fe',
  'cc-by-nc': '#e9d5ff', 'cc-by-nc-sa': '#ddd6fe', 'royalty-free': '#fde68a', 'custom': '#e5e7eb',
};

function fmt(s: number): string {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function durationRange(f: string) {
  if (f === 'short') return { minDuration: undefined, maxDuration: 60 };
  if (f === 'medium') return { minDuration: 60, maxDuration: 180 };
  if (f === 'long') return { minDuration: 180, maxDuration: undefined };
  return { minDuration: undefined, maxDuration: undefined };
}

// ── Audio pipeline types ──────────────────────────────────────────────────────

interface StepResult { label: string; outPath: string; }
interface PipelineResult { steps: StepResult[]; finalPath: string; }

// ── Shared audio player (music tracks) ───────────────────────────────────────

function AudioPlayer({ url, trackId, playing, setPlaying }: {
  url: string; trackId: string;
  playing: string | null; setPlaying: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = playing === trackId;

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (isPlaying) { audio.src = url; audio.play().catch(() => {}); }
    else { audio.pause(); }
    return () => { audio.pause(); };
  }, [isPlaying, url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => setPlaying(null);
    audio.addEventListener('ended', onEnd);
    return () => audio.removeEventListener('ended', onEnd);
  }, [setPlaying]);

  return (
    <button
      onClick={() => setPlaying(isPlaying ? null : trackId)}
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105"
      style={{ background: isPlaying ? 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' : '#f5f2fd', border: '1.5px solid #e3ddf8' }}
      aria-label={isPlaying ? 'Pause' : 'Play preview'}
    >
      {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4" style={{ color: '#6D4AE0' }} />}
    </button>
  );
}

// ── Voice player ──────────────────────────────────────────────────────────────

function VoicePlayer({ url, voiceId, playing, setPlaying }: {
  url: string | null; voiceId: string;
  playing: string | null; setPlaying: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = playing === voiceId;

  useEffect(() => {
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (isPlaying) { audio.src = url; audio.play().catch(() => {}); }
    else { audio.pause(); }
    return () => { audio.pause(); };
  }, [isPlaying, url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => setPlaying(null);
    audio.addEventListener('ended', onEnd);
    return () => audio.removeEventListener('ended', onEnd);
  }, [setPlaying]);

  if (!url) return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb' }} title="No preview available">
      <Mic className="w-4 h-4 text-gray-300" />
    </div>
  );
  return (
    <button
      onClick={() => setPlaying(isPlaying ? null : voiceId)}
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105"
      style={{ background: isPlaying ? 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' : '#f5f2fd', border: '1.5px solid #e3ddf8' }}
      aria-label={isPlaying ? 'Pause preview' : 'Play voice preview'}
    >
      {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4" style={{ color: '#6D4AE0' }} />}
    </button>
  );
}

// ── Step card (audio pipeline) ────────────────────────────────────────────────

function StepCard({
  step, icon, label, description, color, bg, borderColor,
  enabled, onToggle, open, onOpenToggle, running, done, children,
}: {
  step: number; icon: React.ReactNode; label: string; description: string;
  color: string; bg: string; borderColor: string;
  enabled: boolean; onToggle: () => void;
  open: boolean; onOpenToggle: () => void;
  running: boolean; done: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ border: `1.5px solid ${enabled ? borderColor : '#e5e7eb'}`, background: enabled ? bg : '#f9fafb', opacity: enabled ? 1 : 0.6 }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold"
          style={{ background: enabled ? color : '#d1d5db', color: '#fff' }}>
          {done ? <CheckCircle className="w-4 h-4" /> : running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : step}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0" style={{ color: enabled ? color : '#9ca3af' }}>
          {icon}
          <span className="text-sm font-bold truncate">{label}</span>
        </div>
        <button type="button" onClick={onToggle}
          className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
          style={{ background: enabled ? color : '#d1d5db' }}
          aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}>
          <span className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5"
            style={{ marginLeft: enabled ? '18px' : '2px' }} />
        </button>
        {enabled && (
          <button type="button" onClick={onOpenToggle}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
      {enabled && open && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor }}>
          <p className="text-xs text-gray-500 pt-3">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

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

// ── Voices section ────────────────────────────────────────────────────────────

function VoicesSection({ selectedId, onSelect }: {
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [source, setSource] = useState<'all' | 'elevenlabs' | 'openai'>('all');
  const [genderFilter, setGenderFilter] = useState('All');
  const [useCaseFilter, setUseCaseFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showUseCaseFilter, setShowUseCaseFilter] = useState(false);

  const fetchVoices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (source !== 'all') params.set('source', source);
      const res = await fetch(`/api/v1/voice/library?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as VoiceLibraryResponse;
      setVoices(data.voices);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load voices'); }
    finally { setLoading(false); }
  }, [source]);

  useEffect(() => { void fetchVoices(); }, [fetchVoices]);

  const filtered = voices.filter(v => {
    if (genderFilter !== 'All' && v.gender !== genderFilter) return false;
    if (useCaseFilter !== 'All' && !v.useCase?.toLowerCase().includes(useCaseFilter)) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex flex-wrap gap-2 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voices…"
            className="bg-[#faf9ff] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
            style={{ border: '1.5px solid #e3ddf8', width: 180 }} />
          <select value={source} onChange={e => setSource(e.target.value as 'all' | 'elevenlabs' | 'openai')}
            className="bg-[#faf9ff] rounded-xl px-3 py-2 text-sm font-semibold outline-none"
            style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
            {VOICE_SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-1.5 flex-wrap">
            {GENDER_OPTIONS.map(g => (
              <button key={g} onClick={() => setGenderFilter(g)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize"
                style={genderFilter === g
                  ? { background: '#6D4AE0', color: '#fff', border: '1.5px solid #6D4AE0' }
                  : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' }}>
                {g}
              </button>
            ))}
          </div>
          <div className="relative">
            <button onClick={() => setShowUseCaseFilter(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: useCaseFilter !== 'All' ? '#6D4AE0' : '#faf9ff', color: useCaseFilter !== 'All' ? '#fff' : '#6b7280', border: '1.5px solid #e3ddf8' }}>
              {useCaseFilter === 'All' ? 'Use case' : useCaseFilter}<ChevronDown className="w-3 h-3" />
            </button>
            {showUseCaseFilter && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-lg p-2 flex flex-wrap gap-1 min-w-[180px]"
                style={{ border: '1.5px solid #e3ddf8' }}>
                {USE_CASE_OPTIONS.map(u => (
                  <button key={u} onClick={() => { setUseCaseFilter(u); setShowUseCaseFilter(false); }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={useCaseFilter === u ? { background: '#6D4AE0', color: '#fff' } : { color: '#374151', background: '#f5f2fd' }}>
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>
          {voices.length > 0 && <span className="text-xs text-gray-400 ml-auto">{filtered.length} voices</span>}
        </div>
      </div>

      {/* Voice grid */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading voices…</span>
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <Mic className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => void fetchVoices()} className="mt-3 text-xs font-semibold underline" style={{ color: '#6D4AE0' }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center"><Mic className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No voices found.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(voice => {
            const isSelected = selectedId === voice.id;
            return (
              <div key={voice.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all"
                style={{ border: `1.5px solid ${isSelected ? '#6D4AE0' : '#e3ddf8'}`, background: isSelected ? '#fdfcff' : '#fff' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
                    style={{
                      background: voice.source === 'elevenlabs' ? 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                      color: '#fff',
                    }}>
                    {voice.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{voice.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: voice.source === 'elevenlabs' ? '#f5f2fd' : '#eff6ff', color: voice.source === 'elevenlabs' ? '#6D4AE0' : '#2563eb', border: '1px solid #e3ddf8' }}>
                        {voice.source === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}
                      </span>
                      {voice.gender && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>{voice.gender}</span>
                      )}
                      {voice.accent && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                          style={{ background: '#f0f9ff', color: ACCENT_COLORS[voice.accent] ?? '#0369a1', border: '1px solid #bae6fd' }}>{voice.accent}</span>
                      )}
                    </div>
                  </div>
                </div>
                {voice.description && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{voice.description}</p>}
                {voice.useCase && <p className="text-[11px] text-purple-600 font-medium capitalize">Use case: {voice.useCase}</p>}
                <div className="flex items-center gap-2 pt-1 mt-auto">
                  <VoicePlayer url={voice.previewUrl} voiceId={voice.id} playing={playing} setPlaying={setPlaying} />
                  <span className="text-xs text-gray-400 flex-1">{voice.previewUrl ? 'Preview available' : 'No preview'}</span>
                  {isSelected ? (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                      style={{ background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' }}>
                      <CheckCircle className="w-3 h-3" />Selected
                    </span>
                  ) : (
                    <button onClick={() => onSelect(voice.id, voice.name)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 2px 8px rgba(109,74,224,.25)' }}>
                      Select
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Music section ─────────────────────────────────────────────────────────────

function MusicSection({ selectedId, onSelect }: {
  selectedId: string | null;
  onSelect: (id: string, title: string) => void;
}) {
  const [tab, setTab] = useState<'library' | 'discover' | 'ai'>('library');
  const [playing, setPlaying] = useState<string | null>(null);

  // Library state
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [availableMoods, setAvailableMoods] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTrackForm>({
    title: '', artist: '', fileUrl: '', duration: '', license: 'cc0', source: '', attribution: '', mood: '', genre: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Discover state
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverGenre, setDiscoverGenre] = useState('');
  const [discoverMood, setDiscoverMood] = useState('');
  const [discoverSource, setDiscoverSource] = useState<'all' | 'jamendo' | 'pixabay'>('all');
  const [discoverResults, setDiscoverResults] = useState<ExternalTrack[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [showGenreFilter, setShowGenreFilter] = useState(false);
  const [showMoodFilter, setShowMoodFilter] = useState(false);

  const fetchTracks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (licenseFilter) p.set('license', licenseFilter);
      if (moodFilter) p.set('mood', moodFilter);
      const { minDuration, maxDuration } = durationRange(durationFilter);
      if (minDuration != null) p.set('minDuration', String(minDuration));
      if (maxDuration != null) p.set('maxDuration', String(maxDuration));
      const res = await fetch(`/api/v1/music?${p}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TrackListResponse;
      setTracks(data.tracks); setTotal(data.total);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load tracks'); }
    finally { setLoading(false); }
  }, [search, licenseFilter, moodFilter, durationFilter]);

  const fetchMoods = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/music/moods', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setAvailableMoods(await res.json() as string[]);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void fetchTracks(); }, [fetchTracks]);
  useEffect(() => { void fetchMoods(); }, [fetchMoods]);

  const fetchDiscover = useCallback(async (isSearch = false) => {
    setDiscoverLoading(true); setDiscoverError(null);
    try {
      const p = new URLSearchParams();
      if (discoverQuery) p.set('q', discoverQuery);
      if (discoverGenre) p.set('genre', discoverGenre);
      if (discoverMood) p.set('mood', discoverMood);
      if (discoverSource !== 'all') p.set('source', discoverSource);
      p.set('limit', '30');
      const endpoint = (!discoverQuery && !discoverGenre && !discoverMood && !isSearch)
        ? '/api/v1/music/browse/trending'
        : `/api/v1/music/browse/search?${p}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiscoverResults(await res.json() as ExternalTrack[]);
    } catch (err) { setDiscoverError(err instanceof Error ? err.message : 'Failed to load'); }
    finally { setDiscoverLoading(false); }
  }, [discoverQuery, discoverGenre, discoverMood, discoverSource]);

  useEffect(() => { if (tab === 'discover') void fetchDiscover(); }, [tab, fetchDiscover]);

  async function handleImport(track: ExternalTrack) {
    setImportingId(track.externalId);
    try {
      const res = await fetch('/api/v1/music/browse/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(track),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setImportedIds(prev => new Set([...prev, track.externalId]));
    } catch { /* non-fatal */ }
    finally { setImportingId(null); }
  }

  function updateForm(field: keyof CreateTrackForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }
  async function handleAdd() {
    if (!form.title.trim() || !form.fileUrl.trim() || !form.duration.trim()) {
      setAddError('Title, File URL, and Duration are required.'); return;
    }
    const dur = parseInt(form.duration, 10);
    if (isNaN(dur) || dur <= 0) { setAddError('Duration must be a positive number of seconds.'); return; }
    setSubmitting(true); setAddError(null);
    try {
      const res = await fetch('/api/v1/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          title: form.title.trim(),
          ...(form.artist.trim() ? { artist: form.artist.trim() } : {}),
          fileUrl: form.fileUrl.trim(), duration: dur, license: form.license,
          ...(form.source.trim() ? { source: form.source.trim() } : {}),
          ...(form.attribution.trim() ? { attribution: form.attribution.trim() } : {}),
          mood: form.mood.trim() ? form.mood.split(',').map(s => s.trim()).filter(Boolean) : [],
          genre: form.genre.trim() ? form.genre.split(',').map(s => s.trim()).filter(Boolean) : [],
          tags: [],
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { message?: string }; throw new Error(d.message ?? `HTTP ${res.status}`); }
      setForm({ title: '', artist: '', fileUrl: '', duration: '', license: 'cc0', source: '', attribution: '', mood: '', genre: '' });
      setShowAddForm(false); void fetchTracks(); void fetchMoods();
    } catch (err) { setAddError(err instanceof Error ? err.message : 'Failed to add track'); }
    finally { setSubmitting(false); }
  }
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/music/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      setTracks(prev => prev.filter(t => t.id !== id)); setTotal(prev => prev - 1);
      if (selectedId === id) onSelect('', '');
    } catch { /* non-fatal */ }
    finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Inner tab bar */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f0edf9' }}>
          {(['library', 'discover', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all shrink-0"
              style={tab === t ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' } : { color: '#9b8fc4' }}>
              {t === 'library' ? <span className="flex items-center gap-1.5"><Music className="w-3.5 h-3.5" />My Library{total > 0 && <span className="text-[11px] bg-purple-100 text-purple-700 rounded-full px-1.5">{total}</span>}</span>
                : t === 'discover' ? <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Discover</span>
                  : <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />AI Match</span>}
            </button>
          ))}
        </div>
        {tab === 'library' && (
          <button onClick={() => { setShowAddForm(v => !v); setAddError(null); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.35)' }}>
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddForm ? 'Cancel' : 'Import Track'}
          </button>
        )}
      </div>

      {/* ── My Library ── */}
      {tab === 'library' && (
        <>
          {showAddForm && (
            <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
              <p className="text-sm font-semibold text-gray-800">Import a track manually</p>
              {addError && <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>{addError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { field: 'title' as const, label: 'Title *', placeholder: 'Track title' },
                  { field: 'artist' as const, label: 'Artist', placeholder: 'Artist name' },
                ]).map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input value={form[field]} onChange={e => updateForm(field, e.target.value)} placeholder={placeholder}
                      className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }} />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">File URL or path *</label>
                  <input value={form.fileUrl} onChange={e => updateForm('fileUrl', e.target.value)} placeholder="https://example.com/track.mp3"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 font-mono" style={{ border: '1.5px solid #e3e0f0' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration (seconds) *</label>
                  <input type="number" min={1} value={form.duration} onChange={e => updateForm('duration', e.target.value)} placeholder="180"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">License</label>
                  <select value={form.license} onChange={e => updateForm('license', e.target.value)}
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }}>
                    {LICENSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mood tags (comma-separated)</label>
                  <input value={form.mood} onChange={e => updateForm('mood', e.target.value)} placeholder="energetic, calm, upbeat"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Genre tags (comma-separated)</label>
                  <input value={form.genre} onChange={e => updateForm('genre', e.target.value)} placeholder="electronic, ambient"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source URL</label>
                  <input value={form.source} onChange={e => updateForm('source', e.target.value)} placeholder="freemusicarchive.org"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Attribution text</label>
                  <input value={form.attribution} onChange={e => updateForm('attribution', e.target.value)} placeholder="Music by Artist (CC BY)"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3e0f0' }} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setShowAddForm(false); setAddError(null); }} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ border: '1.5px solid #e3ddf8' }}>Cancel</button>
                <button onClick={() => void handleAdd()} disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.35)' }}>
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Import Track
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks…"
              className="bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20"
              style={{ border: '1.5px solid #e3ddf8', width: 200 }} />
            <div className="flex flex-wrap gap-1.5">
              {LICENSE_FILTER_CHIPS.map(chip => (
                <button key={chip.value} onClick={() => setLicenseFilter(chip.value)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={licenseFilter === chip.value
                    ? { background: '#6D4AE0', color: '#fff', border: '1.5px solid #6D4AE0' }
                    : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' }}>
                  {chip.label}
                </button>
              ))}
            </div>
            {availableMoods.length > 0 && (
              <select value={moodFilter} onChange={e => setMoodFilter(e.target.value)}
                className="bg-white rounded-xl px-3 py-1.5 text-xs font-semibold outline-none"
                style={{ border: '1.5px solid #e3ddf8', color: moodFilter ? '#6D4AE0' : '#6b7280' }}>
                <option value="">All moods</option>
                {availableMoods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>

          {/* Track list */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            {loading && tracks.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span></div>
            ) : error ? (
              <div className="py-16 text-center"><Music className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-red-500">{error}</p><button onClick={() => void fetchTracks()} className="mt-3 text-xs font-semibold underline" style={{ color: '#6D4AE0' }}>Retry</button></div>
            ) : tracks.length === 0 ? (
              <div className="py-16 text-center"><Music className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No tracks found.</p><p className="text-xs text-gray-400 mt-1">Use Discover tab to browse &amp; import royalty-free music.</p></div>
            ) : tracks.map((track, idx) => {
              const isSelected = selectedId === track.id;
              return (
                <div key={track.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff] transition-colors"
                  style={{ borderBottom: idx < tracks.length - 1 ? '1px solid #f0edf9' : 'none', background: isSelected ? '#fdfcff' : undefined }}>
                  <AudioPlayer url={track.previewUrl ?? track.fileUrl} trackId={track.id} playing={playing} setPlaying={setPlaying} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">{track.title}</p>
                      {track.artist && <span className="text-xs text-gray-400 truncate">{track.artist}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono">{fmt(track.duration)}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: LICENSE_BG[track.license] ?? '#f9fafb', color: LICENSE_COLORS[track.license] ?? '#6b7280', border: `1.5px solid ${LICENSE_BORDER[track.license] ?? '#e5e7eb'}` }}>
                        {track.license}
                      </span>
                      {track.mood.slice(0, 3).map(m => (
                        <span key={m} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>{m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected ? (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' }}>
                        <CheckCircle className="w-3 h-3" />In use
                      </span>
                    ) : (
                      <button onClick={() => onSelect(track.id, track.title)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 2px 8px rgba(109,74,224,.25)' }}>
                        Use
                      </button>
                    )}
                    <button onClick={() => { if (window.confirm(`Delete "${track.title}"?`)) void handleDelete(track.id); }}
                      disabled={deletingId === track.id}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
                      style={{ border: '1.5px solid #e3ddf8' }} aria-label={`Delete ${track.title}`}>
                      {deletingId === track.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Discover ── */}
      {tab === 'discover' && (
        <>
          <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 relative min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input value={discoverQuery} onChange={e => setDiscoverQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void fetchDiscover(true); }}
                  placeholder="Search royalty-free music…"
                  className="w-full bg-[#faf9ff] rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3ddf8' }} />
              </div>
              <button onClick={() => void fetchDiscover(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.25)' }}>
                Search
              </button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={discoverSource} onChange={e => setDiscoverSource(e.target.value as 'all' | 'jamendo' | 'pixabay')}
                className="bg-[#faf9ff] rounded-xl px-3 py-1.5 text-xs font-semibold outline-none" style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
                {MUSIC_SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="relative">
                <button onClick={() => setShowGenreFilter(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: discoverGenre ? '#6D4AE0' : '#faf9ff', color: discoverGenre ? '#fff' : '#6b7280', border: '1.5px solid #e3ddf8' }}>
                  {discoverGenre || 'Genre'}<ChevronDown className="w-3 h-3" />
                </button>
                {showGenreFilter && (
                  <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-lg p-2 flex flex-wrap gap-1 min-w-[200px]" style={{ border: '1.5px solid #e3ddf8' }}>
                    <button onClick={() => { setDiscoverGenre(''); setShowGenreFilter(false); }} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50">All</button>
                    {GENRE_OPTIONS.map(g => (
                      <button key={g} onClick={() => { setDiscoverGenre(g); setShowGenreFilter(false); }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize"
                        style={discoverGenre === g ? { background: '#6D4AE0', color: '#fff' } : { color: '#374151', background: '#f5f2fd' }}>
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => setShowMoodFilter(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: discoverMood ? '#6D4AE0' : '#faf9ff', color: discoverMood ? '#fff' : '#6b7280', border: '1.5px solid #e3ddf8' }}>
                  {discoverMood || 'Mood'}<ChevronDown className="w-3 h-3" />
                </button>
                {showMoodFilter && (
                  <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-lg p-2 flex flex-wrap gap-1 min-w-[200px]" style={{ border: '1.5px solid #e3ddf8' }}>
                    <button onClick={() => { setDiscoverMood(''); setShowMoodFilter(false); }} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50">All</button>
                    {MOOD_OPTIONS.map(m => (
                      <button key={m} onClick={() => { setDiscoverMood(m); setShowMoodFilter(false); }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize"
                        style={discoverMood === m ? { background: '#6D4AE0', color: '#fff' } : { color: '#374151', background: '#f5f2fd' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(discoverGenre || discoverMood || discoverQuery) && (
                <button onClick={() => { setDiscoverQuery(''); setDiscoverGenre(''); setDiscoverMood(''); void fetchDiscover(); }}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100" style={{ border: '1.5px solid #e3ddf8' }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          {discoverLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Browsing royalty-free music…</span></div>
          ) : discoverError ? (
            <div className="py-16 text-center">
              <Music className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-red-500">{discoverError}</p>
              <button onClick={() => void fetchDiscover()} className="mt-3 text-xs font-semibold underline" style={{ color: '#6D4AE0' }}>Retry</button>
            </div>
          ) : discoverResults.length === 0 ? (
            <div className="py-16 text-center"><Music className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No results. Try a different search or genre.</p></div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 px-1">{discoverResults.length} tracks — preview, then Import to save to your library</p>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                {discoverResults.map((track, idx) => {
                  const imported = importedIds.has(track.externalId);
                  const isImporting = importingId === track.externalId;
                  return (
                    <div key={track.externalId} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff] transition-colors"
                      style={{ borderBottom: idx < discoverResults.length - 1 ? '1px solid #f0edf9' : 'none' }}>
                      {track.imageUrl ? (
                        <img src={track.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#f5f2fd' }}>
                          <Music className="w-4 h-4" style={{ color: '#6D4AE0' }} />
                        </div>
                      )}
                      <AudioPlayer url={track.previewUrl} trackId={track.externalId} playing={playing} setPlaying={setPlaying} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800 truncate">{track.title}</p>
                          <span className="text-xs text-gray-400 truncate">{track.artist}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500 font-mono">{fmt(track.duration)}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: LICENSE_BG[track.license] ?? '#fffbeb', color: LICENSE_COLORS[track.license] ?? '#d97706', border: `1.5px solid ${LICENSE_BORDER[track.license] ?? '#fde68a'}` }}>
                            {track.license}
                          </span>
                          {track.mood.slice(0, 2).map(m => (
                            <span key={m} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>{m}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={track.externalUrl} target="_blank" rel="noopener noreferrer"
                          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50" title="View source">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => !imported && void handleImport(track)} disabled={imported || isImporting}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                          style={imported
                            ? { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' }
                            : { background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', color: '#fff', boxShadow: '0 2px 8px rgba(109,74,224,.3)' }}>
                          {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {imported ? '✓ Saved' : isImporting ? 'Saving…' : '+ Import'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AI Match ── */}
      {tab === 'ai' && (
        <AiMediaPicker
          onMusicAccepted={(trackId) => {
            void fetchTracks().then(() => setTab('library'));
            void console.log('Music accepted:', trackId);
          }}
        />
      )}
    </div>
  );
}

// ── Tools section (audio processing pipeline) ─────────────────────────────────

function ToolsSection({ selectedVoiceName, selectedTrackTitle }: {
  selectedVoiceName: string | null;
  selectedTrackTitle: string | null;
}) {
  const [inputPath, setInputPath] = useState('');
  const [trimEnabled, setTrimEnabled] = useState(true);
  const [denoiseEnabled, setDenoiseEnabled] = useState(true);
  const [normalizeEnabled, setNormalizeEnabled] = useState(true);
  const [thresholdDb, setThresholdDb] = useState(-35);
  const [denoiseStrength, setDenoiseStrength] = useState<'light' | 'medium' | 'strong'>('medium');
  const [targetLufs, setTargetLufs] = useState(-14);
  const [trimOpen, setTrimOpen] = useState(true);
  const [denoiseOpen, setDenoiseOpen] = useState(true);
  const [normalizeOpen, setNormalizeOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<'trim' | 'denoise' | 'normalize' | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledCount = [trimEnabled, denoiseEnabled, normalizeEnabled].filter(Boolean).length;

  async function runPipeline() {
    if (!inputPath.trim()) { setError('Enter a file path first'); return; }
    if (enabledCount === 0) { setError('Enable at least one processing step'); return; }
    setLoading(true); setResult(null); setError(null);
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
    } finally { setLoading(false); setActiveStep(null); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Voice context card */}
      {selectedVoiceName && (
        <div className="rounded-2xl p-3 flex items-center gap-2.5" style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}>
          <Mic className="w-4 h-4 shrink-0" style={{ color: '#6D4AE0' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#6D4AE0' }}>Voice: {selectedVoiceName}</p>
            <p className="text-[11px] text-purple-500">Generate a voice recording first, then paste the output path below.</p>
          </div>
        </div>
      )}

      {/* File input */}
      <div className="bg-white rounded-2xl p-4 space-y-2" style={{ border: '1.5px solid #e3ddf8' }}>
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block">Audio / Video File Path</label>
        <input
          type="text" value={inputPath}
          onChange={e => { setInputPath(e.target.value); setResult(null); setError(null); }}
          placeholder="/data/projects/my-recording.mp4"
          className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all font-mono"
          style={{ borderColor: '#d4c9f9' }}
        />
        <p className="text-[11px] text-gray-400">Server-side absolute path — output is saved alongside with a suffix.</p>
      </div>

      {/* Pipeline steps */}
      <StepCard step={1} icon={<Scissors className="w-4 h-4" />} label="Silence Trimmer"
        description="Remove long silent gaps from the recording."
        color="#16a34a" bg="#f0fdf4" borderColor="#bbf7d0"
        enabled={trimEnabled} onToggle={() => setTrimEnabled(v => !v)}
        open={trimOpen} onOpenToggle={() => setTrimOpen(v => !v)}
        running={activeStep === 'trim'} done={!!result?.steps.find(s => s.label === 'Silence trimmed')}>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Silence threshold</label>
          <div className="flex items-center gap-3">
            <input type="range" min={-60} max={-20} value={thresholdDb}
              onChange={e => setThresholdDb(Number(e.target.value))} className="flex-1" disabled={!trimEnabled} />
            <span className="text-sm font-bold w-16 text-right" style={{ color: '#16a34a' }}>{thresholdDb} dB</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">-35 dB is a good default for voice recordings.</p>
        </div>
      </StepCard>

      <StepConnector />

      <StepCard step={2} icon={<Waves className="w-4 h-4" />} label="Noise Removal"
        description="Remove background hiss, hum, and room noise."
        color="#0891b2" bg="#ecfeff" borderColor="#a5f3fc"
        enabled={denoiseEnabled} onToggle={() => setDenoiseEnabled(v => !v)}
        open={denoiseOpen} onOpenToggle={() => setDenoiseOpen(v => !v)}
        running={activeStep === 'denoise'} done={!!result?.steps.find(s => s.label === 'Noise removed')}>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Reduction strength</label>
          <div className="flex gap-2">
            {(['light', 'medium', 'strong'] as const).map(s => (
              <button key={s} onClick={() => setDenoiseStrength(s)} disabled={!denoiseEnabled}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors capitalize disabled:opacity-40"
                style={denoiseStrength === s
                  ? { background: '#0891b2', color: 'white', borderColor: '#0891b2' }
                  : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </StepCard>

      <StepConnector />

      <StepCard step={3} icon={<Volume2 className="w-4 h-4" />} label="Loudness Normalize"
        description="Set final volume to YouTube standard (-14 LUFS)."
        color="#6D4AE0" bg="#f5f2fd" borderColor="#ddd6fe"
        enabled={normalizeEnabled} onToggle={() => setNormalizeEnabled(v => !v)}
        open={normalizeOpen} onOpenToggle={() => setNormalizeOpen(v => !v)}
        running={activeStep === 'normalize'} done={!!result?.steps.find(s => s.label === 'Loudness normalized')}>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5">Target loudness</label>
          <div className="flex items-center gap-3">
            <input type="range" min={-24} max={-9} value={targetLufs}
              onChange={e => setTargetLufs(Number(e.target.value))} className="flex-1" disabled={!normalizeEnabled} />
            <span className="text-sm font-bold w-14 text-right" style={{ color: '#6D4AE0' }}>{targetLufs} LUFS</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
            <span>Quiet (-24)</span><span>YouTube (-14) ★</span><span>Loud (-9)</span>
          </div>
        </div>
      </StepCard>

      {/* Run button */}
      <button onClick={() => void runPipeline()}
        disabled={loading || enabledCount === 0 || !inputPath.trim()}
        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}>
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
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
        </div>
      )}

      {/* Music context card (shown after result or always if track selected) */}
      {selectedTrackTitle && (
        <div className="rounded-2xl p-3 flex items-center gap-2.5" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
          <Music className="w-4 h-4 shrink-0 text-green-600" />
          <div>
            <p className="text-xs font-semibold text-green-700">Music: {selectedTrackTitle}</p>
            <p className="text-[11px] text-green-600">This track will be available to attach at the publish stage.</p>
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

// ── Audio Hub (main export) ───────────────────────────────────────────────────

const AUDIO_SECTIONS = [
  { id: 'voices' as const, label: 'Voices',      icon: Mic },
  { id: 'music'  as const, label: 'Music',        icon: Music },
  { id: 'tools'  as const, label: 'Audio Tools',  icon: Waves },
];

export function AudioHub() {
  const [section, setSection] = useState<'voices' | 'music' | 'tools'>('voices');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedTrackTitle, setSelectedTrackTitle] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f0edf9' }}>
        {AUDIO_SECTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSection(id)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
            style={section === id
              ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' }
              : { color: '#9b8fc4' }}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {section === 'voices' && (
        <VoicesSection
          selectedId={selectedVoiceId}
          onSelect={(id, name) => { setSelectedVoiceId(id); setSelectedVoiceName(name); }}
        />
      )}
      {section === 'music' && (
        <MusicSection
          selectedId={selectedTrackId}
          onSelect={(id, title) => { setSelectedTrackId(id); setSelectedTrackTitle(title); }}
        />
      )}
      {section === 'tools' && (
        <ToolsSection selectedVoiceName={selectedVoiceName} selectedTrackTitle={selectedTrackTitle} />
      )}
    </div>
  );
}
