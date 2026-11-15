import React, { useState, useMemo, useEffect } from "react";
import {
  FileSpreadsheet,
  Calendar,
  Clock,
  GraduationCap,

  AlertTriangle,
  Search,
  Plus,
  MapPin,
  ChevronRight,
  Printer,
  Download,

  FileText,
  ShieldCheck,
  UserCheck,
  Trophy,
  BookOpen,
  Layout,
  ClipboardList,
} from '../shims/lucide-react';
import { PROGRAMS as FALLBACK_PROGRAMS, API_WORKER_URL } from '../services/contracts-bridge';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;
const API_BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';
import ImportModal from "./ImportModal";
import GradeEntryModal, { GradeFormData } from "./grading/GradeEntryModal";
import { GradingScaleType } from "../grading/types";
import { calculateWeightedGrade } from "../grading/calculators/WeightedGradeCalculator";

import {
  createAcademicRecord,
  updateAcademicRecord,
  getAcademicRecords,
  type AcademicRecordFlat,
} from "../services/academicRecordsService";
import { useDataStore } from "../stores/dataStore";

interface ExamRecord {
  id: string;
  course: string;
  code: string;
  date: string;
  time: string;
  venue: string;
  proctor: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Papers Processing";
  level: "Diploma" | "Degree" | "Masters" | "PhD";
}

interface GradeRecord {
  id: string;
  student: string;
  studentId: string;
  course: string;
  midterm: number;
  final: number;
  total: number;
  grade: string;
  gpa: number;
  status: "Verified" | "Pending Review" | "Flagged";
  level: "Diploma" | "Degree" | "Masters" | "PhD";
}

const Exams: React.FC = () => {
  const students = useDataStore((s) => s.students);
  const courses = useDataStore((s) => s.courses);
  const [activeTab, setActiveTab] = useState<"schedule" | "grading">(
    "schedule",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [academicLevelFilter, setAcademicLevelFilter] = useState("All Levels");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);

  const [savedGrades, setSavedGrades] = useState<AcademicRecordFlat[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // ── DB-as-SSOT: hydrate program picker from the canonical /public/programs endpoint.
  //    Fallback ensures the component renders immediately without a live API connection.
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/programs`, { cache: 'force-cache' });
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data)) return;
        if (cancelled) return;
        setPrograms(body.data.map((p: any) => ({
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load grades from database on component mount
  useEffect(() => {
    const loadGrades = async () => {
      setIsLoadingGrades(true);
      try {
        const result = await getAcademicRecords({ perPage: 500 });

        if (result.items) {
          setSavedGrades(result.items);
        } else {
          setSavedGrades([]);
        }
      } catch {
        setSavedGrades([]);
      } finally {
        setIsLoadingGrades(false);
      }
    };

    loadGrades();
  }, []);

  const handleSaveGrade = async (data: GradeFormData) => {
    setIsSavingGrade(true);
    try {
      const student = students.find((s) => `${s.first_name} ${s.last_name}` === data.studentName);
      const course = courses.find((c) => c.title === data.courseName);

      if (!student || !course) {
        throw new Error("Student or course not found");
      }

      // Reconstruct assessment components and calculate total score
      const assessmentComponents = data.components.map((cs) => ({
        id: cs.componentId,
        type: cs.componentType,
        name: cs.componentType,
        weight: cs.weight,
        maxScore: cs.maxScore,
      }));
      const calculation = calculateWeightedGrade(assessmentComponents, data.components);
      const totalScore = calculation.finalGrade;

      // Extract optional ca_score and exam_score if present in components
      const examComponent = data.components.find(
        (cs) => cs.componentType === "Final_Exam" || cs.componentType === "Midterm"
      );
      const examScore = examComponent ? examComponent.score : undefined;
      const caComponents = data.components.filter(
        (cs) => cs.componentType !== "Final_Exam"
      );
      const caScore = caComponents.length > 0
        ? caComponents.reduce((sum, cs) => sum + (cs.score / cs.maxScore) * cs.weight, 0)
        : undefined;

      if (editingGrade && editingGrade.id.startsWith("DB-")) {
        const gradeId = editingGrade.id.replace("DB-", "");
        await updateAcademicRecord(gradeId, {
          total_score: totalScore,
          ca_score: caScore !== undefined ? Math.round(caScore * 100) / 100 : undefined,
          exam_score: examScore,
        });
      } else if (!editingGrade) {
        await createAcademicRecord({
          student_id: student.id,
          course_id: course.id,
          total_score: totalScore,
          ca_score: caScore !== undefined ? Math.round(caScore * 100) / 100 : undefined,
          exam_score: examScore,
          academic_year: data.academicYear || new Date().getFullYear().toString(),
        });
      }

      // Refresh grades
      const result = await getAcademicRecords({ perPage: 500 });
      if (result.items) setSavedGrades(result.items);

      setIsAddGradeOpen(false);
      setEditingGrade(null);
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Error saving grade:", error);
      alert("An error occurred while saving the grade.");
    } finally {
      setIsSavingGrade(false);
    }
  };

  const openAddGradeModal = (grade?: GradeRecord) => {
    if (grade) {
      setEditingGrade(grade);
    } else {
      setEditingGrade(null);
    }
    setIsAddGradeOpen(true);
  };

  const upcomingExams: ExamRecord[] = [
    {
      id: "EX-901",
      course: "Systematic Theology I",
      code: "THEO101",
      date: "2024-06-12",
      time: "09:00 AM",
      venue: "Main Hall",
      proctor: "Dr. Kiptoo",
      status: "Scheduled",
      level: "Degree",
    },
    {
      id: "EX-902",
      course: "Old Testament Survey I",
      code: "BIBL101",
      date: "2024-06-14",
      time: "02:00 PM",
      venue: "Bethlehem Hall",
      proctor: "Prof. Mwangi",
      status: "Papers Processing",
      level: "Degree",
    },
    {
      id: "EX-903",
      course: "Marriage & Family Counseling",
      code: "COUN501",
      date: "2024-06-15",
      time: "11:00 AM",
      venue: "Room 12B",
      proctor: "Rev. Omolo",
      status: "Scheduled",
      level: "Masters",
    },
    {
      id: "EX-904",
      course: "Biblical Hermeneutics",
      code: "THEO103",
      date: "2024-06-18",
      time: "08:30 AM",
      venue: "Chapel Auditorium",
      proctor: "Dr. Jane Okumu",
      status: "Scheduled",
      level: "Diploma",
    },
  ];

  const rawGradeData = [
    {
      id: "GR-001",
      student: "Aaron Keitany",
      studentId: "BMI-2022-001",
      course: "Systematic Theology I",
      midterm: 88,
      final: 92,
      status: "Verified",
      level: "Degree",
    },
    {
      id: "GR-002",
      student: "Beatrice Wanjiku",
      studentId: "BMI-2023-012",
      course: "New Testament Survey I",
      midterm: 75,
      final: 82,
      status: "Verified",
      level: "Degree",
    },
    {
      id: "GR-003",
      student: "Caleb Rotich",
      studentId: "BMI-2023-045",
      course: "Biblical Hermeneutics",
      midterm: 92,
      final: 95,
      status: "Verified",
      level: "Diploma",
    },
    {
      id: "GR-004",
      student: "Diana Waweru",
      studentId: "BMI-2022-088",
      course: "Organizational Leadership for Ministry",
      midterm: 62,
      final: 55,
      status: "Flagged",
      level: "Degree",
    },
    {
      id: "GR-005",
      student: "Edward Lowasa",
      studentId: "BMI-2023-102",
      course: "Systematic Theology I",
      midterm: 78,
      final: 81,
      status: "Pending Review",
      level: "Masters",
    },
    {
      id: "GR-006",
      student: "Faith Chepkirui",
      studentId: "BMI-2023-055",
      course: "Doctoral Research in Christian Education",
      midterm: 85,
      final: 88,
      status: "Verified",
      level: "PhD",
    },
  ];

  const calculateGradeDetails = (midterm: number, final: number) => {
    const total = Math.round((midterm + final) / 2);
    let grade: string;
    let gpa: number;

    if (total >= 90) {
      grade = "A";
      gpa = 4.0;
    } else if (total >= 80) {
      grade = "B";
      gpa = 3.0;
    } else if (total >= 70) {
      grade = "C";
      gpa = 2.0;
    } else if (total >= 60) {
      grade = "D";
      gpa = 1.0;
    } else {
      grade = "F";
      gpa = 0.0;
    }

    return { total, grade, gpa };
  };

  // Merge imported exams and saved grades into grade data
  const allGradeData: GradeRecord[] = useMemo(() => {
    const base = rawGradeData.map((item) => {
      const { total, grade, gpa } = calculateGradeDetails(
        item.midterm,
        item.final,
      );
      return {
        ...item,
        total,
        grade,
        gpa,
        status: item.status as GradeRecord["status"],
        level: item.level as GradeRecord["level"],
      };
    });

    // Imported exams are obsolete since they are saved directly to DB now
    //     const _fromImport: GradeRecord[] = [];

    // Convert saved database grades to grade records
    const fromDatabase: GradeRecord[] = savedGrades.map((grade) => {
      return {
        id: `DB-${grade.id}`,
        student: grade.studentName,
        studentId: grade.regNo || grade.studentId,
        course: grade.courseTitle,
        midterm: grade.caScore ?? 0,
        final: grade.examScore ?? 0,
        total: grade.totalScore,
        grade: grade.grade || "F",
        gpa: grade.gradePoint || 0.0,
        status: "Verified",
        level: "Degree" as GradeRecord["level"],
      };
    });

    return [...base, ...fromDatabase];
  }, [savedGrades]);

  const gradeReviewData: GradeRecord[] = allGradeData;

  const filteredExams = upcomingExams.filter((ex) => {
    const matchesSearch =
      ex.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel =
      academicLevelFilter === "All Levels" || ex.level === academicLevelFilter;
    const matchesSubject =
      selectedSubject === "All Subjects" || ex.course === selectedSubject;
    return matchesSearch && matchesLevel && matchesSubject;
  });

  const filteredGrades = gradeReviewData.filter((g) => {
    const student = g.student || "Unknown";
    const studentId = g.studentId || "Unknown";
    const matchesSearch =
      student.toLowerCase().includes(searchTerm.toLowerCase()) ||
      studentId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel =
      academicLevelFilter === "All Levels" || g.level === academicLevelFilter;
    const matchesSubject =
      selectedSubject === "All Subjects" || g.course === selectedSubject;
    return matchesSearch && matchesLevel && matchesSubject;
  });

  const metrics = useMemo(() => {
    if (gradeReviewData.length === 0)
      return { institutionalGpa: "0.00", completionRate: "0.0", honorsPool: 0 };

    const totalGpa = gradeReviewData.reduce((acc, curr) => acc + curr.gpa, 0);
    const passes = gradeReviewData.filter((g) => g.total >= 50).length;
    const honors = gradeReviewData.filter((g) => g.total >= 80).length;

    return {
      institutionalGpa: (totalGpa / gradeReviewData.length).toFixed(2),
      completionRate: ((passes / gradeReviewData.length) * 100).toFixed(1),
      honorsPool: honors,
    };
  }, [gradeReviewData]);

  const SelectorSection = () => (
    <div className="bg-white dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
      <h4 className="text-xs font-bold text-[#4B0082] dark:text-[#FFD700] uppercase tracking-widest mb-4 flex items-center gap-2">
        <BookOpen size={14} /> Lecturer Performance Selection
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">
            Select Program / Course
          </label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-bold uppercase outline-none focus:border-[#4B0082] dark:text-white"
          >
            <option>All Programs</option>
            {programs.map((program) => (
              <option key={program.label} value={program.label}>
                {program.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">
            Select Subject Unit
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-bold uppercase outline-none focus:border-[#4B0082] dark:text-white"
          >
            <option>All Subjects</option>
            {[
              ...new Set([
                ...upcomingExams.map((e) => e.course),
                ...rawGradeData.map((g) => g.course),
              ]),
            ]
              .sort()
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Assessment & Academic Standards
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Institutional Oversight • Examination Registry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[9px] sm:text-[10px] uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-xs"
          >
            <FileSpreadsheet size={12} /> Import Excel
          </button>
          <button
            onClick={() => openAddGradeModal()}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 cursor-pointer"
          >
            <Plus size={12} className="text-[#FFD700]" />{" "}
            {activeTab === "schedule" ? "Schedule Exam" : "Enter Grades"}
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <Layout size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Module View
          </span>
        </div>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === "schedule"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          Exam Timetable
        </button>
        <button
          onClick={() => setActiveTab("grading")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "grading"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <ClipboardList
            size={12}
            className={
              activeTab === "grading" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Grade Review
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Academic Level Groups */}
        <div className="flex flex-wrap gap-3">
          {["All Levels", "Diploma", "Degree", "Masters", "PhD"].map(
            (level) => {
              const activeClass = {
                "All Levels": "bg-gray-900 border-gray-900 text-white",
                Diploma: "bg-cyan-600 border-cyan-600 text-white",
                Degree: "bg-[#4B0082] border-[#4B0082] text-white",
                Masters: "bg-amber-600 border-amber-600 text-white",
                PhD: "bg-rose-700 border-rose-700 text-white",
              }[level];

              const hoverClass = {
                "All Levels": "hover:border-gray-900 hover:text-gray-900",
                Diploma: "hover:border-cyan-600 hover:text-cyan-600",
                Degree: "hover:border-[#4B0082] hover:text-[#4B0082]",
                Masters: "hover:border-amber-600 hover:text-amber-600",
                PhD: "hover:border-rose-700 hover:text-rose-700",
              }[level];

              return (
                <button
                  key={level}
                  onClick={() => setAcademicLevelFilter(level)}
                  className={`px-8 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-all duration-300 border transform ${academicLevelFilter === level
                    ? `${activeClass} shadow-xl scale-105 -translate-y-1`
                    : `bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:-translate-y-1 hover:shadow-lg ${hoverClass} dark:hover:text-white`
                    }`}
                >
                  {level}
                </button>
              );
            },
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-none border border-gray-100 dark:border-gray-700 space-y-6">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Filter Registry..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-bold uppercase tracking-tight outline-none focus:ring-1 focus:ring-[#4B0082]"
                />
              </div>

              <div className="space-y-4 pt-4">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Performance Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      Institutional GPA
                    </span>
                    <span className="text-sm font-black text-[#4B0082] dark:text-[#FFD700]">
                      {metrics.institutionalGpa}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      Completion Rate
                    </span>
                    <span className="text-sm font-black text-emerald-600">
                      {metrics.completionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      Honors Pool
                    </span>
                    <span className="text-sm font-black text-blue-600">
                      {metrics.honorsPool} Students
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                <button className="w-full py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#4B0082] transition-all flex items-center justify-center gap-2 shadow-lg">
                  <Download size={14} /> Export Global Audit
                </button>
                <button className="w-full mt-2 py-4 border-2 border-gray-900 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                  <Printer size={14} /> Print Master Ledger
                </button>
              </div>
            </div>

            <div className="bg-[#4B0082] p-8 rounded-none border-l-4 border-[#FFD700] text-white shadow-xl relative overflow-hidden">
              <Trophy
                size={120}
                className="absolute -right-8 -bottom-8 text-white/10 rotate-12"
              />
              <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] mb-2">
                  Chancellor's List
                </h4>
                <p className="text-xs font-medium leading-relaxed opacity-80">
                  The next honors convocation is scheduled for July 12th. Grades
                  must be finalized and verified by the Dean before the close of
                  business this Friday.
                </p>
                <button className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:underline">
                  View Requirements <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeTab === "schedule" ? (
              <div>
                <SelectorSection />
                <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <Calendar size={16} className="text-[#FFD700]" />{" "}
                      Scheduled Assessment Sessions
                    </h3>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      Q2 Academic Cycle
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filteredExams.map((exam) => (
                      <div
                        key={exam.id}
                        className="p-6 flex flex-wrap gap-8 items-center justify-between hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 border-l-4 border-[#4B0082] flex flex-col items-center justify-center shadow-inner">
                            <span className="text-[10px] font-black text-[#4B0082] dark:text-purple-300">
                              {exam.date.split("-")[1]}/
                              {exam.date.split("-")[2]}
                            </span>
                            <span className="text-lg font-black text-gray-900 dark:text-white">
                              JUN
                            </span>
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-lg leading-none">
                              {exam.course}
                            </h4>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 font-bold text-gray-500 uppercase tracking-tighter border border-gray-200 dark:border-gray-600">
                                {exam.code}
                              </span>
                              <span className="text-xs font-bold text-gray-400 flex items-center gap-1 uppercase tracking-widest">
                                <MapPin size={12} /> {exam.venue}
                              </span>
                              <span className="text-[10px] bg-[#4B0082]/10 dark:bg-[#4B0082]/20 px-2 py-0.5 font-bold text-[#4B0082] dark:text-purple-300 uppercase tracking-tighter border border-[#4B0082]/20">
                                {exam.level}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-12">
                          <div className="text-center">
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">
                              Time Control
                            </p>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 uppercase">
                              <Clock size={12} /> {exam.time}
                            </p>
                          </div>
                          <div className="text-center w-32">
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">
                              Status
                            </p>
                            <span
                              className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border inline-block ${exam.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : exam.status === "Scheduled"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                            >
                              {exam.status}
                            </span>
                          </div>
                          <button className="p-3 text-gray-300 hover:text-[#4B0082] transition-colors">
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredExams.length === 0 && (
                      <div className="p-12 text-center text-gray-400 font-bold uppercase text-xs italic tracking-widest">
                        No Exams found for this criteria
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <SelectorSection />
                <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <GraduationCap size={16} className="text-[#FFD700]" />{" "}
                      Institutional Grade Review Console
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Verified
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Flagged
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/30 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                          <th className="px-6 py-4">Student Identity</th>
                          <th className="px-6 py-4">Module Code</th>
                          <th className="px-6 py-4">Level</th>
                          <th className="px-6 py-4 text-center">Midterm (%)</th>
                          <th className="px-6 py-4 text-center">Final (%)</th>
                          <th className="px-6 py-4 text-center">
                            Calculated Total (%)
                          </th>
                          <th className="px-6 py-4 text-center">
                            Letter Grade
                          </th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Commit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {filteredGrades.map((grade) => (
                          <tr
                            key={grade.id}
                            className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group"
                          >
                            <td className="px-6 py-5">
                              <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                                {grade.student}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                                {grade.studentId}
                              </p>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#4B0082] dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 border border-purple-100 dark:border-purple-800 uppercase tracking-tighter">
                                  {grade.course
                                    .split(" ")
                                    .map((w) => w[0])
                                    .join("")}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate max-w-[120px]">
                                  {grade.course}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest border border-gray-200 px-2 py-0.5">
                                {grade.level}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center text-xs font-bold text-gray-700 dark:text-gray-300">
                              {grade.midterm}
                            </td>
                            <td className="px-6 py-5 text-center text-xs font-bold text-gray-700 dark:text-gray-300">
                              {grade.final}
                            </td>
                            <td className="px-6 py-5 text-center text-sm font-black text-gray-900 dark:text-white">
                              {grade.total}%
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span
                                className={`text-lg font-black ${grade.total >= 90 ? "text-emerald-600" : grade.total < 60 ? "text-red-600" : "text-[#4B0082] dark:text-[#FFD700]"}`}
                              >
                                {grade.grade}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <div className="flex justify-center">
                                {grade.status === "Verified" ? (
                                  <ShieldCheck
                                    size={18}
                                    className="text-emerald-500"
                                  />
                                ) : grade.status === "Flagged" ? (
                                  <AlertTriangle
                                    size={18}
                                    className="text-red-500"
                                  />
                                ) : (
                                  <Clock size={18} className="text-amber-500" />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 text-gray-400 hover:text-blue-500">
                                  <FileText size={16} />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-emerald-500">
                                  <UserCheck size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {isLoadingGrades ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="py-24 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm"
                            >
                              <div className="flex items-center justify-center gap-3">
                                <div className="w-6 h-6 border-2 border-[#4B0082] border-t-transparent rounded-full animate-spin"></div>
                                Loading grades from database...
                              </div>
                            </td>
                          </tr>
                        ) : filteredGrades.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="py-24 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm italic"
                            >
                              No grades found in registry
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-6 flex items-start gap-4 mt-6">
                  <div className="p-2 bg-red-500 text-white shadow-lg">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black uppercase text-red-600 tracking-widest">
                      Administrative Protocol: Grade Finalization
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                      Once a grade is marked as "Verified," it is committed to
                      the immutable student transcript database. Further
                      modifications require a formal appeal process authorized
                      by the Faculty Board.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => window.location.reload()}
      />

      <GradeEntryModal
        isOpen={isAddGradeOpen}
        onClose={() => {
          setIsAddGradeOpen(false);
          setEditingGrade(null);
        }}
        onSave={handleSaveGrade}
        isLoading={isSavingGrade}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          admissionNo: s.id,
        }))}
        courses={courses.map((c) => ({
          code: c.code,
          name: c.title,
          fullName: c.title,
          credits: c.credit_hours,
        }))}
        editData={
          editingGrade
            ? {
              id: editingGrade.id.startsWith("DB-")
                ? editingGrade.id.replace("DB-", "")
                : undefined,
              studentId: editingGrade.studentId,
              studentName: editingGrade.student,
              admissionNo: editingGrade.studentId,
              courseCode: editingGrade.id.startsWith("DB-")
                ? savedGrades.find(
                  (g) => g.id === editingGrade.id.replace("DB-", ""),
                )?.courseCode ||
                editingGrade.course
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                : editingGrade.course
                  .split(" ")
                  .map((w) => w[0])
                  .join(""),
              courseName: editingGrade.course,
              credits: 3,
              components: [],
              gradingScaleType: GradingScaleType.US_4_0,
              academicYear: editingGrade.id.startsWith("DB-")
                ? savedGrades.find(
                  (g) => g.id === editingGrade.id.replace("DB-", ""),
                )?.academicYear || "2024"
                : "2024",
              semester: editingGrade.id.startsWith("DB-")
                ? savedGrades.find(
                  (g) => g.id === editingGrade.id.replace("DB-", ""),
                )?.semester || "Fall"
                : "Fall",
            }
            : null
        }
      />
    </div>
  );
};

export default Exams;









