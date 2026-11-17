import { useEffect } from 'react';
import { useLocation } from '../shims/react-router-dom';

/**
 * ScrollToTop — resets the main content area scroll position on every route change.
 *
 * Without this, the parent <main> element retains its scroll offset when navigating
 * between pages, causing newly-rendered pages to appear "stuck" below the viewport.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Reset the main scrollable container (defined in App.tsx)
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
    // Also reset window scroll as a fallback
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
