import { db } from '../db/sqlite.js';
import { userRepository } from '../repositories/users.js';
import { userThemesRepository } from '../repositories/user_themes.js';
import { spendCredit } from './credit.js';
import {
  DEFAULT_THEME_SLUG,
  getThemePriceCredit,
  isValidThemeSlug,
  requireTheme,
  ThemeError,
} from './themes.js';
import type { ThemeSlug, User, UserTheme } from '../domain/types.js';

export class ThemePurchaseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_SLUG'
      | 'USER_NOT_FOUND'
      | 'ALREADY_OWNED'
      | 'NOT_FOR_SALE'
      | 'PRICE_NOT_CONFIGURED'
      | 'INSUFFICIENT_CREDIT'
      | 'NOT_OWNED'
  ) {
    super(message);
    this.name = 'ThemePurchaseError';
  }
}

export type ThemePurchaseResult = {
  user: User;
  user_theme: UserTheme;
  credit_spent_satang: number;
};

/**
 * Atomically purchase a theme:
 *   1. validate user exists
 *   2. validate slug + price configured
 *   3. fail if already owned
 *   4. spend credit (throws on insufficient balance via spendCredit)
 *   5. insert user_themes row
 *   6. auto-activate purchased theme
 */
export const purchaseTheme = (
  userId: number,
  themeSlug: string
): ThemePurchaseResult => {
  if (!isValidThemeSlug(themeSlug)) {
    throw new ThemePurchaseError(
      `Unknown theme: ${themeSlug}`,
      'INVALID_SLUG'
    );
  }
  const theme = requireTheme(themeSlug);
  if (theme.is_default) {
    throw new ThemePurchaseError(
      `${themeSlug} is the free default and cannot be purchased`,
      'NOT_FOR_SALE'
    );
  }

  let priceCredit: number;
  try {
    priceCredit = getThemePriceCredit(themeSlug);
  } catch (err) {
    if (err instanceof ThemeError) {
      throw new ThemePurchaseError(err.message, err.code);
    }
    throw err;
  }
  const priceSatang = priceCredit * 100;

  const tx = db.transaction(() => {
    const user = userRepository.findById(userId);
    if (user === undefined) {
      throw new ThemePurchaseError(
        `User ${userId} not found`,
        'USER_NOT_FOUND'
      );
    }
    if (userThemesRepository.ownsTheme(userId, themeSlug)) {
      throw new ThemePurchaseError(
        `Theme ${themeSlug} already owned by user ${userId}`,
        'ALREADY_OWNED'
      );
    }
    if (user.credit_balance_satang < priceSatang) {
      throw new ThemePurchaseError(
        `Insufficient credit: have ${user.credit_balance_satang / 100}, ` +
          `need ${priceCredit}`,
        'INSUFFICIENT_CREDIT'
      );
    }

    const ownedRow = userThemesRepository.insert(
      userId,
      themeSlug,
      priceCredit
    );
    spendCredit({
      user_id: userId,
      amount_satang: priceSatang,
      source_type: 'theme_purchase',
      source_ref_id: ownedRow.id,
      admin_user_id: null,
      note: `Purchased theme ${themeSlug}`,
    });
    const updatedUser = userRepository.setActiveTheme(userId, themeSlug);
    if (updatedUser === undefined) {
      throw new ThemePurchaseError(
        'setActiveTheme returned undefined',
        'USER_NOT_FOUND'
      );
    }

    return {
      user: updatedUser,
      user_theme: ownedRow,
      credit_spent_satang: priceSatang,
    };
  });

  return tx();
};

/**
 * Activate a theme the user owns (or the default theme, which everyone has).
 * Idempotent — re-activating the same theme is a no-op success.
 */
export const activateTheme = (
  userId: number,
  themeSlug: string
): User => {
  if (!isValidThemeSlug(themeSlug)) {
    throw new ThemePurchaseError(
      `Unknown theme: ${themeSlug}`,
      'INVALID_SLUG'
    );
  }
  const theme = requireTheme(themeSlug);

  const user = userRepository.findById(userId);
  if (user === undefined) {
    throw new ThemePurchaseError(
      `User ${userId} not found`,
      'USER_NOT_FOUND'
    );
  }

  if (!theme.is_default && !userThemesRepository.ownsTheme(userId, themeSlug)) {
    throw new ThemePurchaseError(
      `User ${userId} does not own theme ${themeSlug}`,
      'NOT_OWNED'
    );
  }

  // Default theme is stored as NULL (no row needed). Catalog default slug also
  // accepted for explicit "reset to default" requests.
  const slugToStore: ThemeSlug | null =
    themeSlug === DEFAULT_THEME_SLUG ? null : (themeSlug as ThemeSlug);
  const updated = userRepository.setActiveTheme(userId, slugToStore);
  if (updated === undefined) {
    throw new ThemePurchaseError(
      'setActiveTheme returned undefined',
      'USER_NOT_FOUND'
    );
  }
  return updated;
};
