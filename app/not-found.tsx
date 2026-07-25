import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-gradient-to-br from-store-surface via-white to-amber-50">
      <div className="w-24 h-24 bg-store-surface rounded-full flex items-center justify-center mb-8">
        <span className="text-5xl font-bold text-store-ink">404</span>
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
      <p className="text-lg text-gray-600 mb-8 max-w-md">
        Sorry, we couldn't find the page you're looking for. It may have been moved or no longer exists.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="bg-store-navy hover:bg-store-navy-light text-white px-8 py-3 rounded-full font-medium transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/shop"
          className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-full font-medium transition-colors"
        >
          Browse Shop
        </Link>
      </div>
    </div>
  );
}
