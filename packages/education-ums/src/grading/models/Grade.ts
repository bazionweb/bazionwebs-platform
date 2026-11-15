/**
 * BMI UMS - Grade Domain Model
 * Core grade entity and operations
 */

import {
  Grade,
  GradeStatus,
  SpecialGrade,
  ComponentScore,
  AssessmentComponent,
} from '../types';
import { calculateWeightedGrade } from '../calculators/WeightedGradeCalculator';
import { scoreToLetterGrade, letterGradeToPoints } from './GradingScale';
import type { GradingScale } from '../types';

/**
 * Create a new grade record
 */
export function createGrade(
  studentId: string,
  studentName: string,
  admissionNo: string,
  courseId: string,
  courseCode: string,
  courseName: string,
  credits: number,
  gradingScaleId: string,
  gradingScale: GradingScale,
  components: ComponentScore[],
  academicYear: string,
  semester: string,
  createdBy: string
): Grade {
  // Calculate final grade from components
  const assessmentComponents: AssessmentComponent[] = components.map(cs => ({
    id: cs.componentId,
    type: cs.componentType,
    name: cs.componentType,
    weight: cs.weight,
    maxScore: cs.maxScore,
  }));

  const gradeResult = calculateWeightedGrade(assessmentComponents, components);

  // Convert numeric grade to letter grade
  const letterGrade = scoreToLetterGrade(gradeResult.finalGrade, gradingScale);
  const gradePoints = letterGradeToPoints(letterGrade, gradingScale);

  const now = new Date().toISOString();

  return {
    id: generateGradeId(),
    studentId,
    studentName,
    admissionNo,
    courseId,
    courseCode,
    courseName,
    credits,
    gradingScaleId,
    gradingScaleType: gradingScale.type,
    components,
    numericGrade: gradeResult.finalGrade,
    letterGrade,
    gradePoints,
    isRetake: false,
    academicYear,
    semester,
    status: gradeResult.status,
    createdAt: now,
    updatedAt: now,
    createdBy,
    lastModifiedBy: createdBy,
  };
}

/**
 * Generate unique grade ID
 */
function generateGradeId(): string {
  return `grade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Update grade with new component scores
 */
export function updateGradeComponents(
  grade: Grade,
  components: ComponentScore[],
  gradingScale: GradingScale,
  modifiedBy: string
): Grade {
  const assessmentComponents: AssessmentComponent[] = components.map(cs => ({
    id: cs.componentId,
    type: cs.componentType,
    name: cs.componentType,
    weight: cs.weight,
    maxScore: cs.maxScore,
  }));

  const gradeResult = calculateWeightedGrade(assessmentComponents, components);
  const letterGrade = scoreToLetterGrade(gradeResult.finalGrade, gradingScale);
  const gradePoints = letterGradeToPoints(letterGrade, gradingScale);

  return {
    ...grade,
    components,
    numericGrade: gradeResult.finalGrade,
    letterGrade,
    gradePoints,
    status: gradeResult.status,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: modifiedBy,
  };
}

/**
 * Finalize a grade
 */
export function finalizeGrade(grade: Grade, finalizedBy: string): Grade {
  return {
    ...grade,
    status: GradeStatus.FINALIZED,
    finalizedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastModifiedBy: finalizedBy,
  };
}

/**
 * Mark grade as incomplete
 */
export function markAsIncomplete(
  grade: Grade,
  deadline: string,
  modifiedBy: string
): Grade {
  return {
    ...grade,
    specialGrade: SpecialGrade.INCOMPLETE,
    incompleteDeadline: deadline,
    status: GradeStatus.INCOMPLETE,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: modifiedBy,
  };
}

/**
 * Convert incomplete to final grade
 */
export function convertIncompleteToFinal(
  grade: Grade,
  finalGrade: number,
  gradingScale: GradingScale,
  modifiedBy: string
): Grade {
  const letterGrade = scoreToLetterGrade(finalGrade, gradingScale);
  const gradePoints = letterGradeToPoints(letterGrade, gradingScale);

  return {
    ...grade,
    specialGrade: undefined,
    incompleteDeadline: undefined,
    numericGrade: finalGrade,
    letterGrade,
    gradePoints,
    status: GradeStatus.VERIFIED,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: modifiedBy,
  };
}

/**
 * Auto-convert incomplete to F after deadline
 */
export function autoConvertIncompleteToF(
  grade: Grade,
//   gradingScale: GradingScale
): Grade {
  return {
    ...grade,
    specialGrade: SpecialGrade.FAIL,
    numericGrade: 0,
    letterGrade: 'F',
    gradePoints: 0,
    status: GradeStatus.FINALIZED,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: 'system',
  };
}

/**
 * Mark grade as pass/fail
 */
export function markAsPassFail(
  grade: Grade,
  passed: boolean,
  modifiedBy: string
): Grade {
  return {
    ...grade,
    specialGrade: passed ? SpecialGrade.PASS : SpecialGrade.FAIL,
    status: GradeStatus.FINALIZED,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: modifiedBy,
  };
}

/**
 * Check if grade is editable
 */
export function isGradeEditable(grade: Grade): boolean {
  return grade.status !== GradeStatus.FINALIZED;
}

/**
 * Check if grade is complete
 */
export function isGradeComplete(grade: Grade): boolean {
  return grade.status === GradeStatus.FINALIZED || grade.status === GradeStatus.VERIFIED;
}









