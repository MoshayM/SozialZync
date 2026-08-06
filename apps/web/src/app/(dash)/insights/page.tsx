'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart2, Gift, Activity } from 'lucide-react';
import AnalyticsPage from '../analytics/page';
import GrowthPage from '../growth/page';
import MonitorPage from '../monitor/page';

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart2, description: 'Channel performance and video metrics' },
  { id: 'growth',    label: 'Growth',    icon: Gift,     description: 'Referrals, rewards and audience expansion' },
  { id: 'monitor',   label: 'Monitor',   icon: Activity, description: 'Real-time AI job pipeline status' },
];

function InsightsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'analytics';
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-0 sm:px-7">
        <h1 className="text-xl font-extrabold text-gray-900 leading-tight">Insights Hub</h1>
        <p className="text-sm text-gray-600 mt-0.5">Analytics, growth and monitoring in one place</p>
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
              onClick={() => router.replace(`/insights?tab=${t.id}`)}
              className={[
                'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium shrink-0 border-b-2 transition-all whitespace-nowrap',
                active
                  ? 'border-[#6D4AE0] text-[#6D4AE0] font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200',
              ].join(' ')}
            >
              <t.icon className={`w-4 h-4 ${active ? 'text-[#6D4AE0]' : 'text-gray-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Context description strip ────────────────────────────────────── */}
      <div className="px-5 sm:px-7 py-2.5 bg-[#faf9ff] border-b border-[#f0edf9]">
        <p className="text-xs text-gray-600 leading-none">{activeTabDef?.description}</p>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'growth'    && <GrowthPage />}
      {activeTab === 'monitor'   && <MonitorPage />}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={null}>
      <InsightsContent />
    </Suspense>
  );
}
