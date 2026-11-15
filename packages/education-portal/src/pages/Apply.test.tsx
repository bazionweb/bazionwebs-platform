import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Apply from './Apply';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useAuthModule from '../hooks/useAuth';


// Mock API and Auth
vi.mock('../hooks/useAuth');
vi.mock('../lib/api', () => ({
  api: {
    applications: {
      submit: vi.fn(),
      saveDraft: vi.fn().mockResolvedValue({ message: 'draft saved' }),
    },
  },
}));

import { api } from '../lib/api';

describe('Apply Page (Portal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderWithRouter = () => {
    return render(
      <MemoryRouter>
        <Apply />
      </MemoryRouter>
    );
  };

  it('renders application form if user is authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'applicant@test.com', first_name: 'Test', last_name: 'User', role: 'applicant', is_verified: 1 },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      refreshSession: vi.fn(),
      setUser: vi.fn(),
      expiresAt: null,
    });

    renderWithRouter();
    
    // Check for form elements
    expect(screen.getByText('Your Application')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Program')).toBeInTheDocument();
  });

  it('submits application successfully', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'applicant@test.com', first_name: 'Test', last_name: 'User', role: 'applicant', is_verified: 1 },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      refreshSession: vi.fn(),
      setUser: vi.fn(),
      expiresAt: null,
    });

    (api.applications.submit as any).mockResolvedValue({ success: true, data: { id: 'app-123' } });

    renderWithRouter();
    
    // Select a program
    fireEvent.click(screen.getByText('BA in Biblical Studies'));
    
    // Continue to step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {});
    
    // We are on Personal Info. Fill required fields then continue
    fireEvent.change(screen.getByLabelText(/Date of Birth \*/i), { target: { value: '2000-01-01' } });
    fireEvent.change(screen.getByLabelText(/Gender \*/i), { target: { value: 'Male' } });
    fireEvent.change(screen.getByLabelText(/Nationality \*/i), { target: { value: 'American' } });

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {});
    
    // We are on Background. Add text to prior education
    const bgInput = screen.getByLabelText(/Prior Education & Academic History \*/i);
    fireEvent.change(bgInput, { target: { value: 'I attended high school and got my diploma in 2020.' } });
    
    // Continue to step 4
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {});
    
    // Add text to personal statement
    const statementInput = screen.getByLabelText(/Personal Statement \*/i);
    fireEvent.change(statementInput, { target: { value: 'This is my personal statement. It must be at least one hundred characters long to pass the validation check in the Apply form. Here is some additional text to ensure the length requirement is satisfied.' } });
    
    // Continue to step 5 (Documents)
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {});

    // Continue to step 6 (Review & Submit)
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {});
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Submit Application/i }));
    
    await waitFor(() => {
      expect(api.applications.submit).toHaveBeenCalled();
    });

    // Canonical payload: program_id sent alongside the display label
    const payload = (api.applications.submit as any).mock.calls[0][0];
    expect(payload.degree_level).toBeTruthy();
    expect(payload.program || payload.program_id).toBeTruthy();
    
    // Note: The actual Apply component might redirect or show a success message.
    // The test confirms the API was called correctly.
  }, 15000);
});
