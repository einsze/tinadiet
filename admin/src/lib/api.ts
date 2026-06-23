import { env } from './env.js';

export type ApiError = {
  status: number;
  code: string;
  message: string;
};

const isApiErrorBody = (
  v: unknown
): v is { error: { code: string; message: string } } => {
  return (
    typeof v === 'object' &&
    v !== null &&
    'error' in v &&
    typeof (v as { error: unknown }).error === 'object'
  );
};

const TOKEN_KEY = 'tinadiet_admin_token';

let _adminToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
let _onUnauthorized: (() => void) | null = null;

export const setAdminToken = (token: string | null): void => {
  _adminToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
};

export const getAdminToken = (): string | null => _adminToken;

export const setOnUnauthorized = (fn: (() => void) | null): void => {
  _onUnauthorized = fn;
};

const buildHeaders = (extra?: HeadersInit): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> | undefined),
  };
  if (_adminToken !== null) {
    headers['Authorization'] = `Bearer ${_adminToken}`;
  }
  return headers;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  if (res.status === 401 && _onUnauthorized !== null) {
    _onUnauthorized();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      code: isApiErrorBody(body) ? body.error.code : 'UNKNOWN',
      message: isApiErrorBody(body) ? body.error.message : res.statusText,
    };
    throw err;
  }

  return body as T;
};

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Direct fetch URL for binary endpoints (e.g. slip image)
export const buildAuthedUrl = (path: string): string =>
  `${env.API_BASE_URL}${path}`;

export const buildAuthHeader = (): Record<string, string> =>
  _adminToken !== null ? { Authorization: `Bearer ${_adminToken}` } : {};
