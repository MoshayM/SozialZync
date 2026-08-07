'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LibraryRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const tab = params.get('tab');
    const target =
      tab === 'assets'    ? '/studio/assets' :
      tab === 'playlists' ? '/settings/channels' :
                            '/settings/channels';
    router.replace(target);
  }, [router, params]);
  return null;
}

export default function LibraryPage() {
  return <Suspense><LibraryRedirect /></Suspense>;
}
