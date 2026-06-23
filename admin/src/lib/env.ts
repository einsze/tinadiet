const apiBase =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const env = {
  API_BASE_URL: String(apiBase),
} as const;
