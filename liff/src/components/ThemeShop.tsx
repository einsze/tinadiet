import { useCallback, useEffect, useState } from 'react';
import { Palette, Check, Loader2, Lock, Sparkles } from 'lucide-react';
import { themesApi } from '../api/themes.js';
import { PALETTES } from '../themes/palettes.js';
import { THEME_META, type ThemeSlug } from '../themes/catalog.js';
import { useSession } from '../state/session.js';
import { useTheme } from '../state/theme.js';
import { formatCredit } from '../types/wallet.js';
import type { ThemeListItem } from '../types/theme.js';

type State =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      themes: ThemeListItem[];
      balanceSatang: number;
    }
  | { kind: 'error'; message: string };

const PalettePreview = ({ slug }: { slug: ThemeSlug }) => {
  const ramp = PALETTES[slug];
  const stops: Array<keyof typeof ramp> = [100, 300, 500, 700];
  return (
    <div className="flex gap-1">
      {stops.map((k) => (
        <span
          key={k}
          className="h-5 w-5 rounded-full ring-1 ring-black/5"
          style={{ background: `rgb(${ramp[k]})` }}
        />
      ))}
    </div>
  );
};

const ThemeCard = ({
  theme,
  balance,
  busySlug,
  onPurchase,
  onActivate,
}: {
  theme: ThemeListItem;
  balance: number;
  busySlug: string | null;
  onPurchase: (slug: ThemeSlug) => void;
  onActivate: (slug: ThemeSlug) => void;
}) => {
  const meta = THEME_META[theme.slug];
  const priceSatang = (theme.price_credit ?? 0) * 100;
  const canAfford = balance >= priceSatang;
  const busy = busySlug === theme.slug;

  const ringClass = theme.is_active
    ? 'ring-2 ring-brand-500'
    : 'ring-1 ring-slate-200';

  return (
    <div
      className={`relative rounded-xl bg-white p-4 shadow-sm transition ${ringClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-lg leading-none">{meta.accent.emoji}</span>
            <h4 className="text-sm font-semibold text-slate-900">
              {meta.name_th}
            </h4>
            <span className="text-[10px] text-slate-400">{meta.name_en}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
            {theme.description_th}
          </p>
          <div className="mt-2">
            <PalettePreview slug={theme.slug} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          {theme.is_default ? (
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              ฟรี
            </div>
          ) : theme.owned ? (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3 w-3" />
              <span>ของฉัน</span>
            </div>
          ) : !theme.for_sale ? (
            <div className="text-[10px] font-medium text-slate-400">
              ยังไม่เปิดขาย
            </div>
          ) : (
            <div className="text-xs font-bold text-amber-700">
              {theme.price_credit} credit
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {theme.is_active ? (
          <button
            type="button"
            disabled
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            กำลังใช้งาน
          </button>
        ) : theme.owned ? (
          <button
            type="button"
            onClick={() => onActivate(theme.slug)}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>ใช้ธีมนี้</span>
          </button>
        ) : theme.for_sale ? (
          <button
            type="button"
            onClick={() => onPurchase(theme.slug)}
            disabled={!canAfford || busy}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              canAfford
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : !canAfford ? (
              <Lock className="h-3.5 w-3.5" />
            ) : null}
            <span>
              {canAfford
                ? `แลก ${theme.price_credit} credit`
                : `ต้องมีอีก ${formatCredit(priceSatang - balance)} credit`}
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400"
          >
            ยังไม่เปิดขาย
          </button>
        )}
      </div>
    </div>
  );
};

type Props = {
  /** Fired after a successful purchase or activate so the parent (e.g.
   * PremiumSection wallet card) can refresh its own balance display. */
  onCreditChange?: () => void | Promise<void>;
};

export const ThemeShop = ({ onCreditChange }: Props = {}) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const { setUser, status: sessionStatus } = useSession();
  const { setActiveSlug } = useTheme();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await themesApi.list();
      setState({
        kind: 'ready',
        themes: res.themes,
        balanceSatang: res.credit_balance_satang,
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

  const syncSessionUser = (
    newBalanceSatang: number | undefined,
    newActiveSlug: ThemeSlug
  ) => {
    if (sessionStatus.kind !== 'authenticated') return;
    setUser({
      ...sessionStatus.user,
      credit_balance_satang:
        newBalanceSatang ?? sessionStatus.user.credit_balance_satang,
      active_theme_slug:
        newActiveSlug === 'default' ? null : newActiveSlug,
    });
  };

  const handlePurchase = async (slug: ThemeSlug) => {
    const ok = window.confirm(
      `แลกธีม "${THEME_META[slug].name_th}" ด้วยเครดิต?\nเครดิตจะถูกหักจากยอดของคุณและจะเป็นของคุณตลอดไป`
    );
    if (!ok) return;
    setBusySlug(slug);
    setFeedback(null);
    try {
      const res = await themesApi.purchase(slug);
      setActiveSlug(res.active_theme_slug);
      syncSessionUser(res.credit_balance_satang, res.active_theme_slug);
      setFeedback({
        tone: 'success',
        text: `ปลดล็อกธีม "${THEME_META[slug].name_th}" สำเร็จ! ใช้งานทันที ✨`,
      });
      await load();
      if (onCreditChange) await onCreditChange();
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setFeedback({
        tone: 'error',
        text: apiErr.message ?? 'ปลดล็อกธีมไม่สำเร็จ ลองอีกครั้งนะคะ',
      });
    } finally {
      setBusySlug(null);
    }
  };

  const handleActivate = async (slug: ThemeSlug) => {
    setBusySlug(slug);
    setFeedback(null);
    try {
      const res = await themesApi.activate(slug);
      setActiveSlug(res.active_theme_slug);
      syncSessionUser(undefined, res.active_theme_slug);
      setFeedback({
        tone: 'success',
        text: `เปลี่ยนเป็นธีม "${THEME_META[slug].name_th}" แล้วค่ะ`,
      });
      await load();
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setFeedback({
        tone: 'error',
        text: apiErr.message ?? 'เปลี่ยนธีมไม่สำเร็จ ลองอีกครั้งนะคะ',
      });
    } finally {
      setBusySlug(null);
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>กำลังโหลดธีม…</span>
        </div>
      </section>
    );
  }
  if (state.kind === 'error') {
    return (
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-xs text-rose-700">โหลดธีมไม่สำเร็จ: {state.message}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-slate-900">ธีม (Themes)</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        แลกธีมด้วยเครดิต — ปลดล็อกครั้งเดียวเป็นของคุณตลอดไป สลับใช้งานได้ทุกเวลา
      </p>

      {feedback !== null && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-xs ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {state.themes.map((t) => (
          <ThemeCard
            key={t.slug}
            theme={t}
            balance={state.balanceSatang}
            busySlug={busySlug}
            onPurchase={handlePurchase}
            onActivate={handleActivate}
          />
        ))}
      </div>
    </section>
  );
};
