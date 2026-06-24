import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Gift as GiftIcon,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Crown,
  Palette,
} from 'lucide-react';
import { giftsApi } from '../api/gifts.js';
import { useSession } from '../state/session.js';
import { useTheme } from '../state/theme.js';
import { THEME_META, resolveThemeSlug } from '../themes/catalog.js';
import type { ClaimPreview, GiftPayload } from '../types/gift.js';
import { statusLabel } from '../types/gift.js';

type State =
  | { kind: 'loading' }
  | { kind: 'preview'; preview: ClaimPreview }
  | { kind: 'claiming'; preview: ClaimPreview }
  | { kind: 'claimed'; subject: string; payload: GiftPayload }
  | { kind: 'error'; code?: string; message: string };

const describePayload = (
  gift_type: 'premium' | 'theme',
  payload: GiftPayload
): { label: string; subtitle: string } => {
  if (gift_type === 'premium' && 'months' in payload) {
    return {
      label: `Premium ${payload.months} เดือน`,
      subtitle: 'เข้าถึงฟีเจอร์ Premium ทั้งหมดเพิ่มอีก',
    };
  }
  if (gift_type === 'theme' && 'theme_slug' in payload) {
    const meta = THEME_META[resolveThemeSlug(payload.theme_slug)];
    return {
      label: `ธีม ${meta.name_th}`,
      subtitle: meta.name_en,
    };
  }
  return { label: '—', subtitle: '' };
};

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

export const ClaimPage = () => {
  const params = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setUser, status: sessionStatus } = useSession();
  const { setActiveSlug } = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const token = params.token ?? '';

  const loadPreview = useCallback(async () => {
    if (token.length === 0) {
      setState({ kind: 'error', message: 'Token ไม่ถูกต้อง' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const preview = await giftsApi.preview(token);
      setState({ kind: 'preview', preview });
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setState({
        kind: 'error',
        code: apiErr.code,
        message: apiErr.message ?? 'ไม่พบ link ของขวัญ',
      });
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleClaim = async () => {
    if (state.kind !== 'preview') return;
    const preview = state.preview;
    setState({ kind: 'claiming', preview });
    try {
      const res = await giftsApi.claim(token);
      // Sync session user
      if (sessionStatus.kind === 'authenticated') {
        setUser({
          ...sessionStatus.user,
          premium_expires_at: res.recipient_user.premium_expires_at,
          active_theme_slug: res.recipient_user.active_theme_slug,
          credit_balance_satang: res.recipient_user.credit_balance_satang,
        });
      }
      // If theme gift, apply palette via ThemeProvider override
      if (
        res.gift_type === 'theme' &&
        'theme_slug' in res.payload &&
        typeof res.payload.theme_slug === 'string'
      ) {
        setActiveSlug(resolveThemeSlug(res.payload.theme_slug));
      }
      const desc = describePayload(res.gift_type, res.payload);
      setState({
        kind: 'claimed',
        subject: desc.label,
        payload: res.payload,
      });
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setState({
        kind: 'error',
        code: apiErr.code,
        message: apiErr.message ?? 'รับของขวัญไม่สำเร็จ',
      });
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className="rounded-xl bg-white p-8 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
        <p className="mt-3 text-xs text-slate-500">กำลังตรวจสอบ link…</p>
      </section>
    );
  }

  if (state.kind === 'error') {
    const isUnclaimable =
      state.code === 'GIFT_NOT_PENDING' ||
      state.code === 'GIFT_EXPIRED' ||
      state.code === 'SELF_CLAIM' ||
      state.code === 'RECIPIENT_BLOCKED' ||
      state.code === 'RECIPIENT_ALREADY_OWNS_THEME' ||
      state.code === 'GIFT_NOT_FOUND';
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              ไม่สามารถรับของขวัญได้
            </h3>
            <p className="mt-1 text-xs text-slate-600">{state.message}</p>
            {state.code && (
              <p className="mt-2 text-[10px] text-slate-400">
                Code: {state.code}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          {isUnclaimable ? 'กลับหน้าแรก' : 'ลองอีกครั้ง'}
        </button>
      </section>
    );
  }

  if (state.kind === 'claimed') {
    return (
      <section className="space-y-3">
        <div className="rounded-2xl bg-gradient-to-br from-amber-100 via-brand-50 to-pink-50 p-6 shadow-sm">
          <div className="text-center">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md">
              <Sparkles className="h-7 w-7 text-amber-500" />
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              รับของขวัญเรียบร้อย! 🎉
            </h2>
            <p className="mt-1 text-sm font-semibold text-amber-700">
              {state.subject}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              ขอบคุณที่ใช้ Tina ✨
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full rounded-lg bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          ไปหน้าแรก
        </button>
      </section>
    );
  }

  // preview or claiming
  const preview = state.preview;
  const desc = describePayload(preview.gift_type, preview.payload);
  const Icon = preview.gift_type === 'premium' ? Crown : Palette;
  const claiming = state.kind === 'claiming';

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-brand-50 to-pink-50 p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md">
            <GiftIcon className="h-7 w-7 text-amber-500" />
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-wide text-amber-700">
            หัตถ์การให้สำหรับคุณ
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {desc.label}
          </h2>
          {desc.subtitle.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">{desc.subtitle}</p>
          )}
          {preview.sender_display_name !== null && (
            <p className="mt-3 text-xs text-slate-600">
              จาก <span className="font-semibold">{preview.sender_display_name}</span>
            </p>
          )}
        </div>

        {preview.message !== null && (
          <div className="mt-4 rounded-lg bg-white/70 p-3 text-center text-xs italic text-slate-700">
            "{preview.message}"
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2 text-xs">
          <Icon className="h-4 w-4 flex-shrink-0 text-brand-500" />
          <div className="text-slate-600">
            <div>
              สถานะ:{' '}
              <span className="font-medium text-slate-900">
                {statusLabel(preview.status)}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              link หมดอายุ {formatExpiry(preview.claim_expires_at)}
            </div>
          </div>
        </div>
      </section>

      {preview.status !== 'pending' ? (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          ของขวัญนี้ {statusLabel(preview.status)} แล้ว ไม่สามารถรับซ้ำได้
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={claiming}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {claiming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <span>{claiming ? 'กำลังรับ…' : 'รับของขวัญ'}</span>
        </button>
      )}
    </div>
  );
};
