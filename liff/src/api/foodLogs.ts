import { api } from '../lib/api.js';
import type { FoodLog, FoodLogTotals } from '../types/foodLog.js';

export type FoodLogsListResponse = {
  date: string;
  logs: FoodLog[];
  totals: FoodLogTotals;
};

export const foodLogsApi = {
  listToday: () => api.get<FoodLogsListResponse>('/api/v1/food-logs'),
  listByDate: (date: string) =>
    api.get<FoodLogsListResponse>(
      `/api/v1/food-logs?date=${encodeURIComponent(date)}`
    ),
};
