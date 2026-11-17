/**
 * BMI UMS - University Grading System
 * Core Type Definitions
 * 
 * This file contains all core TypeScript interfaces, types, and enums
 * for the comprehensive university grading system.
 */

// ============================================================================
// Grading Scale Types
// ============================================================================

/**
 * Supported grading scale types
 */
export enum GradingScaleType {
  US_4_0 = 'US_4_0',
  ECTS = 'ECTS',
  PERCENTAGE = 'PERCENTAGE',
  CUSTOM = 'CUSTOM',
}

/**
 * US 4.0 letter grades with modifiers
 */
export enum LetterGrade {
  A_PLUS = 'A+',
  A = 'A',
  A_MINUS = 'A-',
  B_PLUS = 'B+',
  B = 'B',
  B_MINUS = 'B-',
  C_PLUS = 'C+',
  C = 'C',
  C_MINUS = 'C-',
  D_PLUS = 'D+',
  D = 'D',
  F = 'F',
}

/**
 * ECTS letter grades
 */
export enum ECTSGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

/**
 * Grade point mapping for US 4.0 scale
 */
export const US_GRADE_POINTS: Record<LetterGrade, number> = {
  [LetterGrade.A_PLUS]: 4.0,
  [LetterGrade.A]: 4.0,
  [LetterGrade.A_MINUS]: 3.7,
  [LetterGrade.B_PLUS]: 3.3,
  [LetterGrade.B]: 3.0,
  [LetterGrade.B_MINUS]: 2.7,
  [LetterGrade.C_PLUS]: 2.3,
  [LetterGrade.C]: 2.0,
  [LetterGrade.C_MINUS]: 1.7,
  [LetterGrade.D_PLUS]: 1.3,
  [LetterGrade.D]: 1.0,
  [LetterGrade.F]: 0.0,
};

/**
 * Grade boundaries for US 4.0 scale (percentage-based)
 */
export const US_GRADE_BOUNDARIES: Record<LetterGrade, { min: number; max: number }> = {
  [LetterGrade.A_PLUS]: { min: 97, max: 100 },
  [LetterGrade.A]: { min: 93, max: 96.99 },
  [LetterGrade.A_MINUS]: { min: 90, max: 92.99 },
  [LetterGrade.B_PLUS]: { min: 87, max: 89.99 },
  [LetterGrade.B]: { min: 83, max: 86.99 },
  [LetterGrade.B_MINUS]: { min: 80, max: 82.99 },
  [LetterGrade.C_PLUS]: { min: 77, max: 79.99 },
  [LetterGrade.C]: { min: 73, max: 76.99 },
  [LetterGrade.C_MINUS]: { min: 70, max: 72.99 },
  [LetterGrade.D_PLUS]: { min: 67, max: 69.99 },
  [LetterGrade.D]: { min: 60, max: 66.99 },
  [LetterGrade.F]: { min: 0, max: 59.99 },
};

/**
 * ECTS grade point mapping (for GPA conversion)
 */
export const ECTS_GRADE_POINTS: Record<ECTSGrade, number> = {
  [ECTSGrade.A]: 4.0,
  [ECTSGrade.B]: 3.0,
  [ECTSGrade.C]: 2.0,
  [ECTSGrade.D]: 1.0,
  [ECTSGrade.E]: 0.5,
  [ECTSGrade.F]: 0.0,
};

/**
 * Grading scale configuration
 */
export interface GradingScale {
  id: string;
  type: GradingScaleType;
  name: string;
  description: string;
  boundaries: GradeBoundary[];
  gradePointMap: Record<string, number>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Grade boundary definition for custom scales
 */
export interface GradeBoundary {
  grade: string;
  minScore: number;
  maxScore: number;
  gradePoints: number;
  isPassing: boolean;
}

// ============================================================================
// Assessment Component Types
// ============================================================================

/**
 * Assessment component types
 */
export enum AssessmentType {
  MIDTERM = 'Midterm',
  FINAL_EXAM = 'Final_Exam',
  ASSIGNMENT = 'Assignment',
  QUIZ = 'Quiz',
  PROJECT = 'Project',
  PARTICIPATION = 'Participation',
  LAB_WORK = 'Lab_Work',
  PRESENTATION = 'Presentation',
}

/**
 * Assessment component configuration
 */
export interface AssessmentComponent {
  id: string;
  type: AssessmentType;
  name: string;
  weight: number; // Percentage (0-100)
  maxScore: number;
  description?: string;
}

/**
 * Student's score for an assessment component
 */
export interface ComponentScore {
  componentId: string;
  componentType: AssessmentType;
  score: number;
  maxScore: number;
  weight: number;
  submittedAt?: string;
  gradedAt?: string;
  feedback?: string;
}

// ============================================================================
// Grade Types
// ============================================================================

/**
 * Grade status
 */
export enum GradeStatus {
  DRAFT = 'Draft',
  PROVISIONAL = 'Provisional',
  PENDING_REVIEW = 'Pending Review',
  VERIFIED = 'Verified',
  FLAGGED = 'Flagged',
  FINALIZED = 'Finalized',
  INCOMPLETE = 'Incomplete',
}

/**
 * Special grade designations
 */
export enum SpecialGrade {
  INCOMPLETE = 'I',
  PASS = 'P',
  FAIL = 'F',
  WITHDRAWN = 'W',
  AUDIT = 'AU',
}

/**
 * Comprehensive grade record
 */
export interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  
  // Grading scale information
  gradingScaleId: string;
  gradingScaleType: GradingScaleType;
  
  // Assessment components
  components: ComponentScore[];
  
  // Calculated grades
  numericGrade: number; // 0-100 or 0-4.0 depending on scale
  letterGrade: string; // A+, A, A-, etc. or ECTS grade
  gradePoints: number; // For GPA calculation
  
  // Special designations
  specialGrade?: SpecialGrade;
  isRetake: boolean;
  retakeAttemptNumber?: number;
  replacedGradeId?: string; // ID of grade this replaces
  
  // Academic period
  academicYear: string;
  semester: string; // Fall, Spring, Summer
  
  // Status and metadata
  status: GradeStatus;
  percentileRank?: number;
  
  // Incomplete grade handling
  incompleteDeadline?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  finalizedAt?: string;
  
  // Audit trail
  createdBy: string;
  lastModifiedBy: string;
}

// ============================================================================
// GPA Types
// ============================================================================

/**
 * GPA calculation result
 */
export interface GPAResult {
  gpa: number; // Precision to 2 decimal places
  totalCredits: number;
  totalGradePoints: number;
  coursesIncluded: number;
  calculatedAt: string;
}

/**
 * Semester GPA record
 */
export interface SemesterGPA extends GPAResult {
  academicYear: string;
  semester: string;
  studentId: string;
}

/**
 * Cumulative GPA record
 */
export interface CumulativeGPA extends GPAResult {
  studentId: string;
  semestersIncluded: number;
  startDate: string;
  endDate: string;
}

// ============================================================================
// Academic Standing Types
// ============================================================================

/**
 * Academic standing categories
 */
export enum AcademicStanding {
  HONOR_ROLL = 'Honor Roll',
  GOOD_STANDING = 'Good Standing',
  WARNING = 'Warning',
  ACADEMIC_PROBATION = 'Academic Probation',
  SUSPENDED = 'Suspended',
}

/**
 * Academic standing thresholds configuration
 */
export interface AcademicStandingThresholds {
  honorRollMinGPA: number; // Default: 3.5
  goodStandingMinGPA: number; // Default: 2.0
  probationThresholdGPA: number; // Default: 2.0
  warningThresholdGPA: number; // Default: 2.0
}

/**
 * Student academic standing record
 */
export interface StudentAcademicStanding {
  studentId: string;
  standing: AcademicStanding;
  cumulativeGPA: number;
  semesterGPA: number;
  academicYear: string;
  semester: string;
  determinedAt: string;
  notes?: string;
}

/**
 * Dean's List eligibility
 */
export interface DeansListEligibility {
  studentId: string;
  studentName: string;
  semesterGPA: number;
  creditsCompleted: number;
  academicYear: string;
  semester: string;
  isEligible: boolean;
  hasIncompleteGrades: boolean;
}

// ============================================================================
// Retake Policy Types
// ============================================================================

/**
 * Retake policy options
 */
export enum RetakePolicy {
  REPLACE_WITH_HIGHEST = 'replace_with_highest',
  REPLACE_WITH_LATEST = 'replace_with_latest',
  AVERAGE_ALL_ATTEMPTS = 'average_all_attempts',
}

/**
 * Retake policy configuration
 */
export interface RetakePolicyConfig {
  policy: RetakePolicy;
  maxRetakeAttempts: number;
  showAllAttemptsOnTranscript: boolean;
  allowGPARecalculation: boolean;
}

// ============================================================================
// Grade Analytics Types
// ============================================================================

/**
 * Grade distribution data
 */
export interface GradeDistribution {
  courseId: string;
  courseCode: string;
  courseName: string;
  academicYear: string;
  semester: string;
  
  distribution: Record<string, number>; // Grade -> Count
  
  statistics: {
    mean: number;
    median: number;
    standardDeviation: number;
    min: number;
    max: number;
    totalStudents: number;
  };
  
  percentages: Record<string, number>; // Grade -> Percentage
}

/**
 * Grade trend data point
 */
export interface GradeTrendPoint {
  academicYear: string;
  semester: string;
  semesterGPA: number;
  cumulativeGPA: number;
  academicStanding: AcademicStanding;
  creditsEarned: number;
}

/**
 * Grade trend analysis
 */
export interface GradeTrendAnalysis {
  studentId: string;
  trendPoints: GradeTrendPoint[];
  trendDirection: 'improving' | 'declining' | 'stable';
  significantChanges: Array<{
    fromSemester: string;
    toSemester: string;
    gpaChange: number;
  }>;
}

// ============================================================================
// Audit Trail Types
// ============================================================================

/**
 * Grade change audit log entry
 */
export interface GradeAuditLog {
  id: string;
  gradeId: string;
  studentId: string;
  courseId: string;
  
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FINALIZE' | 'APPEAL_APPROVED';
  
  oldValue?: Partial<Grade>;
  newValue?: Partial<Grade>;
  
  changedBy: string;
  changedByRole: string;
  reason?: string;
  
  timestamp: string;
  ipAddress?: string;
}

// ============================================================================
// Grade Appeal Types
// ============================================================================

/**
 * Grade appeal status
 */
export enum AppealStatus {
  SUBMITTED = 'Submitted',
  UNDER_REVIEW = 'Under_Review',
  APPROVED = 'Approved',
  DENIED = 'Denied',
  WITHDRAWN = 'Withdrawn',
}

/**
 * Grade appeal record
 */
export interface GradeAppeal {
  id: string;
  gradeId: string;
  studentId: string;
  courseId: string;
  
  reason: string;
  explanation: string;
  supportingDocuments?: string[];
  
  status: AppealStatus;
  
  submittedAt: string;
  reviewedAt?: string;
  resolvedAt?: string;
  
  reviewedBy?: string;
  reviewNotes?: string;
  
  originalGrade: string;
  revisedGrade?: string;
}

// ============================================================================
// Transcript Types
// ============================================================================

/**
 * Transcript course entry
 */
export interface TranscriptCourse {
  courseCode: string;
  courseName: string;
  credits: number;
  letterGrade: string;
  gradePoints: number;
  academicYear: string;
  semester: string;
  isRetake: boolean;
  retakeIndicator?: string;
}

/**
 * Transcript data
 */
export interface Transcript {
  studentId: string;
  studentName: string;
  admissionNo: string;
  program: string;
  
  courses: TranscriptCourse[];
  
  semesterGPAs: Array<{
    academicYear: string;
    semester: string;
    gpa: number;
    credits: number;
    standing: AcademicStanding;
  }>;
  
  cumulativeGPA: number;
  totalCreditsEarned: number;
  
  gradingScaleLegend: string;
  
  generatedAt: string;
  generatedBy: string;
}

// ============================================================================
// Import/Export Types
// ============================================================================

/**
 * Bulk grade import record
 */
export interface GradeImportRecord {
  rowNumber: number;
  studentId: string;
  courseCode: string;
  grade: number | string;
  academicYear?: string;
  semester?: string;
  
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Bulk import result
 */
export interface BulkImportResult {
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  errors: GradeImportRecord[];
  importedAt: string;
  importedBy: string;
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Old grade system record (for migration)
 */
export interface LegacyGrade {
  id?: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  courseCode: string;
  courseName: string;
  grade: number; // 0-100
  letterGrade?: string;
  gpa?: number;
  total?: number;
  midterm?: number;
  final?: number;
  academicYear?: string;
  semester?: string;
  status?: 'Pending Review' | 'Verified' | 'Flagged';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  errors: Array<{
    legacyGradeId?: string;
    studentId: string;
    courseCode: string;
    error: string;
  }>;
  backupPath: string;
  migratedAt: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Grade submission deadline configuration
 */
export interface GradeDeadlineConfig {
  academicYear: string;
  semester: string;
  submissionDeadline: string;
  reminderDays: number[]; // Days before deadline to send reminders
  autoFinalizeAfterDays: number;
  allowLateSubmission: boolean;
}

/**
 * ECTS conversion configuration
 */
export interface ECTSConversionConfig {
  usCreditsToECTSRatio: number; // Default: 2 (1 US credit = 2 ECTS)
  ectsToUSCreditsRatio: number; // Default: 0.5 (1 ECTS = 0.5 US credits)
  displayBothOnTranscript: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * Grade filters for queries
 */
export interface GradeFilters {
  page?: number;
  perPage?: number;
  studentId?: string;
  courseId?: string;
  courseCode?: string;
  academicYear?: string;
  semester?: string;
  status?: GradeStatus;
  gradingScaleType?: GradingScaleType;
}









