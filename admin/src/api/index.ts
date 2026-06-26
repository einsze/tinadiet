import { api } from '../lib/api.js';
import type {
  AdminUserPublic,
  CreditLedgerEntry,
  ManualPayment,
  ManualPaymentStatus,
  ManualPaymentWithUser,
  SystemSetting,
  UserDetail,
  UserFlag,
  UserListEntry,
} from '../types/index.js';

// ----- Auth -----

export type LoginResponse = {
  token: string;
  admin: AdminUserPublic;
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/v1/admin/auth/login', { email, password }),
  me: () => api.get<{ admin: AdminUserPublic }>('/api/v1/admin/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: true }>('/api/v1/admin/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

// ----- Payments -----

export type PaymentsListResponse = {
  payments: ManualPaymentWithUser[];
  pagination: { limit: number; offset: number; total: number };
};

export type PaymentDetailResponse = {
  payment: ManualPayment;
  user: {
    id: number;
    display_name: string | null;
    line_user_id: string;
    abuse_warning_count: number;
    is_blocked: boolean;
    credit_balance_satang: number;
  } | null;
};

export type ApproveResponse = {
  payment: ManualPayment;
  credit_granted_satang: number;
  user_credit_balance_satang: number;
};

export type RevokeResponse = {
  payment: ManualPayment;
  credit_deducted_satang: number;
  balance_went_to_zero: boolean;
  user_credit_balance_satang: number;
};

export const paymentsApi = {
  pending: (limit = 50, offset = 0) =>
    api.get<PaymentsListResponse>(
      `/api/v1/admin/payments/pending?limit=${limit}&offset=${offset}`
    ),
  history: (
    opts: {
      status?: 'approved' | 'rejected' | 'revoked';
      userId?: number;
      limit?: number;
      offset?: number;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    if (opts.status !== undefined) qs.set('status', opts.status);
    if (opts.userId !== undefined) qs.set('user_id', String(opts.userId));
    qs.set('limit', String(opts.limit ?? 50));
    qs.set('offset', String(opts.offset ?? 0));
    return api.get<PaymentsListResponse>(
      `/api/v1/admin/payments/history?${qs.toString()}`
    );
  },
  detail: (id: number) =>
    api.get<PaymentDetailResponse>(`/api/v1/admin/payments/${id}`),
  approve: (
    id: number,
    body: {
      actual_amount_satang: number;
      admin_notes?: string;
      flag_user_as_abuse?: boolean;
      abuse_reason?: string;
    }
  ) => api.post<ApproveResponse>(`/api/v1/admin/payments/${id}/approve`, body),
  reject: (
    id: number,
    body: {
      rejection_reason: string;
      admin_notes?: string;
      flag_user_as_abuse?: boolean;
      abuse_reason?: string;
    }
  ) =>
    api.post<{ payment: ManualPayment }>(
      `/api/v1/admin/payments/${id}/reject`,
      body
    ),
  revoke: (id: number, revoke_reason: string) =>
    api.post<RevokeResponse>(`/api/v1/admin/payments/${id}/revoke`, {
      revoke_reason,
    }),
};

// ----- Users -----

export type UsersListResponse = {
  users: UserListEntry[];
  pagination: { limit: number; offset: number; total: number };
};

export type UserDetailResponse = {
  user: UserDetail;
  flags: UserFlag[];
  recent_payments: ManualPayment[];
  recent_ledger: CreditLedgerEntry[];
};

export const usersApi = {
  list: (
    opts: {
      q?: string;
      flagged?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    if (opts.q !== undefined && opts.q.length > 0) qs.set('q', opts.q);
    if (opts.flagged === true) qs.set('flagged', '1');
    qs.set('limit', String(opts.limit ?? 30));
    qs.set('offset', String(opts.offset ?? 0));
    return api.get<UsersListResponse>(`/api/v1/admin/users?${qs.toString()}`);
  },
  detail: (id: number) =>
    api.get<UserDetailResponse>(`/api/v1/admin/users/${id}`),
  adjustCredit: (id: number, deltaSatang: number, reason: string) =>
    api.post<{
      ledger_entry: CreditLedgerEntry;
      user_credit_balance_satang: number;
    }>(`/api/v1/admin/users/${id}/adjust-credit`, {
      delta_satang: deltaSatang,
      reason,
    }),
  clearWarnings: (id: number, reason: string) =>
    api.post<{
      cleared_count: number;
      user: { id: number; abuse_warning_count: number; is_blocked: boolean };
    }>(`/api/v1/admin/users/${id}/clear-warnings`, { reason }),
  block: (id: number) =>
    api.post<{ user: { id: number; is_blocked: boolean } }>(
      `/api/v1/admin/users/${id}/block`
    ),
  unblock: (id: number) =>
    api.post<{ user: { id: number; is_blocked: boolean } }>(
      `/api/v1/admin/users/${id}/unblock`
    ),
};

// ----- Settings -----

export const settingsApi = {
  all: () => api.get<{ settings: SystemSetting[] }>('/api/v1/admin/settings'),
  update: (updates: Record<string, string>) =>
    api.put<{ updated: Record<string, string> }>('/api/v1/admin/settings', {
      updates,
    }),
};

// ----- Operators (admin user management) -----

export const operatorsApi = {
  list: () =>
    api.get<{ operators: AdminUserPublic[] }>('/api/v1/admin/operators'),
  create: (input: {
    email: string;
    password: string;
    display_name: string;
    role: 'superadmin' | 'operator';
  }) => api.post<{ admin: AdminUserPublic }>('/api/v1/admin/operators', input),
  update: (
    id: number,
    input: {
      display_name?: string;
      role?: 'superadmin' | 'operator';
      is_active?: boolean;
      password?: string;
    }
  ) =>
    api.put<{ admin: AdminUserPublic }>(`/api/v1/admin/operators/${id}`, input),
  delete: (id: number) =>
    api.delete<{ ok: true }>(`/api/v1/admin/operators/${id}`),
};

// Re-export ManualPaymentStatus type for convenience
export type { ManualPaymentStatus };

// ----- Gifts (admin) -----

export type AdminGiftStatus =
  | 'pending'
  | 'claimed'
  | 'canceled'
  | 'expired'
  | 'refused'
  | 'revoked';

export type AdminGiftListItem = {
  id: number;
  claim_token: string;
  gift_type: 'premium' | 'theme';
  payload: { months?: 1 | 3 | 6 | 12; theme_slug?: string };
  credit_spent_satang: number;
  message: string | null;
  status: AdminGiftStatus;
  claim_expires_at: string;
  claimed_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  refused_at: string | null;
  refused_reason: string | null;
  revoked_at: string | null;
  revoked_by_admin_id: number | null;
  revoke_reason: string | null;
  applied_premium_ms_added: number | null;
  applied_theme_slug: string | null;
  created_at: string;
  updated_at: string;
  sender: { id: number; display_name: string | null; line_user_id: string } | null;
  recipient: { id: number; display_name: string | null; line_user_id: string } | null;
};

export const giftsApi = {
  list: (opts: { status?: AdminGiftStatus; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.status !== undefined) qs.set('status', opts.status);
    qs.set('limit', String(opts.limit ?? 50));
    qs.set('offset', String(opts.offset ?? 0));
    return api.get<{
      gifts: AdminGiftListItem[];
      pagination: { limit: number; offset: number; total: number };
    }>(`/api/v1/admin/gifts?${qs.toString()}`);
  },
  detail: (id: number) =>
    api.get<{ gift: AdminGiftListItem }>(`/api/v1/admin/gifts/${id}`),
  revoke: (id: number, reason: string) =>
    api.post<{ gift_id: number; sender_new_balance_satang: number }>(
      `/api/v1/admin/gifts/${id}/revoke`,
      { reason }
    ),
};
