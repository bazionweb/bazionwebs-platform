import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn('Missing Clerk Publishable Key in environment variables.');
}

export const ClerkAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#4CAF50',
          colorTextOnPrimaryBackground: 'white',
        },
        elements: {
          rootBox: 'clerk-root',
          card: 'clerk-card shadow-xl border border-gray-100',
          formButtonPrimary: 'bg-green-600 hover:bg-green-700 transition-all',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
};
