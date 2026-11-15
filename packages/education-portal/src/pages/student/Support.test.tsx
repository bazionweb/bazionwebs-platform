import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Support from './Support';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    student: {
      getSupportTickets: vi.fn(),
      createSupportTicket: vi.fn(),
    },
  },
}));

describe('Support Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getSupportTickets).mockResolvedValue([
      { id: 't-101', subject: '[Academic Advising] Course Registration Inquiry', status: 'open', created_at: '2026-08-08' },
    ]);
    vi.mocked(api.student.createSupportTicket).mockResolvedValue({ success: true, message: 'Ticket created', ticket_id: 't-102' });
  });

  it('renders support tickets form and history', async () => {
    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🎫 Student Help Desk & Academic Advisory')).toBeInTheDocument();
      expect(screen.getByText('Submit a Support Request')).toBeInTheDocument();
      expect(screen.getByText('Support Category')).toBeInTheDocument();
      expect(screen.getByText('My Support Ticket History')).toBeInTheDocument();
    });
  });

  it('switches to appointment booking tab and confirms advisory session', async () => {
    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('📅 Schedule Advisory Session')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('📅 Schedule Advisory Session'));

    expect(screen.getByText('📅 Book an Academic Advisory Session')).toBeInTheDocument();
    expect(screen.getByText('Select Academic Advisor')).toBeInTheDocument();

    const topicInput = screen.getByPlaceholderText('e.g. Degree progression, transfer credit review, senior capstone topic...');
    fireEvent.change(topicInput, { target: { value: 'Degree audit questions' } });

    const dateInput = screen.getByLabelText(/Select Date/i);
    fireEvent.change(dateInput, { target: { value: '2026-09-20' } });

    const submitBtn = screen.getByRole('button', { name: /Confirm & Schedule Advisory Session/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Advisory Appointment Confirmed!/i)).toBeInTheDocument();
    });
  });
});
