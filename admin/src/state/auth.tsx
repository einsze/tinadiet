import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getAdminToken,
  setAdminToken,
  setOnUnauthorized,
} from '../lib/api.js';
import { authApi, type LoginResponse } from '../api/index.js';
import type { AdminUserPublic } from '../types/index.js';

type AuthState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'authenticated'; admin: AdminUserPublic };

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ kind: 'idle' });

  const refreshMe = useCallback(async () => {
    if (getAdminToken() === null) {
      setState({ kind: 'unauthenticated' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await authApi.me();
      setState({ kind: 'authenticated', admin: res.admin });
    } catch {
      setAdminToken(null);
      setState({ kind: 'unauthenticated' });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState({ kind: 'loading' });
    const res: LoginResponse = await authApi.login(email, password);
    setAdminToken(res.token);
    setState({ kind: 'authenticated', admin: res.admin });
  }, []);

  const logout = useCallback(() => {
    setAdminToken(null);
    setState({ kind: 'unauthenticated' });
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setAdminToken(null);
      setState({ kind: 'unauthenticated' });
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, logout, refreshMe }),
    [state, login, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
