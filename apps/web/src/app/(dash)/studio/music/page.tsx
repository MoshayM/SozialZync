'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, Music, Plus, X, Play } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MusicTrack {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  duration: number;
  bpm?: number | null;
  key?: string | null;
  mood: string[];
  genre: string[];
  tags: string[];
  license: string;
  licenseUrl?: string | null;
  source?: string | null;
  attribution?: string | null;
  fileUrl: string;
  fileSizeBytes?: number | null;
  waveformData?: string | null;
  previewUrl?: string | null;
  isAiGenerated: boolean;
  aiModel?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TrackListResponse {
  tracks: MusicTrack[];
  total: number;
}

interface CreateTrackForm {
  title: string;
  artist: string;
  fileUrl: string;
  duration: string;
  license: string;
  source: string;
  attribution: string;
  mood: string;
  genre: string;
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
  { value: '', label: 'All' },
  { value: 'cc0', label: 'CC0' },
  { value: 'cc-by', label: 'CC BY' },
  { value: 'cc-by-sa', label: 'CC BY-SA' },
  { value: 'royalty-free', label: 'Royalty-Free' },
];

const DURATION_FILTERS = [
  { value: '', label: 'All' },
  { value: 'short', label: 'Short (<60s)' },
  { value: 'medium', label: 'Medium (1-3min)' },
  { value: 'long', label: 'Long (>3min)' },
];

const LICENSE_COLORS: Record<string, string> = {
  'cc0': '#16a34a',
  'cc-by': '#2563eb',
  'cc-by-sa': '#7c3aed',
  'royalty-free': '#d97706',
  'custom': '#6b7280',
};

const LICENSE_BG: Record<string, string> = {
  'cc0': '#f0fdf4',
  'cc-by': '#eff6ff',
  'cc-by-sa': '#f5f3ff',
  'royalty-free': '#fffbeb',
  'custom': '#f9fafb',
};

const LICENSE_BORDER: Record<string, string> = {
  'cc0': '#bbf7d0',
  'cc-by': '#bfdbfe',
  'cc-by-sa': '#ddd6fe',
  'royalty-free': '#fde68a',
  'custom': '#e5e7eb',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

function durationFilterToRange(filter: string): { minDuration?: number; maxDuration?: number } {
  if (filter === 'short') return { maxDuration: 60 };
  if (filter === 'medium') return { minDuration: 60, maxDuration: 180 };
  if (filter === 'long') return { minDuration: 180 };
  return {};
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MusicLibraryPage() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');

  // Available moods from API
  const [availableMoods, setAvailableMoods] = useState<string[]>([]);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTrackForm>({
    title: '',
    artist: '',
    fileUrl: '',
    duration: '',
    license: 'cc0',
    source: '',
    attribution: '',
    mood: '',
    genre: '',
  });

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (licenseFilter) params.set('license', licenseFilter);
      if (moodFilter) params.set('mood', moodFilter);
      const { minDuration, maxDuration } = durationFilterToRange(durationFilter);
      if (minDuration != null) params.set('minDuration', String(minDuration));
      if (maxDuration != null) params.set('maxDuration', String(maxDuration));

      const res = await fetch(`/api/v1/music?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TrackListResponse;
      setTracks(data.tracks);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
    } finally {
      setLoading(false);
    }
  }, [search, licenseFilter, moodFilter, durationFilter]);

  const fetchMoods = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/music/moods', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json() as string[];
        setAvailableMoods(data);
      }
    } catch {
      // non-fatal — moods dropdown just stays empty
    }
  }, []);

  useEffect(() => {
    void fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    void fetchMoods();
  }, [fetchMoods]);

  function updateForm(field: keyof CreateTrackForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleAdd() {
    if (!form.title.trim() || !form.fileUrl.trim() || !form.duration.trim()) {
      setAddError('Title, File URL, and Duration are required.');
      return;
    }
    const durationNum = parseInt(form.duration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      setAddError('Duration must be a positive number of seconds.');
      return;
    }

    setSubmitting(true);
    setAddError(null);
    try {
      const body = {
        title: form.title.trim(),
        ...(form.artist.trim() ? { artist: form.artist.trim() } : {}),
        fileUrl: form.fileUrl.trim(),
        duration: durationNum,
        license: form.license,
        ...(form.source.trim() ? { source: form.source.trim() } : {}),
        ...(form.attribution.trim() ? { attribution: form.attribution.trim() } : {}),
        mood: form.mood.trim() ? form.mood.split(',').map(s => s.trim()).filter(Boolean) : [],
        genre: form.genre.trim() ? form.genre.split(',').map(s => s.trim()).filter(Boolean) : [],
        tags: [],
      };

      const res = await fetch('/api/v1/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }

      setForm({ title: '', artist: '', fileUrl: '', duration: '', license: 'cc0', source: '', attribution: '', mood: '', genre: '' });
      setShowAddForm(false);
      void fetchTracks();
      void fetchMoods();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add track');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/music/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTracks(prev => prev.filter(t => t.id !== id));
      setTotal(prev => prev - 1);
    } catch {
      // non-fatal — track remains in list; reload recovers
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Music className="w-5 h-5" style={{ color: '#6D4AE0' }} />
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Music Library</h1>
            </div>
            <p className="text-sm text-gray-500">
              Royalty-free &amp; CC-licensed music for your videos
              {total > 0 && <span className="ml-2 font-semibold text-gray-700">{total} track{total !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tracks…"
              className="bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
              style={{ border: '1.5px solid #e3ddf8', width: '200px' }}
            />
            <button
              onClick={() => { setShowAddForm(v => !v); setAddError(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddForm ? 'Cancel' : 'Import Track'}
            </button>
          </div>
        </div>

        {/* ── Add Track Form ───────────────────────────────────────────────── */}
        {showAddForm && (
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
            <p className="text-sm font-semibold text-gray-800">Import a track</p>

            {addError && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
                {addError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => updateForm('title', e.target.value)}
                  placeholder="Track title"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Artist</label>
                <input
                  type="text"
                  value={form.artist}
                  onChange={e => updateForm('artist', e.target.value)}
                  placeholder="Artist name"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  File URL or path <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fileUrl}
                  onChange={e => updateForm('fileUrl', e.target.value)}
                  placeholder="https://example.com/track.mp3 or /path/to/file.mp3"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all font-mono"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Duration (seconds) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.duration}
                  onChange={e => updateForm('duration', e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">License</label>
                <select
                  value={form.license}
                  onChange={e => updateForm('license', e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                >
                  {LICENSE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Source URL</label>
                <input
                  type="text"
                  value={form.source}
                  onChange={e => updateForm('source', e.target.value)}
                  placeholder="e.g. freemusicarchive.org"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Attribution text</label>
                <input
                  type="text"
                  value={form.attribution}
                  onChange={e => updateForm('attribution', e.target.value)}
                  placeholder="e.g. Music by Artist Name (CC BY)"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mood tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <input
                  type="text"
                  value={form.mood}
                  onChange={e => updateForm('mood', e.target.value)}
                  placeholder="e.g. energetic, upbeat, calm"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Genre tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <input
                  type="text"
                  value={form.genre}
                  onChange={e => updateForm('genre', e.target.value)}
                  placeholder="e.g. electronic, ambient, cinematic"
                  className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 transition-all"
                  style={{ border: '1.5px solid #e3e0f0' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowAddForm(false); setAddError(null); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ border: '1.5px solid #e3ddf8' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAdd()}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import Track
              </button>
            </div>
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* License chips */}
          <div className="flex flex-wrap gap-2">
            {LICENSE_FILTER_CHIPS.map(chip => (
              <button
                key={chip.value}
                onClick={() => setLicenseFilter(chip.value)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={licenseFilter === chip.value
                  ? { background: '#6D4AE0', color: '#fff', border: '1.5px solid #6D4AE0' }
                  : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Mood + Duration filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {availableMoods.length > 0 && (
              <select
                value={moodFilter}
                onChange={e => setMoodFilter(e.target.value)}
                className="bg-white rounded-xl px-3 py-1.5 text-xs font-semibold outline-none transition-all"
                style={{ border: '1.5px solid #e3ddf8', color: moodFilter ? '#6D4AE0' : '#6b7280' }}
              >
                <option value="">All moods</option>
                {availableMoods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1">
              {DURATION_FILTERS.map(df => (
                <button
                  key={df.value}
                  onClick={() => setDurationFilter(df.value)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={durationFilter === df.value
                    ? { background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }
                    : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' }}
                >
                  {df.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Track list ───────────────────────────────────────────────────── */}
        <section>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            {loading && tracks.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading music library…</span>
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <Music className="w-8 h-8 mx-auto mb-2" style={{ color: '#d1d5db' }} />
                <p className="text-sm text-red-500">{error}</p>
                <button
                  onClick={() => void fetchTracks()}
                  className="mt-3 text-xs font-semibold underline"
                  style={{ color: '#6D4AE0' }}
                >
                  Try again
                </button>
              </div>
            ) : tracks.length === 0 ? (
              <div className="py-16 text-center">
                <Music className="w-8 h-8 mx-auto mb-2" style={{ color: '#d1d5db' }} />
                <p className="text-sm text-gray-500">No tracks found.</p>
                <p className="text-xs text-gray-400 mt-1">
                  {licenseFilter || moodFilter || durationFilter || search
                    ? 'Try clearing some filters.'
                    : 'Click "Import Track" above to add your first royalty-free track.'}
                </p>
              </div>
            ) : (
              tracks.map((track, idx) => {
                const licenseColor = LICENSE_COLORS[track.license] ?? '#6b7280';
                const licenseBg = LICENSE_BG[track.license] ?? '#f9fafb';
                const licenseBorder = LICENSE_BORDER[track.license] ?? '#e5e7eb';
                const isDeleting = deletingId === track.id;

                return (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9ff] transition-colors"
                    style={{ borderBottom: idx < tracks.length - 1 ? '1px solid #f0edf9' : 'none' }}
                  >
                    {/* Play button (visual only — MVP) */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-default"
                      style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}
                      title="Audio preview not yet available"
                    >
                      <Play className="w-4 h-4" style={{ color: '#6D4AE0' }} />
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 truncate">{track.title}</p>
                        {track.artist && (
                          <span className="text-xs text-gray-400 truncate">{track.artist}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {/* Duration */}
                        <span className="text-xs text-gray-500 font-mono">{formatDuration(track.duration)}</span>

                        {/* License badge */}
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: licenseBg, color: licenseColor, border: `1.5px solid ${licenseBorder}` }}
                        >
                          {track.license}
                        </span>

                        {/* Mood tags */}
                        {track.mood.slice(0, 3).map(m => (
                          <span
                            key={m}
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                      {/* Attribution */}
                      {track.attribution && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={track.attribution}>
                          {track.attribution}
                        </p>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => { if (window.confirm(`Delete "${track.title}"?`)) void handleDelete(track.id); }}
                      disabled={isDeleting}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
                      style={{ border: '1.5px solid #e3ddf8' }}
                      aria-label={`Delete ${track.title}`}
                    >
                      {isDeleting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
