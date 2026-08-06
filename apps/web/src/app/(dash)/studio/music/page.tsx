'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Trash2, Music, Plus, X, Play, Pause, Download, Search, TrendingUp, ChevronDown, Sparkles } from 'lucide-react';
import { AiMediaPicker } from '@/components/ai-media-picker';

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const LICENSE_OPTIONS = [
  { value: 'cc0', label: 'CC0 (Public Domain)' },
  { value: 'cc-by', label: 'CC BY' },
  { value: 'cc-by-sa', label: 'CC BY-SA' },
  { value: 'royalty-free', label: 'Royalty-Free' },
  { value: 'custom', label: 'Custom' },
];
const LICENSE_FILTER_CHIPS = [
  { value: '', label: 'All' }, { value: 'cc0', label: 'CC0' },
  { value: 'cc-by', label: 'CC BY' }, { value: 'cc-by-sa', label: 'CC BY-SA' },
  { value: 'royalty-free', label: 'Royalty-Free' },
];
const GENRE_OPTIONS = ['electronic', 'ambient', 'cinematic', 'jazz', 'classical', 'hiphop', 'pop', 'rock', 'acoustic', 'lofi'];
const MOOD_OPTIONS = ['energetic', 'calm', 'happy', 'sad', 'dramatic', 'romantic', 'tense', 'inspirational', 'playful', 'dark'];
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'jamendo', label: 'Jamendo (CC)' },
  { value: 'pixabay', label: 'Pixabay (Free)' },
];

const LICENSE_COLORS: Record<string, string> = {
  'cc0': '#16a34a', 'cc-by': '#2563eb', 'cc-by-sa': '#7c3aed',
  'cc-by-nc': '#9333ea', 'cc-by-nc-sa': '#6d28d9',
  'royalty-free': '#d97706', 'custom': '#6b7280',
};
const LICENSE_BG: Record<string, string> = {
  'cc0': '#f0fdf4', 'cc-by': '#eff6ff', 'cc-by-sa': '#f5f3ff',
  'cc-by-nc': '#faf5ff', 'cc-by-nc-sa': '#f5f3ff',
  'royalty-free': '#fffbeb', 'custom': '#f9fafb',
};
const LICENSE_BORDER: Record<string, string> = {
  'cc0': '#bbf7d0', 'cc-by': '#bfdbfe', 'cc-by-sa': '#ddd6fe',
  'cc-by-nc': '#e9d5ff', 'cc-by-nc-sa': '#ddd6fe',
  'royalty-free': '#fde68a', 'custom': '#e5e7eb',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number): string {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}
function durationRange(f: string) {
  if (f === 'short') return { minDuration: undefined, maxDuration: 60 };
  if (f === 'medium') return { minDuration: 60, maxDuration: 180 };
  if (f === 'long') return { minDuration: 180, maxDuration: undefined };
  return { minDuration: undefined, maxDuration: undefined };
}

// ── Mini Audio Player ─────────────────────────────────────────────────────────

function AudioPlayer({ url, trackId, playing, setPlaying }: {
  url: string; trackId: string;
  playing: string | null; setPlaying: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = playing === trackId;

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (isPlaying) {
      audio.src = url;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
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
      {isPlaying
        ? <Pause className="w-4 h-4 text-white" />
        : <Play className="w-4 h-4" style={{ color: '#6D4AE0' }} />}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MusicLibraryPage() {
  const [tab, setTab] = useState<'library' | 'discover' | 'ai'>('library');
  const [playing, setPlaying] = useState<string | null>(null);

  // ── My Library state ──────────────────────────────────────────────────────
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

  // ── Discover state ────────────────────────────────────────────────────────
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

  // ── Library fetch ─────────────────────────────────────────────────────────
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
      const res = await fetch(`/api/proxy/music?${p}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TrackListResponse;
      setTracks(data.tracks); setTotal(data.total);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load tracks'); }
    finally { setLoading(false); }
  }, [search, licenseFilter, moodFilter, durationFilter]);

  const fetchMoods = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/music/moods', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setAvailableMoods(await res.json() as string[]);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void fetchTracks(); }, [fetchTracks]);
  useEffect(() => { void fetchMoods(); }, [fetchMoods]);

  // ── Discover fetch ────────────────────────────────────────────────────────
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
        ? '/api/proxy/music/browse/trending'
        : `/api/proxy/music/browse/search?${p}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiscoverResults(await res.json() as ExternalTrack[]);
    } catch (err) { setDiscoverError(err instanceof Error ? err.message : 'Failed to load'); }
    finally { setDiscoverLoading(false); }
  }, [discoverQuery, discoverGenre, discoverMood, discoverSource]);

  useEffect(() => { if (tab === 'discover') void fetchDiscover(); }, [tab, fetchDiscover]);

  // ── Import external track ─────────────────────────────────────────────────
  async function handleImport(track: ExternalTrack) {
    setImportingId(track.externalId);
    try {
      const res = await fetch('/api/proxy/music/browse/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(track),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setImportedIds(prev => new Set([...prev, track.externalId]));
    } catch {
      /* non-fatal */
    } finally { setImportingId(null); }
  }

  // ── Manual library add ────────────────────────────────────────────────────
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
      const res = await fetch('/api/proxy/music', {
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
      const res = await fetch(`/api/proxy/music/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      setTracks(prev => prev.filter(t => t.id !== id)); setTotal(prev => prev - 1);
    } catch { /* non-fatal */ }
    finally { setDeletingId(null); }
  }

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Music className="w-5 h-5" style={{ color: '#6D4AE0' }} />
              <h1 className="text-2xl font-extrabold text-gray-900">Music Library</h1>
            </div>
            <p className="text-sm text-gray-500">Royalty-free &amp; CC-licensed music for your videos</p>
          </div>
          {tab === 'library' && (
            <button
              onClick={() => { setShowAddForm(v => !v); setAddError(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.35)' }}
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddForm ? 'Cancel' : 'Import Track'}
            </button>
          )}
        </div>

        {/* ── Tab switcher ─────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full" style={{ background: '#f0edf9', WebkitOverflowScrolling: 'touch' }}>
          {(['library', 'discover', 'ai'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
              style={tab === t
                ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' }
                : { color: '#9b8fc4' }}
            >
              {t === 'library' ? (
                <span className="flex items-center gap-1.5"><Music className="w-3.5 h-3.5" />My Library {total > 0 && <span className="text-[11px] bg-purple-100 text-purple-700 rounded-full px-1.5">{total}</span>}</span>
              ) : t === 'discover' ? (
                <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Discover</span>
              ) : (
                <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />AI Match</span>
              )}
            </button>
          ))}
        </div>

        {/* ════════════════════ MY LIBRARY TAB ════════════════════════════════ */}
        {tab === 'library' && (
          <>
            {/* Manual import form */}
            {showAddForm && (
              <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
                <p className="text-sm font-semibold text-gray-800">Import a track manually</p>
                {addError && <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>{addError}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { field: 'title' as const, label: 'Title *', placeholder: 'Track title' },
                    { field: 'artist' as const, label: 'Artist', placeholder: 'Artist name' },
                  ].map(({ field, label, placeholder }) => (
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

            {/* Search + filters */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks…"
                  className="bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3ddf8', width: 200 }} />
                <div className="flex flex-wrap gap-1.5">
                  {LICENSE_FILTER_CHIPS.map(chip => (
                    <button key={chip.value} onClick={() => setLicenseFilter(chip.value)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={licenseFilter === chip.value ? { background: '#6D4AE0', color: '#fff', border: '1.5px solid #6D4AE0' } : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' }}>
                      {chip.label}
                    </button>
                  ))}
                </div>
                {availableMoods.length > 0 && (
                  <select value={moodFilter} onChange={e => setMoodFilter(e.target.value)}
                    className="bg-white rounded-xl px-3 py-1.5 text-xs font-semibold outline-none" style={{ border: '1.5px solid #e3ddf8', color: moodFilter ? '#6D4AE0' : '#6b7280' }}>
                    <option value="">All moods</option>
                    {availableMoods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Track list */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
              {loading && tracks.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span></div>
              ) : error ? (
                <div className="py-16 text-center"><Music className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-red-500">{error}</p><button onClick={() => void fetchTracks()} className="mt-3 text-xs font-semibold underline" style={{ color: '#6D4AE0' }}>Retry</button></div>
              ) : tracks.length === 0 ? (
                <div className="py-16 text-center"><Music className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No tracks found.</p><p className="text-xs text-gray-400 mt-1">Use Discover tab to browse &amp; import royalty-free music.</p></div>
              ) : tracks.map((track, idx) => (
                <div key={track.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff] transition-colors"
                  style={{ borderBottom: idx < tracks.length - 1 ? '1px solid #f0edf9' : 'none' }}>
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
                    {track.attribution && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{track.attribution}</p>}
                  </div>
                  <button onClick={() => { if (window.confirm(`Delete "${track.title}"?`)) void handleDelete(track.id); }}
                    disabled={deletingId === track.id}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
                    style={{ border: '1.5px solid #e3ddf8' }} aria-label={`Delete ${track.title}`}>
                    {deletingId === track.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════ DISCOVER TAB ══════════════════════════════════ */}
        {tab === 'discover' && (
          <>
            {/* Search bar */}
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
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.25)' }}>
                  Search
                </button>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Source */}
                <select value={discoverSource} onChange={e => setDiscoverSource(e.target.value as 'all' | 'jamendo' | 'pixabay')}
                  className="bg-[#faf9ff] rounded-xl px-3 py-1.5 text-xs font-semibold outline-none" style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
                  {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* Genre dropdown */}
                <div className="relative">
                  <button onClick={() => setShowGenreFilter(v => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: discoverGenre ? '#6D4AE0' : '#faf9ff', color: discoverGenre ? '#fff' : '#6b7280', border: '1.5px solid #e3ddf8' }}>
                    {discoverGenre || 'Genre'}<ChevronDown className="w-3 h-3" />
                  </button>
                  {showGenreFilter && (
                    <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-lg p-2 flex flex-wrap gap-1 min-w-[200px]" style={{ border: '1.5px solid #e3ddf8' }}>
                      <button onClick={() => { setDiscoverGenre(''); setShowGenreFilter(false); }} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50">All</button>
                      {GENRE_OPTIONS.map(g => (
                        <button key={g} onClick={() => { setDiscoverGenre(g); setShowGenreFilter(false); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                          style={discoverGenre === g ? { background: '#6D4AE0', color: '#fff' } : { color: '#374151', background: '#f5f2fd' }}>
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mood dropdown */}
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
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                          style={discoverMood === m ? { background: '#6D4AE0', color: '#fff' } : { color: '#374151', background: '#f5f2fd' }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(discoverGenre || discoverMood || discoverQuery) && (
                  <button onClick={() => { setDiscoverQuery(''); setDiscoverGenre(''); setDiscoverMood(''); void fetchDiscover(); }}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors" style={{ border: '1.5px solid #e3ddf8' }}>
                    Clear
                  </button>
                )}

                <span className="ml-auto text-xs text-gray-400 hidden sm:block">
                  Sources: Jamendo (Creative Commons) · Pixabay (Royalty-Free)
                </span>
              </div>
            </div>

            {/* Results */}
            {discoverLoading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Browsing royalty-free music…</span></div>
            ) : discoverError ? (
              <div className="py-16 text-center">
                <Music className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-red-500">{discoverError}</p>
                <p className="text-xs text-gray-400 mt-1">Check that JAMENDO_CLIENT_ID is set in your environment.</p>
                <button onClick={() => void fetchDiscover()} className="mt-3 text-xs font-semibold underline" style={{ color: '#6D4AE0' }}>Retry</button>
              </div>
            ) : discoverResults.length === 0 ? (
              <div className="py-16 text-center"><Music className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No results. Try a different search or genre.</p></div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 px-1">{discoverResults.length} tracks found — click Play to preview, then Import to save to your library</p>
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                  {discoverResults.map((track, idx) => {
                    const imported = importedIds.has(track.externalId);
                    const isImporting = importingId === track.externalId;
                    return (
                      <div key={track.externalId} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff] transition-colors"
                        style={{ borderBottom: idx < discoverResults.length - 1 ? '1px solid #f0edf9' : 'none' }}>
                        {/* Artwork */}
                        {track.imageUrl ? (
                          <img src={track.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#f5f2fd' }}>
                            <Music className="w-4 h-4" style={{ color: '#6D4AE0' }} />
                          </div>
                        )}
                        {/* Play */}
                        <AudioPlayer url={track.previewUrl} trackId={track.externalId} playing={playing} setPlaying={setPlaying} />
                        {/* Info */}
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
                            <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: track.source === 'jamendo' ? '#eff6ff' : '#f0fdf4', color: track.source === 'jamendo' ? '#2563eb' : '#16a34a', border: '1px solid #e3ddf8' }}>
                              {track.source}
                            </span>
                            {track.mood.slice(0, 2).map(m => (
                              <span key={m} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>{m}</span>
                            ))}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a href={track.externalUrl} target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="View on source">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => !imported && void handleImport(track)}
                            disabled={imported || isImporting}
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

        {/* ════════════════════ AI MATCH TAB ══════════════════════════════════ */}
        {tab === 'ai' && (
          <AiMediaPicker
            onMusicAccepted={(trackId) => {
              // Switch to library tab after accepting so user can see their new track
              void fetchTracks().then(() => setTab('library'));
              void console.log('Music accepted:', trackId);
            }}
          />
        )}
      </div>
    </div>
  );
}
