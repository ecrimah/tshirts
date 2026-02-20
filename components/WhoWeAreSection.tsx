'use client';

import Image from 'next/image';
import Link from 'next/link';
import AnimatedSection from './AnimatedSection';

export default function WhoWeAreSection() {
  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Text Content */}
          <AnimatedSection className="order-2 lg:order-1">
            <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mb-6">
              Who We Are
            </h2>
            <div className="space-y-4 text-lg text-gray-600 leading-relaxed">
              <p>
                <strong>TIWAA PERFUME STYLE HOUSE</strong> is your premier destination for perfumes, both wholesale and retail. Based in Satellite, Accra, we offer a curated range of fragrances at competitive prices for resellers and individual customers.
              </p>
              <p>
                We focus on quality and value. Whether you're stocking up for your business or shopping for yourself, we handpick our perfumes to deliver genuine products and great prices.
              </p>
              <div className="pt-4">
                <Link 
                  href="/about" 
                  className="inline-flex items-center text-blue-800 font-medium hover:text-blue-900 transition-colors group"
                >
                  <span className="border-b border-transparent group-hover:border-blue-900 transition-colors">Read Our Full Story</span>
                  <i className="ri-arrow-right-line ml-2 transition-transform group-hover:translate-x-1"></i>
                </Link>
              </div>
            </div>
          </AnimatedSection>

          {/* Image Content */}
          <AnimatedSection className="order-1 lg:order-2 relative" delay={200}>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative group">
              <Image
                src="/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg"
                alt="TIWAA PERFUME STYLE HOUSE Interior"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Decorative Overlay */}
              <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-transparent transition-colors duration-300"></div>
            </div>
            
            {/* Floating Element */}
            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl max-w-xs hidden md:block animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700">
                  <i className="ri-medal-line text-xl"></i>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Premium Quality</p>
                  <p className="text-sm text-gray-500">Authentic Fragrances</p>
                </div>
              </div>
            </div>
          </AnimatedSection>

        </div>
      </div>
    </section>
  );
}
