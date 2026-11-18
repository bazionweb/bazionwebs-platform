import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth, useSignIn } from '../shims/clerk';
import type { User, UserRole } from './userData';

interface ClerkUserLike {
  id: string;
  fullName?: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
  imageUrl?: string;
  organizationRole?: string;
}

interface AuthContextType {
  user: User | null;
  clerkUser: ClerkUserLike | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, avatar?: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LoadingScreen: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-900 text-white">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-green-500" />
    <p className="text-lg font-medium">Checking your secure session…</p>
  </div>
);

function userFromIdentity(identity: ClerkUserLike | null): User | null {
  if (!identity) return null;
  const email = identity.primaryEmailAddress?.emailAddress ?? '';
  const rawRole = (identity.organizationRole ?? '').toLowerCase();
  const role: UserRole = rawRole.includes('owner') ? 'Super Admin' : rawRole.includes('admin') ? 'Admin' : 'Guest';
  return {
    id: identity.id,
    username: email.split('@')[0] || 'HKM Administrator',
    email,
    role,
    permissionLevel: role === 'Guest' ? 'Viewer' : 'Editor',
    passwordHash: 'MANAGED_BY_BETTER_AUTH',
    lastLogin: new Date().toISOString(),
    avatar: identity.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(identity.fullName || email)}`,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, user: authIdentity } = useUser();
  const { signOut } = useClerkAuth();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(userFromIdentity(authIdentity));
  }, [authIdentity]);

  const login = async (email: string, password: string) => {
    if (!signInLoaded) return { success: false, error: 'Authentication service is still loading.' };
    try {
      await signIn.create({ identifier: email, password });
      return { success: true };
    } catch (cause) {
      return { success: false, error: cause instanceof Error ? cause.message : 'Unable to sign in.' };
    }
  };

  const register = async (_email: string, _password: string, _avatar?: string) => ({
    success: false,
    error: 'Self-registration is disabled. Ask an HKM tenant administrator for an invitation.',
  });

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const refreshUser = async () => {
    const response = await fetch('/api/church/hkm/admin/session/activate', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) {
      setUser(null);
      return;
    }
    const result = await response.json();
    setUser(userFromIdentity(result.identity ?? null));
  };

  const value: AuthContextType = {
    user,
    clerkUser: authIdentity ?? null,
    loading: !isLoaded,
    isAuthenticated: Boolean(isSignedIn && user && user.role !== 'Guest'),
    login,
    register,
    logout,
    refreshUser,
  };

  if (!isLoaded) return <LoadingScreen />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
