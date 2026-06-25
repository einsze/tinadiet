import type { ThemeSlug } from '../themes/catalog.js';

export type GiftType = 'premium' | 'theme';

export type GiftStatus =
  | 'pending'
  | 'claimed'
  | 'canceled'
  | 'expired'
  | 'refused'
  | 'revoked';

export type GiftRefusedReason =
  | 'recipient_already_owns_theme'
  | 'recipient_blocked'
  | 'self_claim';

export type GiftPremiumPayload = { months: 1 | 3 | 6 | 12 | '7d' };
export type GiftThemePayload = { theme_slug: ThemeSlug };
export type GiftPayload = GiftPremiumPayload | GiftThemePayload;

export type CreateGiftRequest = {
  gift_type: GiftType;
  payload: GiftPayload;
  message?: string | null;
};

export type CreateGiftResponse = {
  gift_id: number;
  claim_token: string;
  claim_url: string;
  claim_expires_at: string;
  credit_balance_satang: number;
};

export type SentGift = {
  id: number;
  claim_token: string;
  gift_type: GiftType;
  payload: GiftPayload;
  credit_spent_satang: number;
  status: GiftStatus;
  message: string | null;
  claim_expires_at: string;
  claimed_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  refused_at: string | null;
  refused_reason: GiftRefusedReason | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  recipient_user_id: number | null;
  created_at: string;
};

export type ReceivedGift = {
  id: number;
  gift_type: GiftType;
  payload: GiftPayload;
  status: GiftStatus;
  message: string | null;
  sender_display_name: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
};

export type ClaimPreview = {
  gift_type: GiftType;
  payload: GiftPayload;
  sender_display_name: string | null;
  message: string | null;
  status: GiftStatus;
  claim_expires_at: string;
  credit_value_satang: number;
};

export type ClaimResult = {
  gift_id: number;
  gift_type: GiftType;
  payload: GiftPayload;
  recipient_user: {
    id: number;
    credit_balance_satang: number;
    premium_expires_at: string | null;
    active_theme_slug: string | null;
  };
};

export const statusLabel = (status: GiftStatus): string => {
  switch (status) {
    case 'pending':
      return 'รอผู้รับ';
    case 'claimed':
      return 'รับแล้ว';
    case 'canceled':
      return 'ยกเลิก';
    case 'expired':
      return 'หมดอายุ';
    case 'refused':
      return 'รับไม่ได้';
    case 'revoked':
      return 'ถูกยกเลิกโดยทีม';
  }
};

export const refusedReasonLabel = (
  reason: GiftRefusedReason | null
): string => {
  switch (reason) {
    case 'recipient_already_owns_theme':
      return 'ผู้รับมีธีมนี้อยู่แล้ว';
    case 'recipient_blocked':
      return 'บัญชีผู้รับถูกระงับ';
    case 'self_claim':
      return 'ไม่สามารถรับของขวัญตัวเองได้';
    default:
      return '-';
  }
};
