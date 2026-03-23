import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mustChangePassword?: boolean;
}

export interface AuthConfig {
  authRequired: boolean;
  requireAcknowledgment: boolean;
  acknowledgmentSeverities: string[];
}

interface AuthContextValue {
  user: User | null;
  authConfig: AuthConfig | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuthConfig = useCallback(async () => {
    const fallback = { authRequired: false, requireAcknowledgment: true, acknowledgmentSeverities: ['critical', 'high'] as string[] };
    try {
      const res = await fetch('/api/auth/config', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAuthConfig(data);
        return data;
      }
    } catch {
      /* Server not available (e.g. Electron standalone) - treat as no auth */
    }
    setAuthConfig(fallback);
    return fallback;
  }, []);

  const refreshAuth = useCallback(async () => {
    const config = await fetchAuthConfig();
    if (config && !config.authRequired) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    if (config && config.authRequired) {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setIsLoading(false);
          return;
        }
      } catch {
        /* ignore */
      }
      setUser(null);
    }
    setIsLoading(false);
  }, [fetchAuthConfig]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Login failed' };
      setUser(data.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to change password' };
      setUser((prev) => prev ? { ...prev, mustChangePassword: false } : null);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const value: AuthContextValue = {
    user,
    authConfig,
    isLoading,
    login,
    logout,
    changePassword,
    refreshAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
