/**
 * BMI University Management System - Document Components Index
 * Centralized exports for all document-related components
 */

// Core Components
export { IDCard } from '../IDCard';
export { AdmissionLetter } from '../AdmissionLetter';
export { GoodStandingLetter } from '../GoodStandingLetter';
export { RegistrationCard } from '../RegistrationCard';
export { DocumentVerifier } from '../DocumentVerifier';

// Legacy Components (re-exported for compatibility)
export { default as Certificates } from '../Certificates';
export { Transcripts } from '../Transcripts';

// Types (re-exported from types/documents)
export type {
  BaseDocument,
  StudentIDCard,
  AdmissionLetter as AdmissionLetterType,
  GoodStandingLetter as GoodStandingLetterType,
  RegistrationCard as RegistrationCardType,
  LibraryCard,
  AttendanceRecord,
  DocumentType,
  DocumentStatus,
  DocumentSecurityFeatures,
  DocumentVerificationResult,
  DocumentAuditLog,
  DocumentStatistics,
  DocumentTemplate,
  DocumentOutputOptions,
  TranscriptSemester,
  TranscriptCourse,
  RegisteredCourse,
  AttendanceSession
} from '../../types/documents';

// Service (re-exported)
export { documentService } from '../../services/documentService';









