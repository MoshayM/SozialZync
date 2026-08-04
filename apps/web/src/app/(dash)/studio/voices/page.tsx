'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Mic, Play, Pause, ChevronDown } from 'lucide-react';

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
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'openai', label: 'OpenAI TTS' },
];
const ACCENT_COLORS: Record<string, string> = {
  american: '#2563eb', british: '#7c3aed', australian: '#d97706',
  indian: '#dc2626', irish: '#16a34a',
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

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
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb' }} title="No preview available">
      <Mic className="w-4 h-4 text-gray-300" />
    </div>
  );

  return (
    <button
      onClick={() => setPlaying(isPlaying ? null : voiceId)}
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105"
      style={{ background: isPlaying ? 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' : '#f5f2fd', border: '1.5px solid #e3ddf8' }}
      aria-label={isPlaying ? 'Pause preview' : 'Play voice preview'}>
      {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4" style={{ color: '#6D4AE0' }} />}
    </button>
  );
}

export default function VoiceLibraryPage() {
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
    <div className="min-h-full bg-[#faf9ff]">
      <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-5 h-5" style={{ color: '#6D4AE0' }} />
              <h1 className="text-2xl font-extrabold text-gray-900">Voice Library</h1>
            </div>
            <p className="text-sm text-gray-500">
              Browse premade voices from ElevenLabs &amp; OpenAI for your video narration
              {voices.length > 0 && <span className="ml-2 font-semibold text-gray-700">{voices.length} voices</span>}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voices…"
              className="bg-[#faf9ff] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3ddf8', width: 180 }} />
            <select value={source} onChange={e => setSource(e.target.value as 'all' | 'elevenlabs' | 'openai')}
              className="bg-[#faf9ff] rounded-xl px-3 py-2 text-sm font-semibold outline-none" style={{ border: '1.5px solid #e3ddf8', color: '#6D4AE0' }}>
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex gap-1.5 flex-wrap">
              {GENDER_OPTIONS.map(g => (
                <button key={g} onClick={() => setGenderFilter(g)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize"
                  style={genderFilter === g ? { background: '#6D4AE0', color: '#fff', border: '1.5px solid #6D4AE0' } : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' }}>
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
                <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-lg p-2 flex flex-wrap gap-1 min-w-[180px]" style={{ border: '1.5px solid #e3ddf8' }}>
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
          </div>
        </div>

        {/* Voice grid */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading voices…</span></div>
        ) : error ? (
          <div className="py-16 text-center"><Mic className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-red-500">{error}</p><button onClick={() => void fetchVoices()} className="mt-3 text-xs font-semibold underline" style={{ color: '#6D4AE0' }}>Retry</button></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center"><Mic className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">No voices found.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(voice => (
              <div key={voice.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow" style={{ border: '1.5px solid #e3ddf8' }}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
                    style={{ background: voice.source === 'elevenlabs' ? 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' : 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff' }}>
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
                <div className="flex items-center gap-2 pt-1">
                  <VoicePlayer url={voice.previewUrl} voiceId={voice.id} playing={playing} setPlaying={setPlaying} />
                  <span className="text-xs text-gray-400">{voice.previewUrl ? 'Preview available' : 'No preview'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
