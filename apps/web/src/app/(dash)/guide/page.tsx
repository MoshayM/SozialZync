'use client';
import { useState } from 'react';
import {
  Film, Scissors, FolderOpen, HelpCircle, Plus, Wand2,
  CheckCircle2, Zap, Lightbulb, Upload, Link2, Youtube,
  BarChart3, ArrowRight, Bot, Sparkles, Mic, FlaskConical,
  CalendarClock, Users, Image, Music, ShieldCheck, BookOpen, Award,
  Globe2, Target,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'projects' | 'studio' | 'copilot' | 'workflow' | 'publish';

interface Step {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  desc: string;
  tip?: string;
}

const PROJECTS_STEPS: Step[] = [
  {
    icon: Link2,
    title: 'Connect your channel',
    desc: 'Go to Settings → Channels → click "Connect Google Account". This links your YouTube (or other) channel so the AI can research your niche, analyse your audience, and optimise every piece of content for your specific subscribers.',
  },
  {
    icon: Plus,
    title: 'Create a project',
    desc: 'Click "New Project" on the Projects page. Set a title, niche, target language, and platform (YouTube, Instagram, TikTok, etc.). The AI uses this context for every generation step — so content always fits your audience and platform.',
  },
  {
    icon: Wand2,
    title: 'Generate with AI Copilot',
    desc: 'Tap the robot icon in the top bar to open the Copilot widget. Type or speak your request — "Write a script about AI trends" or "Plan this week\'s content". The Research Agent gathers sources; the Fact-Check Agent verifies every claim before you see it.',
  },
  {
    icon: CheckCircle2,
    title: 'Review & approve',
    desc: 'Every piece of content passes the Compliance Intelligence Engine automatically. You review the results — script, thumbnail, voice, metadata — before anything is published. You are always in control; nothing goes live without your approval.',
  },
  {
    icon: Youtube,
    title: 'Publish to your platform',
    desc: 'Once approved, schedule the post or publish directly. The AI picks the optimal time for your audience\'s timezone and engagement patterns. Pro plan: up to 50 external publishes/month. Unlimited plan: no caps.',
    tip: 'External publishing (YouTube, Instagram, TikTok) requires Pro or Unlimited plan.',
  },
];

const STUDIO_STEPS: Step[] = [
  {
    icon: Users,
    title: 'Create AI Characters',
    desc: 'Open Creative Studio → Characters tab. Describe your character — style, personality, look — and the AI generates a unique avatar for your brand. Characters are reused across thumbnails, storyboards, and video overlays automatically.',
    tip: 'Characters are tied to your account. Use them across all your projects.',
  },
  {
    icon: Image,
    title: 'Generate Images & Thumbnails',
    desc: 'Go to the Images tab. Choose a style, enter your prompt, and AI generates YouTube-optimised thumbnails or storyboard frames in seconds. Four variations are produced — pick the best or mix and match.',
  },
  {
    icon: Mic,
    title: 'Voice & Audio Studio',
    desc: 'In the Audio Studio tab, choose a voice profile that matches your brand. Paste your script and the TTS engine generates a professional narration track. Supports 30+ languages and multiple voice styles.',
  },
  {
    icon: Music,
    title: 'AI Music Generation',
    desc: 'Head to the Music tab to generate royalty-free background music. Choose mood, tempo, and duration. Every track includes provenance metadata for copyright compliance — you can safely monetize any video that uses it.',
  },
  {
    icon: Scissors,
    title: 'Shorts Studio',
    desc: 'Import a long video and AI finds the most engaging 60-second moments. Add animated captions, a hook overlay, and export as a 9:16 vertical Short — ready to upload to YouTube Shorts, Instagram Reels, or TikTok.',
  },
  {
    icon: Film,
    title: 'AI Thumbnails',
    desc: 'Paste your video title and the AI generates 4 thumbnail options using your brand colours and chosen character. Thumbnails are sized correctly for every platform and scored for click-through rate prediction.',
  },
];

const COPILOT_STEPS: Step[] = [
  {
    icon: Bot,
    title: 'Open the Copilot widget',
    desc: 'Tap the robot icon in the top bar — next to your notification bell and channel icons. The 3D robot panel slides open as a floating overlay. It stays available on every page so you never lose your work context.',
  },
  {
    icon: Mic,
    title: 'Tap the chest to start voice input',
    desc: 'Press the glowing chest panel on the robot. It turns green when the microphone is active and listening. Speak naturally — a live transcript streams below your message as you talk. Tap the chest again to stop and send.',
    tip: 'Voice input works in all major browsers on mobile and desktop. Chrome gives the best results.',
  },
  {
    icon: Wand2,
    title: 'Ask Copilot anything',
    desc: 'Type or say what you need: "Plan my content for this week", "Write a script about AI trends", "Generate 3 thumbnail options for my latest video". Copilot coordinates all AI agents — research, scripting, fact-check, images, voice — in one conversation.',
  },
  {
    icon: CheckCircle2,
    title: 'Review streamed output',
    desc: 'Copilot streams results back in real time inside the chat panel. Tap any generated item — a script, image, or voice track — to open it in the full editor. From there, approve it to send directly to your project.',
  },
  {
    icon: Zap,
    title: 'Enable Autopilot mode',
    desc: 'In Publish Hub → Autopilot, turn on AI auto-publish. Copilot can queue, compliance-check, and schedule content end-to-end for pre-approved content types — completely hands-free.',
    tip: 'Autopilot requires content to first pass the Compliance Intelligence Engine. You set the rules; AI executes them.',
  },
];

const WORKFLOW_STEPS: Step[] = [
  {
    icon: Target,
    title: 'Discover trending topics',
    desc: 'TrendAgent scans YouTube, Reddit, and social signals to surface rising topics in your niche before they peak. You get a ranked opportunity list with estimated search volume, competition level, and suggested angles — updated daily.',
  },
  {
    icon: Globe2,
    title: 'Research & fact-check',
    desc: 'ResearchAgent gathers sources, studies, and reference material for your chosen topic. FactCheckAgent then verifies every factual claim against those sources — so your script is backed by real evidence before you ever see it.',
  },
  {
    icon: Sparkles,
    title: 'AI script generation',
    desc: 'ScriptAgent writes a monetization-compliant, fact-checked script in your brand voice — with a hook, structured sections, on-screen text cues, CTAs, and platform SEO keywords built in. Typically delivered in under 60 seconds.',
  },
  {
    icon: Film,
    title: 'Create all media assets',
    desc: 'CharacterAgent, ImageAgent, VoiceAgent, and MusicAgent run in parallel to create thumbnails, voice narration, background music, and optional Shorts clips from your script. Your saved brand assets are applied automatically.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance engine check',
    desc: 'ComplianceAgent reviews the complete package — script, images, voice, and metadata — against YouTube monetization policies, copyright requirements, and fact-check results. Anything that fails is flagged and explained before it reaches you for review.',
  },
  {
    icon: Upload,
    title: 'Human review & publish',
    desc: 'You review the compliance-cleared package and approve in one tap. PublishAgent schedules it at the AI-recommended optimal posting time, or you can set a custom slot. With Autopilot enabled, this step runs automatically for pre-approved content types.',
  },
  {
    icon: BarChart3,
    title: 'Analyze & improve',
    desc: 'AnalyticsAgent monitors views, watch time, CTR, and subscriber growth after publishing. It surfaces what\'s working — best topics, formats, and posting times — and automatically seeds that insight into your next Copilot planning session.',
  },
];

const PUBLISH_STEPS: Step[] = [
  {
    icon: CheckCircle2,
    title: 'Review approved content',
    desc: 'In Publish Hub → Publish Center, all compliance-checked content awaiting your approval is listed. Preview the video, script, thumbnail, and voice track before you commit.',
  },
  {
    icon: CalendarClock,
    title: 'Schedule at the best time',
    desc: 'Click "Schedule" on any approved piece and the AI picks the optimal posting time for your audience\'s timezone and engagement patterns. You can override the suggestion or pick a custom slot.',
  },
  {
    icon: FlaskConical,
    title: 'Run A/B Tests',
    desc: 'Select a live video, enter two alternative titles or upload two thumbnail variants, and let the platform split-test them over 48 hours. The winning variant is promoted automatically — more clicks, better rankings.',
    tip: 'A/B Testing requires Pro or Unlimited plan.',
  },
  {
    icon: Sparkles,
    title: 'Enable Autopilot',
    desc: 'Toggle Autopilot on to let the AI handle the full publish pipeline — research, script, compliance check, voice, thumbnail, and scheduling — without requiring manual approval steps for pre-approved content types.',
  },
  {
    icon: BarChart3,
    title: 'Track performance',
    desc: 'After publishing, head to Insights Hub → Analytics to monitor views, watch time, CTR, and subscriber growth. The AI surfaces patterns and automatically suggests your next topic based on what\'s resonating.',
  },
  {
    icon: Award,
    title: 'Earn ad revenue',
    desc: 'On Pro or Unlimited plan, enable Ad Revenue for any published project from the project page. SozialZynk pays per 1,000 Browse page views — credited daily. Track your earnings in Home → Ad Revenue card.',
    tip: 'Ad revenue requires Pro or Unlimited plan. Upgrade at Settings → Plans.',
  },
];

const PRO_TIPS = [
  { icon: Zap,          title: 'Weekly planning in seconds',   desc: 'Say "Plan my content for this week" to the Copilot — it creates a full 7-day schedule with scripts, thumbnails, and voice narrations, ready to review and approve.' },
  { icon: FlaskConical, title: 'A/B test every new video',     desc: 'Even a 0.5% lift in CTR compounds significantly over time. Set up an A/B test immediately after publishing — the Publish Hub picks the winner automatically after 48 hours.' },
  { icon: BarChart3,    title: 'Check Insights weekly',        desc: 'The Analytics page shows which formats, posting times, and topics drive the most views. Feed these insights back into your next Copilot planning session.' },
  { icon: Target,       title: 'Use Workflow for full autopilot', desc: 'The full AI pipeline (Discover → Research → Script → Create → Comply → Publish → Analyze) can run end-to-end with Autopilot. Set it up once in Publish Hub.' },
];

const QUICK_ACTIONS = [
  { icon: Bot,        label: 'Open Copilot',   href: '/copilot',  primary: true,  copilot: true  },
  { icon: FolderOpen, label: 'Projects',        href: '/projects', primary: false, copilot: false },
  { icon: Sparkles,   label: 'Creative Studio', href: '/studio',   primary: false, copilot: false },
  { icon: Upload,     label: 'Publish Hub',     href: '/publish',  primary: false, copilot: false },
];

const STEP_COLORS = [
  'linear-gradient(135deg, #374151, #1f2937)',
  'linear-gradient(135deg, #374151, #111827)',
  'linear-gradient(135deg, #6b7280, #6D28D9)',
  'linear-gradient(135deg, #374151, #1f2937)',
  'linear-gradient(135deg, #374151, #111827)',
  'linear-gradient(135deg, #6b7280, #6D28D9)',
  'linear-gradient(135deg, #059669, #0891B2)',
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
    { id: 'projects',  icon: FolderOpen,    label: 'Projects',        href: '/projects', steps: PROJECTS_STEPS,  color: '#374151', desc: 'Set up your channel, create projects, and run the full AI content pipeline.' },
    { id: 'studio',    icon: Sparkles,      label: 'Creative Studio', href: '/studio',   steps: STUDIO_STEPS,    color: '#0891B2', desc: 'Characters, images, voice, music, Shorts — all in one creative hub.' },
    { id: 'copilot',   icon: Bot,           label: 'AI Copilot',      href: '/copilot',  steps: COPILOT_STEPS,   color: '#7c3aed', desc: 'The floating 3D robot widget — talk to it by voice or text from any page.' },
    { id: 'workflow',  icon: Target,        label: 'Workflow',        href: '/projects', steps: WORKFLOW_STEPS,  color: '#059669', desc: 'End-to-end AI pipeline: Discover → Research → Script → Create → Comply → Publish → Analyze.' },
    { id: 'publish',   icon: CalendarClock, label: 'Publish Hub',     href: '/publish',  steps: PUBLISH_STEPS,   color: '#059669', desc: 'Approve, schedule, A/B test, enable Autopilot, and track results.' },
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
        .step-card:nth-child(7) { animation-delay: 300ms; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media print {
          .no-print { display:none !important; }
          body { background:white; }
        }
      `}</style>

      <div className="min-h-full" style={{ background: '#f7f5ff' }}>

        {/* ── HERO BANNER ───────────────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg,#1a0845 0%,#4f2ec4 55%,#1f2937 100%)' }} className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
          <div aria-hidden className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse,rgba(156,163,175,.25) 0%,transparent 70%)', transform: 'translate(30%, -40%)' }} />

          <div className="relative max-w-3xl mx-auto px-5 lg:px-7 py-10 lg:py-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-white leading-tight tracking-tight">Getting Started Guide</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white/80 border border-white/20"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>v3.0</span>
                </div>
                <p className="text-sm text-white/60 mt-0.5">Step-by-step guides for every creator tool</p>
              </div>
            </div>

            {/* Tab bar — horizontally scrollable on mobile */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Guide sections">
              {tabs.map((t) => {
                const Icon = t.icon;
                const isActive = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(t.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-all border"
                    style={isActive
                      ? { background: 'rgba(255,255,255,0.95)', color: '#1f2937', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', border: '1.5px solid rgba(255,255,255,0.12)' }
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-sm text-white/55">{active.desc}</p>
          </div>
        </div>

        {/* ── CONTENT ───────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-5 lg:px-7 py-7 space-y-6">

          {/* Copilot hint banner */}
          {tab === 'copilot' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1.5px solid #c4b5fd' }}>
              <Bot className="w-5 h-5 shrink-0" style={{ color: '#7c3aed' }} />
              <p className="text-sm text-purple-800 font-medium">
                The AI Copilot is the <strong>robot icon in the top bar</strong> — next to your notifications and channel icons. It opens as a floating overlay on every page.
              </p>
            </div>
          )}

          {/* Workflow hint banner */}
          {tab === 'workflow' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1.5px solid #6ee7b7' }}>
              <Target className="w-5 h-5 shrink-0" style={{ color: '#059669' }} />
              <p className="text-sm text-emerald-800 font-medium">
                This is the full end-to-end AI pipeline. Each step is automated — you only intervene at the <strong>Review &amp; Publish</strong> step (unless Autopilot is on).
              </p>
            </div>
          )}

          {/* Steps card */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e8e4f8', boxShadow: '0 2px 24px rgba(55,65,81,.06)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f3f4f6' }}>
              <div className="flex items-center gap-2">
                {(() => { const Icon = active.icon; return <Icon className="w-4 h-4" style={{ color: '#374151' }} />; })()}
                <h2 className="text-sm font-bold text-gray-900">{active.label} — How it works</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: '#f0ebff', color: '#374151' }}>
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
                {active.id === 'copilot' || active.id === 'workflow' ? (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('cf:open-copilot'))}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f2ec4)', boxShadow: '0 4px 12px rgba(109,40,217,.35)' }}
                  >
                    Open Copilot
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Link
                    href={active.href}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #374151, #1f2937)', boxShadow: '0 4px 12px rgba(55,65,81,.3)' }}
                  >
                    Open {active.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>

            <div className="p-6 space-y-0">
              {active.steps.map((step, i) => {
                const Icon = step.icon;
                const isLast = i === active.steps.length - 1;
                return (
                  <div key={step.title} className="step-card flex gap-4">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white text-sm font-extrabold shadow-md"
                        style={{ background: STEP_COLORS[i % STEP_COLORS.length], boxShadow: '0 4px 12px rgba(55,65,81,.25)' }}>
                        {i + 1}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 my-2" style={{ background: 'linear-gradient(to bottom,#d1d5db,transparent)', minHeight: '24px' }} />
                      )}
                    </div>
                    <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: '#374151' }} />
                        <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                      {step.tip && (
                        <div className="mt-2 flex items-start gap-1.5 px-3 py-2 rounded-xl"
                          style={{ background: 'linear-gradient(135deg,#f3f4f6,#ede9f8)', border: '1px solid #d8d0f7' }}>
                          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#374151' }} />
                          <p className="text-xs leading-relaxed" style={{ color: '#1f2937' }}>{step.tip}</p>
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
              <Lightbulb className="w-4 h-4" style={{ color: '#374151' }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#374151' }}>Pro Tips</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PRO_TIPS.map((tip, i) => {
                const Icon = tip.icon;
                return (
                  <div key={tip.title} className="bg-white rounded-2xl p-4 space-y-2 transition-all hover:-translate-y-0.5"
                    style={{ border: '1.5px solid #e8e4f8', boxShadow: '0 2px 16px rgba(55,65,81,.04)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: STEP_COLORS[i % STEP_COLORS.length], boxShadow: '0 3px 10px rgba(55,65,81,.22)' }}>
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
          <div className="bg-white rounded-2xl px-5 py-4 flex flex-col gap-3"
            style={{ border: '1.5px solid #e8e4f8' }}>
            <p className="text-sm font-semibold text-gray-900">Ready to create?</p>
            <div className="flex gap-2 flex-wrap">
              {QUICK_ACTIONS.map(({ icon: Icon, label, href, primary, copilot }) => {
                const cls = 'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90';
                const style = primary
                  ? { background: 'linear-gradient(135deg, #7c3aed, #4f2ec4)', color: '#fff', boxShadow: '0 4px 12px rgba(109,40,217,.35)' }
                  : { border: '1px solid #e3ddf8', color: '#4B5563', background: '#faf9ff' };
                if (copilot) {
                  return (
                    <button
                      key={href}
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('cf:open-copilot'))}
                      className={cls}
                      style={style}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                }
                return (
                  <Link key={href} href={href} className={cls} style={{ border: '1px solid #e3ddf8', color: '#4B5563', background: '#faf9ff' }}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Plan reminder */}
          <div className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1.5px solid #c4b5fd' }}>
            <div>
              <p className="font-bold text-purple-900 text-sm mb-1">Free · Pro · Unlimited</p>
              <p className="text-xs text-purple-700 leading-relaxed">
                Free: 3 projects, 10 AI queries/day, SozialZynk feed only. Pro ($17/mo): 50 external publishes/month. Unlimited ($25/mo): no caps on anything.
              </p>
            </div>
            <Link href="/plans"
              className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 text-white"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f2ec4)' }}>
              View Plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Self-hosted AI guide */}
          <div className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'linear-gradient(135deg,#1a0845,#4f2ec4)', border: '1.5px solid rgba(55,65,81,.3)' }}>
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
              className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              View Guide <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
