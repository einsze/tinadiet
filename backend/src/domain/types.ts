export type Plan = 'free' | 'premium';

export type SubscriptionProvider = 'stripe';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type Subscription = {
  id: number;
  user_id: number;
  provider: SubscriptionProvider;
  provider_subscription_id: string;
  provider_customer_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
};

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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodLogSource = 'manual' | 'chat_regex' | 'chat_ai' | 'photo';

export type FoodLog = {
  id: number;
  user_id: number;
  logged_at: string;
  date: string;
  meal_type: MealType | null;
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  kcal: number;
  kcal_low: number;
  kcal_high: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: FoodLogSource;
  raw_text: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type FoodLogTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  count: number;
};

export type WeightLogSource = 'manual' | 'chat';

export type WeightLog = {
  id: number;
  user_id: number;
  logged_at: string;
  date: string;
  weight_kg: number;
  note: string | null;
  source: WeightLogSource;
  created_at: string;
};

export type ChatMessageRole = 'user' | 'assistant';

export type ChatMessage = {
  id: number;
  user_id: number;
  role: ChatMessageRole;
  content: string;
  date: string;
  refused: boolean;
  created_at: string;
};
