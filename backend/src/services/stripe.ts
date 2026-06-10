import Stripe from 'stripe';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/users.js';
import { subscriptionsRepository } from '../repositories/subscriptions.js';
import type {
  Subscription,
  SubscriptionStatus,
  User,
} from '../domain/types.js';

let _client: Stripe | null = null;

export const stripeClient = (): Stripe => {
  if (_client !== null) return _client;
  if (env.STRIPE_SECRET_KEY.length === 0) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  _client = new Stripe(env.STRIPE_SECRET_KEY, {
    typescript: true,
  });
  return _client;
};

export class StripeServiceError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StripeServiceError';
  }
}

const ensureStripeCustomerId = async (user: User): Promise<string> => {
  if (user.stripe_customer_id !== null) return user.stripe_customer_id;
  const customer = await stripeClient().customers.create({
    metadata: {
      tinadiet_user_id: String(user.id),
      line_user_id: user.line_user_id,
    },
    name: user.display_name ?? undefined,
  });
  userRepository.setStripeCustomerId(user.id, customer.id);
  return customer.id;
};

export type CheckoutSessionResult = {
  url: string;
  session_id: string;
  customer_id: string;
};

export const createCheckoutSession = async (
  user: User
): Promise<CheckoutSessionResult> => {
  if (env.STRIPE_PRICE_ID.length === 0) {
    throw new StripeServiceError('STRIPE_PRICE_ID is not set');
  }
  const customerId = await ensureStripeCustomerId(user);
  const session = await stripeClient().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: env.BILLING_SUCCESS_URL,
    cancel_url: env.BILLING_CANCEL_URL,
    allow_promotion_codes: true,
    metadata: {
      tinadiet_user_id: String(user.id),
    },
    subscription_data: {
      metadata: {
        tinadiet_user_id: String(user.id),
      },
    },
  });
  if (session.url === null) {
    throw new StripeServiceError('Stripe checkout session has no url');
  }
  return {
    url: session.url,
    session_id: session.id,
    customer_id: customerId,
  };
};

export const cancelSubscriptionAtPeriodEnd = async (
  user: User
): Promise<Subscription | null> => {
  const latest = subscriptionsRepository.findLatestByUser(user.id);
  if (latest === undefined) return null;
  const updated = await stripeClient().subscriptions.update(
    latest.provider_subscription_id,
    { cancel_at_period_end: true }
  );
  return upsertSubscriptionFromStripe(user.id, updated, 'manual_cancel');
};

export const cancelSubscriptionImmediately = async (
  user: User
): Promise<Subscription | null> => {
  const latest = subscriptionsRepository.findLatestByUser(user.id);
  if (latest === undefined) return null;
  if (
    latest.status === 'canceled' ||
    latest.status === 'incomplete_expired'
  ) {
    return latest;
  }
  try {
    const canceled = await stripeClient().subscriptions.cancel(
      latest.provider_subscription_id
    );
    return upsertSubscriptionFromStripe(user.id, canceled, 'account_delete');
  } catch (err) {
    throw new StripeServiceError(
      `Failed to cancel subscription ${latest.provider_subscription_id}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
};

export const deleteStripeCustomer = async (
  stripeCustomerId: string
): Promise<void> => {
  if (env.STRIPE_SECRET_KEY.length === 0) {
    return;
  }
  try {
    await stripeClient().customers.del(stripeCustomerId);
  } catch (err) {
    throw new StripeServiceError(
      `Failed to delete Stripe customer ${stripeCustomerId}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
};

const toIso = (unix: number | null | undefined): string | null => {
  if (unix === null || unix === undefined) return null;
  return new Date(unix * 1000).toISOString();
};

const STRIPE_STATUS_VALUES: ReadonlyArray<SubscriptionStatus> = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
];

const coerceStatus = (raw: string): SubscriptionStatus => {
  if ((STRIPE_STATUS_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as SubscriptionStatus;
  }
  return 'incomplete';
};

type StripeSubscriptionLike = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

const extractPeriod = (
  sub: StripeSubscriptionLike
): { start: number | null; end: number | null } => {
  const directStart = sub.current_period_start ?? null;
  const directEnd = sub.current_period_end ?? null;
  if (directStart !== null && directEnd !== null) {
    return { start: directStart, end: directEnd };
  }
  const item = sub.items?.data?.[0];
  return {
    start: item?.current_period_start ?? directStart,
    end: item?.current_period_end ?? directEnd,
  };
};

export const upsertSubscriptionFromStripe = (
  userId: number,
  sub: Stripe.Subscription,
  eventType: string
): Subscription => {
  const period = extractPeriod(sub as StripeSubscriptionLike);
  return subscriptionsRepository.upsert({
    user_id: userId,
    provider: 'stripe',
    provider_subscription_id: sub.id,
    provider_customer_id:
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: coerceStatus(sub.status),
    current_period_start: toIso(period.start),
    current_period_end: toIso(period.end),
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: toIso(sub.canceled_at),
    last_event_type: eventType,
    last_event_at: new Date().toISOString(),
  });
};

const findUserForSubscription = (sub: Stripe.Subscription): User | undefined => {
  const metaUserId = sub.metadata?.tinadiet_user_id;
  if (typeof metaUserId === 'string' && metaUserId.length > 0) {
    const id = Number(metaUserId);
    if (Number.isInteger(id) && id > 0) {
      const user = userRepository.findById(id);
      if (user !== undefined) return user;
    }
  }
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  return userRepository.findByStripeCustomerId(customerId);
};

const reconcileUserPlan = (
  user: User,
  sub: Stripe.Subscription,
  subscription: Subscription
): User | undefined => {
  const activeStatuses: ReadonlyArray<SubscriptionStatus> = [
    'active',
    'trialing',
  ];
  if (
    activeStatuses.includes(subscription.status) &&
    subscription.current_period_end !== null
  ) {
    return userRepository.applyPremium(user.id, subscription.current_period_end);
  }

  const terminalStatuses: ReadonlyArray<SubscriptionStatus> = [
    'canceled',
    'incomplete_expired',
    'unpaid',
  ];
  if (terminalStatuses.includes(subscription.status)) {
    const now = Date.now();
    const periodEndMs = subscription.current_period_end
      ? new Date(subscription.current_period_end).getTime()
      : null;
    if (periodEndMs === null || periodEndMs <= now) {
      return userRepository.revertToFree(user.id);
    }
    return userRepository.applyPremium(user.id, subscription.current_period_end!);
  }

  if (subscription.status === 'past_due' && subscription.current_period_end !== null) {
    const stillInsideWindow =
      new Date(subscription.current_period_end).getTime() > Date.now();
    if (stillInsideWindow) {
      return userRepository.applyPremium(user.id, subscription.current_period_end);
    }
    return userRepository.revertToFree(user.id);
  }

  return undefined;
};

export const parseStripeWebhookEvent = (
  rawBody: Buffer,
  signature: string
): Stripe.Event => {
  if (env.STRIPE_WEBHOOK_SECRET.length === 0) {
    throw new StripeServiceError('STRIPE_WEBHOOK_SECRET is not set');
  }
  try {
    return stripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    throw new StripeServiceError(
      `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
};

export type WebhookHandleResult = {
  handled: boolean;
  event_type: string;
  user_id: number | null;
  plan: User['plan'] | null;
  premium_expires_at: string | null;
};

export const handleStripeEvent = async (
  event: Stripe.Event
): Promise<WebhookHandleResult> => {
  const baseResult: WebhookHandleResult = {
    handled: false,
    event_type: event.type,
    user_id: null,
    plan: null,
    premium_expires_at: null,
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription' || session.subscription === null) {
      return baseResult;
    }
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
    const user = findUserForSubscription(sub);
    if (user === undefined) return baseResult;
    const subscription = upsertSubscriptionFromStripe(user.id, sub, event.type);
    const updated = reconcileUserPlan(user, sub, subscription);
    return {
      handled: true,
      event_type: event.type,
      user_id: user.id,
      plan: updated?.plan ?? user.plan,
      premium_expires_at:
        updated?.premium_expires_at ?? user.premium_expires_at,
    };
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.paused' ||
    event.type === 'customer.subscription.resumed'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const user = findUserForSubscription(sub);
    if (user === undefined) return baseResult;
    const subscription = upsertSubscriptionFromStripe(user.id, sub, event.type);
    const updated = reconcileUserPlan(user, sub, subscription);
    return {
      handled: true,
      event_type: event.type,
      user_id: user.id,
      plan: updated?.plan ?? user.plan,
      premium_expires_at:
        updated?.premium_expires_at ?? user.premium_expires_at,
    };
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    };
    const subRef = invoice.subscription;
    if (subRef === null || subRef === undefined) return baseResult;
    const subscriptionId = typeof subRef === 'string' ? subRef : subRef.id;
    const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
    const user = findUserForSubscription(sub);
    if (user === undefined) return baseResult;
    const subscription = upsertSubscriptionFromStripe(user.id, sub, event.type);
    const updated = reconcileUserPlan(user, sub, subscription);
    return {
      handled: true,
      event_type: event.type,
      user_id: user.id,
      plan: updated?.plan ?? user.plan,
      premium_expires_at:
        updated?.premium_expires_at ?? user.premium_expires_at,
    };
  }

  return baseResult;
};
