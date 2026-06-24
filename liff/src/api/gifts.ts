import { api } from '../lib/api.js';
import type {
  ClaimPreview,
  ClaimResult,
  CreateGiftRequest,
  CreateGiftResponse,
  ReceivedGift,
  SentGift,
} from '../types/gift.js';

export const giftsApi = {
  create: (body: CreateGiftRequest) =>
    api.post<CreateGiftResponse>('/api/v1/gifts', body),

  listSent: (limit = 50) =>
    api.get<{ gifts: SentGift[] }>(`/api/v1/gifts/sent?limit=${limit}`),

  listReceived: (limit = 50) =>
    api.get<{ gifts: ReceivedGift[] }>(`/api/v1/gifts/received?limit=${limit}`),

  preview: (token: string) =>
    api.get<ClaimPreview>(`/api/v1/gifts/claim/${encodeURIComponent(token)}`),

  claim: (token: string) =>
    api.post<ClaimResult>(`/api/v1/gifts/claim/${encodeURIComponent(token)}`),

  cancel: (giftId: number) =>
    api.post<{ gift_id: number; credit_balance_satang: number }>(
      `/api/v1/gifts/${giftId}/cancel`
    ),
};
