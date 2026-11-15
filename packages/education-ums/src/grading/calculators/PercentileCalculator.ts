/**
 * BMI UMS - Percentile Calculator
 * Calculates percentile rankings for students
 */

import { Grade } from '../types';

/**
 * Calculate percentile rank for a single grade
 * Formula: Percentile = (Number_of_Students_Below / Total_Students) × 100
 */
export function calculatePercentile(
  studentGrade: number,
  allGrades: number[]
): number {
  if (allGrades.length === 0) {
    return 0;
  }

  const belowCount = allGrades.filter(g => g < studentGrade).length;
  const percentile = (belowCount / allGrades.length) * 100;

  return Math.round(percentile * 100) / 100;
}

/**
 * Calculate percentile rankings for all students
 */
export function calculateAllPercentiles(
  grades: Grade[]
): Map<string, number> {
  const numericGrades = grades.map(g => g.numericGrade);
  const percentiles = new Map<string, number>();

  for (const grade of grades) {
    const percentile = calculatePercentile(grade.numericGrade, numericGrades);
    percentiles.set(grade.studentId, percentile);
  }

  return percentiles;
}

/**
 * Handle tied grades (assign same percentile)
 */
export function calculatePercentilesWithTies(
  grades: Grade[]
): Map<string, number> {
  // Group grades by numeric value
  const gradeGroups = new Map<number, Grade[]>();
  
  for (const grade of grades) {
    if (!gradeGroups.has(grade.numericGrade)) {
      gradeGroups.set(grade.numericGrade, []);
    }
    gradeGroups.get(grade.numericGrade)!.push(grade);
  }

  const percentiles = new Map<string, number>();
  const numericGrades = grades.map(g => g.numericGrade);

  // Calculate percentile for each group
  for (const [gradeValue, gradeGroup] of gradeGroups) {
    const percentile = calculatePercentile(gradeValue, numericGrades);
    
    // Assign same percentile to all students with this grade
    for (const grade of gradeGroup) {
      percentiles.set(grade.studentId, percentile);
    }
  }

  return percentiles;
}

/**
 * Update percentiles when grades change
 */
export function updatePercentiles(
  grades: Grade[],
//   updatedGradeId: string
): Map<string, number> {
  // Recalculate all percentiles
  return calculatePercentilesWithTies(grades);
}

/**
 * Get percentile rank category
 */
export function getPercentileCategory(percentile: number): string {
  if (percentile >= 90) return 'Top 10%';
  if (percentile >= 75) return 'Top 25%';
  if (percentile >= 50) return 'Top 50%';
  if (percentile >= 25) return 'Bottom 50%';
  return 'Bottom 25%';
}









