import React, { useState, useMemo, useEffect } from "react";
import {
  Briefcase,
  Mail,
  Plus,
  Search,
  
  GraduationCap,
  Edit,
  Trash2,
  X,
  CheckCircle,
  Users,
  LayoutGrid,
  List,
  ChevronRight,
  Download,
  Award,
  Upload,
  User,
  Clock,
  MapPin,
  CircleUser,
} from '../shims/lucide-react';
import { StaffMember } from "../types";
import { requestPasswordReset } from "../services/authService";
import { createStaff as createStaffApi, updateStaff as updateStaffApi, deleteStaff as deleteStaffApi } from "../services/staffService";
import { useQueryClient } from '../shims/tanstack-react-query';
import { getAllStudyCenters, StudyCenter } from "../services/studyCenterService";
import { StudyCenterSelector } from "./StudyCenterSelector";
import { useDataStore } from "../stores/dataStore";
import { usePagination } from "../hooks/usePagination";
import { useStaffQuery } from "../hooks/useEntityQueries";
import { useLeaveRequestsQuery, useUpdateLeaveRequest } from "../hooks/api";
import { useDialogStore } from "../stores/dialogStore";

const departments = [
  "All Departments",
  "School of Theology",
  "Dept. of ICT",
  "School of Business",
  "Education Dept.",
  "Administration",
  "Student Affairs",
];

const Staff: React.FC = () => {
  const queryClient = useQueryClient();
  const staff = useDataStore((s) => s.staff);
  const _setStaff = useDataStore((s) => s.setStaff);
  const setStaff = (action: React.SetStateAction<StaffMember[]>) => {
    if (typeof action === "function") {
      _setStaff(
        (action as (prev: StaffMember[]) => StaffMember[])(
          useDataStore.getState().staff,
        ),
      );
    } else {
      _setStaff(action);
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [campusFilter, setCampusFilter] = useState("All Study Centers");
  const [, setCampuses] = useState<StudyCenter[]>([]);
  const [activeTab, setActiveTab] = useState<
    "All" | "Academic" | "Administrative" | "Management" | "Leave Requests"
  >("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [newStaff, setNewStaff] = useState<any>({
    staff_number: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "Full-time",
    category: "Academic",
    role: "",
    name: "",
    department: "",
    office: "",
    officeHours: "",
    specialization: "",
  });
  const { page, perPage, meta, setPage, setMeta } = usePagination(20);
//   const _queryClient = useQueryClient();

  const {
    data: staffResponse,
    
    isFetching,
  } = useStaffQuery({
    page,
    perPage,
    search: searchTerm,
    study_center_id: campusFilter !== "All Study Centers" ? campusFilter : undefined,
    department: deptFilter !== "All Departments" ? deptFilter : undefined,
    category: activeTab !== "All" ? activeTab : undefined,
  });

  const pagedStaff = useMemo(
    () => (staffResponse?.success ? staffResponse.data?.items ?? [] : []),
    [staffResponse],
  );

  useEffect(() => {
    if (staffResponse?.success && staffResponse.data) {
      const { page: p, perPage: pp, total } = staffResponse.data;
      setMeta({ page: p, perPage: pp, total });
    }
  }, [staffResponse, setMeta]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, deptFilter, campusFilter, activeTab, setPage]);

  useEffect(() => {
    let cancelled = false;
    async function loadStudyCenters() {
      try {
        const data = await getAllStudyCenters();
        if (!cancelled) setCampuses(data);
      } catch (_error) {
        // Fallback default study centers handled by service
      }
    }
    loadStudyCenters();
    return () => {
      cancelled = true;
    };
  }, []);


  // ── Leave Requests — real API with local fallback ───────────────────────────
  const { data: apiLeaveRequests } = useLeaveRequestsQuery();
  const updateLeaveRequest = useUpdateLeaveRequest();

  const leaveRequests = apiLeaveRequests ?? [];

  const handleLeaveAction = (id: number, status: 'approved' | 'rejected') => {
    updateLeaveRequest.mutate({ id, status });
  };

  const filteredStaff = useMemo(() => {
    if ((pagedStaff && pagedStaff.length > 0) || isFetching)
      return pagedStaff || [];
    return staff.filter((member) => {
      const name =
        `${member.first_name || ""} ${member.last_name || ""}`.trim();
      const matchesSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.staff_number || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (member.role || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === "All" || member.category === activeTab;
      const matchesCampus =
        campusFilter === "All Study Centers" || member.study_center_id === campusFilter;
      return matchesSearch && matchesTab && matchesCampus;
    });
  }, [staff, searchTerm, activeTab, campusFilter]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size < 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else if (file) {
      await useDialogStore.getState().alert({
        title: "File Size Limit Exceeded",
        message: "The selected image exceeds the 2MB maximum file size permitted by the institutional media policy.",
        detail: "Please compress or resize the image before uploading. Accepted formats: JPEG, PNG, WebP.",
        variant: "warning",
        confirmText: "Understood",
        badgeText: "Media Policy",
      });
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email) {
      if (!newStaff.first_name || !newStaff.last_name) return;
    }
    const [first_name, ...rest] = String(newStaff.name || `${newStaff.first_name} ${newStaff.last_name}`).split(' ');
    const payload: any = {
      staff_number: newStaff.staff_number || undefined,
      first_name: newStaff.first_name || first_name || '',
      last_name: newStaff.last_name || rest.join(' ') || '',
      email: newStaff.email,
      phone: newStaff.phone || null,
      department: newStaff.department || null,
      role: newStaff.role || null,
      category: newStaff.category,
      status: newStaff.status,
    };
    try {
      if (editingId) {
        const res = await updateStaffApi(editingId, payload);
        if (!res.success) throw new Error(res.error || 'Update failed');
        const next = res.data as StaffMember;
        setStaff(prev => prev.map(s => s.id === editingId ? { ...s, ...next } : s));
      } else {
        const res = await createStaffApi(payload);
        if (!res.success) throw new Error(res.error || 'Create failed');
        const member = { ...(res.data as StaffMember), photo: imagePreview || undefined } as StaffMember;
        setStaff([member, ...staff]);
        try { await requestPasswordReset(newStaff.email); } catch (err) { console.error("Failed to send welcome email:", err); }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (err) {
      console.error('Staff save failed:', err);
      if (!editingId) {
        const member = { ...newStaff, id: `STF-${Math.floor(Math.random() * 900) + 100}`, joinDate: new Date().toISOString().split('T')[0], photo: imagePreview || undefined, office: newStaff.office || 'N/A', officeHours: newStaff.officeHours || 'N/A' } as StaffMember;
        setStaff([member, ...staff]);
      }
    }
    setIsModalOpen(false);
    setEditingId(null);
    setImagePreview(null);
    setNewStaff({
      staff_number: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      status: "Full-time",
      category: "Academic",
      role: "",
      name: "",
      department: "",
      office: "",
      officeHours: "",
      specialization: "",
    });
  };

  const deleteStaff = async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Remove Staff Personnel Record",
      message: "Are you sure you want to permanently remove this staff member from the institutional personnel registry?",
      detail: "This action will expunge the staff member's employment record, assigned roles, and access credentials from the BMI University HR system. This operation should only be performed with HR Director authorisation.",
      confirmText: "Remove Staff Record",
      cancelText: "Retain Record",
      variant: "danger",
      badgeText: "HR Protocol",
    });
    if (confirmed) {
      try {
        await deleteStaffApi(id);
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } catch { /* fall through to local */ }
      setStaff(staff.filter((s) => s.id !== id));
    }
  };

  const handleExportCSV = () => {
    const listToExport = filteredStaff.length > 0 ? filteredStaff : staff;
    const headers = ["Staff Number", "Name", "Role", "Department", "Category", "Status", "Email", "Phone", "Office"];
    const rows = listToExport.map((s) => [
      `"${s.staff_number || s.id}"`,
      `"${s.first_name ? `${s.first_name} ${s.last_name}` : s.name}"`,
      `"${s.role || ""}"`,
      `"${s.department || ""}"`,
      `"${s.category || ""}"`,
      `"${s.status || ""}"`,
      `"${s.email || ""}"`,
      `"${s.phone || ""}"`,
      `"${s.office || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `staff_faculty_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#4B0082] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              University Directory
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Institutional Human Capital Registry
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
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white hover:bg-purple-950 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 shadow-md rounded-lg cursor-pointer"
          >
            <Plus size={12} className="text-[#FFD700]" /> Register Staff
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <CircleUser size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Categories
          </span>
        </div>
        {["All", "Academic", "Administrative", "Management", "Leave Requests"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as "All" | "Academic" | "Administrative" | "Management" | "Leave Requests")}
            className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab
                ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Personnel",
              val: staff.length,
              icon: Users,
              col: "text-purple-600",
              bg: "bg-purple-50",
            },
            {
              label: "Faculty Members",
              val: staff.filter((s) => s.category === "Academic").length,
              icon: GraduationCap,
              col: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Administrative",
              val: staff.filter((s) => s.category === "Administrative").length,
              icon: Briefcase,
              col: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "Research Awards",
              val: 12,
              icon: Award,
              col: "text-amber-600",
              bg: "bg-amber-50",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 p-4 rounded-none border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-transform hover:shadow-md"
            >
              <div
                className={`p-2.5 rounded-none ${item.bg} dark:bg-gray-700 ${item.col}`}
              >
                <item.icon size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {item.label}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {item.val}
                </p>
              </div>
            </div>
          ))}
        </div>

      {activeTab === "Leave Requests" ? (
        <div className="bg-white dark:bg-gray-800 rounded-none border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm mt-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-black uppercase tracking-tight text-[#2E004F] dark:text-white">Leave Requests</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-4 uppercase tracking-widest text-xs font-bold text-gray-500">Staff ID</th>
                <th className="p-4 uppercase tracking-widest text-xs font-bold text-gray-500">Start</th>
                <th className="p-4 uppercase tracking-widest text-xs font-bold text-gray-500">End</th>
                <th className="p-4 uppercase tracking-widest text-xs font-bold text-gray-500">Reason</th>
                <th className="p-4 uppercase tracking-widest text-xs font-bold text-gray-500">Status</th>
                <th className="p-4 uppercase tracking-widest text-xs font-bold text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leaveRequests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-bold text-[#4B0082] dark:text-[#FFD700]">#{r.staffId}</td>
                  <td className="p-4">{r.startDate}</td>
                  <td className="p-4">{r.endDate}</td>
                  <td className="p-4">{r.reason}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border ${
                      r.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                      r.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleLeaveAction(r.id, 'approved')}
                          disabled={updateLeaveRequest.isPending}
                          className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold uppercase tracking-widest hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleLeaveAction(r.id, 'rejected')}
                          disabled={updateLeaveRequest.isPending}
                          className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-widest hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
        <div className="bg-white dark:bg-gray-800 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col p-2">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-2">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-none ml-auto">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-none transition-all ${viewMode === "grid" ? "bg-white dark:bg-gray-600 text-[#4B0082] dark:text-[#FFD700] shadow-sm" : "text-gray-400"}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-none transition-all ${viewMode === "table" ? "bg-white dark:bg-gray-600 text-[#4B0082] dark:text-[#FFD700] shadow-sm" : "text-gray-400"}`}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col md:flex-row gap-4 border-t border-gray-100 dark:border-gray-700">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none text-sm dark:text-white font-semibold focus:ring-1 focus:ring-[#4B0082]"
              />
            </div>
            <StudyCenterSelector
              value={campusFilter}
              onChange={setCampusFilter}
              includeAll
            />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-bold uppercase tracking-widest outline-none dark:text-white cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((member) => (
              <div
                key={member.id}
                className="bg-white dark:bg-gray-800 rounded-none border border-gray-100 dark:border-gray-700 overflow-hidden group hover:border-[#4B0082] transition-all hover:shadow-lg"
              >
                <div className={`h-1.5 w-full ${member.avatarColor}`}></div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={`w-16 h-16 rounded-none ${member.avatarColor} flex items-center justify-center text-white font-bold text-2xl shadow-md border-2 border-white dark:border-gray-700 -mt-10 overflow-hidden bg-white`}
                    >
                      {member.photo ? (
                        <img
                          src={member.photo}
                          alt={`${member.first_name} ${member.last_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (member.first_name || "?").charAt(0)
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-none text-[10px] font-bold uppercase tracking-widest ${
                        member.status === "Full-time"
                          ? "bg-green-100 text-green-700"
                          : member.status === "On Leave"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2 uppercase tracking-tight">
                      {member.first_name} {member.last_name}
                      {member.category === "Academic" && (
                        <CheckCircle size={14} className="text-[#4B0082]" />
                      )}
                    </h3>
                    <p className="text-xs text-[#4B0082] dark:text-purple-300 font-bold uppercase tracking-widest mt-0.5">
                      {member.role}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      {member.department} • {member.id}
                    </p>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <Mail size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate font-semibold">
                        {member.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">
                        {member.office}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-500 font-bold uppercase">
                        Hrs: {member.officeHours}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-between items-center">
                    <button
                      onClick={() => deleteStaff(member.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-none text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-[#4B0082] hover:text-white transition-all uppercase tracking-widest">
                      Profile <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-none border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 shadow-sm">
                  <th className="px-6 py-4 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                    Full Name
                  </th>
                  <th className="px-6 py-4 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                    Department
                  </th>
                  <th className="px-6 py-4 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                    Specialization
                  </th>
                  <th className="px-6 py-4 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                    Contact
                  </th>
                  <th className="px-6 py-4 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                    Office
                  </th>
                  <th className="px-6 py-4 text-right sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filteredStaff.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-none ${member.avatarColor} flex items-center justify-center text-white text-xs font-bold overflow-hidden bg-white`}
                        >
                          {member.photo ? (
                            <img
                              src={member.photo}
                              alt={`${member.first_name} ${member.last_name}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (member.first_name || "?").charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            {member.staff_number}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-xs uppercase text-gray-600 dark:text-gray-300">
                      {member.department}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-purple-50 dark:bg-purple-900/20 text-[#4B0082] dark:text-purple-300 px-2 py-0.5 rounded-none text-xs font-bold uppercase">
                        {member.specialization}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-500">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-500">
                      {member.office}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setEditingId(member.id);
                          setNewStaff({ staff_number: member.staff_number || '', first_name: member.first_name || '', last_name: member.last_name || '', name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.name, email: member.email || '', phone: member.phone || '', status: member.status || 'Full-time', category: member.category || 'Academic', role: member.role || '', department: (member as any).department || '', office: (member as any).office || '', officeHours: (member as any).officeHours || '', specialization: (member as any).specialization || '' });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-300 hover:text-[#4B0082] transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteStaff(member.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors ml-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Bar ────────────────────────────────────── */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-6 py-3 shadow-sm mt-6">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Page {meta.page} of {meta.totalPages}
              &nbsp;·&nbsp;{meta.total.toLocaleString()} staff
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

          </>
      )}

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#1a0033]/90 backdrop-blur-3xl z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-none shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border border-[#FFD700]/20">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-900 text-white">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    Staff Registration
                  </h2>
                  <p className="text-xs font-semibold text-[#FFD700] uppercase tracking-widest">
                    Institutional Human Capital Data Node
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/10 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form
                onSubmit={handleAddStaff}
                className="p-8 overflow-y-auto space-y-6"
              >
                {/* Form Fields ... */}
                <div className="flex flex-col md:flex-row gap-8 items-start mb-6">
                  <div className="flex-shrink-0">
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-none flex flex-col items-center justify-center relative overflow-hidden group bg-gray-50 dark:bg-gray-700">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <User size={32} className="text-gray-300" />
                          <span className="text-xs font-bold text-gray-400 mt-2 uppercase">
                            Photo
                          </span>
                        </>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload size={20} className="text-white" />
                      </div>
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={handleImageUpload}
                        accept="image/*"
                      />
                    </div>
                  </div>
                  <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Legal Name
                      </label>
                      <input
                        required
                        type="text"
                        value={newStaff.name}
                        onChange={(e) =>
                          setNewStaff({ ...newStaff, name: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white font-semibold"
                        placeholder="Full Official Names"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Category
                      </label>
                      <select
                        value={newStaff.category}
                        onChange={(e) =>
                          setNewStaff({
                            ...newStaff,
                            category: e.target.value as "Academic" | "Administrative" | "Management",
                          })
                        }
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white font-bold text-xs uppercase"
                      >
                        <option value="Academic">Academic Faculty</option>
                        <option value="Administrative">
                          Administrative Staff
                        </option>
                        <option value="Management">
                          Institutional Management
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Department
                    </label>
                    <select
                      value={newStaff.department}
                      onChange={(e) =>
                        setNewStaff({ ...newStaff, department: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white font-bold text-xs uppercase"
                    >
                      {departments.slice(1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Official Role
                    </label>
                    <input
                      required
                      type="text"
                      value={newStaff.role}
                      onChange={(e) =>
                        setNewStaff({ ...newStaff, role: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white font-semibold"
                      placeholder="e.g. Senior Lecturer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      value={newStaff.email}
                      onChange={(e) =>
                        setNewStaff({ ...newStaff, email: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white"
                      placeholder="name@bmi.edu"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={newStaff.phone}
                      onChange={(e) =>
                        setNewStaff({ ...newStaff, phone: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white"
                      placeholder="+254..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Office Location
                    </label>
                    <input
                      type="text"
                      value={newStaff.office}
                      onChange={(e) =>
                        setNewStaff({ ...newStaff, office: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Office Hours
                    </label>
                    <input
                      type="text"
                      value={newStaff.officeHours}
                      onChange={(e) =>
                        setNewStaff({
                          ...newStaff,
                          officeHours: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Specialization
                    </label>
                    <input
                      type="text"
                      value={newStaff.specialization}
                      onChange={(e) =>
                        setNewStaff({
                          ...newStaff,
                          specialization: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-none outline-none focus:ring-1 focus:ring-[#4B0082] dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2 bg-[#4B0082] text-white rounded-none font-bold uppercase tracking-widest shadow-lg hover:bg-black transition-all"
                  >
                    Confirm Registration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Staff;









