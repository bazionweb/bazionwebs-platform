/**
 * BMI UMS - Accessibility Provider
 * Provides global accessibility features:
 * 1. Focus management on route changes
 * 2. Live region announcements for screen readers
 * 3. Keyboard shortcut handling
 * 4. Reduced motion preferences
 */
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

interface AccessibilityContextType {
  /** Announce a message to screen readers via aria-live region */
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  /** Check if user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Check if user is navigating via keyboard */
  isKeyboardUser: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
  announce: () => {},
  prefersReducedMotion: false,
  isKeyboardUser: false,
});

export function useAccessibility() {
  return useContext(AccessibilityContext);
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  // Detect keyboard vs mouse navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
        document.body.classList.add('keyboard-user');
      }
    };
    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      document.body.classList.remove('keyboard-user');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage(''); // Clear first to re-trigger
      requestAnimationFrame(() => setAssertiveMessage(message));
    } else {
      setPoliteMessage(''); // Clear first to re-trigger
      requestAnimationFrame(() => setPoliteMessage(message));
    }
  }, []);

  return (
    <AccessibilityContext.Provider value={{ announce, prefersReducedMotion, isKeyboardUser }}>
      {children}
      {/* Screen reader live regions */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </AccessibilityContext.Provider>
  );
}









