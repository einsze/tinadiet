import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { giftsApi, type AdminGiftListItem } from '../api/index.js';
import { useAuth } from '../state/auth.js';

const formatDt = (iso: string | null): string => {
  if (iso === null) return '—';
  try {
    return new Date(iso).toLocaleString('th-TH');
  } catch {
    return iso;
  }
};

const describe = (g: AdminGiftListItem): string => {
  if (g.gift_type === 'premium' && g.payload.months !== undefined) {
    return `Premium ${g.payload.months} months`;
  }
  if (g.gift_type === 'theme' && g.payload.theme_slug !== undefined) {
    return `Theme ${g.payload.theme_slug}`;
  }
  return '—';
};

export const GiftDetailPage = () => {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [gift, setGift] = useState<AdminGiftListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { state } = useAuth();
  const isSuperadmin =
    state.kind === 'authenticated' && state.admin.role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await giftsApi.detail(id);
      setGift(res.gift);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (Number.isFinite(id)) void load();
  }, [id, load]);

  const handleRevoke = async () => {
    if (gift === null) return;
    if (reason.trim().length < 3) {
      setMsg('Revoke reason required (min 3 chars)');
      return;
    }
    if (
      !window.confirm(
        `Revoke gift #${gift.id}?\n\n` +
          `This will refund ${gift.credit_spent_satang / 100} credit to ` +
          `${gift.sender?.display_name ?? 'sender'} and remove entitlement ` +
          `from ${gift.recipient?.display_name ?? 'recipient'}.`
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      await giftsApi.revoke(gift.id, reason.trim());
      setMsg('Revoked. Sender refunded, recipient entitlement removed.');
      setReason('');
      await load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMsg(apiErr.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(id)) {
    return <div className="text-sm text-rose-700">Invalid id</div>;
  }
  if (loading || gift === null) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const canRevoke = gift.status === 'claimed';

  return (
    <div className="space-y-4">
      <Link
        to="/gifts"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to gifts
      </Link>

      <header>
        <h2 className="text-xl font-bold text-slate-900">Gift #{gift.id}</h2>
        <p className="mt-1 text-xs text-slate-500">{describe(gift)}</p>
      </header>

      {msg !== null && (
        <div
          className={`rounded-lg p-3 text-xs ${
            msg.startsWith('Revoked')
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {msg}
        </div>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detail
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-slate-900">{gift.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Credit value</dt>
            <dd className="font-medium text-amber-700">
              {gift.credit_spent_satang / 100} credit
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-700">{formatDt(gift.created_at)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Claim expires</dt>
            <dd className="text-slate-700">
              {formatDt(gift.claim_expires_at)}
            </dd>
          </div>
          {gift.claimed_at !== null && (
            <div>
              <dt className="text-slate-500">Claimed at</dt>
              <dd className="text-slate-700">{formatDt(gift.claimed_at)}</dd>
            </div>
          )}
          {gift.canceled_at !== null && (
            <div>
              <dt className="text-slate-500">Canceled at</dt>
              <dd className="text-slate-700">{formatDt(gift.canceled_at)}</dd>
            </div>
          )}
          {gift.expired_at !== null && (
            <div>
              <dt className="text-slate-500">Expired at</dt>
              <dd className="text-slate-700">{formatDt(gift.expired_at)}</dd>
            </div>
          )}
          {gift.refused_at !== null && (
            <div>
              <dt className="text-slate-500">Refused</dt>
              <dd className="text-slate-700">
                {gift.refused_reason ?? '—'} at {formatDt(gift.refused_at)}
              </dd>
            </div>
          )}
          {gift.revoked_at !== null && (
            <div className="col-span-2">
              <dt className="text-slate-500">Revoked</dt>
              <dd className="text-rose-700">
                {formatDt(gift.revoked_at)} (by admin #{gift.revoked_by_admin_id})
                <br />
                <span className="italic">"{gift.revoke_reason}"</span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sender
        </h3>
        {gift.sender ? (
          <dl className="mt-2 text-xs">
            <dt className="text-slate-500">Display name</dt>
            <dd className="text-slate-700">
              <Link
                to={`/users/${gift.sender.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {gift.sender.display_name ?? '(no name)'} (#{gift.sender.id})
              </Link>
            </dd>
            <dt className="mt-2 text-slate-500">LINE user_id</dt>
            <dd className="font-mono text-[10px] text-slate-600 break-all">
              {gift.sender.line_user_id}
            </dd>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Deleted</p>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recipient
        </h3>
        {gift.recipient ? (
          <dl className="mt-2 text-xs">
            <dt className="text-slate-500">Display name</dt>
            <dd className="text-slate-700">
              <Link
                to={`/users/${gift.recipient.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {gift.recipient.display_name ?? '(no name)'} (#{gift.recipient.id})
              </Link>
            </dd>
            <dt className="mt-2 text-slate-500">LINE user_id</dt>
            <dd className="font-mono text-[10px] text-slate-600 break-all">
              {gift.recipient.line_user_id}
            </dd>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Not claimed yet</p>
        )}
      </section>

      {gift.message !== null && (
        <section className="rounded-xl bg-amber-50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Sender's message
          </h3>
          <p className="mt-2 text-sm italic text-amber-900">"{gift.message}"</p>
        </section>
      )}

      {canRevoke && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-900">
            <ShieldAlert className="h-4 w-4" />
            Revoke gift
          </h3>
          <p className="mt-1 text-xs text-rose-700">
            Revokes the gift: refunds {gift.credit_spent_satang / 100} credit
            to sender + unwinds recipient's entitlement (premium days
            subtracted / theme ownership removed). Notification pushed to
            both parties. Reason logged in audit trail.
          </p>
          {!isSuperadmin && (
            <p className="mt-2 text-xs font-semibold text-rose-700">
              Superadmin only.
            </p>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Revoke reason (required, min 3 chars)…"
            disabled={!isSuperadmin || busy}
            className="mt-3 w-full rounded-md border border-rose-200 px-3 py-1.5 text-xs focus:border-rose-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleRevoke()}
            disabled={!isSuperadmin || busy || reason.trim().length < 3}
            className="mt-3 flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Revoke gift #{gift.id}
          </button>
        </section>
      )}
    </div>
  );
};
