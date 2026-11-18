import React from 'react';
import { ClerkProvider } from '../shims/clerk';

export const ClerkAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ClerkProvider>{children}</ClerkProvider>;
};
