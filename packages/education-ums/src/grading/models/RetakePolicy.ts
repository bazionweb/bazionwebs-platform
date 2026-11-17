/**
 * BMI UMS - Retake Policy Domain Model
 * Handles retaken course logic and GPA calculations
 */

import {
  Grade,
  RetakePolicy,
  RetakePolicyConfig,
} from '../types';
import { DEFAULT_RETAKE_POLICY, MAX_RETAKE_ATTEMPTS } from '../utils/constants';

/**
 * Create default retake policy configuration
 */
export function createDefaultRetakePolicyConfig(): RetakePolicyConfig {
  return {
    policy: DEFAULT_RETAKE_POLICY as RetakePolicy,
    maxRetakeAttempts: MAX_RETAKE_ATTEMPTS,
    showAllAttemptsOnTranscript: true,
    allowGPARecalculation: true,
  };
}

/**
 * Create custom retake policy configuration
 */
export function createRetakePolicyConfig(
  policy: RetakePolicy,
  maxAttempts: number = MAX_RETAKE_ATTEMPTS,
  showAllAttempts: boolean = true,
  allowRecalculation: boolean = true
): RetakePolicyConfig {
  return {
    policy,
    maxRetakeAttempts: maxAttempts,
    showAllAttemptsOnTranscript: showAllAttempts,
    allowGPARecalculation: allowRecalculation,
  };
}

/**
 * Detect if a grade is a retake
 */
export function isRetake(
  grade: Grade,
  previousGrades: Grade[]
): boolean {
  return previousGrades.some(
    pg =>
      pg.studentId === grade.studentId &&
      pg.courseCode === grade.courseCode &&
      pg.id !== grade.id &&
      new Date(pg.createdAt) < new Date(grade.createdAt)
  );
}

/**
 * Get all attempts for a course
 */
export function getCourseAttempts(
  studentId: string,
  courseCode: string,
  allGrades: Grade[]
): Grade[] {
  return allGrades
    .filter(g => g.studentId === studentId && g.courseCode === courseCode)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Get retake attempt number
 */
export function getRetakeAttemptNumber(
  grade: Grade,
  allGrades: Grade[]
): number {
  const attempts = getCourseAttempts(grade.studentId, grade.courseCode, allGrades);
  const index = attempts.findIndex(g => g.id === grade.id);
  return index + 1;
}

/**
 * Apply retake policy to select which grade to use for GPA
 */
export function applyRetakePolicy(
  grades: Grade[],
  policy: RetakePolicy = RetakePolicy.REPLACE_WITH_HIGHEST
): Grade[] {
  // Group grades by student and course
  const courseMap = new Map<string, Grade[]>();

  for (const grade of grades) {
    const key = `${grade.studentId}-${grade.courseCode}`;
    if (!courseMap.has(key)) {
      courseMap.set(key, []);
    }
    courseMap.get(key)!.push(grade);
  }

  const result: Grade[] = [];

  // Apply policy for each course
  for (const [, courseGrades] of courseMap) {
    if (courseGrades.length === 1) {
      // No retakes, include the grade
      result.push(courseGrades[0]);
    } else {
      // Apply retake policy
      const selectedGrade = selectGradeByPolicy(courseGrades, policy);
      result.push(selectedGrade);
    }
  }

  return result;
}

/**
 * Select grade based on retake policy
 */
function selectGradeByPolicy(
  courseGrades: Grade[],
  policy: RetakePolicy
): Grade {
  switch (policy) {
    case RetakePolicy.REPLACE_WITH_HIGHEST:
      return getHighestGrade(courseGrades);

    case RetakePolicy.REPLACE_WITH_LATEST:
      return getLatestGrade(courseGrades);

    case RetakePolicy.AVERAGE_ALL_ATTEMPTS:
      return getAverageGrade(courseGrades);

    default:
      return getHighestGrade(courseGrades);
  }
}

/**
 * Get the highest grade from attempts
 */
function getHighestGrade(grades: Grade[]): Grade {
  return grades.reduce((highest, current) =>
    current.gradePoints > highest.gradePoints ? current : highest
  );
}

/**
 * Get the latest grade from attempts
 */
function getLatestGrade(grades: Grade[]): Grade {
  return grades.reduce((latest, current) =>
    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
  );
}

/**
 * Get average grade from all attempts
 * Creates a synthetic grade record with averaged values
 */
function getAverageGrade(grades: Grade[]): Grade {
  const avgNumericGrade =
    grades.reduce((sum, g) => sum + g.numericGrade, 0) / grades.length;
  const avgGradePoints =
    grades.reduce((sum, g) => sum + g.gradePoints, 0) / grades.length;

  // Use the latest grade as the base and update with averages
  const latestGrade = getLatestGrade(grades);

  return {
    ...latestGrade,
    numericGrade: Math.round(avgNumericGrade * 100) / 100,
    gradePoints: Math.round(avgGradePoints * 100) / 100,
    isRetake: true,
    retakeAttemptNumber: grades.length,
  };
}

/**
 * Mark grade as retake
 */
export function markAsRetake(
  grade: Grade,
  attemptNumber: number,
  replacedGradeId?: string
): Grade {
  return {
    ...grade,
    isRetake: true,
    retakeAttemptNumber: attemptNumber,
    replacedGradeId,
  };
}

/**
 * Check if student can retake a course
 */
export function canRetakeCourse(
  studentId: string,
  courseCode: string,
  allGrades: Grade[],
  config: RetakePolicyConfig
): { canRetake: boolean; reason?: string; attemptsUsed: number } {
  const attempts = getCourseAttempts(studentId, courseCode, allGrades);
  const attemptsUsed = attempts.length;

  if (attemptsUsed >= config.maxRetakeAttempts) {
    return {
      canRetake: false,
      reason: `Maximum retake attempts (${config.maxRetakeAttempts}) reached for this course.`,
      attemptsUsed,
    };
  }

  return {
    canRetake: true,
    attemptsUsed,
  };
}

/**
 * Get retake statistics for a student
 */
export function getRetakeStatistics(
  studentId: string,
  allGrades: Grade[]
): {
  totalRetakes: number;
  coursesRetaken: string[];
  averageImprovement: number;
} {
  const studentGrades = allGrades.filter(g => g.studentId === studentId);
  const retakenCourses = new Set<string>();
  let totalImprovement = 0;
  let improvementCount = 0;

  // Group by course
  const courseMap = new Map<string, Grade[]>();
  for (const grade of studentGrades) {
    if (!courseMap.has(grade.courseCode)) {
      courseMap.set(grade.courseCode, []);
    }
    courseMap.get(grade.courseCode)!.push(grade);
  }

  // Calculate improvements
  for (const [courseCode, courseGrades] of courseMap) {
    if (courseGrades.length > 1) {
      retakenCourses.add(courseCode);
      
      // Sort by date
      const sorted = courseGrades.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Calculate improvement from first to last attempt
      const firstGrade = sorted[0].gradePoints;
      const lastGrade = sorted[sorted.length - 1].gradePoints;
      const improvement = lastGrade - firstGrade;

      totalImprovement += improvement;
      improvementCount++;
    }
  }

  return {
    totalRetakes: retakenCourses.size,
    coursesRetaken: Array.from(retakenCourses),
    averageImprovement:
      improvementCount > 0
        ? Math.round((totalImprovement / improvementCount) * 100) / 100
        : 0,
  };
}

/**
 * Get all grades for transcript (including retakes if configured)
 */
export function getTranscriptGrades(
  grades: Grade[],
  config: RetakePolicyConfig
): Grade[] {
  if (config.showAllAttemptsOnTranscript) {
    // Show all attempts, mark which one counts for GPA
    applyRetakePolicy(grades, config.policy);

    return grades.map(g => ({
      ...g,
      // Add a flag to indicate if this grade counts toward GPA
      // (This would be added to the Grade type if needed)
    }));
  } else {
    // Show only the grades that count toward GPA
    return applyRetakePolicy(grades, config.policy);
  }
}

/**
 * Validate retake policy configuration
 */
export function validateRetakePolicyConfig(
  config: RetakePolicyConfig
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxRetakeAttempts < 1) {
    errors.push('Maximum retake attempts must be at least 1.');
  }

  if (config.maxRetakeAttempts > 10) {
    errors.push('Maximum retake attempts cannot exceed 10.');
  }

  if (!Object.values(RetakePolicy).includes(config.policy)) {
    errors.push(`Invalid retake policy: ${config.policy}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}









