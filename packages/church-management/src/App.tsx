import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { User } from './components/userData';
import { ToastProvider } from './components/ToastContext';
import { ThemeProvider } from './components/ThemeContext';
import { useAuth } from './components/AuthContext';
import { useUser } from '@clerk/clerk-react';
import { UserSession, createSessionId } from './components/userSessionData';
import { useUserSessions } from './hooks/useUserSessions';
import { useLoginAttempts } from './hooks/useLoginAttempts';
import ClerkAuthPage from './components/ClerkAuthPage';
import OfflineIndicator from './components/OfflineIndicator';

// Portal Pages (no Clerk auth needed — uses its own PIN-based auth)
import { ApolloProvider } from '@apollo/client';
import { portalApolloClient } from './portal/services/portalApollo';
import PortalLogin from './portal/pages/PortalLogin';
import SetPassword from './portal/pages/SetPassword';
import MemberDashboard from './portal/pages/MemberDashboard';
import PortalAuthGuard from './portal/components/PortalAuthGuard';

// ─── Admin CMS (Clerk-guarded) ────────────────────────────────────────────────
const AdminApp: React.FC = () => {
  const { user: authUser, logout: authLogout } = useAuth();
  const { isLoaded, isSignedIn } = useUser();
  // App only needs the mutation functions; the read queries are unnecessary
  // at startup and are skipped to avoid extra network hits on every load.
  const { addSession } = useUserSessions({ skipQuery: true });
  const { logLoginAttempt } = useLoginAttempts({ skipQuery: true });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);

      createUserSession(authUser)
        .then((session) => {
          if (session) console.warn('User session created:', session);
        })
        .catch((error) => console.error('Failed to create user session:', error));

      logLoginAttempt({
        email: authUser.email,
        timestamp: new Date().toISOString(),
        success: true,
        userAgent: navigator.userAgent,
        location: 'Unknown',
      }).catch(() => {});
    } else {
      setCurrentUser(null);
    }
  }, [authUser]);

  const createUserSession = async (user: User): Promise<UserSession | null> => {
    try {
      const sessionData = {
        userId: user.id,
        userEmail: user.email,
        userName: user.username,
        userRole: user.role,
        loginTime: new Date().toISOString(),
        isActive: true,
        lastActivity: new Date().toISOString(),
        ipAddress: 'Unknown',
        userAgent: navigator.userAgent,
        location: 'Unknown',
      };
      await addSession(sessionData);
      return { id: createSessionId(), ...sessionData };
    } catch (error) {
      console.warn('[App] Session creation failed:', error);
      return null;
    }
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
  };

  if (!isLoaded) return null;

  return (
    <>
      {!isSignedIn ? (
        <ClerkAuthPage />
      ) : (
        <>
          <MainLayout currentUser={currentUser} onLogout={handleLogout} />
          <OfflineIndicator />
        </>
      )}
    </>
  );
};

// ─── Root App with Router ─────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            {/* Member Portal — public PIN-based auth, no Clerk */}
            <Route
              path="/portal/login"
              element={
                <ApolloProvider client={portalApolloClient}>
                  <PortalLogin />
                </ApolloProvider>
              }
            />
            <Route
              path="/portal/set-password"
              element={
                <ApolloProvider client={portalApolloClient}>
                  <SetPassword />
                </ApolloProvider>
              }
            />
            <Route
              path="/portal/dashboard"
              element={
                <ApolloProvider client={portalApolloClient}>
                  <PortalAuthGuard>
                    <MemberDashboard />
                  </PortalAuthGuard>
                </ApolloProvider>
              }
            />
            {/* Admin CMS — all other routes handled by the existing AdminApp */}
            <Route path="/*" element={<AdminApp />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
