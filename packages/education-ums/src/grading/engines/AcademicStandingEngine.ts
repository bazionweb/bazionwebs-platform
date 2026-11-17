/**
 * BMI UMS - Academic Standing Engine
 * Determines student academic status based on GPA thresholds
 */

import {
  AcademicStanding,
  AcademicStandingThresholds,
  StudentAcademicStanding,
  DeansListEligibility,
  Grade,
  SpecialGrade,
} from '../types';
import {
  DEFAULT_STANDING_THRESHOLDS,
  DEFAULT_DEANS_LIST_CRITERIA,
} from '../utils/constants';

/**
 * Determine academic standing based on GPA
 */
export function determineAcademicStanding(
  cumulativeGPA: number,
  semesterGPA: number,
  thresholds: AcademicStandingThresholds = DEFAULT_STANDING_THRESHOLDS
): AcademicStanding {
  // Honor Roll: cumulative GPA >= 3.5
  if (cumulativeGPA >= thresholds.honorRollMinGPA) {
    return AcademicStanding.HONOR_ROLL;
  }

  // Academic Probation: cumulative GPA < 2.0
  if (cumulativeGPA < thresholds.probationThresholdGPA) {
    return AcademicStanding.ACADEMIC_PROBATION;
  }

  // Warning: semester GPA < 2.0 but cumulative GPA >= 2.0
  if (
    semesterGPA < thresholds.warningThresholdGPA &&
    cumulativeGPA >= thresholds.goodStandingMinGPA
  ) {
    return AcademicStanding.WARNING;
  }

  // Good Standing: cumulative GPA >= 2.0 and < 3.5
  if (cumulativeGPA >= thresholds.goodStandingMinGPA) {
    return AcademicStanding.GOOD_STANDING;
  }

  // Default to Good Standing
  return AcademicStanding.GOOD_STANDING;
}

/**
 * Create student academic standing record
 */
export function createAcademicStandingRecord(
  studentId: string,
  cumulativeGPA: number,
  semesterGPA: number,
  academicYear: string,
  semester: string,
  thresholds?: AcademicStandingThresholds,
  notes?: string
): StudentAcademicStanding {
  const standing = determineAcademicStanding(
    cumulativeGPA,
    semesterGPA,
    thresholds
  );

  return {
    studentId,
    standing,
    cumulativeGPA,
    semesterGPA,
    academicYear,
    semester,
    determinedAt: new Date().toISOString(),
    notes,
  };
}

/**
 * Check Dean's List eligibility
 */
export function checkDeansListEligibility(
  studentId: string,
  studentName: string,
  semesterGPA: number,
  creditsCompleted: number,
  grades: Grade[],
  academicYear: string,
  semester: string,
  criteria: {
    minGPA: number;
    minCredits: number;
    excludeIncomplete: boolean;
  } = DEFAULT_DEANS_LIST_CRITERIA
): DeansListEligibility {
  // Check minimum GPA requirement
  const meetsGPARequirement = semesterGPA >= criteria.minGPA;

  // Check minimum credits requirement
  const meetsCreditsRequirement = creditsCompleted >= criteria.minCredits;

  // Check for incomplete grades
  const hasIncompleteGrades = grades.some(
    g => g.specialGrade === SpecialGrade.INCOMPLETE
  );

  // Determine eligibility
  const isEligible =
    meetsGPARequirement &&
    meetsCreditsRequirement &&
    (!criteria.excludeIncomplete || !hasIncompleteGrades);

  return {
    studentId,
    studentName,
    semesterGPA,
    creditsCompleted,
    academicYear,
    semester,
    isEligible,
    hasIncompleteGrades,
  };
}

/**
 * Generate Dean's List for a semester
 */
export function generateDeansList(
  students: Array<{
    studentId: string;
    studentName: string;
    semesterGPA: number;
    creditsCompleted: number;
    grades: Grade[];
  }>,
  academicYear: string,
  semester: string,
  criteria?: {
    minGPA: number;
    minCredits: number;
    excludeIncomplete: boolean;
  }
): DeansListEligibility[] {
  const eligibilityList = students.map(student =>
    checkDeansListEligibility(
      student.studentId,
      student.studentName,
      student.semesterGPA,
      student.creditsCompleted,
      student.grades,
      academicYear,
      semester,
      criteria
    )
  );

  // Filter to only eligible students and sort by GPA (descending)
  return eligibilityList
    .filter(e => e.isEligible)
    .sort((a, b) => b.semesterGPA - a.semesterGPA);
}

/**
 * Get students by academic standing
 */
export function getStudentsByStanding(
  standings: StudentAcademicStanding[],
  standing: AcademicStanding
): StudentAcademicStanding[] {
  return standings.filter(s => s.standing === standing);
}

/**
 * Calculate academic standing distribution
 */
export function calculateStandingDistribution(
  standings: StudentAcademicStanding[]
): Record<AcademicStanding, number> {
  const distribution: Record<AcademicStanding, number> = {
    [AcademicStanding.HONOR_ROLL]: 0,
    [AcademicStanding.GOOD_STANDING]: 0,
    [AcademicStanding.WARNING]: 0,
    [AcademicStanding.ACADEMIC_PROBATION]: 0,
    [AcademicStanding.SUSPENDED]: 0,
  };

  for (const standing of standings) {
    distribution[standing.standing]++;
  }

  return distribution;
}

/**
 * Calculate academic standing percentages
 */
export function calculateStandingPercentages(
  standings: StudentAcademicStanding[]
): Record<AcademicStanding, number> {
  if (standings.length === 0) {
    return {
      [AcademicStanding.HONOR_ROLL]: 0,
      [AcademicStanding.GOOD_STANDING]: 0,
      [AcademicStanding.WARNING]: 0,
      [AcademicStanding.ACADEMIC_PROBATION]: 0,
      [AcademicStanding.SUSPENDED]: 0,
    };
  }

  const distribution = calculateStandingDistribution(standings);
  const total = standings.length;

  const percentages = {} as Record<AcademicStanding, number>;
  for (const [standing, count] of Object.entries(distribution)) {
    percentages[standing as AcademicStanding] = (count / total) * 100;
  }

  return percentages;
}

/**
 * Check if student needs academic intervention
 */
export function needsIntervention(
  standing: StudentAcademicStanding
): { needs: boolean; reason?: string; urgency: 'low' | 'medium' | 'high' } {
  if (standing.standing === AcademicStanding.ACADEMIC_PROBATION) {
    return {
      needs: true,
      reason: 'Student is on academic probation (GPA < 2.0)',
      urgency: 'high',
    };
  }

  if (standing.standing === AcademicStanding.WARNING) {
    return {
      needs: true,
      reason: 'Student received academic warning (semester GPA < 2.0)',
      urgency: 'medium',
    };
  }

  if (standing.cumulativeGPA < 2.5 && standing.standing === AcademicStanding.GOOD_STANDING) {
    return {
      needs: true,
      reason: 'Student GPA is below 2.5, at risk of probation',
      urgency: 'low',
    };
  }

  return {
    needs: false,
    urgency: 'low',
  };
}

/**
 * Get students needing intervention
 */
export function getStudentsNeedingIntervention(
  standings: StudentAcademicStanding[]
): Array<StudentAcademicStanding & { interventionReason: string; urgency: string }> {
  return standings
    .map(standing => {
      const intervention = needsIntervention(standing);
      return {
        ...standing,
        interventionReason: intervention.reason || '',
        urgency: intervention.urgency,
      };
    })
    .filter(s => s.interventionReason !== '')
    .sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency as keyof typeof urgencyOrder] - 
             urgencyOrder[a.urgency as keyof typeof urgencyOrder];
    });
}

/**
 * Update custom thresholds
 */
export function updateStandingThresholds(
  thresholds: Partial<AcademicStandingThresholds>
): AcademicStandingThresholds {
  return {
    ...DEFAULT_STANDING_THRESHOLDS,
    ...thresholds,
  };
}

/**
 * Validate standing thresholds
 */
export function validateStandingThresholds(
  thresholds: AcademicStandingThresholds
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (thresholds.honorRollMinGPA < 0 || thresholds.honorRollMinGPA > 4.0) {
    errors.push('Honor Roll minimum GPA must be between 0 and 4.0');
  }

  if (thresholds.goodStandingMinGPA < 0 || thresholds.goodStandingMinGPA > 4.0) {
    errors.push('Good Standing minimum GPA must be between 0 and 4.0');
  }

  if (thresholds.probationThresholdGPA < 0 || thresholds.probationThresholdGPA > 4.0) {
    errors.push('Probation threshold GPA must be between 0 and 4.0');
  }

  if (thresholds.honorRollMinGPA <= thresholds.goodStandingMinGPA) {
    errors.push('Honor Roll minimum GPA must be greater than Good Standing minimum GPA');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}









