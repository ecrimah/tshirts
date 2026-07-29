import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { listCategories } from '@/lib/data/products';

/** Runtime-only: build containers often lack DATABASE_URL. */
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  let categoriesData: Array<{
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
  }> = [];

  try {
    categoriesData = (await listCategories(true)) as typeof categoriesData;
  } catch (err) {
    console.error('[categories] Failed to load categories:', err);
  }

  const palette = [
    { color: 'from-store-navy-light to-store-navy', icon: 'ri-store-2-line' },
    { color: 'from-store-navy-light to-store-navy', icon: 'ri-shopping-bag-3-line' },
    { color: 'from-store-muted to-store-navy', icon: 'ri-t-shirt-line' },
    { color: 'from-store-primary to-store-navy-light', icon: 'ri-home-smile-line' },
    { color: 'from-store-muted to-store-navy', icon: 'ri-heart-line' },
    { color: 'from-store-primary to-store-navy', icon: 'ri-star-smile-line' },
  ];

  const categories = categoriesData?.map((c, i) => {
    const style = palette[i % palette.length];
    return {
      ...c,
      image: c.image_url || 'https://via.placeholder.com/600x400?text=Category',
      color: style.color,
      icon: style.icon,
      productCount: 'Browse',
    };
  }) || [];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Shop by Category"
        subtitle="Graphic tees, plain basics, polos & performance shirts — shop by category."
        backgroundImage="/hero-fashion-bg.jpg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {categories.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/shop?category=${category.slug}`}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-2xl transition-all cursor-pointer"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${category.color} opacity-0 group-hover:opacity-20 transition-opacity`}></div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${category.color} rounded-full flex items-center justify-center`}>
                      <i className={`${category.icon} text-2xl text-white`}></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-500">Collection</p>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-sm mb-4 line-clamp-2">
                    {category.description || 'Explore our exclusive collection in this category.'}
                  </p>
                  <div className="flex items-center text-store-ink font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Browse Collection</span>
                    <i className="ri-arrow-right-line ml-2"></i>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-xl">
            <i className="ri-inbox-line text-5xl text-gray-300 mb-4"></i>
            <p className="text-xl text-gray-500">No categories found.</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-store-navy to-store-navy-light py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Can't Find What You're Looking For?</h2>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Try our advanced search or contact our team for personalised product recommendations
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-white text-store-ink px-8 py-4 rounded-full font-medium hover:bg-store-surface transition-colors whitespace-nowrap"
            >
              <i className="ri-search-line"></i>
              Search All Products
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-store-navy-light text-white px-8 py-4 rounded-full font-medium hover:bg-store-surface0 transition-colors whitespace-nowrap"
            >
              <i className="ri-customer-service-line"></i>
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
