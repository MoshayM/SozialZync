'use client';
import { useState } from 'react';
import {
  Film, Scissors, FolderOpen, HelpCircle, Download, Plus, Wand2,
  CheckCircle2, Zap, Lightbulb, Printer, Upload, Link2, Youtube,
  Type, BarChart3,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'editor' | 'shorts' | 'projects';

interface Step {
  icon: React.ElementType;
  title: string;
  desc: string;
  tip?: string;
}

const EDITOR_STEPS: Step[] = [
  { icon: Upload,       title: 'Import your video',     desc: 'Go to Projects → open a project → click "Send to Video Editor" on any generated video. The clip appears in the Media Bin on the left.', tip: 'You can also send clips from Shorts Studio.' },
  { icon: Plus,         title: 'Add clips to timeline', desc: 'In the Media Bin, click the + button on any clip. It appears on the timeline. Add multiple clips to build your edit.' },
  { icon: Film,         title: 'Arrange & trim',        desc: 'Drag clips left/right on the timeline to reorder. Drag the left or right edge of a clip to trim it. Zoom in/out with the +/− buttons.' },
  { icon: Wand2,        title: 'Add effects & text',    desc: 'Click any clip on the timeline to open the Inspector panel (right side). Adjust volume, speed, opacity, colour effects, and transitions.' },
  { icon: Download,     title: 'Export your video',     desc: 'Click the Export button in the top bar. Choose a preset (1080p Landscape for YouTube, 1080p 9:16 for Shorts). Click "Start render" and download when ready.' },
];

const SHORTS_STEPS: Step[] = [
  { icon: Upload,       title: 'Import a long video',   desc: 'Click "Import Video" on the Shorts Studio page. Connect your YouTube channel or upload a file directly.' },
  { icon: Zap,          title: 'AI clip detection',     desc: 'The AI analyses your video and highlights the most engaging moments — hooks, highlights, and viral-worthy clips.' },
  { icon: CheckCircle2, title: 'Review & pick clips',   desc: 'Browse the detected clips. Preview each one, keep the best, and discard the rest. You can also manually select a time range.' },
  { icon: Type,         title: 'Edit captions & hooks', desc: 'Click a clip to add animated captions, a hook overlay, background music, and a CTA. The AI pre-fills these for you — just review and tweak.' },
  { icon: Download,     title: 'Export as Short',       desc: 'Export in 9:16 vertical format. Download the file or send it directly to the Scheduler to post at the best time.' },
];

const PROJECTS_STEPS: Step[] = [
  { icon: Link2,        title: 'Connect your channel',  desc: 'Go to Projects → Channel Access tab → click "Connect Google Account". This links your YouTube channel so the AI can optimise for your audience.' },
  { icon: Plus,         title: 'Create a project',      desc: 'Click "New Project". Give it a title and niche (e.g. "Tech Reviews"). The AI uses this context to generate relevant content.' },
  { icon: Wand2,        title: 'Generate with AI',      desc: 'Open the project and use the Copilot tab to create scripts, thumbnails, or full videos in one conversation. Or start specific jobs (Research, Script, Voice, Video).' },
  { icon: CheckCircle2, title: 'Review & approve',      desc: 'Every piece of AI-generated content goes through compliance checking. You review the results before anything is published — you stay in control.' },
  { icon: Youtube,      title: 'Publish to YouTube',    desc: 'Once approved, schedule the post or publish it directly. The AI picks the optimal time for your audience timezone and engagement patterns.' },
];

const PRO_TIPS = [
  { icon: Zap,       title: 'Use AI Copilot first',           desc: 'Open Copilot and say "Plan my content for this week" — it creates a full schedule across all your projects and platforms in one go.' },
  { icon: Scissors,  title: 'Shorts → Video Editor pipeline', desc: 'Send clips from Shorts Studio directly to the Video Editor for advanced colour grading, text overlays, and transitions before exporting.' },
  { icon: BarChart3, title: 'Check Analytics weekly',         desc: 'The Insights page shows which video formats, posting times, and topics drive the most views. Use this to guide your next project.' },
];

function StepCard({ step, idx }: { step: Step; idx: number }) {
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
        {idx < 4 && <div className="w-0.5 flex-1 mt-2 bg-gray-100 min-h-[24px]" />}
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
  const [tab, setTab] = useState<Tab>('editor');

  const tabs: { id: Tab; icon: React.ElementType; label: string; href: string; steps: Step[] }[] = [
    { id: 'editor',   icon: Film,       label: 'Video Editor',  href: '/editor',        steps: EDITOR_STEPS  },
    { id: 'shorts',   icon: Scissors,   label: 'Shorts Studio', href: '/shorts-studio', steps: SHORTS_STEPS  },
    { id: 'projects', icon: FolderOpen, label: 'Projects',      href: '/projects',      steps: PROJECTS_STEPS },
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
          <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm" style={{ border: '1.5px solid #e3ddf8' }}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  style={isActive ? { background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)' } : {}}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
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
                <StepCard key={step.title} step={step} idx={i} />
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
              <Link href="/shorts-studio" className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">
                <Scissors className="w-3.5 h-3.5" /> Shorts Studio
              </Link>
              <Link href="/editor" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #6D4AE0, #7c5ae8)' }}>
                <Film className="w-3.5 h-3.5" /> Video Editor
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
