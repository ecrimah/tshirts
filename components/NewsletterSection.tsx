"use client";

import { useState } from 'react';

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
    <section className="relative z-10 py-12 md:py-16 bg-white">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-store-navy shadow-[0_24px_80px_-20px_rgba(0,0,0,0.55)] border border-store-navy-light">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 70% 80% at 18% 50%, rgba(56, 189, 248, 0.14) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 85% 50%, rgba(56, 189, 248, 0.08) 0%, transparent 50%)',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10 lg:gap-12 p-8 md:p-10 lg:p-14">
            <div className="text-center lg:text-left lg:max-w-[58%]">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-store-primary/35 bg-store-navy-light/90 px-4 py-2 shadow-[0_0_20px_rgba(106,176,255,0.15)] mb-6">
                <span className="h-2 w-2 shrink-0 rounded-full bg-store-primary shadow-[0_0_8px_rgba(106,176,255,0.9)]" />
                <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/95">
                  The Insider Club
                </span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.15] text-white tracking-tight">
                Unlock{' '}
                <span className="italic text-store-primary font-normal">10% Off</span>
                <br className="hidden sm:block" />
                {' '}
                Your First Order
              </h2>

              <p className="mt-5 text-sm md:text-base text-white/75 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Be the first to know about new tee drops, restocks, and exclusive deals. Graphic,
                plain, polo, and performance styles — all in one place.
              </p>
            </div>

            <div className="w-full lg:max-w-md lg:shrink-0">
              <form
                onSubmit={handleSubmit}
                className="flex items-stretch rounded-2xl border border-[#243352] bg-[#060b16]/80 p-1.5 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.06),0_0_40px_rgba(56,189,248,0.06)]"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="min-w-0 flex-1 bg-transparent border-none text-white placeholder:text-gray-500 px-4 py-3.5 text-base focus:outline-none focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-store-primary px-6 py-3.5 text-sm font-bold text-store-navy transition-colors hover:bg-store-primary-dark disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <i className="ri-loader-4-line animate-spin text-lg" aria-hidden />
                  ) : (
                    <>
                      Join <span aria-hidden>→</span>
                    </>
                  )}
                </button>
              </form>

              {submitStatus === 'error' && (
                <p className="mt-3 text-center lg:text-left text-sm text-red-400">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>
          </div>

          {submitStatus === 'success' && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-store-primary px-5 py-2 text-sm font-bold text-store-navy shadow-lg"
              role="status"
            >
              <i className="ri-checkbox-circle-fill" aria-hidden />
              Welcome to the club!
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
