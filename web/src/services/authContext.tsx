import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getMe, logout as apiLogout, getDirectLoginUrl, type UserDto } from './apiClient';
import { supabase, isSupabaseConfigured } from './supabaseClient';
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
  /** Navigates to Google sign in. */
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

  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured) {
      // 1. Check existing Supabase session
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[auth] Supabase session error:', error);
          setAuth({ status: 'unauthenticated' });
          return;
        }

        if (session?.user) {
          const user: UserDto = {
            id: session.user.id,
            googleUserId: session.user.user_metadata?.sub || session.user.id,
            email: session.user.email || '',
            displayName:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0] ||
              'PriorityMail User',
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
          };
          setAuth({ status: 'authenticated', user });
        } else {
          setAuth({ status: 'unauthenticated' });
        }
      });

      // 2. Subscribe to Supabase auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!isMounted) return;
          if (session?.user) {
            const user: UserDto = {
              id: session.user.id,
              googleUserId: session.user.user_metadata?.sub || session.user.id,
              email: session.user.email || '',
              displayName:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'PriorityMail User',
              avatarUrl: session.user.user_metadata?.avatar_url,
              createdAt: session.user.created_at,
            };
            setAuth({ status: 'authenticated', user });
          } else {
            setAuth({ status: 'unauthenticated' });
          }
        }
      );

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    // Fallback: legacy session check
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
        console.warn('[auth] Session check failed:', err);
        setServerReachable(false);
        setAuth({ status: 'unauthenticated' });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle URL errors or success query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const authError = params.get('auth_error');

    if (authResult === 'success') {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      setErrorMessage(null);
      getMe().then((user) => {
        if (user) setAuth({ status: 'authenticated', user });
      });
    } else if (authError) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      let humanMsg = 'Authentication could not be completed.';
      if (authError === 'oauth_not_configured') {
        humanMsg = 'PriorityMail authentication is not configured.';
      } else if (authError === 'access_denied') {
        humanMsg = 'Google sign-in was cancelled or access was denied.';
      } else if (authError === 'server_error') {
        humanMsg = 'Could not connect to PriorityMail authentication server.';
      } else if (authError === 'session_expired') {
        humanMsg = 'Your session expired. Please sign in again.';
      }
      setErrorMessage(humanMsg);
      setAuth({ status: 'unauthenticated' });
    }
  }, []);

  const login = async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        setErrorMessage(error.message);
      }
      return;
    }

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
