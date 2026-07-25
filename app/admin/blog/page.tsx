'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  excerpt: string | null;
  featured_image: string | null;
};

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/blog', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) load();
    else alert('Delete failed');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
          <p className="text-gray-600 mt-1">Create and publish storefront articles</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-store-navy text-white rounded-lg font-semibold hover:bg-store-navy"
        >
          <i className="ri-add-line"></i> New Post
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No posts yet.{' '}
            <Link href="/admin/blog/new" className="text-store-primary font-medium">
              Create one
            </Link>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-500">/blog/{post.slug}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-sm">{post.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="text-store-primary font-medium text-sm hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(post.id)}
                      className="text-red-600 font-medium text-sm hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
