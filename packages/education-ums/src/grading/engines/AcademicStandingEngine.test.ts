/**
 * BMI UMS - AcademicStandingEngine Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  determineAcademicStanding,
  createAcademicStandingRecord,
  checkDeansListEligibility,
  generateDeansList,
} from './AcademicStandingEngine';
import {
  AcademicStanding,
  GradingScaleType,
  GradeStatus,
  SpecialGrade,
  type Grade,
} from '../types';

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

// ---------------------------------------------------------------------------
// determineAcademicStanding
// ---------------------------------------------------------------------------
describe('determineAcademicStanding', () => {
  it('cumulativeGPA 3.5 (honor-roll boundary, inclusive) → HONOR_ROLL', () => {
    expect(determineAcademicStanding(3.5, 3.5)).toBe(AcademicStanding.HONOR_ROLL);
  });

  it('cumulativeGPA 3.8 → HONOR_ROLL', () => {
    expect(determineAcademicStanding(3.8, 3.8)).toBe(AcademicStanding.HONOR_ROLL);
  });

  it('cumulativeGPA 3.49 (just below honor roll) → GOOD_STANDING', () => {
    expect(determineAcademicStanding(3.49, 3.49)).toBe(AcademicStanding.GOOD_STANDING);
  });

  it('cumulativeGPA 2.5, semesterGPA 2.5 → GOOD_STANDING', () => {
    expect(determineAcademicStanding(2.5, 2.5)).toBe(AcademicStanding.GOOD_STANDING);
  });

  it('cumulativeGPA 2.0, semesterGPA 1.8 (semester low, cumulative ok) → WARNING', () => {
    // semesterGPA < 2.0 AND cumulativeGPA >= 2.0 triggers the warning branch
    expect(determineAcademicStanding(2.0, 1.8)).toBe(AcademicStanding.WARNING);
  });

  it('cumulativeGPA 1.9 → ACADEMIC_PROBATION', () => {
    expect(determineAcademicStanding(1.9, 1.9)).toBe(AcademicStanding.ACADEMIC_PROBATION);
  });

  it('cumulativeGPA 0.0 → ACADEMIC_PROBATION', () => {
    expect(determineAcademicStanding(0.0, 0.0)).toBe(AcademicStanding.ACADEMIC_PROBATION);
  });

  it('custom honorRollMinGPA=3.8: cumulativeGPA 3.7 → GOOD_STANDING (not HONOR_ROLL)', () => {
    const customThresholds = {
      honorRollMinGPA: 3.8,
      goodStandingMinGPA: 2.0,
      probationThresholdGPA: 2.0,
      warningThresholdGPA: 2.0,
    };
    expect(determineAcademicStanding(3.7, 3.7, customThresholds)).toBe(
      AcademicStanding.GOOD_STANDING,
    );
  });
});

// ---------------------------------------------------------------------------
// createAcademicStandingRecord
// ---------------------------------------------------------------------------
describe('createAcademicStandingRecord', () => {
  it('returns a record whose standing field reflects the supplied GPA', () => {
    const record = createAcademicStandingRecord('s1', 3.5, 3.5, '2024-2025', 'Fall');
    expect(record.standing).toBe(AcademicStanding.HONOR_ROLL);
  });

  it('determinedAt is a valid ISO date string', () => {
    const record = createAcademicStandingRecord('s1', 3.0, 3.0, '2024-2025', 'Fall');
    expect(new Date(record.determinedAt).toString()).not.toBe('Invalid Date');
  });

  it('studentId in the returned record matches the provided studentId', () => {
    const record = createAcademicStandingRecord('student-123', 3.0, 3.0, '2024-2025', 'Fall');
    expect(record.studentId).toBe('student-123');
  });
});

// ---------------------------------------------------------------------------
// checkDeansListEligibility
// ---------------------------------------------------------------------------
describe('checkDeansListEligibility', () => {
  it('semesterGPA=3.7, credits=15, no incomplete grades → isEligible: true', () => {
    const result = checkDeansListEligibility(
      's1',
      'Alice',
      3.7,
      15,
      [],
      '2024-2025',
      'Fall',
    );
    expect(result.isEligible).toBe(true);
  });

  it('semesterGPA=3.2 (below 3.5 minimum) → isEligible: false', () => {
    const result = checkDeansListEligibility(
      's1',
      'Alice',
      3.2,
      15,
      [],
      '2024-2025',
      'Fall',
    );
    expect(result.isEligible).toBe(false);
  });

  it('semesterGPA=3.7 but credits=9 (below 12 minimum) → isEligible: false', () => {
    const result = checkDeansListEligibility(
      's1',
      'Alice',
      3.7,
      9,
      [],
      '2024-2025',
      'Fall',
    );
    expect(result.isEligible).toBe(false);
  });

  it(
    'semesterGPA=3.7, credits=15, one INCOMPLETE grade, excludeIncomplete=true' +
      ' → isEligible: false, hasIncompleteGrades: true',
    () => {
      const incompleteGrade = makeGrade({ specialGrade: SpecialGrade.INCOMPLETE });
      const result = checkDeansListEligibility(
        's1',
        'Alice',
        3.7,
        15,
        [incompleteGrade],
        '2024-2025',
        'Fall',
        { minGPA: 3.5, minCredits: 12, excludeIncomplete: true },
      );
      expect(result.isEligible).toBe(false);
      expect(result.hasIncompleteGrades).toBe(true);
    },
  );

  it(
    'semesterGPA=3.7, credits=15, one INCOMPLETE grade, excludeIncomplete=false' +
      ' → isEligible: true',
    () => {
      const incompleteGrade = makeGrade({ specialGrade: SpecialGrade.INCOMPLETE });
      const result = checkDeansListEligibility(
        's1',
        'Alice',
        3.7,
        15,
        [incompleteGrade],
        '2024-2025',
        'Fall',
        { minGPA: 3.5, minCredits: 12, excludeIncomplete: false },
      );
      expect(result.isEligible).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// generateDeansList
// ---------------------------------------------------------------------------
describe('generateDeansList', () => {
  it('returns only eligible students (those meeting GPA and credit thresholds)', () => {
    const students = [
      // eligible: semesterGPA=3.8 >= 3.5, credits=15 >= 12
      { studentId: 's1', studentName: 'Alice', semesterGPA: 3.8, creditsCompleted: 15, grades: [] },
      // ineligible: semesterGPA=2.5 < 3.5
      { studentId: 's2', studentName: 'Bob', semesterGPA: 2.5, creditsCompleted: 15, grades: [] },
    ];

    const result = generateDeansList(students, '2024-2025', 'Fall');

    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe('s1');
  });

  it('returns eligible students sorted by semesterGPA descending (highest first)', () => {
    const students = [
      { studentId: 's1', studentName: 'Alice', semesterGPA: 3.6, creditsCompleted: 15, grades: [] },
      { studentId: 's2', studentName: 'Bob', semesterGPA: 3.8, creditsCompleted: 15, grades: [] },
      { studentId: 's3', studentName: 'Carol', semesterGPA: 3.7, creditsCompleted: 15, grades: [] },
    ];

    const result = generateDeansList(students, '2024-2025', 'Fall');

    expect(result).toHaveLength(3);
    expect(result[0].studentId).toBe('s2'); // 3.8
    expect(result[1].studentId).toBe('s3'); // 3.7
    expect(result[2].studentId).toBe('s1'); // 3.6
  });

  it('returns an empty array when no student qualifies', () => {
    const students = [
      { studentId: 's1', studentName: 'Alice', semesterGPA: 2.5, creditsCompleted: 15, grades: [] },
      { studentId: 's2', studentName: 'Bob', semesterGPA: 1.8, creditsCompleted: 15, grades: [] },
    ];

    const result = generateDeansList(students, '2024-2025', 'Fall');

    expect(result).toEqual([]);
  });
});









