'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart2, Gift, Activity, Lightbulb,
  Clock, Flame, FileText, Download, ChevronDown,
  TrendingUp, Calendar, Sparkles,
} from 'lucide-react';
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
  { id: 'analytics', label: 'Analytics', icon: BarChart2,  description: 'Channel performance and video metrics' },
  { id: 'strategy',  label: 'Strategy',  icon: Lightbulb,  description: 'AI-powered content recommendations and posting schedule' },
  { id: 'growth',    label: 'Growth',    icon: Gift,        description: 'Referrals, rewards and audience expansion' },
  { id: 'monitor',   label: 'Monitor',   icon: Activity,    description: 'Real-time AI job pipeline status' },
];

type Period = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'All time';
const PERIODS: Period[] = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'];

interface RecommendationCard {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  headline: string;
  body: string;
  badge: string;
  badgeColor: string;
}

interface PostingSlot {
  day: string;
  times: string[];
  score: number;
}

interface TrendingTopic {
  label: string;
  growth: string;
}

const RECOMMENDATION_CARDS: RecommendationCard[] = [
  {
    icon: Clock,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Best Post Time',
    headline: 'Tuesday & Thursday · 6 – 8 PM',
    body: 'Your audience is most active on Tues/Thurs evenings. Videos published in this window average 2.3× more views in the first 24 hours.',
    badge: '+2.3× views',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    icon: Flame,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    title: 'Trending Topic',
    headline: 'AI Tools for Creators',
    body: '"AI productivity for content creators" is up 340% in search volume this month. Your audience overlaps 74% with this niche.',
    badge: '+340% search',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  {
    icon: FileText,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    title: 'Top Format',
    headline: 'Short tutorials (8 – 12 min)',
    body: 'Tutorial-style videos on your channel retain viewers 47% longer than vlogs and drive 3× more comments on average.',
    badge: '47% longer retention',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
];

const POSTING_SCHEDULE: PostingSlot[] = [
  { day: 'Mon', times: ['7 PM'], score: 62 },
  { day: 'Tue', times: ['6 PM', '8 PM'], score: 95 },
  { day: 'Wed', times: ['12 PM'], score: 48 },
  { day: 'Thu', times: ['6 PM', '9 PM'], score: 91 },
  { day: 'Fri', times: ['5 PM'], score: 70 },
  { day: 'Sat', times: ['11 AM', '3 PM'], score: 77 },
  { day: 'Sun', times: ['2 PM'], score: 55 },
];

const TRENDING_TOPICS: TrendingTopic[] = [
  { label: 'AI Video Editing', growth: '+340%' },
  { label: 'Short-form Strategy', growth: '+218%' },
  { label: 'Monetization Tips', growth: '+195%' },
  { label: 'Creator Burnout', growth: '+167%' },
  { label: 'YouTube SEO 2026', growth: '+154%' },
  { label: 'Faceless Channels', growth: '+143%' },
  { label: 'Niche Automation', growth: '+129%' },
  { label: 'Thumbnail A/B Tests', growth: '+112%' },
];

function scoreColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 65) return 'bg-yellow-400';
  return 'bg-gray-300';
}

function StrategyPanel({ period }: { period: Period }) {
  return (
    <div className="px-5 sm:px-7 py-6 space-y-8">

      {/* ── AI Content Strategy ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-bold text-gray-900">AI Content Strategy</h2>
          <span className="ml-auto text-xs text-gray-400 font-medium">{period}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {RECOMMENDATION_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.title}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 leading-snug">{card.headline}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{card.body}</p>
                <span className={`self-start text-xs font-bold px-2.5 py-1 rounded-full ${card.badgeColor}`}>
                  {card.badge}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Optimal Posting Schedule ────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-bold text-gray-900">Optimal Posting Schedule</h2>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="grid grid-cols-7 gap-2">
            {POSTING_SCHEDULE.map((slot) => (
              <div key={slot.day} className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase">{slot.day}</span>
                <div className="w-full flex flex-col gap-1.5">
                  {slot.times.map((t) => (
                    <div
                      key={t}
                      className={`w-full rounded-lg px-1 py-1.5 text-center text-[10px] font-semibold text-white ${scoreColor(slot.score)}`}
                    >
                      {t}
                    </div>
                  ))}
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor(slot.score)}`}
                    style={{ width: `${slot.score}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{slot.score}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">
            Score 0 – 100 based on historical audience activity. Green = high opportunity.
          </p>
        </div>
      </section>

      {/* ── Trending Topics ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-bold text-gray-900">Trending Topics</h2>
          <span className="text-xs text-gray-400 ml-auto">in your niche · {period}</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex flex-wrap gap-2.5">
            {TRENDING_TOPICS.map((topic) => (
              <div
                key={topic.label}
                className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-3.5 py-2 cursor-pointer hover:bg-purple-100 transition-all"
              >
                <span className="text-sm font-semibold text-purple-800">{topic.label}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">
                  {topic.growth}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

function InsightsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') ?? 'analytics';
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const [period, setPeriod] = useState<Period>('Last 30 days');

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-0 sm:px-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 leading-tight">Insights Hub</h1>
          <p className="text-sm text-gray-600 mt-0.5">Analytics, growth and monitoring in one place</p>
        </div>

        {/* ── Period picker + Export CSV ─────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="appearance-none bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 pl-3 pr-8 py-2 cursor-pointer hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button className="flex items-center gap-1.5 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl px-4 py-2 hover:bg-gray-50 transition">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
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
                onClick={() => router.replace(`/insights?tab=${t.id}`)}
                className={[
                  'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium shrink-0 border-b-2 transition-all whitespace-nowrap touch-manipulation',
                  active
                    ? 'border-[#6D4AE0] text-[#6D4AE0] font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200',
                ].join(' ')}
              >
                <t.icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#6D4AE0]' : 'text-gray-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Context description strip ────────────────────────────────────── */}
      <div className="px-5 sm:px-7 py-2.5 bg-[#faf9ff] border-b border-[#f0edf9]">
        <p className="text-xs text-gray-600 leading-none">{activeTabDef?.description}</p>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'strategy'  && <StrategyPanel period={period} />}
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
