import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import { calculateNutritionGoals } from '../domain/nutrition.js';
import type { ProfileInput, User } from '../domain/types.js';

const USER_COLUMNS = `
  id, line_user_id, display_name,
  gender, date_of_birth, height_cm,
  current_weight_kg, target_weight_kg,
  activity_level, goal_type,
  bmr_kcal, tdee_kcal, daily_calorie_goal,
  daily_protein_g, daily_carbs_g, daily_fat_g,
  locale, timezone,
  plan, premium_expires_at, stripe_customer_id, omise_customer_id,
  credit_balance_satang, abuse_warning_count, is_blocked,
  active_theme_slug, support_mode_until,
  created_at, updated_at
`;

type Stmts = {
  findByLine: Statement;
  findById: Statement;
  insert: Statement;
  updateDisplayName: Statement;
  updateProfile: Statement;
  updateCurrentWeight: Statement;
  listProfileCompleted: Statement;
  setStripeCustomerId: Statement;
  findByStripeCustomerId: Statement;
  setOmiseCustomerId: Statement;
  findByOmiseCustomerId: Statement;
  applyPremium: Statement;
  revertToFree: Statement;
  listExpiredPremium: Statement;
  listExpiringOnLocalDate: Statement;
  revertAllExpired: Statement;
  deleteById: Statement;
  search: Statement;
  countSearch: Statement;
  setPremiumExpiresAt: Statement;
  updateCreditBalance: Statement;
  incrementAbuseCount: Statement;
  clearAbuseCount: Statement;
  setBlocked: Statement;
  setActiveTheme: Statement;
  setSupportMode: Statement;
  clearSupportMode: Statement;
};

type RawUser = Omit<User, 'is_blocked'> & { is_blocked: number };

const hydrate = (row: RawUser | undefined): User | undefined => {
  if (row === undefined) return undefined;
  return { ...row, is_blocked: row.is_blocked === 1 };
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    findByLine: db.prepare(
      `SELECT ${USER_COLUMNS} FROM users WHERE line_user_id = ?`
    ),
    findById: db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO users (line_user_id, display_name) VALUES (?, ?)`
    ),
    updateDisplayName: db.prepare(
      `UPDATE users
       SET display_name = ?, updated_at = datetime('now')
       WHERE id = ? AND (display_name IS NULL OR display_name != ?)`
    ),
    updateProfile: db.prepare(
      `UPDATE users SET
         gender             = @gender,
         date_of_birth      = @date_of_birth,
         height_cm          = @height_cm,
         current_weight_kg  = @current_weight_kg,
         target_weight_kg   = @target_weight_kg,
         activity_level     = @activity_level,
         goal_type          = @goal_type,
         bmr_kcal           = @bmr_kcal,
         tdee_kcal          = @tdee_kcal,
         daily_calorie_goal = @daily_calorie_goal,
         daily_protein_g    = @daily_protein_g,
         daily_carbs_g      = @daily_carbs_g,
         daily_fat_g        = @daily_fat_g,
         updated_at         = datetime('now')
       WHERE id = @id`
    ),
    listProfileCompleted: db.prepare(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE daily_calorie_goal IS NOT NULL
       ORDER BY id ASC`
    ),
    updateCurrentWeight: db.prepare(
      `UPDATE users
       SET current_weight_kg = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    setStripeCustomerId: db.prepare(
      `UPDATE users
       SET stripe_customer_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    findByStripeCustomerId: db.prepare(
      `SELECT ${USER_COLUMNS} FROM users WHERE stripe_customer_id = ?`
    ),
    setOmiseCustomerId: db.prepare(
      `UPDATE users
       SET omise_customer_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    findByOmiseCustomerId: db.prepare(
      `SELECT ${USER_COLUMNS} FROM users WHERE omise_customer_id = ?`
    ),
    applyPremium: db.prepare(
      `UPDATE users
       SET plan = 'premium',
           premium_expires_at = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ),
    revertToFree: db.prepare(
      `UPDATE users
       SET plan = 'free',
           premium_expires_at = NULL,
           updated_at = datetime('now')
       WHERE id = ?`
    ),
    listExpiredPremium: db.prepare(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE plan = 'premium'
         AND premium_expires_at IS NOT NULL
         AND premium_expires_at <= ?
       ORDER BY premium_expires_at ASC`
    ),
    listExpiringOnLocalDate: db.prepare(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE plan = 'premium'
         AND premium_expires_at IS NOT NULL
         AND is_blocked = 0
         AND date(premium_expires_at, '+7 hours') = ?
       ORDER BY id ASC`
    ),
    revertAllExpired: db.prepare(
      `UPDATE users
       SET plan = 'free',
           premium_expires_at = NULL,
           updated_at = datetime('now')
       WHERE plan = 'premium'
         AND premium_expires_at IS NOT NULL
         AND premium_expires_at <= ?`
    ),
    deleteById: db.prepare(`DELETE FROM users WHERE id = ?`),
    search: db.prepare(
      `SELECT ${USER_COLUMNS} FROM users
       WHERE
         (@q = '' OR display_name LIKE @qLike OR line_user_id LIKE @qLike)
         AND (@flagged = 0 OR abuse_warning_count > 0 OR is_blocked = 1)
       ORDER BY id DESC
       LIMIT @limit OFFSET @offset`
    ),
    countSearch: db.prepare(
      `SELECT COUNT(*) AS c FROM users
       WHERE
         (@q = '' OR display_name LIKE @qLike OR line_user_id LIKE @qLike)
         AND (@flagged = 0 OR abuse_warning_count > 0 OR is_blocked = 1)`
    ),
    setPremiumExpiresAt: db.prepare(
      `UPDATE users
       SET premium_expires_at = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    updateCreditBalance: db.prepare(
      `UPDATE users
       SET credit_balance_satang = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    incrementAbuseCount: db.prepare(
      `UPDATE users
       SET abuse_warning_count = abuse_warning_count + 1,
           updated_at = datetime('now')
       WHERE id = ?`
    ),
    clearAbuseCount: db.prepare(
      `UPDATE users
       SET abuse_warning_count = 0, updated_at = datetime('now')
       WHERE id = ?`
    ),
    setBlocked: db.prepare(
      `UPDATE users
       SET is_blocked = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    setActiveTheme: db.prepare(
      `UPDATE users
       SET active_theme_slug = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    setSupportMode: db.prepare(
      `UPDATE users
       SET support_mode_until = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
    clearSupportMode: db.prepare(
      `UPDATE users
       SET support_mode_until = NULL, updated_at = datetime('now')
       WHERE id = ?`
    ),
  };
  return _stmts;
};

export type UpsertFromLineInput = {
  line_user_id: string;
  display_name?: string | null;
};

const findByIdHydrated = (userId: number): User | undefined =>
  hydrate(stmts().findById.get(userId) as RawUser | undefined);

const requireById = (userId: number, context: string): User => {
  const user = findByIdHydrated(userId);
  if (user === undefined) {
    throw new Error(`${context}: user ${userId} not found after update`);
  }
  return user;
};

export type UserSearchInput = {
  query: string;
  flaggedOnly: boolean;
  limit: number;
  offset: number;
};

export const userRepository = {
  findByLineUserId: (lineUserId: string): User | undefined => {
    return hydrate(
      stmts().findByLine.get(lineUserId) as RawUser | undefined
    );
  },

  findById: (id: number): User | undefined => findByIdHydrated(id),

  upsertFromLine: (input: UpsertFromLineInput): User => {
    const s = stmts();
    const existing = hydrate(
      s.findByLine.get(input.line_user_id) as RawUser | undefined
    );

    if (existing) {
      if (input.display_name && input.display_name !== existing.display_name) {
        s.updateDisplayName.run(input.display_name, existing.id, input.display_name);
        return requireById(existing.id, 'upsertFromLine');
      }
      return existing;
    }

    const info = s.insert.run(input.line_user_id, input.display_name ?? null);
    const id = Number(info.lastInsertRowid);
    return requireById(id, 'upsertFromLine');
  },

  listProfileCompleted: (): User[] => {
    const rows = stmts().listProfileCompleted.all() as RawUser[];
    return rows.map((r) => hydrate(r) as User);
  },

  search: (input: UserSearchInput): User[] => {
    const rows = stmts().search.all({
      q: input.query,
      qLike: `%${input.query}%`,
      flagged: input.flaggedOnly ? 1 : 0,
      limit: input.limit,
      offset: input.offset,
    }) as RawUser[];
    return rows.map((r) => hydrate(r) as User);
  },

  countSearch: (input: { query: string; flaggedOnly: boolean }): number => {
    const row = stmts().countSearch.get({
      q: input.query,
      qLike: `%${input.query}%`,
      flagged: input.flaggedOnly ? 1 : 0,
    }) as { c: number };
    return row.c;
  },

  findByStripeCustomerId: (stripeCustomerId: string): User | undefined => {
    return hydrate(
      stmts().findByStripeCustomerId.get(stripeCustomerId) as RawUser | undefined
    );
  },

  setStripeCustomerId: (
    userId: number,
    stripeCustomerId: string
  ): User | undefined => {
    stmts().setStripeCustomerId.run(stripeCustomerId, userId);
    return findByIdHydrated(userId);
  },

  findByOmiseCustomerId: (omiseCustomerId: string): User | undefined => {
    return hydrate(
      stmts().findByOmiseCustomerId.get(omiseCustomerId) as RawUser | undefined
    );
  },

  setOmiseCustomerId: (
    userId: number,
    omiseCustomerId: string
  ): User | undefined => {
    stmts().setOmiseCustomerId.run(omiseCustomerId, userId);
    return findByIdHydrated(userId);
  },

  applyPremium: (userId: number, expiresAtIso: string): User | undefined => {
    stmts().applyPremium.run(expiresAtIso, userId);
    return findByIdHydrated(userId);
  },

  setPremiumExpiresAt: (
    userId: number,
    expiresAtIso: string | null
  ): User | undefined => {
    stmts().setPremiumExpiresAt.run(expiresAtIso, userId);
    return findByIdHydrated(userId);
  },

  revertToFree: (userId: number): User | undefined => {
    stmts().revertToFree.run(userId);
    return findByIdHydrated(userId);
  },

  listExpiredPremium: (nowIso: string): User[] => {
    const rows = stmts().listExpiredPremium.all(nowIso) as RawUser[];
    return rows.map((r) => hydrate(r) as User);
  },

  listExpiringOnLocalDate: (localDate: string): User[] => {
    const rows = stmts().listExpiringOnLocalDate.all(localDate) as RawUser[];
    return rows.map((r) => hydrate(r) as User);
  },

  revertAllExpired: (nowIso: string): number => {
    const info = stmts().revertAllExpired.run(nowIso);
    return info.changes;
  },

  deleteById: (userId: number): boolean => {
    const info = stmts().deleteById.run(userId);
    return info.changes > 0;
  },

  updateCreditBalance: (
    userId: number,
    newBalanceSatang: number
  ): User | undefined => {
    stmts().updateCreditBalance.run(newBalanceSatang, userId);
    return findByIdHydrated(userId);
  },

  incrementAbuseCount: (userId: number): User | undefined => {
    stmts().incrementAbuseCount.run(userId);
    return findByIdHydrated(userId);
  },

  clearAbuseCount: (userId: number): User | undefined => {
    stmts().clearAbuseCount.run(userId);
    return findByIdHydrated(userId);
  },

  setBlocked: (userId: number, blocked: boolean): User | undefined => {
    stmts().setBlocked.run(blocked ? 1 : 0, userId);
    return findByIdHydrated(userId);
  },

  setActiveTheme: (
    userId: number,
    themeSlug: string | null
  ): User | undefined => {
    stmts().setActiveTheme.run(themeSlug, userId);
    return findByIdHydrated(userId);
  },

  setSupportMode: (
    userId: number,
    untilIso: string
  ): User | undefined => {
    stmts().setSupportMode.run(untilIso, userId);
    return findByIdHydrated(userId);
  },

  clearSupportMode: (userId: number): User | undefined => {
    stmts().clearSupportMode.run(userId);
    return findByIdHydrated(userId);
  },

  syncWeightChange: (userId: number, weightKg: number): User | undefined => {
    const s = stmts();
    const existing = findByIdHydrated(userId);
    if (existing === undefined) return undefined;
    const profileComplete =
      existing.gender !== null &&
      existing.date_of_birth !== null &&
      existing.height_cm !== null &&
      existing.activity_level !== null &&
      existing.goal_type !== null &&
      existing.target_weight_kg !== null;

    if (!profileComplete) {
      s.updateCurrentWeight.run(weightKg, userId);
      return findByIdHydrated(userId);
    }

    const goals = calculateNutritionGoals({
      gender: existing.gender!,
      date_of_birth: existing.date_of_birth!,
      height_cm: existing.height_cm!,
      current_weight_kg: weightKg,
      target_weight_kg: existing.target_weight_kg!,
      activity_level: existing.activity_level!,
      goal_type: existing.goal_type!,
    });
    s.updateProfile.run({
      id: userId,
      gender: existing.gender,
      date_of_birth: existing.date_of_birth,
      height_cm: existing.height_cm,
      current_weight_kg: weightKg,
      target_weight_kg: existing.target_weight_kg,
      activity_level: existing.activity_level,
      goal_type: existing.goal_type,
      bmr_kcal: goals.bmr_kcal,
      tdee_kcal: goals.tdee_kcal,
      daily_calorie_goal: goals.daily_calorie_goal,
      daily_protein_g: goals.daily_protein_g,
      daily_carbs_g: goals.daily_carbs_g,
      daily_fat_g: goals.daily_fat_g,
    });
    return findByIdHydrated(userId);
  },

  updateProfile: (userId: number, input: ProfileInput): User => {
    const s = stmts();
    const goals = calculateNutritionGoals(input);
    s.updateProfile.run({
      id: userId,
      gender: input.gender,
      date_of_birth: input.date_of_birth,
      height_cm: input.height_cm,
      current_weight_kg: input.current_weight_kg,
      target_weight_kg: input.target_weight_kg,
      activity_level: input.activity_level,
      goal_type: input.goal_type,
      bmr_kcal: goals.bmr_kcal,
      tdee_kcal: goals.tdee_kcal,
      daily_calorie_goal: goals.daily_calorie_goal,
      daily_protein_g: goals.daily_protein_g,
      daily_carbs_g: goals.daily_carbs_g,
      daily_fat_g: goals.daily_fat_g,
    });
    return requireById(userId, 'updateProfile');
  },
};
