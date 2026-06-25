import { api } from '../lib/api.js';
import type { FoodLog, FoodLogTotals } from '../types/foodLog.js';
import type { WeightLog } from '../types/weightLog.js';

export type HistoryGoals = {
  daily_calorie_goal: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
};

export type HistoryAllowedRange = {
  min: string;
  max: string;
};

export type HistoryResponse = {
  date: string;
  food_logs: FoodLog[];
  food_totals: FoodLogTotals;
  weight_log: WeightLog | null;
  goals: HistoryGoals;
  allowed_range: HistoryAllowedRange;
  plan: 'free' | 'premium';
  is_premium: boolean;
};

export const historyApi = {
  get: (date?: string) =>
    api.get<HistoryResponse>(
      date === undefined
        ? '/api/v1/history'
        : `/api/v1/history?date=${encodeURIComponent(date)}`
    ),
};
