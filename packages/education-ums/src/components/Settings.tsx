import React, { useState, useEffect } from "react";
import {
  Save,
  Bell,
  Shield,
  Globe,
  Moon,
  Sun,
  Smartphone,
  Mail,
  Upload,
  ImageIcon,
  Check,
  Database,
  UserPlus,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from '../shims/lucide-react';
import { authFetch } from "../services/authService";
import { API_URL } from "../services/config";
import { useUIStore } from "../stores/uiStore";
import { useDialogStore } from "../stores/dialogStore";

interface InstitutionProfile {
  name: string;
  legal_name: string;
  admissions_email: string;
  registrar_email: string;
  finance_email: string;
  admin_email: string;
  phones: string[];
  address: string;
  website_url: string;
}

interface RegulatoryEvidence {
  id: string;
  title: string;
  evidence_type: string;
  authority: string;
  reference_number: string | null;
  status: "received" | "pending_review" | "verified" | "expired" | "superseded" | "withdrawn" | "rejected";
  issued_on: string | null;
  expires_on: string | null;
  evidence_url: string | null;
  notes: string;
  created_at: string;
}

async function requestEducationData<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => ({})) as { success?: boolean; data?: T; error?: string; message?: string };
  if (!response.ok || !body.success) throw new Error(body.message ?? body.error ?? `Request failed (${response.status}).`);
  return body.data as T;
}

const Settings: React.FC = () => {
  const currentLogo = useUIStore((s) => s.logo);
  const onUpdateLogo = useUIStore((s) => s.setLogo);
  const currentTheme = useUIStore((s) => s.theme);
  const onUpdateTheme = useUIStore((s) => s.setTheme);
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  const [_isFetching, setIsFetching] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState(
    "Settings saved successfully",
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(currentLogo);
  const [institutionProfile, setInstitutionProfile] = useState<InstitutionProfile | null>(null);
  const [regulatoryEvidence, setRegulatoryEvidence] = useState<RegulatoryEvidence[]>([]);
  const [institutionError, setInstitutionError] = useState("");
  const [institutionLoading, setInstitutionLoading] = useState(false);
  const [institutionSaving, setInstitutionSaving] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState({
    title: "", evidence_type: "", authority: "", reference_number: "", status: "received" as RegulatoryEvidence["status"],
    issued_on: "", expires_on: "", evidence_url: "", notes: "",
  });

  const loadInstitutionRecords = async () => {
    setInstitutionLoading(true);
    setInstitutionError("");
    try {
      const [profile, evidence] = await Promise.all([
        requestEducationData<InstitutionProfile>("/education/institution"),
        requestEducationData<RegulatoryEvidence[]>("/education/regulatory-evidence"),
      ]);
      setInstitutionProfile(profile);
      setRegulatoryEvidence(evidence);
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Could not load institution records.");
    } finally {
      setInstitutionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "institution") void loadInstitutionRecords();
  }, [activeTab]);

  const saveInstitutionProfile = async () => {
    if (!institutionProfile) return;
    setInstitutionSaving(true);
    setInstitutionError("");
    try {
      const saved = await requestEducationData<InstitutionProfile>("/education/institution", {
        method: "PATCH", body: JSON.stringify(institutionProfile),
      });
      setInstitutionProfile(saved);
      setToastMessage("Institution contacts saved");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Could not save institution contacts.");
    } finally {
      setInstitutionSaving(false);
    }
  };

  const addRegulatoryEvidence = async () => {
    setEvidenceSaving(true);
    setInstitutionError("");
    try {
      await requestEducationData<RegulatoryEvidence>("/education/regulatory-evidence", {
        method: "POST", body: JSON.stringify({
          ...evidenceDraft,
          reference_number: evidenceDraft.reference_number || null,
          issued_on: evidenceDraft.issued_on || null,
          expires_on: evidenceDraft.expires_on || null,
          evidence_url: evidenceDraft.evidence_url || null,
        }),
      });
      setEvidenceDraft({ title: "", evidence_type: "", authority: "", reference_number: "", status: "received", issued_on: "", expires_on: "", evidence_url: "", notes: "" });
      await loadInstitutionRecords();
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Could not save the evidence record.");
    } finally {
      setEvidenceSaving(false);
    }
  };

  const updateEvidenceStatus = async (id: string, status: RegulatoryEvidence["status"]) => {
    setInstitutionError("");
    try {
      await requestEducationData<RegulatoryEvidence>(`/education/regulatory-evidence/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      await loadInstitutionRecords();
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Could not update the evidence status.");
    }
  };

  // Password Management State
  const [passwordData, setPasswordData] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });

  // Sync logo preview if prop changes
  useEffect(() => {
    setLogoPreview(currentLogo);
  }, [currentLogo]);

  // General Settings State - initialize empty, hydrate from API then localStorage
  const [general, setGeneral] = useState<Record<string, any>>({});

  // Sync local theme state with prop to ensure form consistency
  useEffect(() => {
    setGeneral((prev) => ({ ...prev, theme: currentTheme }));
  }, [currentTheme]);

  // Notifications State - initialize empty
  const [notifications, setNotifications] = useState<Record<string, any>>({});

  // Security State - initialize empty
  const [security, setSecurity] = useState<Record<string, any>>({});

  // Fetch settings on mount with dynamic import pattern (like Dashboard.tsx)
  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);

    const applyOfflineFallback = () => {
      if (cancelled) return;
      try {
        const savedGeneral = localStorage.getItem("bmi_settings_general");
        if (savedGeneral) setGeneral(JSON.parse(savedGeneral));

        const savedNotif = localStorage.getItem("bmi_settings_notifications");
        if (savedNotif) setNotifications(JSON.parse(savedNotif));

        const savedSec = localStorage.getItem("bmi_settings_security");
        if (savedSec) setSecurity(JSON.parse(savedSec));
      } catch {
        // Ignore corrupted localStorage
      }
    };

    import("../services/authService").then(({ authFetch }) => {
      import("../services/config").then(({ API_URL }) => {
        authFetch(`${API_URL}/settings/admin`)
          .then(async (r) => {
            const data = await r.json();
            if (cancelled) return;
            if (data && data.success && data.data) {
              const settings = data.data as Record<string, any>;
              const generalData: Record<string, any> = {};
              const notifData: Record<string, any> = {};
              const secData: Record<string, any> = {};

              for (const [key, value] of Object.entries(settings)) {
                if (key.startsWith("notifications_")) {
                  notifData[key.replace("notifications_", "")] = value;
                } else if (key.startsWith("security_")) {
                  secData[key.replace("security_", "")] = value;
                } else {
                  generalData[key] = value;
                }
              }

              if (Object.keys(generalData).length > 0) setGeneral(generalData);
              else applyOfflineFallback();

              if (Object.keys(notifData).length > 0) setNotifications(notifData);
              if (Object.keys(secData).length > 0) setSecurity(secData);
            } else {
              applyOfflineFallback();
            }
          })
          .catch(() => {
            applyOfflineFallback();
          })
          .finally(() => {
            if (!cancelled) {
              setIsFetching(false);
            }
          });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);


  // ── Controlled Account Provisioning State ──────────────────────────────
  const CONTROLLED_DESIGNATIONS = [
    { label: 'Academic Registrar', value: 'Academic Registrar', scope: 'Programs, Grades, Transcripts' },
    { label: 'Finance Bursar', value: 'Finance Bursar', scope: 'Student Ledger & Payroll' },
    { label: 'Faculty Chair', value: 'Faculty Chair', scope: 'Classes, Grading & Attendance' },
    { label: 'HR Director', value: 'HR Director', scope: 'Staff Directory & Payroll' },
    { label: 'Admissions Officer', value: 'Admissions Officer', scope: 'Applications & Enrollment' },
    { label: 'IT Administrator', value: 'IT Administrator', scope: 'System Health & Integrations' },
    { label: 'Library Manager', value: 'Library Manager', scope: 'Library & Media Resources' },
    { label: 'System Administrator', value: 'System Administrator', scope: 'Full System Access & Configuration' },
  ];

  const [provisionForm, setProvisionForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    designation: CONTROLLED_DESIGNATIONS[0].value,
    staff_no: '',
  });
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{
    type: 'success' | 'error';
    message: string;
    temp_password?: string;
  } | null>(null);

  const handleProvisionAccount = async () => {
    const { first_name, last_name, email, designation } = provisionForm;
    if (!first_name || !last_name || !email || !designation) {
      setProvisionResult({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }
    setProvisionLoading(true);
    setProvisionResult(null);
    try {
      const res = await authFetch('/api/v1/staff/provision-controlled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provisionForm),
      });
      const data = await res.json() as any;
      if (data.success) {
        setProvisionResult({
          type: 'success',
          message: data.message,
          temp_password: data.data?.temp_password,
        });
        setProvisionForm({ first_name: '', last_name: '', email: '', designation: CONTROLLED_DESIGNATIONS[0].value, staff_no: '' });
      } else {
        setProvisionResult({ type: 'error', message: data.error || 'Provisioning failed.' });
      }
    } catch {
      setProvisionResult({ type: 'error', message: 'Network error — could not reach the server.' });
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    // Always save to localStorage first as offline fallback
    localStorage.setItem("bmi_settings_general", JSON.stringify(general));
    localStorage.setItem(
      "bmi_settings_notifications",
      JSON.stringify(notifications),
    );
    localStorage.setItem("bmi_settings_security", JSON.stringify(security));

    // Build namespaced payload for API
    const payload: Record<string, any> = {};

    // General settings (no prefix)
    for (const [key, value] of Object.entries(general)) {
      if (value !== undefined && value !== null) {
        payload[key] = value;
      }
    }

    // Notifications settings (notifications_ prefix)
    for (const [key, value] of Object.entries(notifications)) {
      if (value !== undefined && value !== null) {
        payload[`notifications_${key}`] = value;
      }
    }

    // Security settings (security_ prefix)
    for (const [key, value] of Object.entries(security)) {
      if (value !== undefined && value !== null) {
        payload[`security_${key}`] = value;
      }
    }

    try {
      const { authFetch } = await import("../services/authService");
      const { API_URL } = await import("../services/config");
      const res = await authFetch(`${API_URL}/settings/admin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data || !data.success) {
        console.warn("[Settings] API save returned non-success; localStorage used as fallback");
      }
    } catch {
      // API failed — localStorage already saved, so user data is safe
    }

    setIsLoading(false);
    setToastMessage("Configuration Committed Successfully");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handlePasswordUpdate = async () => {
    if (
      !passwordData.current ||
      !passwordData.newPass ||
      !passwordData.confirm
    ) {
      setToastMessage("Please fill in all password fields");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    if (passwordData.newPass !== passwordData.confirm) {
      setToastMessage("Passwords do not match");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }
    if (passwordData.newPass.length < 8) {
      setToastMessage("Password must be at least 8 characters");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authFetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.current,
          newPassword: passwordData.newPass,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setToastMessage("Password updated successfully");
        setPasswordData({ current: "", newPass: "", confirm: "" });
      } else {
        setToastMessage(data.error || "Failed to update password");
      }
    } catch {
      setToastMessage("Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleResetSystem = async () => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "⚠ Full System Factory Reset",
      message: "You are about to permanently purge ALL institutional data and reset the BMI University ERP to factory defaults.",
      detail: "This critical security action will irreversibly erase all Student Registries, Financial Ledgers, Staff Records, Course Catalogues, Academic Transcripts, and system configurations. A security audit event will be logged. This action requires Vice-Chancellor authorisation and cannot be undone under any circumstances.",
      confirmText: "Confirm Full System Reset",
      cancelText: "Abort",
      variant: "danger",
      badgeText: "Critical Security Action",
    });
    if (confirmed) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        await useDialogStore.getState().alert({
          title: "Media Upload Limit Exceeded",
          message: "The selected logo file exceeds the 2MB institutional media upload limit.",
          detail: "Please reduce the file size using an image compression tool before uploading. Accepted formats: PNG, SVG, WebP (max 2MB).",
          variant: "warning",
          confirmText: "Understood",
          badgeText: "Media Policy",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/png", 0.8);
            setLogoPreview(dataUrl);
            onUpdateLogo(dataUrl);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: string; label: string; icon: React.ComponentType<{ size?: number }> }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-8 py-4 text-xs font-black uppercase tracking-widest transition-all rounded-none ${activeTab === id
          ? "bg-white dark:bg-gray-800 text-[#4B0082] dark:text-[#FFD700] border-t-4 border-[#4B0082] dark:border-[#FFD700] shadow-sm"
          : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="p-8 animate-fade-in pb-20 max-w-6xl mx-auto relative">
      <div className="mb-8 flex items-center gap-4">
        <div className="w-2 h-12 bg-[#4B0082]"></div>
        <div>
          <h2 className="text-3xl font-bold text-[#2E004F] dark:text-white tracking-tight uppercase">
            System Configuration
          </h2>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Institutional Preferences & Control
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <TabButton id="general" label="General" icon={Globe} />
          <TabButton id="notifications" label="Notifications" icon={Bell} />
          <TabButton id="security" label="Security" icon={Shield} />
          <TabButton id="institution" label="Institution & Evidence" icon={Database} />
          <TabButton id="controlled-accounts" label="Controlled Accounts" icon={UserPlus} />
        </div>

        {/* Content */}
        <div className="p-10 min-h-[500px]">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-10 max-w-3xl">
              {/* Logo Upload Section */}
              <div className="bg-purple-50/30 dark:bg-gray-700/30 p-8 border border-purple-100 dark:border-gray-600 rounded-none">
                <h3 className="text-xs font-black text-[#4B0082] dark:text-purple-300 mb-6 flex items-center gap-2 uppercase tracking-widest">
                  <ImageIcon size={16} /> Institutional Branding
                </h3>
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 rounded-none border-2 border-dashed border-purple-200 dark:border-gray-500 flex items-center justify-center bg-white dark:bg-gray-600 overflow-hidden relative group shadow-sm">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase text-gray-400">
                          No Logo
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-3 px-6 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-[#4B0082] dark:hover:text-purple-300 hover:border-[#4B0082] transition-all shadow-sm font-black text-[10px] uppercase tracking-widest group">
                      <Upload
                        size={14}
                        className="group-hover:scale-110 transition-transform"
                      />
                      Upload Emblem
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </label>
                    <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-wide">
                      Accepted: PNG, JPG, SVG • Max 2MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    value={general.uniName}
                    onChange={(e) =>
                      setGeneral({ ...general, uniName: e.target.value })
                    }
                    className="w-full px-5 py-3 border border-gray-200 dark:border-gray-600 rounded-none focus:border-[#4B0082] outline-none transition-all dark:bg-gray-700 dark:text-white font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    value={general.email}
                    onChange={(e) =>
                      setGeneral({ ...general, email: e.target.value })
                    }
                    className="w-full px-5 py-3 border border-gray-200 dark:border-gray-600 rounded-none focus:border-[#4B0082] outline-none transition-all dark:bg-gray-700 dark:text-white font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={general.phone}
                    onChange={(e) =>
                      setGeneral({ ...general, phone: e.target.value })
                    }
                    className="w-full px-5 py-3 border border-gray-200 dark:border-gray-600 rounded-none focus:border-[#4B0082] outline-none transition-all dark:bg-gray-700 dark:text-white font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Primary Timezone
                  </label>
                  <select className="w-full px-5 py-3 border border-gray-200 dark:border-gray-600 rounded-none focus:border-[#4B0082] outline-none transition-all bg-white dark:bg-gray-700 dark:text-white font-bold text-sm">
                    <option>UTC-05:00 Eastern Time</option>
                    <option>UTC-08:00 Pacific Time</option>
                    <option>UTC+00:00 London</option>
                    <option>UTC+03:00 Nairobi (EAT)</option>
                  </select>
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Campus Address
                  </label>
                  <textarea
                    value={general.address}
                    onChange={(e) =>
                      setGeneral({ ...general, address: e.target.value })
                    }
                    rows={3}
                    className="w-full px-5 py-3 border border-gray-200 dark:border-gray-600 rounded-none focus:border-[#4B0082] outline-none transition-all resize-none dark:bg-gray-700 dark:text-white font-medium text-sm"
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
                  Interface Theme
                </h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => onUpdateTheme("light")}
                    className={`flex items-center gap-3 px-6 py-3 border rounded-none transition-all ${currentTheme === "light" ? "border-[#4B0082] bg-purple-50 text-[#4B0082] dark:bg-gray-700 dark:text-white" : "border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"}`}
                  >
                    <Sun size={18} />
                    <span className="font-bold text-xs uppercase tracking-widest">
                      Light Mode
                    </span>
                  </button>
                  <button
                    onClick={() => onUpdateTheme("dark")}
                    className={`flex items-center gap-3 px-6 py-3 border rounded-none transition-all ${currentTheme === "dark" ? "border-[#4B0082] bg-purple-900 text-white shadow-md" : "border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"}`}
                  >
                    <Moon size={18} />
                    <span className="font-bold text-xs uppercase tracking-widest">
                      Dark Mode
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-black text-red-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Database size={16} /> Data Governance
                </h3>
                <div className="bg-red-50 dark:bg-red-900/10 p-6 border border-red-100 dark:border-red-900/30 rounded-none flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-tight">
                      Factory Reset
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Purge all local registries. Irreversible.
                    </p>
                  </div>
                  <button
                    onClick={handleResetSystem}
                    className="px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-sm rounded-none"
                  >
                    Reset System
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "institution" && (
            <div className="space-y-10 max-w-5xl">
              <section className="space-y-5">
                <div>
                  <h3 className="text-sm font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest">Institution identity and contacts</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This profile is scoped to the BMI or BEMI institution selected by the verified host.</p>
                </div>
                {institutionError && <div role="alert" className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{institutionError}</div>}
                {institutionLoading && <p className="text-sm text-gray-500">Loading institution records…</p>}
                {!institutionLoading && institutionProfile && (
                  <>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {([
                        ["name", "Institution name", "text"], ["legal_name", "Legal entity", "text"],
                        ["admissions_email", "Admissions email", "email"], ["registrar_email", "Registrar email", "email"],
                        ["finance_email", "Finance email", "email"], ["admin_email", "Administrator email", "email"],
                        ["website_url", "Institution website", "url"],
                      ] as const).map(([key, label, type]) => (
                        <label key={key} className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
                          <input type={type} value={institutionProfile[key] ?? ""} onChange={(event) => setInstitutionProfile({ ...institutionProfile, [key]: event.target.value })}
                            className="w-full border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:border-[#4B0082] dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                        </label>
                      ))}
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Phone numbers (one per line)</span>
                        <textarea rows={3} value={institutionProfile.phones.join("\n")} onChange={(event) => setInstitutionProfile({ ...institutionProfile, phones: event.target.value.split("\n").map((phone) => phone.trim()).filter(Boolean).slice(0, 12) })}
                          className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#4B0082] dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Campus / head office address</span>
                        <textarea rows={3} value={institutionProfile.address ?? ""} onChange={(event) => setInstitutionProfile({ ...institutionProfile, address: event.target.value })}
                          className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#4B0082] dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      </label>
                    </div>
                    <button type="button" onClick={() => void saveInstitutionProfile()} disabled={institutionSaving}
                      className="inline-flex items-center gap-2 bg-[#4B0082] px-6 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
                      {institutionSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save institution profile
                    </button>
                  </>
                )}
              </section>

              <section className="space-y-5 border-t border-gray-100 pt-8 dark:border-gray-700">
                <div>
                  <h3 className="text-sm font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest">Regulatory evidence register</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Record source documents and review status. Adding a record does not publish or change accreditation wording.</p>
                </div>
                <form onSubmit={(event) => { event.preventDefault(); void addRegulatoryEvidence(); }} className="grid grid-cols-1 gap-4 rounded-none border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/40 md:grid-cols-2">
                  <input required maxLength={240} placeholder="Evidence title" value={evidenceDraft.title} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, title: event.target.value })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  <input required maxLength={80} placeholder="Evidence type (e.g. registration certificate)" value={evidenceDraft.evidence_type} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, evidence_type: event.target.value })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  <input required maxLength={240} placeholder="Issuing authority" value={evidenceDraft.authority} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, authority: event.target.value })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  <input maxLength={120} placeholder="Reference number (optional)" value={evidenceDraft.reference_number} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, reference_number: event.target.value })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  <select value={evidenceDraft.status} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, status: event.target.value as RegulatoryEvidence["status"] })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                    {(["received", "pending_review", "verified", "expired", "superseded", "withdrawn", "rejected"] as const).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-gray-500">Issued on<input type="date" value={evidenceDraft.issued_on} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, issued_on: event.target.value })} className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" /></label>
                    <label className="text-xs text-gray-500">Expires on<input type="date" value={evidenceDraft.expires_on} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, expires_on: event.target.value })} className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" /></label>
                  </div>
                  <input type="url" placeholder="Evidence link (optional, HTTPS URL)" value={evidenceDraft.evidence_url} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, evidence_url: event.target.value })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  <textarea maxLength={8000} placeholder="Notes" value={evidenceDraft.notes} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, notes: event.target.value })} className="border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                  <div className="md:col-span-2"><button disabled={evidenceSaving || institutionLoading} className="inline-flex items-center gap-2 bg-gray-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60 dark:bg-white dark:text-gray-900">{evidenceSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Add evidence record</button></div>
                </form>
                <div className="space-y-3">
                  {regulatoryEvidence.length === 0 && !institutionLoading && <p className="rounded-none border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-600">No regulatory evidence records have been entered for this institution.</p>}
                  {regulatoryEvidence.map((record) => (
                    <article key={record.id} className="grid grid-cols-1 gap-3 border border-gray-200 p-4 dark:border-gray-700 md:grid-cols-[1fr_auto]">
                      <div><h4 className="font-bold text-gray-900 dark:text-white">{record.title}</h4><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{record.evidence_type} · {record.authority}{record.reference_number ? ` · Ref ${record.reference_number}` : ""}</p>
                        {(record.issued_on || record.expires_on) && <p className="mt-1 text-xs text-gray-500">{record.issued_on ? `Issued ${record.issued_on}` : ""}{record.expires_on ? ` · Expires ${record.expires_on}` : ""}</p>}
                        {record.evidence_url && <a href={record.evidence_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-[#4B0082] underline">Open evidence source</a>}
                        {record.notes && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{record.notes}</p>}
                      </div>
                      <label className="text-xs text-gray-500">Review status<select value={record.status} onChange={(event) => void updateEvidenceStatus(record.id, event.target.value as RegulatoryEvidence["status"])} className="mt-1 block w-full border border-gray-200 px-3 py-2 text-sm capitalize dark:border-gray-600 dark:bg-gray-800 dark:text-white">{(["received", "pending_review", "verified", "expired", "superseded", "withdrawn", "rejected"] as const).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-8 max-w-3xl">
              <h3 className="text-sm font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest">
                Alert Protocols
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-8 rounded-none border border-gray-100 dark:border-gray-600 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-blue-600 rounded-none shadow-sm">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white text-sm uppercase">
                        Email Notifications
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Daily summaries and critical institutional alerts
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.emailAlerts}
                      onChange={() =>
                        setNotifications({
                          ...notifications,
                          emailAlerts: !notifications.emailAlerts,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4B0082] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4B0082]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-green-600 rounded-none shadow-sm">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white text-sm uppercase">
                        SMS Alerts
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Urgent campus announcements sent to mobile terminals
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.smsAlerts}
                      onChange={() =>
                        setNotifications({
                          ...notifications,
                          smsAlerts: !notifications.smsAlerts,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4B0082] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4B0082]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-10 max-w-3xl">
              <div>
                <h3 className="text-sm font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest mb-6">
                  Credential Management
                </h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      Current Password
                    </label>
                    <input
                      type="password"
                      placeholder="Current Access Code"
                      value={passwordData.current}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          current: e.target.value,
                        })
                      }
                      className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-none bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-[#4B0082] outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                        New Password
                      </label>
                      <input
                        type="password"
                        placeholder="New Access Code"
                        value={passwordData.newPass}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            newPass: e.target.value,
                          })
                        }
                        className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-none bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-[#4B0082] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        placeholder="Confirm New Access Code"
                        value={passwordData.confirm}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            confirm: e.target.value,
                          })
                        }
                        className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-none bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-[#4B0082] outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handlePasswordUpdate}
                    disabled={isLoading}
                    className="px-8 py-3 text-[10px] font-black text-[#4B0082] dark:text-purple-300 hover:text-white hover:bg-[#4B0082] border-2 border-[#4B0082] dark:border-purple-300 rounded-none transition-colors disabled:opacity-50 uppercase tracking-widest"
                  >
                    {isLoading
                      ? "Processing Protocol..."
                      : "Update Credentials"}
                  </button>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest mb-6">
                  Access Control Matrix
                </h3>
                <div className="flex items-center justify-between p-6 border border-purple-100 dark:border-gray-600 bg-purple-50/50 dark:bg-gray-700/50 rounded-none">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white text-sm uppercase">
                      Two-Factor Authentication (2FA)
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Enforce biometric or secondary token verification for
                      admin sessions
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={security.twoFactor}
                      onChange={() =>
                        setSecurity({
                          ...security,
                          twoFactor: !security.twoFactor,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4B0082] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4B0082]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
          {/* Controlled Accounts Tab */}
          {activeTab === "controlled-accounts" && (
            <div className="space-y-8 max-w-2xl">
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-none p-5">
                <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <p className="font-black uppercase mb-1">How Controlled Account Provisioning Works</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>A cryptographically random temporary password is generated server-side — you never define it.</li>
                    <li>The account is created as <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">staff</code> role with <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">must_change_password = true</code>.</li>
                    <li>If email (Resend) is configured, the user receives a welcome email with their credentials and must reset on first login.</li>
                    <li>If email is not configured, the temporary password is returned below — relay it via a secure channel.</li>
                  </ul>
                </div>
              </div>

              {/* Result Banner */}
              {provisionResult && (
                <div className={`flex items-start gap-3 p-4 border rounded-none text-xs ${provisionResult.type === 'success'
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                  }`}>
                  {provisionResult.type === 'success'
                    ? <Check size={16} className="mt-0.5 flex-shrink-0" />
                    : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="font-bold">{provisionResult.message}</p>
                    {provisionResult.temp_password && (
                      <p className="mt-2">
                        Temporary Password (no email configured):{' '}
                        <code className="bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded font-mono font-bold select-all">
                          {provisionResult.temp_password}
                        </code>
                        <span className="ml-2 text-[10px] opacity-70">— Send this via a secure channel and remind the user to change it immediately.</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Provision Form */}
              <div className="bg-purple-50/30 dark:bg-gray-700/30 p-8 border border-purple-100 dark:border-gray-600 rounded-none space-y-5">
                <h3 className="text-xs font-black text-[#4B0082] dark:text-purple-300 uppercase tracking-widest flex items-center gap-2">
                  <UserPlus size={16} /> Create New Controlled Staff Account
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={provisionForm.first_name}
                      onChange={(e) => setProvisionForm(f => ({ ...f, first_name: e.target.value }))}
                      placeholder="e.g. Grace"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-none focus:outline-none focus:ring-2 focus:ring-[#4B0082] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={provisionForm.last_name}
                      onChange={(e) => setProvisionForm(f => ({ ...f, last_name: e.target.value }))}
                      placeholder="e.g. Mensah"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-none focus:outline-none focus:ring-2 focus:ring-[#4B0082] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">Work Email *</label>
                  <input
                    type="email"
                    value={provisionForm.email}
                    onChange={(e) => setProvisionForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="registrar@bmi.edu"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-none focus:outline-none focus:ring-2 focus:ring-[#4B0082] dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">Designation / Role *</label>
                  <select
                    value={provisionForm.designation}
                    onChange={(e) => setProvisionForm(f => ({ ...f, designation: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-none focus:outline-none focus:ring-2 focus:ring-[#4B0082] dark:text-white"
                  >
                    {CONTROLLED_DESIGNATIONS.map(d => (
                      <option key={d.value} value={d.value}>
                        {d.label} — {d.scope}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Accounts are provisioned as <strong>staff</strong> role, except System Administrators which receive the <strong>admin</strong> role. Use User Management → Role Update to grant admin privileges separately.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">Staff Number (optional — auto-generated if blank)</label>
                  <input
                    type="text"
                    value={provisionForm.staff_no}
                    onChange={(e) => setProvisionForm(f => ({ ...f, staff_no: e.target.value }))}
                    placeholder="STF-2026-001"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-none focus:outline-none focus:ring-2 focus:ring-[#4B0082] dark:text-white"
                  />
                </div>

                <button
                  onClick={handleProvisionAccount}
                  disabled={provisionLoading}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#4B0082] to-[#320064] text-white font-black text-xs uppercase tracking-widest rounded-none shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-100 transition-all disabled:opacity-70 disabled:transform-none border border-[#FFD700]/20"
                >
                  {provisionLoading
                    ? <><Loader2 size={14} className="animate-spin" /> Provisioning…</>
                    : <><UserPlus size={14} className="text-[#FFD700]" /> Provision Account</>}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[#4B0082] to-[#320064] text-white font-black text-xs uppercase tracking-widest rounded-none shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-70 disabled:transform-none border border-[#FFD700]/20"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={16} className="text-[#FFD700]" />
            )}
            Commit Configuration
          </button>
        </div>
      </div>

      {/* Success Toast Notification */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-[#4B0082] text-white dark:bg-white dark:text-[#4B0082] px-8 py-4 rounded-none shadow-2xl flex items-center gap-4 border-2 border-[#FFD700] dark:border-[#4B0082]/20">
            <div className="bg-white/20 dark:bg-[#4B0082]/10 p-1.5 rounded-full">
              <Check size={18} className="text-[#FFD700] dark:text-[#4B0082]" />
            </div>
            <span className="font-black text-xs uppercase tracking-widest">
              {toastMessage}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;









