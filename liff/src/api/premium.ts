import { api } from '../lib/api.js';
import type {
  PremiumBundle,
  PremiumBundleId,
  RedeemPremiumResponse,
} from '../types/wallet.js';

export const premiumApi = {
  bundles: () =>
    api.get<{ bundles: PremiumBundle[] }>('/api/v1/premium/bundles'),

  redeem: (months: PremiumBundleId) =>
    api.post<RedeemPremiumResponse>('/api/v1/premium/redeem', { months }),
};
