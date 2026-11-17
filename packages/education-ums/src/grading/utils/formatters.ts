/**
 * BMI UMS - Formatting Utilities
 * Format grades, GPAs, and other grading data for display
 */

import { Grade, GradeStatus, AcademicStanding } from '../types';

/**
 * Format GPA for display (2 decimal places)
 */
export function formatGPA(gpa: number): string {
  return gpa.toFixed(2);
}

/**
 * Format percentage grade
 */
export function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(2)}%`;
}

/**
 * Format grade status for display
 */
export function formatGradeStatus(status: GradeStatus): string {
  const statusMap: Record<GradeStatus, string> = {
    [GradeStatus.DRAFT]: 'Draft',
    [GradeStatus.PROVISIONAL]: 'Provisional',
    [GradeStatus.PENDING_REVIEW]: 'Pending Review',
    [GradeStatus.VERIFIED]: 'Verified',
    [GradeStatus.FLAGGED]: 'Flagged',
    [GradeStatus.FINALIZED]: 'Finalized',
    [GradeStatus.INCOMPLETE]: 'Incomplete',
  };
  return statusMap[status] || status;
}

/**
 * Format academic standing for display
 */
export function formatAcademicStanding(standing: AcademicStanding): string {
  return standing;
}

/**
 * Format grade for transcript
 */
export function formatGradeForTranscript(grade: Grade): string {
  if (grade.specialGrade) {
    return grade.specialGrade;
  }
  return `${grade.letterGrade} (${formatGPA(grade.gradePoints)})`;
}

/**
 * Format semester name
 */
export function formatSemester(academicYear: string, semester: string): string {
  return `${semester} ${academicYear}`;
}

/**
 * Format date for display
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format credits
 */
export function formatCredits(credits: number): string {
  return `${credits} ${credits === 1 ? 'credit' : 'credits'}`;
}









