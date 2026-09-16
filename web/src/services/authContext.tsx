import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getMe, logout as apiLogout, getLoginUrl, type UserDto } from './apiClient';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: UserDto }
  | { status: 'unauthenticated' };

interface AuthContextValue {
  auth: AuthState;
  /** Redirects the browser to Google login via the backend URL. */
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ----------------------------------------------------------------
// Provider
// ----------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  // On mount: check for existing session (handles page reload)
  useEffect(() => {
    getMe()
      .then((user) => {
        if (user) {
          setAuth({ status: 'authenticated', user });
        } else {
          setAuth({ status: 'unauthenticated' });
        }
      })
      .catch(() => setAuth({ status: 'unauthenticated' }));
  }, []);

  // Handle OAuth callback redirects (backend redirects back with ?auth=success)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const authError = params.get('auth_error');

    if (authResult === 'success') {
      // Remove query params from URL, then re-check session
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      getMe().then((user) => {
        if (user) setAuth({ status: 'authenticated', user });
      });
    } else if (authError) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setAuth({ status: 'unauthenticated' });
    }
  }, []);

  const login = async () => {
    try {
      const url = await getLoginUrl();
      window.location.assign(url);
    } catch {
      console.error('[auth] Could not get login URL. Is the backend running?');
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch { /* ignore */ }
    setAuth({ status: 'unauthenticated' });
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
