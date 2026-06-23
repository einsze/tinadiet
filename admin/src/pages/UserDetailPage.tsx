import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Minus,
  AlertTriangle,
  Ban,
  ShieldOff,
  Crown,
} from 'lucide-react';
import { usersApi } from '../api/index.js';
import type { UserDetailResponse } from '../api/index.js';
import { formatThb } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useAuth } from '../state/auth.js';

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

const SOURCE_LABEL: Record<string, string> = {
  manual_topup: 'Manual top-up',
  omise_topup: 'Omise top-up',
  admin_grant: 'Admin grant',
  redeem_premium: 'Redeem premium',
  revoke_topup: 'Revoke top-up',
  revoke_redeem: 'Revoke redeem',
};

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: auth } = useAuth();
  const userId = Number(id);
  const isSuperadmin =
    auth.kind === 'authenticated' && auth.admin.role === 'superadmin';

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(userId) || userId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.detail(userId);
      setData(res);
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdjustCredit = async (sign: 1 | -1) => {
    setActionMsg(null);
    const thb = Number(adjustAmount);
    if (!Number.isFinite(thb) || thb <= 0) {
      setActionMsg('Enter positive amount');
      return;
    }
    if (adjustReason.trim().length === 0) {
      setActionMsg('Reason required');
      return;
    }
    setActionPending(true);
    try {
      const res = await usersApi.adjustCredit(
        userId,
        sign * Math.floor(thb * 100),
        adjustReason
      );
      setActionMsg(
        `Adjusted. New balance: ${formatThb(res.user_credit_balance_satang)} credit`
      );
      setAdjustAmount('');
      setAdjustReason('');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setActionMsg(apiErr.message ?? 'Failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleClearWarnings = async () => {
    const reason = window.prompt('Reason for clearing warnings?');
    if (reason === null || reason.trim().length === 0) return;
    setActionPending(true);
    try {
      const res = await usersApi.clearWarnings(userId, reason);
      setActionMsg(
        `Cleared ${res.cleared_count} warning(s). Block status: ${res.user.is_blocked ? 'still blocked' : 'cleared'}`
      );
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setActionMsg(apiErr.message ?? 'Failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleBlock = async () => {
    if (!window.confirm('Block this user from new topups?')) return;
    setActionPending(true);
    try {
      await usersApi.block(userId);
      setActionMsg('User blocked.');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setActionMsg(apiErr.message ?? 'Failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleUnblock = async () => {
    setActionPending(true);
    try {
      await usersApi.unblock(userId);
      setActionMsg('User unblocked.');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setActionMsg(apiErr.message ?? 'Failed');
    } finally {
      setActionPending(false);
    }
  };

  if (loading && data === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error !== null || data === null) {
    return (
      <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
        {error ?? 'Not found'}
      </div>
    );
  }

  const u = data.user;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </button>

      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {u.display_name ?? `User #${u.id}`}
          </h2>
          <p className="font-mono text-xs text-slate-500">{u.line_user_id}</p>
          <p className="mt-1 text-[10px] text-slate-400">
            Joined {formatDate(u.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {u.is_premium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <Crown className="h-3 w-3" />
              Premium
            </span>
          )}
          {u.is_blocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              <Ban className="h-3 w-3" />
              BLOCKED
            </span>
          )}
          {u.abuse_warning_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {u.abuse_warning_count} warning{u.abuse_warning_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {actionMsg !== null && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {actionMsg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Wallet summary */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wallet
          </h3>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {formatThb(u.credit_balance_satang)}{' '}
            <span className="text-sm font-medium text-slate-500">credit</span>
          </div>
          {u.is_premium && (
            <p className="mt-1 text-xs text-slate-600">
              Premium until <strong>{formatDate(u.premium_expires_at)}</strong>
            </p>
          )}

          {isSuperadmin && (
            <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
              <h4 className="text-[11px] font-semibold uppercase text-slate-500">
                Adjust credit (superadmin)
              </h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="THB amount"
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason (required)"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAdjustCredit(1)}
                  disabled={actionPending}
                  className="flex-1 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plus className="mr-1 inline-block h-3 w-3" />
                  Grant
                </button>
                <button
                  type="button"
                  onClick={() => void handleAdjustCredit(-1)}
                  disabled={actionPending}
                  className="flex-1 rounded-md bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <Minus className="mr-1 inline-block h-3 w-3" />
                  Deduct
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Abuse / block controls */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Moderation
          </h3>
          <div className="mt-2 space-y-1 text-sm">
            <div>
              <span className="text-slate-500">Warnings:</span>{' '}
              <strong>{u.abuse_warning_count}</strong>
            </div>
            <div>
              <span className="text-slate-500">Blocked:</span>{' '}
              <strong>{u.is_blocked ? 'Yes' : 'No'}</strong>
            </div>
          </div>
          {isSuperadmin && (
            <div className="mt-3 flex flex-wrap gap-2">
              {u.abuse_warning_count > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearWarnings()}
                  disabled={actionPending}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <ShieldOff className="mr-1 inline-block h-3 w-3" />
                  Clear warnings
                </button>
              )}
              {u.is_blocked ? (
                <button
                  type="button"
                  onClick={() => void handleUnblock()}
                  disabled={actionPending}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Unblock user
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleBlock()}
                  disabled={actionPending}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <Ban className="mr-1 inline-block h-3 w-3" />
                  Block user
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Recent payments */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recent payments
        </h3>
        {data.recent_payments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">None</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 text-sm">
            {data.recent_payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div>
                  <div className="font-medium text-slate-700">
                    #{p.id} ·{' '}
                    {p.credit_granted_satang !== null
                      ? `${formatThb(p.credit_granted_satang)} credit`
                      : `req ${formatThb(p.requested_amount_satang)} ฿`}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {formatDate(p.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <button
                    type="button"
                    onClick={() => navigate(`/payments/${p.id}`)}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Credit ledger */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Credit ledger
        </h3>
        {data.recent_ledger.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No transactions</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 text-xs">
            {data.recent_ledger.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div>
                  <div className="font-medium text-slate-700">
                    {SOURCE_LABEL[e.source_type] ?? e.source_type}
                  </div>
                  {e.note !== null && (
                    <div className="text-[10px] text-slate-400">{e.note}</div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    {formatDate(e.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-semibold ${
                      e.amount_satang > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {e.amount_satang > 0 ? '+' : ''}
                    {formatThb(e.amount_satang)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    bal {formatThb(e.balance_after_satang)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Flags audit log */}
      {data.flags.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Flag history ({data.flags.length})
          </h3>
          <div className="mt-2 divide-y divide-slate-100 text-xs">
            {data.flags.map((f) => (
              <div key={f.id} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-700">
                    {f.flag_type}
                  </span>
                  <span className="text-slate-400">
                    by admin #{f.flagged_by_admin_id}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDate(f.flagged_at)}
                  </span>
                </div>
                {f.reason !== null && (
                  <div className="mt-0.5 text-slate-600">{f.reason}</div>
                )}
                {f.cleared_at !== null && (
                  <div className="mt-0.5 text-[10px] text-emerald-700">
                    Cleared {formatDate(f.cleared_at)}
                    {f.clear_reason !== null ? ` — ${f.clear_reason}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
