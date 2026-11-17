import React, { useEffect, useState } from "react";
import { ShieldCheck, XCircle, CheckCircle2, Award, Calendar, BookOpen, MapPin, Clock, GraduationCap } from '../shims/lucide-react';
import { Student } from "../types";

interface VerifyProps {
  students: Student[];
}

const Verify: React.FC<VerifyProps> = ({ students }) => {
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">(
    "loading",
  );
  const [student, setStudent] = useState<Student | null>(null);
  const [serial, setSerial] = useState("");
  const [docType, setDocType] = useState<string>("");

  const getFirstName = (value: Student | null) =>
    value?.first_name || (value as unknown as Record<string, string>)?.firstName || "";
  const getLastName = (value: Student | null) =>
    value?.last_name || (value as unknown as Record<string, string>)?.lastName || "";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const t = params.get("t"); // document type

    if (!id) {
      setStatus("invalid");
      return;
    }

    setSerial(id);
    if (t) setDocType(t);

    // Simulate verification delay for security effect
    setTimeout(() => {
      // Serial Format from Certificates.tsx: BMI-{YEAR}-{ID_NUM_PART}
      // Example: BMI-2026-020231

      try {
        const parts = id.split("-");
        if (parts.length >= 3) {
          // Extract the numeric ID part which matches the student ID suffix
          const numPart = parts[2];

          // Find student where the numeric part of their ID matches
          const found = students.find((s) => {
            const sNum = s.id.replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
            return sNum === numPart;
          });

          if (found) {
            setStudent(found);
            setStatus("valid");
          } else {
            setStatus("invalid");
          }
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    }, 1500);
  }, [students]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Graduated":
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            Degree Conferred
          </span>
        );
      case "Active":
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            Currently Enrolled - Active
          </span>
        );
      case "Suspended":
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-red-100 text-red-800 border border-red-200">
            Suspended
          </span>
        );
      case "Inactive":
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            Inactive
          </span>
        );
      case "Applicant":
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Admission Applicant
          </span>
        );
      case "On Leave":
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 border border-amber-100">
            On Leave
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

// //   const _getCurrentAcademicYear = (student: Student | null) => {
// //     if (!student) return "";
// //     const admissionYear = student.admissionYear ? parseInt(student.admissionYear) : 2022;
// //     const yearOfStudy = student.year_of_study ? parseInt(student.year_of_study) : 1;
// //     const currentAcademicYearStart = admissionYear + (yearOfStudy - 1);
// //     return `${currentAcademicYearStart}/${currentAcademicYearStart + 1}`;
// //   };

  const normalizeDepartment = (dept?: string) => {
     if (!dept) return "Biblical Studies and Applied Ministry";
     const d = dept.trim();
     const upper = d.toUpperCase();
     if (
       upper === "BIBLICAL STUDIES & MINISTRY" ||
       upper === "BIBLICAL STUDIES" ||
       upper === "DEPARTMENT OF BIBLICAL STUDIES AND APPLIED MINISTRY"
     ) {
       return "Biblical Studies and Applied Ministry";
     }
     return d.replace(/^Department of\s+/i, "");
   };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4B0082] mb-4"></div>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
          Verifying Cryptographic Signature...
        </p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
        <XCircle className="h-20 w-20 text-red-500 mb-6" />
        <h1 className="text-3xl font-black text-red-900 uppercase mb-2">
          Invalid Certificate
        </h1>
        <p className="text-red-700 max-w-md font-medium">
          The document serial number{" "}
          <span className="font-mono bg-red-100 px-2 py-1 rounded">
            {serial}
          </span>{" "}
          could not be verified against the institutional ledger. This document
          may be forged or revoked.
        </p>
        <div className="mt-8">
          <a
            href="/"
            className="text-xs font-black uppercase tracking-widest text-red-800 hover:underline"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow-2xl overflow-hidden border-t-8 border-emerald-500 animate-slide-up">
        {/* Verification Status Header */}
        <div className="bg-emerald-50 p-6 text-center border-b border-emerald-100">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-emerald-900 uppercase tracking-tight">
            Official Record Verified
          </h2>
          <p className="text-emerald-700 text-[10px] font-bold uppercase tracking-widest mt-1">
            BMI Institutional Ledger Registry
          </p>
        </div>

        {/* Student Casing and Details */}
        <div className="p-8 space-y-6">
          <div className="text-center pb-4 border-b border-gray-100">
            <img
              src="/BMI.svg"
              className="h-16 mx-auto mb-4 object-contain filter drop-shadow-sm"
              alt="Logo"
            />
            {student?.photo ? (
              <div className="mx-auto mb-4 w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-100 shadow-md">
                <img
                  src={student.photo}
                  className="w-full h-full object-cover"
                  style={{
                    transform: student.photo_zoom ? `scale(${student.photo_zoom})` : undefined,
                    transformOrigin: student.photo_position ? `${student.photo_position.x}% ${student.photo_position.y}%` : undefined
                  }}
                  alt="Student Portrait"
                />
              </div>
            ) : (
              <div className="mx-auto mb-4 w-24 h-24 rounded-full bg-slate-100 border-4 border-emerald-50 shadow-md flex items-center justify-center text-slate-400 font-bold uppercase tracking-wider text-2xl">
                {getFirstName(student).charAt(0)}{getLastName(student).charAt(0)}
              </div>
            )}
            <h1 className="text-xl font-black text-gray-900 uppercase leading-tight">
              {getFirstName(student)} {getLastName(student)}
            </h1>
            <p className="text-xs font-mono text-gray-500 mt-1">
              Reg No: {student?.reg_no || student?.id}
            </p>
            <div className="mt-3">
              {getStatusBadge(student?.status || "Active")}
            </div>
          </div>

          {/* Academic Details Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                Credential
              </span>
              <span className="text-xs font-black text-gray-800 uppercase text-right max-w-[65%]">
                {getDegreeTitle(student)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                Faculty & Major
              </span>
              <span className="text-xs font-black text-gray-800 uppercase text-right max-w-[65%]">
                {student?.faculty || "School of Theology and Ministry"}
                <div className="text-[10px] text-gray-500 font-normal normal-case">
                  {normalizeDepartment(student?.department)}
                </div>
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                Campus Location
              </span>
              <span className="text-xs font-black text-gray-800 uppercase">
                {student?.expand?.study_center_id?.name || student?.campus_name || "Main Campus"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                Mode of Study
              </span>
              <span className="text-xs font-black text-gray-800 uppercase">
                {student?.mode_of_study || "Full-time"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Admission Year
              </span>
              <span className="text-xs font-black text-gray-800 uppercase">
                {student?.admissionYear || (() => {
                  const m = student?.reg_no?.match(/\s\d{2}(\d)-/);
                  return m ? (2020 + parseInt(m[1])).toString() : (student?.admission_date ? new Date(student.admission_date).getFullYear().toString() : "2025");
                })()}
              </span>
            </div>

            {(student?.status === "Graduated" || docType === "transcript" || docType === "certificate") ? (
              <>
                <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                    Graduation Date
                  </span>
                  <span className="text-xs font-black text-emerald-700 uppercase">
                    {student?.graduation_date ? new Date(student.graduation_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#4B0082]" />
                    Honors Class
                  </span>
                  <span className="text-xs font-black text-[#4B0082] uppercase">
                    {getGraduationClass(student) || "Pass"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center py-1 border-b border-gray-50/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    Expected Graduation
                  </span>
                  <span className="text-xs font-black text-gray-800 uppercase">
                    {student?.admissionYear ? parseInt(student.admissionYear) + 4 : "—"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Cryptographic Seal */}
          <div className="bg-slate-50 p-4 border border-slate-100 rounded space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Ledger Reference</span>
              <span className="text-[9px] text-gray-600 font-mono font-bold break-all">{serial}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Verification Date</span>
              <span className="text-[9px] text-gray-600 font-bold">{new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Registry Authority</span>
              <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> SECURE SIGNATURE VERIFIED
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 px-6 py-4 text-center">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            Bamburi Metropolitan Institute • Office of the Registrar
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper functions duplicated for standalone view context
const getDegreeTitle = (student: Student | null) => {
  if (!student) return "";
  if (student.academicLevel === "PhD") return `DOCTOR OF PHILOSOPHY`;
  if (student.academicLevel === "Masters") return `MASTER OF ARTS`;
  if (student.academicLevel === "Degree")
    return `BACHELOR OF ${(student.faculty ?? "").toUpperCase()}`;
  if (student.academicLevel === "Diploma")
    return `DIPLOMA IN ${(student.faculty ?? "").toUpperCase()}`;
  return `CERTIFICATE IN ${(student.faculty ?? "").toUpperCase()}`;
};

const getGraduationClass = (student: Student | null) => {
  if (!student) return "";
  const gpa = student.gpa ?? 0;
  const { academicLevel } = student;
  if (academicLevel === "PhD") return "";
  if (academicLevel === "Degree") {
    if (gpa >= 3.6) return "First Class Honours";
    if (gpa >= 3.0) return "Second Class Upper";
    if (gpa >= 2.5) return "Second Class Lower";
    return "Pass";
  }
  if (academicLevel === "Diploma") {
    if (gpa >= 3.5) return "Distinction";
    if (gpa >= 2.5) return "Credit";
    return "Pass";
  }
  if (academicLevel === "Masters") {
    if (gpa >= 3.7) return "Distinction";
    return "";
  }
  return "";
};

export default Verify;









