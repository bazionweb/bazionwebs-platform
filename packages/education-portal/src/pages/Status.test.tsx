import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Status from './Status';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';

const refreshMock = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', first_name: 'John', email: 'john@bmi.edu' }, refresh: refreshMock }),
}));

vi.mock('../lib/api', () => ({
  api: {
    applications: {
      getMyApplication: vi.fn(),
      getStatusLogs: vi.fn(),
    },
    admissions: {
      getDecision: vi.fn(),
      acceptOffer: vi.fn(),
      declineOffer: vi.fn(),
    },
    provisioning: {
      getStatus: vi.fn(),
    },
    enrollment: {
      getStatus: vi.fn(),
    },
    recommendations: {
      list: vi.fn(),
    },
  },
}));

describe('Status Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.applications.getMyApplication).mockResolvedValue({
      id: 'app-101',
      status: 'submitted',
      program: 'Bachelor of Science in Biblical Studies',
      degree_level: 'Undergraduate',
      created_at: '2026-08-01T12:00:00Z',
    } as any);
    vi.mocked(api.enrollment.getStatus).mockResolvedValue({
      status: 'APPLICANT_SUBMITTED',
      lastChangedAt: '2026-08-01T12:00:00Z',
      reason: null,
    });
    vi.mocked(api.admissions.getDecision).mockResolvedValue({
      decision: null,
      application_id: 'app-101',
    });
    vi.mocked(api.provisioning.getStatus).mockResolvedValue({
      status: 'idle',
      uid: null,
      regNo: null,
      studentEmail: null,
      catalogYearId: null,
      steps: [],
    });
    vi.mocked(api.recommendations.list).mockResolvedValue([]);
    vi.mocked(api.applications.getStatusLogs).mockResolvedValue([
      { old_status: 'draft', new_status: 'submitted', notes: 'Application officially submitted', changed_at: '2026-08-01T12:00:00Z', changed_by_name: 'Admissions Office' }
    ]);
  });

  it('renders application status tracker and milestone progress', async () => {
    render(
      <MemoryRouter>
        <Status />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/My Application & Enrollment Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Bachelor of Science in Biblical Studies/i)).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Offer')).toBeInTheDocument();
    });
  });

  it('displays status update timeline history', async () => {
    render(
      <MemoryRouter>
        <Status />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application Activity Timeline')).toBeInTheDocument();
      expect(screen.getByText('Application officially submitted')).toBeInTheDocument();
    });
  });

  it('refreshes the session after accepting so student routes unlock without re-login', async () => {
    vi.mocked(api.applications.getMyApplication).mockResolvedValue({
      id: 'app-101',
      status: 'accepted',
      program: 'Bachelor of Science in Biblical Studies',
      degree_level: 'Undergraduate',
      created_at: '2026-08-01T12:00:00Z',
    } as any);
    vi.mocked(api.enrollment.getStatus).mockResolvedValue({
      status: 'OFFER_EXTENDED',
      lastChangedAt: '2026-08-01T12:00:00Z',
      reason: null,
    });
    vi.mocked(api.admissions.getDecision).mockResolvedValue({
      decision: 'admit',
      application_id: 'app-101',
    } as any);
    vi.mocked(api.admissions.acceptOffer).mockResolvedValue({ success: true, provisioningResult: {} } as any);

    render(
      <MemoryRouter>
        <Status />
      </MemoryRouter>
    );

    const acceptBtn = await screen.findByRole('button', { name: /Accept Admission Offer/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(api.admissions.acceptOffer).toHaveBeenCalledWith('app-101');
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
