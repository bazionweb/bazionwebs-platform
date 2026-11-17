import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Clerk (App.tsx imports useUser directly)
vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn().mockReturnValue({ isLoaded: true, isSignedIn: false, user: null }),
  useAuth: vi.fn().mockReturnValue({ getToken: vi.fn(), signOut: vi.fn() }),
  useSignIn: vi.fn().mockReturnValue({ isLoaded: true, signIn: { create: vi.fn() } }),
  useSignUp: vi.fn().mockReturnValue({ isLoaded: true, signUp: { create: vi.fn() } }),
}));

// Mock child components
vi.mock('./components/MainLayout', () => ({
  default: ({ currentUser }: { currentUser?: { email: string } }) => (
    <div data-testid="main-layout">{currentUser ? `Logged in as ${currentUser.email}` : 'Not logged in'}</div>
  ),
}));

vi.mock('./components/ClerkAuthPage', () => ({
  default: () => <div data-testid="clerk-auth-page">Sign in page</div>,
}));

vi.mock('./components/OfflineIndicator', () => ({
  default: () => <div data-testid="offline-indicator" />,
}));

vi.mock('./components/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('./components/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: null,
    logout: vi.fn(),
  }),
  default: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
}));

vi.mock('./components/userData', () => ({
  User: class User {},
}));

vi.mock('./components/userSessionData', () => ({
  UserSession: class UserSession {},
  createSessionId: () => 'session-123',
}));

vi.mock('./hooks/useUserSessions', () => ({
  useUserSessions: () => ({ addSession: vi.fn() }),
}));

vi.mock('./hooks/useLoginAttempts', () => ({
  useLoginAttempts: () => ({
    attempts: [],
    loading: false,
    error: null,
    daysBack: 30,
    loadMoreAttempts: vi.fn(),
    logLoginAttempt: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('./components/AuthorizedApolloProvider', () => ({
  client: {
    query: vi.fn().mockResolvedValue({ data: { users: [] } }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render ClerkAuthPage when not signed in', async () => {
    const { default: App } = await import('./App');
    render(<App />);
    expect(screen.getByTestId('clerk-auth-page')).toBeInTheDocument();
  });

  it('should render MainLayout when signed in', async () => {
    const authModule = await import('./components/AuthContext');
    (authModule.useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: '1', email: 'admin@church.com', username: 'admin', role: 'Super Admin' },
      logout: vi.fn(),
    });

    const clerkModule = await import('@clerk/clerk-react');
    (clerkModule.useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: '1', primaryEmailAddress: { emailAddress: 'admin@church.com' } },
    });

    const { default: App } = await import('./App');
    render(<App />);
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByText(/admin@church.com/)).toBeInTheDocument();
  });

  it('should render offline indicator', async () => {
    const { default: App } = await import('./App');
    render(<App />);
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
  });

  it('should handle logout', async () => {
    const mockLogout = vi.fn();
    const authModule = await import('./components/AuthContext');
    const clerkModule = await import('@clerk/clerk-react');

    (authModule.useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: '1', email: 'admin@church.com', username: 'admin', role: 'Super Admin' },
      logout: mockLogout,
    });
    (clerkModule.useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: '1', primaryEmailAddress: { emailAddress: 'admin@church.com' } },
    });

    const { default: App } = await import('./App');

    const { rerender } = render(<App />);

    // Simulate logout by changing mock return
    (authModule.useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      logout: mockLogout,
    });
    (clerkModule.useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    rerender(<App />);
    expect(screen.getByTestId('clerk-auth-page')).toBeInTheDocument();
  });
});
