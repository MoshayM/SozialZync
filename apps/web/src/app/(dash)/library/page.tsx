'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LibraryRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const tab = params.get('tab');
    const target =
      tab === 'channels'  ? '/projects?tab=channels' :
      tab === 'assets'    ? '/projects?tab=media&media=assets' :
      tab === 'playlists' ? '/projects?tab=media&media=playlists' :
                            '/projects?tab=media';
    router.replace(target);
  }, [router, params]);
  return null;
}

export default function LibraryPage() {
  return <Suspense><LibraryRedirect /></Suspense>;
}
