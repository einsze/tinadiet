import { api } from '../lib/api.js';
import type { ProfileInput, User } from '../types/user.js';

export type MeResponse = { user: User };

export const usersApi = {
  me: () => api.get<MeResponse>('/api/v1/users/me'),
  updateProfile: (input: ProfileInput) =>
    api.patch<MeResponse>('/api/v1/users/me', input),
};
