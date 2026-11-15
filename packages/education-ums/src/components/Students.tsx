import React, { useState, useMemo, useEffect } from "react";
import {
  
  Search,
  Plus,
  Trash2,
  Edit,
  Mail,
  Phone,
  GraduationCap,
  LayoutGrid,
  List,
  Globe,
  Layers,
  FileSpreadsheet,
  ChevronDown,
} from '../shims/lucide-react';
import { Student, Course } from "../types";
import StudentRegistrationModal from "./StudentRegistrationModal";
import ImportModal from "./ImportModal";
import {
  deleteStudent as deleteStudentAPI,
  getStudents,
} from "../services/studentService";
import { getPrograms } from "../services/catalogService";
import { BulkEntryModal } from "./BulkEntryModal";
import { postStudentBatch } from "../services/batchService";
import { getAllStudyCenters, StudyCenter } from "../services/studyCenterService";
import { StudyCenterSelector } from "./StudyCenterSelector";
import StudentEnrollmentForm from "./StudentEnrollmentForm";
import { useDialogStore } from "../stores/dialogStore";

import { useDataStore } from "../stores/dataStore";
import { usePagination } from "../hooks/usePagination";
import { useStudentsQuery } from "../hooks/useEntityQueries";
import { useQueryClient } from '../shims/tanstack-react-query';

interface StudentsProps {
  students?: Student[];
  setStudents?:
    | React.Dispatch<React.SetStateAction<Student[]>>
    | ((students: Student[]) => void);
  courses?: Course[];
  setCourses?: React.Dispatch<React.SetStateAction<Course[]>>;
}

const Students: React.FC<StudentsProps> = (props) => {
  const storeStudents = useDataStore((s) => s.students);

  const storeSetStudents = useDataStore((s) => s.setStudents);

  const students = props.students ?? storeStudents;

  // Custom setter that supports both React.SetStateAction and simple array
  const setStudents = (action: React.SetStateAction<Student[]>) => {
    if (props.setStudents) {
      // If parent provided setter, use it directly
      (props.setStudents as React.Dispatch<React.SetStateAction<Student[]>>)(action);
    } else {
      // Otherwise use store setter
      if (typeof action === "function") {
        storeSetStudents(
          (action as (prev: Student[]) => Student[])(storeStudents),
        );
      } else {
        storeSetStudents(action);
      }
    }
  };

  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("All Programs");
  const [programRows, setProgramRows] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [campusFilter, setCampusFilter] = useState("All Study Centers");
  const [, setCampuses] = useState<StudyCenter[]>([]);
  const [bulkStudentsOpen, setBulkStudentsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [academicLevelFilter, setAcademicLevelFilter] = useState("All Levels");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(
    undefined,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const { page, perPage, meta, setPage, setMeta } = usePagination(50);
  const queryClient = useQueryClient();

  // ── Server-side filtered+paginated fetch ──────────────────────────────────
  const {
    data: studentResponse,
    
    isFetching,
    
  } = useStudentsQuery({
    page,
    perPage,
    search: searchTerm,
    status: statusFilter !== "All Status" ? statusFilter : undefined,
    study_center_id: campusFilter !== "All Study Centers" ? campusFilter : undefined,
    program: programFilter !== "All Programs" ? programFilter : undefined,
  });

  const pagedStudents = useMemo(
    () => (studentResponse?.success ? studentResponse.data?.items ?? [] : []),
    [studentResponse],
  );

  useEffect(() => {
    if (studentResponse?.success && studentResponse.data) {
      const { page: p, perPage: pp, total } = studentResponse.data;
      setMeta({ page: p, perPage: pp, total });
    }
  }, [studentResponse, setMeta]);

  useEffect(() => {
    // When filter changes jump back to page 1
    setPage(1);
  }, [
    searchTerm,
    statusFilter,
    campusFilter,
    programFilter,
    academicLevelFilter,
    setPage,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getPrograms();
      if (cancelled || !r.success || !r.data) return;
      setProgramRows(
        r.data.map((p: any) => ({
          id: String(p.id),
          label: `${String(p.program_code ?? "")} — ${String(p.name ?? "")}`,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadStudyCenters() {
      try {
        const data = await getAllStudyCenters();
        if (!cancelled) setCampuses(data);
      } catch (_error) {
        // Fallback default study centers handled by getAllStudyCenters
      }
    }
    loadStudyCenters();
    return () => {
      cancelled = true;
    };
  }, []);

  // Use server-fetched paginated list when available, else fall back to
  // the store's in-memory list (e.g. when backend is unreachable).
  const filteredStudents = useMemo(() => {
    if ((pagedStudents && pagedStudents.length > 0) || isFetching)
      return pagedStudents || [];
    return students.filter((student) => {
      const matchesSearch =
        `${student.full_name || `${student.first_name} ${student.last_name}`} ${student.reg_no}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesProgram =
        programFilter === "All Programs" || student.program === programFilter;
      const matchesStatus =
        statusFilter === "All Status" || student.status === statusFilter;
      const matchesLevel =
        academicLevelFilter === "All Levels" ||
        student.program === academicLevelFilter;
      const matchesCampus =
        campusFilter === "All Study Centers" || student.study_center_id === campusFilter;
      return (
        matchesSearch &&
        matchesProgram &&
        matchesStatus &&
        matchesLevel &&
        matchesCampus
      );
    });
  }, [
    pagedStudents,
    students,
    isFetching,
    searchTerm,
    programFilter,
    statusFilter,
    academicLevelFilter,
    campusFilter,
  ]);

  const handleAdd = (student: Student) => {
    if (editingStudent) {
      // ── OPTIMISTIC CACHE UPDATE ─────────────────────────────────────────
      // Immediately patch every cached page of students in TanStack Query so
      // the table reflects the change without waiting for a network refetch.
      queryClient.setQueriesData<typeof studentResponse>(
        { queryKey: ['students'] },
        (old) => {
          if (!old || !old.success || !old.data || !Array.isArray(old.data.items)) return old;
          return {
            ...old,
            data: {
              ...old.data,
              items: old.data.items.map((s: Student) => (s.id === student.id ? student : s)),
            },
          };
        },
      );
      // Also update the Zustand store for components reading it directly
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? student : s)),
      );
      // Background refetch for eventual consistency (no visible flicker)
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } else {
      // New student: prepend to local store and invalidate to pull from server
      setStudents((prev) => [student, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
    setEditingStudent(undefined);
    setIsModalOpen(false);
  };

  const deleteStudent = async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Remove Student Enrolment Record",
      message: "Are you sure you want to permanently remove this student from the institutional register?",
      detail: "This action will expunge the student's enrolment record, course registrations, and associated academic history from the BMI University student management system. Proceed only if authorised by the Registrar's Office.",
      confirmText: "Remove Student",
      cancelText: "Keep Record",
      variant: "danger",
      badgeText: "Registrar Protocol",
    });
    if (confirmed) {
      try {
        const result = await deleteStudentAPI(id);
        if (result.success) {
          setStudents((prev) => prev.filter((s) => s.id !== id));
          await useDialogStore.getState().alert({
            title: "Student Record Removed",
            message: "The student enrolment record has been successfully expunged from the institutional register.",
            variant: "success",
            confirmText: "Acknowledged",
            badgeText: "Registrar Notice",
          });
        } else {
          await useDialogStore.getState().alert({
            title: "Removal Failed",
            message: result.error || "The system was unable to remove this student record. Please try again or contact the system administrator.",
            variant: "warning",
            confirmText: "Understood",
            badgeText: "System Notice",
          });
        }
      } catch (error) { // eslint-disable-next-line no-console
        console.error("Error deleting student:", error);
        await useDialogStore.getState().alert({
          title: "Unexpected System Error",
          message: "An unexpected error occurred while processing this request. Please contact the BMI University ICT Support team if this persists.",
          variant: "warning",
          confirmText: "Close",
          badgeText: "System Error",
        });
       }
    }
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleGoogleSheetsSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/v1/import/sheets-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BMI-Webhook-Token": (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_WEBHOOK_SECRET : '') || "",
        },
        body: JSON.stringify({
          spreadsheetId: "1Y0oxI5QUpncZ9m5T48czz4F-vi04vTEWSZVz-PW_mzg",
          sheets: [
            "01_FACULTIES", 
            "02_DEPARTMENTS", 
            "03_PROGRAMS", 
            "04_COURSES", 
            "05_PROG_COURSES", 
            "06_STAFF", 
            "07_STUDENTS", 
            "08_ENROLLMENTS", 
            "09_GRADES"
          ],
        }),
      });
      const data = await response.json();
      if (data.success) {
        queryClient.invalidateQueries();
        await useDialogStore.getState().alert({
          title: "Data Synchronisation Complete",
          message: "The institutional student registry has been successfully synchronised with the BMI University Google Sheets data source.",
          variant: "success",
          confirmText: "Acknowledged",
          badgeText: "Sync Complete",
        });
      } else {
        await useDialogStore.getState().alert({
          title: "Synchronisation Failed",
          message: `Data sync could not be completed: ${data.error}`,
          detail: "Verify that the Google Sheets data source is accessible and that the institutional webhook token is valid.",
          variant: "warning",
          confirmText: "Understood",
          badgeText: "Sync Error",
        });
      }
    } catch (error) {
      await useDialogStore.getState().alert({
        title: "Sync Connection Error",
        message: "Unable to reach the synchronisation endpoint. Please check your network connection and try again.",
        variant: "warning",
        confirmText: "Close",
        badgeText: "Sync Error",
      });
      // eslint-disable-next-line no-console
      console.error(error);
     } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncApplications = async (targetCampusId?: string) => {
    setIsSyncing(true);
    try {
      const activeCampusId =
        targetCampusId !== undefined
          ? targetCampusId
          : campusFilter === "All Study Centers"
            ? undefined
            : campusFilter;
      // Sync fetches page 1 and stores result in the global store for
      // other components that consume useDataStore().students
      const r = await getStudents({
        page: 1,
        perPage: 50,
        campusId: activeCampusId,
      });
      if (r.success && r.data) {
        setStudents(r.data.items);
        // Also invalidate the query to refresh the current view
        queryClient.invalidateQueries({ queryKey: ["students"] });
      }
    } finally {
      setIsSyncing(false);
    }
  };

// //   const _handleImportStudents = (
// //     newStudents: Student[],
// //     newCourses: Partial<Course>[],
// //   ) => {
// //     setStudents((prev) => [...newStudents, ...prev]);
// //     if (setCourses && newCourses.length > 0) {
// //       setCourses((prev) => [...(newCourses as Course[]), ...prev]);
// //     }
// //     // Refresh the view
// //     queryClient.invalidateQueries({ queryKey: ["students"] });
// //   };

  const handleExportStudentsCSV = () => {
    const listToExport = filteredStudents.length > 0 ? filteredStudents : students;
    const headers = ["Registration No", "Full Name", "Program", "Status", "Email", "Phone"];
    const rows = listToExport.map((s) => [
      s.reg_no,
      `"${s.full_name || `${s.first_name} ${s.last_name}`}"`,
      `"${s.program_code || s.program}"`,
      s.status,
      `"${s.email}"`,
      `"${s.phone}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `student_registry_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Sticky Page Header */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Student Registry
            </h2>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Total Enrollment: {meta.total > 0 ? meta.total.toLocaleString() : students.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap justify-start sm:justify-end">
          {/* Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm whitespace-nowrap"
            >
              Data Options <ChevronDown size={13} />
            </button>
            {isActionsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsActionsMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                  <button
                    onClick={() => { handleGoogleSheetsSync(); setIsActionsMenuOpen(false); }}
                    disabled={isSyncing}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <FileSpreadsheet size={14} className="text-green-600" />
                    Sync Sheets
                  </button>
                  <button
                    onClick={() => { handleSyncApplications(); setIsActionsMenuOpen(false); }}
                    disabled={isSyncing}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Globe size={14} className="text-[#4B0082]" />
                    Sync Web Apps
                  </button>
                  <button
                    onClick={() => { setBulkStudentsOpen(true); setIsActionsMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Layers size={14} className="text-indigo-600" />
                    Bulk JSON
                  </button>
                  <button
                    onClick={() => { setIsImportOpen(true); setIsActionsMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                    Import Excel
                  </button>
                  <button
                    onClick={() => { handleExportStudentsCSV(); setIsActionsMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700"
                  >
                    <FileSpreadsheet size={14} className="text-blue-600" />
                    Export CSV
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsEnrollOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg font-semibold text-xs sm:text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all whitespace-nowrap"
          >
            <GraduationCap size={15} /> Enroll Existing
          </button>

          <button
            onClick={() => {
              setEditingStudent(undefined);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-[#380062] transition-all font-semibold text-xs sm:text-sm border border-[#4B0082] whitespace-nowrap"
          >
            <Plus size={15} /> New Admission
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex flex-col gap-2.5 shadow-sm">
          {/* Search always full width on top */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search students..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm dark:text-white focus:border-[#4B0082] focus:ring-1 focus:ring-[#4B0082] transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Dropdowns: 2-col on mobile, 1 row on desktop */}
          <div className="grid grid-cols-2 md:flex md:flex-row gap-2 md:items-center">
            <div className="col-span-2 md:flex-1">
              <StudyCenterSelector
                value={campusFilter}
                onChange={setCampusFilter}
                includeAll={true}
              />
            </div>

            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs sm:text-sm font-medium outline-none cursor-pointer dark:text-white w-full focus:border-[#4B0082]"
            >
              <option value="All Programs">All Programs</option>
              {programRows.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            <select
              value={academicLevelFilter}
              onChange={(e) => setAcademicLevelFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs sm:text-sm font-medium outline-none cursor-pointer dark:text-white w-full focus:border-[#4B0082]"
            >
              {["All Levels", "Certificate", "Diploma", "Degree", "Masters", "PhD"].map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs sm:text-sm font-medium outline-none cursor-pointer dark:text-white w-full focus:border-[#4B0082]"
            >
              {["All Status", "Active", "Applicant", "On Leave", "Graduated", "Suspended"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* View Toggle - always at end */}
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 ml-auto col-span-1 self-center">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white dark:bg-gray-800 text-[#4B0082] dark:text-purple-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-white dark:bg-gray-800 text-[#4B0082] dark:text-purple-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                title="Table View"
              >
              <List size={16} />
            </button>
            </div>
          </div>
        </div>

        {/* Existing Grid/List Logic ... */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col group hover:shadow-lg transition-all relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-full h-1 ${student.status === "Applicant" ? "bg-orange-500" : "bg-[#4B0082]"}`}></div>

                <div className="flex justify-between items-start mb-5">
                  <div className={`w-14 h-14 rounded-full ${student.avatar_color} flex items-center justify-center text-white font-bold text-xl shadow-sm overflow-hidden border-2 border-white dark:border-gray-700`}>
                    {student.photo ? (
                      <img src={student.photo} className="w-full h-full object-cover" />
                    ) : (
                      student.first_name.charAt(0)
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md ${
                        student.status === "Active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : student.status === "Applicant" ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        : student.status === "Suspended" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {student.status}
                    </span>
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(student)} className="text-gray-400 hover:text-[#4B0082] transition-colors bg-gray-50 dark:bg-gray-700 p-1.5 rounded-md">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteStudent(student.id)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 dark:bg-gray-700 p-1.5 rounded-md">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-5">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight group-hover:text-[#4B0082] transition-colors">
                    {student.full_name || `${student.first_name} ${student.last_name}`}
                  </h3>
                  <p className="text-xs font-medium text-gray-500 mt-1">{student.reg_no}</p>
                  <p className="text-xs font-semibold text-[#4B0082] dark:text-purple-400 mt-2">
                    {student.program_code || student.program}
                  </p>
                </div>

                <div className="mt-auto space-y-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail size={14} className="text-gray-400" />
                    <span className="truncate">{student.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone size={14} className="text-gray-400" />
                    <span>{student.phone}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Academic Program
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Enrollment
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${student.avatar_color} flex items-center justify-center text-white text-sm font-bold overflow-hidden shadow-sm`}>
                            {student.photo ? (
                              <img src={student.photo} className="w-full h-full object-cover" />
                            ) : (
                              student.first_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {student.full_name || `${student.first_name} ${student.last_name}`}
                            </p>
                            <p className="text-xs font-medium text-gray-500 mt-0.5">
                              {student.reg_no}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {student.program_code}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                          {student.program}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{student.email}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{student.phone}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">
                        {student.admission_date}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                            student.status === "Active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : student.status === "Applicant" ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(student)}
                            className="p-1.5 text-gray-400 hover:text-[#4B0082] bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => deleteStudent(student.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination Bar ────────────────────────────────────── */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-6 py-3 shadow-sm">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Page {meta.page} of {meta.totalPages}
              &nbsp;·&nbsp;{meta.total.toLocaleString()} students
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={meta.page === 1}
                className="px-2 py-1 text-[10px] font-black uppercase border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082] transition-all"
              >
                «
              </button>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={meta.page <= 1}
                className="px-3 py-1 text-[10px] font-black uppercase border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082] transition-all"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const p =
                  Math.max(1, Math.min(meta.totalPages - 4, page - 2)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 text-[10px] font-black uppercase border transition-all ${
                      p === meta.page
                        ? "bg-[#4B0082] text-white border-[#4B0082]"
                        : "border-gray-200 dark:border-gray-700 hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                disabled={meta.page >= meta.totalPages}
                className="px-3 py-1 text-[10px] font-black uppercase border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082] transition-all"
              >
                Next
              </button>
              <button
                onClick={() => setPage(meta.totalPages)}
                disabled={meta.page >= meta.totalPages}
                className="px-2 py-1 text-[10px] font-black uppercase border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-[#4B0082] hover:text-white hover:border-[#4B0082] transition-all"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      <StudentRegistrationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStudent(undefined);
        }}
        onSuccess={handleAdd}
        initialData={editingStudent}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["students"] })}
      />

      <BulkEntryModal
        open={bulkStudentsOpen}
        onClose={() => setBulkStudentsOpen(false)}
        title="Bulk students (JSON lines)"
        entity="students"
        sampleLine='{"first_name":"Jane","last_name":"Doe","gender":"Female","program_code":"PROGRAM_RECORD_ID","admission_date":"2025-01-01","status":"Active","email":"j@bmi.edu","phone":"+254700000000"}'
        onSubmit={async (lines) => {
          try {
            const items = lines.map(
              (l) => JSON.parse(l) as any,
            );
            const r = await postStudentBatch(items);
            const list = await getStudents({ page: 1, perPage: 50 });
            if (list.success && list.data) setStudents(list.data.items);
            return {
              ok: (r.data?.failureCount ?? 0) === 0,
              message: `Created: ${r.data?.successCount ?? 0}, failed: ${r.data?.failureCount ?? 0}.`,
            };
          } catch {
            return { ok: false, message: "Invalid JSON on one or more lines." };
          }
        }}
      />

      {/* ── Student Enrollment Modal ───────────────────────────────────── */}
      <StudentEnrollmentForm
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        onSuccess={() => {
          setIsEnrollOpen(false);
          queryClient.invalidateQueries({ queryKey: ["students"] });
        }}
        students={filteredStudents.map((s) => ({
          id: s.id,
          name: s.full_name || `${s.first_name} ${s.last_name}`,
          regNo: s.reg_no || '',
        }))}
      />
    </div>
  );
};

export default Students;









