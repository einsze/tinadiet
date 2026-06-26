import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon,
  AlertTriangle,
  Loader2,
  Search,
} from 'lucide-react';
import { usersApi } from '../api/index.js';
import type { UserListEntry } from '../types/index.js';
import { formatThb } from '../types/index.js';
import { Pagination } from '../components/Pagination.js';

const PAGE_SIZE = 20;

const formatDate = (iso: string | null): string => {
  if (iso === null) return '—';
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const UsersListPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserListEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        q: query,
        flagged: flaggedOnly,
        limit: PAGE_SIZE,
        offset,
      });
      setUsers(res.users);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [query, flaggedOnly, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <UsersIcon className="h-5 w-5" />
          Users
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Search by display name or LINE ID
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
            placeholder="Search…"
            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => {
              setFlaggedOnly(e.target.checked);
              setOffset(0);
            }}
          />
          Flagged only
        </label>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No users found
        </div>
      ) : (
        <>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Credit</th>
                <th className="px-4 py-2">Flags</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    #{u.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {u.display_name ?? '(no name)'}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {u.line_user_id.slice(0, 16)}…
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_premium ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Premium
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        Free
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatThb(u.credit_balance_satang)}
                  </td>
                  <td className="px-4 py-3">
                    {u.abuse_warning_count > 0 || u.is_blocked ? (
                      <div className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        {u.is_blocked ? 'BLOCKED' : `${u.abuse_warning_count} warn`}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/users/${u.id}`)}
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
          label="pengguna"
        />
        </>
      )}
    </div>
  );
};
