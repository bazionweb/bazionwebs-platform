import React, { useState, useMemo, useEffect } from "react";
import { ReceiptModal } from "./finance/ReceiptModal";
import { NewTransactionModal } from "./finance/NewTransactionModal";
import {
  
  Plus,
  Search,
  Filter,
  
  
  
  FileText,
  X,
  
  
  History,
  
  Users,
  Briefcase,
  
  ShieldAlert,
  Send,
  Mail,
  Check,
  Edit2,
  Download,
  CreditCard,
} from '../shims/lucide-react';
import { Transaction, Student } from "../types";
import { getPrograms } from "../services/catalogService";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
} from "../services/financeService";
import { BulkEntryModal } from "./BulkEntryModal";
import { postTransactionBatch } from "../services/batchService";
import { useDataStore } from "../stores/dataStore";
import { useTransactionsQuery, useStudentsQuery, useStaffQuery } from "../hooks/useEntityQueries";

const Finance: React.FC = () => {

  // Fetch data using TanStack Query
  const { data: studentsRes } = useStudentsQuery({
    page: 1,
    perPage: 1000,
  });
  const { data: staffRes } = useStaffQuery({
    page: 1,
    perPage: 1000,
  });
  const { data: transactionsRes, refetch: refetchTransactions } = useTransactionsQuery({
    page: 1,
    perPage: 1000,
  });

  const students = studentsRes?.data?.items || [];
  const staff = staffRes?.data?.items || [];
  const transactions = transactionsRes?.data || [];

  const _setTransactions = useDataStore((s) => s.setTransactions);
  const setTransactions = (action: React.SetStateAction<Transaction[]>) => {
    if (typeof action === "function") {
      _setTransactions(
        (action as (prev: Transaction[]) => Transaction[])(
          useDataStore.getState().transactions,
        ),
      );
    } else {
      _setTransactions(action);
    }
  };
  const [financeView, setFinanceView] = useState<"students" | "employees">(
    "students",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
//   const [, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<
    (Student & { paid: number; pending: number; txCount: number }) | null
  >(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState<Transaction | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [bulkTxOpen, setBulkTxOpen] = useState(false);
  const [programRows, setProgramRows] = useState<
    Array<{ id: string; label: string }>
  >([]);

  // Advanced Filters
  const [programFilter, setProgramFilter] = useState("All Programs");
  const [deptFilter, setDeptFilter] = useState("All Dept");
  const [yearFilter, setYearFilter] = useState("All Years");

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


  const [newTx, setNewTx] = useState<{
    name: string;
    desc: string;
    amt: string;
    status: Transaction["status"];
    date: string;
  }>({
    name: "",
    desc: "Tuition Payment",
    amt: "",
    status: "Paid",
    date: new Date().toISOString().split("T")[0],
  });

  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const depts = [
    "All Dept",
    "Biblical Studies",
    "Computer Science",
    "Undeclared",
  ];
  const years = ["All Years", "2022", "2023", "2024"];

  const studentLedgerData = useMemo(() => {
    return students
      .filter((s) => {
        const matchesSearch = `${s.first_name} ${s.last_name} ${s.id}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesProgram =
          programFilter === "All Programs" || s.program_code === programFilter;
        const matchesDept =
          deptFilter === "All Dept" ||
          (s as unknown as { department?: string }).department === deptFilter;
        const matchesYear =
          yearFilter === "All Years" ||
          String(
            (s as unknown as { admission_date?: string }).admission_date || "",
          ).includes(yearFilter);
        return matchesSearch && matchesProgram && matchesDept && matchesYear;
      })
      .map((s) => {
        const studentName = `${s.first_name} ${s.last_name}`;
        const studentTxs = transactions.filter((t) => t.name === studentName);
        const paid = studentTxs.reduce(
          (acc, curr) => (curr.status === "Paid" ? acc + curr.amt : acc),
          0,
        );
        const pending = studentTxs.reduce(
          (acc, curr) => (curr.status === "Pending" ? acc + curr.amt : acc),
          0,
        );
        return { ...s, paid, pending, txCount: studentTxs.length };
      });
  }, [
    students,
    transactions,
    searchTerm,
    programFilter,
    deptFilter,
    yearFilter,
  ]);

  const employeeLedgerData = useMemo(() => {
    return staff
      .filter((st) => {
        const matchesSearch = `${st.name} ${st.id}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        return matchesSearch;
      })
      .map((st) => {
        const staffTxs = transactions.filter(
          (t) => t.name === st.name && (t.desc || "").includes("Salary"),
        );
        const totalPaid = staffTxs.reduce(
          (acc, curr) => (curr.status === "Paid" ? acc + curr.amt : acc),
          0,
        );
        return { ...st, totalPaid, txCount: staffTxs.length };
      });
  }, [staff, transactions, searchTerm]);

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.name) {
      setToastMsg("Please select a recipient from the registry");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    let committedTx: Transaction | null = null;

    try {
      if (editingTx && editingTx.id) {
        const res = await updateTransaction(editingTx.id, {
          name: newTx.name,
          desc: newTx.desc,
          amt: parseFloat(newTx.amt) || 0,
          status: newTx.status,
          date: newTx.date,
        });
        if (res.success && res.data) {
          committedTx = res.data as Transaction;
          setTransactions((prev) =>
            prev.map((t) => (t.id === editingTx.id ? committedTx! : t)),
          );
          try { await refetchTransactions(); } catch { /* ignore */ }
        } else {
          setToastMsg(res.error || "Update failed");
          setShowToast(true);
          return;
        }
        setIsNewTxModalOpen(false);
        setEditingTx(null);
        setToastMsg("Transaction updated successfully");
      } else if (editingTx) {
        committedTx = {
          ...editingTx,
          name: newTx.name,
          desc: newTx.desc,
          amt: parseFloat(newTx.amt) || 0,
          status: newTx.status,
          date: newTx.date,
        };
        setTransactions((prev) =>
          prev.map((t) => (t.ref === editingTx.ref ? committedTx! : t)),
        );
        setIsNewTxModalOpen(false);
        setEditingTx(null);
        setToastMsg("Transaction updated locally (no server id)");
      } else {
        const randomValues = new Uint32Array(1);
        crypto.getRandomValues(randomValues);
        const match = (students as any[]).find((s: any) =>
          `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase() === newTx.name.trim().toLowerCase() ||
          s.id === newTx.name || s.student_number === newTx.name,
        );
        const student_id = (match as any)?.id || (match as any)?.user_id || (students as any[])[0]?.id;
        if (!student_id) {
          setToastMsg("No student in registry — add a student first");
          setShowToast(true);
          return;
        }
        const res = await createTransaction({
          student_id,
          ref: `TRX-${(randomValues[0] % 10000).toString().padStart(4, "0")}`,
          name: newTx.name,
          desc: newTx.desc,
          date: newTx.date,
          amt: parseFloat(newTx.amt) || 0,
          status: newTx.status,
        } as any);
        if (res.success && res.data) {
          committedTx = res.data as Transaction;
          setTransactions((prev) => [committedTx!, ...prev]);
          try { await refetchTransactions(); } catch { /* ignore */ }
          setToastMsg(`Entry for ${committedTx.name} committed successfully`);
        } else {
          setToastMsg(res.error || "Create failed — not persisted");
          setShowToast(true);
          return;
        }
        if (!keepOpen) {
          setIsNewTxModalOpen(false);
        }
      }

      if (committedTx?.status === "Paid") {
        setShowReceipt(committedTx);
      }

      setNewTx({
        name: "",
        desc:
          financeView === "students"
            ? "Tuition Payment"
            : "Salary Disbursement",
        amt: "",
        status: "Paid",
        date: new Date().toISOString().split("T")[0],
      });

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
      setToastMsg("Network error saving transaction");
      setShowToast(true);
     }
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    setNewTx({
      name: tx.name,
      desc: tx.desc,
      amt: tx.amt.toString(),
      status: tx.status,
      date: tx.date,
    });
    setIsNewTxModalOpen(true);
  };

  const sendReceipt = (
    recipient: string,
    type: "single" | "yearly" | "total",
    amt?: number,
  ) => {
    setToastMsg(
      `Digital Archive (${type}) dispatched to ${recipient}${amt ? ` for $${amt.toLocaleString()}` : ""}`,
    );
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const getReceiptData = (tx: Transaction) => {
    const student = students.find(
      (s) => `${s.first_name} ${s.last_name}` === tx.name,
    );
    const studentTxs = transactions.filter(
      (t) => t.name === tx.name && t.status === "Paid",
    );
    const totalPaid = studentTxs.reduce((acc, curr) => acc + curr.amt, 0);
    const tuitionTotal = 5000;
    const balance = Math.max(0, tuitionTotal - totalPaid);
    return { student, totalPaid, balance };
  };

  const handleExportCSV = () => {
    if (financeView === "students") {
      const headers = ["Student ID", "Student Name", "Program", "Total Paid ($)", "Pending ($)", "Transactions Count"];
      const rows = studentLedgerData.map((s) => [
        `"${s.id}"`,
        `"${s.first_name} ${s.last_name}"`,
        `"${s.program_code || ""}"`,
        s.paid,
        s.pending,
        s.txCount,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `finance_student_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ["Employee ID", "Employee Name", "Role / Department", "Total Salary Paid ($)", "Disbursements Count"];
      const rows = employeeLedgerData.map((st) => [
        `"${st.id}"`,
        `"${st.name}"`,
        `"${st.role || st.department || ""}"`,
        st.totalPaid,
        st.txCount,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `finance_personnel_payroll_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#4B0082] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Department of Finance
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Institutional Finance & Audit Ledger
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg shadow-xs cursor-pointer"
          >
            <Download size={12} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => setBulkTxOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-[#4B0082] dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg shadow-xs cursor-pointer"
          >
            Bulk JSON
          </button>
          <button
            onClick={() => {
              setEditingTx(null);
              setNewTx({
                name: "",
                desc:
                  financeView === "students"
                    ? "Tuition Payment"
                    : "Salary Disbursement",
                amt: "",
                status: "Paid",
                date: new Date().toISOString().split("T")[0],
              });
              setIsNewTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white hover:bg-purple-950 transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 shadow-md rounded-lg cursor-pointer"
          >
            <Plus size={12} className="text-[#FFD700]" />{" "}
            {financeView === "students" ? "Record Payment" : "Process Payroll"}
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <CreditCard size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Ledgers
          </span>
        </div>
        <button
          onClick={() => {
            setFinanceView("students");
            setSearchTerm("");
          }}
          className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
            financeView === "students"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <Users
            size={12}
            className={
              financeView === "students" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Student Ledger
        </button>
        <button
          onClick={() => {
            setFinanceView("employees");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            financeView === "employees"
              ? "bg-[#4B0082] text-white shadow-lg shadow-purple-500/20 scale-105 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <Briefcase
            size={12}
            className={
              financeView === "employees" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Personnel Payroll
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Main Ledger Section */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-gray-700 space-y-6 bg-gray-50/50 dark:bg-gray-900/20">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-[450px]">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder={
                    financeView === "students"
                      ? "Search Student Name or BMI-ID..."
                      : "Search Employee Name or STF-ID..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none text-sm dark:text-white font-semibold focus:ring-1 focus:ring-[#4B0082] shadow-inner"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Ledger Metrics:
                </span>
                <div className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase">
                  Active Filters Applied
                </div>
              </div>
            </div>

            {financeView === "students" && (
              <div className="flex flex-wrap gap-4 items-center animate-fade-in">
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-[#4B0082] max-w-[200px]"
                >
                  <option value="All Programs">All Programs</option>
                  {programRows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-[#4B0082]"
                >
                  {depts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-[#4B0082]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setProgramFilter("All Programs");
                    setDeptFilter("All Dept");
                    setYearFilter("All Years");
                  }}
                  className="text-[10px] font-black uppercase text-[#4B0082] hover:underline px-2"
                >
                  Reset Registry Filters
                </button>
              </div>
            )}
          </div>

          {/* ... Table logic remains the same ... */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900 text-gray-400 uppercase text-[9px] font-black tracking-[0.25em] border-b border-gray-800">
                  <th className="px-6 py-5">Record ID</th>
                  <th className="px-6 py-5">
                    {financeView === "students"
                      ? "Billed Student"
                      : "Employee Entity"}
                  </th>
                  <th className="px-6 py-5">Institutional Domain</th>
                  <th className="px-6 py-5">Admission / Join</th>
                  <th className="px-6 py-5">Cumulative Paid</th>
                  <th className="px-6 py-5">Pending Dues</th>
                  <th className="px-6 py-5 text-right">Commit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {financeView === "students"
                  ? studentLedgerData.map((s, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-purple-50/30 dark:hover:bg-gray-700/30 transition-all group"
                      >
                        <td className="px-6 py-5 text-xs font-mono font-bold text-[#4B0082] dark:text-purple-300">
                          {s.id}
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                            {s.careerPath}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-blue-400"></div>
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-tight">
                              {s.program_code || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs text-gray-500 font-black">
                          {s.admissionYear}
                        </td>
                        <td className="px-6 py-5 text-sm font-black text-[#4B0082] dark:text-white">
                          ${s.paid.toLocaleString()}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${
                              s.pending > 0
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            }`}
                          >
                            {s.pending > 0
                              ? `$${s.pending.toLocaleString()}`
                              : "Clear"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedStudent(s)}
                              className="p-2 text-gray-300 hover:text-[#4B0082] transition-colors"
                              title="Bursary Detail"
                            >
                              <History size={18} />
                            </button>
                            <button
                              onClick={() =>
                                sendReceipt(
                                  `${s.first_name} ${s.last_name}`,
                                  "total",
                                )
                              }
                              className="p-2 text-gray-300 hover:text-[#4B0082] transition-colors"
                              title="Dispatch Total Receipt"
                            >
                              <Mail size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : employeeLedgerData.map((st, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-purple-50/30 dark:hover:bg-gray-700/30 transition-all group"
                      >
                        <td className="px-6 py-5 text-xs font-mono font-bold text-[#4B0082] dark:text-purple-300">
                          {st.id}
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                            {st.name}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                            {st.role}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-purple-400"></div>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                              {st.department}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs text-gray-500 font-black">
                          {st.joinDate}
                        </td>
                        <td className="px-6 py-5 text-sm font-black text-[#4B0082] dark:text-white">
                          ${st.totalPaid.toLocaleString()}
                        </td>
                        <td className="px-6 py-5">
                          <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-100">
                            Verified
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button className="p-2 text-gray-300 hover:text-[#4B0082] transition-colors">
                            <FileText size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Existing Modals and Footers ... (Unchanged) */}
        {selectedStudent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4">
            {/* ... Student History Modal ... */}
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl shadow-2xl border-2 border-gray-900 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b-4 border-[#4B0082] flex justify-between items-center bg-gray-900 text-white">
                <div>
                  <h3 className="text-2xl font-bold uppercase tracking-tight">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h3>
                  <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest mt-1">
                    Institutional Financial Node: {selectedStudent.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 hover:bg-red-500 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              {/* ... Modal Content ... */}
              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                {/* ... Student Details and History Table ... */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 border border-gray-100 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Total Capital Committed
                    </p>
                    <p className="text-3xl font-black text-[#4B0082] dark:text-white mt-1">
                      ${selectedStudent.paid.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 border border-gray-100 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Outstanding Audit Dues
                    </p>
                    <p className="text-3xl font-black text-amber-500 mt-1">
                      ${selectedStudent.pending.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() =>
                        sendReceipt(
                          `${selectedStudent.first_name} ${selectedStudent.last_name}`,
                          "yearly",
                        )
                      }
                      className="flex-1 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest py-3 hover:bg-black transition-all"
                    >
                      Dispatch Yearly Statement
                    </button>
                    <button
                      onClick={() =>
                        sendReceipt(
                          `${selectedStudent.first_name} ${selectedStudent.last_name}`,
                          "total",
                        )
                      }
                      className="flex-1 border-2 border-[#4B0082] text-[#4B0082] text-[10px] font-black uppercase tracking-widest py-3 hover:bg-gray-50 transition-all"
                    >
                      Request Final Clearance
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <History size={14} /> Historical Ledger Entries
                  </h4>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900 text-gray-400 uppercase text-[9px] font-black tracking-widest">
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Specification</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {transactions
                        .filter(
                          (t) =>
                            t.name ===
                            `${selectedStudent.first_name} ${selectedStudent.last_name}`,
                        )
                        .map((t, i) => (
                          <tr
                            key={i}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <td className="px-4 py-3 text-xs font-mono font-bold text-[#4B0082]">
                              {t.ref}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold uppercase tracking-tight">
                              {t.desc}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-semibold">
                              {t.date}
                            </td>
                            <td className="px-4 py-3 text-xs font-black">
                              ${t.amt.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleEditClick(t)}
                                  className="p-1 text-gray-400 hover:text-[#4B0082] transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setShowReceipt(t)}
                                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                  <FileText size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    sendReceipt(t.name, "single", t.amt)
                                  }
                                  className="p-1 text-gray-400 hover:text-emerald-500 transition-colors"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {transactions.filter(
                        (t) =>
                          t.name ===
                          `${selectedStudent.first_name} ${selectedStudent.last_name}`,
                      ).length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-10 text-center text-xs font-bold text-gray-400 uppercase italic"
                          >
                            No documented transactions found in registry
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ... Other Modals ... */}
        <ReceiptModal showReceipt={showReceipt} setShowReceipt={setShowReceipt} getReceiptData={getReceiptData} sendReceipt={sendReceipt} setShowToast={setShowToast} setToastMsg={setToastMsg} />\n        <NewTransactionModal isNewTxModalOpen={isNewTxModalOpen} setIsNewTxModalOpen={setIsNewTxModalOpen} editingTx={editingTx} setEditingTx={setEditingTx} financeView={financeView} newTx={newTx} setNewTx={setNewTx} handleAddTx={handleAddTx} students={students} staff={staff} keepOpen={keepOpen} setKeepOpen={setKeepOpen} />\n        {showToast && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[150] animate-fade-in">
            <div className="bg-gray-900 text-[#FFD700] px-10 py-5 rounded-none shadow-2xl flex items-center gap-4 border-2 border-[#FFD700] backdrop-blur-xl">
              <Check size={24} className="animate-pulse" />
              <span className="font-black text-xs uppercase tracking-[0.15em]">
                {toastMsg}
              </span>
            </div>
          </div>
        )}

        <BulkEntryModal
          open={bulkTxOpen}
          onClose={() => setBulkTxOpen(false)}
          title="Bulk transactions (JSON lines)"
          entity="transactions"
          sampleLine='{"ref":"TX-B-1","name":"Jane Doe","desc":"Tuition","amt":1500,"status":"Paid","date":"2025-01-01"}'
          onSubmit={async (lines) => {
            try {
              const items = lines.map(
                (l) => JSON.parse(l) as any,
              );
              const r = await postTransactionBatch(items);
              const list = await getTransactions({ perPage: 500 });
              if (list.success && list.data) setTransactions(list.data);
              return {
                ok: (r.data?.failureCount ?? 0) === 0,
                message: `Created: ${r.data?.successCount ?? 0}, failed: ${r.data?.failureCount ?? 0}.`,
              };
} catch {
              return {
                ok: false,
                message: "Invalid JSON on one or more lines.",
              };
            }
          }}
        />

        {/* Security Protocol Footer */}
        <div className="bg-gray-900 border-l-4 border-[#FFD700] p-6 text-white flex items-start gap-5 shadow-2xl mt-auto">
          <div className="p-2 bg-[#FFD700] text-black">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700]">
              Security Protocol Enforcement
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Bursary collections and payroll cycles are locked for the current
              fiscal period. Automated receipt dispatch is monitored for
              institutional transparency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finance;









