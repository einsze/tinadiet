import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Info,
} from 'lucide-react';

export const TopupMethodPage = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/premium')}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3 w-3" />
        กลับไป Premium
      </button>

      <header>
        <h2 className="text-lg font-bold text-slate-900">เลือกวิธีเติมเครดิต</h2>
        <p className="mt-1 text-xs text-slate-500">
          เลือกช่องทางการชำระเงินที่สะดวกที่สุดสำหรับคุณ
        </p>
      </header>

      {/* Active option: Manual PromptPay */}
      <button
        type="button"
        onClick={() => navigate('/premium/topup/manual')}
        className="block w-full rounded-xl bg-white p-5 text-left shadow-sm ring-1 ring-brand-200 transition hover:ring-2 hover:ring-brand-400"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-amber-100">
            <QrCode className="h-5 w-5 text-brand-700" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                PromptPay Manual
              </h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                เปิดให้บริการ
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              สแกน QR โอนเงิน แล้วแนบสลิป ผู้ดูแลตรวจสอบภายใน 1-24 ชั่วโมง
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-700">
              <span>เลือก PromptPay</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </button>

      {/* Coming soon: Omise auto-payment */}
      <div className="block w-full cursor-not-allowed rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 opacity-70">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200">
            <CreditCard className="h-5 w-5 text-slate-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Auto-payment (Omise)
              </h3>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Coming Soon
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ระบบชำระอัตโนมัติด้วย PromptPay / TrueMoney
              เครดิตจะเข้าทันทีโดยไม่ต้องแนบสลิป
            </p>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
              <Info className="h-3 w-3" />
              <span>กำลังยืนยันตัวตนกับผู้ให้บริการ</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900">
        <strong>หมายเหตุ:</strong> หลังจากชำระเงินด้วย PromptPay แล้ว
        กรุณาแนบสลิปเพื่อให้ผู้ดูแลตรวจสอบและเติมเครดิตให้
      </div>
    </div>
  );
};
