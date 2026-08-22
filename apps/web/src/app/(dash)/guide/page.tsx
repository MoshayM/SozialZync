'use client';
import { useState } from 'react';
import {
  Film, Scissors, FolderOpen, HelpCircle, Plus, Wand2,
  CheckCircle2, Zap, Lightbulb, Upload, Link2, Youtube,
  BarChart3, ArrowRight, Bot, Sparkles, Mic, FlaskConical,
  CalendarClock, Users, Image, Music, ShieldCheck, BookOpen,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'projects' | 'studio' | 'copilot' | 'publish';

interface Step {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  desc: string;
  tip?: string;
}

const PROJECTS_STEPS: Step[] = [
  { icon: Link2,        title: 'Connect your YouTube channel',  desc: 'Go to Settings → Channels → click "Connect Google Account". This links your channel so the AI can research your niche and optimise for your audience.' },
  { icon: Plus,         title: 'Create a project',              desc: 'Click "New Project" from the Projects page. Give it a title, niche, and target language. The AI uses this context to generate relevant, audience-matched content.' },
  { icon: Wand2,        title: 'Generate with AI Copilot',      desc: 'Open any project and use the Copilot tab to create scripts, thumbnails, or full videos in one conversation. The Research Agent gathers sources; the Fact-Check Agent verifies every claim.' },
  { icon: CheckCircle2, title: 'Review & approve',              desc: 'Every piece of content passes the Compliance Intelligence Engine first. You review results before anything is published — you always stay in control.' },
  { icon: Youtube,      title: 'Publish to YouTube',            desc: 'Once approved, schedule the post or publish directly. The AI picks the optimal time for your audience timezone and engagement patterns.' },
];

const STUDIO_STEPS: Step[] = [
  { icon: Users,    title: 'Create AI Characters',          desc: 'Open Creative Studio → Characters tab. Describe your character — style, personality, look — and the AI generates a unique avatar for your brand.', tip: 'Characters can be used in thumbnails, storyboards, and video overlays.' },
  { icon: Image,    title: 'Generate Images & Thumbnails',  desc: 'Go to the Images tab. Choose a style, enter your prompt, and AI generates YouTube-optimised thumbnails or storyboard frames in seconds.' },
  { icon: Mic,      title: 'Voice & Audio Studio',          desc: 'In the Audio Studio tab, choose a voice profile and paste your script. The TTS engine generates a narration track.' },
  { icon: Music,    title: 'AI Music Generation',           desc: 'Head to the Music tab to generate royalty-free background music — choose mood, tempo, and duration. Tracks include provenance metadata for compliance.' },
  { icon: Scissors, title: 'Shorts Studio',                 desc: 'Import a long video and AI finds the most engaging moments. Add animated captions, a hook overlay, and export as a 9:16 vertical Short.' },
  { icon: Film,     title: 'AI Thumbnails',                 desc: 'Paste your video title and the AI generates 4 thumbnail options using your brand colours and chosen character. Pick the best and send it straight to your project.' },
];

const COPILOT_STEPS: Step[] = [
  { icon: Bot,          title: 'Open Copilot',          desc: 'Tap the Copilot icon in the sidebar or bottom nav. The robot avatar activates — its chest panel shows the current state: idle, listening, thinking, or speaking.' },
  { icon: Mic,          title: 'Enable voice input',    desc: 'Tap the robot\'s chest panel to toggle the microphone on. The panel glows green when listening. Speak naturally — the live voice transcript appears below.' },
  { icon: Wand2,        title: 'Ask Copilot anything',  desc: 'Type or say what you need: "Plan my content for this week", "Write a script about AI trends", "Generate 3 thumbnail options". Copilot coordinates all the AI agents for you.' },
  { icon: CheckCircle2, title: 'Review agent output',   desc: 'Copilot streams the results back in the chat. Tap any generated item — a script, image, or voice track — to open it in the full editor. From there, approve it to send it to your project.' },
  { icon: Zap,          title: 'Use Autopilot mode',    desc: 'In Publish Hub → Autopilot, enable AI auto-publish. Copilot can queue, compliance-check, and schedule content end-to-end for pre-approved content types.' },
];

const PUBLISH_STEPS: Step[] = [
  { icon: CheckCircle2,  title: 'Review approved content',    desc: 'In Publish Hub → Publish Center, all compliance-checked content awaiting your approval is listed. Preview the video, script, thumbnail, and voice track.' },
  { icon: CalendarClock, title: 'Schedule at the best time',  desc: 'Click "Schedule" on any approved piece and the AI picks the optimal posting time for your audience. You can override the suggested time or set a custom slot.' },
  { icon: FlaskConical,  title: 'Run A/B Tests',              desc: 'Select a live video, enter two alternative titles or upload two thumbnail variants, and let the platform split-test them over 48 hours. The winning variant is automatically promoted.', tip: 'A/B Testing is available on Pro and Agency plans.' },
  { icon: Sparkles,      title: 'Enable Autopilot',           desc: 'Toggle Autopilot on to let the AI handle the full publish pipeline — research, script, compliance check, voice, thumbnail, and scheduling — without manual approval steps.' },
  { icon: BarChart3,     title: 'Track performance',          desc: 'After publishing, head to Insights Hub → Analytics to monitor views, watch time, CTR, and subscriber growth. The AI surfaces patterns and suggests your next topic.' },
];

const PRO_TIPS = [
  { icon: Zap,          title: 'Weekly planning in seconds',  desc: 'Say "Plan my YouTube content for this week" — Copilot creates a full 7-day schedule, complete with scripts, thumbnails, and voice narrations.' },
  { icon: FlaskConical, title: 'A/B test every new video',    desc: 'Even a 0.5% lift in CTR compounds over a year. Set up an A/B test immediately after publishing — the Publish Hub picks the winner after 48 hours.' },
  { icon: BarChart3,    title: 'Check Insights weekly',       desc: 'The Insights page shows which formats, posting times, and topics drive the most views. Feed this back into your next Copilot planning session.' },
];

const QUICK_ACTIONS = [
  { icon: Bot,       label: 'Open Copilot',     href: '/copilot',  primary: true  },
  { icon: FolderOpen,label: 'Projects',          href: '/projects', primary: false },
  { icon: Sparkles,  label: 'Creative Studio',   href: '/studio',   primary: false },
  { icon: Upload,    label: 'Publish Hub',        href: '/publish',  primary: false },
];

const STEP_COLORS = [
  'linear-gradient(135deg,#7C3AED,#5B21B6)',
  'linear-gradient(135deg,#6D28D9,#4C1D95)',
  'linear-gradient(135deg,#8B5CF6,#6D28D9)',
  'linear-gradient(135deg,#7C3AED,#5B21B6)',
  'linear-gradient(135deg,#6D28D9,#4C1D95)',
  'linear-gradient(135deg,#8B5CF6,#6D28D9)',
];

export default function GuidePage() {
  const [tab, setTab] = useState<Tab>('projects');

  const tabs: {
    id: Tab;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    href: string;
    steps: Step[];
    color: string;
    desc: string;
  }[] = [
    { id: 'projects', icon: FolderOpen,    label: 'Projects',        href: '/projects', steps: PROJECTS_STEPS, color: '#7C3AED', desc: 'Set up your channel, create projects, and run the full AI pipeline.' },
    { id: 'studio',   icon: Sparkles,      label: 'Creative Studio', href: '/studio',   steps: STUDIO_STEPS,   color: '#0891B2', desc: 'Characters, images, voice, music, Shorts — all in one creative hub.' },
    { id: 'copilot',  icon: Bot,           label: 'Copilot',         href: '/copilot',  steps: COPILOT_STEPS,  color: '#6D28D9', desc: 'Talk to the AI by voice or text — it coordinates your entire workflow.' },
    { id: 'publish',  icon: CalendarClock, label: 'Publish Hub',     href: '/publish',  steps: PUBLISH_STEPS,  color: '#059669', desc: 'Approve, schedule, A/B test, enable Autopilot, and track results.' },
  ];

  const active = tabs.find((t) => t.id === tab)!;

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .step-card { animation: fadeSlideIn 0.25s ease both; }
        .step-card:nth-child(1) { animation-delay: 0ms; }
        .step-card:nth-child(2) { animation-delay: 50ms; }
        .step-card:nth-child(3) { animation-delay: 100ms; }
        .step-card:nth-child(4) { animation-delay: 150ms; }
        .step-card:nth-child(5) { animation-delay: 200ms; }
        .step-card:nth-child(6) { animation-delay: 250ms; }
        @media print {
          .no-print { display:none !important; }
          body { background:white; }
        }
      `}</style>

      <div className="min-h-full" style={{ background: '#f7f5ff' }}>

        {/* ── HERO BANNER ───────────────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg,#1a0845 0%,#4f2ec4 55%,#5B21B6 100%)' }} className="relative overflow-hidden">
          {/* subtle grid overlay */}
          <div aria-hidden className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
          {/* glow orb */}
          <div aria-hidden className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse,rgba(167,139,250,.25) 0%,transparent 70%)', transform: 'translate(30%, -40%)' }} />

          <div className="relative max-w-3xl mx-auto px-5 lg:px-7 py-10 lg:py-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-white leading-tight tracking-tight">Getting Started Guide</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white/80 border border-white/20"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>v2.0</span>
                </div>
                <p className="text-sm text-white/60 mt-0.5">Step-by-step guides for every creator tool</p>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {tabs.map((t) => {
                const Icon = t.icon;
                const isActive = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-all border"
                    style={isActive
                      ? { background: 'rgba(255,255,255,0.95)', color: '#5B21B6', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', border: '1.5px solid rgba(255,255,255,0.12)' }
                    }
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Active tab description */}
            <p className="mt-3 text-sm text-white/55">{active.desc}</p>
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-5 lg:px-7 py-7 space-y-6">

          {/* Steps card */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e8e4f8', boxShadow: '0 2px 24px rgba(109,74,224,.06)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f0edf9' }}>
              <div className="flex items-center gap-2">
                {(() => { const Icon = active.icon; return <Icon className="w-4 h-4" style={{ color: '#7C3AED' }} />; })()}
                <h2 className="text-sm font-bold text-gray-900">{active.label} — How it works</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: '#f0ebff', color: '#6D4AE0' }}>
                  {active.steps.length} steps
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors"
                >
                  Save PDF
                </button>
                <Link
                  href={active.href}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', boxShadow: '0 4px 12px rgba(109,74,224,.3)' }}
                >
                  Open {active.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="p-6 space-y-0">
              {active.steps.map((step, i) => {
                const Icon = step.icon;
                const isLast = i === active.steps.length - 1;
                return (
                  <div key={step.title} className="step-card flex gap-4">
                    {/* Timeline */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white text-sm font-extrabold shadow-md"
                        style={{ background: STEP_COLORS[i % STEP_COLORS.length], boxShadow: '0 4px 12px rgba(109,74,224,.25)' }}>
                        {i + 1}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 my-2" style={{ background: 'linear-gradient(to bottom,#c4b5fd,transparent)', minHeight: '24px' }} />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: '#7C3AED' }} />
                        <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                      {step.tip && (
                        <div className="mt-2 flex items-start gap-1.5 px-3 py-2 rounded-xl"
                          style={{ background: 'linear-gradient(135deg,#f5f2fd,#ede9f8)', border: '1px solid #d8d0f7' }}>
                          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
                          <p className="text-xs leading-relaxed" style={{ color: '#5B21B6' }}>{step.tip}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pro Tips */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4" style={{ color: '#7C3AED' }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7C3AED' }}>Pro Tips</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRO_TIPS.map((tip, i) => {
                const Icon = tip.icon;
                return (
                  <div key={tip.title} className="bg-white rounded-2xl p-4 space-y-2 transition-all hover:-translate-y-0.5"
                    style={{ border: '1.5px solid #e8e4f8', boxShadow: '0 2px 16px rgba(109,74,224,.04)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: STEP_COLORS[i % STEP_COLORS.length], boxShadow: '0 3px 10px rgba(109,74,224,.22)' }}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">{tip.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions row */}
          <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
            style={{ border: '1.5px solid #e8e4f8' }}>
            <p className="text-sm font-semibold text-gray-900">Ready to create?</p>
            <div className="flex gap-2 flex-wrap">
              {QUICK_ACTIONS.map(({ icon: Icon, label, href, primary }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                  style={primary
                    ? { background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', boxShadow: '0 4px 12px rgba(109,74,224,.3)' }
                    : { border: '1px solid #e3ddf8', color: '#4B5563', background: '#faf9ff' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Self-hosted AI guide */}
          <div className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: 'linear-gradient(135deg,#1a0845,#4f2ec4)', border: '1.5px solid rgba(109,74,224,.3)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-white/80" />
                <p className="font-bold text-white text-sm">Self-Hosted AI Guide</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Run AI generation locally with Ollama, ComfyUI, and open-source models — no cloud APIs required.
              </p>
            </div>
            <Link href="/guide/self-hosted"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0 transition-all hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              View Guide <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
