'use client';

import { useEffect, useRef } from 'react';

export type Phase = 'extracting' | 'validating' | 'uploading_images' | 'creating_products' | 'complete';

export interface ProgressState {
  phase: Phase;
  current: number;
  total: number;
  message: string;
}

export interface ProductLogEntry {
  row: number;
  name: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  skipped?: boolean;
}

const phaseLabels: Record<Phase, string> = {
  extracting: 'Extracting files...',
  validating: 'Validating CSV...',
  uploading_images: 'Uploading images...',
  creating_products: 'Creating products...',
  complete: 'Complete',
};

interface ProgressTrackerProps {
  progress: ProgressState | null;
  productLog: ProductLogEntry[];
  summary: {
    totalRows: number;
    productsCreated: number;
    variantsCreated: number;
    imagesUploaded: number;
    errors: number;
    warnings: number;
    skipped: number;
    duration: string;
  } | null;
}

export default function ProgressTracker({ progress, productLog, summary }: ProgressTrackerProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [productLog]);

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : progress?.phase === 'validating'
        ? 10
        : 0;

  return (
    <div className="space-y-4">
      {progress && (
        <>
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{phaseLabels[progress.phase] ?? progress.message}</span>
              {progress.total > 0 && (
                <span>
                  {progress.current} / {progress.total}
                </span>
              )}
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg bg-white max-h-64 overflow-y-auto">
            <div className="p-2 space-y-1 text-sm">
              {productLog.map((entry, i) => (
                <div
                  key={`${entry.row}-${i}`}
                  className="flex items-center gap-2 py-1 px-2 rounded"
                >
                  <span className="text-gray-500 shrink-0">Row {entry.row}</span>
                  <span className="truncate flex-1">{entry.name || '—'}</span>
                  {entry.status === 'success' && (
                    <span className="text-green-600 shrink-0" title="Success">✓</span>
                  )}
                  {entry.status === 'error' && (
                    <span className="text-red-600 shrink-0" title={entry.error}>✗</span>
                  )}
                  {entry.status === 'skipped' && (
                    <span className="text-amber-600 shrink-0" title="Skipped">⚠</span>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {summary && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>{summary.productsCreated} products created</span>
              <span>{summary.variantsCreated} variants</span>
              <span>{summary.imagesUploaded} images uploaded</span>
              {summary.errors > 0 && <span className="text-red-600">{summary.errors} errors</span>}
              {summary.warnings > 0 && (
                <span className="text-amber-600">{summary.warnings} warnings</span>
              )}
              {summary.skipped > 0 && <span className="text-amber-600">{summary.skipped} skipped</span>}
              <span>Duration: {summary.duration}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
