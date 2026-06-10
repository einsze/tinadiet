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
  pricing: {
    currency: string;
    amount: number;
    interval: string;
  };
  stripe_configured: boolean;
};
