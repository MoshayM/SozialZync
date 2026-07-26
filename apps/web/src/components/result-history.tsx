'use client';
import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2, RefreshCw, Clock } from 'lucide-react';
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

  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#e3ddf8] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#faf9ff] hover:bg-[#f5f2fd] transition-colors text-sm"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-700">
          <History className="w-4 h-4 text-[#6D4AE0]" />
          Previous Results
          <span className="px-2 py-0.5 bg-[#f0edfb] text-[#6D4AE0] rounded-full text-xs font-bold">
            {entries.length}
          </span>
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <ul className="divide-y divide-[#f0edfb]">
          {entries.map(entry => (
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
                      className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[#f5f2fd] border border-[#e3ddf8] text-[#6D4AE0] rounded-full hover:bg-[#ebe6fb] transition-colors"
                    >
                      View result
                    </button>
                    <button
                      type="button"
                      onClick={() => onRerun(entry)}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-white border border-[#e3ddf8] text-gray-600 rounded-full hover:bg-[#f5f2fd] hover:text-[#6D4AE0] hover:border-[#c4b5f4] transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 rounded-full hover:text-red-400 hover:bg-red-50 transition-colors ml-auto opacity-0 group-hover:opacity-100"
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
    </div>
  );
}
