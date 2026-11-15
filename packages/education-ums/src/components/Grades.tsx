/**
 * BMI UMS - Grades Management Component
 * Main component for managing student grades with the new grading system
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Download,
  Upload,
  Eye,
  User,
  BarChart2,
  FileText,
  X,
  CheckCircle,
  Calendar,
  BookOpen,
} from '../shims/lucide-react';
import GradeEntryModal, { GradeFormData } from "./grading/GradeEntryModal";
import GradeDetailsView from "./grading/GradeDetailsView";
import StudentGradeReport from "./grading/StudentGradeReport";
import CourseGradeDistribution from "./grading/CourseGradeDistribution";
import GradeAppealForm, { AppealFormData } from "./grading/GradeAppealForm";
import GradeAppealReview from "./grading/GradeAppealReview";
import ExamsPanel from "./ExamsPanel";
import {
  createGrade,
  updateGrade,
  deleteGrade,
  submitGradeAppeal,
  approveGradeAppeal,
  denyGradeAppeal,
} from "../grading/services/GradeAPIService";
import { getAcademicRecords } from "../services/academicRecordsService";
import { Grade } from "../grading/types";
import { BulkEntryModal } from "./BulkEntryModal";
import { postGradeBatch } from "../services/batchService";
import { useStudentsQuery, useCoursesQuery } from "../hooks/useEntityQueries";

const Grades: React.FC = () => {
  const [mainTab, setMainTab] = useState<"exams" | "records">("records");
  const { data: studentsRes } = useStudentsQuery({ page: 1, perPage: 1000 });
  const { data: coursesRes } = useCoursesQuery({ page: 1, perPage: 1000 });

  const students = studentsRes?.data?.items || [];
  const courses = coursesRes?.data?.items || [];
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStudentReportOpen, setIsStudentReportOpen] = useState(false);
  const [isCourseDistributionOpen, setIsCourseDistributionOpen] =
    useState(false);
  const [isAppealFormOpen, setIsAppealFormOpen] = useState(false);
  const [isAppealReviewOpen, setIsAppealReviewOpen] = useState(false);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [selectedGradeForAppeal, setSelectedGradeForAppeal] =
    useState<Grade | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{
    code: string;
    name: string;
    year: string;
    semester: string;
  } | null>(null);
  const [editingGrade, setEditingGrade] = useState<GradeFormData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [gradeSuccess, setGradeSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`.trim(),
        admissionNo: s.reg_no ?? s.id,
      })),
    [students],
  );

  const courseOptions = useMemo(
    () =>
      courses.map((c) => ({
        code: c.code,
        name: c.title,
        fullName: c.title,
        credits: c.credit_hours,
      })),
    [courses],
  );

  useEffect(() => {
    loadGrades();
  }, [filterSemester, filterYear]);

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (!gradeSuccess) return;
    const timer = setTimeout(() => setGradeSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [gradeSuccess]);

  const loadGrades = async () => {
    setIsLoading(true);
    try {
      const result = await getAcademicRecords({
        academicYear: filterYear || undefined,
        semester: filterSemester || undefined,
        perPage: 500,
      });
      // Map AcademicRecordFlat → Grade shape expected by GradeEntryModal / table
      const mapped = result.items.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.studentName,
        admissionNo: r.regNo,
        courseId: r.courseId,
        courseCode: r.courseCode,
        courseName: r.courseTitle,
        credits: r.creditHours,
        numericGrade: r.totalScore,
        percentage: r.totalScore,
        letterGrade: r.grade,
        gradePoints: r.gradePoint,
        gpa: r.gradePoint,
        academicYear: r.academicYear,
        semester: r.semester,
        status: "Verified",
        isRetake: false,
        components: [],
        gradingScaleId: "US_4_0",
        gradingScaleType: "US_4_0",
        createdAt: "",
        updatedAt: "",
        createdBy: "system",
        lastModifiedBy: "system",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setGrades(mapped as any[]);
    } catch (_error) {
      // Fallback records handled gracefully by service
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGrade = async (gradeData: GradeFormData) => {
    setIsLoading(true);
    setGradeError(null);
    try {
      let response;
      if (gradeData.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await updateGrade(gradeData.id, gradeData as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await createGrade(gradeData as any);
      }

      if (!response.success) {
        // Categorise error by content for user-friendly messages
        const raw = response.error ?? '';
        let friendlyError: string;
        if (
          raw.toLowerCase().includes('network') ||
          raw.toLowerCase().includes('fetch') ||
          raw.toLowerCase().includes('failed to fetch') ||
          raw.toLowerCase().includes('connection')
        ) {
          friendlyError =
            'Network error: Unable to connect to the server. Please check your connection and try again.';
        } else if (raw.includes('400') || raw.toLowerCase().includes('validation')) {
          friendlyError = raw || 'Validation error: Please check the form fields and try again.';
        } else if (raw.includes('500') || raw.includes('503') || raw.toLowerCase().includes('server error')) {
          friendlyError = 'Server error occurred. Please try again or contact support.';
        } else if (raw.toLowerCase().includes('timeout') || raw.toLowerCase().includes('timed out')) {
          friendlyError = 'Request timed out. Please try again.';
        } else {
          friendlyError = raw || 'Failed to save grade. Please try again.';
        }
        setGradeError(friendlyError);
        // Do NOT close modal — let user correct the issue
        return;
      }

      // Success path
      setGradeSuccess('Grade saved successfully');
      await loadGrades();
      setIsModalOpen(false);
      setEditingGrade(null);
    } catch (error) {
      // Unexpected thrown errors (e.g. JSON parse failure)
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
      if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
        setGradeError('Request timed out. Please try again.');
      } else if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network')
      ) {
        setGradeError(
          'Network error: Unable to connect to the server. Please check your connection and try again.'
        );
      } else {
        setGradeError(msg || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditGrade = (grade: Grade) => {
    const formData: GradeFormData = {
      id: grade.id,
      studentId: grade.studentId,
      studentName: grade.studentName,
      admissionNo: grade.admissionNo,
      courseCode: grade.courseCode,
      courseName: grade.courseName,
      credits: grade.credits,
      components: grade.components,
      academicYear: grade.academicYear,
      semester: grade.semester,
      gradingScaleType: grade.gradingScaleType,
    };
    setEditingGrade(formData);
    setIsModalOpen(true);
  };

  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm("Are you sure you want to delete this grade?")) return;

    setIsLoading(true);
    try {
      await deleteGrade(gradeId);
      await loadGrades();
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to delete grade:", error);
     } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    setIsDetailsOpen(true);
  };

  const handleViewStudentReport = (studentId: string, studentName: string) => {
    setSelectedStudent({ id: studentId, name: studentName });
    setIsStudentReportOpen(true);
  };

  const handleViewCourseDistribution = (
    courseCode: string,
    courseName: string,
    year: string,
    semester: string,
  ) => {
    setSelectedCourse({ code: courseCode, name: courseName, year, semester });
    setIsCourseDistributionOpen(true);
  };

  const handleSubmitAppeal = async (appealData: AppealFormData) => {
    setIsLoading(true);
    try {
      const result = await submitGradeAppeal(appealData);
      if (result.success) {
        alert("Appeal submitted successfully");
        setIsAppealFormOpen(false);
      } else {
        alert(result.error || "Failed to submit appeal");
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to submit appeal:", error);
      alert("An error occurred while submitting the appeal");
     } finally {
      setIsLoading(false);
    }
  };

  const handleApproveAppeal = async (
    appealId: string,
    revisedGrade: string,
    notes: string,
  ) => {
    setIsLoading(true);
    try {
      const result = await approveGradeAppeal(appealId, revisedGrade, notes);
      if (result.success) {
        alert("Appeal approved successfully");
        await loadGrades(); // Reload to show updated grade if applicable
      } else {
        alert(result.error || "Failed to approve appeal");
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to approve appeal:", error);
      alert("An error occurred while approving the appeal");
     } finally {
      setIsLoading(false);
    }
  };

  const handleDenyAppeal = async (appealId: string, notes: string) => {
    setIsLoading(true);
    try {
      const result = await denyGradeAppeal(appealId, notes);
      if (result.success) {
        alert("Appeal denied successfully");
      } else {
        alert(result.error || "Failed to deny appeal");
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to deny appeal:", error);
      alert("An error occurred while denying the appeal");
     } finally {
      setIsLoading(false);
    }
  };

  const filteredGrades = grades.filter(
    (grade) =>
      grade.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grade.courseName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleExportGradesCSV = () => {
    const listToExport = filteredGrades.length > 0 ? filteredGrades : grades;
    const headers = ["Student ID", "Student Name", "Course Code", "Course Title", "Credits", "Numeric Score", "Letter Grade", "Grade Point", "Academic Year", "Semester"];
    const rows = listToExport.map((g) => [
      `"${g.studentId}"`,
      `"${g.studentName}"`,
      `"${g.courseCode}"`,
      `"${g.courseName}"`,
      g.credits,
      g.numericGrade,
      `"${g.letterGrade}"`,
      g.gradePoints,
      `"${g.academicYear}"`,
      `"${g.semester}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `academic_grades_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">

      {/* Page Header */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-3 shadow-sm">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            Assessments &amp; Grades
          </h2>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Exam scheduling, grade entry and official grade records
          </p>
        </div>
        {mainTab === "records" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportGradesCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-xs hover:bg-gray-50 transition-all shadow-sm cursor-pointer"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-xs hover:bg-gray-50 transition-all shadow-sm cursor-pointer"
            >
              Bulk JSON
            </button>
            <button
              type="button"
              onClick={() => { setEditingGrade(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-[#380062] transition-all font-semibold text-xs cursor-pointer"
            >
              <Plus size={16} /> Add Grade
            </button>
          </div>
        )}
      </div>

      {/* Top Tab Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex gap-1">
          {[
            { id: "exams" as const, label: "Exam Schedule & Entry", icon: Calendar },
            { id: "records" as const, label: "Grade Records", icon: BookOpen },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMainTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                mainTab === id
                  ? "border-[#4B0082] text-[#4B0082] dark:text-purple-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {mainTab === "exams" ? (
          <ExamsPanel />
        ) : (
      <div className="p-6 space-y-6">
        {/* Success notification */}
        {gradeSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 px-4 py-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="flex-shrink-0" />
              <span className="text-sm font-bold">{gradeSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setGradeSuccess(null)}
              aria-label="Dismiss success message"
              className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search students or courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
          />
        </div>

        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
        >
          <option value="">All Years</option>
          <option value="2024-2025">2024-2025</option>
          <option value="2023-2024">2023-2024</option>
        </select>

        <select
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
        >
          <option value="">All Semesters</option>
          <option value="Fall">Fall</option>
          <option value="Spring">Spring</option>
          <option value="Summer">Summer</option>
        </select>

        <div className="flex gap-2">
          <button className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
            <Download size={16} />
            Export
          </button>
          <button className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
            <Upload size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => {
            // Get unique students from grades
            const uniqueStudents = Array.from(
              new Set(grades.map((g) => g.studentId)),
            ).map((id) => {
              const grade = grades.find((g) => g.studentId === id);
              return { id, name: grade?.studentName || "" };
            });

            if (uniqueStudents.length > 0) {
              handleViewStudentReport(
                String(uniqueStudents[0].id),
                uniqueStudents[0].name,
              );
            }
          }}
          className="px-6 py-3 bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <User size={16} />
          View Student Report
        </button>
        <button
          onClick={() => {
            // Get unique courses from grades
            const uniqueCourses = Array.from(
              new Set(grades.map((g) => g.courseCode)),
            ).map((code) => {
              const grade = grades.find((g) => g.courseCode === code);
              return {
                code,
                name: grade?.courseName || "",
                year: grade?.academicYear || "",
                semester: grade?.semester || "",
              };
            });

            if (uniqueCourses.length > 0) {
              const course = uniqueCourses[0];
              handleViewCourseDistribution(
                String(course.code),
                String(course.name),
                String(course.year),
                String(course.semester),
              );
            }
          }}
          className="px-6 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
        >
          <BarChart2 size={16} />
          View Course Analytics
        </button>
        <button
          onClick={() => setIsAppealReviewOpen(true)}
          className="px-6 py-3 bg-amber-600 text-white font-black text-xs uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center gap-2"
        >
          <FileText size={16} />
          Review Appeals
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search students or courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
          />
        </div>

        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
        >
          <option value="">All Years</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
        </select>

        <select
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
        >
          <option value="">All Semesters</option>
          <option value="Fall">Fall</option>
          <option value="Spring">Spring</option>
          <option value="Summer">Summer</option>
        </select>

        <div className="flex gap-2">
          <button className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
            <Download size={16} />
            Export
          </button>
          <button className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
            <Upload size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Grades Table */}
      <div className="bg-white dark:bg-gray-800 border-4 border-[#4B0082] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest">
                  Student
                </th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest">
                  Course
                </th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest">
                  Semester
                </th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest">
                  Grade
                </th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest">
                  GPA
                </th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredGrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <p className="text-sm font-bold">No grades found</p>
                    <p className="text-xs mt-1">
                      Add your first grade to get started
                    </p>
                  </td>
                </tr>
              ) : (
                filteredGrades.map((grade) => (
                  <tr
                    key={grade.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {grade.studentName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {grade.admissionNo}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {grade.courseCode}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {grade.courseName}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {grade.semester} {grade.academicYear}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-2xl font-black ${
                            grade.letterGrade.startsWith("A")
                              ? "text-emerald-600"
                              : grade.letterGrade.startsWith("B")
                                ? "text-blue-600"
                                : grade.letterGrade.startsWith("C")
                                  ? "text-amber-600"
                                  : grade.letterGrade.startsWith("D")
                                    ? "text-orange-600"
                                    : "text-red-600"
                          }`}
                        >
                          {grade.letterGrade}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {grade.numericGrade.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-black text-gray-900 dark:text-white">
                        {grade.gradePoints.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 text-xs font-black uppercase tracking-widest ${
                          grade.status === "Finalized"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : grade.status === "Verified"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                              : grade.status === "Provisional"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                        }`}
                      >
                        {grade.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(grade.id)}
                          className="px-3 py-1 bg-[#4B0082] text-white text-xs font-bold uppercase hover:bg-black transition-colors flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleEditGrade(grade)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-bold uppercase hover:bg-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteGrade(grade.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Entry Modal */}
      <GradeEntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGrade(null);
          setGradeError(null);
        }}
        onSave={handleSaveGrade}
        students={studentOptions}
        courses={courseOptions}
        editData={editingGrade}
        isLoading={isLoading}
        error={gradeError}
        onDismissError={() => setGradeError(null)}
      />

      {/* Grade Details View */}
      {selectedGradeId && (
        <GradeDetailsView
          gradeId={selectedGradeId}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedGradeId(null);
          }}
        />
      )}

      {/* Student Grade Report */}
      {selectedStudent && (
        <StudentGradeReport
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          isOpen={isStudentReportOpen}
          onClose={() => {
            setIsStudentReportOpen(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Course Grade Distribution */}
      {selectedCourse && (
        <CourseGradeDistribution
          courseCode={selectedCourse.code}
          courseName={selectedCourse.name}
          academicYear={selectedCourse.year}
          semester={selectedCourse.semester}
          isOpen={isCourseDistributionOpen}
          onClose={() => {
            setIsCourseDistributionOpen(false);
            setSelectedCourse(null);
          }}
        />
      )}

      {/* Grade Appeal Form */}
      {selectedGradeForAppeal && (
        <GradeAppealForm
          grade={selectedGradeForAppeal}
          isOpen={isAppealFormOpen}
          onClose={() => {
            setIsAppealFormOpen(false);
            setSelectedGradeForAppeal(null);
          }}
          onSubmit={handleSubmitAppeal}
        />
      )}

      {/* Grade Appeal Review */}
      <GradeAppealReview
        isOpen={isAppealReviewOpen}
        onClose={() => setIsAppealReviewOpen(false)}
        onApprove={handleApproveAppeal}
        onDeny={handleDenyAppeal}
      />

      <BulkEntryModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk grades (JSON lines)"
        entity="grades"
        sampleLine='{"studentId":"STUDENT_ID_OR_NUMBER","courseCode":"THEO101","academicYear":"2024-2025","semester":"Fall","percentage":88}'
        onSubmit={async (lines) => {
          try {
            const items = lines.map(
              (l) => JSON.parse(l) as any,
            );
            const r = await postGradeBatch(items);
            await loadGrades();
            const ok = (r.data?.failureCount ?? 0) === 0;
            return {
              ok,
              message: `Created: ${r.data?.successCount ?? 0}, failed: ${r.data?.failureCount ?? 0}. ${(r.data?.errors || []).map((e) => `#${e.index}: ${e.error}`).join(" | ")}`,
            };
} catch {
            return { ok: false, message: "Invalid JSON on one or more lines." };
          }
        }}
      />
        </div>
        )}
      </div>
    </div>
  );
};

export default Grades;









