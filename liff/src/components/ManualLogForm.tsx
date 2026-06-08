import { useState, type FormEvent } from 'react';
import { foodLogsApi } from '../api/foodLogs.js';
import type { FoodLog, MealType } from '../types/foodLog.js';

const MEAL_OPTIONS: ReadonlyArray<{ value: MealType | ''; label: string }> = [
  { value: '', label: '—' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const parseNumber = (raw: string): number | undefined => {
  if (raw.length === 0) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const initialName = (log: FoodLog): string =>
  log.food_name_th ?? log.food_name_en ?? log.raw_text ?? '';

type Props = {
  onSaved: (log: FoodLog) => void;
  onCancel: () => void;
  initial?: FoodLog;
};

export const ManualLogForm = ({ onSaved, onCancel, initial }: Props) => {
  const isEdit = initial !== undefined;
  const [name, setName] = useState<string>(
    initial !== undefined ? initialName(initial) : ''
  );
  const [kcal, setKcal] = useState<number | undefined>(initial?.kcal);
  const [protein, setProtein] = useState<number | undefined>(
    initial?.protein_g
  );
  const [carbs, setCarbs] = useState<number | undefined>(initial?.carbs_g);
  const [fat, setFat] = useState<number | undefined>(initial?.fat_g);
  const [mealType, setMealType] = useState<MealType | ''>(
    initial?.meal_type ?? ''
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValid = name.trim().length > 0 && kcal !== undefined && kcal >= 0;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const trimmed = name.trim();
      const payload = {
        food_name_th: trimmed,
        food_name_en: initial?.food_name_en ?? null,
        kcal: kcal ?? 0,
        protein_g: protein ?? 0,
        carbs_g: carbs ?? 0,
        fat_g: fat ?? 0,
        meal_type: mealType === '' ? null : mealType,
      };
      let res;
      if (isEdit && initial !== undefined) {
        res = await foodLogsApi.update(initial.id, payload);
      } else {
        res = await foodLogsApi.create({
          ...payload,
          raw_text: trimmed,
        });
      }
      onSaved(res.log);
    } catch (err) {
      const message =
        err !== null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      {isEdit ? (
        <div className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Edit log
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">Food name *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="ผัดกะเพรา"
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Kcal *</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={5000}
            step="1"
            value={kcal ?? ''}
            onChange={(e) => setKcal(parseNumber(e.target.value))}
            className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="450"
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Meal type</span>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType | '')}
            className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {MEAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Protein (g)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={500}
            step="0.1"
            value={protein ?? ''}
            onChange={(e) => setProtein(parseNumber(e.target.value))}
            className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="0"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Carbs (g)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={1000}
            step="0.1"
            value={carbs ?? ''}
            onChange={(e) => setCarbs(parseNumber(e.target.value))}
            className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="0"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Fat (g)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={500}
            step="0.1"
            value={fat ?? ''}
            onChange={(e) => setFat(parseNumber(e.target.value))}
            className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="0"
          />
        </label>
      </div>

      {errorMessage !== null ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid || submitting}
          className="flex-1 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save log'}
        </button>
      </div>
    </form>
  );
};
