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
  Gift as GiftIcon,
} from 'lucide-react';
import { ThemeShop } from './ThemeShop.js';
import { GiftCreateModal } from './GiftCreateModal.js';
import { walletApi } from '../api/wallet.js';
import { topupApi } from '../api/topup.js';
import { premiumApi } from '../api/premium.js';
import { useSession } from '../state/session.js';
import type {
  ManualPaymentSubmission,
  ManualPaymentStatus,
  PremiumBundle,
  PremiumBundleId,
  WalletState,
} from '../types/wallet.js';
import {
  formatBundleLabel,
  formatCredit,
  formatStatusLabel,
} from '../types/wallet.js';

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
  onGift,
  pending,
}: {
  bundle: PremiumBundle;
  balance: number;
  onRedeem: (months: PremiumBundleId) => void;
  onGift: (months: PremiumBundleId) => void;
  pending: boolean;
}) => {
  const required = bundle.credit_required * 100; // satang
  const enough = balance >= required;
  const disabled = !enough || pending || bundle.credit_required <= 0;
  return (
    <div
      className={`rounded-lg border transition ${
        enough
          ? 'border-amber-200 bg-white'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="text-sm font-semibold text-slate-900">
          Premium {formatBundleLabel(bundle.months)}
        </div>
        <div className="text-xs font-bold text-amber-700">
          {bundle.credit_required} credit
        </div>
      </div>
      <div className="px-4 mt-1 text-[10px] text-slate-500">
        {enough
          ? 'เลือกใช้เอง หรือส่งให้เพื่อน'
          : `ต้องมีอีก ${formatCredit(required - balance)} credit`}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => onRedeem(bundle.months)}
          disabled={disabled}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ใช้เอง
        </button>
        <button
          type="button"
          onClick={() => onGift(bundle.months)}
          disabled={disabled}
          className="flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GiftIcon className="h-3 w-3" />
          ของขวัญ
        </button>
      </div>
    </div>
  );
};

export const PremiumSection = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [redeemPending, setRedeemPending] = useState<boolean>(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(
    null
  );
  const [giftBundle, setGiftBundle] = useState<{
    months: PremiumBundleId;
    credit_required: number;
  } | null>(null);
  const navigate = useNavigate();
  const { status: sessionStatus, setUser } = useSession();

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

  const handleRedeem = async (months: PremiumBundleId) => {
    const label = formatBundleLabel(months);
    const ok = window.confirm(
      `ใช้เครดิตแลก Premium ${label}?\nเครดิตจะถูกหักจากยอดของคุณ`
    );
    if (!ok) return;
    setRedeemPending(true);
    setRedeemMessage(null);
    try {
      const res = await premiumApi.redeem(months);
      setPremiumExpiresAt(res.premium_expires_at);
      setRedeemMessage(
        `แลก Premium ${label} สำเร็จ! หมดอายุ ${formatDate(res.premium_expires_at)}`
      );
      // Reactive wallet update: balance display reads from session.user.
      // setUser propagates new balance immediately; background load() refreshes
      // ledger entries / is_blocked / etc.
      if (sessionStatus.kind === 'authenticated') {
        setUser({
          ...sessionStatus.user,
          credit_balance_satang: res.credit_balance_satang,
        });
      }
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
  // Balance source of truth = session user (reactive). Falls back to wallet
  // state during the brief window when session hydrates after initial mount.
  const balance =
    sessionStatus.kind === 'authenticated'
      ? sessionStatus.user.credit_balance_satang
      : wallet.balance_satang;
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

      {/* In-progress topup banner — shown when user has awaiting_slip
          submission. Both "Continue" and "View" lead to /premium/topup/manual
          which auto-resumes the pending transaction. */}
      {(() => {
        const awaiting = submissions.find(
          (s) => s.status === 'awaiting_slip'
        );
        if (awaiting === undefined) return null;
        return (
          <section
            onClick={() => navigate('/premium/topup/manual')}
            className="cursor-pointer rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm transition hover:bg-amber-100"
          >
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-900">
                  มีการเติมเครดิตค้างอยู่
                </div>
                <p className="mt-0.5 text-xs text-amber-800">
                  จำนวน {formatCredit(awaiting.requested_amount_satang)} ฿ ·
                  ดำเนินการต่อ หรือยกเลิกเพื่อเปลี่ยนจำนวน
                </p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            </div>
          </section>
        );
      })()}

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
              onGift={(months) =>
                setGiftBundle({ months, credit_required: b.credit_required })
              }
              pending={redeemPending}
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

      {/* Themes marketplace — wallet card above is reactive via session.user */}
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

      {/* Gift modal — single instance, opens for either bundle or theme */}
      {giftBundle !== null && (
        <GiftCreateModal
          open={true}
          onClose={() => setGiftBundle(null)}
          giftType="premium"
          payload={{ months: giftBundle.months }}
          priceCredit={giftBundle.credit_required}
          subjectLabel={`Premium ${formatBundleLabel(giftBundle.months)}`}
        />
      )}
    </div>
  );
};
