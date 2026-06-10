import { api, getSessionToken } from '../lib/api.js';
import { env } from '../lib/env.js';

export type AccountDeleteResponse = {
  deleted: boolean;
  stripe: {
    subscription_canceled: 'skipped' | 'canceled' | 'failed';
    customer_deleted: 'skipped' | 'deleted' | 'failed';
  };
  message: string;
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

export const accountApi = {
  exportData: async (): Promise<void> => {
    const token = getSessionToken();
    if (token === null) {
      throw {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'No session token',
      };
    }
    const res = await fetch(`${env.API_BASE_URL}/api/v1/account/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      try {
        const parsed = JSON.parse(body) as {
          error?: { code?: string; message?: string };
        };
        throw {
          status: res.status,
          code: parsed.error?.code ?? 'UNKNOWN',
          message: parsed.error?.message ?? res.statusText,
        };
      } catch {
        throw {
          status: res.status,
          code: 'UNKNOWN',
          message: res.statusText,
        };
      }
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename =
      match !== null && match[1]
        ? match[1]
        : `tinadiet-export-${new Date().toISOString().slice(0, 10)}.json`;
    triggerDownload(blob, filename);
  },

  deleteAccount: (confirm: 'DELETE') =>
    api.post<AccountDeleteResponse>('/api/v1/account/delete', { confirm }),
};
