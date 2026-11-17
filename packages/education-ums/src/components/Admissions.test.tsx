import 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Admissions from './Admissions';
import { admissionsService } from '../services/admissionsService';

vi.mock('../services/admissionsService', () => ({
  admissionsService: {
    listApplications: vi.fn(),
    getApplication: vi.fn(),
    updateStatus: vi.fn(),
    getStatusLogs: vi.fn(),
  },
}));

describe('Admissions Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Admissions Management heading', async () => {
    vi.mocked(admissionsService.listApplications).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <Admissions />
      </MemoryRouter>
    );

    expect(screen.getByText(/Admissions Lifecycle/i)).toBeInTheDocument();
  });

  it('renders stat cards correctly when data is loaded', async () => {
    const mockApps = [
      { id: '1', applicant_id: 'u1', status: 'submitted', first_name: 'John', last_name: 'Doe', program: 'CS', degree_level: 'bachelors', email: 'john@test.com', submitted_at: '2023-01-01', created_at: '2023-01-01', updated_at: '2023-01-01' },
      { id: '2', applicant_id: 'u2', status: 'accepted', first_name: 'Jane', last_name: 'Smith', program: 'Math', degree_level: 'masters', email: 'jane@test.com', submitted_at: '2023-01-02', created_at: '2023-01-02', updated_at: '2023-01-02' },
    ];
    
    vi.mocked(admissionsService.listApplications).mockResolvedValueOnce(mockApps);

    render(
      <MemoryRouter>
        <Admissions />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 2 total
      expect(screen.getByText('2')).toBeInTheDocument();
      // 1 awaiting review (submitted)
      const ones = screen.getAllByText('1');
      expect(ones.length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Total Applications/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting Review/i)).toBeInTheDocument();
  });
});
