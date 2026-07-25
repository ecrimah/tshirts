'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { sanitizeHtml } from '@/lib/sanitize';
import { usePageTitle } from '@/hooks/usePageTitle';

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  published_at: string | null;
  seo_title: string | null;
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = String(params?.id || '');
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageTitle(post?.seo_title || post?.title || '');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/storefront/blog/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Not found');
        setPost(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Not found');
        setPost(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-store-muted">Loading…</div>;
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-store-ink mb-3">Post not found</h1>
        <Link href="/blog" className="text-store-primary font-medium hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-sm text-store-muted hover:text-store-ink inline-flex items-center gap-1 mb-6">
        <i className="ri-arrow-left-line"></i> Blog
      </Link>
      <h1 className="text-4xl font-serif text-store-ink mb-4">{post.title}</h1>
      {post.published_at ? (
        <p className="text-sm text-store-muted mb-8">
          {new Date(post.published_at).toLocaleDateString()}
        </p>
      ) : null}
      {post.featured_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.featured_image}
          alt=""
          className="w-full rounded-2xl mb-8 aspect-[16/9] object-cover bg-store-surface"
        />
      ) : null}
      <div
        className="prose prose-stone max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content || '') }}
      />
    </article>
  );
}
