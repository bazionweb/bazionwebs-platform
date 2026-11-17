/**
 * BMI UMS - GPA Calculator
 * Calculates course-level, semester, and cumulative GPAs
 */

import {
  Grade,
  
  SemesterGPA,
  CumulativeGPA,
  GradingScale,
  SpecialGrade,
} from '../types';
import { letterGradeToPoints } from '../models/GradingScale';
import { GPA_PRECISION } from '../utils/constants';

/**
 * Calculate course-level GPA
 * Converts the grade to grade points using the course's grading scale
 */
export function calculateCourseGPA(
  grade: Grade,
  gradingScale: GradingScale
): number {
  // Handle special grades
  if (grade.specialGrade) {
    switch (grade.specialGrade) {
      case SpecialGrade.INCOMPLETE:
      case SpecialGrade.WITHDRAWN:
      case SpecialGrade.AUDIT:
        return 0; // These don't contribute to GPA
      case SpecialGrade.PASS:
        return 0; // Pass/Fail doesn't contribute to GPA
      case SpecialGrade.FAIL:
        return 0;
      default:
        return 0;
    }
  }

  // Convert letter grade to grade points
  const gradePoints = letterGradeToPoints(grade.letterGrade, gradingScale);
  
  return roundToPrecision(gradePoints, GPA_PRECISION);
}

/**
 * Calculate semester GPA
 * Formula: Semester_GPA = Σ(Course_Credits × Course_Grade_Points) ÷ Σ(Course_Credits)
 */
export function calculateSemesterGPA(
  grades: Grade[],
  gradingScales: Map<string, GradingScale>,
  academicYear: string,
  semester: string
): SemesterGPA {
  // Filter grades for the specified semester
  const semesterGrades = grades.filter(
    g => g.academicYear === academicYear && g.semester === semester
  );

  // Filter out grades that shouldn't be included in GPA
  const includedGrades = semesterGrades.filter(g => shouldIncludeInGPA(g));

  if (includedGrades.length === 0) {
    return {
      studentId: semesterGrades[0]?.studentId || '',
      academicYear,
      semester,
      gpa: 0,
      totalCredits: 0,
      totalGradePoints: 0,
      coursesIncluded: 0,
      calculatedAt: new Date().toISOString(),
    };
  }

  let totalGradePoints = 0;
  let totalCredits = 0;

  for (const grade of includedGrades) {
    const scale = gradingScales.get(grade.gradingScaleId);
    if (!scale) {
      // eslint-disable-next-line no-console
      console.warn(`Grading scale not found for grade ${grade.id}`);
      continue;
    }

    const courseGradePoints = letterGradeToPoints(grade.letterGrade, scale);
    totalGradePoints += courseGradePoints * grade.credits;
    totalCredits += grade.credits;
  }

  const gpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;

  return {
    studentId: includedGrades[0].studentId,
    academicYear,
    semester,
    gpa: roundToPrecision(gpa, GPA_PRECISION),
    totalCredits: roundToPrecision(totalCredits, GPA_PRECISION),
    totalGradePoints: roundToPrecision(totalGradePoints, GPA_PRECISION),
    coursesIncluded: includedGrades.length,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate cumulative GPA
 * Formula: Cumulative_GPA = Σ(All_Course_Credits × Course_Grade_Points) ÷ Σ(All_Course_Credits)
 */
export function calculateCumulativeGPA(
  grades: Grade[],
  gradingScales: Map<string, GradingScale>,
  studentId: string
): CumulativeGPA {
  // Filter grades for the student
  const studentGrades = grades.filter(g => g.studentId === studentId);

  // Filter out grades that shouldn't be included in GPA
  const includedGrades = studentGrades.filter(g => shouldIncludeInGPA(g));

  // Handle retaken courses - use only the most recent grade
  const gradesAfterRetakes = applyRetakePolicy(includedGrades);

  if (gradesAfterRetakes.length === 0) {
    return {
      studentId,
      gpa: 0,
      totalCredits: 0,
      totalGradePoints: 0,
      coursesIncluded: 0,
      semestersIncluded: 0,
      startDate: '',
      endDate: '',
      calculatedAt: new Date().toISOString(),
    };
  }

  let totalGradePoints = 0;
  let totalCredits = 0;

  for (const grade of gradesAfterRetakes) {
    const scale = gradingScales.get(grade.gradingScaleId);
    if (!scale) {
      // eslint-disable-next-line no-console
      console.warn(`Grading scale not found for grade ${grade.id}`);
      continue;
    }

    const courseGradePoints = letterGradeToPoints(grade.letterGrade, scale);
    totalGradePoints += courseGradePoints * grade.credits;
    totalCredits += grade.credits;
  }

  const gpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;

  // Calculate semester count
  const semesters = new Set(
    gradesAfterRetakes.map(g => `${g.academicYear}-${g.semester}`)
  );

  // Get date range
  const sortedGrades = [...gradesAfterRetakes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const startDate = sortedGrades[0]?.createdAt || '';
  const endDate = sortedGrades[sortedGrades.length - 1]?.createdAt || '';

  return {
    studentId,
    gpa: roundToPrecision(gpa, GPA_PRECISION),
    totalCredits: roundToPrecision(totalCredits, GPA_PRECISION),
    totalGradePoints: roundToPrecision(totalGradePoints, GPA_PRECISION),
    coursesIncluded: gradesAfterRetakes.length,
    semestersIncluded: semesters.size,
    startDate,
    endDate,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Determine if a grade should be included in GPA calculation
 */
function shouldIncludeInGPA(grade: Grade): boolean {
  // Exclude special grades that don't count toward GPA
  if (grade.specialGrade) {
    switch (grade.specialGrade) {
      case SpecialGrade.INCOMPLETE:
      case SpecialGrade.WITHDRAWN:
      case SpecialGrade.AUDIT:
      case SpecialGrade.PASS:
        return false;
      case SpecialGrade.FAIL:
        return true; // Failing grades count toward GPA
      default:
        return true;
    }
  }

  return true;
}

/**
 * Apply retake policy - use only the most recent grade for retaken courses
 */
function applyRetakePolicy(grades: Grade[]): Grade[] {
  // Group grades by course
  const courseGrades = new Map<string, Grade[]>();
  
  for (const grade of grades) {
    const courseKey = grade.courseCode;
    if (!courseGrades.has(courseKey)) {
      courseGrades.set(courseKey, []);
    }
    courseGrades.get(courseKey)!.push(grade);
  }

  // For each course, keep only the most recent grade
  const result: Grade[] = [];
  
  for (const [, courseGradeList] of courseGrades) {
    if (courseGradeList.length === 1) {
      result.push(courseGradeList[0]);
    } else {
      // Sort by retake attempt number (or date if not available)
      const sorted = courseGradeList.sort((a, b) => {
        if (a.retakeAttemptNumber && b.retakeAttemptNumber) {
          return b.retakeAttemptNumber - a.retakeAttemptNumber;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Use the most recent grade
      result.push(sorted[0]);
    }
  }

  return result;
}

/**
 * Calculate GPA for multiple semesters
 */
export function calculateMultipleSemesterGPAs(
  grades: Grade[],
  gradingScales: Map<string, GradingScale>,
  studentId: string
): SemesterGPA[] {
  const studentGrades = grades.filter(g => g.studentId === studentId);
  
  // Get unique semester combinations
  const semesters = new Set(
    studentGrades.map(g => `${g.academicYear}|${g.semester}`)
  );

  const results: SemesterGPA[] = [];

  for (const semesterKey of semesters) {
    const [academicYear, semester] = semesterKey.split('|');
    const semesterGPA = calculateSemesterGPA(
      studentGrades,
      gradingScales,
      academicYear,
      semester
    );
    results.push(semesterGPA);
  }

  // Sort by academic year and semester
  return results.sort((a, b) => {
    if (a.academicYear !== b.academicYear) {
      return a.academicYear.localeCompare(b.academicYear);
    }
    return getSemesterOrder(a.semester) - getSemesterOrder(b.semester);
  });
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
 * Recalculate all GPAs for a student
 */
export function recalculateStudentGPAs(
  grades: Grade[],
  gradingScales: Map<string, GradingScale>,
  studentId: string
): {
  semesterGPAs: SemesterGPA[];
  cumulativeGPA: CumulativeGPA;
} {
  const semesterGPAs = calculateMultipleSemesterGPAs(grades, gradingScales, studentId);
  const cumulativeGPA = calculateCumulativeGPA(grades, gradingScales, studentId);

  return {
    semesterGPAs,
    cumulativeGPA,
  };
}

/**
 * Round number to specified precision
 */
function roundToPrecision(value: number, precision: number): number {
  const multiplier = Math.pow(10, precision);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate GPA change between two semesters
 */
export function calculateGPAChange(
  previousGPA: number,
  currentGPA: number
): {
  change: number;
  percentChange: number;
  direction: 'improving' | 'declining' | 'stable';
} {
  const change = currentGPA - previousGPA;
  const percentChange = previousGPA > 0 ? (change / previousGPA) * 100 : 0;

  let direction: 'improving' | 'declining' | 'stable';
  if (Math.abs(change) < 0.01) {
    direction = 'stable';
  } else if (change > 0) {
    direction = 'improving';
  } else {
    direction = 'declining';
  }

  return {
    change: roundToPrecision(change, GPA_PRECISION),
    percentChange: roundToPrecision(percentChange, 2),
    direction,
  };
}

/**
 * Predict GPA if student achieves target grades in remaining courses
 */
export function predictGPA(
  currentGrades: Grade[],
  upcomingCourses: Array<{ credits: number; expectedGradePoints: number }>,
  gradingScales: Map<string, GradingScale>,
  studentId: string
): number {
  const currentCumulativeGPA = calculateCumulativeGPA(
    currentGrades,
    gradingScales,
    studentId
  );

  let totalGradePoints = currentCumulativeGPA.totalGradePoints;
  let totalCredits = currentCumulativeGPA.totalCredits;

  for (const course of upcomingCourses) {
    totalGradePoints += course.expectedGradePoints * course.credits;
    totalCredits += course.credits;
  }

  const predictedGPA = totalCredits > 0 ? totalGradePoints / totalCredits : 0;
  return roundToPrecision(predictedGPA, GPA_PRECISION);
}









