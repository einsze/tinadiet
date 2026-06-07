import liff from '@line/liff';
import { env } from './env.js';

let initPromise: Promise<void> | null = null;

export const initLiff = (): Promise<void> => {
  if (initPromise === null) {
    initPromise = liff.init({ liffId: env.LIFF_ID });
  }
  return initPromise;
};

export const getIDToken = (): string | null => liff.getIDToken();

export const isInClient = (): boolean => liff.isInClient();

export const isLoggedIn = (): boolean => liff.isLoggedIn();

export const login = (redirectUri?: string): void => {
  liff.login(redirectUri ? { redirectUri } : undefined);
};

export const closeWindow = (): void => liff.closeWindow();

export const getProfile = () => liff.getProfile();

export { liff };
