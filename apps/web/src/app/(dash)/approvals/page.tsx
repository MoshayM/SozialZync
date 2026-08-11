'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  History,
  LayoutList,
  Loader2,
  MessageSquare,
  Plus,
  Scissors,
  Search,
  Tag,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, apiClient, type TrackedVideo, type TrackedVideoStatus, type PublishTrackingSummary, type CalendarEntry } from '@/lib/api';
import { StatCard } from '@/components/stat-card';

// ── Approval types ────────────────────────────────────────────────────────────

interface Approval {
  id: string;
  status: string;
  expiresAt: string;
  reviewedAt?: string | null;
  scheduledAt?: string | null;
  notes?: string | null;
  project: { id: string; title: string; channel: { title: string } };
  job: { type: string; result: unknown };
}

const STATUS_CHIP: Record<string, React.CSSProperties> = {
  APPROVED: { background: '#ecfdf5', color: '#065f46' },
  REJECTED: { background: '#fef2f2', color: '#dc2626' },
  EXPIRED: { background: '#f3f4f6', color: '#4b5563' },
  PENDING: { background: '#f3f4f6', color: '#4b5563' },
};

interface ShortsExportResult {
  shortClipId?: string;
  clipType?: string;
  exportVersionId?: string | null;
  durationMs?: number | null;
  metadata?: { title?: string; description?: string; tags?: string[] };
}

function isShortsExport(type: string, result: unknown): result is ShortsExportResult {
  return type === 'SHORTS_EXPORT' && !!result && typeof result === 'object';
}

function useBlobUrl(versionId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!versionId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void apiClient.get(`/media/versions/${versionId}/file`, { responseType: 'blob' }).then((r) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(r.data as Blob);
      setUrl(objectUrl);
    }).catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [versionId]);
  return url;
}

/** Watchable review card for a Shorts export awaiting publish approval. */
function ShortsExportReview({ result }: { result: ShortsExportResult }) {
  const videoUrl = useBlobUrl(result.exportVersionId);
  const meta = result.metadata ?? {};
  return (
    <div className="flex gap-4 rounded-2xl p-4 mb-4" style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8' }}>
      <div className="w-32 shrink-0">
        {videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- AI-generated preview; caption track not produced
          <video src={videoUrl} controls className="w-full rounded-2xl aspect-[9/16] object-cover bg-black" />
        ) : (
          <div className="w-full rounded-2xl aspect-[9/16] bg-gray-100 flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#6D4AE0' }}>
          <Clapperboard className="w-3.5 h-3.5" />
          {(result.clipType ?? 'SHORT').replace(/_/g, ' ')}
          {result.durationMs ? ` · ${Math.round(result.durationMs / 1000)}s` : ''}
        </p>
        {meta.title && <p className="font-semibold text-gray-900 mt-1.5">{meta.title}</p>}
        {meta.description && (
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line line-clamp-4">{meta.description}</p>
        )}
        {(meta.tags?.length ?? 0) > 0 && (
          <p className="flex items-center gap-1 flex-wrap mt-2">
            <Tag className="w-3 h-3 text-gray-400" />
            {meta.tags!.slice(0, 8).map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: '#f5f2fd', color: '#6D4AE0' }}>{t}</span>
            ))}
          </p>
        )}
        {result.shortClipId && (
          <Link href={`/shorts-studio/clips/${result.shortClipId}/export`} className="inline-block text-xs hover:underline mt-2" style={{ color: '#6D4AE0' }}>
            Open full export page →
          </Link>
        )}
      </div>
    </div>
  );
}

/** Readable fallback for other job results: flat fields as labeled rows, raw JSON behind a toggle. */
function isDisplayable(v: unknown): boolean {
  return ['string', 'number', 'boolean'].includes(typeof v)
    || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
}

function GenericResultView({ result }: { result: unknown }) {
  if (!result || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  const flat: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (isDisplayable(v)) {
      flat.push([k, v]);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
        if (isDisplayable(cv)) flat.push([`${k} ${ck}`, cv]);
      }
    }
  }

  return (
    <div className="rounded-2xl p-4 mb-4 text-sm" style={{ background: '#faf9ff', border: '1.5px solid #e3ddf8' }}>
      {flat.length > 0 ? (
        <dl className="space-y-1.5">
          {flat.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-gray-500 shrink-0 w-32 capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
              <dd className="text-gray-700 min-w-0 break-words">
                {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-gray-500 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Structured result attached</p>
      )}
      <details className="mt-2">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-600">Raw details</summary>
        <pre className="whitespace-pre-wrap text-xs text-gray-500 mt-1 max-h-40 overflow-y-auto">{JSON.stringify(obj, null, 2)}</pre>
      </details>
    </div>
  );
}

function HistoryRow({ a, open, onToggle }: { a: Approval; open: boolean; onToggle: () => void }) {
  const shorts = isShortsExport(a.job.type, a.job.result) ? a.job.result : null;
  const title = shorts?.metadata?.title
    ?? (a.job.type === 'SHORTS_EXPORT' ? 'Short clip' : a.job.type.replace(/_/g, ' ').toLowerCase());
  const effectiveStatus = a.status === 'PENDING' ? 'EXPIRED' : a.status;
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0"
          style={STATUS_CHIP[effectiveStatus] ?? { background: '#f3f4f6', color: '#4b5563' }}
        >
          {effectiveStatus}
        </span>
        {a.scheduledAt && effectiveStatus === 'APPROVED' && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 flex items-center gap-1" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <CalendarClock className="w-3 h-3" />
            {new Date(a.scheduledAt).toLocaleString()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
          <p className="text-[11px] text-gray-400 truncate">
            {a.project.title} · {a.project.channel.title}
            {a.reviewedAt ? ` · reviewed ${new Date(a.reviewedAt).toLocaleString()}` : ''}
          </p>
        </div>
        {shorts?.shortClipId && (
          <Link
            href={`/shorts-studio/clips/${shorts.shortClipId}/export`}
            onClick={(e) => e.stopPropagation()}
            className="hover:opacity-70 shrink-0 transition-opacity"
            style={{ color: '#6D4AE0' }}
            title="Open clip export page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>
      {open && (
        <div className="px-4 pb-4 border-t pt-3" style={{ borderColor: '#e3ddf8' }}>
          {shorts ? <ShortsExportReview result={shorts} /> : <GenericResultView result={a.job.result} />}
          <div className="text-xs text-gray-400 space-y-0.5 -mt-2">
            {a.notes && <p><span className="text-gray-500">Review notes:</span> "{a.notes}"</p>}
            {a.scheduledAt && <p><span className="text-gray-500">Scheduled publish:</span> {new Date(a.scheduledAt).toLocaleString()}</p>}
            {a.reviewedAt && <p><span className="text-gray-500">Reviewed:</span> {new Date(a.reviewedAt).toLocaleString()}</p>}
            <p><span className="text-gray-500">Expires{effectiveStatus === 'EXPIRED' ? 'd' : ''}:</span> {new Date(a.expiresAt).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline schedule picker panel shown below the action buttons. */
function SchedulePanel({
  approvalId,
  onConfirm,
  onCancel,
  isPending,
}: {
  approvalId: string;
  onConfirm: (id: string, scheduledAt: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  // Default to tomorrow at 10:00 in local time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [value, setValue] = useState(localIso);

  // Minimum: 30 minutes from now (YouTube requirement)
  const minValue = new Date(Date.now() + 31 * 60 * 1000);
  const minIso = new Date(minValue.getTime() - minValue.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const handleConfirm = () => {
    if (!value) return;
    // Convert local datetime-local string to ISO string with timezone offset
    const picked = new Date(value);
    if (isNaN(picked.getTime())) return;
    onConfirm(approvalId, picked.toISOString());
  };

  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4" />
          Schedule publish time
        </p>
        <button onClick={onCancel} className="text-blue-400 hover:text-blue-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-blue-600 mb-3">
        YouTube will keep the video private until this time. Minimum 30 minutes from now.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="datetime-local"
          value={value}
          min={minIso}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm border border-blue-200 bg-white outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
        />
        <button
          onClick={handleConfirm}
          disabled={isPending || !value}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: '#1d4ed8' }}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
          Confirm schedule
        </button>
      </div>
    </div>
  );
}

// ── Scheduler types & constants ───────────────────────────────────────────────

interface Channel {
  id: string;
  title: string;
}

type ViewMode = 'month' | 'list';
type StatusTab = 'all' | TrackedVideoStatus;

const CHANNEL_LS_KEY = 'cf.scheduler.channelId';
const LIST_PAGE_SIZE = 30;
const WEEK_OPTS = { weekStartsOn: 1 as const };

const STATUS_CHIP_STYLE: Record<TrackedVideoStatus, React.CSSProperties> = {
  SCHEDULED: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  PUBLISHED: { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' },
  FAILED: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
};

const STATUS_BADGE_STYLE: Record<TrackedVideoStatus, React.CSSProperties> = {
  SCHEDULED: { background: '#fff7ed', color: '#c2410c' },
  PUBLISHED: { background: '#ecfdf5', color: '#065f46' },
  FAILED: { background: '#fef2f2', color: '#b91c1c' },
};

const STATUS_LABEL: Record<TrackedVideoStatus, string> = {
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
};

/** Effective tracking date: when it went live, else when it will. */
function effectiveDate(v: TrackedVideo): Date | null {
  const d = v.publishedAt ?? v.scheduledAt;
  return d ? new Date(d) : null;
}

function StatusBadge({ status }: { status: TrackedVideoStatus }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={STATUS_BADGE_STYLE[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(value); }, delay);
    return () => { clearTimeout(t); };
  }, [value, delay]);
  return debounced;
}

// ── Page tab type ─────────────────────────────────────────────────────────────

type PageTab = 'pending' | 'calendar' | 'history';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublishCenterPage() {
  const qc = useQueryClient();
  const router = useRouter();

  // Tab state
  const [pageTab, setPageTab] = useState<PageTab>('pending');

  // Approval state
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [scheduleOpenFor, setScheduleOpenFor] = useState<string | null>(null);
  const [scheduledSuccess, setScheduledSuccess] = useState<string | null>(null);

  // Calendar state
  const [view, setView] = useState<ViewMode>('month');
  const [selected, setSelected] = useState<TrackedVideo | null>(null);
  const [channelId, setChannelId] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(CHANNEL_LS_KEY) ?? '';
    return '';
  });

  function handleChannelChange(id: string) {
    setChannelId(id);
    localStorage.setItem(CHANNEL_LS_KEY, id);
  }

  // Queries
  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['approvals'],
    queryFn: () => api.approvals.listPending().then((r) => (r.data as { data: Approval[] }).data),
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery<Approval[]>({
    queryKey: ['approvals-history'],
    queryFn: () => api.approvals.listHistory().then((r) => (r.data as { data: Approval[] }).data),
    refetchInterval: 60_000,
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => api.channels.list().then((r) => r.data as Channel[]),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<PublishTrackingSummary>({
    queryKey: ['scheduler-summary', channelId],
    queryFn: () => api.publishing.summary(channelId || undefined).then((r) => r.data),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string }) =>
      api.approvals.approve(id, notes[id], scheduledAt),
    onSuccess: (_, { id, scheduledAt }) => {
      qc.setQueryData<Approval[]>(['approvals'], (old) => (old ?? []).filter((a) => a.id !== id));
      void qc.invalidateQueries({ queryKey: ['approvals-history'] });
      void qc.invalidateQueries({ queryKey: ['scheduler-summary', channelId] });
      setScheduleOpenFor(null);
      if (scheduledAt) {
        const dateStr = new Date(scheduledAt).toLocaleString();
        setScheduledSuccess(`Scheduled! Your video will publish automatically on ${dateStr}. No further action needed.`);
        setTimeout(() => setScheduledSuccess(null), 8000);
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.approvals.reject(id, notes[id]),
    onSuccess: (_, { id }) => {
      qc.setQueryData<Approval[]>(['approvals'], (old) => (old ?? []).filter((a) => a.id !== id));
      void qc.invalidateQueries({ queryKey: ['approvals-history'] });
      void qc.invalidateQueries({ queryKey: ['shorts-clips'] });
    },
  });

  const moveToEditingMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.approvals.moveToEditing(id, notes[id]).then((r) => r.data as { shortClipId: string }),
    onSuccess: (data, { id }) => {
      qc.setQueryData<Approval[]>(['approvals'], (old) => (old ?? []).filter((a) => a.id !== id));
      void qc.invalidateQueries({ queryKey: ['approvals-history'] });
      void qc.invalidateQueries({ queryKey: ['shorts-clips'] });
      router.push(`/shorts-studio/clips/${data.shortClipId}/edit`);
    },
  });

  // Tab button style helper
  const tabStyle = (active: boolean): React.CSSProperties =>
    active
      ? { background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', color: '#fff', border: '1.5px solid transparent', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }
      : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' };

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Publish Center</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review, schedule and track your content</p>
        </div>

        {/* Auto-publish scheduled confirmation banner — always visible regardless of tab */}
        {scheduledSuccess && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-green-800" style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0' }}>
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            {scheduledSuccess}
          </div>
        )}

        {/* Summary stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            tone="lilac"
            icon={<Clock className="w-5 h-5" />}
            label="Pending approvals"
            value={isLoading ? <div className="h-8 w-12 bg-gray-100 rounded-xl animate-pulse mt-0.5" /> : approvals.length}
          />
          <StatCard
            tone="periwinkle"
            icon={<CalendarClock className="w-5 h-5" />}
            label="Scheduled"
            value={summaryLoading ? <div className="h-8 w-12 bg-gray-100 rounded-xl animate-pulse mt-0.5" /> : (summary?.scheduled ?? 0)}
            sub={summary ? `${summary.upcoming7d} in next 7 days` : undefined}
            subClassName="text-gray-600"
          />
          <StatCard
            tone="pink"
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Published"
            value={summaryLoading ? <div className="h-8 w-12 bg-gray-100 rounded-xl animate-pulse mt-0.5" /> : (summary?.published ?? 0)}
            sub={summary ? `${summary.publishedThisMonth} this month` : undefined}
            subClassName="text-gray-600"
          />
          <StatCard
            tone="cream"
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Failed"
            value={summaryLoading ? <div className="h-8 w-12 bg-gray-100 rounded-xl animate-pulse mt-0.5" /> : (summary?.failed ?? 0)}
            subClassName="text-red-700"
          />
        </div>

        {/* Tab strip */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setPageTab('pending')}
            className="px-4 py-2.5 flex items-center gap-2 text-sm font-semibold rounded-2xl transition-all"
            style={tabStyle(pageTab === 'pending')}
          >
            Pending
            {approvals.length > 0 && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
                style={
                  pageTab === 'pending'
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: '#6D4AE0', color: '#fff' }
                }
              >
                {approvals.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPageTab('calendar')}
            className="px-4 py-2.5 flex items-center gap-2 text-sm font-semibold rounded-2xl transition-all"
            style={tabStyle(pageTab === 'calendar')}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setPageTab('history')}
            className="px-4 py-2.5 flex items-center gap-2 text-sm font-semibold rounded-2xl transition-all"
            style={tabStyle(pageTab === 'history')}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        {/* ── Pending tab ── */}
        {pageTab === 'pending' && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6D4AE0' }} />
              </div>
            ) : approvals.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 flex flex-col items-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #f0edf9, #e3ddf8)' }}>
                  <CheckCircle className="w-7 h-7" style={{ color: '#6D4AE0' }} />
                </div>
                <p className="text-sm font-semibold text-gray-700">No pending approvals</p>
                <p className="text-xs text-gray-400 mt-1">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvals.map((a) => (
                  <div key={a.id} className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid #e3ddf8' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          <Link href={`/projects/${a.project.id}`} className="hover:underline" style={{ color: '#1f2937' }}>{a.project.title}</Link>
                        </h3>
                        <p className="text-sm text-gray-400">
                          {a.project.channel.title} · {a.job.type === 'SHORTS_EXPORT' ? 'Short ready to publish' : a.job.type.replace(/_/g, ' ').toLowerCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm" style={{ color: '#c2410c' }}>
                        <Clock className="w-4 h-4" />
                        Expires {new Date(a.expiresAt).toLocaleDateString()}
                      </div>
                    </div>

                    {isShortsExport(a.job.type, a.job.result)
                      ? <ShortsExportReview result={a.job.result} />
                      : <GenericResultView result={a.job.result} />}

                    <div className="mb-4">
                      <textarea
                        placeholder="Review notes (optional)"
                        value={notes[a.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                        rows={2}
                        className="w-full bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
                        style={{ border: '1.5px solid #e3e0f0' }}
                      />
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      {/* Approve & Publish Now */}
                      <button
                        onClick={() => approveMutation.mutate({ id: a.id })}
                        disabled={approveMutation.isPending || scheduleOpenFor === a.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                        style={{ background: '#15803d', boxShadow: '0 4px 16px rgba(21,128,61,0.25)' }}
                      >
                        {approveMutation.isPending && approveMutation.variables?.id === a.id && !approveMutation.variables?.scheduledAt
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <CheckCircle className="w-4 h-4" />}
                        Approve &amp; Publish Now
                      </button>

                      {/* Schedule button — only for Shorts exports that go to YouTube */}
                      {isShortsExport(a.job.type, a.job.result) && (
                        <button
                          onClick={() => setScheduleOpenFor((prev) => prev === a.id ? null : a.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-2xl font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                          style={{
                            background: scheduleOpenFor === a.id ? '#1d4ed8' : 'white',
                            color: scheduleOpenFor === a.id ? 'white' : '#1d4ed8',
                            border: '1.5px solid #bfdbfe',
                            boxShadow: scheduleOpenFor === a.id ? '0 4px 16px rgba(29,78,216,0.25)' : undefined,
                          }}
                        >
                          <CalendarClock className="w-4 h-4" />
                          Schedule
                        </button>
                      )}

                      <button
                        onClick={() => rejectMutation.mutate({ id: a.id })}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
                        style={{ background: '#dc2626', boxShadow: '0 4px 16px rgba(220,38,38,0.25)' }}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>

                      {isShortsExport(a.job.type, a.job.result) && a.job.result.shortClipId && (
                        <button
                          onClick={() => moveToEditingMutation.mutate({ id: a.id })}
                          disabled={moveToEditingMutation.isPending}
                          title="Close this approval and reopen the clip in the timeline editor"
                          className="flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
                          style={{ border: '1.5px solid #e3ddf8' }}
                        >
                          {moveToEditingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                          Move to editing
                        </button>
                      )}
                    </div>

                    {/* Inline schedule panel */}
                    {scheduleOpenFor === a.id && (
                      <SchedulePanel
                        approvalId={a.id}
                        onConfirm={(id, scheduledAt) => approveMutation.mutate({ id, scheduledAt })}
                        onCancel={() => setScheduleOpenFor(null)}
                        isPending={approveMutation.isPending && approveMutation.variables?.id === a.id}
                      />
                    )}

                    {approveMutation.isError && approveMutation.variables?.id === a.id && (
                      <p className="text-xs text-red-600 mt-2">
                        {approveMutation.error instanceof Error
                          ? (approveMutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? approveMutation.error.message
                          : 'Action failed — please try again'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Calendar tab ── */}
        {pageTab === 'calendar' && (
          <>
            {/* Channel selector + view toggle */}
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={channelId}
                onChange={(e) => { handleChannelChange(e.target.value); }}
                className="bg-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
                style={{ border: '1.5px solid #e3e0f0' }}
                aria-label="Select channel"
              >
                <option value="">All channels</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <div className="flex gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => { setView('month'); }}
                  className="px-3 py-2.5 flex items-center gap-1.5 text-sm font-semibold rounded-2xl transition-all"
                  style={
                    view === 'month'
                      ? { background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', color: '#fff', border: '1.5px solid transparent', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }
                      : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }
                  }
                >
                  <CalendarDays className="w-4 h-4" /> Month
                </button>
                <button
                  type="button"
                  onClick={() => { setView('list'); }}
                  className="px-3 py-2.5 flex items-center gap-1.5 text-sm font-semibold rounded-2xl transition-all"
                  style={
                    view === 'list'
                      ? { background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', color: '#fff', border: '1.5px solid transparent', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }
                      : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }
                  }
                >
                  <LayoutList className="w-4 h-4" /> List
                </button>
              </div>
            </div>

            {view === 'month'
              ? <MonthView channelId={channelId} onSelect={setSelected} />
              : <ListView channelId={channelId} onSelect={setSelected} />}

            {selected && <VideoDetailModal video={selected} onClose={() => { setSelected(null); }} />}
          </>
        )}

        {/* ── History tab ── */}
        {pageTab === 'history' && (
          <>
            {history.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 flex flex-col items-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #f0edf9, #e3ddf8)' }}>
                  <History className="w-7 h-7" style={{ color: '#6D4AE0' }} />
                </div>
                <p className="text-sm font-semibold text-gray-700">No review history yet</p>
                <p className="text-xs text-gray-400 mt-1">Approved and rejected items will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                    <History className="w-4 h-4" /> Recently reviewed
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: '#f5f2fd', color: '#6D4AE0' }}>{history.length}</span>
                  </h2>
                  <button
                    onClick={() => setOpenRows((prev) => prev.size === history.length ? new Set() : new Set(history.map((a) => a.id)))}
                    className="text-xs hover:underline"
                    style={{ color: '#6D4AE0' }}
                  >
                    {openRows.size === history.length ? 'Collapse all' : 'Expand all'}
                  </button>
                </div>
                <div className="space-y-2">
                  {history.map((a) => (
                    <HistoryRow
                      key={a.id}
                      a={a}
                      open={openRows.has(a.id)}
                      onToggle={() => setOpenRows((prev) => {
                        const next = new Set(prev);
                        if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                        return next;
                      })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ── Plan Content modal ────────────────────────────────────────────────────────

function PlanContentModal({
  channelId,
  initialDate,
  onClose,
  onCreated,
}: {
  channelId: string;
  initialDate: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [fmt, setFmt] = useState<'VIDEO' | 'SHORT'>('VIDEO');
  const [angle, setAngle] = useState('');
  // pre-fill to noon on the clicked day in local time
  const localNoon = new Date(initialDate);
  localNoon.setHours(12, 0, 0, 0);
  const localIso = new Date(localNoon.getTime() - localNoon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [plannedAt, setPlannedAt] = useState(localIso);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api.autonomy.createEntry(channelId, {
      title: title.trim(),
      plannedAt: new Date(plannedAt).toISOString(),
      format: fmt,
      angle: angle.trim() || undefined,
    }),
    onSuccess: () => { onCreated(); onClose(); },
  });

  const errMsg = error instanceof Error
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? error.message
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,40,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan content"
        className="bg-white rounded-3xl w-full max-w-md p-6"
        style={{ border: '1.5px solid #e3ddf8' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4" style={{ color: '#6D4AE0' }} />
            Plan new content
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-2xl hover:bg-gray-50 text-gray-400" style={{ border: '1.5px solid #e3ddf8' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to grow on YouTube in 2026"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
              style={{ border: '1.5px solid #e3e0f0' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Format</label>
              <div className="flex gap-2">
                {(['VIDEO', 'SHORT'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFmt(f)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={fmt === f
                      ? { background: 'linear-gradient(135deg, #6D4AE0, #7c5ae8)', color: '#fff', border: '1.5px solid transparent' }
                      : { background: '#faf9ff', color: '#374151', border: '1.5px solid #e3ddf8' }}
                  >
                    {f === 'SHORT' ? <><Scissors className="w-3 h-3 inline mr-1" />Short</> : 'Video'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Planned date</label>
              <input
                type="datetime-local"
                value={plannedAt}
                onChange={(e) => setPlannedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
                style={{ border: '1.5px solid #e3e0f0' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Angle / hook <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="A compelling hook that stops viewers mid-scroll"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all"
              style={{ border: '1.5px solid #e3e0f0' }}
            />
          </div>

          {errMsg && <p className="text-xs text-red-600">{errMsg}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isPending || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to calendar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Month (calendar) view ─────────────────────────────────────────────────────

function MonthView({ channelId, onSelect }: { channelId: string; onSelect: (v: TrackedVideo) => void }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [planDay, setPlanDay] = useState<Date | null>(null);

  const gridStart = startOfWeek(startOfMonth(month), WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(month), WEEK_OPTS);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const { data: videos = [], isLoading } = useQuery<TrackedVideo[]>({
    queryKey: ['scheduler-month', channelId, format(month, 'yyyy-MM')],
    queryFn: () =>
      api.publishing
        .listVideos({
          channelId: channelId || undefined,
          from: gridStart.toISOString(),
          to: gridEnd.toISOString(),
          take: 200,
        })
        .then((r) => r.data.data),
  });

  // AI-planned slots — channel-scoped; require a specific channel selection
  const { data: planned = [] } = useQuery<CalendarEntry[]>({
    queryKey: ['scheduler-planned', channelId, format(month, 'yyyy-MM')],
    queryFn: () =>
      api.autonomy
        .listCalendar(channelId, { from: gridStart.toISOString(), to: gridEnd.toISOString() })
        .then((r) => r.data.filter((e) => e.status === 'PROPOSED' || e.status === 'APPROVED')),
    enabled: !!channelId,
  });

  const plannedByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of planned) {
      const key = format(new Date(e.plannedAt), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [planned]);

  const byDay = useMemo(() => {
    const map = new Map<string, TrackedVideo[]>();
    for (const v of videos) {
      const d = effectiveDate(v);
      if (!d) continue;
      const key = format(d, 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return map;
  }, [videos]);

  return (
    <>
      <div className="bg-white rounded-2xl p-4 flex flex-col" style={{ border: '1.5px solid #e3ddf8' }}>
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setMonth((m) => subMonths(m, 1)); }}
              className="p-2 rounded-2xl hover:bg-[#faf9ff] text-gray-600 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 w-40 text-center">{format(month, 'MMMM yyyy')}</h2>
            <button
              type="button"
              onClick={() => { setMonth((m) => addMonths(m, 1)); }}
              className="p-2 rounded-2xl hover:bg-[#faf9ff] text-gray-600 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Scheduled</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Published</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Failed</span>
              {channelId && (
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-indigo-400" /> AI planned</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setMonth(startOfMonth(new Date())); }}
              className="px-3 py-1.5 text-sm font-semibold rounded-2xl text-gray-600 hover:bg-[#faf9ff] transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
            >
              Today
            </button>
          </div>
        </div>

        {/* Channel hint for planned slots */}
        {!channelId && (
          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            Select a specific channel above to see AI-planned slots and plan new content.
          </p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-16 justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6D4AE0' }} /> Loading calendar…
          </div>
        )}

        {!isLoading && (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 pb-2 mb-1" style={{ borderBottom: '1px solid #f0edf9' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="px-2">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayVideos = byDay.get(key) ?? [];
                const dayPlanned = plannedByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, month);
                const visibleVideos = dayVideos.slice(0, 3);
                const remainingSlots = Math.max(0, 3 - visibleVideos.length);
                return (
                  <div
                    key={key}
                    className={`group p-1.5 min-h-[100px] flex flex-col gap-1 ${inMonth ? '' : 'bg-[#faf9ff]/60'}`}
                    style={{ borderBottom: '1px solid #f0edf9', borderRight: '1px solid #f0edf9' }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-semibold ${
                          isToday(day)
                            ? 'text-white'
                            : inMonth ? 'text-gray-700' : 'text-gray-400'
                        }`}
                        style={isToday(day) ? { background: '#6D4AE0' } : {}}
                      >
                        {format(day, 'd')}
                      </span>
                      {/* Plan content button — only when channel selected, visible on hover */}
                      {channelId && inMonth && (
                        <button
                          type="button"
                          onClick={() => setPlanDay(day)}
                          title="Plan content for this day"
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full flex items-center justify-center transition-opacity hover:bg-[#6D4AE0]/10"
                          style={{ color: '#6D4AE0' }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {visibleVideos.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { onSelect(v); }}
                        title={`${v.source === 'SHORT' ? 'Short · ' : ''}${STATUS_LABEL[v.status]}: ${v.title}`}
                        className="text-left text-[11px] leading-tight px-1.5 py-1 rounded-lg truncate hover:opacity-80 transition-opacity flex items-center gap-1"
                        style={STATUS_CHIP_STYLE[v.status]}
                      >
                        {v.source === 'SHORT' && <Scissors className="w-2.5 h-2.5 shrink-0" />}
                        <span className="truncate">{v.title}</span>
                      </button>
                    ))}
                    {dayVideos.length > 3 && (
                      <span className="text-[10px] text-gray-400 px-1.5">+{dayVideos.length - 3} more</span>
                    )}
                    {dayPlanned.slice(0, remainingSlots).map((e) => (
                      <span
                        key={e.id}
                        title={`${e.source === 'manual' ? 'Manual plan' : 'AI planned'} (${e.status.toLowerCase()}): ${e.title}`}
                        className="text-left text-[11px] leading-tight px-1.5 py-1 rounded-lg border border-dashed truncate"
                        style={e.source === 'manual'
                          ? { background: '#fdf4ff', color: '#7c3aed', borderColor: '#e9d5ff' }
                          : { background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }}
                      >
                        {e.title}
                      </span>
                    ))}
                    {dayPlanned.length > remainingSlots && remainingSlots > 0 && (
                      <span className="text-[10px] text-gray-400 px-1.5">+{dayPlanned.length - remainingSlots} planned</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {planDay && channelId && (
        <PlanContentModal
          channelId={channelId}
          initialDate={planDay}
          onClose={() => setPlanDay(null)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ['scheduler-planned', channelId, format(month, 'yyyy-MM')] });
          }}
        />
      )}
    </>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ channelId, onSelect }: { channelId: string; onSelect: (v: TrackedVideo) => void }) {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [searchInput, setSearchInput] = useState('');
  const q = useDebounced(searchInput, 300);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['scheduler-list', channelId, statusTab, q],
    queryFn: ({ pageParam }) =>
      api.publishing
        .listVideos({
          channelId: channelId || undefined,
          status: statusTab === 'all' ? undefined : [statusTab],
          q: q || undefined,
          take: LIST_PAGE_SIZE,
          skip: pageParam,
        })
        .then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.skip + last.data.length < last.total ? last.skip + last.take : undefined,
  });

  const videos = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(['all', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as StatusTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setStatusTab(t); }}
              className="px-3 py-2 text-sm font-semibold rounded-2xl transition-all"
              style={
                statusTab === t
                  ? { background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', color: '#fff', border: '1.5px solid transparent', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }
                  : { background: '#faf9ff', border: '1.5px solid #e3ddf8', color: '#374151' }
              }
            >
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); }}
            placeholder="Search videos…"
            aria-label="Search videos"
            className="w-full pl-10 pr-4 bg-white rounded-2xl py-3 text-sm outline-none focus:ring-2 focus:ring-[#6D4AE0]/20 focus:border-[#6D4AE0] transition-all placeholder:text-gray-400"
            style={{ border: '1.5px solid #e3e0f0' }}
          />
        </div>
        {!isLoading && (
          <span
            className="rounded-full text-[11px] font-bold px-2.5 py-0.5 ml-auto"
            style={{ background: '#f5f2fd', color: '#6D4AE0' }}
          >
            {total} video{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6D4AE0' }} /> Loading videos…
        </div>
      )}

      {!isLoading && videos.length === 0 && (
        <div className="bg-white rounded-3xl p-16 flex flex-col items-center justify-center text-center" style={{ border: '1.5px solid #e3ddf8' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #f0edf9, #e3ddf8)' }}>
            <CalendarClock className="w-8 h-8" style={{ color: '#6D4AE0' }} />
          </div>
          <p className="text-base font-extrabold text-gray-900 mb-1">No {statusTab === 'all' ? 'tracked' : STATUS_LABEL[statusTab as TrackedVideoStatus].toLowerCase()} videos yet</p>
          <p className="text-sm text-gray-400">Videos appear here once they are scheduled or published.</p>
        </div>
      )}

      {!isLoading && videos.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
          {videos.map((v) => {
            const d = effectiveDate(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => { onSelect(v); }}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[#faf9ff] transition-colors"
                style={{ borderBottom: '1px solid #f0edf9' }}
              >
                {/* Thumbnail */}
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="w-24 h-14 object-cover rounded-2xl bg-gray-100 shrink-0" />
                ) : (
                  <div className="w-24 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-5 h-5 text-gray-300" />
                  </div>
                )}
                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                    {v.source === 'SHORT' && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                        style={{ background: '#fdf4ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}
                      >
                        <Scissors className="w-2.5 h-2.5" />Short
                      </span>
                    )}
                    <span className="truncate">{v.title}</span>
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {v.channel.title} · {v.project.title}
                  </p>
                </div>
                {/* Stats (published only) */}
                {v.status === 'PUBLISHED' && (
                  <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 tabular-nums shrink-0">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {v.viewCount.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {v.likeCount.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {v.commentCount.toLocaleString()}</span>
                  </div>
                )}
                {/* Date + status */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={v.status} />
                  <span className="text-xs text-gray-400 tabular-nums">
                    {d ? format(d, 'd MMM yyyy, HH:mm') : '—'}
                  </span>
                </div>
              </button>
            );
          })}
          {hasNextPage && (
            <div className="p-3 flex justify-center" style={{ borderTop: '1px solid #f0edf9' }}>
              <button
                type="button"
                onClick={() => { void fetchNextPage(); }}
                disabled={isFetchingNextPage}
                className="px-4 py-2 text-sm font-semibold rounded-2xl text-gray-600 hover:bg-[#faf9ff] disabled:opacity-50 flex items-center gap-2 transition-colors"
                style={{ border: '1.5px solid #e3ddf8' }}
              >
                {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function VideoDetailModal({ video, onClose }: { video: TrackedVideo; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const youtubeUrl = video.youtubeVideoId ? `https://youtu.be/${video.youtubeVideoId}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,40,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={video.title}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden"
        style={{ border: '1.5px solid #e3ddf8' }}
      >
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="w-full aspect-video object-cover bg-gray-100" />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold text-gray-900">{video.title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-2xl hover:bg-[#faf9ff] text-gray-400 shrink-0 transition-colors"
              style={{ border: '1.5px solid #e3ddf8' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{video.channel.title} · {video.project.title}</p>

          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Status</span>
              <StatusBadge status={video.status} />
            </div>
            {video.scheduledAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Scheduled for</span>
                <span className="text-gray-900 tabular-nums">{format(new Date(video.scheduledAt), 'd MMM yyyy, HH:mm')}</span>
              </div>
            )}
            {video.publishedAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Published on</span>
                <span className="text-gray-900 tabular-nums">{format(new Date(video.publishedAt), 'd MMM yyyy, HH:mm')}</span>
              </div>
            )}
            {video.status === 'PUBLISHED' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Performance</span>
                <span className="flex items-center gap-3 text-gray-900 text-xs tabular-nums">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-gray-400" /> {video.viewCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5 text-gray-400" /> {video.likeCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-gray-400" /> {video.commentCount.toLocaleString()}</span>
                </span>
              </div>
            )}
          </div>

          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #6D4AE0 0%, #7c5ae8 100%)', boxShadow: '0 4px 20px rgba(109,74,224,0.35)' }}
            >
              <ExternalLink className="w-4 h-4" /> Open on YouTube
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
