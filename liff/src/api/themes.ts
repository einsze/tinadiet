import { api } from '../lib/api.js';
import type {
  ThemeActivateResponse,
  ThemeListResponse,
  ThemePurchaseResponse,
} from '../types/theme.js';

export const themesApi = {
  list: () => api.get<ThemeListResponse>('/api/v1/themes'),

  purchase: (slug: string) =>
    api.post<ThemePurchaseResponse>('/api/v1/themes/purchase', { slug }),

  activate: (slug: string) =>
    api.post<ThemeActivateResponse>('/api/v1/themes/activate', { slug }),
};
