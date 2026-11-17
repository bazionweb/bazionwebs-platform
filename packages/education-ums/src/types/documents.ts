/**
 * BMI University Management System - Document Types
 * Comprehensive type definitions for all institutional documents
 * Security-focused with full audit trail support
 */

export type DocumentType =
  | "certificate"
  | "transcript"
  | "id_card"
  | "admission_letter"
  | "good_standing"
  | "registration_card"
  | "library_card"
  | "attendance_record";

export type DocumentStatus =
  | "draft"
  | "issued"
  | "revoked"
  | "suspended"
  | "expired";

export interface DocumentSecurityFeatures {
  /** Cryptographic hash of document content */
  contentHash: string;
  /** Unique serial number */
  serialNumber: string;
  /** QR code data URL */
  qrCodeDataUrl: string;
  /** Verification URL */
  verificationUrl: string;
  /** Timestamp of issuance */
  issuedAt: string;
  /** Expiry date if applicable */
  expiresAt?: string;
  /** Digital signature (if implemented) */
  digitalSignature?: string;
  /** Anti-tamper seal hash */
  sealHash: string;
  /** Blockchain anchor hash (optional) */
  blockchainAnchor?: string;
  /** Number of times verified */
  verificationCount: number;
  /** Last verification timestamp */
  lastVerifiedAt?: string;
}

export interface BaseDocument {
  id: string;
  type: DocumentType;
  studentId: string;
  studentName: string;
  status: DocumentStatus;
  security: DocumentSecurityFeatures;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

/** Enhanced Certificate with full security features */
export interface EnhancedCertificate extends BaseDocument {
  type: "certificate";
  degreeTitle: string;
  faculty: string;
  department: string;
  graduationClass?: string;
  graduationDate: string;
  issueDate: string;
  gpa: number;
  honors?: string;
  thesisTitle?: string;
  thesisGrade?: string;
  /** Certificate template variant */
  template: "standard" | "honors" | "distinction" | "phd";
}

/** Enhanced Transcript with full security features */
export interface EnhancedTranscript extends BaseDocument {
  type: "transcript";
  transcriptType: "official" | "provisional" | "complete";
  academicLevel: string;
  faculty: string;
  department: string;
  admissionDate: string;
  expectedGraduation: string;
  actualGraduation?: string;
  cumulativeGpa: number;
  totalCredits: number;
  totalHours: number;
  academicStanding: string;
  semesters: TranscriptSemester[];
  hasRetakes: boolean;
  failedModules: string[];
  academicRecommendation: string;
  deanName: string;
  registrarName: string;
}

export interface TranscriptSemester {
  term: string;
  year: number;
  gpa: number;
  credits: number;
  status: "completed" | "in_progress" | "withdrawn";
  courses: TranscriptCourse[];
}

export interface TranscriptCourse {
  code: string;
  name: string;
  credits: number;
  hours: number;
  score: number;
  grade: string;
  points: number;
  status: "passed" | "failed" | "incomplete" | "withdrawn";
  attempt: number;
}

/** Student ID Card */
export interface StudentIDCard extends BaseDocument {
  type: "id_card";
  cardNumber?: string;
  photoUrl?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  studentId: string;
  faculty?: string;
  department?: string;
  program?: string;
  academicLevel?: string;
  bloodType?: string;
  bloodGroup?: string;
  issueDate?: string;
  expiryDate?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  barcodeData?: string;
  libraryNumber?: string;
  hostelName?: string;
  roomNumber?: string;
  // ── Fields used by IDCard component ──
  studentNumber?: string;
  // Note: studentName is inherited as required from BaseDocument
  student_number?: string;
}

/** Letter of Admission */
export interface AdmissionLetter extends BaseDocument {
  type: "admission_letter";
  admissionNumber: string;
  academicYear: string;
  semester: string;
  program: string;
  faculty: string;
  department: string;
  admissionDate: string;
  registrationDeadline: string;
  tuitionFees: number;
  currency: string;
  paymentDeadline: string;
  conditions?: string[];
  requiredDocuments: string[];
  orientationDate?: string;
  registrationUrl: string;
  contactInfo: {
    phone: string;
    email: string;
    address: string;
  };
}

/** Letter of Good Standing */
export interface GoodStandingLetter extends BaseDocument {
  type: "good_standing";
  letterType: "general" | "transfer" | "employment" | "scholarship" | "visa";
  purpose: string;
  recipientName?: string;
  recipientAddress?: string;
  academicStatus: string;
  conductStatus: string;
  financialStatus: string;
  effectiveDate: string;
  letterBody: string;
  authorizedBy: string;
  authorizedTitle: string;
  standingType?: string;
}

/** Course Registration Card */
export interface RegistrationCard extends BaseDocument {
  type: "registration_card";
  academicYear: string;
  semester: string;
  registrationDate: string;
  courses: RegisteredCourse[];
  totalCredits: number;
  totalHours: number;
  registrationStatus: "complete" | "pending" | "provisional";
  advisorName: string;
  advisorApproval: boolean;
  financeClearance: boolean;
  libraryClearance: boolean;
}

export interface RegisteredCourse {
  code: string;
  name: string;
  credits: number;
  hours: number;
  lecturer: string;
  schedule: string;
  venue: string;
  status: "registered" | "waitlist" | "dropped";
}

/** Library Card */
export interface LibraryCard extends BaseDocument {
  type: "library_card";
  libraryNumber: string;
  category: "student" | "staff" | "external";
  issueDate: string;
  expiryDate: string;
  maxBooks: number;
  currentLoans: number;
  fineBalance: number;
  accessLevel: "full" | "limited" | "restricted";
  departments: string[];
}

/** Attendance Record */
export interface AttendanceRecord extends BaseDocument {
  type: "attendance_record";
  academicYear: string;
  semester: string;
  courseCode: string;
  courseName: string;
  lecturer: string;
  totalSessions: number;
  attendedSessions: number;
  absentSessions: number;
  excusedSessions: number;
  attendancePercentage: number;
  sessions: AttendanceSession[];
  eligibilityStatus: "eligible" | "warning" | "barred";
}

export interface AttendanceSession {
  date: string;
  time: string;
  status: "present" | "absent" | "excused" | "late";
  verifiedBy: string;
  verificationMethod: "manual" | "biometric" | "qr_scan" | "app";
}

/** Document Template Configuration */
export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  name: string;
  description: string;
  orientation: "portrait" | "landscape";
  paperSize: "A4" | "A5" | "letter" | "ID1" | "custom";
  customDimensions?: {
    width: number;
    height: number;
    unit: "mm" | "in" | "px";
  };
  securityLevel: "standard" | "enhanced" | "maximum";
  features: {
    qrCode: boolean;
    barcode: boolean;
    microtext: boolean;
    guilloche: boolean;
    watermark: boolean;
    holographic: boolean;
    uvFeatures: boolean;
    digitalSignature: boolean;
  };
  design: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    borderStyle: "none" | "simple" | "ornate" | "double" | "seal";
    sealImage?: string;
    backgroundPattern?: string;
  };
  isDefault: boolean;
  isActive: boolean;
}

/** Document Generation Request */
export interface DocumentGenerationRequest {
  type: DocumentType;
  studentId: string;
  templateId?: string;
  options?: {
    orientation?: "portrait" | "landscape";
    securityLevel?: "standard" | "enhanced" | "maximum";
    includeDigitalSignature?: boolean;
    includeBlockchainAnchor?: boolean;
    expiresAt?: string;
  };
  metadata?: Record<string, any>;
}

/** Document Print/PDF Options */
export interface DocumentOutputOptions {
  format: "pdf" | "print" | "preview" | "image";
  filename?: string;
  quality?: "low" | "medium" | "high" | "maximum";
  includeBackground?: boolean;
  colorMode?: "color" | "grayscale" | "monochrome";
  duplex?: boolean;
  watermarkText?: string;
  password?: string; // For encrypted PDF
}

/** Document Verification Result */
export interface DocumentVerificationResult {
  valid: boolean;
  document?: BaseDocument;
  securityCheck: {
    hashValid: boolean;
    sealIntact: boolean;
    notExpired: boolean;
    notRevoked: boolean;
    qrCodeValid: boolean;
  };
  verification: {
    timestamp: string;
    method: "online" | "offline" | "qr_scan" | "api";
    verifiedBy?: string;
    ipAddress?: string;
    location?: string;
  };
  error?: string;
  code?: string;
  // ── Flattened convenience fields used by DocumentVerifier component ──
  documentType?: string;
  serialNumber?: string;
  status?: string;
  issuedAt?: string;
  verifiedAt?: string;
  hashVerified?: boolean;
  blockchainAnchor?: string;
  verificationCount?: number;
}

/** Document Statistics */
export interface DocumentStatistics {
  totalDocuments: number;
  byType: Record<DocumentType, number>;
  byStatus: Record<DocumentStatus, number>;
  issuedThisMonth: number;
  issuedThisYear: number;
  revokedCount: number;
  averageVerificationTime: number;
  mostVerifiedDocuments: Array<{ documentId: string; count: number }>;
}

/** Document Audit Log */
export interface DocumentAuditLog {
  id: string;
  documentId: string;
  action:
    | "created"
    | "viewed"
    | "printed"
    | "downloaded"
    | "verified"
    | "revoked"
    | "updated";
  performedBy: string;
  performedAt: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}










