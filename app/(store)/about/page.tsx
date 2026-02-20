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

  const siteName = getSetting('site_name') || 'TIWAA PERFUME STYLE HOUSE';

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
        title="More Than Just A Brand"
        subtitle="From Satellite, Accra — perfumes wholesale and retail."
        backgroundImage="/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex border-b border-gray-200 mb-12 justify-center">
          <button
            onClick={() => setActiveTab('story')}
            className={`px-4 py-2 sm:px-8 sm:py-4 font-medium transition-colors text-lg cursor-pointer ${activeTab === 'story'
              ? 'text-blue-700 border-b-4 border-blue-700 font-bold'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Our Story
          </button>
          <button
            onClick={() => setActiveTab('mission')}
            className={`px-4 py-2 sm:px-8 sm:py-4 font-medium transition-colors text-lg cursor-pointer ${activeTab === 'mission'
              ? 'text-blue-700 border-b-4 border-blue-700 font-bold'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Our Mission
          </button>
        </div>

        {activeTab === 'story' && (
          <div className="grid md:grid-cols-2 gap-16 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-6">How It All Started</h2>
              <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                <p>
                  <strong>TIWAA PERFUME STYLE HOUSE</strong> sells perfumes — wholesale and retail. Based in Satellite, Accra, we offer a curated range of fragrances at competitive prices for both resellers and individual customers.
                </p>
                <p>
                  We focus on quality and value. Whether you're stocking up for your business or shopping for yourself, we handpick our perfumes to deliver genuine products and great prices.
                </p>
                <p>
                  Call us on <strong>054 501 0949</strong> or WhatsApp <strong>055 416 9992</strong>. We're here to help with orders and enquiries.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl bg-gray-100 relative flex items-center justify-center">
                <img
                  src="/tiwa logo.png"
                  alt="TIWAA PERFUME STYLE HOUSE"
                  className="w-2/3 h-auto object-contain opacity-80"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
                  <p className="text-white font-bold text-xl">TIWAA PERFUME STYLE HOUSE</p>
                  <p className="text-blue-200">Perfumes · Wholesale & Retail · Satellite, Accra</p>
                </div>
              </div>
              {/* Decorative Element */}
              <div className="absolute -z-10 top-10 -right-10 w-full h-full border-4 border-blue-100 rounded-2xl hidden md:block"></div>
            </div>
          </div>
        )}

        {activeTab === 'mission' && (
          <div className="grid md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 p-10 rounded-3xl border border-blue-100">
              <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                <i className="ri-store-2-line text-3xl text-white"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Everything in One Place</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                We stock a wide range of perfumes and fragrances. Our catalogue is constantly updated with new arrivals for both wholesale and retail customers.
              </p>
            </div>
            <div className="bg-amber-50 p-10 rounded-3xl border border-amber-100">
              <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                <i className="ri-hand-heart-line text-3xl text-white"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Empowering Resellers</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                We support small businesses and resellers with competitive bulk pricing. Many of our products are available at wholesale rates, helping entrepreneurs across Ghana grow their own ventures.
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
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <i className={`${value.icon} text-2xl text-blue-700`}></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-blue-900 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to shop smarter?</h2>
          <p className="text-xl text-blue-100 mb-10 leading-relaxed max-w-2xl mx-auto">
            Browse our perfumes — wholesale and retail. Call 054 501 0949 or WhatsApp 055 416 9992.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 bg-white text-blue-900 px-10 py-5 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
          >
            Start Shopping
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
