'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import CSVGuide from './CSVGuide';
import ProgressTracker, { type ProgressState, type ProductLogEntry } from './ProgressTracker';
import ResultsSummary, { type ImportSummary, type ImportError } from './ResultsSummary';

type Tab = 'zip' | 'csv';

export default function ImportForm() {
  const [tab, setTab] = useState<Tab>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [productLog, setProductLog] = useState<ProductLogEntry[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [warnings, setWarnings] = useState<ImportError[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    (tab === 'zip' && zipFile) || (tab === 'csv' && csvFile);
  const isComplete = summary !== null;

  const resetForm = () => {
    setZipFile(null);
    setCsvFile(null);
    setImageFiles([]);
    setProgress(null);
    setProductLog([]);
    setSummary(null);
    setErrors([]);
    setWarnings([]);
    setStreamError(null);
    setConfirmOpen(false);
    setLoading(false);
    if (csvInputRef.current) csvInputRef.current.value = '';
    if (imagesInputRef.current) imagesInputRef.current.value = '';
  };

  const startImport = async () => {
    if (!canSubmit || loading) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setStreamError('You must be logged in to import.');
      return;
    }

    setLoading(true);
    setProgress({ phase: 'validating', current: 0, total: 1, message: 'Starting...' });
    setProductLog([]);
    setSummary(null);
    setErrors([]);
    setWarnings([]);
    setStreamError(null);

    const formData = new FormData();
    if (tab === 'zip' && zipFile) {
      formData.append('zipFile', zipFile);
    } else {
      if (csvFile) formData.append('csvFile', csvFile);
      imageFiles.forEach((f) => formData.append('images', f));
    }
    formData.append('updateExisting', String(updateExisting));

    try {
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStreamError(err.error || `Import failed (${res.status})`);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setStreamError('No response body');
        setLoading(false);
        return;
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        let event = '';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataStr = line.slice(6);
          else if (line === '' && event && dataStr) {
            try {
              const data = JSON.parse(dataStr);
              if (event === 'progress') {
                setProgress({
                  phase: data.phase ?? 'validating',
                  current: data.current ?? 0,
                  total: data.total ?? 1,
                  message: data.message ?? '',
                });
              } else if (event === 'product') {
                setProductLog((prev) => [
                  ...prev,
                  {
                    row: data.row ?? 0,
                    name: data.name ?? '',
                    status: data.status ?? 'error',
                    error: data.error,
                    skipped: data.skipped,
                  },
                ]);
              } else if (event === 'complete') {
                setSummary(data.summary ?? {});
                setErrors(data.errors ?? []);
                setWarnings(data.warnings ?? []);
                setProgress((p) => (p ? { ...p, phase: 'complete', message: 'Complete' } : null));
              } else if (event === 'error') {
                setStreamError(data.message ?? 'Unknown error');
              }
            } catch (_) {}
            event = '';
            dataStr = '';
          }
        }
      }
    } catch (e: any) {
      setStreamError(e?.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name?.toLowerCase().endsWith('.zip')) setZipFile(file);
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name?.toLowerCase().endsWith('.csv')) setCsvFile(file);
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    setImageFiles(files.filter((f) => allowed.some((ext) => f.name.toLowerCase().endsWith(ext))));
  };

  return (
    <div className="space-y-6">
      <CSVGuide />

      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('zip')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'zip' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            ZIP Upload
          </button>
          <button
            type="button"
            onClick={() => setTab('csv')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'csv' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            CSV + Images Upload
          </button>
        </div>

        <div className="p-6">
          {tab === 'zip' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleZipDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 focus-within:border-blue-500 transition-colors"
            >
              <input
                type="file"
                accept=".zip"
                className="sr-only"
                id="zip-upload"
                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="zip-upload" className="cursor-pointer">
                <i className="ri-upload-cloud-2-line text-4xl text-gray-400 block mb-2" />
                <p className="text-gray-600">Drop your ZIP file here or click to browse</p>
                <p className="text-sm text-gray-500 mt-1">Max 500MB. Include products.csv and images/ folder.</p>
                {zipFile && (
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </label>
            </div>
          )}

          {tab === 'csv' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleCsvDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
              >
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  id="csv-upload"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <p className="text-gray-600">CSV file</p>
                  {csvFile && (
                    <p className="mt-1 text-sm font-medium text-gray-700">{csvFile.name}</p>
                  )}
                </label>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={imagesInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  multiple
                  className="sr-only"
                  id="images-upload"
                  onChange={handleImagesChange}
                />
                <label htmlFor="images-upload" className="cursor-pointer">
                  <p className="text-gray-600">Images (optional, multiple)</p>
                  {imageFiles.length > 0 && (
                    <p className="mt-1 text-sm font-medium text-gray-700">
                      {imageFiles.length} image(s) selected
                    </p>
                  )}
                </label>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="update-existing"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="update-existing" className="text-sm text-gray-700">
              Update existing products if name matches
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <a
              href="/api/admin/products/import-template"
              download="products-import-template.csv"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <i className="ri-download-line" />
              Download sample CSV
            </a>
            {!isComplete && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSubmit || loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Upload & Process'}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <p className="text-gray-700">
              You are about to import products. This action cannot be undone. Continue?
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  startImport();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {streamError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {streamError}
        </div>
      )}

      {(progress || productLog.length > 0) && (
        <div className="border border-gray-200 rounded-xl bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Processing</h3>
          <ProgressTracker progress={progress} productLog={productLog} summary={summary} />
        </div>
      )}

      {isComplete && summary && (
        <ResultsSummary
          summary={summary}
          errors={errors}
          warnings={warnings}
          onImportMore={resetForm}
        />
      )}
    </div>
  );
}
