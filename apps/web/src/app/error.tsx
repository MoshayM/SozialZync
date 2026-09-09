'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = error.message ?? '';
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module');
    if (isChunkError) window.location.reload();
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center bg-gray-50">
      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-3xl shadow">
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
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
