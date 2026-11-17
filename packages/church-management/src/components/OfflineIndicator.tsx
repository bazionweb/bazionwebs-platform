import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '../hooks/useOfflineSync';

const OfflineIndicator: React.FC = () => {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 ${isOnline ? 'bg-blue-500' : 'bg-red-500'} text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2`}
    >
      {isOnline ? (
        <>
          {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          <span className="text-sm font-medium">{isSyncing ? 'Syncing...' : `${pendingCount} pending sync`}</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Offline Mode</span>
          {pendingCount > 0 && (
            <span className="bg-white text-red-500 px-2 py-0.5 rounded-full text-xs font-bold">{pendingCount}</span>
          )}
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
