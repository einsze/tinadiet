import type { Plan } from './user.js';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type PaymentMethod = 'promptpay' | 'truemoney';
export type PaymentStatus =
  | 'pending'
  | 'successful'
  | 'failed'
  | 'expired'
  | 'reversed';

export type LatestPayment = {
  provider: 'omise';
  method: PaymentMethod;
  status: PaymentStatus;
  amount_satang: number;
  currency: string;
  completed_at: string | null;
  grant_ends_at: string | null;
};

export type BillingStatus = {
  plan: Plan;
  is_premium: boolean;
  premium_expires_at: string | null;
  subscription: {
    provider: 'stripe';
    status: SubscriptionStatus;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    canceled_at: string | null;
  } | null;
  latest_payment: LatestPayment | null;
  pricing: {
    currency: string;
    amount: number;
    grant_days: number;
    model: 'manual_renew';
  };
  stripe_configured: boolean;
  omise_configured: boolean;
};

export type OmiseChargeResponse = {
  charge_id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount_satang: number;
  qr_image_uri: string | null;
  authorize_uri: string | null;
  expires_at: string | null;
  completed_at?: string | null;
  grant_ends_at?: string | null;
};
