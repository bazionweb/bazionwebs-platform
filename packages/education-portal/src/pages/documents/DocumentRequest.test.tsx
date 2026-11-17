import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentRequest from './DocumentRequest';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    payments: {
      createIntent: vi.fn(),
    },
  },
}));

describe('DocumentRequest Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    // @ts-expect-error jsdom navigation
    delete window.location;
    // @ts-expect-error jsdom navigation
    window.location = { href: '' };
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <DocumentRequest />
      </MemoryRouter>
    );
  };

  it('renders the document request form', () => {
    renderPage();
    expect(screen.getByText('Self-Service Documents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request Document/i })).toBeInTheDocument();
  });

  it('shows all document type options', () => {
    renderPage();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Official Transcript ($15)');
    expect(options[1]).toHaveTextContent('Degree Certificate ($25)');
    expect(options[2]).toHaveTextContent('Enrollment Letter (Free)');
  });

  it('shows the BEMI merchant line (Paystack payee)', () => {
    renderPage();
    expect(screen.getByText(/BEMI TRAINING INSTITUTE/i)).toBeInTheDocument();
  });

  it('initializes Paystack intent and redirects to checkout on submit', async () => {
    vi.mocked(api.payments.createIntent).mockResolvedValue({
      intentId: 'BMI-1',
      reference: 'BMI-1',
      authorizationUrl: 'https://checkout.paystack.com/x',
      merchant: 'BEMI TRAINING INSTITUTE',
      tradingAs: 'BEMI TRAINING INSTITUTE (trading as BMI University)',
    });

    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByRole('combobox'), 'transcript');
    fireEvent.click(screen.getByRole('button', { name: /Request Document/i }));

    await waitFor(() => {
      expect(api.payments.createIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 15, reason: 'Document Request: transcript' }),
      );
    });
    expect(window.location.href).toBe('https://checkout.paystack.com/x');
  });

  it('shows processing state while submitting', async () => {
    vi.mocked(api.payments.createIntent).mockImplementation(() => new Promise(() => {}));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Request Document/i }));

    expect(screen.getByRole('button', { name: /Processing.../i })).toBeDisabled();
  });

  it('shows alert on error', async () => {
    vi.mocked(api.payments.createIntent).mockRejectedValue(new Error('Network error'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Request Document/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Network error');
    });
  });

  it('sends correct reason based on selected document type', async () => {
    vi.mocked(api.payments.createIntent).mockResolvedValue({
      intentId: 'BMI-2',
      reference: 'BMI-2',
      merchant: 'BEMI TRAINING INSTITUTE',
      tradingAs: 'BEMI TRAINING INSTITUTE (trading as BMI University)',
    });

    renderPage();

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'certificate' } });
    expect((select as unknown as HTMLSelectElement).value).toBe('certificate');

    fireEvent.click(screen.getByRole('button', { name: /Request Document/i }));

    await waitFor(() => {
      expect(api.payments.createIntent).toHaveBeenCalledWith(
        expect.objectContaining({ reason: expect.stringContaining('Document Request: certificate') }),
      );
    });
  });
});
