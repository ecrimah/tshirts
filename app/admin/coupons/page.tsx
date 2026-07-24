'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: number | string;
  minimum_purchase: number | string;
  maximum_discount: number | string | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type CouponForm = {
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minimum_purchase: string;
  maximum_discount: string;
  usage_limit: string;
  per_user_limit: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const emptyForm = (): CouponForm => ({
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  minimum_purchase: '0',
  maximum_discount: '',
  usage_limit: '',
  per_user_limit: '1',
  start_date: '',
  end_date: '',
  is_active: true,
});

function num(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0;
  return Number(v);
}

function formatTypeLabel(type: DiscountType): string {
  if (type === 'percentage') return 'Percentage';
  if (type === 'fixed_amount') return 'Fixed Amount';
  return 'Free Shipping';
}

function deriveStatus(c: CouponRow): 'Active' | 'Scheduled' | 'Expired' | 'Disabled' {
  if (!c.is_active) return 'Disabled';
  const now = new Date();
  if (c.end_date && new Date(c.end_date) < now) return 'Expired';
  if (c.start_date && new Date(c.start_date) > now) return 'Scheduled';
  return 'Active';
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function formFromCoupon(c: CouponRow): CouponForm {
  return {
    code: c.code,
    description: c.description || '',
    type: c.type,
    value: String(num(c.value)),
    minimum_purchase: String(num(c.minimum_purchase)),
    maximum_discount: c.maximum_discount != null ? String(num(c.maximum_discount)) : '',
    usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
    per_user_limit: String(c.per_user_limit ?? 1),
    start_date: toDateInput(c.start_date),
    end_date: toDateInput(c.end_date),
    is_active: c.is_active,
  };
}

function payloadFromForm(form: CouponForm) {
  return {
    code: form.code,
    description: form.description || null,
    type: form.type,
    value: Number(form.value) || 0,
    minimum_purchase: Number(form.minimum_purchase) || 0,
    maximum_discount: form.maximum_discount !== '' ? Number(form.maximum_discount) : null,
    usage_limit: form.usage_limit !== '' ? Number(form.usage_limit) : null,
    per_user_limit: Number(form.per_user_limit) || 1,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    is_active: form.is_active,
  };
}

export default function AdminCouponsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CouponForm>(emptyForm());

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<CouponRow[]>('/api/admin/coupons');
      setCoupons(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const statusColors: Record<string, string> = {
    Active: 'bg-stone-100 text-stone-700',
    Scheduled: 'bg-stone-100 text-stone-700',
    Expired: 'bg-gray-100 text-gray-700',
    Disabled: 'bg-red-100 text-red-700',
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingCoupon(null);
    setFormData(emptyForm());
  };

  const openCreate = () => {
    setFormData(emptyForm());
    setEditingCoupon(null);
    setShowAddModal(true);
  };

  const handleEdit = (coupon: CouponRow) => {
    setEditingCoupon(coupon);
    setFormData(formFromCoupon(coupon));
    setShowEditModal(true);
  };

  const handleDelete = async (coupon: CouponRow) => {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' });
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      alert(message);
    }
  };

  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      alert('Coupon code is required');
      return;
    }
    if (formData.type !== 'free_shipping' && (formData.value === '' || Number.isNaN(Number(formData.value)))) {
      alert('Discount value is required');
      return;
    }

    setSaving(true);
    try {
      const payload = payloadFromForm(formData);
      if (formData.type === 'free_shipping') {
        payload.value = 0;
      }

      if (showEditModal && editingCoupon) {
        await api(`/api/admin/coupons/${editingCoupon.id}`, { method: 'PATCH', json: payload });
      } else {
        await api('/api/admin/coupons', { method: 'POST', json: payload });
      }

      closeModal();
      await fetchCoupons();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const activeCoupons = coupons.filter((c) => deriveStatus(c) === 'Active');
  const totalUses = coupons.reduce((sum, c) => sum + (c.usage_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons & Promotions</h1>
          <p className="text-gray-600 mt-1">Create and manage discount codes</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-stone-700 hover:bg-stone-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Coupons</p>
          <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-stone-700">{activeCoupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Uses</p>
          <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Discount</p>
          <p className="text-2xl font-bold text-purple-700">--</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">All Coupons</h2>
            <div className="flex items-center space-x-3">
              <select className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500 font-medium cursor-pointer">
                <option>All Status</option>
                <option>Active</option>
                <option>Scheduled</option>
                <option>Expired</option>
              </select>
              <select className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500 font-medium cursor-pointer">
                <option>Sort by Date</option>
                <option>Sort by Usage</option>
                <option>Sort by Value</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Code</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Value</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Min Purchase</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Usage</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Valid Period</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No coupons found.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
                  const status = deriveStatus(coupon);
                  const typeLabel = formatTypeLabel(coupon.type);
                  const valueNum = num(coupon.value);
                  const minPurchase = num(coupon.minimum_purchase);
                  return (
                    <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(coupon.code)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-stone-700 hover:bg-stone-50 rounded transition-colors cursor-pointer"
                          >
                            <i className="ri-file-copy-line"></i>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{typeLabel}</td>
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        {coupon.type === 'percentage'
                          ? `${valueNum}%`
                          : coupon.type === 'fixed_amount'
                            ? `GH₵ ${valueNum}`
                            : 'Free Shipping'}
                      </td>
                      <td className="py-4 px-4 text-gray-700 whitespace-nowrap">
                        {minPurchase > 0 ? `GH₵ ${minPurchase.toFixed(2)}` : 'No minimum'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-900 font-semibold">{coupon.usage_count ?? 0}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-gray-600">{coupon.usage_limit ?? '∞'}</span>
                        </div>
                        {coupon.usage_limit != null && coupon.usage_limit > 0 && (
                          <div className="w-24 h-2 bg-gray-200 rounded-full mt-2">
                            <div
                              className="h-full bg-stone-600 rounded-full"
                              style={{
                                width: `${Math.min(((coupon.usage_count ?? 0) / coupon.usage_limit) * 100, 100)}%`,
                              }}
                            ></div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-gray-700 whitespace-nowrap">
                          {coupon.start_date ? new Date(coupon.start_date).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500 whitespace-nowrap">
                          {coupon.end_date ? new Date(coupon.end_date).toLocaleDateString() : 'No expiry'}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[status] || 'bg-gray-100'}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(coupon)}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(coupon)}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <i className="ri-delete-bin-line text-lg"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {showAddModal ? 'Create Coupon' : 'Edit Coupon'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500 font-mono"
                    placeholder="SAVE10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as DiscountType })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500 cursor-pointer"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500 resize-none"
                  placeholder="Optional description for internal use"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {formData.type === 'percentage' ? 'Percentage off *' : formData.type === 'fixed_amount' ? 'Amount (GH₵) *' : 'Value'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={formData.type === 'percentage' ? 1 : 0.01}
                    disabled={formData.type === 'free_shipping'}
                    value={formData.type === 'free_shipping' ? '0' : formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Minimum purchase (GH₵)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.minimum_purchase}
                    onChange={(e) => setFormData({ ...formData, minimum_purchase: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
                  />
                </div>
              </div>

              {formData.type === 'percentage' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Maximum discount cap (GH₵)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.maximum_discount}
                    onChange={(e) => setFormData({ ...formData, maximum_discount: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
                    placeholder="Optional"
                  />
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Total usage limit</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Per-user limit</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.per_user_limit}
                    onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Start date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">End date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="coupon-active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-stone-700 border-gray-300 rounded focus:ring-stone-500 cursor-pointer"
                />
                <label htmlFor="coupon-active" className="text-gray-900 font-medium">
                  Active (can be used when within valid dates)
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3 bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className={`px-6 py-3 bg-stone-700 hover:bg-stone-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center ${saving ? 'opacity-70' : ''}`}
              >
                {saving && <i className="ri-loader-4-line animate-spin mr-2"></i>}
                {showAddModal ? 'Create Coupon' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
