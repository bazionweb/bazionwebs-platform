import React, { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  
  BookOpen,
  Search,
  Save,
  Check,
  Loader2,
  
  
  Timer,
  Download,
  CheckCheck,
} from '../shims/lucide-react';
import { useStudentsQuery } from "../hooks/useEntityQueries";
import { useApiDataStore } from "../stores/apiDataStore";

interface AttendanceState {
  [studentId: string]: "present" | "absent" | "late";
}

const Attendance: React.FC = () => {
  const { data: studentsRes, isLoading: isLoadingStudents } = useStudentsQuery({
    page: 1,
    // 200 is sufficient — the UI already filters by faculty/department client-side.
    // Requesting 1000 blocks the JS thread when React reconciles the list DOM nodes.
    perPage: 200,
  });
  const students = studentsRes?.data?.items || [];
  
  const {
    attendanceRecords,
    fetchAttendance,
    createAttendanceRecord,
    updateAttendanceRecord,
    isLoading: apiLoading,
  } = useApiDataStore();

  const [selectedCourse, setSelectedCourse] = useState("School of Theology");
  const [searchTerm, setSearchTerm] = useState("");
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastMarkedAt, setLastMarkedAt] = useState<string | null>(null);

  // Explicit session timing state
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [sessionTime, setSessionTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );

  const courses = [
    { name: "School of Theology", faculty: "Theology" },
    { name: "Dept. of ICT", faculty: "ICT" },
    { name: "School of Business", faculty: "Business" },
    { name: "Education Dept.", faculty: "Education" },
  ];

  // fetchAttendance is stable (Zustand action), so this only fires once on mount.
  // The dep array must include it to satisfy the linter, but it won't re-fire.
  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const currentFaculty = useMemo(() => {
    return (
      courses.find((c) => c.name === selectedCourse)?.faculty || "Theology"
    );
  }, [selectedCourse]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const studentFaculty = (s.faculty || "").toLowerCase();
      const targetFaculty = currentFaculty.toLowerCase();
      const matchesFaculty =
        studentFaculty === targetFaculty ||
        studentFaculty.includes(targetFaculty) ||
        targetFaculty.includes(studentFaculty);

      const matchesSearch =
        `${s.first_name || ""} ${s.last_name || ""} ${s.reg_no || ""} ${s.id} ${s.department ?? ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      return matchesFaculty && matchesSearch;
    });
  }, [students, currentFaculty, searchTerm]);

  const existingRecord = useMemo(() => {
    return (attendanceRecords || []).find(
      (r) => r.courseId === selectedCourse && r.date === sessionDate
    );
  }, [attendanceRecords, selectedCourse, sessionDate]);

  useEffect(() => {
    if (existingRecord) {
      const state: AttendanceState = {};
      existingRecord.records.forEach((r) => {
        // Find matching student code or id in filtered list
        const s = students.find(stud => stud.reg_no === r.studentId || stud.id === r.studentId);
        if (s) {
          state[s.id] = r.status.toLowerCase() as "present" | "absent" | "late";
        }
      });
      setAttendance(state);
      if (existingRecord.updated) {
        setLastMarkedAt(new Date(existingRecord.updated).toLocaleString());
      }
    } else {
      setAttendance({});
      setLastMarkedAt(null);
    }
  }, [existingRecord, selectedCourse, sessionDate]);
  // Intentionally omit `students` from deps — we only need to re-sync when the
  // record or date changes, not on every student list refetch (which would cause
  // the attendance marks to reset while the user is actively marking attendance).

  const isPageLoading = isLoadingStudents || !!apiLoading?.attendanceRecords;

  const handleMark = (id: string, status: "present" | "absent" | "late") => {
    setAttendance((prev) => ({
      ...prev,
      [id]: prev[id] === status ? "absent" : status, // Toggling back defaults to absent
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const recordsPayload = filteredStudents.map((s) => {
      const rawStatus = attendance[s.id] || "absent";
      const status = (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)) as "Present" | "Absent" | "Late";
      return {
        studentId: s.reg_no || s.id,
        studentName: `${s.first_name} ${s.last_name}`,
        status,
      };
    });

    let success: boolean;
    if (existingRecord) {
      const res = await updateAttendanceRecord(existingRecord.id, {
        courseId: selectedCourse,
        date: sessionDate,
        records: recordsPayload,
      });
      success = !!res;
    } else {
      const res = await createAttendanceRecord({
        courseId: selectedCourse,
        date: sessionDate,
        records: recordsPayload,
      });
      success = !!res;
    }

    setIsSubmitting(false);
    if (success) {
      setShowSuccess(true);
      const now = new Date();
      setLastMarkedAt(
        now.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setTimeout(() => setShowSuccess(false), 3000);
      fetchAttendance(); // refresh the records
    } else {
      alert("Failed to commit attendance registry. Please try again.");
    }
  };

  const stats = useMemo(() => {
    let p = 0,
      l = 0,
      a = 0;
    filteredStudents.forEach((s) => {
      const status = attendance[s.id] || "absent";
      if (status === "present") p++;
      else if (status === "late") l++;
      else a++;
    });
    return { present: p, late: l, absent: a };
  }, [attendance, filteredStudents]);

  const markAllPresent = () => {
    const nextState: AttendanceState = { ...attendance };
    filteredStudents.forEach((s) => {
      nextState[s.id] = "present";
    });
    setAttendance(nextState);
  };

  const markAllAbsent = () => {
    const nextState: AttendanceState = { ...attendance };
    filteredStudents.forEach((s) => {
      nextState[s.id] = "absent";
    });
    setAttendance(nextState);
  };

  const handleExportCSV = () => {
    const headers = ["Registration No", "Student Name", "Department", "Status", "Course / Module", "Session Date"];
    const rows = filteredStudents.map((s) => [
      `"${s.reg_no || s.id}"`,
      `"${s.first_name} ${s.last_name}"`,
      `"${s.department || ""}"`,
      (attendance[s.id] || "absent").toUpperCase(),
      `"${selectedCourse}"`,
      `"${sessionDate}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${selectedCourse.replace(/\s+/g, "_")}_${sessionDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Loading overlay — shown while students or attendance records are in-flight */}
      {isPageLoading && (
        <div className="absolute inset-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-[#4B0082] rounded-full animate-spin" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading Registry...</p>
          </div>
        </div>
      )}
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Institutional Attendance
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Live Session Monitoring • {currentFaculty}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          {/* Date/Time Controls */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 border border-gray-100 dark:border-gray-700 shadow-sm hidden md:flex">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700">
              <Calendar
                size={12}
                className="text-[#4B0082] dark:text-[#FFD700]"
              />
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              <Timer size={12} className="text-[#4B0082] dark:text-[#FFD700]" />
              <input
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-white"
              />
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all font-bold text-[9px] uppercase tracking-wider rounded-lg shadow-xs cursor-pointer"
          >
            <Download size={12} /> Export CSV
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || filteredStudents.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] uppercase tracking-wider border border-[#FFD700]/30 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} className="text-[#FFD700]" />
            )}
            {existingRecord ? "Update Registry" : "Commit Registry"}
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar - Modules */}
      <div className="flex-shrink-0 bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <BookOpen size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Active Modules
          </span>
        </div>
        {courses.map((course) => (
          <button
            key={course.name}
            onClick={() => {
              setSelectedCourse(course.name);
            }}
            className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
              selectedCourse === course.name
                ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
            }`}
          >
            {course.name}
          </button>
        ))}
      </div>

      {/* Pinned Metrics Row - Responsive 2x2 on Mobile, 4-col on Desktop */}
      <div className="flex-shrink-0 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 z-30 shadow-xs px-3 sm:px-6 py-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {/* Present Card */}
          <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border-l-[3px] border-emerald-500 px-3 py-2 rounded-r-lg flex flex-col justify-center">
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-emerald-600 tracking-widest">
              Present
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 leading-none mt-0.5">
              {stats.present}
            </span>
          </div>

          {/* Late Card */}
          <div className="bg-amber-50/80 dark:bg-amber-950/20 border-l-[3px] border-amber-500 px-3 py-2 rounded-r-lg flex flex-col justify-center">
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-600 tracking-widest">
              Late
            </span>
            <span className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400 leading-none mt-0.5">
              {stats.late}
            </span>
          </div>

          {/* Absent Card */}
          <div className="bg-rose-50/80 dark:bg-rose-950/20 border-l-[3px] border-rose-500 px-3 py-2 rounded-r-lg flex flex-col justify-center">
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-rose-600 tracking-widest">
              Absent
            </span>
            <span className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-400 leading-none mt-0.5">
              {stats.absent}
            </span>
          </div>

          {/* Total Class Card */}
          <div className="bg-indigo-50/80 dark:bg-indigo-950/20 border-l-[3px] border-indigo-500 px-3 py-2 rounded-r-lg flex flex-col justify-center">
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-300 tracking-widest">
              Total Class
            </span>
            <span className="text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-300 leading-none mt-0.5">
              {filteredStudents.length}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Search & Bulk Actions Bar */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 sm:p-4 rounded-xl flex flex-col md:flex-row gap-3 items-stretch sm:items-center shadow-xs">
            <div className="relative flex-1 w-full">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                size={15}
              />
              <input
                type="text"
                placeholder="Search registry by ID, Name or Department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg outline-none font-medium text-xs dark:text-white focus:ring-2 focus:ring-[#4B0082]/20 focus:border-[#4B0082]"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={markAllPresent}
                type="button"
                className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
              >
                <CheckCheck size={13} /> Mark All Present
              </button>
              <button
                onClick={markAllAbsent}
                type="button"
                className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
              >
                <XCircle size={13} /> Mark All Absent
              </button>
            </div>
            {lastMarkedAt && (
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                <CheckCircle2 size={13} /> Last Save: {lastMarkedAt}
              </div>
            )}
          </div>

          {/* Student List */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xs overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const currentStatus = attendance[student.id] || "absent";
                  return (
                    <div
                      key={student.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-5 gap-3 hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white shadow-xs overflow-hidden flex-shrink-0 text-xs sm:text-sm`}
                        >
                          {student.photo ? (
                            <img
                              src={student.photo}
                              className="w-full h-full object-cover"
                              alt="S"
                            />
                          ) : (
                            student.first_name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm uppercase tracking-tight truncate">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-[9px] text-gray-500 font-mono tracking-widest uppercase truncate mt-0.5">
                            {student.reg_no || student.id} • {student.department}
                          </p>
                        </div>
                      </div>

                      {/* Status Toggle Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 bg-gray-100/80 dark:bg-gray-900/80 p-1 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
                        <button
                          onClick={() => handleMark(student.id, "present")}
                          className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "present"
                              ? "bg-emerald-500 text-white shadow-xs"
                              : "text-gray-500 hover:text-emerald-600"
                          }`}
                        >
                          <CheckCircle2 size={13} /> Present
                        </button>
                        <button
                          onClick={() => handleMark(student.id, "late")}
                          className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "late"
                              ? "bg-amber-500 text-white shadow-xs"
                              : "text-gray-500 hover:text-amber-600"
                          }`}
                        >
                          <Clock size={13} /> Late
                        </button>
                        <button
                          onClick={() => handleMark(student.id, "absent")}
                          className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "absent"
                              ? "bg-red-500 text-white shadow-xs font-black"
                              : "text-gray-500 hover:text-red-600"
                          }`}
                        >
                          <XCircle size={13} /> Absent
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center text-gray-400 font-bold uppercase tracking-widest text-xs italic">
                  No Students Identified in this Institutional Domain
                </div>
              )}
            </div>
          </div>

          {/* Footer Message */}
          <div className="bg-amber-50/80 dark:bg-amber-950/20 border-l-4 border-amber-400 p-3 sm:p-4 rounded-r-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider leading-relaxed">
                  Institutional Protocol: Students not explicitly marked as
                  'Present' or 'Late' are automatically processed as 'Absent'.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[120] animate-fade-in">
          <div className="bg-gray-900 text-[#FFD700] px-10 py-5 rounded-none shadow-2xl flex items-center gap-4 border-2 border-[#FFD700] backdrop-blur-xl">
            <Check size={24} className="animate-pulse" />
            <span className="font-black text-sm uppercase tracking-[0.25em] italic">
              Attendance Registry Successfully Committed
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;









