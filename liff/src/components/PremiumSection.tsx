import { useCallback, useEffect, useState } from 'react';
import { billingApi } from '../api/billing.js';
import type { BillingStatus } from '../types/billing.js';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: BillingStatus }
  | { kind: 'error'; message: string };

const formatExpiry = (iso: string | null): string => {
  if (iso === null) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
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
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleUpgrade = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      const res = await billingApi.checkout();
      window.location.href = res.url;
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; code?: string };
      setActionError(
        apiErr.message ?? 'ไม่สามารถเริ่ม checkout ได้ ลองอีกครั้งนะคะ'
      );
      setActionPending(false);
    }
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        'ยกเลิกสมาชิก Premium ค่ะ?\nคุณยังใช้ฟีเจอร์ได้จนถึงสิ้นสุดรอบบิลปัจจุบัน'
      )
    ) {
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      await billingApi.cancel();
      await load();
    } catch (err) {
      const apiErr = err as { status?: number; message?: string };
      setActionError(apiErr.message ?? 'ยกเลิกไม่สำเร็จ ลองอีกครั้งนะคะ');
    } finally {
      setActionPending(false);
    }
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
  const sub = data.subscription;

  if (isPremium) {
    return (
      <section className="rounded-xl bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              สมาชิก Premium ⭐
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
            <span>รอบถัดไป</span>
            <span className="font-medium text-slate-900">
              {formatExpiry(sub?.current_period_end ?? data.premium_expires_at)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>สถานะ</span>
            <span className="font-medium text-slate-900">
              {sub?.cancel_at_period_end ? 'ยกเลิกที่สิ้นสุดรอบ' : 'ต่ออายุอัตโนมัติ'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>ราคา</span>
            <span className="font-medium text-slate-900">
              {data.pricing.amount} {data.pricing.currency}/{data.pricing.interval}
            </span>
          </div>
        </div>

        {!sub?.cancel_at_period_end ? (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={actionPending}
            className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionPending ? '...' : 'ยกเลิกการต่ออายุ'}
          </button>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
            จะกลับเป็น Free หลังสิ้นสุดรอบบิลปัจจุบัน
          </p>
        )}

        {actionError !== null ? (
          <p className="mt-2 text-xs text-rose-700">{actionError}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            ปลดล็อก Tina Premium ⭐
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
          150 <span className="text-base font-medium text-slate-500">฿/เดือน</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">ยกเลิกได้ทุกเมื่อ · ปลอดภัยด้วย Stripe</p>
      </div>

      {!data.stripe_configured ? (
        <p className="mt-3 text-center text-xs text-amber-700">
          การชำระเงินกำลังตั้งค่า · พร้อมเปิดให้บริการเร็วๆ นี้
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void handleUpgrade()}
          disabled={actionPending}
          className="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionPending ? 'กำลังเปิด Stripe…' : 'อัปเกรดเป็น Premium →'}
        </button>
      )}

      {actionError !== null ? (
        <p className="mt-2 text-xs text-rose-700">{actionError}</p>
      ) : null}
    </section>
  );
};
