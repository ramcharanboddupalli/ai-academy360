import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { authService, type AuthUser, type LoginPayload } from '../services/auth.service';
import { setAccessToken } from '../services/api';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ token: string; user: AuthUser } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const response = await authService.login(payload);
      const { token, user } = response.data;
      setAccessToken(token);
      setSession({ token, user });
      return user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (session?.token) await authService.logout();
    } catch {
    } finally {
      setAccessToken(null);
      setSession(null);
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    token: session?.token ?? null,
    isAuthenticated: session !== null,
    isLoading,
    login,
    logout,
  }), [session, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}