/**
 * BMI UMS — Hooks/API barrel export
 * Import everything from here so components don't need deep paths.
 *
 * Usage:
 *   import { useUpdateLeaveRequest, useReturnBookMutation } from '../hooks/api';
 */

// ── Infrastructure ────────────────────────────────────────────────────────────
export { apiClient, ApiError } from './apiClient';
export { QUERY_KEYS } from './queryKeys';

// ── HR / Staff ────────────────────────────────────────────────────────────────
export {
  useLeaveRequestsQuery,
  usePayrollQuery,
  useUpdateLeaveRequest,
  useAddStaffMutation,
  useUpdateStaffMutation,
  type LeaveRequest,
  type PayrollRecord,
} from './useHR';

// ── Library ───────────────────────────────────────────────────────────────────
export {
  useLibraryBooksQuery,
  useLibraryBorrowingsQuery,
  useLibraryFinesQuery,
  useReturnBookMutation,
  useMarkFinePaidMutation,
  useAddBookMutation,
  useCheckoutBookMutation,
  type LibraryBook,
  type LibraryBorrowing,
  type LibraryFine,
} from './useLibrary';

// ── Alumni & Campus ───────────────────────────────────────────────────────────
export {
  useAlumniProfilesQuery,
  useAlumniEventsQuery,
  useDonationsQuery,
  useTransportRoutesQuery,
  useTransportPassesQuery,
  useAddAlumniEventMutation,
  useRecordDonationMutation,
  type AlumniProfile,
  type AlumniEvent,
  type Donation,
  type TransportRoute,
  type TransportPass,
} from './useAlumniCampus';

// ── Students & Applications ───────────────────────────────────────────────────
export {
  useUpdateStudentMutation,
  useToggleStudentHoldMutation,
  useUpdateApplicationStatusMutation,
  useConvertApplicationMutation,
  useCreateInvoiceMutation,
  useProcessPaymentMutation,
} from './useStudents';
