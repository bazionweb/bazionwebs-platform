import React, { useState, useMemo, useEffect } from "react";
import {
  Stethoscope,
  Heart,
  Activity,
  Plus,
  Search,
  AlertCircle,
  Clock,
  X,
  User,
  CheckCircle2,
  ShieldAlert,
  Thermometer,
  Wind,
  Droplets,
  Printer,
  Trash2,
  History,
} from '../shims/lucide-react';
import { MedicalVisit } from "../types";
import { useDataStore } from "../stores/dataStore";
import { useApiDataStore } from "../stores/apiDataStore";
import { useDialogStore } from "../stores/dialogStore";

export const Medical: React.FC = () => {
  const students = useDataStore((s) => s.students);
  const staff = useDataStore((s) => s.staff);
  const {
    medicalVisits: records,
    fetchMedicalVisits,
    createMedicalVisit,
    deleteMedicalVisit,
  } = useApiDataStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<MedicalVisit | null>(null);
  const [newVisit, setNewVisit] = useState<Partial<MedicalVisit>>({
    studentId: "",
    condition: "",
    bloodType: "O+",
    status: "Normal",
    attendingStaff: "",
    vitals: { temp: "", bp: "", pulse: "" },
    notes: "",
  });

  useEffect(() => {
    fetchMedicalVisits();
  }, []);

  const medicalStaff = useMemo(() => {
    const keywords = ["Nurse", "Doctor", "Medical", "Health", "Clinical", "Physician", "Surgeon", "Pediatrician", "Cardiologist"];
    return (staff || []).filter((s) => {
      const roleMatch = keywords.some((k) =>
        (s.role || "").toLowerCase().includes(k.toLowerCase())
      );
      const deptMatch = (s.department || "")
        .toLowerCase()
        .includes("medical");
      return roleMatch || deptMatch;
    });
  }, [staff]);

  const activeStaff = useMemo(() => medicalStaff.length || 0, [medicalStaff]);

  const filteredRecords = useMemo(() => {
    return (records || [])
      .filter((rec) => {
        const matchesSearch =
          (rec.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (rec.studentId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (rec.condition || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === "All" || rec.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, searchTerm, statusFilter]);

  const stats = {
    total: records.length,
    urgent: records.filter((r) => r.status === "Urgent").length,
    activeStaff,
  };

  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === newVisit.studentId || s.reg_no === newVisit.studentId);
    if (!student) return;

    const success = await createMedicalVisit({
      studentId: student.reg_no || student.id,
      studentName: `${student.first_name} ${student.last_name}`,
      condition: newVisit.condition || "General Observation",
      bloodType: newVisit.bloodType || "O+",
      date: new Date().toISOString().split("T")[0],
      attendingStaff: newVisit.attendingStaff || "",
      status: newVisit.status as "Normal" | "Urgent" | "Follow-up",
      vitals: {
        temp: newVisit.vitals?.temp || "36.5",
        bp: newVisit.vitals?.bp || "120/80",
        pulse: newVisit.vitals?.pulse || "70",
      },
      notes: newVisit.notes || "",
    });

    if (success) {
      setIsModalOpen(false);
      setNewVisit({
        studentId: "",
        condition: "",
        bloodType: "O+",
        status: "Normal",
        attendingStaff: "",
        vitals: { temp: "", bp: "", pulse: "" },
        notes: "",
      });
    } else {
      await useDialogStore.getState().alert({
        title: "Medical Visit Record Failed",
        message: "The system was unable to save this medical visit record. Please ensure all required fields are completed and try again.",
        detail: "If the issue persists, contact the BMI University Health Services IT administrator.",
        variant: "warning",
        confirmText: "Understood",
        badgeText: "Health Services",
      });
    }
  };

  const deleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await useDialogStore.getState().confirm({
      title: "Decommission Medical Record",
      message: "Are you sure you want to permanently decommission this medical visit record?",
      detail: "Medical records are protected under institutional health data policies. This action is irreversible and must comply with BMI University Health Services data governance guidelines. Ensure proper authorisation before proceeding.",
      confirmText: "Decommission Record",
      cancelText: "Retain Record",
      variant: "danger",
      badgeText: "Health Services Protocol",
    });
    if (confirmed) {
      const success = await deleteMedicalVisit(id);
      if (!success) {
        await useDialogStore.getState().alert({
          title: "Record Deletion Failed",
          message: "The medical record could not be removed. Please contact the Health Services IT administrator.",
          variant: "warning",
          confirmText: "Close",
          badgeText: "Health Services",
        });
      }
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Health Center Portal
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Institutional Medical Registry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 cursor-pointer"
          >
            <Plus size={12} className="text-[#FFD700]" /> New Medical Visit
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <Activity size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Triage Status
          </span>
        </div>
        {["All", "Normal", "Urgent", "Follow-up"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
              statusFilter === status
                ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-red-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-none">
                <Heart size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Total Consultations
                </p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">
                  {stats.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-none">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Urgent Cases (Current)
                </p>
                <p className="text-3xl font-black text-amber-600">
                  {stats.urgent}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-[#4B0082]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-[#4B0082] dark:text-purple-300 rounded-none">
                <Stethoscope size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Medical Staff On-Duty
                </p>
                <p className="text-3xl font-black text-[#4B0082] dark:text-purple-300">
                  {stats.activeStaff}
                </p>
              </div>
            </div>
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
              placeholder="Query by Student Name, ID or Diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-sm dark:text-white focus:ring-1 focus:ring-[#4B0082]"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 justify-between items-center bg-gray-900 text-white">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-[#FFD700]" />
              <h3 className="font-black text-xs uppercase tracking-[0.25em]">
                Clinical Visit Ledger
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
                  <th className="px-6 py-5">Visit ID</th>
                  <th className="px-6 py-5">Patient Details</th>
                  <th className="px-6 py-5">Diagnosis/Condition</th>
                  <th className="px-6 py-5 text-center">Blood Type</th>
                  <th className="px-6 py-5 text-center">Protocol Date</th>
                  <th className="px-6 py-5 text-center">Priority</th>
                  <th className="px-6 py-5 text-right">Commit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => setSelectedVisit(rec)}
                    className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all cursor-pointer group"
                  >
                    <td className="px-6 py-5 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">
                      {rec.id}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                        {rec.studentName}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                        {rec.studentId}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1 h-4 ${rec.status === "Urgent" ? "bg-red-500" : "bg-[#4B0082]"}`}
                        ></div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                          {rec.condition}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center font-black text-red-600 text-sm">
                      {rec.bloodType}
                    </td>
                    <td className="px-6 py-5 text-center text-[10px] font-bold text-gray-500 uppercase">
                      {rec.date}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${rec.status === "Urgent"
                          ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                          : rec.status === "Follow-up"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-2 text-gray-400 hover:text-[#4B0082]"
                          title="Print Consultation Receipt"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={(e) => deleteRecord(rec.id, e)}
                          className="p-2 text-gray-400 hover:text-red-500"
                          title="Purge Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-24 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm italic"
                    >
                      Zero (0) Medical Records Identified in Search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Consultation Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#1a0033]/95 backdrop-blur-3xl p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl shadow-2xl border-t-[8px] border-[#4B0082] overflow-hidden flex flex-col animate-slide-up">
              <div className="bg-gray-900 p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">
                    New Clinical Consultation
                  </h3>
                  <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">
                    BMI Institutional Medical Node
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-red-500 transition-all text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <form
                onSubmit={handleAddVisit}
                className="p-10 space-y-8 bg-[#FAFAFA] dark:bg-gray-950 max-h-[70vh] overflow-y-auto no-scrollbar"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    Select Patient Registry
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <select
                      required
                      value={newVisit.studentId}
                      onChange={(e) =>
                        setNewVisit({ ...newVisit, studentId: e.target.value })
                      }
                      className="w-full pl-12 pr-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm focus:ring-1 focus:ring-[#4B0082] appearance-none cursor-pointer"
                    >
                      <option value="">--- Select Student ---</option>
                      {students
                        .sort((a, b) =>
                          a.first_name.localeCompare(b.first_name),
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} | {s.first_name} {s.last_name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    Primary Diagnosis / Condition
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Acute Migraine / Routine Checkup"
                    value={newVisit.condition}
                    onChange={(e) =>
                      setNewVisit({ ...newVisit, condition: e.target.value })
                    }
                    className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm uppercase tracking-tight focus:border-[#4B0082]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Blood Group Identity
                    </label>
                    <select
                      value={newVisit.bloodType}
                      onChange={(e) =>
                        setNewVisit({ ...newVisit, bloodType: e.target.value })
                      }
                      className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-black text-sm uppercase tracking-widest focus:border-[#4B0082]"
                    >
                      {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(
                        (type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Triage Priority
                    </label>
                    <select
                      value={newVisit.status}
                      onChange={(e) =>
                        setNewVisit({
                          ...newVisit,
                          status: e.target.value as "Normal" | "Urgent" | "Follow-up",
                        })
                      }
                      className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-black text-xs uppercase tracking-widest focus:border-[#4B0082]"
                    >
                      <option value="Normal">Normal Observation</option>
                      <option value="Urgent">Urgent Intervention</option>
                      <option value="Follow-up">Required Follow-up</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    Attending Medical Staff
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <select
                      required
                      value={newVisit.attendingStaff}
                      onChange={(e) =>
                        setNewVisit({ ...newVisit, attendingStaff: e.target.value })
                      }
                      className="w-full pl-12 pr-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm focus:ring-1 focus:ring-[#4B0082] appearance-none cursor-pointer"
                    >
                      <option value="">--- Select Attending Staff ---</option>
                      {medicalStaff
                        .sort((a, b) =>
                          (a.first_name || "").localeCompare(b.first_name || ""),
                        )
                        .map((s) => (
                          <option
                            key={s.id}
                            value={`${s.first_name || ""} ${s.last_name || ""}`.trim()}
                          >
                            {(s as any).staff_no ? `${(s as any).staff_no} | ` : ""}
                            {s.first_name || ""} {s.last_name || ""}
                            {s.role ? ` — ${s.role}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Vitals ... */}
                <div className="p-6 border-2 border-[#4B0082]/10 bg-white dark:bg-gray-800 space-y-6">
                  <h4 className="text-[10px] font-black uppercase text-[#4B0082] dark:text-purple-300 tracking-[0.25em] flex items-center gap-2">
                    <Activity size={14} /> Critical Vital Matrix
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1 text-center">
                      <label className="text-[8px] font-black uppercase text-gray-400">
                        Temp (°C)
                      </label>
                      <input
                        type="text"
                        placeholder="36.5"
                        value={newVisit.vitals?.temp}
                        onChange={(e) =>
                          setNewVisit({
                            ...newVisit,
                            vitals: {
                              ...newVisit.vitals!,
                              temp: e.target.value,
                            },
                          })
                        }
                        className="w-full text-center py-2 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-1 text-center">
                      <label className="text-[8px] font-black uppercase text-gray-400">
                        BP (mmHg)
                      </label>
                      <input
                        type="text"
                        placeholder="120/80"
                        value={newVisit.vitals?.bp}
                        onChange={(e) =>
                          setNewVisit({
                            ...newVisit,
                            vitals: { ...newVisit.vitals!, bp: e.target.value },
                          })
                        }
                        className="w-full text-center py-2 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-1 text-center">
                      <label className="text-[8px] font-black uppercase text-gray-400">
                        Pulse (BPM)
                      </label>
                      <input
                        type="text"
                        placeholder="72"
                        value={newVisit.vitals?.pulse}
                        onChange={(e) =>
                          setNewVisit({
                            ...newVisit,
                            vitals: {
                              ...newVisit.vitals!,
                              pulse: e.target.value,
                            },
                          })
                        }
                        className="w-full text-center py-2 bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 outline-none font-bold text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes ... */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    Clinical Notes & Observations
                  </label>
                  <textarea
                    rows={3}
                    value={newVisit.notes}
                    onChange={(e) =>
                      setNewVisit({ ...newVisit, notes: e.target.value })
                    }
                    placeholder="Institutional medical documentation..."
                    className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-medium text-sm focus:border-[#4B0082] resize-none"
                  ></textarea>
                </div>

                <div className="flex flex-col gap-5 pt-4">
                  <button
                    type="submit"
                    className="w-full py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-xs border border-[#FFD700]/30 hover:bg-black transition-all flex items-center justify-center gap-4"
                  >
                    <CheckCircle2 size={18} className="text-[#FFD700]" />{" "}
                    Authorize Clinical Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Discard Draft
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Detail Overlay */}
        {selectedVisit && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#1a0033]/95 backdrop-blur-3xl p-4 md:p-8">
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl shadow-2xl border-t-[8px] border-[#4B0082] overflow-hidden flex flex-col animate-slide-up">
              <div className="p-10 md:p-16 flex flex-col md:flex-row gap-16 relative overflow-hidden bg-[#FAFAFA] dark:bg-gray-950 flex-1 overflow-y-auto no-scrollbar">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#4B0082]/5 rounded-full blur-[100px] -mr-48 -mt-48"></div>

                <div className="flex-shrink-0 w-full md:w-72 space-y-8 relative z-10">
                  <div className="aspect-square bg-white dark:bg-gray-800 shadow-2xl border-4 border-white dark:border-gray-700 flex flex-col items-center justify-center relative group overflow-hidden">
                    <Activity size={80} className="text-[#4B0082] opacity-10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <h1 className="text-6xl font-black text-red-600 opacity-20">
                        {selectedVisit.bloodType}
                      </h1>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Visit Status
                      </p>
                      <p className="text-xs font-black uppercase text-[#4B0082] dark:text-[#FFD700]">
                        {selectedVisit.status}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Blood Type
                      </p>
                      <p className="text-sm font-black text-red-600 uppercase">
                        {selectedVisit.bloodType}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button className="w-full py-5 bg-[#4B0082] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 border-2 border-[#FFD700]/30">
                      <Printer size={18} className="text-[#FFD700]" /> PRINT
                      MEDICAL SLIP
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-12 relative z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-[#4B0082] dark:text-[#FFD700] uppercase tracking-[0.4em]">
                          Official Medical Record
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full animate-pulse ${selectedVisit.status === "Urgent" ? "bg-red-500" : "bg-emerald-500"}`}
                        ></span>
                      </div>
                      <h2 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight">
                        {selectedVisit.studentName}
                      </h2>
                      <p className="text-xl font-bold text-[#4B0082] dark:text-purple-300 mt-2 uppercase tracking-tight">
                        {selectedVisit.studentId}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedVisit(null)}
                      className="p-4 bg-white dark:bg-gray-800 hover:bg-red-500 hover:text-white transition-all text-gray-400 shadow-sm"
                    >
                      <X size={32} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-y border-gray-200 dark:border-gray-800">
                    <div className="bg-white dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                      <Thermometer
                        size={20}
                        className="mx-auto mb-2 text-amber-500"
                      />
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Temperature
                      </p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">
                        {selectedVisit.vitals.temp}°C
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                      <Wind size={20} className="mx-auto mb-2 text-blue-500" />
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Blood Pressure
                      </p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">
                        {selectedVisit.vitals.bp}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                      <Droplets
                        size={20}
                        className="mx-auto mb-2 text-red-500"
                      />
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Pulse Rate
                      </p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">
                        {selectedVisit.vitals.pulse} BPM
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">
                        Consultation Profile:
                      </h4>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={12} /> {selectedVisit.date}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-8 border-l-8 border-gray-900 dark:border-gray-700 shadow-sm">
                      <h5 className="text-lg font-black text-[#4B0082] dark:text-purple-300 uppercase mb-4">
                        {selectedVisit.condition}
                      </h5>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200 leading-relaxed italic">
                        {selectedVisit.notes ||
                          "No detailed observations recorded for this node."}
                      </p>
                      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Attending Specialist
                          </p>
                          <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {selectedVisit.attendingStaff}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <History size={16} className="text-[#4B0082]" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Registry Updated
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end items-center gap-4">
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="px-10 py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#4B0082] transition-all"
                >
                  <CheckCircle2 size={16} className="text-[#FFD700]" /> Close
                  Patient File
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Protocol Footer */}
        <div className="bg-gray-900 border-l-4 border-[#FFD700] p-6 text-white flex items-start gap-5 shadow-2xl">
          <div className="p-2 bg-[#FFD700] text-black shadow-lg">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700]">
              Health Information Privacy Protocol
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Medical records are strictly confidential and governed by BMI
              Institutional Privacy Mandates. Access is logged and monitored.
              Unauthorized disclosure of patient health data is a severe policy
              violation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};









