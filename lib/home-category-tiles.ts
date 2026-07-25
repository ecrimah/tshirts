export type HomeCategoryTile = {
  name: string;
  slug: string;
  /** Index 0–3 in public/categories/shop-by-category-strip.png */
  stripIndex: number;
};

export const HOME_CATEGORY_TILES: HomeCategoryTile[] = [
  { name: 'Graphic T-Shirts', slug: 'graphic-t-shirts', stripIndex: 0 },
  { name: 'Plain & Basic T-Shirts', slug: 'plain-basic-t-shirts', stripIndex: 1 },
  { name: 'Polo T-Shirts', slug: 'polo-t-shirts', stripIndex: 2 },
  { name: 'Sports & Performance T-Shirts', slug: 'sports-performance-t-shirts', stripIndex: 3 },
];
