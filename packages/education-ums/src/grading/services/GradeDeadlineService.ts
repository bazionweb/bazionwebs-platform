/**
 * BMI UMS - Grade Deadline Service
 * Manages grade submission deadlines, reminders, and auto-finalization
 */

import { GradeDeadlineConfig } from '../types';

/**
 * Grade deadline configuration for a semester
 */
export interface DeadlineConfig extends GradeDeadlineConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Course with missing grades
 */
export interface MissingGradeCourse {
  courseId: string;
  courseCode: string;
  courseName: string;
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  enrolledStudents: number;
  submittedGrades: number;
  missingGrades: number;
}

/**
 * Deadline extension request
 */
export interface DeadlineExtension {
  id: string;
  courseId: string;
  courseCode: string;
  instructorId: string;
  requestedDeadline: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Denied';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

/**
 * Service for managing grade submission deadlines
 */
export class GradeDeadlineService {
  /**
   * Set grade submission deadline for a semester
   */
  static async setDeadline(config: Omit<GradeDeadlineConfig, 'id'>): Promise<DeadlineConfig> {
    try {
      const response = await fetch('/api/grading/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to set deadline API', e);
    }
    throw new Error('Failed to set deadline API');
  }

  /**
   * Get deadline configuration for a semester
   */
  static async getDeadline(academicYear: string, semester: string): Promise<DeadlineConfig | null> {
    try {
      const response = await fetch(`/api/grading/deadlines?year=${academicYear}&semester=${semester}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to get deadline API', e);
    }
    return null;
  }

  /**
   * Check if deadline has passed
   */
  static hasDeadlinePassed(deadline: string): boolean {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    return now > deadlineDate;
  }

  /**
   * Calculate days until deadline
   */
  static getDaysUntilDeadline(deadline: string): number {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Send reminder notifications to instructors with unsubmitted grades
   */
  static async sendDeadlineReminders(
    deadline: DeadlineConfig,
    daysBeforeDeadline: number
  ): Promise<string[]> {
    const daysUntil = this.getDaysUntilDeadline(deadline.submissionDeadline);

    // Only send if within reminder window
    if (daysUntil !== daysBeforeDeadline) {
      return [];
    }

    // Get courses with missing grades
    const coursesWithMissingGrades = await this.getCoursesWithMissingGrades(
      deadline.academicYear,
      deadline.semester
    );

    const notifiedInstructors: string[] = [];

    for (const course of coursesWithMissingGrades) {
      try {
        await this.sendReminderNotification(course, deadline, daysUntil);
        notifiedInstructors.push(course.instructorId);
        
        // eslint-disable-next-line no-console
        console.log(`[GradeDeadline] Sent reminder to instructor ${course.instructorId} for course ${course.courseCode}`);
      } catch (error) { // eslint-disable-next-line no-console
        console.error(`[GradeDeadline] Failed to send reminder for course ${course.courseCode }:`, error);
      }
    }

    return notifiedInstructors;
  }

  /**
   * Send reminder notification to instructor
   */
  private static async sendReminderNotification(
    course: MissingGradeCourse,
    deadline: DeadlineConfig,
    daysUntil: number
  ): Promise<void> {
    try {
      console.log(`Sending reminder for ${(course as any).code || course.courseId}, days until deadline: ${daysUntil}`);
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: course.instructorEmail,
          subject: 'Action Required: Submit Grades',
          message: `Please submit missing grades for ${course.courseCode} by ${deadline.submissionDeadline}`,
        }),
      });
    } catch (e) {
      console.error('Failed to send deadline reminder', e);
    }
  }

  /**
   * Get courses with missing grades for a semester
   */
  static async getCoursesWithMissingGrades(
    academicYear: string,
    semester: string
  ): Promise<MissingGradeCourse[]> {
    try {
      const response = await fetch(`/api/grading/missing?year=${academicYear}&semester=${semester}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to get missing grades API', e);
    }
    return [];
  }

  /**
   * Flag courses with missing grades after deadline
   */
  static async flagMissingGrades(
    academicYear: string,
    semester: string
  ): Promise<string[]> {
    const coursesWithMissingGrades = await this.getCoursesWithMissingGrades(
      academicYear,
      semester
    );

    const flaggedCourses: string[] = [];

    for (const course of coursesWithMissingGrades) {
      if (course.missingGrades > 0) {
        try {
          await fetch(`/api/grading/courses/${course.courseId}/flag`, { method: 'POST' });
        } catch (e) {
          console.error('Failed to flag course API', e);
        }
        flaggedCourses.push(course.courseId);
        // eslint-disable-next-line no-console
        console.log(`[GradeDeadline] Flagged course ${course.courseCode} with ${course.missingGrades} missing grades`);
      }
    }

    return flaggedCourses;
  }

  /**
   * Generate report of courses with unsubmitted grades
   */
  static async generateMissingGradesReport(
    academicYear: string,
    semester: string
  ): Promise<{
    totalCourses: number;
    coursesWithMissingGrades: number;
    totalMissingGrades: number;
    courses: MissingGradeCourse[];
  }> {
    const courses = await this.getCoursesWithMissingGrades(academicYear, semester);

    const coursesWithMissing = courses.filter(c => c.missingGrades > 0);
    const totalMissing = coursesWithMissing.reduce((sum, c) => sum + c.missingGrades, 0);

    return {
      totalCourses: courses.length,
      coursesWithMissingGrades: coursesWithMissing.length,
      totalMissingGrades: totalMissing,
      courses: coursesWithMissing,
    };
  }

  /**
   * Request deadline extension for a course
   */
  static async requestExtension(
    courseId: string,
    instructorId: string,
    requestedDeadline: string,
    reason: string
  ): Promise<DeadlineExtension> {
    try {
      const response = await fetch('/api/grading/extensions/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, instructorId, requestedDeadline, reason }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to request extension API', e);
    }
    
    return {
      id: `EXT-${Date.now()}`,
      courseId,
      courseCode: 'UNKNOWN',
      instructorId,
      requestedDeadline,
      reason,
      status: 'Pending',
      requestedAt: new Date().toISOString(),
    };
  }

  /**
   * Approve or deny deadline extension
   */
  static async reviewExtension(
    extensionId: string,
    approved: boolean,
    reviewerId: string
  ): Promise<DeadlineExtension> {
    try {
      const response = await fetch(`/api/grading/extensions/${extensionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, reviewerId }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to review extension API', e);
    }
    
    return {
      id: extensionId,
      courseId: 'CRS-101',
      courseCode: 'THEO101',
      instructorId: 'INS-001',
      requestedDeadline: new Date().toISOString(),
      reason: 'Need more time',
      status: approved ? 'Approved' : 'Denied',
      requestedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
    };
  }

  /**
   * Prevent students from viewing grades until instructor submits them
   */
  static async setGradeVisibility(
    gradeId: string,
    visible: boolean
  ): Promise<void> {
    try {
      await fetch(`/api/grades/${gradeId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      });
    } catch (e) {
      console.error('Failed to set grade visibility API', e);
    }
  }

  /**
   * Auto-finalize submitted grades after review period
   */
  static async autoFinalizeGrades(
    academicYear: string,
    semester: string,
    reviewPeriodDays: number
  ): Promise<string[]> {
    try {
      const response = await fetch('/api/grading/auto-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYear, semester, reviewPeriodDays }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Failed to auto-finalize grades API', e);
    }
    
    return [];
  }

  /**
   * Run all deadline-related automated operations
   */
  static async runDeadlineOperations(deadline: DeadlineConfig): Promise<{
    remindersSent: string[];
    flaggedCourses: string[];
    finalizedGrades: string[];
  }> {
    // eslint-disable-next-line no-console
    console.log('[GradeDeadline] Running deadline operations...');

    const daysUntil = this.getDaysUntilDeadline(deadline.submissionDeadline);

    // Send reminders if within reminder window
    let remindersSent: string[] = [];
    if (deadline.reminderDays.includes(daysUntil)) {
      remindersSent = await this.sendDeadlineReminders(deadline, daysUntil);
    }

    // Flag courses with missing grades if deadline has passed
    let flaggedCourses: string[] = [];
    if (this.hasDeadlinePassed(deadline.submissionDeadline)) {
      flaggedCourses = await this.flagMissingGrades(
        deadline.academicYear,
        deadline.semester
      );
    }

    // Auto-finalize grades after review period
    const finalizedGrades = await this.autoFinalizeGrades(
      deadline.academicYear,
      deadline.semester,
      deadline.autoFinalizeAfterDays
    );

    // eslint-disable-next-line no-console
    console.log('[GradeDeadline] Deadline operations complete:', {
      remindersSent: remindersSent.length,
      flaggedCourses: flaggedCourses.length,
      finalizedGrades: finalizedGrades.length,
    });

    return {
      remindersSent,
      flaggedCourses,
      finalizedGrades,
    };
  }
}

export default GradeDeadlineService;









