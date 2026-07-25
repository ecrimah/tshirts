"use client";

import { useState } from 'react';

// Newsletter Component
export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Subscribe failed');
      }
      setSubmitStatus('success');
      setEmail('');
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 mb-12">
      <div className="bg-stone-950 rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-stone-800 relative">

        {/* Premium Background Textures & Lighting */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-stone-700 rounded-full blur-[120px] opacity-30"></div>
          <div className="absolute top-40 -left-20 w-72 h-72 bg-stone-600 rounded-full blur-[100px] opacity-20"></div>
          {/* Subtle top edge highlight */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-stone-500/50 to-transparent"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between p-8 md:p-10 lg:p-12 gap-8">

          {/* Left Content */}
          <div className="text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-stone-300 text-xs font-semibold tracking-[0.2em] uppercase mb-4 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse"></span>
              The Insider Club
            </div>

            <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-white mb-4 leading-tight tracking-tight">
              Unlock <span className="italic text-stone-400 font-light">10% Off</span> <br /> Your First Order
            </h3>

            <p className="text-stone-400 text-base leading-relaxed tracking-wide">
              Be the first to know about new arrivals, restocks, and exclusive deals. From premium wigs to luxurious extensions, we keep you updated on the latest products.
            </p>
          </div>

          {/* Right Form */}
          <div className="w-full max-w-md bg-stone-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-stone-800 pwa-submit-form shadow-inner">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-transparent border-none text-white placeholder-stone-500 px-5 py-3 focus:ring-0 text-base font-medium tracking-wide"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-stone-200 hover:bg-white text-stone-950 font-bold px-8 py-3 rounded-[14px] transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed shadow-lg whitespace-nowrap text-sm"
              >
                {isSubmitting ? (
                  <i className="ri-loader-4-line animate-spin text-lg"></i>
                ) : (
                  <span className="flex items-center gap-2 tracking-wide">
                    Join <i className="ri-arrow-right-line"></i>
                  </span>
                )}
              </button>
            </form>
          </div>

        </div>

        {submitStatus === 'success' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-200 text-stone-950 px-6 py-2 rounded-full font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-2 border border-stone-300">
            <i className="ri-checkbox-circle-fill mr-2"></i> Welcome to the club!
          </div>
        )}
      </div>
    </div>
  );
}
