import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Undo2,
  ExternalLink,
} from 'lucide-react';
import { paymentsApi } from '../api/index.js';
import { buildAuthedUrl, buildAuthHeader } from '../lib/api.js';
import type { PaymentDetailResponse } from '../api/index.js';
import { formatThb } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useAuth } from '../state/auth.js';

const formatDateTime = (iso: string | null): string => {
  if (iso === null) return '—';
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type ActionPanel = 'none' | 'approve' | 'reject' | 'revoke';

export const PaymentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: auth } = useAuth();
  const [detail, setDetail] = useState<PaymentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slipBlobUrl, setSlipBlobUrl] = useState<string | null>(null);
  type SlipState = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';
  const [slipState, setSlipState] = useState<SlipState>('idle');
  const [slipErrorDetail, setSlipErrorDetail] = useState<string | null>(null);
  const [panel, setPanel] = useState<ActionPanel>('none');
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Approve form fields
  const [approveAmountThb, setApproveAmountThb] = useState<string>('');
  const [approveNotes, setApproveNotes] = useState('');
  const [approveFlag, setApproveFlag] = useState(false);
  const [approveAbuseReason, setApproveAbuseReason] = useState('');

  // Reject form fields
  const [rejectReason, setRejectReason] = useState('');
  const [rejectFlag, setRejectFlag] = useState(false);

  // Revoke form fields
  const [revokeReason, setRevokeReason] = useState('');

  const paymentId = Number(id);
  const isSuperadmin =
    auth.kind === 'authenticated' && auth.admin.role === 'superadmin';

  const load = useCallback(async () => {
    if (!Number.isInteger(paymentId) || paymentId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsApi.detail(paymentId);
      setDetail(res);
      // Default approve amount = requested
      setApproveAmountThb(
        String(Math.floor(res.payment.requested_amount_satang / 100))
      );
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fetch slip image as blob (so we can include auth header)
  useEffect(() => {
    if (detail === null || detail.payment.slip_file_path === null) {
      setSlipState('idle');
      return;
    }
    let cancelled = false;
    let activeUrl: string | null = null;
    setSlipState('loading');
    setSlipErrorDetail(null);
    (async () => {
      try {
        const res = await fetch(
          buildAuthedUrl(`/api/v1/admin/payments/${paymentId}/slip`),
          { headers: buildAuthHeader() }
        );
        if (res.status === 404) {
          if (!cancelled) setSlipState('missing');
          return;
        }
        if (!res.ok) {
          if (!cancelled) {
            setSlipState('error');
            setSlipErrorDetail(`HTTP ${res.status}`);
          }
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        activeUrl = URL.createObjectURL(blob);
        setSlipBlobUrl(activeUrl);
        setSlipState('loaded');
      } catch (err) {
        if (!cancelled) {
          setSlipState('error');
          setSlipErrorDetail(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      if (activeUrl !== null) URL.revokeObjectURL(activeUrl);
    };
  }, [detail, paymentId]);

  const handleApprove = async () => {
    setActionError(null);
    const amountThb = Number(approveAmountThb);
    if (!Number.isFinite(amountThb) || amountThb <= 0) {
      setActionError('Enter a valid amount');
      return;
    }
    setActionPending(true);
    try {
      const res = await paymentsApi.approve(paymentId, {
        actual_amount_satang: Math.floor(amountThb * 100),
        admin_notes: approveNotes.length > 0 ? approveNotes : undefined,
        flag_user_as_abuse: approveFlag,
        abuse_reason: approveAbuseReason.length > 0 ? approveAbuseReason : undefined,
      });
      setActionSuccess(
        `Approved! Granted ${formatThb(res.credit_granted_satang)} credit · user balance now ${formatThb(res.user_credit_balance_satang)}`
      );
      setPanel('none');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      if (apiErr.code === 'HIGH_VALUE_NEEDS_SUPERADMIN') {
        setActionError(
          'Amount exceeds high-value threshold. Escalated to superadmin review.'
        );
        void load();
      } else {
        setActionError(apiErr.message ?? 'Approve failed');
      }
    } finally {
      setActionPending(false);
    }
  };

  const handleReject = async () => {
    setActionError(null);
    if (rejectReason.trim().length === 0) {
      setActionError('Rejection reason is required');
      return;
    }
    setActionPending(true);
    try {
      await paymentsApi.reject(paymentId, {
        rejection_reason: rejectReason,
        flag_user_as_abuse: rejectFlag,
      });
      setActionSuccess('Rejected. User will be notified.');
      setPanel('none');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setActionError(apiErr.message ?? 'Reject failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleRevoke = async () => {
    setActionError(null);
    if (revokeReason.trim().length === 0) {
      setActionError('Revoke reason is required');
      return;
    }
    if (!window.confirm('Revoke this approved payment? Credit will be deducted from user balance.')) {
      return;
    }
    setActionPending(true);
    try {
      const res = await paymentsApi.revoke(paymentId, revokeReason);
      setActionSuccess(
        `Revoked. Deducted ${formatThb(res.credit_deducted_satang)} credit${
          res.balance_went_to_zero ? ' (balance hit zero — user had spent some)' : ''
        }.`
      );
      setPanel('none');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setActionError(apiErr.message ?? 'Revoke failed');
    } finally {
      setActionPending(false);
    }
  };

  if (loading && detail === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error !== null || detail === null) {
    return (
      <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
        {error ?? 'Not found'}
      </div>
    );
  }

  const p = detail.payment;
  const u = detail.user;
  const reviewableNow = p.status === 'pending' || p.status === 'flagged_review';
  const revokeableNow = p.status === 'approved';

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
            Submission #{p.id}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Created {formatDateTime(p.created_at)}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </header>

      {actionSuccess !== null && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {actionSuccess}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* User panel */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            User
          </h3>
          {u !== null ? (
            <div className="mt-2 space-y-1.5 text-sm">
              <div>
                <span className="text-slate-500">Display name:</span>{' '}
                <strong>{u.display_name ?? '(none)'}</strong>
              </div>
              <div className="font-mono text-xs text-slate-500">
                {u.line_user_id}
              </div>
              <div>
                <span className="text-slate-500">Credit balance:</span>{' '}
                <strong>{formatThb(u.credit_balance_satang)}</strong>
              </div>
              {u.abuse_warning_count > 0 && (
                <div className="mt-2 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {u.abuse_warning_count} abuse warning
                  {u.abuse_warning_count > 1 ? 's' : ''}
                  {u.is_blocked ? ' · BLOCKED' : ''}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate(`/users/${u.id}`)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                View user details <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">User not found</p>
          )}
        </section>

        {/* Submission details */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Submission
          </h3>
          <div className="mt-2 space-y-1.5 text-sm">
            <div>
              <span className="text-slate-500">Requested:</span>{' '}
              <strong>{formatThb(p.requested_amount_satang)} ฿</strong>
            </div>
            {p.actual_amount_satang !== null && (
              <div>
                <span className="text-slate-500">Actual recorded:</span>{' '}
                <strong>{formatThb(p.actual_amount_satang)} ฿</strong>
              </div>
            )}
            {p.credit_granted_satang !== null && (
              <div>
                <span className="text-slate-500">Credit granted:</span>{' '}
                <strong>{formatThb(p.credit_granted_satang)} credit</strong>
              </div>
            )}
            {p.reviewed_at !== null && (
              <div>
                <span className="text-slate-500">Reviewed:</span>{' '}
                {formatDateTime(p.reviewed_at)}
                {p.reviewed_by_admin_id !== null
                  ? ` by admin #${p.reviewed_by_admin_id}`
                  : ''}
              </div>
            )}
            {p.rejection_reason !== null && (
              <div className="rounded-md bg-rose-50 p-2 text-xs">
                <strong>Rejection:</strong> {p.rejection_reason}
              </div>
            )}
            {p.revoked_at !== null && (
              <div className="rounded-md bg-purple-50 p-2 text-xs">
                <strong>Revoked {formatDateTime(p.revoked_at)}:</strong>{' '}
                {p.revoke_reason ?? '(no reason)'}
              </div>
            )}
            {p.admin_notes !== null && (
              <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                <strong>Notes:</strong> {p.admin_notes}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Slip viewer */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Transfer Slip
        </h3>
        {p.slip_file_path === null ? (
          <p className="mt-2 text-sm text-slate-400">No slip uploaded yet</p>
        ) : slipState === 'loading' || slipState === 'idle' ? (
          <div className="mt-2 flex h-32 items-center justify-center text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : slipState === 'missing' ? (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              File slip hilang dari storage
            </div>
            <p className="mt-1 text-xs">
              DB masih menunjuk file ini, tapi file sudah tidak ada di volume.
              Kemungkinan file ter-upload sebelum <code>SLIP_STORAGE_DIR</code>{' '}
              di-set ke volume persisten (<code>/data/slips</code>) dan hilang
              saat redeploy.
            </p>
            <p className="mt-1 break-all font-mono text-[10px] text-amber-700">
              path: {p.slip_file_path}
            </p>
          </div>
        ) : slipState === 'error' ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Gagal memuat slip
            </div>
            {slipErrorDetail !== null && (
              <p className="mt-1 text-xs">{slipErrorDetail}</p>
            )}
          </div>
        ) : slipBlobUrl !== null ? (
          <div className="mt-2">
            <a
              href={slipBlobUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={slipBlobUrl}
                alt="Transfer slip"
                className="max-h-[600px] w-full rounded-lg border border-slate-200 object-contain"
              />
            </a>
            <p className="mt-1 text-[10px] text-slate-400">
              Tap to open fullscreen
            </p>
          </div>
        ) : null}
      </section>

      {/* Action panel */}
      {(reviewableNow || revokeableNow) && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Actions
          </h3>

          {actionError !== null && (
            <div className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {actionError}
            </div>
          )}

          {reviewableNow && (
            <>
              {p.status === 'flagged_review' && !isSuperadmin && (
                <div className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  ⚠️ Flagged for superadmin review. Only superadmin can approve.
                </div>
              )}

              {panel === 'none' && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel('approve')}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-1 inline-block h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel('reject')}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    <XCircle className="mr-1 inline-block h-4 w-4" />
                    Reject
                  </button>
                </div>
              )}

              {panel === 'approve' && (
                <div className="mt-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Actual amount from slip (THB)
                    </label>
                    <input
                      type="number"
                      value={approveAmountThb}
                      onChange={(e) => setApproveAmountThb(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      User requested {formatThb(p.requested_amount_satang)} ฿. Enter actual.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Admin notes (optional)
                    </label>
                    <input
                      type="text"
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={approveFlag}
                      onChange={(e) => setApproveFlag(e.target.checked)}
                    />
                    Flag user as abuse (suspicious slip / mismatch)
                  </label>
                  {approveFlag && (
                    <input
                      type="text"
                      value={approveAbuseReason}
                      onChange={(e) => setApproveAbuseReason(e.target.value)}
                      placeholder="Abuse reason (optional)"
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                    />
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={actionPending}
                      className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionPending ? 'Approving…' : 'Confirm Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel('none')}
                      className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {panel === 'reject' && (
                <div className="mt-3 space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Reason (visible to user)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      rows={2}
                      placeholder="e.g. Slip tidak jelas, nominal tidak match"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={rejectFlag}
                      onChange={(e) => setRejectFlag(e.target.checked)}
                    />
                    Flag user as abuse
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={actionPending}
                      className="flex-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {actionPending ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel('none')}
                      className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {revokeableNow && isSuperadmin && (
            <>
              {panel === 'none' && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setPanel('revoke')}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    <Undo2 className="mr-1 inline-block h-4 w-4" />
                    Revoke this approval (superadmin)
                  </button>
                </div>
              )}
              {panel === 'revoke' && (
                <div className="mt-3 space-y-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                  <p className="text-xs text-slate-700">
                    Revoking deducts the granted credit from the user. If they
                    already spent it, balance hits 0.
                  </p>
                  <textarea
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    rows={2}
                    placeholder="Reason (logged for audit)"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRevoke}
                      disabled={actionPending}
                      className="flex-1 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {actionPending ? 'Revoking…' : 'Confirm Revoke'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel('none')}
                      className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};
