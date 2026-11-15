import { render, screen } from '@testing-library/react';
import ProtectedRoute from './ProtectedRoute';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import * as useAuthModule from '../hooks/useAuth';
import React from 'react';

// Mock the useAuth hook
vi.mock('../hooks/useAuth');

const renderWithRouter = (ui: React.ReactElement, initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/status" element={<div>Status Page</div>} />
        <Route path="/*" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  it('shows loading spinner when auth is loading', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      refreshSession: vi.fn(),
      setUser: vi.fn(),
      expiresAt: null,
    });

    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });

  it('redirects to /login if unauthenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      refreshSession: vi.fn(),
      setUser: vi.fn(),
      expiresAt: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows unauthorized if user lacks required role', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'test@test.com', first_name: 'Test', last_name: 'User', role: 'applicant', is_verified: 1 },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      refreshSession: vi.fn(),
      setUser: vi.fn(),
      expiresAt: null,
    });

    renderWithRouter(
      <ProtectedRoute roles={['admin']}>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Status Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders child components if user has required role', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'test@test.com', first_name: 'Test', last_name: 'User', role: 'applicant', is_verified: 1 },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      refreshSession: vi.fn(),
      setUser: vi.fn(),
      expiresAt: null,
    });

    renderWithRouter(
      <ProtectedRoute roles={['applicant']}>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
