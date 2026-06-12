import { api } from '../lib/api.js';
import type {
  BillingStatus,
  OmiseChargeResponse,
  PaymentMethod,
} from '../types/billing.js';

export type CheckoutResponse = {
  url: string;
  session_id: string;
};

export type CancelResponse = {
  subscription: NonNullable<BillingStatus['subscription']>;
};

export const billingApi = {
  status: () => api.get<BillingStatus>('/api/v1/billing/status'),
  checkout: () => api.post<CheckoutResponse>('/api/v1/billing/checkout'),
  cancel: () => api.post<CancelResponse>('/api/v1/billing/cancel'),

  createOmiseCharge: (method: PaymentMethod) =>
    api.post<OmiseChargeResponse>('/api/v1/billing/omise/charge', { method }),
  getOmiseCharge: (chargeId: string) =>
    api.get<OmiseChargeResponse>(
      `/api/v1/billing/omise/charge/${encodeURIComponent(chargeId)}`
    ),
};
