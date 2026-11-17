import { useEffect } from 'react';
import { useQueryClient } from '../shims/tanstack-react-query';

/**
 * useLiveSync
 * Periodically invalidates specific query keys to ensure the dashboard feels "live"
 * without exhausting Cloudflare Worker free tier limits.
 * Pauses when the tab is hidden (visibilitychange) to avoid burning quota.
 */
export function useLiveSync(intervalMs = 60000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['grades'] });
          queryClient.invalidateQueries({ queryKey: ['enrollments'] });
        }
      }, intervalMs);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    // Only start if the tab is already visible
    if (document.visibilityState === 'visible') {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [queryClient, intervalMs]);
}
