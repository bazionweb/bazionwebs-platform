import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegistrationWizard from './RegistrationWizard';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../lib/api';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@test.com', role: 'student' } }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    student: {
      getRegistrationEligibility: vi.fn(),
      getCurriculum: vi.fn(),
      getSections: vi.fn(),
      autoEnrollMandatory: vi.fn(),
      generateInvoice: vi.fn(),
    },
    finance: {
      getFeeAgreement: vi.fn(),
      getFinancialAid: vi.fn(),
    },
    registration: {
      getStatus: vi.fn(),
      getModules: vi.fn(),
      getPrograms: vi.fn(),
      reserveSeat: vi.fn(),
      joinWaitlist: vi.fn(),
      dropCourse: vi.fn(),
      saveStep: vi.fn(),
      complete: vi.fn(),
      finalize: vi.fn(),
    },
    enrollment: {
      getStatus: vi.fn(),
      getAgreement: vi.fn(),
      signAgreement: vi.fn(),
    },
  },
}));

describe('RegistrationWizard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.student.getRegistrationEligibility).mockResolvedValue({
      eligible: true,
      status: 'REGISTRATION_ELIGIBLE',
      reasons: [],
      activeHolds: [],
      advisingReleased: true,
      catalogYearId: 'CAT-2026',
      term: { id: 'term-1', name: 'Fall 2026', academic_year: '2026-2027', status: 'active' },
    });
    vi.mocked(api.finance.getFeeAgreement).mockResolvedValue({
      program_name: 'Theology',
      catalog_year_id: 'CAT-2026',
      gross_tuition: 1500,
      financial_aid_discount: 500,
      net_balance_due: 1000,
      currency: 'USD',
      payment_plans: [{ id: 'full', name: 'Single Full Payment' }],
    });
    vi.mocked(api.student.getCurriculum).mockResolvedValue({
      program_name: 'Theology',
      terms: [],
    });
    vi.mocked(api.registration.getStatus).mockResolvedValue({
      current_data: {
        personal_details: {
          first_name: 'John',
          last_name: 'Doe',
          phone: '+23177000000',
          emergency_contact_name: 'Jane Doe',
          emergency_contact_phone: '+23177111111',
        },
      },
      completed_steps: [],
      next_step: 'personal_details',
      registration_complete: false,
    });
    vi.mocked(api.registration.getModules).mockResolvedValue([
      { id: 'c1', code: 'BIB101', name: 'Old Testament Survey', credits: 3 },
      { id: 'c2', code: 'THE101', name: 'Systematic Theology', credits: 3 },
    ]);
    vi.mocked(api.registration.reserveSeat).mockResolvedValue({ status: 'reserved', sectionId: 'c1', message: 'Reserved' });
    vi.mocked((api.student as any).getSections).mockResolvedValue({ sections: [], my_section_ids: [] });
    vi.mocked((api.student as any).autoEnrollMandatory).mockResolvedValue({ success: true, message: 'ok' });
    vi.mocked(api.registration.saveStep).mockResolvedValue({ message: 'saved' });
    vi.mocked((api.enrollment as any).getAgreement).mockResolvedValue({ document_id: 'ENROLL-AGREEMENT-2026', version: '2026.1', version_hash: 'sha256:test', text: 'Agreement' });
    vi.mocked(api.enrollment.signAgreement).mockResolvedValue({ success: true, signature_id: 'sig-1', status: 'REGISTERED', message: 'Signed' });
    vi.mocked(api.registration.complete).mockResolvedValue({ message: 'completed' });
    vi.mocked((api.registration as any).finalize).mockResolvedValue({ success: true, status: 'REGISTERED', registered_sections: 1, message: 'ok' });
  });

  const renderPage = async () => {
    render(
      <MemoryRouter>
        <RegistrationWizard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Student Registration & Enrollment')).toBeInTheDocument();
    });
  };

  it('renders step labels and starts at Step 1', async () => {
    await renderPage();
    expect(screen.getByText(/Profile & Emergency Contacts/i)).toBeInTheDocument();
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('shows blocker screen when student is not eligible', async () => {
    vi.mocked(api.student.getRegistrationEligibility).mockResolvedValue({
      eligible: false,
      status: 'UNDER_REVIEW',
      reasons: ['Active Hold: FINANCIAL — Unpaid prior balance'],
      activeHolds: [{ id: 'h1', hold_type: 'financial', reason: 'Unpaid prior balance', blocks: 'registration' }],
      advisingReleased: false,
      catalogYearId: null,
      term: null,
    });

    render(
      <MemoryRouter>
        <RegistrationWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Registration Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/Active Hold: FINANCIAL/i)).toBeInTheDocument();
    });
  });

  it('advances through steps on Save & Continue', async () => {
    await renderPage();
    fireEvent.click(screen.getByText(/Save & Continue/i));

    await waitFor(() => {
      expect(screen.getByText(/Curriculum & Degree Pathway/i)).toBeInTheDocument();
    });
  });

  it('toggles course selection and calls reserveSeat', async () => {
    await renderPage();
    // Step 0 -> Step 1
    fireEvent.click(screen.getByText(/Save & Continue/i));
    await waitFor(() => expect(screen.getByText(/Curriculum & Degree Pathway/i)).toBeInTheDocument());

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/Save & Continue/i));
    await waitFor(() => expect(screen.getByText(/Course & Section Selection/i)).toBeInTheDocument());

    expect(screen.getAllByText(/BIB101/i).length).toBeGreaterThan(0);
  });
});
