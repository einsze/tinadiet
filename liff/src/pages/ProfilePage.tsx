import { useState } from 'react';
import { useSession } from '../state/session.js';
import { ProfileForm } from '../components/ProfileForm.js';

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

export const ProfilePage = () => {
  const { status, setUser } = useSession();
  const [editing, setEditing] = useState(false);

  if (status.kind !== 'authenticated') return null;
  const { user } = status;

  if (editing) {
    return (
      <div className="space-y-4">
        <ProfileForm
          user={user}
          onSaved={(updated) => {
            setUser(updated);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              ข้อมูลส่วนตัว
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {user.display_name ?? 'Anonymous'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
          >
            Edit
          </button>
        </div>
        <dl className="mt-3 divide-y divide-slate-100">
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
        </dl>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">เป้าหมายรายวัน</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          คำนวณอัตโนมัติจากข้อมูลของคุณ
        </p>
        <dl className="mt-3 divide-y divide-slate-100">
          <StatRow label="BMR" value={user.bmr_kcal ?? '—'} unit="kcal" />
          <StatRow label="TDEE" value={user.tdee_kcal ?? '—'} unit="kcal" />
          <StatRow
            label="Daily kcal goal"
            value={user.daily_calorie_goal ?? '—'}
            unit="kcal"
          />
          <StatRow
            label="Protein"
            value={user.daily_protein_g ?? '—'}
            unit="g"
          />
          <StatRow label="Carbs" value={user.daily_carbs_g ?? '—'} unit="g" />
          <StatRow label="Fat" value={user.daily_fat_g ?? '—'} unit="g" />
        </dl>
      </section>
    </div>
  );
};
