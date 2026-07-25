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

  const values = [
    {
      icon: 'ri-verified-badge-line',
      title: 'Verified Quality',
      description: 'Every product is personally inspected before it reaches you. Whether sourced locally or imported from China, quality comes first.'
    },
    {
      icon: 'ri-money-dollar-circle-line',
      title: 'Unbeatable Prices',
      description: 'By sourcing directly from manufacturers and local suppliers, we cut out the middleman and pass the savings to you.'
    },
    {
      icon: 'ri-global-line',
      title: 'Local & Imported',
      description: 'The best of both worlds — handpicked local products alongside carefully selected imports from trusted Chinese suppliers.'
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
        subtitle="Premium wigs and luxury extensions designed to make every moment feel special."
        backgroundImage="/hero_about_1772074892869.png"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex border-b border-gray-200 mb-12 justify-center">
          <button
            onClick={() => setActiveTab('story')}
            className={`px-4 py-2 sm:px-8 sm:py-4 font-medium transition-colors text-lg cursor-pointer ${activeTab === 'story'
              ? 'text-stone-700 border-b-4 border-stone-700 font-bold'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Our Story
          </button>
          <button
            onClick={() => setActiveTab('mission')}
            className={`px-4 py-2 sm:px-8 sm:py-4 font-medium transition-colors text-lg cursor-pointer ${activeTab === 'mission'
              ? 'text-stone-700 border-b-4 border-stone-700 font-bold'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Our Mission
          </button>
        </div>

        {activeTab === 'story' && (
          <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="order-2 md:order-1">
              <div className="flex items-center gap-4 mb-8">
                <span className="h-[1px] w-12 bg-stone-300"></span>
                <span className="text-stone-500 text-sm tracking-[0.3em] uppercase font-medium">Our Story</span>
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-gray-900 mb-8 leading-[1.1] tracking-tight">
                How It All <span className="italic font-light text-stone-500">Started</span>
              </h2>
              <div className="space-y-6 text-lg text-gray-600 font-light leading-[1.8]">
                <p>
                  <strong>{siteName}</strong> started with a simple idea: bring beautifully curated pieces together in one place, so getting dressed feels effortless and exciting.
                </p>
                <p>
                  From statement wigs and luxurious extensions to everyday essentials, every item is carefully selected for quality, comfort, and style. We believe great hair should feel accessible, inspiring, and uniquely you.
                </p>
                <p>
                  Whether you are refreshing your wardrobe, shopping for a special occasion, or styling content for your brand, <strong>{siteName}</strong> is here to make every look feel intentional and complete.
                </p>
              </div>
            </div>

            <div className="relative order-1 md:order-2 group">
              <div className="aspect-[4/5] bg-stone-50 relative flex items-center justify-center overflow-hidden transition-transform duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)]">
                <img
                  src={getSetting('site_logo') || '/logo.png'}
                  alt={siteName}
                  className="w-3/5 h-auto object-contain mix-blend-multiply opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] relative z-10"
                />
              </div>
              {/* Architectural offset shadow element instead of heavy glowing shadows */}
              <div className="absolute -z-10 -bottom-6 -right-6 w-full h-full bg-stone-100/80 transition-transform duration-1000 group-hover:-translate-y-2 group-hover:-translate-x-2 ease-[cubic-bezier(0.25,0.1,0.25,1)]"></div>
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
                To provide quality products, expert guidance, fast and reliable services to beauty enthusiasts and professionals.
              </p>
            </div>
            <div className="bg-amber-50 p-10 rounded-3xl border border-amber-100">
              <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                <i className="ri-eye-line text-3xl text-white"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Vision Statement</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                To be the one stop beauty store delivering quality, comfort and reliability without compromise.
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
      <div className="bg-stone-900 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to shop smarter?</h2>
          <p className="text-xl text-stone-100 mb-10 leading-relaxed max-w-2xl mx-auto">
            Browse our collection of premium wigs, extensions, closures, frontals and more. New stock arrives weekly.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 bg-white text-stone-900 px-10 py-5 rounded-full font-bold text-lg hover:bg-stone-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
          >
            Start Shopping
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
