'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layers, Sparkles, Loader2, Plus, Trash2, Play, Pause, Pencil, Check, X, Users, Star, Wand2, Image as ImageIcon, Scissors, Headphones, FileText, Palette } from 'lucide-react';
import { ImageAssetBrowser } from '@/components/image-asset-browser';
import { ThumbnailGenerator } from '@/components/thumbnail-generator';
import { ContentToolsContent } from '@/components/content-tools-embed';
import ShortsStudioPage from '../shorts-studio/page';
import BrandKitPage from '../brand-kit/page';
import { AudioHub } from '@/components/audio-hub';

// ── Types ──────────────────────────────────────────────────────────────────────

type VideoStyle = 'realistic' | 'cartoon' | 'animation' | 'anime' | 'movie' | 'pixel';
type VoiceEffect = 'none' | 'robot' | 'cartoon' | 'villain' | 'whisper' | 'chipmunk' | 'giant' | 'echo';
type AvatarStyle = 'avataaars' | 'bottts' | 'fun-emoji' | 'pixel-art' | 'adventurer' | 'lorelei' | 'micah' | 'open-peeps' | 'thumbs' | 'notionists' | 'croodles' | 'big-ears';

interface Character {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  voiceProvider: 'openai' | 'elevenlabs';
  voiceId: string;
  voicePitch: number;
  voiceSpeed: number;
  voiceEffect: VoiceEffect;
  videoStyle: VideoStyle;
  avatarStyle: AvatarStyle;
  avatarUrl?: string;
  createdAt: string;
}

interface CharacterPreset {
  id: string;
  name: string;
  description: string;
  personality: string;
  voiceProvider: 'openai' | 'elevenlabs';
  voiceId: string;
  voicePitch: number;
  voiceSpeed: number;
  voiceEffect: VoiceEffect;
  videoStyle: VideoStyle;
  avatarStyle: AvatarStyle;
  emoji: string;
  tags: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const VIDEO_STYLES: Array<{ value: VideoStyle; label: string; emoji: string; color: string; desc: string }> = [
  { value: 'realistic', label: 'Realistic', emoji: '📷', color: '#1e293b', desc: 'Photorealistic' },
  { value: 'cartoon', label: 'Cartoon', emoji: '🎨', color: '#f59e0b', desc: '2D flat style' },
  { value: 'animation', label: 'Animation', emoji: '✨', color: '#8b5cf6', desc: 'Pixar-like 3D' },
  { value: 'anime', label: 'Anime', emoji: '⛩️', color: '#ec4899', desc: 'Japanese style' },
  { value: 'movie', label: 'Movie', emoji: '🎬', color: '#dc2626', desc: 'Cinematic' },
  { value: 'pixel', label: 'Pixel Art', emoji: '👾', color: '#10b981', desc: 'Retro 8-bit' },
];

const VOICE_EFFECTS: Array<{ value: VoiceEffect; label: string; emoji: string; desc: string }> = [
  { value: 'none', label: 'Natural', emoji: '🎤', desc: 'Normal voice' },
  { value: 'cartoon', label: 'Cartoon', emoji: '🐭', desc: 'Pitch up, fun' },
  { value: 'chipmunk', label: 'Chipmunk', emoji: '🐿️', desc: 'Very high pitch' },
  { value: 'villain', label: 'Villain', emoji: '😈', desc: 'Deep & menacing' },
  { value: 'giant', label: 'Giant', emoji: '🗻', desc: 'Huge & slow' },
  { value: 'robot', label: 'Robot', emoji: '🤖', desc: 'Mechanical echo' },
  { value: 'whisper', label: 'Whisper', emoji: '🌙', desc: 'Soft & eerie' },
  { value: 'echo', label: 'Echo', emoji: '🏔️', desc: 'Cave reverb' },
];

const AVATAR_STYLES: Array<{ value: AvatarStyle; label: string }> = [
  { value: 'avataaars', label: 'Avataaars' },
  { value: 'fun-emoji', label: 'Fun Emoji' },
  { value: 'bottts', label: 'Bottts (Robot)' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'adventurer', label: 'Adventurer' },
  { value: 'lorelei', label: 'Lorelei' },
  { value: 'micah', label: 'Micah' },
  { value: 'open-peeps', label: 'Open Peeps' },
  { value: 'thumbs', label: 'Thumbs Up' },
  { value: 'notionists', label: 'Notionists' },
  { value: 'croodles', label: 'Croodles' },
  { value: 'big-ears', label: 'Big Ears' },
];

const OPENAI_VOICES = [
  { id: 'alloy', label: 'Alloy (neutral)' },
  { id: 'echo', label: 'Echo (male)' },
  { id: 'fable', label: 'Fable (British)' },
  { id: 'onyx', label: 'Onyx (deep)' },
  { id: 'nova', label: 'Nova (female)' },
  { id: 'shimmer', label: 'Shimmer (soft)' },
];

const PREVIEW_TEXTS: Record<VoiceEffect, string> = {
  none: 'Hello! I am your new character. How can I help you today?',
  cartoon: "Oh boy oh boy! This is so exciting! Let's go on an adventure!",
  chipmunk: 'Hehehe! I am super fast and super tiny and super happy!',
  villain: 'You thought you could stop me? How delightfully naive of you.',
  giant: 'GREETINGS. I AM VERY BIG. THE GROUND SHAKES WHEN I WALK.',
  robot: 'PROCESSING. INITIATING. HELLO HUMAN. I AM YOUR ROBOT ASSISTANT.',
  whisper: 'Come closer... I have something important to tell you...',
  echo: 'Hello from the mountains... hello... hello...',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cf_token') ?? '';
}

function headers(extra?: Record<string, string>) {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

function diceBearUrl(style: AvatarStyle, seed: string) {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=80`;
}

// ── Character Avatar ───────────────────────────────────────────────────────────

function CharacterAvatar({ character, size = 48 }: { character: Character | CharacterPreset; size?: number }) {
  const seed = character.name.toLowerCase().replace(/s+/g, '-');
  const url = (character as Character).avatarUrl || diceBearUrl(character.avatarStyle, seed);
  return (
    <div className="rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: '#f5f2fd', border: '2px solid #e3ddf8' }}>
      <img src={url} alt={character.name} width={size} height={size} className="w-full h-full object-cover" />
    </div>
  );
}

// ── Voice Preview Button ───────────────────────────────────────────────────────

function VoicePreviewBtn({ character, size = 'sm' }: { character: Partial<Character>; size?: 'sm' | 'md' }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/characters/preview-voice', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: PREVIEW_TEXTS[character.voiceEffect ?? 'none'],
          voiceProvider: character.voiceProvider ?? 'openai',
          voiceId: character.voiceId ?? 'nova',
          voicePitch: character.voicePitch ?? 1.0,
          voiceSpeed: character.voiceSpeed ?? 1.0,
          voiceEffect: character.voiceEffect ?? 'none',
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlaying(false);
      await audioRef.current.play();
      setPlaying(true);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  const cls = size === 'sm'
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold'
    : 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold';

  return (
    <button onClick={() => void play()} disabled={loading}
      className={cls + ' transition-all hover:scale-105 disabled:opacity-50'}
      style={playing ? { background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', color: '#fff' } : { background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {playing ? 'Pause' : 'Preview Voice'}
    </button>
  );
}

// ── Create / Edit Form ─────────────────────────────────────────────────────────

function CharacterForm({ initial, onSave, onCancel }: {
  initial?: Partial<Character>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [personality, setPersonality] = useState(initial?.personality ?? '');
  const [voiceProvider, setVoiceProvider] = useState<'openai' | 'elevenlabs'>(initial?.voiceProvider ?? 'openai');
  const [voiceId, setVoiceId] = useState(initial?.voiceId ?? 'nova');
  const [voicePitch, setVoicePitch] = useState(initial?.voicePitch ?? 1.0);
  const [voiceSpeed, setVoiceSpeed] = useState(initial?.voiceSpeed ?? 1.0);
  const [voiceEffect, setVoiceEffect] = useState<VoiceEffect>(initial?.voiceEffect ?? 'none');
  const [videoStyle, setVideoStyle] = useState<VideoStyle>(initial?.videoStyle ?? 'realistic');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(initial?.avatarStyle ?? 'avataaars');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview: Partial<Character> = { voiceProvider, voiceId, voicePitch, voiceSpeed, voiceEffect, avatarStyle, name };

  async function save() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const url = initial?.id ? `/api/v1/characters/${initial.id}` : '/api/v1/characters';
      const method = initial?.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), personality: personality.trim(), voiceProvider, voiceId, voicePitch, voiceSpeed, voiceEffect, videoStyle, avatarStyle }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSave();
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl p-6 space-y-6" style={{ border: '1.5px solid #e3ddf8' }}>
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-gray-800">{initial?.id ? 'Edit Character' : 'New Character'}</p>
        <button onClick={onCancel} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>{error}</div>}

      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Identity</p>
        <div className="flex gap-4 items-start">
          <div className="shrink-0">
            <CharacterAvatar character={preview as Character} size={64} />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Character name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Professor Zoom, Robo-Max"
                className="w-full bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3ddf8' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief character description"
                className="w-full bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20" style={{ border: '1.5px solid #e3ddf8' }} />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Personality & speaking style</label>
          <textarea value={personality} onChange={e => setPersonality(e.target.value)} rows={2}
            placeholder="e.g. Energetic and funny, uses lots of exclamations, speaks fast and enthusiastically"
            className="w-full bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 resize-none" style={{ border: '1.5px solid #e3ddf8' }} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Avatar Style</p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_STYLES.map(s => (
            <button key={s.value} onClick={() => setAvatarStyle(s.value)}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all"
              style={avatarStyle === s.value ? { border: '2px solid #6D4AE0', background: '#f5f2fd' } : { border: '1.5px solid #e3ddf8', background: '#faf9ff' }}>
              <img src={diceBearUrl(s.value, name || 'character')} alt={s.label} width={36} height={36} className="rounded-lg" />
              <span className="text-[10px] font-medium text-gray-600 whitespace-nowrap">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Voice</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
            <select value={voiceProvider} onChange={e => setVoiceProvider(e.target.value as 'openai' | 'elevenlabs')}
              className="w-full bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm outline-none" style={{ border: '1.5px solid #e3ddf8' }}>
              <option value="openai">OpenAI TTS</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Base voice</label>
            {voiceProvider === 'openai' ? (
              <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                className="w-full bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm outline-none" style={{ border: '1.5px solid #e3ddf8' }}>
                {OPENAI_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            ) : (
              <input value={voiceId} onChange={e => setVoiceId(e.target.value)}
                placeholder="ElevenLabs voice ID"
                className="w-full bg-[#faf9ff] rounded-xl px-3 py-2.5 text-sm outline-none font-mono" style={{ border: '1.5px solid #e3ddf8' }} />
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Voice effect</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {VOICE_EFFECTS.map(e => (
              <button key={e.value} onClick={() => setVoiceEffect(e.value)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all"
                style={voiceEffect === e.value ? { border: '2px solid #6D4AE0', background: '#f5f2fd' } : { border: '1.5px solid #e3ddf8', background: '#faf9ff' }}>
                <span className="text-xl">{e.emoji}</span>
                <span className="text-[10px] font-medium text-gray-600">{e.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pitch: {voicePitch.toFixed(1)}x</label>
            <input type="range" min={0.5} max={2.0} step={0.05} value={voicePitch} onChange={e => setVoicePitch(Number(e.target.value))}
              className="w-full accent-[#6D4AE0]" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>0.5x (deep)</span><span>2.0x (high)</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Speed: {voiceSpeed.toFixed(1)}x</label>
            <input type="range" min={0.5} max={2.0} step={0.05} value={voiceSpeed} onChange={e => setVoiceSpeed(Number(e.target.value))}
              className="w-full accent-[#6D4AE0]" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>0.5x (slow)</span><span>2.0x (fast)</span></div>
          </div>
        </div>

        <VoicePreviewBtn character={preview} size="md" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Video Style</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {VIDEO_STYLES.map(s => (
            <button key={s.value} onClick={() => setVideoStyle(s.value)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
              style={videoStyle === s.value ? { border: '2px solid #6D4AE0', background: '#f5f2fd' } : { border: '1.5px solid #e3ddf8', background: '#faf9ff' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl" style={{ background: s.color }}>
                {s.emoji}
              </div>
              <span className="text-[10px] font-semibold text-gray-700">{s.label}</span>
              <span className="text-[9px] text-gray-400 text-center">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ border: '1.5px solid #e3ddf8' }}>Cancel</button>
        <button onClick={() => void save()} disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 20px rgba(109,74,224,.35)' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Character'}
        </button>
      </div>
    </div>
  );
}

// ── Characters section ─────────────────────────────────────────────────────────

function CharactersSection() {
  const [tab, setTab] = useState<'my' | 'presets' | 'create'>('my');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [presets, setPresets] = useState<CharacterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);
  const [addedPresetIds, setAddedPresetIds] = useState<Set<string>>(new Set());

  const fetchCharacters = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/v1/characters', { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCharacters(await res.json() as Character[]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load characters'); }
    finally { setLoading(false); }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/characters/presets', { headers: headers() });
      if (res.ok) setPresets(await res.json() as CharacterPreset[]);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void fetchCharacters(); void fetchPresets(); }, [fetchCharacters, fetchPresets]);

  async function deleteCharacter(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/v1/characters/${id}`, { method: 'DELETE', headers: headers() });
      setCharacters(prev => prev.filter(c => c.id !== id));
    } catch { /* non-fatal */ }
    finally { setDeletingId(null); }
  }

  async function addFromPreset(presetId: string) {
    setAddingPresetId(presetId);
    try {
      const res = await fetch(`/api/v1/characters/from-preset/${presetId}`, { method: 'POST', headers: headers() });
      if (res.ok) {
        setAddedPresetIds(prev => new Set([...prev, presetId]));
        void fetchCharacters();
      }
    } catch { /* non-fatal */ }
    finally { setAddingPresetId(null); }
  }

  const CHAR_TABS = [
    { id: 'my' as const, label: 'My Characters', icon: Users },
    { id: 'presets' as const, label: 'Presets', icon: Star },
    { id: 'create' as const, label: 'Create Custom', icon: Wand2 },
  ];

  return (
    <div className="space-y-6">
      {/* Inner tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar" style={{ background: '#f0edf9', width: 'fit-content' }}>
        {CHAR_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
            style={tab === id ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' } : { color: '#9b8fc4' }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'my' && characters.length > 0 && (
              <span className="text-[11px] bg-purple-100 text-purple-700 rounded-full px-1.5 ml-0.5">{characters.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'my' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading...</span></div>
          ) : error ? (
            <div className="py-12 text-center"><p className="text-sm text-red-500">{error}</p></div>
          ) : characters.length === 0 ? (
            <div className="py-16 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3" style={{ color: '#6D4AE0', opacity: 0.3 }} />
              <p className="text-gray-600 font-medium mb-1">No characters yet</p>
              <p className="text-sm text-gray-400 mb-4">Add a preset or create a custom character to get started</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setTab('presets')} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}>
                  Browse presets
                </button>
                <button onClick={() => setTab('create')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)' }}>
                  <Plus className="w-4 h-4" />Create custom
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {editingId === '__new__' && (
                <CharacterForm onSave={() => { setEditingId(null); void fetchCharacters(); }} onCancel={() => setEditingId(null)} />
              )}
              {characters.map(char => (
                editingId === char.id ? (
                  <CharacterForm key={char.id} initial={char}
                    onSave={() => { setEditingId(null); void fetchCharacters(); }}
                    onCancel={() => setEditingId(null)} />
                ) : (
                  <div key={char.id} className="bg-white rounded-2xl p-4 flex items-start gap-4" style={{ border: '1.5px solid #e3ddf8' }}>
                    <CharacterAvatar character={char} size={56} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{char.name}</p>
                        {(() => { const s = VIDEO_STYLES.find(v => v.value === char.videoStyle); return s ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#faf9ff', color: '#6b7280', border: '1px solid #e3ddf8' }}>
                            {s.emoji} {s.label}
                          </span>
                        ) : null; })()}
                        {(() => { const e = VOICE_EFFECTS.find(v => v.value === char.voiceEffect); return e && e.value !== 'none' ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>
                            {e.emoji} {e.label}
                          </span>
                        ) : null; })()}
                      </div>
                      {char.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{char.description}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <VoicePreviewBtn character={char} />
                        <button onClick={() => setEditingId(char.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors" style={{ border: '1.5px solid #e3ddf8' }}>
                          <Pencil className="w-3 h-3" />Edit
                        </button>
                        <button onClick={() => { if (window.confirm(`Delete "${char.name}"?`)) void deleteCharacter(char.id); }}
                          disabled={deletingId === char.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors" style={{ border: '1.5px solid #fecaca' }}>
                          {deletingId === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ))}
              <button onClick={() => setTab('create')} className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-white"
                style={{ border: '2px dashed #e3ddf8', color: '#9b8fc4' }}>
                <Plus className="w-4 h-4" />Add another character
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'presets' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map(preset => {
            const added = addedPresetIds.has(preset.id);
            const isAdding = addingPresetId === preset.id;
            const effect = VOICE_EFFECTS.find(e => e.value === preset.voiceEffect);
            const style = VIDEO_STYLES.find(s => s.value === preset.videoStyle);
            return (
              <div key={preset.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3" style={{ border: '1.5px solid #e3ddf8' }}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: '#f5f2fd', border: '1.5px solid #e3ddf8' }}>
                    {preset.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{preset.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preset.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1px solid #e3ddf8' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{preset.description}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {effect && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#faf9ff', color: '#6b7280', border: '1px solid #e3ddf8' }}>{effect.emoji} {effect.label}</span>}
                  {style && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#faf9ff', color: '#6b7280', border: '1px solid #e3ddf8' }}>{style.emoji} {style.label}</span>}
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <VoicePreviewBtn character={preset} />
                  <button onClick={() => void addFromPreset(preset.id)} disabled={added || isAdding}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ml-auto transition-all"
                    style={added ? { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' } : { background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', color: '#fff', boxShadow: '0 2px 8px rgba(109,74,224,.3)' }}>
                    {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {added ? '+ Added' : isAdding ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'create' && (
        <CharacterForm
          onSave={() => { void fetchCharacters(); setTab('my'); }}
          onCancel={() => setTab('my')}
        />
      )}
    </div>
  );
}

// ── Top-level tabs ─────────────────────────────────────────────────────────────

type TopTab = 'characters' | 'images' | 'thumbnails' | 'shorts' | 'audio' | 'content' | 'brand-kit';

const TOP_TABS: Array<{ id: TopTab; label: string; icon: typeof Layers }> = [
  { id: 'characters', label: 'Characters',    icon: Users },
  { id: 'images',     label: 'Images',        icon: ImageIcon },
  { id: 'thumbnails', label: 'AI Thumbnails', icon: Sparkles },
  { id: 'shorts',     label: 'Shorts Studio', icon: Scissors },
  { id: 'audio',      label: 'Audio Studio',  icon: Headphones },
  { id: 'content',    label: 'Content Tools', icon: FileText },
  { id: 'brand-kit',  label: 'Brand Kit',     icon: Palette  },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CreativeStudioPage() {
  const [topTab, setTopTab] = useState<TopTab>('characters');

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5" style={{ color: '#6D4AE0' }} />
            <h1 className="text-2xl font-extrabold text-gray-900">Creative Studio</h1>
          </div>
          <p className="text-sm text-gray-500">Characters · Images · Thumbnails · Shorts · Audio Studio · Content Tools · Brand Kit</p>
        </div>

        {/* Top-level tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar" style={{ background: '#f0edf9', width: 'fit-content' }}>
          {TOP_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTopTab(id)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
              style={topTab === id ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' } : { color: '#9b8fc4' }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {topTab === 'characters' && <CharactersSection />}
        {topTab === 'images'     && <ImageAssetBrowser />}
        {topTab === 'thumbnails' && <ThumbnailGenerator />}
        {topTab === 'shorts'     && <ShortsStudioPage />}
        {topTab === 'audio'      && <AudioHub />}
        {topTab === 'content'    && <ContentToolsContent />}
        {topTab === 'brand-kit'  && <BrandKitPage />}
      </div>
    </div>
  );
}
