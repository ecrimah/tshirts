import { TEE_IMAGES } from '@/lib/tee-images';

export type HomeCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  position?: number | null;
  metadata?: Record<string, unknown> | null;
};

const FALLBACK_IMAGES = [
  TEE_IMAGES.heroFlatLay,
  TEE_IMAGES.heroGraphic,
  TEE_IMAGES.heroPolo,
  TEE_IMAGES.heroFlatLay,
] as const;

export function isCategoryFeatured(cat: HomeCategory): boolean {
  const featured = cat.metadata?.featured;
  return featured === true || featured === 'true';
}

export function sortCategoriesForHome(categories: HomeCategory[]): HomeCategory[] {
  const list = Array.isArray(categories) ? categories : [];
  return [...list].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
}

/** Featured categories first (admin “Feature on homepage”), then by position. */
export function pickHomeCategories(categories: HomeCategory[], limit: number): HomeCategory[] {
  const sorted = sortCategoriesForHome(categories);
  const featured = sorted.filter(isCategoryFeatured);
  const rest = sorted.filter((c) => !isCategoryFeatured(c));
  return [...featured, ...rest].slice(0, limit);
}

export function categoryImageUrl(cat: HomeCategory, index: number): string {
  const url = cat.image_url?.trim();
  if (url) return url;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

export function categoryShopHref(slug: string): string {
  return `/shop?category=${encodeURIComponent(slug)}`;
}
