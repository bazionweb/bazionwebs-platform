/**
 * BMI UMS — Academic Records Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all academic_records queries.
 * Every grade display, transcript, GPA calculation and export flows through here.
 *
 * Collections served: 'academic_records' (bulk import) + 'grades' (faculty entry)
 * Relations:          student_id → students, course_id → courses → module_id
 */

import { authFetch } from './authService';
import { API_URL } from './config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcademicRecord {
  id: string;
  student_id: string;
  course_id: string;
  total_score: number;
  ca_score: number | null;
  exam_score: number | null;
  grade: string;          // A, B+, B, C+, C, D, F
  grade_point: number;    // 4.0, 3.5, 3.0, 2.5, 2.0, 1.0, 0.0
  remarks: string;        // Pass | Fail
  academic_year: string;
  semester: string;
  created: string;
  updated: string;
  // Expanded relations (present when ?expand=student_id,course_id is used)
  expand?: {
    student_id?: {
      id: string;
      reg_no: string;
      full_name: string;
      first_name: string;
      last_name: string;
      gender: string;
      study_center_id: string;
      program_code?: string;
      expand?: { study_center_id?: { id: string; name: string } };
    };
    course_id?: {
      id: string;
      code: string;
      course_code?: string;   // legacy alias
      title: string;
      credit_hours: number;
      credits?: number;       // legacy alias
      category: string;
      module_id: string;
      expand?: {
        module_id?: { id: string; name: string; semester: string; sort_order: number };
      };
    };
  };
}

/** Flat shape returned to UI components */
export interface AcademicRecordFlat {
  id: string;
  studentId: string;
  regNo: string;
  studentName: string;
  gender: string;
  campusName: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  category: string;
  module: string;
  semester: string;
  totalScore: number;      // mapped from numericGrade or total_score
  caScore: number | null;
  examScore: number | null;
  grade: string;           // mapped from letterGrade or grade
  gradePoint: number;      // mapped from gradePoints or grade_point
  remarks: string;
  academicYear: string;
  // Backend direct fields (for robustness)
  numericGrade?: number;
  letterGrade?: string;
  gradePoints?: number;
  credits?: number;
}

export interface GpaRecord {
  studentId: string;
  regNo: string;
  campusName: string;
  module: string;
  totalCreditHours: number;
  totalGradePoints: number;
  gpa: number;
}

export interface AcademicRecordsFilters {
  studentId?: string;
  courseId?: string;
  campusId?: string;
  academicYear?: string;
  semester?: string;
  grade?: string;
  page?: number;
  perPage?: number;
}

// ─── Normaliser ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenRecord(r: AcademicRecord | any): AcademicRecordFlat {
  // Expand relations (present when backend returns expanded records)
  const student  = r.expand?.student_id;
  const course   = r.expand?.course_id;
  const module   = course?.expand?.module_id;
  const campus   = student?.expand?.study_center_id;

  let totalScore = r.score ?? 0;
  let grade = r.letter_grade ?? '';
  let gradePoint = r.grade_point ?? 0;

  return {
    id:            r.id,
    studentId:     r.studentId || r.student_id,
    regNo:         student?.reg_no ?? r.regNo ?? r.reg_no ?? r.studentCode ?? r.student_code ?? '',
    studentName:   (student?.full_name ??
                   `${student?.first_name ?? r.first_name ?? ''} ${student?.last_name ?? r.last_name ?? ''}`.trim()) ||
                   r.studentName || r.student_name || 'Unknown',
    gender:        student?.gender ?? r.gender ?? '',
    campusName:    campus?.name ?? r.campusName ?? r.campus_name ?? '',
    courseId:      r.courseId || r.course_id,
    courseCode:    (course?.code ?? course?.course_code) ?? r.courseCode ?? r.course_code ?? '',
    courseTitle:   (course?.title ?? r.courseName ?? r.courseTitle ?? r.course_name ?? r.title ?? ''),
    creditHours:   (course?.credit_hours ?? course?.credits ?? r.creditHours ?? r.credits ?? r.credit_hours) ?? 0,
    category:      course?.category ?? r.category ?? '',
    module:        module?.name ?? r.module ?? '',
    semester:      r.semester || module?.semester || '',
    totalScore:    totalScore,
    caScore:       null,
    examScore:     null,
    grade:         grade,
    gradePoint:    gradePoint,
    remarks:       grade === 'F' ? 'Fail' : (grade === 'N/A' ? '' : 'Pass'),
    academicYear:  r.academic_year ?? r.academicYear ?? '',
    numericGrade:  totalScore,
    letterGrade:   grade,
    gradePoints:   gradePoint,
    credits:       r.credits,
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const EXPAND = 'student_id,student_id.study_center_id,course_id,course_id.module_id';

/**
 * GET /api/v1/grades  (backed by academic_records collection)
 * Returns flat records ready for display.
 */
/**
 * 🔒 [LOCKED] Core Grade Retrieval Function
 * ─────────────────────────────────────────────────────────────────────────────
 * This function is the primary conduit for all academic performance data.
 * It interfaces with the backend /api/v1/grades endpoint which provides 
 * pre-flattened and expanded records. 
 * 
 * DO NOT change the parameter mapping or result structure without full 
 * verification of Transcripts.tsx and VerificationPortal.
 */
export async function getAcademicRecords(
  filters: AcademicRecordsFilters = {}
): Promise<{ items: AcademicRecordFlat[]; total: number; page: number; perPage: number }> {
  const params = new URLSearchParams();
  
  // Align with backend /api/v1/grades query parameters (snake_case)
  if (filters.studentId)   params.set('student_id',  filters.studentId);
  if (filters.courseId)    params.set('course_id',   filters.courseId);
  if (filters.campusId)    params.set('study_center_id',   filters.campusId);
  if (filters.academicYear)params.set('academic_year',filters.academicYear);
  if (filters.semester)    params.set('semester',    filters.semester);
  if (filters.grade)       params.set('grade',       filters.grade);
  
  params.set('page',    String(filters.page    ?? 1));
  params.set('perPage', String(filters.perPage ?? 500));
  params.set('expand',  EXPAND);

  const res  = await authFetch(`${API_URL}/grades?${params}`);
  const body = await res.json();

  if (!body.success) throw new Error(body.error ?? 'Failed to fetch academic records');

  const rawItems = Array.isArray(body.data)
    ? body.data
    : (body.data?.items ?? []);

  const items: AcademicRecordFlat[] = rawItems.map(flattenRecord);

  // Return flattened records — note: backend already flattens them via mapGradeToFrontend
  // but we run them through flattenRecord again to ensure UI-compatible field names.
  return {
    items,
    total:   body.meta?.total    ?? body.data?.total    ?? body.data?.totalItems ?? items.length,
    page:    body.meta?.page     ?? body.data?.page     ?? 1,
    perPage: body.meta?.perPage  ?? body.data?.perPage  ?? items.length,
  };
}

/**
 * All grades for a specific student (used by Transcripts + student profile).
 */
export async function getStudentAcademicRecords(
  studentId: string
): Promise<AcademicRecordFlat[]> {
  const result = await getAcademicRecords({ studentId, perPage: 200 });
  return result.items;
}

/**
 * Compute per-student, per-module GPA from a list of flat records.
 */
export function computeGpa(records: AcademicRecordFlat[]): GpaRecord[] {
  const byStudentModule = new Map<string, {
    studentId: string; regNo: string; studentName: string; 
    module: string; credits: number; points: number;
  }>();

  for (const r of records) {
    const key = `${r.studentId}__${r.courseCode}`;
    const existing = byStudentModule.get(key);
    if (existing) {
      existing.credits += r.creditHours;
      existing.points  += r.gradePoint * r.creditHours;
    } else {
      byStudentModule.set(key, {
        studentId:   r.studentId,
        regNo:       r.regNo,
        studentName: r.studentName,
        module:      r.courseCode,
        credits:     r.creditHours,
        points:      r.gradePoint * r.creditHours,
      });
    }
  }

  return Array.from(byStudentModule.values()).map(v => ({
    studentId:         v.studentId,
    regNo:             v.regNo,
    studentName:       v.studentName,
    campusName:        '', // Not present in flat record, backend should provide if needed
    module:            v.module,
    totalCreditHours:  v.credits,
    totalGradePoints:  parseFloat(v.points.toFixed(2)),
    gpa:               v.credits > 0 ? parseFloat((v.points / v.credits).toFixed(2)) : 0,
  }));
}

/**
 * Single-student overall GPA (across all modules).
 */
export function computeOverallGpa(records: AcademicRecordFlat[]): number {
  const totalCredits = records.reduce((s, r) => s + r.creditHours, 0);
  const totalPoints  = records.reduce((s, r) => s + r.gradePoint * r.creditHours, 0);
  return totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;
}

/**
 * Create a new academic record.
 */
export async function createAcademicRecord(data: {
  student_id: string;
  course_id: string;
  total_score: number;
  ca_score?: number;
  exam_score?: number;
  academic_year?: string;
}): Promise<AcademicRecordFlat> {
  const res  = await authFetch(`${API_URL}/grades`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? 'Failed to create record');
  return flattenRecord(body.data);
}

/**
 * Update an existing academic record.
 */
export async function updateAcademicRecord(
  id: string,
  data: Partial<{ total_score: number; ca_score: number; exam_score: number }>
): Promise<AcademicRecordFlat> {
  const res  = await authFetch(`${API_URL}/grades/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? 'Failed to update record');
  return flattenRecord(body.data);
}

/**
 * Delete an academic record.
 */
export async function deleteAcademicRecord(id: string): Promise<void> {
  const res  = await authFetch(`${API_URL}/grades/${id}`, { method: 'DELETE' });
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? 'Failed to delete record');
}









