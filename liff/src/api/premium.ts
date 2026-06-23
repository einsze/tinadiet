import { api } from '../lib/api.js';
import type {
  PremiumBundle,
  RedeemPremiumResponse,
} from '../types/wallet.js';

export const premiumApi = {
  bundles: () =>
    api.get<{ bundles: PremiumBundle[] }>('/api/v1/premium/bundles'),

  redeem: (months: 1 | 3 | 6 | 12) =>
    api.post<RedeemPremiumResponse>('/api/v1/premium/redeem', { months }),
};
