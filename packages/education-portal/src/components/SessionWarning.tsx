import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const WARNING_BEFORE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export function SessionWarning() {
  const { expiresAt, refreshSession, logout, user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemainingStr, setTimeRemainingStr] = useState('');

  useEffect(() => {
    if (!user || !expiresAt) {
      setShowWarning(false);
      return;
    }

    const checkExpiry = () => {
      const expiryTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const remaining = expiryTime - now;

      if (remaining <= 0) {
        // Session expired completely
        logout();
        setShowWarning(false);
      } else if (remaining <= WARNING_BEFORE_EXPIRY_MS) {
        setShowWarning(true);
        // Format mm:ss
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeRemainingStr(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setShowWarning(false);
      }
    };

    // Check immediately and then every second
    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, user, logout]);

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm w-full bg-white border border-gray-200 rounded-lg shadow-xl p-5 z-50 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Session Expiring Soon</h3>
          <p className="text-sm text-gray-500 mt-1">
            Your session will expire in <span className="font-bold text-amber-600">{timeRemainingStr}</span> due to inactivity. Do you want to stay logged in?
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button 
          onClick={() => logout()}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Logout
        </button>
        <button 
          onClick={async () => {
            await refreshSession();
            setShowWarning(false);
          }}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );
}
