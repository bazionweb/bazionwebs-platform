/**
 * BMI UMS - Grade Conversion Utilities
 * Convert grades between different grading scales
 */

import {
  GradingScale,
  GradingScaleType,
  LetterGrade,
  ECTSGrade,
} from '../types';
import {
  scoreToLetterGrade,
  letterGradeToPoints,
  scoreToGradePoints,
} from '../models/GradingScale';

/**
 * Conversion table from US 4.0 to ECTS
 */
const US_TO_ECTS_CONVERSION: Record<LetterGrade, ECTSGrade> = {
  [LetterGrade.A_PLUS]: ECTSGrade.A,
  [LetterGrade.A]: ECTSGrade.A,
  [LetterGrade.A_MINUS]: ECTSGrade.B,
  [LetterGrade.B_PLUS]: ECTSGrade.B,
  [LetterGrade.B]: ECTSGrade.C,
  [LetterGrade.B_MINUS]: ECTSGrade.C,
  [LetterGrade.C_PLUS]: ECTSGrade.D,
  [LetterGrade.C]: ECTSGrade.D,
  [LetterGrade.C_MINUS]: ECTSGrade.E,
  [LetterGrade.D_PLUS]: ECTSGrade.E,
  [LetterGrade.D]: ECTSGrade.E,
  [LetterGrade.F]: ECTSGrade.F,
};

/**
 * Conversion table from ECTS to US 4.0
 */
const ECTS_TO_US_CONVERSION: Record<ECTSGrade, LetterGrade> = {
  [ECTSGrade.A]: LetterGrade.A,
  [ECTSGrade.B]: LetterGrade.B_PLUS,
  [ECTSGrade.C]: LetterGrade.B,
  [ECTSGrade.D]: LetterGrade.C_PLUS,
  [ECTSGrade.E]: LetterGrade.C_MINUS,
  [ECTSGrade.F]: LetterGrade.F,
};

/**
 * Convert a grade from one scale to another
 */
export function convertGrade(
  grade: string | number,
  fromScale: GradingScale,
  toScale: GradingScale
): string {
  // If scales are the same, return the grade as-is
  if (fromScale.id === toScale.id) {
    return typeof grade === 'number' ? scoreToLetterGrade(grade, fromScale) : grade;
  }

  // Convert numeric grade to letter grade in source scale
  let sourceLetterGrade: string;
  if (typeof grade === 'number') {
    sourceLetterGrade = scoreToLetterGrade(grade, fromScale);
  } else {
    sourceLetterGrade = grade;
  }

  // Handle specific scale conversions
  if (fromScale.type === GradingScaleType.US_4_0 && toScale.type === GradingScaleType.ECTS) {
    return convertUSToECTS(sourceLetterGrade as LetterGrade);
  }

  if (fromScale.type === GradingScaleType.ECTS && toScale.type === GradingScaleType.US_4_0) {
    return convertECTSToUS(sourceLetterGrade as ECTSGrade);
  }

  // For other conversions, use grade points as intermediary
  return convertViaGradePoints(sourceLetterGrade, fromScale, toScale);
}

/**
 * Convert US 4.0 letter grade to ECTS grade
 */
export function convertUSToECTS(usGrade: LetterGrade): ECTSGrade {
  const ectsGrade = US_TO_ECTS_CONVERSION[usGrade];
  if (!ectsGrade) {
    throw new Error(`Cannot convert US grade ${usGrade} to ECTS`);
  }
  return ectsGrade;
}

/**
 * Convert ECTS grade to US 4.0 letter grade
 */
export function convertECTSToUS(ectsGrade: ECTSGrade): LetterGrade {
  const usGrade = ECTS_TO_US_CONVERSION[ectsGrade];
  if (!usGrade) {
    throw new Error(`Cannot convert ECTS grade ${ectsGrade} to US`);
  }
  return usGrade;
}

/**
 * Convert grade between scales using grade points as intermediary
 */
function convertViaGradePoints(
  sourceGrade: string,
  fromScale: GradingScale,
  toScale: GradingScale
): string {
  // Get grade points from source grade
  const gradePoints = letterGradeToPoints(sourceGrade, fromScale);

  // Find the closest grade in target scale
  let closestGrade = toScale.boundaries[0].grade;
  let smallestDiff = Math.abs(toScale.boundaries[0].gradePoints - gradePoints);

  for (const boundary of toScale.boundaries) {
    const diff = Math.abs(boundary.gradePoints - gradePoints);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestGrade = boundary.grade;
    }
  }

  return closestGrade;
}

/**
 * Convert percentage score to grade in any scale
 */
export function percentageToGrade(
  percentage: number,
  targetScale: GradingScale
): string {
  if (percentage < 0 || percentage > 100) {
    throw new Error(`Invalid percentage: ${percentage}. Must be between 0 and 100.`);
  }

  return scoreToLetterGrade(percentage, targetScale);
}

/**
 * Convert grade to percentage (approximate)
 * Uses the midpoint of the grade's score range
 */
export function gradeToPercentage(
  grade: string,
  scale: GradingScale
): number {
  const boundary = scale.boundaries.find(b => b.grade === grade);
  
  if (!boundary) {
    throw new Error(`Grade ${grade} not found in scale ${scale.name}`);
  }

  // Return midpoint of the range
  return (boundary.minScore + boundary.maxScore) / 2;
}

/**
 * Convert grade to grade points
 */
export function gradeToGradePoints(
  grade: string | number,
  scale: GradingScale
): number {
  if (typeof grade === 'number') {
    return scoreToGradePoints(grade, scale);
  }
  return letterGradeToPoints(grade, scale);
}

/**
 * Batch convert grades from one scale to another
 */
export function batchConvertGrades(
  grades: Array<{ grade: string | number; studentId: string }>,
  fromScale: GradingScale,
  toScale: GradingScale
): Array<{ grade: string; studentId: string; originalGrade: string | number }> {
  return grades.map(({ grade, studentId }) => ({
    grade: convertGrade(grade, fromScale, toScale),
    studentId,
    originalGrade: grade,
  }));
}

/**
 * Get conversion table between two scales
 */
export function getConversionTable(
  fromScale: GradingScale,
  toScale: GradingScale
): Array<{ fromGrade: string; toGrade: string; gradePoints: number }> {
  return fromScale.boundaries.map(boundary => ({
    fromGrade: boundary.grade,
    toGrade: convertGrade(boundary.grade, fromScale, toScale),
    gradePoints: boundary.gradePoints,
  }));
}

/**
 * Validate if a grade exists in a scale
 */
export function isValidGradeForScale(grade: string, scale: GradingScale): boolean {
  return scale.boundaries.some(b => b.grade === grade);
}

/**
 * Round grade points to specified precision
 */
export function roundGradePoints(gradePoints: number, precision: number = 2): number {
  const multiplier = Math.pow(10, precision);
  return Math.round(gradePoints * multiplier) / multiplier;
}









