
import { ILMSProvider, Course, Enrollment, Grade } from '../../ports';

export class MemoryLMSAdapter implements ILMSProvider {
  private courses: Map<string, Course> = new Map();
  private enrollments: Map<string, Enrollment> = new Map();
  private grades: Map<string, Grade> = new Map();

  async getCourses(userId?: string): Promise<Course[]> {
    if (!userId) {
      return Array.from(this.courses.values());
    }
    const userEnrollments = this.getEnrollments(userId);
    const courseIds = (await userEnrollments).map(e => e.courseId);
    return Array.from(this.courses.values()).filter(c => courseIds.includes(c.id));
  }

  async getCourse(courseId: string): Promise<Course | null> {
    return this.courses.get(courseId) || null;
  }

  async enrollStudent(userId: string, courseId: string): Promise<Enrollment> {
    const id = crypto.randomUUID();
    const enrollment: Enrollment = {
      id,
      userId,
      courseId,
      status: 'enrolled',
      enrollmentDate: new Date(),
    };
    this.enrollments.set(id, enrollment);
    return enrollment;
  }

  async dropStudent(userId: string, courseId: string): Promise<void> {
    for (const [id, enrollment] of this.enrollments) {
      if (enrollment.userId === userId && enrollment.courseId === courseId) {
        enrollment.status = 'dropped';
        this.enrollments.set(id, enrollment);
        break;
      }
    }
  }

  async getEnrollments(userId: string): Promise<Enrollment[]> {
    return Array.from(this.enrollments.values()).filter(e => e.userId === userId);
  }

  async getGrades(userId: string, courseId?: string): Promise<Grade[]> {
    let grades = Array.from(this.grades.values()).filter(g => g.userId === userId);
    if (courseId) {
      grades = grades.filter(g => g.courseId === courseId);
    }
    return grades;
  }

  async syncGrade(grade: Grade): Promise<void> {
    this.grades.set(grade.id, grade);
  }
}
