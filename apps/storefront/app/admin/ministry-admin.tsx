"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@bazion/auth/client";
import { SiteSettingsEditor } from "./site-settings-editor";
import { apiErrorMessage } from "../../lib/api-error";

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
  const [sermonForm, setSermonForm] = useState({ title: "", slug: "", speaker: "", description: "", scriptureReference: "", youtubeVideoId: "", thumbnailUrl: "", status: "draft" as "draft" | "published" });
  const [eventForm, setEventForm] = useState({ title: "", slug: "", description: "", startsAt: "", endsAt: "", venue: "", address: "", posterUrl: "", registrationCapacity: "", registrationEnabled: true });
  const [campaignForm, setCampaignForm] = useState({ title: "", slug: "", description: "", targetAmountKsh: "", startsAt: "", endsAt: "" });

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
      await apiRequest("/v1/admin/church/sermons", { method: "POST", body: JSON.stringify({
        ...sermonForm,
        thumbnailUrl: sermonForm.thumbnailUrl.trim() || undefined,
        youtubeVideoId: sermonForm.youtubeVideoId || undefined,
        scriptureReference: sermonForm.scriptureReference || undefined,
        status: sermonForm.status,
      }) });
      const savedStatus = sermonForm.status;
      setSermonForm({ title: "", slug: "", speaker: "", description: "", scriptureReference: "", youtubeVideoId: "", thumbnailUrl: "", status: "draft" });
      setReloadKey((value) => value + 1); setNotice(savedStatus === "published" ? "Sermon published." : "Sermon saved as a draft.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not save the sermon."); }
    finally { setBusy(false); }
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await apiRequest("/v1/admin/church/events", { method: "POST", body: JSON.stringify({
        ...eventForm,
        description: eventForm.description.trim() || undefined,
        posterUrl: eventForm.posterUrl.trim() || undefined,
        startsAt: new Date(eventForm.startsAt).toISOString(),
        endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : undefined,
        registrationCapacity: eventForm.registrationCapacity ? Number(eventForm.registrationCapacity) : undefined,
      }) });
      setEventForm({ title: "", slug: "", description: "", startsAt: "", endsAt: "", venue: "", address: "", posterUrl: "", registrationCapacity: "", registrationEnabled: true });
      setReloadKey((value) => value + 1); setNotice("Event created.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not create the event."); }
    finally { setBusy(false); }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await apiRequest("/v1/admin/church/campaigns", { method: "POST", body: JSON.stringify({
        ...campaignForm,
        targetAmountKsh: Number(campaignForm.targetAmountKsh),
        startsAt: campaignForm.startsAt ? new Date(campaignForm.startsAt).toISOString() : undefined,
        endsAt: campaignForm.endsAt ? new Date(campaignForm.endsAt).toISOString() : undefined,
      }) });
      setCampaignForm({ title: "", slug: "", description: "", targetAmountKsh: "", startsAt: "", endsAt: "" });
      setReloadKey((value) => value + 1); setNotice("Giving campaign created.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not create this campaign."); }
    finally { setBusy(false); }
  }

  async function setCampaignStatus(id: string, status: string) {
    setBusy(true); setNotice("");
    try {
      await apiRequest(`/v1/admin/church/campaigns/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setReloadKey((value) => value + 1); setNotice("Campaign status updated.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not update the campaign."); }
    finally { setBusy(false); }
  }

  async function setPublicContentStatus(kind: "sermons" | "events", id: string, status: string) {
    setBusy(true); setNotice("");
    try {
      await apiRequest(`/v1/admin/church/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setReloadKey((value) => value + 1); setNotice(`${kind === "sermons" ? "Sermon" : "Event"} status updated.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not update the content status."); }
    finally { setBusy(false); }
  }

  async function removeRecord(path: string, label: string) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
    setBusy(true); setNotice("");
    try { await apiRequest(path, { method: "DELETE" }); setReloadKey((value) => value + 1); setNotice(`${label} deleted.`); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : `Could not delete the ${label}.`); }
    finally { setBusy(false); }
  }

  if (session.isPending || activeOrganization.isPending) return <section className="ch-card"><div className="ch-card-body"><p>Checking your workspace session…</p></div></section>;
  if (!session.data) return <section className="ch-card"><div className="ch-card-body"><h2>Sign in to manage ministry records.</h2><a className="ch-btn ch-btn-primary" href="/login?callbackURL=%2Fadmin">Sign in →</a></div></section>;
  if (!activeOrganization.data) return <section className="ch-card"><div className="ch-card-body"><h2>Select a client workspace.</h2><a className="ch-btn ch-btn-primary" href="/workspace">Choose workspace →</a></div></section>;

  const tabs: Array<[Tab, string]> = [["overview", "Overview"], ["site", "Website settings"], ["sermons", "Sermons"], ["events", "Events"], ["campaigns", "Giving campaigns"], ["registrations", "Registrations"], ["donations", "Donations"], ["messages", "Enquiries"], ["prayers", "Prayer requests"], ["newsletter", "Email opt-ins"]];
  return <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 24 }}>
    <aside className="ch-card"><div className="ch-card-body"><strong>{activeOrganization.data.name}</strong><p>Ministry operations</p>{tabs.map(([id, label]) => <button key={id} type="button" className={`ch-filter-btn ${tab === id ? "active" : ""}`} style={{ display: "block", width: "100%", marginBottom: 6, textAlign: "left" }} onClick={() => setTab(id)}>{label}</button>)}</div></aside>
    <section className="ch-card"><div className="ch-card-body">
      <h1>{tabs.find(([id]) => id === tab)?.[1]}</h1>
      <p>Signed in as {session.data.user.email}. Records are scoped to {activeOrganization.data.name}.</p>
      {loading && <p role="status">Loading…</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {!sensitiveAccess && <p role="status">Private registrations, donation details, enquiries, prayer requests and email opt-ins require an owner or administrator role.</p>}
      {tab === "overview" && overview && <div className="ch-grid-3">{[["Published sermons", overview.sermonCount], ["Events", overview.eventCount], ["Registrations", overview.registrationCount], ["Verified donations", overview.donationCount], ["Confirmed giving", `KES ${(overview.totalRaisedMinor / 100).toLocaleString()}`], ["Pending prayer requests", overview.pendingPrayers], ["New enquiries", overview.newMessages]].map(([label, value]) => <article className="ch-card" key={String(label)}><div className="ch-card-body"><span>{label}</span><strong style={{ display: "block", fontSize: 24 }}>{value}</strong></div></article>)}</div>}
      {tab === "site" && <SiteSettingsEditor />}
      {tab === "sermons" && <>
        <form onSubmit={createSermon} className="ch-grid-2" style={{ marginBottom: 24 }}>
          <label style={{ display: "grid", gap: 6 }}>Title<input required minLength={3} maxLength={200} value={sermonForm.title} onChange={(e) => setSermonForm({ ...sermonForm, title: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>URL slug<input required minLength={3} maxLength={140} pattern="[a-z0-9-]+" value={sermonForm.slug} onChange={(e) => setSermonForm({ ...sermonForm, slug: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Speaker<input required minLength={2} maxLength={160} value={sermonForm.speaker} onChange={(e) => setSermonForm({ ...sermonForm, speaker: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Scripture reference<input maxLength={160} value={sermonForm.scriptureReference} onChange={(e) => setSermonForm({ ...sermonForm, scriptureReference: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>YouTube video ID<input minLength={5} maxLength={64} value={sermonForm.youtubeVideoId} onChange={(e) => setSermonForm({ ...sermonForm, youtubeVideoId: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Thumbnail image URL<input type="url" value={sermonForm.thumbnailUrl} onChange={(e) => setSermonForm({ ...sermonForm, thumbnailUrl: e.target.value })} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Description<textarea maxLength={5000} rows={4} value={sermonForm.description} onChange={(e) => setSermonForm({ ...sermonForm, description: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Visibility<select aria-label="New sermon visibility" value={sermonForm.status} onChange={(e) => setSermonForm({ ...sermonForm, status: e.target.value as "draft" | "published" })}><option value="draft">Save as draft</option><option value="published">Publish now</option></select></label>
          <button className="ch-btn ch-btn-primary" disabled={busy}>Save sermon</button>
        </form>
        {sermons.map((item) => <article key={item.id} className="ch-card"><div className="ch-card-body"><strong>{item.title}</strong><p>{item.speaker} · {item.status} · /sermons/{item.slug}</p><select aria-label={`Visibility for ${item.title}`} value={item.status} disabled={busy} onChange={(e) => void setPublicContentStatus("sermons", item.id, e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select> <button className="ch-btn ch-btn-outline" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/sermons/${item.id}`, "sermon")}>Delete</button></div></article>)}
      </>}
      {tab === "events" && <>
        <form onSubmit={createEvent} className="ch-grid-2" style={{ marginBottom: 24 }}>
          <label style={{ display: "grid", gap: 6 }}>Event title<input required minLength={3} maxLength={200} value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>URL slug<input required minLength={3} maxLength={140} pattern="[a-z0-9-]+" value={eventForm.slug} onChange={(e) => setEventForm({ ...eventForm, slug: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Starts at<input required type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Ends at (optional)<input type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Venue<input maxLength={180} value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Address<input maxLength={500} value={eventForm.address} onChange={(e) => setEventForm({ ...eventForm, address: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Poster image URL<input type="url" value={eventForm.posterUrl} onChange={(e) => setEventForm({ ...eventForm, posterUrl: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 6 }}>Registration capacity (optional)<input type="number" min={1} value={eventForm.registrationCapacity} onChange={(e) => setEventForm({ ...eventForm, registrationCapacity: e.target.value })} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Description<textarea maxLength={5000} rows={4} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={eventForm.registrationEnabled} onChange={(e) => setEventForm({ ...eventForm, registrationEnabled: e.target.checked })} />Enable event registration</label>
          <button className="ch-btn ch-btn-primary" disabled={busy}>Create event</button>
        </form>
        {events.map((item) => <article key={item.id} className="ch-card"><div className="ch-card-body"><strong>{item.title}</strong><p>{new Date(item.startsAt).toLocaleString()} · {item.venue ?? "Venue not set"} · {item.status}</p><label>Status <select aria-label={`Status for ${item.title}`} value={item.status} disabled={busy} onChange={(e) => void setPublicContentStatus("events", item.id, e.target.value)}><option value="upcoming">Upcoming</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label> <button className="ch-btn ch-btn-outline" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/events/${item.id}`, "event")}>Delete</button></div></article>)}
      </>}
      {tab === "campaigns" && <>
        <p className="admin-muted">Create a giving campaign or pause one. Progress increases only after a payment provider confirms a donation.</p>
        <form onSubmit={createCampaign} className="ch-grid-2" style={{ marginBottom: 24 }}>
          <input required minLength={3} maxLength={180} aria-label="Campaign title" placeholder="Campaign title" value={campaignForm.title} onChange={(event) => setCampaignForm({ ...campaignForm, title: event.target.value })} />
          <input required minLength={3} maxLength={120} pattern="[a-z0-9-]+" aria-label="Campaign URL slug" placeholder="url-slug" value={campaignForm.slug} onChange={(event) => setCampaignForm({ ...campaignForm, slug: event.target.value })} />
          <input required type="number" min={1} max={500000000} aria-label="Campaign target amount in KES" placeholder="Target amount (KES)" value={campaignForm.targetAmountKsh} onChange={(event) => setCampaignForm({ ...campaignForm, targetAmountKsh: event.target.value })} />
          <input type="datetime-local" aria-label="Campaign starts at" value={campaignForm.startsAt} onChange={(event) => setCampaignForm({ ...campaignForm, startsAt: event.target.value })} />
          <input type="datetime-local" aria-label="Campaign ends at" value={campaignForm.endsAt} onChange={(event) => setCampaignForm({ ...campaignForm, endsAt: event.target.value })} />
          <textarea maxLength={5000} aria-label="Campaign description" placeholder="What the campaign supports" value={campaignForm.description} onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })} />
          <button className="ch-btn ch-btn-primary" disabled={busy}>Create campaign</button>
        </form>
        <div style={{ display: "grid", gap: 12 }}>
          {campaigns.map((campaign) => <article key={campaign.id} className="ch-card"><div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div><strong>{campaign.title}</strong><p>{campaign.currency} {(campaign.raisedAmountMinor / 100).toLocaleString()} raised of {(campaign.targetAmountMinor / 100).toLocaleString()} · /give#{campaign.slug}</p></div>
            <label>Campaign status <select value={campaign.status} disabled={busy} onChange={(event) => void setCampaignStatus(campaign.id, event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
          </div></article>)}
          {!campaigns.length && <p>No giving campaigns have been created.</p>}
        </div>
      </>}
      {tab === "registrations" && registrations.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.fullName} · {item.eventTitle}</strong><p>{item.email} · {item.telephone}</p><p>Ref {item.registrationReference} · {item.status}</p><button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/registrations/${item.id}`, "event registration")}>Delete personal data</button></div></article>)}
      {tab === "donations" && donations.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.anonymous ? "Anonymous donor" : item.donorName || "Donor"} · {item.currency} {(item.amountMinor / 100).toLocaleString()}</strong><p>{item.givingCategory} · {item.paymentMethod} · {item.paymentStatus}</p><p>{item.paymentStatus === "verified" ? "Provider-confirmed" : "Not confirmed"} · {new Date(item.createdAt).toLocaleString()}</p></div></article>)}
      {tab === "messages" && messages.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.subject}</strong><p>{item.fullName} · {item.email} · {item.category}</p><p>{item.message}</p><select value={item.status} disabled={busy} onChange={(e) => void changeStatus("messages", item.id, e.target.value)}><option value="new">New</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option></select> <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/messages/${item.id}`, "enquiry")}>Delete personal data</button></div></article>)}
      {tab === "prayers" && prayers.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><strong>{item.fullName} · {item.status}</strong><p>{item.requestText}</p><select value={item.status} disabled={busy} onChange={(e) => void changeStatus("prayers", item.id, e.target.value)}><option value="received">Received</option><option value="prayed_for">Prayed for</option></select> <button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/prayers/${item.id}`, "prayer request")}>Delete personal data</button></div></article>)}
      {tab === "newsletter" && sensitiveAccess && <><p className="admin-muted">Email opt-ins are stored with consent time. Remove an address after a person asks to withdraw or erase their subscription.</p>{newsletterSubscribers.map((subscriber) => <article className="ch-card" key={subscriber.id}><div className="ch-card-body" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div><strong>{subscriber.email}</strong><p>Consent recorded {new Date(subscriber.consentAt).toLocaleString()} · {subscriber.status}</p></div><button className="admin-danger-button" disabled={busy} onClick={() => void removeRecord(`/v1/admin/church/newsletter/${subscriber.id}`, "email opt-in")}>Remove opt-in</button></div></article>)}{!newsletterSubscribers.length && <p>No email opt-ins have been recorded.</p>}</>}
      {!loading && sensitiveAccess && tab === "registrations" && registrations.length === 0 && <p>No registrations yet.</p>}
      {!loading && sensitiveAccess && tab === "donations" && donations.length === 0 && <p>No donation attempts yet.</p>}
      {!loading && sensitiveAccess && tab === "messages" && messages.length === 0 && <p>No enquiries yet.</p>}
      {!loading && sensitiveAccess && tab === "prayers" && prayers.length === 0 && <p>No prayer requests yet.</p>}
      {!loading && tab === "sermons" && sermons.length === 0 && <p>No sermons have been published.</p>}
      {!loading && tab === "events" && events.length === 0 && <p>No events have been created.</p>}
    </div></section>
  </div>;
}
