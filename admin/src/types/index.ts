// Mirrors backend src/domain/types.ts for admin-facing endpoints.

export type AdminRole = 'superadmin' | 'operator';

export type AdminUserPublic = {
  id: number;
  email: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_by_admin_id: number | null;
  created_at: string;
  updated_at: string;
};

export type ManualPaymentStatus =
  | 'awaiting_slip'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged_review'
  | 'revoked';

export type ManualPayment = {
  id: number;
  user_id: number;
  requested_amount_satang: number;
  actual_amount_satang: number | null;
  slip_file_path: string | null;
  slip_mime_type: string | null;
  slip_size_bytes: number | null;
  status: ManualPaymentStatus;
  reviewed_by_admin_id: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  flag_user_as_abuse: boolean;
  credit_granted_satang: number | null;
  revoked_by_admin_id: number | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSummary = {
  id: number;
  display_name: string | null;
  abuse_warning_count: number;
  is_blocked: boolean;
};

export type ManualPaymentWithUser = ManualPayment & {
  user: UserSummary | null;
};

export type UserDetail = {
  id: number;
  line_user_id: string;
  display_name: string | null;
  plan: 'free' | 'premium';
  premium_expires_at: string | null;
  credit_balance_satang: number;
  abuse_warning_count: number;
  is_blocked: boolean;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
};

export type UserListEntry = UserDetail;

export type UserFlag = {
  id: number;
  user_id: number;
  flag_type: 'abuse_warning' | 'manual_block';
  reason: string | null;
  related_payment_id: number | null;
  flagged_by_admin_id: number;
  flagged_at: string;
  cleared_by_admin_id: number | null;
  cleared_at: string | null;
  clear_reason: string | null;
};

export type CreditLedgerEntry = {
  id: number;
  user_id: number;
  amount_satang: number;
  balance_after_satang: number;
  source_type:
    | 'manual_topup'
    | 'omise_topup'
    | 'admin_grant'
    | 'redeem_premium'
    | 'revoke_topup'
    | 'revoke_redeem';
  source_ref_id: number | null;
  admin_user_id: number | null;
  note: string | null;
  created_at: string;
};

export type SystemSetting = {
  key: string;
  value: string;
  updated_by_admin_id: number | null;
  updated_at: string;
};

export const formatThb = (satang: number): string =>
  `${(satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export const formatStatusLabel = (status: ManualPaymentStatus): string => {
  switch (status) {
    case 'awaiting_slip':
      return 'Awaiting slip';
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'flagged_review':
      return 'Flagged for superadmin';
    case 'revoked':
      return 'Revoked';
  }
};

export const STATUS_BADGE_CLASS: Record<ManualPaymentStatus, string> = {
  awaiting_slip: 'bg-slate-100 text-slate-600',
  pending: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  flagged_review: 'bg-amber-100 text-amber-700',
  revoked: 'bg-purple-100 text-purple-700',
};
