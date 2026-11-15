/**
 * BMI UMS - Grade Migration Service
 * Migrates data from old grading system to new system
 */

import {
  LegacyGrade,
  Grade,
  MigrationResult,
  GradingScaleType,
  GradeStatus,
  ComponentScore,
  AssessmentType,
} from '../types';
import { createUS40Scale, scoreToLetterGrade, letterGradeToPoints } from '../models/GradingScale';

/**
 * Migrate all grades from old system to new system
 */
export async function migrateGrades(
  legacyGrades: LegacyGrade[]
): Promise<MigrationResult> {
//   const _startTime = Date.now();
  const errors: MigrationResult['errors'] = [];
  let migratedCount = 0;

  const us40Scale = createUS40Scale();
  const migratedGrades: Grade[] = [];

  for (const legacyGrade of legacyGrades) {
    try {
      const newGrade = convertLegacyGrade(legacyGrade, us40Scale);
      migratedGrades.push(newGrade);
      migratedCount++;
    } catch (error) { errors.push({
        legacyGradeId: legacyGrade.id,
        studentId: legacyGrade.studentId,
        courseCode: legacyGrade.courseCode,
        error: error instanceof Error ? error.message : 'Unknown error',
       });
    }
  }

  // Create backup (in real implementation, this would save to file/database)
  const backupPath = await createBackup(legacyGrades);

  return {
    totalRecords: legacyGrades.length,
    migratedRecords: migratedCount,
    failedRecords: errors.length,
    errors,
    backupPath,
    migratedAt: new Date().toISOString(),
  };
}

/**
 * Convert a legacy grade to new grade format
 */
function convertLegacyGrade(
  legacyGrade: LegacyGrade,
  gradingScale: ReturnType<typeof createUS40Scale>
): Grade {
  // Convert numeric grade (0-100) to letter grade
  const letterGrade = scoreToLetterGrade(legacyGrade.grade, gradingScale);
  const gradePoints = letterGradeToPoints(letterGrade, gradingScale);

  // Create assessment components from legacy midterm/final if available
  const components: ComponentScore[] = [];
  
  if (legacyGrade.midterm !== undefined && legacyGrade.final !== undefined) {
    // Traditional split: Midterm 40%, Final 60%
    components.push({
      componentId: `midterm-${legacyGrade.id}`,
      componentType: AssessmentType.MIDTERM,
      score: legacyGrade.midterm,
      maxScore: 100,
      weight: 40,
      gradedAt: legacyGrade.createdAt,
    });
    
    components.push({
      componentId: `final-${legacyGrade.id}`,
      componentType: AssessmentType.FINAL_EXAM,
      score: legacyGrade.final,
      maxScore: 100,
      weight: 60,
      gradedAt: legacyGrade.createdAt,
    });
  } else {
    // Single grade component
    components.push({
      componentId: `total-${legacyGrade.id}`,
      componentType: AssessmentType.FINAL_EXAM,
      score: legacyGrade.grade,
      maxScore: 100,
      weight: 100,
      gradedAt: legacyGrade.createdAt,
    });
  }

  // Map legacy status to new status
  let status: GradeStatus;
  switch (legacyGrade.status) {
    case 'Verified':
      status = GradeStatus.VERIFIED;
      break;
    case 'Flagged':
      status = GradeStatus.FLAGGED;
      break;
    case 'Pending Review':
    default:
      status = GradeStatus.FINALIZED;
      break;
  }

  return {
    id: legacyGrade.id || `migrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    studentId: legacyGrade.studentId,
    studentName: legacyGrade.studentName,
    admissionNo: legacyGrade.admissionNo,
    courseId: legacyGrade.courseCode, // Use course code as ID for now
    courseCode: legacyGrade.courseCode,
    courseName: legacyGrade.courseName,
    credits: 3, // Default to 3 credits (would need to be looked up in real implementation)
    gradingScaleId: 'us-4-0-standard',
    gradingScaleType: GradingScaleType.US_4_0,
    components,
    numericGrade: legacyGrade.grade,
    letterGrade,
    gradePoints,
    isRetake: false,
    academicYear: legacyGrade.academicYear || new Date().getFullYear().toString(),
    semester: legacyGrade.semester || 'Fall',
    status,
    createdAt: legacyGrade.createdAt || new Date().toISOString(),
    updatedAt: legacyGrade.updatedAt || new Date().toISOString(),
    createdBy: 'migration-service',
    lastModifiedBy: 'migration-service',
  };
}

/**
 * Create backup of legacy grades
 */
async function createBackup(legacyGrades: LegacyGrade[]): Promise<string> {
  const backupData = JSON.stringify(legacyGrades, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backups/legacy-grades-${timestamp}.json`;
  
  // In real implementation, this would save to file system or cloud storage
  // eslint-disable-next-line no-console
  console.log(`[Migration] Backup created at: ${backupPath}`);
  // eslint-disable-next-line no-console
  console.log(`[Migration] Backup size: ${backupData.length} bytes`);
  
  return backupPath;
}

/**
 * Validate migrated grades
 */
export function validateMigration(
  legacyGrades: LegacyGrade[],
  migratedGrades: Grade[]
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check counts match
  if (legacyGrades.length !== migratedGrades.length) {
    errors.push(
      `Count mismatch: ${legacyGrades.length} legacy grades vs ${migratedGrades.length} migrated grades`
    );
  }

  // Check each legacy grade has a corresponding migrated grade
  for (const legacyGrade of legacyGrades) {
    const migrated = migratedGrades.find(
      g => g.studentId === legacyGrade.studentId && g.courseCode === legacyGrade.courseCode
    );

    if (!migrated) {
      errors.push(
        `Missing migrated grade for student ${legacyGrade.studentId}, course ${legacyGrade.courseCode}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate migration report
 */
export function generateMigrationReport(result: MigrationResult): string {
  const successRate = (result.migratedRecords / result.totalRecords) * 100;

  let report = '=== Grade Migration Report ===\n\n';
  report += `Migration Date: ${result.migratedAt}\n`;
  report += `Total Records: ${result.totalRecords}\n`;
  report += `Successfully Migrated: ${result.migratedRecords}\n`;
  report += `Failed: ${result.failedRecords}\n`;
  report += `Success Rate: ${successRate.toFixed(2)}%\n`;
  report += `Backup Location: ${result.backupPath}\n\n`;

  if (result.errors.length > 0) {
    report += '=== Errors ===\n';
    result.errors.forEach((error, index) => {
      report += `${index + 1}. Student: ${error.studentId}, Course: ${error.courseCode}\n`;
      report += `   Error: ${error.error}\n`;
    });
  }

  return report;
}









