/**
 * BMI UMS - Skip Navigation Component
 * Provides keyboard-accessible skip links for screen reader users,
 * allowing them to bypass the sidebar and jump directly to main content.
 *
 * WCAG 2.1 Level A: 2.4.1 Bypass Blocks
 */
import 'react';

export default function SkipNavigation() {
  return (
    <nav aria-label="Skip navigation" className="sr-only">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-[200] focus:bg-[#4B0082] focus:text-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
      >
        Skip to main content
      </a>
      <a
        href="#sidebar-navigation"
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-[200] focus:bg-[#4B0082] focus:text-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:mt-10"
      >
        Skip to navigation
      </a>
    </nav>
  );
}









