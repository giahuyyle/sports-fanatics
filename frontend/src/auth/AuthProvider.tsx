import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import { accountRequest, authMessage } from './client';
import type { Account } from './client';

interface AuthState {
  user: User | null;
  account: Account | null;
  loading: boolean;
  syncing: boolean;
  error: string;
  retry: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const sync = useCallback(async (next: User | null) => {
    const current = ++generation.current;
    setUser(next);
    setAccount(null);
    setError('');
    setLoading(false);
    setSyncing(Boolean(next));
    if (!next) return;
    try {
      const result = await accountRequest('POST');
      if (generation.current === current) setAccount(result);
    } catch (e) {
      if (generation.current === current) setError(authMessage(e));
    } finally {
      if (generation.current === current) setSyncing(false);
    }
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onIdTokenChanged(auth, (next) => void sync(next));
    return () => {
      unsubscribe();
      invalidate();
    };
  }, [sync, invalidate]);
  return (
    <Context.Provider
      value={{
        user,
        account,
        loading,
        syncing,
        error,
        retry: () => sync(auth?.currentUser || null),
      }}
    >
      {children}
    </Context.Provider>
  );
}

// Shared auth hook intentionally lives beside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
