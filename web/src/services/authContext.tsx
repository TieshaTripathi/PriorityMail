import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.ts';
import { getApiBaseUrl } from './apiUrl.ts';
import type { UserDto } from './apiClient.ts';

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
  apiBaseUrl: string;
  login: () => Promise<void>;
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
// Helper: Map Supabase User to UserDto
// ----------------------------------------------------------------

function mapSupabaseUser(sessionUser: User): UserDto {
  return {
    id: sessionUser.id,
    googleUserId: sessionUser.user_metadata?.sub || sessionUser.id,
    email: sessionUser.email || '',
    displayName:
      sessionUser.user_metadata?.full_name ||
      sessionUser.user_metadata?.name ||
      sessionUser.email?.split('@')[0] ||
      'PriorityMail User',
    avatarUrl: sessionUser.user_metadata?.avatar_url,
    createdAt: sessionUser.created_at,
  };
}

// ----------------------------------------------------------------
// Provider
// ----------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    let isMounted = true;

    // H. SAFE diagnostic logging (never logs tokens, secrets, or keys)
    console.log('Supabase auth initialization');
    const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    console.log('[auth] current origin:', origin);

    // D. Check whether OAuth callback parameters or errors are present in the URL
    const searchParams = new URLSearchParams(window.location.search);
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);

    // Check for OAuth error returned from Google/Supabase in query or hash
    const oauthError =
      searchParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error_description') ||
      hashParams.get('error');

    if (oauthError) {
      console.log('[auth] OAuth error message:', oauthError);
      const decoded = decodeURIComponent(oauthError.replace(/\+/g, ' '));
      setErrorMessage(decoded);
      setAuth({ status: 'unauthenticated' });
      // Remove error parameters from URL
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        /* ignore */
      }
      return;
    }

    const hasAuthCallbackInUrl =
      searchParams.has('code') ||
      hash.includes('access_token=') ||
      hash.includes('refresh_token=');

    // Helper to clean URL after OAuth callback without disturbing app hash routing (#inbox, #all, etc.)
    const cleanAuthParamsFromUrl = () => {
      try {
        const currentHash = window.location.hash || '';
        const isAppHash =
          currentHash.startsWith('#inbox') ||
          currentHash.startsWith('#all') ||
          currentHash.startsWith('#rules') ||
          currentHash.startsWith('#people') ||
          currentHash.startsWith('#settings') ||
          currentHash.startsWith('#email');
        const cleanUrl = window.location.pathname + (isAppHash ? currentHash : '');
        window.history.replaceState({}, '', cleanUrl);
      } catch {
        /* ignore */
      }
    };

    // C. Register onAuthStateChange to immediately receive SIGNED_IN events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      console.log('[auth] auth event name:', event);
      console.log('[auth] session exists:', Boolean(session));

      if (session?.user) {
        const user = mapSupabaseUser(session.user);
        setAuth({ status: 'authenticated', user });
        setErrorMessage(null);
        if (hasAuthCallbackInUrl) {
          cleanAuthParamsFromUrl();
        }
      } else if (event === 'SIGNED_OUT') {
        setAuth({ status: 'unauthenticated' });
      } else if (event === 'INITIAL_SESSION' && !session) {
        // If OAuth callback is actively in progress in the URL, wait for code exchange
        if (!hasAuthCallbackInUrl) {
          setAuth({ status: 'unauthenticated' });
        }
      }
    });

    // B. On app startup: Call await supabase.auth.getSession() and wait for it
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;

        console.log('[auth] session exists:', Boolean(session));

        if (error) {
          console.log('[auth] OAuth error message:', error.message);
          // E. Temporary initialization/network error must not force login loop if callback is running
          if (!hasAuthCallbackInUrl) {
            setAuth({ status: 'unauthenticated' });
          }
          return;
        }

        if (session?.user) {
          const user = mapSupabaseUser(session.user);
          setAuth({ status: 'authenticated', user });
          setErrorMessage(null);
          if (hasAuthCallbackInUrl) {
            cleanAuthParamsFromUrl();
          }
        } else if (!hasAuthCallbackInUrl) {
          // Decided unauthenticated only when no session and no pending OAuth callback in URL
          setAuth({ status: 'unauthenticated' });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[auth] getSession error:', err);
        if (!hasAuthCallbackInUrl) {
          setAuth({ status: 'unauthenticated' });
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // A. Google login uses Supabase only
  const login = async () => {
    clearError();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.log('[auth] OAuth error message:', error.message);
      setErrorMessage(error.message);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[auth] signOut error:', err);
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
