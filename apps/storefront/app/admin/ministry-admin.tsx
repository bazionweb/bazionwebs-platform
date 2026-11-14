"use client";

import { useCallback, useEffect, useState } from "react";
import { pulse } from "@bazion/ui";
import { authClient } from "@bazion/auth/client";
import { SiteSettingsEditor } from "./site-settings-editor";
import { MediaUploadField } from "./media-upload-field";
import { apiErrorMessage } from "../../lib/api-error";
import { globalMissionConfig } from "@bazion/church-ministry-template";
import { slugifyContentTitle } from "@bazion/church-ministry-domain";

type Tab = "overview" | "site" | "sermons" | "events" | "campaigns" | "registrations" | "donations" | "messages" | "prayers" | "newsletter";
type Sermon = { id: string; title: string; slug: string; speaker: string; status: string; publishedAt: string | null };
type ChurchEvent = { id: string; title: string; slug: string; startsAt: string; venue: string | null; registrationEnabled: boolean; status: string };
type Campaign = { id: string; title: string; slug: string; description: string | null; targetAmountMinor: number; raisedAmountMinor: number; currency: string; status: string; createdAt: string };
type Registration = { id: string; eventTitle: string; fullName: string; email: string; telephone: string; registrationReference: string; status: string; createdAt: string };
type Donation = { id: string; donorName: string | null; donorPhone: string | null; anonymous: boolean; amountMinor: number; currency: string; givingCategory: string; paymentMethod: string; paymentStatus: string; createdAt: string };
type Message = { id: string; fullName: string; email: string; subject: string; message: string; category: string; status: string; createdAt: string };
type Prayer = { id: string; fullName: string; email: string | null; telephone: string | null; requestText: string; status: string; createdAt: string };
type NewsletterSubscriber = { id: string; email: string; consentAt: string; status: string };
type Overview = { sermonCount: number; eventCount: number; registrationCount: number; donationCount: number; totalRaisedMinor: number; pendingPrayers: number; newMessages: number };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sensitiveAccess, setSensitiveAccess] = useState(true);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sermonForm, setSermonForm] = useState({ title: "", speaker: "", description: "", scriptureReference: "", youtubeVideoId: "", thumbnailUrl: "", status: "draft" as "draft" | "published" });
  const [eventForm, setEventForm] = useState({ title: "", description: "", startsAt: "", endsAt: "", venue: "", address: "", posterUrl: "", registrationCapacity: "", registrationEnabled: true });
  const [campaignForm, setCampaignForm] = useState({ title: "", description: "", targetAmountKsh: "", startsAt: "", endsAt: "" });

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
    ]).then(([summary, sermonResult, eventResult, campaignResult, registrationResult, donationResult, messageResult, prayerResult, newsletterResult]) => {
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
      setReloadKey((value) => value + 1); setNotice("Campaign status updated.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not update the campaign."); }
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
  const tabs: Array<[Tab, string]> = [["overview", "Overview"], ["site", "Website settings"], ["sermons", "Sermons"], ["events", "Events"], ["campaigns", "Giving campaigns"], ["registrations", "Registrations"], ["donations", "Donations"], ["messages", "Enquiries"], ["prayers", "Prayer requests"], ["newsletter", "Email opt-ins"]];
  return <div className="ministry-admin-layout">
    <aside className="ch-card ministry-admin-sidebar">
      <div className="ch-card-body">
        <p className="ministry-admin-sidebar-eyebrow">{isGlobalMission ? "GLOBAL MISSION" : "MINISTRY WORKSPACE"}</p>
        <strong className="ministry-admin-org-name">{organizationName}</strong>
        <p className="ministry-admin-sidebar-caption">Ministry operations</p>
        <nav className="ministry-admin-nav" aria-label="Ministry administration">
          {tabs.map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} className={`ministry-admin-nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}<span aria-hidden="true">›</span></button>)}
        </nav>
      </div>
    </aside>
    <section className="ch-card ministry-admin-content"><div className="ch-card-body">
      {loading && <p role="status">Loading…</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {!sensitiveAccess && <p role="status">Private registrations, donation details, enquiries, prayer requests and email opt-ins require an owner or administrator role.</p>}
      {tab === "overview" && <div className="ministry-admin-overview">
        <header className="ministry-admin-welcome">
          <div>
            <p className="ministry-admin-kicker">{isGlobalMission ? "GLOBAL MISSION · MINISTRY DESK" : "MINISTRY OPERATIONS"}</p>
            <h1>{isGlobalMission ? "Welcome to your mission desk" : `Welcome to ${organizationName}`}</h1>
            <p>{formattedToday} <span aria-hidden="true">·</span> Signed in as {session.data.user.email}</p>
          </div>
          <a className="ministry-admin-site-link" href="/" target="_blank" rel="noreferrer">View public website <span aria-hidden="true">↗</span></a>
        </header>

        {overview && <div className="ministry-admin-metrics">
          {dashboardMetrics.map((metric) => <button className="ministry-admin-metric" key={metric.label} type="button" onClick={() => setTab(metric.tab)}>
            <span className="ministry-admin-metric-icon" aria-hidden="true">{metric.icon}</span>
            <span className="ministry-admin-metric-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </button>)}
        </div>}

        <div className="ministry-admin-overview-grid">
          <section className="ministry-admin-panel ministry-admin-attention">
            <div className="ministry-admin-panel-heading"><div><p className="ministry-admin-kicker">CARE AND CONNECTION</p><h2>Needs your attention</h2></div><span aria-hidden="true">♡</span></div>
            <button type="button" className="ministry-admin-attention-row" onClick={() => setTab("messages")}>
              <span className="ministry-admin-attention-icon" aria-hidden="true">✉</span><span><strong>New enquiries</strong><small>Follow up with people who reached out</small></span><b>{overview?.newMessages ?? "—"}</b>
            </button>
            <button type="button" className="ministry-admin-attention-row" onClick={() => setTab("prayers")}>
              <span className="ministry-admin-attention-icon" aria-hidden="true">✧</span><span><strong>Prayer requests</strong><small>Requests waiting for the prayer team</small></span><b>{overview?.pendingPrayers ?? "—"}</b>
            </button>
            <button type="button" className="ministry-admin-attention-row" onClick={() => setTab("registrations")}>
              <span className="ministry-admin-attention-icon" aria-hidden="true">⌑</span><span><strong>Event registrations</strong><small>People signed up for ministry gatherings</small></span><b>{overview?.registrationCount ?? "—"}</b>
            </button>
          </section>

          <section className="ministry-admin-panel ministry-admin-next-event">
            <div className="ministry-admin-panel-heading"><div><p className="ministry-admin-kicker">UP NEXT</p><h2>Upcoming gathering</h2></div><span aria-hidden="true">✦</span></div>
            {upcomingEvent ? <>
              <p className="ministry-admin-event-date">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(upcomingEvent.startsAt))}</p>
              <h3>{upcomingEvent.title}</h3>
              <p className="ministry-admin-panel-muted">{upcomingEvent.venue || "Venue to be announced"}</p>
              <button className="ministry-admin-text-link" type="button" onClick={() => setTab("events")}>Manage events <span aria-hidden="true">→</span></button>
            </> : <>
              <h3>Make room for the next gathering</h3>
              <p className="ministry-admin-panel-muted">There are no upcoming events yet. Add a gathering, conference, or outreach to the calendar.</p>
              <button className="ministry-admin-text-link" type="button" onClick={() => setTab("events")}>Create an event <span aria-hidden="true">→</span></button>
            </>}
          </section>

          <section className="ministry-admin-panel ministry-admin-quick-actions">
            <div className="ministry-admin-panel-heading"><div><p className="ministry-admin-kicker">KEEP THINGS MOVING</p><h2>Quick actions</h2></div></div>
            <div className="ministry-admin-action-grid">
              <button type="button" onClick={() => setTab("sermons")}><span aria-hidden="true">＋</span><strong>Add a sermon</strong><small>Share a new message</small></button>
              <button type="button" onClick={() => setTab("events")}><span aria-hidden="true">＋</span><strong>Plan an event</strong><small>Schedule a gathering</small></button>
              <button type="button" onClick={() => setTab("campaigns")}><span aria-hidden="true">＋</span><strong>Start a campaign</strong><small>Invite people to give</small></button>
              <button type="button" onClick={() => setTab("site")}><span aria-hidden="true">↗</span><strong>Update the website</strong><small>Keep your information current</small></button>
            </div>
          </section>

          <section className="ministry-admin-panel ministry-admin-giving">
            <div className="ministry-admin-panel-heading"><div><p className="ministry-admin-kicker">GENEROSITY IN ACTION</p><h2>Giving campaigns</h2></div><span aria-hidden="true">♡</span></div>
            {campaigns.slice(0, 2).map((campaign) => {
              const progress = campaign.targetAmountMinor > 0 ? Math.min(100, Math.round(campaign.raisedAmountMinor / campaign.targetAmountMinor * 100)) : 0;
              return <div className="ministry-admin-campaign" key={campaign.id}>
                <div><strong>{campaign.title}</strong><small>{campaign.currency} {(campaign.raisedAmountMinor / 100).toLocaleString()} of {(campaign.targetAmountMinor / 100).toLocaleString()}</small></div>
                <div className="ministry-admin-progress" role="progressbar" aria-label={`${campaign.title} campaign progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
              </div>;
            })}
            {!campaigns.length && <p className="ministry-admin-panel-muted">Campaigns you create will appear here, with confirmed giving progress.</p>}
            <button className="ministry-admin-text-link" type="button" onClick={() => setTab("campaigns")}>Manage campaigns <span aria-hidden="true">→</span></button>
          </section>
        </div>
      </div>}
      {tab !== "overview" && <header className="ministry-admin-section-heading"><p className="ministry-admin-kicker">{isGlobalMission ? "GLOBAL MISSION · MINISTRY DESK" : organizationName}</p><h1>{tabs.find(([id]) => id === tab)?.[1]}</h1><p>Manage ministry records for {organizationName}.</p></header>}
      {tab === "site" && <SiteSettingsEditor />}
      {tab === "sermons" && <>
        <form onSubmit={createSermon} className="ch-grid-2" style={{ marginBottom: 24 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>Title</span>
              <button
                type="button"
                className="admin-sample-btn"
                onClick={() => setSermonForm({
                  title: "Walking in Faith and Victory",
                  speaker: "Senior Pastor",
                  description: "Discover the foundational principles of living a victorious Christian life amidst modern challenges.",
                  scriptureReference: "Hebrews 11:1-6",
                  youtubeVideoId: "",
                  thumbnailUrl: "",
                  status: "published",
                })}
              >
                + Load sample sermon
              </button>
            </div>
            <input required minLength={3} maxLength={200} value={sermonForm.title} onChange={(e) => setSermonForm({ ...sermonForm, title: e.target.value })} />
            <small className="admin-muted">Page link: /sermons/{slugifyContentTitle(sermonForm.title, "sermon")} · generated automatically</small>
          </label>
          <label style={{ display: "grid", gap: 6 }}>Speaker<input required minLength={2} maxLength={160} value={sermonForm.speaker} onChange={(e) => setSermonForm({ ...sermonForm, speaker: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Scripture reference<input maxLength={160} placeholder="e.g. John 3:16-18, Psalm 23" value={sermonForm.scriptureReference} onChange={(e) => setSermonForm({ ...sermonForm, scriptureReference: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span>YouTube video link or ID</span>
              {sermonForm.youtubeVideoId ? <span className="admin-field-success-badge">✓ Video ID: {sermonForm.youtubeVideoId}</span> : null}
            </div>
            <input placeholder="e.g. dQw4w9WgXcQ or https://youtu.be/..." value={sermonForm.youtubeVideoId} onChange={(e) => setSermonForm({ ...sermonForm, youtubeVideoId: extractYouTubeVideoId(e.target.value) })} />
            <small className="admin-muted">Paste full YouTube link or ID; we extract the ID automatically.</small>
          </label>
          <MediaUploadField label="Sermon thumbnail" value={sermonForm.thumbnailUrl} onChange={(value) => setSermonForm({ ...sermonForm, thumbnailUrl: value })} />
          <label style={{ gridColumn: "1 / -1" }}>Description<textarea maxLength={5000} rows={4} value={sermonForm.description} onChange={(e) => setSermonForm({ ...sermonForm, description: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Visibility<select aria-label="New sermon visibility" value={sermonForm.status} onChange={(e) => setSermonForm({ ...sermonForm, status: e.target.value as "draft" | "published" })}><option value="draft">Save as draft (hidden from public)</option><option value="published">Publish now (visible on public site)</option></select></label>
          <button className="ch-btn ch-btn-primary" disabled={busy}>Save sermon</button>
        </form>
        {sermons.map((item) => <article key={item.id} className="ch-card"><div className="ch-card-body"><strong>{item.title}</strong><p>{item.speaker} · {item.status} · /sermons/{item.slug}</p><select aria-label={`Visibility for ${item.title}`} value={item.status} disabled={busy} onChange={(e) => void setPublicContentStatus("sermons", item.id, e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select> <button className="ch-btn ch-btn-outline" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/sermons/${item.id}`, "sermon")}>Delete</button></div></article>)}
        {!loading && sermons.length === 0 && (
          <EmptyStateGuide
            icon="♪"
            title="No sermons in your library yet"
            description="Sermons allow your congregation and visitors to watch or listen to messages online anytime. Published sermons appear at /sermons and in the homepage teaching section."
            actionLabel="Load sample sermon"
            onAction={() => setSermonForm({
              title: "Walking in Faith and Victory",
              speaker: "Senior Pastor",
              description: "Discover the foundational principles of living a victorious Christian life amidst modern challenges.",
              scriptureReference: "Hebrews 11:1-6",
              youtubeVideoId: "",
              thumbnailUrl: "",
              status: "published",
            })}
          />
        )}
      </>}
      {tab === "events" && <>
        <form onSubmit={createEvent} className="ch-grid-2" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", gridColumn: "1 / -1", margin: "0 0 8px" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--church-text-muted)" }}>Quick schedule:</span>
            <button
              type="button"
              className="admin-sample-btn"
              onClick={() => {
                const nextSunStart = getNextDayOfWeek(0, 10, 0);
                const nextSunEnd = getNextDayOfWeek(0, 12, 30);
                setEventForm((prev) => ({ ...prev, startsAt: nextSunStart, endsAt: nextSunEnd }));
              }}
            >
              This/Next Sunday 10:00 AM
            </button>
            <button
              type="button"
              className="admin-sample-btn"
              onClick={() => {
                const satStart = getNextDayOfWeek(6, 14, 0);
                const satEnd = getNextDayOfWeek(6, 17, 0);
                setEventForm((prev) => ({ ...prev, startsAt: satStart, endsAt: satEnd }));
              }}
            >
              This/Next Saturday 2:00 PM
            </button>
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
        {events.map((item) => <article key={item.id} className="ch-card"><div className="ch-card-body"><strong>{item.title}</strong><p>{new Date(item.startsAt).toLocaleString()} · {item.venue ?? "Venue not set"} · {item.status}</p><label>Status <select aria-label={`Status for ${item.title}`} value={item.status} disabled={busy} onChange={(e) => void setPublicContentStatus("events", item.id, e.target.value)}><option value="upcoming">Upcoming</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label> <button className="ch-btn ch-btn-outline" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/events/${item.id}`, "event")}>Delete</button></div></article>)}
        {!loading && events.length === 0 && (
          <EmptyStateGuide
            icon="✦"
            title="No ministry events scheduled"
            description="Plan conferences, prayer summits, youth fellowships, or Sunday gatherings. Visitors can read event details, see venue maps, and RSVP online."
            actionLabel="Load sample event"
            onAction={() => setEventForm({
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
          />
        )}
      </>}
      {tab === "campaigns" && <>
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
            <small className="admin-muted">Whole KES. Verified gifts automatically increment progress.</small>
          </label>
          <input type="datetime-local" aria-label="Campaign starts at" value={campaignForm.startsAt} onChange={(event) => setCampaignForm({ ...campaignForm, startsAt: event.target.value })} />
          <input type="datetime-local" aria-label="Campaign ends at" value={campaignForm.endsAt} onChange={(event) => setCampaignForm({ ...campaignForm, endsAt: event.target.value })} />
          <textarea maxLength={5000} aria-label="Campaign description" placeholder="What the campaign supports and why it matters" value={campaignForm.description} onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })} />
          <button className="ch-btn ch-btn-primary" disabled={busy}>Create campaign</button>
        </form>
        <div style={{ display: "grid", gap: 12 }}>
          {campaigns.map((campaign) => <article key={campaign.id} className="ch-card"><div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div><strong>{campaign.title}</strong><p>{campaign.currency} {(campaign.raisedAmountMinor / 100).toLocaleString()} raised of {(campaign.targetAmountMinor / 100).toLocaleString()} · /give#{campaign.slug}</p></div>
            <label>Campaign status <select value={campaign.status} disabled={busy} onChange={(event) => void setCampaignStatus(campaign.id, event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
          </div></article>)}
          {!loading && campaigns.length === 0 && (
            <EmptyStateGuide
              icon="♡"
              title="No giving campaigns created yet"
              description="Create targeted fundraising drives for missions, building expansions, or community relief. Real-time progress bars update as confirmed gifts arrive."
              actionLabel="Load sample campaign"
              onAction={() => setCampaignForm({
                title: "Community Outreach & Food Drive",
                description: "Providing essential food hampers, blankets, and school kits for 500 vulnerable families in our local community.",
                targetAmountKsh: "250000",
                startsAt: getNextDayOfWeek(1, 8, 0),
                endsAt: getNextDayOfWeek(0, 18, 0),
              })}
            />
          )}
        </div>
      </>}
      {tab === "registrations" && registrations.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.fullName} · {item.eventTitle}</strong><p>{item.email} · {item.telephone}</p><p>Ref {item.registrationReference} · {item.status}</p><button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/registrations/${item.id}`, "event registration")}>Delete personal data</button></div></article>)}
      {tab === "donations" && donations.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.anonymous ? "Anonymous donor" : item.donorName || "Donor"} · {item.currency} {(item.amountMinor / 100).toLocaleString()}</strong><p>{item.givingCategory} · {item.paymentMethod} · {item.paymentStatus}</p><p>{item.paymentStatus === "verified" ? "Provider-confirmed" : "Not confirmed"} · {new Date(item.createdAt).toLocaleString()}</p></div></article>)}
      {tab === "messages" && messages.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.subject}</strong><p>{item.fullName} · {item.email} · {item.category}</p><p>{item.message}</p><select value={item.status} disabled={busy} onChange={(e) => void changeStatus("messages", item.id, e.target.value)}><option value="new">New</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option></select> <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/messages/${item.id}`, "enquiry")}>Delete personal data</button></div></article>)}
      {tab === "prayers" && prayers.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.fullName} · {item.status}</strong><p>{item.requestText}</p><select value={item.status} disabled={busy} onChange={(e) => void changeStatus("prayers", item.id, e.target.value)}><option value="received">Received</option><option value="prayed_for">Prayed for</option></select> <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/prayers/${item.id}`, "prayer request")}>Delete personal data</button></div></article>)}
      {tab === "newsletter" && sensitiveAccess && <><p className="admin-muted">Email opt-ins are stored with consent time. Remove an address after a person asks to withdraw or erase their subscription.</p>{newsletterSubscribers.map((subscriber) => <article className="ch-card" key={subscriber.id}><div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div><strong>{subscriber.email}</strong><p>Consent recorded {new Date(subscriber.consentAt).toLocaleString()} · {subscriber.status}</p></div><button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/newsletter/${subscriber.id}`, "email opt-in")}>Remove opt-in</button></div></article>)}{!newsletterSubscribers.length && <EmptyStateGuide icon="📬" title="No newsletter subscribers yet" description="Visitors who subscribe to email updates on your website will be saved here with verified consent timestamps." />}</>}
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
    </div></section>
  </div>;
}
