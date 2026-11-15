import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
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
      getOnboardingStatus: vi.fn(),
      getDeadlines: vi.fn(),
      getAttendance: vi.fn(),
    },
  },
}));

describe('Student Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getDashboard).mockResolvedValue({
      id: 'STD-1001',
      first_name: 'John',
      last_name: 'Doe',
      gpa: 3.85,
      total_credits: 45,
      degree_credits: 120,
      program_name: 'Bachelor of Science in Biblical Studies',
      current_classes: [
        { id: 'c-1', code: 'BIB-101', name: 'Old Testament Survey', credits: 3, room: 'Room 101', time: 'Mon/Wed 09:00 AM' }
      ],
      upcoming_invoices: [],
    });
    vi.mocked(api.student.getOnboardingStatus).mockResolvedValue({ tasks: [], progress: 100, isComplete: true });
    vi.mocked(api.student.getDeadlines).mockResolvedValue([
      { title: 'Add/Drop Deadline', date: 'Sept 15, 2026', tag: 'Urgent', type: 'Academic', color: 'blue' }
    ]);
    vi.mocked(api.student.getAttendance).mockResolvedValue([
      { id: 'att-1', status: 'present' },
      { id: 'att-2', status: 'present' },
    ]);
  });

  it('renders student welcome greeting and key KPI cards', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, John Doe!/i)).toBeInTheDocument();
      expect(screen.getByText('Cumulative GPA')).toBeInTheDocument();
      expect(screen.getByText('3.85')).toBeInTheDocument();
      expect(screen.getByText('Degree Credit Progress')).toBeInTheDocument();
      expect(screen.getByText('Account Tuition Balance')).toBeInTheDocument();
    });
  });

  it('renders degree pathway progress and attendance tracker', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Degree Completion Pathway/i)).toBeInTheDocument();
      expect(screen.getByText(/Course Attendance & Engagement Record/i)).toBeInTheDocument();
      expect(screen.getByText(/100% Attendance Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/BIB-101/i)).toBeInTheDocument();
    });
  });

  it('renders academic deadlines widget', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Add/Drop Deadline')).toBeInTheDocument();
      expect(screen.getByText('📅 Sept 15, 2026')).toBeInTheDocument();
    });
  });
});
