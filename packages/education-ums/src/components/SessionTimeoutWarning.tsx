import React, { useEffect, useCallback } from 'react';
import { isTokenExpiringSoon, verifySession, logout } from '../services/authService';

interface SessionTimeoutWarningProps {
  onSessionExpired?: () => void;
}

/**
 * Silently keeps the session alive by auto-refreshing the token
 * when it is within the warning window. Only calls onSessionExpired
 * if the refresh itself fails (e.g. server is down or refresh token
 * has also expired), which is a genuine end-of-session event.
 *
 * No UI is shown — the user is never interrupted.
 */
const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({ onSessionExpired }) => {

  const silentRefresh = useCallback(async () => {
    if (!isTokenExpiringSoon()) return; // Nothing to do yet

    const sessionIsValid = await verifySession();
    if (!sessionIsValid) {
      await logout();
      onSessionExpired?.();
    }
  }, [onSessionExpired]);

  useEffect(() => {
    // Check every 5 minutes; silently refresh if token is expiring soon
    const interval = setInterval(silentRefresh, 5 * 60 * 1000);
    silentRefresh(); // also check immediately on mount
    return () => clearInterval(interval);
  }, [silentRefresh]);

  // No UI rendered — completely invisible to the user
  return null;
};

export default SessionTimeoutWarning;









