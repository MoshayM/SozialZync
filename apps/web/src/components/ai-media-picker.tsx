'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Music, Mic, Play, Pause, Check, RefreshCw, ChevronRight } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MusicPick {
  track: {
    id: string;
    title: string;
    artist?: string;
    duration: number;
    license: string;
    previewUrl?: string;
    fileUrl: string;
    mood: string[];
    genre: string[];
    attribution?: string;
  } | null;
  brief: { mood: string; genre: string; bpm: number; energy: string };
  source: 'library' | 'external' | 'none';
  reason: string;
}

interface VoicePick {
  voiceId: string;
  provider: 'elevenlabs' | 'openai';
  name: string;
  previewUrl: string | null;
  reason: string;
}

interface AiMediaPickerProps {
  /** Pre-fill the script textarea (e.g. from the active project) */
  initialScript?: string;
  /** Called when user accepts a music pick — receives the track ID */
  onMusicAccepted?: (trackId: string) => void;
  /** Called when user accepts a voice pick — receives voiceId + provider */
  onVoiceAccepted?: (voiceId: string, provider: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const ENERGY_COLORS: Record<string, string> = {
  low: '#16a34a', medium: '#d97706', high: '#dc2626', dynamic: '#7c3aed',
};

// ── Mini audio preview ─────────────────────────────────────────────────────────

function PreviewBtn({ url, id, playing, setPlaying }: {
  url: string | null; id: string;
  playing: string | null; setPlaying: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = playing === id;

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
    <span className="text-xs text-gray-400 italic">No preview</span>
  );

  return (
    <button
      onClick={() => setPlaying(isPlaying ? null : id)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
      style={isPlaying
        ? { background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff' }
        : { background: '#f3f4f6', color: '#374151', border: '1.5px solid #e3ddf8' }}
      aria-label={isPlaying ? 'Pause' : 'Preview'}
    >
      {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {isPlaying ? 'Pause' : 'Preview'}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AiMediaPicker({ initialScript = '', onMusicAccepted, onVoiceAccepted }: AiMediaPickerProps) {
  const [scriptText, setScriptText] = useState(initialScript);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicPick, setMusicPick] = useState<MusicPick | null>(null);
  const [voicePick, setVoicePick] = useState<VoicePick | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [musicAccepted, setMusicAccepted] = useState(false);
  const [voiceAccepted, setVoiceAccepted] = useState(false);

  async function analyze() {
    if (!scriptText.trim()) return;
    setLoading(true);
    setError(null);
    setMusicPick(null);
    setVoicePick(null);
    setMusicAccepted(false);
    setVoiceAccepted(false);

    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      };
      const body = JSON.stringify({ scriptText: scriptText.trim(), projectId: 'ai-pick' });

      const [musicRes, voiceRes] = await Promise.all([
        fetch('/api/proxy/music/auto-select', { method: 'POST', headers, body }),
        fetch('/api/proxy/voice/auto-select', { method: 'POST', headers, body }),
      ]);

      if (musicRes.ok) setMusicPick(await musicRes.json() as MusicPick);
      if (voiceRes.ok) setVoicePick(await voiceRes.json() as VoicePick);

      if (!musicRes.ok && !voiceRes.ok) {
        throw new Error('AI analysis failed — check API connection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  const hasResults = musicPick !== null || voicePick !== null;

  return (
    <div className="space-y-5">
      {/* ── Script input ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">AI Media Matcher</p>
            <p className="text-xs text-gray-400">Paste your script — AI picks the best royalty-free music and voice</p>
          </div>
        </div>

        <textarea
          value={scriptText}
          onChange={e => setScriptText(e.target.value)}
          placeholder="Paste your video script or describe your content here…&#10;&#10;Example: &quot;This video covers 5 productivity tips for remote workers. Energetic and motivational tone targeting professionals aged 25-40.&quot;"
          rows={5}
          className="w-full bg-[#faf9ff] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]/20 resize-none leading-relaxed"
          style={{ border: '1.5px solid #e3ddf8', color: '#374151' }}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{scriptText.length} characters — more context = better match</p>
          <button
            onClick={() => void analyze()}
            disabled={loading || !scriptText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', boxShadow: '0 4px 20px rgba(55,65,81,.35)' }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
              : hasResults
                ? <><RefreshCw className="w-4 h-4" /> Re-analyze</>
                : <><Sparkles className="w-4 h-4" /> Find Best Match</>}
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Music card */}
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4" style={{ color: '#374151' }} />
              <p className="text-sm font-bold text-gray-800">Background Music</p>
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e3ddf8' }}>
                AI Pick
              </span>
            </div>

            {musicPick?.track ? (
              <>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{musicPick.track.title}</p>
                    {musicPick.track.artist && <p className="text-xs text-gray-400">{musicPick.track.artist}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-mono text-gray-500">{fmt(musicPick.track.duration)}</span>
                    {musicPick.brief?.energy && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: '#faf9ff', color: ENERGY_COLORS[musicPick.brief.energy] ?? '#6b7280', border: '1.5px solid #e3ddf8' }}>
                        {musicPick.brief.energy} energy
                      </span>
                    )}
                    {musicPick.track.mood.slice(0, 2).map(m => (
                      <span key={m} className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e3ddf8' }}>{m}</span>
                    ))}
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: musicPick.source === 'library' ? '#f0fdf4' : '#eff6ff', color: musicPick.source === 'library' ? '#16a34a' : '#2563eb', border: '1px solid #e3ddf8' }}>
                      {musicPick.source === 'library' ? '★ Library' : '↓ Imported'}
                    </span>
                  </div>
                </div>

                {/* AI reasoning */}
                <div className="rounded-xl px-3 py-2.5" style={{ background: '#faf9ff', border: '1.5px solid #f3f4f6' }}>
                  <p className="text-[11px] text-gray-500 italic">"{musicPick.reason}"</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <PreviewBtn
                    url={musicPick.track.previewUrl ?? musicPick.track.fileUrl}
                    id={`music-${musicPick.track.id}`}
                    playing={playing}
                    setPlaying={setPlaying}
                  />
                  <button
                    onClick={() => { setMusicAccepted(true); onMusicAccepted?.(musicPick.track!.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ml-auto"
                    style={musicAccepted
                      ? { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' }
                      : { background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff', boxShadow: '0 2px 8px rgba(55,65,81,.3)' }}
                  >
                    {musicAccepted ? <><Check className="w-3 h-3" /> Applied</> : <>Apply <ChevronRight className="w-3 h-3" /></>}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <Music className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">No matching track found.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add tracks to your library or set up <span className="font-mono">JAMENDO_CLIENT_ID</span>.
                </p>
              </div>
            )}
          </div>

          {/* Voice card */}
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4" style={{ color: '#374151' }} />
              <p className="text-sm font-bold text-gray-800">Narration Voice</p>
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e3ddf8' }}>
                AI Pick
              </span>
            </div>

            {voicePick ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                    style={{ background: voicePick.provider === 'elevenlabs' ? 'linear-gradient(135deg,#374151,#7c5ae8)' : 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
                    {voicePick.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{voicePick.name}</p>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: voicePick.provider === 'elevenlabs' ? '#f3f4f6' : '#eff6ff', color: voicePick.provider === 'elevenlabs' ? '#374151' : '#2563eb', border: '1px solid #e3ddf8' }}>
                      {voicePick.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI TTS'}
                    </span>
                  </div>
                </div>

                {/* AI reasoning */}
                <div className="rounded-xl px-3 py-2.5" style={{ background: '#faf9ff', border: '1.5px solid #f3f4f6' }}>
                  <p className="text-[11px] text-gray-500 italic">"{voicePick.reason}"</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <PreviewBtn
                    url={voicePick.previewUrl}
                    id={`voice-${voicePick.voiceId}`}
                    playing={playing}
                    setPlaying={setPlaying}
                  />
                  <button
                    onClick={() => { setVoiceAccepted(true); onVoiceAccepted?.(voicePick.voiceId, voicePick.provider); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ml-auto"
                    style={voiceAccepted
                      ? { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' }
                      : { background: 'linear-gradient(135deg,#374151,#7c5ae8)', color: '#fff', boxShadow: '0 2px 8px rgba(55,65,81,.3)' }}
                  >
                    {voiceAccepted ? <><Check className="w-3 h-3" /> Applied</> : <>Apply <ChevronRight className="w-3 h-3" /></>}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <Mic className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">No voice selected.</p>
                <p className="text-xs text-gray-400 mt-1">Check <span className="font-mono">ELEVENLABS_API_KEY</span>.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── How it works ───────────────────────────────────────────────────── */}
      {!hasResults && !loading && (
        <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid #f3f4f6' }}>
          <p className="text-xs font-semibold text-gray-600 mb-3">How AI matching works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: '1', title: 'Analyze script', desc: 'AI reads your script to detect mood, energy, topic, and target audience' },
              { step: '2', title: 'Match media', desc: 'Searches your library first, then Jamendo & Pixabay for the best royalty-free track' },
              { step: '3', title: 'Pick voice', desc: 'Selects the most suitable ElevenLabs or OpenAI voice for your content\'s tone' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#374151' }}>{step}</div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
