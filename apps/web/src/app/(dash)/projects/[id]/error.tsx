'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

function isChunkError(error: Error): boolean {
  const msg = error.message ?? '';
  return (
    error.name === 'ChunkLoadError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('Unable to preload CSS')
  );
}

export default function ProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = isChunkError(error);

  useEffect(() => {
    if (chunk) window.location.reload();
  }, [chunk]);

  if (chunk) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 rounded-full border-[3px] animate-spin" style={{ borderColor: '#e3ddf8', borderTopColor: '#7c5ae8' }} />
        <p className="text-sm text-gray-400">Refreshing…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f3f4f6,#e3ddf8)' }}>
        <RefreshCw className="w-6 h-6 text-gray-400" />
      </div>
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">This tab failed to load</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Try clicking <strong>Try again</strong> — if this keeps happening, reload the page.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-2xl font-semibold text-sm text-white hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#374151,#7c5ae8)', boxShadow: '0 4px 16px rgba(55,65,81,0.30)' }}
        >
          Try again
        </button>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl font-semibold text-sm text-gray-700 border hover:bg-gray-50 transition-colors"
          style={{ borderColor: '#e3ddf8' }}
        >
          <ArrowLeft className="w-4 h-4" /> All Projects
        </Link>
      </div>
    </div>
  );
}
