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
  { id: 'script',   icon: FileText,    label: 'Script Ideas', description: 'Build a full script from scratch',           placeholder: 'Video title or concept?',    template: v => `Generate a detailed script outline for a YouTube video titled: "${v}"`,               color: '#7C3AED', bg: '#f5f2fd' },
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

function removeFromHistory(text: string) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter(h => h.text !== text)));
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
  if (status === 'running') return <Loader2 style={{ width:14,height:14,color:'#A78BFA',flexShrink:0,animation:'cfSpinSimple 1s linear infinite' }} />;
  if (status === 'failed')  return <AlertCircle style={{ width:14,height:14,color:'#F87171',flexShrink:0 }} />;
  return <Circle style={{ width:14,height:14,color:'rgba(255,255,255,.2)',flexShrink:0 }} />;
}

function JobDot({ status }: { status: string }) {
  const c: Record<string,string> = { COMPLETED:'#4ADE80',RUNNING:'#A78BFA',PENDING:'#FBBF24',QUEUED:'#FBBF24',FAILED:'#F87171',CANCELLED:'#d1d5db' };
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

// ── Robot types ───────────────────────────────────────────────────────────────

type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking';
type PanelId = 'chat' | 'actions' | 'jobs';

// ── Robot Avatar — CSS 3D, zero deps, works on all devices + offline ─────────────

// Replaced R3F / WebGL canvas with pure CSS because WebGL in a position:fixed
// overlay fails silently on many mobile browsers (iOS Safari, Android WebView).

// Greetings the robot cycles through when idle
const GREETINGS = [
  "Hey! Ready to create something amazing? 🚀",
  "What shall we build today?",
  "I'm your AI creative partner — ask me anything! ✨",
  "Let's make your next video go viral 🎯",
  "Scripts, ideas, SEO — I've got you covered!",
  "Your channel growth starts here 📈",
];

function detectEmotion(text: string): 'excited' | 'error' | 'neutral' {
  const t = text.toLowerCase();
  if (/error|fail|sorry|unable|can't|cannot|problem|issue/.test(t)) return 'error';
  if (/great|amazing|awesome|perfect|done|created|success|ready|excellent|wonderful/.test(t)) return 'excited';
  return 'neutral';
}

// CSS plastic robot body with SVG camera-lens eyes (matching Capture.PNG style)
function RobotSvgBody({ state, excited }: { state: RobotState; excited: boolean }) {
  const [pupilOff, setPupilOff] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (state !== 'idle') { setPupilOff({ x: 0, y: 0 }); return undefined; }
    const POS: [number, number][] = [[0,0],[0,0],[0,0],[-2,0],[2,0],[0,-1.5],[1.5,1],[-1.5,0.8]];
    const interval = setInterval(() => {
      const p = POS[Math.floor(Math.random() * POS.length)]!;
      setPupilOff({ x: p[0], y: p[1] });
    }, 1800);
    return () => clearInterval(interval);
  }, [state]);

  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';

  // Plastic body colors matching Capture.PNG CSS robot
  const W = '#f4f4ff';
  const S = '#d0d0e2';
  const grad = `linear-gradient(155deg,${W} 40%,${S})`;

  const eyeCol = isThinking ? '#FBBF24' : isListening ? '#4ADE80' : '#60A5FA';
  const antCol = isListening ? '#4ADE80' : isThinking ? '#FBBF24' : '#00C8D8';
  const antGlow = `0 0 12px 5px ${antCol}66`;

  const armWaving = isSpeaking || excited;

  // Eye blink animation per state
  const blinkL: React.CSSProperties = {
    transformOrigin: '15px 11px', transformBox: 'fill-box',
    animation: isThinking ? 'cfEyeBlinkThink 2.4s ease-in-out infinite' : 'cfBlink 4.5s ease-in-out 0.3s infinite',
  };
  const blinkR: React.CSSProperties = {
    transformOrigin: '45px 11px', transformBox: 'fill-box',
    animation: isThinking ? 'cfEyeBlinkThink 2.4s ease-in-out 0.25s infinite' : 'cfBlink 4.5s ease-in-out 0.55s infinite',
  };

  return (
    <div style={{ position:'relative', display:'inline-block', userSelect:'none', pointerEvents:'none' }}>
      {/* State rings */}
      {isThinking && (
        <div style={{ position:'absolute', inset:-12, borderRadius:'50%', border:'2.5px solid transparent', borderTopColor:'#FBBF24', borderRightColor:'rgba(251,191,36,0.3)', animation:'cfSpinSimple 1.2s linear infinite', pointerEvents:'none' }} />
      )}
      {isListening && (<>
        <div style={{ position:'absolute', inset:-12, borderRadius:'50%', border:'1.5px solid rgba(74,222,128,0.45)', animation:'cfRipple 1.5s ease-out infinite', pointerEvents:'none' }} />
        <div style={{ position:'absolute', inset:-12, borderRadius:'50%', border:'1.5px solid rgba(74,222,128,0.22)', animation:'cfRipple 1.5s ease-out 0.75s infinite', pointerEvents:'none' }} />
      </>)}
      {isSpeaking && (
        <div style={{ position:'absolute', inset:-10, borderRadius:'50%', border:'1.5px solid rgba(0,200,255,0.3)', animation:'cfPulse 0.7s ease-in-out infinite', pointerEvents:'none' }} />
      )}

      {/* ── CSS plastic robot body ── */}
      <div>
        {/* Antenna pole */}
        <div style={{ margin:'0 auto', width:4, height:14, background:'linear-gradient(90deg,#9090a0,#c0c0d4)', borderRadius:2 }} />
        {/* Antenna tip */}
        <div style={{ margin:'-2px auto 0', width:12, height:12, borderRadius:'50%', background:antCol, boxShadow:antGlow, transition:'background 0.4s, box-shadow 0.4s', animation:'cfPulse 2s ease-in-out infinite' }} />

        {/* Head */}
        <div style={{ marginTop:5, width:76, height:58, borderRadius:14, background:grad, boxShadow:'3px 4px 14px rgba(0,0,0,0.28),-1px -1px 5px rgba(255,255,255,0.4)', position:'relative' }}>
          {/* Visor strip with SVG camera-lens eyes */}
          <div style={{ position:'absolute', top:'26%', left:'8%', right:'8%', height:'40%', background:'linear-gradient(180deg,#090920,#0d0d26)', borderRadius:9, boxShadow:'inset 0 2px 10px rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <svg width="60" height="22" viewBox="0 0 60 22" fill="none">
              <defs>
                <radialGradient id="cfEyeLG" cx="35%" cy="30%" r="65%" gradientUnits="objectBoundingBox">
                  <stop offset="0%" stopColor="#7EEEFF" />
                  <stop offset="40%" stopColor={eyeCol} />
                  <stop offset="100%" stopColor="#001824" />
                </radialGradient>
              </defs>
              {/* Left eye — camera lens with blink */}
              <g style={blinkL}>
                <circle cx="15" cy="11" r="9.5" fill="#0C1A38" />
                <circle cx="15" cy="11" r="8.5" fill="url(#cfEyeLG)" />
                <circle cx="15" cy="11" r="6.5" fill="none" stroke="rgba(120,210,255,0.25)" strokeWidth={1} />
                <circle cx="15" cy="11" r="3.5" fill="#040C20" style={{ transform:`translate(${pupilOff.x}px,${pupilOff.y}px)`, transition:'transform 0.45s cubic-bezier(.4,0,.2,1)', transformOrigin:'15px 11px', transformBox:'fill-box' }} />
                <circle cx="11.5" cy="7.5" r="3" fill="rgba(255,255,255,0.92)" />
                <circle cx="17.5" cy="13.5" r="1.5" fill="rgba(255,255,255,0.5)" />
                {isSpeaking && <circle cx="15" cy="11" r="8" fill="none" stroke="rgba(0,200,216,0.45)" strokeWidth={1} style={{ animation:'cfPulse 0.42s ease-in-out infinite' }} />}
              </g>
              {/* Right eye */}
              <g style={blinkR}>
                <circle cx="45" cy="11" r="9.5" fill="#0C1A38" />
                <circle cx="45" cy="11" r="8.5" fill="url(#cfEyeLG)" />
                <circle cx="45" cy="11" r="6.5" fill="none" stroke="rgba(120,210,255,0.25)" strokeWidth={1} />
                <circle cx="45" cy="11" r="3.5" fill="#040C20" style={{ transform:`translate(${pupilOff.x}px,${pupilOff.y}px)`, transition:'transform 0.45s cubic-bezier(.4,0,.2,1)', transformOrigin:'45px 11px', transformBox:'fill-box' }} />
                <circle cx="41.5" cy="7.5" r="3" fill="rgba(255,255,255,0.92)" />
                <circle cx="47.5" cy="13.5" r="1.5" fill="rgba(255,255,255,0.5)" />
                {isSpeaking && <circle cx="45" cy="11" r="8" fill="none" stroke="rgba(0,200,216,0.45)" strokeWidth={1} style={{ animation:'cfPulse 0.42s ease-in-out 0.21s infinite' }} />}
              </g>
            </svg>
          </div>
        </div>

        {/* Neck */}
        <div style={{ margin:'0 auto', width:20, height:8, background:`linear-gradient(160deg,${S},#b0b0c6)`, borderRadius:'0 0 4px 4px' }} />

        {/* Body + arms wrapper */}
        <div style={{ position:'relative' }}>
          {/* Left shoulder joint — gray ball at pivot point */}
          <div style={{ position:'absolute', top:5, left:-14, width:13, height:13, borderRadius:'50%', background:'linear-gradient(135deg,#9898b0,#787890)', boxShadow:'0 2px 5px rgba(0,0,0,0.28)', zIndex:2 }} />
          {/* Left arm */}
          <div style={{ position:'absolute', top:10, left:-17, width:15, height:60, borderRadius:8, background:grad, boxShadow:'2px 3px 10px rgba(0,0,0,0.22)', transformOrigin:'top center', transform:armWaving?undefined:'rotate(7deg)', animation:armWaving?'cfArmWave 0.7s ease-in-out infinite':'cfArmSway 4.5s ease-in-out 0.2s infinite', transition:'transform 0.5s', overflow:'visible' }}>
            {/* Left hand — free-swinging at wrist */}
            <div style={{ position:'absolute', bottom:-9, left:'50%', transform:'translateX(-50%)', width:19, height:13, borderRadius:7, background:grad, boxShadow:'1px 3px 7px rgba(0,0,0,0.2)', transformOrigin:'top center', animation:armWaving?'cfHandSwing 0.55s ease-in-out 0.12s infinite':'cfHandSwing 1.8s ease-in-out 0.6s infinite' }} />
          </div>
          {/* Right shoulder joint */}
          <div style={{ position:'absolute', top:5, right:-14, width:13, height:13, borderRadius:'50%', background:'linear-gradient(135deg,#9898b0,#787890)', boxShadow:'0 2px 5px rgba(0,0,0,0.28)', zIndex:2 }} />
          {/* Right arm */}
          <div style={{ position:'absolute', top:10, right:-17, width:15, height:60, borderRadius:8, background:grad, boxShadow:'2px 3px 10px rgba(0,0,0,0.22)', transformOrigin:'top center', transform:armWaving?undefined:'rotate(-7deg)', animation:armWaving?'cfArmWave 0.7s ease-in-out 0.35s infinite':'cfArmSwayR 4.5s ease-in-out 0.9s infinite', transition:'transform 0.5s', overflow:'visible' }}>
            {/* Right hand — free-swinging at wrist */}
            <div style={{ position:'absolute', bottom:-9, left:'50%', transform:'translateX(-50%)', width:19, height:13, borderRadius:7, background:grad, boxShadow:'1px 3px 7px rgba(0,0,0,0.2)', transformOrigin:'top center', animation:armWaving?'cfHandSwing 0.55s ease-in-out 0.53s infinite':'cfHandSwing 1.8s ease-in-out 0.3s infinite' }} />
          </div>

          {/* Body */}
          <div style={{ width:86, height:86, borderRadius:14, background:grad, boxShadow:'4px 5px 18px rgba(0,0,0,0.26),-2px -2px 6px rgba(255,255,255,0.33)', position:'relative', overflow:'hidden' }}>
            {/* Chest panel */}
            <div style={{ position:'absolute', top:'14%', left:'12%', right:'12%', bottom:'14%', background:'#080820', borderRadius:9, boxShadow:'inset 0 2px 10px rgba(0,0,0,0.95)', display:'flex', alignItems:'flex-end', justifyContent:'center', gap:3, paddingBottom:6 }}>
              {(isSpeaking || isListening) ? [0,1,2,3,4].map(i => (
                <div key={i} style={{ width:5, height:'52%', borderRadius:2, transformOrigin:'bottom', background:isSpeaking?'#00C8FF':'#4ADE80', boxShadow:`0 0 5px ${isSpeaking?'#00C8FFaa':'#4ADE80aa'}`, animation:`cfVoiceBar ${isSpeaking?'0.55':'0.38'}s ease-in-out ${i*0.11}s infinite` }} />
              )) : (
                <div style={{ width:10, height:10, borderRadius:'50%', marginBottom:2, background:eyeCol, boxShadow:`0 0 8px 3px ${eyeCol}55`, transition:'background 0.4s, box-shadow 0.4s', animation:'cfPulse 2s ease-in-out infinite' }} />
              )}
            </div>
          </div>
        </div>

        {/* Feet (no legs) */}
        <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:4 }}>
          {[0,1].map(i => (
            <div key={i} style={{ width:26, height:11, borderRadius:'3px 3px 8px 8px', background:`linear-gradient(160deg,#c4c4d8,#8e8ea2)`, boxShadow:'2px 2px 6px rgba(0,0,0,0.22)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RobotAvatar({ state, excited = false, compact = false }: { state: RobotState; excited?: boolean; compact?: boolean }) {
  const robotAnim: React.CSSProperties['animation'] = excited
    ? 'cfExcite 0.65s cubic-bezier(.36,0,.66,1.5) both'
    : state === 'speaking' ? 'cfHeadBob 0.38s ease-in-out infinite'
    : state === 'idle'     ? 'cfFloat 3s ease-in-out infinite'
    : 'none';

  const sparkleColors = ['#00CCFF','#A78BFA','#34D399','#FBBF24','#F472B6'];

  if (compact) {
    return (
      <div style={{ position:'relative', width:76, height:90, flexShrink:0, animation:robotAnim }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-52%) scale(0.72)', transformOrigin:'center center' }}>
          <RobotSvgBody state={state} excited={excited} />
        </div>
        {excited && [{dx:'-20px',dy:'-18px'},{dx:'20px',dy:'-18px'},{dx:'-24px',dy:'4px'},{dx:'24px',dy:'4px'}].map((s, i) => (
          <span key={i} style={{ position:'absolute', top:28, left:38, width:4, height:4, borderRadius:'50%',
            background:sparkleColors[i % sparkleColors.length], '--dx':s.dx, '--dy':s.dy,
            animation:`cfSparkle 0.6s ease-out ${i*0.08}s forwards`, pointerEvents:'none', zIndex:20,
          } as React.CSSProperties} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display:'inline-block', position:'relative', animation:robotAnim }}>
      <RobotSvgBody state={state} excited={excited} />
      {excited && [{dx:'-32px',dy:'-30px'},{dx:'32px',dy:'-30px'},{dx:'-42px',dy:'4px'},{dx:'42px',dy:'4px'},{dx:'-22px',dy:'34px'},{dx:'22px',dy:'34px'}].map((s, i) => (
        <span key={i} style={{ position:'absolute', top:50, left:48, width:5, height:5, borderRadius:'50%',
          background:sparkleColors[i % sparkleColors.length], '--dx':s.dx, '--dy':s.dy,
          animation:`cfSparkle 0.6s ease-out ${i*0.07}s forwards`, pointerEvents:'none', zIndex:20,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

// ── Speech Bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ text, state }: { text: string; state: RobotState }) {
  const color = state === 'listening' ? '#4ADE80' : state === 'thinking' ? '#FBBF24' : state === 'speaking' ? '#C4B5FD' : 'rgba(255,255,255,0.88)';
  const isLong = text.length > 38;
  return (
    <div style={{ textAlign:'center', marginBottom:6, width:224, overflow:'hidden' }}>
      <div style={{
        display:'inline-block', background:'rgba(8,4,20,0.52)', backdropFilter:'blur(16px)',
        WebkitBackdropFilter:'blur(16px)', borderRadius:99, padding:'6px 16px',
        fontSize:12, color, fontWeight:500, lineHeight:1.4,
        border:'1px solid rgba(255,255,255,0.10)', boxShadow:'0 4px 24px rgba(0,0,0,0.32)',
        animation:'cfSlideUp 0.28s ease-out both',
        maxWidth:224, overflow:'hidden', whiteSpace:'nowrap',
        fontStyle: state === 'thinking' ? 'italic' : 'normal',
      }}>
        {isLong ? (
          <span style={{ display:'inline-block', animation:'cfTicker 10s linear infinite', whiteSpace:'nowrap', paddingRight:32 }}>
            {text}&nbsp;&nbsp;&nbsp;{text}
          </span>
        ) : text}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CopilotPanel() {
  const router = useRouter();

  // panel
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [greetingIdx, setGreetingIdx] = useState(0);

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ttsAvailable, setTtsAvailable]   = useState<boolean|null>(null);

  // quick actions
  const [activeAction, setActiveAction] = useState<string|null>(null);
  const [actionInput, setActionInput]   = useState('');

  // jobs
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  // history (kept in state for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [history, setHistory] = useState<{ text:string; ts:number }[]>([]);

  // misc
  const [currentPlan, setCurrentPlan] = useState<TaskPlan|null>(null);

  // widget collapsed/expanded
  const [widgetOpen, setWidgetOpen] = useState(false);

  // bubble show/hide
  const [showBubble, setShowBubble]   = useState(false);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // refs
  const conversationRef  = useRef(false);
  const recognitionRef   = useRef<SpeechRecognitionLike|null>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
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
        if (open) setActivePanel(null); // close any open panel on widget close
        return !open;
      });
    };
    window.addEventListener('cf:open-copilot', handler as EventListener);
    return () => window.removeEventListener('cf:open-copilot', handler as EventListener);
  }, []);

  useEffect(() => {
    setVoiceEnabled(localStorage.getItem('cf_copilot_voice') === 'true');
    setTtsAvailable('speechSynthesis' in window);
    setHistory(loadHistory());
    apiClient.get('/copilot/stt-status')
      .then(r => setServerStt((r.data as { available: boolean }).available))
      .catch(() => setServerStt(false));
  }, []);

  // Cycle greeting when idle (robot visible, no panel open)
  useEffect(() => {
    if (!widgetOpen || activePanel !== null) return;
    const t = setInterval(() => setGreetingIdx(i => (i + 1) % GREETINGS.length), 4000);
    return () => clearInterval(t);
  }, [widgetOpen, activePanel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages, busy, pending, currentPlan]);

  // Show bubble for 8s after new assistant message
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      setShowBubble(true);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 8000);
    }
  }, [messages]);

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

  // iOS requires speechSynthesis.speak() to be called synchronously within a
  // user-gesture handler. This re-primes the session on every send so that
  // the TTS that fires after the async API response is still allowed by iOS.
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
          if (e.error !== 'canceled' && e.error !== 'interrupted') console.warn('[TTS] error:', e.error);
        };
        window.speechSynthesis.speak(utt);
      }
      keepAlive = setInterval(() => { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); }, 5_000);
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
    // Prime iOS speech session synchronously before any await — iOS blocks
    // speechSynthesis.speak() called from async context (after fetch resolves).
    if (voiceEnabled || conversationRef.current) primeSpeechSession();
    const isVoiceSend = conversationRef.current;

    const nextMessages: ChatMessage[] = text
      ? [...messages, { role: 'user' as const, content: text }]
      : messages;
    if (text) {
      setMessages(nextMessages);
      saveToHistory(text);
      setHistory(loadHistory());
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
      // Voice replies show in speech bubble; only auto-open chat panel for text interactions
      if (!isVoiceSend) setActivePanel(prev => prev ?? 'chat');
      if (data.needsConfirmation) { setPending(data.needsConfirmation); setPendingEst(data.estimatedCredits ?? null); }
      if (data.plan)     setCurrentPlan(data.plan);
      if (data.navigate) router.push(data.navigate);
      const wasVoiceInput = conversationRef.current;
      if (voiceEnabled || wasVoiceInput) {
        conversationRef.current = true;
        const newIdx = nextMessages.length;
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
        : is502 ? 'Backend API not reachable. For full functionality, access the app via your local network (http://[your-PC-IP]:3007) or configure API_URL in your deployment.'
        : status ? httpErrorMessage(status)
        : isTimeout ? 'The AI is taking longer than expected. Check your connection and try again.'
        : 'Cannot reach the server — make sure the API server is running at port 4007.';
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
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];
    setRecording(true);
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
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
    };
    recorder.start(250);
    window.speechSynthesis?.cancel();
  }, [lang, send]);

  const startBrowserSTT = useCallback(async () => {
    const rec = getBrowserRecognition();
    if (!rec) { setListening(false); setMicError('Voice not supported — use Chrome or Edge'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      setListening(false); conversationRef.current = false;
      const name = (err as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') setMicError('Mic blocked — allow microphone in your browser settings');
      else if (name === 'NotFoundError') setMicError('No microphone found');
      else setMicError('Could not access microphone');
      return;
    }
    recognitionRef.current = rec;
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    let finalText = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = 0; i < (e.results as unknown as { length: number }).length; i++) {
        const r = e.results[i]!;
        if ((r as { isFinal: boolean }).isFinal) finalText += r[0]!.transcript;
        else interim += r[0]!.transcript;
      }
      setLiveTranscript(finalText + interim);
      setInput(finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) { conversationRef.current = true; void send(finalText.trim()); }
      else { conversationRef.current = false; setInput(''); setLiveTranscript(''); }
    };
    rec.onerror = e => {
      setListening(false); conversationRef.current = false;
      if (e.error === 'not-allowed') setMicError('Mic blocked — allow microphone in your browser');
    };
    window.speechSynthesis?.cancel();
    try { rec.start(); }
    catch { setListening(false); conversationRef.current = false; setMicError('Could not start microphone'); }
  }, [send, lang]);

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
      if (mediaRecorderRef.current) stopServerSTT();
      else recognitionRef.current?.stop();
      setListening(false); setRecording(false);
      return;
    }
    setListening(true); setMicError(null); conversationRef.current = true;
    startListening();
  }, [listening, recording, startListening, stopServerSTT, primeAudio]);

  function toggleVoice() {
    primeAudio();
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem('cf_copilot_voice', String(next));
    if (next) {
      // Voice ON → immediately enter listening mode
      conversationRef.current = true;
      setListening(true);
      setMicError(null);
      // Small delay: iOS needs the silent utterance from primeAudio() to settle
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
  const statusColor     = micError ? '#F87171' : listening ? '#4ADE80' : speaking ? '#A78BFA' : busy ? '#FBBF24' : '#4ADE80';

  const robotState: RobotState = isVoiceActive ? 'listening' : busy ? 'thinking' : speaking ? 'speaking' : 'idle';

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const bubbleText =
    micError ? micError :
    isVoiceActive ? (liveTranscript || "I'm all ears, go ahead…") :
    busy ? "Let me think on that…" :
    speaking ? (lastAssistant?.content ?? "Speaking…") :
    lastAssistant ? (lastAssistant.content.length > 68 ? lastAssistant.content.slice(0, 68) + '…' : lastAssistant.content) :
    "Scripts, SEO, ideas — just say the word!";

  const shouldShowBubble = showBubble || robotState !== 'idle';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .cf-copilot-widget * { box-sizing: border-box; }
        .cf-copilot-widget textarea::placeholder { color: rgba(255,255,255,0.32); }
        .cf-copilot-widget textarea { caret-color: #A78BFA; }
        .cf-popup-input:focus-within {
          border-color: rgba(167,139,250,0.55) !important;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.14) !important;
        }
        .cf-foot-btn { transition: all 0.17s; }
        .cf-foot-btn:hover { background: rgba(255,255,255,0.14) !important; }
        .cf-topic-btn { transition: all 0.17s; }
        .cf-topic-btn:hover { background: rgba(167,139,250,0.18) !important; border-color: rgba(167,139,250,0.45) !important; transform: translateY(-1px); }
        .cf-act-card { transition: background 0.17s, border-color 0.17s, transform 0.15s; }
        .cf-act-card:hover:not(.cf-act-active) {
          background: rgba(255,255,255,0.1) !important;
          border-color: rgba(167,139,250,0.3) !important;
          transform: translateY(-2px);
        }
        .cf-msg-row:hover .cf-msg-assistant { background: rgba(255,255,255,0.13) !important; }
        @media (max-width: 768px) {
          .cf-copilot-widget { bottom: 82px !important; right: 10px !important; }
        }
        @keyframes cfVoiceBar   { 0%,100%{transform:scaleY(0.25);opacity:0.5} 50%{transform:scaleY(1);opacity:1} }
        @keyframes cfRipple     { 0%{transform:scale(1);opacity:0.65} 100%{transform:scale(1.9);opacity:0} }
        @keyframes cfPulse      { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes cfEyeBlinkIdle  { 0%,91%,95%,100%{transform:scaleY(0)} 93%{transform:scaleY(1)} }
        @keyframes cfEyeBlinkAlert { 0%,97%,100%{transform:scaleY(0)} 98.5%{transform:scaleY(0.18)} }
        @keyframes cfEyeBlinkThink { 0%,18%,68%,100%{transform:scaleY(0)} 38%,54%{transform:scaleY(0.68)} }
        @keyframes cfEyeBlinkSpeak { 0%,28%,72%,100%{transform:scaleY(0)} 50%{transform:scaleY(0.8)} }
        @keyframes cfSlideUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cfTicker     { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes cfFloat      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes cfSpin       { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
        @keyframes cfSpinSimple { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes cfPanelIn    { from{opacity:0;transform:translateY(14px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes cfBlink      { 0%,88%,92%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.04)} }
        @keyframes cfHeadBob    { 0%,100%{transform:translateY(0) rotate(0deg)} 20%{transform:translateY(-6px) rotate(-2.5deg)} 50%{transform:translateY(-2px) rotate(2deg)} 75%{transform:translateY(-5px) rotate(-1.5deg)} }
        @keyframes cfMouthTalk  { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
        @keyframes cfExcite     { 0%{transform:translateY(0) scale(1)} 20%{transform:translateY(-10px) scale(1.06)} 50%{transform:translateY(3px) scale(0.97)} 80%{transform:translateY(-5px) scale(1.03)} 100%{transform:translateY(0) scale(1)} }
        @keyframes cfArmWave    { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(-18deg)} 70%{transform:rotate(12deg)} }
        @keyframes cfHandDangle { 0%,100%{transform:translateX(-50%) rotate(-8deg)} 50%{transform:translateX(-50%) rotate(8deg)} }
        @keyframes cfArmSway    { 0%,100%{transform:rotate(7deg)} 50%{transform:rotate(3deg)} }
        @keyframes cfArmSwayR   { 0%,100%{transform:rotate(-7deg)} 50%{transform:rotate(-3deg)} }
        @keyframes cfHandSwing  { 0%,100%{transform:translateX(-50%) rotate(-16deg)} 50%{transform:translateX(-50%) rotate(16deg)} }
        @keyframes cfSparkle    { 0%{transform:translate(0,0) scale(0);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(1.2);opacity:0} }
        @keyframes cfScan       { 0%{r:4;opacity:0.85} 100%{r:14;opacity:0} }
        @keyframes cfScanRing   { 0%{transform:scale(0.4);opacity:0.85} 100%{transform:scale(1.4);opacity:0} }
        @media (max-width: 480px) {
          .cf-copilot-widget { bottom: 86px !important; right: 8px !important; }
        }
      `}</style>

      {/* ── Floating widget ── */}
      <div
        className="cf-copilot-widget"
        style={{ position:'fixed', bottom:24, right:24, zIndex:9999 }}
      >

        {/* ── OPEN WIDGET ── */}
        {widgetOpen && (
        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>

          {/* ── PANEL (absolute, overlays robot from above) ── */}
          {activePanel && (
          <div style={{
            position:'absolute',
            bottom: 96,
            right: 0,
            width: 340,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(460px, calc(100svh - 180px))',
            zIndex: 10,
            background:'rgba(10,7,28,0.96)',
            backdropFilter:'blur(60px) saturate(200%)',
            WebkitBackdropFilter:'blur(60px) saturate(200%)',
            borderRadius:18,
            border:'1px solid rgba(139,92,246,0.32)',
            boxShadow:'0 -8px 50px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.04)',
            overflow:'hidden',
            animation:'cfPanelIn 0.24s cubic-bezier(.22,1,.36,1) both',
            display:'flex', flexDirection:'column',
          }}>
            {/* Panel header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
              <span style={{ flex:'1 1 auto', fontSize:13, fontWeight:700, color:'#fff', letterSpacing:'-.1px' }}>
                {activePanel === 'chat' ? '💬 Chat' : activePanel === 'actions' ? '⚡ Quick Actions' : '✅ Recent Tasks'}
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:statusColor, transition:'background .3s' }} />
                <span style={{ fontSize:10.5, color:'rgba(255,255,255,.45)', fontWeight:500 }}>{statusLabel}</span>
              </div>
              {activePanel === 'chat' && messages.length > 0 && (
                <button type="button"
                  title="Clear chat history"
                  onClick={() => { setMessages([]); localStorage.removeItem(CHAT_KEY); }}
                  style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(248,113,113,.7)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                  <Trash2 style={{ width:12, height:12 }} />
                </button>
              )}
              <button type="button" onClick={() => setActivePanel(null)}
                style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.7)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                <X style={{ width:13, height:13 }} />
              </button>
            </div>

          {/* panel content */}
          <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', flex:'1 1 auto' }}>

              {/* ── CHAT ── */}
              {activePanel === 'chat' && (
                <>
                  <div style={{ maxHeight:280, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:9 }}>
                    {messages.length === 0 && !busy && (
                      <div style={{ padding:'6px 0 4px' }}>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:10, lineHeight:1.5 }}>
                          Scripts, SEO, ideas, research — ask me anything.
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {PROMPT_CHIPS.map(chip => (
                            <button key={chip} onClick={() => void send(chip)} style={{ padding:'5px 10px', borderRadius:99, fontSize:11, fontWeight:500, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.72)', cursor:'pointer' }}>
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((m, i) => (
                      <div key={i} className="cf-msg-row" style={{ display:'flex', gap:7, flexDirection:m.role==='user'?'row-reverse':'row', alignItems:'flex-end' }}>
                        <div style={{ width:22, height:22, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:m.role==='user'?'rgba(255,255,255,0.12)':'linear-gradient(135deg,#7C3AED,#4F1D96)', border:m.role==='user'?'1px solid rgba(255,255,255,0.2)':'none', color:'#fff', fontSize:9, fontWeight:700 }}>
                          {m.role==='user' ? 'U' : <Zap style={{ width:10, height:10 }} />}
                        </div>
                        <div className={m.role==='assistant'?'cf-msg-assistant':''} style={{ maxWidth:'82%', padding:'8px 11px', borderRadius:m.role==='user'?'12px 12px 3px 12px':'3px 12px 12px 12px', fontSize:12.5, lineHeight:1.55, whiteSpace:'pre-wrap', background:m.role==='user'?'linear-gradient(135deg,#7C3AED,#4F1D96)':'rgba(255,255,255,0.09)', color:'#fff', border:m.role==='assistant'?'1px solid rgba(255,255,255,0.09)':'1px solid rgba(167,139,250,0.22)', boxShadow:m.role==='user'?'0 4px 14px -4px rgba(124,58,237,.5)':'none', animation:'cfSlideUp 0.2s ease-out both', transition:'background 0.2s' }}>
                          {m.content}
                          {m.fromCache && <span style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginLeft:5 }}>cached</span>}
                        </div>
                      </div>
                    ))}

                    {busy && (
                      <div style={{ display:'flex', gap:7, alignItems:'flex-end' }}>
                        <div style={{ width:22, height:22, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#7C3AED,#5B21B6)' }}>
                          <Zap style={{ width:10, height:10, color:'#fff' }} />
                        </div>
                        <div style={{ padding:'8px 12px', borderRadius:'3px 12px 12px 12px', background:'linear-gradient(160deg,#7C3AED,#5B21B6)', border:'1px solid rgba(124,58,237,.2)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:2, height:14 }}>
                            {['5px','9px','13px','9px','5px'].map((h,i) => (
                              <span key={i} style={{ display:'inline-block', width:2.5, borderRadius:3, background:'rgba(233,213,255,.85)', height:h, animation:`cfVoiceBar .65s ease-in-out ${[0,.1,.2,.1,0][i]}s infinite` }} />
                            ))}
                          </div>
                          <div style={{ fontSize:9.5, fontWeight:600, color:'rgba(233,213,255,.5)', marginTop:2 }}>Thinking…</div>
                        </div>
                      </div>
                    )}

                    {currentPlan && (
                      <div style={{ background:'#1E1B2E', borderRadius:12, padding:'10px 12px', border:'1px solid rgba(124,58,237,.3)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <BrainCircuit style={{ width:12, height:12, color:'#A78BFA' }} />
                          <span style={{ fontSize:10, fontWeight:700, color:'#A78BFA', letterSpacing:'.5px' }}>TASK PLAN</span>
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
                          <button onClick={() => void send('', pending)} style={{ padding:'6px 12px', background:'linear-gradient(135deg,#7C3AED,#5B21B6)', color:'#fff', borderRadius:8, fontSize:11.5, fontWeight:600, border:'none', cursor:'pointer' }}>Confirm</button>
                          <button onClick={() => { setPending(null); setPendingEst(null); }} style={{ padding:'6px 12px', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.65)', borderRadius:8, fontSize:11.5, fontWeight:600, border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input bar */}
                  <div style={{ padding:'8px 10px 10px', background:'rgba(0,0,0,0.25)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    {isVoiceActive ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,#7C3AED,#5B21B6)', borderRadius:12, padding:'8px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                          {['8px','14px','18px','14px','8px'].map((h,i) => (
                            <span key={i} style={{ display:'inline-block', width:2.5, borderRadius:2, background:'rgba(255,255,255,.9)', height:h, animation:`cfVoiceBar .65s ease-in-out ${[0,.1,.2,.1,0][i]}s infinite` }} />
                          ))}
                        </div>
                        <span style={{ flex:'1 1 auto', fontSize:12.5, fontWeight:500, color:'rgba(255,255,255,.85)' }}>Listening…</span>
                        <button type="button" onClick={toggleMic} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:9, background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.3)', color:'#fff', fontSize:11.5, fontWeight:600, cursor:'pointer' }}>
                          <span style={{ width:7, height:7, borderRadius:1.5, background:'#fff' }} /> Stop
                        </button>
                      </div>
                    ) : isTranscribing ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(124,58,237,0.15)', border:'1px solid rgba(167,139,250,0.35)', borderRadius:12, padding:'10px 14px' }}>
                        <Loader2 style={{ width:15, height:15, color:'#A78BFA', animation:'cfSpinSimple 1s linear infinite', flexShrink:0 }} />
                        <span style={{ fontSize:12.5, fontWeight:500, color:'#C4B5FD' }}>Processing…</span>
                      </div>
                    ) : micError ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'9px 12px' }}>
                        <MicOff style={{ width:14, height:14, color:'#F87171', flexShrink:0 }} />
                        <span style={{ flex:'1 1 auto', fontSize:12, fontWeight:500, color:'#FCA5A5' }}>{micError}</span>
                        <button type="button" onClick={() => setMicError(null)} style={{ background:'none', border:'none', color:'#F87171', cursor:'pointer', padding:0 }}><X style={{ width:12, height:12 }} /></button>
                      </div>
                    ) : (
                      <div className="cf-popup-input" style={{ display:'flex', alignItems:'flex-end', gap:6, background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.10)', borderRadius:12, padding:'6px 6px 6px 12px', transition:'border-color .2s, box-shadow .2s' }}>
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
                        <button
                          type="button"
                          onClick={toggleMic}
                          style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:voiceEnabled?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.09)', border:`1px solid ${voiceEnabled?'rgba(74,222,128,0.4)':'rgba(255,255,255,0.14)'}`, color:voiceEnabled?'#4ADE80':'rgba(255,255,255,0.55)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                        >
                          <Mic style={{ width:13, height:13 }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (input.trim()) void send(input.trim()); }}
                          disabled={!input.trim() || busy}
                          style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:'linear-gradient(135deg,#7C3AED,#5B21B6)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', border:'none', cursor:'pointer', opacity:(!input.trim()||busy)?0.4:1, transition:'opacity .15s' }}
                        >
                          <Send style={{ width:13, height:13 }} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── ACTIONS ── */}
              {activePanel === 'actions' && (
                <div style={{ padding:'10px', maxHeight:380, overflowY:'auto' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:currentAction?10:0 }}>
                    {QUICK_ACTIONS.map(action => {
                      const Icon = action.icon;
                      const isAct = activeAction === action.id;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => { setActiveAction(isAct ? null : action.id); setActionInput(''); }}
                          className={`cf-act-card${isAct?' cf-act-active':''}`}
                          style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:7, padding:'11px', borderRadius:12, textAlign:'left', cursor:'pointer', background:isAct?`${action.color}18`:'rgba(255,255,255,0.06)', border:`1.5px solid ${isAct?action.color+'55':'rgba(255,255,255,0.09)'}` }}
                        >
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
                      <input
                        autoFocus
                        value={actionInput}
                        onChange={e => setActionInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && actionInput.trim()) {
                            void send(currentAction.template(actionInput.trim()));
                            setActiveAction(null); setActionInput('');
                          }
                        }}
                        placeholder={currentAction.placeholder}
                        style={{ width:'100%', padding:'8px 11px', borderRadius:9, border:`1px solid ${currentAction.color}44`, fontSize:13, outline:'none', background:'rgba(0,0,0,0.3)', color:'#fff', fontFamily:'inherit', boxSizing:'border-box' }}
                      />
                      <div style={{ display:'flex', gap:6, marginTop:8 }}>
                        <button
                          type="button"
                          onClick={() => { if (actionInput.trim()) { void send(currentAction.template(actionInput.trim())); setActiveAction(null); setActionInput(''); } }}
                          disabled={!actionInput.trim()}
                          style={{ flex:'1 1 auto', padding:'8px', borderRadius:9, fontSize:12.5, fontWeight:600, color:'#fff', background:`linear-gradient(135deg,${currentAction.color},${currentAction.color}cc)`, border:'none', cursor:'pointer', opacity:actionInput.trim()?1:0.4 }}
                        >
                          Ask Copilot →
                        </button>
                        <button type="button" onClick={() => { setActiveAction(null); setActionInput(''); }} style={{ width:34, borderRadius:9, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                          <X style={{ width:13, height:13 }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TASKS ── */}
              {activePanel === 'jobs' && (
                <div style={{ padding:'8px 10px 10px', maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                  {recentJobs.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                      <Zap style={{ width:24, height:24, color:'#C4B5FD', margin:'0 auto 8px' }} />
                      <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.45)' }}>No tasks yet</p>
                    </div>
                  ) : recentJobs.map(j => (
                    <div key={j.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10 }}>
                      <JobDot status={j.status} />
                      <div style={{ flex:'1 1 auto', minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.9)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.type.replace(/_/g,' ')}</div>
                        <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.45)', marginTop:1 }}>{j.project.title.slice(0,32)}</div>
                        {j.error && <div style={{ fontSize:10, color:'#F87171', marginTop:1 }}>{j.error.slice(0,45)}</div>}
                      </div>
                      <span style={{ fontSize:10.5, fontWeight:600, color:'rgba(255,255,255,0.45)', flexShrink:0, textTransform:'capitalize' }}>{j.status.toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>)} {/* end panel absolute */}

          {/* ── Robot — full size, behind panel ── */}
          <div style={{ position:'relative', zIndex:2, textAlign:'center' }}>
            {shouldShowBubble && !activePanel && (
              <SpeechBubble text={bubbleText} state={robotState} />
            )}
            <RobotAvatar state={robotState} excited={excited} />
          </div>

          {/* ── Speech bubble inside greeting area (idle, no panel) ── */}
          {!activePanel && !shouldShowBubble && messages.length === 0 && (
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:500, textAlign:'center', maxWidth:180, lineHeight:1.4, animation:'cfSlideUp 0.3s ease-out both' }}>
              {GREETINGS[greetingIdx]}
            </div>
          )}

          {/* ── Topic pills — bottom of robot ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, position:'relative', zIndex:5 }}>
            {([
              { id:'chat'    as PanelId, Icon:MessageSquare, label:'Chat' },
              { id:'actions' as PanelId, Icon:Zap,           label:'Actions' },
              { id:'jobs'    as PanelId, Icon:ListChecks,    label:'Tasks' },
            ] as const).map(({ id, Icon, label }) => {
              const isA = activePanel === id;
              return (
                <button key={id} type="button" className="cf-topic-btn"
                  onClick={() => setActivePanel(isA ? null : id)}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'8px 14px', borderRadius:999,
                    background: isA ? 'rgba(167,139,250,0.22)' : 'rgba(14,10,28,0.85)',
                    border: `1.5px solid ${isA ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
                    color: isA ? '#C4B5FD' : 'rgba(255,255,255,0.7)',
                    fontSize:12, fontWeight:600, cursor:'pointer',
                    boxShadow: isA ? '0 0 14px rgba(167,139,250,0.2)' : '0 4px 14px rgba(0,0,0,0.35)',
                    transition:'all 0.17s',
                  }}>
                  <Icon style={{ width:12, height:12 }} />{label}
                </button>
              );
            })}
          </div>

          {/* ── Mic on/off (voice auto-listen toggle) ── */}
          <button type="button" onClick={toggleVoice}
            title={isVoiceActive ? 'Listening… tap to turn off' : voiceEnabled ? 'Mic ON — tap to turn off' : 'Mic OFF — tap for hands-free voice'}
            style={{
              position:'relative', zIndex:5,
              width:38, height:38, borderRadius:'50%',
              background: isVoiceActive ? 'rgba(74,222,128,0.28)' : voiceEnabled ? 'rgba(74,222,128,0.15)' : 'rgba(14,10,28,0.85)',
              border: `1.5px solid ${isVoiceActive ? 'rgba(74,222,128,0.75)' : voiceEnabled ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.12)'}`,
              backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
              color: voiceEnabled || isVoiceActive ? '#4ADE80' : 'rgba(255,255,255,0.38)',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
              boxShadow: isVoiceActive ? '0 0 20px rgba(74,222,128,0.5)' : voiceEnabled ? '0 0 14px rgba(74,222,128,0.25)' : '0 4px 14px rgba(0,0,0,0.35)',
              animation: isVoiceActive ? 'cfPulse 1s ease-in-out infinite' : 'none',
              transition:'all 0.18s',
            }}>
            {voiceEnabled || isVoiceActive ? <Mic style={{ width:15, height:15 }} /> : <MicOff style={{ width:15, height:15 }} />}
          </button>

        </div>
        )} {/* end widgetOpen */}
      </div>
    </>
  );
}
