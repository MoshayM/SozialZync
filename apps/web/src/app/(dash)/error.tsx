'use client';

import { useEffect } from 'react';

function isChunkError(error: Error): boolean {
  const msg = error.message ?? '';
  return (
    error.name === 'ChunkLoadError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('Unable to preload CSS')
  );
}

export default function DashError({
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

  // Chunk errors: show a silent spinner and reload — never flash the error UI
  if (chunk) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div
          className="w-7 h-7 rounded-full border-[3px] animate-spin"
          style={{ borderColor: '#e3ddf8', borderTopColor: '#7c5ae8' }}
        />
        <p className="text-sm text-gray-400">Refreshing…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center text-3xl">
        ⚠️
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-600 max-w-xs">
          This can happen after a new update is deployed. Reloading usually fixes it.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-br from-[#374151] to-[#7c5ae8] shadow hover:opacity-90 transition-opacity"
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-[#374151] border border-[#e3ddf8] hover:bg-[#f3f4f6] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
