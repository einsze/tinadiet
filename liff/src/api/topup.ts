import { api } from '../lib/api.js';
import type {
  ManualPaymentSubmission,
  StartManualTopupResponse,
  TopupConfig,
} from '../types/wallet.js';

export const topupApi = {
  config: () => api.get<TopupConfig>('/api/v1/topup/config'),

  startManual: (amountThb: number) =>
    api.post<StartManualTopupResponse>('/api/v1/topup/manual/start', {
      amount_thb: amountThb,
    }),

  uploadSlip: (paymentId: number, file: File) => {
    const fd = new FormData();
    fd.append('slip', file);
    return api.postMultipart<{ payment: { id: number; status: string } }>(
      `/api/v1/topup/manual/${paymentId}/upload-slip`,
      fd
    );
  },

  mySubmissions: (limit = 10) =>
    api.get<{ submissions: ManualPaymentSubmission[] }>(
      `/api/v1/topup/submissions?limit=${limit}`
    ),

  currentManual: () =>
    api.get<{ current: StartManualTopupResponse | null }>(
      '/api/v1/topup/manual/current'
    ),

  cancelManual: (paymentId: number) =>
    api.post<{ ok: true; payment_id: number }>(
      `/api/v1/topup/manual/${paymentId}/cancel`
    ),
};
