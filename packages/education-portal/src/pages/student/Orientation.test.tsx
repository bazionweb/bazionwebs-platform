import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Orientation from './Orientation';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    student: {
      getDashboard: vi.fn(),
      completeOrientation: vi.fn(),
    },
  },
}));

describe('Orientation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getDashboard).mockResolvedValue({
      id: 'STD-1001',
      registration_holds: [{ hold_type: 'orientation', description: 'Complete orientation' }],
    });
    vi.mocked(api.student.completeOrientation).mockResolvedValue({
      success: true,
      message: 'Orientation completed',
    });
  });

  it('renders module navigation sidebar and first orientation module', async () => {
    render(
      <MemoryRouter>
        <Orientation />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Student Online Orientation')).toBeInTheDocument();
      expect(screen.getByText(/Welcome to BMI University/i)).toBeInTheDocument();
      expect(screen.getByText('Student Services & LMS Guide')).toBeInTheDocument();
      expect(screen.getByText('Orientation Quiz & Verification')).toBeInTheDocument();
    });
  });

  it('navigates to next module on button click', async () => {
    render(
      <MemoryRouter>
        <Orientation />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Continue to Academic Integrity →')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Continue to Academic Integrity →'));

    await waitFor(() => {
      expect(screen.getAllByText(/Academic Integrity & Honor Code/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Continue to Student Services →')).toBeInTheDocument();
    });
  });
});
