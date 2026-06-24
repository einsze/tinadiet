import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  Wallet,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { ThemeShop } from './ThemeShop.js';
import { walletApi } from '../api/wallet.js';
import { topupApi } from '../api/topup.js';
import { premiumApi } from '../api/premium.js';
import type {
  ManualPaymentSubmission,
  ManualPaymentStatus,
  PremiumBundle,
  WalletState,
} from '../types/wallet.js';
import { formatCredit, formatStatusLabel } from '../types/wallet.js';

type LoadedData = {
  wallet: WalletState;
  bundles: PremiumBundle[];
  submissions: ManualPaymentSubmission[];
};

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: LoadedData }
  | { kind: 'error'; message: string };

const formatDate = (iso: string | null): string => {
  if (iso === null) return '—';
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
};

const daysUntil = (iso: string | null): number | null => {
  if (iso === null) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

const StatusIcon = ({ status }: { status: ManualPaymentStatus }) => {
  const cls = 'h-3.5 w-3.5';
  switch (status) {
    case 'approved':
      return <CheckCircle2 className={`${cls} text-emerald-600`} />;
    case 'rejected':
    case 'revoked':
      return <XCircle className={`${cls} text-rose-600`} />;
    case 'flagged_review':
      return <ShieldAlert className={`${cls} text-amber-600`} />;
    case 'pending':
    case 'awaiting_slip':
    default:
      return <Clock className={`${cls} text-slate-500`} />;
  }
};

const SubmissionRow = ({ s }: { s: ManualPaymentSubmission }) => {
  const credit =
    s.credit_granted_satang !== null
      ? formatCredit(s.credit_granted_satang)
      : `(ขอ ${formatCredit(s.requested_amount_satang)})`;
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <StatusIcon status={s.status} />
        <div>
          <div className="font-medium text-slate-700">{credit} credit</div>
          <div className="text-[10px] text-slate-400">
            {formatDate(s.created_at)} · {formatStatusLabel(s.status)}
          </div>
        </div>
      </div>
      {s.rejection_reason !== null && (
        <span
          className="max-w-[140px] truncate text-[10px] italic text-rose-600"
          title={s.rejection_reason}
        >
          {s.rejection_reason}
        </span>
      )}
    </div>
  );
};

const BundleButton = ({
  bundle,
  balance,
  onRedeem,
  pending,
}: {
  bundle: PremiumBundle;
  balance: number;
  onRedeem: (months: 1 | 3 | 6 | 12) => void;
  pending: boolean;
}) => {
  const required = bundle.credit_required * 100; // satang
  const enough = balance >= required;
  return (
    <button
      type="button"
      onClick={() => onRedeem(bundle.months)}
      disabled={!enough || pending || bundle.credit_required <= 0}
      className={`w-full rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        enough
          ? 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          Premium {bundle.months} {bundle.months === 1 ? 'เดือน' : 'เดือน'}
        </div>
        <div className="text-xs font-bold text-amber-700">
          {bundle.credit_required} credit
        </div>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        {enough ? 'แตะเพื่อใช้เครดิต' : `ต้องมีอีก ${formatCredit(required - balance)} credit`}
      </div>
    </button>
  );
};

export const PremiumSection = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [redeemPending, setRedeemPending] = useState<false | number>(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(
    null
  );
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [wallet, bundles, mySubs] = await Promise.all([
        walletApi.get(),
        premiumApi.bundles(),
        topupApi.mySubmissions(3),
      ]);
      setState({
        kind: 'ready',
        data: {
          wallet,
          bundles: bundles.bundles,
          submissions: mySubs.submissions,
        },
      });
    } catch (err) {
      const msg =
        err !== null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setState({ kind: 'error', message: msg });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRedeem = async (months: 1 | 3 | 6 | 12) => {
    const ok = window.confirm(
      `ใช้เครดิตแลก Premium ${months} เดือน?\nเครดิตจะถูกหักจากยอดของคุณ`
    );
    if (!ok) return;
    setRedeemPending(months);
    setRedeemMessage(null);
    try {
      const res = await premiumApi.redeem(months);
      setPremiumExpiresAt(res.premium_expires_at);
      setRedeemMessage(
        `แลก Premium ${months} เดือน สำเร็จ! หมดอายุ ${formatDate(res.premium_expires_at)}`
      );
      await load();
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setRedeemMessage(apiErr.message ?? 'ไม่สำเร็จ ลองอีกครั้งนะคะ');
    } finally {
      setRedeemPending(false);
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm text-rose-700">Error: {state.message}</p>
      </section>
    );
  }

  const { wallet, bundles, submissions } = state.data;
  const balance = wallet.balance_satang;
  const balanceLabel = formatCredit(balance);

  // We get premium status from /redeem response or from /billing/status, but
  // here we only need the expires_at for display. Pull it via the last redeem
  // event OR the submissions. For now, just show what we know.
  const expiresIn = daysUntil(premiumExpiresAt);

  return (
    <div className="space-y-4">
      {/* Wallet card */}
      <section className="rounded-xl bg-gradient-to-br from-brand-50 via-white to-amber-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Wallet className="h-3.5 w-3.5" />
              My Wallet
            </h3>
            <div className="mt-1 text-3xl font-bold text-slate-900">
              {balanceLabel}{' '}
              <span className="text-base font-medium text-slate-500">credit</span>
            </div>
            {wallet.is_blocked && (
              <p className="mt-1 text-xs font-medium text-rose-700">
                บัญชีของคุณถูกระงับการเติมเครดิต
              </p>
            )}
          </div>
          <Sparkles className="h-6 w-6 text-amber-400" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/premium/topup')}
          disabled={wallet.is_blocked}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>เติมเครดิต</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {/* Premium redeem section */}
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            แลก Premium ด้วยเครดิต
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          แตะแพ็กเกจที่ต้องการเพื่อใช้เครดิตแลก premium ต่ออายุได้ตลอดเวลา
          (วันต่อจากวันหมดอายุปัจจุบัน)
        </p>

        {premiumExpiresAt !== null && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs">
            <div className="font-semibold text-amber-900">
              ✓ Premium active until {formatDate(premiumExpiresAt)}
            </div>
            {expiresIn !== null && (
              <div className="text-amber-700">เหลือ {expiresIn} วัน</div>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2">
          {bundles.map((b) => (
            <BundleButton
              key={b.months}
              bundle={b}
              balance={balance}
              onRedeem={handleRedeem}
              pending={redeemPending !== false}
            />
          ))}
        </div>

        {redeemMessage !== null && (
          <p
            className={`mt-3 text-xs ${
              redeemMessage.startsWith('แลก') &&
              redeemMessage.includes('สำเร็จ')
                ? 'text-emerald-700'
                : 'text-rose-700'
            }`}
          >
            {redeemMessage}
          </p>
        )}
      </section>

      {/* Recent submissions */}
      {submissions.length > 0 && (
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            การเติมเครดิตล่าสุด
          </h3>
          <div className="mt-2 divide-y divide-slate-100">
            {submissions.map((s) => (
              <SubmissionRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      {/* Themes marketplace */}
      <ThemeShop />

      {/* Coming soon: Omise auto-payment */}
      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CreditCard className="h-4 w-4" />
          <span className="font-medium">Auto-payment (Omise) — Coming Soon</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          ระบบชำระอัตโนมัติด้วย PromptPay / TrueMoney
          กำลังอยู่ระหว่างการยืนยันตัวตนกับผู้ให้บริการ
        </p>
      </section>
    </div>
  );
};
