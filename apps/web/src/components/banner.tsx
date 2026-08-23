'use client';
import React from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type BannerType = 'success' | 'error' | 'warning' | 'info';

export interface BannerState {
  type: BannerType;
  message: string;
}

export function safeString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(safeString).join('\n');
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj['message'] === 'string') return obj['message'];
    try { return JSON.stringify(val); } catch { return 'An unexpected error occurred.'; }
  }
  return 'An unexpected error occurred.';
}

// Simple inline toast — appears at top, auto-dismisses
export function Banner({
  type,
  message,
  onDismiss,
}: { type: BannerType; message: unknown; onDismiss: () => void }) {
  const text = safeString(message);
  const styles: Record<BannerType, string> = {
    success: 'border text-emerald-300',
    error: 'border text-red-400',
    warning: 'border text-amber-400',
    info: 'border text-blue-400',
  };
  const styleInline: Record<BannerType, React.CSSProperties> = {
    success: { background: 'rgba(16,185,129,.1)', borderColor: 'rgba(16,185,129,.2)' },
    error: { background: 'rgba(239,68,68,.12)', borderColor: 'rgba(239,68,68,.2)' },
    warning: { background: 'rgba(251,191,36,.1)', borderColor: 'rgba(251,191,36,.2)' },
    info: { background: 'rgba(59,130,246,.1)', borderColor: 'rgba(59,130,246,.2)' },
  };
  const icons: Record<BannerType, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />,
    error: <XCircle className="w-4 h-4 text-red-600 shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />,
    info: <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />,
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${styles[type]}`} style={styleInline[type]}>
      {icons[type]}
      <span className="flex-1 whitespace-pre-wrap">{text}</span>
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
