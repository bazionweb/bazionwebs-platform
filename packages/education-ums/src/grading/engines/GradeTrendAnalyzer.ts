/**
 * BMI UMS - Grade Trend Analyzer
 * Analyzes GPA trends over multiple semesters
 */

import {
  GradeTrendPoint,
  GradeTrendAnalysis,
  SemesterGPA,
  AcademicStanding,
} from '../types';
import { SIGNIFICANT_GPA_CHANGE } from '../utils/constants';

/**
 * Create trend analysis for a student
 */
export function analyzeGradeTrend(
  semesterGPAs: SemesterGPA[],
  academicStandings: Map<string, AcademicStanding>
): GradeTrendAnalysis {
  if (semesterGPAs.length === 0) {
    return {
      studentId: '',
      trendPoints: [],
      trendDirection: 'stable',
      significantChanges: [],
    };
  }

  // Sort by academic year and semester
  const sorted = [...semesterGPAs].sort((a, b) => {
    if (a.academicYear !== b.academicYear) {
      return a.academicYear.localeCompare(b.academicYear);
    }
    return getSemesterOrder(a.semester) - getSemesterOrder(b.semester);
  });

  // Create trend points
  const trendPoints: GradeTrendPoint[] = sorted.map(sgpa => {
    const semesterKey = `${sgpa.academicYear}-${sgpa.semester}`;
    const standing = academicStandings.get(semesterKey) || AcademicStanding.GOOD_STANDING;

    return {
      academicYear: sgpa.academicYear,
      semester: sgpa.semester,
      semesterGPA: sgpa.gpa,
      cumulativeGPA: 0, // Will be calculated separately
      academicStanding: standing,
      creditsEarned: sgpa.totalCredits,
    };
  });

  // Determine trend direction
  const trendDirection = determineTrendDirection(sorted);

  // Identify significant changes
  const significantChanges = identifySignificantChanges(sorted);

  return {
    studentId: sorted[0].studentId,
    trendPoints,
    trendDirection,
    significantChanges,
  };
}

/**
 * Determine overall trend direction
 */
function determineTrendDirection(
  semesterGPAs: SemesterGPA[]
): 'improving' | 'declining' | 'stable' {
  if (semesterGPAs.length < 2) {
    return 'stable';
  }

  // Calculate linear regression slope
  const n = semesterGPAs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  semesterGPAs.forEach((sgpa, index) => {
    const x = index;
    const y = sgpa.gpa;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Determine direction based on slope
  if (Math.abs(slope) < 0.05) {
    return 'stable';
  } else if (slope > 0) {
    return 'improving';
  } else {
    return 'declining';
  }
}

/**
 * Identify significant GPA changes (> 0.5 points)
 */
function identifySignificantChanges(
  semesterGPAs: SemesterGPA[]
): Array<{
  fromSemester: string;
  toSemester: string;
  gpaChange: number;
}> {
  const changes: Array<{
    fromSemester: string;
    toSemester: string;
    gpaChange: number;
  }> = [];

  for (let i = 1; i < semesterGPAs.length; i++) {
    const prev = semesterGPAs[i - 1];
    const curr = semesterGPAs[i];
    const change = curr.gpa - prev.gpa;

    if (Math.abs(change) >= SIGNIFICANT_GPA_CHANGE) {
      changes.push({
        fromSemester: `${prev.academicYear} ${prev.semester}`,
        toSemester: `${curr.academicYear} ${curr.semester}`,
        gpaChange: Math.round(change * 100) / 100,
      });
    }
  }

  return changes;
}

/**
 * Get semester order for sorting
 */
function getSemesterOrder(semester: string): number {
  const order: Record<string, number> = {
    'Spring': 1,
    'Summer': 2,
    'Fall': 3,
  };
  return order[semester] || 0;
}

/**
 * Calculate moving average GPA
 */
export function calculateMovingAverage(
  semesterGPAs: SemesterGPA[],
  windowSize: number = 3
): number[] {
  if (semesterGPAs.length < windowSize) {
    return semesterGPAs.map(s => s.gpa);
  }

  const movingAverages: number[] = [];

  for (let i = 0; i <= semesterGPAs.length - windowSize; i++) {
    const window = semesterGPAs.slice(i, i + windowSize);
    const avg = window.reduce((sum, s) => sum + s.gpa, 0) / windowSize;
    movingAverages.push(Math.round(avg * 100) / 100);
  }

  return movingAverages;
}

/**
 * Predict next semester GPA based on trend
 */
export function predictNextSemesterGPA(
  semesterGPAs: SemesterGPA[]
): number {
  if (semesterGPAs.length < 2) {
    return semesterGPAs[0]?.gpa || 0;
  }

  // Use simple linear regression
  const n = semesterGPAs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  semesterGPAs.forEach((sgpa, index) => {
    const x = index;
    const y = sgpa.gpa;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Predict for next semester (index = n)
  const prediction = slope * n + intercept;

  // Clamp to valid GPA range
  return Math.max(0, Math.min(4.0, Math.round(prediction * 100) / 100));
}









