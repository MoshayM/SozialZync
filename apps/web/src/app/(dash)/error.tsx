'use client';

import { useEffect } from 'react';

export default function DashError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-recover from ChunkLoadError (happens when a new deploy replaces old JS chunks)
    if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f5f2fd] flex items-center justify-center text-3xl">
        ⚠️
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          This can happen after a new update is deployed. Reloading usually fixes it.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-br from-[#6D4AE0] to-[#7c5ae8] shadow hover:opacity-90 transition-opacity"
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-[#6D4AE0] border border-[#e3ddf8] hover:bg-[#f5f2fd] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
