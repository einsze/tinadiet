import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Upload,
  AlertCircle,
  QrCode,
  Coins,
} from 'lucide-react';
import { topupApi } from '../api/topup.js';
import type {
  StartManualTopupResponse,
  TopupConfig,
} from '../types/wallet.js';

type Step =
  | { kind: 'loading' }
  | { kind: 'choose-amount' }
  | { kind: 'starting' }
  | { kind: 'show-qr'; charge: StartManualTopupResponse; resumed: boolean }
  | { kind: 'upload-slip'; charge: StartManualTopupResponse; file: File | null }
  | { kind: 'uploading'; charge: StartManualTopupResponse }
  | { kind: 'canceling'; charge: StartManualTopupResponse }
  | { kind: 'done'; charge: StartManualTopupResponse };

const formatAmount = (thb: number): string =>
  thb.toLocaleString('th-TH', { maximumFractionDigits: 0 });

const PresetButton = ({
  amount,
  selected,
  onClick,
}: {
  amount: number;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border px-3 py-3 text-center text-sm font-semibold transition ${
      selected
        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200'
        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
    }`}
  >
    {formatAmount(amount)}
    <span className="ml-1 text-xs font-normal text-slate-500">฿</span>
  </button>
);

export const ManualTopupPage = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<TopupConfig | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const c = await topupApi.config();
      setConfig(c);
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'ไม่สามารถโหลดการตั้งค่าได้');
    }
  }, []);

  // On mount: check if user has an in-progress topup. If yes, resume to its
  // QR step so they don't get confused by the "already has pending" error
  // when trying to start a new one.
  const checkExisting = useCallback(async () => {
    try {
      const { current } = await topupApi.currentManual();
      if (current !== null) {
        setStep({ kind: 'show-qr', charge: current, resumed: true });
      } else {
        setStep({ kind: 'choose-amount' });
      }
    } catch {
      // Fall through to choose-amount if current check fails
      setStep({ kind: 'choose-amount' });
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void checkExisting();
  }, [loadConfig, checkExisting]);

  const resolvedAmount: number | null = (() => {
    if (selectedPreset !== null) return selectedPreset;
    const n = Number(customAmount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  })();

  const amountValid =
    resolvedAmount !== null &&
    config !== null &&
    resolvedAmount >= config.min_thb &&
    resolvedAmount <= config.max_thb;

  const handleStart = async () => {
    if (!amountValid || resolvedAmount === null) return;
    setError(null);
    setStep({ kind: 'starting' });
    try {
      const res = await topupApi.startManual(resolvedAmount);
      setStep({ kind: 'show-qr', charge: res, resumed: false });
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      // Race: another tab/refresh created a pending topup. Resume into it.
      if (
        apiErr.code === 'ALREADY_HAS_AWAITING_SLIP' ||
        apiErr.code === 'ALREADY_HAS_PENDING'
      ) {
        try {
          const { current } = await topupApi.currentManual();
          if (current !== null) {
            setStep({ kind: 'show-qr', charge: current, resumed: true });
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setError(apiErr.message ?? 'ไม่สามารถสร้าง QR ได้ ลองอีกครั้งนะคะ');
      setStep({ kind: 'choose-amount' });
    }
  };

  const handleCancelExisting = async (paymentId: number) => {
    setError(null);
    const previousStep = step;
    if (previousStep.kind === 'show-qr') {
      setStep({ kind: 'canceling', charge: previousStep.charge });
    }
    try {
      await topupApi.cancelManual(paymentId);
      setStep({ kind: 'choose-amount' });
      setSelectedPreset(null);
      setCustomAmount('');
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'ยกเลิกไม่สำเร็จ ลองอีกครั้งนะคะ');
      setStep(previousStep);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (step.kind !== 'upload-slip') return;
    const file = e.target.files?.[0] ?? null;
    if (file !== null && file.size > 5 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกิน 5 MB กรุณาเลือกใหม่');
      return;
    }
    setError(null);
    setStep({ ...step, file });
  };

  const handleUpload = async () => {
    if (step.kind !== 'upload-slip' || step.file === null) return;
    setError(null);
    const uploadingStep: Step = { kind: 'uploading', charge: step.charge };
    setStep(uploadingStep);
    try {
      await topupApi.uploadSlip(step.charge.payment_id, step.file);
      setStep({ kind: 'done', charge: step.charge });
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setError(apiErr.message ?? 'อัปโหลดล้มเหลว ลองอีกครั้งนะคะ');
      setStep({ kind: 'upload-slip', charge: step.charge, file: step.file });
    }
  };

  const goBackToPremium = () => navigate('/premium');

  // --- Render per step ---

  if (step.kind === 'loading') {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>กำลังตรวจสอบรายการของคุณ…</span>
      </div>
    );
  }

  if (step.kind === 'done') {
    return (
      <div className="space-y-4">
        <section className="rounded-xl bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            แนบสลิปเรียบร้อย!
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            ผู้ดูแลจะตรวจสอบและเติมเครดิตให้คุณภายใน 1-24 ชั่วโมง
          </p>
          <p className="mt-2 text-xs text-slate-500">
            จำนวนที่ขอ:{' '}
            <strong>{formatAmount(step.charge.amount_thb)} ฿</strong>
          </p>
          <button
            type="button"
            onClick={goBackToPremium}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            กลับไปหน้า Premium <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>
    );
  }

  if (
    step.kind === 'show-qr' ||
    step.kind === 'upload-slip' ||
    step.kind === 'uploading' ||
    step.kind === 'canceling'
  ) {
    const charge = step.charge;
    const resumed = step.kind === 'show-qr' && step.resumed;
    const canCancel =
      step.kind === 'show-qr' || step.kind === 'upload-slip';
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={goBackToPremium}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3 w-3" />
          กลับไปหน้า Premium
        </button>

        {resumed && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="font-semibold">มีรายการเติมเครดิตค้างอยู่</div>
            <p className="mt-0.5">
              คุณมีรายการเติมเครดิต {formatAmount(charge.amount_thb)} ฿
              ที่ยังไม่เสร็จ ดำเนินการต่อ หรือกดยกเลิกเพื่อเปลี่ยนจำนวน
            </p>
          </div>
        )}

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <QrCode className="h-3.5 w-3.5" />
            ชำระด้วย PromptPay
          </div>
          <div className="mt-3 text-center">
            <div className="text-4xl font-bold text-slate-900">
              {formatAmount(charge.amount_thb)} ฿
            </div>
            <div className="mt-1 text-xs text-slate-500">
              ผู้รับ: {charge.promptpay_receiver_name || '(กำลังตั้งค่า)'}
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <img
              src={charge.qr_data_url}
              alt="PromptPay QR"
              className="h-64 w-64 rounded-lg border border-slate-200"
            />
          </div>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-slate-600">
            <li>เปิดแอปธนาคารของคุณ</li>
            <li>เลือกเมนูสแกน QR</li>
            <li>
              สแกน QR ด้านบนและตรวจสอบจำนวน{' '}
              <strong>{formatAmount(charge.amount_thb)} ฿</strong>
            </li>
            <li>กดยืนยันการโอน</li>
            <li>กลับมาที่นี่และแนบสลิป</li>
          </ol>
        </section>

        {step.kind === 'show-qr' && (
          <button
            type="button"
            onClick={() =>
              setStep({ kind: 'upload-slip', charge, file: null })
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-3 text-base font-semibold text-white shadow-sm hover:from-brand-600 hover:to-amber-600"
          >
            <Upload className="h-4 w-4" />
            ฉันโอนแล้ว แนบสลิป
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                `ยกเลิกรายการเติมเครดิต ${formatAmount(charge.amount_thb)} ฿?\nคุณสามารถสร้างรายการใหม่ด้วยจำนวนอื่นได้ทันที`
              );
              if (ok) void handleCancelExisting(charge.payment_id);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            ยกเลิกและเปลี่ยนจำนวน
          </button>
        )}

        {step.kind === 'canceling' && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังยกเลิก…
          </div>
        )}

        {(step.kind === 'upload-slip' || step.kind === 'uploading') && (
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              แนบสลิปการโอน
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              ถ่ายภาพหรือแคปสลิปจากแอปธนาคาร · ไฟล์ JPG/PNG/WEBP สูงสุด 5 MB
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              disabled={step.kind === 'uploading'}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={step.kind === 'uploading'}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/30 px-4 py-6 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {step.kind === 'upload-slip' && step.file !== null
                ? `เลือกแล้ว: ${step.file.name}`
                : 'แตะเพื่อเลือกไฟล์'}
            </button>

            {step.kind === 'upload-slip' && step.file !== null && (
              <div className="mt-3">
                <img
                  src={URL.createObjectURL(step.file)}
                  alt="Slip preview"
                  className="max-h-48 rounded-lg border border-slate-200 object-contain"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={
                step.kind !== 'upload-slip' || step.file === null
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step.kind === 'uploading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังอัปโหลด…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  ส่งสลิปให้ผู้ดูแลตรวจสอบ
                </>
              )}
            </button>
          </section>
        )}

        {error !== null && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // --- Default: choose-amount or starting ---
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/premium/topup')}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3 w-3" />
        เปลี่ยนวิธีการชำระ
      </button>

      <header>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Coins className="h-5 w-5 text-amber-600" />
          เลือกจำนวนเครดิต
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          1 บาท = 1 credit · แลก premium ได้ตั้งแต่ 150 credit
        </p>
      </header>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          แพ็กเกจมาตรฐาน
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(config?.presets_thb ?? [49, 150, 450, 900, 1800]).map((amt) => (
            <PresetButton
              key={amt}
              amount={amt}
              selected={selectedPreset === amt}
              onClick={() => {
                setSelectedPreset(amt);
                setCustomAmount('');
                setError(null);
              }}
            />
          ))}
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            หรือกำหนดเอง
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={config?.min_thb ?? 50}
              max={config?.max_thb ?? 5000}
              step="1"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedPreset(null);
                setError(null);
              }}
              placeholder={`${config?.min_thb ?? 50} - ${config?.max_thb ?? 5000}`}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <span className="text-sm font-medium text-slate-500">฿</span>
          </div>
        </div>

        {resolvedAmount !== null && config !== null && !amountValid && (
          <p className="mt-2 text-xs text-rose-600">
            กรุณาเลือกจำนวนระหว่าง {formatAmount(config.min_thb)} -{' '}
            {formatAmount(config.max_thb)} ฿
          </p>
        )}
      </section>

      {error !== null && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={!amountValid || step.kind === 'starting'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {step.kind === 'starting' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังสร้าง QR…
          </>
        ) : (
          <>
            <span>ดำเนินการต่อ</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
};
