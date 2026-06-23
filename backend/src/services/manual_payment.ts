import { db } from '../db/sqlite.js';
import { manualPaymentsRepository } from '../repositories/manual_payments.js';
import { userRepository } from '../repositories/users.js';
import { systemSettingsRepository } from '../repositories/system_settings.js';
import { saveSlip, deleteSlip } from './slip_storage.js';
import { applyCreditMutation, CreditError } from './credit.js';
import { recordAbuseFlag } from './abuse_flag.js';
import type { ManualPayment, User } from '../domain/types.js';

export class ManualPaymentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'USER_BLOCKED'
      | 'AMOUNT_OUT_OF_RANGE'
      | 'NO_PENDING_TO_REVIEW'
      | 'ALREADY_HAS_PENDING'
      | 'ALREADY_HAS_AWAITING_SLIP'
      | 'PAYMENT_NOT_FOUND'
      | 'WRONG_STATUS'
      | 'WRONG_USER'
      | 'HIGH_VALUE_NEEDS_SUPERADMIN'
      | 'REQUIRES_REJECTION_REASON'
      | 'NO_SLIP_UPLOADED'
  ) {
    super(message);
    this.name = 'ManualPaymentError';
  }
}

export type StartTopupResult = {
  payment: ManualPayment;
};

export const startManualTopup = (input: {
  user: User;
  requested_amount_satang: number;
}): StartTopupResult => {
  if (input.user.is_blocked) {
    throw new ManualPaymentError(
      'User is blocked from creating new topups',
      'USER_BLOCKED'
    );
  }
  const minSatang = systemSettingsRepository.getNumber('topup_min_satang', 5000);
  const maxSatang = systemSettingsRepository.getNumber('topup_max_satang', 500000);
  if (
    !Number.isInteger(input.requested_amount_satang) ||
    input.requested_amount_satang < minSatang ||
    input.requested_amount_satang > maxSatang
  ) {
    throw new ManualPaymentError(
      `requested_amount_satang must be integer in [${minSatang}, ${maxSatang}]`,
      'AMOUNT_OUT_OF_RANGE'
    );
  }

  // Enforce: only one awaiting_slip or pending submission at a time
  const awaiting = manualPaymentsRepository.countByUserAndStatus(
    input.user.id,
    'awaiting_slip'
  );
  if (awaiting > 0) {
    throw new ManualPaymentError(
      'You already have an unfinished topup. Upload the slip first.',
      'ALREADY_HAS_AWAITING_SLIP'
    );
  }
  const pending = manualPaymentsRepository.countByUserAndStatus(
    input.user.id,
    'pending'
  );
  if (pending > 0) {
    throw new ManualPaymentError(
      'You already have a pending topup awaiting review.',
      'ALREADY_HAS_PENDING'
    );
  }

  const payment = manualPaymentsRepository.createAwaitingSlip(
    input.user.id,
    input.requested_amount_satang
  );
  return { payment };
};

export type UploadSlipResult = {
  payment: ManualPayment;
};

export const uploadSlipForPayment = async (input: {
  user_id: number;
  payment_id: number;
  buffer: Buffer;
  mime_type: string;
}): Promise<UploadSlipResult> => {
  const existing = manualPaymentsRepository.findById(input.payment_id);
  if (existing === undefined) {
    throw new ManualPaymentError('Payment not found', 'PAYMENT_NOT_FOUND');
  }
  if (existing.user_id !== input.user_id) {
    throw new ManualPaymentError('Payment not found', 'WRONG_USER');
  }
  if (existing.status !== 'awaiting_slip') {
    throw new ManualPaymentError(
      `Cannot upload slip: status is '${existing.status}'`,
      'WRONG_STATUS'
    );
  }

  const saved = await saveSlip({
    buffer: input.buffer,
    mime_type: input.mime_type,
  });

  const updated = manualPaymentsRepository.attachSlip(
    input.payment_id,
    saved.file_path,
    saved.mime_type,
    saved.size_bytes
  );
  if (updated === undefined) {
    await deleteSlip(saved.file_path).catch(() => undefined);
    throw new ManualPaymentError(
      'Failed to attach slip (status changed?)',
      'WRONG_STATUS'
    );
  }

  // Note: even if the user has abuse warnings, we keep status='pending'.
  // The operator dashboard surfaces the warning badge; the high-value
  // escalation logic at approve-time handles superadmin gating.

  return { payment: updated };
};

export type ApproveInput = {
  payment_id: number;
  admin_id: number;
  admin_role: 'superadmin' | 'operator';
  actual_amount_satang: number;
  admin_notes: string | null;
  flag_user_as_abuse: boolean;
  abuse_reason: string | null;
};

export type ApproveResult = {
  payment: ManualPayment;
  user: User;
  credit_granted_satang: number;
};

export const approveManualPayment = (input: ApproveInput): ApproveResult => {
  // Read-only validation (no DB writes)
  const existing = manualPaymentsRepository.findById(input.payment_id);
  if (existing === undefined) {
    throw new ManualPaymentError('Payment not found', 'PAYMENT_NOT_FOUND');
  }
  if (existing.status !== 'pending' && existing.status !== 'flagged_review') {
    throw new ManualPaymentError(
      `Cannot approve: status is '${existing.status}'`,
      'WRONG_STATUS'
    );
  }
  if (
    !Number.isInteger(input.actual_amount_satang) ||
    input.actual_amount_satang <= 0
  ) {
    throw new ManualPaymentError(
      'actual_amount_satang must be positive integer',
      'AMOUNT_OUT_OF_RANGE'
    );
  }

  const highValueThreshold = systemSettingsRepository.getNumber(
    'high_value_threshold_satang',
    500000
  );

  // High-value escalation: only superadmin may approve >= threshold.
  // If a regular operator tries it AND it's not already flagged_review, we
  // promote the row to flagged_review in its OWN transaction so the state
  // change persists, then throw to inform the caller.
  if (
    input.actual_amount_satang >= highValueThreshold &&
    input.admin_role !== 'superadmin'
  ) {
    if (existing.status !== 'flagged_review') {
      manualPaymentsRepository.markReviewed({
        id: input.payment_id,
        status: 'flagged_review',
        admin_id: input.admin_id,
        actual_amount_satang: input.actual_amount_satang,
        credit_granted_satang: null,
        rejection_reason: null,
        admin_notes:
          (input.admin_notes ? input.admin_notes + ' | ' : '') +
          'Auto-escalated: amount above high-value threshold',
        flag_user_as_abuse: input.flag_user_as_abuse,
      });
    }
    throw new ManualPaymentError(
      'Amount exceeds high-value threshold; escalated for superadmin review',
      'HIGH_VALUE_NEEDS_SUPERADMIN'
    );
  }

  // Main approval transaction: mark approved + grant credit + (optionally) flag.
  const tx = db.transaction(() => {
    const reviewed = manualPaymentsRepository.markReviewed({
      id: input.payment_id,
      status: 'approved',
      admin_id: input.admin_id,
      actual_amount_satang: input.actual_amount_satang,
      credit_granted_satang: input.actual_amount_satang,
      rejection_reason: null,
      admin_notes: input.admin_notes,
      flag_user_as_abuse: input.flag_user_as_abuse,
    });
    if (reviewed === undefined) {
      throw new ManualPaymentError(
        'Failed to mark approved (concurrent review?)',
        'WRONG_STATUS'
      );
    }

    const credit = applyCreditMutation({
      user_id: existing.user_id,
      amount_satang: input.actual_amount_satang,
      source_type: 'manual_topup',
      source_ref_id: existing.id,
      admin_user_id: input.admin_id,
      note: `Manual topup #${existing.id} approved`,
    });

    if (input.flag_user_as_abuse) {
      recordAbuseFlag({
        user_id: existing.user_id,
        reason: input.abuse_reason,
        related_payment_id: existing.id,
        flagged_by_admin_id: input.admin_id,
      });
    }

    return {
      payment: reviewed,
      user: credit.user,
      credit_granted_satang: input.actual_amount_satang,
    };
  });

  return tx();
};

export type RejectInput = {
  payment_id: number;
  admin_id: number;
  rejection_reason: string;
  admin_notes: string | null;
  flag_user_as_abuse: boolean;
  abuse_reason: string | null;
};

export type RejectResult = {
  payment: ManualPayment;
  user: User;
};

export const rejectManualPayment = (input: RejectInput): RejectResult => {
  if (input.rejection_reason.trim().length === 0) {
    throw new ManualPaymentError(
      'Rejection reason required',
      'REQUIRES_REJECTION_REASON'
    );
  }

  const tx = db.transaction(() => {
    const existing = manualPaymentsRepository.findById(input.payment_id);
    if (existing === undefined) {
      throw new ManualPaymentError('Payment not found', 'PAYMENT_NOT_FOUND');
    }
    if (existing.status !== 'pending' && existing.status !== 'flagged_review') {
      throw new ManualPaymentError(
        `Cannot reject: status is '${existing.status}'`,
        'WRONG_STATUS'
      );
    }

    const reviewed = manualPaymentsRepository.markReviewed({
      id: input.payment_id,
      status: 'rejected',
      admin_id: input.admin_id,
      actual_amount_satang: null,
      credit_granted_satang: null,
      rejection_reason: input.rejection_reason,
      admin_notes: input.admin_notes,
      flag_user_as_abuse: input.flag_user_as_abuse,
    });
    if (reviewed === undefined) {
      throw new ManualPaymentError(
        'Failed to mark rejected (concurrent review?)',
        'WRONG_STATUS'
      );
    }

    let user = userRepository.findById(existing.user_id);
    if (user === undefined) {
      throw new ManualPaymentError('User not found', 'PAYMENT_NOT_FOUND');
    }

    if (input.flag_user_as_abuse) {
      const result = recordAbuseFlag({
        user_id: existing.user_id,
        reason: input.abuse_reason,
        related_payment_id: existing.id,
        flagged_by_admin_id: input.admin_id,
      });
      user = result.user;
    }

    return { payment: reviewed, user };
  });

  return tx();
};

export type RevokeInput = {
  payment_id: number;
  admin_id: number;
  revoke_reason: string;
};

export type RevokeResult = {
  payment: ManualPayment;
  user: User;
  credit_deducted_satang: number;
  balance_went_to_zero: boolean;
};

export const revokeApprovedManualPayment = (input: RevokeInput): RevokeResult => {
  const tx = db.transaction(() => {
    const existing = manualPaymentsRepository.findById(input.payment_id);
    if (existing === undefined) {
      throw new ManualPaymentError('Payment not found', 'PAYMENT_NOT_FOUND');
    }
    if (existing.status !== 'approved') {
      throw new ManualPaymentError(
        `Cannot revoke: status is '${existing.status}' (must be approved)`,
        'WRONG_STATUS'
      );
    }
    const grantedSatang = existing.credit_granted_satang ?? 0;
    if (grantedSatang <= 0) {
      throw new ManualPaymentError(
        'Payment has no credit_granted to revoke',
        'WRONG_STATUS'
      );
    }

    const user = userRepository.findById(existing.user_id);
    if (user === undefined) {
      throw new ManualPaymentError('User not found', 'PAYMENT_NOT_FOUND');
    }

    // If user has spent some/all of the credit, we deduct only what's available.
    // Note: this means the user keeps any premium they redeemed using the
    // (now revoked) credit. Superadmin can manually revert premium via the
    // separate admin endpoint if needed.
    const deductSatang = Math.min(user.credit_balance_satang, grantedSatang);
    const balanceWentToZero =
      deductSatang < grantedSatang && user.credit_balance_satang > 0;

    if (deductSatang > 0) {
      try {
        applyCreditMutation({
          user_id: existing.user_id,
          amount_satang: -deductSatang,
          source_type: 'revoke_topup',
          source_ref_id: existing.id,
          admin_user_id: input.admin_id,
          note: `Revoked topup #${existing.id}: ${input.revoke_reason}`,
        });
      } catch (err) {
        if (err instanceof CreditError) {
          throw new ManualPaymentError(
            `Credit deduction failed: ${err.message}`,
            'WRONG_STATUS'
          );
        }
        throw err;
      }
    }

    const updated = manualPaymentsRepository.markRevoked(
      existing.id,
      input.admin_id,
      input.revoke_reason
    );
    if (updated === undefined) {
      throw new ManualPaymentError(
        'Failed to mark revoked (concurrent review?)',
        'WRONG_STATUS'
      );
    }

    const refreshedUser = userRepository.findById(existing.user_id);
    return {
      payment: updated,
      user: refreshedUser ?? user,
      credit_deducted_satang: deductSatang,
      balance_went_to_zero: balanceWentToZero,
    };
  });

  return tx();
};
