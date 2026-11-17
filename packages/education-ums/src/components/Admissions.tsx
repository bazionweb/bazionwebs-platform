import { useState, useEffect } from "react";
import {
  Search,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  UserPlus,
  Download,
  Filter,
  CheckSquare,
  Square,
  FileCheck,
  GraduationCap,
  Gavel,
  DollarSign,
  Trash2
} from '../shims/lucide-react';
import { admissionsService, Application, StatusLogEntry } from "../services/admissionsService";
import { useDialogStore } from "../stores/dialogStore";
import { PROGRAMS as FALLBACK_PROGRAMS, API_WORKER_URL } from '../services/contracts-bridge';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;
const API_BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  submitted: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  under_review: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  waitlisted: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
};

const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["submitted", "under_review"],
  submitted: ["under_review", "rejected"],
  // NOTE: "accepted" is intentionally absent. Offers are issued ONLY via the
  // formal decision flow (POST /api/admissions/decide → OFFER_EXTENDED) and
  // provisioning runs only after the applicant accepts. See handleFormalDecision.
  under_review: ["rejected", "waitlisted"],
  accepted: [],
  rejected: ["under_review"],
  waitlisted: ["rejected", "under_review"],
};

export default function Admissions() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [appDetails, setAppDetails] = useState<Application | null>(null);
  const [logs, setLogs] = useState<StatusLogEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Formal Decision Modal state
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<Application | null>(null);
  const [decisionForm, setDecisionForm] = useState({
    decision: 'admit' as 'admit' | 'conditional' | 'waitlist' | 'deny',
    conditions: '' as string,
    offer_expires_in_days: 14,
    deposit_required: false,
    deposit_amount: 0,
    reviewer_notes: '',
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Selection & Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── DB-as-SSOT: hydrate program picker from the canonical /public/programs endpoint.
  //    Fallback ensures the component renders immediately without a live API connection.
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/programs`, { cache: 'force-cache' });
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data)) return;
        if (cancelled) return;
        setPrograms(body.data.map((p: any) => ({
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // New Applicant Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFormData, setNewFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    program: programs[0]?.label || "BA in Biblical Studies",
    degree_level: programs[0]?.level || "undergraduate",
    high_school: "",
    gpa: "3.8",
    address: "",
    nationality: "United Kingdom",
  });

  // Document Verification Checklist State for active applicant drawer
  const [docChecklist, setDocChecklist] = useState<Record<string, "verified" | "pending" | "flagged">>({
    transcript: "verified",
    id_copy: "verified",
    recommendation: "pending",
    statement: "verified",
  });

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await admissionsService.listApplications();
      setApps(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectApp = async (app: Application) => {
    setSelectedApp(app);
    setAppDetails(null);
    setLogs([]);
    setNotes("");
    setDocChecklist({
      transcript: "pending",
      id_copy: "pending",
      recommendation: "pending",
      statement: "pending",
    });
    try {
      const [details, auditLogs] = await Promise.all([
        admissionsService.getApplication(app.id),
        admissionsService.getStatusLogs(app.id).catch(() => [])
      ]);
      setAppDetails(details);
      setLogs(auditLogs);

      const docs = details?.documents || [];
      const hasDoc = (types: string[]) => docs.some(d => types.includes(d.doc_type?.toLowerCase()));

      setDocChecklist({
        transcript: hasDoc(["transcript", "academic_transcript", "official_transcript"]) ? "verified" : "pending",
        id_copy: hasDoc(["id_document", "id_copy", "passport", "government_id"]) ? "verified" : "pending",
        recommendation: hasDoc(["recommendation", "recommendation_letter"]) ? "verified" : "pending",
        statement: hasDoc(["statement", "personal_statement", "statement_of_intent"]) ? "verified" : "pending",
      });
    } catch {
      setError("Failed to load full application details");
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedApp) return;
    // Guard: legacy direct-accept is disabled — route staff to formal decisions.
    if (newStatus === 'accepted') {
      setError('Direct approval is disabled. Use "Issue Formal Admissions Decision" (admit) to extend an offer — the student must accept before any provisioning.');
      return;
    }
    setUpdating(true);
    try {
      await admissionsService.updateStatus(selectedApp.id, newStatus, notes);
      setSuccess(`Application for ${selectedApp.first_name} ${selectedApp.last_name} updated to ${newStatus.replace("_", " ")}`);
      setSelectedApp(null);
      loadApplications();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const openFormalDecisionModal = (app: Application) => {
    setDecisionTarget(app);
    setDecisionForm({
      decision: 'admit',
      conditions: '',
      offer_expires_in_days: 14,
      deposit_required: false,
      deposit_amount: 0,
      reviewer_notes: '',
    });
    setShowDecisionModal(true);
  };

  const handleFormalDecision = async () => {
    if (!decisionTarget) return;
    setUpdating(true);
    try {
      const conditionsArray = decisionForm.conditions.trim()
        ? decisionForm.conditions.split('\n').map(c => c.trim()).filter(Boolean)
        : undefined;

      await admissionsService.recordFormalDecision({
        application_id: decisionTarget.id,
        decision: decisionForm.decision,
        conditions: conditionsArray,
        offer_expires_in_days: decisionForm.offer_expires_in_days || undefined,
        deposit_required: decisionForm.deposit_required || undefined,
        deposit_amount: decisionForm.deposit_required ? decisionForm.deposit_amount : undefined,
        reviewer_notes: decisionForm.reviewer_notes || undefined,
      });

      const decisionLabel = decisionForm.decision === 'admit' ? 'Admitted'
        : decisionForm.decision === 'conditional' ? 'Conditionally Admitted'
        : decisionForm.decision === 'waitlist' ? 'Waitlisted'
        : 'Denied';
      setSuccess(`Formal decision recorded: ${decisionTarget.first_name} ${decisionTarget.last_name} — ${decisionLabel}`);
      setShowDecisionModal(false);
      setDecisionTarget(null);
      setSelectedApp(null);
      loadApplications();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record formal admissions decision');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormData.first_name || !newFormData.last_name || !newFormData.email) {
      setError("Please fill in applicant name and email.");
      return;
    }
    setUpdating(true);
    try {
      await admissionsService.createApplication({
        first_name: newFormData.first_name,
        last_name: newFormData.last_name,
        email: newFormData.email,
        phone: newFormData.phone,
        program: newFormData.program,
        degree_level: newFormData.degree_level,
        high_school: newFormData.high_school,
        gpa: parseFloat(newFormData.gpa) || 3.5,
        address: newFormData.address,
        nationality: newFormData.nationality,
      });
      setSuccess(`Applicant ${newFormData.first_name} ${newFormData.last_name} created successfully!`);
      setShowAddModal(false);
      setNewFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        program: programs[0]?.label || "BA in Biblical Studies",
        degree_level: programs[0]?.level || "undergraduate",
        high_school: "",
        gpa: "3.8",
        address: "",
        nationality: "United Kingdom",
      });
      loadApplications();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create new applicant");
    } finally {
      setUpdating(false);
    }
  };

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApps.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkUpdate = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    // Bulk approve would bypass the offer→accept→provision lifecycle — forbid it.
    if (newStatus === 'accepted') {
      setError('Bulk approve is disabled. Issue formal decisions per application so offers, expiry and deposits are tracked.');
      return;
    }
    setUpdating(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => admissionsService.updateStatus(id, newStatus, "Bulk update action executed."))
      );
      setSuccess(`Updated ${selectedIds.size} applications to ${newStatus.replace("_", " ")}`);
      setSelectedIds(new Set());
      loadApplications();
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Failed to execute bulk update");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteApplication = async (id: string, name: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Permanent Application Deletion",
      message: `Are you sure you want to permanently delete the application for ${name}?`,
      detail: "This irreversible operation will permanently purge the candidate's admission file, uploaded academic transcripts, recommendation references, and decision history from the Bethel Ministries International University institutional registry.",
      confirmText: "Permanently Delete",
      cancelText: "Retain Application",
      variant: "danger",
      badgeText: "Admissions Protocol",
    });
    if (!confirmed) return;

    setUpdating(true);
    setError("");
    try {
      await admissionsService.deleteApplication(id);
      setApps(prev => prev.filter(a => a.id !== id));
      if (selectedApp?.id === id) {
        setSelectedApp(null);
        setAppDetails(null);
      }
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSuccess(`Application for ${name} deleted successfully.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete application.");
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await useDialogStore.getState().confirm({
      title: `Bulk Deletion (${selectedIds.size} Applications)`,
      message: `Are you sure you want to permanently purge ${selectedIds.size} selected candidate application dossiers?`,
      detail: "All associated candidate files, document verifications, committee notes, and decision logs will be permanently expunged from the institutional database. This action cannot be undone.",
      confirmText: `Delete ${selectedIds.size} Applications`,
      cancelText: "Cancel",
      variant: "danger",
      badgeText: "Bulk Purge Protocol",
    });
    if (!confirmed) return;

    setUpdating(true);
    setError("");
    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(idsToDelete.map(id => admissionsService.deleteApplication(id)));
      setApps(prev => prev.filter(a => !selectedIds.has(a.id)));
      if (selectedApp && selectedIds.has(selectedApp.id)) {
        setSelectedApp(null);
        setAppDetails(null);
      }
      setSuccess(`Successfully deleted ${selectedIds.size} applications.`);
      setSelectedIds(new Set());
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete selected applications.");
    } finally {
      setUpdating(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "First Name", "Last Name", "Email", "Phone", "Program", "Level", "Status", "GPA", "Submitted At"];
    const rows = filteredApps.map(a => [
      a.id,
      `"${a.first_name}"`,
      `"${a.last_name}"`,
      `"${a.email}"`,
      `"${a.phone || ''}"`,
      `"${a.program}"`,
      a.degree_level,
      a.status,
      a.gpa || '',
      a.submitted_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admissions_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats
  const stats = {
    total: apps.length,
    submitted: apps.filter(a => a.status === "submitted").length,
    under_review: apps.filter(a => a.status === "under_review").length,
    accepted: apps.filter(a => a.status === "accepted").length,
    waitlisted: apps.filter(a => a.status === "waitlisted").length,
  };

  // Local filter
  const filteredApps = apps.filter(a => {
    const term = search.toLowerCase();
    const matchesSearch =
      a.first_name.toLowerCase().includes(term) ||
      a.last_name.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      a.program.toLowerCase().includes(term);

    const matchesDegree = degreeFilter === "all" || a.degree_level === degreeFilter;
    const matchesStatus = !filter || a.status === filter;
    return matchesSearch && matchesDegree && matchesStatus;
  });

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full relative font-sans text-gray-900 dark:text-gray-100">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg shadow-sm">
              <ClipboardList size={22} />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-[#2E004F] dark:text-white uppercase">
              Admissions Lifecycle & Application Management
            </h1>
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
            Institutional applicant review portal • Verify credentials, record review logs, and issue decision letters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#2E004F] bg-[#FFD700] hover:bg-yellow-400 rounded-lg transition-all shadow-md active:scale-95"
          >
            <UserPlus size={16} /> New Applicant
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 p-3.5 rounded-xl mb-4 border border-rose-200 dark:border-rose-800 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
          <button onClick={() => setError("")} className="hover:opacity-75 font-bold">✕</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 p-3.5 rounded-xl mb-4 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle size={18} /> {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-t-4 border-t-blue-600">
          <div className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">Total Applications</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-t-4 border-t-sky-500">
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">{stats.submitted}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">Awaiting Review</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-t-4 border-t-amber-500">
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.under_review}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">Under Review</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-t-4 border-t-purple-500">
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.waitlisted}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">Waitlisted</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-t-4 border-t-emerald-500 col-span-2 md:col-span-1">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.accepted}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">Accepted</div>
        </div>
      </div>

      {/* Search & Toolbar Filters */}
      <div className="bg-white dark:bg-[#1a1a1a] p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, email, or program..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD700] dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
            <Filter size={14} />
            <select
              value={degreeFilter}
              onChange={(e) => setDegreeFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 text-xs font-semibold dark:text-white focus:outline-none"
            >
              <option value="all">All Degree Levels</option>
              <option value="undergraduate">Undergraduate</option>
              <option value="graduate">Graduate</option>
              <option value="doctorate">Doctorate</option>
              <option value="diploma">Diploma</option>
              <option value="certificate">Certificate</option>
            </select>
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex gap-1 flex-wrap bg-gray-100 dark:bg-gray-800/80 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold uppercase">
          {["", "submitted", "under_review", "accepted", "waitlisted", "rejected"].map(s => (
            <button
              key={s || "all"}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-md transition-all ${filter === s
                ? "bg-[#2E004F] text-[#FFD700] shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700"
                }`}
            >
              {s ? s.replace("_", " ") : "ALL"}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Toolbar if selection exists */}
      {selectedIds.size > 0 && (
        <div className="bg-[#2E004F] text-white p-3 rounded-xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-semibold shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="bg-[#FFD700] text-[#2E004F] font-black px-2 py-0.5 rounded text-[10px]">
              {selectedIds.size} Selected
            </span>
            <span>Batch Operations Available</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            <button
              onClick={() => handleBulkUpdate("under_review")}
              disabled={updating}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded uppercase text-[10px] tracking-wider transition-all min-h-[36px]"
            >
              Move to Review
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={updating}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded uppercase text-[10px] tracking-wider transition-all min-h-[36px]"
            >
              <Trash2 size={12} /> Bulk Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 text-purple-200 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col min-h-[350px]">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-[#FFD700] rounded-full animate-spin"></div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-gray-500 p-8">
            <ClipboardList size={48} className="mb-3 opacity-20 text-[#2E004F]" />
            <p className="font-bold text-sm">No applications found matching criteria.</p>
            <p className="text-xs text-gray-400 mt-1">Try resetting search filters or register a new applicant.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-700 dark:text-gray-400 sticky top-0 uppercase font-black text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800 z-10">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {selectedIds.size === filteredApps.length && filteredApps.length > 0 ? (
                        <CheckSquare size={16} className="text-[#FFD700]" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="px-5 py-3.5">Applicant</th>
                  <th className="px-5 py-3.5">Program & Level</th>
                  <th className="px-4 py-3.5 text-center">Academic GPA</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {filteredApps.map(app => {
                  const isChecked = selectedIds.has(app.id);
                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-purple-50/30 dark:hover:bg-gray-800/40 transition-colors ${isChecked ? "bg-purple-50/50 dark:bg-purple-950/20" : ""
                        }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => toggleSelect(app.id)} className="text-gray-400 hover:text-gray-600">
                          {isChecked ? <CheckSquare size={16} className="text-[#2E004F] dark:text-[#FFD700]" /> : <Square size={16} />}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900 dark:text-white text-sm">
                          {app.first_name} {app.last_name}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{app.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-800 dark:text-gray-200">{app.program}</div>
                        <div className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 tracking-wider">
                          {app.degree_level}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-gray-900 dark:text-white">
                        {app.gpa ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono text-xs">
                            {app.gpa.toFixed(2)}
                          </span>
                        ) : (
                          " N/A"
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${STATUS_COLORS[app.status]}`}>
                          {app.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">
                        {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleSelectApp(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#2E004F] bg-purple-50 hover:bg-purple-100 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 rounded-lg transition-colors"
                          >
                            <Eye size={14} /> Review
                          </button>
                          <button
                            onClick={() => handleDeleteApplication(app.id, `${app.first_name} ${app.last_name}`)}
                            disabled={updating}
                            title="Delete Application"
                            className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-800/60 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Applicant Detail & Review Drawer */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white dark:bg-[#111] w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border-l border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${STATUS_COLORS[selectedApp.status]}`}>
                    {selectedApp.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">ID: {selectedApp.id}</span>
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1">
                  {selectedApp.first_name} {selectedApp.last_name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteApplication(selectedApp.id, `${selectedApp.first_name} ${selectedApp.last_name}`)}
                  disabled={updating}
                  title="Delete Application"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 dark:border-rose-900/40 rounded-lg transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <XCircle size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Program Header Box */}
              <div className="bg-gradient-to-r from-[#2E004F] to-purple-900 text-white p-4 rounded-xl shadow-md flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-[#FFD700] tracking-widest">Target Degree Program</div>
                  <div className="text-base font-black">{selectedApp.program}</div>
                  <div className="text-xs text-purple-200 mt-0.5 capitalize">{selectedApp.degree_level} Level</div>
                </div>
                <GraduationCap size={36} className="text-[#FFD700] opacity-80" />
              </div>

              {/* Applicant Profile Grid */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <h3 className="text-xs font-black text-[#2E004F] dark:text-purple-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 pb-2">
                  Personal & Academic Profile
                </h3>

                {appDetails ? (
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-400 block font-semibold text-[10px] uppercase">Email Address</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{appDetails.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-semibold text-[10px] uppercase">Contact Phone</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{appDetails.phone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-semibold text-[10px] uppercase">Nationality</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{appDetails.nationality || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-semibold text-[10px] uppercase">Date of Birth</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {appDetails.date_of_birth ? new Date(appDetails.date_of_birth).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 block font-semibold text-[10px] uppercase">Residential Address</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{appDetails.address || "—"}</span>
                    </div>
                    <div className="col-span-2 border-t border-gray-200 dark:border-gray-800 pt-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <span className="text-gray-400 block font-semibold text-[10px] uppercase">Previous School</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{appDetails.high_school || "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-semibold text-[10px] uppercase">Graduation Year</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{appDetails.graduation_year || "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-semibold text-[10px] uppercase">GPA Score</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">{appDetails.gpa || "—"} / 4.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse space-y-2 py-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                  </div>
                )}
              </div>

              {/* Document Verification Checklist */}
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
                <h3 className="text-xs font-black text-[#2E004F] dark:text-purple-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><FileCheck size={16} /> Submitted Documentation Checklist</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${(appDetails?.documents?.length || 0) > 0
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                    : "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                    }`}>
                    {appDetails?.documents?.length || 0} Document{(appDetails?.documents?.length === 1) ? "" : "s"} On File
                  </span>
                </h3>

                <div className="space-y-2 text-xs">
                  {[
                    { key: "transcript", label: "Official Academic Transcript / Records", desc: "PDF Transcript verified by registrar", matchTypes: ["transcript", "academic_transcript", "official_transcript"] },
                    { key: "id_copy", label: "Government Issued Photo ID / Passport", desc: "Valid identity documentation", matchTypes: ["id_document", "id_copy", "passport", "government_id"] },
                    { key: "recommendation", label: "Academic Recommendation Letter", desc: "Signed by faculty referee", matchTypes: ["recommendation", "recommendation_letter"] },
                    { key: "statement", label: "Personal Statement of Intent", desc: "500-word statement", matchTypes: ["statement", "personal_statement", "statement_of_intent"] }
                  ].map(doc => {
                    const uploaded = appDetails?.documents?.find(d => doc.matchTypes.includes(d.doc_type?.toLowerCase()));
                    const status = docChecklist[doc.key] || (uploaded ? "verified" : "pending");
                    return (
                      <div key={doc.key} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                            {doc.label}
                            {uploaded && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                Uploaded ({uploaded.file_name})
                              </span>
                            )}
                            {!uploaded && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                                Not Uploaded
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400">{uploaded ? `File: ${uploaded.file_name} • ${doc.desc}` : doc.desc}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDocChecklist(prev => ({ ...prev, [doc.key]: "verified" }))}
                            className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${status === "verified"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                          >
                            Verified
                          </button>
                          <button
                            onClick={() => setDocChecklist(prev => ({ ...prev, [doc.key]: "flagged" }))}
                            className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${status === "flagged"
                              ? "bg-rose-600 text-white shadow-xs"
                              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                          >
                            Flag
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Audit Logs Timeline */}
              <div>
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider pb-2 border-b border-gray-200 dark:border-gray-800 mb-3 flex items-center justify-between">
                  <span>Audit Trail & Decision Timeline</span>
                  <Clock size={14} className="text-gray-400" />
                </h3>
                {logs.length > 0 ? (
                  <div className="space-y-3">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <div className="mt-0.5 flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#2E004F] dark:bg-[#FFD700]"></div>
                          {i < logs.length - 1 && <div className="w-px h-full bg-gray-200 dark:bg-gray-800 my-1"></div>}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="text-gray-900 dark:text-gray-200 font-semibold">
                            Status changed to <span className="font-bold text-[#2E004F] dark:text-[#FFD700] uppercase">{log.new_status.replace('_', ' ')}</span> by {log.changed_by_name}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(log.changed_at).toLocaleString()}
                          </div>
                          {log.notes && (
                            <div className="mt-1.5 text-xs bg-gray-50 dark:bg-gray-800/60 p-2 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 italic">
                              "{log.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">No timeline events recorded yet.</div>
                )}
              </div>
            </div>

            {/* Decision Actions Footer */}
            <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              {NEXT_STATUSES[selectedApp.status]?.length > 0 ? (
                <>
                  <div className="mb-3">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Admissions Officer Review Notes
                    </label>
                    <textarea
                      className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#FFD700] outline-none dark:text-white font-medium"
                      rows={2}
                      placeholder="Enter decision rationale, missing documents required, or scholarship recommendation notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="flex gap-2">
                    {NEXT_STATUSES[selectedApp.status].map(status => (
                      <button
                        key={status}
                        disabled={updating}
                        onClick={() => handleUpdateStatus(status)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95
                          ${status === 'rejected' ? 'bg-rose-600 hover:bg-rose-700' :
                              status === 'waitlisted' ? 'bg-purple-700 hover:bg-purple-800' :
                                'bg-[#2E004F] hover:bg-purple-950'}`}
                      >
                        {updating ? 'Processing...' : status === 'rejected' ? 'Decline Application' : 'Mark ' + status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  {/* Formal Decision — the ONLY path to an offer (admit/conditional → OFFER_EXTENDED/CONDITIONAL) */}
                  {(selectedApp.status === 'under_review' || selectedApp.status === 'submitted' || selectedApp.status === 'waitlisted') && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                      <button
                        onClick={() => openFormalDecisionModal(selectedApp)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#2E004F] via-purple-800 to-indigo-900 hover:from-purple-950 hover:to-indigo-950 rounded-lg shadow-lg transition-all active:scale-95"
                      >
                        <Gavel size={16} className="text-[#FFD700]" />
                        Issue Formal Admissions Decision
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1 text-center">Records in the enrollment state machine with conditions, deposit, and offer expiry</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-xs text-gray-500 p-3 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  This application is in a final decision state (<span className="font-bold uppercase text-gray-700 dark:text-gray-300">{selectedApp.status}</span>).
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Applicant Registration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg">
                  <UserPlus size={18} />
                </span>
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Register New Applicant
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateApplicant} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFormData.first_name}
                    onChange={(e) => setNewFormData({ ...newFormData, first_name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="e.g. Eleanor"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newFormData.last_name}
                    onChange={(e) => setNewFormData({ ...newFormData, last_name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="e.g. Vance"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newFormData.email}
                    onChange={(e) => setNewFormData({ ...newFormData, email: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="eleanor@example.com"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newFormData.phone}
                    onChange={(e) => setNewFormData({ ...newFormData, phone: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="+44 7700 900888"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Target Program</label>
                  <select
                    value={newFormData.program}
                    onChange={(e) => {
                      const selectedProg = programs.find(p => p.label === e.target.value);
                      setNewFormData({
                        ...newFormData,
                        program: e.target.value,
                        degree_level: selectedProg?.level || newFormData.degree_level
                      });
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  >
                    {programs.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Degree Level</label>
                  <select
                    value={newFormData.degree_level}
                    onChange={(e) => setNewFormData({ ...newFormData, degree_level: e.target.value as 'undergraduate' | 'graduate' | 'doctorate' | 'certificate' | 'diploma' })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  >
                    <option value="undergraduate">Undergraduate</option>
                    <option value="graduate">Graduate</option>
                    <option value="doctorate">Doctorate</option>
                    <option value="diploma">Diploma</option>
                    <option value="certificate">Certificate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">High School / Academy</label>
                  <input
                    type="text"
                    value={newFormData.high_school}
                    onChange={(e) => setNewFormData({ ...newFormData, high_school: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                    placeholder="Central High School"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">GPA / Score</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4.0"
                    value={newFormData.gpa}
                    onChange={(e) => setNewFormData({ ...newFormData, gpa: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 font-black uppercase text-xs tracking-wider bg-[#2E004F] text-[#FFD700] hover:bg-purple-950 rounded-lg shadow-md transition-all"
                >
                  {updating ? "Saving..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───── Formal Admissions Decision Modal ───── */}
      {showDecisionModal && decisionTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full border border-gray-200 dark:border-gray-800 animate-scale-up overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-[#2E004F] to-purple-900">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-[#FFD700]/20 rounded-lg">
                    <Gavel size={20} className="text-[#FFD700]" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Formal Admissions Decision</h3>
                    <p className="text-[10px] text-purple-200 font-medium mt-0.5">
                      {decisionTarget.first_name} {decisionTarget.last_name} — {decisionTarget.program}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowDecisionModal(false); setDecisionTarget(null); }}
                  className="p-1.5 text-purple-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Decision Type */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Committee Decision
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'admit', label: 'Admit', color: 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700', icon: '✓' },
                    { value: 'conditional', label: 'Conditional', color: 'bg-amber-600 hover:bg-amber-700 border-amber-700', icon: '⚠' },
                    { value: 'waitlist', label: 'Waitlist', color: 'bg-purple-600 hover:bg-purple-700 border-purple-700', icon: '⏳' },
                    { value: 'deny', label: 'Deny', color: 'bg-rose-600 hover:bg-rose-700 border-rose-700', icon: '✕' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDecisionForm(f => ({ ...f, decision: opt.value }))}
                      className={`py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider border-2 transition-all ${
                        decisionForm.decision === opt.value
                          ? `${opt.color} text-white shadow-md scale-[1.02]`
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Admission Conditions */}
              {decisionForm.decision === 'conditional' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    <AlertCircle size={12} className="inline mr-1 text-amber-500" />
                    Admission Conditions (one per line)
                  </label>
                  <textarea
                    value={decisionForm.conditions}
                    onChange={(e) => setDecisionForm(f => ({ ...f, conditions: e.target.value }))}
                    rows={3}
                    placeholder={"Submit official WAEC results by enrollment deadline\nMaintain minimum 2.5 GPA during first semester\nComplete English proficiency verification"}
                    className="w-full bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-amber-400 outline-none dark:text-white font-medium"
                  />
                </div>
              )}

              {/* Offer Expiry Window */}
              {(decisionForm.decision === 'admit' || decisionForm.decision === 'conditional') && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    <Clock size={12} className="inline mr-1" /> Offer Acceptance Window
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={decisionForm.offer_expires_in_days}
                      onChange={(e) => setDecisionForm(f => ({ ...f, offer_expires_in_days: parseInt(e.target.value) || 14 }))}
                      className="w-20 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs font-bold text-center focus:ring-2 focus:ring-[#FFD700] outline-none dark:text-white"
                    />
                    <span className="text-xs text-gray-500 font-semibold">days from today</span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      Expires: {new Date(Date.now() + (decisionForm.offer_expires_in_days || 14) * 86400000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Enrollment Deposit */}
              {(decisionForm.decision === 'admit' || decisionForm.decision === 'conditional') && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <DollarSign size={12} /> Enrollment Deposit Required
                    </label>
                    <button
                      type="button"
                      onClick={() => setDecisionForm(f => ({ ...f, deposit_required: !f.deposit_required }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        decisionForm.deposit_required ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        decisionForm.deposit_required ? 'translate-x-5' : ''
                      }`} />
                    </button>
                  </div>
                  {decisionForm.deposit_required && (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <span className="text-sm font-bold text-gray-500">$</span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={decisionForm.deposit_amount}
                        onChange={(e) => setDecisionForm(f => ({ ...f, deposit_amount: parseFloat(e.target.value) || 0 }))}
                        className="w-32 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-[#FFD700] outline-none dark:text-white"
                        placeholder="500.00"
                      />
                      <span className="text-[10px] text-gray-400">USD — non-refundable enrollment deposit</span>
                    </div>
                  )}
                </div>
              )}

              {/* Committee Notes */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Committee Review Notes
                </label>
                <textarea
                  value={decisionForm.reviewer_notes}
                  onChange={(e) => setDecisionForm(f => ({ ...f, reviewer_notes: e.target.value }))}
                  rows={2}
                  placeholder="Decision rationale, scholarship recommendations, or special notes for the registrar..."
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#FFD700] outline-none dark:text-white font-medium"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 flex justify-between items-center">
              <button
                type="button"
                onClick={() => { setShowDecisionModal(false); setDecisionTarget(null); }}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={updating}
                onClick={handleFormalDecision}
                className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white rounded-lg shadow-lg transition-all active:scale-95 ${
                  decisionForm.decision === 'admit' ? 'bg-emerald-600 hover:bg-emerald-700'
                  : decisionForm.decision === 'conditional' ? 'bg-amber-600 hover:bg-amber-700'
                  : decisionForm.decision === 'waitlist' ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Gavel size={14} />
                {updating ? 'Recording...' : `Record ${decisionForm.decision === 'admit' ? 'Admission' : decisionForm.decision === 'conditional' ? 'Conditional Admission' : decisionForm.decision === 'waitlist' ? 'Waitlist' : 'Denial'} Decision`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
