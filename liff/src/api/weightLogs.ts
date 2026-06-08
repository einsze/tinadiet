import { api } from '../lib/api.js';
import type { WeightLog } from '../types/weightLog.js';

export type WeightLogsListResponse = {
  logs: WeightLog[];
  latest: WeightLog | null;
  target_weight_kg: number | null;
  current_weight_kg: number | null;
};

export const weightLogsApi = {
  listRecent: (limit: number = 30) =>
    api.get<WeightLogsListResponse>(`/api/v1/weight-logs?limit=${limit}`),
};
