import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { billingApi } from '../api/billing.js';
import type { OmiseChargeResponse, PaymentStatus } from '../types/billing.js';

type Props = {
  charge: OmiseChargeResponse;
  onClose: () => void;
  onSuccess: () => void;
};

type ViewState = 'pending' | 'successful' | 'failed' | 'expired';

const POLL_INTERVAL_MS = 2_000;
const COUNTDOWN_TICK_MS = 1_000;

const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatAmount = (satang: number): string =>
  (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const statusToView = (s: PaymentStatus): ViewState => {
  if (s === 'successful') return 'successful';
  if (s === 'failed') return 'failed';
  if (s === 'expired') return 'expired';
  return 'pending';
};

export const PromptPayQrModal = ({ charge, onClose, onSuccess }: Props) => {
  const [view, setView] = useState<ViewState>(statusToView(charge.status));
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (charge.expires_at === null) return 10 * 60 * 1000;
    return Math.max(0, new Date(charge.expires_at).getTime() - Date.now());
  });
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (view !== 'pending') return;
    let cancelled = false;

    const tick = async () => {
      try {
        const fresh = await billingApi.getOmiseCharge(charge.charge_id);
        if (cancelled) return;
        const next = statusToView(fresh.status);
        if (next !== view) setView(next);
        if (next === 'successful') {
          setTimeout(() => onSuccessRef.current(), 1_500);
        }
      } catch {
        // network blip — keep polling
      }
    };

    const intervalId = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [view, charge.charge_id]);

  useEffect(() => {
    if (view !== 'pending') return;
    const id = window.setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - COUNTDOWN_TICK_MS;
        if (next <= 0) {
          window.clearInterval(id);
          setView('expired');
          return 0;
        }
        return next;
      });
    }, COUNTDOWN_TICK_MS);
    return () => window.clearInterval(id);
  }, [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {view === 'pending' && (
          <>
            <h2 className="text-center text-lg font-bold text-slate-900">
              สแกน QR เพื่อชำระ
            </h2>
            <p className="mt-1 text-center text-xs text-slate-500">
              เปิดแอปธนาคารของคุณ → สแกน QR ด้านล่าง
            </p>

            <div className="mt-5 flex justify-center">
              {charge.qr_image_uri !== null ? (
                <img
                  src={charge.qr_image_uri}
                  alt="PromptPay QR code"
                  className="h-64 w-64 rounded-xl border-2 border-brand-100 bg-white p-2 shadow-sm"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                  ไม่มี QR
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-600">ยอดชำระ</span>
                <span className="text-xl font-bold text-brand-700">
                  {formatAmount(charge.amount_satang)}{' '}
                  <span className="text-sm font-medium">฿</span>
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs text-slate-600">หมดอายุใน</span>
                <span className="font-mono text-sm font-semibold text-rose-600 tabular-nums">
                  {formatCountdown(remainingMs)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>กำลังตรวจสอบการชำระเงิน…</span>
            </div>

            <p className="mt-3 text-center text-[10px] leading-tight text-slate-400">
              ระบบจะตรวจจับอัตโนมัติเมื่อชำระสำเร็จ
              <br />
              ไม่ต้องส่งหลักฐาน
            </p>
          </>
        )}

        {view === 'successful' && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" strokeWidth={2.5} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              ชำระสำเร็จ! 🎉
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              คุณเป็นสมาชิก Premium แล้วค่ะ
            </p>
            <p className="mt-1 text-xs text-slate-500">กำลังโหลดสถานะใหม่…</p>
          </div>
        )}

        {view === 'expired' && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-10 w-10 text-amber-600" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">QR หมดอายุ</h2>
            <p className="mt-2 text-sm text-slate-600">
              กรุณากดสร้าง QR ใหม่ค่ะ
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              ปิด
            </button>
          </div>
        )}

        {view === 'failed' && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
              <AlertCircle className="h-10 w-10 text-rose-600" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              ชำระไม่สำเร็จ
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              กรุณาลองใหม่อีกครั้งค่ะ
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
