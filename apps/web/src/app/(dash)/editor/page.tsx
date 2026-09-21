'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Loader2, AlertCircle } from 'lucide-react';
import { api, type EditProject } from '@/lib/api';

const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 4000;

function SmartRedirect() {
  const router = useRouter();
  const ran = useRef(false);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Fast path: if the user was recently in a project, jump straight there.
    const cached = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('lastEditorId')
      : null;
    if (cached) {
      router.replace(`/editor/${cached}`);
      return;
    }

    async function go(currentAttempt: number): Promise<void> {
      try {
        const { data: edits } = await api.editor.listMine();
        const arr: EditProject[] = Array.isArray(edits) ? edits : [];
        if (arr.length > 0) {
          const sorted = arr.slice().sort(
            (a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime()
          );
          router.replace(`/editor/${sorted[0]!.id}`);
          return;
        }
        const { data: edit } = await api.editor.createBlank({ title: 'New Edit' });
        router.replace(`/editor/${edit.id}`);
      } catch {
        if (currentAttempt < MAX_ATTEMPTS) {
          // Server may be waking up (cold start) — wait and retry
          setAttempt(currentAttempt + 1);
          setTimeout(() => void go(currentAttempt + 1), RETRY_DELAY_MS);
        } else {
          setError('Could not open the editor. Please try again.');
        }
      }
    }

    void go(1);
  }, [router]);

  function retry() {
    setError(null);
    setAttempt(1);
    ran.current = false;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-800 mb-1">Couldn&apos;t open the editor</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
        <button
          onClick={retry}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #374151, #1f2937)' }}
      >
        <Film className="w-7 h-7 text-white" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-800 text-lg">Opening Video Editor</p>
        <div className="flex items-center justify-center gap-2 mt-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">
            {attempt > 1 ? `Starting up… (attempt ${attempt}/${MAX_ATTEMPTS})` : 'Loading your workspace…'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return <SmartRedirect />;
}
