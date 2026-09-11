// Shared watch-history utility — used by the watch-history page and any future
// video player that wants to record a view.

const LS_KEY = 'cf_watch_history';
const MAX_ENTRIES = 500;

export interface WatchEntry {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  duration: string;   // display string, e.g. "18:42"
  durationSec: number;
  progress: number;   // 0–100
  progressSec: number;
  watchedAt: string;  // ISO 8601
  gradient: string;
  views: string;
  kind: 'video' | 'short';
}

export function getHistory(): WatchEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as WatchEntry[]; }
  catch { return []; }
}

export function saveHistory(entries: WatchEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function recordWatch(entry: Omit<WatchEntry, 'id' | 'watchedAt'>): void {
  const existing = getHistory().filter((e) => e.videoId !== entry.videoId);
  const next: WatchEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2),
    watchedAt: new Date().toISOString(),
  };
  saveHistory([next, ...existing]);
}

export function updateProgress(videoId: string, progress: number, progressSec: number): void {
  const entries = getHistory().map((e) =>
    e.videoId === videoId
      ? { ...e, progress, progressSec, watchedAt: new Date().toISOString() }
      : e,
  );
  saveHistory(entries);
}

export function removeEntry(id: string): void {
  saveHistory(getHistory().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  localStorage.removeItem(LS_KEY);
}
