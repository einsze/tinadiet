import { api } from '../lib/api.js';
import type { CreditLedgerEntry, WalletState } from '../types/wallet.js';

export type WalletHistoryResponse = {
  entries: CreditLedgerEntry[];
  pagination: { limit: number; offset: number; total: number };
};

export const walletApi = {
  get: () => api.get<WalletState>('/api/v1/wallet'),
  history: (limit = 50, offset = 0) =>
    api.get<WalletHistoryResponse>(
      `/api/v1/wallet/history?limit=${limit}&offset=${offset}`
    ),
};
