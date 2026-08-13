'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Sparkles, FlaskConical, Calendar, LayoutGrid } from 'lucide-react';
import ApprovalsPage from '../approvals/page';
import AutonomyPage from '../autonomy/page';
import AbTestingPage from '../ab-testing/page';
import CalendarPage from '../calendar/page';

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: 'NEW' | 'BETA' | 'AI';
}

const TABS: TabDef[] = [
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'AI-planned content calendar — generate schedules, review proposals and track your publishing plan',
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

type CalendarView = 'grid' | 'ai-planner';

const CALENDAR_VIEWS: { id: CalendarView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'grid',       label: 'Calendar Grid', icon: LayoutGrid },
  { id: 'ai-planner', label: 'AI Planner',    icon: Sparkles   },
];

function PublishContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'calendar';
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const [calendarView, setCalendarView] = useState<CalendarView>('grid');

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-0 sm:px-7">
        <h1 className="text-xl font-extrabold text-gray-900 leading-tight">Publish Hub</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage, schedule and optimise your content</p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-[#e3ddf8] mt-4 overflow-x-auto no-scrollbar"
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
                    ? 'border-[#6D4AE0] text-[#6D4AE0] font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
                ].join(' ')}
              >
                <t.icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#6D4AE0]' : 'text-gray-400'}`} />
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
                          ? 'linear-gradient(135deg,#6D4AE0,#7c5ae8)'
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
      <div className="px-5 sm:px-7 py-2.5 bg-[#faf9ff] border-b border-[#f0edf9]">
        <p className="text-xs text-gray-500 leading-none">{activeTabDef?.description}</p>
      </div>

      {/* ── Calendar sub-view toggle ─────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="px-5 sm:px-7 pt-4 pb-0 flex gap-2">
          {CALENDAR_VIEWS.map((v) => {
            const active = calendarView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setCalendarView(v.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={
                  active
                    ? { background: '#6D4AE0', color: '#fff', boxShadow: '0 2px 8px rgba(109,74,224,.35)' }
                    : { background: '#f0edf9', color: '#6D4AE0' }
                }
              >
                <v.icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && calendarView === 'grid'       && <CalendarPage />}
      {activeTab === 'calendar' && calendarView === 'ai-planner' && <AutonomyPage />}
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
