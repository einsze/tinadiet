import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { paymentsApi } from '../api/index.js';
import type { ManualPaymentWithUser } from '../types/index.js';
import { formatThb } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Pagination } from '../components/Pagination.js';

const PAGE_SIZE = 20;

const formatRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.floor(ms / (1000 * 60));
    return `${mins}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const PaymentsPendingPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<ManualPaymentWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsApi.pending(PAGE_SIZE, offset);
      setPayments(res.payments);
      setTotal(res.pagination.total);
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ClipboardList className="h-5 w-5" />
            Pending Review
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Sorted oldest first — review and approve/reject each submission
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-200"
          title="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </header>

      {loading && payments.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      )}

      {error !== null && (
        <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && payments.length === 0 && error === null && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">
            No pending submissions. All caught up!
          </p>
        </div>
      )}

      {payments.length > 0 && (
        <>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Requested</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Submitted</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    #{p.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {p.user?.display_name ?? `User #${p.user_id}`}
                    </div>
                    {p.user !== null &&
                      (p.user.abuse_warning_count > 0 || p.user.is_blocked) && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {p.user.is_blocked
                            ? 'Blocked'
                            : `${p.user.abuse_warning_count} warning${p.user.abuse_warning_count > 1 ? 's' : ''}`}
                        </div>
                      )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatThb(p.requested_amount_satang)} ฿
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatRelative(p.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/payments/${p.id}`)}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          onChange={setOffset}
          label="pembayaran"
        />
        </>
      )}
    </div>
  );
};
