import { useEffect, useRef } from 'react';

/**
 * Refetch core entities on an interval while logged in (lightweight polling "realtime").
 */
export function useCoreDataPolling(
  enabled: boolean,
  intervalMs: number,
  tick: () => void | Promise<void>
): void {
  const cb = useRef(tick);
  cb.current = tick;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      try {
        await cb.current();
      } catch {
        /* ignore */
      }
    };
    run();
    const id = window.setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);
}









