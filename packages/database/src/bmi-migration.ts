export interface BmiProgramSource {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  title?: unknown;
  level?: unknown;
  degree_level?: unknown;
  description?: unknown;
  duration?: unknown;
  credits?: unknown;
  faculty?: unknown;
}

export interface BmiStudentSource {
  id?: unknown;
  student_id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  program_id?: unknown;
  status?: unknown;
  enrollment_status?: unknown;
  gpa?: unknown;
}

export interface MappedBmiProgram {
  id: string;
  code: string;
  name: string;
  level: "certificate" | "diploma" | "bachelor" | "master" | "doctorate";
  description: string;
  duration: string;
  credits: number;
  faculty: string;
}

export interface MappedBmiStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  programId: string;
  status: "active" | "suspended" | "graduated" | "withdrawn";
  enrollmentStatus: "APPLIED" | "ACCEPTED" | "ENROLLED" | "COMPLETED";
  gpa: number;
}

export function mapBmiPrograms(sources: BmiProgramSource[]): {
  programs: MappedBmiProgram[];
  skipped: number;
} {
  let skipped = 0;
  const programs: MappedBmiProgram[] = [];

  for (const item of sources) {
    const name = typeof item.name === "string" ? item.name.trim() : typeof item.title === "string" ? item.title.trim() : "";
    const id = typeof item.id === "string" ? item.id.trim().toLowerCase() : name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const code = typeof item.code === "string" ? item.code.trim().toUpperCase() : id.slice(0, 8).toUpperCase();
    const rawLevel = (typeof item.level === "string" ? item.level : typeof item.degree_level === "string" ? item.degree_level : "bachelor").toLowerCase();
    const level: MappedBmiProgram["level"] =
      rawLevel.includes("cert") ? "certificate"
      : rawLevel.includes("dip") ? "diploma"
      : rawLevel.includes("master") ? "master"
      : rawLevel.includes("doc") || rawLevel.includes("phd") ? "doctorate"
      : "bachelor";

    if (!name || !id) {
      skipped++;
      continue;
    }

    programs.push({
      id,
      code,
      name,
      level,
      description: typeof item.description === "string" ? item.description.trim() : `${name} academic degree program.`,
      duration: typeof item.duration === "string" ? item.duration.trim() : "4 Semesters",
      credits: typeof item.credits === "number" && Number.isFinite(item.credits) ? item.credits : 120,
      faculty: typeof item.faculty === "string" ? item.faculty.trim() : "Faculty of Theology & Leadership",
    });
  }

  return { programs, skipped };
}

export function mapBmiStudents(sources: BmiStudentSource[]): {
  students: MappedBmiStudent[];
  skipped: number;
} {
  let skipped = 0;
  const students: MappedBmiStudent[] = [];

  for (const item of sources) {
    const firstName = typeof item.first_name === "string" ? item.first_name.trim() : "";
    const lastName = typeof item.last_name === "string" ? item.last_name.trim() : "";
    const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
    const studentId = typeof item.student_id === "string" ? item.student_id.trim() : typeof item.id === "string" ? item.id.trim() : "";

    if (!firstName || !lastName || !email || !studentId) {
      skipped++;
      continue;
    }

    const rawEnrollment = typeof item.enrollment_status === "string" ? item.enrollment_status.toUpperCase() : "ENROLLED";
    const enrollmentStatus: MappedBmiStudent["enrollmentStatus"] =
      rawEnrollment === "APPLIED" || rawEnrollment === "ACCEPTED" || rawEnrollment === "COMPLETED"
        ? rawEnrollment
        : "ENROLLED";

    students.push({
      id: typeof item.id === "string" ? item.id.trim() : `std-${studentId.toLowerCase()}`,
      studentId,
      firstName,
      lastName,
      email,
      phone: typeof item.phone === "string" ? item.phone.trim() : null,
      programId: typeof item.program_id === "string" ? item.program_id.trim() : "bachelor-theology",
      status: item.status === "graduated" || item.status === "suspended" || item.status === "withdrawn" ? item.status : "active",
      enrollmentStatus,
      gpa: typeof item.gpa === "number" && Number.isFinite(item.gpa) ? item.gpa : 3.5,
    });
  }

  return { students, skipped };
}

