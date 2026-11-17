import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Finances from './Finances';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    student: {
      getFinances: vi.fn(),
      getDashboard: vi.fn(),
      payInvoice: vi.fn(),
    },
    finance: {
      getFinancialAid: vi.fn(),
    },
    payments: {
      verify: vi.fn(),
    },
  },
}));

describe('Finances Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getFinances).mockResolvedValue({
      invoices: [
        { id: 'inv-001', amount: 1500, status: 'unpaid', created_at: '2026-08-01', due_date: '2026-09-01' },
        { id: 'inv-002', amount: 3000, status: 'paid', created_at: '2026-05-01', due_date: '2026-06-01' },
      ],
    });
    vi.mocked(api.student.getDashboard).mockResolvedValue({
      id: 'STD-1001',
      user: { first_name: 'John', last_name: 'Doe' },
    });
    vi.mocked(api.finance.getFinancialAid).mockResolvedValue({
      awards: [{ id: 'aid-1', amount: 500, aid_type: 'scholarship' }],
      total_awarded: 500,
    });
    vi.mocked(api.student.payInvoice).mockResolvedValue({ success: true });
  });

  it('renders summary financial KPI cards and invoice table', async () => {
    render(
      <MemoryRouter>
        <Finances />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('💳 Tuition & Student Financial Services')).toBeInTheDocument();
      expect(screen.getByText('Current Balance Due')).toBeInTheDocument();
      expect(screen.getByText('Total Settled (YTD)')).toBeInTheDocument();
      expect(screen.getByText('Institutional Aid / Grant')).toBeInTheDocument();
      expect(screen.getAllByText('$1,500.00').length).toBeGreaterThan(0);
    });
  });

  it('opens and confirms 3-Month Installment Plan modal', async () => {
    render(
      <MemoryRouter>
        <Finances />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Apply for Installment Plan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Apply for Installment Plan'));

    expect(screen.getByText('📋 3-Month Installment Plan Option')).toBeInTheDocument();
    expect(screen.getByText('Installment 1 (Immediate)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm & Enroll in Plan'));

    await waitFor(() => {
      expect(screen.getByText(/Installment payment plan agreement submitted successfully/i)).toBeInTheDocument();
    });
  });

  it('opens 1098-T Tax Statement modal and displays IRS boxes', async () => {
    render(
      <MemoryRouter>
        <Finances />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🖨️ View 1098-T Tax Statement')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('🖨️ View 1098-T Tax Statement'));

    expect(screen.getByText('IRS Form 1098-T Tuition Statement')).toBeInTheDocument();
    expect(screen.getByText(/BOX 1: Payments Received for Qualified Tuition/i)).toBeInTheDocument();
    expect(screen.getByText(/BOX 5: Scholarships or Institutional Grants/i)).toBeInTheDocument();
    expect(screen.getByText('🖨️ Print Form 1098-T')).toBeInTheDocument();
  });
});
