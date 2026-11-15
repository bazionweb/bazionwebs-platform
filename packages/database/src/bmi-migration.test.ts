import { describe, expect, it } from "vitest";
import { mapBmiPrograms, mapBmiStudents } from "./bmi-migration.js";

describe("bmi-migration", () => {
  it("maps academic programs with fallback defaults", () => {
    const { programs, skipped } = mapBmiPrograms([
      {
        id: "bth-01",
        code: "BTH-101",
        name: "Bachelor of Theology",
        level: "bachelor",
        description: "Foundational theological study",
        credits: 120,
      },
      {
        id: "",
        name: "",
      },
    ]);

    expect(programs).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(programs[0]?.code).toBe("BTH-101");
    expect(programs[0]?.level).toBe("bachelor");
    expect(programs[0]?.credits).toBe(120);
  });

  it("maps students with valid enrollment statuses", () => {
    const { students, skipped } = mapBmiStudents([
      {
        id: "std-1",
        student_id: "BMI-2024-001",
        first_name: "Samuel",
        last_name: "Mwangi",
        email: "samuel@bmi.ac.ke",
        enrollment_status: "ENROLLED",
        gpa: 3.8,
      },
      {
        id: "missing-email",
        first_name: "Invalid",
        last_name: "Student",
        student_id: "BMI-999",
      },
    ]);

    expect(students).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(students[0]?.studentId).toBe("BMI-2024-001");
    expect(students[0]?.enrollmentStatus).toBe("ENROLLED");
    expect(students[0]?.gpa).toBe(3.8);
  });
});
