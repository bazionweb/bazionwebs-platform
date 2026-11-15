/**
 * BMI UMS - Core Data Store (Zustand)
 * Centralizes all entity data (students, staff, courses, transactions, library).
 * Replaces the massive prop-drilling from App.tsx through ViewRenderer to every component.
 *
 * @deprecated Use TanStack Query hooks from `useEntityQueries.ts` instead.
 * - students: useStudentsQuery()
 * - staff: useStaffQuery()
 * - courses: useCoursesQuery()
 * - transactions: useTransactionsQuery()
 * - library: useLibraryQuery()
 *
 * Features:
 * - Single source of truth for all entity collections
 * - Automatic API fetching with loading/error states
 * - Intelligent polling (only when logged in)
 * - Optimistic updates for create operations
 */
import { create } from '../shims/zustand';
import { getStudents } from "../services/studentService";
import { getStaff } from "../services/staffService";
import { getCourses } from "../services/courseService";
import { getLibraryItems } from "../services/libraryService";
import { getTransactions, createTransaction } from "../services/financeService";
import { getAllStudyCenters } from "../services/studyCenterService";
import type {
  Student,
  StaffMember,
  Transaction,
  Course,
  LibraryItem,
  StudyCenter,
} from "../types";

interface DataState {
  // Entity collections
  students: Student[];
  staff: StaffMember[];
  transactions: Transaction[];
  courses: Course[];
  library: LibraryItem[];
  studyCenters: StudyCenter[];

  // Loading states
  isLoadingStudents: boolean;
  isLoadingStaff: boolean;
  isLoadingCourses: boolean;
  isLoadingTransactions: boolean;
  isLoadingLibrary: boolean;
  isLoadingStudyCenters: boolean;

  // Error states
  error: string | null;

  // Polling management
  lastFetchedAt: number | null;

  // Actions
  fetchStudents: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchCourses: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchLibrary: () => Promise<void>;
  fetchStudyCenters: () => Promise<void>;
  fetchAllCoreData: () => Promise<void>;

  // Mutations with optimistic updates
  addStudent: (student: Student) => void;
  addTransaction: (amt: number) => Promise<void>;
  setStudents: (students: Student[]) => void;
  setStaff: (staff: StaffMember[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setCourses: (courses: Course[]) => void;
  setLibrary: (library: LibraryItem[]) => void;
  setStudyCenters: (studyCenters: StudyCenter[]) => void;

  // Clear all data (on logout)
  clearAll: () => void;

  // Stats computed from data
  getStats: () => {
    students: number;
    admissions: number;
    tuition: number;
  };
}

export const useDataStore = create<DataState>((set, get) => ({
  students: [],
  staff: [],
  transactions: [],
  courses: [],
  library: [],

  isLoadingStudents: false,
  isLoadingStaff: false,
  isLoadingCourses: false,
  isLoadingTransactions: false,
  isLoadingLibrary: false,
  isLoadingStudyCenters: false,
  studyCenters: [],

  error: null,
  lastFetchedAt: null,

  fetchStudents: async () => {
    set({ isLoadingStudents: true });
    try {
      const result = await getStudents({ perPage: 50 });
      if (result.success && result.data) {
        set({ students: result.data.items, isLoadingStudents: false });
      } else {
        set({ students: [], isLoadingStudents: false, error: result.error });
      }
    } catch (error: unknown) {
      set({
        students: [],
        isLoadingStudents: false,
        error: "Failed to fetch students",
      });
    }
  },

  fetchStaff: async () => {
    set({ isLoadingStaff: true });
    try {
      const result = await getStaff({ perPage: 100 });
      if (result.success && result.data) {
        set({ staff: result.data.items, isLoadingStaff: false });
      } else {
        set({ isLoadingStaff: false });
      }
    } catch (error: unknown) {
      set({ isLoadingStaff: false });
    }
  },

  fetchCourses: async () => {
    set({ isLoadingCourses: true });
    try {
      const result = await getCourses({ perPage: 100 });
      if (result.success && result.data) {
        set({ courses: result.data.items, isLoadingCourses: false });
      } else {
        set({ isLoadingCourses: false });
      }
    } catch (error: unknown) {
      set({ isLoadingCourses: false });
    }
  },

  fetchTransactions: async () => {
    set({ isLoadingTransactions: true });
    try {
      const result = await getTransactions({ perPage: 100 });
      if (result.success && result.data) {
        set({ transactions: result.data, isLoadingTransactions: false });
      } else {
        set({ isLoadingTransactions: false });
      }
    } catch (error: unknown) {
      set({ isLoadingTransactions: false });
    }
  },

  fetchLibrary: async () => {
    set({ isLoadingLibrary: true });
    try {
      const result = await getLibraryItems({ perPage: 100 });
      if (result.success && result.data) {
        set({ library: result.data, isLoadingLibrary: false });
      } else {
        set({ isLoadingLibrary: false });
      }
    } catch (error: unknown) {
      set({ isLoadingLibrary: false });
    }
  },

  fetchStudyCenters: async () => {
    set({ isLoadingStudyCenters: true });
    try {
      const data = await getAllStudyCenters();
      set({ studyCenters: data, isLoadingStudyCenters: false });
    } catch (error: unknown) {
      set({ isLoadingStudyCenters: false });
    }
  },

  fetchAllCoreData: async () => {
    try {
      const [stuRes, st, co, lib, tx, ca] = await Promise.all([
        getStudents({ perPage: 50 }),
        getStaff({ perPage: 100 }),
        getCourses({ perPage: 100 }),
        getLibraryItems({ perPage: 100 }),
        getTransactions({ perPage: 100 }),
        getAllStudyCenters(),
      ]);
      set({
        students: stuRes.success && stuRes.data ? stuRes.data.items : get().students,
        staff: st.success && st.data ? st.data.items : get().staff,
        courses: co.success && co.data ? co.data.items : get().courses,
        library: lib.success && lib.data ? lib.data : get().library,
        transactions: tx.success && tx.data ? tx.data : get().transactions,
        studyCenters: Array.isArray(ca) ? ca : get().studyCenters,
        lastFetchedAt: Date.now(),
      });
    } catch (error: unknown) {
      // Polling will retry — log for diagnostics in dev
      console.warn("[dataStore] fetchAllCoreData error:", error);
    }
  },

  addStudent: (student: Student) => {
    set((state) => ({ students: [student, ...state.students] }));
  },

  addTransaction: async (amt: number) => {
    try {
      const res = await createTransaction({
        ref: `TX-${Date.now()}`,
        name: "Quick Entry",
        desc: "Ad-hoc Payment",
        amt,
        status: "Paid",
        date: new Date().toISOString().split("T")[0],
      });
      if (res.success && res.data) {
        set((state) => ({
          transactions: [res.data as Transaction, ...state.transactions],
        }));
      }
    } catch (error: unknown) {
      console.error("[Finance] quick entry failed", error);
    }
  },

  setStudents: (students) => set({ students }),
  setStaff: (staff) => set({ staff }),
  setTransactions: (transactions) => set({ transactions }),
  setCourses: (courses) => set({ courses }),
  setLibrary: (library) => set({ library }),

  clearAll: () =>
    set({
      students: [],
      staff: [],
      transactions: [],
      courses: [],
      library: [],
      studyCenters: [],
      error: null,
      lastFetchedAt: null,
    }),
  setStudyCenters: (studyCenters) => set({ studyCenters }),

  getStats: () => {
    const state = get();
    return {
      students: state.students.length,
      admissions: state.students.filter((s) => s.status === "Applicant").length,
      tuition: state.transactions
        .filter((t) => t.status === "Paid")
        .reduce((acc, curr) => acc + curr.amt, 0),
    };
  },
}));










