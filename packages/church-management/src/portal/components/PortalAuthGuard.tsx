import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { portalAuthService } from '../services/portalAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

const PortalAuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(portalAuthService.isAuthenticated());

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAuthenticated(portalAuthService.isAuthenticated());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  // If member needs to set a password, redirect to set-password page
  if (portalAuthService.needsPasswordSetup()) {
    return <Navigate to="/portal/set-password" replace />;
  }

  return <>{children}</>;
};

export default PortalAuthGuard;
