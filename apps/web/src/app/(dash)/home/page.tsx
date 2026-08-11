'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen, Video, Zap, Youtube, ArrowRight, Plus, Sparkles, CalendarDays,
  CheckCircle2, Circle, ChevronRight, Bot, Mic2, MessageSquare, TrendingUp,
  Clock, Activity, PlayCircle, FileText, Music2, Image as ImageIcon, Film,
  LayoutDashboard, Flame, Scissors, Send, Loader2, X,
} from 'lucide-react';
import { api, type TrialStatusResponse, type ChannelAutomation } from '@/lib/api';
import { StatCard } from '@/components/stat-card';

interface Project {
  id: string;
  title: string;
  niche?: string;
  status: string;
  channel: { title: string };
  _count: { jobs: number; videos: number };
  updatedAt: string;
}

interface Channel {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  subscriberCount?: number;
  videoCount?: number;
}

const JOB_ICON: Record<string, React.ElementType> = {
  RESEARCH:       BookOpenIcon,
  SCRIPT:         FileText,
  VOICE_GENERATE: Mic2,
  MUSIC_GENERATE: Music2,
  IMAGE_GENERATE: ImageIcon,
  VIDEO_GENERATE: Film,
  RENDER:         PlayCircle,
  THUMBNAIL:      ImageIcon,
};

function BookOpenIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#10B981',
  RUNNING:   '#F59E0B',
  FAILED:    '#EF4444',
  PENDING:   '#8B8FA8',
  DRAFT:     '#8B8FA8',
};

const QUICK_PROMPTS = [
  { label: 'New YouTube video', icon: PlayCircle,  prompt: 'Create a new YouTube video' },
  { label: 'Create Shorts',     icon: Scissors,    prompt: 'Create YouTube Shorts from an existing video' },
  { label: 'Research a topic',  icon: TrendingUp,  prompt: 'Research a topic for my next video' },
  { label: 'Write a script',    icon: FileText,    prompt: 'Write a script for my next video' },
];

const QUICK_ACTIONS = [
  { href: '/projects',      icon: Plus,          label: 'New Project',      sub: 'Start from scratch',           tileBg: '#6D4AE0' },
  { href: '/copilot',       icon: Bot,           label: 'AI Copilot',       sub: 'Chat with your AI crew',       tileBg: '#7c5ae8' },
  { href: '/shorts-studio', icon: Scissors,      label: 'Shorts Studio',    sub: 'Clip & export YouTube Shorts', tileBg: '#e11d48' },
  { href: '/calendar',      icon: CalendarDays,  label: 'Content Calendar', sub: 'AI-planned video schedule',    tileBg: '#0891b2' },
];

function greet(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
      <Icon className="w-3.5 h-3.5" />
      {children}
    </h2>
  );
}

// ── Auth-style card wrapper ───────────────────────────────────────────────────
function Card({ children, className = '', href }: { children: React.ReactNode; className?: string; href?: string }) {
  const cls = `bg-white rounded-2xl p-5 ${className}`;
  const style = { border: '1.5px solid #e3ddf8' };
  if (href) {
    return (
      <Link href={href} className={`block ${cls} hover:border-[#6D4AE0]/40 hover:shadow-md transition-all`} style={style}>
        {children}
      </Link>
    );
  }
  return <div className={cls} style={style}>{children}</div>;
}

// ── Onboarding wizard ────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  {
    icon: Youtube,
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    title: 'Connect your YouTube channel',
    body: 'Link your channel so Sozialzync can publish, analyze, and schedule your content automatically.',
    cta: 'Connect a channel',
    href: '/settings/channels',
    skip: "I'll do this later",
  },
  {
    icon: FolderOpen,
    iconBg: '#ede9fe',
    iconColor: '#7C3AED',
    title: 'Create your first content project',
    body: 'A project is your content workspace — choose a niche, and AI generates research, scripts, voice, and thumbnails.',
    cta: 'Create a project',
    href: '/projects',
    skip: null,
  },
  {
    icon: Bot,
    iconBg: '#e0e7ff',
    iconColor: '#4338ca',
    title: 'Say hello to your AI Copilot',
    body: 'Your copilot plans your entire YouTube pipeline. Just tell it what you want to create — by voice or text.',
    cta: 'Open the Copilot',
    href: '/copilot',
    skip: null,
  },
] as const;

function OnboardingWizard({
  step,
  onAdvance,
  onSkip,
  onDismiss,
}: {
  step: number;
  onAdvance: (href: string) => void;
  onSkip: () => void;
  onDismiss: () => void;
}) {
  const current = WIZARD_STEPS[step - 1];
  if (!current) return null;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 p-8 relative">
        {/* Skip / close */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-5 right-5 flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Skip onboarding"
        >
          <X className="w-3.5 h-3.5" />
          Skip for now
        </button>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {WIZARD_STEPS.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i + 1 === step ? '24px' : '8px',
                height: '8px',
                background: i + 1 <= step ? '#6D4AE0' : '#e3ddf8',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: current.iconBg }}
        >
          <Icon className="w-8 h-8" style={{ color: current.iconColor }} />
        </div>

        {/* Brand header */}
        <div className="text-center mb-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6D4AE0' }}>
            Step {step} of {WIZARD_STEPS.length}
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 text-center mb-3 leading-tight">
          {current.title}
        </h2>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-8">
          {current.body}
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onAdvance(current.href)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] mb-3"
          style={{ background: 'linear-gradient(135deg,#a78bfa,#6D4AE0)', boxShadow: '0 8px 24px -6px rgba(109,74,224,.45)' }}
        >
          {current.cta}
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Skip step */}
        {current.skip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            {current.skip}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  // greeting uses local time — must be client-only to avoid SSR/client hydration mismatch
  const [greeting, setGreeting] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [trendNiche, setTrendNiche] = useState('');
  const [trendItems, setTrendItems] = useState<Array<{ topic: string; score: number }>>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const trendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localStorage.getItem('cf.onboarding.done') === '1') setOnboardingDone(true);
  }, []);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me().then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Channel[]),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.projects.list().then((r) => (r.data as { data: Project[] }).data),
  });

  const firstChannelId = channels[0]?.id;

  const { data: automation } = useQuery<ChannelAutomation>({
    queryKey: ['automation', firstChannelId],
    queryFn: () => api.automation.get(firstChannelId!).then((r) => r.data),
    enabled: !!firstChannelId,
    staleTime: 60_000,
  });

  const { data: trialStatus } = useQuery<TrialStatusResponse>({
    queryKey: ['trial-status'],
    queryFn: () => api.trial.status().then((r) => r.data),
    staleTime: 120_000,
  });

  const displayName = (me?.name ?? 'Creator').split(' ')[0] ?? 'Creator';

  useEffect(() => { setGreeting(greet(displayName)); }, [displayName]);

  useEffect(() => {
    setTrendNiche(localStorage.getItem('cf_channel_niche') ?? '');
  }, []);

  useEffect(() => {
    if (trendDebounceRef.current) clearTimeout(trendDebounceRef.current);
    if (!trendNiche.trim()) { setTrendItems([]); return; }
    localStorage.setItem('cf_channel_niche', trendNiche);
    trendDebounceRef.current = setTimeout(async () => {
      setTrendsLoading(true);
      try {
        const res = await fetch('/api/proxy/trends/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('cf_token') ?? ''}` },
          body: JSON.stringify({ niche: trendNiche }),
        });
        if (res.ok) {
          const data = await res.json() as { trending?: Array<{ topic: string; score: number }> };
          setTrendItems(data.trending?.slice(0, 5) ?? []);
        } else {
          setTrendItems([]);
        }
      } catch {
        setTrendItems([]);
      } finally {
        setTrendsLoading(false);
      }
    }, 800);
    return () => { if (trendDebounceRef.current) clearTimeout(trendDebounceRef.current); };
  }, [trendNiche]);

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const totalVideos = projects.reduce((s, p) => s + p._count.videos, 0);
  const totalJobs = projects.reduce((s, p) => s + p._count.jobs, 0);
  const totalSubscribers = channels.reduce((s, ch) => s + (ch.subscriberCount ?? 0), 0);

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const lastProject = recentProjects[0];

  const showTrial = trialStatus?.hasTrial && (trialStatus.trialCreditsRemaining ?? 0) > 0;
  const creditsPct = trialStatus?.creditsGranted
    ? Math.round(((trialStatus.trialCreditsRemaining ?? 0) / trialStatus.creditsGranted) * 100)
    : 0;
  const daysLeft = trialStatus?.expiresAt ? daysUntil(trialStatus.expiresAt) : null;

  const steps = [
    { label: 'Connect a YouTube channel',     done: channels.length > 0,       href: '/settings/channels' },
    { label: 'Create your first project',      done: projects.length > 0,       href: '/projects' },
    { label: 'Enable AI automation',           done: automation?.enabled === true, href: '/automation' },
    { label: 'Generate your first AI content', done: totalJobs > 0,             href: '/calendar' },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const allComplete = completedCount === steps.length;

  useEffect(() => {
    if (allComplete && !onboardingDone) {
      localStorage.setItem('cf.onboarding.done', '1');
      const t = setTimeout(() => setOnboardingDone(true), 3000);
      return () => clearTimeout(t);
    }
  }, [allComplete, onboardingDone]);

  function advanceWizard(href: string) {
    if (wizardStep < WIZARD_STEPS.length) {
      setWizardStep((s) => s + 1);
      router.push(href);
    } else {
      localStorage.setItem('cf.onboarding.done', '1');
      setOnboardingDone(true);
      router.push(href);
    }
  }

  function skipWizardStep() {
    if (wizardStep < WIZARD_STEPS.length) {
      setWizardStep((s) => s + 1);
    } else {
      dismissWizard();
    }
  }

  function dismissWizard() {
    localStorage.setItem('cf.onboarding.done', '1');
    setOnboardingDone(true);
  }

  function openCopilotWithPrompt(prompt: string) {
    window.dispatchEvent(new CustomEvent('cf:open-copilot'));
    setTimeout(() => {
      const inp = document.querySelector<HTMLInputElement>('input[placeholder="Type a message…"]');
      if (inp) { inp.value = prompt; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); }
    }, 400);
  }

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">

        {/* ── AI GREETING BANNER ─────────────────────────────────────────── */}
        <div
          className="rounded-3xl overflow-hidden relative"
          style={{ background: 'linear-gradient(145deg, #4f2ec4 0%, #6D4AE0 55%, #7c5ae8 100%)' }}
        >
          {/* Ambient orbs */}
          <div aria-hidden className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.07)', filter: 'blur(50px)' }} />
          <div aria-hidden className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'rgba(160,120,255,0.25)', filter: 'blur(40px)' }} />

          <div className="relative px-6 sm:px-8 py-7">
            {/* Top row */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
                >
                  <Bot className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <p className="text-white/55 text-sm font-medium leading-none mb-0.5">{greeting}</p>
                  <h1 className="text-white font-extrabold text-xl leading-tight">
                    What would you like to create today?
                  </h1>
                </div>
              </div>

              {/* Short Studio badge */}
              <Link
                href="/shorts-studio"
                className="hidden sm:flex items-center gap-2 shrink-0 px-3.5 py-2 rounded-2xl transition-all hover:scale-[1.03] active:scale-95"
                style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', textDecoration: 'none' }}
              >
                <span className="text-[10px] font-extrabold tracking-widest px-2 py-0.5 rounded-full" style={{ background: '#f0c14d', color: '#3b1f00' }}>NEW</span>
                <span className="text-white/80 text-xs font-semibold">✂️ Short Studio</span>
              </Link>
            </div>

            {/* Prompt input */}
            <div
              className="flex items-stretch rounded-2xl overflow-hidden mb-4 max-w-2xl"
              style={{ background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.18)' }}
            >
              <div className="flex items-center flex-1 gap-2.5 px-4 py-3 min-w-0">
                <MessageSquare className="w-4 h-4 text-purple-300 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Describe what you want to create…"
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-white/40"
                  style={{ fontFamily: 'inherit' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                      openCopilotWithPrompt((e.target as HTMLInputElement).value.trim());
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <kbd className="hidden sm:inline text-white/30 text-base shrink-0 select-none" title="Press Enter to send">⏎</kbd>
              </div>
              <button
                type="button"
                onClick={() => {
                  const val = inputRef.current?.value.trim();
                  if (val) { openCopilotWithPrompt(val); if (inputRef.current) inputRef.current.value = ''; }
                  else window.dispatchEvent(new CustomEvent('cf:open-copilot'));
                }}
                className="shrink-0 flex items-center gap-1.5 px-4 font-bold text-sm transition-opacity hover:opacity-90 border-l"
                style={{ background: 'rgba(255,255,255,0.13)', color: 'white', borderColor: 'rgba(255,255,255,0.15)' }}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
              <button
                type="button"
                title="Voice mode"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('cf:open-copilot'));
                  setTimeout(() => document.querySelector<HTMLButtonElement>('button[title="Start listening"]')?.click(), 500);
                }}
                className="shrink-0 w-12 flex items-center justify-center transition-all hover:opacity-80 border-l"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#c4b5fd', borderColor: 'rgba(255,255,255,0.10)' }}
              >
                <Mic2 className="w-4 h-4" />
              </button>
            </div>

            {/* Quick suggestion chips */}
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map(({ label, icon: Icon, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => openCopilotWithPrompt(prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/80 transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.13)' }}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── STATS ROW ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard tone="lilac"      icon={<Youtube className="w-5 h-5" />}    label="Subscribers"      value={totalSubscribers > 0 ? formatCount(totalSubscribers) : channels.length} sub={totalSubscribers > 0 ? `${channels.length} channel${channels.length !== 1 ? 's' : ''}` : 'channels connected'} />
          <StatCard tone="cream"      icon={<Zap className="w-5 h-5" />}        label="Active Projects"  value={activeProjects.length} sub={`of ${projects.length} total`} />
          <StatCard tone="periwinkle" icon={<Video className="w-5 h-5" />}      label="Videos"           value={totalVideos} />
          <StatCard tone="pink"       icon={<Activity className="w-5 h-5" />}   label="AI Jobs"          value={totalJobs} sub="across all projects" />
        </div>

        {/* ── MAIN GRID ──────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-5">

          {/* ── LEFT: Continue + Recent ──────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            <SectionLabel icon={Clock}>Continue</SectionLabel>

            {/* Last project card */}
            {lastProject ? (
              <Card href={`/projects/${lastProject.id}`} className="group !p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: lastProject.status === 'ACTIVE' ? '#ecfdf5' : '#f5f2fd',
                          color: lastProject.status === 'ACTIVE' ? '#065f46' : '#6D4AE0',
                        }}
                      >
                        {lastProject.status}
                      </span>
                      <span className="text-[11px] text-gray-400">{relativeTime(lastProject.updatedAt)}</span>
                    </div>
                    <h3 className="font-extrabold text-gray-900 text-base leading-tight truncate">{lastProject.title}</h3>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Youtube className="w-3.5 h-3.5 text-red-500" />
                      {lastProject.channel?.title ?? 'No channel'}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Video className="w-3 h-3" /> {lastProject._count.videos} videos</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {lastProject._count.jobs} AI jobs</span>
                    </div>
                  </div>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #f0edf9, #e3ddf8)' }}
                  >
                    <FolderOpen className="w-6 h-6" style={{ color: '#6D4AE0' }} />
                  </div>
                </div>
                <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: '1.5px solid #f0edf9' }}>
                  <span className="text-xs font-bold text-[#6D4AE0] flex items-center gap-1 group-hover:gap-2 transition-all">
                    Open project <ArrowRight className="w-3 h-3" />
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); openCopilotWithPrompt(`Continue working on ${lastProject.title}`); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors hover:bg-[#f5f2fd]"
                    style={{ color: '#6D4AE0' }}
                  >
                    <Bot className="w-3 h-3" /> Ask AI
                  </button>
                </div>
              </Card>
            ) : (
              <Card className="text-center !py-8">
                <LayoutDashboard className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-500 mb-4">No projects yet — let AI start your first one.</p>
                <button
                  type="button"
                  onClick={() => openCopilotWithPrompt('Create a new YouTube video project')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg, #6D4AE0, #7c5ae8)', boxShadow: '0 4px 16px rgba(109,74,224,0.30)' }}
                >
                  <Bot className="w-4 h-4" /> Ask AI to start
                </button>
              </Card>
            )}

            {/* Recent projects list */}
            {recentProjects.length > 1 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1.5px solid #f0edf9' }}>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Recent Projects</span>
                  <Link href="/projects" className="text-xs font-semibold hover:underline" style={{ color: '#6D4AE0' }}>View all</Link>
                </div>
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                  {recentProjects.slice(1).map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-[#faf9ff] transition-colors"
                      style={{ borderBottom: '1px solid #f5f2fd' }}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-gray-900 text-sm truncate">{p.title}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Youtube className="w-3 h-3 text-red-400" /> {p.channel?.title ?? 'No channel'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className="text-[11px] text-gray-400">{relativeTime(p.updatedAt)}</span>
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[p.status] ?? '#8B8FA8' }} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Onboarding + Actions + Channels ───────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Onboarding checklist */}
            {!onboardingDone && (
              allComplete ? (
                <div
                  className="rounded-2xl px-5 py-4 flex items-center gap-3"
                  style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}
                >
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  <div>
                    <p className="font-bold text-green-800 text-sm">You&apos;re all set!</p>
                    <p className="text-green-600 text-xs mt-0.5">All setup steps complete.</p>
                  </div>
                </div>
              ) : (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-extrabold text-gray-900 text-sm">Getting Started</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{completedCount} of {steps.length} complete</p>
                    </div>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(completedCount / steps.length) * 100}%`, background: 'linear-gradient(90deg, #6D4AE0, #7c5ae8)' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {steps.map((step, i) => (
                      <Link
                        key={step.label}
                        href={step.href}
                        className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${step.done ? 'opacity-50 pointer-events-none' : 'hover:bg-[#faf9ff]'}`}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                          style={step.done
                            ? { background: '#10b981', color: '#fff' }
                            : { background: '#f0edf9', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}
                        >
                          {step.done ? '✓' : i + 1}
                        </div>
                        <span className={`text-xs flex-1 font-medium ${step.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {step.label}
                        </span>
                        {!step.done && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                      </Link>
                    ))}
                  </div>
                </Card>
              )
            )}

            {/* Trial credits */}
            {showTrial && (
              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-gray-700">Trial Credits</span>
                  {daysLeft !== null && daysLeft <= 7 && (
                    <span className="ml-auto text-xs text-red-500 font-semibold">{daysLeft}d left</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${creditsPct}%`, background: creditsPct > 30 ? '#6D4AE0' : '#f59e0b' }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap tabular-nums">
                    {(trialStatus?.trialCreditsRemaining ?? 0).toLocaleString()} credits
                  </span>
                </div>
                <Link href="/wallet" className="text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: '#6D4AE0' }}>
                  Upgrade plan <ArrowRight className="w-3 h-3" />
                </Link>
              </Card>
            )}

            {/* Quick actions */}
            <Card>
              <SectionLabel icon={Sparkles}>Quick Actions</SectionLabel>
              <div className="space-y-2">
                {QUICK_ACTIONS.map(({ href, icon: Icon, label, sub, tileBg }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#faf9ff] transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: tileBg }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 leading-none mb-0.5">{label}</p>
                      <p className="text-[11px] text-gray-400">{sub}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#6D4AE0] transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>

            {/* Trending Topics */}
            <Card>
              <SectionLabel icon={TrendingUp}>Trending Topics</SectionLabel>
              <input
                type="text"
                placeholder="Enter your channel niche…"
                value={trendNiche}
                onChange={(e) => setTrendNiche(e.target.value)}
                className="w-full text-sm rounded-xl px-3 py-2 mb-3 outline-none"
                style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#1f1a3d' }}
              />
              {trendsLoading && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6D4AE0' }} />
                </div>
              )}
              {!trendsLoading && trendItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {trendItems.map(({ topic, score }) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => openCopilotWithPrompt(`Research trending topic: ${topic}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: '#f5f2fd', color: '#6D4AE0', border: '1.5px solid #e3ddf8' }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: score > 80 ? '#10b981' : score > 60 ? '#f59e0b' : '#8b8fa8' }}
                      />
                      {topic}
                    </button>
                  ))}
                </div>
              )}
              {!trendsLoading && trendItems.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-1">
                  {trendNiche.trim() ? 'No trends found for this niche.' : 'Enter your niche to see trending topics.'}
                </p>
              )}
            </Card>

            {/* Connected channels */}
            {channels.length > 0 && (
              <Card>
                <SectionLabel icon={Youtube}>Connected Channels</SectionLabel>
                <div className="space-y-3">
                  {channels.slice(0, 3).map((ch) => (
                    <div key={ch.id} className="flex items-center gap-3">
                      {ch.thumbnailUrl ? (
                        <img src={ch.thumbnailUrl} alt={ch.title} className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-white shadow-sm" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <Youtube className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-semibold truncate leading-none">{ch.title}</p>
                        {(ch.subscriberCount ?? 0) > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{formatCount(ch.subscriberCount!)} subscribers</p>
                        )}
                      </div>
                      {automation?.enabled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Auto</span>
                      )}
                    </div>
                  ))}
                  {channels.length > 3 && (
                    <Link href="/settings/channels" className="text-xs font-semibold hover:underline" style={{ color: '#6D4AE0' }}>
                      +{channels.length - 3} more channels
                    </Link>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {!onboardingDone && (
        <OnboardingWizard
          step={wizardStep}
          onAdvance={advanceWizard}
          onSkip={skipWizardStep}
          onDismiss={dismissWizard}
        />
      )}
    </div>
  );
}
