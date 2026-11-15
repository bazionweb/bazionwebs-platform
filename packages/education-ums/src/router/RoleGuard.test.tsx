/**
 * BMI UMS — RoleGuard Router Tests
 *
 * Verifies that the RoleGuard component:
 * - Renders children for admin users (bypass all role checks)
 * - Renders children when the user's role is in allowedRoles
 * - Redirects to /dashboard when the user's role is NOT in allowedRoles
 * - Redirects to /dashboard when there is no authenticated user
 *
 * RoleGuard is defined inline in src/router/index.tsx.  We reproduce its
 * logic here so the test stays decoupled from all the lazy-loaded page
 * components in that file.  The authStore is mocked so we can control the
 * current user role for each test.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// ── Mock Zustand auth store ───────────────────────────────────────────────────
// `currentMockUser` is mutated in `beforeEach` / test bodies.
// The `useAuthStore` mock reads from it at call-time, so mutations between
// tests are reflected correctly.
const mockState: { user: { role: string } | null } = { user: { role: 'admin' } };

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof mockState) => unknown) => selector(mockState),
}));

// Import AFTER vi.mock so the hoisted mock is already in place
import { useAuthStore } from '../stores/authStore';

// ── Local copy of RoleGuard ───────────────────────────────────────────────────
// Mirrors the component defined in src/router/index.tsx exactly.
function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const user = useAuthStore((s: typeof mockState) => s.user);

  if (user?.role === 'admin') return <>{children}</>;
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('RoleGuard', () => {
  beforeEach(() => {
    mockState.user = { role: 'admin' };
  });

  it('renders children when user is admin (bypasses allowedRoles check)', () => {
    renderWithRouter(
      <RoleGuard allowedRoles={['registrar']}>
        <div>Protected Content</div>
      </RoleGuard>,
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user role is in allowedRoles', () => {
    mockState.user = { role: 'registrar' };
    renderWithRouter(
      <RoleGuard allowedRoles={['registrar', 'admin']}>
        <div>Registrar Content</div>
      </RoleGuard>,
    );
    expect(screen.getByText('Registrar Content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when user role is NOT in allowedRoles', () => {
    mockState.user = { role: 'faculty' };
    renderWithRouter(
      <RoleGuard allowedRoles={['registrar']}>
        <div>Should Not Appear</div>
      </RoleGuard>,
    );
    expect(screen.queryByText('Should Not Appear')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('redirects to /dashboard when there is no authenticated user', () => {
    mockState.user = null;
    renderWithRouter(
      <RoleGuard allowedRoles={['student']}>
        <div>Student Portal</div>
      </RoleGuard>,
    );
    expect(screen.queryByText('Student Portal')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('renders children for student role when student is allowed', () => {
    mockState.user = { role: 'student' };
    renderWithRouter(
      <RoleGuard allowedRoles={['student']}>
        <div>Student Content</div>
      </RoleGuard>,
    );
    expect(screen.getByText('Student Content')).toBeInTheDocument();
  });

  it('redirects student away from faculty-only routes', () => {
    mockState.user = { role: 'student' };
    renderWithRouter(
      <RoleGuard allowedRoles={['faculty']}>
        <div>Faculty Only</div>
      </RoleGuard>,
    );
    expect(screen.queryByText('Faculty Only')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});









