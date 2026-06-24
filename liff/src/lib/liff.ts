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

const isWebShareAvailable = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Open the OS-level share sheet so the user can pick any installed app
 * (LINE, WhatsApp, Messenger, Gmail, Notes…). Falls back to LINE-only
 * shareTargetPicker if the platform doesn't expose navigator.share, then
 * to copy as last resort.
 *
 * Returns:
 *   'shared'      — share dialog opened and user picked a target
 *   'canceled'    — share dialog opened but user dismissed
 *   'copied'      — neither share path worked, link copied to clipboard
 *   'unsupported' — no share path AND clipboard write failed (rare)
 */
export type ShareResult =
  | 'shared'
  | 'canceled'
  | 'copied'
  | 'unsupported'
  | 'error';

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  // Legacy fallback for older webviews: temporary textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export const shareGift = async (
  title: string,
  text: string,
  url: string
): Promise<ShareResult> => {
  // Primary: Web Share API — opens OS-level share sheet on mobile.
  if (isWebShareAvailable()) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      // User-canceled share is not a real error; the share sheet did open.
      if (err instanceof Error && err.name === 'AbortError') return 'canceled';
      // Some webviews throw a generic error for any cancel/dismiss too.
      // Fall through to LINE share or copy as a safety net.
    }
  }

  // Secondary: LINE-only share picker — only when inside LINE client AND
  // the LIFF channel has shareTargetPicker scope enabled.
  if (isShareTargetPickerAvailable()) {
    try {
      const res = await liff.shareTargetPicker(
        [{ type: 'text', text: `${text}\n${url}` }],
        { isMultiple: true }
      );
      if (res === null) return 'canceled';
      return 'shared';
    } catch {
      /* fall through to copy */
    }
  }

  // Last resort: copy to clipboard so user can paste anywhere.
  const copied = await copyToClipboard(url);
  return copied ? 'copied' : 'unsupported';
};

export { liff };
