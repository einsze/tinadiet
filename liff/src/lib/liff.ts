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

export const isShareTargetPickerAvailable = (): boolean => {
  try {
    return (
      typeof liff.isApiAvailable === 'function' &&
      liff.isApiAvailable('shareTargetPicker')
    );
  } catch {
    return false;
  }
};

export const shareGiftToLine = async (
  text: string,
  url: string
): Promise<'shared' | 'unsupported' | 'canceled' | 'error'> => {
  if (!isShareTargetPickerAvailable()) return 'unsupported';
  try {
    const res = await liff.shareTargetPicker(
      [
        {
          type: 'text',
          text: `${text}\n${url}`,
        },
      ],
      { isMultiple: true }
    );
    if (res === null) return 'canceled';
    return 'shared';
  } catch {
    return 'error';
  }
};

export { liff };
