'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, Plus, X, Loader2, Check } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type EntryStatus = 'idea' | 'draft' | 'scheduled' | 'published';

interface CalendarEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  status: EntryStatus;
  category?: string;
  notes?: string;
}

interface GeneratedIdea {
  title: string;
  category: string;
  date: string;
  selected: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LS_KEY = 'cf_content_calendar';
const NICHE_KEY = 'cf_channel_niche';

const CATEGORIES = ['Tutorial', 'Review', 'Trending', 'Educational', 'Entertainment', 'Behind the Scenes', 'Q&A', 'Challenge', 'Announcement', 'Other'];

const STATUS_COLORS: Record<EntryStatus, string> = {
  idea: '#6366f1',
  draft: '#f59e0b',
  scheduled: '#7C3AED',
  published: '#10b981',
};

const STATUS_BG: Record<EntryStatus, string> = {
  idea: '#eef2ff',
  draft: '#fffbeb',
  scheduled: '#f5f2fd',
  published: '#ecfdf5',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayStr(): string {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

function loadEntries(): CalendarEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as CalendarEntry[]; } catch { return []; }
}

function saveEntries(entries: CalendarEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function getWeekdaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(toDateStr(year, month, date.getDate()));
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function fallbackGenerate(niche: string, count: number, year: number, month: number): GeneratedIdea[] {
  const templates: Array<{ category: string; title: (n: string) => string }> = [
    { category: 'Tutorial',          title: n => `How to ${n} for Beginners` },
    { category: 'Review',            title: n => `Best ${n} Tools in 2026` },
    { category: 'Trending',          title: n => `Why Everyone is Talking About ${n}` },
    { category: 'Educational',       title: n => `${n} Explained in 5 Minutes` },
    { category: 'Entertainment',     title: n => `${n} Challenges You Have to Try` },
    { category: 'Behind the Scenes', title: n => `Day in the Life of a ${n} Creator` },
    { category: 'Q&A',               title: n => `Your Top ${n} Questions Answered` },
    { category: 'Challenge',         title: n => `The ${n} 30-Day Challenge` },
  ];
  const weekdays = getWeekdaysInMonth(year, month);
  const result: GeneratedIdea[] = [];
  const step = Math.max(1, Math.floor(weekdays.length / count));
  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length]!;
    result.push({
      title: tpl.title(niche || 'Content'),
      category: tpl.category,
      date: weekdays[Math.min(i * step, weekdays.length - 1)] ?? weekdays[0] ?? toDateStr(year, month, 1),
      selected: true,
    });
  }
  return result;
}

// ── Entry Modal ────────────────────────────────────────────────────────────────

function EntryModal({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Partial<CalendarEntry> & { date: string };
  onSave: (e: CalendarEntry) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [category, setCategory] = useState(initial.category ?? 'Tutorial');
  const [status, setStatus] = useState<EntryStatus>(initial.status ?? 'idea');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const overlayRef = useRef<HTMLDivElement>(null);

  function submit() {
    if (!title.trim()) return;
    onSave({
      id: initial.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: initial.date,
      title: title.trim(),
      status,
      category,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">{initial.id ? 'Edit Entry' : 'Add Entry'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{initial.date}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Title *</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Video idea title…"
            className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-purple-400 bg-[#faf9ff]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-purple-400 bg-[#faf9ff]"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as EntryStatus)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-purple-400 bg-[#faf9ff]"
            >
              <option value="idea">Idea</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-purple-400 bg-[#faf9ff] resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          {initial.id && onDelete && (
            <button
              onClick={() => { onDelete(initial.id!); onClose(); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border border-red-200"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors border border-gray-200 ml-auto"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 16px -4px rgba(109,74,224,.4)' }}
          >
            <Check className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generate Plan Modal ────────────────────────────────────────────────────────

function GenerateModal({
  year,
  month,
  onAdd,
  onClose,
}: {
  year: number;
  month: number;
  onAdd: (ideas: GeneratedIdea[]) => void;
  onClose: () => void;
}) {
  const [niche, setNiche] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(NICHE_KEY) ?? '';
  });
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  async function generate() {
    if (!niche.trim()) return;
    setLoading(true);
    setIdeas([]);
    localStorage.setItem(NICHE_KEY, niche.trim());
    try {
      const res = await fetch('/api/proxy/content/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('cf_token') ?? '' : ''}` },
        body: JSON.stringify({ niche: niche.trim(), count, month: month + 1, year }),
      });
      if (!res.ok) throw new Error('api');
      const data = await res.json() as { ideas?: Array<{ title: string; category?: string; date?: string }> };
      const weekdays = getWeekdaysInMonth(year, month);
      const step = Math.max(1, Math.floor(weekdays.length / count));
      const parsed: GeneratedIdea[] = (data.ideas ?? []).slice(0, count).map((item, i) => ({
        title: item.title,
        category: item.category ?? CATEGORIES[i % CATEGORIES.length] ?? 'Tutorial',
        date: item.date ?? weekdays[Math.min(i * step, weekdays.length - 1)] ?? toDateStr(year, month, 1),
        selected: true,
      }));
      setIdeas(parsed.length ? parsed : fallbackGenerate(niche.trim(), count, year, month));
    } catch {
      setIdeas(fallbackGenerate(niche.trim(), count, year, month));
    } finally {
      setLoading(false);
    }
  }

  function toggleIdea(i: number) {
    setIdeas(prev => prev.map((idea, idx) => idx === i ? { ...idea, selected: !idea.selected } : idea));
  }

  function addSelected() {
    onAdd(ideas.filter(i => i.selected));
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Generate Content Plan</h2>
            <p className="text-xs text-gray-500 mt-0.5">{MONTH_NAMES[month]} {year}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 shrink-0">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Channel niche / topic</label>
            <input
              autoFocus
              value={niche}
              onChange={e => setNiche(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void generate(); }}
              placeholder="e.g. tech reviews, cooking, personal finance…"
              className="w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-purple-400 bg-[#faf9ff]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Number of videos: {count}</label>
            <input
              type="range" min={4} max={28} step={1} value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full accent-[#7C3AED]"
            />
            <div className="flex justify-between text-[10px] text-gray-400"><span>4</span><span>28</span></div>
          </div>
          <button
            onClick={() => void generate()}
            disabled={!niche.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#D97706,#7C3AED)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generating…' : 'Generate Plan'}
          </button>
        </div>

        {/* Skeleton loading */}
        {loading && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: '#f0edf9' }} />
            ))}
          </div>
        )}

        {/* Ideas list */}
        {!loading && ideas.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {ideas.map((idea, i) => (
              <label key={i} className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50" style={{ border: '1.5px solid #e3ddf8' }}>
                <input
                  type="checkbox"
                  checked={idea.selected}
                  onChange={() => toggleIdea(i)}
                  className="mt-0.5 accent-[#7C3AED] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{idea.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#f5f2fd', color: '#6D4AE0' }}>{idea.category}</span>
                    <span className="text-[11px] text-gray-400">{idea.date}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {!loading && ideas.length > 0 && (
          <button
            onClick={addSelected}
            disabled={!ideas.some(i => i.selected)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
            style={{ background: 'linear-gradient(135deg,#6D4AE0,#7c5ae8)', boxShadow: '0 4px 16px -4px rgba(109,74,224,.4)' }}
          >
            <Check className="w-4 h-4" />
            Add {ideas.filter(i => i.selected).length} to Calendar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ContentCalendarPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [editEntry, setEditEntry] = useState<(Partial<CalendarEntry> & { date: string }) | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const today = todayStr();

  // Load from localStorage on mount
  useEffect(() => { setEntries(loadEntries()); }, []);

  const persist = useCallback((next: CalendarEntry[]) => {
    setEntries(next);
    saveEntries(next);
  }, []);

  function saveEntry(entry: CalendarEntry) {
    const existing = entries.findIndex(e => e.id === entry.id);
    if (existing >= 0) {
      persist(entries.map((e, i) => i === existing ? entry : e));
    } else {
      persist([...entries, entry]);
    }
    setEditEntry(null);
  }

  function deleteEntry(id: string) {
    persist(entries.filter(e => e.id !== id));
  }

  function addGeneratedIdeas(ideas: GeneratedIdea[]) {
    const newEntries: CalendarEntry[] = ideas.map(idea => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: idea.date,
      title: idea.title,
      status: 'idea',
      category: idea.category,
    }));
    persist([...entries, ...newEntries]);
  }

  // ── Stats bar ────────────────────────────────────────────────────────────────

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter(e => e.date.startsWith(monthStr));

  const stats = {
    total: monthEntries.length,
    drafts: monthEntries.filter(e => e.status === 'draft').length,
    scheduled: monthEntries.filter(e => e.status === 'scheduled').length,
    published: monthEntries.filter(e => e.status === 'published').length,
  };

  // ── Month grid ───────────────────────────────────────────────────────────────

  function buildMonthGrid() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // getDay: 0=Sun,1=Mon…6=Sat → convert to Mon-first: Mon=0,Tue=1,…Sun=6
    const startDow = (firstDay.getDay() + 6) % 7; // offset to make Monday=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null; inMonth: boolean }> = [];

    // Pad before
    for (let i = 0; i < startDow; i++) {
      const d = new Date(viewYear, viewMonth, 1 - (startDow - i));
      cells.push({ date: toDateStr(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: toDateStr(viewYear, viewMonth, d), day: d, inMonth: true });
    }
    // Pad after to complete the last row
    const remainder = cells.length % 7;
    if (remainder > 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
        const d = new Date(viewYear, viewMonth + 1, i);
        cells.push({ date: toDateStr(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: false });
      }
    }
    return cells;
  }

  // ── Week grid ────────────────────────────────────────────────────────────────

  function buildWeekDays() {
    // Find Monday of the week containing today (or viewYear/viewMonth/1 if different month)
    const ref = new Date();
    const dow = (ref.getDay() + 6) % 7;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - dow);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(toDateStr(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return days;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const grid = buildMonthGrid();
  const weekDays = buildWeekDays();

  return (
    <div className="min-h-full bg-[#faf9ff]">
      <div className="px-4 py-6 sm:p-8 max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-5 h-5" style={{ color: '#7C3AED' }} />
              <h1 className="text-2xl font-extrabold text-gray-900">Content Calendar</h1>
            </div>
            <p className="text-sm text-gray-500">AI-planned video schedule — add ideas, track status</p>
          </div>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98] shrink-0"
            style={{ background: 'linear-gradient(135deg,#D97706,#7C3AED)', boxShadow: '0 4px 16px -4px rgba(109,74,224,.4)' }}
          >
            <Sparkles className="w-4 h-4" />Generate Plan
          </button>
        </div>

        {/* Month nav + view toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white transition-colors border border-[#e3ddf8]">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-base font-bold text-gray-900 min-w-[160px] text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white transition-colors border border-[#e3ddf8]">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="flex gap-1 p-1 rounded-xl ml-auto" style={{ background: '#f0edf9' }}>
            {(['month', 'week'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
                style={viewMode === v ? { background: '#fff', color: '#6D4AE0', boxShadow: '0 2px 8px rgba(109,74,224,.15)' } : { color: '#9b8fc4' }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Total', value: stats.total, color: '#6366f1', bg: '#eef2ff' },
            { label: 'Drafts', value: stats.drafts, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Scheduled', value: stats.scheduled, color: '#7C3AED', bg: '#f5f2fd' },
            { label: 'Published', value: stats.published, color: '#10b981', bg: '#ecfdf5' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: s.bg, color: s.color }}>
              <span className="text-base font-extrabold">{s.value}</span>{s.label}
            </div>
          ))}
        </div>

        {/* ── Month View ── */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            {/* Day header */}
            <div className="grid grid-cols-7 border-b border-[#e3ddf8]">
              {DAY_NAMES.map(d => (
                <div key={d} className="py-2.5 text-center text-xs font-bold text-gray-500">{d}</div>
              ))}
            </div>
            {/* Grid rows */}
            <div className="grid grid-cols-7">
              {grid.map((cell, idx) => {
                if (!cell.date) return <div key={idx} className="min-h-[90px] border-b border-r border-[#f0edf9]" />;
                const cellEntries = entries.filter(e => e.date === cell.date);
                const isToday = cell.date === today;
                const isExpanded = expandedDay === cell.date;
                const visible = isExpanded ? cellEntries : cellEntries.slice(0, 3);
                const overflow = cellEntries.length - 3;
                return (
                  <div
                    key={idx}
                    className="min-h-[90px] p-1.5 border-b border-r border-[#f0edf9] transition-colors hover:bg-[#faf9ff]"
                    style={isToday ? { background: '#f5f2fd', outline: '2px solid #7C3AED', outlineOffset: '-2px', borderRadius: '2px' } : {}}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold leading-none ${cell.inMonth ? (isToday ? 'text-[#7C3AED]' : 'text-gray-800') : 'text-gray-300'}`}
                      >
                        {cell.day}
                      </span>
                      <button
                        onClick={() => setEditEntry({ date: cell.date! })}
                        className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                        style={{ fontSize: '14px', lineHeight: 1 }}
                        title="Add entry"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div
                      className="space-y-0.5 cursor-pointer"
                      onClick={() => { if (cellEntries.length === 0) setEditEntry({ date: cell.date! }); }}
                    >
                      {visible.map(entry => (
                        <div
                          key={entry.id}
                          onClick={e => { e.stopPropagation(); setEditEntry(entry); }}
                          className="flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: STATUS_BG[entry.status] }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.status] }} />
                          <span className="text-[10px] font-medium truncate" style={{ color: STATUS_COLORS[entry.status] }}>{entry.title}</span>
                        </div>
                      ))}
                      {overflow > 0 && !isExpanded && (
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedDay(cell.date!); }}
                          className="text-[10px] text-purple-500 font-semibold hover:underline w-full text-left px-1"
                        >
                          +{overflow} more
                        </button>
                      )}
                      {isExpanded && (
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedDay(null); }}
                          className="text-[10px] text-gray-400 font-semibold hover:underline w-full text-left px-1"
                        >
                          show less
                        </button>
                      )}
                    </div>
                    {cellEntries.length === 0 && cell.inMonth && (
                      <div
                        onClick={() => setEditEntry({ date: cell.date! })}
                        className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Week View ── */}
        {viewMode === 'week' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #e3ddf8' }}>
            <div className="grid grid-cols-7 border-b border-[#e3ddf8]">
              {weekDays.map((dateStr, i) => {
                const d = new Date(dateStr + 'T00:00:00');
                const isToday = dateStr === today;
                return (
                  <div key={dateStr} className="py-3 px-2 text-center border-r border-[#f0edf9] last:border-r-0" style={isToday ? { background: '#f5f2fd' } : {}}>
                    <div className="text-[10px] font-bold text-gray-400">{DAY_NAMES[i]}</div>
                    <div className={`text-sm font-bold ${isToday ? 'text-[#7C3AED]' : 'text-gray-800'}`}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {weekDays.map(dateStr => {
                const dayEntries = entries.filter(e => e.date === dateStr);
                const isToday = dateStr === today;
                return (
                  <div
                    key={dateStr}
                    className="min-h-[200px] p-2 border-r border-[#f0edf9] last:border-r-0 space-y-1.5"
                    style={isToday ? { background: '#faf5ff' } : {}}
                  >
                    {dayEntries.map(entry => (
                      <div
                        key={entry.id}
                        onClick={() => setEditEntry(entry)}
                        className="p-2 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: STATUS_BG[entry.status], border: `1.5px solid ${STATUS_COLORS[entry.status]}22` }}
                      >
                        <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: STATUS_COLORS[entry.status] }}>{entry.title}</p>
                        {entry.category && (
                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1" style={{ background: 'rgba(109,74,224,.1)', color: '#6D4AE0' }}>{entry.category}</span>
                        )}
                        <div className="mt-1">
                          <span className="text-[10px] font-bold capitalize" style={{ color: STATUS_COLORS[entry.status] }}>{entry.status}</span>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setEditEntry({ date: dateStr })}
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors border-2 border-dashed border-gray-200 hover:border-purple-200"
                    >
                      <Plus className="w-3 h-3" />Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {(Object.entries(STATUS_COLORS) as Array<[EntryStatus, string]>).map(([s, color]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="capitalize font-medium">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Entry modal */}
      {editEntry && (
        <EntryModal
          initial={editEntry}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={() => setEditEntry(null)}
        />
      )}

      {/* Generate modal */}
      {showGenerate && (
        <GenerateModal
          year={viewYear}
          month={viewMonth}
          onAdd={addGeneratedIdeas}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </div>
  );
}
