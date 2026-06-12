import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Sparkles, Info } from 'lucide-react';
import { billingApi } from '../api/billing.js';
import type {
  BillingStatus,
  OmiseChargeResponse,
  PaymentMethod,
} from '../types/billing.js';
import { PaymentMethodPicker } from './PaymentMethodPicker.js';
import { PromptPayQrModal } from './PromptPayQrModal.js';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: BillingStatus }
  | { kind: 'error'; message: string };

const RENEW_WINDOW_DAYS = 7;

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

const FeatureRow = ({ included, label }: { included: boolean; label: string }) => (
  <div className="flex items-center gap-2 text-sm">
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
        included ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {included ? '✓' : '×'}
    </span>
    <span className={included ? 'text-slate-900' : 'text-slate-400 line-through'}>
      {label}
    </span>
  </div>
);

export const PremiumSection = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [method, setMethod] = useState<PaymentMethod>('promptpay');
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCharge, setActiveCharge] = useState<OmiseChargeResponse | null>(
    null
  );
  const truemoneyPollIdRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await billingApi.status();
      setState({ kind: 'ready', data });
    } catch (err) {
      const message =
        err !== null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setState({ kind: 'error', message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // After redirect back from TrueMoney, query param omise_return=1 triggers
  // a status reload (webhook may have already fired, or polling will sync).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('omise_return') !== '1') return;
    params.delete('omise_return');
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch.length > 0 ? `?${newSearch}` : '');
    window.history.replaceState({}, '', newUrl);
    void load();
  }, [load]);

  const stopTruemoneyPolling = useCallback(() => {
    if (truemoneyPollIdRef.current !== null) {
      window.clearInterval(truemoneyPollIdRef.current);
      truemoneyPollIdRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTruemoneyPolling(), [stopTruemoneyPolling]);

  const startCharge = async () => {
    setActionPending(true);
    setActionError(null);
    stopTruemoneyPolling();
    try {
      const charge = await billingApi.createOmiseCharge(method);
      if (method === 'promptpay') {
        setActiveCharge(charge);
        setActionPending(false);
        return;
      }
      // TrueMoney → redirect to authorize_uri; start background poll so that
      // when the user returns to the LIFF, status is fresh.
      if (charge.authorize_uri === null) {
        setActionError('ไม่ได้รับลิงก์ TrueMoney กรุณาลองใหม่ค่ะ');
        setActionPending(false);
        return;
      }
      truemoneyPollIdRef.current = window.setInterval(() => {
        void load();
      }, 5_000);
      window.location.href = charge.authorize_uri;
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; code?: string };
      setActionError(
        apiErr.message ?? 'ไม่สามารถเริ่มการชำระเงินได้ ลองอีกครั้งนะคะ'
      );
      setActionPending(false);
    }
  };

  const handleModalClose = () => {
    setActiveCharge(null);
    void load();
  };

  const handleModalSuccess = () => {
    setActiveCharge(null);
    void load();
  };

  if (state.kind === 'loading') {
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading…</p>
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

  const { data } = state;
  const isPremium = data.is_premium;
  const expiresIn = daysUntil(data.premium_expires_at);
  const canRenew = isPremium && expiresIn !== null && expiresIn <= RENEW_WINDOW_DAYS;

  return (
    <>
      {isPremium ? (
        <section className="rounded-xl bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Crown className="h-4 w-4 text-amber-600" />
                สมาชิก Premium
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                ใช้งานได้ครบทุกฟีเจอร์
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              Active
            </span>
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>หมดอายุ</span>
              <span className="font-medium text-slate-900">
                {formatDate(data.premium_expires_at)}
              </span>
            </div>
            {expiresIn !== null && (
              <div className="flex justify-between">
                <span>เหลือ</span>
                <span
                  className={[
                    'font-medium',
                    expiresIn <= 3 ? 'text-rose-600' : 'text-slate-900',
                  ].join(' ')}
                >
                  {expiresIn} วัน
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>วิธีต่ออายุ</span>
              <span className="font-medium text-slate-900">
                ชำระเอง · ไม่หักอัตโนมัติ
              </span>
            </div>
          </div>

          {canRenew ? (
            <div className="mt-5 space-y-3">
              <p className="text-center text-xs font-medium text-amber-700">
                ใกล้หมดอายุแล้ว — ต่ออายุเลย?
              </p>
              <PaymentMethodPicker
                value={method}
                onChange={setMethod}
                disabled={actionPending}
              />
              <button
                type="button"
                onClick={() => void startCharge()}
                disabled={actionPending || !data.omise_configured}
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionPending
                  ? 'กำลังเปิด…'
                  : `ต่ออายุ ${data.pricing.amount} ฿ · ${data.pricing.grant_days} วัน`}
              </button>
              <p className="text-center text-[10px] text-slate-500">
                วันที่ใหม่จะถูกบวกต่อจากวันหมดอายุปัจจุบัน
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
              เปิดให้ต่ออายุได้ {RENEW_WINDOW_DAYS} วันก่อนหมดอายุ
            </p>
          )}

          {actionError !== null ? (
            <p className="mt-2 text-xs text-rose-700">{actionError}</p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-rose-500" />
                ปลดล็อก Tina Premium
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                ใช้ฟีเจอร์ทั้งหมดของ Tina ได้เต็มที่
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Free
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/70 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Free
              </div>
              <div className="mt-2 space-y-1.5">
                <FeatureRow included label="บันทึกอาหารด้วยข้อความ" />
                <FeatureRow included label="บันทึกน้ำหนัก" />
                <FeatureRow included label="Dashboard + กราฟ" />
                <FeatureRow included label="สรุปรายวัน + สัปดาห์" />
                <FeatureRow included={false} label="ถ่ายรูปอาหาร 📷" />
                <FeatureRow included={false} label="ถามปรึกษา 💬" />
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm ring-2 ring-amber-300">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Premium
              </div>
              <div className="mt-2 space-y-1.5">
                <FeatureRow included label="ทุกอย่างของ Free" />
                <FeatureRow included label="ถ่ายรูปอาหาร 📷" />
                <FeatureRow included label="ถามปรึกษา 💬" />
                <FeatureRow included label="ใช้ข้อมูลส่วนตัวประกอบ" />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white p-4 text-center">
            <div className="text-3xl font-bold text-slate-900">
              {data.pricing.amount}{' '}
              <span className="text-base font-medium text-slate-500">
                ฿/{data.pricing.grant_days} วัน
              </span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-500">
              <Info className="h-3 w-3" />
              <span>ชำระครั้งเดียวต่อเดือน · ไม่หักเงินอัตโนมัติ</span>
            </div>
          </div>

          {!data.omise_configured ? (
            <p className="mt-3 text-center text-xs text-amber-700">
              การชำระเงินกำลังตั้งค่า · พร้อมเปิดให้บริการเร็วๆ นี้
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <PaymentMethodPicker
                value={method}
                onChange={setMethod}
                disabled={actionPending}
              />
              <button
                type="button"
                onClick={() => void startCharge()}
                disabled={actionPending}
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionPending
                  ? 'กำลังเปิด…'
                  : `ชำระ ${data.pricing.amount} ฿ ด้วย ${
                      method === 'promptpay' ? 'PromptPay' : 'TrueMoney'
                    }`}
              </button>
            </div>
          )}

          {actionError !== null ? (
            <p className="mt-2 text-xs text-rose-700">{actionError}</p>
          ) : null}
        </section>
      )}

      {activeCharge !== null && (
        <PromptPayQrModal
          charge={activeCharge}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </>
  );
};
