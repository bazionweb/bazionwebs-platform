import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Graduation from './Graduation';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', first_name: 'John', last_name: 'Doe', email: 'john@bmi.edu', role: 'student' } }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    student: {
      getDashboard: vi.fn(),
    },
  },
}));

describe('Graduation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getDashboard).mockResolvedValue({
      id: 'STD-1001',
      first_name: 'John',
      last_name: 'Doe',
      gpa: 3.85,
      total_credits: 105,
      degree_credits: 120,
      program_name: 'Bachelor of Science in Biblical Studies',
      upcoming_invoices: [],
    });
  });

  it('renders Senior Clearance Checklist with 4 audit milestones', async () => {
    render(
      <MemoryRouter>
        <Graduation />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🎓 Senior Graduation Clearance & Ceremony Hub')).toBeInTheDocument();
      expect(screen.getByText('1. Academic Credit Audit')).toBeInTheDocument();
      expect(screen.getByText('2. Financial Ledger')).toBeInTheDocument();
      expect(screen.getByText('3. Library & Media Return')).toBeInTheDocument();
      expect(screen.getByText('4. Registrar Verification')).toBeInTheDocument();
    });
  });

  it('submits application for degree conferral successfully', async () => {
    render(
      <MemoryRouter>
        <Graduation />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application for Degree Conferral')).toBeInTheDocument();
    });

    const addressInput = screen.getByPlaceholderText('Street Address, City, State/Province, Postal Code, Country');
    fireEvent.change(addressInput, { target: { value: '123 Campus Blvd, Charlotte, NC 28202' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Application for Degree Conferral/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Graduation Application Submitted!')).toBeInTheDocument();
      expect(screen.getByText(/Explore Alumni Benefits & Network/i)).toBeInTheDocument();
    });
  });
});
