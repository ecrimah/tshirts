'use client';

import { useEffect, useState } from 'react';
import HomeHeroSlider from '@/components/home/HomeHeroSlider';
import HomeTrustBar from '@/components/home/HomeTrustBar';
import HomePromoGrid from '@/components/home/HomePromoGrid';
import HomeFeaturedProductsTabs from '@/components/home/HomeFeaturedProductsTabs';
import HomeDualPromoBanners from '@/components/home/HomeDualPromoBanners';
import HomeAutoProductMarquee from '@/components/home/HomeAutoProductMarquee';
import NewsletterSection from '@/components/NewsletterSection';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { HomeCategory } from '@/lib/home-categories';

export default function Home() {
  usePageTitle('');
  const [categories, setCategories] = useState<HomeCategory[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [categoriesRes, featuredRes, catalogRes] = await Promise.all([
          fetch('/api/storefront/categories'),
          fetch('/api/storefront/products?featured=true&limit=20'),
          fetch('/api/storefront/products?limit=24'),
        ]);

        if (categoriesRes.ok) {
          setCategories(await categoriesRes.json());
        }
        if (featuredRes.ok) {
          setFeaturedProducts(await featuredRes.json());
        }
        if (catalogRes.ok) {
          setCatalogProducts(await catalogRes.json());
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <HomeHeroSlider categories={categories} />
      <HomeTrustBar />
      <HomePromoGrid categories={categories} />
      <HomeFeaturedProductsTabs
        featuredProducts={featuredProducts}
        catalogProducts={catalogProducts}
        loading={loading}
      />
      <HomeDualPromoBanners categories={categories} />
      <HomeAutoProductMarquee products={catalogProducts} loading={loading} />
      <NewsletterSection />
    </main>
  );
}
