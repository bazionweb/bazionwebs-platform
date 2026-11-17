/**
 * Dashboard — smoke tests
 */
import 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ── Store mocks ───────────────────────────────────────────────────────────────
vi.mock('../stores/authStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: vi.fn((selector: any) =>
    selector({ user: { name: 'Test User', role: 'admin' } }),
  ),
}));

vi.mock('../services/authService', () => ({
  authFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] }),
  }),
}));

vi.mock('../stores/dataStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useDataStore: vi.fn((selector: any) =>
    selector({
      addStudent: vi.fn(),
      addTransaction: vi.fn(),
    }),
  ),
}));

vi.mock('../hooks/useEntityQueries', () => ({
  useStudentsQuery: vi.fn(() => ({ data: { data: { items: [], page: 1, perPage: 50, total: 0 } }, isLoading: false })),
  useTransactionsQuery: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
}));

import Dashboard from './Dashboard';
import { checkA11y } from '../test/axe';

describe('Dashboard', () => {
  it('renders the Executive Dashboard heading', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/executive dashboard|executive overview/i)).toBeInTheDocument();
  });

  it('renders the four stat cards', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/total students/i)).toBeInTheDocument();
    expect(screen.getByText(/ytd revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/new admissions/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming deadlines/i)).toBeInTheDocument();
  });

  it('shows the logged-in user name', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/test user/i)).toBeInTheDocument();
  });

  it('has no critical or serious accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await checkA11y(container);
  });
});









