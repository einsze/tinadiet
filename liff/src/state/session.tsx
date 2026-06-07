import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  initLiff,
  getIDToken,
  isInClient,
  isLoggedIn,
  login,
  liff,
} from '../lib/liff.js';
import { setSessionToken } from '../lib/api.js';
import { authApi, type ExchangeResponse } from '../api/auth.js';

export type LiffDebug = {
  inClient: boolean;
  loggedIn: boolean;
  os: string;
  language: string;
  version: string;
  liffId: string;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'initializing' }
  | { kind: 'needs_login'; debug: LiffDebug }
  | { kind: 'authenticating' }
  | { kind: 'authenticated'; user: ExchangeResponse['user']; debug: LiffDebug }
  | { kind: 'error'; message: string; debug?: LiffDebug };

type SessionContextValue = {
  status: Status;
  triggerLogin: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const collectDebug = (): LiffDebug => ({
  inClient: isInClient(),
  loggedIn: isLoggedIn(),
  os: liff.getOS() ?? 'unknown',
  language: liff.getLanguage() ?? 'unknown',
  version: liff.getVersion() ?? 'unknown',
  liffId: import.meta.env.VITE_LIFF_ID,
});

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const exchangeAndSet = useCallback(async (debug: LiffDebug) => {
    const idToken = getIDToken();
    if (idToken === null) {
      throw new Error(
        `LIFF returned null ID token. inClient=${debug.inClient} loggedIn=${debug.loggedIn}`
      );
    }
    setStatus({ kind: 'authenticating' });
    const exchanged = await authApi.exchange(idToken);
    setSessionToken(exchanged.session);
    setStatus({ kind: 'authenticated', user: exchanged.user, debug });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus({ kind: 'initializing' });
      try {
        await initLiff();
        if (cancelled) return;

        const debug = collectDebug();

        if (!debug.loggedIn) {
          setStatus({ kind: 'needs_login', debug });
          return;
        }

        await exchangeAndSet(debug);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        let debug: LiffDebug | undefined;
        try {
          debug = collectDebug();
        } catch (_) {
          /* swallow */
        }
        setStatus({ kind: 'error', message, debug });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [exchangeAndSet]);

  const triggerLogin = useCallback(() => {
    login(window.location.href);
  }, []);

  return (
    <SessionContext.Provider value={{ status, triggerLogin }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
};
