/**
 * BMI UMS - Grading System Constants
 * Shared constants used throughout the grading system
 */

/**
 * Default GPA precision (decimal places)
 */
export const GPA_PRECISION = 2;

/**
 * Default academic standing thresholds
 */
export const DEFAULT_STANDING_THRESHOLDS = {
  honorRollMinGPA: 3.5,
  goodStandingMinGPA: 2.0,
  probationThresholdGPA: 2.0,
  warningThresholdGPA: 2.0,
};

/**
 * Default Dean's List criteria
 */
export const DEFAULT_DEANS_LIST_CRITERIA = {
  minGPA: 3.5,
  minCredits: 12,
  excludeIncomplete: true,
};

/**
 * Default ECTS conversion ratios
 */
export const DEFAULT_ECTS_CONVERSION = {
  US_TO_ECTS_RATIO: 2, // 1 US credit = 2 ECTS
  ECTS_TO_US_RATIO: 0.5, // 1 ECTS = 0.5 US credits
};

/**
 * Grade percentage ranges
 */
export const PERCENTAGE_RANGE = {
  MIN: 0,
  MAX: 100,
};

/**
 * GPA scale ranges
 */
export const GPA_RANGE = {
  MIN: 0.0,
  MAX: 4.0,
};

/**
 * Default retake policy
 */
export const DEFAULT_RETAKE_POLICY = "replace_with_highest";

/**
 * Maximum retake attempts allowed
 */
export const MAX_RETAKE_ATTEMPTS = 3;

/**
 * Audit log retention period (years)
 */
export const AUDIT_LOG_RETENTION_YEARS = 7;

/**
 * Default grade submission reminder days
 */
export const DEFAULT_REMINDER_DAYS = [7, 3, 1]; // Days before deadline

/**
 * Default auto-finalize period (days after submission)
 */
export const DEFAULT_AUTO_FINALIZE_DAYS = 3;

/**
 * Semester names
 */
export const SEMESTERS = ["Fall", "Spring", "Summer"] as const;

/**
 * Significant GPA change threshold
 */
export const SIGNIFICANT_GPA_CHANGE = 0.5;









