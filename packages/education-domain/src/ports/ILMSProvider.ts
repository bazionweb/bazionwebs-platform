
export interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  credits: number;
  semester: string;
  year: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'enrolled' | 'dropped' | 'completed';
  grade?: string;
  enrollmentDate: Date;
}

export interface Grade {
  id: string;
  userId: string;
  courseId: string;
  value: string;
  percentage?: number;
  timestamp: Date;
}

export interface ILMSProvider {
  getCourses(userId?: string): Promise<Course[]>;
  getCourse(courseId: string): Promise<Course | null>;
  enrollStudent(userId: string, courseId: string): Promise<Enrollment>;
  dropStudent(userId: string, courseId: string): Promise<void>;
  getEnrollments(userId: string): Promise<Enrollment[]>;
  getGrades(userId: string, courseId?: string): Promise<Grade[]>;
  syncGrade(grade: Grade): Promise<void>;
}
