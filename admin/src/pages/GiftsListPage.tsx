import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Gift as GiftIcon,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
} from 'lucide-react';
import { giftsApi, type AdminGiftListItem, type AdminGiftStatus } from '../api/index.js';
import { Pagination } from '../components/Pagination.js';

const PAGE_SIZE = 20;

const STATUSES: AdminGiftStatus[] = [
  'pending',
  'claimed',
  'canceled',
  'expired',
  'refused',
  'revoked',
];

const statusBadge = (status: AdminGiftStatus) => {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
          <Clock className="h-2.5 w-2.5" /> Pending
        </span>
      );
    case 'claimed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          <CheckCircle2 className="h-2.5 w-2.5" /> Claimed
        </span>
      );
    case 'canceled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
          <XCircle className="h-2.5 w-2.5" /> Canceled
        </span>
      );
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          <AlertCircle className="h-2.5 w-2.5" /> Expired
        </span>
      );
    case 'refused':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
          <XCircle className="h-2.5 w-2.5" /> Refused
        </span>
      );
    case 'revoked':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
          <XCircle className="h-2.5 w-2.5" /> Revoked
        </span>
      );
  }
};

const describePayload = (g: AdminGiftListItem): string => {
  if (g.gift_type === 'premium' && g.payload.months !== undefined) {
    return `Premium ${g.payload.months}mo`;
  }
  if (g.gift_type === 'theme' && g.payload.theme_slug !== undefined) {
    return `Theme: ${g.payload.theme_slug}`;
  }
  return '—';
};

export const GiftsListPage = () => {
  const [status, setStatus] = useState<AdminGiftStatus | ''>('');
  const [gifts, setGifts] = useState<AdminGiftListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await giftsApi.list({
        status: status === '' ? undefined : status,
        q: query,
        limit: PAGE_SIZE,
        offset,
      });
      setGifts(res.gifts);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [status, query, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <GiftIcon className="h-5 w-5" />
            Gifts
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Credit-funded gifts sent peer-to-peer. Revoke to refund sender +
            unwind recipient entitlement.
          </p>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
          placeholder="Cari nama, LINE ID, atau #ID gift…"
          className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setStatus('');
            setOffset(0);
          }}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            status === ''
              ? 'bg-brand-100 text-brand-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setOffset(0);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
              status === s
                ? 'bg-brand-100 text-brand-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : gifts.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          No gifts to show.
        </div>
      ) : (
        <>
        <div className="rounded-xl bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Sender</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Credit</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gifts.map((g) => (
                <tr
                  key={g.id}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <Link
                      to={`/gifts/${g.id}`}
                      className="font-mono text-brand-700 hover:underline"
                    >
                      #{g.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{statusBadge(g.status)}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">
                    {describePayload(g)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {g.sender?.display_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {g.recipient?.display_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-amber-700">
                    {g.credit_spent_satang / 100}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-400">
                    {new Date(g.created_at).toLocaleDateString('th-TH')}
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
          label="gifts"
        />
        </>
      )}
    </div>
  );
};
