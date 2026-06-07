import { api } from '../lib/api.js';

export type ExchangeResponse = {
  session: string;
  user: {
    id: number;
    line_user_id: string;
    display_name: string | null;
  };
};

export const authApi = {
  exchange: (idToken: string) =>
    api.post<ExchangeResponse>('/api/v1/auth/exchange', { id_token: idToken }),
};
