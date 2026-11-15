import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PROGRAMS } from "@bazion/education-contracts";

const mockStudents = [
  {
    id: "std-1001",
    student_id: "BMI-2024-001",
    first_name: "Samuel",
    last_name: "Mwangi",
    email: "s.mwangi@student.bmi.ac.ke",
    phone: "+254 712 345678",
    program_id: "bachelor-theology",
    program_name: "Bachelor of Theology",
    status: "active",
    enrollment_status: "ENROLLED",
    gpa: 3.75,
    credits_earned: 45,
    academic_year: "Year 2",
    campus: "Main Campus",
    created_at: "2024-01-15T08:00:00Z",
  },
  {
    id: "std-1002",
    student_id: "BMI-2024-002",
    first_name: "Grace",
    last_name: "Achieng",
    email: "g.achieng@student.bmi.ac.ke",
    phone: "+254 723 456789",
    program_id: "bachelor-biblical-studies",
    program_name: "Bachelor of Biblical Studies",
    status: "active",
    enrollment_status: "ENROLLED",
    gpa: 3.9,
    credits_earned: 60,
    academic_year: "Year 2",
    campus: "Main Campus",
    created_at: "2024-01-16T08:00:00Z",
  },
  {
    id: "std-1003",
    student_id: "BMI-2024-003",
    first_name: "David",
    last_name: "Kimani",
    email: "d.kimani@student.bmi.ac.ke",
    phone: "+254 734 567890",
    program_id: "master-divinity",
    program_name: "Master of Divinity",
    status: "active",
    enrollment_status: "ENROLLED",
    gpa: 3.82,
    credits_earned: 28,
    academic_year: "Year 1",
    campus: "Online",
    created_at: "2024-02-01T08:00:00Z",
  },
];

const mockStaff = [
  {
    id: "stf-2001",
    first_name: "Dr. Joseph",
    last_name: "Kamau",
    email: "j.kamau@bmi.ac.ke",
    role: "Dean of Theology",
    department: "Theological Studies",
    status: "active",
  },
  {
    id: "stf-2002",
    first_name: "Prof. Sarah",
    last_name: "Mutua",
    email: "s.mutua@bmi.ac.ke",
    role: "Registrar",
    department: "Academic Affairs",
    status: "active",
  },
];

const mockCourses = [
  {
    id: "crs-301",
    code: "THEO-101",
    name: "Foundations of Biblical Theology",
    credits: 3,
    department: "Theology",
    level: "Undergraduate",
  },
  {
    id: "crs-302",
    code: "HEBR-201",
    name: "Biblical Hebrew Syntax",
    credits: 3,
    department: "Biblical Languages",
    level: "Undergraduate",
  },
  {
    id: "crs-303",
    code: "LEAD-401",
    name: "Pastoral Leadership & Ethics",
    credits: 4,
    department: "Practical Ministries",
    level: "Postgraduate",
  },
];

export async function bmiApiRoutes(app: FastifyInstance) {
  // Public program listings
  app.get("/api/public/programs", async () => ({
    success: true,
    data: PROGRAMS,
    programs: PROGRAMS,
  }));

  app.get("/api/programs", async () => ({
    success: true,
    data: PROGRAMS,
    programs: PROGRAMS,
  }));

  // Public tuition and fees
  app.get("/api/public/fees", async () => ({
    success: true,
    data: {
      tuition: [
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

  // Public contact
  app.post("/api/public/contact", async (request) => {
    return {
      success: true,
      message: "Thank you for contacting us. Our admissions and academic team will get back to you shortly.",
      received: request.body,
    };
  });

  // Public & Academic verification
  const handleVerify = async (request: FastifyRequest) => {
    const query = (request.query as Record<string, string>) || {};
    const body = (request.body as Record<string, string>) || {};
    const code = query.code || query.id || body.code || body.id || body.document_id || "VERIFIED-DEMO";
    return {
      success: true,
      verified: true,
      status: "VERIFIED",
      verification_code: code,
      document: {
        id: code,
        type: "ACADEMIC_CREDENTIAL",
        issuer: "Bible Missionary Institute & University",
        issue_date: "2024-06-25",
        status: "OFFICIAL_AND_VALID",
      },
    };
  };

  app.get("/api/public/verify", handleVerify);
  app.post("/api/public/verify", handleVerify);
  app.get("/api/v1/documents/verify", handleVerify);
  app.post("/api/v1/documents/verify", handleVerify);
  app.get("/v1/documents/verify", handleVerify);
  app.post("/v1/documents/verify", handleVerify);

  // Marketing Stats
  app.get("/api/public/stats", async () => ({
    success: true,
    data: {
      studentsCount: 1450,
      programsCount: PROGRAMS.length,
      facultyCount: 52,
      graduatesCount: 4200,
      accreditationStatus: "Active",
    },
  }));

  // Portal & UMS Authentication Handlers
  const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as { email?: string; password?: string; mfa_token?: string }) || {};
    const email = body.email || "student@bmi.ac.ke";
    const isAdmin = email.includes("admin") || email.includes("staff");
    return reply.code(200).send({
      success: true,
      data: {
        token: "mock-education-jwt-token-" + Date.now(),
        csrf_token: "mock-education-csrf-" + Date.now(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        user: {
          id: isAdmin ? "stf-2001" : "std-1001",
          email,
          first_name: isAdmin ? "Dr. Joseph" : "Samuel",
          last_name: isAdmin ? "Kamau" : "Mwangi",
          role: isAdmin ? "admin" : "student",
          email_verified: true,
        },
      },
      token: "mock-education-jwt-token-" + Date.now(),
      csrf_token: "mock-education-csrf-" + Date.now(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      user: {
        id: isAdmin ? "stf-2001" : "std-1001",
        email,
        first_name: isAdmin ? "Dr. Joseph" : "Kamau",
        last_name: isAdmin ? "Kamau" : "Mwangi",
        role: isAdmin ? "admin" : "student",
        email_verified: true,
      },
    });
  };

  app.post("/api/auth/login", handleLogin);
  app.post("/api/v1/auth/login", handleLogin);
  app.post("/v1/auth/login", handleLogin);

  const handleRegister = async (request: FastifyRequest) => {
    const body = (request.body as Record<string, string>) || {};
    return {
      success: true,
      message: "Registration successful. Please verify your email.",
      data: {
        user_id: "std-" + Date.now(),
        email: body.email,
      },
    };
  };

  app.post("/api/auth/register", handleRegister);
  app.post("/api/v1/auth/register", handleRegister);
  app.post("/v1/auth/register", handleRegister);

  const handleMe = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization || "";
    const isAdmin = authHeader.includes("admin") || authHeader.includes("staff");
    return {
      success: true,
      data: {
        id: isAdmin ? "stf-2001" : "std-1001",
        email: isAdmin ? "admin@bmi.ac.ke" : "student@bmi.ac.ke",
        first_name: isAdmin ? "Dr. Joseph" : "Samuel",
        last_name: isAdmin ? "Kamau" : "Mwangi",
        role: isAdmin ? "admin" : "student",
        email_verified: true,
        csrf_token: "mock-education-csrf-" + Date.now(),
      },
      id: isAdmin ? "stf-2001" : "std-1001",
      email: isAdmin ? "admin@bmi.ac.ke" : "student@bmi.ac.ke",
      first_name: isAdmin ? "Dr. Joseph" : "Samuel",
      last_name: isAdmin ? "Kamau" : "Mwangi",
      role: isAdmin ? "admin" : "student",
      email_verified: true,
      csrf_token: "mock-education-csrf-" + Date.now(),
    };
  };

  app.get("/api/auth/me", handleMe);
  app.get("/api/v1/auth/me", handleMe);
  app.get("/v1/auth/me", handleMe);

  const handleLogout = async () => ({ success: true, message: "Logged out successfully" });
  app.delete("/api/auth/logout", handleLogout);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/v1/auth/logout", handleLogout);
  app.post("/v1/auth/logout", handleLogout);

  app.post("/api/auth/refresh", async () => ({
    success: true,
    data: {
      csrf_token: "mock-csrf-" + Date.now(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  }));

  app.post("/api/auth/mfa/setup", async () => ({
    success: true,
    data: {
      secret: "MOCKMFASECRETKEY2026",
      otp_auth_url: "otpauth://totp/BMI:demo@bmi.ac.ke?secret=MOCKMFASECRETKEY2026&issuer=BMI",
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

  // Applications & Admissions
  app.get("/api/applications/me", async () => ({
    success: true,
    data: {
      id: "app-1001",
      program_id: "bachelor-theology",
      program: "Bachelor of Theology",
      degree_level: "undergraduate",
      status: "submitted",
      current_step: 3,
      submitted_at: "2024-05-10T12:00:00Z",
    },
  }));

  app.post("/api/applications", async (request) => {
    const body = (request.body as Record<string, unknown>) || {};
    return {
      success: true,
      data: {
        application_id: "app-" + Date.now(),
        status: "submitted",
        ...body,
      },
      application_id: "app-" + Date.now(),
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

  app.get("/api/applications/:id/logs", async () => ({
    success: true,
    data: [
      { step: "Application Created", status: "Completed", timestamp: "2024-05-10T10:00:00Z" },
      { step: "Documents Uploaded", status: "Completed", timestamp: "2024-05-10T11:30:00Z" },
      { step: "Application Submitted", status: "Completed", timestamp: "2024-05-10T12:00:00Z" },
    ],
  }));

  app.get("/api/admin/applications", async () => ({
    success: true,
    data: [
      {
        id: "app-1001",
        first_name: "Samuel",
        last_name: "Mwangi",
        email: "s.mwangi@example.com",
        program_id: "bachelor-theology",
        program: "Bachelor of Theology",
        degree_level: "undergraduate",
        status: "submitted",
        created_at: "2024-05-10T12:00:00Z",
      },
    ],
  }));

  app.get("/api/admissions/decision", async () => ({
    success: true,
    data: {
      decision: "accepted",
      program: "Bachelor of Theology",
      scholarship_percent: 20,
      enrollment_deadline: "2024-08-31",
    },
  }));

  app.get("/api/admissions/decision/:id", async () => ({
    success: true,
    data: {
      decision: "accepted",
      program: "Bachelor of Theology",
      scholarship_percent: 20,
      enrollment_deadline: "2024-08-31",
    },
  }));

  app.post("/api/admissions/accept", async () => ({
    success: true,
    data: {
      provisioningResult: {
        studentId: "std-1001",
        portalAccessGranted: true,
      },
    },
    provisioningResult: {
      studentId: "std-1001",
      portalAccessGranted: true,
    },
  }));

  app.post("/api/admissions/decline", async () => ({
    success: true,
    message: "Admissions offer declined.",
  }));

  app.post("/api/admissions/deposit", async () => ({
    success: true,
    depositId: "dep-" + Date.now(),
    message: "Tuition deposit confirmed.",
  }));

  app.post("/api/payment/create-intent", async () => ({
    success: true,
    intentId: "pi_" + Date.now(),
    reference: "REF-" + Date.now(),
    authorizationUrl: "https://checkout.paystack.com/demo-checkout",
    accessCode: "acc_demo_code",
  }));

  // Student course registration & enrollment
  app.get("/api/student/sections", async () => ({
    success: true,
    data: [
      {
        section_id: "sec-101",
        course_id: "crs-301",
        course_name: "Foundations of Biblical Theology",
        instructor: "Dr. Joseph Kamau",
        schedule: "Mon/Wed 09:00 - 10:30",
        capacity: 35,
        enrolled: 22,
      },
      {
        section_id: "sec-102",
        course_id: "crs-302",
        course_name: "Biblical Hebrew Syntax",
        instructor: "Prof. Sarah Mutua",
        schedule: "Tue/Thu 11:00 - 12:30",
        capacity: 25,
        enrolled: 18,
      },
    ],
  }));

  app.post("/api/registration/reserve-seat", async () => ({
    success: true,
    message: "Seat reserved successfully in section.",
  }));

  app.post("/api/registration/finalize", async () => ({
    success: true,
    registered: true,
    message: "Semester registration finalized.",
  }));

  app.get("/api/enrollment/agreement", async () => ({
    success: true,
    data: {
      document_id: "ENROLL-AGREEMENT-2026",
      version: "1.0",
      document_version_hash: "v1.0-hash",
      content: "Student Honor Code & Academic Matriculation Agreement...",
    },
  }));

  app.post("/api/enrollment/sign-agreement", async () => ({
    success: true,
    message: "Matriculation agreement signed and recorded.",
  }));

  // UMS Endpoints (served under both /api/v1 and /v1)
  const registerUmsEndpoints = (prefix: string) => {
    app.get(`${prefix}/students`, async () => ({
      success: true,
      data: mockStudents,
      students: mockStudents,
      total: mockStudents.length,
    }));

    app.get(`${prefix}/students/:id`, async (request, reply) => {
      const { id } = request.params as { id: string };
      const student = mockStudents.find((s) => s.id === id || s.student_id === id);
      if (!student) return reply.code(404).send({ error: "Student not found" });
      return { success: true, data: student };
    });

    app.get(`${prefix}/programs`, async () => ({
      success: true,
      data: PROGRAMS,
      programs: PROGRAMS,
    }));

    app.get(`${prefix}/courses`, async () => ({
      success: true,
      data: mockCourses,
      courses: mockCourses,
    }));

    app.get(`${prefix}/staff`, async () => ({
      success: true,
      data: mockStaff,
      staff: mockStaff,
    }));

    app.get(`${prefix}/grades`, async () => ({
      success: true,
      data: [
        {
          student_id: "std-1001",
          course_code: "THEO-101",
          course_name: "Foundations of Biblical Theology",
          grade: "A",
          gpa_points: 4.0,
          semester: "Spring 2024",
        },
        {
          student_id: "std-1001",
          course_code: "HEBR-201",
          course_name: "Biblical Hebrew Syntax",
          grade: "A-",
          gpa_points: 3.7,
          semester: "Spring 2024",
        },
      ],
    }));

    app.get(`${prefix}/finance`, async () => ({
      success: true,
      data: {
        totalBilled: 24000,
        totalCollected: 21500,
        outstanding: 2500,
        currency: "USD",
        recentTransactions: [
          { id: "tx-101", studentId: "std-1001", amount: 1200, date: "2024-05-01", type: "Tuition Payment" },
        ],
      },
    }));

    app.get(`${prefix}/analytics`, async () => ({
      success: true,
      data: {
        totalEnrolled: 1450,
        retentionRate: "94.2%",
        graduationRate: "89.5%",
        activeInstructors: 52,
      },
    }));

    app.get(`${prefix}/notifications`, async () => ({
      success: true,
      data: [
        { id: "notif-1", title: "Semester Orientation", message: "Orientation begins Monday at 9:00 AM.", read: false },
      ],
    }));

    app.patch(`${prefix}/notifications/:id/read`, async () => ({
      success: true,
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
  registerUmsEndpoints("/v1");
}
