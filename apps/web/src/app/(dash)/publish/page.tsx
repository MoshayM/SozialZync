'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Sparkles, FlaskConical, Plus } from 'lucide-react';
import Link from 'next/link';
import ApprovalsPage from '../approvals/page';
import AutonomyPage from '../autonomy/page';
import AbTestingPage from '../ab-testing/page';

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: 'NEW' | 'BETA' | 'AI';
}

const TABS: TabDef[] = [
  {
    id: 'ai-planner',
    label: 'AI Planner',
    icon: Sparkles,
    description: 'Generate AI-powered content schedules — review proposals and approve ideas for your calendar',
    badge: 'AI',
  },
  {
    id: 'publish-center',
    label: 'Publish Center',
    icon: CalendarClock,
    description: 'Review, schedule and track your published content',
  },
  {
    id: 'ab-testing',
    label: 'A/B Test',
    icon: FlaskConical,
    description: 'Test titles and thumbnails',
    badge: 'BETA',
  },
];

function PublishContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'ai-planner';
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-0 sm:px-7">
        <h1 className="text-xl font-extrabold text-gray-900 leading-tight">Publish Hub</h1>
        <p className="text-sm text-gray-400 mt-0.5">Generate, schedule and publish your content</p>
      </div>

      {/* ── Connected Platforms bar ─────────────────────────────────────── */}
      <div className="mx-5 sm:mx-7 mt-4 bg-white rounded-2xl border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-gray-500 shrink-0">Connected Platforms:</span>

        {/* YouTube — connected */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z" />
          </svg>
          <span className="text-[12.5px] font-medium text-gray-700">YouTube</span>
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
            Connected
          </span>
        </div>

        {/* Instagram — connected */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <defs>
              <radialGradient id="ig-pub" cx="30%" cy="107%" r="150%">
                <stop offset="0%" stopColor="#fdf497" />
                <stop offset="5%" stopColor="#fdf497" />
                <stop offset="45%" stopColor="#fd5949" />
                <stop offset="60%" stopColor="#d6249f" />
                <stop offset="90%" stopColor="#285AEB" />
              </radialGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill="url(#ig-pub)" />
            <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.6" fill="none" />
            <circle cx="17.5" cy="6.5" r="1" fill="white" />
          </svg>
          <span className="text-[12.5px] font-medium text-gray-700">Instagram</span>
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
            Connected
          </span>
        </div>

        {/* TikTok — not connected */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#000000">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.77a4.85 4.85 0 0 1-1-.08z" />
          </svg>
          <span className="text-[12.5px] font-medium text-gray-500">TikTok</span>
          <span className="text-[11.5px] font-semibold text-gray-400">—</span>
        </div>

        <div className="flex-1" />

        <Link
          href="/channel-access"
          className="flex items-center gap-1 text-[13px] font-semibold text-gray-600 hover:text-gray-800 shrink-0 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Platform
        </Link>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-gray-200 mt-4 overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex px-4 sm:px-6 min-w-max">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => router.replace(`/publish?tab=${t.id}`)}
                className={[
                  'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium shrink-0 border-b-2 transition-all whitespace-nowrap touch-manipulation',
                  active
                    ? 'border-gray-800 text-gray-800 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
                ].join(' ')}
              >
                <t.icon className={`w-4 h-4 shrink-0 ${active ? 'text-gray-800' : 'text-gray-400'}`} />
                {t.label}
                {t.badge && (
                  <span
                    className="text-white font-bold leading-none"
                    style={{
                      fontSize: '9px',
                      padding: '2px 5px',
                      borderRadius: '99px',
                      background:
                        t.badge === 'AI'
                          ? 'linear-gradient(135deg,#374151,#1f2937)'
                          : 'linear-gradient(135deg,#F59E0B,#D97706)',
                    }}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Context description strip ────────────────────────────────────── */}
      <div className="px-5 sm:px-7 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-xs text-gray-500 leading-none">{activeTabDef?.description}</p>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'ai-planner'     && <AutonomyPage />}
      {activeTab === 'publish-center' && <ApprovalsPage />}
      {activeTab === 'ab-testing'     && <AbTestingPage />}
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={null}>
      <PublishContent />
    </Suspense>
  );
}
