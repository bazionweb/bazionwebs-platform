import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Documents from './Documents';
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
      uploadDocument: vi.fn(),
    },
  },
}));

describe('Documents Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getDashboard).mockResolvedValue({
      id: 'STD-1001',
      first_name: 'John',
      last_name: 'Doe',
      program_name: 'Bachelor of Science in Biblical Studies',
    });
    vi.mocked(api.student.uploadDocument).mockResolvedValue({ success: true });
  });

  it('renders digital student ID card with front view details', async () => {
    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('📁 Student Document Hub & Digital Credentials')).toBeInTheDocument();
      expect(screen.getByText('Digital Student Identification Card')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('🔄 Flip to Card Back')).toBeInTheDocument();
    });
  });

  it('toggles digital student ID card to back view', async () => {
    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('🔄 Flip to Card Back')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('🔄 Flip to Card Back'));

    expect(screen.getByText(/TERMS & EMERGENCY SERVICES/i)).toBeInTheDocument();
    expect(screen.getByText('🔄 View Card Front')).toBeInTheDocument();
  });

  it('opens Admission Letter and Verification Letter modals', async () => {
    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Admission Letter')).toBeInTheDocument();
      expect(screen.getByText('Verification Letter')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole('button', { name: /View \/ Print/i });
    fireEvent.click(viewButtons[0]);

    expect(screen.getByText('OFFICIAL LETTER OF ADMISSION')).toBeInTheDocument();
    expect(screen.getByText('🖨️ Print Letter')).toBeInTheDocument();
  });
});
