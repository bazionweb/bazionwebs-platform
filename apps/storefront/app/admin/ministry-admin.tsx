"use client";

import { useState } from "react";
import {
  sampleSermons,
  sampleEvents,
  sampleGallery,
  sampleCampaigns,
  type SermonItem,
  type EventItem,
  type GalleryItem,
  type CampaignItem,
} from "../../../../templates/church-sample-data";
import { globalMissionConfig } from "../../../../templates/global-mission.config";

type AdminTab =
  | "overview"
  | "sermons"
  | "events"
  | "registrations"
  | "gallery"
  | "donations"
  | "messages"
  | "prayers"
  | "settings"
  | "audit";

interface RegistrationRecord {
  id: string;
  eventTitle: string;
  fullName: string;
  email: string;
  telephone: string;
  refCode: string;
  date: string;
}

interface MessageRecord {
  id: string;
  fullName: string;
  email: string;
  telephone?: string;
  subject: string;
  message: string;
  category: string;
  status: "new" | "reviewed" | "archived";
  date: string;
}

interface PrayerRecord {
  id: string;
  fullName: string;
  telephone?: string;
  requestText: string;
  status: "received" | "prayed_for";
  date: string;
}

interface DonationRecord {
  id: string;
  donorName: string;
  phone: string;
  amount: number;
  category: string;
  method: "M-Pesa" | "Bank";
  status: "verified" | "pending";
  date: string;
  ref: string;
}

export function MinistryAdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // State collections
  const [sermonsList, setSermonsList] = useState<SermonItem[]>(sampleSermons);
  const [eventsList, setEventsList] = useState<EventItem[]>(sampleEvents);
  const [galleryList, setGalleryList] = useState<GalleryItem[]>(sampleGallery);
  const [campaignsList] = useState<CampaignItem[]>(sampleCampaigns);

  // Registrations state
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([
    {
      id: "reg-1",
      eventTitle: "Annual Global Revival Conference 2026",
      fullName: "David Mwangi",
      email: "david.m@example.com",
      telephone: "+254 712 345 678",
      refCode: "GMFC-REG-847291",
      date: "Nov 08, 2026",
    },
    {
      id: "reg-2",
      eventTitle: "National Medical Outreach & Crusade",
      fullName: "Esther Kemunto",
      email: "esther.k@example.com",
      telephone: "+254 722 987 654",
      refCode: "GMFC-REG-391024",
      date: "Nov 07, 2026",
    },
  ]);

  // Messages & Prayers
  const [messages, setMessages] = useState<MessageRecord[]>([
    {
      id: "msg-1",
      fullName: "Pastor John Omondi",
      email: "john.omondi@church.org",
      telephone: "+254 733 112 233",
      subject: "Invitation to revival meeting in Kisumu",
      message:
        "Greetings in Christ. We would like to officially invite Rev. Anthony Githui for a 3-day regional crusade in Kisumu this coming February.",
      category: "Partnership",
      status: "new",
      date: "Nov 08, 2026",
    },
  ]);

  const [prayers, setPrayers] = useState<PrayerRecord[]>([
    {
      id: "pray-1",
      fullName: "Faith Njeri",
      telephone: "+254 720 554 433",
      requestText:
        "Please stand with my family in prayer for healing for my younger brother admitted to hospital and for complete peace.",
      status: "received",
      date: "Nov 08, 2026",
    },
  ]);

  const [donations] = useState<DonationRecord[]>([
    {
      id: "don-1",
      donorName: "Anonymous",
      phone: "254721***793",
      amount: 5000,
      category: "Global Revival Conferences Fund",
      method: "M-Pesa",
      status: "verified",
      date: "Nov 08, 2026",
      ref: "TK9283741J",
    },
    {
      id: "don-2",
      donorName: "Samuel Mutua",
      phone: "254710***232",
      amount: 2500,
      category: "Free Medical Outreach & Medication Fund",
      method: "M-Pesa",
      status: "verified",
      date: "Nov 07, 2026",
      ref: "TK8847192A",
    },
  ]);

  // Modals
  const [showAddSermon, setShowAddSermon] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  // Form states
  const [newSermon, setNewSermon] = useState({
    title: "",
    speaker: "Rev. Anthony Githui",
    category: "Revival",
    scriptureReference: "",
    youtubeVideoId: "",
    description: "",
  });

  const [newEvent, setNewEvent] = useState({
    title: "",
    dateStr: "",
    venue: "",
    location: "Kenya",
    description: "",
    capacity: 1000,
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px", minHeight: "750px" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          background: "#ffffff",
          borderRadius: "var(--church-radius)",
          border: "1px solid var(--church-border)",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div style={{ padding: "0 12px 16px 12px", borderBottom: "1px solid var(--church-border)", marginBottom: "8px" }}>
          <strong style={{ display: "block", fontSize: "14px", color: "var(--church-primary)" }}>
            Ministry Portal
          </strong>
          <small style={{ color: "var(--church-text-muted)", fontSize: "11px" }}>
            {globalMissionConfig.ministryName}
          </small>
        </div>

        {[
          { id: "overview", label: "📊 Overview" },
          { id: "sermons", label: "🎙️ Sermons" },
          { id: "events", label: "📅 Events" },
          { id: "registrations", label: "👥 Registrations" },
          { id: "gallery", label: "🖼️ Gallery & Media" },
          { id: "donations", label: "💰 Donations & M-Pesa" },
          { id: "messages", label: "✉️ Enquiries" },
          { id: "prayers", label: "🙏 Prayer Requests" },
          { id: "settings", label: "⚙️ Settings" },
          { id: "audit", label: "🔒 Audit Logs" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "var(--church-radius)",
                fontSize: "13px",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--church-secondary)" : "var(--church-text)",
                backgroundColor: isActive ? "var(--church-bg-muted)" : "transparent",
                border: 0,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </aside>

      {/* Main Admin Workspace Panel */}
      <section
        style={{
          background: "#ffffff",
          borderRadius: "var(--church-radius)",
          border: "1px solid var(--church-border)",
          padding: "28px",
          boxShadow: "var(--church-shadow-sm)",
        }}
      >
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "24px", color: "var(--church-primary)", margin: 0 }}>
                Ministry Dashboard Overview
              </h2>
              <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: "4px 0 0 0" }}>
                Key ministry engagement and administration metrics.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
              <div style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", background: "var(--church-bg-alt)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--church-text-muted)", textTransform: "uppercase" }}>
                  Published Sermons
                </span>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-primary)", marginTop: "4px" }}>
                  {sermonsList.length}
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", background: "var(--church-bg-alt)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--church-text-muted)", textTransform: "uppercase" }}>
                  Upcoming Events
                </span>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-secondary)", marginTop: "4px" }}>
                  {eventsList.filter((e) => e.registrationOpen).length}
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", background: "var(--church-bg-alt)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--church-text-muted)", textTransform: "uppercase" }}>
                  Event Registrations
                </span>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-accent)", marginTop: "4px" }}>
                  {registrations.length}
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", background: "var(--church-bg-alt)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--church-text-muted)", textTransform: "uppercase" }}>
                  Pending Messages
                </span>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-primary)", marginTop: "4px" }}>
                  {messages.filter((m) => m.status === "new").length}
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", background: "var(--church-bg-alt)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--church-text-muted)", textTransform: "uppercase" }}>
                  Prayer Requests
                </span>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-warning)", marginTop: "4px" }}>
                  {prayers.filter((p) => p.status === "received").length}
                </div>
              </div>

              <div style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", background: "var(--church-bg-alt)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--church-text-muted)", textTransform: "uppercase" }}>
                  Verified Donations
                </span>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-success)", marginTop: "4px" }}>
                  KES {donations.reduce((acc, d) => acc + d.amount, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERMONS */}
        {activeTab === "sermons" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Manage Sermons ({sermonsList.length})
              </h2>
              <button
                type="button"
                className="ch-btn ch-btn-accent"
                onClick={() => setShowAddSermon(true)}
              >
                + Add New Sermon
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--church-bg-muted)", textAlign: "left" }}>
                  <th style={{ padding: "12px" }}>Title</th>
                  <th style={{ padding: "12px" }}>Speaker</th>
                  <th style={{ padding: "12px" }}>Category</th>
                  <th style={{ padding: "12px" }}>Date</th>
                  <th style={{ padding: "12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sermonsList.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--church-border)" }}>
                    <td style={{ padding: "12px", fontWeight: 600 }}>{s.title}</td>
                    <td style={{ padding: "12px" }}>{s.speaker}</td>
                    <td style={{ padding: "12px" }}>
                      <span className="ch-sermon-badge">{s.category}</span>
                    </td>
                    <td style={{ padding: "12px", color: "var(--church-text-muted)" }}>{s.date}</td>
                    <td style={{ padding: "12px" }}>
                      <button
                        type="button"
                        style={{ border: 0, background: "none", color: "#dc2626", cursor: "pointer", fontSize: "12px" }}
                        onClick={() => setSermonsList(sermonsList.filter((x) => x.id !== s.id))}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: EVENTS */}
        {activeTab === "events" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Manage Events ({eventsList.length})
              </h2>
              <button
                type="button"
                className="ch-btn ch-btn-accent"
                onClick={() => setShowAddEvent(true)}
              >
                + Create New Event
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--church-bg-muted)", textAlign: "left" }}>
                  <th style={{ padding: "12px" }}>Event Title</th>
                  <th style={{ padding: "12px" }}>Dates</th>
                  <th style={{ padding: "12px" }}>Venue</th>
                  <th style={{ padding: "12px" }}>Status</th>
                  <th style={{ padding: "12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eventsList.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: "1px solid var(--church-border)" }}>
                    <td style={{ padding: "12px", fontWeight: 600 }}>{evt.title}</td>
                    <td style={{ padding: "12px" }}>{evt.dateStr}</td>
                    <td style={{ padding: "12px" }}>{evt.venue}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ color: evt.registrationOpen ? "var(--church-success)" : "var(--church-text-muted)", fontWeight: 700 }}>
                        {evt.registrationOpen ? "Active" : "Closed"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <button
                        type="button"
                        style={{ border: 0, background: "none", color: "var(--church-secondary)", cursor: "pointer", marginRight: "12px" }}
                        onClick={() => {
                          setEventsList(
                            eventsList.map((x) =>
                              x.id === evt.id ? { ...x, registrationOpen: !x.registrationOpen } : x
                            )
                          );
                        }}
                      >
                        {evt.registrationOpen ? "Close Reg" : "Open Reg"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: REGISTRATIONS */}
        {activeTab === "registrations" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Attendee Registrations ({registrations.length})
              </h2>
              <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: "4px 0 0 0" }}>
                Confirmed attendees for conferences and medical outreaches.
              </p>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--church-bg-muted)", textAlign: "left" }}>
                  <th style={{ padding: "12px" }}>Reference</th>
                  <th style={{ padding: "12px" }}>Name</th>
                  <th style={{ padding: "12px" }}>Event</th>
                  <th style={{ padding: "12px" }}>Contact</th>
                  <th style={{ padding: "12px" }}>Registered On</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--church-border)" }}>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 700 }}>{r.refCode}</td>
                    <td style={{ padding: "12px", fontWeight: 600 }}>{r.fullName}</td>
                    <td style={{ padding: "12px" }}>{r.eventTitle}</td>
                    <td style={{ padding: "12px" }}>
                      <div>{r.telephone}</div>
                      <small style={{ color: "var(--church-text-muted)" }}>{r.email}</small>
                    </td>
                    <td style={{ padding: "12px", color: "var(--church-text-muted)" }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: DONATIONS & M-PESA */}
        {activeTab === "donations" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Donations & Verified Transactions
              </h2>
              <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: "4px 0 0 0" }}>
                Verified mobile money contributions and campaign reconciliations.
              </p>
            </div>

            {/* Campaign Progress Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
              {campaignsList.map((camp) => (
                <div key={camp.id} style={{ padding: "16px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}>
                  <h4 style={{ margin: "0 0 6px 0", color: "var(--church-primary)" }}>{camp.title}</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--church-text-muted)" }}>
                    <span>Raised: KES {camp.raisedAmount.toLocaleString()}</span>
                    <span>Target: KES {camp.targetAmount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--church-bg-muted)", textAlign: "left" }}>
                  <th style={{ padding: "12px" }}>Receipt / Ref</th>
                  <th style={{ padding: "12px" }}>Donor</th>
                  <th style={{ padding: "12px" }}>Amount</th>
                  <th style={{ padding: "12px" }}>Category</th>
                  <th style={{ padding: "12px" }}>Method</th>
                  <th style={{ padding: "12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--church-border)" }}>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 700 }}>{d.ref}</td>
                    <td style={{ padding: "12px" }}>{d.donorName}</td>
                    <td style={{ padding: "12px", fontWeight: 700, color: "var(--church-success)" }}>
                      KES {d.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "12px" }}>{d.category}</td>
                    <td style={{ padding: "12px" }}>{d.method}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ color: "var(--church-success)", fontWeight: 700 }}>✓ Verified</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 6: PRAYER REQUESTS */}
        {activeTab === "prayers" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Prayer Requests (Confidential)
              </h2>
              <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: "4px 0 0 0" }}>
                Pastoral intercession requests submitted by website visitors.
              </p>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              {prayers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "20px",
                    border: "1px solid var(--church-border)",
                    borderRadius: "var(--church-radius)",
                    backgroundColor: p.status === "received" ? "var(--church-bg-alt)" : "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "15px", color: "var(--church-primary)" }}>{p.fullName}</strong>
                      {p.telephone && <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--church-text-muted)" }}>📞 {p.telephone}</span>}
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: p.status === "received" ? "var(--church-warning)" : "var(--church-success)" }}>
                      {p.status === "received" ? "Pending Prayer" : "✓ Prayed Over"}
                    </span>
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--church-text)", margin: "0 0 14px 0" }}>
                    &ldquo;{p.requestText}&rdquo;
                  </p>
                  {p.status === "received" && (
                    <button
                      type="button"
                      className="ch-btn ch-btn-primary"
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                      onClick={() => {
                        setPrayers(
                          prayers.map((x) => (x.id === p.id ? { ...x, status: "prayed_for" } : x))
                        );
                      }}
                    >
                      Mark as Prayed Over
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: ENQUIRIES */}
        {activeTab === "messages" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Enquiries & Contact Messages ({messages.length})
              </h2>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              {messages.map((m) => (
                <div key={m.id} style={{ padding: "18px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "15px" }}>{m.subject}</strong>
                    <span className="ch-eyebrow" style={{ fontSize: "11px" }}>{m.category}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--church-text-muted)", marginBottom: "12px" }}>
                    From: <strong>{m.fullName}</strong> ({m.email})
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: 1.6, margin: "0 0 14px 0" }}>
                    {m.message}
                  </p>
                  <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="ch-btn ch-btn-outline" style={{ fontSize: "12px", padding: "6px 14px" }}>
                    Reply via Email ✉️
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: GALLERY & MEDIA */}
        {activeTab === "gallery" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--church-primary)", margin: 0 }}>
                Media Library & Albums ({galleryList.length})
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              {galleryList.map((g) => (
                <div key={g.id} style={{ border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)", overflow: "hidden" }}>
                  <div style={{ height: "160px", background: "var(--church-bg-muted)" }}>
                    <img src={g.imageUrl} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: "12px" }}>
                    <strong style={{ display: "block", fontSize: "13px" }}>{g.title}</strong>
                    <small style={{ color: "var(--church-text-muted)" }}>{g.category} • {g.eventDate}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 9: SETTINGS & AUDIT */}
        {activeTab === "settings" && (
          <div>
            <h2 style={{ fontSize: "22px", color: "var(--church-primary)", marginBottom: "16px" }}>
              Ministry Configuration Settings
            </h2>
            <div style={{ display: "grid", gap: "16px", maxWidth: "600px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Ministry Name</label>
                <input type="text" readOnly value={globalMissionConfig.ministryName} style={{ width: "100%", padding: "10px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>M-Pesa Paybill</label>
                <input type="text" readOnly value={globalMissionConfig.giving.mpesaPaybill} style={{ width: "100%", padding: "10px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Account Number</label>
                <input type="text" readOnly value={globalMissionConfig.giving.accountName} style={{ width: "100%", padding: "10px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div>
            <h2 style={{ fontSize: "22px", color: "var(--church-primary)", marginBottom: "16px" }}>
              Ministry Security Audit Logs
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--church-bg-muted)", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>Action</th>
                  <th style={{ padding: "10px" }}>Actor</th>
                  <th style={{ padding: "10px" }}>Resource</th>
                  <th style={{ padding: "10px" }}>Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--church-border)" }}>
                  <td style={{ padding: "10px", fontWeight: 600 }}>SERMON_PUBLISHED</td>
                  <td style={{ padding: "10px" }}>admin@globalmissionfc.org</td>
                  <td style={{ padding: "10px" }}>sermon-1</td>
                  <td style={{ padding: "10px", color: "var(--church-text-muted)" }}>2026-11-08 19:40:12</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--church-border)" }}>
                  <td style={{ padding: "10px", fontWeight: 600 }}>EVENT_CREATED</td>
                  <td style={{ padding: "10px" }}>admin@globalmissionfc.org</td>
                  <td style={{ padding: "10px" }}>annual-revival-conference-2026</td>
                  <td style={{ padding: "10px", color: "var(--church-text-muted)" }}>2026-11-07 14:15:22</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Sermon Modal */}
      {showAddSermon && (
        <div
          className="ch-modal-overlay"
          onClick={() => setShowAddSermon(false)}
        >
          <div
            className="ch-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "28px" }}
          >
            <h3 style={{ fontSize: "20px", marginBottom: "16px" }}>Add New Sermon</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const slug = newSermon.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                setSermonsList([
                  ...sermonsList,
                  {
                    id: `sermon-${Date.now()}`,
                    slug,
                    title: newSermon.title,
                    speaker: newSermon.speaker,
                    date: "November 2026",
                    scriptureReference: newSermon.scriptureReference,
                    category: newSermon.category,
                    youtubeVideoId: newSermon.youtubeVideoId,
                    description: newSermon.description,
                  },
                ]);
                setShowAddSermon(false);
              }}
              style={{ display: "grid", gap: "12px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Title *</label>
                <input
                  type="text"
                  required
                  value={newSermon.title}
                  onChange={(e) => setNewSermon({ ...newSermon, title: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Speaker *</label>
                <input
                  type="text"
                  required
                  value={newSermon.speaker}
                  onChange={(e) => setNewSermon({ ...newSermon, speaker: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Scripture Reference</label>
                  <input
                    type="text"
                    value={newSermon.scriptureReference}
                    onChange={(e) => setNewSermon({ ...newSermon, scriptureReference: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>YouTube Video ID</label>
                  <input
                    type="text"
                    placeholder="e.g. bO9p1a8_zV4"
                    value={newSermon.youtubeVideoId}
                    onChange={(e) => setNewSermon({ ...newSermon, youtubeVideoId: e.target.value })}
                    style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Description</label>
                <textarea
                  rows={3}
                  value={newSermon.description}
                  onChange={(e) => setNewSermon({ ...newSermon, description: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="ch-btn ch-btn-outline" onClick={() => setShowAddSermon(false)}>
                  Cancel
                </button>
                <button type="submit" className="ch-btn ch-btn-accent">
                  Publish Sermon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div
          className="ch-modal-overlay"
          onClick={() => setShowAddEvent(false)}
        >
          <div
            className="ch-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "28px" }}
          >
            <h3 style={{ fontSize: "20px", marginBottom: "16px" }}>Create New Event</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const slug = newEvent.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                setEventsList([
                  ...eventsList,
                  {
                    id: `event-${Date.now()}`,
                    slug,
                    title: newEvent.title,
                    dateStr: newEvent.dateStr,
                    dayBadge: "15",
                    monthBadge: "DEC",
                    time: "8:00 AM EAT",
                    venue: newEvent.venue,
                    location: newEvent.location,
                    description: newEvent.description,
                    posterUrl: "/images/events/conference.jpg",
                    registrationOpen: true,
                    registrationCapacity: newEvent.capacity,
                  },
                ]);
                setShowAddEvent(false);
              }}
              style={{ display: "grid", gap: "12px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Event Title *</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Dates *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dec 15 - 18, 2026"
                  value={newEvent.dateStr}
                  onChange={(e) => setNewEvent({ ...newEvent, dateStr: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700 }}>Venue & Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Church Grounds, Nyeri"
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--church-border)", borderRadius: "var(--church-radius)" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="ch-btn ch-btn-outline" onClick={() => setShowAddEvent(false)}>
                  Cancel
                </button>
                <button type="submit" className="ch-btn ch-btn-accent">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
