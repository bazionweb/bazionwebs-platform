import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth, useSignIn, useSignUp } from '@clerk/clerk-react';
import { User, UserRole } from './userData';
import { client } from './AuthorizedApolloProvider';
import { UPSERT_USER_MUTATION, GET_USER_QUERY } from '../services/graphql/users';

interface ClerkUserLike {
  id: string;
  primaryEmailAddress?: { emailAddress?: string } | null;
  imageUrl?: string;
}

interface AuthContextType {
  user: User | null;
  clerkUser: ClerkUserLike | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    avatar?: string,
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LoadingScreen: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '20px',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      color: 'white',
    }}
  >
    <div
      style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(255,255,255,0.1)',
        borderTop: '4px solid #4CAF50',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <p
      style={{
        color: '#fff',
        fontSize: '18px',
        fontWeight: 500,
      }}
    >
      Initializing secure session...
    </p>
    <style>{`
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `}</style>
  </div>
);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerkAuth();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAndSyncProfile = async (cUser: ClerkUserLike) => {
    if (!cUser) return null;

    const email = cUser.primaryEmailAddress?.emailAddress;
    const uid = cUser.id;

    try {
      const { data } = await client.query({
        query: GET_USER_QUERY,
        variables: { id: uid },
        fetchPolicy: 'network-only',
      });

      // Supabase pg_graphql returns data in edges[].node format
      if (data?.usersCollection?.edges?.length > 0) {
        const hUser = data.usersCollection.edges[0].node;
        return {
          id: hUser.id,
          username: hUser.username,
          email: hUser.email,
          role: hUser.role as UserRole,
          avatar: hUser.avatar,
          lastLogin: hUser.last_login,
          permissionLevel: hUser.role === 'Admin' || hUser.role === 'Super Admin' ? 'Editor' : 'Viewer',
          passwordHash: 'MANAGED_BY_CLERK',
        } as User;
      }

      const newProfile: User = {
        id: uid,
        username: email?.split('@')[0] || 'User',
        email: email || '',
        role: 'Guest' as UserRole,
        permissionLevel: 'Viewer',
        passwordHash: 'MANAGED_BY_CLERK',
        lastLogin: new Date().toISOString(),
        avatar: cUser.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(email || 'User')}`,
      };

      await client.mutate({
        mutation: UPSERT_USER_MUTATION,
        variables: {
          object: {
            id: newProfile.id,
            username: newProfile.username,
            email: newProfile.email,
            role: newProfile.role,
            avatar: newProfile.avatar,
            last_login: newProfile.lastLogin,
          },
        },
      });

      return newProfile;
    } catch (err) {
      console.error('[AuthContext] Profile sync error:', err);
      return {
        id: uid,
        username: email?.split('@')[0] || 'User',
        email: email || '',
        role: 'Guest' as UserRole,
        permissionLevel: 'Viewer',
        passwordHash: 'MANAGED_BY_CLERK',
        lastLogin: new Date().toISOString(),
        avatar: cUser.imageUrl || '',
      } as User;
    }
  };

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && clerkUser) {
        fetchAndSyncProfile(clerkUser)
          .then((profile) => {
            setUserProfile(profile);
            setLoading(false);
          })
          .catch(() => {
            setUserProfile(null);
            setLoading(false);
          });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    }
  }, [isLoaded, isSignedIn, clerkUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!signInLoaded) return { success: false, error: 'Auth not ready' };

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        return { success: true };
      } else {
        return { success: false, error: 'Additional steps required (2FA, etc.)' };
      }
    } catch (error: unknown) {
      const clerkError = error as { errors?: Array<{ message?: string }> };
      return { success: false, error: clerkError.errors?.[0]?.message || 'Login failed' };
    }
  };

  const register = async (
    email: string,
    password: string,
    _avatar?: string,
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    if (!signUpLoaded) return { success: false, error: 'Auth not ready' };

    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      if (result.status === 'complete') {
        return { success: true };
      } else {
        return { success: false, error: 'Registration incomplete (verification needed)' };
      }
    } catch (error: unknown) {
      const clerkError = error as { errors?: Array<{ message?: string }> };
      return { success: false, error: clerkError.errors?.[0]?.message || 'Registration failed' };
    }
  };

  const logout = async (): Promise<void> => {
    await signOut();
    setUserProfile(null);
  };

  const refreshUser = async (): Promise<void> => {
    if (clerkUser) {
      const profile = await fetchAndSyncProfile(clerkUser);
      setUserProfile(profile);
    }
  };

  const value: AuthContextType = {
    user: userProfile,
    clerkUser: clerkUser ?? null,
    loading: loading || !isLoaded,
    isAuthenticated: isSignedIn ?? false,
    login,
    register,
    logout,
    refreshUser,
  };

  if (loading || !isLoaded) {
    return <LoadingScreen />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
