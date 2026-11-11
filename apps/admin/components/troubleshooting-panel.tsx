"use client";

import { useEffect, useState } from "react";
import type { Tenant } from "@/lib/platform";

interface OutboxItem {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  channel: string;
  idempotencyKey: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  lockedAt: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  recipient: string;
  subject: string | null;
  template: string;
  variables: Record<string, unknown>;
}

interface PaymentItem {
  id: string;
  source: "church_donation" | "commerce_order";
  tenantId: string;
  tenantName: string | null;
  referenceId: string;
  orderNumber?: string | null;
  provider: string;
  providerReference: string | null;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  verifiedAt: string | null;
  rawCallback: any;
  createdAt: string;
  customerName: string | null;
  customerContact: string | null;
}

interface DomainItem {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  hostname: string;
  status: string;
  verification_token_hash: string | null;
  verified_at: string | null;
  created_at: string;
}

interface UserItem {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
  }>;
  activeSessionsCount: number;
}

interface DnsReport {
  hostname: string;
  challengeHostname: string;
  challengeTxtRecords: string[];
  rootTxtRecords: string[];
  aRecords: string[];
  cnameRecords: string[];
  tokenMatched: boolean;
  dnsReachable: boolean;
  issues: string[];
  recommendations: string[];
}

interface MigrationItem {
  version: string;
  applied: boolean;
  appliedAt: string | null;
}

interface MigrationsData {
  currentPlatformSchemaVersion: string;
  totalRequired: number;
  appliedCount: number;
  pendingCount: number;
  isUpToDate: boolean;
  migrations: MigrationItem[];
  tenantBindingsSummary: Array<{
    schemaVersion: string;
    count: number;
    isCurrent: boolean;
  }>;
  poolStatus: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}

interface StorageUsageItem {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  assetCount: number;
  estimatedSizeBytes: number;
  quotaMb: number;
  quotaBytes: number;
  percentUsed: number;
}

interface StorageUsageData {
  driver: string;
  defaultQuotaMb: number;
  totalTenants: number;
  items: StorageUsageItem[];
}

interface RateLimitPolicy {
  id: string;
  route: string;
  window: string;
  maxRequests: number;
  keyType: string;
}

interface RateLimitsData {
  policies: RateLimitPolicy[];
  status: string;
  store: string;
  resetSupported: boolean;
}

interface TenantModuleItem {
  id: string;
  name: string;
  category: string;
  tier: string;
  defaultEnabled: boolean;
  effectiveEnabled: boolean;
  hasOverride: boolean;
  updatedAt: string | null;
}

export function TroubleshootingPanel({
  initialTenants,
  defaultTenantId,
}: {
  initialTenants: Tenant[];
  defaultTenantId?: string;
}) {
  const [activeTab, setActiveTab] = useState<
    "outbox" | "payments" | "domains" | "users" | "tenants" | "migrations" | "storage" | "ratelimits"
  >("outbox");
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tab 1: Outbox State
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [outboxSummary, setOutboxSummary] = useState<Record<string, number>>({ pending: 0, processing: 0, sent: 0, dead: 0 });
  const [outboxStatus, setOutboxStatus] = useState("all");
  const [outboxChannel, setOutboxChannel] = useState("all");
  const [outboxSearch, setOutboxSearch] = useState("");
  const [loadingOutbox, setLoadingOutbox] = useState(false);
  const [inspectOutbox, setInspectOutbox] = useState<OutboxItem | null>(null);
  const [showTestDispatch, setShowTestDispatch] = useState(false);
  const [testChannel, setTestChannel] = useState<"email" | "sms">("email");
  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testMessage, setTestMessage] = useState("");

  // Tab 2: Payments State
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentSource, setPaymentSource] = useState("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<PaymentItem | null>(null);
  const [reconcileAction, setReconcileAction] = useState<"mark_succeeded" | "mark_failed">("mark_succeeded");
  const [reconcileRef, setReconcileRef] = useState("");
  const [reconcileReason, setReconcileReason] = useState("");
  const [inspectCallback, setInspectCallback] = useState<any | null>(null);
  const [showStkQueryModal, setShowStkQueryModal] = useState(false);
  const [stkQueryCheckoutId, setStkQueryCheckoutId] = useState("");
  const [stkQueryResult, setStkQueryResult] = useState<any | null>(null);
  const [queryingStk, setQueryingStk] = useState(false);

  // Tab 3: Domains State
  const [domainItems, setDomainItems] = useState<DomainItem[]>([]);
  const [domainSearch, setDomainSearch] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [dnsDiagnoseHost, setDnsDiagnoseHost] = useState("");
  const [dnsReport, setDnsReport] = useState<DnsReport | null>(null);
  const [diagnosingDns, setDiagnosingDns] = useState(false);
  const [forceVerifyDomainId, setForceVerifyDomainId] = useState<string | null>(null);
  const [forceVerifyReason, setForceVerifyReason] = useState("");

  // Tab 4: Users State
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [generatedResetUrl, setGeneratedResetUrl] = useState<string | null>(null);

  // Tab 5: Tenant Recovery & Overrides State
  const [selectedTenantId, setSelectedTenantId] = useState<string>(defaultTenantId || initialTenants[0]?.id || "");
  const [tenantHealth, setTenantHealth] = useState<any>(null);
  const [tenantModules, setTenantModules] = useState<TenantModuleItem[]>([]);
  const [loadingTenantHealth, setLoadingTenantHealth] = useState(false);
  const [loadingTenantModules, setLoadingTenantModules] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [overrideModuleId, setOverrideModuleId] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideReason, setOverrideReason] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newTenantStatus, setNewTenantStatus] = useState<"active" | "suspended" | "maintenance" | "archived">("active");
  const [statusOverrideReason, setStatusOverrideReason] = useState("");
  const [savingStatusOverride, setSavingStatusOverride] = useState(false);
  const [exportingRecovery, setExportingRecovery] = useState(false);

  // Tab 6: Migrations & Schema State
  const [migrationsData, setMigrationsData] = useState<MigrationsData | null>(null);
  const [loadingMigrations, setLoadingMigrations] = useState(false);
  const [syncingBindings, setSyncingBindings] = useState(false);

  // Tab 7: Storage & Quotas State
  const [storageData, setStorageData] = useState<StorageUsageData | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [quotaTarget, setQuotaTarget] = useState<StorageUsageItem | null>(null);
  const [quotaInputMb, setQuotaInputMb] = useState<number>(500);
  const [quotaReason, setQuotaReason] = useState("");
  const [savingQuota, setSavingQuota] = useState(false);

  // Tab 8: Rate Limits State
  const [rateLimitsData, setRateLimitsData] = useState<RateLimitsData | null>(null);
  const [loadingRateLimits, setLoadingRateLimits] = useState(false);

  function notify(type: "success" | "error", text: string) {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 6000);
  }

  // Load Outbox
  async function loadOutbox() {
    setLoadingOutbox(true);
    try {
      const q = new URLSearchParams();
      if (outboxStatus !== "all") q.set("status", outboxStatus);
      if (outboxChannel !== "all") q.set("channel", outboxChannel);
      if (outboxSearch) q.set("search", outboxSearch);
      const res = await fetch(`/v1/admin/platform/troubleshoot/outbox?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOutboxItems(data.items || []);
        setOutboxSummary(data.summary || {});
      }
    } finally {
      setLoadingOutbox(false);
    }
  }

  // Load Payments
  async function loadPayments() {
    setLoadingPayments(true);
    try {
      const q = new URLSearchParams();
      if (paymentStatus !== "all") q.set("status", paymentStatus);
      if (paymentSource !== "all") q.set("source", paymentSource);
      if (paymentSearch) q.set("search", paymentSearch);
      const res = await fetch(`/v1/admin/platform/troubleshoot/payments?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPaymentItems(data.items || []);
      }
    } finally {
      setLoadingPayments(false);
    }
  }

  // Load Domains
  async function loadDomains() {
    setLoadingDomains(true);
    try {
      const q = new URLSearchParams();
      if (domainSearch) q.set("search", domainSearch);
      const res = await fetch(`/v1/admin/platform/troubleshoot/domains?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDomainItems(data.items || []);
      }
    } finally {
      setLoadingDomains(false);
    }
  }

  // Load Users
  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const q = new URLSearchParams();
      if (userSearch) q.set("query", userSearch);
      const res = await fetch(`/v1/admin/platform/troubleshoot/users?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUserItems(data.items || []);
      }
    } finally {
      setLoadingUsers(false);
    }
  }

  // Load Tenant Health & Modules
  async function loadTenantHealth(tId: string) {
    if (!tId) return;
    setLoadingTenantHealth(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/tenants/${tId}/health`);
      if (res.ok) {
        const data = await res.json();
        setTenantHealth(data);
        setMaintenanceEnabled(data.maintenance?.enabled ?? false);
        setMaintenanceMessage(data.maintenance?.message ?? "");
        setNewTenantStatus(data.tenant?.status ?? "active");
      }
    } finally {
      setLoadingTenantHealth(false);
    }
  }

  async function loadTenantModules(tId: string) {
    if (!tId) return;
    setLoadingTenantModules(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/tenants/${tId}/modules`);
      if (res.ok) {
        const data = await res.json();
        setTenantModules(data.modules || []);
      }
    } finally {
      setLoadingTenantModules(false);
    }
  }

  // Load Migrations
  async function loadMigrations() {
    setLoadingMigrations(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/database/migrations`);
      if (res.ok) {
        setMigrationsData(await res.json());
      }
    } finally {
      setLoadingMigrations(false);
    }
  }

  // Load Storage Usage
  async function loadStorageUsage() {
    setLoadingStorage(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/storage/usage`);
      if (res.ok) {
        setStorageData(await res.json());
      }
    } finally {
      setLoadingStorage(false);
    }
  }

  // Load Rate Limits
  async function loadRateLimits() {
    setLoadingRateLimits(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/rate-limits`);
      if (res.ok) {
        setRateLimitsData(await res.json());
      }
    } finally {
      setLoadingRateLimits(false);
    }
  }

  useEffect(() => {
    if (activeTab === "outbox") loadOutbox();
    if (activeTab === "payments") loadPayments();
    if (activeTab === "domains") loadDomains();
    if (activeTab === "users") loadUsers();
    if (activeTab === "tenants" && selectedTenantId) {
      loadTenantHealth(selectedTenantId);
      loadTenantModules(selectedTenantId);
    }
    if (activeTab === "migrations") loadMigrations();
    if (activeTab === "storage") loadStorageUsage();
    if (activeTab === "ratelimits") loadRateLimits();
  }, [activeTab, selectedTenantId]);

  // Outbox Actions
  async function handleRetryOutbox(id: string) {
    const res = await fetch(`/v1/admin/platform/troubleshoot/outbox/${id}/retry`, { method: "POST" });
    if (res.ok) {
      notify("success", "Outbox notification requeued for immediate delivery.");
      loadOutbox();
    } else {
      notify("error", "Could not requeue outbox notification.");
    }
  }

  async function handleBatchRetryDead() {
    const res = await fetch(`/v1/admin/platform/troubleshoot/outbox/batch-retry-dead`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      notify("success", `Requeued ${data.requeuedCount} dead/stuck notification deliveries.`);
      loadOutbox();
    } else {
      notify("error", "Could not batch retry dead letters.");
    }
  }

  async function handleCancelOutbox(id: string) {
    const res = await fetch(`/v1/admin/platform/troubleshoot/outbox/${id}/cancel`, { method: "POST" });
    if (res.ok) {
      notify("success", "Notification discarded from active queue.");
      loadOutbox();
    } else {
      notify("error", "Could not cancel notification.");
    }
  }

  async function handleTestDispatch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/v1/admin/platform/troubleshoot/outbox/test-dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: testChannel,
        to: testTo.trim(),
        subject: testSubject.trim() || undefined,
        message: testMessage.trim(),
      }),
    });
    if (res.ok) {
      notify("success", "Diagnostic notification enqueued to outbox.");
      setShowTestDispatch(false);
      setTestTo("");
      setTestMessage("");
      loadOutbox();
    } else {
      const data = await res.json().catch(() => ({}));
      notify("error", data.error || "Failed to enqueue diagnostic test.");
    }
  }

  // Payment Reconciliation Action
  async function handleReconcilePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!reconcileTarget) return;
    const res = await fetch(`/v1/admin/platform/troubleshoot/payments/${reconcileTarget.id}/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: reconcileTarget.source,
        action: reconcileAction,
        providerReference: reconcileRef.trim() || undefined,
        reason: reconcileReason.trim(),
      }),
    });
    if (res.ok) {
      notify("success", `Transaction successfully marked as ${reconcileAction === "mark_succeeded" ? "succeeded" : "failed"}.`);
      setReconcileTarget(null);
      setReconcileRef("");
      setReconcileReason("");
      loadPayments();
    } else {
      notify("error", "Could not reconcile payment transaction.");
    }
  }

  // Daraja STK Push Live Query Action
  async function handleQueryStkStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!stkQueryCheckoutId.trim()) return;
    setQueryingStk(true);
    setStkQueryResult(null);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/payments/query-stk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkoutRequestId: stkQueryCheckoutId.trim() }),
      });
      const data = await res.json();
      setStkQueryResult(data);
      if (res.ok) {
        notify("success", "Safaricom gateway STK query completed.");
      } else {
        notify("error", data.message || "Gateway STK status query failed.");
      }
    } finally {
      setQueryingStk(false);
    }
  }

  // Domain Diagnostics Action
  async function handleRunDnsDiagnosis(hostname: string, domainId?: string) {
    setDiagnosingDns(true);
    setDnsDiagnoseHost(hostname);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/domains/diagnose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostname, domainId }),
      });
      if (res.ok) {
        setDnsReport(await res.json());
      } else {
        notify("error", "DNS diagnostic query failed.");
      }
    } finally {
      setDiagnosingDns(false);
    }
  }

  async function handleForceVerifyDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!forceVerifyDomainId) return;
    const res = await fetch(`/v1/admin/platform/troubleshoot/domains/${forceVerifyDomainId}/force-verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: forceVerifyReason.trim() }),
    });
    if (res.ok) {
      notify("success", "Domain force-verified and set to active.");
      setForceVerifyDomainId(null);
      setForceVerifyReason("");
      loadDomains();
    } else {
      notify("error", "Failed to force verify domain.");
    }
  }

  async function handleToggleDomainStatus(domainId: string, currentStatus: string) {
    const nextStatus = currentStatus === "disabled" ? "active" : "disabled";
    const res = await fetch(`/v1/admin/platform/troubleshoot/domains/${domainId}/toggle-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus, reason: `Platform admin set status to ${nextStatus}` }),
    });
    if (res.ok) {
      notify("success", `Domain status changed to ${nextStatus}.`);
      loadDomains();
    } else {
      notify("error", "Could not toggle domain status.");
    }
  }

  // User & Auth Actions
  async function handleForceVerifyEmail(userId: string) {
    const res = await fetch(`/v1/admin/platform/troubleshoot/users/${userId}/force-verify-email`, { method: "POST" });
    if (res.ok) {
      notify("success", "User email status forced to verified.");
      loadUsers();
    } else {
      notify("error", "Could not force verify user email.");
    }
  }

  async function handleRevokeSessions(userId: string) {
    const res = await fetch(`/v1/admin/platform/troubleshoot/users/${userId}/revoke-sessions`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      notify("success", `Revoked ${data.revokedSessions} active session(s) for user.`);
      loadUsers();
    } else {
      notify("error", "Could not revoke sessions.");
    }
  }

  async function handleEmergencyResetLink(userId: string) {
    const res = await fetch(`/v1/admin/platform/troubleshoot/users/${userId}/emergency-reset-link`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setGeneratedResetUrl(data.resetUrl);
    } else {
      notify("error", "Could not generate emergency reset link.");
    }
  }

  // Tenant Maintenance Action
  async function handleSaveMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenantId) return;
    setSavingMaintenance(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/tenants/${selectedTenantId}/maintenance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: maintenanceEnabled,
          message: maintenanceMessage,
          reason: maintenanceReason || "Platform maintenance override",
        }),
      });
      if (res.ok) {
        notify("success", `Maintenance mode ${maintenanceEnabled ? "activated" : "cleared"} for workspace.`);
        loadTenantHealth(selectedTenantId);
      } else {
        notify("error", "Could not save maintenance mode settings.");
      }
    } finally {
      setSavingMaintenance(false);
    }
  }

  // Tenant Status Override Action
  async function handleSaveStatusOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenantId) return;
    setSavingStatusOverride(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/tenants/${selectedTenantId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: newTenantStatus,
          reason: statusOverrideReason.trim(),
        }),
      });
      if (res.ok) {
        notify("success", `Workspace status changed to ${newTenantStatus}.`);
        setShowStatusModal(false);
        setStatusOverrideReason("");
        loadTenantHealth(selectedTenantId);
      } else {
        notify("error", "Could not update workspace status.");
      }
    } finally {
      setSavingStatusOverride(false);
    }
  }

  // Tenant Module Force Override
  async function handleForceModuleOverride(moduleId: string, enable: boolean) {
    if (!selectedTenantId) return;
    const reason = prompt(`Enter audited justification for ${enable ? "enabling" : "disabling"} module "${moduleId}":`);
    if (!reason?.trim()) return;

    const res = await fetch(`/v1/admin/platform/troubleshoot/tenants/${selectedTenantId}/modules/force-override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        moduleId,
        enabled: enable,
        reason: reason.trim(),
      }),
    });
    if (res.ok) {
      notify("success", `Module "${moduleId}" override set to ${enable ? "enabled" : "disabled"}.`);
      loadTenantModules(selectedTenantId);
    } else {
      notify("error", "Could not apply module override.");
    }
  }

  // Tenant Disaster Recovery Export
  async function handleDownloadRecoveryExport() {
    if (!selectedTenantId) return;
    setExportingRecovery(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/tenants/${selectedTenantId}/recovery-export`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.tenant?.slug || "tenant"}-recovery-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify("success", "Emergency recovery snapshot downloaded.");
      } else {
        notify("error", "Failed to generate disaster recovery export.");
      }
    } finally {
      setExportingRecovery(false);
    }
  }

  // Sync Tenant Schema Versions Action
  async function handleSyncTenantBindings() {
    if (!confirm("Align all lagging tenant database bindings to current platform schema version?")) return;
    setSyncingBindings(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/database/sync-tenant-bindings`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        notify("success", `Synchronized ${data.synchronizedCount} tenant database binding(s) to ${data.currentSchemaVersion}.`);
        loadMigrations();
      } else {
        notify("error", "Failed to sync tenant database bindings.");
      }
    } finally {
      setSyncingBindings(false);
    }
  }

  // Quota Override Action
  async function handleSaveQuotaOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!quotaTarget) return;
    setSavingQuota(true);
    try {
      const res = await fetch(`/v1/admin/platform/troubleshoot/storage/tenants/${quotaTarget.tenantId}/quota-override`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quotaMb: quotaInputMb,
          reason: quotaReason.trim(),
        }),
      });
      if (res.ok) {
        notify("success", `Storage quota for ${quotaTarget.tenantName} set to ${quotaInputMb} MB.`);
        setQuotaTarget(null);
        setQuotaReason("");
        loadStorageUsage();
      } else {
        notify("error", "Failed to update storage quota.");
      }
    } finally {
      setSavingQuota(false);
    }
  }

  return (
    <div>
      {notification && (
        <div
          className={`notice-card ${notification.type === "success" ? "success-notice" : "error-notice"}`}
          style={{ padding: "12px 18px", marginBottom: "18px" }}
        >
          {notification.text}
        </div>
      )}

      {/* Troubleshooting Navigation Tabs */}
      <nav className="troubleshoot-tabs" aria-label="Troubleshooting categories">
        <button
          className={`troubleshoot-tab ${activeTab === "outbox" ? "active" : ""}`}
          onClick={() => setActiveTab("outbox")}
        >
          <span>📨</span>
          <span>Outbox & Dispatch</span>
          {outboxSummary.dead > 0 && <span className="tab-badge" style={{ background: "var(--red)", color: "#fff" }}>{outboxSummary.dead} dead</span>}
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "payments" ? "active" : ""}`}
          onClick={() => setActiveTab("payments")}
        >
          <span>💳</span>
          <span>Payments & Daraja</span>
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "domains" ? "active" : ""}`}
          onClick={() => setActiveTab("domains")}
        >
          <span>🌐</span>
          <span>DNS & Domains</span>
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <span>👤</span>
          <span>User & Auth Rescue</span>
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "tenants" ? "active" : ""}`}
          onClick={() => setActiveTab("tenants")}
        >
          <span>⚙️</span>
          <span>Tenants & Overrides</span>
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "migrations" ? "active" : ""}`}
          onClick={() => setActiveTab("migrations")}
        >
          <span>🗄️</span>
          <span>Migrations & Schema</span>
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "storage" ? "active" : ""}`}
          onClick={() => setActiveTab("storage")}
        >
          <span>📦</span>
          <span>Storage & Quotas</span>
        </button>

        <button
          className={`troubleshoot-tab ${activeTab === "ratelimits" ? "active" : ""}`}
          onClick={() => setActiveTab("ratelimits")}
        >
          <span>⏱️</span>
          <span>Rate Limits & Unblock</span>
        </button>
      </nav>

      {/* ─── TAB 1: NOTIFICATION OUTBOX ────────────────────────────────────────── */}
      {activeTab === "outbox" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MESSAGE QUEUE & NOTIFICATION WORKER</p>
              <h2>Notification Outbox Diagnostics</h2>
              <p className="muted">
                Inspect encrypted email & SMS outbox rows, retry failed or dead-letter deliveries, and test SMTP dispatch.
              </p>
            </div>
            <div className="panel-actions">
              <button
                className="secondary"
                onClick={handleBatchRetryDead}
                disabled={outboxSummary.dead === 0}
                style={{ fontSize: "11px", padding: "8px 14px" }}
              >
                ↻ Requeue All Dead Letters ({outboxSummary.dead})
              </button>
              <button
                className="primary"
                onClick={() => setShowTestDispatch(true)}
                style={{ fontSize: "11px", padding: "8px 14px" }}
              >
                + Test Gateway Dispatch
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", margin: "20px 0" }}>
            <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>PENDING QUEUE</span>
              <p style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0 0", color: "var(--ink)" }}>{outboxSummary.pending || 0}</p>
            </div>
            <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>PROCESSING LEASES</span>
              <p style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0 0", color: "#1e4e79" }}>{outboxSummary.processing || 0}</p>
            </div>
            <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>DELIVERED SENT</span>
              <p style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0 0", color: "var(--green)" }}>{outboxSummary.sent || 0}</p>
            </div>
            <div style={{ padding: "14px", background: outboxSummary.dead > 0 ? "#fdf2f2" : "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>DEAD LETTERS (EXHAUSTED)</span>
              <p style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0 0", color: outboxSummary.dead > 0 ? "var(--red)" : "inherit" }}>
                {outboxSummary.dead || 0}
              </p>
            </div>
          </div>

          <div className="filters">
            <select value={outboxStatus} onChange={(e) => setOutboxStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="dead">Dead Letters Only</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="sent">Sent</option>
            </select>
            <select value={outboxChannel} onChange={(e) => setOutboxChannel(e.target.value)}>
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <input
              type="search"
              placeholder="Filter by idempotency key or error code..."
              value={outboxSearch}
              onChange={(e) => setOutboxSearch(e.target.value)}
            />
            <button className="primary" onClick={loadOutbox}>Search</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CHANNEL</th>
                  <th>RECIPIENT & TEMPLATE</th>
                  <th>STATUS</th>
                  <th>ATTEMPTS</th>
                  <th>LAST ERROR</th>
                  <th>TIMESTAMPS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loadingOutbox ? (
                  <tr><td colSpan={7} className="empty">Loading outbox queue...</td></tr>
                ) : outboxItems.length === 0 ? (
                  <tr><td colSpan={7} className="empty">No notification records matching criteria.</td></tr>
                ) : (
                  outboxItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>{item.channel}</span>
                        {item.tenantName && <small>{item.tenantName}</small>}
                      </td>
                      <td>
                        <strong>{item.recipient}</strong>
                        <small>{item.subject || item.template}</small>
                      </td>
                      <td>
                        <span className={`status badge-${item.status}`}>{item.status}</span>
                      </td>
                      <td>
                        <strong>{item.attempts} / {item.maxAttempts}</strong>
                      </td>
                      <td>
                        {item.lastErrorCode ? (
                          <span style={{ color: "var(--red)", fontFamily: "monospace", fontSize: "10px" }}>
                            {item.lastErrorCode}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <small>Created: {new Date(item.createdAt).toLocaleTimeString()}</small>
                        {item.sentAt && <small style={{ color: "var(--green)" }}>Sent: {new Date(item.sentAt).toLocaleTimeString()}</small>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="secondary-btn-sm"
                            onClick={() => setInspectOutbox(item)}
                            title="Inspect decrypted payload"
                          >
                            Inspect
                          </button>
                          <button
                            className="secondary-btn-sm"
                            onClick={() => handleRetryOutbox(item.id)}
                            title="Reset attempts and queue immediately"
                          >
                            Retry
                          </button>
                          {item.status !== "sent" && item.status !== "dead" && (
                            <button
                              className="secondary-btn-sm"
                              style={{ color: "var(--red)" }}
                              onClick={() => handleCancelOutbox(item.id)}
                              title="Discard notification"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB 2: PAYMENTS & RECONCILIATION ──────────────────────────────────── */}
      {activeTab === "payments" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">FINANCIAL TRANSACTIONS & DARAJA WEBHOOKS</p>
              <h2>Payment Reconciler & Daraja Query</h2>
              <p className="muted">
                Inspect and force-reconcile transactions across church donations and storefront commerce orders, test live Safaricom STK queries, and view raw webhook payloads.
              </p>
            </div>
            <div className="panel-actions">
              <button
                className="secondary"
                onClick={() => {
                  setStkQueryCheckoutId("");
                  setStkQueryResult(null);
                  setShowStkQueryModal(true);
                }}
                style={{ fontSize: "11px", padding: "8px 14px" }}
              >
                🔍 Live Daraja Query
              </button>
              <button className="secondary" onClick={loadPayments} style={{ fontSize: "11px", padding: "8px 14px" }}>
                ↻ Refresh Transactions
              </button>
            </div>
          </div>

          <div className="filters">
            <select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)}>
              <option value="all">All Sources (Donations & Store Orders)</option>
              <option value="church_donation">Church Donations Only</option>
              <option value="commerce_order">Commerce Store Orders Only</option>
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="all">All Transaction Statuses</option>
              <option value="pending">Pending (Unconfirmed)</option>
              <option value="succeeded">Succeeded (Verified)</option>
              <option value="failed">Failed / Cancelled</option>
            </select>
            <input
              type="search"
              placeholder="Search by receipt, phone, name, order #, or checkoutRequestID..."
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
            />
            <button className="primary" onClick={loadPayments}>Search</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SOURCE & WORKSPACE</th>
                  <th>CUSTOMER & PHONE</th>
                  <th>AMOUNT & PROVIDER</th>
                  <th>RECEIPT / CHECKOUT ID</th>
                  <th>STATUS</th>
                  <th>TIME</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayments ? (
                  <tr><td colSpan={7} className="empty">Loading payment transactions...</td></tr>
                ) : paymentItems.length === 0 ? (
                  <tr><td colSpan={7} className="empty">No payment transactions found matching filter.</td></tr>
                ) : (
                  paymentItems.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span style={{
                          display: "inline-block",
                          font: "9px ui-monospace,monospace",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          marginBottom: "4px",
                          background: tx.source === "commerce_order" ? "#e7f0fa" : "#eef3ef",
                          color: tx.source === "commerce_order" ? "#1e4e79" : "#214a35",
                          fontWeight: 700,
                        }}>
                          {tx.source === "commerce_order" ? (tx.orderNumber ? `ORDER #${tx.orderNumber}` : "STORE ORDER") : "CHURCH DONATION"}
                        </span>
                        <strong>{tx.tenantName || "Workspace"}</strong>
                      </td>
                      <td>
                        <strong>{tx.customerName || "Anonymous Customer"}</strong>
                        <small>{tx.customerContact || "No contact info"}</small>
                      </td>
                      <td>
                        <strong>{(tx.amountMinor / 100).toLocaleString()} {tx.currency}</strong>
                        <small>{tx.provider}</small>
                      </td>
                      <td>
                        {tx.providerReference ? (
                          <span className="copy-pill" title="Click to copy receipt code" onClick={() => {
                            navigator.clipboard.writeText(tx.providerReference!);
                            notify("success", "Receipt copied to clipboard.");
                          }}>
                            {tx.providerReference}
                          </span>
                        ) : tx.checkoutRequestId ? (
                          <span
                            className="copy-pill"
                            style={{ fontFamily: "monospace", fontSize: "10px" }}
                            title="Click to copy CheckoutRequestID"
                            onClick={() => {
                              navigator.clipboard.writeText(tx.checkoutRequestId!);
                              notify("success", "CheckoutRequestID copied to clipboard.");
                            }}
                          >
                            {tx.checkoutRequestId.slice(0, 16)}...
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`status ${tx.status === "succeeded" ? "status-active" : tx.status === "failed" ? "status-closed" : "status-provisioning"}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>
                        <small>{new Date(tx.createdAt).toLocaleDateString()}</small>
                        <small className="muted">{new Date(tx.createdAt).toLocaleTimeString()}</small>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {tx.checkoutRequestId && (
                            <button
                              className="secondary-btn-sm"
                              onClick={() => {
                                setStkQueryCheckoutId(tx.checkoutRequestId!);
                                setStkQueryResult(null);
                                setShowStkQueryModal(true);
                              }}
                              title="Query Safaricom STK Push Status"
                            >
                              STK Query
                            </button>
                          )}
                          {Boolean(tx.rawCallback) && (
                            <button
                              className="secondary-btn-sm"
                              onClick={() => setInspectCallback(tx.rawCallback)}
                              title="View raw gateway callback"
                            >
                              Payload
                            </button>
                          )}
                          <button
                            className="secondary-btn-sm"
                            style={{ fontWeight: 600, color: "var(--green)" }}
                            onClick={() => {
                              setReconcileTarget(tx);
                              setReconcileAction(tx.status === "succeeded" ? "mark_failed" : "mark_succeeded");
                              setReconcileRef(tx.providerReference || "");
                            }}
                          >
                            Reconcile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB 3: DNS & CUSTOM DOMAINS ───────────────────────────────────────── */}
      {activeTab === "domains" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CUSTOM DOMAINS & DNS VERIFICATION</p>
              <h2>DNS Diagnostic & Domain Rescue</h2>
              <p className="muted">
                Run live DNS queries on client hostnames, verify TXT challenge records, and execute platform force-verification overrides.
              </p>
            </div>
            <button className="secondary" onClick={loadDomains} style={{ fontSize: "11px", padding: "8px 14px" }}>
              ↻ Refresh Domains
            </button>
          </div>

          <div className="diag-card">
            <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Live DNS Diagnostic Tool</h3>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: "12px" }}>
              Enter any custom hostname to query real-time TXT, A, and CNAME DNS propagation:
            </p>
            <div style={{ display: "flex", gap: "8px", maxWidth: "600px" }}>
              <input
                type="text"
                placeholder="e.g. church.example.org"
                value={dnsDiagnoseHost}
                onChange={(e) => setDnsDiagnoseHost(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "4px" }}
              />
              <button
                className="primary"
                onClick={() => handleRunDnsDiagnosis(dnsDiagnoseHost)}
                disabled={!dnsDiagnoseHost || diagnosingDns}
                style={{ fontSize: "12px", padding: "8px 16px" }}
              >
                {diagnosingDns ? "Querying DNS..." : "Run Diagnostic"}
              </button>
            </div>

            {dnsReport && (
              <div style={{ marginTop: "16px", padding: "14px", background: "#fff", border: "1px solid var(--line)", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>DNS Report for {dnsReport.hostname}</strong>
                  <span className={`status ${dnsReport.tokenMatched ? "status-active" : "status-closed"}`}>
                    {dnsReport.tokenMatched ? "TOKEN MATCHED" : "TOKEN NOT MATCHED"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px", fontSize: "12px" }}>
                  <div>
                    <span className="muted" style={{ fontWeight: 600 }}>Challenge TXT Host:</span>
                    <p style={{ margin: "2px 0 6px", fontFamily: "monospace" }}>{dnsReport.challengeHostname}</p>
                    <span className="muted" style={{ fontWeight: 600 }}>TXT Records Found:</span>
                    <pre className="code-preview" style={{ maxHeight: "90px", margin: "4px 0" }}>
                      {dnsReport.challengeTxtRecords.length ? dnsReport.challengeTxtRecords.join("\n") : "(None)"}
                    </pre>
                  </div>
                  <div>
                    <span className="muted" style={{ fontWeight: 600 }}>Resolved A Records:</span>
                    <p style={{ margin: "2px 0 6px", fontFamily: "monospace" }}>
                      {dnsReport.aRecords.length ? dnsReport.aRecords.join(", ") : "(None)"}
                    </p>
                    <span className="muted" style={{ fontWeight: 600 }}>Resolved CNAME:</span>
                    <p style={{ margin: "2px 0 6px", fontFamily: "monospace" }}>
                      {dnsReport.cnameRecords.length ? dnsReport.cnameRecords.join(", ") : "(None)"}
                    </p>
                  </div>
                </div>

                {dnsReport.issues.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ color: "var(--red)", fontWeight: 600, fontSize: "11px" }}>DETECTED ISSUES:</span>
                    <ul className="diag-list issues">
                      {dnsReport.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                    </ul>
                  </div>
                )}

                {dnsReport.recommendations.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ color: "var(--green)", fontWeight: 600, fontSize: "11px" }}>RECOMMENDED CLIENT ACTIONS:</span>
                    <ul className="diag-list recommendations">
                      {dnsReport.recommendations.map((rec, idx) => <li key={idx}>{rec}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="table-wrap" style={{ marginTop: "24px" }}>
            <table>
              <thead>
                <tr>
                  <th>WORKSPACE</th>
                  <th>HOSTNAME</th>
                  <th>STATUS</th>
                  <th>VERIFIED AT</th>
                  <th>CREATED AT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loadingDomains ? (
                  <tr><td colSpan={6} className="empty">Loading tenant domains...</td></tr>
                ) : domainItems.length === 0 ? (
                  <tr><td colSpan={6} className="empty">No custom domains configured.</td></tr>
                ) : (
                  domainItems.map((dom) => (
                    <tr key={dom.id}>
                      <td>
                        <strong>{dom.tenant_name}</strong>
                        <small className="muted">{dom.tenant_slug}</small>
                      </td>
                      <td>
                        <strong style={{ fontFamily: "monospace" }}>{dom.hostname}</strong>
                      </td>
                      <td>
                        <span className={`status ${dom.status === "active" ? "status-active" : dom.status === "disabled" ? "status-closed" : "status-provisioning"}`}>
                          {dom.status}
                        </span>
                      </td>
                      <td>
                        {dom.verified_at ? (
                          <small style={{ color: "var(--green)" }}>{new Date(dom.verified_at).toLocaleDateString()}</small>
                        ) : (
                          <span className="muted">Unverified</span>
                        )}
                      </td>
                      <td>
                        <small>{new Date(dom.created_at).toLocaleDateString()}</small>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="secondary-btn-sm"
                            onClick={() => handleRunDnsDiagnosis(dom.hostname, dom.id)}
                            title="Query DNS records"
                          >
                            Diagnose
                          </button>
                          {dom.status !== "active" && (
                            <button
                              className="secondary-btn-sm"
                              style={{ color: "var(--green)", fontWeight: 600 }}
                              onClick={() => {
                                setForceVerifyDomainId(dom.id);
                                setForceVerifyReason("");
                              }}
                              title="Superadmin Override: Activate without TXT check"
                            >
                              Force Verify
                            </button>
                          )}
                          <button
                            className="secondary-btn-sm"
                            onClick={() => handleToggleDomainStatus(dom.id, dom.status)}
                          >
                            {dom.status === "disabled" ? "Enable" : "Disable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB 4: USER & AUTH RESCUE ─────────────────────────────────────────── */}
      {activeTab === "users" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">IDENTITY, ACCOUNT LOCKOUTS & CREDENTIAL RESCUE</p>
              <h2>User & Auth Rescue Tool</h2>
              <p className="muted">
                Search users across all organizations, force-verify accounts with bouncing email, generate working emergency password reset links, and revoke active sessions.
              </p>
            </div>
            <button className="secondary" onClick={loadUsers} style={{ fontSize: "11px", padding: "8px 14px" }}>
              ↻ Refresh Directory
            </button>
          </div>

          <div className="filters">
            <input
              type="search"
              placeholder="Search user by email or name..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <button className="primary" onClick={loadUsers}>Search</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>USER</th>
                  <th>EMAIL VERIFIED</th>
                  <th>ORGANIZATIONS & ROLES</th>
                  <th>ACTIVE SESSIONS</th>
                  <th>CREATED</th>
                  <th>EMERGENCY RESCUE ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={6} className="empty">Loading user directory...</td></tr>
                ) : userItems.length === 0 ? (
                  <tr><td colSpan={6} className="empty">No users found matching query.</td></tr>
                ) : (
                  userItems.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </td>
                      <td>
                        {user.emailVerified ? (
                          <span className="status status-active">Verified</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="status status-closed">Unverified</span>
                            <button
                              className="secondary-btn-sm"
                              style={{ color: "var(--green)", fontWeight: 600 }}
                              onClick={() => handleForceVerifyEmail(user.id)}
                              title="Force set emailVerified to true"
                            >
                              Force Verify
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        {user.memberships.length ? (
                          user.memberships.map((m, idx) => (
                            <div key={idx} style={{ fontSize: "11px" }}>
                              <strong>{m.organizationName}</strong>: <span className="muted">{m.role}</span>
                            </div>
                          ))
                        ) : (
                          <span className="muted">No workspace assigned</span>
                        )}
                      </td>
                      <td>
                        <strong>{user.activeSessionsCount} active</strong>
                      </td>
                      <td>
                        <small>{new Date(user.createdAt).toLocaleDateString()}</small>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="secondary-btn-sm"
                            style={{ fontWeight: 600 }}
                            onClick={() => handleEmergencyResetLink(user.id)}
                            title="Generate working one-time reset link"
                          >
                            🔑 Reset Link
                          </button>
                          <button
                            className="secondary-btn-sm"
                            style={{ color: "var(--red)" }}
                            onClick={() => handleRevokeSessions(user.id)}
                            title="Terminate all active user sessions"
                          >
                            Revoke Sessions
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB 5: TENANTS, STATUS & MODULE OVERRIDES ─────────────────────────── */}
      {activeTab === "tenants" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">DISASTER RECOVERY & TENANT CONTROL PLANE</p>
              <h2>Workspace Status, Maintenance & Module Overrides</h2>
              <p className="muted">
                Override tenant status (active/suspended/archived), broadcast maintenance banners, inspect and toggle full module entitlements, and generate disaster recovery snapshots.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px" }}
              >
                {initialTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                onClick={handleDownloadRecoveryExport}
                disabled={exportingRecovery}
                style={{ fontSize: "11px", padding: "8px 14px" }}
                title="Download complete disaster recovery dump for this workspace"
              >
                {exportingRecovery ? "Exporting..." : "📥 Backup Snapshot JSON"}
              </button>
            </div>
          </div>

          {loadingTenantHealth ? (
            <div className="empty" style={{ margin: "30px 0" }}>Loading tenant telemetry...</div>
          ) : tenantHealth ? (
            <div style={{ marginTop: "20px", display: "grid", gap: "20px" }}>
              {/* Telemetry Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>WORKSPACE STATUS</span>
                    <button
                      className="secondary-btn-sm"
                      style={{ fontSize: "10px", padding: "2px 6px" }}
                      onClick={() => setShowStatusModal(true)}
                    >
                      Change
                    </button>
                  </div>
                  <p style={{ margin: "8px 0 0" }}>
                    <span className={`status-pill ${tenantHealth.tenant.status}`}>
                      {tenantHealth.tenant.status.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>DATABASE BINDING TIER</span>
                  <p style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0 0" }}>
                    {tenantHealth.binding.tier.toUpperCase()} ({tenantHealth.binding.state})
                  </p>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>SCHEMA VERSION</span>
                  <p style={{ fontSize: "12px", fontFamily: "monospace", margin: "4px 0 0" }}>
                    {tenantHealth.binding.schema_version || "current"}
                  </p>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>TOTAL GIVING / ORDERS</span>
                  <p style={{ fontSize: "18px", fontWeight: 700, margin: "4px 0 0", color: "var(--green)" }}>
                    {tenantHealth.donations.count} transactions
                  </p>
                </div>
              </div>

              {/* Emergency Maintenance Mode */}
              <div className="diag-card">
                <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Emergency Public Maintenance Mode</h3>
                <p className="muted" style={{ margin: "0 0 16px", fontSize: "12px" }}>
                  When enabled, public visitors to this tenant's storefront or church portal will see a clean maintenance banner.
                </p>
                <form onSubmit={handleSaveMaintenance} style={{ display: "grid", gap: "12px", maxWidth: "600px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={maintenanceEnabled}
                      onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "var(--green)" }}
                    />
                    <strong>Enable Workspace Maintenance Mode</strong>
                  </label>

                  <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Custom Announcement Message:
                    <textarea
                      rows={2}
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="e.g. We are performing scheduled database upgrades. Services will resume at 2:00 PM."
                      style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit", fontSize: "12px" }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                    Audited Reason (Required):
                    <input
                      type="text"
                      value={maintenanceReason}
                      onChange={(e) => setMaintenanceReason(e.target.value)}
                      placeholder="e.g. Routine maintenance or client requested downtime"
                      required
                      style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit", fontSize: "12px" }}
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary"
                    disabled={savingMaintenance}
                    style={{ justifySelf: "start", fontSize: "12px", padding: "8px 16px" }}
                  >
                    {savingMaintenance ? "Saving..." : "Save Maintenance Mode"}
                  </button>
                </form>
              </div>

              {/* Full Module Entitlements Catalog Grid */}
              <div className="diag-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>Tenant Module Entitlements & Overrides</h3>
                    <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                      Inspect all platform catalog modules. Superadmin can break-glass override any module state regardless of tier.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => loadTenantModules(selectedTenantId)}
                    style={{ fontSize: "11px", padding: "6px 12px" }}
                  >
                    ↻ Refresh Modules
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>MODULE NAME & ID</th>
                        <th>CATEGORY</th>
                        <th>TIER</th>
                        <th>CATALOG DEFAULT</th>
                        <th>EFFECTIVE STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTenantModules ? (
                        <tr><td colSpan={6} className="empty">Loading modules catalog...</td></tr>
                      ) : tenantModules.length === 0 ? (
                        <tr><td colSpan={6} className="empty">No module catalog records found.</td></tr>
                      ) : (
                        tenantModules.map((mod) => (
                          <tr key={mod.id}>
                            <td>
                              <strong>{mod.name}</strong>
                              <small className="mono-id">{mod.id}</small>
                            </td>
                            <td>
                              <span style={{ textTransform: "capitalize", fontSize: "11px" }}>{mod.category}</span>
                            </td>
                            <td>
                              <span style={{ font: "10px ui-monospace,monospace", textTransform: "uppercase" }}>{mod.tier}</span>
                            </td>
                            <td>
                              <small>{mod.defaultEnabled ? "Enabled by Default" : "Disabled by Default"}</small>
                            </td>
                            <td>
                              <span className={`status ${mod.effectiveEnabled ? "status-active" : "status-closed"}`}>
                                {mod.effectiveEnabled ? "Active" : "Disabled"}
                              </span>
                              {mod.hasOverride && (
                                <span style={{ marginLeft: "6px", font: "9px ui-monospace,monospace", background: "#fef3c7", color: "#92400e", padding: "2px 5px", borderRadius: "3px" }}>
                                  OVERRIDE
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="secondary-btn-sm"
                                style={{ color: mod.effectiveEnabled ? "var(--red)" : "var(--green)", fontWeight: 600 }}
                                onClick={() => handleForceModuleOverride(mod.id, !mod.effectiveEnabled)}
                              >
                                {mod.effectiveEnabled ? "Force Disable" : "Force Enable"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">Select a workspace to view health and recovery tooling.</div>
          )}
        </section>
      )}

      {/* ─── TAB 6: MIGRATIONS & SCHEMA INSPECTOR ─────────────────────────────── */}
      {activeTab === "migrations" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">DATABASE SCHEMA & MIGRATION GOVERNANCE</p>
              <h2>Database Migrations & Schema Inspector</h2>
              <p className="muted">
                Inspect applied database schema versions, detect lagging tenant database bindings, verify migrations parity, and trigger alignment.
              </p>
            </div>
            <div className="panel-actions">
              <button
                className="secondary"
                onClick={handleSyncTenantBindings}
                disabled={syncingBindings}
                style={{ fontSize: "11px", padding: "8px 14px" }}
              >
                {syncingBindings ? "Syncing..." : "⚡ Align Tenant Bindings"}
              </button>
              <button className="secondary" onClick={loadMigrations} style={{ fontSize: "11px", padding: "8px 14px" }}>
                ↻ Refresh Status
              </button>
            </div>
          </div>

          {loadingMigrations ? (
            <div className="empty" style={{ margin: "30px 0" }}>Querying migration registry and connection pools...</div>
          ) : migrationsData ? (
            <div style={{ marginTop: "20px", display: "grid", gap: "20px" }}>
              {/* Telemetry Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>PLATFORM SCHEMA VERSION</span>
                  <p style={{ fontSize: "12px", fontFamily: "monospace", margin: "6px 0 0", color: "var(--green)", fontWeight: 700 }}>
                    {migrationsData.currentPlatformSchemaVersion}
                  </p>
                </div>
                <div style={{ padding: "14px", background: migrationsData.isUpToDate ? "#f8faf7" : "#fff8e9", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>MIGRATIONS STATUS</span>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0", color: migrationsData.isUpToDate ? "var(--green)" : "#8c6419" }}>
                    {migrationsData.appliedCount} / {migrationsData.totalRequired} Applied
                  </p>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>PENDING MIGRATIONS</span>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0", color: migrationsData.pendingCount > 0 ? "var(--red)" : "inherit" }}>
                    {migrationsData.pendingCount}
                  </p>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>DB POOL CLIENTS</span>
                  <p style={{ fontSize: "18px", fontWeight: 700, margin: "4px 0 0" }}>
                    {migrationsData.poolStatus.totalCount} total ({migrationsData.poolStatus.idleCount} idle)
                  </p>
                </div>
              </div>

              {/* Tenant Bindings Distribution */}
              <div className="diag-card">
                <h3 style={{ margin: "0 0 6px", fontSize: "14px" }}>Tenant Database Bindings Alignment</h3>
                <p className="muted" style={{ margin: "0 0 14px", fontSize: "12px" }}>
                  Tracks the schema release marker recorded in each workspace's database binding:
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {migrationsData.tenantBindingsSummary.map((b, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        background: b.isCurrent ? "#f0f6f2" : "#fff8e9",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 600 }}>{b.schemaVersion}</span>
                        <span className={`status ${b.isCurrent ? "status-active" : "status-provisioning"}`}>
                          {b.isCurrent ? "ALIGNED" : "LAGGING"}
                        </span>
                      </div>
                      <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                        {b.count} workspace(s) on this release
                      </small>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Migrations Parity Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>MIGRATION SCRIPT</th>
                      <th>STATUS</th>
                      <th>APPLIED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrationsData.migrations.map((m, idx) => (
                      <tr key={m.version}>
                        <td style={{ color: "var(--muted)", font: "10px ui-monospace,monospace" }}>{idx + 1}</td>
                        <td>
                          <strong style={{ fontFamily: "monospace" }}>{m.version}</strong>
                        </td>
                        <td>
                          {m.applied ? (
                            <span className="badge-applied">✓ Applied</span>
                          ) : (
                            <span className="badge-missing">⚠ Pending</span>
                          )}
                        </td>
                        <td>
                          {m.appliedAt ? (
                            <small>{new Date(m.appliedAt).toLocaleString()}</small>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty">Could not load migration telemetry.</div>
          )}
        </section>
      )}

      {/* ─── TAB 7: STORAGE & ASSET QUOTAS ─────────────────────────────────────── */}
      {activeTab === "storage" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MEDIA STORAGE & TENANT ASSET GOVERNANCE</p>
              <h2>Storage & Asset Quota Inspector</h2>
              <p className="muted">
                Inspect media consumption per workspace, monitor high-resolution banner and photo storage, and adjust tenant asset quotas.
              </p>
            </div>
            <button className="secondary" onClick={loadStorageUsage} style={{ fontSize: "11px", padding: "8px 14px" }}>
              ↻ Refresh Storage Telemetry
            </button>
          </div>

          {loadingStorage ? (
            <div className="empty" style={{ margin: "30px 0" }}>Scanning storage driver and tenant assets...</div>
          ) : storageData ? (
            <div style={{ marginTop: "20px", display: "grid", gap: "20px" }}>
              {/* Storage Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>ACTIVE STORAGE DRIVER</span>
                  <p style={{ fontSize: "18px", fontWeight: 700, margin: "4px 0 0", textTransform: "uppercase" }}>
                    {storageData.driver} STORAGE
                  </p>
                  <small className="muted">{storageData.driver === "s3" ? "Object Storage (S3 API)" : "Local Filesystem Media"}</small>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>DEFAULT WORKSPACE QUOTA</span>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0", color: "var(--green)" }}>
                    {storageData.defaultQuotaMb} MB
                  </p>
                  <small className="muted">Applied to all standard tier workspaces</small>
                </div>
                <div style={{ padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                  <span className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>MANAGED WORKSPACES</span>
                  <p style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0 0" }}>
                    {storageData.totalTenants}
                  </p>
                  <small className="muted">Active tenant asset containers</small>
                </div>
              </div>

              {/* Tenants Media Usage Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>WORKSPACE</th>
                      <th>UPLOADED ASSETS</th>
                      <th>ESTIMATED SIZE</th>
                      <th>QUOTA LIMIT</th>
                      <th>USAGE %</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageData.items.length === 0 ? (
                      <tr><td colSpan={6} className="empty">No workspaces found.</td></tr>
                    ) : (
                      storageData.items.map((item) => {
                        const fillClass = item.percentUsed > 90 ? "quota-fill-red" : item.percentUsed > 70 ? "quota-fill-amber" : "quota-fill-green";
                        return (
                          <tr key={item.tenantId}>
                            <td>
                              <strong>{item.tenantName}</strong>
                              <small className="muted">{item.tenantSlug}</small>
                            </td>
                            <td>
                              <strong>{item.assetCount}</strong> <small className="muted">media files</small>
                            </td>
                            <td>
                              <strong>{(item.estimatedSizeBytes / (1024 * 1024)).toFixed(1)} MB</strong>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{item.quotaMb} MB</span>
                              {item.quotaMb !== storageData.defaultQuotaMb && (
                                <span style={{ marginLeft: "6px", font: "9px ui-monospace,monospace", background: "#fef3c7", color: "#92400e", padding: "1px 4px", borderRadius: "3px" }}>
                                  CUSTOM
                                </span>
                              )}
                            </td>
                            <td style={{ minWidth: "140px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                                <span>{item.percentUsed}%</span>
                              </div>
                              <div className="quota-progress-bar">
                                <div className={`quota-progress-fill ${fillClass}`} style={{ width: `${item.percentUsed}%` }} />
                              </div>
                            </td>
                            <td>
                              <button
                                className="secondary-btn-sm"
                                onClick={() => {
                                  setQuotaTarget(item);
                                  setQuotaInputMb(item.quotaMb);
                                  setQuotaReason("");
                                }}
                              >
                                Adjust Quota
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty">Could not load storage data.</div>
          )}
        </section>
      )}

      {/* ─── TAB 8: RATE LIMITS ─────────────────────────────────────────────────── */}
      {activeTab === "ratelimits" && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">TRAFFIC CONTROL & ABUSE PROTECTION</p>
              <h2>Rate Limiting</h2>
              <p className="muted">
                Inspect the configured throttling rules for API endpoints and authentication routes.
              </p>
            </div>
            <button className="secondary" onClick={loadRateLimits} style={{ fontSize: "11px", padding: "8px 14px" }}>
              ↻ Refresh Policies
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "18px" }}>
            {/* Manual reset is intentionally unavailable until both stores support it. */}
            <div className="diag-card" style={{ margin: 0 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Manual counter reset unavailable</h3>
              <p className="muted" role="status" style={{ margin: "0 0 16px", fontSize: "12px" }}>
                Current API and authentication rate-limit stores expire counters automatically but do not expose targeted reset operations.
              </p>
            </div>

            {/* Active Policies Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="muted" style={{ fontSize: "11px", fontWeight: 700 }}>ACTIVE RATE LIMIT RULES</span>
                <span className="status status-active">ENFORCING</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PROTECTED ROUTE</th>
                      <th>WINDOW</th>
                      <th>MAX REQUESTS</th>
                      <th>KEY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateLimitsData?.policies.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ fontFamily: "monospace", fontSize: "11px" }}>{p.route}</strong>
                        </td>
                        <td>{p.window}</td>
                        <td><strong>{p.maxRequests} req</strong></td>
                        <td><small className="muted">{p.keyType}</small></td>
                      </tr>
                    )) ?? (
                      <tr><td colSpan={4} className="empty">Loading rate limit policies...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── MODAL: INSPECT NOTIFICATION PAYLOAD ──────────────────────────────── */}
      {inspectOutbox && (
        <div className="modal-backdrop" onClick={() => setInspectOutbox(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "580px" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">DECRYPTED PAYLOAD INSPECTOR</p>
                <h2>Outbox Message Details</h2>
              </div>
              <button className="modal-close" onClick={() => setInspectOutbox(null)}>✕</button>
            </div>
            <div style={{ marginTop: "16px", display: "grid", gap: "10px", fontSize: "12px" }}>
              <div><strong>Recipient:</strong> <span style={{ fontFamily: "monospace" }}>{inspectOutbox.recipient}</span></div>
              <div><strong>Channel:</strong> {inspectOutbox.channel.toUpperCase()}</div>
              <div><strong>Subject:</strong> {inspectOutbox.subject || "—"}</div>
              <div><strong>Template:</strong> <code>{inspectOutbox.template}</code></div>
              <div><strong>Idempotency Key:</strong> <span className="mono-id">{inspectOutbox.idempotencyKey}</span></div>
              <div>
                <strong>Payload Variables:</strong>
                <pre className="code-preview" style={{ marginTop: "6px" }}>
                  {JSON.stringify(inspectOutbox.variables, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "18px" }}>
              <button className="secondary" onClick={() => setInspectOutbox(null)}>Close</button>
              <button
                className="primary"
                onClick={() => {
                  handleRetryOutbox(inspectOutbox.id);
                  setInspectOutbox(null);
                }}
              >
                Requeue Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: TEST GATEWAY DISPATCH ────────────────────────────────────── */}
      {showTestDispatch && (
        <div className="modal-backdrop" onClick={() => setShowTestDispatch(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">GATEWAY CONNECTIVITY TEST</p>
                <h2>Dispatch Test Notification</h2>
              </div>
              <button className="modal-close" onClick={() => setShowTestDispatch(false)}>✕</button>
            </div>
            <form onSubmit={handleTestDispatch} className="modal-form">
              <label>
                Channel
                <select value={testChannel} onChange={(e) => setTestChannel(e.target.value as "email" | "sms")}>
                  <option value="email">Email (SMTP)</option>
                  <option value="sms">SMS Gateway</option>
                </select>
              </label>
              <label>
                Recipient Address / Phone
                <input
                  type="text"
                  placeholder={testChannel === "email" ? "admin@example.org" : "254712345678"}
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  required
                />
              </label>
              {testChannel === "email" && (
                <label>
                  Subject Line
                  <input
                    type="text"
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    placeholder="Diagnostics Gateway Ping"
                  />
                </label>
              )}
              <label>
                Test Message
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Testing notification outbox gateway connectivity."
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowTestDispatch(false)}>Cancel</button>
                <button type="submit" className="primary">Enqueue Test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RECONCILE PAYMENT ────────────────────────────────────────── */}
      {reconcileTarget && (
        <div className="modal-backdrop" onClick={() => setReconcileTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">AUDITED PAYMENT RECONCILIATION</p>
                <h2>Reconcile Transaction</h2>
              </div>
              <button className="modal-close" onClick={() => setReconcileTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleReconcilePayment} className="modal-form">
              <div style={{ padding: "10px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "12px" }}>
                <div><strong>Source:</strong> {reconcileTarget.source === "commerce_order" ? "Store Order" : "Church Donation"}</div>
                <div><strong>Amount:</strong> {(reconcileTarget.amountMinor / 100).toLocaleString()} {reconcileTarget.currency}</div>
                <div><strong>Customer:</strong> {reconcileTarget.customerName} ({reconcileTarget.customerContact})</div>
                <div><strong>Current Status:</strong> <span className="status status-provisioning">{reconcileTarget.status}</span></div>
              </div>

              <label>
                Target Status
                <select value={reconcileAction} onChange={(e) => setReconcileAction(e.target.value as any)}>
                  <option value="mark_succeeded">Force Mark Succeeded (Confirm Payment)</option>
                  <option value="mark_failed">Force Mark Failed / Cancelled</option>
                </select>
              </label>

              <label>
                M-Pesa / Gateway Receipt Reference
                <input
                  type="text"
                  placeholder="e.g. QGH789234"
                  value={reconcileRef}
                  onChange={(e) => setReconcileRef(e.target.value)}
                />
              </label>

              <label>
                Mandatory Operator Justification (Audited)
                <textarea
                  rows={2}
                  placeholder="e.g. Customer provided Safaricom SMS receipt QGH789234, verified in Daraja portal."
                  value={reconcileReason}
                  onChange={(e) => setReconcileReason(e.target.value)}
                  required
                  style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit", fontSize: "12px" }}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setReconcileTarget(null)}>Cancel</button>
                <button type="submit" className="primary">Confirm Reconcile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DARAJA STK QUERY ─────────────────────────────────────────── */}
      {showStkQueryModal && (
        <div className="modal-backdrop" onClick={() => setShowStkQueryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">SAFARICOM GATEWAY QUERY TOOL</p>
                <h2>Live Daraja STK Push Query</h2>
              </div>
              <button className="modal-close" onClick={() => setShowStkQueryModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQueryStkStatus} className="modal-form">
              <label>
                CheckoutRequestID (ws_CO_...)
                <input
                  type="text"
                  placeholder="ws_CO_12042026112035..."
                  value={stkQueryCheckoutId}
                  onChange={(e) => setStkQueryCheckoutId(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowStkQueryModal(false)}>Close</button>
                <button type="submit" className="primary" disabled={queryingStk}>
                  {queryingStk ? "Querying Gateway..." : "Query Safaricom STK Status"}
                </button>
              </div>
            </form>

            {stkQueryResult && (
              <div style={{ marginTop: "18px", padding: "14px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Gateway Response</strong>
                  <span className={`status ${stkQueryResult.result?.resultCode === "0" ? "status-active" : "status-closed"}`}>
                    RESULT CODE: {stkQueryResult.result?.resultCode ?? "N/A"}
                  </span>
                </div>
                {stkQueryResult.notice && (
                  <p className="muted" style={{ fontSize: "11px", margin: "6px 0", color: "#8c6419" }}>
                    ℹ {stkQueryResult.notice}
                  </p>
                )}
                <pre className="code-preview" style={{ marginTop: "8px", maxHeight: "200px" }}>
                  {JSON.stringify(stkQueryResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: INSPECT RAW CALLBACK ─────────────────────────────────────── */}
      {Boolean(inspectCallback) && (
        <div className="modal-backdrop" onClick={() => setInspectCallback(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">RAW WEBHOOK PAYLOAD</p>
                <h2>Gateway Callback Data</h2>
              </div>
              <button className="modal-close" onClick={() => setInspectCallback(null)}>✕</button>
            </div>
            <pre className="code-preview" style={{ marginTop: "16px", maxHeight: "350px" }}>
              {JSON.stringify(inspectCallback, null, 2)}
            </pre>
            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button className="primary" onClick={() => setInspectCallback(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: FORCE VERIFY DOMAIN OVERRIDE ─────────────────────────────── */}
      {forceVerifyDomainId && (
        <div className="modal-backdrop" onClick={() => setForceVerifyDomainId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">SUPERADMIN OVERRIDE</p>
                <h2>Force Verify Domain</h2>
              </div>
              <button className="modal-close" onClick={() => setForceVerifyDomainId(null)}>✕</button>
            </div>
            <form onSubmit={handleForceVerifyDomain} className="modal-form">
              <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                This activates the custom domain immediately without waiting for DNS TXT propagation. Use only when you have manually confirmed domain ownership.
              </p>
              <label>
                Audit Justification (Required)
                <textarea
                  rows={2}
                  placeholder="e.g. Domain belongs to verified enterprise client; DNS is managed behind Cloudflare."
                  value={forceVerifyReason}
                  onChange={(e) => setForceVerifyReason(e.target.value)}
                  required
                  style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit", fontSize: "12px" }}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setForceVerifyDomainId(null)}>Cancel</button>
                <button type="submit" className="danger">Force Activate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: TENANT STATUS OVERRIDE ───────────────────────────────────── */}
      {showStatusModal && (
        <div className="modal-backdrop" onClick={() => setShowStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">CONTROL PLANE STATE TRANSITION</p>
                <h2>Workspace Status Override</h2>
              </div>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveStatusOverride} className="modal-form">
              <label>
                Target Workspace Status
                <select value={newTenantStatus} onChange={(e) => setNewTenantStatus(e.target.value as any)}>
                  <option value="active">Active (Fully Operational)</option>
                  <option value="suspended">Suspended (Billing / Violation Lock)</option>
                  <option value="maintenance">Maintenance (Public Banner Mode)</option>
                  <option value="archived">Archived (Decommissioned)</option>
                </select>
              </label>
              <label>
                Audit Justification (Required)
                <textarea
                  rows={2}
                  placeholder="e.g. Customer billing dispute resolved; restoring full access per ticket #884."
                  value={statusOverrideReason}
                  onChange={(e) => setStatusOverrideReason(e.target.value)}
                  required
                  style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit", fontSize: "12px" }}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={savingStatusOverride}>
                  {savingStatusOverride ? "Saving..." : "Apply Status Transition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADJUST STORAGE QUOTA ─────────────────────────────────────── */}
      {quotaTarget && (
        <div className="modal-backdrop" onClick={() => setQuotaTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">ASSET ALLOCATION OVERRIDE</p>
                <h2>Adjust Workspace Storage Quota</h2>
              </div>
              <button className="modal-close" onClick={() => setQuotaTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveQuotaOverride} className="modal-form">
              <div style={{ padding: "10px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "12px" }}>
                <div><strong>Workspace:</strong> {quotaTarget.tenantName} ({quotaTarget.tenantSlug})</div>
                <div><strong>Current Usage:</strong> {(quotaTarget.estimatedSizeBytes / (1024 * 1024)).toFixed(1)} MB ({quotaTarget.assetCount} assets)</div>
              </div>

              <label>
                Storage Quota Allocation (in Megabytes):
                <input
                  type="number"
                  min={50}
                  max={102400}
                  value={quotaInputMb}
                  onChange={(e) => setQuotaInputMb(Number(e.target.value))}
                  required
                />
              </label>

              <label>
                Audited Reason (Required):
                <textarea
                  rows={2}
                  placeholder="e.g. Upgraded to premium media package or large media asset library."
                  value={quotaReason}
                  onChange={(e) => setQuotaReason(e.target.value)}
                  required
                  style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit", fontSize: "12px" }}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setQuotaTarget(null)}>Cancel</button>
                <button type="submit" className="primary" disabled={savingQuota}>
                  {savingQuota ? "Saving..." : "Save Storage Quota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EMERGENCY PASSWORD RESET URL ─────────────────────────────── */}
      {generatedResetUrl && (
        <div className="modal-backdrop" onClick={() => setGeneratedResetUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">EMERGENCY CREDENTIAL LINK GENERATED</p>
                <h2>Password Reset Link Ready</h2>
              </div>
              <button className="modal-close" onClick={() => setGeneratedResetUrl(null)}>✕</button>
            </div>
            <div style={{ marginTop: "16px", fontSize: "12px" }}>
              <p className="muted" style={{ margin: "0 0 10px" }}>
                Provide this verified one-time URL directly to the client. Better-Auth will validate the token on submission. Link expires in 1 hour:
              </p>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={generatedResetUrl}
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}
                />
                <button
                  className="primary"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedResetUrl);
                    notify("success", "Reset link copied to clipboard.");
                  }}
                  style={{ fontSize: "11px", padding: "8px 12px" }}
                >
                  Copy Link
                </button>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "18px" }}>
              <button className="secondary" onClick={() => setGeneratedResetUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
