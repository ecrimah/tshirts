'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';
import NewsletterSection from '@/components/NewsletterSection';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useStorePricing } from '@/context/StorePricingContext';
import { getProductCardPricing } from '@/lib/pricing';

export default function Home() {
  usePageTitle('');
  const { salesActive } = useStorePricing();
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Config State - Managed in Code
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const config: {
    hero: {
      headline: string;
      subheadline: string;
      primaryButtonText: string;
      primaryButtonLink: string;
      secondaryButtonText: string;
      secondaryButtonLink: string;
      backgroundImage?: string;
    };
    banners?: Array<{ text: string; active: boolean }>;
  } = {
    hero: {
      headline: 'Premium Wigs, Extensions, Closures & Frontals — Everything You Need, One Store',
      subheadline: 'Quality products locally sourced and imported directly from China. Unbeatable prices for individuals and resellers across Ghana.',
      primaryButtonText: 'Shop Collections',
      primaryButtonLink: '/shop',
      secondaryButtonText: 'Our Story',
      secondaryButtonLink: '/about',
      // backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop' // Optional override
    },
    banners: [
      { text: '🚚 Free delivery on orders over GH₵ 500 within Accra!', active: false },
      { text: '✨ New stock arriving this weekend - Pre-order now!', active: false },
      { text: '💳 Secure payments via Mobile Money & Card', active: false }
    ]
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const productsRes = await fetch('/api/storefront/products?featured=true&limit=8');
        if (productsRes.ok) {
          setFeaturedProducts(await productsRes.json());
        }

        const categoriesRes = await fetch('/api/storefront/categories');
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          const featuredCategories = (categoriesData || []).filter(
            (cat: { metadata?: { featured?: boolean } }) => cat.metadata?.featured === true
          );
          setCategories(featuredCategories);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [salesActive]);


  const getHeroImage = () => {
    if (config.hero.backgroundImage) return config.hero.backgroundImage;
    return "/logo.png";
  };

  const renderBanners = () => {
    const activeBanners = config.banners?.filter(b => b.active) || [];
    if (activeBanners.length === 0) return null;

    return (
      <div className="bg-stone-900 text-white py-2 overflow-hidden relative">
        <div className="flex animate-marquee whitespace-nowrap">
          {activeBanners.concat(activeBanners).map((banner, index) => (
            <span key={index} className="mx-8 text-sm font-medium tracking-wide flex items-center">
              {banner.text}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex-col items-center justify-between min-h-screen">
      {renderBanners()}

      {/* Hero Section - God Level Design */}
      <section className="relative w-full h-[85vh] md:h-[95vh] overflow-hidden bg-[#0a0a0a] group">

        {/* Premium Progress Bar */}
        <div className="absolute top-0 left-0 right-0 z-40 h-[2px] bg-white/5">
          <div
            key={currentSlide}
            className="h-full bg-gradient-to-r from-transparent via-white/80 to-white shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-progress origin-left"
            style={{ animationDuration: '3000ms' }}
          ></div>
        </div>

        {/* Background Slider + Per-Slide Content */}
        {[
          {
            image: '/image1.jpeg',
            tag: 'New Arrivals',
            heading: <>Premium <br /><span className="italic font-light text-transparent bg-clip-text bg-gradient-to-r from-stone-200 to-stone-400">Quality Collection</span></>,
            subtext: 'Discover our latest arrivals imported directly for you. Unmatched quality at unbeatable prices.',
            cta: { text: 'Shop Now', href: '/shop' },
            cta2: { text: 'View Catalog', href: '/categories' },
            position: 'object-center'
          },
          {
            image: '/image2.jpeg',
            tag: 'Fashion & Style',
            heading: <>Elegance <br /><span className="italic font-light text-transparent bg-clip-text bg-gradient-to-r from-rose-200 to-rose-400">Redefined</span></>,
            subtext: 'Step into the season with our exclusive hair collections. Curated for the modern trendsetter.',
            cta: { text: 'Shop Hair', href: '/shop?category=hair' },
            cta2: { text: 'Learn More', href: '/about' },
            position: 'object-top'
          },
          {
            image: '/image3.jpeg',
            tag: 'Exclusive Deals',
            heading: <>Limited <br /><span className="italic font-light text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">Time Offers</span></>,
            subtext: 'Don\'t miss out on our seasonal sale. Great discounts on your favorite items.',
            cta: { text: 'View Offers', href: '/shop?on_sale=true' },
            cta2: { text: 'Contact Us', href: '/contact' },
            position: 'object-center'
          },
        ].map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            {/* Background Image with Ken Burns Effect */}
            <div className={`absolute inset-0 ${index === currentSlide ? 'animate-ken-burns' : ''}`}>
              <Image
                src={slide.image}
                alt={`Hero Banner ${index + 1}`}
                fill
                className={`object-cover ${slide.position}`}
                priority={index === 0}
                sizes="100vw"
                quality={85}
              />
            </div>

            {/* Premium Overlays - Dark gradients, subtle noise */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>

            {/* Cinematic Noise Texture */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

            {/* Slide Content - Center aligned */}
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-6 md:px-16 lg:px-24 max-w-7xl mx-auto w-full h-full mt-[-20px] z-10">
              <div className="max-w-2xl lg:max-w-4xl flex flex-col items-center">

                {/* Minimalist Tag */}
                <div
                  className={`flex items-center justify-center gap-4 overflow-hidden mb-8 transition-all duration-1000 delay-[300ms] ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                  <span className="h-[1px] w-8 bg-white/60"></span>
                  <span className="text-white/90 text-xs md:text-sm tracking-[0.4em] uppercase font-medium">
                    {slide.tag}
                  </span>
                  <span className="h-[1px] w-8 bg-white/60"></span>
                </div>

                {/* Stately Heading */}
                <div className={`transition-all duration-1000 delay-[400ms] ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <h1 className="text-6xl sm:text-7xl md:text-[5.5rem] lg:text-[6.5rem] font-serif text-white mb-6 leading-[1.05] tracking-tight drop-shadow-2xl text-center">
                    {slide.heading}
                  </h1>
                </div>

                {/* Elegant Subtext */}
                <div className={`transition-all duration-1000 delay-[500ms] ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <p className="text-lg md:text-xl lg:text-2xl text-white/70 max-w-2xl mx-auto mb-12 font-light leading-relaxed tracking-wide text-center">
                    {slide.subtext}
                  </p>
                </div>

                {/* God-Level Rounded Buttons */}
                <div className={`flex flex-col sm:flex-row justify-center items-center gap-5 w-full sm:w-auto transition-all duration-[1200ms] delay-[600ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  {/* Primary Solid Button */}
                  <Link
                    href={slide.cta.href}
                    className="group relative flex items-center justify-center gap-4 px-8 py-[16px] bg-white text-gray-950 rounded-full font-medium tracking-[0.2em] text-xs sm:text-sm uppercase overflow-hidden hover:scale-[1.03] transition-all duration-500 w-full sm:w-auto shadow-[0_0_0_0_rgba(255,255,255,0)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.6)]"
                  >
                    {/* Hover Glow Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <span className="relative z-10 font-bold">{slide.cta.text}</span>

                    {/* Circular Icon Container */}
                    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black text-white group-hover:bg-gray-800 transition-colors duration-500">
                      <i className="ri-arrow-right-line text-sm transition-transform duration-500 group-hover:translate-x-1"></i>
                    </span>
                  </Link>

                  {/* Secondary Glass Button */}
                  <Link
                    href={slide.cta2.href}
                    className="group relative flex items-center justify-center px-10 py-[18px] bg-white/5 border border-white/30 text-white rounded-full font-medium tracking-[0.2em] text-xs sm:text-sm uppercase hover:bg-white hover:text-black transition-all duration-500 w-full sm:w-auto backdrop-blur-md overflow-hidden hover:scale-[1.03] shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)]"
                  >
                    {/* Shine effect that sweeps across on hover */}
                    <span className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] skew-x-12 group-hover:translate-x-[150%] transition-transform duration-1000 ease-out z-0"></span>

                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {slide.cta2.text}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Slide Indicators - Architectural and Minimalist */}
        <div className="absolute bottom-12 right-6 md:right-16 z-20 flex items-center gap-6">
          <div className="text-white/70 font-serif tabular-nums text-lg">
            0{currentSlide + 1}
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`transition-all duration-500 rounded-full relative overflow-hidden ${currentSlide === i
                  ? 'w-16 h-[2px] bg-white/20'
                  : 'w-4 h-[2px] bg-white/20 hover:bg-white/40'
                  }`}
                aria-label={`Go to slide ${i + 1}`}
              >
                {currentSlide === i && (
                  <span
                    className="absolute top-0 left-0 h-full bg-white block animate-progress origin-left"
                    style={{ animationDuration: '3000ms' }}
                  ></span>
                )}
              </button>
            ))}
          </div>
          <div className="text-white/40 font-serif tabular-nums text-sm">
            03
          </div>
        </div>

      </section>

      {/* Categories Section */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-gray-900 mb-4">Shop by Category</h2>
              <p className="text-gray-600 text-lg max-w-md">From premium wigs to luxurious extensions</p>
            </div>
            <Link href="/categories" className="hidden md:flex items-center justify-center w-14 h-14 rounded-full border border-stone-200 hover:border-stone-900 hover:bg-stone-900 text-stone-900 hover:text-white transition-all duration-500 group">
              <i className="ri-arrow-right-line text-xl group-hover:translate-x-1 transition-transform"></i>
            </Link>
          </AnimatedSection>

          <AnimatedGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {categories.map((category) => (
              <Link href={`/shop?category=${category.slug}`} key={category.id} className="group cursor-pointer block relative">
                <div className="aspect-[3/4] rounded-2xl overflow-hidden relative shadow-sm group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-all duration-[800ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-2">
                  <Image
                    src={category.image || category.image_url || 'https://via.placeholder.com/600x800?text=' + encodeURIComponent(category.name)}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:scale-110"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={85}
                    loading="lazy"
                  />
                  {/* Premium Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10 opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>

                  {/* Inner Glass Border */}
                  <div className="absolute inset-0 rounded-2xl border border-white/10 z-10 pointer-events-none transition-colors duration-500 group-hover:border-white/20"></div>

                  {/* Content */}
                  <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end z-20">
                    <div className="overflow-hidden">
                      <h3 className="font-serif font-medium text-white text-2xl md:text-3xl tracking-wide transform translate-y-4 group-hover:translate-y-0 transition-transform duration-700 ease-out">{category.name}</h3>
                    </div>

                    <div className="flex items-center text-white/90 font-medium mt-3 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-4 group-hover:translate-y-0 delay-100">
                      <span className="uppercase tracking-[0.15em] text-xs font-semibold">Explore</span>
                      <div className="ml-4 w-6 h-[1px] bg-white/70 group-hover:w-10 transition-all duration-700 ease-out relative">
                        <i className="ri-arrow-right-s-line absolute -right-2 -top-[11px] text-[22px] text-white/70"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </AnimatedGrid>

          <div className="mt-8 text-center md:hidden">
            <Link href="/categories" className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-stone-200 hover:border-stone-900 hover:bg-stone-900 text-stone-900 hover:text-white transition-all duration-500 group mx-auto">
              <i className="ri-arrow-right-line text-xl group-hover:translate-x-1 transition-transform"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-gray-900 mb-4">Featured Products</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">Top picks from our latest arrivals</p>
          </AnimatedSection>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-8">
              {[...Array(4)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <AnimatedGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
              {featuredProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const pricing = getProductCardPricing(product, salesActive);
                const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
                const effectiveStock = hasVariants ? totalVariantStock : product.quantity;

                // Extract unique colors from option2
                const colorVariants: ColorVariant[] = [];
                const seenColors = new Set<string>();
                for (const v of variants) {
                  const colorName = (v as any).option2;
                  if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                    const hex = getColorHex(colorName);
                    if (hex) {
                      seenColors.add(colorName.toLowerCase().trim());
                      colorVariants.push({ name: colorName.trim(), hex });
                    }
                  }
                }

                const badge =
                  pricing.saleBadge ? 'Sale' : product.featured ? 'Featured' : undefined;

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    price={pricing.price}
                    originalPrice={pricing.originalPrice}
                    image={product.product_images?.[0]?.url || 'https://via.placeholder.com/400x500'}
                    rating={product.rating_avg || 5}
                    reviewCount={product.review_count || 0}
                    badge={badge}
                    inStock={effectiveStock > 0}
                    maxStock={effectiveStock || 50}
                    moq={product.moq || 1}
                    hasVariants={hasVariants}
                    minVariantPrice={pricing.minVariantPrice}
                    colorVariants={colorVariants}
                  />
                );
              })}
            </AnimatedGrid>
          )}

          <div className="text-center mt-16">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-gray-900 text-white px-10 py-4 rounded-full font-medium hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 btn-animate"
            >
              View All Products
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter - Homepage Only */}
      <NewsletterSection />

    </main>
  );
}
