'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Candidate = {
  id: string;
  order_number: string;
  email: string;
  total: number;
  payment_status: string;
  status: string;
  created_at: string;
  age_minutes: number;
  amount_paid: number;
  expected_charge: number;
  balance_due: number;
  external_ref: string | null;
  issue: string;
  issue_label: string;
};

type CheckResult = Candidate & {
  gateway: { verified: boolean; amount?: number; status?: string };
  proposed_action: 'none' | 'apply_payment' | 'manual_review';
  proposed_label: string;
  safe_to_apply: boolean;
};

type LogRow = {
  id: string;
  order_number: string;
  action: string;
  result: string;
  admin_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

function money(n: number) {
  return `GH₵ ${Number(n || 0).toFixed(2)}`;
}

export default function PaymentReconcilePage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [olderThanMinutes, setOlderThanMinutes] = useState(15);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<{
        candidates: Candidate[];
        logs: LogRow[];
      }>(`/api/admin/payments/reconcile?olderThanMinutes=${olderThanMinutes}&limit=50`);
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [olderThanMinutes]);

  useEffect(() => {
    load();
  }, [load]);

  const runCheck = async (orderNumber: string) => {
    setBusyOrder(orderNumber);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ success: boolean; check: CheckResult }>('/api/admin/payments/reconcile', {
        method: 'POST',
        json: { action: 'check', orderNumber },
      });
      setChecks((prev) => ({ ...prev, [orderNumber]: res.check }));
      setMessage(`Checked ${orderNumber}: ${res.check.proposed_label}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusyOrder(null);
    }
  };

  const runApply = async (orderNumber: string) => {
    const check = checks[orderNumber];
    if (!check?.safe_to_apply) {
      setError('Run Verify with Moolre first. Apply is only allowed for safe matches.');
      return;
    }
    if (
      !confirm(
        `Apply verified payment for ${orderNumber}?\n\n${check.proposed_label}\n\nThis updates the order using the gateway result.`
      )
    ) {
      return;
    }

    setBusyOrder(orderNumber);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{
        success: boolean;
        message: string;
        check?: CheckResult;
      }>('/api/admin/payments/reconcile', {
        method: 'POST',
        json: { action: 'apply', orderNumber },
      });
      if (res.check) {
        setChecks((prev) => ({ ...prev, [orderNumber]: res.check! }));
      }
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setBusyOrder(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Reconciliation</h1>
            <p className="text-sm text-gray-600 mt-1">
              Find stuck payments, verify with Moolre, and apply safe corrections. Does not mark paid from
              redirects alone.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 flex items-center gap-2">
              Older than
              <select
                value={olderThanMinutes}
                onChange={(e) => setOlderThanMinutes(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value={5}>5 min</option>
                <option value={15}>15 min</option>
                <option value={60}>1 hour</option>
                <option value={1440}>24 hours</option>
              </select>
            </label>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 bg-store-navy text-white rounded-lg font-semibold hover:bg-store-navy-light disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
            {message}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Queue ({candidates.length})</h2>
            <p className="text-xs text-gray-500">Pending, failed, or half-paid orders</p>
          </div>

          {loading && candidates.length === 0 ? (
            <p className="p-8 text-center text-gray-500">Loading reconciliation queue…</p>
          ) : candidates.length === 0 ? (
            <p className="p-8 text-center text-gray-500">No orders need reconciliation right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Order</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Local status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Amounts</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Issue</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Gateway check</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const check = checks[c.order_number];
                    return (
                      <tr key={c.id} className="border-b border-gray-100 align-top">
                        <td className="py-3 px-4">
                          <Link
                            href={`/admin/orders/${c.id}`}
                            className="font-semibold text-store-ink hover:underline"
                          >
                            {c.order_number}
                          </Link>
                          <p className="text-xs text-gray-500 mt-1">{c.age_minutes} min old</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-gray-900">{c.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="capitalize font-medium">{c.payment_status.replace('_', ' ')}</p>
                          <p className="text-xs text-gray-500 capitalize">{c.status}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p>Total {money(c.total)}</p>
                          <p className="text-xs text-gray-600">Paid {money(c.amount_paid)}</p>
                          <p className="text-xs text-amber-700">Due now {money(c.expected_charge)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-gray-800">{c.issue_label}</p>
                          {!c.external_ref && (
                            <p className="text-xs text-red-600 mt-1">No external ref</p>
                          )}
                        </td>
                        <td className="py-3 px-4 min-w-[180px]">
                          {check ? (
                            <div className="space-y-1">
                              <p
                                className={
                                  check.gateway.verified ? 'text-green-700 font-medium' : 'text-gray-700'
                                }
                              >
                                {check.gateway.verified ? 'Gateway: paid' : 'Gateway: not paid'}
                              </p>
                              {check.gateway.amount != null && (
                                <p className="text-xs text-gray-600">
                                  Amount {money(check.gateway.amount)}
                                </p>
                              )}
                              <p className="text-xs text-gray-600">{check.proposed_label}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Not checked yet</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col gap-2 items-end">
                            <button
                              onClick={() => runCheck(c.order_number)}
                              disabled={busyOrder === c.order_number}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium disabled:opacity-50"
                            >
                              {busyOrder === c.order_number ? 'Working…' : 'Verify with Moolre'}
                            </button>
                            <button
                              onClick={() => runApply(c.order_number)}
                              disabled={busyOrder === c.order_number || !check?.safe_to_apply}
                              className="px-3 py-1.5 rounded-lg bg-store-navy text-white font-medium hover:bg-store-navy-light disabled:opacity-40"
                              title={
                                check?.safe_to_apply
                                  ? 'Apply verified payment'
                                  : 'Only enabled after a safe gateway match'
                              }
                            >
                              Apply fix
                            </button>
                            {(c.payment_status === 'pending' ||
                              c.payment_status === 'failed' ||
                              c.payment_status === 'partially_paid') && (
                              <Link
                                href={`/pay/${c.order_number}`}
                                target="_blank"
                                className="text-xs text-store-ink hover:underline"
                              >
                                Open pay link
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Recent audit log</h2>
          </div>
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No reconciliation actions logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">When</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Order</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Result</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-medium">{log.order_number}</td>
                      <td className="py-3 px-4">{log.action}</td>
                      <td className="py-3 px-4 capitalize">{log.result}</td>
                      <td className="py-3 px-4 text-gray-600">{log.admin_email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
