'use client';
import { useState } from 'react';
import {
  Film, Scissors, FolderOpen, HelpCircle, Download, Plus, Wand2,
  CheckCircle2, Zap, Lightbulb, Printer, Upload, Link2, Youtube,
  Type, BarChart3, ArrowRight, Bot, Sparkles, Mic, FlaskConical,
  CalendarClock, Users, Image, Music,
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
  { icon: Link2,        title: 'Connect your YouTube channel',  desc: 'Go to Settings → Channels → click "Connect Google Account". This links your YouTube channel so the AI can research your niche and optimise for your audience.' },
  { icon: Plus,         title: 'Create a project',      desc: 'Click "New Project" from the Projects page. Give it a title, niche, and target language. The AI uses this context to generate relevant, audience-matched content.' },
  { icon: Wand2,        title: 'Generate with AI Copilot',      desc: 'Open any project and use the Copilot tab to create scripts, thumbnails, or full videos in one conversation. The Research Agent gathers sources; the Fact-Check Agent verifies every claim.' },
  { icon: CheckCircle2, title: 'Review & approve',      desc: 'Every piece of AI-generated content passes the Compliance Intelligence Engine first. You review the results before anything is published — you always stay in control.' },
  { icon: Youtube,      title: 'Publish to YouTube',    desc: 'Once approved, schedule the post or publish directly. The AI picks the optimal time for your audience timezone and engagement patterns.' },
];

const STUDIO_STEPS: Step[] = [
  { icon: Users,        title: 'Create AI Characters',  desc: 'Open Creative Studio → Characters tab. Describe your character — style, personality, look — and the AI generates a unique avatar or mascot for your brand.', tip: 'Characters can be used in thumbnails, storyboards, and video overlays.' },
  { icon: Image,        title: 'Generate Images & Thumbnails', desc: 'Go to the Images tab. Choose a style, enter your prompt, and AI generates YouTube-optimised thumbnails or storyboard frames in seconds. All assets are stored in your Image Library.' },
  { icon: Mic,          title: 'Voice & Audio Studio',  desc: 'In the Audio Studio tab, choose a voice profile and paste your script. The TTS engine generates a narration track. You can also record your own voice as a custom profile.' },
  { icon: Music,        title: 'AI Music Generation',   desc: 'Head to the Music tab to generate royalty-free background music for your videos — choose mood, tempo, and duration. Generated tracks include provenance metadata for compliance.' },
  { icon: Scissors,     title: 'Shorts Studio',         desc: 'Import a long video and AI finds the most engaging moments — hooks, highlights, and viral clips. Add animated captions, a hook overlay, and export as a 9:16 vertical Short.' },
  { icon: Download,     title: 'AI Thumbnails',         desc: 'In the AI Thumbnails tab, paste your video title and the AI generates 4 thumbnail options using your brand colours and chosen character. Pick the best and send it straight to your project.' },
];

const COPILOT_STEPS: Step[] = [
  { icon: Bot,          title: 'Open Copilot',          desc: 'Tap the Copilot icon in the sidebar or bottom nav. The robot avatar activates — its chest panel shows the current state: idle (dark), listening (green glow), thinking (amber pulse), or speaking (cyan).' },
  { icon: Mic,          title: 'Enable voice input',    desc: 'Tap the robot\'s chest panel to toggle the microphone on. The panel glows green when listening. Speak naturally — the live voice transcript strip appears below the Chat / Actions / Tasks pills.' },
  { icon: Wand2,        title: 'Ask Copilot anything',  desc: 'Type or say what you need: "Plan my content for this week", "Write a script about AI trends", "Generate 3 thumbnail options for my latest video". Copilot coordinates all the AI agents on your behalf.' },
  { icon: CheckCircle2, title: 'Review agent output',   desc: 'Copilot streams the results back in the chat. Tap any generated item — a script, image, or voice track — to open it in the full editor. From there, approve it to send it to your project.' },
  { icon: Zap,          title: 'Use Autopilot mode',    desc: 'In Publish Hub → Autopilot, enable AI auto-publish. Once enabled, Copilot can queue, compliance-check, and schedule content end-to-end — no manual approval step required for pre-approved content types.' },
];

const PUBLISH_STEPS: Step[] = [
  { icon: CheckCircle2, title: 'Review approved content', desc: 'In Publish Hub → Publish Center, all compliance-checked content awaiting your approval is listed. Preview the video, script, thumbnail, and voice track before clicking "Approve to Publish".' },
  { icon: CalendarClock,title: 'Schedule at the best time', desc: 'Click "Schedule" on any approved piece and the AI picks the optimal posting time for your audience. You can override the suggested time or set a custom slot.' },
  { icon: FlaskConical, title: 'Run A/B Tests',          desc: 'In the A/B Test tab, select a live video, enter two alternative titles or upload two thumbnail variants, and let the platform split-test them over 48 hours. The winning variant is automatically promoted.', tip: 'A/B Testing is available on Pro and Agency plans.' },
  { icon: Sparkles,     title: 'Enable Autopilot',       desc: 'Go to Publish Hub → Autopilot. Toggle Autopilot on to let the AI handle the full publish pipeline — research, script, compliance check, voice, thumbnail, and scheduling — without manual approval steps.' },
  { icon: BarChart3,    title: 'Track performance',      desc: 'After publishing, head to Insights Hub → Analytics to monitor views, watch time, CTR, and subscriber growth. The AI surfaces patterns and suggests your next content topic based on what\'s working.' },
];

const PRO_TIPS = [
  { icon: Zap,        title: 'Use Copilot for weekly planning', desc: 'Say "Plan my YouTube content for this week" — Copilot creates a full 7-day schedule, complete with scripts, thumbnails, and voice narrations for each video, in a single session.' },
  { icon: FlaskConical, title: 'A/B test every new video',     desc: 'Even a 0.5% lift in CTR compounds over a year. Set up an A/B test immediately after publishing — the Publish Hub will pick the winner automatically after 48 hours.' },
  { icon: BarChart3,  title: 'Check Insights weekly',          desc: 'The Insights page shows which formats, posting times, and topics drive the most views. Feed this back into your next Copilot planning session for compounding growth.' },
];

function StepCard({ step, idx, total }: { step: Step; idx: number; total: number }) {
  const Icon = step.icon;
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' }}
        >
          {idx + 1}
        </div>
        {idx < total - 1 && <div className="w-0.5 flex-1 mt-2 bg-gray-100 min-h-[24px]" />}
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-brand-500 shrink-0" />
          <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
        {step.tip && (
          <p className="mt-2 text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-1.5 inline-block">
            💡 {step.tip}
          </p>
        )}
      </div>
    </div>
  );
}

export default function GuidePage() {
  const [tab, setTab] = useState<Tab>('projects');

  const tabs: {
    id: Tab;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    href: string;
    steps: Step[];
  }[] = [
    { id: 'projects', icon: FolderOpen, label: 'Projects',        href: '/projects',  steps: PROJECTS_STEPS },
    { id: 'studio',   icon: Sparkles,   label: 'Creative Studio', href: '/studio',    steps: STUDIO_STEPS   },
    { id: 'copilot',  icon: Bot,        label: 'Copilot',         href: '/copilot',   steps: COPILOT_STEPS  },
    { id: 'publish',  icon: CalendarClock, label: 'Publish Hub',  href: '/publish',   steps: PUBLISH_STEPS  },
  ];

  const active = tabs.find((t) => t.id === tab)!;

  return (
    <>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="min-h-full bg-[#faf9ff]">
        <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' }}
              >
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Getting Started</h1>
                <p className="text-sm text-gray-400 mt-0.5">Step-by-step guides for every creator tool</p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="print:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-white"
              title="Save as PDF — use your browser's print dialog and choose 'Save as PDF'"
            >
              <Printer className="w-4 h-4" />
              Save as PDF
            </button>
          </div>

          {/* Tab bar */}
          <div className="w-full overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="inline-flex gap-1 bg-white rounded-2xl p-1 shadow-sm min-w-max" style={{ border: '1.5px solid #e3ddf8' }}>
              {tabs.map((t) => {
                const Icon = t.icon;
                const isActive = t.id === tab;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    style={isActive ? { background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' } : {}}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-gray-900">{active.label} — How it works</h2>
              <Link
                href={active.href}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold"
                style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' }}
              >
                Open {active.label}
              </Link>
            </div>
            <div>
              {active.steps.map((step, i) => (
                <StepCard key={step.title} step={step} idx={i} total={active.steps.length} />
              ))}
            </div>
          </div>

          {/* Pro Tips */}
          <div>
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Lightbulb className="w-3.5 h-3.5" />
              Pro Tips
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRO_TIPS.map((tip) => {
                const Icon = tip.icon;
                return (
                  <div key={tip.title} className="bg-white rounded-2xl p-4 space-y-2" style={{ border: '1.5px solid #e3ddf8' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0ebff' }}>
                      <Icon className="w-4 h-4" style={{ color: '#6D4AE0' }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{tip.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap" style={{ border: '1.5px solid #e3ddf8' }}>
            <p className="text-sm font-semibold text-gray-800">Ready to create?</p>
            <div className="flex gap-2 flex-wrap">
              <Link href="/projects" className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                <FolderOpen className="w-3.5 h-3.5" /> Projects
              </Link>
              <Link href="/studio" className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                <Sparkles className="w-3.5 h-3.5" /> Creative Studio
              </Link>
              <Link href="/copilot" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #6D4AE0, #7c5ae8)' }}>
                <Bot className="w-3.5 h-3.5" /> Open Copilot
              </Link>
            </div>
          </div>

          {/* Self-hosted AI guide link */}
          <div className="mt-6 rounded-2xl p-5 flex items-center justify-between gap-4" style={{ background: '#f5f2fd', border: '1.5px solid #d4c9f9' }}>
            <div>
              <p className="font-bold text-gray-900">Self-Hosted AI Guide</p>
              <p className="text-sm text-gray-500 mt-0.5">Run AI generation locally with Ollama, ComfyUI, and open-source models — no cloud APIs required.</p>
            </div>
            <Link href="/guide/self-hosted" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0" style={{ background: '#6D4AE0' }}>
              View Guide <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
