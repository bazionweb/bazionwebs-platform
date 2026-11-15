/**
 * BMI UMS - Grade Validation Utilities
 * Validation functions for grades, scores, and GPA calculations
 */

import {
  Grade,
  GradeStatus,
  SpecialGrade,
  GradingScale,
  AssessmentComponent,
} from '../types';
import { PERCENTAGE_RANGE, GPA_RANGE } from './constants';

/**
 * Validate numeric grade within valid range
 */
export function validateNumericGrade(
  grade: number,
//   scale: GradingScale
): { isValid: boolean; error?: string } {
  // For percentage-based scales
  if (grade < PERCENTAGE_RANGE.MIN || grade > PERCENTAGE_RANGE.MAX) {
    return {
      isValid: false,
      error: `Grade ${grade} is out of range. Must be between ${PERCENTAGE_RANGE.MIN} and ${PERCENTAGE_RANGE.MAX}.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate letter grade exists in grading scale
 */
export function validateLetterGrade(
  letterGrade: string,
  scale: GradingScale
): { isValid: boolean; error?: string } {
  const isValid = scale.boundaries.some(b => b.grade === letterGrade);

  if (!isValid) {
    return {
      isValid: false,
      error: `Letter grade '${letterGrade}' is not valid for grading scale '${scale.name}'.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate component weights sum to 100%
 */
export function validateComponentWeightsSum(
  components: AssessmentComponent[]
): { isValid: boolean; totalWeight: number; error?: string } {
  if (components.length === 0) {
    return {
      isValid: false,
      totalWeight: 0,
      error: 'No assessment components defined.',
    };
  }

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01; // Allow small floating point errors

  return {
    isValid,
    totalWeight,
    error: isValid ? undefined : `Component weights sum to ${totalWeight}%, must equal 100%.`,
  };
}

/**
 * Check if grade can be modified (not past finalization deadline)
 */
export function canModifyGrade(
  grade: Grade,
  finalizationDeadline?: Date
): { canModify: boolean; reason?: string } {
  // Check if grade is finalized
  if (grade.status === GradeStatus.FINALIZED) {
    return {
      canModify: false,
      reason: 'Grade is finalized and requires administrator approval to modify.',
    };
  }

  // Check finalization deadline
  if (finalizationDeadline && grade.finalizedAt) {
    const finalizedDate = new Date(grade.finalizedAt);
    if (finalizedDate < finalizationDeadline) {
      return {
        canModify: false,
        reason: 'Grade modification deadline has passed. Administrator approval required.',
      };
    }
  }

  return { canModify: true };
}

/**
 * Filter grades that should be included in GPA calculation
 */
export function filterGradesForGPA(grades: Grade[]): Grade[] {
  return grades.filter(grade => {
    // Exclude incomplete grades
    if (grade.specialGrade === SpecialGrade.INCOMPLETE) {
      return false;
    }

    // Exclude withdrawn courses
    if (grade.specialGrade === SpecialGrade.WITHDRAWN) {
      return false;
    }

    // Exclude audit courses
    if (grade.specialGrade === SpecialGrade.AUDIT) {
      return false;
    }

    // Exclude pass/fail courses (they don't contribute to GPA)
    if (grade.specialGrade === SpecialGrade.PASS) {
      return false;
    }

    // Include failing grades (they do count toward GPA)
    return true;
  });
}

/**
 * Filter grades for a specific semester
 */
export function filterGradesBySemester(
  grades: Grade[],
  academicYear: string,
  semester: string
): Grade[] {
  return grades.filter(
    g => g.academicYear === academicYear && g.semester === semester
  );
}

/**
 * Filter grades for a specific student
 */
export function filterGradesByStudent(
  grades: Grade[],
  studentId: string
): Grade[] {
  return grades.filter(g => g.studentId === studentId);
}

/**
 * Filter grades for a specific course
 */
export function filterGradesByCourse(
  grades: Grade[],
  courseCode: string
): Grade[] {
  return grades.filter(g => g.courseCode === courseCode);
}

/**
 * Check if student has any incomplete grades
 */
export function hasIncompleteGrades(grades: Grade[]): boolean {
  return grades.some(g => g.specialGrade === SpecialGrade.INCOMPLETE);
}

/**
 * Check if student has completed minimum credits
 */
export function hasMinimumCredits(
  grades: Grade[],
  minimumCredits: number
): boolean {
  const totalCredits = grades.reduce((sum, g) => sum + g.credits, 0);
  return totalCredits >= minimumCredits;
}

/**
 * Validate grade before saving
 */
export function validateGrade(
  grade: Partial<Grade>,
  scale: GradingScale
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!grade.studentId) {
    errors.push('Student ID is required.');
  }

  if (!grade.courseCode) {
    errors.push('Course code is required.');
  }

  if (!grade.credits || grade.credits <= 0) {
    errors.push('Credits must be greater than 0.');
  }

  // Validate numeric grade
  if (grade.numericGrade !== undefined) {
    const numericValidation = validateNumericGrade(grade.numericGrade);
    if (!numericValidation.isValid) {
      errors.push(numericValidation.error!);
    }
  }

  // Validate letter grade
  if (grade.letterGrade) {
    const letterValidation = validateLetterGrade(grade.letterGrade, scale);
    if (!letterValidation.isValid) {
      errors.push(letterValidation.error!);
    }
  }

  // Validate components if present
  if (grade.components && grade.components.length > 0) {
    for (const component of grade.components) {
      if (component.score < 0) {
        errors.push(`Component ${component.componentType} has negative score.`);
      }
      if (component.score > component.maxScore) {
        errors.push(
          `Component ${component.componentType} score exceeds maximum (${component.maxScore}).`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if grade is passing
 */
export function isPassingGrade(grade: Grade, scale: GradingScale): boolean {
  if (grade.specialGrade === SpecialGrade.FAIL) {
    return false;
  }

  if (grade.specialGrade === SpecialGrade.PASS) {
    return true;
  }

  const boundary = scale.boundaries.find(b => b.grade === grade.letterGrade);
  return boundary?.isPassing ?? false;
}

/**
 * Get grades that need review
 */
export function getGradesNeedingReview(grades: Grade[]): Grade[] {
  return grades.filter(
    g =>
      g.status === GradeStatus.PENDING_REVIEW ||
      g.status === GradeStatus.FLAGGED ||
      g.status === GradeStatus.PROVISIONAL
  );
}

/**
 * Get finalized grades
 */
export function getFinalizedGrades(grades: Grade[]): Grade[] {
  return grades.filter(g => g.status === GradeStatus.FINALIZED);
}

/**
 * Validate GPA value
 */
export function validateGPA(gpa: number): { isValid: boolean; error?: string } {
  if (gpa < GPA_RANGE.MIN || gpa > GPA_RANGE.MAX) {
    return {
      isValid: false,
      error: `GPA ${gpa} is out of range. Must be between ${GPA_RANGE.MIN} and ${GPA_RANGE.MAX}.`,
    };
  }

  return { isValid: true };
}

/**
 * Check if semester has any completed courses
 */
export function hasCompletedCourses(grades: Grade[]): boolean {
  return grades.some(
    g =>
      g.status === GradeStatus.FINALIZED ||
      g.status === GradeStatus.VERIFIED
  );
}

/**
 * Validate academic year format
 */
export function validateAcademicYear(year: string): { isValid: boolean; error?: string } {
  // Expected format: "2024" or "2024-2025"
  const singleYearPattern = /^\d{4}$/;
  const rangePattern = /^\d{4}-\d{4}$/;

  if (!singleYearPattern.test(year) && !rangePattern.test(year)) {
    return {
      isValid: false,
      error: `Invalid academic year format: ${year}. Expected format: "2024" or "2024-2025".`,
    };
  }

  return { isValid: true };
}

/**
 * Validate semester name
 */
export function validateSemester(semester: string): { isValid: boolean; error?: string } {
  const validSemesters = ['Fall', 'Spring', 'Summer'];

  if (!validSemesters.includes(semester)) {
    return {
      isValid: false,
      error: `Invalid semester: ${semester}. Must be one of: ${validSemesters.join(', ')}.`,
    };
  }

  return { isValid: true };
}









