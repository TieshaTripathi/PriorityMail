import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getMe, logout as apiLogout, getDirectLoginUrl, type UserDto } from './apiClient';
import { getApiBaseUrl } from './apiUrl';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: UserDto }
  | { status: 'unauthenticated' };

interface AuthContextValue {
  auth: AuthState;
  errorMessage: string | null;
  serverReachable: boolean;
  apiBaseUrl: string;
  /** Navigates the browser directly to Google OAuth endpoint. */
  login: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverReachable, setServerReachable] = useState<boolean>(true);
  const apiBaseUrl = getApiBaseUrl();

  // On mount: check for existing session (handles page reload)
  useEffect(() => {
    let isMounted = true;
    getMe()
      .then((user) => {
        if (!isMounted) return;
        setServerReachable(true);
        if (user) {
          setAuth({ status: 'authenticated', user });
        } else {
          setAuth({ status: 'unauthenticated' });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // If it was a network failure connecting to the server
        console.warn('[auth] Session check failed:', err);
        setServerReachable(false);
        setAuth({ status: 'unauthenticated' });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle OAuth callback query params (?auth=success or ?auth_error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const authError = params.get('auth_error');

    if (authResult === 'success') {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setErrorMessage(null);
      getMe().then((user) => {
        if (user) {
          setAuth({ status: 'authenticated', user });
        } else {
          setAuth({ status: 'unauthenticated' });
        }
      }).catch(() => setAuth({ status: 'unauthenticated' }));
    } else if (authError) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      let humanMsg = 'Authentication could not be completed.';
      if (authError === 'oauth_not_configured') {
        humanMsg = 'PriorityMail authentication server is not configured.';
      } else if (authError === 'access_denied') {
        humanMsg = 'Google sign-in was cancelled or access was denied.';
      } else if (authError === 'server_error') {
        humanMsg = 'Could not connect to PriorityMail server.';
      } else if (authError === 'session_expired') {
        humanMsg = 'Your session expired. Please sign in again.';
      }
      setErrorMessage(humanMsg);
      setAuth({ status: 'unauthenticated' });
    }
  }, []);

  const login = () => {
    // Navigate directly using a full browser redirect
    const targetUrl = getDirectLoginUrl();
    window.location.assign(targetUrl);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore network errors on logout */
    }
    setAuth({ status: 'unauthenticated' });
  };

  const clearError = () => {
    setErrorMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        auth,
        errorMessage,
        serverReachable,
        apiBaseUrl,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
