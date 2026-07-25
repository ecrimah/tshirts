import Link from 'next/link';
import {
  type HomeCategory,
  categoryImageUrl,
  categoryShopHref,
  pickHomeCategories,
} from '@/lib/home-categories';

function BannerImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`absolute inset-0 h-full w-full object-cover ${className ?? ''}`} />
  );
}

export default function HomeDualPromoBanners({ categories = [] }: { categories?: HomeCategory[] }) {
  const picked = pickHomeCategories(categories, 6);
  const pair = picked.length >= 2 ? [picked[1], picked[2] ?? picked[0]] : picked.slice(0, 2);
  if (pair.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-white border-t border-gray-100">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-4 md:gap-5">
        {pair.map((cat, i) => (
          <Link
            key={cat.id}
            href={categoryShopHref(cat.slug)}
            className="relative min-h-[220px] md:min-h-[260px] overflow-hidden rounded-sm group"
          >
            <BannerImage
              src={categoryImageUrl(cat, i + 4)}
              alt={cat.name}
              className="object-center group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 p-8 flex flex-col justify-center text-white">
              <p className="font-handwriting text-xl text-store-primary">Shop</p>
              <h3 className="text-2xl md:text-3xl font-bold uppercase mt-1">{cat.name}</h3>
              <p className="mt-2 opacity-90 line-clamp-2">
                {cat.description?.trim() || 'Browse products in this category'}
              </p>
              <span className="mt-4 text-sm font-semibold uppercase tracking-wide">Shop Now →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
