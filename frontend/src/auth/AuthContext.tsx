import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_BASE } from '../apiConfig';

/**
 * Authenticated user as exposed to the React tree. Mirrors `AuthSession.user`
 * on the backend.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface AuthState {
  status: 'loading' | 'unauthenticated' | 'authenticated';
  user: AuthUser | null;
  token: string | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signup: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Fetch wrapper that injects Authorization automatically. */
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const STORAGE_KEY = 'criaai.auth.token';

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider responsible for:
 *  - Hydrating the session from localStorage on boot (`/auth/me`).
 *  - Storing the token across reloads.
 *  - Exposing `authFetch` so every API call can include the bearer token
 *    transparently and force-logout on 401.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    token: null,
    error: null,
  });

  const persistToken = useCallback((token: string | null) => {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearSession = useCallback(() => {
    persistToken(null);
    setState({
      status: 'unauthenticated',
      user: null,
      token: null,
      error: null,
    });
  }, [persistToken]);

  // Bootstrap: read token from storage, fetch /me to validate.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setState((s) => ({ ...s, status: 'unauthenticated' }));
      return;
    }
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`auth/me ${res.status}`);
        return (await res.json()) as AuthUser;
      })
      .then((user) => {
        setState({
          status: 'authenticated',
          user,
          token: stored,
          error: null,
        });
      })
      .catch(() => {
        clearSession();
      });
  }, [clearSession]);

  const handleAuthResponse = useCallback(
    (data: { token: string; user: AuthUser }) => {
      persistToken(data.token);
      setState({
        status: 'authenticated',
        user: data.user,
        token: data.token,
        error: null,
      });
    },
    [persistToken],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const body = (await res.json()) as
        | { token: string; user: AuthUser }
        | { message?: string };
      if (!res.ok) {
        const msg =
          (body as { message?: string }).message ?? `Falha (${res.status})`;
        throw new Error(msg);
      }
      handleAuthResponse(body as { token: string; user: AuthUser });
    },
    [handleAuthResponse],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as
        | { token: string; user: AuthUser }
        | { message?: string };
      if (!res.ok) {
        const msg =
          (body as { message?: string }).message ?? `Falha (${res.status})`;
        throw new Error(msg);
      }
      handleAuthResponse(body as { token: string; user: AuthUser });
    },
    [handleAuthResponse],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // Drop-in fetch that handles auth headers + 401 auto-logout.
  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers ?? {});
      if (state.token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${state.token}`);
      }
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        clearSession();
      }
      return res;
    },
    [state.token, clearSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signup, login, logout, authFetch }),
    [state, signup, login, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Standalone helper for code that runs outside of React (e.g. background
 * fetches in legacy modules). Reads the token directly from localStorage.
 */
export function getStoredAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
