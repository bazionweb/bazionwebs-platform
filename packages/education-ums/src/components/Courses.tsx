import React, { useState, useMemo } from "react";
import {
  
  Plus,
  Search,
  Layers,
  GraduationCap,
  BookMarked,
  Hash,
  Edit,
  Trash2,
  LayoutGrid,
  List,
  Award,
  Library,
  AlertTriangle,
  RefreshCw,
} from '../shims/lucide-react';
import { Course } from "../types";
import CourseModal from "./CourseModal";
import {
  createCourse as createCourseApi,
  deleteCourse as deleteCourseApi,
  updateCourse as updateCourseApi,
  getCourses,
} from "../services/courseService";
import { BulkEntryModal } from "./BulkEntryModal";
import { postCourseBatch } from "../services/batchService";
import { useDataStore } from "../stores/dataStore";
import { useAuthStore } from "../stores/authStore";
import { usePagination } from "../hooks/usePagination";
import { useCoursesQuery } from "../hooks/useEntityQueries";
import { useQueryClient } from '../shims/tanstack-react-query';
import { useDialogStore } from "../stores/dialogStore";

const Courses: React.FC = () => {
  const queryClient = useQueryClient();
  const courses = useDataStore((s) => s.courses);
  const _setCourses = useDataStore((s) => s.setCourses);
  const setCourses = (action: React.SetStateAction<Course[]>) => {
    if (typeof action === "function") {
      _setCourses(
        (action as (prev: Course[]) => Course[])(
          useDataStore.getState().courses,
        ),
      );
    } else {
      _setCourses(action);
    }
  };
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLevel, setActiveLevel] = useState("All Levels");
  const [facultyFilter, setFacultyFilter] = useState("All Faculty");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [bulkCoursesOpen, setBulkCoursesOpen] = useState(false);
  const { page, perPage, meta, setPage, setMeta } = usePagination(50);

  const {
    data: courseResponse,
    refetch: refetchCourses,
    isFetching: coursesFetching,
    isError: coursesQueryError,
  } = useCoursesQuery({
    page,
    perPage,
    search: searchTerm,
  });

  // Distinguish "no courses match" from "the request failed". Services return
  // { success: false } on network/auth failures instead of throwing, so an
  // explicit flag is required — otherwise an outage renders the exact same
  // "not found" message as a genuinely empty catalog. The HTTP status is kept
  // so a dead session (401) gets a log-in-again action instead of a retry.
  const coursesFailure =
    !coursesFetching
      ? coursesQueryError
        ? { status: 0, message: 'Request failed' }
        : courseResponse != null && courseResponse.success === false
          ? {
              status:
                typeof (courseResponse as { status?: unknown }).status === 'number'
                  ? (courseResponse as { status?: number }).status
                  : undefined,
              message:
                typeof courseResponse.error === 'string' && courseResponse.error
                  ? courseResponse.error
                  : 'Request failed',
            }
          : null
      : null;
  const coursesLoadFailed = coursesFailure != null;
  const coursesSessionExpired = coursesFailure?.status === 401;

  const handleCoursesSessionExpired = async () => {
    await useAuthStore.getState().logout();
    useDataStore.getState().clearAll();
  };

  const pagedCourses = useMemo(
    () => (courseResponse?.success ? courseResponse.data?.items ?? [] : []),
    [courseResponse],
  );

  React.useEffect(() => {
    if (courseResponse?.success && courseResponse.data) {
      const { page: p, perPage: pp, total } = courseResponse.data;
      setMeta({ page: p, perPage: pp, total });
    }
  }, [courseResponse, setMeta]);

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, facultyFilter, activeLevel, setPage]);

  const sourceCourses = useMemo(
    () => (pagedCourses.length > 0 ? pagedCourses : courses),
    [pagedCourses, courses],
  );

  const facultyOptions = useMemo(() => {
    const fromData = [
      ...new Set(sourceCourses.map((c: any) => c.faculty || c.department).filter(Boolean)),
    ];
    return ["All Faculty", ...fromData.sort()];
  }, [sourceCourses]);

  const filteredCourses = useMemo(() => {
    return sourceCourses.filter((course: any) => {
      const matchesSearch =
        !searchTerm ||
        (course.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.code || "").toLowerCase().includes(searchTerm.toLowerCase());
      const deptOrFac = course.faculty || course.department || "";
      const matchesFaculty =
        facultyFilter === "All Faculty" || deptOrFac === facultyFilter;

      let matchesLevel = true;
      if (activeLevel !== "All Levels") {
        const lvl = String(course.level || "").toLowerCase();
        const title = (course.title || "").toLowerCase();
        const code = (course.code || "").toUpperCase();
        if (activeLevel === "Undergraduate") {
          matchesLevel = lvl.includes("undergrad") || lvl === "100" || lvl === "200" || lvl === "300" || lvl === "400";
        } else if (activeLevel === "Postgraduate" || activeLevel === "Masters") {
          matchesLevel = lvl.includes("master") || lvl.includes("postgrad") || lvl === "500" || lvl === "600" || title.includes("master") || title.includes("mdiv");
        } else if (activeLevel === "PhD") {
          matchesLevel = lvl.includes("phd") || lvl.includes("doct") || lvl === "700" || lvl === "800" || title.includes("doctor") || code.startsWith("D");
        } else if (activeLevel === "Diploma") {
          matchesLevel = lvl.includes("diploma") || title.includes("diploma");
        } else if (activeLevel === "Certificate") {
          matchesLevel = lvl.includes("cert") || title.includes("certificate");
        }
      }

      return matchesSearch && matchesFaculty && matchesLevel;
    });
  }, [sourceCourses, searchTerm, facultyFilter, activeLevel]);

  const handleSave = async (courseData: Partial<Course>) => {
    if (editingCourse) {
      // Update existing course
      try {
        const result = await updateCourseApi(editingCourse.id, courseData);

        if (result.success) {
          // Use server response when available; fall back to local merge.
          const next = result.data
            ? result.data
            : ({ ...editingCourse, ...courseData } as Course);
          setCourses((prev) =>
            prev.map((c) => (c.id === editingCourse.id ? next : c)),
          );
          await refetchCourses();
          queryClient.invalidateQueries({ queryKey: ['courses'] });
          await useDialogStore.getState().alert({ title: "Course Updated", message: "The course record has been successfully updated in the institutional course registry.", variant: "success", confirmText: "Acknowledged", badgeText: "Academic Registry" });
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            "Backend update failed, updating local state only",
            result.error,
          );
          setCourses((prev) =>
            prev.map((c) =>
              c.id === editingCourse.id
                ? ({ ...c, ...courseData } as Course)
                : c,
            ),
          );
          await useDialogStore.getState().alert({ title: "Course Updated (Offline Mode)", message: "The course has been updated locally. Changes have not been persisted to the server — the academic database may be temporarily unavailable.", variant: "warning", confirmText: "Understood", badgeText: "Offline Notice" });
        }
      } catch (error) { // eslint-disable-next-line no-console
        console.error("Error updating course:", error);
        setCourses((prev) =>
          prev.map((c) =>
            c.id === editingCourse.id ? ({ ...c, ...courseData  } as Course) : c,
          ),
        );
        await useDialogStore.getState().alert({ title: "Course Updated (Offline Mode)", message: "The course has been updated locally. Changes have not been persisted to the server — the academic database may be temporarily unavailable.", variant: "warning", confirmText: "Understood", badgeText: "Offline Notice" });
      }
    } else {
      // Add new course
      const newCourse: Course = {
        ...(courseData as Course),
        id: `CRS-${Math.floor(Math.random() * 9000) + 1000}`,
      };

      try {
        const result = await createCourseApi(newCourse);

        if (result.success) {
          setCourses((prev) => [result.data || newCourse, ...prev]);
          await refetchCourses();
          queryClient.invalidateQueries({ queryKey: ['courses'] });
          await useDialogStore.getState().alert({ title: "Course Added", message: "The new course has been successfully registered in the institutional academic catalogue.", variant: "success", confirmText: "Acknowledged", badgeText: "Academic Registry" });
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            "Backend save failed, adding to local state only",
            result.error,
          );
          setCourses((prev) => [newCourse, ...prev]);
          await useDialogStore.getState().alert({ title: "Course Added (Offline Mode)", message: "The course has been added locally. It has not been persisted to the server — the academic database may be temporarily unavailable.", variant: "warning", confirmText: "Understood", badgeText: "Offline Notice" });
        }
      } catch (error) { // eslint-disable-next-line no-console
        console.error("Error saving course:", error);
        setCourses((prev) => [newCourse, ...prev]);
        await useDialogStore.getState().alert({ title: "Course Added (Offline Mode)", message: "The course has been added locally. It has not been persisted to the server — the academic database may be temporarily unavailable.", variant: "warning", confirmText: "Understood", badgeText: "Offline Notice" });
       }
    }
    setEditingCourse(null);
  };

  const deleteCourse = async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Delete Course from Academic Registry",
      message: "Are you sure you want to permanently remove this course from the institutional academic catalogue?",
      detail: "Deleting this course will remove it from the degree programme offerings and may affect enrolled students. Ensure the Registrar and Faculty Dean have authorised this removal before proceeding.",
      confirmText: "Delete Course",
      cancelText: "Retain Course",
      variant: "danger",
      badgeText: "Academic Registry",
    });
    if (confirmed) {
      try {
        const result = await deleteCourseApi(id);
        if (result.success) {
          setCourses((prev) => prev.filter((c) => c.id !== id));
          await refetchCourses();
          queryClient.invalidateQueries({ queryKey: ['courses'] });
          await useDialogStore.getState().alert({ title: "Course Deleted", message: "The course has been successfully removed from the institutional academic catalogue.", variant: "success", confirmText: "Acknowledged", badgeText: "Academic Registry" });
        } else {
          // eslint-disable-next-line no-console
          console.warn("Backend delete failed, removing from local state only", result.error);
          setCourses((prev) => prev.filter((c) => c.id !== id));
          await useDialogStore.getState().alert({ title: "Course Removed (Offline Mode)", message: "The course was removed locally but could not be deleted from the server. The academic database may be temporarily unavailable.", variant: "warning", confirmText: "Understood", badgeText: "Offline Notice" });
        }
      } catch (error) { // eslint-disable-next-line no-console
        console.error("Error deleting course:", error);
        setCourses((prev) => prev.filter((c) => c.id !== id));
        await useDialogStore.getState().alert({ title: "Course Removed (Offline Mode)", message: "The course was removed locally but could not be deleted from the server. The academic database may be temporarily unavailable.", variant: "warning", confirmText: "Understood", badgeText: "Offline Notice" });
       }
    }
  };

  const openModal = (course?: Course) => {
    setEditingCourse(course || null);
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    const listToExport = filteredCourses.length > 0 ? filteredCourses : courses;
    const headers = ["Course Code", "Title", "Faculty", "Department", "Level", "Credit Hours", "Status"];
    const rows = listToExport.map((c) => [
      `"${c.code}"`,
      `"${c.title}"`,
      `"${c.faculty || ""}"`,
      `"${(c as any).department || ""}"`,
      `"${(c as any).level || ""}"`,
      c.credit_hours,
      `"${(c as any).status || "Published"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `courses_catalog_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Curriculum Management
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Institutional Course Catalog
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-[#4B0082] text-white shadow-xs" : "text-gray-400 hover:text-[#4B0082]"}`}
              title="Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-[#4B0082] text-white shadow-xs" : "text-gray-400 hover:text-[#4B0082]"}`}
              title="List View"
            >
              <List size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg shadow-xs cursor-pointer"
            >
              Export CSV
            </button>
            <button
              onClick={() => setBulkCoursesOpen(true)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white dark:bg-gray-800 text-[#4B0082] dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg shadow-xs cursor-pointer"
            >
              Bulk JSON
            </button>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-1 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white hover:bg-purple-950 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 shadow-md rounded-lg cursor-pointer"
            >
              <Plus size={13} className="text-[#FFD700]" /> Add Course
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Programs Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <BookMarked size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Programs
          </span>
        </div>
        {[
          { id: "All Levels", label: "All Programs", icon: Layers },
          { id: "Diploma", label: "Diploma", icon: BookMarked },
          { id: "Undergraduate", label: "Degree", icon: GraduationCap },
          { id: "Masters", label: "Masters", icon: Award },
          { id: "PhD", label: "PhD", icon: Library },
          { id: "Certificate", label: "Certificate", icon: Hash },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveLevel(tab.id)}
            className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              activeLevel === tab.id
                ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
            }`}
          >
            <tab.icon
              size={12}
              className={
                activeLevel === tab.id ? "text-[#FFD700]" : "text-gray-400"
              }
            />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Responsive Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center shadow-xs">
        <div className="relative flex-1 w-full">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            size={15}
          />
          <input
            type="text"
            placeholder="Search by course name, code or description..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg outline-none font-medium text-xs dark:text-white focus:ring-2 focus:ring-[#4B0082]/20 focus:border-[#4B0082]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={facultyFilter}
          onChange={(e) => setFacultyFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-[10px] font-bold uppercase outline-none cursor-pointer dark:text-white rounded-lg w-full sm:w-auto"
        >
          {facultyOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 flex flex-col group hover:shadow-xl transition-all relative overflow-hidden rounded-xl"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#4B0082] group-hover:w-2 transition-all"></div>

                <div className="flex justify-between items-start mb-3 pl-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono">
                    {course.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md border ${
                      (course as any).status === "Published"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : (course as any).status === "Draft"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    {(course as any).status}
                  </span>
                </div>

                <div className="pl-3 mb-4 flex-1">
                  <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight leading-snug group-hover:text-[#4B0082] transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-[9px] font-bold text-[#4B0082] dark:text-purple-300 uppercase tracking-widest mt-1.5">
                    {(course as any).category ? `${(course as any).category} • ` : ""}{(course as any).department || (course as any).department_name || "Academic Department"}
                  </p>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {(course as any).description}
                  </div>
                </div>

                <div className="mt-auto pl-3 pt-3 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded">
                    {course.credit_hours ?? (course as any).credits ?? 3} Credits
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(course)}
                      className="p-1.5 text-gray-400 hover:text-[#4B0082] transition-colors"
                      title="Edit Course"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => deleteCourse(course.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete Course"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredCourses.length === 0 && !coursesLoadFailed && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 mb-4">
                  <Layers size={32} />
                </div>
                <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">
                  No courses found
                </h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Try adjusting your search criteria or program level filter.
                </p>
              </div>
            )}
            {coursesLoadFailed && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 rounded-2xl flex items-center justify-center text-red-400 mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Could not load courses
                </h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  {coursesSessionExpired
                    ? 'Your session expired — please log in again. Your data is safe.'
                    : 'The server could not be reached. Your data is safe — try again.'}
                </p>
                {coursesFailure && coursesFailure.status !== undefined && (
                  <p className="mt-1 font-mono text-[10px] text-gray-400">
                    HTTP {coursesFailure.status}{coursesFailure.message ? ` · ${coursesFailure.message.slice(0, 120)}` : ''}
                  </p>
                )}
                {coursesSessionExpired ? (
                  <button
                    onClick={() => handleCoursesSessionExpired()}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer"
                  >
                    Log in again
                  </button>
                ) : (
                  <button
                    onClick={() => refetchCourses()}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700 overflow-x-auto w-full">
            <div className="min-w-[680px]">
              {/* Table Header */}
              <div className="bg-gray-900 text-gray-400 uppercase text-[9px] font-black tracking-[0.2em] shadow-xs border-b border-gray-800 grid grid-cols-[100px_2fr_1.5fr_90px_100px_80px] gap-4 items-center">
                <div className="px-5 py-3.5">Code</div>
                <div className="px-5 py-3.5">Course Title</div>
                <div className="px-5 py-3.5">Department</div>
                <div className="px-5 py-3.5 text-center">Credits</div>
                <div className="px-5 py-3.5 text-center">Status</div>
                <div className="px-5 py-3.5 text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group grid grid-cols-[100px_2fr_1.5fr_90px_100px_80px] gap-4 items-center"
                  >
                    <div className="px-5 py-4 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300 truncate">
                      {course.code}
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight truncate">
                        {course.title}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 truncate">
                        {(course as any).level}
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase truncate">
                        {(course as any).department || (course as any).department_name || "General"}
                      </p>
                      <p className="text-[9px] font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest mt-0.5 truncate">
                        {(course as any).category ?? ""}
                      </p>
                    </div>
                    <div className="px-5 py-4 text-center font-bold text-gray-600 dark:text-gray-400 text-xs">
                      {course.credit_hours ?? (course as any).credits ?? 3}
                    </div>
                    <div className="px-5 py-4 text-center">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border whitespace-nowrap rounded-md ${
                          ((course as any).status === "Published" || (course as any).is_active === 1)
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : ((course as any).status === "Draft" || (course as any).is_active === 0)
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {(course as any).status || ((course as any).is_active === 0 ? "Draft" : "Published")}
                      </span>
                    </div>
                    <div className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(course)}
                          className="p-1.5 text-gray-400 hover:text-[#4B0082]"
                          title="Edit Course"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => deleteCourse(course.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500"
                          title="Delete Course"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCourses.length === 0 && !coursesLoadFailed && (
                  <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                    No curriculum modules found
                  </div>
                )}
                {coursesLoadFailed && (
                  <div className="py-20 text-center flex flex-col items-center justify-center">
                    <AlertTriangle size={32} className="mb-3 text-red-400" />
                    <p className="font-bold uppercase tracking-widest text-xs text-gray-500">
                      Could not load courses
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium normal-case tracking-normal">
                      {coursesSessionExpired
                        ? 'Your session expired — please log in again. Your data is safe.'
                        : 'The server could not be reached. Your data is safe.'}
                    </p>
                    {coursesFailure && coursesFailure.status !== undefined && (
                      <p className="mt-1 font-mono text-[10px] text-gray-400">
                        HTTP {coursesFailure.status}{coursesFailure.message ? ` · ${coursesFailure.message.slice(0, 120)}` : ''}
                      </p>
                    )}
                    {coursesSessionExpired ? (
                      <button
                        onClick={() => handleCoursesSessionExpired()}
                        className="mt-4 px-4 py-2 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer"
                      >
                        Log in again
                      </button>
                    ) : (
                      <button
                        onClick={() => refetchCourses()}
                        className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer"
                      >
                        <RefreshCw size={12} /> Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Pagination Bar ────────────────────────────────────── */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-6 py-3 shadow-sm mt-6">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Page {meta.page} of {meta.totalPages}
              &nbsp;·&nbsp;{meta.total.toLocaleString()} courses
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

      <CourseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editData={editingCourse}
      />

      <BulkEntryModal
        open={bulkCoursesOpen}
        onClose={() => setBulkCoursesOpen(false)}
        title="Bulk courses (JSON lines)"
        entity="courses"
        sampleLine='{"name":"Sample Course","code":"SMPL101","faculty":"Theology","department":"Ministry","level":"Undergraduate","credits":3,"status":"Published","description":"At least ten chars here.","syllabus":"At least ten chars in syllabus text."}'
        onSubmit={async (lines) => {
          try {
            const items = lines.map(
              (l) => JSON.parse(l) as any,
            );
            const r = await postCourseBatch(items);
            const list = await getCourses({ perPage: 500 });
            if (list.success && list.data) setCourses(list.data.items);
            return {
              ok: (r.data?.failureCount ?? 0) === 0,
              message: `Created: ${r.data?.successCount ?? 0}, failed: ${r.data?.failureCount ?? 0}.`,
            };
          } catch {
            return { ok: false, message: "Invalid JSON on one or more lines." };
          }
        }}
      />
    </div>
  );
};

export default Courses;









