'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, CheckCircle, CalendarClock, Sparkles, FlaskConical } from 'lucide-react';
import { ProBanner } from '@/components/pro-gate';
import PublishingPage from '../publishing/page';
import ApprovalsPage from '../approvals/page';
import SchedulerPage from '../scheduler/page';
import AutonomyPage from '../autonomy/page';
import AbTestingPage from '../ab-testing/page';

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'NEW' | 'BETA';
}

const TABS: TabDef[] = [
  { id: 'publishing',  label: 'Publishing',  icon: Upload },
  { id: 'approvals',   label: 'Approvals',   icon: CheckCircle },
  { id: 'scheduler',   label: 'Scheduler',   icon: CalendarClock },
  { id: 'autonomy',    label: 'Autopilot',   icon: Sparkles,    badge: 'NEW' },
  { id: 'ab-testing',  label: 'A/B Testing', icon: FlaskConical, badge: 'BETA' },
];

function PublishContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'publishing';

  return (
    <div>
      <ProBanner
        feature="Direct publishing"
        description="Connect your YouTube, Instagram, TikTok and other accounts to publish directly. Upgrade to Pro to unlock channel connections and one-click publishing."
        className="mx-4 mt-4 sm:mx-6"
      />
      <div className="sticky top-0 z-10 bg-white border-b border-[#ede9f8] px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => router.replace(`/publish?tab=${t.id}`)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-2xl transition-all shrink-0"
            style={
              activeTab === t.id
                ? { background: '#f5f2fd', border: '2px solid #6D4AE0', color: '#6D4AE0' }
                : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', color: '#fff',
                background: t.badge === 'NEW' ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F59E0B,#D97706)',
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'publishing'  && <PublishingPage />}
      {activeTab === 'approvals'   && <ApprovalsPage />}
      {activeTab === 'scheduler'   && <SchedulerPage />}
      {activeTab === 'autonomy'    && <AutonomyPage />}
      {activeTab === 'ab-testing'  && <AbTestingPage />}
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
