/**
 * BMI UMS - Grade Automation Service
 * Handles automated grade operations including incomplete grade conversion,
 * pass/fail grade management, and deadline notifications
 */

import { Grade, SpecialGrade } from '../types';

/**
 * Service for automated grade operations
 */
export class GradeAutomationService {
  /**
   * Check and auto-convert incomplete grades that have passed their deadline
   * @param grades - Array of grades to check
   * @returns Array of grade IDs that were converted
   */
  static async autoConvertIncompleteGrades(grades: Grade[]): Promise<string[]> {
    const convertedGradeIds: string[] = [];
    const now = new Date();

    for (const grade of grades) {
      // Check if grade is incomplete and has a deadline
      if (
        grade.specialGrade === SpecialGrade.INCOMPLETE &&
        grade.incompleteDeadline
      ) {
        const deadline = new Date(grade.incompleteDeadline);

        // If deadline has passed, convert to F
        if (now > deadline) {
          try {
            // Update grade to F
            await this.convertIncompleteToF(grade.id);
            convertedGradeIds.push(grade.id);
            
            // eslint-disable-next-line no-console
            console.log(`[GradeAutomation] Converted incomplete grade ${grade.id} to F (deadline: ${grade.incompleteDeadline})`);
          } catch (error) { // eslint-disable-next-line no-console
            console.error(`[GradeAutomation] Failed to convert grade ${grade.id }:`, error);
          }
        }
      }
    }

    return convertedGradeIds;
  }

  /**
   * Convert an incomplete grade to F
   * @param gradeId - ID of the grade to convert
   */
  private static async convertIncompleteToF(gradeId: string): Promise<void> {
    // This would call the API to update the grade
    // For now, this is a placeholder
    // eslint-disable-next-line no-console
    console.log(`Converting grade ${gradeId} from Incomplete to F`);
    // API call to update the grade
    try {
      await fetch(`/api/grades/${gradeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialGrade: SpecialGrade.FAIL,
          letterGrade: 'F',
          gradePoints: 0.0,
          status: 'FINALIZED',
        }),
      });
    } catch (e) {
      console.error('Failed to convert incomplete to F API', e);
    }
  }

  /**
   * Send reminders for incomplete grades approaching deadline
   * @param grades - Array of grades to check
   * @param daysBeforeDeadline - Number of days before deadline to send reminder
   * @returns Array of student IDs who received reminders
   */
  static async sendIncompleteGradeReminders(
    grades: Grade[],
    daysBeforeDeadline: number = 7
  ): Promise<string[]> {
    const remindedStudentIds: string[] = [];
    const now = new Date();
    const reminderThreshold = new Date();
    reminderThreshold.setDate(reminderThreshold.getDate() + daysBeforeDeadline);

    for (const grade of grades) {
      if (
        grade.specialGrade === SpecialGrade.INCOMPLETE &&
        grade.incompleteDeadline
      ) {
        const deadline = new Date(grade.incompleteDeadline);

        // If deadline is within the reminder threshold
        if (deadline > now && deadline <= reminderThreshold) {
          try {
            await this.sendReminderNotification(grade);
            remindedStudentIds.push(grade.studentId);
            
            // eslint-disable-next-line no-console
            console.log(`[GradeAutomation] Sent reminder to student ${grade.studentId} for grade ${grade.id}`);
          } catch (error) { // eslint-disable-next-line no-console
            console.error(`[GradeAutomation] Failed to send reminder for grade ${grade.id }:`, error);
          }
        }
      }
    }

    return remindedStudentIds;
  }

  /**
   * Send reminder notification to student
   * @param grade - Grade with incomplete status
   */
  private static async sendReminderNotification(grade: Grade): Promise<void> {
    // This would send an email/SMS notification
    // eslint-disable-next-line no-console
    console.log(`Sending reminder notification for grade ${grade.id} to student ${grade.studentId}`);
    // Send notification via API
    try {
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: grade.studentId,
          subject: `Reminder: Incomplete Grade Deadline Approaching`,
          message: `Your incomplete grade for ${grade.courseId} is due on ${grade.incompleteDeadline}`,
        }),
      });
    } catch (e) {
      console.error('Failed to send reminder API', e);
    }
  }

  /**
   * Validate pass/fail grade eligibility for a course
   * @param courseId - ID of the course
   * @param studentId - ID of the student
   * @returns Whether the student is eligible for pass/fail grading
   */
  static async validatePassFailEligibility(
    courseId: string,
    studentId: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const response = await fetch(`/api/grading/pass-fail-eligibility?courseId=${courseId}&studentId=${studentId}`);
      if (response.ok) {
        const data = await response.json();
        return data as { eligible: boolean; reason?: string };
      }
    } catch (e) {
      console.error('Pass fail eligibility check failed', e);
    }
    
    return {
      eligible: true,
    };
  }

  /**
   * Convert a letter grade to pass/fail
   * @param grade - Original grade
   * @returns Pass or Fail designation
   */
  static convertToPassFail(grade: Grade): SpecialGrade {
    // Typically, D or above is passing
    const passingGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D'];
    
    if (passingGrades.includes(grade.letterGrade)) {
      return SpecialGrade.PASS;
    } else {
      return SpecialGrade.FAIL;
    }
  }

  /**
   * Check if a grade should be excluded from GPA calculation
   * @param grade - Grade to check
   * @returns Whether the grade should be excluded from GPA
   */
  static shouldExcludeFromGPA(grade: Grade): boolean {
    // Exclude incomplete, pass/fail, withdrawn, and audit grades
    const excludedSpecialGrades = [
      SpecialGrade.INCOMPLETE,
      SpecialGrade.PASS,
      SpecialGrade.WITHDRAWN,
      SpecialGrade.AUDIT,
    ];

    return (
      grade.specialGrade !== undefined &&
      excludedSpecialGrades.includes(grade.specialGrade)
    );
  }

  /**
   * Count credits from passed courses (for pass/fail)
   * @param grade - Grade to check
   * @returns Credits to count toward degree requirements
   */
  static getCreditsForDegreeRequirements(grade: Grade): number {
    // Pass/fail courses count for credits if passed
    if (grade.specialGrade === SpecialGrade.PASS) {
      return grade.credits;
    }

    // Failed, incomplete, withdrawn, or audit courses don't count
    if (
      grade.specialGrade === SpecialGrade.FAIL ||
      grade.specialGrade === SpecialGrade.INCOMPLETE ||
      grade.specialGrade === SpecialGrade.WITHDRAWN ||
      grade.specialGrade === SpecialGrade.AUDIT
    ) {
      return 0;
    }

    // Regular graded courses count if passing
    const passingGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D'];
    if (passingGrades.includes(grade.letterGrade)) {
      return grade.credits;
    }

    return 0;
  }

  /**
   * Run all automated grade operations
   * This should be called periodically (e.g., daily cron job)
   */
  static async runAutomatedOperations(grades: Grade[]): Promise<{
    convertedIncompletes: string[];
    remindersSet: string[];
  }> {
    // eslint-disable-next-line no-console
    console.log('[GradeAutomation] Running automated operations...');

    // Convert expired incomplete grades
    const convertedIncompletes = await this.autoConvertIncompleteGrades(grades);

    // Send reminders for upcoming deadlines
    const remindersSet = await this.sendIncompleteGradeReminders(grades, 7);

    // eslint-disable-next-line no-console
    console.log('[GradeAutomation] Automated operations complete:', {
      convertedIncompletes: convertedIncompletes.length,
      remindersSet: remindersSet.length,
    });

    return {
      convertedIncompletes,
      remindersSet,
    };
  }
}

/**
 * Configuration for pass/fail grading
 */
export interface PassFailConfig {
  // Maximum number of pass/fail courses per semester
  maxPassFailPerSemester: number;
  
  // Deadline for pass/fail election (days after semester start)
  electionDeadlineDays: number;
  
  // Courses eligible for pass/fail grading
  eligibleCourses: string[]; // Course IDs or codes
  
  // Courses NOT eligible for pass/fail grading
  excludedCourses: string[]; // Course IDs or codes (e.g., major requirements)
  
  // Minimum grade for "Pass" designation
  minimumPassingGrade: string; // Default: 'D'
}

/**
 * Default pass/fail configuration
 */
export const DEFAULT_PASS_FAIL_CONFIG: PassFailConfig = {
  maxPassFailPerSemester: 2,
  electionDeadlineDays: 14,
  eligibleCourses: [],
  excludedCourses: [],
  minimumPassingGrade: 'D',
};

/**
 * Configuration for incomplete grade handling
 */
export interface IncompleteGradeConfig {
  // Default deadline for incomplete grades (days from assignment)
  defaultDeadlineDays: number;
  
  // Maximum deadline extension allowed (days)
  maxExtensionDays: number;
  
  // Days before deadline to send first reminder
  firstReminderDays: number;
  
  // Days before deadline to send second reminder
  secondReminderDays: number;
  
  // Days before deadline to send final reminder
  finalReminderDays: number;
  
  // Whether to auto-convert to F after deadline
  autoConvertToF: boolean;
}

/**
 * Default incomplete grade configuration
 */
export const DEFAULT_INCOMPLETE_CONFIG: IncompleteGradeConfig = {
  defaultDeadlineDays: 60, // 60 days from end of semester
  maxExtensionDays: 30,
  firstReminderDays: 14,
  secondReminderDays: 7,
  finalReminderDays: 3,
  autoConvertToF: true,
};

export default GradeAutomationService;









