import type {
  ActivityLevel,
  Gender,
  GoalType,
  NutritionGoals,
  ProfileInput,
} from './types.js';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_KCAL_DELTA: Record<GoalType, number> = {
  loss: -500,
  maintain: 0,
  gain: 300,
};

const ageInYears = (isoDob: string, now: Date = new Date()): number => {
  const dob = new Date(isoDob);
  if (Number.isNaN(dob.getTime())) {
    throw new Error(`Invalid date_of_birth: ${isoDob}`);
  }
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() &&
      now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export const calculateBmr = (
  gender: Gender,
  weightKg: number,
  heightCm: number,
  ageYears: number
): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78;
};

export const calculateTdee = (
  bmr: number,
  activity: ActivityLevel
): number => bmr * ACTIVITY_MULTIPLIERS[activity];

export const calculateNutritionGoals = (
  input: ProfileInput,
  now: Date = new Date()
): NutritionGoals => {
  const age = ageInYears(input.date_of_birth, now);
  const bmr = calculateBmr(
    input.gender,
    input.current_weight_kg,
    input.height_cm,
    age
  );
  const tdee = calculateTdee(bmr, input.activity_level);
  const goalKcal = Math.max(1200, tdee + GOAL_KCAL_DELTA[input.goal_type]);

  const proteinG = Math.round(input.current_weight_kg * 1.8);
  const fatG = Math.round((goalKcal * 0.25) / 9);
  const carbsKcal = goalKcal - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(carbsKcal / 4));

  return {
    bmr_kcal: Math.round(bmr),
    tdee_kcal: Math.round(tdee),
    daily_calorie_goal: Math.round(goalKcal),
    daily_protein_g: proteinG,
    daily_carbs_g: carbsG,
    daily_fat_g: fatG,
  };
};
