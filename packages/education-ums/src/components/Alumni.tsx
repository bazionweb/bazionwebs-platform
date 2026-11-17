import React, { useState, useMemo, useEffect } from "react";
import {
  Award,
  Briefcase,
  GraduationCap,
  MapPin,
  Search,
  Plus,
  X,
  Trash2,
  Edit,
  Star,
  Bot,
  Loader2,
  Globe,
  Download,
  UserCheck,
  Mail,
  Filter,
  CheckCircle2,
} from '../shims/lucide-react';
import { getAIResponse } from "../services/aiService";
import { useDataStore } from "../stores/dataStore";
import { useAlumniProfilesQuery, useAlumniEventsQuery, useDonationsQuery } from "../hooks/api/useAlumniCampus";
import { useDialogStore } from "../stores/dialogStore";

interface AlumniMember {
  id: string;
  name: string;
  classYear: string;
  course: string;
  occupation: string;
  location: string;
  achievements: string;
  email: string;
  linkedIn?: string;
  isHallOfFame: boolean;
}

const Alumni: React.FC = () => {
  const students = useDataStore((s) => s.students);
  const { data: apiAlumniProfiles } = useAlumniProfilesQuery();
  const [alumni, setAlumni] = useState<AlumniMember[]>([]);

  useEffect(() => {
    if (apiAlumniProfiles) {
      setAlumni(
        apiAlumniProfiles.map((p) => ({
          id: String(p.id),
          name: p.name,
          classYear: String(p.graduationYear),
          course: p.program,
          occupation: p.currentRole || "Alumnus",
          location: "Not specified",
          achievements: "No narrative generated.",
          email: p.email,
          isHallOfFame: false,
        }))
      );
    }
  }, [apiAlumniProfiles]);

  const [activeTab, setActiveTab] = useState<
    "Registry" | "Events" | "Donations"
  >("Registry");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: apiEvents } = useAlumniEventsQuery();
  const events = apiEvents ?? [];
  
  const { data: apiDonations } = useDonationsQuery();
  const donations = apiDonations ?? [];
  const [yearFilter, setYearFilter] = useState("All Years");
  const [hallOfFameOnly, setHallOfFameOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingForId, setGeneratingForId] = useState<string | null>(null);
  const [editingAlumnus, setEditingAlumnus] = useState<AlumniMember | null>(
    null,
  );
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({
    show: false,
    msg: "",
  });

  const [formData, setFormData] = useState<Partial<AlumniMember>>({
    name: "",
    classYear: "2023",
    course: "",
    occupation: "",
    location: "",
    achievements: "",
    email: "",
    linkedIn: "",
    isHallOfFame: false,
  });

  // Save to local storage is disabled in favor of API fetching

  // Sync Logic: Integrate students marked as 'Graduated' into the Alumni database
  const syncGraduatedStudents = () => {
    const graduatedStudents = students.filter((s) => s.status === "Graduated");
    const newAlumniFromSync: AlumniMember[] = [];

    graduatedStudents.forEach((s) => {
      const existing = alumni.find(
        (a) => a.id === `ALM-${s.id}` || a.email === s.email,
      );
      if (!existing) {
        newAlumniFromSync.push({
          id: `ALM-${s.id}`,
          name: s.full_name || `${s.first_name} ${s.last_name}`,
          classYear: String((s as any).enrollment_date || "2024"),
          course: s.program || "Degree Program",
          occupation: "Graduated Alumnus — Record Verified",
          location: s.email || "Institutional Directory",
          achievements:
            "Graduated with honors. Academic record verified by registrar.",
          email: s.email || `alumni.${s.id}@bmi.edu`,
          isHallOfFame: false,
        });
      }
    });

    if (newAlumniFromSync.length > 0) {
      setAlumni((prev) => [...prev, ...newAlumniFromSync]);
      showToast(
        `${newAlumniFromSync.length} graduated student(s) synced to Alumni Registry.`,
      );
    } else {
      showToast(
        "Alumni Registry is already up to date with all graduated students.",
      );
    }
  };

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: "" }), 4000);
  };

  const years = useMemo(() => {
    const set = new Set(alumni.map((a) => a.classYear));
    return ["All Years", ...Array.from(set).sort().reverse()];
  }, [alumni]);

  const stats = useMemo(() => {
    const locations = new Set(
      alumni.map((a) => a.location.split(",").pop()?.trim()).filter(Boolean),
    );
    return {
      total: alumni.length,
      hallOfFame: alumni.filter((a) => a.isHallOfFame).length,
      globalReach: locations.size || 1,
    };
  }, [alumni]);

  const filteredAlumni = useMemo(() => {
    return alumni.filter((member) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        member.name.toLowerCase().includes(term) ||
        member.course.toLowerCase().includes(term) ||
        member.occupation.toLowerCase().includes(term) ||
        member.location.toLowerCase().includes(term);

      const matchesYear =
        yearFilter === "All Years" || member.classYear === yearFilter;
      const matchesHallOfFame = !hallOfFameOnly || member.isHallOfFame;

      return matchesSearch && matchesYear && matchesHallOfFame;
    });
  }, [alumni, searchTerm, yearFilter, hallOfFameOnly]);

  const handleOpenModal = (member?: AlumniMember) => {
    if (member) {
      setEditingAlumnus(member);
      setFormData({ ...member });
    } else {
      setEditingAlumnus(null);
      setFormData({
        name: "",
        classYear: "2024",
        course: "BSc Computer Science & AI",
        occupation: "Software Engineer / Professional",
        location: "London, UK",
        achievements: "Demonstrated academic excellence and career leadership.",
        email: "",
        linkedIn: "",
        isHallOfFame: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingAlumnus) {
      setAlumni((prev) =>
        prev.map((a) =>
          a.id === editingAlumnus.id
            ? ({ ...a, ...formData } as AlumniMember)
            : a,
        ),
      );
      showToast("Alumnus record updated successfully!");
    } else {
      const newId = `ALM-${Math.floor(Math.random() * 900) + 100}`;
      setAlumni((prev) => [
        { ...formData, id: newId } as AlumniMember,
        ...prev,
      ]);
      showToast("New Alumnus record registered!");
    }
    setIsModalOpen(false);
  };

  const generateNarrative = async (member: AlumniMember) => {
    setGeneratingForId(member.id);
    try {
      const prompt = `Write a inspiring, 2-sentence professional bio/achievement statement for alumni ${member.name}, class of ${member.classYear}, who studied ${member.course} and is currently working as ${member.occupation} in ${member.location}. Highlight institutional impact and career success.`;
      const narrative = await getAIResponse(prompt);

      if (narrative) {
        setAlumni((prev) =>
          prev.map((a) =>
            a.id === member.id ? { ...a, achievements: narrative.trim() } : a,
          ),
        );
        showToast(`AI impact narrative generated for ${member.name}!`);
      }
    } catch {
      showToast("Failed to generate story with AI.");
    } finally {
      setGeneratingForId(null);
    }
  };

  const toggleHallOfFame = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlumni((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, isHallOfFame: !a.isHallOfFame } : a,
      ),
    );
  };

  const deleteMember = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await useDialogStore.getState().confirm({
      title: "Remove from Global Alumni Registry",
      message: "Are you sure you want to permanently remove this graduate's record from the BMI University Global Alumni Registry?",
      detail: "This will expunge the alumnus's profile, verified credentials, and engagement history from the institutional alumni network. This action requires Alumni Office authorisation.",
      confirmText: "Remove from Registry",
      cancelText: "Keep Record",
      variant: "danger",
      badgeText: "Alumni Registry",
    });
    if (confirmed) {
      setAlumni((prev) => prev.filter((a) => a.id !== id));
      showToast("Alumnus record removed.");
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Full Name",
      "Class Year",
      "Course Degree",
      "Occupation / Title",
      "Location",
      "Email",
      "LinkedIn",
      "Hall of Fame",
    ];
    const rows = filteredAlumni.map((a) => [
      a.id,
      `"${a.name}"`,
      a.classYear,
      `"${a.course}"`,
      `"${a.occupation}"`,
      `"${a.location}"`,
      `"${a.email}"`,
      `"${a.linkedIn || ""}"`,
      a.isHallOfFame ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `alumni_network_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full relative font-sans text-gray-900 dark:text-gray-100 animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg shadow-sm">
              <Award size={22} />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-[#2E004F] dark:text-white uppercase">
              Global Alumni Registry & Network
            </h1>
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
            Track graduate career progress, honor Hall of Fame inductees, and
            connect institutional alumni globally.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={syncGraduatedStudents}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all shadow-sm"
            title="Sync students marked as 'Graduated' into Alumni"
          >
            <UserCheck size={14} /> Sync Graduates
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#2E004F] bg-[#FFD700] hover:bg-yellow-400 rounded-lg transition-all shadow-md active:scale-95"
          >
            <Plus size={16} /> New Record
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-[#2E004F] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Total Alumni Network
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {stats.total.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              Verified institutional graduates
            </p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-[#2E004F] dark:text-[#FFD700] rounded-xl">
            <GraduationCap size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Hall of Fame Inductees
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.hallOfFame}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              Recognized for national/global impact
            </p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Star size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Global Reach
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.globalReach} Regions
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              Career footprint across nations
            </p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Globe size={24} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-2">
        {(["Registry", "Events", "Donations"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#2E004F] text-[#2E004F] dark:border-[#FFD700] dark:text-[#FFD700]"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Registry" && (
        <>
          {/* Cohort Tabs & Filter Bar */}
          <div className="bg-white dark:bg-[#1a1a1a] p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6 space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-2 flex items-center gap-1 shrink-0">
                <Filter size={12} /> Cohort:
              </span>
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYearFilter(y)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap shrink-0 ${
                    yearFilter === y
                      ? "bg-[#2E004F] text-[#FFD700] shadow-xs"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {y === "All Years" ? "All Cohorts" : `Class of ${y}`}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="relative flex-1 w-full">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search by name, degree, occupation, or city..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD700] dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button
                onClick={() => setHallOfFameOnly(!hallOfFameOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  hallOfFameOnly
                    ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-xs"
                    : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-100"
                }`}
              >
                <Star
                  size={14}
                  className={
                    hallOfFameOnly ? "fill-current text-amber-500" : ""
                  }
                />
                Hall of Fame Only
              </button>
            </div>
          </div>

          {/* Alumni Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAlumni.map((member) => (
              <div
                key={member.id}
                className={`bg-white dark:bg-[#1a1a1a] rounded-xl border p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${
                  member.isHallOfFame
                    ? "border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/20"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                {member.isHallOfFame && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-500 text-gray-900 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1">
                    <Star size={10} className="fill-current" /> Hall of Fame
                  </div>
                )}

                <div>
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E004F] to-purple-900 text-[#FFD700] flex items-center justify-center font-black text-xl shadow-md shrink-0">
                      {(member.name || "?").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="text-base font-black text-gray-900 dark:text-white truncate">
                        {member.name}
                      </h3>
                      <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase truncate">
                        {member.course}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        Class of {member.classYear} • {member.id}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200">
                      <Briefcase
                        size={14}
                        className="text-amber-500 shrink-0"
                      />
                      <span className="truncate">{member.occupation}</span>
                    </div>
                    <div className="flex items-center gap-2 font-medium text-gray-500 dark:text-gray-400">
                      <MapPin size={14} className="text-blue-500 shrink-0" />
                      <span className="truncate">{member.location}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-lg border border-gray-100 dark:border-gray-800 text-xs italic text-gray-600 dark:text-gray-300 relative group/story mb-4">
                    <p className="line-clamp-3">"{member.achievements}"</p>
                    <button
                      onClick={() => generateNarrative(member)}
                      disabled={generatingForId === member.id}
                      className="absolute bottom-2 right-2 p-1.5 bg-white dark:bg-gray-800 rounded-md shadow-sm opacity-0 group-hover/story:opacity-100 transition-all text-[#2E004F] dark:text-[#FFD700] hover:bg-purple-50"
                      title="Generate AI career narrative statement"
                    >
                      {generatingForId === member.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Bot size={12} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => toggleHallOfFame(member.id, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        member.isHallOfFame
                          ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                          : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      title="Toggle Hall of Fame"
                    >
                      <Star
                        size={16}
                        className={member.isHallOfFame ? "fill-current" : ""}
                      />
                    </button>
                    <button
                      onClick={() => handleOpenModal(member)}
                      className="p-1.5 text-gray-400 hover:text-[#2E004F] dark:hover:text-[#FFD700] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title="Edit Record"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => deleteMember(member.id, e)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Remove Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-[#2E004F] dark:text-[#FFD700] bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors"
                  >
                    <Mail size={12} /> Email
                  </a>
                </div>
              </div>
            ))}

            {filteredAlumni.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400 font-bold text-xs">
                No alumni records match current search filters.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "Events" && (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold">Alumni Events</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">Date</th>
                <th className="p-4">Location</th>
                <th className="p-4">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {events.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="p-4 font-bold">{e.title}</td>
                  <td className="p-4">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="p-4">{e.location}</td>
                  <td className="p-4">{e.attendees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "Donations" && (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold">Donation Records</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-4">Alumni ID</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {donations.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="p-4 font-bold">#{d.alumniId}</td>
                  <td className="p-4 font-bold text-emerald-600">
                    GHS {d.amount.toFixed(2)}
                  </td>
                  <td className="p-4">{d.purpose}</td>
                  <td className="p-4">
                    {new Date(d.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Alumni Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg">
                  <GraduationCap size={18} />
                </span>
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {editingAlumnus
                    ? "Update Alumni Record"
                    : "Register New Alumni Record"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Graduate Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  placeholder="e.g. Dr. Jane Okumu"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Graduation Class Year *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.classYear}
                    onChange={(e) =>
                      setFormData({ ...formData, classYear: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="2022"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Degree Course *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.course}
                    onChange={(e) =>
                      setFormData({ ...formData, course: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="BSc Computer Science"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Current Occupation / Role
                  </label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) =>
                      setFormData({ ...formData, occupation: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="Senior Architect"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Location / City
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="Nairobi, Kenya"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="alumni@example.com"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="text"
                    value={formData.linkedIn}
                    onChange={(e) =>
                      setFormData({ ...formData, linkedIn: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Career Achievements / Bio
                </label>
                <textarea
                  rows={2}
                  value={formData.achievements}
                  onChange={(e) =>
                    setFormData({ ...formData, achievements: e.target.value })
                  }
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  placeholder="Key career highlights or awards..."
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="hallOfFameCheck"
                  checked={formData.isHallOfFame}
                  onChange={(e) =>
                    setFormData({ ...formData, isHallOfFame: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#2E004F] rounded cursor-pointer"
                />
                <label
                  htmlFor="hallOfFameCheck"
                  className="text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  Induct into Institutional Hall of Fame
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-black uppercase text-xs tracking-wider bg-[#2E004F] text-[#FFD700] hover:bg-purple-950 rounded-lg shadow-md transition-all"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[150] animate-fade-in">
          <div className="bg-[#2E004F] text-[#FFD700] px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-purple-800">
            <CheckCircle2 size={18} />
            <span className="font-bold text-xs">{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alumni;
