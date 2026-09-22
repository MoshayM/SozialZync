'use client';
import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2, RefreshCw, Clock, Search } from 'lucide-react';
import { type HistoryEntry } from '@/hooks/use-content-history';

interface ResultHistoryProps {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onRerun: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  timeAgo: (ts: number) => string;
}

const TYPE_ICONS: Record<string, string> = {
  seo: '🔍', trends: '📈', research: '📚', series: '📋', repurpose: '♻️', score: '⭐',
};

export function ResultHistory({ entries, onRestore, onRerun, onDelete, timeAgo }: ResultHistoryProps) {
  const [open, setOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  if (entries.length === 0) return null;

  const entryTypes = [...new Set(entries.map(e => e.type))].filter(Boolean);

  const filtered = entries.filter(e => {
    const matchesType = !typeFilter || e.type === typeFilter;
    const q = historySearch.toLowerCase();
    const matchesSearch = !q ||
      e.label.toLowerCase().includes(q) ||
      (e.summaryText ?? '').toLowerCase().includes(q) ||
      (e.query ?? '').toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const chipStyle = (active: boolean) => active
    ? { background: '#374151', color: '#fff', border: '1.5px solid #374151' }
    : { background: '#fff', color: '#6b7280', border: '1.5px solid #e3ddf8' };

  return (
    <div className="bg-white rounded-2xl border border-[#e3ddf8] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#faf9ff] hover:bg-[#f3f4f6] transition-colors text-sm"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-700">
          <History className="w-4 h-4 text-[#374151]" />
          Previous Results
          <span className="px-2 py-0.5 bg-[#f0edfb] text-[#374151] rounded-full text-xs font-bold">
            {entries.length}
          </span>
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <>
          {/* Search + type filter */}
          <div className="px-4 py-3 border-b border-[#f0edfb] space-y-2.5 bg-[#faf9ff]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search history…"
                className="w-full bg-white rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#374151]/20"
                style={{ border: '1.5px solid #e3ddf8' }}
              />
            </div>
            {entryTypes.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setTypeFilter('')}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                  style={chipStyle(typeFilter === '')}>
                  All
                </button>
                {entryTypes.map(t => (
                  <button key={t} type="button"
                    onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition-all"
                    style={chipStyle(typeFilter === t)}>
                    {TYPE_ICONS[t]} {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">
              No results match &ldquo;{historySearch}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-[#f0edfb]">
              {filtered.map(entry => (
                <li key={entry.id} className="px-5 py-4 hover:bg-[#faf9ff] transition-colors group">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5 shrink-0">{TYPE_ICONS[entry.type] ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{entry.label}</span>
                        <span className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0">
                          <Clock className="w-3 h-3" />{timeAgo(entry.savedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{entry.summaryText}</p>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onRestore(entry)}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[#f3f4f6] border border-[#e3ddf8] text-[#374151] rounded-full hover:bg-[#ebe6fb] transition-colors"
                        >
                          View result
                        </button>
                        <button
                          type="button"
                          onClick={() => onRerun(entry)}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-white border border-[#e3ddf8] text-gray-600 rounded-full hover:bg-[#f3f4f6] hover:text-[#374151] hover:border-[#c4b5f4] transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Try Again
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(entry.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 rounded-full hover:text-red-400 hover:bg-red-50 transition-colors ml-auto"
                          title="Remove from history"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
