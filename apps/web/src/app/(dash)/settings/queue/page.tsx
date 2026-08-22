'use client';
import { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, CheckCircle, XCircle, Pause, RefreshCw, Loader2, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  dbStats: { total: number; byStatus: Record<string, number> };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   '#374151',
  RUNNING:   '#2563eb',
  COMPLETED: '#16a34a',
  FAILED:    '#dc2626',
  CANCELLED: '#9ca3af',
  RETRYING:  '#d97706',
};

export default function QueuePage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get<QueueStats>('/jobs/queue-stats');
      setStats(r.data);
      setLastUpdated(new Date());
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const bullCards = [
    { label: 'Active',    value: stats?.active    ?? 0, icon: Activity,     color: '#2563eb', bg: '#eff6ff' },
    { label: 'Waiting',   value: stats?.waiting   ?? 0, icon: Clock,        color: '#d97706', bg: '#fffbeb' },
    { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle,  color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Failed',    value: stats?.failed    ?? 0, icon: XCircle,      color: '#dc2626', bg: '#fef2f2' },
    { label: 'Delayed',   value: stats?.delayed   ?? 0, icon: Pause,        color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return (
    <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Queue Manager</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            BullMQ job queue status · {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* BullMQ live queue */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Live Queue (BullMQ / Redis)</h2>
        {loading && !stats ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#374151]" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {bullCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: bg, border: `1px solid ${color}20` }}>
                <Icon className="w-5 h-5" style={{ color }} />
                <p className="text-2xl font-extrabold" style={{ color }}>{value.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DB job stats */}
      {stats && (
        <div>
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
            Database Jobs · <span className="text-gray-400 font-normal normal-case">{stats.dbStats.total.toLocaleString()} total</span>
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
            {Object.entries(stats.dbStats.byStatus).sort(([, a], [, b]) => b - a).map(([status, count], i) => {
              const pct = stats.dbStats.total > 0 ? Math.round((count / stats.dbStats.total) * 100) : 0;
              return (
                <div key={status} className={`flex items-center gap-4 px-5 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: STATUS_COLORS[status] ?? '#9ca3af' }}
                  />
                  <span className="text-sm font-semibold text-gray-900 flex-1">{status}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STATUS_COLORS[status] ?? '#9ca3af' }} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-12 text-right">{count.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl px-5 py-3 flex items-center gap-2" style={{ background: '#f3f4f6', border: '1px solid #d4c9f9' }}>
        <Zap className="w-4 h-4 text-[#374151] shrink-0" />
        <p className="text-xs text-gray-600">Queue auto-refreshes every 15 seconds. Active jobs process in the background via Redis/BullMQ workers.</p>
      </div>
    </div>
  );
}
