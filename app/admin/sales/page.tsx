'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { parseStorePricingValue } from '@/lib/pricing';

export default function AdminSalesPage() {
  const [salesActive, setSalesActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await api<{ user: { role: string } | null }>('/api/auth/me');
      setIsAdmin(me.user?.role === 'admin');

      const settingsRes = await api<{ settings: { store_pricing?: unknown } }>(
        '/api/settings?keys=store_pricing'
      );
      setSalesActive(parseStorePricingValue(settingsRes.settings?.store_pricing).sales_active);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (next: boolean) => {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/settings', {
        method: 'PUT',
        json: {
          settings: {
            store_pricing: { sales_active: next },
          },
          category: 'pricing',
        },
      });
      setSalesActive(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        <i className="ri-loader-4-line text-3xl animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sale pricing</h1>
        <p className="text-gray-600 mt-1">
          Turn store-wide sale pricing on or off. When active, eligible products show sale prices on the
          storefront.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Sales mode</p>
            <p className="text-sm text-gray-500">
              {salesActive ? 'Sale prices are visible to customers.' : 'Only regular prices are shown.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin || saving}
            onClick={() => handleToggle(!salesActive)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              salesActive ? 'bg-stone-700' : 'bg-gray-300'
            } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                salesActive ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {!isAdmin && (
          <p className="text-xs text-amber-700 mt-4">Only admins can change this setting.</p>
        )}
      </div>
    </div>
  );
}
