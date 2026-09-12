'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Send, Mic, MicOff, ShieldCheck, Trash2,
  CheckCircle2, Circle, Loader2, AlertCircle, BrainCircuit, Zap,
  BookOpen, FileText, Calendar, Search, Sparkles,
  MessageSquare, ListChecks, type LucideIcon,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { checkInputSafety, httpErrorMessage, SAFETY_COLORS } from '@/lib/safety';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  fromCache?: boolean;
}

interface PlanStep {
  label: string;
  agentName?: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}

interface TaskPlan {
  goal: string;
  steps: PlanStep[];
}

interface CopilotResponse {
  reply: string;
  language?: string;
  executed?: { action: string; result: unknown };
  needsConfirmation?: Record<string, unknown> & { action: string };
  estimatedCredits?: number | null;
  fromCache?: boolean;
  plan?: TaskPlan;
  navigate?: string;
}

interface RecentJob {
  id: string;
  type: string;
  status: string;
  error?: string | null;
  createdAt: string;
  project: { id: string; title: string };
}

interface QuickAction {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  placeholder: string;
  template: (v: string) => string;
  color: string;
  bg: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'research', icon: BookOpen,    label: 'Research',     description: "I'll dig into any topic for you",            placeholder: 'What topic?',                template: v => `Research this topic in depth for a YouTube video: ${v}`,                                   color: '#3b82f6', bg: '#eff6ff' },
  { id: 'script',   icon: FileText,    label: 'Script Ideas', description: 'Build a full script from scratch',           placeholder: 'Video title or concept?',    template: v => `Generate a detailed script outline for a YouTube video titled: "${v}"`,               color: '#374151', bg: '#f3f4f6' },
  { id: 'calendar', icon: Calendar,    label: 'Content Plan', description: 'Lock in your posting schedule',              placeholder: "What's your niche?",         template: v => `Suggest a 2-week content calendar for a YouTube channel about: ${v}`,               color: '#10b981', bg: '#ecfdf5' },
  { id: 'seo',      icon: Search,      label: 'SEO Analysis', description: 'Boost your reach with smarter SEO',          placeholder: 'Topic or keyword?',          template: v => `Analyze the SEO potential and suggest optimized titles, tags, and keywords for: ${v}`, color: '#d97706', bg: '#fefce8' },
  { id: 'ideas',    icon: Sparkles,    label: 'Video Ideas',  description: "Brainstorm ideas that'll get views",         placeholder: "What's your channel niche?", template: v => `Give me 10 viral YouTube video ideas for a channel focused on: ${v}`,             color: '#ec4899', bg: '#fdf2f8' },
  { id: 'factcheck',icon: ShieldCheck, label: 'Fact Check',   description: "Don't get caught slipping — I'll check it", placeholder: 'Claim to verify?',           template: v => `Fact-check this claim for my YouTube video: "${v}"`,                                color: '#0d9488', bg: '#f0fdfa' },
];

const PROMPT_CHIPS = [
  "What's blowing up in my niche right now?",
  "Give me 5 video ideas I can shoot next week",
  "Help me plan my next 2 weeks of uploads",
  "Check my scripts before I post",
];

const HISTORY_KEY = 'cf_copilot_history';
const CHAT_KEY    = 'cf_copilot_chat';
const MAX_HISTORY = 12;

function loadHistory(): { text: string; ts: number }[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as { text: string; ts: number }[]; }
  catch { return []; }
}

function saveToHistory(text: string) {
  const existing = loadHistory().filter(h => h.text !== text);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([{ text, ts: Date.now() }, ...existing].slice(0, MAX_HISTORY)));
}

function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5)     return 'just now';
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── STT ────────────────────────────────────────────────────────────────────────

type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { [i: number]: { isFinal: boolean } & ArrayLike<{ transcript: string }> } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void; stop: () => void;
};

function getBrowserRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const BAR_HEIGHTS = ['16px','26px','38px','48px','54px','48px','38px','26px','16px'];
const BAR_DELAYS  = ['0s','.09s','.18s','.06s','.15s','.03s','.21s','.12s','.09s'];

function VoiceBars({ active, color = '#fff', compact = false }: { active: boolean; color?: string; compact?: boolean }) {
  const heights = compact ? ['5px','9px','13px','17px','19px','17px','13px','9px','5px'] : BAR_HEIGHTS;
  const w = compact ? '2.5px' : '4px';
  const gap = compact ? '2px' : '3.5px';
  const containerH = compact ? '22px' : '60px';
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap,height:containerH }}>
      {heights.map((h, i) => (
        <span key={i} style={{ display:'inline-block', width:w, borderRadius:'4px', background:color, height:h, transformOrigin:'center', transform:active?'scaleY(1)':'scaleY(0.12)', opacity:active?1:0.25, animation:active?`cfVoiceBar .75s ease-in-out ${BAR_DELAYS[i]} infinite`:'none', transition:'transform .4s cubic-bezier(.4,0,.2,1), opacity .4s' }} />
      ))}
    </div>
  );
}

function StepIcon({ status }: { status: PlanStep['status'] }) {
  if (status === 'done')    return <CheckCircle2 style={{ width:14,height:14,color:'#4ADE80',flexShrink:0 }} />;
  if (status === 'running') return <Loader2 style={{ width:14,height:14,color:'#9ca3af',flexShrink:0,animation:'cfSpinSimple 1s linear infinite' }} />;
  if (status === 'failed')  return <AlertCircle style={{ width:14,height:14,color:'#F87171',flexShrink:0 }} />;
  return <Circle style={{ width:14,height:14,color:'rgba(255,255,255,.2)',flexShrink:0 }} />;
}

function JobDot({ status }: { status: string }) {
  const c: Record<string,string> = { COMPLETED:'#4ADE80',RUNNING:'#9ca3af',PENDING:'#FBBF24',QUEUED:'#FBBF24',FAILED:'#F87171',CANCELLED:'#d1d5db' };
  return <span style={{ display:'inline-block',width:7,height:7,borderRadius:'50%',background:c[status]??'#d1d5db',flexShrink:0 }} />;
}

// ── TTS helpers ────────────────────────────────────────────────────────────────

function cleanForTTS(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, 'code example.')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^[\s]*[•·▪▸◦\-\*]\s+/gm, '')
    .replace(/^(\s*\d+)[.)]\s+/gm, '$1, ')
    .replace(/[→←↑↓↗↘•·▪▸◦–—]/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?,])\s*([.!?,])+/g, '$1')
    .trim();
}

function pickBestVoice(voices: SpeechSynthesisVoice[], langTag: string): SpeechSynthesisVoice | null {
  const prefix = langTag.split('-')[0]!.toLowerCase();
  const candidates = voices.filter(v => {
    const vl = v.lang.toLowerCase();
    return vl === langTag.toLowerCase() || vl.startsWith(prefix + '-') || vl === prefix;
  });
  if (!candidates.length) {
    const enFallback = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    if (enFallback.length) return pickBestVoice(enFallback, 'en-US') ?? enFallback[0] ?? null;
    return null;
  }
  const PREFER = ['natural','neural','enhanced','premium','online','aria','jenny','guy','samantha','alex','zira','google us english','google uk english'];
  const AVOID  = ['compact','linear'];
  const scored = candidates.map(v => {
    const name = v.name.toLowerCase();
    let score = 0;
    if (AVOID.some(a => name.includes(a))) score -= 20;
    PREFER.forEach((p, i) => { if (name.includes(p)) score += (PREFER.length - i) * 2; });
    if (v.localService) score += 3;
    if (v.default)      score += 1;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.v ?? null;
}

function chunkForTTS(text: string, maxChars = 160): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const part of parts) {
    if (current.length + part.length > maxChars && current.trim()) { chunks.push(current.trim()); current = part; }
    else current += part;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

function detectEmotion(text: string): 'excited' | 'error' | 'neutral' {
  const t = text.toLowerCase();
  if (/error|fail|sorry|unable|can't|cannot|problem|issue/.test(t)) return 'error';
  if (/great|amazing|awesome|perfect|done|created|success|ready|excellent|wonderful/.test(t)) return 'excited';
  return 'neutral';
}

type PanelId = 'chat' | 'actions' | 'jobs';

// ── Main component ─────────────────────────────────────────────────────────────

export function CopilotPanel() {
  const router = useRouter();

  // panel
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  // chat — persisted across page loads
  const [messages, setMessages]     = useState<ChatMessage[]>(() => {
    try { const s = localStorage.getItem(CHAT_KEY); return s ? (JSON.parse(s) as ChatMessage[]) : []; }
    catch { return []; }
  });
  const [input, setInput]           = useState('');
  const [busy, setBusy]             = useState(false);
  const [excited, setExcited]       = useState(false);
  const [pending, setPending]       = useState<CopilotResponse['needsConfirmation']|null>(null);
  const [pendingEst, setPendingEst] = useState<number|null>(null);

  // voice
  const [voiceEnabled, setVoiceEnabled]   = useState(false);
  const [listening, setListening]         = useState(false);
  const [speaking, setSpeaking]           = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [recording, setRecording]         = useState(false);
  const [micError, setMicError]           = useState<string|null>(null);
  const [serverStt, setServerStt]         = useState<boolean|null>(null);
  const [lang]                            = useState<string>('en-US');
  const [speakingIdx, setSpeakingIdx]     = useState<number|null>(null);
  const [ttsAvailable, setTtsAvailable]   = useState<boolean|null>(null);

  // quick actions
  const [activeAction, setActiveAction] = useState<string|null>(null);
  const [actionInput, setActionInput]   = useState('');

  // jobs
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  // misc
  const [currentPlan, setCurrentPlan] = useState<TaskPlan|null>(null);

  // widget collapsed/expanded
  const [widgetOpen, setWidgetOpen] = useState(false);

  // real-time voice amplitude (5 bars, 0–1)
  const [volumeBars, setVolumeBars] = useState<number[]>([0.15, 0.15, 0.15, 0.15, 0.15]);

  // refs
  const conversationRef  = useRef(false);
  const recognitionRef   = useRef<SpeechRecognitionLike|null>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const micAudioCtxRef   = useRef<AudioContext|null>(null);
  const micAnalyserRef   = useRef<AnalyserNode|null>(null);
  const micRafRef        = useRef<number>(0);
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const speechPrimedRef  = useRef(false);
  const busyRef          = useRef(false);

  // Persist chat messages to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages)); } catch { /* storage full */ }
  }, [messages]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      setWidgetOpen(open => {
        if (!open) setActivePanel(prev => prev ?? 'chat');
        return !open;
      });
    };
    window.addEventListener('cf:open-copilot', handler as EventListener);
    return () => window.removeEventListener('cf:open-copilot', handler as EventListener);
  }, []);

  useEffect(() => {
    setVoiceEnabled(localStorage.getItem('cf_copilot_voice') === 'true');
    setTtsAvailable('speechSynthesis' in window);
    apiClient.get('/copilot/stt-status')
      .then(r => setServerStt((r.data as { available: boolean }).available))
      .catch(() => setServerStt(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages, busy, pending, currentPlan]);

  useEffect(() => {
    if (activePanel !== 'jobs') return;
    const fetch = () => {
      apiClient.get('/copilot/jobs?take=10')
        .then(r => setRecentJobs((r.data as { data: RecentJob[] }).data))
        .catch(() => undefined);
    };
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, [activePanel]);

  useEffect(() => {
    if (!micError) return;
    const id = setTimeout(() => setMicError(null), 6000);
    return () => clearTimeout(id);
  }, [micError]);

  // ── Voice amplitude analyser ──────────────────────────────────────────────

  const startVoiceAnalyser = useCallback((stream: MediaStream) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC: typeof AudioContext = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      ctx.createMediaStreamSource(stream).connect(analyser);
      micAudioCtxRef.current = ctx;
      micAnalyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.floor(analyser.frequencyBinCount / 5);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = Array.from({ length: 5 }, (_, idx) => {
          let sum = 0;
          for (let j = idx * step; j < (idx + 1) * step; j++) sum += data[j] ?? 0;
          return Math.max(0.08, (sum / step) / 255);
        });
        setVolumeBars(bars);
        micRafRef.current = requestAnimationFrame(tick);
      };
      micRafRef.current = requestAnimationFrame(tick);
    } catch { /* AudioContext unavailable */ }
  }, []);

  const stopVoiceAnalyser = useCallback(() => {
    cancelAnimationFrame(micRafRef.current);
    micAnalyserRef.current?.disconnect();
    micAudioCtxRef.current?.close().catch(() => {});
    micAudioCtxRef.current = null;
    micAnalyserRef.current = null;
    setVolumeBars([0.15, 0.15, 0.15, 0.15, 0.15]);
  }, []);

  // ── Audio priming ──────────────────────────────────────────────────────────

  const primeAudio = useCallback(() => {
    if (speechPrimedRef.current || typeof window === 'undefined') return;
    speechPrimedRef.current = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC: typeof AudioContext = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (AC) { const ctx = new AC(); ctx.resume().catch(() => {}); }
    } catch {}
    if (!('speechSynthesis' in window)) return;
    try {
      const silent = new SpeechSynthesisUtterance('​');
      silent.volume = 0; silent.rate = 10;
      window.speechSynthesis.speak(silent);
    } catch {}
    try { window.speechSynthesis.getVoices(); } catch {}
  }, []);

  const primeSpeechSession = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('​');
      u.volume = 0; u.rate = 10;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  // ── TTS ────────────────────────────────────────────────────────────────────

  const startListeningRef = useRef<() => void>(() => undefined);

  const speak = useCallback((text: string, replyLang?: string, onDone?: () => void, msgIdx?: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { onDone?.(); return; }
    if (msgIdx !== undefined) setSpeakingIdx(msgIdx);
    const target = replyLang ?? lang;
    window.speechSynthesis.cancel();
    const cleaned = cleanForTTS(text);
    if (!cleaned) { onDone?.(); return; }
    const chunks = chunkForTTS(cleaned);
    let chunkIdx = 0;
    let keepAlive: ReturnType<typeof setInterval> | null = null;

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = pickBestVoice(voices, target);
      function next() {
        if (chunkIdx >= chunks.length) {
          if (keepAlive) clearInterval(keepAlive);
          setSpeaking(false); setSpeakingIdx(null); onDone?.();
          return;
        }
        const chunk = chunks[chunkIdx++]!;
        const utt = new SpeechSynthesisUtterance(chunk);
        utt.lang = bestVoice?.lang ?? target;
        utt.rate = 0.93; utt.pitch = 1.0; utt.volume = 1.0;
        if (bestVoice) utt.voice = bestVoice;
        if (chunkIdx === 1) utt.onstart = () => setSpeaking(true);
        utt.onend = next;
        utt.onerror = (e) => {
          if (keepAlive) clearInterval(keepAlive);
          setSpeaking(false); setSpeakingIdx(null);
          if (e.error === 'not-allowed') {
            setActivePanel('chat');
            return;
          }
          if (e.error !== 'canceled' && e.error !== 'interrupted') console.warn('[TTS] error:', e.error);
        };
        window.speechSynthesis.speak(utt);
      }
      keepAlive = setInterval(() => { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); }, 250);
      next();
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { doSpeak(); }
    else {
      let fired = false;
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; if (!fired) { fired = true; doSpeak(); } };
      let attempts = 0;
      const poll = setInterval(() => {
        if (fired) { clearInterval(poll); return; }
        if (window.speechSynthesis.getVoices().length > 0) { clearInterval(poll); window.speechSynthesis.onvoiceschanged = null; if (!fired) { fired = true; doSpeak(); } return; }
        if (++attempts > 20) { clearInterval(poll); window.speechSynthesis.onvoiceschanged = null; if (!fired) { fired = true; doSpeak(); } }
      }, 150);
    }
  }, [lang]);

  // ── Send ───────────────────────────────────────────────────────────────────

  const send = useCallback(async (text: string, confirmedCommand?: Record<string, unknown>) => {
    if (voiceEnabled || conversationRef.current) primeSpeechSession();
    const isVoiceSend = conversationRef.current;

    const nextMessages: ChatMessage[] = text
      ? [...messages, { role: 'user' as const, content: text }]
      : messages;
    if (text) {
      setMessages(nextMessages);
      saveToHistory(text);
    }
    setInput('');
    setLiveTranscript('');
    setPending(null);
    setPendingEst(null);

    if (text.trim()) {
      const safety = checkInputSafety(text.trim());
      if (!safety.ok) {
        const cat = safety.category ?? 'abuse';
        const colors = SAFETY_COLORS[cat];
        setMessages(prev => [...prev, { role:'assistant', content:`${colors.icon} ${safety.message}`, fromCache:false }]);
        return;
      }
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await apiClient.post('/copilot/chat', {
        messages: nextMessages.slice(-10),
        inputMode: conversationRef.current ? 'voice' : 'text',
        lang: 'en',
        ...(confirmedCommand ? { confirmedCommand } : {}),
        ...(!confirmedCommand && pending ? { pendingCommand: pending } : {}),
      }, { timeout: 90_000 });
      const data = res.data as CopilotResponse;
      setMessages(m => [...m, { role:'assistant', content:data.reply, fromCache:data.fromCache }]);
      const emotion = detectEmotion(data.reply);
      if (emotion === 'excited') { setExcited(true); setTimeout(() => setExcited(false), 700); }
      if (!isVoiceSend) setActivePanel(prev => prev ?? 'chat');
      if (data.needsConfirmation) { setPending(data.needsConfirmation); setPendingEst(data.estimatedCredits ?? null); }
      if (data.plan)     setCurrentPlan(data.plan);
      if (data.navigate) router.push(data.navigate);
      const wasVoiceInput = conversationRef.current;
      if (voiceEnabled || wasVoiceInput) {
        conversationRef.current = true;
        const newIdx = nextMessages.length;
        primeSpeechSession();
        speak(data.reply, data.language, () => { if (voiceEnabled) startListeningRef.current(); }, newIdx);
      } else {
        conversationRef.current = false;
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number }; code?: string };
      const status = axiosErr.response?.status;
      const isTimeout = axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ERR_NETWORK' || status === 504;
      const is502 = status === 502 || status === 503;
      const msg = status === 504
        ? 'The AI is taking longer than expected. Try again in a moment.'
        : is502 ? 'The AI assistant is temporarily unavailable. Please try again in a moment.'
        : status ? httpErrorMessage(status)
        : isTimeout ? 'The AI is taking longer than expected. Check your connection and try again.'
        : (typeof window !== 'undefined' && window.location.hostname === 'localhost')
          ? 'Cannot reach the API server — run `pnpm dev` in apps/api (port 4007).'
          : 'Connection error — please check your internet and try again.';
      setMessages(m => [...m, { role:'assistant', content:`⚠️ ${msg}`, fromCache:false }]);
      conversationRef.current = false;
      window.speechSynthesis?.cancel();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [messages, speak, pending, router, voiceEnabled, primeSpeechSession]);

  // ── STT ────────────────────────────────────────────────────────────────────

  const stopServerSTT = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  const startServerSTT = useCallback(async () => {
    if (typeof window === 'undefined') return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setListening(false); setMicError('Microphone permission denied'); return; }
    startVoiceAnalyser(stream);
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];
    setRecording(true);
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stopVoiceAnalyser();
      setRecording(false); setListening(false);
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < 500) { setLiveTranscript(''); return; }
      setLiveTranscript('Transcribing…');
      try {
        const form = new FormData();
        form.append('audio', blob, `recording.${mimeType.includes('ogg') ? 'ogg' : 'webm'}`);
        form.append('language', 'en');
        const { data } = await apiClient.post('/copilot/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const text = (data as { text: string }).text?.trim() ?? '';
        if (text) { conversationRef.current = true; setLiveTranscript(text); void send(text); }
        else      { setLiveTranscript(''); conversationRef.current = false; }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const msg = status === 400
          ? 'Voice input not configured — type your message instead'
          : 'Voice transcription failed — please type your message';
        setLiveTranscript(msg);
        setMicError(msg);
        conversationRef.current = false;
      }
      setLiveTranscript('');
    };
    recorder.start(1000);
  }, [send, startVoiceAnalyser, stopVoiceAnalyser]);

  const startBrowserSTT = useCallback(async () => {
    const rec = getBrowserRecognition();
    if (!rec) { setMicError('Speech recognition not supported in this browser'); return; }
    recognitionRef.current = rec;
    let stream: MediaStream | null = null;
    let analyserStream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      analyserStream = stream;
      startVoiceAnalyser(stream);
    } catch { /* no amplitude */ }
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        if (r.isFinal) finalText += r[0]?.transcript ?? '';
        else interim += r[0]?.transcript ?? '';
      }
      setLiveTranscript(finalText + interim);
      setInput(finalText + interim);
    };
    rec.onend = () => {
      stopVoiceAnalyser();
      analyserStream?.getTracks().forEach(t => t.stop());
      setListening(false);
      if (finalText.trim()) { conversationRef.current = true; void send(finalText.trim()); }
      else { conversationRef.current = false; setInput(''); setLiveTranscript(''); }
    };
    rec.onerror = e => {
      stopVoiceAnalyser();
      analyserStream?.getTracks().forEach(t => t.stop());
      setListening(false); conversationRef.current = false;
      if (e.error === 'not-allowed') setMicError('Mic blocked — allow microphone in your browser');
    };
    window.speechSynthesis?.cancel();
    try { rec.start(); }
    catch { stopVoiceAnalyser(); analyserStream?.getTracks().forEach(t => t.stop()); setListening(false); conversationRef.current = false; setMicError('Could not start microphone'); }
  }, [send, lang, startVoiceAnalyser, stopVoiceAnalyser]);

  const startListening = useCallback(() => {
    setMicError(null);
    if (serverStt === true) void startServerSTT();
    else void startBrowserSTT();
  }, [serverStt, startServerSTT, startBrowserSTT]);
  startListeningRef.current = startListening;

  const toggleMic = useCallback(() => {
    primeAudio();
    if (listening || recording) {
      conversationRef.current = false;
      stopVoiceAnalyser();
      if (mediaRecorderRef.current) stopServerSTT();
      else recognitionRef.current?.stop();
      setListening(false); setRecording(false);
      return;
    }
    setListening(true); setMicError(null); conversationRef.current = true;
    startListening();
  }, [listening, recording, startListening, stopServerSTT, stopVoiceAnalyser, primeAudio]);

  function toggleVoice() {
    primeAudio();
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem('cf_copilot_voice', String(next));
    if (next) {
      conversationRef.current = true;
      setListening(true);
      setMicError(null);
      setTimeout(() => startListeningRef.current(), 150);
    } else {
      conversationRef.current = false;
      if (mediaRecorderRef.current) stopServerSTT();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setListening(false); setRecording(false); setSpeaking(false); setSpeakingIdx(null);
    }
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  function handleTextarea(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) void send(input.trim()); }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const isVoiceActive   = listening || recording;
  const isTranscribing  = liveTranscript === 'Transcribing…';
  const currentAction   = QUICK_ACTIONS.find(a => a.id === activeAction);
  const statusLabel     = micError ? micError : listening ? 'Listening…' : speaking ? 'Speaking…' : busy ? 'Thinking…' : 'Ready';
  const statusColor     = micError ? '#F87171' : listening ? '#4ADE80' : speaking ? '#9ca3af' : busy ? '#FBBF24' : '#4ADE80';

  // suppress unused-var lint for states set by voice analyser but not displayed
  void excited; void volumeBars; void relTime;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .cf-copilot-widget * { box-sizing: border-box; }
        .cf-copilot-widget textarea::placeholder { color: rgba(255,255,255,0.32); }
        .cf-copilot-widget textarea { caret-color: #9ca3af; }
        .cf-popup-input:focus-within {
          border-color: rgba(107,114,128,0.5) !important;
          box-shadow: 0 0 0 3px rgba(75,85,99,0.12) !important;
        }
        .cf-tab-btn { transition: all 0.15s; }
        .cf-tab-btn:hover { color: rgba(255,255,255,0.9) !important; background: rgba(255,255,255,0.1) !important; }
        .cf-act-card { transition: background 0.17s, border-color 0.17s, transform 0.15s; }
        .cf-act-card:hover:not(.cf-act-active) {
          background: rgba(255,255,255,0.1) !important;
          border-color: rgba(255,255,255,0.18) !important;
          transform: translateY(-2px);
        }
        .cf-msg-row:hover .cf-msg-assistant { background: rgba(255,255,255,0.13) !important; }
        .cf-trigger-btn { transition: transform 0.2s, box-shadow 0.2s; }
        .cf-trigger-btn:hover { transform: scale(1.07); }
        @media (max-width: 768px) {
          .cf-copilot-widget { bottom: 82px !important; right: 10px !important; }
        }
        @media (max-width: 480px) {
          .cf-copilot-widget { bottom: 86px !important; right: 8px !important; }
        }
        @keyframes cfVoiceBar   { 0%,100%{transform:scaleY(0.25);opacity:0.5} 50%{transform:scaleY(1);opacity:1} }
        @keyframes cfPulse      { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes cfSlideUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cfSpinSimple { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes cfPanelIn    { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      <div className="cf-copilot-widget" style={{ position:'fixed', bottom:24, right:24, zIndex:9999 }}>

        {/* ── Panel ── */}
        {widgetOpen && (
          <div style={{
            position:'absolute', bottom:68, right:0,
            width:360, maxWidth:'calc(100vw - 20px)',
            maxHeight:'min(520px, calc(100svh - 110px))',
            background:'rgba(9,6,24,0.97)',
            backdropFilter:'blur(60px) saturate(180%)',
            WebkitBackdropFilter:'blur(60px) saturate(180%)',
            borderRadius:20, border:'1px solid rgba(255,255,255,0.1)',
            boxShadow:'0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
            overflow:'hidden', display:'flex', flexDirection:'column',
            animation:'cfPanelIn 0.22s cubic-bezier(.22,1,.36,1) both',
          }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#1f2937,#111827)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Zap style={{ width:15, height:15, color:'#d1d5db' }} />
              </div>
              <div style={{ flex:'1 1 auto', minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', letterSpacing:'-.2px' }}>Sozialzynk Copilot</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:1 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:statusColor, transition:'background .3s', flexShrink:0 }} />
                  <span style={{ fontSize:10.5, color:'rgba(255,255,255,.4)', fontWeight:500 }}>{statusLabel}</span>
                </div>
              </div>
              {activePanel === 'chat' && messages.length > 0 && (
                <button type="button" title="Clear chat"
                  onClick={() => { setMessages([]); localStorage.removeItem(CHAT_KEY); }}
                  style={{ width:28, height:28, borderRadius:8, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(248,113,113,.7)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                  <Trash2 style={{ width:13, height:13 }} />
                </button>
              )}
              <button type="button"
                onClick={() => { setWidgetOpen(false); window.speechSynthesis?.cancel(); }}
                style={{ width:28, height:28, borderRadius:8, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.6)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                <X style={{ width:14, height:14 }} />
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display:'flex', gap:2, padding:'8px 10px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:0, flexShrink:0 }}>
              {([
                { id:'chat'    as PanelId, Icon:MessageSquare, label:'Chat'    },
                { id:'actions' as PanelId, Icon:Zap,           label:'Actions' },
                { id:'jobs'    as PanelId, Icon:ListChecks,    label:'Tasks'   },
              ] as const).map(({ id, Icon, label }) => {
                const isA = activePanel === id;
                return (
                  <button key={id} type="button" className="cf-tab-btn"
                    onClick={() => setActivePanel(id)}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'7px 12px 9px', borderRadius:'8px 8px 0 0',
                      background: isA ? 'rgba(255,255,255,0.08)' : 'transparent',
                      borderBottom: isA ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                      color: isA ? '#fff' : 'rgba(255,255,255,0.4)',
                      fontSize:12, fontWeight: isA ? 700 : 500, cursor:'pointer', border:'none',
                    }}>
                    <Icon style={{ width:12, height:12 }} />{label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div style={{ flex:'1 1 auto', overflow:'hidden', display:'flex', flexDirection:'column' }}>

              {/* ── CHAT ── */}
              {(activePanel === 'chat' || activePanel === null) && (
                <>
                  <div style={{ flex:'1 1 auto', overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:9 }}>
                    {messages.length === 0 && !busy && (
                      <div style={{ padding:'6px 0 4px' }}>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:10, lineHeight:1.5 }}>
                          Scripts, SEO, ideas, research — ask me anything.
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {PROMPT_CHIPS.map(chip => (
                            <button key={chip} onClick={() => void send(chip)}
                              style={{ padding:'5px 10px', borderRadius:99, fontSize:11, fontWeight:500, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.72)', cursor:'pointer' }}>
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((m, i) => (
                      <div key={i} className="cf-msg-row" style={{ display:'flex', gap:7, flexDirection:m.role==='user'?'row-reverse':'row', alignItems:'flex-end' }}>
                        <div style={{ width:22, height:22, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:m.role==='user'?'rgba(255,255,255,0.12)':'linear-gradient(135deg,#374151,#111827)', border:m.role==='user'?'1px solid rgba(255,255,255,0.2)':'none', color:'#fff', fontSize:9, fontWeight:700 }}>
                          {m.role==='user' ? 'U' : <Zap style={{ width:10, height:10 }} />}
                        </div>
                        <div className={m.role==='assistant'?'cf-msg-assistant':''} style={{ maxWidth:'82%', padding:'8px 11px', borderRadius:m.role==='user'?'12px 12px 3px 12px':'3px 12px 12px 12px', fontSize:12.5, lineHeight:1.55, whiteSpace:'pre-wrap', background:m.role==='user'?'linear-gradient(135deg,#374151,#111827)':'rgba(255,255,255,0.09)', color:'#fff', border:m.role==='assistant'?'1px solid rgba(255,255,255,0.09)':'1px solid rgba(255,255,255,0.15)', boxShadow:m.role==='user'?'0 4px 14px -4px rgba(55,65,81,.5)':'none', animation:'cfSlideUp 0.2s ease-out both' }}>
                          {m.content}
                          {m.fromCache && <span style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginLeft:5 }}>cached</span>}
                          {m.role === 'assistant' && ttsAvailable && (
                            <button type="button"
                              onClick={() => {
                                if (speakingIdx === i) { window.speechSynthesis.cancel(); setSpeakingIdx(null); setSpeaking(false); return; }
                                primeSpeechSession();
                                speak(m.content, undefined, undefined, i);
                              }}
                              style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 0 0', marginTop:3, display:'block', fontSize:11, opacity:speakingIdx===i?1:0.45, color:speakingIdx===i?'#d1d5db':'rgba(255,255,255,0.7)', transition:'opacity 0.2s' }}
                              title={speakingIdx===i?'Stop':'Tap to hear'}
                              aria-label={speakingIdx===i?'Stop speaking':'Read aloud'}
                            >
                              {speakingIdx===i?'⏹ Stop':'🔊 Hear'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {busy && (
                      <div style={{ display:'flex', gap:7, alignItems:'flex-end' }}>
                        <div style={{ width:22, height:22, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#374151,#111827)' }}>
                          <Zap style={{ width:10, height:10, color:'#d1d5db' }} />
                        </div>
                        <div style={{ padding:'8px 12px', borderRadius:'3px 12px 12px 12px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.07)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:2, height:14 }}>
                            {['5px','9px','13px','9px','5px'].map((h,j) => (
                              <span key={j} style={{ display:'inline-block', width:2.5, borderRadius:3, background:'rgba(255,255,255,.6)', height:h, animation:`cfVoiceBar .65s ease-in-out ${[0,.1,.2,.1,0][j]}s infinite` }} />
                            ))}
                          </div>
                          <div style={{ fontSize:9.5, fontWeight:600, color:'rgba(255,255,255,.4)', marginTop:2 }}>Thinking…</div>
                        </div>
                      </div>
                    )}

                    {currentPlan && (
                      <div style={{ background:'rgba(30,27,46,0.9)', borderRadius:12, padding:'10px 12px', border:'1px solid rgba(107,114,128,.3)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <BrainCircuit style={{ width:12, height:12, color:'#9ca3af' }} />
                          <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', letterSpacing:'.5px' }}>TASK PLAN</span>
                          <button type="button" onClick={() => setCurrentPlan(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,.35)', cursor:'pointer', padding:0 }}><X style={{ width:10, height:10 }} /></button>
                        </div>
                        <p style={{ fontSize:11.5, fontWeight:600, color:'#fff', marginBottom:8 }}>{currentPlan.goal}</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                          {currentPlan.steps.map((step, si) => (
                            <div key={si} style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <StepIcon status={step.status} />
                              <span style={{ fontSize:11, color:step.status==='pending'?'rgba(255,255,255,.45)':step.status==='failed'?'#F87171':'#fff', fontWeight:step.status==='running'?700:500 }}>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pending && (
                      <div style={{ background:'rgba(251,191,36,0.10)', border:'1px solid rgba(251,191,36,0.28)', borderRadius:12, padding:'10px 12px', animation:'cfSlideUp 0.2s ease-out both' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, color:'#FCD34D', fontWeight:600, fontSize:12, marginBottom:4 }}>
                          <ShieldCheck style={{ width:13, height:13 }} />
                          Confirm: {pending.action.replace(/_/g,' ')}
                        </div>
                        <p style={{ fontSize:11, color:'rgba(252,211,77,0.7)', marginBottom:10 }}>
                          {pendingEst !== null ? `Est. ${pendingEst.toLocaleString()} credits` : 'Cost varies'}
                        </p>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => void send('', pending)} style={{ padding:'6px 12px', background:'rgba(55,65,81,0.8)', color:'#fff', borderRadius:8, fontSize:11.5, fontWeight:600, border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer' }}>Confirm</button>
                          <button onClick={() => { setPending(null); setPendingEst(null); }} style={{ padding:'6px 12px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.65)', borderRadius:8, fontSize:11.5, fontWeight:600, border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input bar */}
                  <div style={{ padding:'8px 10px 10px', background:'rgba(0,0,0,0.2)', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
                    {isVoiceActive ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(55,65,81,0.5)', borderRadius:12, padding:'8px 12px', border:'1px solid rgba(74,222,128,0.3)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                          {['8px','14px','18px','14px','8px'].map((h,i) => (
                            <span key={i} style={{ display:'inline-block', width:2.5, borderRadius:2, background:'#4ADE80', height:h, animation:`cfVoiceBar .65s ease-in-out ${[0,.1,.2,.1,0][i]}s infinite` }} />
                          ))}
                        </div>
                        <span style={{ flex:'1 1 auto', fontSize:12.5, fontWeight:500, color:'rgba(255,255,255,.85)' }}>Listening…</span>
                        <button type="button" onClick={toggleMic} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', fontSize:11.5, fontWeight:600, cursor:'pointer' }}>
                          <span style={{ width:7, height:7, borderRadius:1.5, background:'#fff' }} /> Stop
                        </button>
                      </div>
                    ) : isTranscribing ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(55,65,81,0.25)', border:'1px solid rgba(107,114,128,0.35)', borderRadius:12, padding:'10px 14px' }}>
                        <Loader2 style={{ width:15, height:15, color:'#9ca3af', animation:'cfSpinSimple 1s linear infinite', flexShrink:0 }} />
                        <span style={{ fontSize:12.5, fontWeight:500, color:'#d1d5db' }}>Processing…</span>
                      </div>
                    ) : micError ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'9px 12px' }}>
                        <MicOff style={{ width:14, height:14, color:'#F87171', flexShrink:0 }} />
                        <span style={{ flex:'1 1 auto', fontSize:12, fontWeight:500, color:'#FCA5A5' }}>{micError}</span>
                        <button type="button" onClick={() => setMicError(null)} style={{ background:'none', border:'none', color:'#F87171', cursor:'pointer', padding:0 }}><X style={{ width:12, height:12 }} /></button>
                      </div>
                    ) : (
                      <div className="cf-popup-input" style={{ display:'flex', alignItems:'flex-end', gap:6, background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.10)', borderRadius:12, padding:'6px 6px 6px 12px', transition:'border-color .2s' }}>
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={handleTextarea}
                          onKeyDown={handleKeyDown}
                          disabled={busy}
                          placeholder="What's on your mind?"
                          rows={1}
                          style={{ flex:'1 1 auto', background:'none', border:'none', outline:'none', resize:'none', fontSize:13, color:'#fff', fontFamily:'inherit', maxHeight:80, lineHeight:1.5, paddingTop:2 }}
                        />
                        <button type="button" onClick={toggleMic}
                          style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:voiceEnabled?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.09)', border:`1px solid ${voiceEnabled?'rgba(74,222,128,0.4)':'rgba(255,255,255,0.14)'}`, color:voiceEnabled?'#4ADE80':'rgba(255,255,255,0.55)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                          <Mic style={{ width:13, height:13 }} />
                        </button>
                        <button type="button"
                          onClick={() => { if (input.trim()) void send(input.trim()); }}
                          disabled={!input.trim() || busy}
                          style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:'rgba(55,65,81,0.8)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', opacity:(!input.trim()||busy)?0.4:1, transition:'opacity .15s' }}>
                          <Send style={{ width:13, height:13 }} />
                        </button>
                      </div>
                    )}
                    {/* Voice mode toggle */}
                    {!isVoiceActive && !isTranscribing && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                        <button type="button" onClick={toggleVoice}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:99, fontSize:10.5, fontWeight:600, cursor:'pointer', border:'1px solid', background: voiceEnabled?'rgba(74,222,128,0.12)':'transparent', borderColor: voiceEnabled?'rgba(74,222,128,0.4)':'rgba(255,255,255,0.12)', color: voiceEnabled?'#4ADE80':'rgba(255,255,255,0.35)', transition:'all .2s' }}>
                          {voiceEnabled ? <Mic style={{ width:10, height:10 }} /> : <MicOff style={{ width:10, height:10 }} />}
                          {voiceEnabled ? 'Voice on' : 'Voice off'}
                        </button>
                        {voiceEnabled && (
                          <VoiceBars active={speaking} color="#4ADE80" compact />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── ACTIONS ── */}
              {activePanel === 'actions' && (
                <div style={{ padding:'10px', overflowY:'auto', flex:'1 1 auto' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:currentAction?10:0 }}>
                    {QUICK_ACTIONS.map(action => {
                      const Icon = action.icon;
                      const isAct = activeAction === action.id;
                      return (
                        <button key={action.id} type="button"
                          onClick={() => { setActiveAction(isAct ? null : action.id); setActionInput(''); }}
                          className={`cf-act-card${isAct?' cf-act-active':''}`}
                          style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:7, padding:'11px', borderRadius:12, textAlign:'left', cursor:'pointer', background:isAct?`${action.color}18`:'rgba(255,255,255,0.06)', border:`1.5px solid ${isAct?action.color+'55':'rgba(255,255,255,0.09)'}` }}>
                          <div style={{ width:28, height:28, borderRadius:9, background:`${action.color}22`, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${action.color}33` }}>
                            <Icon style={{ width:14, height:14, color:action.color }} />
                          </div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:isAct?action.color:'rgba(255,255,255,0.88)', marginBottom:1 }}>{action.label}</div>
                            <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.45)', lineHeight:1.4 }}>{action.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {currentAction && (
                    <div style={{ background:`${currentAction.color}12`, border:`1.5px solid ${currentAction.color}44`, borderRadius:12, padding:'11px', marginTop:2 }}>
                      <p style={{ fontSize:11.5, fontWeight:600, color:currentAction.color, marginBottom:8 }}>{currentAction.description}</p>
                      <input autoFocus value={actionInput} onChange={e => setActionInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && actionInput.trim()) { void send(currentAction.template(actionInput.trim())); setActiveAction(null); setActionInput(''); } }}
                        placeholder={currentAction.placeholder}
                        style={{ width:'100%', padding:'8px 11px', borderRadius:9, border:`1px solid ${currentAction.color}44`, fontSize:13, outline:'none', background:'rgba(0,0,0,0.3)', color:'#fff', fontFamily:'inherit', boxSizing:'border-box' as const }} />
                      <div style={{ display:'flex', gap:6, marginTop:8 }}>
                        <button type="button"
                          onClick={() => { if (actionInput.trim()) { void send(currentAction.template(actionInput.trim())); setActivePanel('chat'); setActiveAction(null); setActionInput(''); } }}
                          disabled={!actionInput.trim()}
                          style={{ flex:'1 1 auto', padding:'8px', borderRadius:9, fontSize:12.5, fontWeight:600, color:'#fff', background:`linear-gradient(135deg,${currentAction.color},${currentAction.color}cc)`, border:'none', cursor:'pointer', opacity:actionInput.trim()?1:0.4 }}>
                          Ask Copilot →
                        </button>
                        <button type="button" onClick={() => { setActiveAction(null); setActionInput(''); }}
                          style={{ width:34, borderRadius:9, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                          <X style={{ width:13, height:13 }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TASKS ── */}
              {activePanel === 'jobs' && (
                <div style={{ padding:'8px 10px 10px', overflowY:'auto', flex:'1 1 auto', display:'flex', flexDirection:'column', gap:6 }}>
                  {recentJobs.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'30px 0' }}>
                      <ListChecks style={{ width:24, height:24, color:'rgba(255,255,255,0.15)', margin:'0 auto 8px', display:'block' }} />
                      <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.35)' }}>No tasks yet</p>
                    </div>
                  ) : recentJobs.map(j => (
                    <div key={j.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10 }}>
                      <JobDot status={j.status} />
                      <div style={{ flex:'1 1 auto', minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.9)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.type.replace(/_/g,' ')}</div>
                        <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.45)', marginTop:1 }}>{j.project.title.slice(0,32)}</div>
                        {j.error && <div style={{ fontSize:10, color:'#F87171', marginTop:1 }}>{j.error.slice(0,45)}</div>}
                      </div>
                      <span style={{ fontSize:10.5, fontWeight:600, color:'rgba(255,255,255,0.45)', flexShrink:0, textTransform:'capitalize' as const }}>{j.status.toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Trigger button ── */}
        <button
          type="button"
          className="cf-trigger-btn"
          onClick={() => {
            const opening = !widgetOpen;
            setWidgetOpen(opening);
            if (opening) { setActivePanel(prev => prev ?? 'chat'); primeAudio(); }
            else window.speechSynthesis?.cancel();
          }}
          title={widgetOpen ? 'Close Copilot' : 'Open Copilot'}
          aria-label={widgetOpen ? 'Close Copilot' : 'Open Copilot'}
          style={{
            width:56, height:56, borderRadius:'50%',
            background: widgetOpen
              ? 'rgba(40,30,60,0.96)'
              : 'linear-gradient(145deg,#1f2937,#0f172a)',
            border:`1.5px solid ${widgetOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: widgetOpen
              ? '0 8px 24px rgba(0,0,0,0.5)'
              : '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', position:'relative',
          }}
        >
          {widgetOpen
            ? <X style={{ width:20, height:20, color:'rgba(255,255,255,0.75)' }} />
            : <Zap style={{ width:22, height:22, color:'#d1d5db' }} />
          }
          {/* Notification dot when there are messages and widget is closed */}
          {!widgetOpen && messages.length > 0 && (
            <span style={{
              position:'absolute', top:3, right:3,
              width:11, height:11, borderRadius:'50%',
              background:'#60A5FA', border:'2px solid #0f172a',
              animation:'cfPulse 2s ease-in-out infinite',
            }} />
          )}
        </button>

      </div>
    </>
  );
}
