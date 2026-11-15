import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClaimAccount from './ClaimAccount';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';


import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    auth: {
      claim: vi.fn(),
    },
  },
}));

describe('ClaimAccount Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  const renderWithRouter = () => {
    return render(
      <MemoryRouter initialEntries={['/claim']}>
        <Routes>
          <Route path="/claim" element={<ClaimAccount />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders the claim form with heading and submit button', () => {
    renderWithRouter();
    expect(screen.getByText('Activate Student Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate Account/i })).toBeInTheDocument();
  });

  it('renders admission code and password input fields', () => {
    renderWithRouter();
    const inputs = screen.getAllByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    expect(passwordInput).toBeInTheDocument();
  });

  it('shows "Activating Account..." while submitting', async () => {
    vi.mocked(api.auth.claim).mockImplementation(() => new Promise(() => {}));

    renderWithRouter();
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'APP-001');
    const passwordInput = document.querySelector('input[type="password"]')!;
    await userEvent.type(passwordInput, 'Str0ng!Pass');
    fireEvent.click(screen.getByRole('button', { name: /Activate Account/i }));

    expect(screen.getByRole('button', { name: /Activating Account.../i })).toBeDisabled();
  });

  it('navigates to login on successful claim', async () => {
    vi.mocked(api.auth.claim).mockResolvedValue({ message: 'Success' });

    renderWithRouter();
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'APP-001');
    const passwordInput = document.querySelector('input[type="password"]')!;
    await userEvent.type(passwordInput, 'Str0ng!Pass');
    fireEvent.click(screen.getByRole('button', { name: /Activate Account/i }));

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('shows error alert on failed claim', async () => {
    vi.mocked(api.auth.claim).mockRejectedValue(new Error('Invalid admission code'));

    renderWithRouter();
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'BAD-CODE');
    const passwordInput = document.querySelector('input[type="password"]')!;
    await userEvent.type(passwordInput, 'Str0ng!Pass');
    fireEvent.click(screen.getByRole('button', { name: /Activate Account/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid admission code')).toBeInTheDocument();
    });
  });

  it('shows generic alert on network error', async () => {
    vi.mocked(api.auth.claim).mockRejectedValue(new Error('Network error'));

    renderWithRouter();
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'APP-001');
    const passwordInput = document.querySelector('input[type="password"]')!;
    await userEvent.type(passwordInput, 'Str0ng!Pass');
    fireEvent.click(screen.getByRole('button', { name: /Activate Account/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
