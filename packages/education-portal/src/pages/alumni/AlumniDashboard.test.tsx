import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlumniDashboard from './AlumniDashboard';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';


describe('AlumniDashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    window.alert = vi.fn();
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <AlumniDashboard />
      </MemoryRouter>
    );
  };

  it('renders the alumni portal heading', () => {
    renderPage();
    expect(screen.getByText('Alumni Portal')).toBeInTheDocument();
    expect(screen.getByText('Welcome Alumni!')).toBeInTheDocument();
    expect(screen.getByText(/As an alumnus/)).toBeInTheDocument();
  });

  it('renders email forwarding input and button', () => {
    renderPage();
    expect(screen.getByPlaceholderText('personal@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Alumni Preferences/i })).toBeInTheDocument();
  });

  it('calls transition API and shows success alert', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText('personal@email.com'), 'alumni@gmail.com');
    fireEvent.click(screen.getByRole('button', { name: /Save Alumni Preferences/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/alumni/transition',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ forwardEmail: 'alumni@gmail.com' }),
        }),
      );
    });
    expect(window.alert).toHaveBeenCalledWith('Transitioned to Alumni status successfully.');
  });

  it('shows failure alert when API returns error', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Save Alumni Preferences/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to transition.');
    });
  });

  it('sends empty forwardEmail when field is blank', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Save Alumni Preferences/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/alumni/transition',
        expect.objectContaining({
          body: JSON.stringify({ forwardEmail: '' }),
        }),
      );
    });
  });
});
