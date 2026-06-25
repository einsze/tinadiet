import { db } from '../db/sqlite.js';
import { userRepository } from '../repositories/users.js';
import { systemSettingsRepository } from '../repositories/system_settings.js';
import { spendCredit } from './credit.js';
import type { SystemSettingKey, User } from '../domain/types.js';

export class PremiumRedemptionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_BUNDLE'
      | 'USER_NOT_FOUND'
      | 'INSUFFICIENT_CREDIT'
      | 'BUNDLE_NOT_CONFIGURED'
  ) {
    super(message);
    this.name = 'PremiumRedemptionError';
  }
}

/**
 * Bundle identifiers: numeric months (1/3/6/12) OR string day bundles ('7d').
 * Adding new day-based bundles: extend this union + PRICE_KEY_BY_BUNDLE +
 * ALL_BUNDLES + getAllBundlePrices + computeNewExpiry.
 */
export type PremiumBundle = 1 | 3 | 6 | 12 | '7d';

export const ALL_BUNDLES: ReadonlyArray<PremiumBundle> = ['7d', 1, 3, 6, 12];

const VALID_BUNDLE_SET: ReadonlySet<unknown> = new Set<unknown>(ALL_BUNDLES);

export const isValidBundle = (value: unknown): value is PremiumBundle =>
  VALID_BUNDLE_SET.has(value);

const PRICE_KEY_BY_BUNDLE: Record<PremiumBundle, SystemSettingKey> = {
  '7d': 'price_7d_credit',
  1: 'price_1mo_credit',
  3: 'price_3mo_credit',
  6: 'price_6mo_credit',
  12: 'price_12mo_credit',
};

export const getBundlePriceCredit = (bundle: PremiumBundle): number => {
  const key = PRICE_KEY_BY_BUNDLE[bundle];
  const n = systemSettingsRepository.getNumber(key, 0);
  if (n <= 0) {
    throw new PremiumRedemptionError(
      `Bundle ${bundle} price not configured (key ${key})`,
      'BUNDLE_NOT_CONFIGURED'
    );
  }
  return n;
};

export const getAllBundlePrices = (): Record<PremiumBundle, number> => ({
  '7d': systemSettingsRepository.getNumber('price_7d_credit', 0),
  1: systemSettingsRepository.getNumber('price_1mo_credit', 0),
  3: systemSettingsRepository.getNumber('price_3mo_credit', 0),
  6: systemSettingsRepository.getNumber('price_6mo_credit', 0),
  12: systemSettingsRepository.getNumber('price_12mo_credit', 0),
});

const addMonthsIso = (fromIso: string, months: number): string => {
  const d = new Date(fromIso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};

const addDaysIso = (fromIso: string, days: number): string => {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

/**
 * Compute new premium_expires_at after redeeming a bundle.
 * Stacking rule: max(now, current_expiry) + bundle_duration
 *   - Numeric bundle = N months
 *   - '7d' bundle    = 7 days
 */
export const computeNewExpiry = (
  user: User,
  bundle: PremiumBundle,
  now: Date
): string => {
  const currentExpiryMs =
    user.premium_expires_at !== null
      ? new Date(user.premium_expires_at).getTime()
      : 0;
  const baseMs = Math.max(currentExpiryMs, now.getTime());
  const baseIso = new Date(baseMs).toISOString();
  if (bundle === '7d') {
    return addDaysIso(baseIso, 7);
  }
  return addMonthsIso(baseIso, bundle);
};

const describeBundle = (bundle: PremiumBundle): string => {
  if (bundle === '7d') return '7 days';
  return `${bundle} month(s)`;
};

export type RedeemResult = {
  user: User;
  credit_spent_satang: number;
  new_premium_expires_at: string;
  bundle_months: PremiumBundle;
};

export const redeemPremium = (
  userId: number,
  bundle: PremiumBundle,
  now: Date = new Date()
): RedeemResult => {
  if (!ALL_BUNDLES.includes(bundle)) {
    throw new PremiumRedemptionError(
      `Invalid bundle: ${bundle}`,
      'INVALID_BUNDLE'
    );
  }
  const priceCredit = getBundlePriceCredit(bundle);
  const priceSatang = priceCredit * 100;

  const tx = db.transaction(() => {
    const user = userRepository.findById(userId);
    if (user === undefined) {
      throw new PremiumRedemptionError('User not found', 'USER_NOT_FOUND');
    }
    if (user.credit_balance_satang < priceSatang) {
      throw new PremiumRedemptionError(
        `Insufficient credit: have ${user.credit_balance_satang / 100}, need ${priceCredit}`,
        'INSUFFICIENT_CREDIT'
      );
    }

    const newExpiry = computeNewExpiry(user, bundle, now);
    spendCredit({
      user_id: userId,
      amount_satang: priceSatang,
      source_type: 'redeem_premium',
      source_ref_id: null,
      admin_user_id: null,
      note: `Redeemed ${describeBundle(bundle)} premium`,
    });

    const updatedUser = userRepository.applyPremium(userId, newExpiry);
    if (updatedUser === undefined) {
      throw new PremiumRedemptionError(
        'applyPremium returned undefined',
        'USER_NOT_FOUND'
      );
    }

    return {
      user: updatedUser,
      credit_spent_satang: priceSatang,
      new_premium_expires_at: newExpiry,
      bundle_months: bundle,
    };
  });

  return tx();
};

