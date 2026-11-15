/**
 * BMI UMS — Centralised Query Key Registry
 * Mirrors admin-dashboard/src/hooks/api/queryKeys.ts
 *
 * Using a single registry means mutations can call:
 *   queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staff.all() })
 * and every component subscribed to that data will automatically refetch.
 */

export const QUERY_KEYS = {
  // ── Students ──
  students: {
    all:    (filters?: Record<string, unknown>) => ['students', filters ?? {}] as const,
    detail: (id: string) => ['students', id] as const,
  },

  // ── Staff / HR ──
  staff: {
    all:          (filters?: Record<string, unknown>) => ['staff', filters ?? {}] as const,
    detail:       (id: string) => ['staff', id] as const,
    leaveRequests: () => ['staff', 'leave-requests'] as const,
    payroll:       () => ['staff', 'payroll'] as const,
  },

  // ── Courses ──
  courses: {
    all:    (filters?: Record<string, unknown>) => ['courses', filters ?? {}] as const,
    detail: (id: string) => ['courses', id] as const,
  },

  // ── Terms & Programs ──
  terms: {
    all:    () => ['terms'] as const,
    detail: (id: string) => ['terms', id] as const,
  },
  programs: {
    all:    (filters?: Record<string, unknown>) => ['programs', filters ?? {}] as const,
    detail: (id: string) => ['programs', id] as const,
  },

  // ── Finance / Invoices ──
  invoices: {
    all:       (filters?: Record<string, unknown>) => ['invoices', filters ?? {}] as const,
    byStudent: (studentId: string) => ['invoices', 'student', studentId] as const,
  },
  transactions: {
    all: (filters?: Record<string, unknown>) => ['transactions', filters ?? {}] as const,
  },

  // ── Library ──
  library: {
    books:     () => ['library', 'books'] as const,
    borrowings: () => ['library', 'borrowings'] as const,
    fines:     () => ['library', 'fines'] as const,
    byStudent: (studentId: string) => ['library', 'loans', 'student', studentId] as const,
  },

  // ── Alumni ──
  alumni: {
    profiles:  () => ['alumni', 'profiles'] as const,
    events:    () => ['alumni', 'events'] as const,
    donations: () => ['alumni', 'donations'] as const,
  },

  // ── Campus Services ──
  campus: {
    hostels:        () => ['campus', 'hostels'] as const,
    transportRoutes: () => ['campus', 'transport'] as const,
    transportPasses: () => ['campus', 'transport', 'passes'] as const,
  },

  // ── Grades ──
  grades: {
    all:       (filters?: Record<string, unknown>) => ['grades', filters ?? {}] as const,
    byStudent: (studentId: string) => ['grades', 'student', studentId] as const,
  },

  // ── Study Centers / Applications ──
  studyCenters: () => ['studyCenters'] as const,
  applications: {
    all:    (filters?: Record<string, unknown>) => ['applications', filters ?? {}] as const,
    detail: (id: string) => ['applications', id] as const,
  },

  // ── Audit ──
  auditLogs: {
    all: () => ['audit-logs'] as const,
  },
} as const;
