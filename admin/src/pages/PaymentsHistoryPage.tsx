import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import { paymentsApi } from '../api/index.js';
import type { ManualPaymentWithUser } from '../types/index.js';
import { formatThb } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Pagination } from '../components/Pagination.js';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'approved' | 'rejected' | 'revoked';

const formatDate = (iso: string | null): string => {
  if (iso === null) return '—';
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PaymentsHistoryPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<ManualPaymentWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: { status?: 'approved' | 'rejected' | 'revoked' } = {};
      if (filter !== 'all') opts.status = filter;
      const res = await paymentsApi.history({
        ...opts,
        limit: PAGE_SIZE,
        offset,
      });
      setPayments(res.payments);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <History className="h-5 w-5" />
          Payment History
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          All approved, rejected, and revoked submissions
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['all', 'approved', 'rejected', 'revoked'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setOffset(0);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No history yet
        </div>
      ) : (
        <>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Requested</th>
                <th className="px-4 py-2">Actual</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Reviewed</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    #{p.id}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.user?.display_name ?? `User #${p.user_id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatThb(p.requested_amount_satang)} ฿
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {p.actual_amount_satang !== null
                      ? `${formatThb(p.actual_amount_satang)} ฿`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(p.reviewed_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/payments/${p.id}`)}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      View →
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
