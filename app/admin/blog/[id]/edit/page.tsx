import BlogPostForm from '@/components/admin/BlogPostForm';

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogPostForm postId={id} />;
}
