import { useCallback, useEffect, useState } from 'react';
import { foodLogsApi } from '../api/foodLogs.js';
import type { FoodLog, FoodLogTotals } from '../types/foodLog.js';
import type { User } from '../types/user.js';
import { KcalRing } from './KcalRing.js';
import { ManualLogForm } from './ManualLogForm.js';
import { WeightSection } from './WeightSection.js';

const StatRow = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) => (
  <div className="flex items-center justify-between py-2">
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="text-sm font-medium text-slate-900">
      {value}
      {unit !== undefined ? (
        <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
      ) : null}
    </dd>
  </div>
);

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

type Props = {
  user: User;
  streak: number;
  onEditProfile: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; date: string; logs: FoodLog[]; totals: FoodLogTotals }
  | { kind: 'error'; message: string };

export const Dashboard = ({ user, streak, onEditProfile }: Props) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await foodLogsApi.listToday();
      setState({
        kind: 'ready',
        date: res.date,
        logs: res.logs,
        totals: res.totals,
      });
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

  const handleDelete = async (log: FoodLog) => {
    const name = log.food_name_th ?? log.food_name_en ?? log.raw_text ?? 'this log';
    if (!window.confirm(`ลบ "${name}" ?`)) return;
    setDeletingId(log.id);
    try {
      await foodLogsApi.delete(log.id);
      await load();
    } catch (err) {
      const message =
        err !== null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      window.alert(`Failed to delete: ${message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const goal = user.daily_calorie_goal ?? 0;
  const proteinGoal = user.daily_protein_g ?? 0;
  const carbsGoal = user.daily_carbs_g ?? 0;
  const fatGoal = user.daily_fat_g ?? 0;

  const totals: FoodLogTotals =
    state.kind === 'ready'
      ? state.totals
      : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, count: 0 };

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Hi{user.display_name ? `, ${user.display_name}` : ''} 👋
          </h2>
          <div className="flex items-center gap-2">
            {streak >= 2 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
                aria-label={`Streak ${streak} days`}
              >
                🔥 {streak}d
              </span>
            ) : null}
            <button
              type="button"
              onClick={onEditProfile}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Edit profile
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {state.kind === 'ready' ? `Today · ${state.date}` : 'Today'}
        </p>

        <div className="mt-4 flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-6">
          <KcalRing consumed={totals.kcal} goal={goal} />
        </div>

        <div className="mt-4 space-y-2">
          <MacroProgress
            label="Protein"
            consumed={totals.protein_g}
            goal={proteinGoal}
            tone="protein"
          />
          <MacroProgress
            label="Carbs"
            consumed={totals.carbs_g}
            goal={carbsGoal}
            tone="carbs"
          />
          <MacroProgress
            label="Fat"
            consumed={totals.fat_g}
            goal={fatGoal}
            tone="fat"
          />
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Today&apos;s logs</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {showAddForm ? 'Close' : '+ Add log'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>

        {showAddForm ? (
          <ManualLogForm
            onCancel={() => setShowAddForm(false)}
            onSaved={() => {
              setShowAddForm(false);
              void load();
            }}
          />
        ) : null}

        {state.kind === 'loading' ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="mt-3 text-sm text-rose-700">Error: {state.message}</p>
        ) : null}

        {state.kind === 'ready' && state.logs.length === 0 && !showAddForm ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
            <p className="text-sm text-slate-500">ยังไม่มีบันทึกอาหารวันนี้</p>
            <p className="mt-1 text-xs text-slate-400">
              พิมพ์อาหารที่ทานในแชต TinaDiet เพื่อบันทึกอัตโนมัติ
            </p>
          </div>
        ) : null}

        {state.kind === 'ready' && state.logs.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {state.logs.map((log) => {
              const isDeleting = deletingId === log.id;
              const isEditing = editingLogId === log.id;
              if (isEditing) {
                return (
                  <li key={log.id} className="py-3">
                    <ManualLogForm
                      initial={log}
                      onCancel={() => setEditingLogId(null)}
                      onSaved={() => {
                        setEditingLogId(null);
                        void load();
                      }}
                    />
                  </li>
                );
              }
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-1.5 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {log.food_name_th ?? log.food_name_en ?? log.raw_text ?? 'Food'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.quantity_text !== null ? `${log.quantity_text} · ` : ''}
                      {log.meal_type ?? log.source}
                    </div>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <div className="font-semibold text-slate-900">
                      {Math.round(log.kcal)}
                      <span className="ml-0.5 text-xs font-normal text-slate-500">kcal</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {Math.round(log.protein_g)}p · {Math.round(log.carbs_g)}c ·{' '}
                      {Math.round(log.fat_g)}f
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingLogId(log.id)}
                    aria-label={`Edit ${log.food_name_th ?? 'log'}`}
                    className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.5 1.5 12.5 4.5 4.5 12.5 1.5 12.5 1.5 9.5z" />
                      <line x1="8" y1="3" x2="11" y2="6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(log)}
                    disabled={isDeleting}
                    aria-label={`Delete ${log.food_name_th ?? 'log'}`}
                    className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <line x1="3" y1="3" x2="11" y2="11" />
                      <line x1="11" y1="3" x2="3" y2="11" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <WeightSection />

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Your profile</h3>
        <dl className="mt-2 divide-y divide-slate-100">
          <StatRow label="Gender" value={user.gender ?? '—'} />
          <StatRow label="Height" value={user.height_cm ?? '—'} unit="cm" />
          <StatRow
            label="Current weight"
            value={user.current_weight_kg ?? '—'}
            unit="kg"
          />
          <StatRow
            label="Target weight"
            value={user.target_weight_kg ?? '—'}
            unit="kg"
          />
          <StatRow label="Activity" value={user.activity_level ?? '—'} />
          <StatRow label="Goal" value={user.goal_type ?? '—'} />
          <StatRow label="BMR" value={user.bmr_kcal ?? '—'} unit="kcal" />
          <StatRow label="TDEE" value={user.tdee_kcal ?? '—'} unit="kcal" />
        </dl>
      </section>
    </div>
  );
};
