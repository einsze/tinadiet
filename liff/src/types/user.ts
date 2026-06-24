export type Plan = 'free' | 'premium';

export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type GoalType = 'loss' | 'maintain' | 'gain';

export type User = {
  id: number;
  line_user_id: string;
  display_name: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal_type: GoalType | null;
  bmr_kcal: number | null;
  tdee_kcal: number | null;
  daily_calorie_goal: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  locale: string;
  timezone: string;
  plan: Plan;
  premium_expires_at: string | null;
  stripe_customer_id: string | null;
  active_theme_slug: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInput = {
  gender: Gender;
  date_of_birth: string;
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  activity_level: ActivityLevel;
  goal_type: GoalType;
};

export const isProfileComplete = (user: User): boolean =>
  user.gender !== null &&
  user.date_of_birth !== null &&
  user.height_cm !== null &&
  user.current_weight_kg !== null &&
  user.activity_level !== null &&
  user.goal_type !== null &&
  user.daily_calorie_goal !== null;
