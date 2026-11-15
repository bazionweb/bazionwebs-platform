import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Academics from './Academics';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', first_name: 'John', last_name: 'Doe', email: 'john@bmi.edu', role: 'student' } }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    student: {
      getCourses: vi.fn(),
      getDashboard: vi.fn(),
      getTranscript: vi.fn(),
      enroll: vi.fn(),
      dropCourse: vi.fn(),
    },
  },
}));

describe('Academics Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getCourses).mockResolvedValue([
      { id: 'c-101', code: 'BIB-101', title: 'Old Testament Survey', description: 'Survey of OT', term: 'Fall 2026', credits: 3, capacity: 30, prerequisites_met: true, unmet_prerequisites: [] },
      { id: 'c-201', code: 'THEO-201', title: 'Systematic Theology', description: 'Systematic overview', term: 'Fall 2026', credits: 3, capacity: 25, is_full: true, prerequisites_met: true, unmet_prerequisites: [] },
    ]);
    vi.mocked(api.student.getDashboard).mockResolvedValue({
      id: 'STD-1001',
      first_name: 'John',
      last_name: 'Doe',
      gpa: 3.85,
      total_credits: 45,
      degree_credits: 120,
      program_name: 'Bachelor of Science in Biblical Studies',
      current_classes: [
        { id: 'c-101', code: 'BIB-101', name: 'Old Testament Survey', credits: 3, room: 'Room 101', time: 'Mon/Wed 09:00 AM' }
      ],
    });
    vi.mocked(api.student.getTranscript).mockResolvedValue({
      gpa: '3.85',
      classes: [
        { term: 'Fall 2026', code: 'BIB-101', title: 'Old Testament Survey', credits: 3, grade: 'A' }
      ]
    });
    vi.mocked(api.student.enroll).mockResolvedValue({ success: true, message: 'Enrolled' });
    vi.mocked(api.student.dropCourse).mockResolvedValue({ success: true, message: 'Dropped' });
  });

  it('renders academic navigation tabs', async () => {
    render(
      <MemoryRouter>
        <Academics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('📝 Course Registration')).toBeInTheDocument();
      expect(screen.getByText('📅 Active Class Schedule')).toBeInTheDocument();
      expect(screen.getByText('📊 Degree Audit Checklist')).toBeInTheDocument();
      expect(screen.getByText('🎓 Official Transcript & Grades')).toBeInTheDocument();
      expect(screen.getByText('🧮 GPA Forecast Simulator')).toBeInTheDocument();
    });
  });

  it('switches to Degree Audit tab and displays curriculum categories', async () => {
    render(
      <MemoryRouter>
        <Academics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('📊 Degree Audit Checklist')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('📊 Degree Audit Checklist'));

    await waitFor(() => {
      expect(screen.getByText(/Degree Requirement Audit/i)).toBeInTheDocument();
      expect(screen.getByText(/Biblical & Theological Core Foundations/i)).toBeInTheDocument();
      expect(screen.getByText(/Ministry Leadership & Practical Fieldwork/i)).toBeInTheDocument();
    });
  });

  it('switches to GPA Forecast Simulator tab and calculates projected GPA', async () => {
    render(
      <MemoryRouter>
        <Academics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🧮 GPA Forecast Simulator')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('🧮 GPA Forecast Simulator'));

    await waitFor(() => {
      expect(screen.getByText(/Interactive GPA Forecast & "What-If" Simulator/i)).toBeInTheDocument();
      expect(screen.getByText('Projected Cumulative GPA')).toBeInTheDocument();
    });
  });

  it('switches to Official Transcript tab and renders print button', async () => {
    render(
      <MemoryRouter>
        <Academics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🎓 Official Transcript & Grades')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('🎓 Official Transcript & Grades'));

    await waitFor(() => {
      expect(screen.getByText(/Print \/ Save Official Transcript/i)).toBeInTheDocument();
      expect(screen.getByText(/BMI UNIVERSITY • OFFICE OF THE REGISTRAR/i)).toBeInTheDocument();
    });
  });
});
