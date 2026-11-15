import React, { useState, useEffect } from "react";
import {
  Send,
  Mail,
  Smartphone,
  Users,
  Search,
  History,
  CheckCircle,
  Clock,
  AlertCircle,
  Bot,
  Paperclip,
  FileText,
  Trash2,
  Layout,
  Loader2,
  Check,
  ShieldCheck,
  Zap,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  Inbox,
  Globe,
  Reply,
  RefreshCw,
  Filter,
  CheckCircle2,
  Archive,
} from '../shims/lucide-react';
import { getAIResponse } from "../services/aiService";
import { 
  listCommunications, 
  createCommunication, 
  deleteCommunication,
  listContactSubmissions,
  updateContactSubmissionStatus,
  deleteContactSubmission,
  ContactSubmissionRecord
} from "../services/communicationsService";
import { Student, StaffMember } from "../types";
import { useDataStore } from "../stores/dataStore";

interface MessageLog {
  id: string;
  type: "SMS" | "Email";
  recipient: string;
  date: string;
  status: "Delivered" | "Pending" | "Failed";
  subject?: string;
  text: string;
}

const Communications: React.FC = () => {
  const students = useDataStore((s) => s.students);
  const staff = useDataStore((s) => s.staff);
  const [activeChannel, setActiveChannel] = useState<"sms" | "email">("email");
  const [activeTab, setActiveTab] = useState<"composer" | "history" | "inquiries">(
    "composer",
  );
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [recipientType, setRecipientType] = useState<
    "Broadcast" | "Individual"
  >("Broadcast");
  const [recipientGroup, setRecipientGroup] = useState(
    "All Registered Students",
  );
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [history, setHistory] = useState<MessageLog[]>([]);

  // ── Website Inquiries (contact form submissions) ──────────────────────────
  const [inquiries, setInquiries] = useState<ContactSubmissionRecord[]>([]);
  const [inquiriesTotal, setInquiriesTotal] = useState(0);
  const [inquiriesUnread, setInquiriesUnread] = useState(0);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(false);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>("all");
  const [inquirySearch, setInquirySearch] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<ContactSubmissionRecord | null>(null);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await listCommunications({ perPage: 200 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setHistory(
        list.map((r) => ({
          id: r.id,
          type: r.type,
          recipient: r.recipient,
          date: new Date(r.created_at || Date.now()).toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: r.status,
          subject: r.subject || undefined,
          text: r.body,
        })),
      );
    } catch {
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadInquiries = async () => {
    setIsLoadingInquiries(true);
    try {
      const res = await listContactSubmissions({
        status: inquiryStatusFilter === "all" ? undefined : inquiryStatusFilter,
        search: inquirySearch || undefined,
        perPage: 100,
      });
      setInquiries(Array.isArray(res?.data) ? res.data : []);
      setInquiriesTotal(res.total ?? 0);
      setInquiriesUnread(res.unreadCount ?? 0);
    } catch {
      setInquiries([]);
    } finally {
      setIsLoadingInquiries(false);
    }
  };

  const handleMarkInquiry = async (id: string, status: "read" | "replied" | "archived" | "new") => {
    await updateContactSubmissionStatus(id, status);
    setInquiries((prev) => prev.map((q) => q.id === id ? { ...q, status } : q));
    if (selectedInquiry?.id === id) setSelectedInquiry((prev) => prev ? { ...prev, status } : prev);
    // Refresh unread badge
    const unreadNow = inquiries.filter((q) => q.id !== id ? q.status === "new" : status === "new").length;
    setInquiriesUnread(unreadNow);
  };

  const handleDeleteInquiry = async (id: string) => {
    const res = await deleteContactSubmission(id);
    if (res.success) {
      setInquiries((prev) => prev.filter((q) => q.id !== id));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
    }
  };

  useEffect(() => {
    loadHistory();
    loadInquiries();
  }, []);

  useEffect(() => {
    if (activeTab === "inquiries") loadInquiries();
  }, [activeTab, inquiryStatusFilter]);

  const handleDeleteRecord = async (id: string) => {
    const res = await deleteCommunication(id);
    if (res.success) {
      setHistory((prev) => prev.filter((h) => h.id !== id));
      setToastMsg("Dispatch record removed from the ledger.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      setToastMsg(res.error || "Failed to remove the record.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const templates = [
    {
      name: "Exam Reminder",
      channel: "both",
      text: "Official Notice: Final examinations for the current semester commence on [Date]. Ensure all academic clearances are satisfied.",
    },
    {
      name: "Fee Deadline",
      channel: "email",
      subject: "Urgent: Financial Commitment Deadline",
      text: "Institutional Audit Notice: The deadline for tuition settlement for the Fall 2024 cycle is approaching. Please satisfy outstanding dues to maintain portal access.",
    },
    {
      name: "Event Invitation",
      channel: "email",
      subject: "Chancellor's Excellence Convocation",
      text: "BMI University cordially invites you to the annual Convocation of Excellence at Bethlehem Hall.",
    },
    {
      name: "System Maintenance",
      channel: "sms",
      text: "ICT Alert: The Institutional ERP Node will undergo optimization on [Time]. System latency may be encountered.",
    },
  ];

  const filteredTemplates = templates.filter(
    (t) => t.channel === "both" || t.channel === activeChannel,
  );

  const getRecipientLabel = () => {
    if (recipientType === "Broadcast") return recipientGroup;
    const s = students.find((x) => x.id === selectedRecipientId);
    if (s) return `${s.first_name} ${s.last_name} (${s.id})`;
    const st = staff.find((x) => x.id === selectedRecipientId);
    if (st)
      return `${`${st.first_name ?? ""} ${st.last_name ?? ""}`.trim()} (${st.id})`;
    return "Unknown Recipient";
  };

  const handleAiDraft = async () => {
    if (!message && activeChannel === "email" && !subject) {
      setToastMsg("Please enter a brief topic or prompt for the AI.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setIsAiDrafting(true);
    const target = getRecipientLabel();
    const prompt = `Draft a professional BMI University institutional ${activeChannel} to ${target} about: ${message || subject || "general campus updates"}.
    Use a formal tone. DO NOT use stars (**) or HTML (<b>).
    Ensure titles end with a colon (:) or are on a single line.
    Include the official signature: "In Excellence, Office of the Registrar".`;

    let response = await getAIResponse(
      prompt,
      `Acting as the BMI Communications Director. Target: ${target}.`,
    );

    // Final clean: remove any accidental stars or tags
    response = response
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/<[^>]*>?/gm, "");

    if (activeChannel === "email") {
      if (response.includes("Subject:")) {
        const lines = response.split("\n");
        const subjLine = lines.find((l) => l.startsWith("Subject:"));
        if (subjLine) {
          setSubject(subjLine.replace("Subject:", "").trim());
          setMessage(
            lines
              .filter((l) => !l.startsWith("Subject:"))
              .join("\n")
              .trim(),
          );
        } else {
          setMessage(response);
        }
      } else {
        setMessage(response);
      }
    } else {
      setMessage(response.slice(0, 160));
    }
    setIsAiDrafting(false);
  };

  const handleSend = async () => {
    if (!message) return;
    if (recipientType === "Individual" && !selectedRecipientId) {
      setToastMsg("Please select a specific recipient from the registry.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setIsDispatching(true);

    const res = await createCommunication({
      type: activeChannel === "sms" ? "SMS" : "Email",
      channel: activeChannel,
      recipient: getRecipientLabel(),
      subject: activeChannel === "email" ? subject : undefined,
      body: message,
      status: "Delivered",
    });
    setIsDispatching(false);

    if (res.success && res.data) {
      setHistory((prev) => [
        {
          id: res.data!.id,
          type: res.data!.type,
          recipient: res.data!.recipient,
          date: new Date(res.data!.created_at).toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: res.data!.status,
          subject: res.data!.subject || undefined,
          text: res.data!.body,
        },
        ...prev,
      ]);
      setToastMsg(
        `${activeChannel.toUpperCase()} Broadcast dispatched successfully.`,
      );
    } else {
      setToastMsg(res.error || "Dispatch failed — could not reach the ledger.");
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    setMessage("");
    setSubject("");
    setSelectedRecipientId("");
  };

  const handleWhatsAppSend = async () => {
    if (!message) return;
    const cleanMsg = message.replace(/<[^>]*>?/gm, "");
    const formatNum = (num: string) => num.replace(/\D/g, "");

    let targetNumbers: string[] = [];

    if (recipientType === "Individual") {
      const entity =
        students.find((s) => s.id === selectedRecipientId) ||
        staff.find((st) => st.id === selectedRecipientId);
      if (entity?.phone) {
        targetNumbers.push(formatNum(entity.phone));
      }
    } else {
      // Broadcast Logic
      let targets: (Student | StaffMember)[] = [];
      if (recipientGroup === "All Registered Students") {
        targets = students;
      } else if (recipientGroup === "Faculty of Theology") {
        targets = students.filter((s) => s.faculty === "Theology");
      } else if (recipientGroup === "ICT Department") {
        targets = students.filter((s) => s.faculty === "ICT");
      } else if (recipientGroup === "Business Cohort") {
        targets = students.filter((s) => s.faculty === "Business");
      } else if (recipientGroup === "Education Staff") {
        targets = staff.filter(
          (st) => st.role?.includes("Education") || st.category === "Academic",
        );
      } else if (recipientGroup === "Eden Residence Tenants") {
        targets = students.filter((s) => s.status === "Active").slice(0, 10); // Simulated segment
      } else if (recipientGroup === "Emergency Nodes") {
        targets = staff.filter((st) => st.category === "Management");
      }
      targetNumbers = targets
        .map((t) => t.phone)
        .filter(Boolean)
        .map((n) => formatNum(n));
    }

    if (targetNumbers.length === 0) {
      setToastMsg(
        "Registry Error: No valid phone numbers identified for selection.",
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    // Direct WhatsApp Dispatch (Sequential tab opening with delay to prevent browser blocking)
    targetNumbers.forEach((num, idx) => {
      setTimeout(() => {
        window.open(
          `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(cleanMsg)}`,
          "_blank",
        );
      }, idx * 800);
    });

    // Record the dispatch in the ledger (SMS record with WhatsApp channel)
    const res = await createCommunication({
      type: "SMS",
      channel: "whatsapp",
      recipient: `${getRecipientLabel()} (${targetNumbers.length} WhatsApp targets)`,
      body: message,
      status: "Delivered",
    });
    if (res.success && res.data) {
      setHistory((prev) => [
        {
          id: res.data!.id,
          type: res.data!.type,
          recipient: res.data!.recipient,
          date: new Date(res.data!.created_at).toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: res.data!.status,
          text: res.data!.body,
        },
        ...prev,
      ]);
    }

    setToastMsg(
      `WhatsApp Gateway: Initiating dispatch to ${targetNumbers.length} entities.`,
    );
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Logic to visually bold titles and signature lines in the UI without using tags in the text
  const renderMessageText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      // Bold if ends with colon, starts with "Subject", is the signature line, or is short and all caps
      const isHeader =
        trimmed.endsWith(":") ||
        trimmed.startsWith("Subject:") ||
        trimmed.startsWith("In Excellence") ||
        trimmed.startsWith("Office of the Registrar") ||
        trimmed.startsWith("BMI University") ||
        (trimmed.length > 0 &&
          trimmed.length < 30 &&
          trimmed === trimmed.toUpperCase() &&
          !trimmed.includes("."));

      return (
        <div
          key={i}
          className={
            isHeader
              ? "font-black text-gray-900 dark:text-white"
              : "font-medium"
          }
        >
          {line || "\u00A0"}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Communications Center
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Institutional Broadcast & Global Notification Gateway
            </p>
          </div>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <MessageSquare size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Modules
          </span>
        </div>
        <button
          onClick={() => setActiveTab("composer")}
          className={`px-4 sm:px-6 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "composer"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <Send
            size={12}
            className={
              activeTab === "composer" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Composer
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 sm:px-6 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "history"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          <History
            size={12}
            className={
              activeTab === "history" ? "text-[#FFD700]" : "text-gray-400"
            }
          />{" "}
          Dispatch Log
        </button>
        <button
          onClick={() => setActiveTab("inquiries")}
          className={`px-4 sm:px-6 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === "inquiries"
              ? "bg-[#8B0000] text-white shadow-md shadow-red-500/20 border border-red-800/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#8B0000]"
          }`}
        >
          <Inbox
            size={12}
            className={activeTab === "inquiries" ? "text-[#FFD700]" : "text-gray-400"}
          />{" "}
          Website Inquiries
          {inquiriesUnread > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white animate-pulse">
              {inquiriesUnread}
            </span>
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-none border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                <Layout size={14} className="text-[#4B0082]" /> Template Library
              </h3>
              <div className="space-y-2">
                {filteredTemplates.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setMessage(t.text);
                      setSubject(t.subject || "");
                    }}
                    className="w-full text-left p-4 bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-[#4B0082] transition-all group rounded-none"
                  >
                    <p className="text-[11px] font-black uppercase text-gray-700 dark:text-gray-200 group-hover:text-[#4B0082]">
                      {t.name}
                    </p>
                    <div className="text-[9px] text-gray-400 mt-1 line-clamp-1 italic">
                      {t.text}
                    </div>
                  </button>
                ))}
              </div>
              <button className="w-full mt-6 py-3 border-2 border-dashed border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#4B0082] hover:border-[#4B0082] transition-all">
                Create New Template
              </button>
            </div>

            <div className="bg-[#1a0033] p-8 border-l-4 border-[#FFD700] text-white shadow-xl relative overflow-hidden">
              <Zap
                size={100}
                className="absolute -right-8 -bottom-8 text-white/5 rotate-12"
              />
              <div className="relative z-10 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                  Gateway Metrics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-purple-300 uppercase">
                      SMS Dispatches
                    </p>
                    <p className="text-xl font-black">
                      {history.filter((h) => h.type === "SMS").length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-purple-300 uppercase">
                      Deliverability
                    </p>
                    <p className="text-xl font-black text-emerald-400">
                      {history.length > 0
                        ? `${Math.round(
                            (history.filter((h) => h.status === "Delivered")
                              .length /
                              history.length) *
                              1000,
                          ) / 10}%`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-tighter">
                    {history.length > 0
                      ? `${history.filter((h) => h.type === "Email").length} Email / ${history.filter((h) => h.status === "Failed").length} failed dispatch(s) in ledger.`
                      : "No dispatches recorded in the ledger yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeTab === "composer" ? (
              <div className="bg-white dark:bg-gray-800 rounded-none shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col min-h-[600px]">
                <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-900">
                  <button
                    onClick={() => setActiveChannel("email")}
                    className={`flex-1 py-6 text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${activeChannel === "email" ? "bg-[#4B0082] text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    <Mail
                      size={18}
                      className={
                        activeChannel === "email" ? "text-[#FFD700]" : ""
                      }
                    />{" "}
                    Institutional Email
                  </button>
                  <button
                    onClick={() => setActiveChannel("sms")}
                    className={`flex-1 py-6 text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${activeChannel === "sms" ? "bg-[#4B0082] text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    <Smartphone
                      size={18}
                      className={
                        activeChannel === "sms" ? "text-[#FFD700]" : ""
                      }
                    />{" "}
                    SMS Gateway
                  </button>
                </div>

                <div className="p-10 space-y-10 flex-1">
                  {/* Form Content ... */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                        Target Selection Mode
                      </label>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setRecipientType("Broadcast")}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border transition-all ${recipientType === "Broadcast" ? "bg-[#4B0082] text-white border-[#4B0082]" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                        >
                          Mass Broadcast
                        </button>
                        <button
                          onClick={() => setRecipientType("Individual")}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border transition-all ${recipientType === "Individual" ? "bg-[#4B0082] text-white border-[#4B0082]" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                        >
                          Selective Individual
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                        {recipientType === "Broadcast"
                          ? "Registry Segment"
                          : "Registry Entity Search"}
                      </label>
                      {recipientType === "Broadcast" ? (
                        <div className="relative group">
                          <Users
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4B0082]"
                          />
                          <select
                            value={recipientGroup}
                            onChange={(e) => setRecipientGroup(e.target.value)}
                            className="w-full pl-12 pr-10 py-4 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#4B0082] outline-none text-sm font-black uppercase tracking-tight rounded-none appearance-none cursor-pointer shadow-inner"
                          >
                            <option>All Registered Students</option>
                            <option>Faculty of Theology</option>
                            <option>ICT Department</option>
                            <option>Business Cohort</option>
                            <option>Education Staff</option>
                            <option>Eden Residence Tenants</option>
                            <option>Emergency Nodes</option>
                          </select>
                        </div>
                      ) : (
                        <div className="relative group">
                          <Search
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4B0082]"
                          />
                          <select
                            value={selectedRecipientId}
                            onChange={(e) =>
                              setSelectedRecipientId(e.target.value)
                            }
                            className="w-full pl-12 pr-10 py-4 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#4B0082] outline-none text-sm font-black uppercase tracking-tight rounded-none appearance-none cursor-pointer shadow-inner"
                          >
                            <option value="">--- Select Individual ---</option>
                            <optgroup label="Staff & Faculty">
                              {staff.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {`${st.first_name ?? ""} ${st.last_name ?? ""}`.trim()}{" "}
                                  ({st.id})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Student Registry">
                              {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.first_name} {s.last_name} ({s.id})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeChannel === "email" && (
                    <div className="space-y-2 animate-slide-up">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                        Formal Subject Line
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. OFFICIAL ADVISORY: Semester Curriculum Finalization"
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#4B0082] outline-none text-sm font-bold uppercase tracking-widest rounded-none shadow-inner"
                      />
                    </div>
                  )}

                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                        Broadcast Narrative
                      </label>
                      <button
                        onClick={handleAiDraft}
                        disabled={isAiDrafting}
                        className="flex items-center gap-2 px-4 py-1.5 bg-[#4B0082] text-[#FFD700] text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg border border-[#FFD700]/30 disabled:opacity-50"
                      >
                        {isAiDrafting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Bot size={12} />
                        )}
                        Assist with BMI AI
                      </button>
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        activeChannel === "sms"
                          ? "Type concise SMS protocol message..."
                          : "Draft institutional email body content..."
                      }
                      className="w-full px-6 py-6 bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#4B0082] outline-none text-sm font-medium leading-relaxed rounded-none h-64 resize-none shadow-inner"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-gray-400 select-none">
                      {activeChannel === "email" && (
                        <button className="flex items-center gap-1.5 hover:text-[#4B0082] transition-colors">
                          <Paperclip size={12} /> Attach Protocols
                        </button>
                      )}
                      <span
                        className={
                          activeChannel === "sms" && message.length > 160
                            ? "text-red-500"
                            : ""
                        }
                      >
                        {message.length} /{" "}
                        {activeChannel === "sms" ? "160 (1 Segment)" : "10,000"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-900 text-[#FFD700] rounded-none shadow-lg">
                        <ShieldCheck size={20} />
                      </div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest max-w-[300px] leading-relaxed">
                        This transmission is record-locked. Hierarchy:
                        Institutional Audit Level 4.
                      </p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <button
                        onClick={handleWhatsAppSend}
                        disabled={!message}
                        className="px-8 py-5 bg-[#25D366] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-[11px] border border-white/20 hover:bg-[#128C7E] transition-all transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        <Smartphone size={18} /> WhatsApp
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={!message || isDispatching}
                        className="flex-1 md:flex-none px-14 py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.3em] text-[11px] border-2 border-[#FFD700]/30 hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-4 group disabled:opacity-50 min-w-[220px]"
                      >
                        {isDispatching ? (
                          <>
                            <Loader2
                              size={18}
                              className="animate-spin text-[#FFD700]"
                            />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Send
                              size={18}
                              className="text-[#FFD700] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                            />
                            Dispatch
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "inquiries" ? (
              /* ─── Website Inquiries Inbox ─────────────────────────────── */
              <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-gray-900 text-white flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-[#FFD700]" />
                    <h3 className="font-black text-xs uppercase tracking-[0.25em]">Website Inquiries Inbox</h3>
                    {inquiriesUnread > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white">{inquiriesUnread} new</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Status filter */}
                    <div className="flex items-center gap-1">
                      <Filter size={12} className="text-gray-400" />
                      {["all","new","read","replied","archived"].map(s => (
                        <button
                          key={s}
                          onClick={() => setInquiryStatusFilter(s)}
                          className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
                            inquiryStatusFilter === s
                              ? "bg-[#8B0000] text-white"
                              : "bg-gray-800 text-gray-400 hover:text-white"
                          }`}
                        >{s}</button>
                      ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                      <input
                        type="text"
                        placeholder="Search inquiries..."
                        value={inquirySearch}
                        onChange={(e) => setInquirySearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadInquiries()}
                        className="pl-7 pr-3 py-1.5 bg-gray-800 border border-gray-700 text-[10px] outline-none focus:border-[#FFD700] text-white rounded"
                      />
                    </div>
                    <button onClick={loadInquiries} className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white" title="Refresh">
                      <RefreshCw size={12} className={isLoadingInquiries ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                {/* Split pane */}
                <div className="flex flex-col md:flex-row min-h-[500px] md:h-[600px]">
                  {/* Left: inquiry list */}
                  <div className={`w-full md:w-2/5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 overflow-y-auto ${selectedInquiry ? 'hidden md:block' : 'block'}`}>
                    {isLoadingInquiries ? (
                      <div className="flex items-center justify-center h-40 text-gray-400">
                        <Loader2 size={20} className="animate-spin mr-2" /> Loading…
                      </div>
                    ) : inquiries.length === 0 ? (
                      <div className="py-20 text-center text-gray-400 text-xs uppercase tracking-widest">No inquiries found</div>
                    ) : (
                      inquiries.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => {
                            setSelectedInquiry(q);
                            if (q.status === "new") handleMarkInquiry(q.id, "read");
                          }}
                          className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors ${
                            selectedInquiry?.id === q.id
                              ? "bg-red-50 dark:bg-red-900/20 border-l-2 border-l-[#8B0000]"
                              : q.status === "new"
                              ? "bg-amber-50 dark:bg-amber-900/10 hover:bg-red-50 dark:hover:bg-red-900/10"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-black uppercase ${ q.status === "new" ? "text-[#8B0000]" : "text-gray-500" }`}>{q.name}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                              q.status === "new" ? "bg-red-100 text-red-700" :
                              q.status === "replied" ? "bg-green-100 text-green-700" :
                              q.status === "archived" ? "bg-gray-100 text-gray-500" :
                              "bg-blue-100 text-blue-700"
                            }`}>{q.status}</span>
                          </div>
                          <div className="text-[10px] text-gray-600 dark:text-gray-300 font-semibold truncate">{q.subject}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5">{new Date(q.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Right: detail reader */}
                  <div className={`flex-1 overflow-y-auto ${!selectedInquiry ? 'hidden md:block' : 'block'}`}>
                    {selectedInquiry ? (
                      <div className="p-4 sm:p-6">
                        {/* Mobile Back Button */}
                        <div className="md:hidden mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                          <button
                            onClick={() => setSelectedInquiry(null)}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#8B0000] hover:underline"
                          >
                            ← Back to Inquiries List
                          </button>
                        </div>

                        {/* Header */}
                        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                          <div>
                            <h4 className="font-black text-sm text-gray-900 dark:text-white">{selectedInquiry.subject}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-gray-500">From:</span>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedInquiry.name}</span>
                              <a href={`mailto:${selectedInquiry.email}`} className="text-xs text-[#8B0000] hover:underline">&lt;{selectedInquiry.email}&gt;</a>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">{new Date(selectedInquiry.created_at).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })}</div>
                          </div>
                          <span className={`text-[9px] px-2 py-1 rounded-full font-black uppercase flex-shrink-0 ${
                            selectedInquiry.status === "new" ? "bg-red-100 text-red-700" :
                            selectedInquiry.status === "replied" ? "bg-green-100 text-green-700" :
                            selectedInquiry.status === "archived" ? "bg-gray-100 text-gray-500" :
                            "bg-blue-100 text-blue-700"
                          }`}>{selectedInquiry.status}</span>
                        </div>

                        {/* Message body */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mb-6">
                          {selectedInquiry.message}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`mailto:${selectedInquiry.email}?subject=Re: ${encodeURIComponent(selectedInquiry.subject)}`}
                            onClick={() => handleMarkInquiry(selectedInquiry.id, "replied")}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#4B0082] text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-purple-900 transition-colors"
                          >
                            <Reply size={12} /> Reply via Email
                          </a>
                          <button
                            onClick={() => handleMarkInquiry(selectedInquiry.id, "replied")}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-green-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle2 size={12} /> Mark Replied
                          </button>
                          <button
                            onClick={() => handleMarkInquiry(selectedInquiry.id, "archived")}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gray-200 text-gray-700 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            <Archive size={12} /> Archive
                          </button>
                          <button
                            onClick={() => handleDeleteInquiry(selectedInquiry.id)}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-red-100 text-red-700 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-16">
                        <Inbox size={40} className="opacity-30" />
                        <p className="text-xs uppercase tracking-widest font-black">Select an inquiry to read</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Summary footer */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-[9px] text-gray-400 uppercase tracking-widest flex justify-between">
                  <span>{inquiriesTotal} total inquiries</span>
                  <span>{inquiriesUnread} unread</span>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 bg-gray-900 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <History size={18} className="text-[#FFD700]" />
                    <h3 className="font-black text-xs uppercase tracking-[0.25em]">
                      Institutional Dispatch Ledger
                    </h3>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder="Search dispatch records..."
                      className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 text-[10px] font-bold uppercase outline-none focus:border-[#FFD700] text-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                        <th className="px-6 py-5">Node ID</th>
                        <th className="px-6 py-5">Recipient Identity</th>
                        <th className="px-6 py-5 text-center">Gateway</th>
                        <th className="px-6 py-5">Broadcast Content</th>
                        <th className="px-6 py-5 text-center">Status</th>
                        <th className="px-6 py-5 text-right">Commit Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {(history || [])
                        .filter(
                          (h) =>
                            h.recipient
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()) ||
                            h.text
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()),
                        )
                        .map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group"
                          >
                            <td className="px-6 py-5 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">
                              {log.id}
                            </td>
                            <td className="px-6 py-5">
                              <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                                {log.recipient}
                              </p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                                {log.date}
                              </p>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-none text-[8px] font-black uppercase tracking-widest border ${log.type === "SMS" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-purple-50 text-[#4B0082] border-purple-100"}`}
                              >
                                {log.type}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="max-w-[350px]">
                                {log.subject && (
                                  <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase truncate mb-1 flex items-center gap-2">
                                    <Mail
                                      size={10}
                                      className="text-[#4B0082]"
                                    />{" "}
                                    {log.subject}
                                  </p>
                                )}
                                <div className="text-[10px] text-gray-600 dark:text-gray-400 font-medium line-clamp-4 leading-relaxed italic">
                                  {renderMessageText(log.text)}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <div className="flex justify-center items-center gap-1.5">
                                {log.status === "Delivered" ? (
                                  <CheckCircle
                                    size={14}
                                    className="text-emerald-500"
                                  />
                                ) : log.status === "Failed" ? (
                                  <AlertCircle
                                    size={14}
                                    className="text-red-500"
                                  />
                                ) : (
                                  <Clock size={14} className="text-amber-500" />
                                )}
                                <span
                                  className={`text-[9px] font-black uppercase tracking-widest ${log.status === "Delivered" ? "text-emerald-600" : log.status === "Failed" ? "text-red-600" : "text-amber-600"}`}
                                >
                                  {log.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-2 text-gray-300 hover:text-blue-500"
                                  title="View Protocol Record"
                                >
                                  <FileText size={16} />
                                </button>
                                <button
                                  className="p-2 text-gray-300 hover:text-red-500"
                                  title="Delete Archive"
                                  onClick={() => handleDeleteRecord(log.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {history.length === 0 && (
                    <div className="py-20 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm italic">
                      {isLoadingHistory
                        ? "Loading dispatch ledger…"
                        : "Zero (0) dispatch records identified in comms ledger"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {showToast && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[150] animate-fade-in">
            <div className="bg-gray-900 text-[#FFD700] px-10 py-5 rounded-none shadow-2xl flex items-center gap-4 border-2 border-[#FFD700] backdrop-blur-xl">
              <Check size={24} className="animate-pulse" />
              <span className="font-black text-xs uppercase tracking-[0.15em]">
                {toastMsg}
              </span>
            </div>
          </div>
        )}

        {/* Institutional Security Bar */}
        <div className="bg-gray-900 border-l-4 border-[#FFD700] p-8 text-white flex items-start gap-8 shadow-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <div className="p-3 bg-[#FFD700] text-black shadow-lg relative z-10">
            <ShieldAlert size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700]">
              Communication Privacy & Ethics Disclosure
            </p>
            <p className="text-xs text-gray-300 mt-2 leading-relaxed max-w-4xl font-medium">
              Institutional broadcasts are subject to the BMI University
              Information Security Mandate. All transmissions are digitally
              watermarked and stored for 7 academic years. Visual formatting is
              enforced for professional legibility.
            </p>
            <button className="mt-4 text-[9px] font-black uppercase tracking-widest text-[#FFD700] hover:underline flex items-center gap-2">
              Review Ethics Policy <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Communications;









