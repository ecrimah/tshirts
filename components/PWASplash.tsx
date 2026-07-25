'use client';

import { useState, useEffect } from 'react';

export default function PWASplash() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Only show splash in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Only show on first load (not on subsequent navigations)
    const hasShownSplash = sessionStorage.getItem('splashShown');

    if (isStandalone && !hasShownSplash) {
      setShowSplash(true);
      sessionStorage.setItem('splashShown', 'true');

      const timer = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showSplash) return null;

  return (
    <div className="pwa-splash" aria-hidden="true">
      <div className="pwa-splash-logo mb-6">
        <img
          src="/logo.png"
          alt="Mamator"
          className="w-24 h-24 object-contain rounded-full"
        />
      </div>
      <div className="z-10 flex flex-col items-center animate-fade-in-up delay-300">
        <h1 className="text-white text-xl font-bold font-serif mb-2">Mamator</h1>
        <p className="text-stone-200 text-sm font-medium mb-8">Premium t-shirts &amp; polos</p>
        <div className="flex gap-2">
          <span className="w-2 h-2 bg-white rounded-full" />
          <span className="w-2 h-2 bg-white rounded-full" />
          <span className="w-2 h-2 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}
