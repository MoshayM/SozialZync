'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, Loader2, Play, Pause,
  Check, Mic, Music2, Volume2, Users, ImageIcon, Sparkles,
} from 'lucide-react';
import { api, apiClient } from '@/lib/api';
import type { VoiceLibraryEntry, MusicTrack } from '@/lib/api';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  timelineId: string;
  shortClipId: string;
  captionsText: string;
  audioVersionId?: string;
}

// ── Panel header (accordion toggle) ──────────────────────────────────────────

function PanelHeader({
  icon, label, open, onToggle,
}: {
  icon: React.ReactNode; label: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
    >
      <span className="flex items-center gap-2">{icon} {label}</span>
      {open
        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

// ── 1. Background Music ───────────────────────────────────────────────────────

function MusicPanel({ captionsText }: { captionsText: string }) {
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const musicQ = useQuery({
    queryKey: ['studio-music', search],
    queryFn: () => api.music.list({ search: search || undefined }).then((r) => r.data.tracks),
    staleTime: 60_000,
  });

  const autoQ = useMutation({
    mutationFn: () => api.music.autoSelect(captionsText).then((r) => r.data),
  });

  const importMut = useMutation({
    mutationFn: (track: MusicTrack) =>
      apiClient.post('/music/browse/import', {
        externalId: track.id,
        title: track.title,
        artist: track.artist,
        fileUrl: track.fileUrl,
        duration: track.duration,
        mood: track.mood,
        genre: track.genre,
        license: track.license,
        isAiGenerated: track.isAiGenerated,
      }).then(() => track.title),
    onSuccess: (title) => setImported(title),
  });

  const togglePreview = (url: string) => {
    if (preview === url) {
      audioRef.current?.pause();
      setPreview(null);
    } else {
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      void audioRef.current.play();
      setPreview(url);
    }
  };

  const autoTrack = autoQ.data?.track;
  const browseList = musicQ.data ?? [];
  const tracks: MusicTrack[] = autoTrack
    ? [autoTrack, ...browseList.filter((t) => t.id !== autoTrack.id)]
    : browseList;

  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="flex gap-1.5">
        <input
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-400"
          placeholder="Search tracks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => autoQ.mutate()}
          disabled={autoQ.isPending || !captionsText}
          title="AI auto-suggest based on captions"
          className="px-2 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-600 hover:bg-cyan-100 disabled:opacity-50"
        >
          {autoQ.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />}
        </button>
      </div>

      {autoQ.data?.track && (
        <p className="text-[11px] text-cyan-700 font-medium">
          AI pick: {autoQ.data.track.title}
        </p>
      )}
      {imported && (
        <p className="text-[11px] text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> &quot;{imported}&quot; added to music library
        </p>
      )}
      {musicQ.isLoading && <p className="text-[11px] text-gray-400">Loading tracks…</p>}

      <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
        {tracks.slice(0, 8).map((t) => {
          const previewUrl = t.previewUrl ?? t.fileUrl;
          return (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-cyan-50 text-xs">
              <button
                type="button"
                onClick={() => togglePreview(previewUrl)}
                className="shrink-0 w-6 h-6 flex items-center justify-center bg-cyan-100 rounded-full text-cyan-700 hover:bg-cyan-200"
              >
                {preview === previewUrl
                  ? <Pause className="w-3 h-3" />
                  : <Play className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{t.title}</p>
                <p className="text-gray-400 truncate">{t.artist ?? ''} · {Math.round(t.duration)}s</p>
              </div>
              <button
                type="button"
                onClick={() => importMut.mutate(t)}
                disabled={importMut.isPending}
                className="shrink-0 text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 hover:border-cyan-400 hover:text-cyan-700 disabled:opacity-50"
              >
                {importMut.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400">Added tracks are available in your Music Library for use in Export.</p>
    </div>
  );
}

// ── 2. Voice-Over ─────────────────────────────────────────────────────────────

function VoicePanel({ timelineId, captionsText }: { timelineId: string; captionsText: string }) {
  const [source, setSource] = useState<'elevenlabs' | 'openai'>('openai');
  const [selectedVoice, setSelectedVoice] = useState<VoiceLibraryEntry | null>(null);
  const [script, setScript] = useState(captionsText.slice(0, 1000));
  const [done, setDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const voicesQ = useQuery({
    queryKey: ['voice-library', source],
    queryFn: () => api.voice.library(source).then((r) => r.data.voices),
    staleTime: 300_000,
  });

  const genVoice = useMutation({
    mutationFn: () => {
      if (!selectedVoice) return Promise.reject(new Error('No voice selected'));
      return api.editor.generateVoice(timelineId, {
        text: script,
        voiceId: selectedVoice.id,
        source: selectedVoice.source,
      });
    },
    onSuccess: () => setDone(true),
  });

  const togglePreview = (url: string) => {
    if (playing === url) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      void audioRef.current.play();
      setPlaying(url);
    }
  };

  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="flex gap-1">
        {(['openai', 'elevenlabs'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setSource(s); setSelectedVoice(null); }}
            className={`flex-1 text-[11px] py-1 rounded-md border transition-colors ${source === s ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {s === 'openai' ? 'OpenAI' : 'ElevenLabs'}
          </button>
        ))}
      </div>

      {voicesQ.isLoading && <p className="text-[11px] text-gray-400">Loading voices…</p>}
      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
        {(voicesQ.data ?? []).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setSelectedVoice(v)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs border text-left ${selectedVoice?.id === v.id ? 'bg-brand-50 border-brand-300' : 'bg-gray-50 hover:bg-gray-100 border-transparent'}`}
          >
            {v.previewUrl && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); togglePreview(v.previewUrl!); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); togglePreview(v.previewUrl!); } }}
                className="shrink-0 w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded-full"
              >
                {playing === v.previewUrl
                  ? <Pause className="w-2.5 h-2.5" />
                  : <Play className="w-2.5 h-2.5" />}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">{v.name}</p>
              {v.gender && <p className="text-gray-400">{v.gender}{v.useCase ? ` · ${v.useCase}` : ''}</p>}
            </div>
            {selectedVoice?.id === v.id && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
          </button>
        ))}
      </div>

      <textarea
        className="w-full text-xs border border-gray-200 rounded-lg p-2 outline-none focus:border-brand-400 resize-none"
        rows={3}
        placeholder="Voice-over script…"
        value={script}
        onChange={(e) => setScript(e.target.value)}
      />

      {done && (
        <p className="text-[11px] text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> Voice-over added — save &amp; re-render to hear it
        </p>
      )}
      {genVoice.isError && (
        <p className="text-[11px] text-red-500">Generation failed — try again</p>
      )}

      <button
        type="button"
        onClick={() => { setDone(false); genVoice.mutate(); }}
        disabled={genVoice.isPending || !selectedVoice || !script.trim()}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-700 disabled:opacity-50"
      >
        {genVoice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
        Generate voice-over
      </button>
    </div>
  );
}

// ── 3. Audio Enhancement ──────────────────────────────────────────────────────

function AudioPanel({ timelineId, audioVersionId }: { timelineId: string; audioVersionId?: string }) {
  const [opts, setOpts] = useState({
    trimSilence: true,
    denoise: true,
    normalize: true,
    denoiseStrength: 'medium' as 'light' | 'medium' | 'strong',
  });
  const [done, setDone] = useState(false);

  const enhance = useMutation({
    mutationFn: () => {
      if (!audioVersionId) return Promise.reject(new Error('No audio track'));
      return api.editor.enhanceAsset(timelineId, { assetVersionId: audioVersionId, ...opts });
    },
    onSuccess: () => setDone(true),
  });

  if (!audioVersionId) {
    return (
      <p className="px-3 pb-3 text-[11px] text-gray-400">
        No audio track found in the timeline.
      </p>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-2">
      {(['trimSilence', 'denoise', 'normalize'] as const).map((key) => (
        <label key={key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={opts[key] as boolean}
            onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))}
            className="rounded border-gray-300"
          />
          {{ trimSilence: 'Trim silence', denoise: 'Denoise', normalize: 'Normalize loudness' }[key]}
        </label>
      ))}

      {opts.denoise && (
        <div className="flex gap-1 pl-5">
          {(['light', 'medium', 'strong'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOpts((o) => ({ ...o, denoiseStrength: s }))}
              className={`text-[10px] px-2 py-0.5 rounded border ${opts.denoiseStrength === s ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {done && (
        <p className="text-[11px] text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> Audio enhanced — save &amp; re-render to apply
        </p>
      )}
      {enhance.isError && (
        <p className="text-[11px] text-red-500">Enhancement failed — try again</p>
      )}

      <button
        type="button"
        onClick={() => { setDone(false); enhance.mutate(); }}
        disabled={enhance.isPending}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50"
      >
        {enhance.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
        Enhance audio
      </button>
    </div>
  );
}

// ── 4. Characters ─────────────────────────────────────────────────────────────

interface Character {
  id: string;
  name: string;
  voiceProvider: 'openai' | 'elevenlabs';
  voiceId: string;
  avatarStyle: string;
  avatarUrl?: string;
}

function CharactersPanel({ timelineId, captionsText }: { timelineId: string; captionsText: string }) {
  const [selected, setSelected] = useState<Character | null>(null);
  const [script, setScript] = useState(captionsText.slice(0, 1000));
  const [done, setDone] = useState(false);

  const charsQ = useQuery({
    queryKey: ['studio-characters'],
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('cf_token') ?? '') : '';
      const res = await fetch('/api/proxy/characters', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      return res.json() as Promise<Character[]>;
    },
    staleTime: 300_000,
  });

  const genVoice = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error('No character selected'));
      return api.editor.generateVoice(timelineId, {
        text: script,
        voiceId: selected.voiceId,
        source: selected.voiceProvider,
      });
    },
    onSuccess: () => setDone(true),
  });

  const diceBear = (c: Character) => {
    const seed = c.name.toLowerCase().replace(/\s+/g, '-');
    return c.avatarUrl ?? `https://api.dicebear.com/7.x/${c.avatarStyle}/svg?seed=${encodeURIComponent(seed)}&size=40`;
  };

  return (
    <div className="px-3 pb-3 space-y-2">
      {charsQ.isLoading && <p className="text-[11px] text-gray-400">Loading characters…</p>}
      {charsQ.isError && <p className="text-[11px] text-red-400">Could not load characters</p>}
      {!charsQ.isLoading && !charsQ.isError && (charsQ.data ?? []).length === 0 && (
        <p className="text-[11px] text-gray-400">
          No characters yet —{' '}
          <a href="/studio/characters" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
            create one in Character Studio
          </a>
        </p>
      )}

      <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
        {(charsQ.data ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs border text-left ${selected?.id === c.id ? 'bg-fuchsia-50 border-fuchsia-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={diceBear(c)} alt="" className="w-8 h-8 rounded-xl shrink-0 object-cover" />
            <span className="font-medium text-gray-800 flex-1 truncate">{c.name}</span>
            {selected?.id === c.id && <Check className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />}
          </button>
        ))}
      </div>

      <textarea
        className="w-full text-xs border border-gray-200 rounded-lg p-2 outline-none focus:border-brand-400 resize-none"
        rows={3}
        placeholder="Lines for this character…"
        value={script}
        onChange={(e) => setScript(e.target.value)}
      />

      {done && (
        <p className="text-[11px] text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> Added — save &amp; re-render to hear it
        </p>
      )}
      {genVoice.isError && (
        <p className="text-[11px] text-red-500">Generation failed — try again</p>
      )}

      <button
        type="button"
        onClick={() => { setDone(false); genVoice.mutate(); }}
        disabled={genVoice.isPending || !selected || !script.trim()}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs hover:bg-fuchsia-700 disabled:opacity-50"
      >
        {genVoice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
        Generate narration
      </button>
    </div>
  );
}

// ── 5. Thumbnails ─────────────────────────────────────────────────────────────

interface Thumbnail { id: string; url: string; isPrimary: boolean }

function ThumbnailsPanel({ shortClipId }: { shortClipId: string }) {
  const rawBase = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/api\/v\d+\/?$/, '');

  const thumbQ = useQuery({
    queryKey: ['clip-thumbnails', shortClipId],
    queryFn: () => api.shortsStudio.thumbnails(shortClipId).then((r) => r.data as Thumbnail[]),
    staleTime: 60_000,
  });

  const setPrimary = useMutation({
    mutationFn: (id: string) => api.shortsStudio.setPrimaryThumbnail(id),
    onSuccess: () => void thumbQ.refetch(),
  });

  if (thumbQ.isLoading) {
    return <p className="px-3 pb-3 text-[11px] text-gray-400">Loading thumbnails…</p>;
  }

  const thumbs = thumbQ.data ?? [];
  if (thumbs.length === 0) {
    return (
      <p className="px-3 pb-3 text-[11px] text-gray-400">
        Thumbnails are generated when you render. Re-open this panel after your first render.
      </p>
    );
  }

  return (
    <div className="px-3 pb-3 grid grid-cols-2 gap-2">
      {thumbs.map((t) => {
        const src = t.url.startsWith('http') ? t.url : `${rawBase}${t.url}`;
        return (
          <div key={t.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="thumbnail" className="w-full aspect-video object-cover" />
            {t.isPrimary && (
              <span className="absolute top-1 left-1 text-[9px] bg-brand-600 text-white px-1.5 py-0.5 rounded font-semibold">
                Primary
              </span>
            )}
            {!t.isPrimary && (
              <button
                type="button"
                onClick={() => setPrimary.mutate(t.id)}
                disabled={setPrimary.isPending}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-medium"
              >
                {setPrimary.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set primary'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 6. Image Overlays (stub) ──────────────────────────────────────────────────

function ImagesPanel() {
  return (
    <div className="px-3 pb-3 space-y-2">
      <p className="text-[11px] text-gray-500">
        Browse stock images and add them as overlay clips. Full drag-and-drop support is coming soon.
      </p>
      <a
        href="/studio/assets"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 hover:underline"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        Open Image Studio
      </a>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

const PANELS = [
  { id: 'music',   icon: <Music2 className="w-4 h-4 text-cyan-600" />,    label: 'Background Music' },
  { id: 'voice',   icon: <Mic    className="w-4 h-4 text-brand-600" />,   label: 'Voice-Over' },
  { id: 'audio',   icon: <Volume2 className="w-4 h-4 text-emerald-600" />, label: 'Audio Enhancement' },
  { id: 'chars',   icon: <Users  className="w-4 h-4 text-fuchsia-600" />, label: 'Characters' },
  { id: 'thumbs',  icon: <Sparkles className="w-4 h-4 text-amber-500" />, label: 'Thumbnails' },
  { id: 'images',  icon: <ImageIcon className="w-4 h-4 text-purple-600" />, label: 'Image Overlays' },
] as const;

type PanelId = typeof PANELS[number]['id'];

export function StudioToolPanels({ timelineId, shortClipId, captionsText, audioVersionId }: Props) {
  const [open, setOpen] = useState<PanelId | null>(null);
  const toggle = (id: PanelId) => setOpen((o) => (o === id ? null : id));

  function renderContent(id: PanelId) {
    switch (id) {
      case 'music':  return <MusicPanel captionsText={captionsText} />;
      case 'voice':  return <VoicePanel timelineId={timelineId} captionsText={captionsText} />;
      case 'audio':  return <AudioPanel timelineId={timelineId} audioVersionId={audioVersionId} />;
      case 'chars':  return <CharactersPanel timelineId={timelineId} captionsText={captionsText} />;
      case 'thumbs': return <ThumbnailsPanel shortClipId={shortClipId} />;
      case 'images': return <ImagesPanel />;
    }
  }

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Studio Tools</p>
      <div className="space-y-1">
        {PANELS.map((p) => (
          <div key={p.id} className="border border-gray-100 rounded-xl overflow-hidden">
            <PanelHeader
              icon={p.icon}
              label={p.label}
              open={open === p.id}
              onToggle={() => toggle(p.id)}
            />
            {open === p.id && (
              <div className="border-t border-gray-100 pt-2">
                {renderContent(p.id)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
