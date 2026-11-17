/**
 * BMI University Management System - Modern Registration Card Component
 * Course registration document with elegant design
 * 100% Open Source - Unique Creative Design
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  Printer,
  Download,
  ClipboardList,
  ShieldCheck,
  
  Calendar,
  CheckCircle,
  Sparkles,
  BookOpen,
  
  
  
  
  
  
  
} from '../shims/lucide-react';
import { Student, Course } from "../types";
import { documentService } from "../services/documentService";
import { getHtml2Pdf } from "../services/pdfService";
import type {
  RegistrationCard as RegistrationCardType,
  DocumentSecurityFeatures,
  RegisteredCourse,
} from "../types/documents";

interface RegistrationCardProps {
  students: Student[];
  courses: Course[];
  logo: string;
}

const THEME = {
  card: "bg-white rounded-2xl shadow-xl border border-slate-100",
  input:
    "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
  btnPrimary:
    "inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20",
  btnSecondary:
    "inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all",
};

// const _GRADE_COLORS: Record<string, string> = {
//   A: "bg-emerald-100 text-emerald-700",
//   B: "bg-blue-100 text-blue-700",
//   C: "bg-amber-100 text-amber-700",
//   D: "bg-orange-100 text-orange-700",
//   F: "bg-red-100 text-red-700",
// };

export const RegistrationCard: React.FC<RegistrationCardProps> = ({
  students,
  courses,
  logo,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] =
    useState<RegistrationCardType | null>(null);
  const [securityFeatures, setSecurityFeatures] =
    useState<DocumentSecurityFeatures | null>(null);

  const getFirstName = (student: Student) =>
    student.first_name || (student as unknown as Record<string, string>).firstName || "";
  const getLastName = (student: Student) =>
    student.last_name || (student as unknown as Record<string, string>).lastName || "";
  const getFaculty = (student: Student) =>
    (student as unknown as Record<string, string>).faculty || student.program_code;
  const getDepartment = (student: Student) =>
    (student as unknown as Record<string, string>).department || student.program_code;
  const getGpa = (student: Student) => (student as unknown as Record<string, number>).gpa;



  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchTerm.toLowerCase();
      return `${getFirstName(s)} ${getLastName(s)} ${s.id}`
        .toLowerCase()
        .includes(q);
    });
  }, [students, searchTerm]);

  const generateCardData = useCallback(
    async (
      student: Student,
    ): Promise<{
      card: RegistrationCardType;
      security: DocumentSecurityFeatures;
    }> => {
      const studentCourses = courses
        .filter(
          (c) =>
            c.faculty === getFaculty(student) ||
            c.department === getDepartment(student),
        )
        .slice(0, 6);

      const registeredCourses: RegisteredCourse[] = studentCourses.map((c) => ({
        code: c.code,
        name: c.title,
        credits: c.credit_hours,
        hours: c.credit_hours * 3,
        lecturer: (c as unknown as Record<string, string>).instructor ?? "TBA",
        schedule: "Mon/Wed 10:00-12:00",
        venue: "Main Campus",
        status: "registered" as const,
      }));

      const totalCredits = registeredCourses.reduce(
        (sum, c) => sum + c.credits,
        0,
      );
      const totalHours = registeredCourses.reduce((sum, c) => sum + c.hours, 0);

      const cardData: Omit<
        RegistrationCardType,
        "id" | "security" | "createdAt" | "updatedAt"
      > = {
        type: "registration_card",
        studentId: student.id,
        studentName: `${getFirstName(student)} ${getLastName(student)}`,
        academicYear: "2024-2025",
        semester: "Fall 2024",
        registrationDate: new Date().toISOString().split("T")[0],
        courses: registeredCourses,
        totalCredits,
        totalHours,
        registrationStatus: "complete",
        advisorName: "Dr. Sarah Johnson",
        advisorApproval: true,
        financeClearance: true,
        libraryClearance: true,
        status: "draft",
        createdBy: "admin",
      };

      const security = await documentService.generateSecurityFeatures(
        "registration_card",
        student.id,
        cardData,
        {
          includeBlockchain: false,
        },
      );

      const card = await documentService.createDocument<RegistrationCardType>(
        "registration_card",
        student.id,
        cardData,
        {
          createdBy: "admin",
        },
      );

      return { card, security };
    },
    [courses],
  );

  const handleGenerate = async () => {
    if (!selectedStudent) return;
    setIsGenerating(true);
    try {
      const { card, security } = await generateCardData(selectedStudent);
      setGeneratedCard(card);
      setSecurityFeatures(security);
      setShowCard(true);
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Registration card generation failed:", error);
     } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!generatedCard) return;
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!generatedCard) return;
    const element = document.getElementById("modern-registration-card");
    if (!element) return;

    try {
      const html2pdf = await getHtml2Pdf();

      const opt = {
        margin: 0,
        filename:
          `REGISTRATION_${generatedCard.studentId}_${generatedCard.academicYear.replace(/\s/g, "_")}.pdf`.toUpperCase(),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) { // eslint-disable-next-line no-console
      console.error("PDF generation failed:", error);
     }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <ClipboardList className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Course Registration
              </h1>
              <p className="text-slate-500">
                Generate official registration cards
              </p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-500">Total Students: </span>
            <span className="font-bold text-slate-900">{students.length}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">
        {/* Left Panel */}
        <div className="col-span-5 space-y-6">
          {/* Search */}
          <div className={THEME.card}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Search size={18} className="text-amber-500" />
                Find Student
              </h3>
            </div>
            <div className="p-4">
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={THEME.input}
              />
            </div>
          </div>

          {/* Student List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`bg-white rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg border-2 ${
                  selectedStudent?.id === student.id
                    ? "border-amber-500 shadow-lg"
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold shadow-md">
                    {getFirstName(student)[0]}
                    {getLastName(student)[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">
                      {getFirstName(student)} {getLastName(student)}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {student.id} • {getDepartment(student)}
                    </p>
                    {getGpa(student) !== undefined && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                        GPA: {getGpa(student)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Generate Button */}
          {selectedStudent && (
            <div className={THEME.card}>
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">
                  Generate Registration
                </h3>
              </div>
              <div className="p-4">
                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Selected:</span>{" "}
                    {getFirstName(selectedStudent)}{" "}
                    {getLastName(selectedStudent)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {getFaculty(selectedStudent)} •{" "}
                    {getDepartment(selectedStudent)}
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`${THEME.btnPrimary} w-full justify-center`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Registration Card
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="col-span-7">
          {showCard && generatedCard && securityFeatures ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">
                  Registration Card Preview
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrint} className={THEME.btnSecondary}>
                    <Printer size={18} />
                    Print
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className={THEME.btnPrimary}
                  >
                    <Download size={18} />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* Registration Document */}
              <div
                id="modern-registration-card"
                className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
              >
                <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

                <div className="p-8">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-6 border-b-2 border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center shadow-xl">
                        <img
                          src={logo}
                          alt="BMI"
                          className="w-10 h-10 object-contain brightness-0 invert"
                        />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                          BMI University
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                          Course Registration Card
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs shadow-lg">
                        <ShieldCheck size={14} />
                        {generatedCard.registrationStatus === "complete"
                          ? "Registered"
                          : "Pending"}
                      </div>
                    </div>
                  </div>

                  {/* Academic Info */}
                  <div className="flex justify-center gap-4 mb-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <Calendar className="text-amber-500" size={18} />
                      <span className="text-sm font-bold text-amber-800">
                        {generatedCard.academicYear}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <BookOpen className="text-blue-500" size={18} />
                      <span className="text-sm font-bold text-blue-800">
                        {generatedCard.semester}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                      <CheckCircle className="text-emerald-500" size={18} />
                      <span className="text-sm font-bold text-emerald-800">
                        {generatedCard.totalCredits} Credits
                      </span>
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="bg-slate-50 rounded-2xl p-5 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                          Student ID
                        </p>
                        <p className="font-mono font-bold text-slate-900">
                          {generatedCard.studentId}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                          Registration Date
                        </p>
                        <p className="font-semibold text-slate-800">
                          {new Date(
                            generatedCard.registrationDate,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                          Advisor
                        </p>
                        <p className="font-semibold text-slate-800">
                          {generatedCard.advisorName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                          Approval Status
                        </p>
                        <div className="flex items-center gap-1">
                          {generatedCard.advisorApproval ? (
                            <>
                              <CheckCircle
                                size={16}
                                className="text-emerald-500"
                              />
                              <span className="text-sm font-semibold text-emerald-700">
                                Approved
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-amber-700">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Course Table */}
                  <div className="mb-6">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <BookOpen size={18} className="text-amber-500" />
                      Registered Courses
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                              Course
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-20">
                              Credits
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-20">
                              Hours
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                              Instructor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedCard.courses.map((course, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800">
                                  {course.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {course.code}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-700">
                                {course.credits}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-700">
                                {course.hours}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {course.lecturer}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50">
                          <tr className="border-t border-slate-200">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              Total
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900">
                              {generatedCard.totalCredits}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900">
                              {generatedCard.totalHours}
                            </td>
                            <td className="px-4 py-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white rounded-lg shadow-md p-1 border border-slate-100">
                        <img
                          src={securityFeatures.qrCodeDataUrl}
                          alt="QR"
                          className="w-full h-full"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase">
                          Document ID
                        </p>
                        <p className="font-mono font-bold text-slate-700 text-sm">
                          {securityFeatures.serialNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">
                        Registration confirmed by academic advisor
                      </p>
                      <p className="text-xs text-slate-500">BMI University</p>
                    </div>
                  </div>
                </div>

                <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
              </div>
            </div>
          ) : (
            <div
              className={`${THEME.card} h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center`}
            >
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ClipboardList className="text-slate-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                No Registration Card
              </h3>
              <p className="text-slate-500 max-w-md">
                Select a student to generate an official course registration
                card with their enrolled courses.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationCard;









