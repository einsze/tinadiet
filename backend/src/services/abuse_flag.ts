import { db } from '../db/sqlite.js';
import { userRepository } from '../repositories/users.js';
import { userFlagsRepository } from '../repositories/user_flags.js';
import type { User } from '../domain/types.js';

/**
 * Level B Tiered Escalation:
 *  - 1 warning: visible badge to operators on future submissions
 *  - 3 warnings: future submissions auto-flag 'flagged_review' (superadmin only)
 *  - 5 warnings: user auto-blocked (cannot submit new topups)
 */
export const ABUSE_FLAGGED_REVIEW_THRESHOLD = 3;
export const ABUSE_AUTO_BLOCK_THRESHOLD = 5;

export type AbuseFlagResult = {
  user: User;
  warning_count: number;
  needs_superadmin_review: boolean;
  auto_blocked: boolean;
};

export const recordAbuseFlag = (input: {
  user_id: number;
  reason: string | null;
  related_payment_id: number | null;
  flagged_by_admin_id: number;
}): AbuseFlagResult => {
  const tx = db.transaction(() => {
    userFlagsRepository.create({
      user_id: input.user_id,
      flag_type: 'abuse_warning',
      reason: input.reason,
      related_payment_id: input.related_payment_id,
      flagged_by_admin_id: input.flagged_by_admin_id,
    });
    let user = userRepository.incrementAbuseCount(input.user_id);
    if (user === undefined) {
      throw new Error(`recordAbuseFlag: user ${input.user_id} not found`);
    }
    const autoBlocked = user.abuse_warning_count >= ABUSE_AUTO_BLOCK_THRESHOLD;
    if (autoBlocked && !user.is_blocked) {
      user = userRepository.setBlocked(input.user_id, true);
      if (user === undefined) {
        throw new Error('recordAbuseFlag: setBlocked returned undefined');
      }
    }
    return {
      user,
      warning_count: user.abuse_warning_count,
      needs_superadmin_review:
        user.abuse_warning_count >= ABUSE_FLAGGED_REVIEW_THRESHOLD,
      auto_blocked: user.is_blocked,
    };
  });
  return tx();
};

export const clearAbuseWarnings = (input: {
  user_id: number;
  cleared_by_admin_id: number;
  reason: string;
}): { user: User; cleared_count: number } => {
  const tx = db.transaction(() => {
    const cleared = userFlagsRepository.clearAllActiveByUser(
      input.user_id,
      input.cleared_by_admin_id,
      input.reason
    );
    const user = userRepository.clearAbuseCount(input.user_id);
    if (user === undefined) {
      throw new Error(`clearAbuseWarnings: user ${input.user_id} not found`);
    }
    return { user, cleared_count: cleared };
  });
  return tx();
};

export const isUserAtFlaggedReviewLevel = (user: User): boolean =>
  user.abuse_warning_count >= ABUSE_FLAGGED_REVIEW_THRESHOLD;
