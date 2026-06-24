import { useState } from 'react';
import {
  Gift,
  Loader2,
  X,
  Copy,
  Share2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { giftsApi } from '../api/gifts.js';
import { useSession } from '../state/session.js';
import { formatCredit } from '../types/wallet.js';
import { THEME_META, type ThemeSlug } from '../themes/catalog.js';
import { shareGift } from '../lib/liff.js';
import type { GiftPayload, GiftType } from '../types/gift.js';

type Props = {
  open: boolean;
  onClose: () => void;
  giftType: GiftType;
  payload: GiftPayload;
  priceCredit: number;
  /** Label shown for the gift subject, e.g. "Premium 1 เดือน" or "ธีม Sakura". */
  subjectLabel: string;
};

type LocalState =
  | { kind: 'compose' }
  | { kind: 'creating' }
  | {
      kind: 'created';
      claim_url: string;
      gift_id: number;
      expires_at: string;
    }
  | { kind: 'error'; message: string };

const formatExpiry = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const GiftCreateModal = ({
  open,
  onClose,
  giftType,
  payload,
  priceCredit,
  subjectLabel,
}: Props) => {
  const [state, setState] = useState<LocalState>({ kind: 'compose' });
  const [message, setMessage] = useState('');
  const [copyDone, setCopyDone] = useState(false);
  const { status: sessionStatus, setUser } = useSession();

  if (!open) return null;

  const balance =
    sessionStatus.kind === 'authenticated'
      ? sessionStatus.user.credit_balance_satang
      : 0;
  const balanceLabel = formatCredit(balance);
  const priceSatang = priceCredit * 100;
  const canAfford = balance >= priceSatang;

  const handleClose = () => {
    setState({ kind: 'compose' });
    setMessage('');
    setCopyDone(false);
    onClose();
  };

  const handleCreate = async () => {
    if (!canAfford) return;
    setState({ kind: 'creating' });
    try {
      const res = await giftsApi.create({
        gift_type: giftType,
        payload,
        message: message.trim().length === 0 ? null : message.trim(),
      });
      // optimistic balance sync
      if (sessionStatus.kind === 'authenticated') {
        setUser({
          ...sessionStatus.user,
          credit_balance_satang: res.credit_balance_satang,
        });
      }
      setState({
        kind: 'created',
        claim_url: res.claim_url,
        gift_id: res.gift_id,
        expires_at: res.claim_expires_at,
      });
    } catch (err) {
      const apiErr = err as { message?: string };
      setState({
        kind: 'error',
        message: apiErr.message ?? 'สร้างหัตถ์การให้ไม่สำเร็จ ลองอีกครั้งนะคะ',
      });
    }
  };

  const handleCopy = async () => {
    if (state.kind !== 'created') return;
    try {
      await navigator.clipboard.writeText(state.claim_url);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      window.prompt('คัดลอก link:', state.claim_url);
    }
  };

  const handleShare = async () => {
    if (state.kind !== 'created') return;
    const title = `🎁 ${subjectLabel}`;
    const text =
      message.trim().length > 0
        ? `🎁 ${subjectLabel}\n"${message.trim()}"`
        : `🎁 ${subjectLabel}`;
    const result = await shareGift(title, text, state.claim_url);
    if (result === 'copied') {
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } else if (result === 'unsupported') {
      window.prompt('คัดลอก link:', state.claim_url);
    }
  };

  const themeInPayload =
    giftType === 'theme' && 'theme_slug' in payload
      ? THEME_META[payload.theme_slug as ThemeSlug]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-brand-100 ring-1 ring-amber-200">
            <Gift className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              ส่งหัตถ์การให้
            </h3>
            <p className="text-[11px] text-slate-500">
              {subjectLabel} · {priceCredit} credit
            </p>
          </div>
        </header>

        {state.kind === 'compose' && (
          <div className="space-y-3">
            {themeInPayload && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <span className="text-lg">{themeInPayload.accent.emoji}</span>
                <div>
                  <div className="font-medium text-slate-800">
                    ธีม {themeInPayload.name_th}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {themeInPayload.name_en}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-600">
                ข้อความ (ไม่บังคับ, สูงสุด 200 ตัวอักษร)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="สุขสันต์วันเกิดนะ! 💖"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <div className="mt-0.5 text-right text-[10px] text-slate-400">
                {message.length}/200
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900">
              💡 Link สำหรับรับของขวัญใช้ได้ภายใน 7 วัน คุณสามารถ
              <strong> ยกเลิกได้</strong>ตลอดเวลาถ้ายังไม่มีคนรับ
              เครดิตจะคืนเข้าบัญชีของคุณทันที
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">เครดิตของคุณ</span>
                <span className="font-medium text-slate-900">
                  {balanceLabel}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">ราคา</span>
                <span className="font-bold text-amber-700">
                  − {priceCredit} credit
                </span>
              </div>
              <div className="mt-1 border-t border-slate-200 pt-1.5 flex items-center justify-between">
                <span className="text-slate-500">คงเหลือ</span>
                <span
                  className={`font-semibold ${
                    canAfford ? 'text-slate-900' : 'text-rose-700'
                  }`}
                >
                  {formatCredit(Math.max(0, balance - priceSatang))}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!canAfford}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Gift className="h-4 w-4" />
              <span>
                {canAfford
                  ? 'สร้าง link ของขวัญ'
                  : `ต้องมีอีก ${formatCredit(priceSatang - balance)} credit`}
              </span>
            </button>
          </div>
        )}

        {state.kind === 'creating' && (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>กำลังสร้าง link…</span>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{state.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setState({ kind: 'compose' })}
              className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {state.kind === 'created' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <div>
                <div className="font-semibold">สร้าง link สำเร็จ!</div>
                <div className="mt-0.5">
                  ใช้ได้ถึง {formatExpiry(state.expires_at)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <code className="block break-all text-[11px] text-slate-700">
                {state.claim_url}
              </code>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copyDone ? 'คัดลอกแล้ว ✓' : 'คัดลอก link'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-amber-500 px-3 py-2 text-xs font-semibold text-white"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>แชร์</span>
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 p-2.5 text-[10px] text-amber-900">
              💡 ดูสถานะของขวัญที่ส่งได้ที่หน้า "ของขวัญของฉัน"
              สามารถยกเลิกได้ตลอดเวลาถ้ายังไม่มีคนรับ
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
