'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  tags: string[] | null;
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/storefront/blog');
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-serif text-stone-900 mb-3">Blog</h1>
        <p className="text-stone-600">Tips, updates, and stories from Mamator.</p>
      </div>

      {loading ? (
        <div className="text-stone-500">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-stone-500">No published posts yet. Check back soon.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl overflow-hidden border border-stone-200 bg-white hover:shadow-lg transition-shadow"
            >
              <div className="aspect-[16/10] bg-stone-100 overflow-hidden">
                {post.featured_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.featured_image}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <i className="ri-article-line text-4xl"></i>
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString()
                    : Array.isArray(post.tags) && post.tags[0]
                      ? post.tags[0]
                      : 'Article'}
                </p>
                <h2 className="text-xl font-semibold text-stone-900 group-hover:text-stone-700 mb-2">
                  {post.title}
                </h2>
                {post.excerpt ? (
                  <p className="text-stone-600 text-sm line-clamp-3">{post.excerpt}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
