'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center bg-white">
      {/* Brand mark */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg"
        style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)' }}
      >
        S
      </div>

      {/* 404 */}
      <div>
        <p className="text-[80px] font-black leading-none text-gray-100 select-none">404</p>
        <h1 className="text-xl font-bold text-gray-900 -mt-2 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/home"
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #374151 0%, #7c5ae8 100%)' }}
        >
          Go to Dashboard
        </Link>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
