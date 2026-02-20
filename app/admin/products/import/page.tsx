'use client';

import Link from 'next/link';
import ImportForm from '@/components/admin/ProductImport/ImportForm';

export default function ImportProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-gray-700">
          Admin
        </Link>
        <span>/</span>
        <Link href="/admin/products" className="hover:text-gray-700">
          Products
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Import</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Products</h1>
        <p className="mt-1 text-gray-600">
          Bulk import products from a CSV file and images (ZIP or separate upload).
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
