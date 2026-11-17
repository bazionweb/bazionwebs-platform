import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { bmiApiRoutes } from "./bmi-api-routes.js";

describe("bmiApiRoutes end-to-end Website ↔ Portal ↔ UMS synchronization", () => {
  it("hydrates UMS student, staff, course, and catalog endpoints with valid pagination envelopes", async () => {
    const app = Fastify();
    await app.register(bmiApiRoutes);

    const studentsRes = await app.inject({ method: "GET", url: "/api/v1/students?perPage=50" });
    expect(studentsRes.statusCode).toBe(200);
    const studentsBody = studentsRes.json();
    expect(studentsBody.success).toBe(true);
    expect(Array.isArray(studentsBody.data.items)).toBe(true);
    expect(studentsBody.data.items.length).toBeGreaterThanOrEqual(3);
    expect(studentsBody.data.total).toBe(studentsBody.data.items.length);

    const facultiesRes = await app.inject({ method: "GET", url: "/api/v1/catalog/faculties" });
    expect(facultiesRes.statusCode).toBe(200);
    expect(facultiesRes.json().data.length).toBeGreaterThanOrEqual(3);

    const departmentsRes = await app.inject({ method: "GET", url: "/api/v1/catalog/departments" });
    expect(departmentsRes.statusCode).toBe(200);
    expect(departmentsRes.json().data.length).toBeGreaterThanOrEqual(3);

    const txRes = await app.inject({ method: "GET", url: "/api/v1/finance/transactions" });
    expect(txRes.statusCode).toBe(200);
    expect(Array.isArray(txRes.json().data)).toBe(true);

    await app.close();
  });

  it("synchronizes an application from submission -> UMS review -> offer acceptance -> student & finance provisioning -> credential verification", async () => {
    const app = Fastify();
    await app.register(bmiApiRoutes);

    // 1. Prospective student submits application via Portal/Website
    const submitRes = await app.inject({
      method: "POST",
      url: "/api/applications",
      payload: {
        first_name: "John",
        last_name: "Kariuki",
        email: "j.kariuki@example.org",
        phone: "+254 711 223344",
        program: "BA in Ministry Leadership",
        degree_level: "undergraduate",
        personal_statement: "Equipping the local church.",
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const submitted = submitRes.json();
    expect(submitted.success).toBe(true);
    const appId = submitted.application_id as string;

    // 2. Registrar views applications in UMS and sees the newly submitted application
    const adminAppsRes = await app.inject({ method: "GET", url: "/api/admin/applications" });
    expect(adminAppsRes.statusCode).toBe(200);
    const adminApps = adminAppsRes.json().data as Array<{ id: string; email: string }>;
    expect(adminApps.some((a) => a.id === appId && a.email === "j.kariuki@example.org")).toBe(true);

    // 3. Registrar admits the applicant in UMS
    const statusRes = await app.inject({
      method: "PUT",
      url: `/api/admin/applications/${appId}/status`,
      payload: { status: "accepted", notes: "Approved by Admissions Committee" },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().new_status).toBe("accepted");

    // 4. Applicant checks decision in Student Portal and accepts the offer
    const decisionRes = await app.inject({ method: "GET", url: `/api/admissions/decision/${appId}` });
    expect(decisionRes.statusCode).toBe(200);
    expect(decisionRes.json().data.decision).toBe("admit");

    const acceptRes = await app.inject({
      method: "POST",
      url: "/api/admissions/accept",
      payload: { application_id: appId },
    });
    expect(acceptRes.statusCode).toBe(200);
    const provisionedRegNo = acceptRes.json().provisioningResult.regNo as string;
    expect(provisionedRegNo).toMatch(/^BMI-2026-/);

    // 5. Public Website & UMS Credential Verification validates the newly provisioned student
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/public/verify?code=${encodeURIComponent(provisionedRegNo)}`,
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody.valid).toBe(true);
    expect(verifyBody.data.student_name).toBe("John Kariuki");
    expect(verifyBody.document.holder_name).toBe("John Kariuki");

    await app.close();
  });
});

