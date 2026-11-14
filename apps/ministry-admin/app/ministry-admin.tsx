"use client";

import { useCallback, useEffect, useState } from "react";
import { pulse } from "@bazion/ui";
import { authClient } from "@bazion/auth/client";
import { SiteSettingsEditor } from "./site-settings-editor";
import { MediaUploadField } from "./media-upload-field";
import { apiErrorMessage } from "../lib/api-error";
import { globalMissionConfig } from "@bazion/church-ministry-template";
import { slugifyContentTitle } from "@bazion/church-ministry-domain";

type Tab =
  | "overview"
  | "site"
  | "departments"
  | "groups"
  | "volunteers"
  | "inventory"
  | "sermons"
  | "events"
  | "campaigns"
  | "registrations"
  | "donations"
  | "messages"
  | "prayers"
  | "newsletter";

type Sermon = { id: string; title: string; slug: string; speaker: string; status: string; publishedAt: string | null };
type ChurchEvent = { id: string; title: string; slug: string; startsAt: string; venue: string | null; registrationEnabled: boolean; status: string };
type Campaign = { id: string; title: string; slug: string; description: string | null; targetAmountMinor: number; raisedAmountMinor: number; currency: string; status: string; createdAt: string };
type Registration = { id: string; eventTitle: string; fullName: string; email: string; telephone: string; registrationReference: string; status: string; createdAt: string };
type Donation = { id: string; donorName: string | null; donorPhone: string | null; anonymous: boolean; amountMinor: number; currency: string; givingCategory: string; paymentMethod: string; paymentStatus: string; createdAt: string };
type Message = { id: string; fullName: string; email: string; subject: string; message: string; category: string; status: string; createdAt: string };
type Prayer = { id: string; fullName: string; email: string | null; telephone: string | null; requestText: string; status: string; createdAt: string };
type NewsletterSubscriber = { id: string; email: string; consentAt: string; status: string };
type Overview = { sermonCount: number; eventCount: number; registrationCount: number; donationCount: number; totalRaisedMinor: number; pendingPrayers: number; newMessages: number };

type DepartmentItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  leaderName: string | null;
  leaderRole: string | null;
  meetingSchedule: string | null;
  contactEmail: string | null;
  icon: string | null;
  displayOrder: number;
  status: string;
};

type GroupItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  leaderName: string;
  leaderEmail: string | null;
  leaderPhone: string | null;
  meetingSchedule: string;
  locationName: string | null;
  publicLocationLabel: string;
  acceptingMembers: boolean;
  status: string;
};

type VolunteerTeamItem = {
  id: string;
  name: string;
  slug: string;
  departmentId: string | null;
  departmentName?: string;
  description: string;
  requirements: string | null;
  coordinatorName: string | null;
  coordinatorEmail: string | null;
  coordinatorPhone: string | null;
  acceptingApplications: boolean;
  status: string;
};

type InventoryAssetItem = {
  id: string;
  name: string;
  assetTag: string | null;
  category: string;
  location: string;
  condition: string;
  status: string;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCostMinor: number | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  notes: string | null;
};

function extractYouTubeVideoId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{5,})/);
  if (shortMatch?.[1]) return shortMatch[1];
  const longMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{5,})/);
  if (longMatch?.[1]) return longMatch[1];
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{5,})/);
  if (embedMatch?.[1]) return embedMatch[1];
  const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{5,})/);
  if (liveMatch?.[1]) return liveMatch[1];
  return trimmed;
}

function getNextDayOfWeek(dayOfWeek: number, hour = 10, minute = 0): string {
  const d = new Date();
  const currentDay = d.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  d.setDate(d.getDate() + daysUntil);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EmptyStateGuide({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="admin-empty-guide">
      <div className="admin-empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="ch-btn ch-btn-primary" style={{ marginTop: 8 }} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const result = await response.json().catch(() => null) as T | null;
  if (!response.ok) throw new Error(apiErrorMessage(result, response.status));
  return result as T;
}

export function MinistryAdminDashboard() {
  const session = authClient.useSession();
  const activeOrganization = authClient.useActiveOrganization();
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [newsletterSubscribers, setNewsletterSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [volunteerTeams, setVolunteerTeams] = useState<VolunteerTeamItem[]>([]);
  const [inventoryAssets, setInventoryAssets] = useState<InventoryAssetItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sensitiveAccess, setSensitiveAccess] = useState(true);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);

  // Existing forms
  const [sermonForm, setSermonForm] = useState({ title: "", speaker: "", description: "", scriptureReference: "", youtubeVideoId: "", thumbnailUrl: "", status: "draft" as "draft" | "published" });
  const [eventForm, setEventForm] = useState({ title: "", description: "", startsAt: "", endsAt: "", venue: "", address: "", posterUrl: "", registrationCapacity: "", registrationEnabled: true });
  const [campaignForm, setCampaignForm] = useState({ title: "", description: "", targetAmountKsh: "", startsAt: "", endsAt: "" });

  // Operations forms
  const [deptForm, setDeptForm] = useState({ name: "", leaderName: "", leaderRole: "", meetingSchedule: "", contactEmail: "", description: "", icon: "" });
  const [groupForm, setGroupForm] = useState({ name: "", category: "Home Fellowship", leaderName: "", leaderEmail: "", leaderPhone: "", meetingSchedule: "", locationName: "", publicLocationLabel: "", acceptingMembers: true, description: "" });
  const [volunteerTeamForm, setVolunteerTeamForm] = useState({ name: "", departmentId: "", description: "", requirements: "", coordinatorName: "", coordinatorEmail: "", coordinatorPhone: "", acceptingApplications: true });
  const [assetForm, setAssetForm] = useState({ name: "", category: "Audio/Visual", location: "Main Sanctuary", condition: "good" as "excellent" | "good" | "fair" | "needs_repair", status: "available" as "available" | "in_use" | "maintenance" | "reserved", serialNumber: "", purchaseCostKsh: "", notes: "", assetTag: "" });

  useEffect(() => {
    if (!session.data || !activeOrganization.data?.id) return;
    let active = true;
    setLoading(true);
    setError("");
    Promise.allSettled([
      apiRequest<Overview>("/v1/admin/church/overview"),
      apiRequest<{ items: Sermon[] }>("/v1/admin/church/sermons"),
      apiRequest<{ events: ChurchEvent[] }>("/v1/admin/church/events"),
      apiRequest<{ campaigns: Campaign[] }>("/v1/admin/church/campaigns"),
      apiRequest<{ registrations: Registration[] }>("/v1/admin/church/registrations"),
      apiRequest<{ donations: Donation[] }>("/v1/admin/church/donations"),
      apiRequest<{ messages: Message[] }>("/v1/admin/church/messages"),
      apiRequest<{ prayers: Prayer[] }>("/v1/admin/church/prayers"),
      apiRequest<{ subscribers: NewsletterSubscriber[] }>("/v1/admin/church/newsletter"),
      apiRequest<{ items: DepartmentItem[] }>("/v1/admin/church/departments"),
      apiRequest<{ items: GroupItem[] }>("/v1/admin/church/groups"),
      apiRequest<{ items: VolunteerTeamItem[] }>("/v1/admin/church/volunteer-teams"),
      apiRequest<{ items: InventoryAssetItem[] }>("/v1/admin/church/inventory-assets"),
    ]).then(([summary, sermonResult, eventResult, campaignResult, registrationResult, donationResult, messageResult, prayerResult, newsletterResult, deptResult, groupResult, volResult, assetResult]) => {
      if (!active) return;
      if (summary.status === "rejected") throw summary.reason;
      setOverview(summary.value as Overview);
      setSermons(sermonResult.status === "fulfilled" ? sermonResult.value.items : []);
      setEvents(eventResult.status === "fulfilled" ? eventResult.value.events : []);
      setCampaigns(campaignResult.status === "fulfilled" ? campaignResult.value.campaigns : []);
      setRegistrations(registrationResult.status === "fulfilled" ? registrationResult.value.registrations : []);
      setDonations(donationResult.status === "fulfilled" ? donationResult.value.donations : []);
      setMessages(messageResult.status === "fulfilled" ? messageResult.value.messages : []);
      setPrayers(prayerResult.status === "fulfilled" ? prayerResult.value.prayers : []);
      setNewsletterSubscribers(newsletterResult.status === "fulfilled" ? newsletterResult.value.subscribers : []);
      setDepartments(deptResult.status === "fulfilled" ? deptResult.value.items : []);
      setGroups(groupResult.status === "fulfilled" ? groupResult.value.items : []);
      setVolunteerTeams(volResult.status === "fulfilled" ? volResult.value.items : []);
      setInventoryAssets(assetResult.status === "fulfilled" ? assetResult.value.items : []);
      setSensitiveAccess([registrationResult, donationResult, messageResult, prayerResult, newsletterResult].every((result) => result.status === "fulfilled"));
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load ministry records.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.data, activeOrganization.data?.id, reloadKey]);

  const changeStatus = useCallback(async (kind: "messages" | "prayers", id: string, status: string) => {
    setBusy(true); setNotice("");
    try {
      await apiRequest(`/v1/admin/church/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setReloadKey((value) => value + 1);
      setNotice("Record updated.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not update the record."); }
    finally { setBusy(false); }
  }, []);

  async function createSermon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await pulse.track(
        () =>
          apiRequest("/v1/admin/church/sermons", {
            method: "POST",
            body: JSON.stringify({
              ...sermonForm,
              slug: slugifyContentTitle(sermonForm.title, "sermon"),
              thumbnailUrl: sermonForm.thumbnailUrl.trim() || undefined,
              youtubeVideoId: sermonForm.youtubeVideoId || undefined,
              scriptureReference: sermonForm.scriptureReference || undefined,
              status: sermonForm.status,
            }),
          }),
        {
          pending: "Saving sermon…",
          success: sermonForm.status === "published" ? "Sermon published" : "Sermon saved as draft",
          group: "ministry:sermon",
        },
      );
      const savedStatus = sermonForm.status;
      setSermonForm({ title: "", speaker: "", description: "", scriptureReference: "", youtubeVideoId: "", thumbnailUrl: "", status: "draft" });
      setReloadKey((value) => value + 1); setNotice(savedStatus === "published" ? "Sermon published." : "Sermon saved as a draft.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not save the sermon."); }
    finally { setBusy(false); }
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    if (eventForm.endsAt && new Date(eventForm.endsAt) < new Date(eventForm.startsAt)) {
      const msg = "Event end time must be after the start time.";
      setNotice(msg);
      pulse.warning(msg);
      setBusy(false);
      return;
    }
    try {
      const result = await pulse.track(
        () =>
          apiRequest<{ event: { slug: string } }>("/v1/admin/church/events", {
            method: "POST",
            body: JSON.stringify({
              ...eventForm,
              slug: slugifyContentTitle(eventForm.title, "event"),
              description: eventForm.description.trim() || undefined,
              posterUrl: eventForm.posterUrl.trim() || undefined,
              startsAt: new Date(eventForm.startsAt).toISOString(),
              endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : undefined,
              registrationCapacity: eventForm.registrationCapacity ? Number(eventForm.registrationCapacity) : undefined,
            }),
          }),
        {
          pending: "Creating ministry event…",
          success: `Event created (/events/${eventForm.title})`,
          group: "ministry:event",
        },
      );
      setEventForm({ title: "", description: "", startsAt: "", endsAt: "", venue: "", address: "", posterUrl: "", registrationCapacity: "", registrationEnabled: true });
      setReloadKey((value) => value + 1); setNotice(`Event created. Its page link is /events/${result.event.slug}.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not create the event."); }
    finally { setBusy(false); }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await pulse.track(
        () =>
          apiRequest("/v1/admin/church/campaigns", {
            method: "POST",
            body: JSON.stringify({
              ...campaignForm,
              slug: slugifyContentTitle(campaignForm.title, "campaign"),
              targetAmountKsh: Number(campaignForm.targetAmountKsh),
              startsAt: campaignForm.startsAt ? new Date(campaignForm.startsAt).toISOString() : undefined,
              endsAt: campaignForm.endsAt ? new Date(campaignForm.endsAt).toISOString() : undefined,
            }),
          }),
        {
          pending: "Creating giving campaign…",
          success: "Giving campaign created",
          group: "ministry:campaign",
        },
      );
      setCampaignForm({ title: "", description: "", targetAmountKsh: "", startsAt: "", endsAt: "" });
      setReloadKey((value) => value + 1); setNotice("Giving campaign created.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not create this campaign."); }
    finally { setBusy(false); }
  }

  async function createDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await pulse.track(
        () =>
          apiRequest("/v1/admin/church/departments", {
            method: "POST",
            body: JSON.stringify({
              ...deptForm,
              slug: slugifyContentTitle(deptForm.name, "dept"),
              leaderName: deptForm.leaderName.trim() || undefined,
              leaderRole: deptForm.leaderRole.trim() || undefined,
              meetingSchedule: deptForm.meetingSchedule.trim() || undefined,
              contactEmail: deptForm.contactEmail.trim() || undefined,
              icon: deptForm.icon.trim() || undefined,
            }),
          }),
        {
          pending: "Creating ministry department…",
          success: `Department "${deptForm.name}" created`,
          group: "ministry:department",
        },
      );
      setDeptForm({ name: "", leaderName: "", leaderRole: "", meetingSchedule: "", contactEmail: "", description: "", icon: "" });
      setReloadKey((value) => value + 1);
      setNotice("Department created.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not create department.");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await pulse.track(
        () =>
          apiRequest("/v1/admin/church/groups", {
            method: "POST",
            body: JSON.stringify({
              ...groupForm,
              slug: slugifyContentTitle(groupForm.name, "cell"),
              leaderEmail: groupForm.leaderEmail?.trim() || undefined,
              leaderPhone: groupForm.leaderPhone?.trim() || undefined,
              locationName: groupForm.locationName?.trim() || undefined,
              publicLocationLabel: groupForm.publicLocationLabel.trim() || groupForm.locationName?.trim() || "Local Fellowship",
              description: groupForm.description?.trim() || undefined,
            }),
          }),
        {
          pending: "Creating life group…",
          success: `Group "${groupForm.name}" created`,
          group: "ministry:group",
        },
      );
      setGroupForm({ name: "", category: "Home Fellowship", leaderName: "", leaderEmail: "", leaderPhone: "", meetingSchedule: "", locationName: "", publicLocationLabel: "", acceptingMembers: true, description: "" });
      setReloadKey((value) => value + 1);
      setNotice("Life group created.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not create life group.");
    } finally {
      setBusy(false);
    }
  }

  async function createVolunteerTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await pulse.track(
        () =>
          apiRequest("/v1/admin/church/volunteer-teams", {
            method: "POST",
            body: JSON.stringify({
              ...volunteerTeamForm,
              slug: slugifyContentTitle(volunteerTeamForm.name, "vol"),
              departmentId: volunteerTeamForm.departmentId?.trim() || undefined,
              requirements: volunteerTeamForm.requirements?.trim() || undefined,
              coordinatorName: volunteerTeamForm.coordinatorName?.trim() || undefined,
              coordinatorEmail: volunteerTeamForm.coordinatorEmail?.trim() || undefined,
              coordinatorPhone: volunteerTeamForm.coordinatorPhone?.trim() || undefined,
            }),
          }),
        {
          pending: "Creating volunteer team…",
          success: `Volunteer team "${volunteerTeamForm.name}" created`,
          group: "ministry:volunteer-team",
        },
      );
      setVolunteerTeamForm({ name: "", departmentId: "", description: "", requirements: "", coordinatorName: "", coordinatorEmail: "", coordinatorPhone: "", acceptingApplications: true });
      setReloadKey((value) => value + 1);
      setNotice("Volunteer team created.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not create volunteer team.");
    } finally {
      setBusy(false);
    }
  }

  async function createInventoryAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await pulse.track(
        () =>
          apiRequest("/v1/admin/church/inventory-assets", {
            method: "POST",
            body: JSON.stringify({
              ...assetForm,
              assetTag: assetForm.assetTag.trim() || undefined,
              serialNumber: assetForm.serialNumber.trim() || undefined,
              purchaseCostMinor: assetForm.purchaseCostKsh ? Math.round(Number(assetForm.purchaseCostKsh) * 100) : undefined,
              notes: assetForm.notes.trim() || undefined,
            }),
          }),
        {
          pending: "Registering equipment asset…",
          success: `Equipment "${assetForm.name}" registered`,
          group: "ministry:inventory",
        },
      );
      setAssetForm({ name: "", category: "Audio/Visual", location: "Main Sanctuary", condition: "good", status: "available", serialNumber: "", purchaseCostKsh: "", notes: "", assetTag: "" });
      setReloadKey((value) => value + 1);
      setNotice("Equipment asset registered in inventory.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not register equipment asset.");
    } finally {
      setBusy(false);
    }
  }

  async function setCampaignStatus(id: string, status: string) {
    setBusy(true); setNotice("");
    try {
      await pulse.track(
        () => apiRequest(`/v1/admin/church/campaigns/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
        {
          pending: `Updating campaign to ${status}…`,
          success: `Campaign status updated to ${status}`,
          group: `ministry:campaign:${id}`,
        },
      );
      setReloadKey((value) => value + 1); setNotice(`Campaign status updated to ${status}.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not update campaign status."); }
    finally { setBusy(false); }
  }

  async function setPublicContentStatus(kind: "sermons" | "events", id: string, status: string) {
    setBusy(true); setNotice("");
    try {
      await pulse.track(
        () => apiRequest(`/v1/admin/church/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
        {
          pending: `Updating ${kind === "sermons" ? "sermon" : "event"} to ${status}…`,
          success: `${kind === "sermons" ? "Sermon" : "Event"} status updated to ${status}`,
          group: `ministry:${kind}:${id}`,
        },
      );
      setReloadKey((value) => value + 1); setNotice(`${kind === "sermons" ? "Sermon" : "Event"} status updated.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not update the content status."); }
    finally { setBusy(false); }
  }

  async function removeRecord(path: string, label: string) {
    const ok = await pulse.confirm({
      title: `Delete this ${label}?`,
      message: "This record will be permanently deleted and cannot be undone.",
      tone: "danger",
      confirmLabel: `Delete ${label}`,
    });
    if (!ok) return;
    setBusy(true); setNotice("");
    try {
      await pulse.track(
        () => apiRequest(path, { method: "DELETE" }),
        {
          pending: `Deleting ${label}…`,
          success: `${label} deleted`,
          group: `ministry:delete:${path}`,
        },
      );
      setReloadKey((value) => value + 1); setNotice(`${label} deleted.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : `Could not delete the ${label}.`); }
    finally { setBusy(false); }
  }

  if (session.isPending || activeOrganization.isPending) return <section className="ch-card"><div className="ch-card-body"><p>Checking your workspace session…</p></div></section>;
  if (!session.data) return <section className="ch-card"><div className="ch-card-body"><h2>Sign in to manage ministry records.</h2><a className="ch-btn ch-btn-primary" href="/login?callbackURL=%2Fadmin">Sign in →</a></div></section>;
  if (!activeOrganization.data) return <section className="ch-card"><div className="ch-card-body"><h2>Select a client workspace.</h2><a className="ch-btn ch-btn-primary" href="/workspace">Choose workspace →</a></div></section>;

  const organizationName = activeOrganization.data.name;
  const isGlobalMission = activeOrganization.data.slug === globalMissionConfig.tenantSlug
    || organizationName.trim().toLowerCase() === globalMissionConfig.ministryName.toLowerCase();
  const formattedToday = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const upcomingEvent = events
    .filter((event) => new Date(event.startsAt).getTime() >= Date.now() && !["cancelled", "completed"].includes(event.status))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const dashboardMetrics = overview ? [
    { label: "Sermons in library", value: overview.sermonCount, icon: "♪", detail: "Teachings and messages", tab: "sermons" as Tab },
    { label: "Ministry events", value: overview.eventCount, icon: "✦", detail: "Gatherings and outreaches", tab: "events" as Tab },
    { label: "Confirmed giving", value: `KES ${(overview.totalRaisedMinor / 100).toLocaleString()}`, icon: "♡", detail: `${overview.donationCount} verified gifts`, tab: "donations" as Tab },
    { label: "New enquiries", value: overview.newMessages, icon: "✉", detail: "Messages to follow up", tab: "messages" as Tab },
  ] : [];

  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"],
    ["site", "Website & Themes"],
    ["departments", "Departments"],
    ["groups", "Life Groups & Cells"],
    ["volunteers", "Volunteer Teams"],
    ["inventory", "Equipment & Inventory"],
    ["sermons", "Sermons"],
    ["events", "Events"],
    ["campaigns", "Giving campaigns"],
    ["registrations", "Registrations"],
    ["donations", "Donations"],
    ["messages", "Enquiries"],
    ["prayers", "Prayer requests"],
    ["newsletter", "Email opt-ins"],
  ];

  return (
    <div className="ministry-admin-layout">
      <aside className="ch-card ministry-admin-sidebar">
        <div className="ch-card-body">
          <p className="ministry-admin-sidebar-eyebrow">{isGlobalMission ? "GLOBAL MISSION" : "MINISTRY WORKSPACE"}</p>
          <strong className="ministry-admin-org-name">{organizationName}</strong>
          <p className="ministry-admin-sidebar-caption">Ministry operations</p>
          <nav className="ministry-admin-nav" aria-label="Ministry administration">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" aria-current={tab === id ? "page" : undefined} className={`ministry-admin-nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
                {label}<span aria-hidden="true">›</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <section className="ch-card ministry-admin-content">
        <div className="ch-card-body">
          {loading && <p role="status">Loading…</p>}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          {!sensitiveAccess && <p role="status">Private registrations, donation details, enquiries, prayer requests and email opt-ins require an owner or administrator role.</p>}

          {/* 1. OVERVIEW */}
          {tab === "overview" && (
            <div className="ministry-admin-overview">
              <header className="ministry-admin-welcome">
                <div>
                  <p className="ministry-admin-kicker">{isGlobalMission ? "GLOBAL MISSION · MINISTRY DESK" : "MINISTRY OPERATIONS"}</p>
                  <h1>{isGlobalMission ? "Welcome to your mission desk" : `Welcome to ${organizationName}`}</h1>
                  <p>{formattedToday} <span aria-hidden="true">·</span> Signed in as {session.data.user.email}</p>
                </div>
                <a className="ministry-admin-site-link" href="/" target="_blank" rel="noreferrer">View public website <span aria-hidden="true">↗</span></a>
              </header>

              {overview && (
                <div className="ministry-admin-metrics">
                  {dashboardMetrics.map((metric) => (
                    <button className="ministry-admin-metric" key={metric.label} type="button" onClick={() => setTab(metric.tab)}>
                      <span className="ministry-admin-metric-icon" aria-hidden="true">{metric.icon}</span>
                      <span className="ministry-admin-metric-label">{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <small>{metric.detail}</small>
                    </button>
                  ))}
                </div>
              )}

              <div className="ministry-admin-overview-grid">
                <section className="ministry-admin-panel ministry-admin-attention">
                  <div className="ministry-admin-panel-heading">
                    <div><p className="ministry-admin-kicker">CARE AND CONNECTION</p><h2>Needs your attention</h2></div>
                    <span aria-hidden="true">♡</span>
                  </div>
                  <button type="button" className="ministry-admin-attention-row" onClick={() => setTab("messages")}>
                    <span className="ministry-admin-attention-icon" aria-hidden="true">✉</span>
                    <span><strong>New enquiries</strong><small>Follow up with people who reached out</small></span>
                    <b>{overview?.newMessages ?? "—"}</b>
                  </button>
                  <button type="button" className="ministry-admin-attention-row" onClick={() => setTab("prayers")}>
                    <span className="ministry-admin-attention-icon" aria-hidden="true">✧</span>
                    <span><strong>Prayer requests</strong><small>Requests waiting for the prayer team</small></span>
                    <b>{overview?.pendingPrayers ?? "—"}</b>
                  </button>
                  <button type="button" className="ministry-admin-attention-row" onClick={() => setTab("registrations")}>
                    <span className="ministry-admin-attention-icon" aria-hidden="true">⌑</span>
                    <span><strong>Event registrations</strong><small>People signed up for ministry gatherings</small></span>
                    <b>{overview?.registrationCount ?? "—"}</b>
                  </button>
                </section>

                <section className="ministry-admin-panel ministry-admin-next-event">
                  <div className="ministry-admin-panel-heading">
                    <div><p className="ministry-admin-kicker">UP NEXT</p><h2>Upcoming gathering</h2></div>
                    <span aria-hidden="true">✦</span>
                  </div>
                  {upcomingEvent ? (
                    <>
                      <p className="ministry-admin-event-date">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(upcomingEvent.startsAt))}</p>
                      <h3>{upcomingEvent.title}</h3>
                      <p className="ministry-admin-panel-muted">{upcomingEvent.venue || "Venue to be announced"}</p>
                      <button className="ministry-admin-text-link" type="button" onClick={() => setTab("events")}>Manage events <span aria-hidden="true">→</span></button>
                    </>
                  ) : (
                    <>
                      <h3>Make room for the next gathering</h3>
                      <p className="ministry-admin-panel-muted">There are no upcoming events yet. Add a gathering, conference, or outreach to the calendar.</p>
                      <button className="ch-btn ch-btn-primary" type="button" onClick={() => setTab("events")}>Add your next event →</button>
                    </>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* 2. SITE SETTINGS & THEMES */}
          {tab === "site" && <SiteSettingsEditor />}

          {/* 3. DEPARTMENTS DESK */}
          {tab === "departments" && (
            <>
              <p className="admin-muted">Manage structured ministry wings and departments (e.g. Worship, Missions, Ushers, Media). These appear on your public ministries directory.</p>
              <form onSubmit={createDepartment} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>Department name</span>
                    <button
                      type="button"
                      className="admin-sample-btn"
                      onClick={() => setDeptForm({
                        name: "Praise & Worship (Choir & Music)",
                        leaderName: "David Ochieng",
                        leaderRole: "Music Director",
                        meetingSchedule: "Saturdays 3:00 PM Rehearsals",
                        contactEmail: "worship@gmfc.org",
                        description: "Leading heartfelt corporate worship through hymns, contemporary praise, and instrumental excellence.",
                        icon: "🎵",
                      })}
                    >
                      + Load sample department
                    </button>
                  </div>
                  <input required minLength={2} maxLength={120} value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="e.g. Missions & Community Outreach" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>Leader name<input maxLength={160} value={deptForm.leaderName} onChange={(e) => setDeptForm({ ...deptForm, leaderName: e.target.value })} placeholder="e.g. Evangelist Mark" /></label>
                <label style={{ display: "grid", gap: 6 }}>Leader role<input maxLength={120} value={deptForm.leaderRole} onChange={(e) => setDeptForm({ ...deptForm, leaderRole: e.target.value })} placeholder="e.g. Missions Coordinator" /></label>
                <label style={{ display: "grid", gap: 6 }}>Meeting schedule<input maxLength={200} value={deptForm.meetingSchedule} onChange={(e) => setDeptForm({ ...deptForm, meetingSchedule: e.target.value })} placeholder="e.g. 1st & 3rd Saturday 9:00 AM" /></label>
                <label style={{ display: "grid", gap: 6 }}>Contact email<input type="email" value={deptForm.contactEmail} onChange={(e) => setDeptForm({ ...deptForm, contactEmail: e.target.value })} placeholder="missions@gmfc.org" /></label>
                <label style={{ display: "grid", gap: 6 }}>Icon / Emoji<input maxLength={32} value={deptForm.icon} onChange={(e) => setDeptForm({ ...deptForm, icon: e.target.value })} placeholder="e.g. 🌍 or 🎵" /></label>
                <label style={{ gridColumn: "1 / -1" }}>Description<textarea required rows={3} maxLength={1000} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="Overview of what this department accomplishes and who it serves." /></label>
                <button className="ch-btn ch-btn-primary" disabled={busy}>Add Department</button>
              </form>

              <div style={{ display: "grid", gap: 12 }}>
                {departments.map((dept) => (
                  <article key={dept.id} className="ch-card">
                    <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{dept.icon ? `${dept.icon} ` : ""}{dept.name}</strong>
                        <p style={{ margin: "4px 0", fontSize: 13, color: "var(--church-text-muted)" }}>{dept.description}</p>
                        <small className="admin-muted">
                          {dept.leaderName ? `Lead: ${dept.leaderName}${dept.leaderRole ? ` (${dept.leaderRole})` : ""} · ` : ""}
                          {dept.meetingSchedule ? `${dept.meetingSchedule} · ` : ""}
                          Slug: {dept.slug}
                        </small>
                      </div>
                      <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/departments/${dept.id}`, "department")}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {!loading && departments.length === 0 && (
                  <EmptyStateGuide
                    icon="🏛️"
                    title="No departments established yet"
                    description="Organize your church operations into departments such as Worship, Prayer, Evangelism, and Children's Ministry."
                  />
                )}
              </div>
            </>
          )}

          {/* 4. LIFE GROUPS & CELL CIRCLES */}
          {tab === "groups" && (
            <>
              <p className="admin-muted">Manage small groups, cell circles, and home fellowships. Church members can find their nearest group and request to join online.</p>
              <form onSubmit={createGroup} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>Group name</span>
                    <button
                      type="button"
                      className="admin-sample-btn"
                      onClick={() => setGroupForm({
                        name: "Kiamariga Revival Cell Fellowship",
                        category: "Home Fellowship",
                        leaderName: "Elder John Mwangi",
                        leaderEmail: "john.mwangi@example.com",
                        leaderPhone: "+254712345678",
                        meetingSchedule: "Wednesdays 6:00 PM - 7:30 PM",
                        locationName: "Kiamariga Grounds Centre",
                        publicLocationLabel: "Kiamariga Area",
                        acceptingMembers: true,
                        description: "Weekly prayer, Bible study, and mutual encouragement for families living around Kiamariga.",
                      })}
                    >
                      + Load sample cell group
                    </button>
                  </div>
                  <input required minLength={2} maxLength={120} value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="e.g. CBD Young Professionals Circle" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  Category
                  <select value={groupForm.category} onChange={(e) => setGroupForm({ ...groupForm, category: e.target.value })}>
                    <option value="Home Fellowship">Home Fellowship</option>
                    <option value="Youth & Young Adults">Youth & Young Adults</option>
                    <option value="Men of Honor">Men of Honor</option>
                    <option value="Women of Faith">Women of Faith</option>
                    <option value="Prayer & Intercession">Prayer & Intercession</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>Leader name<input required maxLength={160} value={groupForm.leaderName} onChange={(e) => setGroupForm({ ...groupForm, leaderName: e.target.value })} placeholder="e.g. Elder John" /></label>
                <label style={{ display: "grid", gap: 6 }}>Meeting schedule<input required maxLength={200} value={groupForm.meetingSchedule} onChange={(e) => setGroupForm({ ...groupForm, meetingSchedule: e.target.value })} placeholder="e.g. Thursdays 6:30 PM" /></label>
                <label style={{ display: "grid", gap: 6 }}>Public location label<input required maxLength={300} value={groupForm.publicLocationLabel} onChange={(e) => setGroupForm({ ...groupForm, publicLocationLabel: e.target.value })} placeholder="e.g. Westlands / Online Zoom" /></label>
                <label style={{ display: "grid", gap: 6 }}>Leader phone (private)<input value={groupForm.leaderPhone} onChange={(e) => setGroupForm({ ...groupForm, leaderPhone: e.target.value })} placeholder="+254..." /></label>
                <label style={{ gridColumn: "1 / -1" }}>Description<textarea rows={2} maxLength={800} value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="What members can expect during meetings." /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={groupForm.acceptingMembers} onChange={(e) => setGroupForm({ ...groupForm, acceptingMembers: e.target.checked })} />
                  Open to new members
                </label>
                <button className="ch-btn ch-btn-primary" disabled={busy}>Add Life Group</button>
              </form>

              <div style={{ display: "grid", gap: 12 }}>
                {groups.map((item) => (
                  <article key={item.id} className="ch-card">
                    <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{item.name}</strong>
                        <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--church-bg-alt)", color: "var(--church-primary)", fontWeight: 700 }}>
                          {item.category}
                        </span>
                        {item.description && <p style={{ margin: "4px 0", fontSize: 13, color: "var(--church-text-muted)" }}>{item.description}</p>}
                        <small className="admin-muted">
                          Leader: {item.leaderName} · Schedule: {item.meetingSchedule} · Venue: {item.publicLocationLabel} · {item.acceptingMembers ? "Accepting Members" : "Full"}
                        </small>
                      </div>
                      <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/groups/${item.id}`, "life group")}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {!loading && groups.length === 0 && (
                  <EmptyStateGuide
                    icon="👥"
                    title="No life groups or cell circles registered"
                    description="Create home fellowships and small groups where believers gather during the week for community and discipleship."
                  />
                )}
              </div>
            </>
          )}

          {/* 5. VOLUNTEER TEAMS */}
          {tab === "volunteers" && (
            <>
              <p className="admin-muted">Manage volunteer service teams. Visitors can submit applications through the ministries directory, which arrive here for review.</p>
              <form onSubmit={createVolunteerTeam} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>Volunteer team title</span>
                    <button
                      type="button"
                      className="admin-sample-btn"
                      onClick={() => setVolunteerTeamForm({
                        name: "Medical Camp Health Professionals & Nurses",
                        departmentId: "",
                        description: "Registered medical officers, nurses, pharmacists, and lab techs who volunteer during free medical outreach camps.",
                        requirements: "Valid medical license, passion for rural compassion ministry.",
                        coordinatorName: "Dr. Rachel Wambui",
                        coordinatorEmail: "medical@gmfc.org",
                        coordinatorPhone: "+254722000111",
                        acceptingApplications: true,
                      })}
                    >
                      + Load sample volunteer team
                    </button>
                  </div>
                  <input required minLength={2} maxLength={120} value={volunteerTeamForm.name} onChange={(e) => setVolunteerTeamForm({ ...volunteerTeamForm, name: e.target.value })} placeholder="e.g. Camera & Live Stream Operators" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>Coordinator name<input maxLength={160} value={volunteerTeamForm.coordinatorName} onChange={(e) => setVolunteerTeamForm({ ...volunteerTeamForm, coordinatorName: e.target.value })} placeholder="e.g. Dr. Rachel Wambui" /></label>
                <label style={{ display: "grid", gap: 6 }}>Coordinator email<input type="email" value={volunteerTeamForm.coordinatorEmail} onChange={(e) => setVolunteerTeamForm({ ...volunteerTeamForm, coordinatorEmail: e.target.value })} placeholder="coordinator@example.com" /></label>
                <label style={{ display: "grid", gap: 6 }}>Requirements<input maxLength={500} value={volunteerTeamForm.requirements} onChange={(e) => setVolunteerTeamForm({ ...volunteerTeamForm, requirements: e.target.value })} placeholder="e.g. Background check, orientation attendance" /></label>
                <label style={{ gridColumn: "1 / -1" }}>Description<textarea required rows={3} maxLength={1000} value={volunteerTeamForm.description} onChange={(e) => setVolunteerTeamForm({ ...volunteerTeamForm, description: e.target.value })} placeholder="Responsibilities and scheduling for this volunteer team." /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={volunteerTeamForm.acceptingApplications} onChange={(e) => setVolunteerTeamForm({ ...volunteerTeamForm, acceptingApplications: e.target.checked })} />
                  Accepting online volunteer applications
                </label>
                <button className="ch-btn ch-btn-primary" disabled={busy}>Add Volunteer Team</button>
              </form>

              <div style={{ display: "grid", gap: 12 }}>
                {volunteerTeams.map((team) => (
                  <article key={team.id} className="ch-card">
                    <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{team.name}</strong>
                        <p style={{ margin: "4px 0", fontSize: 13, color: "var(--church-text-muted)" }}>{team.description}</p>
                        <small className="admin-muted">
                          {team.coordinatorName ? `Coordinator: ${team.coordinatorName} · ` : ""}
                          {team.requirements ? `Requirements: ${team.requirements} · ` : ""}
                          {team.acceptingApplications ? "Accepting Applications" : "Closed"}
                        </small>
                      </div>
                      <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/volunteer-teams/${team.id}`, "volunteer team")}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {!loading && volunteerTeams.length === 0 && (
                  <EmptyStateGuide
                    icon="🤝"
                    title="No volunteer teams registered"
                    description="Create service opportunities (such as Media, Medical Outreach, Hospitality, and Children Ministry) where members can volunteer."
                  />
                )}
              </div>
            </>
          )}

          {/* 6. PHYSICAL INVENTORY & ASSETS */}
          {tab === "inventory" && (
            <>
              <p className="admin-muted">
                Private church inventory operations. Track sound gear, broadcast cameras, vehicles, generators, and tents with serial numbers, condition status, and maintenance events under strict tenant RLS isolation.
              </p>
              <form onSubmit={createInventoryAsset} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>Asset name</span>
                    <button
                      type="button"
                      className="admin-sample-btn"
                      onClick={() => setAssetForm({
                        name: "Yamaha Digital Audio & Line Array Sound System",
                        category: "Audio/Visual",
                        location: "Main Sanctuary & Mobile Rig",
                        condition: "excellent",
                        status: "available",
                        assetTag: "GMFC-AV-001",
                        serialNumber: "YMH-LS9-32-4821",
                        purchaseCostKsh: "450000",
                        notes: "Includes 32-channel digital console, wireless UHF microphones, stage monitors, and power amplifiers.",
                      })}
                    >
                      + Load sample sound equipment
                    </button>
                  </div>
                  <input required minLength={2} maxLength={160} value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. 15 kVA Diesel Generator" />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  Category
                  <select value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}>
                    <option value="Audio/Visual">Audio / Visual</option>
                    <option value="Media & Broadcasting">Media & Broadcasting</option>
                    <option value="Vehicles">Vehicles & Transport</option>
                    <option value="Power & Utilities">Power & Utilities</option>
                    <option value="Facilities & Hospitality">Facilities & Tents</option>
                    <option value="Musical Instruments">Musical Instruments</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>Location<input maxLength={180} value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} placeholder="e.g. Main Sanctuary / Store" /></label>
                <label style={{ display: "grid", gap: 6 }}>Asset Tag / Serial number<input maxLength={100} value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} placeholder="e.g. GMFC-2026-001" /></label>
                <label style={{ display: "grid", gap: 6 }}>
                  Condition
                  <select value={assetForm.condition} onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value as "excellent" | "good" | "fair" | "needs_repair" })}>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="needs_repair">Needs Repair</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  Status
                  <select value={assetForm.status} onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as "available" | "in_use" | "maintenance" | "reserved" })}>
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>Estimated cost (KES)<input type="number" value={assetForm.purchaseCostKsh} onChange={(e) => setAssetForm({ ...assetForm, purchaseCostKsh: e.target.value })} placeholder="e.g. 250000" /></label>
                <label style={{ gridColumn: "1 / -1" }}>Operational notes<textarea rows={2} maxLength={2000} value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} placeholder="Maintenance schedule, accessories included, storage details." /></label>
                <button className="ch-btn ch-btn-primary" disabled={busy}>Register Equipment Asset</button>
              </form>

              <div style={{ display: "grid", gap: 12 }}>
                {inventoryAssets.map((asset) => (
                  <article key={asset.id} className="ch-card">
                    <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{asset.name}</strong>
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: asset.status === "available" ? "#DCFCE7" : asset.status === "in_use" ? "#DBEAFE" : asset.status === "maintenance" ? "#FEF3C7" : "#F3E8FF",
                          color: asset.status === "available" ? "#166534" : asset.status === "in_use" ? "#1E40AF" : asset.status === "maintenance" ? "#92400E" : "#6B21A8",
                        }}>
                          {asset.status.replace("_", " ")}
                        </span>
                        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--church-text-muted)" }}>
                          ({asset.condition})
                        </span>
                        {asset.notes && <p style={{ margin: "4px 0", fontSize: 13, color: "var(--church-text-muted)" }}>{asset.notes}</p>}
                        <small className="admin-muted">
                          Category: {asset.category} · Location: {asset.location}
                          {asset.serialNumber ? ` · S/N: ${asset.serialNumber}` : ""}
                          {asset.purchaseCostMinor ? ` · Val: KES ${(asset.purchaseCostMinor / 100).toLocaleString()}` : ""}
                        </small>
                      </div>
                      <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/inventory-assets/${asset.id}`, "equipment asset")}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {!loading && inventoryAssets.length === 0 && (
                  <EmptyStateGuide
                    icon="📦"
                    title="No equipment or facilities in inventory"
                    description="Stewarded equipment (such as sound boards, broadcast kits, outreach vehicles, generators, and tents) is recorded here for internal church management."
                  />
                )}
              </div>
            </>
          )}

          {/* 7. SERMONS */}
          {tab === "sermons" && (
            <>
              <p className="admin-muted">Manage your sermon and teachings archive. Add YouTube recordings or draft upcoming message titles.</p>
              <form onSubmit={createSermon} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                    <span>Sermon title</span>
                    <button
                      type="button"
                      className="admin-sample-btn"
                      onClick={() => setSermonForm({
                        title: "Walking in Faith and Supernatural Favor",
                        speaker: "Senior Pastor",
                        description: "An inspiring message exploring how unwavering trust in God positions believers to experience His favor, breakthroughs, and divine purpose.",
                        scriptureReference: "Hebrews 11:1-6",
                        youtubeVideoId: "dQw4w9WgXcQ",
                        thumbnailUrl: "",
                        status: "published",
                      })}
                    >
                      + Load sample sermon
                    </button>
                  </div>
                  <input required minLength={3} maxLength={200} placeholder="e.g. Walking in the Spirit" value={sermonForm.title} onChange={(event) => setSermonForm({ ...sermonForm, title: event.target.value })} />
                  <small className="admin-muted">Page link: /sermons/{slugifyContentTitle(sermonForm.title, "sermon")} · generated automatically</small>
                </label>
                <label style={{ display: "grid", gap: 6 }}>Speaker<input required maxLength={160} placeholder="e.g. Pastor David" value={sermonForm.speaker} onChange={(event) => setSermonForm({ ...sermonForm, speaker: event.target.value })} /></label>
                <label style={{ display: "grid", gap: 6 }}>Scripture reference (optional)<input maxLength={120} placeholder="e.g. Romans 8:28" value={sermonForm.scriptureReference} onChange={(event) => setSermonForm({ ...sermonForm, scriptureReference: event.target.value })} /></label>
                <label style={{ display: "grid", gap: 6 }}>
                  YouTube Link or Video ID
                  <input
                    maxLength={200}
                    placeholder="e.g. https://youtu.be/abc123xyz or abc123xyz"
                    value={sermonForm.youtubeVideoId}
                    onChange={(event) => setSermonForm({ ...sermonForm, youtubeVideoId: extractYouTubeVideoId(event.target.value) })}
                  />
                  <small className="admin-muted">Paste full YouTube link or ID</small>
                </label>
                <MediaUploadField label="Sermon thumbnail" value={sermonForm.thumbnailUrl} onChange={(value) => setSermonForm({ ...sermonForm, thumbnailUrl: value })} />
                <label style={{ gridColumn: "1 / -1" }}>Description<textarea maxLength={5000} rows={4} placeholder="Summary of the message" value={sermonForm.description} onChange={(event) => setSermonForm({ ...sermonForm, description: event.target.value })} /></label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={sermonForm.status === "published"} onChange={(e) => setSermonForm({ ...sermonForm, status: e.target.checked ? "published" : "draft" })} />
                  Publish immediately to sermon library
                </label>
                <button className="ch-btn ch-btn-primary" disabled={busy}>Save sermon</button>
              </form>
              <div style={{ display: "grid", gap: 12 }}>
                {sermons.map((item) => (
                  <article key={item.id} className="ch-card">
                    <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <strong>{item.title}</strong>
                        <p style={{ margin: "4px 0", fontSize: 13, color: "var(--church-text-muted)" }}>{item.speaker} · /sermons/{item.slug}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select aria-label={`Status for ${item.title}`} value={item.status} disabled={busy} onChange={(e) => void setPublicContentStatus("sermons", item.id, e.target.value)}>
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="archived">Archived</option>
                        </select>
                        <button className="ch-btn ch-btn-outline" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/sermons/${item.id}`, "sermon")}>Delete</button>
                      </div>
                    </div>
                  </article>
                ))}
                {!loading && sermons.length === 0 && (
                  <EmptyStateGuide
                    icon="♪"
                    title="No sermons in your library yet"
                    description="Upload your Sunday teachings, conference messages, and revival sessions. Visitors can stream messages and follow sermon notes online."
                  />
                )}
              </div>
            </>
          )}

          {/* 8. EVENTS */}
          {tab === "events" && (
            <>
              <p className="admin-muted">Add gatherings, revival conferences, and special services to your public calendar.</p>
              <form onSubmit={createEvent} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="admin-sample-btn"
                    onClick={() => setEventForm({
                      title: "Kingdom Life Annual Conference 2026",
                      description: "Join believers from across the nation for three days of transformative worship, teachings, and empowering ministry.",
                      startsAt: getNextDayOfWeek(5, 17, 0),
                      endsAt: getNextDayOfWeek(0, 13, 0),
                      venue: "Main Worship Sanctuary",
                      address: "123 Faith Way, Nairobi",
                      posterUrl: "",
                      registrationCapacity: "250",
                      registrationEnabled: true,
                    })}
                  >
                    + Load sample event
                  </button>
                </div>
                <label style={{ display: "grid", gap: 6 }}>Event title<input required minLength={3} maxLength={200} value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /><small className="admin-muted">Page link: /events/{slugifyContentTitle(eventForm.title, "event")} · generated automatically</small></label>
                <label style={{ display: "grid", gap: 6 }}>Starts at<input required type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 6 }}>Ends at (optional)<input type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} /></label>
                {eventForm.startsAt && eventForm.endsAt && new Date(eventForm.endsAt) < new Date(eventForm.startsAt) ? (
                  <div className="admin-field-alert" style={{ gridColumn: "1 / -1" }}>⚠️ Event end time must be after the start time.</div>
                ) : null}
                <label style={{ display: "grid", gap: 6 }}>Venue<input maxLength={180} value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 6 }}>Address<input maxLength={500} value={eventForm.address} onChange={(e) => setEventForm({ ...eventForm, address: e.target.value })} /></label>
                <MediaUploadField label="Event poster" value={eventForm.posterUrl} onChange={(value) => setEventForm({ ...eventForm, posterUrl: value })} />
                <label style={{ display: "grid", gap: 6 }}>Registration capacity (optional)<input type="number" min={1} value={eventForm.registrationCapacity} onChange={(e) => setEventForm({ ...eventForm, registrationCapacity: e.target.value })} /></label>
                <label style={{ gridColumn: "1 / -1" }}>Description<textarea maxLength={5000} rows={4} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={eventForm.registrationEnabled} onChange={(e) => setEventForm({ ...eventForm, registrationEnabled: e.target.checked })} />Enable event registration</label>
                <button className="ch-btn ch-btn-primary" disabled={busy}>Create event</button>
              </form>
              {events.map((item) => (
                <article key={item.id} className="ch-card">
                  <div className="ch-card-body">
                    <strong>{item.title}</strong>
                    <p>{new Date(item.startsAt).toLocaleString()} · {item.venue ?? "Venue not set"} · {item.status}</p>
                    <label>Status <select aria-label={`Status for ${item.title}`} value={item.status} disabled={busy} onChange={(e) => void setPublicContentStatus("events", item.id, e.target.value)}><option value="upcoming">Upcoming</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
                    {" "}<button className="ch-btn ch-btn-outline" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/events/${item.id}`, "event")}>Delete</button>
                  </div>
                </article>
              ))}
              {!loading && events.length === 0 && (
                <EmptyStateGuide
                  icon="✦"
                  title="No ministry events scheduled"
                  description="Plan conferences, prayer summits, youth fellowships, or Sunday gatherings."
                />
              )}
            </>
          )}

          {/* 9. CAMPAIGNS */}
          {tab === "campaigns" && (
            <>
              <p className="admin-muted">Create a giving campaign or pause one. Progress increases only after a payment provider confirms a donation.</p>
              <form onSubmit={createCampaign} className="ch-grid-2" style={{ marginBottom: 24 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                    <span>Campaign title</span>
                    <button
                      type="button"
                      className="admin-sample-btn"
                      onClick={() => setCampaignForm({
                        title: "Community Outreach & Food Drive",
                        description: "Providing essential food hampers, blankets, and school kits for 500 vulnerable families in our local community.",
                        targetAmountKsh: "250000",
                        startsAt: getNextDayOfWeek(1, 8, 0),
                        endsAt: getNextDayOfWeek(0, 18, 0),
                      })}
                    >
                      + Load sample campaign
                    </button>
                  </div>
                  <input required minLength={3} maxLength={180} placeholder="e.g. Building Expansion Project" value={campaignForm.title} onChange={(event) => setCampaignForm({ ...campaignForm, title: event.target.value })} />
                  <small className="admin-muted">Campaign link: /give#{slugifyContentTitle(campaignForm.title, "campaign")} · generated automatically</small>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>Target amount (KES)</span>
                    {Number(campaignForm.targetAmountKsh) > 0 ? (
                      <span className="admin-field-success-badge">Target: KES {Number(campaignForm.targetAmountKsh).toLocaleString()}</span>
                    ) : null}
                  </div>
                  <input required type="number" min={1} max={500000000} aria-label="Campaign target amount in KES" placeholder="Target amount in KES (e.g. 250000)" value={campaignForm.targetAmountKsh} onChange={(event) => setCampaignForm({ ...campaignForm, targetAmountKsh: event.target.value })} />
                </label>
                <input type="datetime-local" aria-label="Campaign starts at" value={campaignForm.startsAt} onChange={(event) => setCampaignForm({ ...campaignForm, startsAt: event.target.value })} />
                <input type="datetime-local" aria-label="Campaign ends at" value={campaignForm.endsAt} onChange={(event) => setCampaignForm({ ...campaignForm, endsAt: event.target.value })} />
                <textarea maxLength={5000} aria-label="Campaign description" placeholder="What the campaign supports and why it matters" value={campaignForm.description} onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })} />
                <button className="ch-btn ch-btn-primary" disabled={busy}>Create campaign</button>
              </form>
              <div style={{ display: "grid", gap: 12 }}>
                {campaigns.map((campaign) => (
                  <article key={campaign.id} className="ch-card">
                    <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <strong>{campaign.title}</strong>
                        <p>{campaign.currency} {(campaign.raisedAmountMinor / 100).toLocaleString()} raised of {(campaign.targetAmountMinor / 100).toLocaleString()} · /give#{campaign.slug}</p>
                      </div>
                      <label>Campaign status <select value={campaign.status} disabled={busy} onChange={(event) => void setCampaignStatus(campaign.id, event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
                    </div>
                  </article>
                ))}
                {!loading && campaigns.length === 0 && (
                  <EmptyStateGuide icon="♡" title="No giving campaigns created yet" description="Create targeted fundraising drives for missions, building expansions, or community relief." />
                )}
              </div>
            </>
          )}

          {/* 10. REGISTRATIONS */}
          {tab === "registrations" && registrations.map((item) => (
            <article className="ch-card" key={item.id}>
              <div className="ch-card-body">
                <strong>{item.fullName} · {item.eventTitle}</strong>
                <p>{item.email} · {item.telephone}</p>
                <p>Ref {item.registrationReference} · {item.status}</p>
                <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/registrations/${item.id}`, "event registration")}>Delete personal data</button>
              </div>
            </article>
          ))}

          {/* 11. DONATIONS */}
          {tab === "donations" && donations.map((item) => (
            <article className="ch-card" key={item.id}>
              <div className="ch-card-body">
                <strong>{item.anonymous ? "Anonymous donor" : item.donorName || "Donor"} · {item.currency} {(item.amountMinor / 100).toLocaleString()}</strong>
                <p>{item.givingCategory} · {item.paymentMethod} · {item.paymentStatus}</p>
                <p>{item.paymentStatus === "verified" ? "Provider-confirmed" : "Not confirmed"} · {new Date(item.createdAt).toLocaleString()}</p>
              </div>
            </article>
          ))}

          {/* 12. ENQUIRIES */}
          {tab === "messages" && messages.map((item) => (
            <article className="ch-card" key={item.id}>
              <div className="ch-card-body">
                <strong>{item.subject}</strong>
                <p>{item.fullName} · {item.email} · {item.category}</p>
                <p>{item.message}</p>
                <select value={item.status} disabled={busy} onChange={(e) => void changeStatus("messages", item.id, e.target.value)}>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="archived">Archived</option>
                </select>
                {" "}<button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/messages/${item.id}`, "enquiry")}>Delete personal data</button>
              </div>
            </article>
          ))}

          {/* 13. PRAYERS */}
          {tab === "prayers" && prayers.map((item) => (
            <article className="ch-card" key={item.id}>
              <div className="ch-card-body">
                <strong>{item.fullName} · {item.status}</strong>
                <p>{item.requestText}</p>
                <select value={item.status} disabled={busy} onChange={(e) => void changeStatus("prayers", item.id, e.target.value)}>
                  <option value="received">Received</option>
                  <option value="prayed_for">Prayed for</option>
                </select>
                {" "}<button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/prayers/${item.id}`, "prayer request")}>Delete personal data</button>
              </div>
            </article>
          ))}

          {/* 14. NEWSLETTER */}
          {tab === "newsletter" && sensitiveAccess && (
            <>
              <p className="admin-muted">Email opt-ins are stored with consent time. Remove an address after a person asks to withdraw or erase their subscription.</p>
              {newsletterSubscribers.map((subscriber) => (
                <article className="ch-card" key={subscriber.id}>
                  <div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <strong>{subscriber.email}</strong>
                      <p>Consent recorded {new Date(subscriber.consentAt).toLocaleString()} · {subscriber.status}</p>
                    </div>
                    <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/newsletter/${subscriber.id}`, "email opt-in")}>Remove opt-in</button>
                  </div>
                </article>
              ))}
              {!newsletterSubscribers.length && <EmptyStateGuide icon="📬" title="No newsletter subscribers yet" description="Visitors who subscribe to email updates on your website will be saved here with verified consent timestamps." />}
            </>
          )}

          {!loading && sensitiveAccess && tab === "registrations" && registrations.length === 0 && (
            <EmptyStateGuide icon="⌑" title="No event registrations yet" description="When visitors register for events with registration enabled, their contact details, timestamps, and registration references will appear here." />
          )}
          {!loading && sensitiveAccess && tab === "donations" && donations.length === 0 && (
            <EmptyStateGuide icon="💳" title="No confirmed donations yet" description="When supporters give through verified M-Pesa STK prompts or your payment gateway, confirmed contributions appear here automatically." />
          )}
          {!loading && sensitiveAccess && tab === "messages" && messages.length === 0 && (
            <EmptyStateGuide icon="✉" title="Your enquiries inbox is clear" description="Messages submitted via the Contact form on your website will arrive here so your pastoral or support team can follow up." />
          )}
          {!loading && sensitiveAccess && tab === "prayers" && prayers.length === 0 && (
            <EmptyStateGuide icon="✧" title="No prayer requests pending" description="Confidential prayer requests submitted by visitors through your website will appear here for pastoral intercession." />
          )}
        </div>
      </section>
    </div>
  );
}
