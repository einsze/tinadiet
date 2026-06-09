import { api } from '../lib/api.js';
import type {
  FoodLog,
  FoodLogTotals,
  MealType,
} from '../types/foodLog.js';

export type FoodLogsListResponse = {
  date: string;
  logs: FoodLog[];
  totals: FoodLogTotals;
};

export type FoodLogCreatePayload = {
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text?: string | null;
  meal_type?: MealType | null;
  kcal: number;
  kcal_low?: number;
  kcal_high?: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  raw_text?: string | null;
};

export type FoodLogCreateResponse = { log: FoodLog };

export type FoodLogUpdatePayload = {
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text?: string | null;
  meal_type?: MealType | null;
  kcal: number;
  kcal_low?: number;
  kcal_high?: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export const foodLogsApi = {
  listToday: () => api.get<FoodLogsListResponse>('/api/v1/food-logs'),
  listByDate: (date: string) =>
    api.get<FoodLogsListResponse>(
      `/api/v1/food-logs?date=${encodeURIComponent(date)}`
    ),
  create: (payload: FoodLogCreatePayload) =>
    api.post<FoodLogCreateResponse>('/api/v1/food-logs', payload),
  update: (id: number, payload: FoodLogUpdatePayload) =>
    api.patch<FoodLogCreateResponse>(`/api/v1/food-logs/${id}`, payload),
  delete: (id: number) => api.delete<void>(`/api/v1/food-logs/${id}`),
};
