import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@clerk/clerk-react', () => ({
  SignIn: vi.fn().mockImplementation(() => <div data-testid="clerk-signin">Sign In</div>),
  SignUp: vi.fn().mockImplementation(() => <div data-testid="clerk-signup">Sign Up</div>),
}));

describe('ClerkAuthPage', () => {
  it('should render branding and auth components', async () => {
    const mod = await import('./ClerkAuthPage');
    const { default: ClerkAuthPage } = mod;

    render(<ClerkAuthPage />);

    const headings = screen.getAllByText('HKM Ministries');
    expect(headings.length).toBeGreaterThan(0);
    const subtexts = screen.getAllByText('Church Management System');
    expect(subtexts.length).toBeGreaterThan(0);
  });

  it('should render sign-in form by default', async () => {
    const mod = await import('./ClerkAuthPage');
    const { default: ClerkAuthPage } = mod;

    render(<ClerkAuthPage />);

    expect(screen.getByTestId('clerk-signin')).toBeInTheDocument();
    const signInButtons = screen.getAllByText('Sign In');
    expect(signInButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('should render register button', async () => {
    const mod = await import('./ClerkAuthPage');
    const { default: ClerkAuthPage } = mod;

    render(<ClerkAuthPage />);

    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('should have secure auth footer', async () => {
    const mod = await import('./ClerkAuthPage');
    const { default: ClerkAuthPage } = mod;

    render(<ClerkAuthPage />);

    expect(screen.getByText('Secure Enterprise Authentication')).toBeInTheDocument();
    expect(screen.getByText(/Empowering your ministry/)).toBeInTheDocument();
  });
});
