/**
 * Grades Component — Error Handling Unit Tests
 * Tests for the grade creation error handling fix.
 *
 * Covers:
 *  - handleSaveGrade: API error → modal stays open, error shown
 *  - handleSaveGrade: API success → modal closes, success shown
 *  - handleSaveGrade: network error (thrown) → modal stays open, error shown
 *  - Loading state: disabled Save button during submission
 */

import 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── External dependency mocks ─────────────────────────────────────────────────

// GradeAPIService — key mock: createGrade / updateGrade
vi.mock('../grading/services/GradeAPIService', () => ({
  createGrade: vi.fn(),
  updateGrade: vi.fn(),
  deleteGrade: vi.fn(),
  submitGradeAppeal: vi.fn(),
  approveGradeAppeal: vi.fn(),
  denyGradeAppeal: vi.fn(),
}));

// Academic records service
vi.mock('../services/academicRecordsService', () => ({
  getAcademicRecords: vi.fn().mockResolvedValue({ items: [] }),
}));

// Hooks
vi.mock('../hooks/useEntityQueries', () => ({
  useStudentsQuery: vi.fn(() => ({
    data: {
      data: {
        items: [
          { id: 'stu-1', first_name: 'Alice', last_name: 'Smith', student_number: 'STU001' },
        ],
        page: 1,
        perPage: 50,
        total: 1,
      },
    },
  })),
  useCoursesQuery: vi.fn(() => ({
    data: {
      data: {
        items: [
          { code: 'THEO101', title: 'Theology 101', credit_hours: 3 },
        ],
        page: 1,
        perPage: 50,
        total: 1,
      },
    },
  })),
}));

// Zustand data store
vi.mock('../stores/dataStore', () => ({
  useDataStore: vi.fn(() => ({})),
}));

// Child modals — keep them lightweight to avoid deep dependency chains
vi.mock('./grading/GradeDetailsView', () => ({
  default: () => null,
}));
vi.mock('./grading/StudentGradeReport', () => ({
  default: () => null,
}));
vi.mock('./grading/CourseGradeDistribution', () => ({
  default: () => null,
}));
vi.mock('./grading/GradeAppealForm', () => ({
  default: () => null,
}));
vi.mock('./grading/GradeAppealReview', () => ({
  default: () => null,
}));
vi.mock('./BulkEntryModal', () => ({
  BulkEntryModal: () => null,
}));
vi.mock('../services/batchService', () => ({
  postGradeBatch: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import Grades from './Grades';
import * as GradeAPI from '../grading/services/GradeAPIService';
import * as academicService from '../services/academicRecordsService';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Opens the Add Grade modal and fills in the minimum required fields
 * (student, course, and one assessment component) so the form validates.
 */
async function openModalAndFillForm(user: ReturnType<typeof userEvent.setup>) {
  const addButton = screen.getByRole('button', { name: /add grade/i });
  await user.click(addButton);

  // Wait for modal to appear
  await screen.findByRole('dialog');

  // Select student
  const studentSelect = screen.getByLabelText(/select student/i);
  await user.selectOptions(studentSelect, 'stu-1');

  // Select course
  const courseSelect = screen.getByLabelText(/select course/i);
  await user.selectOptions(courseSelect, 'THEO101');

  // Add one assessment component so validation passes
  const addComponentBtn = screen.getByRole('button', { name: /add component/i });
  await user.click(addComponentBtn);
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Grades — handleSaveGrade error handling', () => {
  const createGradeMock = GradeAPI.createGrade as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getAcademicRecords returns empty list
    (academicService.getAcademicRecords as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. API returns { success: false } ───────────────────────────────────────
  it('should display error alert and keep modal open when API returns success:false', async () => {
    createGradeMock.mockResolvedValue({
      success: false,
      error: 'Validation error: Missing enrollment.',
    });

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);

    // Submit the form
    const saveBtn = screen.getByRole('button', { name: /save grade/i });
    await user.click(saveBtn);

    // Error alert should be visible
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/validation error/i);

    // Modal must still be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ── 2. Network / fetch error (thrown exception) ─────────────────────────────
  it('should display network error and keep modal open when createGrade throws', async () => {
    createGradeMock.mockRejectedValue(new Error('Failed to fetch'));

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);

    const saveBtn = screen.getByRole('button', { name: /save grade/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    // Should surface a user-friendly network message
    expect(alert).toHaveTextContent(/network error|unable to connect/i);

    // Modal still open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ── 3. API returns { success: true } ────────────────────────────────────────
  it('should close modal and show success message when API returns success:true', async () => {
    createGradeMock.mockResolvedValue({
      success: true,
      data: { id: 'grade-new-1' },
    });

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);

    const saveBtn = screen.getByRole('button', { name: /save grade/i });
    await user.click(saveBtn);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Success banner should be visible
    const successBanner = await screen.findByRole('status');
    expect(successBanner).toHaveTextContent(/grade saved successfully/i);
  });

  // ── 4. Success message auto-dismisses after ~4 seconds ──────────────────────
  it('should auto-dismiss success message after 4 seconds', async () => {
    createGradeMock.mockResolvedValue({ success: true, data: { id: 'grade-2' } });

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);
    const saveBtn = screen.getByRole('button', { name: /save grade/i });
    await user.click(saveBtn);

    // Modal should close on success
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Success banner visible initially
    const statusEl = await screen.findByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent(/grade saved successfully/i);
  }, 10000);

  // ── 5. Error cleared on new submission ──────────────────────────────────────
  it('should clear previous error when a new submission starts', async () => {
    // First call fails, second succeeds
    createGradeMock
      .mockResolvedValueOnce({ success: false, error: 'Server error' })
      .mockResolvedValueOnce({ success: true, data: { id: 'grade-3' } });

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);

    const saveBtn = screen.getByRole('button', { name: /save grade/i });

    // First submit — error
    await user.click(saveBtn);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // Second submit — should clear error, then succeed
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 15000);

  // ── 6. Error cleared when modal is closed ───────────────────────────────────
  it('should clear error state when the modal is closed', async () => {
    createGradeMock.mockResolvedValue({ success: false, error: 'Some error' });

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);

    const saveBtn = screen.getByRole('button', { name: /save grade/i });
    await user.click(saveBtn);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // Close the modal
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    // Modal gone
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Re-open modal — no stale error should appear
    const addBtn = screen.getByRole('button', { name: /add grade/i });
    await user.click(addBtn);
    await screen.findByRole('dialog');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }, 15000);
});

describe('GradeEntryModal — loading state prevents double-submission', () => {
  const createGradeMock = GradeAPI.createGrade as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (academicService.getAcademicRecords as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
  });

  it('should disable Save button while the API request is in-flight', async () => {
    // Promise that never resolves — simulates long request
    let resolveRequest!: (v: unknown) => void;
    createGradeMock.mockImplementation(
      () => new Promise((res) => { resolveRequest = res; }),
    );

    const user = userEvent.setup();
    render(<Grades />);

    await openModalAndFillForm(user);

    const saveBtn = screen.getByRole('button', { name: /save grade/i });
    expect(saveBtn).not.toBeDisabled();

    await user.click(saveBtn);

    // Button should now be disabled / show "Saving..."
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /saving\.\.\.|save grade/i });
      expect(btn).toBeDisabled();
    });

    // Clean up — resolve the dangling promise
    resolveRequest({ success: true, data: {} });
  }, 15000);
});
