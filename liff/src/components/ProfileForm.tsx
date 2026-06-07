import { useMemo, useState, type FormEvent } from 'react';
import { usersApi } from '../api/users.js';
import type {
  ActivityLevel,
  Gender,
  GoalType,
  ProfileInput,
  User,
} from '../types/user.js';

const ACTIVITY_OPTIONS: ReadonlyArray<{
  value: ActivityLevel;
  label: string;
  hint: string;
}> = [
  { value: 'sedentary', label: 'Sedentary', hint: 'Sedikit/tidak olahraga' },
  { value: 'light', label: 'Light', hint: 'Olahraga ringan 1–3x/minggu' },
  { value: 'moderate', label: 'Moderate', hint: 'Olahraga sedang 3–5x/minggu' },
  { value: 'active', label: 'Active', hint: 'Olahraga berat 6–7x/minggu' },
  { value: 'very_active', label: 'Very active', hint: 'Atlet / kerja fisik berat' },
];

const GOAL_OPTIONS: ReadonlyArray<{ value: GoalType; label: string; hint: string }> = [
  { value: 'loss', label: 'Lose weight', hint: '−500 kcal/day' },
  { value: 'maintain', label: 'Maintain', hint: 'TDEE level' },
  { value: 'gain', label: 'Gain weight', hint: '+300 kcal/day' },
];

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const today = () => new Date().toISOString().slice(0, 10);

const defaultProfile = (existing: User): Partial<ProfileInput> => ({
  gender: existing.gender ?? undefined,
  date_of_birth: existing.date_of_birth ?? undefined,
  height_cm: existing.height_cm ?? undefined,
  current_weight_kg: existing.current_weight_kg ?? undefined,
  target_weight_kg: existing.target_weight_kg ?? undefined,
  activity_level: existing.activity_level ?? undefined,
  goal_type: existing.goal_type ?? undefined,
});

const parseNumberInput = (raw: string): number | undefined => {
  if (raw.length === 0) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

type Props = {
  user: User;
  onSaved: (user: User) => void;
};

export const ProfileForm = ({ user, onSaved }: Props) => {
  const initial = useMemo(() => defaultProfile(user), [user]);
  const [gender, setGender] = useState<Gender | undefined>(initial.gender);
  const [dob, setDob] = useState<string>(initial.date_of_birth ?? '');
  const [heightCm, setHeightCm] = useState<number | undefined>(initial.height_cm);
  const [currentKg, setCurrentKg] = useState<number | undefined>(
    initial.current_weight_kg
  );
  const [targetKg, setTargetKg] = useState<number | undefined>(
    initial.target_weight_kg
  );
  const [activity, setActivity] = useState<ActivityLevel | undefined>(
    initial.activity_level
  );
  const [goal, setGoal] = useState<GoalType | undefined>(initial.goal_type);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValid =
    gender !== undefined &&
    dob.length === 10 &&
    heightCm !== undefined &&
    currentKg !== undefined &&
    targetKg !== undefined &&
    activity !== undefined &&
    goal !== undefined;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: ProfileInput = {
        gender: gender!,
        date_of_birth: dob,
        height_cm: heightCm!,
        current_weight_kg: currentKg!,
        target_weight_kg: targetKg!,
        activity_level: activity!,
        goal_type: goal!,
      };
      const res = await usersApi.updateProfile(payload);
      onSaved(res.user);
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
      className="space-y-6 rounded-xl bg-white p-6 shadow-sm"
    >
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Set up your profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Isi data berikut agar Tina bisa hitung target kalori harian Anda.
        </p>
      </header>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Gender</legend>
        <div className="grid grid-cols-3 gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGender(opt.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                gender === opt.value
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Date of birth</span>
        <input
          type="date"
          value={dob}
          max={today()}
          onChange={(e) => setDob(e.target.value)}
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Height (cm)</span>
          <input
            type="number"
            inputMode="decimal"
            min={100}
            max={250}
            step="0.1"
            value={heightCm ?? ''}
            onChange={(e) => setHeightCm(parseNumberInput(e.target.value))}
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="170"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Weight (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            min={30}
            max={300}
            step="0.1"
            value={currentKg ?? ''}
            onChange={(e) => setCurrentKg(parseNumberInput(e.target.value))}
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="65"
            required
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">
          Target weight (kg)
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={30}
          max={300}
          step="0.1"
          value={targetKg ?? ''}
          onChange={(e) => setTargetKg(parseNumberInput(e.target.value))}
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="60"
          required
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Activity level</legend>
        <div className="space-y-2">
          {ACTIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActivity(opt.value)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                activity === opt.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-medium text-slate-900">
                {opt.label}
              </span>
              <span className="text-xs text-slate-500">{opt.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Goal</legend>
        <div className="grid grid-cols-3 gap-2">
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGoal(opt.value)}
              className={`flex flex-col items-center rounded-lg border px-2 py-3 transition ${
                goal === opt.value
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span
                className={`mt-0.5 text-xs ${
                  goal === opt.value ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {errorMessage !== null ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? 'Saving…' : 'Save & calculate goals'}
      </button>
    </form>
  );
};
