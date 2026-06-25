import { useCallback, useEffect, useState } from 'react';
import {
  Gift as GiftIcon,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Share2,
} from 'lucide-react';
import { giftsApi } from '../api/gifts.js';
import { useSession } from '../state/session.js';
import { THEME_META } from '../themes/catalog.js';
import { shareGift } from '../lib/liff.js';
import { env } from '../lib/env.js';
import {
  statusLabel,
  refusedReasonLabel,
  type GiftPayload,
  type GiftStatus,
  type ReceivedGift,
  type SentGift,
} from '../types/gift.js';
import { formatCredit } from '../types/wallet.js';

type LoadedData = {
  sent: SentGift[];
  received: ReceivedGift[];
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

const describePayload = (
  gift_type: 'premium' | 'theme',
  payload: GiftPayload
): string => {
  if (gift_type === 'premium' && 'months' in payload) {
    const m = payload.months;
    const label = m === '7d' ? '7 วัน' : `${m} เดือน`;
    return `Premium ${label}`;
  }
  if (gift_type === 'theme' && 'theme_slug' in payload) {
    const meta =
      THEME_META[payload.theme_slug as keyof typeof THEME_META] ??
      ({ name_th: payload.theme_slug, accent: { emoji: '🎨' } } as const);
    return `ธีม ${meta.name_th}`;
  }
  return '—';
};

const StatusIcon = ({ status }: { status: GiftStatus }) => {
  const cls = 'h-3.5 w-3.5';
  switch (status) {
    case 'claimed':
      return <CheckCircle2 className={`${cls} text-emerald-600`} />;
    case 'canceled':
    case 'refused':
    case 'revoked':
      return <XCircle className={`${cls} text-rose-600`} />;
    case 'expired':
      return <AlertCircle className={`${cls} text-amber-600`} />;
    case 'pending':
    default:
      return <Clock className={`${cls} text-slate-500`} />;
  }
};

const buildClaimUrl = (token: string): string => {
  // Use LIFF deep link form so LINE auto-opens the LIFF webview (with auth
  // context) instead of the generic LINE smart browser.
  return `https://liff.line.me/${env.LIFF_ID}/claim/${token}`;
};

const SentRow = ({
  gift,
  busyId,
  onCancel,
}: {
  gift: SentGift;
  busyId: number | null;
  onCancel: (id: number) => void;
}) => {
  const isPending = gift.status === 'pending';
  const url = buildClaimUrl(gift.claim_token);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Link:', url);
    }
  };

  const handleShare = async () => {
    const subject = describePayload(gift.gift_type, gift.payload);
    const title = `🎁 ${subject}`;
    const text =
      gift.message !== null && gift.message.length > 0
        ? `🎁 ${subject}\n"${gift.message}"`
        : `🎁 ${subject}`;
    const result = await shareGift(title, text, url);
    if (result === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else if (result === 'unsupported') {
      window.prompt('Link:', url);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StatusIcon status={gift.status} />
            <span className="text-xs font-medium text-slate-700">
              {statusLabel(gift.status)}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {describePayload(gift.gift_type, gift.payload)}
          </div>
          {gift.message !== null && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 italic">
              "{gift.message}"
            </p>
          )}
          <div className="mt-1 text-[10px] text-slate-400">
            {formatDate(gift.created_at)} · {formatCredit(gift.credit_spent_satang)} credit
          </div>
          {gift.status === 'refused' && (
            <div className="mt-1 text-[10px] text-rose-600">
              {refusedReasonLabel(gift.refused_reason)}
            </div>
          )}
          {gift.status === 'revoked' && gift.revoke_reason !== null && (
            <div className="mt-1 text-[10px] text-rose-600 italic">
              "{gift.revoke_reason}"
            </div>
          )}
        </div>
      </div>

      {isPending && (
        <div className="mt-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex items-center justify-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
            >
              <Copy className="h-3 w-3" />
              <span>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex items-center justify-center gap-1 rounded-md bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white"
            >
              <Share2 className="h-3 w-3" />
              <span>แชร์</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => onCancel(gift.id)}
            disabled={busyId === gift.id}
            className="w-full rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {busyId === gift.id ? 'กำลังยกเลิก…' : 'ยกเลิกหัตถ์การให้นี้'}
          </button>
        </div>
      )}
    </div>
  );
};

const ReceivedRow = ({ gift }: { gift: ReceivedGift }) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <StatusIcon status={gift.status} />
        <span className="text-xs font-medium text-slate-700">
          {statusLabel(gift.status)}
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {describePayload(gift.gift_type, gift.payload)}
      </div>
      {gift.message !== null && (
        <p className="mt-0.5 text-[11px] text-slate-500 italic">
          "{gift.message}"
        </p>
      )}
      <div className="mt-1 text-[10px] text-slate-400">
        จาก {gift.sender_display_name ?? 'เพื่อน'} · {formatDate(gift.claimed_at)}
      </div>
    </div>
  );
};

export const GiftsPage = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { setUser, status: sessionStatus } = useSession();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [sent, received] = await Promise.all([
        giftsApi.listSent(50),
        giftsApi.listReceived(50),
      ]);
      setState({
        kind: 'ready',
        data: { sent: sent.gifts, received: received.gifts },
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

  const handleCancel = async (id: number) => {
    if (!window.confirm('ยกเลิกหัตถ์การให้นี้? เครดิตจะถูกคืนทันที')) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await giftsApi.cancel(id);
      if (sessionStatus.kind === 'authenticated') {
        setUser({
          ...sessionStatus.user,
          credit_balance_satang: res.credit_balance_satang,
        });
      }
      setMessage('ยกเลิกสำเร็จ เครดิตคืนเข้าบัญชีแล้วค่ะ');
      await load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMessage(apiErr.message ?? 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>กำลังโหลด…</span>
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

  const { sent, received } = state.data;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-gradient-to-br from-amber-50 via-white to-brand-50 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <GiftIcon className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-900">หัตถ์การให้</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          ส่งของขวัญให้เพื่อน หรือดูประวัติของที่คุณได้รับ
        </p>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('sent')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'sent'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          ส่งไป ({sent.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('received')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'received'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          ได้รับ ({received.length})
        </button>
      </div>

      {message !== null && (
        <p
          className={`rounded-md px-3 py-2 text-xs ${
            message.includes('สำเร็จ')
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {message}
        </p>
      )}

      {tab === 'sent' && (
        <div className="space-y-2.5">
          {sent.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center text-xs text-slate-400 shadow-sm">
              คุณยังไม่ได้ส่งของขวัญใครเลย
              <br />
              ไปที่หน้า Premium เพื่อส่งของขวัญ
            </div>
          ) : (
            sent.map((g) => (
              <SentRow
                key={g.id}
                gift={g}
                busyId={busyId}
                onCancel={handleCancel}
              />
            ))
          )}
        </div>
      )}

      {tab === 'received' && (
        <div className="space-y-2.5">
          {received.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center text-xs text-slate-400 shadow-sm">
              ยังไม่มีของขวัญที่ได้รับ
            </div>
          ) : (
            received.map((g) => <ReceivedRow key={g.id} gift={g} />)
          )}
        </div>
      )}
    </div>
  );
};
