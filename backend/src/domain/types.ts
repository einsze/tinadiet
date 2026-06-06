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

export type NutritionGoals = {
  bmr_kcal: number;
  tdee_kcal: number;
  daily_calorie_goal: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
};
