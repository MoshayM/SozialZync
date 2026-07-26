'use client';
import { useState, useCallback, useEffect } from 'react';

const LS_HIST = 'cf_result_history';
const MAX_ENTRIES = 10;

export type HistoryType = 'seo' | 'trends' | 'research' | 'series' | 'repurpose' | 'score';

export interface HistoryEntry {
  id: string;
  type: HistoryType;
  label: string;
  query: string;
  summaryText: string;
  fullText: string;
  // @reason: history stores heterogeneous AI result shapes across 6 different modes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  savedAt: number;
}

function loadAll(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_HIST);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch { return []; }
}

function saveAll(entries: HistoryEntry[]) {
  try { localStorage.setItem(LS_HIST, JSON.stringify(entries)); } catch {}
}

export function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function useContentHistory(type: HistoryType) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadAll().filter(e => e.type === type));
  }, [type]);

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'savedAt' | 'type'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: `${type}-${String(Date.now())}`,
      type,
      savedAt: Date.now(),
    };
    // Replace existing entry with same label for this type
    const all = loadAll().filter(e => !(e.type === type && e.label === newEntry.label));
    const updated = [newEntry, ...all].slice(0, MAX_ENTRIES);
    saveAll(updated);
    setEntries(updated.filter(e => e.type === type));
  }, [type]);

  const removeEntry = useCallback((id: string) => {
    const all = loadAll().filter(e => e.id !== id);
    saveAll(all);
    setEntries(all.filter(e => e.type === type));
  }, [type]);

  return { entries, addEntry, removeEntry, timeAgo };
}
