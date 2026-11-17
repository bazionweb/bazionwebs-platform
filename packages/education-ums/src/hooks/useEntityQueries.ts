/**
 * BMI UMS — TanStack Query hooks for core entities
 *
 * Replace blind 60s polling with intelligent cache management:
 * - staleTime=5min: no network request if data is less than 5 minutes old
 * - refetchOnWindowFocus: background refresh when user returns to tab
 * - Per-query keys enable granular cache invalidation after mutations
 *
 * Usage example (in a component):
 *   const { data: students, isLoading } = useStudentsQuery({ page: 1, perPage: 50 });
 */
import { useQuery } from '../shims/tanstack-react-query';
import { getStudents } from '../services/studentService';
import { getStaff } from '../services/staffService';
import { getCourses } from '../services/courseService';
import { getLibraryItems } from '../services/libraryService';
import { getTransactions } from '../services/financeService';
import { getAllStudyCenters } from '../services/studyCenterService';
import { getGrades } from '../services/gradeService';

// ── Query Keys ────────────────────────────────────────────────────────────────
// Centralised so mutations can call queryClient.invalidateQueries({ queryKey: QUERY_KEYS.students() })
export const QUERY_KEYS = {
  students: (filters?: any) => ['students', filters ?? {}] as const,
  grades: (filters?: any) => ['grades', filters ?? {}] as const,
  staff: (filters?: any) => ['staff', filters ?? {}] as const,
  courses: (filters?: any) => ['courses', filters ?? {}] as const,
  library: (filters?: any) => ['library', filters ?? {}] as const,
  transactions: (filters?: any) => ['transactions', filters ?? {}] as const,
  studyCenters: () => ['studyCenters'] as const,
};

// ── Students ──────────────────────────────────────────────────────────────────
export function useStudentsQuery(params?: {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  study_center_id?: string;
  program?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.students(params as any | undefined),
    queryFn: () => {
      if (!params) return getStudents({ perPage: 50 });
      // StudentFilters uses campusId (camelCase); map from the snake_case param
      const { study_center_id, ...rest } = params;
      return getStudents({ ...rest, campusId: study_center_id });
    },
    // Reference data changes rarely — cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
}

// ── Grades ────────────────────────────────────────────────────────────────────
export function useGradesQuery(params?: {
  page?: number;
  perPage?: number;
  studentId?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.grades(params as any | undefined),
    queryFn: () => getGrades(params ?? { perPage: 50 }),
    staleTime: 5 * 60 * 1000,
  });
}


// ── Staff ─────────────────────────────────────────────────────────────────────
export function useStaffQuery(params?: {
  page?: number;
  perPage?: number;
  department?: string;
  search?: string;
  study_center_id?: string;
  category?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.staff(params as any | undefined),
    queryFn: () => {
      if (!params) return getStaff({ perPage: 50 });
      const { study_center_id, ...rest } = params;
      return getStaff({ ...rest, campusId: study_center_id });
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Courses ───────────────────────────────────────────────────────────────────
export function useCoursesQuery(params?: {
  page?: number;
  perPage?: number;
  search?: string;
  study_center_id?: string;
  status?: string;
  module_id?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.courses(params as any | undefined),
    queryFn: () => {
      if (!params) return getCourses({ perPage: 100 });
      const { study_center_id, module_id, ...rest } = params;
      return getCourses({ ...rest, campusId: study_center_id, moduleId: module_id });
    },
    // Courses change very rarely
    staleTime: 10 * 60 * 1000,
  });
}

// ── Library ───────────────────────────────────────────────────────────────────
export function useLibraryQuery(params?: { page?: number; perPage?: number }) {
  return useQuery({
    queryKey: QUERY_KEYS.library(params),
    queryFn: () => getLibraryItems(params ?? { perPage: 100 }),
    staleTime: 10 * 60 * 1000,
  });
}

// ── Finance ───────────────────────────────────────────────────────────────────
export function useTransactionsQuery(params?: {
  page?: number;
  perPage?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.transactions(params),
    queryFn: () => getTransactions(params ?? { perPage: 50 }),
    // Transactions change more frequently
    staleTime: 2 * 60 * 1000,
  });
}

// ── Study Centers ────────────────────────────────────────────────────────────
export function useStudyCentersQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.studyCenters(),
    queryFn: getAllStudyCenters,
    // Study centers almost never change
    staleTime: 30 * 60 * 1000,
  });
}









