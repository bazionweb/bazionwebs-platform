import { useState, useEffect, useCallback } from 'react';
import { offlineSyncService } from '../services/offlineSync';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = useCallback(async () => {
    const pending = await offlineSyncService.getPendingOperations();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  const syncPendingOperations = useCallback(
    async (syncCallback: (operations: unknown[]) => Promise<void>) => {
      if (!isOnline) return;

      setIsSyncing(true);
      try {
        const pending = await offlineSyncService.getPendingOperations();
        if (pending.length > 0) {
          await syncCallback(pending);
          for (const op of pending) {
            await offlineSyncService.clearSyncedOperation(op.id);
          }
          await updatePendingCount();
        }
      } catch (error) {
        console.error('Sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    },
    [isOnline, updatePendingCount],
  );

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncPendingOperations,
    updatePendingCount,
  };
};
