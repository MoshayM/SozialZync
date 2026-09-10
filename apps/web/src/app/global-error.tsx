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

export default function GlobalError({
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

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
        {chunk ? (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #e5e7eb', borderTopColor: '#374151',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>Refreshing…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Something went wrong</h2>
              <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 300, margin: 0 }}>
                This can happen after a new update is deployed. Reloading usually fixes it.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, color: '#fff', background: '#374151', border: 'none', cursor: 'pointer' }}
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={reset}
                style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, color: '#374151', background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
