/**
 * BMI UMS - Grade Analytics Engine
 * Generates statistical analysis and visualizations of grade distributions
 */

import {
  Grade,
  GradeDistribution,
  GradingScale,
} from '../types';

/**
 * Calculate grade distribution for a course
 */
export function calculateGradeDistribution(
  grades: Grade[],
  courseCode: string,
  academicYear: string,
  semester: string,
  courseName?: string
): GradeDistribution {
  const courseGrades = grades.filter(
    g =>
      g.courseCode === courseCode &&
      g.academicYear === academicYear &&
      g.semester === semester
  );

  if (courseGrades.length === 0) {
    return createEmptyDistribution(courseCode, courseName || courseCode, academicYear, semester);
  }

  // Count grades by letter grade
  const distribution: Record<string, number> = {};
  for (const grade of courseGrades) {
    const letter = grade.letterGrade;
    distribution[letter] = (distribution[letter] || 0) + 1;
  }

  // Calculate percentages
  const totalStudents = courseGrades.length;
  const percentages: Record<string, number> = {};
  for (const [grade, count] of Object.entries(distribution)) {
    percentages[grade] = (count / totalStudents) * 100;
  }

  // Calculate statistics
  const numericGrades = courseGrades.map(g => g.numericGrade);
  const statistics = calculateStatistics(numericGrades);

  return {
    courseId: courseGrades[0]?.courseId || '',
    courseCode,
    courseName: courseName || courseCode,
    academicYear,
    semester,
    distribution,
    statistics: {
      ...statistics,
      totalStudents,
    },
    percentages,
  };
}

/**
 * Create empty distribution
 */
function createEmptyDistribution(
  courseCode: string,
  courseName: string,
  academicYear: string,
  semester: string
): GradeDistribution {
  return {
    courseId: '',
    courseCode,
    courseName,
    academicYear,
    semester,
    distribution: {},
    statistics: {
      mean: 0,
      median: 0,
      standardDeviation: 0,
      min: 0,
      max: 0,
      totalStudents: 0,
    },
    percentages: {},
  };
}

/**
 * Calculate statistical measures
 */
function calculateStatistics(values: number[]): {
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      standardDeviation: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;

  const median =
    values.length % 2 === 0
      ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
      : sorted[Math.floor(values.length / 2)];

  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    mean: roundToTwo(mean),
    median: roundToTwo(median),
    standardDeviation: roundToTwo(standardDeviation),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Calculate percentile ranking for a student
 */
export function calculatePercentileRank(
  studentGrade: number,
  allGrades: number[]
): number {
  if (allGrades.length === 0) {
    return 0;
  }

  const belowCount = allGrades.filter(g => g < studentGrade).length;
  const percentile = (belowCount / allGrades.length) * 100;

  return roundToTwo(percentile);
}

/**
 * Calculate percentile rankings for all students in a course
 */
export function calculatePercentileRankings(
  grades: Grade[]
): Map<string, number> {
  const numericGrades = grades.map(g => g.numericGrade);
  const rankings = new Map<string, number>();

  for (const grade of grades) {
    const percentile = calculatePercentileRank(grade.numericGrade, numericGrades);
    rankings.set(grade.studentId, percentile);
  }

  return rankings;
}

/**
 * Update percentile rankings when grades change
 */
export function updatePercentileRankings(
  grades: Grade[],
  courseCode: string,
  academicYear: string,
  semester: string
): Map<string, number> {
  const courseGrades = grades.filter(
    g =>
      g.courseCode === courseCode &&
      g.academicYear === academicYear &&
      g.semester === semester
  );

  return calculatePercentileRankings(courseGrades);
}

/**
 * Generate bell curve data for visualization
 */
export function generateBellCurveData(
  grades: number[],
  bins: number = 10
): Array<{ range: string; count: number; percentage: number }> {
  if (grades.length === 0) {
    return [];
  }

  const min = Math.min(...grades);
  const max = Math.max(...grades);
  const binSize = (max - min) / bins;

  const binCounts: number[] = new Array(bins).fill(0);

  for (const grade of grades) {
    const binIndex = Math.min(Math.floor((grade - min) / binSize), bins - 1);
    binCounts[binIndex]++;
  }

  return binCounts.map((count, index) => {
    const rangeStart = min + index * binSize;
    const rangeEnd = min + (index + 1) * binSize;
    return {
      range: `${roundToTwo(rangeStart)}-${roundToTwo(rangeEnd)}`,
      count,
      percentage: (count / grades.length) * 100,
    };
  });
}

/**
 * Identify outlier grades (more than 2 standard deviations from mean)
 */
export function identifyOutliers(
  grades: Grade[]
): { high: Grade[]; low: Grade[] } {
  if (grades.length < 3) {
    return { high: [], low: [] };
  }

  const numericGrades = grades.map(g => g.numericGrade);
  const stats = calculateStatistics(numericGrades);

  const highThreshold = stats.mean + 2 * stats.standardDeviation;
  const lowThreshold = stats.mean - 2 * stats.standardDeviation;

  const high = grades.filter(g => g.numericGrade > highThreshold);
  const low = grades.filter(g => g.numericGrade < lowThreshold);

  return { high, low };
}

/**
 * Calculate grade distribution across multiple courses
 */
export function calculateMultipleCourseDistributions(
  grades: Grade[],
  courseCodes: string[],
  academicYear: string,
  semester: string
): GradeDistribution[] {
  return courseCodes.map(courseCode => {
    const courseGrades = grades.filter(g => g.courseCode === courseCode);
    const courseName = courseGrades[0]?.courseName || courseCode;
    return calculateGradeDistribution(
      grades,
      courseCode,
      academicYear,
      semester,
      courseName
    );
  });
}

/**
 * Compare grade distributions between two semesters
 */
export function compareDistributions(
  dist1: GradeDistribution,
  dist2: GradeDistribution
): {
  meanChange: number;
  medianChange: number;
  stdDevChange: number;
  distributionShift: Record<string, number>;
} {
  const meanChange = dist2.statistics.mean - dist1.statistics.mean;
  const medianChange = dist2.statistics.median - dist1.statistics.median;
  const stdDevChange =
    dist2.statistics.standardDeviation - dist1.statistics.standardDeviation;

  // Calculate distribution shift (change in percentage for each grade)
  const distributionShift: Record<string, number> = {};
  const allGrades = new Set([
    ...Object.keys(dist1.percentages),
    ...Object.keys(dist2.percentages),
  ]);

  for (const grade of allGrades) {
    const pct1 = dist1.percentages[grade] || 0;
    const pct2 = dist2.percentages[grade] || 0;
    distributionShift[grade] = pct2 - pct1;
  }

  return {
    meanChange: roundToTwo(meanChange),
    medianChange: roundToTwo(medianChange),
    stdDevChange: roundToTwo(stdDevChange),
    distributionShift,
  };
}

/**
 * Round to two decimal places
 */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get grade category percentages (A, B, C, D, F)
 */
export function getGradeCategoryPercentages(
  distribution: GradeDistribution
): Record<string, number> {
  const categories: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  };

  for (const [grade, percentage] of Object.entries(distribution.percentages)) {
    const category = grade.charAt(0); // Get first letter (A, B, C, D, F)
    if (categories[category] !== undefined) {
      categories[category] += percentage;
    }
  }

  return categories;
}

/**
 * Calculate pass/fail rate
 */
export function calculatePassFailRate(
  grades: Grade[],
  scale: GradingScale
): { passRate: number; failRate: number; totalStudents: number } {
  if (grades.length === 0) {
    return { passRate: 0, failRate: 0, totalStudents: 0 };
  }

  const passingGrades = grades.filter(g => {
    const boundary = scale.boundaries.find(b => b.grade === g.letterGrade);
    return boundary?.isPassing ?? false;
  });

  const passRate = (passingGrades.length / grades.length) * 100;
  const failRate = 100 - passRate;

  return {
    passRate: roundToTwo(passRate),
    failRate: roundToTwo(failRate),
    totalStudents: grades.length,
  };
}









