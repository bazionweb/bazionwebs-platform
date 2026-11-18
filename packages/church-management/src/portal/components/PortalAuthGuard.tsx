import React, { useEffect, useState } from 'react';
import { Navigate } from '../../shims/react-router-dom';
import { portalAuthService } from '../services/portalAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

const PortalAuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [sessionState, setSessionState] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    portalAuthService.isAuthenticated() ? 'checking' : 'unauthenticated',
  );

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const session = await portalAuthService.verifySession();
      if (active) setSessionState(session ? 'authenticated' : 'unauthenticated');
    };
    void verify();
    const interval = setInterval(() => void verify(), 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (sessionState === 'checking') return <div className="portal-auth-checking">Checking your member session…</div>;
  if (sessionState === 'unauthenticated') {
    return <Navigate to="/portal/login" replace />;
  }

  // If member needs to set a password, redirect to set-password page
  if (portalAuthService.needsPasswordSetup()) {
    return <Navigate to="/portal/set-password" replace />;
  }

  return <>{children}</>;
};

export default PortalAuthGuard;
