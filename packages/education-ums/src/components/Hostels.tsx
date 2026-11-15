import React, { useState, useMemo, useEffect } from "react";
import {
  
  Users,
  Bed,
  
  MapPin,
  Plus,
  
  Search,
  
  X,
  CheckCircle2,
  History,
  MoreVertical,
  Trash2,
  UserPlus,
  Building2,
  
  
  ShieldAlert,
  FileText,
} from '../shims/lucide-react';
import { Hostel } from "../types";
import { useDataStore } from "../stores/dataStore";
import { useApiDataStore } from "../stores/apiDataStore";
import { useTransportRoutesQuery, useTransportPassesQuery } from "../hooks/api/useAlumniCampus";
import { useDialogStore } from "../stores/dialogStore";

const Hostels: React.FC = () => {
  const students = useDataStore((s) => s.students);
  const {
    hostels: halls,
    roomAssignments: assignments,
    fetchHostels,
    fetchRoomAssignments,
    createHostel,
    createRoomAssignment,
    deleteRoomAssignment,
  } = useApiDataStore();
  const [isHostelModalOpen, setIsHostelModalOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<any | null>(null);
  const [hostelForm, setHostelForm] = useState({ name: '', type: 'Male', capacity: 100, location: '' });

  const [activeTab, setActiveTab] = useState<"halls" | "registry" | "transport">("halls");
  
  const { data: apiRoutes } = useTransportRoutesQuery();
  const routes = apiRoutes ?? [];

  const { data: apiPasses } = useTransportPassesQuery();
  const passes = apiPasses ?? [];
  const [searchTerm, setSearchTerm] = useState("");
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [selectedHall, setSelectedHall] = useState<Hostel | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    studentId: "",
    hostelId: "",
    roomNumber: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchHostels();
    fetchRoomAssignments();
  }, []);

  const filteredHalls = useMemo(() => {
    return halls.filter((h) =>
      h.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [halls, searchTerm]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(
      (a) =>
        (a.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.studentId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.roomNumber || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [assignments, searchTerm]);

  const getOccupancy = (hallId: string) => {
    return assignments.filter(
      (a) => a.hostelId === hallId && a.status === "Active",
    ).length;
  };

  // Filter halls based on selected student gender
  const allocationAvailableHalls = useMemo(() => {
    if (!newAssignment.studentId) return halls;
    const student = students.find((s) => s.id === newAssignment.studentId || s.reg_no === newAssignment.studentId);
    if (!student) return halls;
    return halls.filter((h) => h.type === student.gender);
  }, [newAssignment.studentId, students, halls]);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === newAssignment.studentId || s.reg_no === newAssignment.studentId);
    if (!student) return;

    const success = await createRoomAssignment({
      studentId: student.reg_no || student.id,
      hostelId: newAssignment.hostelId || selectedHall?.id || "",
      roomNumber: newAssignment.roomNumber,
      checkInDate: newAssignment.date,
      status: "Active",
    });

    if (success) {
      setIsAllocationModalOpen(false);
      setNewAssignment({
        studentId: "",
        hostelId: "",
        roomNumber: "",
        date: new Date().toISOString().split("T")[0],
      });
      setSelectedHall(null);
    } else {
      await useDialogStore.getState().alert({
        title: "Housing Allocation Failed",
        message: "The system was unable to complete this room allocation. Please verify room availability and try again.",
        variant: "warning",
        confirmText: "Understood",
        badgeText: "Housing Office",
      });
    }
  };

  const deleteAssignment = async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Revoke Housing Allocation",
      message: "Are you sure you want to revoke this student's housing allocation?",
      detail: "The student will immediately lose their assigned room and will need to re-apply through the Housing Office. Ensure the student has been notified before proceeding.",
      confirmText: "Revoke Allocation",
      cancelText: "Keep Allocation",
      variant: "danger",
      badgeText: "Housing Protocol",
    });
    if (confirmed) {
      const success = await deleteRoomAssignment(id);
      if (!success) {
        await useDialogStore.getState().alert({
          title: "Revocation Failed",
          message: "The housing allocation could not be revoked at this time. Please contact the Housing Office directly.",
          variant: "warning",
          confirmText: "Close",
          badgeText: "Housing Office",
        });
      }
    }
  };

  const stats = {
    totalCapacity: halls.reduce((acc, curr) => acc + curr.capacity, 0),
    totalOccupied: assignments.filter((a) => a.status === "Active").length,
    maleOccupied: assignments.filter((a) => {
      const h = halls.find((hall) => hall.id === a.hostelId);
      return h?.type === "Male" && a.status === "Active";
    }).length,
    femaleOccupied: assignments.filter((a) => {
      const h = halls.find((hall) => hall.id === a.hostelId);
      return h?.type === "Female" && a.status === "Active";
    }).length,
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Residential Services
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Institutional Housing & Allocation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            onClick={() => { setEditingHostel(null); setHostelForm({ name: '', type: 'Male', capacity: 100, location: '' }); setIsHostelModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg font-bold text-[10px] uppercase"
          >
            <Plus size={12} /> New Hostel
          </button>
          <button
            onClick={() => {
              setIsAllocationModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 cursor-pointer"
          >
            <UserPlus size={12} className="text-[#FFD700]" /> New Allocation
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <Building2 size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            View Mode
          </span>
        </div>
        <button
          onClick={() => setActiveTab("halls")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "halls"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <Building2
            size={12}
            className={
              activeTab === "halls" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Halls of Residence
        </button>
        <button
          onClick={() => setActiveTab("transport")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "transport"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <Users
            size={12}
            className={
              activeTab === "transport" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Transport Routes
        </button>
        <button
          onClick={() => setActiveTab("registry")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "registry"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <FileText
            size={12}
            className={
              activeTab === "registry" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Resident Registry
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-purple-500">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
              Total Bed Capacity
            </h4>
            <p className="text-3xl font-bold text-[#4B0082] dark:text-white">
              {stats.totalCapacity.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-emerald-500">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
              Global Occupancy
            </h4>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-emerald-600">
                {Math.round((stats.totalOccupied / stats.totalCapacity) * 100)}%
              </p>
              <span className="text-xs font-semibold text-gray-400">
                ({stats.totalOccupied} Residents)
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-blue-500">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
              Male Residents
            </h4>
            <p className="text-3xl font-bold text-blue-600">
              {stats.maleOccupied}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-pink-500">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
              Female Residents
            </h4>
            <p className="text-3xl font-bold text-pink-600">
              {stats.femaleOccupied}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder={
                activeTab === "halls"
                  ? "Search for Housing Blocks..."
                  : "Search Residents by Name, ID or Room..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-sm dark:text-white focus:ring-1 focus:ring-[#4B0082]"
            />
          </div>
          {activeTab === "registry" && (
            <div className="flex gap-2">
              <button className="px-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black flex items-center gap-2">
                <History size={14} className="text-[#FFD700]" /> Allocation Logs
              </button>
            </div>
          )}
        </div>

        {activeTab === "transport" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden rounded-none">
              <div className="p-6 bg-gray-900 text-white border-b border-gray-800">
                <h3 className="font-black text-xs uppercase tracking-[0.25em]">Transport Routes</h3>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                  <tr><th className="px-6 py-5">Route</th><th className="px-6 py-5">Capacity</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {routes.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-5 font-bold text-sm">{r.name}</td>
                      <td className="px-6 py-5 text-gray-500">{r.capacity} seats</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden rounded-none">
              <div className="p-6 bg-gray-900 text-white border-b border-gray-800">
                <h3 className="font-black text-xs uppercase tracking-[0.25em]">Issued Passes</h3>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                  <tr><th className="px-6 py-5">Route</th><th className="px-6 py-5">Valid Until</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {passes.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-5 font-bold text-sm">{p.routeName}</td>
                      <td className="px-6 py-5 text-gray-500">{p.validTo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === "halls" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredHalls.map((hall, i) => {
              const occupied = getOccupancy(hall.id);
              const percentage = Math.round((occupied / hall.capacity) * 100);
              return (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 p-8 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-[#4B0082] transition-all relative overflow-hidden flex flex-col"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div
                      className={`p-4 rounded-none border-2 ${hall.type === "Male" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-pink-50 text-pink-600 border-pink-200"} shadow-sm`}
                    >
                      <Building2 size={24} />
                    </div>
                    <span
                      className={`text-[10px] font-black px-3 py-1 rounded-none border-2 uppercase tracking-widest ${
                        hall.status === "Full"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : hall.status === "Near Capacity"
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-emerald-50 text-emerald-600 border-emerald-200"
                      }`}
                    >
                      {hall.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 uppercase tracking-tight leading-none group-hover:text-[#4B0082] transition-colors">
                    {hall.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-bold flex items-center gap-1.5 mb-6 uppercase tracking-widest opacity-60">
                    <MapPin size={12} /> {hall.location}
                  </p>

                  <div className="space-y-4 mt-auto">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                      <span className="text-gray-400">Registry Occupancy</span>
                      <span
                        className={
                          percentage > 90
                            ? "text-red-600"
                            : "text-[#4B0082] dark:text-[#FFD700]"
                        }
                      >
                        {percentage}%
                      </span>
                    </div>
                    <div className="h-4 bg-gray-50 dark:bg-gray-700 rounded-none overflow-hidden p-1 border border-gray-100 dark:border-gray-600">
                      <div
                        className={`h-full transition-all duration-700 ${hall.type === "Male" ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]"}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      <span>{occupied} Active Slots</span>
                      <span>{hall.capacity} Total Beds</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-8 pt-6 border-t border-gray-50 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setSelectedHall(hall);
                        setIsAllocationModalOpen(true);
                      }}
                      className="flex-1 py-3 bg-[#4B0082] text-white rounded-none text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Plus size={14} className="text-[#FFD700]" /> Allocate
                    </button>
                    <button className="p-3 bg-gray-50 dark:bg-gray-700 rounded-none text-gray-400 hover:text-[#4B0082] transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-[#FFD700]" />
                <h3 className="font-black text-xs uppercase tracking-[0.25em]">
                  Master Resident Registry
                </h3>
              </div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">
                Live Institutional Ledger
              </span>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-5">Registry ID</th>
                    <th className="px-6 py-5">Student Identity</th>
                    <th className="px-6 py-5">Housing Block</th>
                    <th className="px-6 py-5 text-center">Room No.</th>
                    <th className="px-6 py-5 text-center">Allocation Date</th>
                    <th className="px-6 py-5 text-center">Status</th>
                    <th className="px-6 py-5 text-right">Commit Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredAssignments.map((asn) => {
                    const hall = halls.find((h) => h.id === asn.hostelId);
                    return (
                      <tr
                        key={asn.id}
                        className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group"
                      >
                        <td className="px-6 py-5 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">
                          {asn.id}
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                            {asn.studentName}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                            {asn.studentId}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-1 h-4 ${hall?.type === "Male" ? "bg-blue-400" : "bg-pink-400"}`}
                            ></div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                              {hall?.name || "Unknown Hall"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center text-xs font-black text-[#4B0082] dark:text-[#FFD700]">
                          {asn.roomNumber}
                        </td>
                        <td className="px-6 py-5 text-center text-[10px] font-bold text-gray-500 uppercase">
                          {asn.checkInDate}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">
                            {asn.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                              title="Print Resident Pass"
                            >
                              <History size={16} />
                            </button>
                            <button
                              onClick={() => deleteAssignment(asn.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="Revoke Allocation"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAssignments.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-24 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm italic"
                      >
                        No records identified in registry node
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isAllocationModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#1a0033]/95 backdrop-blur-3xl p-4">
            {/* Modal Content Unchanged... */}
            <div className="bg-white dark:bg-gray-900 w-full max-w-xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border-t-[8px] border-[#4B0082] overflow-hidden flex flex-col animate-slide-up">
              <div className="bg-gray-900 p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">
                    New Housing Allocation
                  </h3>
                  <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">
                    BMI Institutional Residential Node
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAllocationModalOpen(false);
                    setSelectedHall(null);
                  }}
                  className="p-2 hover:bg-red-500 transition-all text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <form
                onSubmit={handleAllocate}
                className="p-10 space-y-8 bg-[#FAFAFA] dark:bg-gray-950"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    Select Student Entity
                  </label>
                  <select
                    required
                    value={newAssignment.studentId}
                    onChange={(e) => {
                      setNewAssignment({
                        ...newAssignment,
                        studentId: e.target.value,
                        hostelId: "",
                      });
                    }}
                    className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm focus:ring-1 focus:ring-[#4B0082] appearance-none cursor-pointer"
                  >
                    <option value="">--- Select Resident ---</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} | {s.first_name} {s.last_name} ({s.gender})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Housing Block (Filtered)
                    </label>
                    <select
                      required
                      value={
                        selectedHall ? selectedHall.id : newAssignment.hostelId
                      }
                      disabled={!!selectedHall}
                      onChange={(e) =>
                        setNewAssignment({
                          ...newAssignment,
                          hostelId: e.target.value,
                        })
                      }
                      className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-xs uppercase tracking-tight"
                    >
                      <option value="">--- Select Hall ---</option>
                      {allocationAvailableHalls.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Room Assignment
                    </label>
                    <div className="relative">
                      <Bed
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        required
                        type="text"
                        placeholder="e.g. A-204"
                        value={newAssignment.roomNumber}
                        onChange={(e) =>
                          setNewAssignment({
                            ...newAssignment,
                            roomNumber: e.target.value,
                          })
                        }
                        className="w-full pl-12 pr-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-black text-sm uppercase tracking-widest focus:border-[#4B0082]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    Effective Check-In Date
                  </label>
                  <input
                    required
                    type="date"
                    value={newAssignment.date}
                    onChange={(e) =>
                      setNewAssignment({
                        ...newAssignment,
                        date: e.target.value,
                      })
                    }
                    className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-xs uppercase"
                  />
                </div>

                <div className="flex flex-col gap-5 pt-4">
                  <button
                    type="submit"
                    className="w-full py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-xs border border-[#FFD700]/30 hover:bg-black transition-all flex items-center justify-center gap-4"
                  >
                    <CheckCircle2 size={18} className="text-[#FFD700]" />{" "}
                    Authorize Allocation
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAllocationModalOpen(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Abort Protocol
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {isHostelModalOpen && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!hostelForm.name) return;
              const res = await createHostel(hostelForm as any);
              if (res) { setIsHostelModalOpen(false); await fetchHostels(); }
            }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-2 text-sm">
              <h3 className="font-black uppercase">{editingHostel ? 'Edit Hostel' : 'New Hostel'}</h3>
              <input required placeholder="Hostel name" value={hostelForm.name} onChange={e => setHostelForm({ ...hostelForm, name: e.target.value })} className="w-full border rounded p-2" />
              <select value={hostelForm.type} onChange={e => setHostelForm({ ...hostelForm, type: e.target.value })} className="w-full border rounded p-2"><option>Male</option><option>Female</option></select>
              <input type="number" value={hostelForm.capacity} onChange={e => setHostelForm({ ...hostelForm, capacity: Number(e.target.value) })} className="w-full border rounded p-2" />
              <input placeholder="Location" value={hostelForm.location} onChange={e => setHostelForm({ ...hostelForm, location: e.target.value })} className="w-full border rounded p-2" />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsHostelModalOpen(false)}>Cancel</button><button className="px-4 py-1.5 bg-[#4B0082] text-white rounded">Save to Database</button></div>
            </div>
          </form>
        )}

        <div className="bg-gray-900 border-l-4 border-[#FFD700] p-6 text-white flex items-start gap-5 shadow-2xl">
          <div className="p-2 bg-[#FFD700] text-black shadow-lg">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700]">
              Security Protocol Enforcement
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Housing assignments are strictly monitored. All residents must
              adhere to the institutional code of conduct within BMI residential
              blocks. Unauthorized guest entry is prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hostels;









