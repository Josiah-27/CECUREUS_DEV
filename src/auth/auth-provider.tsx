import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { setUnauthorizedHandler } from '@/api';
import type { AuthSession, User } from '@/api/schemas';
import { useApi } from '@/providers/api-provider';

import { sessionStore } from './session-store';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Set when the user was signed out because the server rejected the session. */
  sessionExpired: boolean;
  /** Verifies the SMS code sent to the user's mobile and signs them in. */
  verifyOtp: (requestId: string, code: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const mounted = useRef(true);

  const clearLocal = useCallback(async (expired: boolean) => {
    await sessionStore.clear();
    if (!mounted.current) return;
    setUser(null);
    setSessionExpired(expired);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    mounted.current = true;
    sessionStore.load().then((session) => {
      if (!mounted.current) return;
      setUser(session?.user ?? null);
      setStatus(session ? 'signedIn' : 'signedOut');
    });
    setUnauthorizedHandler(() => {
      void clearLocal(true);
    });
    return () => {
      mounted.current = false;
      setUnauthorizedHandler(null);
    };
  }, [clearLocal]);

  const startSession = useCallback(async (session: AuthSession) => {
    await sessionStore.save(session);
    setUser(session.user);
    setSessionExpired(false);
    setStatus('signedIn');
  }, []);

  const verifyOtp = useCallback(
    async (requestId: string, code: string) => startSession(await api.auth.verifyOtp(requestId, code)),
    [api, startSession],
  );

  const updateUser = useCallback(async (next: User) => {
    const session = await sessionStore.load();
    if (session) await sessionStore.save({ ...session, user: next });
    setUser(next);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Server-side revocation is best effort; local credentials are always removed.
    }
    await clearLocal(false);
  }, [api, clearLocal]);

  const value = useMemo(
    () => ({ status, user, sessionExpired, verifyOtp, updateUser, signOut }),
    [status, user, sessionExpired, verifyOtp, updateUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
