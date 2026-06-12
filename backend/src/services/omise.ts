import { env } from '../config/env.js';
import { paymentsRepository } from '../repositories/payments.js';
import { userRepository } from '../repositories/users.js';
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  User,
} from '../domain/types.js';

export class OmiseServiceError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OmiseServiceError';
  }
}

export const isOmiseConfigured = (): boolean =>
  env.OMISE_SECRET_KEY.length > 0;

const requireConfigured = (): void => {
  if (!isOmiseConfigured()) {
    throw new OmiseServiceError('OMISE_SECRET_KEY is not set');
  }
};

const authHeader = (): string => {
  const token = Buffer.from(`${env.OMISE_SECRET_KEY}:`).toString('base64');
  return `Basic ${token}`;
};

type OmiseApiPath =
  | '/charges'
  | `/charges/${string}`
  | '/customers'
  | `/customers/${string}`;

type OmiseRequestOptions = {
  method: 'GET' | 'POST';
  path: OmiseApiPath | string;
  body?: Record<string, unknown>;
};

const omiseRequest = async <T>(opts: OmiseRequestOptions): Promise<T> => {
  requireConfigured();
  const url = `${env.OMISE_API_BASE_URL}${opts.path}`;
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    'Omise-Version': env.OMISE_API_VERSION,
  };
  let bodyText: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyText = JSON.stringify(opts.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method,
      headers,
      body: bodyText,
    });
  } catch (err) {
    throw new OmiseServiceError(
      `Omise network error: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      err
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    throw new OmiseServiceError(
      `Omise response not JSON (status ${response.status})`,
      response.status,
      err
    );
  }

  if (!response.ok) {
    const errObj = payload as
      | { code?: string; message?: string; location?: string }
      | undefined;
    throw new OmiseServiceError(
      `Omise API ${response.status} ${errObj?.code ?? 'unknown'}: ${errObj?.message ?? 'no message'}`,
      response.status
    );
  }

  return payload as T;
};

// ----- Omise API response shapes (partial, only what we use) -----

type OmiseChargeStatus =
  | 'pending'
  | 'failed'
  | 'expired'
  | 'reversed'
  | 'successful'
  | 'unknown';

type OmiseSource = {
  object: 'source';
  id: string;
  type: string;
  amount: number;
  currency: string;
  flow?: string;
  scannable_code?: {
    object?: string;
    type?: string;
    image?: {
      object?: string;
      download_uri?: string;
      filename?: string;
    };
  };
};

type OmiseCharge = {
  object: 'charge';
  id: string;
  status: OmiseChargeStatus;
  amount: number;
  currency: string;
  paid: boolean;
  authorized: boolean;
  refunded: number;
  failure_code: string | null;
  failure_message: string | null;
  authorize_uri: string | null;
  return_uri: string | null;
  expires_at: string | null;
  expired_at: string | null;
  paid_at: string | null;
  created_at: string;
  source?: OmiseSource | null;
  metadata?: Record<string, string | number | null>;
  customer?: string | null;
};

type OmiseEvent = {
  object: 'event';
  id: string;
  key: string; // e.g. "charge.create", "charge.complete", "charge.update"
  created_at: string;
  data: OmiseCharge | Record<string, unknown>;
};

// ----- Charge creation -----

const PAYMENT_AMOUNT_SATANG = () => env.PAYMENT_AMOUNT_THB * 100;

const mapOmiseStatusToPaymentStatus = (
  charge: OmiseCharge
): PaymentStatus => {
  if (charge.status === 'successful') return 'successful';
  if (charge.status === 'failed') return 'failed';
  if (charge.status === 'expired') return 'expired';
  if (charge.status === 'reversed') return 'reversed';
  return 'pending';
};

const extractQrUri = (charge: OmiseCharge): string | null => {
  const dl = charge.source?.scannable_code?.image?.download_uri;
  return typeof dl === 'string' && dl.length > 0 ? dl : null;
};

const buildChargeBody = (
  user: User,
  method: PaymentMethod
): Record<string, unknown> => {
  const sourceType =
    method === 'promptpay' ? 'promptpay' : 'truemoney_jumpapp';
  const body: Record<string, unknown> = {
    amount: PAYMENT_AMOUNT_SATANG(),
    currency: 'thb',
    source: { type: sourceType },
    metadata: {
      tinadiet_user_id: String(user.id),
      line_user_id: user.line_user_id,
    },
  };
  // TrueMoney Jumpapp requires return_uri so user is redirected back after auth
  if (method === 'truemoney') {
    body.return_uri = env.PAYMENT_RETURN_URL;
  }
  return body;
};

export type CreateChargeResult = {
  payment: Payment;
  charge_id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount_satang: number;
  qr_image_uri: string | null;
  authorize_uri: string | null;
  expires_at: string | null;
};

export const createOmiseCharge = async (
  user: User,
  method: PaymentMethod
): Promise<CreateChargeResult> => {
  const body = buildChargeBody(user, method);
  const charge = await omiseRequest<OmiseCharge>({
    method: 'POST',
    path: '/charges',
    body,
  });

  const status = mapOmiseStatusToPaymentStatus(charge);
  const qrUri = extractQrUri(charge);

  const payment = paymentsRepository.create({
    user_id: user.id,
    provider: 'omise',
    provider_charge_id: charge.id,
    provider_source_id: charge.source?.id ?? null,
    method,
    amount_satang: charge.amount,
    currency: charge.currency,
    status,
    failure_code: charge.failure_code,
    failure_message: charge.failure_message,
    authorize_uri: charge.authorize_uri,
    qr_image_uri: qrUri,
    expires_at: charge.expires_at,
    grant_days: env.PAYMENT_GRANT_DAYS,
    last_event_type: 'charge.create',
    last_event_at: new Date().toISOString(),
  });

  return {
    payment,
    charge_id: charge.id,
    status,
    method,
    amount_satang: charge.amount,
    qr_image_uri: qrUri,
    authorize_uri: charge.authorize_uri,
    expires_at: charge.expires_at,
  };
};

export const retrieveOmiseCharge = async (
  chargeId: string
): Promise<OmiseCharge> => {
  return omiseRequest<OmiseCharge>({
    method: 'GET',
    path: `/charges/${chargeId}`,
  });
};

// ----- Grant logic -----

const addDaysIso = (fromIso: string, days: number): string => {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

const computeGrantWindow = (
  user: User,
  grantDays: number,
  now: Date
): { starts: string; ends: string } => {
  const nowIso = now.toISOString();
  const currentExpiryMs =
    user.premium_expires_at !== null
      ? new Date(user.premium_expires_at).getTime()
      : 0;
  const stackStart =
    currentExpiryMs > now.getTime()
      ? new Date(currentExpiryMs).toISOString()
      : nowIso;
  return {
    starts: stackStart,
    ends: addDaysIso(stackStart, grantDays),
  };
};

const applyGrantForSuccessfulCharge = (
  user: User,
  payment: Payment,
  charge: OmiseCharge,
  eventType: string,
  now: Date
): { updatedUser: User; updatedPayment: Payment } => {
  const grant = computeGrantWindow(user, payment.grant_days, now);

  const updatedPayment = paymentsRepository.markCompleted({
    provider: 'omise',
    provider_charge_id: charge.id,
    completed_at: charge.paid_at ?? now.toISOString(),
    grant_starts_at: grant.starts,
    grant_ends_at: grant.ends,
    last_event_type: eventType,
    last_event_at: now.toISOString(),
  });
  if (updatedPayment === undefined) {
    throw new OmiseServiceError(
      `applyGrantForSuccessfulCharge: payment row ${charge.id} not found`
    );
  }

  const updatedUser =
    userRepository.applyPremium(user.id, grant.ends) ?? user;

  return { updatedUser, updatedPayment };
};

// ----- Webhook event handling -----

const findUserForCharge = (charge: OmiseCharge): User | undefined => {
  const metaId = charge.metadata?.tinadiet_user_id;
  if (metaId !== undefined && metaId !== null) {
    const id = Number(metaId);
    if (Number.isInteger(id) && id > 0) {
      const user = userRepository.findById(id);
      if (user !== undefined) return user;
    }
  }
  return undefined;
};

export type OmiseWebhookResult = {
  handled: boolean;
  event_id: string;
  event_type: string;
  charge_id: string | null;
  user_id: number | null;
  payment_status: PaymentStatus | null;
  plan: User['plan'] | null;
  premium_expires_at: string | null;
};

const baseResult = (event: OmiseEvent): OmiseWebhookResult => ({
  handled: false,
  event_id: event.id,
  event_type: event.key,
  charge_id: null,
  user_id: null,
  payment_status: null,
  plan: null,
  premium_expires_at: null,
});

export const handleOmiseEvent = async (
  event: OmiseEvent
): Promise<OmiseWebhookResult> => {
  if (!event.key.startsWith('charge.')) return baseResult(event);

  const data = event.data as OmiseCharge;
  if (data.object !== 'charge') return baseResult(event);

  const now = new Date();
  const existing = paymentsRepository.findByProviderChargeId(
    'omise',
    data.id
  );

  // Edge case: webhook for a charge we never created (manual dashboard test, etc.)
  if (existing === undefined) {
    const user = findUserForCharge(data);
    if (user === undefined) return baseResult(event);
    const method: PaymentMethod =
      data.source?.type === 'promptpay' ? 'promptpay' : 'truemoney';
    paymentsRepository.create({
      user_id: user.id,
      provider: 'omise',
      provider_charge_id: data.id,
      provider_source_id: data.source?.id ?? null,
      method,
      amount_satang: data.amount,
      currency: data.currency,
      status: mapOmiseStatusToPaymentStatus(data),
      failure_code: data.failure_code,
      failure_message: data.failure_message,
      authorize_uri: data.authorize_uri,
      qr_image_uri: extractQrUri(data),
      expires_at: data.expires_at,
      grant_days: env.PAYMENT_GRANT_DAYS,
      last_event_type: event.key,
      last_event_at: now.toISOString(),
    });
  }

  const payment = paymentsRepository.findByProviderChargeId('omise', data.id);
  if (payment === undefined) return baseResult(event);

  const user = userRepository.findById(payment.user_id);
  if (user === undefined) return baseResult(event);

  // Already successful? Idempotent — do nothing.
  if (payment.status === 'successful') {
    return {
      handled: true,
      event_id: event.id,
      event_type: event.key,
      charge_id: data.id,
      user_id: user.id,
      payment_status: 'successful',
      plan: user.plan,
      premium_expires_at: user.premium_expires_at,
    };
  }

  const newStatus = mapOmiseStatusToPaymentStatus(data);

  if (newStatus === 'successful') {
    const { updatedUser, updatedPayment } = applyGrantForSuccessfulCharge(
      user,
      payment,
      data,
      event.key,
      now
    );
    return {
      handled: true,
      event_id: event.id,
      event_type: event.key,
      charge_id: data.id,
      user_id: updatedUser.id,
      payment_status: updatedPayment.status,
      plan: updatedUser.plan,
      premium_expires_at: updatedUser.premium_expires_at,
    };
  }

  const updated = paymentsRepository.updateStatus({
    provider: 'omise',
    provider_charge_id: data.id,
    status: newStatus,
    failure_code: data.failure_code,
    failure_message: data.failure_message,
    last_event_type: event.key,
    last_event_at: now.toISOString(),
  });

  return {
    handled: true,
    event_id: event.id,
    event_type: event.key,
    charge_id: data.id,
    user_id: user.id,
    payment_status: updated?.status ?? newStatus,
    plan: user.plan,
    premium_expires_at: user.premium_expires_at,
  };
};

export const parseOmiseWebhookEvent = (rawBody: unknown): OmiseEvent => {
  if (typeof rawBody !== 'object' || rawBody === null) {
    throw new OmiseServiceError('Omise webhook body is not an object');
  }
  const obj = rawBody as Partial<OmiseEvent>;
  if (
    obj.object !== 'event' ||
    typeof obj.id !== 'string' ||
    typeof obj.key !== 'string' ||
    typeof obj.created_at !== 'string' ||
    typeof obj.data !== 'object' ||
    obj.data === null
  ) {
    throw new OmiseServiceError('Omise webhook body shape invalid');
  }
  return obj as OmiseEvent;
};

export const verifyOmiseBasicAuth = (header: string | undefined): boolean => {
  if (env.OMISE_WEBHOOK_BASIC_USER.length === 0) {
    // Basic Auth not configured — accept all (dev/test mode). Production MUST set creds.
    return true;
  }
  if (typeof header !== 'string' || !header.startsWith('Basic ')) {
    return false;
  }
  const expected = Buffer.from(
    `${env.OMISE_WEBHOOK_BASIC_USER}:${env.OMISE_WEBHOOK_BASIC_PASS}`
  ).toString('base64');
  const received = header.slice('Basic '.length).trim();
  if (received.length !== expected.length) return false;
  // Constant-time compare to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return mismatch === 0;
};

// ----- For polling endpoint: sync DB state with Omise -----

export const syncChargeFromOmise = async (
  chargeId: string
): Promise<Payment | undefined> => {
  const payment = paymentsRepository.findByProviderChargeId('omise', chargeId);
  if (payment === undefined) return undefined;
  if (payment.status === 'successful') return payment;

  const charge = await retrieveOmiseCharge(chargeId);
  const newStatus = mapOmiseStatusToPaymentStatus(charge);
  if (newStatus === payment.status) return payment;

  const user = userRepository.findById(payment.user_id);
  if (user === undefined) return payment;

  const now = new Date();
  if (newStatus === 'successful') {
    const { updatedPayment } = applyGrantForSuccessfulCharge(
      user,
      payment,
      charge,
      'manual.sync',
      now
    );
    return updatedPayment;
  }

  return paymentsRepository.updateStatus({
    provider: 'omise',
    provider_charge_id: charge.id,
    status: newStatus,
    failure_code: charge.failure_code,
    failure_message: charge.failure_message,
    last_event_type: 'manual.sync',
    last_event_at: now.toISOString(),
  });
};
