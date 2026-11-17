import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  expiresAt: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('bmi_token_expiry') : null));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.auth.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email: string, password: string): Promise<User | null> => {
    const res = await api.auth.login(email, password);
    if (res.requires_mfa || !res.user) {
      return null;
    }
    if (res.expires_at) {
      localStorage.setItem('bmi_token_expiry', res.expires_at);
      setExpiresAt(res.expires_at);
    }
    setUser(res.user);
    return res.user;
  };

  const refreshSession = async () => {
    try {
      const res = await api.auth.refresh();
      if (res.expires_at) {
        localStorage.setItem('bmi_token_expiry', res.expires_at);
        setExpiresAt(res.expires_at);
      }
    } catch {
      // If refresh fails, they might be logged out
      await logout();
    }
  };

  const logout = async () => {
    await api.auth.logout();
    localStorage.removeItem('bmi_token_expiry');
    setExpiresAt(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, expiresAt, login, logout, refresh, refreshSession, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
