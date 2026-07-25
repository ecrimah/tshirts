'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { slugifyProduct } from '@/lib/product-seo';

type BlogStatus = 'draft' | 'published' | 'archived';

type BlogPostFormProps = {
  postId?: string;
};

export default function BlogPostForm({ postId }: BlogPostFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(postId);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<BlogStatus>('draft');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  useEffect(() => {
    if (!postId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/blog/${postId}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load post');
        setTitle(data.title || '');
        setSlug(data.slug || '');
        setSlugTouched(true);
        setExcerpt(data.excerpt || '');
        setContent(data.content || '');
        setFeaturedImage(data.featured_image || '');
        setTagsInput(Array.isArray(data.tags) ? data.tags.join(', ') : '');
        setStatus((data.status as BlogStatus) || 'draft');
        setSeoTitle(data.seo_title || '');
        setSeoDescription(data.seo_description || '');
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to load post');
        router.push('/admin/blog');
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, router]);

  useEffect(() => {
    if (!slugTouched && title) setSlug(slugifyProduct(title));
  }, [title, slugTouched]);

  const parseTags = (value: string) =>
    value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const normalizeContent = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
    return trimmed
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, '<br />')}</p>`)
      .join('\n');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files?.length) return;
      setUploading(true);
      const file = e.target.files[0];
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'blog');
      const uploaded = await fetch('/api/uploads', {
        method: 'POST',
        body: form,
        credentials: 'include',
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Upload failed'))));
      setFeaturedImage(uploaded.url);
    } catch (err: unknown) {
      alert('Error uploading image: ' + (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (nextStatus?: BlogStatus) => {
    const resolvedStatus = nextStatus || status;
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    if (!content.trim()) {
      alert('Content is required');
      return;
    }
    const finalSlug = (slug || slugifyProduct(title)).trim();
    if (!finalSlug) {
      alert('Slug is required');
      return;
    }

    try {
      setSaving(true);
      const tags = parseTags(tagsInput);
      const payload = {
        title: title.trim(),
        slug: finalSlug,
        excerpt: excerpt.trim() || null,
        content: normalizeContent(content),
        featured_image: featuredImage.trim() || null,
        status: resolvedStatus,
        tags,
        seo_title: seoTitle.trim() || title.trim().slice(0, 60),
        seo_description: seoDescription.trim() || excerpt.trim().slice(0, 160) || null,
      };

      const res = await fetch(isEditMode ? `/api/admin/blog/${postId}` : '/api/admin/blog', {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save post');

      router.push('/admin/blog');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading post…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/blog"
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            aria-label="Back to blog posts"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit Post' : 'New Post'}
            </h1>
            <p className="text-gray-600 mt-1">Write and publish blog content for the storefront</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugifyProduct(e.target.value));
            }}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">URL: /blog/{slug || 'your-slug'}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none font-mono text-sm"
            placeholder="Write your post… Plain text or HTML."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Featured image</label>
          {featuredImage ? (
            <div className="mb-3 relative w-full max-w-xl aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
              <img src={featuredImage} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setFeaturedImage('')}
                className="absolute top-3 right-3 bg-white/90 hover:bg-white text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-3">
            <label
              className={`inline-flex items-center justify-center px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-700 hover:border-blue-700 hover:text-blue-700 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <i className="ri-upload-2-line mr-2"></i>
              {uploading ? 'Uploading…' : 'Upload image'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
            <input
              type="url"
              value={featuredImage}
              onChange={(e) => setFeaturedImage(e.target.value)}
              className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none text-sm"
              placeholder="Or paste image URL"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none"
              placeholder="Tips, News"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BlogStatus)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none bg-white"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">SEO</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">SEO title</label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none"
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">SEO description</label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={3}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-700 focus:outline-none"
              maxLength={160}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit('draft')}
            className="px-5 py-3 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit('published')}
            className="px-5 py-3 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
