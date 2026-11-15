/**
 * BMI UMS - GradingScale Domain Model
 * Implements grading scale configurations for US 4.0, ECTS, Percentage, and Custom scales
 */

import {
  GradingScale,
  GradingScaleType,
  GradeBoundary,
  LetterGrade,
  ECTSGrade,
  US_GRADE_POINTS,
  US_GRADE_BOUNDARIES,
  ECTS_GRADE_POINTS,
} from '../types';

/**
 * Create a US 4.0 grading scale
 */
export function createUS40Scale(): GradingScale {
  const boundaries: GradeBoundary[] = Object.entries(US_GRADE_BOUNDARIES).map(
    ([grade, range]) => ({
      grade,
      minScore: range.min,
      maxScore: range.max,
      gradePoints: US_GRADE_POINTS[grade as LetterGrade],
      isPassing: grade !== LetterGrade.F,
    })
  );

  return {
    id: 'us-4-0-standard',
    type: GradingScaleType.US_4_0,
    name: 'US 4.0 Scale',
    description: 'Standard US grading scale with letter grades (A+ to F) and 4.0 grade points',
    boundaries,
    gradePointMap: US_GRADE_POINTS as Record<string, number>,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create an ECTS grading scale
 */
export function createECTSScale(): GradingScale {
  const boundaries: GradeBoundary[] = [
    { grade: ECTSGrade.A, minScore: 90, maxScore: 100, gradePoints: 4.0, isPassing: true },
    { grade: ECTSGrade.B, minScore: 80, maxScore: 89.99, gradePoints: 3.0, isPassing: true },
    { grade: ECTSGrade.C, minScore: 70, maxScore: 79.99, gradePoints: 2.0, isPassing: true },
    { grade: ECTSGrade.D, minScore: 60, maxScore: 69.99, gradePoints: 1.0, isPassing: true },
    { grade: ECTSGrade.E, minScore: 50, maxScore: 59.99, gradePoints: 0.5, isPassing: true },
    { grade: ECTSGrade.F, minScore: 0, maxScore: 49.99, gradePoints: 0.0, isPassing: false },
  ];

  return {
    id: 'ects-standard',
    type: GradingScaleType.ECTS,
    name: 'ECTS Scale',
    description: 'European Credit Transfer and Accumulation System grading scale (A-F)',
    boundaries,
    gradePointMap: ECTS_GRADE_POINTS as Record<string, number>,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a percentage-based grading scale
 */
export function createPercentageScale(): GradingScale {
  const boundaries: GradeBoundary[] = [
    { grade: 'A', minScore: 90, maxScore: 100, gradePoints: 4.0, isPassing: true },
    { grade: 'B', minScore: 80, maxScore: 89.99, gradePoints: 3.0, isPassing: true },
    { grade: 'C', minScore: 70, maxScore: 79.99, gradePoints: 2.0, isPassing: true },
    { grade: 'D', minScore: 60, maxScore: 69.99, gradePoints: 1.0, isPassing: true },
    { grade: 'F', minScore: 0, maxScore: 59.99, gradePoints: 0.0, isPassing: false },
  ];

  return {
    id: 'percentage-standard',
    type: GradingScaleType.PERCENTAGE,
    name: 'Percentage Scale',
    description: 'Simple percentage-based grading scale (0-100)',
    boundaries,
    gradePointMap: {
      'A': 4.0,
      'B': 3.0,
      'C': 2.0,
      'D': 1.0,
      'F': 0.0,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a custom grading scale
 */
export function createCustomScale(
  id: string,
  name: string,
  description: string,
  boundaries: GradeBoundary[]
): GradingScale {
  // Validate boundaries
  validateGradeBoundaries(boundaries);

  // Build grade point map from boundaries
  const gradePointMap: Record<string, number> = {};
  boundaries.forEach(boundary => {
    gradePointMap[boundary.grade] = boundary.gradePoints;
  });

  return {
    id,
    type: GradingScaleType.CUSTOM,
    name,
    description,
    boundaries,
    gradePointMap,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate grade boundaries
 */
function validateGradeBoundaries(boundaries: GradeBoundary[]): void {
  if (boundaries.length === 0) {
    throw new Error('Grade boundaries cannot be empty');
  }

  // Check for overlapping ranges
  const sortedBoundaries = [...boundaries].sort((a, b) => a.minScore - b.minScore);
  
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const current = sortedBoundaries[i];
    const next = sortedBoundaries[i + 1];
    
    if (current.maxScore >= next.minScore) {
      throw new Error(
        `Overlapping grade boundaries: ${current.grade} (${current.minScore}-${current.maxScore}) ` +
        `and ${next.grade} (${next.minScore}-${next.maxScore})`
      );
    }
  }

  // Check for valid score ranges
  boundaries.forEach(boundary => {
    if (boundary.minScore < 0 || boundary.maxScore > 100) {
      throw new Error(
        `Invalid score range for grade ${boundary.grade}: ${boundary.minScore}-${boundary.maxScore}. ` +
        'Scores must be between 0 and 100.'
      );
    }
    
    if (boundary.minScore > boundary.maxScore) {
      throw new Error(
        `Invalid score range for grade ${boundary.grade}: minScore (${boundary.minScore}) ` +
        `cannot be greater than maxScore (${boundary.maxScore})`
      );
    }
  });
}

/**
 * Convert a numeric score to a letter grade using a grading scale
 */
export function scoreToLetterGrade(score: number, scale: GradingScale): string {
  if (score < 0 || score > 100) {
    throw new Error(`Invalid score: ${score}. Score must be between 0 and 100.`);
  }

  const boundary = scale.boundaries.find(
    b => score >= b.minScore && score <= b.maxScore
  );

  if (!boundary) {
    throw new Error(
      `No grade boundary found for score ${score} in scale ${scale.name}`
    );
  }

  return boundary.grade;
}

/**
 * Convert a letter grade to grade points using a grading scale
 */
export function letterGradeToPoints(letterGrade: string, scale: GradingScale): number {
  const gradePoints = scale.gradePointMap[letterGrade];

  if (gradePoints === undefined) {
    throw new Error(
      `Invalid letter grade: ${letterGrade} for scale ${scale.name}`
    );
  }

  return gradePoints;
}

/**
 * Convert a numeric score directly to grade points using a grading scale
 */
export function scoreToGradePoints(score: number, scale: GradingScale): number {
  const letterGrade = scoreToLetterGrade(score, scale);
  return letterGradeToPoints(letterGrade, scale);
}

/**
 * Check if a grade is passing
 */
export function isPassingGrade(letterGrade: string, scale: GradingScale): boolean {
  const boundary = scale.boundaries.find(b => b.grade === letterGrade);
  return boundary?.isPassing ?? false;
}

/**
 * Get all available grading scales
 */
export function getAllGradingScales(): GradingScale[] {
  return [
    createUS40Scale(),
    createECTSScale(),
    createPercentageScale(),
  ];
}

/**
 * Get a grading scale by ID
 */
export function getGradingScaleById(id: string): GradingScale | null {
  const scales = getAllGradingScales();
  return scales.find(scale => scale.id === id) || null;
}

/**
 * Get a grading scale by type
 */
export function getGradingScaleByType(type: GradingScaleType): GradingScale | null {
  const scales = getAllGradingScales();
  return scales.find(scale => scale.type === type) || null;
}









