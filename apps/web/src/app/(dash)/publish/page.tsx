'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Sparkles, FlaskConical } from 'lucide-react';
import ApprovalsPage from '../approvals/page';
import AutonomyPage from '../autonomy/page';
import AbTestingPage from '../ab-testing/page';

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: 'NEW' | 'BETA';
}

const TABS: TabDef[] = [
  {
    id: 'publish-center',
    label: 'Publish Center',
    icon: CalendarClock,
    description: 'Review, schedule and track your published content',
  },
  {
    id: 'autonomy',
    label: 'Autopilot',
    icon: Sparkles,
    description: 'AI-powered auto-publishing settings',
    badge: 'NEW',
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
  const activeTab = searchParams.get('tab') ?? 'publish-center';
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-0 sm:px-7">
        <h1 className="text-xl font-extrabold text-gray-900 leading-tight">Publish Hub</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage, schedule and optimise your content</p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-[#e3ddf8] mt-4 px-4 sm:px-6 flex overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => router.replace(`/publish?tab=${t.id}`)}
              className={[
                'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium shrink-0 border-b-2 transition-all whitespace-nowrap',
                active
                  ? 'border-[#6D4AE0] text-[#6D4AE0] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
              ].join(' ')}
            >
              <t.icon className={`w-4 h-4 ${active ? 'text-[#6D4AE0]' : 'text-gray-400'}`} />
              {t.label}
              {t.badge && (
                <span
                  className="text-white font-bold leading-none"
                  style={{
                    fontSize: '9px',
                    padding: '2px 5px',
                    borderRadius: '99px',
                    background:
                      t.badge === 'NEW'
                        ? 'linear-gradient(135deg,#10B981,#059669)'
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

      {/* ── Context description strip ────────────────────────────────────── */}
      <div className="px-5 sm:px-7 py-2.5 bg-[#faf9ff] border-b border-[#f0edf9]">
        <p className="text-xs text-gray-500 leading-none">{activeTabDef.description}</p>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'publish-center' && <ApprovalsPage />}
      {activeTab === 'autonomy'       && <AutonomyPage />}
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
