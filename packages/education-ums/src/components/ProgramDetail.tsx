import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from '../shims/react-router-dom';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Layers,
  BookOpen,
  Award,
  ShieldAlert,
  Compass,
  CheckCircle,
  Clock,
  Briefcase,
  ExternalLink,
} from '../shims/lucide-react';
import { Program, Faculty, Department } from "../types";
import { getProgramById, getFaculties, getDepartments } from "../services/programService";

const ProgramDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [program, setProgram] = useState<(Program & { courses: unknown[] }) | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetails() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [progRes, facRes, deptRes] = await Promise.all([
          getProgramById(id),
          getFaculties(),
          getDepartments(),
        ]);

        if (progRes.success && progRes.data) {
          setProgram(progRes.data);
        } else {
          const errMsg = typeof progRes.error === "string"
            ? progRes.error
            : (progRes.error?.message || "Failed to load program details");
          setError(errMsg);
        }

        if (facRes.success && facRes.data) setFaculties(facRes.data);
        if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to load program details", error);
        setError("Network error occurred while fetching catalog.");
       } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [id]);

  // Name map
  const facultyName = useMemo(() => {
    if (!program) return "";
    const f = faculties.find((fac) => fac.id === program.faculty_id);
    return f ? f.name : "School of Theology & Ministry";
  }, [program, faculties]);

  const deptName = useMemo(() => {
    if (!program) return "";
    const d = departments.find((dept) => dept.id === program.department_id);
    return d ? d.name : "Academic Department";
  }, [program, departments]);

  // Group program courses by semester
  const semesterGroups = useMemo(() => {
    if (!program || !program.courses) return [];
    
    // Group courses by semester_number
    const groups: Record<number, unknown[]> = {};
    
    program.courses.forEach((c: any) => {
      const sem = c.semester_number || 1;
      if (!groups[sem]) {
        groups[sem] = [];
      }
      groups[sem].push(c);
    });

    // Convert to sorted array of groups
    return Object.entries(groups)
      .map(([semNum, list]) => ({
        semesterNumber: parseInt(semNum, 10),
        courses: list.sort((a: any, b: any) => (a.code || '').localeCompare(b.code || '')),
      }))
      .sort((a, b) => a.semesterNumber - b.semesterNumber);
  }, [program]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-[#4B0082]/30 border-t-[#4B0082] rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">
          Assembling Curriculum Sheet...
        </p>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center max-w-md mx-auto">
        <ShieldAlert size={64} className="text-red-500 animate-bounce" />
        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">
          Curriculum File Error
        </h3>
        <p className="text-xs text-gray-500 font-medium leading-relaxed">
          {error || "We could not find the specified degree program in the catalog."}
        </p>
        <button
          onClick={() => navigate("/programs")}
          className="mt-4 px-6 py-2.5 bg-[#4B0082] text-white hover:bg-black font-black text-[10px] uppercase tracking-widest border border-[#FFD700]/30 shadow-xl cursor-pointer"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in relative bg-[#F8F9FA] dark:bg-[#0a0015]">
      {/* Premium Navigation Header */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={() => navigate("/programs")}
          className="p-2 text-gray-500 hover:text-white hover:bg-[#4B0082] transition-all rounded-full border border-gray-200 dark:border-gray-700 hover:scale-105 cursor-pointer"
          aria-label="Back to Catalog"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="w-1 h-6 bg-[#FFD700] rounded-none"></div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#4B0082] dark:text-purple-300">
              {program.code}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              Degree Map Details
            </span>
          </div>
          <h2 className="text-sm md:text-base font-black text-[#2E004F] dark:text-white uppercase tracking-tight line-clamp-1 mt-0.5">
            {program.name}
          </h2>
        </div>
      </div>

      {/* Main Details Layout */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Specifications Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card 1: Overview Specifications */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#4B0082]"></div>
            <h3 className="text-xs font-black text-[#2E004F] dark:text-white uppercase tracking-widest pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Compass size={14} className="text-[#FFD700]" /> Program Overview
            </h3>

            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-[#4B0082] dark:text-purple-300 rounded-xl">
                  <GraduationCap size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Degree Level</p>
                  <p className="text-xs font-black text-gray-800 dark:text-white uppercase mt-0.5">{program.level}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-[#4B0082] dark:text-purple-300 rounded-xl">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Duration</p>
                  <p className="text-xs font-black text-gray-800 dark:text-white uppercase mt-0.5">
                    {program.duration_years} Years ({program.total_semesters} Semesters)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-[#4B0082] dark:text-purple-300 rounded-xl">
                  <BookOpen size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Credit Hours</p>
                  <p className="text-xs font-black text-gray-800 dark:text-white uppercase mt-0.5">{program.total_credit_hours} Credits</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-[#4B0082] dark:text-purple-300 rounded-xl">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Study Mode</p>
                  <p className="text-xs font-black text-gray-800 dark:text-white uppercase mt-0.5">
                    {program.mode_of_study === "full_time" ? "Full Time" : program.mode_of_study || "Hybrid"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-[#4B0082] dark:text-purple-300 rounded-xl">
                  <Briefcase size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Academic Department</p>
                  <p className="text-xs font-black text-gray-800 dark:text-white uppercase mt-0.5 leading-tight">{deptName}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{facultyName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Entry Requirements & Accreditation */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#FFD700]"></div>
            <h3 className="text-xs font-black text-[#2E004F] dark:text-white uppercase tracking-widest pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Award size={14} className="text-[#4B0082]" /> Admissions & Accreditation
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Admissions Requirements</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed mt-2 bg-gray-50 dark:bg-gray-700 p-3 border-l-2 border-purple-500">
                  {program.entry_requirements || "A high school diploma, KCSE C+ equivalent or higher, certificate of Christian character endorsement, and personal testimony of ministerial vocation."}
                </div>
              </div>

              {program.accreditation_body && (
                <div className="pt-2">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Accreditation</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs font-black text-gray-700 dark:text-white">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span>Accredited by {program.accreditation_body}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Semester Timeline / Course List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col min-h-full">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xs font-black text-[#2E004F] dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-[#FFD700]" /> Curriculum Map Timeline
              </h3>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                {program.courses?.length || 0} Registered Modules
              </span>
            </div>

            {/* Curriculum Timeline */}
            <div className="mt-6 space-y-8 relative pl-6 border-l border-gray-100 dark:border-gray-800">
              {semesterGroups.map((group) => (
                <div key={group.semesterNumber} className="relative">
                  {/* Timeline bullet */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-4 border-[#4B0082] flex items-center justify-center shadow-sm"></div>

                  {/* Semester Header */}
                  <h4 className="text-sm font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest mb-4">
                    Semester {group.semesterNumber}
                  </h4>

                  {/* Course Cards list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.courses.map((course: any) => (
                      <div
                        key={course.id}
                        onClick={() => navigate(`/courses?search=${course.code}`)}
                        className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 p-4 hover:border-[#4B0082] hover:bg-white dark:hover:bg-gray-800 transition-all flex flex-col justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-mono font-black text-[#4B0082] dark:text-purple-300">
                              {course.code}
                            </span>
                            <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200/50 dark:border-gray-600">
                              {course.course_type || "core"}
                            </span>
                          </div>
                          <h5 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-[#4B0082] transition-colors leading-tight line-clamp-1">
                            {course.title}
                          </h5>
                          {course.category && (
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">
                              {course.category}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center text-[10px] text-gray-400 font-bold">
                          <span>{course.credit_hours} Credits</span>
                          <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#4B0082] dark:text-purple-300">
                            <ExternalLink size={10} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {semesterGroups.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                  <Compass size={48} className="mb-4 opacity-10" />
                  <p className="font-black uppercase tracking-widest text-xs">
                    Curriculum mapping in progress
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 font-medium">
                    Courses are currently being mapped to this program core.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramDetail;









