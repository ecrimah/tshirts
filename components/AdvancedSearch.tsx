'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useStorePricing } from '@/context/StorePricingContext';
import { resolveProductPrice } from '@/lib/pricing';
import { useDebouncedValue } from '@/components/useDebouncedValue';
import type { StorefrontSearchHit } from '@/lib/storefront-search-types';

export default function AdvancedSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 280);
  const [suggestions, setSuggestions] = useState<StorefrontSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { salesActive } = useStorePricing();

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/storefront/search?q=${encodeURIComponent(q)}&limit=8`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StorefrontSearchHit[]) => {
        if (!ac.signal.aborted) setSuggestions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!ac.signal.aborted) setSuggestions([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [debounced]);

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const handleVoiceSearch = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.onstart = () => {
        setIsVoiceActive(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsVoiceActive(false);
      };

      recognition.onerror = () => {
        setIsVoiceActive(false);
      };

      recognition.onend = () => {
        setIsVoiceActive(false);
      };

      recognition.start();
    }
  };

  const showEmpty =
    query.trim() && debounced.trim() && !loading && suggestions.length === 0;

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl mx-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch(query);
              setIsOpen(false);
            }
          }}
          placeholder="Search products — suggestions appear as you type"
          autoComplete="off"
          className="w-full pl-12 pr-24 py-3 border-2 border-gray-300 rounded-full focus:border-store-navy focus:ring-2 focus:ring-store-primary/20 text-sm"
        />
        <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-400"></i>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
          <button
            type="button"
            onClick={handleVoiceSearch}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              isVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <i className="ri-mic-line"></i>
          </button>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
              }}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-600"
            >
              <i className="ri-close-line"></i>
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto z-50">
          {query.trim() && loading && (
            <div className="p-4 flex items-center justify-center gap-2 text-gray-500 text-sm">
              <i className="ri-loader-4-line animate-spin" />
              Searching…
            </div>
          )}

          {query.trim() && !loading && suggestions.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-500 px-3 py-2">Products</p>
              {suggestions.map((product) => {
                const { effective, originalDisplay } = resolveProductPrice({
                  salesActive,
                  price: Number(product.price) || 0,
                  salePrice: product.sale_price,
                  compareAtPrice: product.compare_at_price,
                });
                const img = product.image || '/logo.png';
                return (
                  <Link
                    key={product.id}
                    href={`/product/${encodeURIComponent(product.slug)}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <img src={img} alt="" className="w-12 h-12 object-cover object-center rounded-lg bg-gray-100" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</p>
                      {product.categoryName && (
                        <p className="text-xs text-gray-500 truncate">{product.categoryName}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">GH₵{effective.toFixed(2)}</p>
                      {originalDisplay != null && originalDisplay > effective && (
                        <p className="text-xs text-gray-400 line-through">GH₵{originalDisplay.toFixed(2)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {showEmpty && (
            <div className="p-8 text-center">
              <i className="ri-search-line text-4xl text-gray-300 mb-2"></i>
              <p className="text-gray-500 font-medium">No products found</p>
              <p className="text-sm text-gray-400 mt-1">Try another letter or press Enter to search the shop</p>
            </div>
          )}

          {!query.trim() && recentSearches.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-semibold text-gray-500">Recent Searches</p>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-xs text-store-ink hover:text-store-ink font-medium whitespace-nowrap"
                >
                  Clear All
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => {
                    setQuery(search);
                    handleSearch(search);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <i className="ri-history-line text-gray-400"></i>
                  <span className="flex-1 text-gray-700">{search}</span>
                  <i className="ri-arrow-right-up-line text-gray-400"></i>
                </button>
              ))}
            </div>
          )}

          {!query.trim() && recentSearches.length === 0 && (
            <div className="p-6">
              <p className="text-xs font-semibold text-gray-500 mb-3">Popular Searches</p>
              <div className="flex flex-wrap gap-2">
                {['Wig', 'Glue', 'Shampoo', 'Nail', 'Kuura'].map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      handleSearch(tag);
                      setIsOpen(false);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors whitespace-nowrap"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
