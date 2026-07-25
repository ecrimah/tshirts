'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AboutPage() {
  usePageTitle('Our Story');
  const { getSetting } = useCMS();
  const [activeTab, setActiveTab] = useState('story');

  const siteName = getSetting('site_name') || process.env.NEXT_PUBLIC_SITE_NAME || 'Mamator';
  const companyName =
    getSetting('company_legal_name') || 'Mamator Trading Enterprise';

  const values = [
    {
      icon: 'ri-verified-badge-line',
      title: 'Verified Quality',
      description: 'Every tee is checked for fabric, fit, and finish — from plain crew necks to graphic prints and polos.'
    },
    {
      icon: 'ri-money-dollar-circle-line',
      title: 'Unbeatable Prices',
      description: 'Direct sourcing on blanks and imports means better prices on the shirts you wear every day.'
    },
    {
      icon: 'ri-global-line',
      title: 'Local & Imported',
      description: 'Graphic, plain, polo, and performance tees — curated from trusted factories and local partners.'
    },
    {
      icon: 'ri-truck-line',
      title: 'Nationwide Delivery',
      description: 'Fast and reliable delivery across Ghana. Based in Accra, we ship to every region with care and speed.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Our Story"
        subtitle="Ghana’s home for quality t-shirts, polos, and performance tees."
        backgroundImage="/hero-fashion-bg.jpg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex border-b border-gray-200 mb-12 justify-center">
          <button
            onClick={() => setActiveTab('story')}
            className={`px-4 py-2 sm:px-8 sm:py-4 font-medium transition-colors text-lg cursor-pointer ${activeTab === 'story'
              ? 'text-store-navy border-b-4 border-store-primary font-bold'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Our Story
          </button>
          <button
            onClick={() => setActiveTab('mission')}
            className={`px-4 py-2 sm:px-8 sm:py-4 font-medium transition-colors text-lg cursor-pointer ${activeTab === 'mission'
              ? 'text-store-navy border-b-4 border-store-primary font-bold'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Our Mission
          </button>
        </div>

        {activeTab === 'story' && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold text-store-ink mb-8 tracking-tight">
              How It All Started
            </h2>
            <div className="space-y-6 text-base sm:text-lg text-gray-600 leading-relaxed">
              <p>
                <strong className="font-semibold text-gray-800">{companyName}</strong> started with a
                simple idea: bring quality t-shirts to Ghanaians at fair prices. We saw how people were
                paying too much for tees that could be sourced smarter — so we built a bridge between
                trusted Chinese manufacturers, local suppliers, and everyday shoppers.
              </p>
              <p>
                What began as a small operation in Accra has grown into a focused online store for
                t-shirts — graphic prints, plain crew necks, polos, and performance styles. We
                handpick every shirt, test the fabric and fit, and price it fairly.
              </p>
              <p>
                Whether you are shopping for yourself, stocking your boutique, or looking for the perfect
                gift, <strong className="font-semibold text-gray-800">{companyName}</strong> has you
                covered. We combine local sourcing with direct imports to give you the widest selection
                at the best value.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'mission' && (
          <div className="grid md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-stone-50 p-10 rounded-3xl border border-stone-100">
              <div className="w-16 h-16 bg-stone-700 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                <i className="ri-focus-3-line text-3xl text-white"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Mission Statement</h3>
              <p className="text-gray-600 leading-relaxed text-sm lg:text-base">
                To connect Ghanaians with quality t-shirts at fair prices — through trusted imports,
                local partnerships, and a shopping experience you can rely on.
              </p>
            </div>
            <div className="bg-amber-50 p-10 rounded-3xl border border-amber-100">
              <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                <i className="ri-eye-line text-3xl text-white"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Vision Statement</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                To become Ghana&apos;s go-to online store for t-shirts and polos — known for value,
                trust, and nationwide delivery.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Values Section */}
      <div className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Shop With Us?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Trusted by hundreds of customers and resellers across Ghana.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                  <i className={`${value.icon} text-2xl text-stone-700`}></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-store-navy py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to shop smarter?</h2>
          <p className="text-xl text-white/85 mb-10 leading-relaxed max-w-2xl mx-auto">
            Browse graphic tees, plain basics, polos, and performance shirts — handpicked and fairly priced.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 bg-store-primary text-store-navy px-10 py-5 rounded-full font-bold text-lg hover:bg-store-primary-dark transition-colors shadow-lg"
          >
            Start Shopping
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
