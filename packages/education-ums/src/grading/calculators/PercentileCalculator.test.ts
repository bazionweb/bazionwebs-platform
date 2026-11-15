/**
 * BMI UMS - PercentileCalculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePercentile,
  calculateAllPercentiles,
  calculatePercentilesWithTies,
} from './PercentileCalculator';
import { GradingScaleType, GradeStatus, SpecialGrade, type Grade } from '../types';

// ---------------------------------------------------------------------------
// Grade object factory
// ---------------------------------------------------------------------------
function makeGrade(overrides: Partial<Grade> = {}): Grade {
  return {
    id: 'g1',
    studentId: 's1',
    studentName: 'Test Student',
    admissionNo: 'ADM-001',
    courseId: 'c1',
    courseCode: 'THE101',
    courseName: 'Introduction to Theology',
    credits: 3,
    gradingScaleId: 'us-4-0-standard',
    gradingScaleType: GradingScaleType.US_4_0,
    components: [],
    numericGrade: 85,
    letterGrade: 'B',
    gradePoints: 3.0,
    isRetake: false,
    academicYear: '2024-2025',
    semester: 'Fall',
    status: GradeStatus.FINALIZED,
    createdAt: '2024-09-01T00:00:00.000Z',
    updatedAt: '2024-09-01T00:00:00.000Z',
    createdBy: 'admin',
    lastModifiedBy: 'admin',
    ...overrides,
  };
}

// Suppress unused-import warning — SpecialGrade is included per the shared
// factory template specification; it is used in AcademicStandingEngine tests.
void SpecialGrade;

// ---------------------------------------------------------------------------
// calculatePercentile
// ---------------------------------------------------------------------------
describe('calculatePercentile', () => {
  const grades = [60, 70, 80, 90, 95];

  it('top score (95) in [60,70,80,90,95] → 80th percentile (4 below / 5 total × 100)', () => {
    expect(calculatePercentile(95, grades)).toBe(80);
  });

  it('bottom score (60) in [60,70,80,90,95] → 0th percentile (0 below)', () => {
    expect(calculatePercentile(60, grades)).toBe(0);
  });

  it('middle score (80) in [60,70,80,90,95] → 40th percentile (2 below / 5 total × 100)', () => {
    expect(calculatePercentile(80, grades)).toBe(40);
  });

  it('returns 0 when allGrades array is empty', () => {
    expect(calculatePercentile(85, [])).toBe(0);
  });

  it('returns 0th percentile when all grades in the array are equal (no one below)', () => {
    expect(calculatePercentile(75, [75, 75, 75])).toBe(0);
  });

  it('rounds the result to exactly 2 decimal places', () => {
    // Grade 40 in [10,20,30,40,50,60,70]:
    //   belowCount = 3, total = 7
    //   raw = (3/7) × 100 = 42.857142…  →  rounds to 42.86
    expect(calculatePercentile(40, [10, 20, 30, 40, 50, 60, 70])).toBe(42.86);
  });
});

// ---------------------------------------------------------------------------
// calculateAllPercentiles
// ---------------------------------------------------------------------------
describe('calculateAllPercentiles', () => {
  it('returns a Map with exactly one entry per Grade, keyed by studentId', () => {
    const gradeObjects = [
      makeGrade({ studentId: 's1', numericGrade: 90 }),
      makeGrade({ studentId: 's2', numericGrade: 75 }),
      makeGrade({ studentId: 's3', numericGrade: 60 }),
    ];

    const result = calculateAllPercentiles(gradeObjects);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.has('s1')).toBe(true);
    expect(result.has('s2')).toBe(true);
    expect(result.has('s3')).toBe(true);
  });

  it('all returned percentile values are within [0, 100]', () => {
    const gradeObjects = [
      makeGrade({ studentId: 's1', numericGrade: 55 }),
      makeGrade({ studentId: 's2', numericGrade: 78 }),
      makeGrade({ studentId: 's3', numericGrade: 92 }),
    ];

    const result = calculateAllPercentiles(gradeObjects);

    for (const value of result.values()) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// calculatePercentilesWithTies
// ---------------------------------------------------------------------------
describe('calculatePercentilesWithTies', () => {
  it('two students with identical numericGrade receive the same percentile', () => {
    const gradeObjects = [
      makeGrade({ studentId: 's1', numericGrade: 80 }),
      makeGrade({ studentId: 's2', numericGrade: 80 }),
      makeGrade({ studentId: 's3', numericGrade: 60 }),
    ];

    const result = calculatePercentilesWithTies(gradeObjects);

    expect(result.get('s1')).toBe(result.get('s2'));
  });

  it('a higher-grade student receives a strictly higher percentile than a lower-grade student', () => {
    const gradeObjects = [
      makeGrade({ studentId: 's1', numericGrade: 90 }),
      makeGrade({ studentId: 's2', numericGrade: 70 }),
      makeGrade({ studentId: 's3', numericGrade: 50 }),
    ];

    const result = calculatePercentilesWithTies(gradeObjects);

    expect(result.get('s1')!).toBeGreaterThan(result.get('s2')!);
  });
});









