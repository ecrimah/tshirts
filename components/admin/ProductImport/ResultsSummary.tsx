'use client';

import Link from 'next/link';

export interface ImportSummary {
  totalRows: number;
  productsCreated: number;
  variantsCreated: number;
  imagesUploaded: number;
  errors: number;
  warnings: number;
  skipped: number;
  duration: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ResultsSummaryProps {
  summary: ImportSummary;
  errors: ImportError[];
  warnings: ImportError[];
  onImportMore: () => void;
}

export default function ResultsSummary({ summary, errors, warnings, onImportMore }: ResultsSummaryProps) {
  const errorCsv =
    errors.length > 0
      ? 'Row,Field,Message\n' +
        errors.map((e) => `${e.row},${e.field},${(e.message ?? '').replace(/"/g, '""')}`).join('\n')
      : '';

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Import complete</h3>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-green-700">{summary.productsCreated}</p>
            <p className="text-sm text-green-600">Products created</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-700">{summary.imagesUploaded}</p>
            <p className="text-sm text-blue-600">Images uploaded</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-indigo-700">{summary.variantsCreated}</p>
            <p className="text-sm text-indigo-600">Variants created</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-red-700">{summary.errors}</p>
            <p className="text-sm text-red-600">Errors</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-700">{summary.warnings}</p>
            <p className="text-sm text-amber-600">Warnings</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-gray-700">{summary.skipped}</p>
            <p className="text-sm text-gray-600">Skipped</p>
          </div>
        </div>

        {errors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Errors</h4>
              {errorCsv && (
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(errorCsv)}`}
                  download="import-errors.csv"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Download error report
                </a>
              )}
            </div>
            <ul className="max-h-40 overflow-y-auto text-sm text-red-700 space-y-1 border border-red-100 rounded-lg p-3 bg-red-50">
              {errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.field} — {e.message}
                </li>
              ))}
              {errors.length > 20 && (
                <li className="text-gray-500">… and {errors.length - 20} more (see download)</li>
              )}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Warnings</h4>
            <ul className="max-h-32 overflow-y-auto text-sm text-amber-700 space-y-1 border border-amber-100 rounded-lg p-3 bg-amber-50">
              {warnings.slice(0, 10).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.field} — {e.message}
                </li>
              ))}
              {warnings.length > 10 && (
                <li className="text-gray-500">… and {warnings.length - 10} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="ri-list-check-2" />
            View Products
          </Link>
          <button
            type="button"
            onClick={onImportMore}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="ri-upload-2-line" />
            Import More
          </button>
        </div>
      </div>
    </div>
  );
}
