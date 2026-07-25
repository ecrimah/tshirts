import Link from 'next/link';
import {
  type HomeCategory,
  categoryImageUrl,
  categoryShopHref,
  pickHomeCategories,
} from '@/lib/home-categories';

function PromoImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const remote = src.startsWith('http://') || src.startsWith('https://');
  if (remote) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`absolute inset-0 h-full w-full object-cover ${className ?? ''}`} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`absolute inset-0 h-full w-full object-cover ${className ?? ''}`} />
  );
}

export default function HomePromoGrid({ categories = [] }: { categories?: HomeCategory[] }) {
  const tiles = pickHomeCategories(categories, 4);
  if (tiles.length === 0) return null;

  const [hero, ...rest] = tiles;
  const small = rest.slice(0, 2);
  const wide = rest[2];

  return (
    <section className="py-10 md:py-14 bg-white">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
          <Link
            href={categoryShopHref(hero.slug)}
            className="lg:col-span-5 relative min-h-[320px] md:min-h-[420px] rounded-sm overflow-hidden group"
          >
            <PromoImage
              src={categoryImageUrl(hero, 0)}
              alt={hero.name}
              className="group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
            <div className="absolute inset-0 p-8 md:p-10 flex flex-col justify-end text-white">
              <p className="text-sm font-medium opacity-90">Collection</p>
              <h3 className="text-3xl md:text-4xl font-bold mt-1">{hero.name}</h3>
              <p className="text-base mt-2 opacity-90 line-clamp-1 max-w-sm">
                {hero.description?.trim() || 'Shop this category'}
              </p>
              <span className="mt-6 inline-flex w-fit bg-white text-store-ink px-6 py-2.5 text-xs font-bold uppercase tracking-wider">
                Shop Now
              </span>
            </div>
          </Link>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {small.map((cat, i) => (
              <Link
                key={cat.id}
                href={categoryShopHref(cat.slug)}
                className="relative min-h-[180px] rounded-sm overflow-hidden group bg-store-surface"
              >
                <PromoImage
                  src={categoryImageUrl(cat, i + 1)}
                  alt={cat.name}
                  className="group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-wide">Category</p>
                  <h4 className="text-lg font-bold">{cat.name}</h4>
                  <span className="text-sm mt-1 inline-block opacity-90 group-hover:underline">Shop Now →</span>
                </div>
              </Link>
            ))}

            {wide ? (
              <Link
                href={categoryShopHref(wide.slug)}
                className="sm:col-span-2 relative min-h-[160px] rounded-sm overflow-hidden group bg-store-navy-light"
              >
                <PromoImage
                  src={categoryImageUrl(wide, 3)}
                  alt={wide.name}
                  className="opacity-90 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 p-6 md:p-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 text-white">
                  <div className="min-w-0">
                    <h4 className="text-xl md:text-2xl font-bold uppercase tracking-wide">
                      {wide.name}
                    </h4>
                    <p className="mt-1 text-sm opacity-90 line-clamp-1 max-w-md">
                      {wide.description?.trim() || 'Explore the collection'}
                    </p>
                  </div>
                  <span className="mt-2 sm:mt-0 shrink-0 text-sm font-semibold uppercase tracking-wide group-hover:underline">
                    Shop Now →
                  </span>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
