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

let _sessionToken: string | null = null;

export const setSessionToken = (token: string | null): void => {
  _sessionToken = token;
};

export const getSessionToken = (): string | null => _sessionToken;

const buildHeaders = (extra?: HeadersInit): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> | undefined),
  };
  if (_sessionToken !== null) {
    headers['Authorization'] = `Bearer ${_sessionToken}`;
  }
  return headers;
};

const request = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });

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
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
