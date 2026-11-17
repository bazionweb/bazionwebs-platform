// BMI UMS - Frontend Type Entrypoint
// Types inlined from shared to ensure reliable resolution in all build environments

// --- auth ---
export type UserRole = 'admin' | 'registrar' | 'faculty' | 'student' | 'staff' | 'viewer';

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  type?: "access" | "refresh" | "mfa";
  iat: number;
  exp: number;
  id?: string;
  studentId?: string;
  staffId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// --- student ---
export interface Student {
  id: string;
  reg_no?: string;
  full_name: string;
  first_name: string;
  last_name: string;
  gender: "Male" | "Female";
  date_of_birth?: string;
  nationality?: string;
  email: string;
  phone: string;
  admission_date: string;
  program: string;
  program_code?: string;
  status: "Active" | "Inactive" | "Graduated" | "Suspended" | "Applicant";
  avatar_color: string;
  photo?: string;
  photo_zoom: number;
  photo_position?: { x: number; y: number };
  study_center_id?: string;
  campus_name?: string;
  expand?: {
    study_center_id?: { name: string; location?: string };
  };
  academicLevel?: string;
  faculty?: string;
  department?: string;
  faculty_id?: string;
  department_id?: string;
  gpa?: number;
  admissionYear?: string;
  legacy_identifiers?: any;
  careerPath?: string;
  year_of_study?: string;
  graduation_date?: string;
  degree_level?: string;
  award_type?: string;
  mode_of_study?: string;
  created?: string;
  updated?: string;
}

export interface StudentCreateInput {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  program: string;
  yearOfStudy: number;
}

// --- certificate ---
export interface Certificate {
  id: string;
  serial_number: string;
  student_id: string;
  student_name: string;
  degree: string;
  graduation_class?: string;
  faculty: string;
  department: string;
  issue_date: string;
  graduation_date: string;
  gpa: number;
  status: "ISSUED" | "REVOKED" | "SUSPENDED";
  content_hash: string;
  verification_count: number;
  created: string;
  updated: string;
  courseCode?: string;
  courseName?: string;
  grade?: string;
  issuedAt?: string;
  verificationHash?: string;
  qrData?: string;
}

export interface CertificateVerificationRequest {
  serial: string;
  hash?: string;
  method: "online" | "offline" | "qr_scan";
}

export interface CertificateVerificationResult {
  valid: boolean;
  certificate?: {
    serial_number: string;
    student_name: string;
    degree_title: string;
    graduation_class?: string;
    faculty: string;
    department: string;
    issue_date: string;
    graduation_date: string;
    gpa: number;
    status: "active" | "revoked" | "suspended" | "ISSUED" | "REVOKED" | "SUSPENDED";
  };
  verification?: {
    timestamp: string;
    method: string;
    hash_verified: boolean;
    verification_count: number;
  };
  error?: string;
  code?: string;
}

// --- academic ---
export type ProgramLevel = 'certificate' | 'diploma' | 'bachelor' | 'master' | 'doctorate';
export type StudyMode = 'full_time' | 'part_time' | 'distance' | 'hybrid';

export interface Faculty {
  id: string;
  code: string;
  name: string;
  short_name: string;
  dean_id?: string;
  email?: string;
  description: string;
  is_active: boolean;
  created: string;
  updated: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  faculty_id: string;
  head_id?: string;
  email?: string;
  description: string;
  is_active: boolean;
  created: string;
  updated: string;
}

export interface Program {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  degree_type: string;
  level: ProgramLevel;
  faculty_id: string;
  department_id: string;
  duration_years: number;
  total_credit_hours: number;
  total_semesters: number;
  mode_of_study: StudyMode;
  accreditation_body: string;
  entry_requirements: string;
  description: string;
  is_active: boolean;
  created: string;
  updated: string;
}

export interface AcademicTerm {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  academic_year: string;
  semester_number: number;
  status: 'upcoming' | 'registration' | 'active' | 'exam' | 'grading' | 'closed';
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  term_id: string;
  expand?: {
    student_id?: Student;
    course_id?: Course;
    term_id?: AcademicTerm;
  };
  status: 'enrolled' | 'dropped' | 'completed' | 'failed' | 'incomplete';
  grade?: string;
  score?: number;
}

// --- other ---
export interface StaffMember {
  id: string;
  staff_number: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  category: "Academic" | "Administrative" | "Management";
  status: "Full-time" | "Part-time" | "On Leave";
  specialization?: string;
  office?: string;
  officeHours?: string;
  avatarColor?: string;
  photo?: string;
  joinDate?: string;
  study_center_id?: string;
  expand?: {
    study_center_id?: { name: string; location?: string };
  };
  created?: string;
  updated?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  name?: string;
  faculty_id?: string;
  department_id?: string;
  // Legacy aliases for backward compatibility
  faculty?: string;
  department?: string;
  expand?: {
    faculty_id?: Faculty;
    department_id?: Department;
  };
  level: "Undergraduate" | "Postgraduate" | "Diploma" | "Certificate";
  credits?: number;
  credit_hours: number;
  status: "Published" | "Draft" | "Archived";
  description: string;
  syllabus: string;
  module_id?: string;
  study_center_id?: string;
  created?: string;
  updated?: string;
}

export interface Transaction {
  id: string;
  ref: string;
  name: string;
  desc: string;
  amt: number;
  status: "Paid" | "Pending" | "Failed";
  date: string;
  student_id?: string;
  expand?: {
    student_id?: Student;
  };
  created: string;
  updated: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  author: string;
  category: "Theology" | "ICT" | "Business" | "Education" | "General";
  type: "PDF" | "E-Book" | "Hardcopy" | "Journal" | "Video";
  status: "Digital" | "Available" | "Borrowed" | "Reserved";
  year: string;
  description: string;
  downloadUrl: string;
  location?: string;
  isbn?: string;
  created: string;
  updated: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "registrar" | "faculty" | "student" | "staff" | "viewer";
  department?: string;
  studentId?: string;
  staffId?: string;
  expand?: {
    studentId?: Student;
    staffId?: StaffMember;
  };
  isActive: boolean;
  lastLogin?: string;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  mfaRecoveryCodes?: string[];
  created: string;
  updated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  /** HTTP status of the underlying request (0 = network failure). Lets UI
   *  distinguish expired sessions (401) from server outages. */
  status?: number;
  message?: string;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalItems?: number;
    totalPages?: number;
  };
}

export interface StudyCenter {
  id: string;
  name: string;
  location?: string;
  code?: string;
}

export interface Hostel {
  id: string;
  name: string;
  type: "Male" | "Female";
  capacity: number;
  location: string;
  status: "Available" | "Near Capacity" | "Full";
  created?: string;
  updated?: string;
}

export interface RoomAssignment {
  id: string;
  student_id: string;
  studentName: string;
  hostelId: string;
  roomNumber: string;
  checkInDate: string;
  status: "Active" | "Revoked";
  expand?: {
    student_id?: Student;
    hostelId?: Hostel;
  };
  created?: string;
  updated?: string;
}

export interface MedicalVisit {
  id: string;
  // Primary identifier may be optional for legacy compatibility
  student_id?: string;
  studentName: string;
  // Legacy alias for older code
  studentId?: string;
  condition: string;
  bloodType: string;
  date: string;
  attendingStaff: string;
  status: "Normal" | "Urgent" | "Follow-up";
  vitals: {
    temp: string;
    bp: string;
    pulse: string;
  };
  notes: string;
  expand?: {
    student_id?: Student;
  };
  created?: string;
  updated?: string;
}

export interface AuditLog {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "LOGIN" | "LOGOUT" | "VERIFY";
  resource: string;
  resourceId?: string;
  userId: string;
  userEmail: string;
  details?: any;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
}

// UI-specific
export type UIState = 'loading' | 'error' | 'success' | 'idle';
