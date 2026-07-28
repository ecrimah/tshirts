'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TEE_IMAGES } from '@/lib/tee-images';
import {
  type HomeCategory,
  categoryImageUrl,
  categoryShopHref,
  pickHomeCategories,
} from '@/lib/home-categories';

type SlideCopy = {
  script: string;
  title: string;
  subtitle: string;
  cta: string;
};

/** Brand-led hero copy — category images/links still come from admin categories. */
const DEFAULT_SLIDE_COPY: SlideCopy = {
  script: 'Mamator',
  title: "Ghana's Trusted Plain T-Shirt Supplier",
  subtitle: 'Wholesale & Retail • Premium Quality • Nationwide Delivery',
  cta: 'Shop Now',
};

const SLIDE_COPY_BY_SLUG: { match: RegExp; copy: SlideCopy }[] = [
  {
    match: /plain|basic/i,
    copy: {
      script: 'Mamator',
      title: "Ghana's Trusted Plain T-Shirt Supplier",
      subtitle: 'Wholesale & Retail • Premium Quality • Nationwide Delivery',
      cta: 'Shop Plains',
    },
  },
  {
    match: /graphic/i,
    copy: {
      script: 'Graphics',
      title: 'Bold Graphic Tees for Every Brand',
      subtitle: 'Wholesale & Retail • Custom Prints • Nationwide Delivery',
      cta: 'Shop Graphics',
    },
  },
  {
    match: /polo/i,
    copy: {
      script: 'Polos',
      title: 'Polo T-Shirts Built for Business',
      subtitle: 'Wholesale & Retail • Corporate Ready • Nationwide Delivery',
      cta: 'Shop Polos',
    },
  },
  {
    match: /performance|sport|active/i,
    copy: {
      script: 'Performance',
      title: 'Performance Tees That Work Hard',
      subtitle: 'Wholesale & Retail • Durable Wear • Nationwide Delivery',
      cta: 'Shop Performance',
    },
  },
];

const FALLBACK_SLIDES = [
  {
    ...DEFAULT_SLIDE_COPY,
    image: TEE_IMAGES.heroFlatLay,
    href: '/shop',
    readMore: '/categories',
  },
  {
    script: 'Graphics',
    title: 'Bold Graphic Tees for Every Brand',
    subtitle: 'Wholesale & Retail • Custom Prints • Nationwide Delivery',
    cta: 'Shop Graphics',
    image: TEE_IMAGES.heroGraphic,
    href: '/shop',
    readMore: '/categories',
  },
  {
    script: 'Polos',
    title: 'Polo T-Shirts Built for Business',
    subtitle: 'Wholesale & Retail • Corporate Ready • Nationwide Delivery',
    cta: 'Shop Polos',
    image: TEE_IMAGES.heroPolo,
    href: '/categories',
    readMore: '/about',
  },
];

type Slide = {
  script: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  imageClass: string;
  href: string;
  readMore: string;
};

function copyForCategory(cat: HomeCategory, index: number): SlideCopy {
  const haystack = `${cat.slug} ${cat.name}`;
  const matched = SLIDE_COPY_BY_SLUG.find((entry) => entry.match.test(haystack));
  if (matched) return matched.copy;
  // First slide always gets the flagship supplier message
  if (index === 0) return DEFAULT_SLIDE_COPY;
  return {
    script: 'Mamator',
    title: cat.name,
    subtitle: 'Wholesale & Retail • Premium Quality • Nationwide Delivery',
    cta: 'Shop Now',
  };
}

function slidesFromCategories(categories: HomeCategory[]): Slide[] {
  const picked = pickHomeCategories(categories, 3);
  if (picked.length === 0) {
    return FALLBACK_SLIDES.map((s) => ({ ...s, imageClass: 'object-cover object-center' }));
  }
  return picked.map((cat, i) => {
    const copy = copyForCategory(cat, i);
    return {
      ...copy,
      image: categoryImageUrl(cat, i),
      imageClass: 'object-cover object-center',
      href: categoryShopHref(cat.slug),
      readMore: '/categories',
    };
  });
}

const SLIDE_MS = 6000;

function isRemoteImage(src: string): boolean {
  return src.startsWith('http://') || src.startsWith('https://');
}

export default function HomeHeroSlider({ categories = [] }: { categories?: HomeCategory[] }) {
  const slides = useMemo(() => slidesFromCategories(categories), [categories]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[index] ?? slides[0];

  if (!slide) return null;

  return (
    <section className="relative w-full overflow-hidden bg-store-navy">
      <div className="relative min-h-[480px] sm:min-h-[540px] md:min-h-[600px] lg:min-h-[640px]">
        {slides.map((s, i) => (
          <div
            key={`${s.title}-${i}`}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              i === index ? 'opacity-100 z-0' : 'opacity-0 z-0 pointer-events-none'
            }`}
            aria-hidden={i !== index}
          >
            {isRemoteImage(s.image) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className={`absolute inset-0 h-full w-full ${s.imageClass}`} />
            ) : (
              <Image
                src={s.image}
                alt=""
                fill
                className={s.imageClass}
                priority={i === 0}
                sizes="100vw"
                quality={90}
              />
            )}
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
          </div>
        ))}

        <div className="relative z-10 flex min-h-[480px] sm:min-h-[540px] md:min-h-[600px] lg:min-h-[640px] items-center justify-center px-4 sm:px-6 py-16">
          <div key={index} className="w-full max-w-3xl text-center animate-fade-in">
            <p className="font-handwriting text-3xl sm:text-4xl md:text-[2.75rem] text-store-primary mb-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] leading-none">
              {slide.script}
            </p>

            <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-extrabold text-white uppercase tracking-[0.06em] leading-[1.05] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
              {slide.title}
            </h1>

            <p className="mt-5 max-w-xl mx-auto text-base sm:text-lg md:text-xl text-white/90 font-normal leading-relaxed drop-shadow-md">
              {slide.subtitle}
            </p>

            <div className="mt-9 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href={slide.href}
                className="inline-flex w-full sm:w-auto min-w-[200px] items-center justify-center gap-2 rounded-full bg-store-primary px-10 py-4 text-sm font-bold uppercase tracking-[0.12em] text-black shadow-[0_8px_32px_rgba(201,162,39,0.45)] transition-all hover:bg-white hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] hover:scale-[1.02] active:scale-[0.98]"
              >
                {slide.cta}
                <i className="ri-arrow-right-line text-lg" aria-hidden />
              </Link>
              <Link
                href={slide.readMore}
                className="inline-flex w-full sm:w-auto min-w-[200px] items-center justify-center rounded-full border-2 border-white/90 bg-white/10 px-10 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm transition-all hover:bg-white hover:text-black hover:border-white active:scale-[0.98]"
              >
                Read More
              </Link>
            </div>
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                    i === index
                      ? 'bg-store-primary scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-transparent'
                      : 'bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-white/10">
              <div
                key={index}
                className="h-full bg-store-primary origin-left"
                style={{ animation: `heroSlideProgress ${SLIDE_MS}ms linear forwards` }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
