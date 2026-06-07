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
