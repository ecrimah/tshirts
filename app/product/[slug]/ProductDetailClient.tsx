'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { asNumber, money } from '@/lib/format-money';
import {
  colorNameToHex,
  findVariant,
  normalizeStorefrontVariants,
  type StorefrontVariant,
  variantSizesForColor,
  variantStock,
} from '@/lib/product-variants';

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch main product (cached for 2 minutes)
        const { data: productData, error } = await cachedQuery<{ data: any; error: any }>(
          `product:${slug}`,
          async () => {
            const res = await fetch(`/api/storefront/products/${encodeURIComponent(slug)}`);
            if (!res.ok) {
              return { data: null, error: new Error('Not found') };
            }
            const data = await res.json();
            return { data, error: null };
          },
          2 * 60 * 1000
        );

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        const { variants, colors, colorHexMap } = normalizeStorefrontVariants(
          productData.product_variants || [],
          productData.price
        );

        const transformedProduct = {
          ...productData,
          price: asNumber(productData.price),
          compare_at_price: productData.compare_at_price != null ? asNumber(productData.compare_at_price) : null,
          images: productData.product_images?.sort((a: any, b: any) => a.position - b.position).map((img: any) => img.url) || [],
          category: productData.categories?.name || 'Shop',
          rating: asNumber(productData.rating_avg),
          reviewCount: productData.review_count || 0,
          stockCount: asNumber(productData.quantity),
          moq: productData.moq || 1,
          colors,
          colorHexMap,
          variants,
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: productData.metadata?.preorder_shipping || null
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

        setProduct(transformedProduct);
        setSelectedColor('');
        setSelectedSize('');

        // Auto-select when there is only one purchasable variant
        if (variants.length === 1) {
          setSelectedColor(variants[0].color);
          setSelectedSize(variants[0].name);
        }

        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // Fetch related products (cached for 5 minutes)
        if (productData.category_id) {
          const relatedList = await cachedQuery<any[]>(
            `related:${productData.category_id}:${productData.id}`,
            async () => {
              const res = await fetch(
                `/api/storefront/products?limit=20&category=${encodeURIComponent(productData.categories?.slug || '')}`
              );
              if (!res.ok) return [];
              const all = await res.json();
              return (all as any[])
                .filter((p) => p.id !== productData.id)
                .slice(0, 4);
            },
            5 * 60 * 1000
          );

          if (relatedList) {
            setRelatedProducts(
              relatedList.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
              const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800?text=No+Image',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: effectiveStock > 0,
                maxStock: effectiveStock || 50,
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const hasColors = (product?.colors?.length ?? 0) > 0;

  const resolvedVariant: StorefrontVariant | null = useMemo(() => {
    if (!product?.variants?.length) return null;
    if (product.variants.length === 1) return product.variants[0];
    if (hasColors && !selectedColor) return null;
    return findVariant(product.variants, selectedColor, selectedSize);
  }, [product, hasColors, selectedColor, selectedSize]);

  const sizeOptions = useMemo(() => {
    if (!product?.variants?.length) return [] as string[];
    if (hasColors && !selectedColor) return [] as string[];
    return variantSizesForColor(product.variants, selectedColor);
  }, [product, hasColors, selectedColor]);

  const needsColorSelection = hasColors && product!.variants.length > 1 && !selectedColor;
  const needsSizeSelection = hasVariants && product!.variants.length > 1 && sizeOptions.length > 0 && !selectedSize;
  const needsVariantSelection = hasVariants && product!.variants.length > 1 && !resolvedVariant;

  const activePrice = resolvedVariant?.price ?? product?.price ?? 0;
  const activeStock = variantStock(resolvedVariant, product?.stockCount);

  const handleAddToCart = () => {
    if (!product) return;
    if (needsVariantSelection || needsColorSelection || needsSizeSelection) return;

    let variantLabel: string | undefined;
    if (resolvedVariant) {
      const color = resolvedVariant.color || selectedColor || '';
      const name = resolvedVariant.name || '';
      variantLabel = color && name ? `${color} / ${name}` : color || name || undefined;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: activePrice,
      image: product.images[0],
      quantity: quantity,
      variant: variantLabel,
      slug: product.slug,
      maxStock: activeStock,
      moq: product.moq || 1
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12 flex justify-center items-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-store-primary animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
          <Link href="/shop" className="text-store-primary hover:underline">Return to Shop</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price ? Math.round((1 - activePrice / product.compare_at_price) * 100) : 0;
  const minVariantPrice = hasVariants
    ? Math.min(...product.variants.map((v: StorefrontVariant) => v.price))
    : product.price;

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: hasVariants ? minVariantPrice : product.price,
    currency: 'GHS',
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mamator.com').replace(/\/+$/, '');
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: siteUrl },
    { name: 'Shop', url: `${siteUrl}/shop` },
    { name: product.category, url: `${siteUrl}/shop?category=${product.category.toLowerCase().replace(/\s+/g, '-')}` },
    { name: product.name, url: `${siteUrl}/product/${slug}` }
  ]);

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="min-h-screen bg-white">
        <section className="py-8 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-2 text-sm flex-wrap gap-y-2">
              <Link href="/" className="text-gray-600 hover:text-store-primary transition-colors">Home</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="/shop" className="text-gray-600 hover:text-store-primary transition-colors">Shop</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="#" className="text-gray-600 hover:text-store-primary transition-colors">{product.category}</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 shadow-lg border border-gray-100">
                  <Image
                    src={product.images[selectedImage]}
                    alt={product.name}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                    quality={80}
                  />
                  {discount > 0 && (
                    <span className="absolute top-6 right-6 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-full">
                      Save {discount}%
                    </span>
                  )}
                </div>

                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {product.images.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage === index ? 'border-store-navy shadow-md' : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <Image
                          src={image}
                          alt={`${product.name} view ${index + 1}`}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 1024px) 25vw, 12vw"
                          quality={60}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-store-primary font-semibold mb-2">{product.category}</p>
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{product.name}</h1>
                  </div>
                  <button
                    onClick={() => setIsWishlisted(!isWishlisted)}
                    className="w-12 h-12 flex items-center justify-center border-2 border-gray-200 hover:border-store-navy rounded-full transition-colors cursor-pointer"
                  >
                    <i className={`${isWishlisted ? 'ri-heart-fill text-red-600' : 'ri-heart-line text-gray-700'} text-xl`}></i>
                  </button>
                </div>

                <div className="flex items-center mb-6">
                  <div className="flex items-center space-x-1 mr-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`${star <= Math.round(product.rating) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-300'} text-lg`}
                      ></i>
                    ))}
                  </div>
                  <span className="text-gray-700 font-medium">{Number(product.rating).toFixed(1)}</span>
                </div>

                <div className="flex items-baseline space-x-4 mb-6">
                  {hasVariants && !resolvedVariant ? (
                    <span className="text-3xl lg:text-4xl font-bold text-gray-900">
                      From GH₵{money(minVariantPrice)}
                    </span>
                  ) : (
                    <span className="text-3xl lg:text-4xl font-bold text-gray-900">GH₵{money(activePrice)}</span>
                  )}
                  {product.compare_at_price && product.compare_at_price > activePrice && (
                    <span className="text-xl text-gray-400 line-through">GH₵{money(product.compare_at_price)}</span>
                  )}
                </div>

                <p className="text-gray-700 leading-relaxed mb-8 text-lg">{product.description}</p>

                {/* Color selector */}
                {hasVariants && hasColors && (
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-900 mb-3">
                      Color:{' '}
                      {selectedColor ? (
                        <span className="text-store-primary font-normal">{selectedColor}</span>
                      ) : (
                        <span className="text-red-500 font-normal text-sm">Please select a color</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {product.colors.map((color: string) => {
                        const isSelected = selectedColor === color;
                        const colorVariants = product.variants.filter((v: StorefrontVariant) => v.color === color);
                        const colorStock = colorVariants.reduce((sum: number, v: StorefrontVariant) => sum + v.quantity, 0);
                        const isOutOfStock = colorStock <= 0 && activeStock <= 0;
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setSelectedColor(color);
                              const matching = product.variants.filter((v: StorefrontVariant) => v.color === color);
                              if (matching.length === 1) {
                                setSelectedSize(matching[0].name);
                              } else {
                                setSelectedSize('');
                              }
                            }}
                            disabled={isOutOfStock}
                            className={`px-5 py-2.5 rounded-full border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'border-store-navy bg-store-surface text-store-primary shadow-sm'
                                : isOutOfStock
                                  ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                  : 'border-gray-300 text-gray-700 hover:border-store-primary'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: product.colorHexMap?.[color] || colorNameToHex(color) }}
                            />
                            <span>{color}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size / type selector */}
                {hasVariants && sizeOptions.length > 0 && (
                  <div className="mb-8">
                    <label className="block font-semibold text-gray-900 mb-3">
                      {hasColors ? 'Size' : 'Variant'}:{' '}
                      {resolvedVariant ? (
                        <span className="text-store-primary font-normal">
                          {resolvedVariant.name} — GH₵{money(resolvedVariant.price)}
                        </span>
                      ) : (
                        <span className="text-red-500 font-normal text-sm">Please select</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {sizeOptions.map((size) => {
                        const variant = findVariant(product.variants, selectedColor, size);
                        const isSelected = selectedSize === size;
                        const variantQty = variant?.quantity ?? 0;
                        const isOutOfStock = variantQty <= 0 && asNumber(product.stockCount) <= 0;
                        return (
                          <button
                            key={`${selectedColor}-${size}`}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                            disabled={isOutOfStock}
                            className={`px-6 py-3 rounded-lg border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center min-w-[4.5rem] ${
                              isSelected
                                ? 'border-store-navy bg-store-surface text-store-primary shadow-sm'
                                : isOutOfStock
                                  ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                  : 'border-gray-300 text-gray-700 hover:border-store-primary'
                            }`}
                          >
                            <span>{size}</span>
                            {variant && (
                              <span className={`text-xs mt-0.5 ${isSelected ? 'text-store-primary' : 'text-gray-500'}`}>
                                GH₵{money(variant.price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <label className="block font-semibold text-gray-900 mb-3">Quantity</label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center border-2 border-gray-300 rounded-lg">
                      <button
                        onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        disabled={activeStock === 0 || quantity <= (product.moq || 1)}
                      >
                        <i className="ri-subtract-line text-xl"></i>
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(product.moq || 1, Math.min(activeStock, parseInt(e.target.value) || (product.moq || 1))))}
                        className="w-16 h-12 text-center border-x-2 border-gray-300 focus:outline-none text-lg font-semibold"
                        min={product.moq || 1}
                        max={activeStock}
                        disabled={activeStock === 0}
                      />
                      <button
                        onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        disabled={activeStock === 0}
                      >
                        <i className="ri-add-line text-xl"></i>
                      </button>
                    </div>
                    <div className="flex flex-col">
                      {product.moq > 1 && (
                        <span className="text-store-primary font-medium text-sm">
                          <i className="ri-information-line mr-1"></i>
                          Min. order: {product.moq} units
                        </span>
                      )}
                      {activeStock > 10 && (
                        <span className="text-gray-600 font-medium text-sm">
                          <i className="ri-checkbox-circle-line mr-1 text-store-primary"></i>
                          {activeStock} in stock
                        </span>
                      )}
                      {activeStock > 0 && activeStock <= 10 && (
                        <span className="text-amber-600 font-medium text-sm">
                          <i className="ri-error-warning-line mr-1"></i>
                          Only {activeStock} left in stock
                        </span>
                      )}
                      {activeStock === 0 && (
                        <span className="text-red-600 font-medium">
                          <i className="ri-close-circle-line mr-1"></i>
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <button
                    disabled={activeStock === 0 || needsVariantSelection || needsColorSelection || needsSizeSelection}
                    className={`flex-1 bg-store-navy hover:bg-store-navy-light text-white py-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-lg whitespace-nowrap cursor-pointer ${(activeStock === 0 || needsVariantSelection || needsColorSelection || needsSizeSelection) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleAddToCart}
                  >
                    <i className="ri-shopping-cart-line text-xl"></i>
                    <span>
                      {activeStock === 0
                        ? 'Out of Stock'
                        : needsColorSelection
                          ? 'Select a Color'
                          : needsSizeSelection
                            ? 'Select a Size'
                            : needsVariantSelection
                              ? 'Select a Variant'
                              : 'Add to Cart'}
                    </span>
                  </button>
                  {activeStock > 0 && !needsVariantSelection && !needsColorSelection && !needsSizeSelection && (
                    <button
                      onClick={handleBuyNow}
                      className="sm:w-auto bg-store-navy hover:bg-store-navy text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Buy Now
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div className="flex items-center text-gray-700">
                    <i className="ri-store-2-line text-xl text-store-primary mr-3"></i>
                    <span>Free store pickup available</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-arrow-left-right-line text-xl text-store-primary mr-3"></i>
                    <span>30-day easy returns and exchanges</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-shield-check-line text-xl text-store-primary mr-3"></i>
                    <span>Secure payment & buyer protection</span>
                  </div>
                  {product.sku && (
                    <div className="flex items-center text-gray-700">
                      <i className="ri-barcode-line text-xl text-store-primary mr-3"></i>
                      <span>SKU: {product.sku}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="border-b border-gray-300 mb-8">
              <div className="flex space-x-4 sm:space-x-8 overflow-x-auto">
                {['description', 'features', 'care', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 font-semibold transition-colors relative whitespace-nowrap cursor-pointer ${activeTab === tab
                      ? 'text-store-primary border-b-2 border-store-navy'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h3>
                <ul className="grid md:grid-cols-2 gap-4">
                  {product.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <i className="ri-checkbox-circle-fill text-store-primary text-xl mr-3 mt-1"></i>
                      <span className="text-gray-700 text-lg">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'care' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Care Instructions</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{product.care}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div id="reviews">
                <ProductReviews productId={product.id} />
              </div>
            )}
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="py-20 bg-white" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">You May Also Like</h2>
                <p className="text-lg text-gray-600">Curated recommendations based on this product</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} {...p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
