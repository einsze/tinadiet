import { useState } from 'react';
import type { User } from '../types/user.js';

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

type Props = {
  user: User;
  onEditProfile: () => void;
};

export const Dashboard = ({ user, onEditProfile }: Props) => {
  const [showDebug] = useState(false);
  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Hi{user.display_name ? `, ${user.display_name}` : ''} 👋
          </h2>
          <button
            type="button"
            onClick={onEditProfile}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Edit profile
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Target harian Anda:</p>

        <div className="mt-4 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
          <div className="text-xs uppercase tracking-wide text-white/70">
            Daily calorie goal
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold">{user.daily_calorie_goal}</span>
            <span className="text-sm text-white/80">kcal</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Protein</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">
              {user.daily_protein_g}
              <span className="ml-0.5 text-xs font-normal text-slate-500">g</span>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Carbs</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">
              {user.daily_carbs_g}
              <span className="ml-0.5 text-xs font-normal text-slate-500">g</span>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Fat</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">
              {user.daily_fat_g}
              <span className="ml-0.5 text-xs font-normal text-slate-500">g</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Your profile</h3>
        <dl className="mt-2 divide-y divide-slate-100">
          <StatRow label="Gender" value={user.gender ?? '—'} />
          <StatRow label="Date of birth" value={user.date_of_birth ?? '—'} />
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

      <section className="rounded-xl bg-brand-500/5 border border-brand-500/10 p-6">
        <h3 className="font-semibold text-brand-900">What&apos;s next</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>• Food logging (text + photo)</li>
          <li>• Daily kcal ring + remaining quota</li>
          <li>• AI coach chat</li>
        </ul>
      </section>

      {showDebug ? (
        <pre className="rounded-lg bg-slate-900 p-3 text-xs text-slate-200">
          {JSON.stringify(user, null, 2)}
        </pre>
      ) : null}
    </div>
  );
};
