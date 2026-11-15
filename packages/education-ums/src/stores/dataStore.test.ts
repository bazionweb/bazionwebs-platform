/**
 * BMI UMS - Data Store Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDataStore } from "../stores/dataStore";

// Mock service modules
vi.mock("../services/studentService", () => ({
  getStudents: vi.fn(),
}));
vi.mock("../services/staffService", () => ({
  getStaff: vi.fn(),
}));
vi.mock("../services/courseService", () => ({
  getCourses: vi.fn(),
}));
vi.mock("../services/libraryService", () => ({
  getLibraryItems: vi.fn(),
}));
vi.mock("../services/financeService", () => ({
  getTransactions: vi.fn(),
  createTransaction: vi.fn(),
}));


describe("useDataStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataStore.setState({
      students: [],
      staff: [],
      transactions: [],
      courses: [],
      library: [],
      isLoadingStudents: false,
      error: null,
    });
  });

  describe("initial state", () => {
    it("should have empty collections", () => {
      const state = useDataStore.getState();
      expect(state.students).toEqual([]);
      expect(state.staff).toEqual([]);
      expect(state.transactions).toEqual([]);
      expect(state.courses).toEqual([]);
      expect(state.library).toEqual([]);
    });
  });

  describe("addStudent", () => {
    it("should add a student to the beginning of the array", () => {
      const student = {
        id: "1",
        student_code: "STD-001",
        full_name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        gender: "Male" as const,
        email: "john@test.com",
        phone: "123",
        program: "CS",
        program_code: "CS",
        admission_date: "2024-01-01",
        status: "Active" as const,
        avatar_color: "#fff",
        photo_zoom: 1,
      };

      useDataStore.getState().addStudent(student);

      expect(useDataStore.getState().students).toHaveLength(1);
      expect(useDataStore.getState().students[0]).toEqual(student);
    });
  });

  describe("getStats", () => {
    it("should compute stats from current data", () => {
      useDataStore.setState({
        students: [
          { status: "Active" } as any,
          { status: "Applicant" } as any,
          { status: "Applicant" } as any,
        ],
        transactions: [
          { status: "Paid", amt: 1000 } as any,
          { status: "Paid", amt: 2000 } as any,
          { status: "Pending", amt: 500 } as any,
        ],
      });

      const stats = useDataStore.getState().getStats();
      expect(stats.students).toBe(3);
      expect(stats.admissions).toBe(2);
      expect(stats.tuition).toBe(3000);
    });
  });

  describe("clearAll", () => {
    it("should reset all data", () => {
      useDataStore.setState({
        students: [{ id: "1" }] as any,
        staff: [{ id: "2" }] as any,
      });

      useDataStore.getState().clearAll();

      expect(useDataStore.getState().students).toEqual([]);
      expect(useDataStore.getState().staff).toEqual([]);
    });
  });
});










