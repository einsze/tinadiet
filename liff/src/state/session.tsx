import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { initLiff, getIDToken, isLoggedIn, login } from '../lib/liff.js';
import { setSessionToken } from '../lib/api.js';
import { authApi, type ExchangeResponse } from '../api/auth.js';

type Status =
  | { kind: 'idle' }
  | { kind: 'initializing' }
  | { kind: 'authenticating' }
  | { kind: 'authenticated'; user: ExchangeResponse['user'] }
  | { kind: 'error'; message: string };

type SessionContextValue = {
  status: Status;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus({ kind: 'initializing' });
      try {
        await initLiff();

        if (!isLoggedIn()) {
          login(window.location.href);
          return;
        }

        const idToken = getIDToken();
        if (idToken === null) {
          throw new Error('LIFF returned null ID token');
        }

        setStatus({ kind: 'authenticating' });
        const exchanged = await authApi.exchange(idToken);
        setSessionToken(exchanged.session);

        if (!cancelled) {
          setStatus({ kind: 'authenticated', user: exchanged.user });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ kind: 'error', message });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ status }}>
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
