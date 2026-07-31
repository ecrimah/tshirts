'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

function isChunkLoadError(error: Error): boolean {
  const msg = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return (
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed')
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reloaded = useRef(false);

  useEffect(() => {
    console.error('[app/error]', error);

    // After a deploy, stale clients often hit ChunkLoadError once — hard reload recovers.
    if (!reloaded.current && isChunkLoadError(error)) {
      const key = 'mamator_chunk_reload';
      const already = sessionStorage.getItem(key);
      if (!already) {
        reloaded.current = true;
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center bg-gradient-to-br from-store-surface via-white to-white">
      <div className="w-16 h-16 rounded-full bg-store-surface flex items-center justify-center mb-6">
        <i className="ri-error-warning-line text-3xl text-store-navy" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Something went wrong</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Please try again. If you keep seeing this after a site update, hard-refresh or reopen the app.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem('mamator_chunk_reload');
            } catch {
              /* ignore */
            }
            reset();
            window.location.reload();
          }}
          className="px-8 py-3 rounded-full bg-store-primary text-store-navy font-semibold hover:bg-store-primary-dark transition-colors"
        >
          Try again
        </button>
        <Link
          href="/shop"
          className="px-8 py-3 rounded-full border-2 border-store-navy text-store-navy font-semibold hover:bg-store-surface transition-colors"
        >
          Go to Shop
        </Link>
      </div>
    </div>
  );
}
