import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from '../shims/react-router-dom';
import {
  GraduationCap,
  Award,
  BookMarked,
  Library,
  BookOpen,
  Search,
  Plus,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Layers,
  Book,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from '../shims/lucide-react';
import { Program, Faculty, Department } from "../types";
import { getPrograms, getFaculties, getDepartments, createProgram, updateProgram, deleteProgram } from "../services/programService";
import { useQueryClient } from '../shims/tanstack-react-query';
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";


// Beautiful mapping of program levels to distinct, premium aesthetics
const LEVEL_CONFIG = {
  certificate: {
    label: "Certificates",
    gradient: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50/50 dark:bg-amber-950/10",
    border: "border-amber-200/50 dark:border-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    icon: Book,
  },
  diploma: {
    label: "Diplomas",
    gradient: "from-teal-500 to-emerald-600",
    bgLight: "bg-teal-50/50 dark:bg-teal-950/10",
    border: "border-teal-200/50 dark:border-teal-900/30",
    text: "text-teal-700 dark:text-teal-400",
    icon: BookMarked,
  },
  bachelor: {
    label: "Bachelors",
    gradient: "from-purple-500 to-indigo-600",
    bgLight: "bg-purple-50/50 dark:bg-purple-950/10",
    border: "border-purple-200/50 dark:border-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    icon: GraduationCap,
  },
  master: {
    label: "Masters",
    gradient: "from-pink-500 to-rose-600",
    bgLight: "bg-pink-50/50 dark:bg-pink-950/10",
    border: "border-pink-200/50 dark:border-pink-900/30",
    text: "text-pink-700 dark:text-pink-400",
    icon: Award,
  },
  doctorate: {
    label: "Doctorates",
    gradient: "from-blue-600 to-indigo-800",
    bgLight: "bg-blue-50/50 dark:bg-blue-950/10",
    border: "border-blue-200/50 dark:border-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: Library,
  },
};

const Programs: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinct from "loaded but empty": a failed fetch must not masquerade as
  // "No programs found", otherwise outages look like wiped data. The HTTP
  // status is kept so a dead session (401) offers log-in-again.
  const [loadError, setLoadError] = useState<{ message: string; status?: number } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [activeLevel, setActiveLevel] = useState<string>("All");

  // Load programs, faculties, and departments
  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [progRes, facRes, deptRes] = await Promise.all([
        getPrograms(),
        getFaculties(),
        getDepartments(),
      ]);

      if (progRes.success && progRes.data) {
        setPrograms(progRes.data);
      } else {
        const status =
          typeof (progRes as { status?: unknown }).status === 'number'
            ? (progRes as { status?: number }).status
            : undefined;
        const err = new Error(
          typeof progRes.error === 'string'
            ? progRes.error
            : (progRes.error as { message?: string } | undefined)?.message || 'Failed to load programs',
        );
        (err as { status?: number }).status = status;
        throw err;
      }
      if (facRes.success && facRes.data) setFaculties(facRes.data);
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to load academic catalog", error);
      setLoadError({
        message: error instanceof Error ? error.message : 'Failed to load academic catalog',
        status: typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status?: number }).status as number
          : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  const programsSessionExpired = loadError?.status === 401;

  const handleProgramsSessionExpired = async () => {
    await useAuthStore.getState().logout();
    useDataStore.getState().clearAll();
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// Normalize diverse level formats (undergraduate/bachelor, postgraduate/master, doctoral/doctorate, certificate, diploma)
const normalizeProgramLevel = (p: Partial<Program>): keyof typeof LEVEL_CONFIG => {
  const lvl = (p.level || "").toLowerCase();
  const deg = (p.degree_type || "").toLowerCase();
  if (lvl.includes("diploma") || deg.includes("diploma")) return "diploma";
  if (lvl.includes("cert") || deg.includes("cert")) return "certificate";
  if (lvl.includes("bach") || lvl.includes("undergrad") || deg.includes("bach")) return "bachelor";
  if (lvl.includes("doct") || deg.includes("doct") || lvl.includes("phd")) return "doctorate";
  if (lvl.includes("mast") || lvl.includes("postgrad") || lvl.includes("grad") || deg.includes("mast")) return "master";
  return "bachelor";
};

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.abbreviation || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFaculty =
        selectedFaculty === "All" || p.faculty_id === selectedFaculty;

      const matchesDepartment =
        selectedDepartment === "All" || p.department_id === selectedDepartment;

      const matchesLevel =
        activeLevel === "All" || normalizeProgramLevel(p) === activeLevel;

      return matchesSearch && matchesFaculty && matchesDepartment && matchesLevel;
    });
  }, [programs, searchTerm, selectedFaculty, selectedDepartment, activeLevel]);

  // Grouped Programs by level
  const groupedPrograms = useMemo(() => {
    const groups: Record<keyof typeof LEVEL_CONFIG, Program[]> = {
      certificate: [],
      diploma: [],
      bachelor: [],
      master: [],
      doctorate: [],
    };

    filteredPrograms.forEach((p) => {
      const norm = normalizeProgramLevel(p);
      if (groups[norm]) {
        groups[norm].push(p);
      }
    });

    return groups;
  }, [filteredPrograms]);

  // Department Mapping
  const deptMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((d) => {
      map[d.id] = d.name;
    });
    return map;
  }, [departments]);

  // Modal & Toast State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [newProgData, setNewProgData] = useState({
    name: "",
    code: "",
    level: "bachelor" as "certificate" | "diploma" | "bachelor" | "master" | "doctorate",
    duration_years: 4,
    total_credit_hours: 120,
    department_id: "",
    faculty_id: "",
    description: "",
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleExportCSV = () => {
    const listToExport = filteredPrograms.length > 0 ? filteredPrograms : programs;
    const headers = ["Code", "Program Name", "Level", "Duration Years", "Total Credits", "Department ID"];
    const rows = listToExport.map((p) => [
      `"${p.code}"`,
      `"${p.name}"`,
      `"${p.level}"`,
      p.duration_years,
      p.total_credit_hours,
      `"${p.department_id}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `degree_programs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgData.name || !newProgData.code) return;

    const payload = {
      ...newProgData,
      department_id: newProgData.department_id || (departments[0]?.id || "dept-1"),
      faculty_id: newProgData.faculty_id || (faculties[0]?.id || "fac-1"),
    };
    try {
      if (editingProgram) {
        const res = await updateProgram(editingProgram.id, payload);
        if (res.success && res.data) {
          setPrograms(prev => prev.map(p => p.id === editingProgram.id ? { ...p, ...(res.data as Program) } : p));
          showToast("Program updated in database!");
        } else throw new Error(typeof res.error === 'string' ? res.error : res.error?.message || 'Update failed');
      } else {
        const res = await createProgram(payload);
        if (res.success && res.data) {
          setPrograms(prev => [res.data as Program, ...prev]);
          showToast("New degree program created successfully!");
        } else throw new Error(typeof (res as any).error === 'string' ? (res as any).error : (res as any).error?.message || 'Create failed');
      }
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    } catch (err: any) {
      showToast(err?.message || 'Save failed — not persisted');
      if (!editingProgram) {
        const localProg = {
          id: `prog-${Date.now()}`,
          ...newProgData,
          department_id: newProgData.department_id || "dept-1",
          faculty_id: newProgData.faculty_id || "fac-1",
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        } as Program;
        setPrograms((prev) => [localProg, ...prev]);
      }
    } finally {
      setIsCreateModalOpen(false);
      setEditingProgram(null);
      setNewProgData({
        name: "",
        code: "",
        level: "bachelor",
        duration_years: 4,
        total_credit_hours: 120,
        department_id: "",
        faculty_id: "",
        description: "",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-[#4B0082]/30 border-t-[#4B0082] rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">
          Loading Academic Taxonomy...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in relative bg-[#F8F9FA] dark:bg-[#0a0015]">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-black text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Programs & Curricula
            </h2>
            <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
              Theological Seminary Degree Taxonomy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg shadow-xs cursor-pointer"
          >
            <Download size={12} /> Export CSV
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 shadow-md rounded-lg cursor-pointer"
          >
            <Plus size={12} className="text-[#FFD700]" /> Create Program
          </button>
        </div>
      </div>

      {/* Level Filters Quickbar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <Layers size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Degree Levels
          </span>
        </div>
        <button
          onClick={() => setActiveLevel("All")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
            activeLevel === "All"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          All Programs
        </button>
        {Object.entries(LEVEL_CONFIG).map(([key, config]) => {
          const IconComponent = config.icon;
          const isSelected = activeLevel === key;
          return (
            <button
              key={key}
              onClick={() => setActiveLevel(key)}
              className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
                isSelected
                  ? `bg-gradient-to-r ${config.gradient} text-white shadow-md border border-white/20`
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <IconComponent size={12} className={isSelected ? "text-[#FFD700]" : "text-gray-400"} />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Advanced Filters Drawer / Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col lg:flex-row gap-3 items-stretch sm:items-center shadow-xs">
        <div className="relative flex-1 w-full">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            size={15}
          />
          <input
            type="text"
            placeholder="Search programs by title, code or abbreviation..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg outline-none font-medium text-xs dark:text-white focus:ring-2 focus:ring-[#4B0082]/20 focus:border-[#4B0082]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full lg:w-auto items-center">
          <div className="flex items-center gap-2 text-gray-400 mr-2">
            <SlidersHorizontal size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">
              Filters
            </span>
          </div>

          {/* Faculty select */}
          <select
            value={selectedFaculty}
            onChange={(e) => {
              setSelectedFaculty(e.target.value);
              setSelectedDepartment("All"); // Reset department on faculty change
            }}
            className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[10px] font-black uppercase outline-none cursor-pointer dark:text-white flex-1 md:flex-initial"
          >
            <option value="All">All Faculties</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {/* Department select */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[10px] font-black uppercase outline-none cursor-pointer dark:text-white flex-1 md:flex-initial"
          >
            <option value="All">All Departments</option>
            {departments
              .filter((d) => selectedFaculty === "All" || d.faculty_id === selectedFaculty)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {Object.entries(LEVEL_CONFIG).map(([levelKey, config]) => {
          const progs = groupedPrograms[levelKey as keyof typeof LEVEL_CONFIG] || [];
          if (progs.length === 0) return null;

          const IconComponent = config.icon;

          return (
            <div key={levelKey} className="space-y-4">
              {/* Category Sub-Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                <div className={`p-2 bg-gradient-to-r ${config.gradient} text-white shadow-md rounded-xl`}>
                  <IconComponent size={16} />
                </div>
                <h3 className="text-base font-black text-[#2E004F] dark:text-white uppercase tracking-wider">
                  {config.label}
                </h3>
                <span className="ml-2 text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {progs.length}
                </span>
              </div>

              {/* Grid of Programs */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {progs.map((prog: Program) => (
                  <div
                    key={prog.id}
                    onClick={() => navigate(`/programs/${prog.id}`)}
                    className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 cursor-pointer relative overflow-hidden"
                  >
                    {/* Level Accent Bar */}
                    <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${config.gradient} group-hover:w-2.5 transition-all`}></div>

                    <div className="pl-4">
                      {/* Top Meta */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#4B0082] dark:text-purple-300 bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 border border-purple-100 dark:border-purple-900/30">
                          {prog.code}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          {prog.duration_years} Years
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight leading-snug group-hover:text-[#4B0082] dark:group-hover:text-[#FFD700] transition-colors line-clamp-2">
                        {prog.name}
                      </h4>

                      {/* Department */}
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 line-clamp-1">
                        {deptMap[prog.department_id] || "Academic Department"}
                      </p>

                      {/* Description */}
                      <p className="text-xs text-gray-400 dark:text-gray-400 font-medium line-clamp-3 mt-4 leading-relaxed">
                        {prog.description || "Comprehensive theological studies curriculum preparing leaders for ministerial excellence, biblical pedagogy, and pastoral stewardship."}
                      </p>
                    </div>

                    {/* Stats and Navigation indicator */}
                    <div className="mt-6 pl-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <BookOpen size={12} />
                          <span className="text-[10px] font-bold text-gray-500">
                            {prog.total_credit_hours} Credits
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Info size={12} />
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            {prog.mode_of_study === "full_time" ? "Full Time" : prog.mode_of_study || "Hybrid"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProgram(prog);
                            setNewProgData({ name: prog.name, code: prog.code, level: prog.level as any, duration_years: prog.duration_years, total_credit_hours: prog.total_credit_hours, department_id: prog.department_id, faculty_id: (prog as any).faculty_id || '', description: (prog as any).description || '' });
                            setIsCreateModalOpen(true);
                          }}
                          className="px-2 py-1 text-[10px] font-bold border rounded-lg hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`Delete program ${prog.code}?`)) return;
                            try {
                              await deleteProgram(prog.id);
                              setPrograms(prev => prev.filter(p => p.id !== prog.id));
                              queryClient.invalidateQueries({ queryKey: ['programs'] });
                              showToast('Program deleted from database');
                            } catch (err: any) { showToast('Delete failed'); }
                          }}
                          className="px-2 py-1 text-[10px] font-bold border rounded-lg text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                        <div className="text-gray-300 group-hover:text-[#4B0082] dark:group-hover:text-[#FFD700] group-hover:translate-x-1.5 transition-all">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredPrograms.length === 0 && !loadError && (
          <div className="py-24 flex flex-col items-center justify-center text-gray-400">
            <GraduationCap size={64} className="mb-4 opacity-20 text-[#4B0082]" />
            <h4 className="font-black uppercase tracking-widest text-base">
              No programs found
            </h4>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              Try adjusting your search criteria or catalog filters.
            </p>
          </div>
        )}

        {loadError && (
          <div className="py-24 flex flex-col items-center justify-center text-gray-400">
            <AlertTriangle size={56} className="mb-4 text-red-400" />
            <h4 className="font-black uppercase tracking-widest text-base text-gray-600 dark:text-gray-300">
              Could not load programs
            </h4>
            <p className="text-xs text-gray-500 mt-2 font-medium max-w-sm text-center">
              {programsSessionExpired
                ? 'Your session expired — please log in again. Your data is safe.'
                : 'The server could not be reached. Your data is safe.'}
            </p>
            {loadError.status !== undefined && (
              <p className="mt-1 font-mono text-[10px] text-gray-400">
                HTTP {loadError.status}{loadError.message ? ` · ${loadError.message.slice(0, 120)}` : ''}
              </p>
            )}
            {programsSessionExpired ? (
              <button
                onClick={() => handleProgramsSessionExpired()}
                className="mt-5 px-4 py-2 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer"
              >
                Log in again
              </button>
            ) : (
              <button
                onClick={() => loadData()}
                className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-[#4B0082] text-white hover:bg-black transition-all font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-md cursor-pointer"
              >
                <RefreshCw size={12} /> Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Program Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg">
                  <GraduationCap size={18} />
                </span>
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {editingProgram ? 'Edit Degree Program' : 'Create Degree Program'}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProgramSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Program Full Name *</label>
                <input
                  type="text"
                  required
                  value={newProgData.name}
                  onChange={(e) => setNewProgData({ ...newProgData, name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  placeholder="e.g. Bachelor of Theology & Pastoral Ministry"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Program Code *</label>
                  <input
                    type="text"
                    required
                    value={newProgData.code}
                    onChange={(e) => setNewProgData({ ...newProgData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none font-mono"
                    placeholder="BTH-101"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Academic Level *</label>
                  <select
                    value={newProgData.level}
                    onChange={(e) => setNewProgData({ ...newProgData, level: e.target.value as any })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  >
                    <option value="certificate">Certificate</option>
                    <option value="diploma">Diploma</option>
                    <option value="bachelor">Bachelor Degree</option>
                    <option value="master">Master Degree</option>
                    <option value="doctorate">Doctorate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Duration (Years)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newProgData.duration_years}
                    onChange={(e) => setNewProgData({ ...newProgData, duration_years: Number(e.target.value) })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Total Credit Hours</label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={newProgData.total_credit_hours}
                    onChange={(e) => setNewProgData({ ...newProgData, total_credit_hours: Number(e.target.value) })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={newProgData.department_id}
                  onChange={(e) => setNewProgData({ ...newProgData, department_id: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Program Overview & Description</label>
                <textarea
                  rows={2}
                  value={newProgData.description}
                  onChange={(e) => setNewProgData({ ...newProgData, description: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  placeholder="Program objectives, ministerial focus, and academic requirements..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black uppercase text-xs tracking-wider bg-[#2E004F] text-[#FFD700] hover:bg-purple-950 rounded-lg shadow-md transition-all"
                >
                  {editingProgram ? 'Save Changes' : 'Create Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[150] animate-fade-in">
          <div className="bg-[#2E004F] text-[#FFD700] px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-purple-800">
            <CheckCircle2 size={18} />
            <span className="font-bold text-xs">{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Programs;









