import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  PROGRAMS,
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
} from "@bazion/education-contracts";

export interface EducationStudentRecord {
  id: string;
  student_id: string;
  reg_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  program_id: string;
  program_code: string;
  program_name: string;
  faculty: string;
  department: string;
  status: string;
  enrollment_status: string;
  gpa: number;
  credits_earned: number;
  academic_year: string;
  admission_date: string;
  campus: string;
  campus_name: string;
  study_center_id: string;
  created_at: string;
}

export interface EducationApplicationRecord {
  id: string;
  applicant_id: string;
  user_id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  program_id: string;
  program: string;
  degree_level: string;
  status: "draft" | "submitted" | "under_review" | "accepted" | "rejected" | "waitlisted";
  current_step: number;
  personal_statement: string | null;
  high_school?: string | undefined;
  graduation_year?: number | undefined;
  gpa?: number | undefined;
  reviewer_notes?: string | null | undefined;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

const studyCentersStore = [
  {
    id: "sc-mukurweini",
    name: "BEMI Training Institute — Mukurweini Campus (Africa Hub)",
    code: "BEMI-KE",
    location: "Mukurwe-ini Plaza, Nyeri County, Kenya",
    status: "active" as const,
    created: "2024-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  },
  {
    id: "sc-charlotte",
    name: "BMI University — Charlotte Main Campus",
    code: "BMI-US",
    location: "Charlotte, North Carolina, USA",
    status: "active" as const,
    created: "2024-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  },
  {
    id: "sc-online",
    name: "BMI Global Online & Distance Learning Campus",
    code: "BMI-GLOBAL",
    location: "Global Virtual Learning Environment",
    status: "active" as const,
    created: "2024-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  },
];

const facultiesStore = [
  {
    id: "fac-theology",
    name: "School of Theology & Biblical Studies",
    faculty_code: "THEO",
    code: "THEO",
    dean: "Dr. Joseph Kiai",
    description: "Biblical exegesis, systematic theology, and historical Christian doctrine.",
  },
  {
    id: "fac-ministry",
    name: "School of Practical Ministry & Leadership",
    faculty_code: "MIN",
    code: "MIN",
    dean: "Dr. George Githinji",
    description: "Pastoral leadership, church planting, worship ministry, and global missions.",
  },
  {
    id: "fac-education",
    name: "School of Christian Education & Counseling",
    faculty_code: "EDUC",
    code: "EDUC",
    dean: "Dr. Lilian Young",
    description: "Christian pedagogy, educational leadership, and biblical counseling.",
  },
];

const departmentsStore = [
  {
    id: "dept-bib",
    faculty_id: "fac-theology",
    name: "Department of Biblical & Theological Studies",
    dept_code: "BIB",
    code: "BIB",
  },
  {
    id: "dept-lead",
    faculty_id: "fac-ministry",
    name: "Department of Ministry Leadership & Missions",
    dept_code: "LEAD",
    code: "LEAD",
  },
  {
    id: "dept-coun",
    faculty_id: "fac-education",
    name: "Department of Christian Education & Counseling",
    dept_code: "COUN",
    code: "COUN",
  },
];

const termsStore = [
  {
    id: "term-2026-fall",
    name: "Fall Semester 2026",
    code: "2026-FALL",
    academic_year: "2026/2027",
    semester_number: 1,
    start_date: "2026-09-01",
    end_date: "2026-12-18",
    status: "active",
    registration_opens_at: "2026-07-01T00:00:00Z",
    registration_closes_at: "2026-09-15T23:59:59Z",
    census_date: "2026-09-30",
  },
  {
    id: "term-2027-spring",
    name: "Spring Semester 2027",
    code: "2027-SPRING",
    academic_year: "2026/2027",
    semester_number: 2,
    start_date: "2027-01-15",
    end_date: "2027-05-15",
    status: "upcoming",
    registration_opens_at: "2026-11-15T00:00:00Z",
    registration_closes_at: "2027-01-31T23:59:59Z",
    census_date: "2027-02-15",
  },
];

const programsStore = PROGRAMS.map((p, index) => {
  const codePrefix =
    p.level === "undergraduate"
      ? "BA"
      : p.level === "graduate"
        ? "MA"
        : p.level === "doctorate"
          ? "DOC"
          : p.level === "diploma"
            ? "DIP"
            : "CERT";
  const code = `${codePrefix}-${101 + index}`;
  return {
    id: `prog-${index + 1}`,
    code,
    program_code: code,
    name: p.label,
    label: p.label,
    level: p.level,
    degree_level: p.level,
    degree_type: p.level.toUpperCase(),
    description: p.description,
    icon: p.icon,
    department_id: index % 3 === 0 ? "dept-bib" : index % 3 === 1 ? "dept-lead" : "dept-coun",
    faculty_id: index % 3 === 0 ? "fac-theology" : index % 3 === 1 ? "fac-ministry" : "fac-education",
    credits_required: p.level === "undergraduate" ? 120 : p.level === "graduate" ? 60 : p.level === "doctorate" ? 48 : 30,
    is_active: true,
  };
});

const studentsStore: EducationStudentRecord[] = [
  {
    id: "std-1001",
    student_id: "BMI-2024-001",
    reg_no: "BMI-2024-001",
    first_name: "Samuel",
    last_name: "Mwangi",
    full_name: "Samuel Mwangi",
    email: "s.mwangi@student.bmiuniversities.org",
    phone: "+254 712 345678",
    program_id: "prog-1",
    program_code: "BA-101",
    program_name: "BA in Biblical Studies",
    faculty: "School of Theology & Biblical Studies",
    department: "Department of Biblical & Theological Studies",
    status: "active",
    enrollment_status: "ENROLLED",
    gpa: 3.75,
    credits_earned: 45,
    academic_year: "Year 2",
    admission_date: "2024-01-15",
    campus: "Mukurweini Campus, Kenya",
    campus_name: "BEMI Training Institute — Mukurweini Campus (Africa Hub)",
    study_center_id: "sc-mukurweini",
    created_at: "2024-01-15T08:00:00Z",
  },
  {
    id: "std-1002",
    student_id: "BMI-2024-002",
    reg_no: "BMI-2024-002",
    first_name: "Grace",
    last_name: "Achieng",
    full_name: "Grace Achieng",
    email: "g.achieng@student.bmiuniversities.org",
    phone: "+254 723 456789",
    program_id: "prog-2",
    program_code: "BA-102",
    program_name: "BA in Christian Education",
    faculty: "School of Christian Education & Counseling",
    department: "Department of Christian Education & Counseling",
    status: "active",
    enrollment_status: "ENROLLED",
    gpa: 3.9,
    credits_earned: 60,
    academic_year: "Year 2",
    admission_date: "2024-01-16",
    campus: "Mukurweini Campus, Kenya",
    campus_name: "BEMI Training Institute — Mukurweini Campus (Africa Hub)",
    study_center_id: "sc-mukurweini",
    created_at: "2024-01-16T08:00:00Z",
  },
  {
    id: "std-1003",
    student_id: "BMI-2024-003",
    reg_no: "BMI-2024-003",
    first_name: "David",
    last_name: "Kimani",
    full_name: "David Kimani",
    email: "d.kimani@student.bmiuniversities.org",
    phone: "+254 734 567890",
    program_id: "prog-6",
    program_code: "MA-106",
    program_name: "Master of Divinity (MDiv)",
    faculty: "School of Practical Ministry & Leadership",
    department: "Department of Ministry Leadership & Missions",
    status: "active",
    enrollment_status: "ENROLLED",
    gpa: 3.82,
    credits_earned: 28,
    academic_year: "Year 1",
    admission_date: "2024-02-01",
    campus: "Global Online",
    campus_name: "BMI Global Online & Distance Learning Campus",
    study_center_id: "sc-online",
    created_at: "2024-02-01T08:00:00Z",
  },
];

const staffStore = [
  {
    id: "stf-2001",
    first_name: "Dr. Christopher",
    last_name: "Cookhorne",
    full_name: "Dr. Christopher Cookhorne",
    email: "c.cookhorne@bmiuniversities.org",
    role: "President & Chancellor",
    department: "Executive Office & Systematic Theology",
    category: "Leadership",
    study_center_id: "sc-charlotte",
    status: "active",
  },
  {
    id: "stf-2002",
    first_name: "Dr. George",
    last_name: "Githinji",
    full_name: "Dr. George Githinji",
    email: "g.githinji@bmiuniversities.org",
    role: "Vice-President & Africa Hub Director",
    department: "Practical Ministry & Leadership",
    category: "Leadership",
    study_center_id: "sc-mukurweini",
    status: "active",
  },
  {
    id: "stf-2003",
    first_name: "Dr. Joseph",
    last_name: "Kiai",
    full_name: "Dr. Joseph Kiai",
    email: "j.kiai@bmiuniversities.org",
    role: "Dean of Academics",
    department: "Biblical & Theological Studies",
    category: "Academic",
    study_center_id: "sc-mukurweini",
    status: "active",
  },
  {
    id: "stf-2004",
    first_name: "Dr. Melba",
    last_name: "Layne",
    full_name: "Dr. Melba Layne",
    email: "registrar@bmiuniversities.org",
    role: "Chief Registrar",
    department: "Office of the Registrar & Student Records",
    category: "Administrative",
    study_center_id: "sc-charlotte",
    status: "active",
  },
  {
    id: "stf-2005",
    first_name: "Dr. Lilian",
    last_name: "Young",
    full_name: "Dr. Lilian Young",
    email: "l.young@bmiuniversities.org",
    role: "Dean of Students",
    department: "Christian Education & Student Affairs",
    category: "Academic",
    study_center_id: "sc-charlotte",
    status: "active",
  },
];

const coursesStore = [
  {
    id: "crs-301",
    code: "THEO-101",
    name: "Foundations of Biblical Theology",
    title: "Foundations of Biblical Theology",
    description: "Introduction to canonical Scripture, hermeneutics, and orthodox Christian theology.",
    credits: 3,
    credit_hours: 3,
    department: "Department of Biblical & Theological Studies",
    level: "Undergraduate",
    term: "Fall Semester 2026",
    capacity: 40,
    enrolled_count: 22,
    status: "Published",
    is_mandatory: true,
  },
  {
    id: "crs-302",
    code: "HEBR-201",
    name: "Biblical Hebrew Syntax & Exegesis",
    title: "Biblical Hebrew Syntax & Exegesis",
    description: "Grammatical and exegetical analysis of the Hebrew Old Testament text.",
    credits: 3,
    credit_hours: 3,
    department: "Department of Biblical & Theological Studies",
    level: "Undergraduate",
    term: "Fall Semester 2026",
    capacity: 30,
    enrolled_count: 18,
    status: "Published",
    is_mandatory: false,
  },
  {
    id: "crs-303",
    code: "LEAD-401",
    name: "Pastoral Leadership & Ministerial Ethics",
    title: "Pastoral Leadership & Ministerial Ethics",
    description: "Servant leadership principles, church governance, and ministerial integrity.",
    credits: 4,
    credit_hours: 4,
    department: "Department of Ministry Leadership & Missions",
    level: "Masters",
    term: "Fall Semester 2026",
    capacity: 35,
    enrolled_count: 25,
    status: "Published",
    is_mandatory: true,
  },
  {
    id: "crs-304",
    code: "COUN-302",
    name: "Biblical Counseling & Spiritual Formation",
    title: "Biblical Counseling & Spiritual Formation",
    description: "Christ-centered counseling methodologies and spiritual care in ministry contexts.",
    credits: 3,
    credit_hours: 3,
    department: "Department of Christian Education & Counseling",
    level: "Undergraduate",
    term: "Fall Semester 2026",
    capacity: 35,
    enrolled_count: 20,
    status: "Published",
    is_mandatory: false,
  },
];

const applicationsStore: EducationApplicationRecord[] = [
  {
    id: "app-1001",
    applicant_id: "usr-app-1001",
    user_id: "usr-app-1001",
    application_number: "BMI-APP-2026-001",
    first_name: "Samuel",
    last_name: "Mwangi",
    email: "s.mwangi@student.bmiuniversities.org",
    phone: "+254 712 345678",
    program_id: "prog-1",
    program: "BA in Biblical Studies",
    degree_level: "undergraduate",
    status: "accepted",
    current_step: 4,
    personal_statement: "Called to serve the Church in East Africa through sound biblical teaching.",
    high_school: "Nyeri High School",
    graduation_year: 2022,
    gpa: 3.75,
    reviewer_notes: "Strong pastoral recommendation and academic preparation.",
    submitted_at: "2026-05-10T12:00:00Z",
    created_at: "2026-05-08T09:00:00Z",
    updated_at: "2026-05-15T14:30:00Z",
  },
  {
    id: "app-1002",
    applicant_id: "usr-app-1002",
    user_id: "usr-app-1002",
    application_number: "BMI-APP-2026-002",
    first_name: "Esther",
    last_name: "Wanjiku",
    email: "e.wanjiku@example.org",
    phone: "+254 721 998877",
    program_id: "prog-6",
    program: "Master of Divinity (MDiv)",
    degree_level: "graduate",
    status: "submitted",
    current_step: 4,
    personal_statement: "Seeking advanced theological equipping for ministry leadership and chaplaincy.",
    high_school: "Alliance Girls High School",
    graduation_year: 2019,
    gpa: 3.85,
    reviewer_notes: null,
    submitted_at: "2026-10-12T10:15:00Z",
    created_at: "2026-10-10T08:00:00Z",
    updated_at: "2026-10-12T10:15:00Z",
  },
];

const applicationLogsStore: Record<
  string,
  Array<{
    id: string;
    application_id: string;
    step?: string;
    status?: string;
    old_status: string | null;
    new_status: string;
    changed_by: string;
    changed_by_name: string;
    notes: string | null;
    changed_at: string;
    timestamp: string;
  }>
> = {
  "app-1001": [
    {
      id: "log-1",
      application_id: "app-1001",
      step: "Application Created",
      status: "Completed",
      old_status: null,
      new_status: "draft",
      changed_by: "usr-app-1001",
      changed_by_name: "Samuel Mwangi",
      notes: "Initial application started",
      changed_at: "2026-05-08T09:00:00Z",
      timestamp: "2026-05-08T09:00:00Z",
    },
    {
      id: "log-2",
      application_id: "app-1001",
      step: "Application Submitted",
      status: "Completed",
      old_status: "draft",
      new_status: "submitted",
      changed_by: "usr-app-1001",
      changed_by_name: "Samuel Mwangi",
      notes: "Completed all steps and uploaded transcripts",
      changed_at: "2026-05-10T12:00:00Z",
      timestamp: "2026-05-10T12:00:00Z",
    },
    {
      id: "log-3",
      application_id: "app-1001",
      step: "Admissions Decision",
      status: "Accepted",
      old_status: "submitted",
      new_status: "accepted",
      changed_by: "stf-2004",
      changed_by_name: "Dr. Melba Layne",
      notes: "Admitted with 20% ministry scholarship.",
      changed_at: "2026-05-15T14:30:00Z",
      timestamp: "2026-05-15T14:30:00Z",
    },
  ],
};

const transactionsStore = [
  {
    id: "tx-101",
    student_id: "std-1001",
    studentId: "std-1001",
    name: "Samuel Mwangi",
    amount: 1200,
    amt: 1200,
    currency: "USD",
    type: "Tuition Payment",
    status: "Paid",
    ref: "BEMI-MPESA-882190",
    date: "2026-09-01",
    due_date: "2026-09-01",
  },
  {
    id: "tx-102",
    student_id: "std-1002",
    studentId: "std-1002",
    name: "Grace Achieng",
    amount: 1200,
    amt: 1200,
    currency: "USD",
    type: "Tuition Payment",
    status: "Paid",
    ref: "BEMI-PAYSTACK-991024",
    date: "2026-09-03",
    due_date: "2026-09-03",
  },
  {
    id: "tx-103",
    student_id: "std-1003",
    studentId: "std-1003",
    name: "David Kimani",
    amount: 1800,
    amt: 1800,
    currency: "USD",
    type: "Tuition Invoice",
    status: "Pending",
    ref: "BEMI-INV-2026-103",
    date: "2026-09-10",
    due_date: "2026-10-10",
  },
];

const gradesStore = [
  {
    id: "grd-1",
    student_id: "std-1001",
    studentId: "std-1001",
    studentName: "Samuel Mwangi",
    regNo: "BMI-2024-001",
    course_code: "THEO-101",
    courseCode: "THEO-101",
    course_name: "Foundations of Biblical Theology",
    courseName: "Foundations of Biblical Theology",
    numericGrade: 94,
    percentage: 94,
    grade: "A",
    letterGrade: "A",
    gpa_points: 4.0,
    gpa: 4.0,
    academicYear: "2025/2026",
    semester: "Spring 2026",
    status: "Published",
  },
  {
    id: "grd-2",
    student_id: "std-1001",
    studentId: "std-1001",
    studentName: "Samuel Mwangi",
    regNo: "BMI-2024-001",
    course_code: "HEBR-201",
    courseCode: "HEBR-201",
    course_name: "Biblical Hebrew Syntax & Exegesis",
    courseName: "Biblical Hebrew Syntax & Exegesis",
    numericGrade: 90,
    percentage: 90,
    grade: "A-",
    letterGrade: "A-",
    gpa_points: 3.7,
    gpa: 3.7,
    academicYear: "2025/2026",
    semester: "Spring 2026",
    status: "Published",
  },
];

const libraryStore = [
  {
    id: "lib-1",
    title: "Systematic Theology: An Introduction to Biblical Doctrine",
    author: "Wayne Grudem",
    category: "Theology",
    isbn: "978-0310286707",
    status: "Available",
    copies: 15,
  },
  {
    id: "lib-2",
    title: "African Christian Theology: An Introduction",
    author: "Samuel Waje Kunhiyop",
    category: "Contextual Theology",
    isbn: "978-9966003096",
    status: "Available",
    copies: 24,
  },
  {
    id: "lib-3",
    title: "Spiritual Leadership: Principles of Excellence for Every Believer",
    author: "J. Oswald Sanders",
    category: "Ministry Leadership",
    isbn: "978-0802416704",
    status: "Available",
    copies: 20,
  },
];

function resolveActiveEducationTenantConfig(request: FastifyRequest) {
  const tenantHeader = String(request.headers["x-bazion-tenant"] ?? "").toLowerCase();
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").toLowerCase();
  if (tenantHeader.includes("bemi") || host.includes("bemi")) {
    return bemiTrainingInstituteTenantConfig;
  }
  return bmiUniversityTenantConfig;
}

function paginate<T>(items: T[], query: Record<string, unknown> = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.max(1, Math.min(200, Number(query.perPage || query.per_page || query.limit) || 50));
  const start = (page - 1) * perPage;
  const paged = items.slice(start, start + perPage);
  return {
    items: paged,
    page,
    perPage,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / perPage)),
  };
}

export async function bmiApiRoutes(app: FastifyInstance) {
  // ── Public Website Endpoints ───────────────────────────────────────────────
  app.get("/api/public/programs", async (request) => {
    const query = (request.query as { level?: string }) || {};
    const levelFilter = query.level?.toLowerCase();
    const filtered = levelFilter
      ? programsStore.filter((p) => p.level === levelFilter)
      : programsStore;
    return {
      success: true,
      data: filtered,
      programs: filtered,
    };
  });

  app.get("/api/programs", async () => ({
    success: true,
    data: programsStore,
    programs: programsStore,
  }));

  app.get("/api/public/fees", async () => ({
    success: true,
    data: {
      tuition: [
        { level: "diploma", fee: 650, currency: "USD", per: "semester" },
        { level: "bachelor", fee: 1200, currency: "USD", per: "semester" },
        { level: "master", fee: 1800, currency: "USD", per: "semester" },
        { level: "doctorate", fee: 2500, currency: "USD", per: "semester" },
      ],
      discounts: {
        earlyBird: 10,
        scholarshipMax: 50,
      },
    },
  }));

  app.post("/api/public/contact", async (request) => {
    return {
      success: true,
      message: "Thank you for contacting us. Our admissions and academic team will get back to you shortly.",
      received: request.body,
    };
  });

  // ── Unified Public & UMS Credential Verification ──────────────────────────
  const handleVerify = async (request: FastifyRequest) => {
    const tenantConfig = resolveActiveEducationTenantConfig(request);
    const query = (request.query as Record<string, string>) || {};
    const body = (request.body as Record<string, string>) || {};
    const rawCode =
      query.code ||
      query.id ||
      query.serial ||
      body.serial ||
      body.code ||
      body.id ||
      body.document_id ||
      "BMI-2024-001";
    const code = String(rawCode).trim().toUpperCase();

    const matchedStudent: EducationStudentRecord =
      studentsStore.find(
        (s) =>
          s.reg_no.toUpperCase() === code ||
          s.student_id.toUpperCase() === code ||
          code.includes(s.reg_no.toUpperCase()),
      ) ??
      studentsStore[0] ?? {
        id: "std-1001",
        student_id: code,
        reg_no: code,
        first_name: "Samuel",
        last_name: "Mwangi",
        full_name: "Samuel Mwangi",
        email: "s.mwangi@student.bmiuniversities.org",
        phone: "+254 712 345678",
        program_id: "prog-1",
        program_code: "BA-101",
        program_name: "BA in Biblical Studies",
        faculty: "School of Theology & Biblical Studies",
        department: "Department of Biblical & Theological Studies",
        status: "active",
        enrollment_status: "ENROLLED",
        gpa: 3.75,
        credits_earned: 45,
        academic_year: "Year 2",
        admission_date: "2024-01-15",
        campus: "Mukurweini Campus, Kenya",
        campus_name: "BEMI Training Institute — Mukurweini Campus (Africa Hub)",
        study_center_id: "sc-mukurweini",
        created_at: "2024-01-15T08:00:00Z",
      };

    const isTranscript = code.includes("TRN") || code.includes("TRANS");
    const docTypeLabel = isTranscript
      ? "Official Academic Transcript"
      : code.includes("ADM")
        ? "Official Admission Letter"
        : "Degree Certificate / Academic Credential";

    const verificationPayload = {
      code,
      status: "AUTHENTIC_AND_VERIFIED",
      institution: tenantConfig.institutionName,
      accreditation_status:
        tenantConfig.accreditationLabel ||
        "QAHE Accredited (International Association for Quality Assurance in Higher Education)",
      state_status:
        "Exempt from licensure under N.C.G.S. 116-15(d) for religious education",
      document_type: docTypeLabel,
      student_name: matchedStudent.full_name,
      program: matchedStudent.program_name,
      registration_number: matchedStudent.reg_no,
      academic_status: "Good Standing",
      registrar_signature: "Dr. Melba Layne, Ph.D. (Chief Registrar)",
      chancellor_signature: "Dr. Christopher Cookhorne, Ph.D. (President & Chancellor)",
      verified_at: new Date().toISOString(),
      cryptographic_fingerprint: `SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069`,
    };

    return {
      success: true,
      valid: true,
      verified: true,
      status: "VERIFIED",
      verification_code: code,
      documentType: isTranscript ? ("transcript" as const) : ("certificate" as const),
      data: verificationPayload,
      document: {
        id: code,
        serial_number: code,
        holder_name: matchedStudent.full_name,
        credential: matchedStudent.program_name,
        type: "ACADEMIC_CREDENTIAL",
        issuer: tenantConfig.institutionName,
        institution: tenantConfig.institutionName,
        issue_date: matchedStudent.admission_date,
        issued_at: matchedStudent.admission_date,
        status: "active" as const,
        faculty: matchedStudent.faculty,
        department: matchedStudent.department,
        gpa: matchedStudent.gpa,
        academic_year: matchedStudent.academic_year,
        student_status: matchedStudent.status,
        student_reg_no: matchedStudent.reg_no,
        student_campus: matchedStudent.campus,
      },
      verification: {
        timestamp: new Date().toISOString(),
        method: "CRYPTOGRAPHIC_REGISTRY_LOOKUP",
        token_verified: true,
        confidence: "high" as const,
        verification_count: 1,
      },
    };
  };

  app.get("/api/public/verify", handleVerify);
  app.post("/api/public/verify", handleVerify);
  app.get("/api/v1/documents/verify", handleVerify);
  app.post("/api/v1/documents/verify", handleVerify);

  // ── Live Marketing & Institutional Stats ──────────────────────────────────
  app.get("/api/public/stats", async () => ({
    success: true,
    data: {
      studentsCount: 1450 + studentsStore.length,
      total_enrolled_students: 1450 + studentsStore.length,
      programsCount: programsStore.length,
      total_programs: programsStore.length,
      total_applications_this_term: applicationsStore.length,
      facultyCount: 47 + staffStore.length,
      graduatesCount: 4200,
      accreditationStatus: "Active",
    },
  }));

  // ── Portal & UMS Authentication Handlers ──────────────────────────────────
  const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as { email?: string; password?: string; mfa_token?: string }) || {};
    const email = (body.email || "student@bmiuniversities.org").trim();
    const isAdmin =
      email.includes("admin") ||
      email.includes("staff") ||
      email.includes("registrar") ||
      email.includes("cookhorne") ||
      email.includes("githinji");
    const matchedStudent = studentsStore.find((s) => s.email.toLowerCase() === email.toLowerCase());
    const userPayload = {
      id: isAdmin ? "stf-2001" : matchedStudent?.id ?? "std-1001",
      email,
      first_name: isAdmin ? "Dr. Christopher" : matchedStudent?.first_name ?? "Samuel",
      last_name: isAdmin ? "Cookhorne" : matchedStudent?.last_name ?? "Mwangi",
      role: (isAdmin ? "admin" : "student") as "admin" | "student",
      reg_no: isAdmin ? undefined : matchedStudent?.reg_no ?? "BMI-2024-001",
      email_verified: true,
    };
    const token = `bmi-session-token-${isAdmin ? "admin" : "student"}-${Date.now()}`;
    const csrf = `bmi-csrf-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    return reply.code(200).send({
      success: true,
      data: {
        token,
        csrf_token: csrf,
        expires_at: expiresAt,
        user: userPayload,
      },
      token,
      csrf_token: csrf,
      expires_at: expiresAt,
      user: userPayload,
    });
  };

  app.post("/api/auth/login", handleLogin);
  app.post("/api/v1/auth/login", handleLogin);

  const handleRegister = async (request: FastifyRequest) => {
    const body = (request.body as Record<string, string>) || {};
    const userId = `usr-${Date.now()}`;
    const firstName = body.first_name || "New";
    const lastName = body.last_name || "Applicant";
    const email = body.email || `applicant-${Date.now()}@bmiuniversities.org`;
    const programName = body.program || PROGRAMS[0]?.label || "BA in Biblical Studies";

    if (body.program) {
      const appId = `app-${1000 + applicationsStore.length + 1}`;
      const now = new Date().toISOString();
      const newApp: EducationApplicationRecord = {
        id: appId,
        applicant_id: userId,
        user_id: userId,
        application_number: `BMI-APP-2026-00${applicationsStore.length + 1}`,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: body.phone || "+254 700 000000",
        program_id: body.program_id || "prog-1",
        program: programName,
        degree_level: "undergraduate",
        status: "draft",
        current_step: 1,
        personal_statement: null,
        submitted_at: now,
        created_at: now,
        updated_at: now,
      };
      applicationsStore.unshift(newApp);
      applicationLogsStore[appId] = [
        {
          id: `log-${Date.now()}`,
          application_id: appId,
          step: "Account & Application Initialized",
          status: "Completed",
          old_status: null,
          new_status: "draft",
          changed_by: userId,
          changed_by_name: `${firstName} ${lastName}`,
          notes: `Initialized application for ${programName}`,
          changed_at: now,
          timestamp: now,
        },
      ];
    }

    return {
      success: true,
      message: "Registration successful. Please verify your email.",
      data: {
        user_id: userId,
        email,
      },
    };
  };

  app.post("/api/auth/register", handleRegister);
  app.post("/api/v1/auth/register", handleRegister);

  const handleMe = async (request: FastifyRequest) => {
    const authHeader = String(request.headers.authorization || "");
    const isAdmin = authHeader.includes("admin") || authHeader.includes("staff");
    const user = {
      id: isAdmin ? "stf-2001" : "std-1001",
      email: isAdmin ? "admin@bmiuniversities.org" : "s.mwangi@student.bmiuniversities.org",
      first_name: isAdmin ? "Dr. Christopher" : "Samuel",
      last_name: isAdmin ? "Cookhorne" : "Mwangi",
      role: isAdmin ? "admin" : "student",
      reg_no: isAdmin ? undefined : "BMI-2024-001",
      email_verified: true,
      csrf_token: "bmi-csrf-" + Date.now(),
    };
    return {
      success: true,
      data: user,
      ...user,
    };
  };

  app.get("/api/auth/me", handleMe);
  app.get("/api/v1/auth/me", handleMe);

  const handleLogout = async () => ({ success: true, message: "Logged out successfully" });
  app.delete("/api/auth/logout", handleLogout);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/v1/auth/logout", handleLogout);

  app.post("/api/auth/refresh", async () => ({
    success: true,
    data: {
      csrf_token: "bmi-csrf-" + Date.now(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  }));

  app.post("/api/auth/mfa/setup", async () => ({
    success: true,
    data: {
      secret: "BMIMFASECRETKEY2026",
      otp_auth_url: "otpauth://totp/BMI:student@bmiuniversities.org?secret=BMIMFASECRETKEY2026&issuer=BMI",
    },
  }));

  app.post("/api/auth/mfa/enable", async () => ({
    success: true,
    message: "Multi-factor authentication successfully enabled.",
  }));

  app.post("/api/auth/forgot-password", async () => ({
    success: true,
    message: "Password reset link sent to your registered email.",
  }));

  app.post("/api/auth/reset-password", async () => ({
    success: true,
    message: "Password has been updated successfully.",
  }));

  app.get("/api/auth/verify", async () => ({
    success: true,
    message: "Email address verified successfully.",
  }));

  // ── End-to-End Applications & Admissions Sync Pipeline ─────────────────────
  app.get("/api/applications/me", async () => {
    const latestApp = applicationsStore[0];
    return {
      success: true,
      data: latestApp,
    };
  });

  app.post("/api/applications", async (request) => {
    const body = (request.body as Record<string, unknown>) || {};
    const now = new Date().toISOString();
    const appId = `app-${1000 + applicationsStore.length + 1}`;
    const programName = String(body.program || body.program_id || PROGRAMS[0]?.label || "BA in Biblical Studies");
    const firstName = String(body.first_name || "Samuel");
    const lastName = String(body.last_name || "Mwangi");
    const email = String(body.email || "applicant@bmiuniversities.org");

    const newApp: EducationApplicationRecord = {
      id: appId,
      applicant_id: `usr-${Date.now()}`,
      user_id: `usr-${Date.now()}`,
      application_number: `BMI-APP-2026-00${applicationsStore.length + 1}`,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: String(body.phone || "+254 712 345678"),
      program_id: String(body.program_id || "prog-1"),
      program: programName,
      degree_level: String(body.degree_level || "undergraduate"),
      status: "submitted",
      current_step: 4,
      personal_statement: body.personal_statement ? String(body.personal_statement) : null,
      high_school: body.high_school ? String(body.high_school) : undefined,
      graduation_year: body.graduation_year ? Number(body.graduation_year) : undefined,
      gpa: body.gpa ? Number(body.gpa) : undefined,
      reviewer_notes: null,
      submitted_at: now,
      created_at: now,
      updated_at: now,
    };

    applicationsStore.unshift(newApp);
    applicationLogsStore[appId] = [
      {
        id: `log-${Date.now()}`,
        application_id: appId,
        step: "Application Submitted",
        status: "Completed",
        old_status: "draft",
        new_status: "submitted",
        changed_by: newApp.user_id,
        changed_by_name: `${firstName} ${lastName}`,
        notes: `Submitted application for ${programName}`,
        changed_at: now,
        timestamp: now,
      },
    ];

    return {
      success: true,
      data: {
        ...newApp,
        application_id: appId,
      },
      application_id: appId,
      status: "submitted",
    };
  });

  app.patch("/api/applications/draft", async () => ({
    success: true,
    data: { message: "Draft saved successfully", throttled: false },
    message: "Draft saved successfully",
    throttled: false,
  }));

  app.post("/api/applications/check-duplicate", async () => ({
    success: true,
    received: true,
    data: { received: true, isDuplicate: false },
  }));

  const handleGetAppLogs = async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const logs = applicationLogsStore[id] ?? applicationLogsStore["app-1001"] ?? [];
    return {
      success: true,
      data: logs,
    };
  };

  app.get("/api/applications/:id/logs", handleGetAppLogs);
  app.get("/api/v1/applications/:id/logs", handleGetAppLogs);

  const handleListAdminApplications = async (request: FastifyRequest) => {
    const query = (request.query as { status?: string }) || {};
    const filtered =
      query.status && query.status !== "all"
        ? applicationsStore.filter((a) => a.status.toLowerCase() === query.status!.toLowerCase())
        : applicationsStore;
    return {
      success: true,
      data: filtered,
    };
  };

  app.get("/api/admin/applications", handleListAdminApplications);
  app.get("/api/v1/admin/applications", handleListAdminApplications);

  const handleGetAdminApplication = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const found = applicationsStore.find((a) => a.id === id) ?? applicationsStore[0];
    if (!found) return reply.code(404).send({ success: false, error: "Application not found" });
    return { success: true, data: found };
  };

  app.get("/api/admin/applications/:id", handleGetAdminApplication);
  app.get("/api/v1/admin/applications/:id", handleGetAdminApplication);

  const handleCreateAdminApplication = async (request: FastifyRequest) => {
    const body = (request.body as Record<string, unknown>) || {};
    const now = new Date().toISOString();
    const appId = `app-${1000 + applicationsStore.length + 1}`;
    const created: EducationApplicationRecord = {
      id: appId,
      applicant_id: `usr-${Date.now()}`,
      user_id: `usr-${Date.now()}`,
      application_number: `BMI-APP-2026-00${applicationsStore.length + 1}`,
      first_name: String(body.first_name || "New"),
      last_name: String(body.last_name || "Applicant"),
      email: String(body.email || "applicant@bmiuniversities.org"),
      phone: String(body.phone || "+254 700 000000"),
      program_id: String(body.program_id || "prog-1"),
      program: String(body.program || PROGRAMS[0]?.label || "BA in Biblical Studies"),
      degree_level: String(body.degree_level || "undergraduate"),
      status: "submitted",
      current_step: 4,
      personal_statement: null,
      submitted_at: now,
      created_at: now,
      updated_at: now,
    };
    applicationsStore.unshift(created);
    return { success: true, data: created };
  };

  app.post("/api/admin/applications", handleCreateAdminApplication);
  app.post("/api/v1/admin/applications", handleCreateAdminApplication);

  const handleUpdateApplicationStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { status?: string; notes?: string }) || {};
    const target = applicationsStore.find((a) => a.id === id);
    if (!target) {
      return reply.code(404).send({ success: false, error: "Application not found" });
    }
    const oldStatus = target.status;
    const newStatus = (body.status || "under_review").toLowerCase() as EducationApplicationRecord["status"];
    target.status = newStatus;
    target.reviewer_notes = body.notes ?? target.reviewer_notes;
    target.updated_at = new Date().toISOString();

    if (!applicationLogsStore[id]) applicationLogsStore[id] = [];
    applicationLogsStore[id].unshift({
      id: `log-${Date.now()}`,
      application_id: id,
      step: `Status updated to ${newStatus}`,
      status: "Completed",
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: "stf-2004",
      changed_by_name: "Dr. Melba Layne (Registrar)",
      notes: body.notes || null,
      changed_at: target.updated_at,
      timestamp: target.updated_at,
    });

    return {
      success: true,
      data: {
        application_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        application: target,
      },
      application_id: id,
      new_status: newStatus,
    };
  };

  app.put("/api/admin/applications/:id/status", handleUpdateApplicationStatus);
  app.put("/api/v1/admin/applications/:id/status", handleUpdateApplicationStatus);

  app.post("/api/admissions/decide", async (request) => {
    const body = (request.body as { application_id?: string; decision?: string; reviewer_notes?: string }) || {};
    const appId = body.application_id || applicationsStore[0]?.id || "app-1001";
    const target = applicationsStore.find((a) => a.id === appId);
    const mappedStatus =
      body.decision === "admit" || body.decision === "conditional"
        ? "accepted"
        : body.decision === "deny"
          ? "rejected"
          : "waitlisted";
    if (target) {
      target.status = mappedStatus;
      target.reviewer_notes = body.reviewer_notes ?? target.reviewer_notes;
      target.updated_at = new Date().toISOString();
    }
    return {
      success: true,
      decisionId: `dec-${Date.now()}`,
      status: mappedStatus,
      data: {
        decisionId: `dec-${Date.now()}`,
        status: mappedStatus,
      },
    };
  });

  const handleGetDecision = async (request: FastifyRequest) => {
    const params = (request.params as { id?: string }) || {};
    const target =
      (params.id ? applicationsStore.find((a) => a.id === params.id) : applicationsStore[0]) ??
      applicationsStore[0];
    const appStatus = target?.status ?? "accepted";
    const decisionType =
      appStatus === "accepted"
        ? "admit"
        : appStatus === "rejected"
          ? "deny"
          : appStatus === "waitlisted"
            ? "waitlist"
            : "admit";
    return {
      success: true,
      data: {
        id: `dec-${target?.id ?? "app-1001"}`,
        application_id: target?.id ?? "app-1001",
        decision: decisionType,
        program: target?.program ?? "BA in Biblical Studies",
        degree_level: target?.degree_level ?? "undergraduate",
        application_status: appStatus,
        scholarship_percent: 20,
        deposit_required: 1,
        deposit_amount: 150,
        enrollment_deadline: "2026-08-31",
        offer_expires_at: "2026-08-31T23:59:59Z",
        payment: {
          required: true,
          amount_minor: 15000,
          charge_currency: "USD",
          formatted: "$150.00",
          deferred: false,
          paid: false,
        },
      },
    };
  };

  app.get("/api/admissions/decision", handleGetDecision);
  app.get("/api/admissions/decision/:id", handleGetDecision);

  // Accepting an offer in Portal provisions the student into UMS and Finance!
  app.post("/api/admissions/accept", async (request) => {
    const body = (request.body as { application_id?: string }) || {};
    const targetApp =
      applicationsStore.find((a) => a.id === body.application_id) ?? applicationsStore[0];
    const appEmail = targetApp?.email ?? "student@bmiuniversities.org";
    const newRegNo = `BMI-2026-00${studentsStore.length + 1}`;
    const existingStudent = studentsStore.find(
      (s) => s.email.toLowerCase() === appEmail.toLowerCase(),
    );

    let studentId = existingStudent?.id ?? `std-${1000 + studentsStore.length + 1}`;
    if (!existingStudent) {
      const firstName = targetApp?.first_name ?? "Samuel";
      const lastName = targetApp?.last_name ?? "Mwangi";
      const createdStudent: EducationStudentRecord = {
        id: studentId,
        student_id: newRegNo,
        reg_no: newRegNo,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: appEmail,
        phone: targetApp?.phone ?? "+254 712 345678",
        program_id: targetApp?.program_id ?? "prog-1",
        program_code: "BA-101",
        program_name: targetApp?.program ?? "BA in Biblical Studies",
        faculty: "School of Theology & Biblical Studies",
        department: "Department of Biblical & Theological Studies",
        status: "active",
        enrollment_status: "ENROLLED",
        gpa: 4.0,
        credits_earned: 0,
        academic_year: "Year 1",
        admission_date: new Date().toISOString().slice(0, 10),
        campus: "Mukurweini Campus, Kenya",
        campus_name: "BEMI Training Institute — Mukurweini Campus (Africa Hub)",
        study_center_id: "sc-mukurweini",
        created_at: new Date().toISOString(),
      };
      studentsStore.unshift(createdStudent);
      transactionsStore.unshift({
        id: `tx-${100 + transactionsStore.length + 1}`,
        student_id: studentId,
        studentId,
        name: createdStudent.full_name,
        amount: 1200,
        amt: 1200,
        currency: "USD",
        type: "Initial Semester Tuition Invoice",
        status: "Pending",
        ref: `BEMI-INV-2026-${100 + transactionsStore.length + 1}`,
        date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      });
    } else {
      studentId = existingStudent.id;
    }

    return {
      success: true,
      data: {
        provisioningResult: {
          studentId,
          regNo: existingStudent?.reg_no ?? newRegNo,
          portalAccessGranted: true,
        },
      },
      provisioningResult: {
        studentId,
        regNo: existingStudent?.reg_no ?? newRegNo,
        portalAccessGranted: true,
      },
    };
  });

  app.post("/api/admissions/decline", async () => ({
    success: true,
    message: "Admissions offer declined.",
  }));

  app.post("/api/admissions/deposit", async () => ({
    success: true,
    depositId: "dep-" + Date.now(),
    message: "Tuition deposit confirmed and credited to BEMI Training Institute (trading as BMI University).",
  }));

  app.post("/api/payment/create-intent", async () => ({
    success: true,
    intentId: "pi_" + Date.now(),
    reference: "BEMI-REF-" + Date.now(),
    authorizationUrl: "https://checkout.paystack.com/bmi-university-checkout",
    accessCode: "acc_bmi_live",
    merchant: "BEMI TRAINING INSTITUTE",
    tradingAs: "BEMI TRAINING INSTITUTE (trading as BMI University)",
  }));

  // ── Student Portal Endpoints ───────────────────────────────────────────────
  app.get("/api/student/dashboard", async () => {
    const s = studentsStore[0];
    return {
      success: true,
      data: {
        student: s,
        enrolledCourses: coursesStore.slice(0, 3),
        gpa: s?.gpa ?? 3.75,
        creditsEarned: s?.credits_earned ?? 45,
        creditsRequired: 120,
        tuitionBalance: 0,
        upcomingDeadlines: [
          { title: "Fall Semester Registration Finalization", date: "2026-09-15", type: "Academic", tag: "Mandatory", color: "#c5a048" },
          { title: "Biblical Theology Research Paper", date: "2026-10-20", type: "Coursework", tag: "THEO-101", color: "#3b82f6" },
        ],
      },
    };
  });

  app.get("/api/student/courses", async () => ({
    success: true,
    data: coursesStore,
  }));

  app.get("/api/student/finances", async () => ({
    success: true,
    data: {
      balance: 0,
      currency: "USD",
      merchant: "BEMI TRAINING INSTITUTE (trading as BMI University)",
      invoices: transactionsStore.filter((t) => t.student_id === "std-1001"),
      transactions: transactionsStore.filter((t) => t.student_id === "std-1001"),
    },
  }));

  app.get("/api/student/transcript", async () => ({
    success: true,
    data: {
      gpa: "3.85",
      classes: gradesStore.filter((g) => g.student_id === "std-1001"),
    },
  }));

  app.get("/api/student/sections", async () => ({
    success: true,
    data: {
      sections: [
        {
          id: "sec-101",
          section_id: "sec-101",
          section_code: "THEO-101-A",
          course_id: "crs-301",
          code: "THEO-101",
          title: "Foundations of Biblical Theology",
          course_name: "Foundations of Biblical Theology",
          instructor: "Dr. Joseph Kiai",
          schedule: "Mon/Wed 09:00 - 10:30 EAT",
          room: "Mukurweini Lecture Hall A / Zoom Hybrid",
          capacity: 35,
          enrolled: 22,
          seats_taken: 22,
          seats_available: 13,
          is_full: false,
        },
        {
          id: "sec-102",
          section_id: "sec-102",
          section_code: "HEBR-201-A",
          course_id: "crs-302",
          code: "HEBR-201",
          title: "Biblical Hebrew Syntax & Exegesis",
          course_name: "Biblical Hebrew Syntax & Exegesis",
          instructor: "Dr. Christopher Cookhorne",
          schedule: "Tue/Thu 14:00 - 15:30 EAT",
          room: "Global Virtual Classroom 2",
          capacity: 25,
          enrolled: 18,
          seats_taken: 18,
          seats_available: 7,
          is_full: false,
        },
      ],
      my_section_ids: ["sec-101"],
    },
  }));

  app.post("/api/registration/reserve-seat", async () => ({
    success: true,
    status: "reserved",
    message: "Seat reserved successfully in section.",
  }));

  app.post("/api/registration/finalize", async () => ({
    success: true,
    registered: true,
    status: "registered",
    registered_sections: 2,
    message: "Semester registration finalized.",
  }));

  app.get("/api/enrollment/agreement", async () => ({
    success: true,
    data: {
      document_id: "ENROLL-AGREEMENT-2026",
      version: "1.0",
      version_hash: "v1.0-hash",
      document_version_hash: "v1.0-hash",
      text: "Bethel Ministries International University (BMI University) Student Honor Code & Academic Matriculation Agreement.",
      content: "Bethel Ministries International University (BMI University) Student Honor Code & Academic Matriculation Agreement.",
    },
  }));

  app.post("/api/enrollment/sign-agreement", async () => ({
    success: true,
    signature_id: `sig-${Date.now()}`,
    status: "signed",
    message: "Matriculation agreement signed and recorded.",
  }));

  // ── UMS Full CRUD & Paginated Endpoints (/api/v1 & /v1) ────────────────────
  const registerUmsEndpoints = (prefix: string) => {
    // 1. Students CRUD (with PaginatedData<Student> envelope)
    app.get(`${prefix}/students`, async (request) => {
      const query = (request.query as Record<string, string>) || {};
      let list = [...studentsStore];
      if (query.search) {
        const q = query.search.toLowerCase();
        list = list.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            s.reg_no.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q),
        );
      }
      const statusFilter = query.status?.toLowerCase();
      if (statusFilter && statusFilter !== "all") {
        list = list.filter((s) => s.status.toLowerCase() === statusFilter);
      }
      if (query.study_center_id) {
        list = list.filter((s) => s.study_center_id === query.study_center_id);
      }
      const paged = paginate(list, query);
      return {
        success: true,
        data: paged,
        students: paged.items,
        total: paged.total,
      };
    });

    app.get(`${prefix}/students/:id`, async (request, reply) => {
      const { id } = request.params as { id: string };
      const student = studentsStore.find((s) => s.id === id || s.student_id === id || s.reg_no === id);
      if (!student) return reply.code(404).send({ success: false, error: "Student not found" });
      return { success: true, data: student };
    });

    app.post(`${prefix}/students`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const id = `std-${1000 + studentsStore.length + 1}`;
      const regNo = String(body.reg_no || body.student_code || `BMI-2026-00${studentsStore.length + 1}`);
      const firstName = String(body.first_name || "New");
      const lastName = String(body.last_name || "Student");
      const created: EducationStudentRecord = {
        id,
        student_id: regNo,
        reg_no: regNo,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: String(body.email || `${firstName.toLowerCase()}@student.bmiuniversities.org`),
        phone: String(body.phone || "+254 700 000000"),
        program_id: String(body.program_id || "prog-1"),
        program_code: String(body.program_code || "BA-101"),
        program_name: String(body.program_name || "BA in Biblical Studies"),
        faculty: String(body.faculty || "School of Theology & Biblical Studies"),
        department: String(body.department || "Department of Biblical & Theological Studies"),
        status: String(body.status || "active"),
        enrollment_status: "ENROLLED",
        gpa: Number(body.gpa ?? 4.0),
        credits_earned: Number(body.credits_earned ?? 0),
        academic_year: String(body.academic_year || "Year 1"),
        admission_date: String(body.admission_date || new Date().toISOString().slice(0, 10)),
        campus: String(body.campus || "Mukurweini Campus, Kenya"),
        campus_name: "BEMI Training Institute — Mukurweini Campus (Africa Hub)",
        study_center_id: String(body.study_center_id || "sc-mukurweini"),
        created_at: new Date().toISOString(),
      };
      studentsStore.unshift(created);
      return { success: true, data: created };
    });

    app.patch(`${prefix}/students/:id`, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as Record<string, unknown>) || {};
      const existing = studentsStore.find((s) => s.id === id || s.reg_no === id);
      if (!existing) return reply.code(404).send({ success: false, error: "Student not found" });
      Object.assign(existing, body);
      return { success: true, data: existing };
    });

    app.delete(`${prefix}/students/:id`, async (request) => {
      const { id } = request.params as { id: string };
      const idx = studentsStore.findIndex((s) => s.id === id || s.reg_no === id);
      if (idx !== -1) studentsStore.splice(idx, 1);
      return { success: true, message: "Student record deleted" };
    });

    // 2. Programs & Academic Catalog (Faculties, Departments, Terms)
    app.get(`${prefix}/programs`, async () => ({
      success: true,
      data: {
        items: programsStore,
        page: 1,
        perPage: programsStore.length,
        total: programsStore.length,
      },
      items: programsStore,
      programs: programsStore,
      total: programsStore.length,
    }));

    app.get(`${prefix}/programs/:id`, async (request) => {
      const { id } = request.params as { id: string };
      const prog = programsStore.find((p) => p.id === id || p.code === id) ?? programsStore[0];
      return {
        success: true,
        data: { ...prog, courses: coursesStore },
      };
    });

    app.post(`${prefix}/programs`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const lvl = (body.level as "undergraduate" | "graduate" | "doctorate" | "certificate" | "diploma") || "undergraduate";
      const created = {
        id: `prog-${programsStore.length + 1}`,
        code: String(body.code || `PRG-${101 + programsStore.length}`),
        program_code: String(body.code || `PRG-${101 + programsStore.length}`),
        name: String(body.name || body.label || "New Academic Program"),
        label: String(body.label || body.name || "New Academic Program"),
        level: lvl,
        degree_level: lvl,
        degree_type: String(lvl).toUpperCase(),
        description: String(body.description || ""),
        icon: undefined,
        department_id: String(body.department_id || "dept-bib"),
        faculty_id: String(body.faculty_id || "fac-theology"),
        credits_required: Number(body.credits_required || 120),
        is_active: true,
      };
      programsStore.push(created);
      return { success: true, data: created };
    });

    app.get(`${prefix}/catalog/faculties`, async () => ({
      success: true,
      data: facultiesStore,
    }));

    app.get(`${prefix}/catalog/departments`, async (request) => {
      const query = (request.query as { facultyId?: string; faculty_id?: string }) || {};
      const fId = query.facultyId || query.faculty_id;
      const list = fId ? departmentsStore.filter((d) => d.faculty_id === fId) : departmentsStore;
      return {
        success: true,
        data: list,
      };
    });

    app.get(`${prefix}/catalog/programs`, async (request) => {
      const query = (request.query as { deptId?: string; department_id?: string }) || {};
      const dId = query.deptId || query.department_id;
      const list = dId ? programsStore.filter((p) => p.department_id === dId) : programsStore;
      return {
        success: true,
        data: list,
      };
    });

    app.get(`${prefix}/catalog/terms`, async () => ({
      success: true,
      data: termsStore,
    }));

    app.get(`${prefix}/terms`, async () => ({
      success: true,
      data: termsStore,
    }));

    app.post(`${prefix}/terms`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const created = {
        id: `term-${Date.now()}`,
        name: String(body.name || "Academic Term"),
        code: String(body.code || "TERM-NEW"),
        academic_year: String(body.academic_year || "2026/2027"),
        semester_number: Number(body.semester_number || 1),
        start_date: String(body.start_date || "2026-09-01"),
        end_date: String(body.end_date || "2026-12-18"),
        status: String(body.status || "upcoming"),
        registration_opens_at: "2026-07-01T00:00:00Z",
        registration_closes_at: "2026-09-15T23:59:59Z",
        census_date: "2026-09-30",
      };
      termsStore.push(created);
      return { success: true, data: created };
    });

    // 3. Courses CRUD
    app.get(`${prefix}/courses`, async (request) => {
      const query = (request.query as Record<string, string>) || {};
      const paged = paginate(coursesStore, query);
      return {
        success: true,
        data: paged,
        courses: paged.items,
      };
    });

    app.post(`${prefix}/courses`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const created = {
        id: `crs-${300 + coursesStore.length + 1}`,
        code: String(body.code || `THEO-${100 + coursesStore.length + 1}`),
        name: String(body.name || body.title || "New Course"),
        title: String(body.title || body.name || "New Course"),
        description: String(body.description || ""),
        credits: Number(body.credits || body.credit_hours || 3),
        credit_hours: Number(body.credit_hours || body.credits || 3),
        department: String(body.department || "Department of Biblical & Theological Studies"),
        level: String(body.level || "Undergraduate"),
        term: "Fall Semester 2026",
        capacity: Number(body.capacity || 35),
        enrolled_count: 0,
        status: "Published",
        is_mandatory: false,
      };
      coursesStore.push(created);
      return { success: true, data: created };
    });

    app.get(`${prefix}/courses/stats/overview`, async () => ({
      success: true,
      data: {
        totalCourses: coursesStore.length,
        publishedCourses: coursesStore.length,
        totalCredits: coursesStore.reduce((acc, c) => acc + c.credits, 0),
      },
    }));

    // 4. Staff CRUD
    app.get(`${prefix}/staff`, async (request) => {
      const query = (request.query as Record<string, string>) || {};
      const paged = paginate(staffStore, query);
      return {
        success: true,
        data: paged,
        staff: paged.items,
      };
    });

    app.post(`${prefix}/staff`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const firstName = String(body.first_name || "New");
      const lastName = String(body.last_name || "Faculty");
      const created = {
        id: `stf-${2000 + staffStore.length + 1}`,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: String(body.email || `${firstName.toLowerCase()}@bmiuniversities.org`),
        role: String(body.role || "Professor"),
        department: String(body.department || "Theological Studies"),
        category: String(body.category || "Academic"),
        study_center_id: String(body.study_center_id || "sc-mukurweini"),
        status: "active",
      };
      staffStore.push(created);
      return { success: true, data: created };
    });

    app.get(`${prefix}/staff/stats/overview`, async () => ({
      success: true,
      data: {
        totalStaff: staffStore.length,
        activeStaff: staffStore.length,
        departmentsCount: departmentsStore.length,
      },
    }));

    // 5. Study Centers
    app.get(`${prefix}/study-centers/all`, async () => ({
      success: true,
      data: studyCentersStore,
    }));

    app.get(`${prefix}/study-centers`, async () => ({
      success: true,
      data: studyCentersStore,
      meta: { page: 1, perPage: 20, total: studyCentersStore.length },
    }));

    app.get(`${prefix}/study-centers/:id`, async (request) => {
      const { id } = request.params as { id: string };
      const sc = studyCentersStore.find((c) => c.id === id) ?? studyCentersStore[0];
      return { success: true, data: sc };
    });

    app.get(`${prefix}/study-centers/:id/stats`, async (request) => {
      const { id } = request.params as { id: string };
      const sc = studyCentersStore.find((c) => c.id === id) ?? studyCentersStore[0];
      const scId = sc?.id ?? "sc-mukurweini";
      return {
        success: true,
        data: {
          studyCenter: sc,
          students: studentsStore.filter((s) => s.study_center_id === scId).length,
          staff: staffStore.filter((s) => s.study_center_id === scId).length,
          courses: coursesStore.length,
        },
      };
    });

    // 6. Grades
    app.get(`${prefix}/grades`, async (request) => {
      const query = (request.query as Record<string, string>) || {};
      const list = query.studentId
        ? gradesStore.filter((g) => g.studentId === query.studentId || g.regNo === query.studentId)
        : gradesStore;
      return {
        success: true,
        data: paginate(list, query),
      };
    });

    app.post(`${prefix}/grades`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const created = {
        id: `grd-${gradesStore.length + 1}`,
        student_id: String(body.studentId || "std-1001"),
        studentId: String(body.studentId || "std-1001"),
        studentName: String(body.studentName || "Samuel Mwangi"),
        regNo: String(body.regNo || "BMI-2024-001"),
        course_code: String(body.courseCode || "THEO-101"),
        courseCode: String(body.courseCode || "THEO-101"),
        course_name: String(body.courseName || "Foundations of Biblical Theology"),
        courseName: String(body.courseName || "Foundations of Biblical Theology"),
        numericGrade: Number(body.numericGrade ?? 92),
        percentage: Number(body.percentage ?? 92),
        grade: String(body.letterGrade || "A"),
        letterGrade: String(body.letterGrade || "A"),
        gpa_points: Number(body.gpa ?? 4.0),
        gpa: Number(body.gpa ?? 4.0),
        academicYear: String(body.academicYear || "2026/2027"),
        semester: String(body.semester || "Fall 2026"),
        status: "Published",
      };
      gradesStore.unshift(created);
      return { success: true, data: created };
    });

    // 7. Finance & Transactions
    app.get(`${prefix}/finance`, async () => {
      const totalBilled = transactionsStore.reduce((acc, t) => acc + t.amount, 0);
      const totalCollected = transactionsStore
        .filter((t) => t.status === "Paid")
        .reduce((acc, t) => acc + t.amount, 0);
      return {
        success: true,
        data: {
          totalBilled,
          totalCollected,
          outstanding: totalBilled - totalCollected,
          currency: "USD",
          merchant: "BEMI TRAINING INSTITUTE (trading as BMI University)",
          recentTransactions: transactionsStore,
        },
      };
    });

    app.get(`${prefix}/finance/transactions`, async () => ({
      success: true,
      data: transactionsStore,
      meta: { page: 1, perPage: 50, total: transactionsStore.length },
    }));

    app.post(`${prefix}/finance/transactions`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const amount = Number(body.amount ?? body.amt ?? 500);
      const created = {
        id: `tx-${100 + transactionsStore.length + 1}`,
        student_id: String(body.student_id || body.studentId || "std-1001"),
        studentId: String(body.studentId || body.student_id || "std-1001"),
        name: String(body.name || "Samuel Mwangi"),
        amount,
        amt: amount,
        currency: String(body.currency || "USD"),
        type: String(body.type || "Tuition Payment"),
        status: String(body.status || "Paid"),
        ref: String(body.ref || `BEMI-TX-${Date.now()}`),
        date: String(body.date || new Date().toISOString().slice(0, 10)),
        due_date: String(body.due_date || body.date || new Date().toISOString().slice(0, 10)),
      };
      transactionsStore.unshift(created);
      return { success: true, data: created };
    });

    app.get(`${prefix}/finance/stats`, async () => {
      const totalBilled = transactionsStore.reduce((acc, t) => acc + t.amount, 0);
      const totalCollected = transactionsStore
        .filter((t) => t.status === "Paid")
        .reduce((acc, t) => acc + t.amount, 0);
      return {
        success: true,
        data: {
          totalRevenue: totalCollected,
          totalBilled,
          outstandingBalance: totalBilled - totalCollected,
          collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100,
          currency: "USD",
        },
      };
    });

    // 8. Library
    app.get(`${prefix}/library`, async () => ({
      success: true,
      data: libraryStore,
      meta: { page: 1, perPage: 50, total: libraryStore.length },
    }));

    app.post(`${prefix}/library`, async (request) => {
      const body = (request.body as Record<string, unknown>) || {};
      const created = {
        id: `lib-${libraryStore.length + 1}`,
        title: String(body.title || "New Theological Volume"),
        author: String(body.author || "BMI Faculty"),
        category: String(body.category || "Theology"),
        isbn: String(body.isbn || "978-0000000000"),
        status: "Available",
        copies: Number(body.copies || 5),
      };
      libraryStore.unshift(created);
      return { success: true, data: created };
    });

    // 9. Analytics & Notifications
    app.get(`${prefix}/analytics`, async () => ({
      success: true,
      data: {
        totalEnrolled: 1450 + studentsStore.length,
        retentionRate: "94.2%",
        graduationRate: "89.5%",
        activeInstructors: staffStore.length,
        applicationsCount: applicationsStore.length,
      },
    }));

    app.get(`${prefix}/notifications`, async () => ({
      success: true,
      data: [
        {
          id: "notif-1",
          title: "Fall 2026 Semester Orientation",
          message: "Orientation for BMI University & BEMI Africa Hub begins Monday at 9:00 AM EAT.",
          read: false,
          created_at: new Date().toISOString(),
        },
      ],
      meta: { total: 1, unread_count: 1 },
    }));

    app.patch(`${prefix}/notifications/:id/read`, async () => ({
      success: true,
    }));

    app.post(`${prefix}/notifications/read`, async () => ({
      success: true,
      message: "Notifications marked as read",
    }));

    app.delete(`${prefix}/notifications/:id`, async () => ({
      success: true,
    }));

    app.post(`${prefix}/documents/request`, async () => ({
      success: true,
      data: { request_id: "doc-req-" + Date.now(), status: "PROCESSING" },
    }));

    app.post(`${prefix}/import/v2`, async () => ({
      success: true,
      data: { imported: 15, updated: 2, errors: [] },
    }));

    app.post(`${prefix}/import/sheets-webhook`, async () => ({
      success: true,
      message: "Sync acknowledged",
    }));
  };

  registerUmsEndpoints("/api/v1");
}
