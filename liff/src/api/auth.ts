import { api } from '../lib/api.js';

export type ExchangeResponse = {
  session: string;
  user: {
    id: number;
    line_user_id: string;
    display_name: string | null;
  };
};

export type MeResponse = {
  user: {
    id: number;
    line_user_id: string;
    display_name: string | null;
    gender: string | null;
    height_cm: number | null;
    current_weight_kg: number | null;
    target_weight_kg: number | null;
    activity_level: string | null;
    goal_type: string | null;
    bmr_kcal: number | null;
    tdee_kcal: number | null;
    daily_calorie_goal: number | null;
  };
};

export const authApi = {
  exchange: (idToken: string) =>
    api.post<ExchangeResponse>('/api/v1/auth/exchange', { id_token: idToken }),

  me: () => api.get<MeResponse>('/api/v1/users/me'),
};
