import { db } from '../db/sqlite.js';
import { creditLedgerRepository } from '../repositories/credit_ledger.js';
import { userRepository } from '../repositories/users.js';
import type {
  CreditLedgerEntry,
  CreditLedgerSourceType,
  User,
} from '../domain/types.js';

export class CreditError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'USER_NOT_FOUND'
      | 'INSUFFICIENT_BALANCE'
      | 'INVALID_AMOUNT'
  ) {
    super(message);
    this.name = 'CreditError';
  }
}

export type CreditMutationInput = {
  user_id: number;
  amount_satang: number; // signed: positive=earn, negative=spend
  source_type: CreditLedgerSourceType;
  source_ref_id: number | null;
  admin_user_id: number | null;
  note: string | null;
};

export type CreditMutationResult = {
  user: User;
  ledger_entry: CreditLedgerEntry;
};

/**
 * Atomically apply a credit balance change + record ledger entry.
 * Throws if user not found or spend would result in negative balance.
 */
export const applyCreditMutation = (
  input: CreditMutationInput
): CreditMutationResult => {
  if (input.amount_satang === 0) {
    throw new CreditError('amount_satang cannot be zero', 'INVALID_AMOUNT');
  }
  if (!Number.isInteger(input.amount_satang)) {
    throw new CreditError(
      `amount_satang must be integer satang, got ${input.amount_satang}`,
      'INVALID_AMOUNT'
    );
  }

  const tx = db.transaction(() => {
    const user = userRepository.findById(input.user_id);
    if (user === undefined) {
      throw new CreditError(
        `User ${input.user_id} not found`,
        'USER_NOT_FOUND'
      );
    }
    const newBalance = user.credit_balance_satang + input.amount_satang;
    if (newBalance < 0) {
      throw new CreditError(
        `Insufficient credit balance: have ${user.credit_balance_satang} satang, ` +
          `requested -${Math.abs(input.amount_satang)} satang`,
        'INSUFFICIENT_BALANCE'
      );
    }
    const updatedUser = userRepository.updateCreditBalance(
      input.user_id,
      newBalance
    );
    if (updatedUser === undefined) {
      throw new CreditError('Update returned no user row', 'USER_NOT_FOUND');
    }
    const entry = creditLedgerRepository.create({
      user_id: input.user_id,
      amount_satang: input.amount_satang,
      balance_after_satang: newBalance,
      source_type: input.source_type,
      source_ref_id: input.source_ref_id,
      admin_user_id: input.admin_user_id,
      note: input.note,
    });
    return { user: updatedUser, ledger_entry: entry };
  });

  return tx();
};

export const grantCredit = (
  input: Omit<CreditMutationInput, 'amount_satang'> & { amount_satang: number }
): CreditMutationResult => {
  if (input.amount_satang <= 0) {
    throw new CreditError(
      `grantCredit amount must be positive, got ${input.amount_satang}`,
      'INVALID_AMOUNT'
    );
  }
  return applyCreditMutation(input);
};

export const spendCredit = (
  input: Omit<CreditMutationInput, 'amount_satang'> & { amount_satang: number }
): CreditMutationResult => {
  if (input.amount_satang <= 0) {
    throw new CreditError(
      `spendCredit amount must be positive, got ${input.amount_satang}`,
      'INVALID_AMOUNT'
    );
  }
  return applyCreditMutation({
    ...input,
    amount_satang: -input.amount_satang,
  });
};
