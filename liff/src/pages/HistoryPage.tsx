import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../state/session.js';
import { historyApi, type HistoryResponse } from '../api/history.js';
import { formatKcalRange } from '../types/foodLog.js';
import { KcalRing } from '../components/KcalRing.js';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: HistoryResponse }
  | { kind: 'error'; status: number; code: string; message: string };

const MacroProgress = ({
  label,
  consumed,
  goal,
  tone,
}: {
  label: string;
  consumed: number;
  goal: number;
  tone: 'protein' | 'carbs' | 'fat';
}) => {
  const ratio = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const barClass =
    tone === 'protein'
      ? 'bg-rose-400'
      : tone === 'carbs'
        ? 'bg-amber-400'
        : 'bg-sky-400';
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xs tabular-nums text-slate-700">
          <span className="font-semibold">{consumed}</span>
          <span className="text-slate-400"> / {goal} g</span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${barClass}`}
          style={{ width: `${ratio * 100}%`, transition: 'width 400ms ease-out' }}
        />
      </div>
    </div>
  );
};

const formatDateThai = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const HistoryPage = () => {
  const { status } = useSession();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [allowedRange, setAllowedRange] = useState<{
    min: string;
    max: string;
  } | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async (date?: string) => {
    setState({ kind: 'loading' });
    try {
      const data = await historyApi.get(date);
      setState({ kind: 'ready', data });
      setSelectedDate(data.date);
      setAllowedRange(data.allowed_range);
    } catch (err) {
      const apiErr = err as {
        status?: number;
        code?: string;
        message?: string;
      };
      setState({
        kind: 'error',
        status: apiErr.status ?? 0,
        code: apiErr.code ?? 'UNKNOWN',
        message: apiErr.message ?? 'Failed to load history',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (status.kind !== 'authenticated') return null;

  const onDateChange = (newDate: string) => {
    if (newDate === '' || newDate === selectedDate) return;
    void load(newDate);
  };

  const data = state.kind === 'ready' ? state.data : null;
  const isToday = data !== null && data.date === allowedRange?.max;
  const isPremium = data?.is_premium ?? false;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            ดูประวัติย้อนหลัง
          </h2>
          {!isPremium ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              ฟรี · 30 วัน
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-100 to-rose-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              ⭐ Premium · 365 วัน
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          เลือกวันที่เพื่อดูบันทึกอาหารและน้ำหนัก
        </p>

        <label className="mt-4 block">
          <span className="block text-xs font-medium text-slate-600">
            วันที่
          </span>
          <input
            type="date"
            value={selectedDate}
            min={allowedRange?.min}
            max={allowedRange?.max}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {allowedRange !== null ? (
            <span className="mt-1 block text-[11px] text-slate-400">
              เลือกได้ตั้งแต่ {allowedRange.min} ถึง {allowedRange.max}
            </span>
          ) : null}
        </label>
      </section>

      {state.kind === 'loading' ? (
        <section className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          กำลังโหลด…
        </section>
      ) : null}

      {state.kind === 'error' && state.code === 'DATE_OUT_OF_RANGE' ? (
        <section className="rounded-xl bg-gradient-to-br from-amber-50 via-rose-50 to-pink-50 p-6 shadow-sm">
          <div className="text-center">
            <div className="text-3xl">🔒</div>
            <h3 className="mt-2 text-base font-bold text-slate-900">
              ดูประวัติย้อนหลังได้ไม่เกิน 30 วัน
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              อัปเกรด Premium เพื่อดูประวัติย้อนหลังถึง 1 ปี
            </p>
            <Link
              to="/premium"
              className="mt-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-500 hover:to-rose-500"
            >
              อัปเกรด Premium →
            </Link>
          </div>
        </section>
      ) : null}

      {state.kind === 'error' && state.code !== 'DATE_OUT_OF_RANGE' ? (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-rose-700">เกิดข้อผิดพลาด: {state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            ลองอีกครั้ง
          </button>
        </section>
      ) : null}

      {data !== null ? (
        <>
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {isToday ? 'วันนี้' : 'สรุปวันนั้น'}
              </h3>
              <span className="text-xs text-slate-500">
                {formatDateThai(data.date)}
              </span>
            </div>

            <div className="relative mt-4 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 p-6">
              <KcalRing
                consumed={data.food_totals.kcal}
                goal={data.goals.daily_calorie_goal ?? 0}
              />
            </div>

            <div className="mt-4 space-y-2">
              <MacroProgress
                label="Protein"
                consumed={data.food_totals.protein_g}
                goal={data.goals.daily_protein_g ?? 0}
                tone="protein"
              />
              <MacroProgress
                label="Carbs"
                consumed={data.food_totals.carbs_g}
                goal={data.goals.daily_carbs_g ?? 0}
                tone="carbs"
              />
              <MacroProgress
                label="Fat"
                consumed={data.food_totals.fat_g}
                goal={data.goals.daily_fat_g ?? 0}
                tone="fat"
              />
            </div>
            {!isToday ? (
              <p className="mt-3 text-[11px] text-slate-400">
                * เปรียบเทียบกับเป้าหมายปัจจุบัน
              </p>
            ) : null}
          </section>

          {data.weight_log !== null ? (
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚖️</span>
                <div className="flex-1">
                  <div className="text-xs text-slate-500">น้ำหนักวันนั้น</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    {data.weight_log.weight_kg.toFixed(1)} kg
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              บันทึกอาหาร
            </h3>
            {data.food_logs.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                <p className="text-sm text-slate-500">
                  ไม่มีบันทึกอาหารในวันนี้
                </p>
                {!isToday ? (
                  <Link
                    to="/"
                    className="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline"
                  >
                    กลับวันนี้
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.food_logs.map((log) => (
                  <li key={log.id} className="flex items-start gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {log.food_name_th ??
                          log.food_name_en ??
                          log.raw_text ??
                          'Food'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {log.quantity_text !== null
                          ? `${log.quantity_text} · `
                          : ''}
                        {log.meal_type ?? log.source}
                      </div>
                    </div>
                    <div className="text-right text-sm shrink-0">
                      <div className="font-semibold text-slate-900 tabular-nums">
                        {formatKcalRange(log.kcal_low, log.kcal_high, log.kcal)}
                        <span className="ml-0.5 text-xs font-normal text-slate-500">
                          kcal
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 tabular-nums">
                        {Math.round(log.protein_g)}p ·{' '}
                        {Math.round(log.carbs_g)}c · {Math.round(log.fat_g)}f
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!isPremium ? (
            <Link
              to="/premium"
              className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 via-rose-50 to-pink-50 p-4 shadow-sm transition hover:from-amber-100 hover:via-rose-100 hover:to-pink-100"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                ⭐
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  อัปเกรด Premium
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  ดูประวัติย้อนหลังถึง 365 วัน
                </div>
              </div>
              <div className="shrink-0 text-slate-400">→</div>
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
