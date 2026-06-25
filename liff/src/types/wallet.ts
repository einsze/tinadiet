// Mirrors backend src/domain/types.ts (CreditLedgerEntry + ManualPayment etc.)

export type CreditLedgerSourceType =
  | 'manual_topup'
  | 'omise_topup'
  | 'admin_grant'
  | 'redeem_premium'
  | 'revoke_topup'
  | 'revoke_redeem';

export type CreditLedgerEntry = {
  id: number;
  user_id: number;
  amount_satang: number;
  balance_after_satang: number;
  source_type: CreditLedgerSourceType;
  source_ref_id: number | null;
  admin_user_id: number | null;
  note: string | null;
  created_at: string;
};

export type WalletState = {
  balance_satang: number;
  is_blocked: boolean;
  abuse_warning_count: number;
  recent_transactions: CreditLedgerEntry[];
};

export type ManualPaymentStatus =
  | 'awaiting_slip'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged_review'
  | 'revoked';

export type ManualPaymentSubmission = {
  id: number;
  requested_amount_satang: number;
  actual_amount_satang: number | null;
  status: ManualPaymentStatus;
  rejection_reason: string | null;
  credit_granted_satang: number | null;
  created_at: string;
  reviewed_at: string | null;
};

export type TopupConfig = {
  presets_thb: number[];
  min_thb: number;
  max_thb: number;
};

export type StartManualTopupResponse = {
  payment_id: number;
  amount_thb: number;
  amount_satang: number;
  qr_data_url: string;
  promptpay_receiver_id: string;
  promptpay_receiver_name: string;
  /** Only present on /current responses (resume flow). Optional for /start. */
  created_at?: string;
};

export type PremiumBundleId = 1 | 3 | 6 | 12 | '7d';

export type PremiumBundle = {
  months: PremiumBundleId;
  credit_required: number;
};

export type RedeemPremiumResponse = {
  bundle_months: PremiumBundleId;
  credit_spent_satang: number;
  premium_expires_at: string;
  credit_balance_satang: number;
  is_premium: boolean;
};

export const formatBundleLabel = (id: PremiumBundleId): string => {
  if (id === '7d') return '7 วัน';
  return `${id} เดือน`;
};

export const formatCredit = (satang: number): string =>
  `${(satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export const formatStatusLabel = (status: ManualPaymentStatus): string => {
  switch (status) {
    case 'awaiting_slip':
      return 'รอแนบสลิป';
    case 'pending':
      return 'รอการตรวจสอบ';
    case 'approved':
      return 'อนุมัติแล้ว';
    case 'rejected':
      return 'ปฏิเสธ';
    case 'flagged_review':
      return 'ตรวจสอบโดยผู้ดูแลพิเศษ';
    case 'revoked':
      return 'ยกเลิกการอนุมัติ';
  }
};
