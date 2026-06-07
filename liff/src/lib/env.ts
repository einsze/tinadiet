const requireViteEnv = (key: string, value: string | undefined): string => {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required Vite env: ${key}`);
  }
  return value;
};

export const env = {
  LIFF_ID: requireViteEnv('VITE_LIFF_ID', import.meta.env.VITE_LIFF_ID),
  API_BASE_URL: requireViteEnv(
    'VITE_API_BASE_URL',
    import.meta.env.VITE_API_BASE_URL
  ),
  DEFAULT_LOCALE: import.meta.env.VITE_DEFAULT_LOCALE ?? 'th-TH',
} as const;
