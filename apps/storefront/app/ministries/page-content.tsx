"use client";

import { useState } from "react";
import { ChurchFooter, ChurchNav, PageHero } from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

type CategoryTab = "all" | "departments" | "ministries" | "groups" | "volunteerTeams" | "locations";

export default function MinistriesPage() {
  const site = useMinistrySite();
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");

  const hasDepartments = (site.departments?.length ?? 0) > 0;
  const hasMinistries = (site.ministries?.length ?? 0) > 0;
  const hasGroups = (site.groups?.length ?? 0) > 0;
  const hasVolunteerTeams = (site.volunteerTeams?.length ?? 0) > 0;
  const hasLocations = (site.locations?.length ?? 0) > 0;

  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        links={site.navigation}
        currentPath="/ministries"
        giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null}
      />
      <main id="main-content">
        <PageHero
          eyebrow="FIND YOUR PLACE"
          title="Life is better"
          highlightedTitle="in community"
          subtitle="Explore the departments, ministry wings, fellowship circles, and volunteer teams that empower every member to grow and serve."
          bgImageUrl={site.branding.heroBgUrl}
        />

        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Connect and Serve</span>
              <h2 className="ch-title">Fellowship & Operations Directory</h2>
              <p className="ch-subtitle">
                Browse our structured ministry departments, small groups, volunteer opportunities, and facilities.
              </p>
            </div>

            {/* Interactive Category Filter Tabs */}
            <div className="ch-tabs-bar" role="tablist" aria-label="Ministry sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={`ch-tab-button ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Sections
              </button>
              {hasDepartments && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "departments"}
                  className={`ch-tab-button ${activeTab === "departments" ? "active" : ""}`}
                  onClick={() => setActiveTab("departments")}
                >
                  Departments ({site.departments?.length ?? 0})
                </button>
              )}
              {hasMinistries && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "ministries"}
                  className={`ch-tab-button ${activeTab === "ministries" ? "active" : ""}`}
                  onClick={() => setActiveTab("ministries")}
                >
                  Ministries & Programs ({site.ministries.length})
                </button>
              )}
              {hasGroups && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "groups"}
                  className={`ch-tab-button ${activeTab === "groups" ? "active" : ""}`}
                  onClick={() => setActiveTab("groups")}
                >
                  Life Groups & Cells ({site.groups?.length ?? 0})
                </button>
              )}
              {hasVolunteerTeams && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "volunteerTeams"}
                  className={`ch-tab-button ${activeTab === "volunteerTeams" ? "active" : ""}`}
                  onClick={() => setActiveTab("volunteerTeams")}
                >
                  Volunteer Teams ({site.volunteerTeams?.length ?? 0})
                </button>
              )}
              {hasLocations && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "locations"}
                  className={`ch-tab-button ${activeTab === "locations" ? "active" : ""}`}
                  onClick={() => setActiveTab("locations")}
                >
                  Campuses & Locations ({site.locations.length})
                </button>
              )}
            </div>

            {/* 1. Departments */}
            {(activeTab === "all" || activeTab === "departments") && hasDepartments && (
              <div style={{ marginBottom: "56px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "0 0 6px" }}>
                    Ministry Departments
                  </h3>
                  <p style={{ color: "var(--church-text-muted)", fontSize: "14px", margin: 0 }}>
                    Core operational departments driving spiritual care, mission outreach, and church administration.
                  </p>
                </div>
                <div className="ch-grid-3">
                  {(site.departments ?? []).map((dept, index) => (
                    <article className="ch-dept-card" key={`${dept.name}-${index}`}>
                      <span className="ch-dept-icon">{dept.icon || "🏛️"}</span>
                      <h4 className="ch-dept-title">{dept.name}</h4>
                      <p className="ch-dept-desc">{dept.description}</p>
                      {(dept.leaderName || dept.meetingSchedule) && (
                        <div className="ch-dept-meta">
                          {dept.leaderName && <div className="ch-dept-leader">Leader: {dept.leaderName}</div>}
                          {dept.meetingSchedule && <div className="ch-dept-schedule">Schedule: {dept.meetingSchedule}</div>}
                        </div>
                      )}
                      <a
                        href="/contact"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "16px",
                          color: "var(--church-accent)",
                          fontWeight: 700,
                          fontSize: "13px",
                          textDecoration: "none",
                        }}
                      >
                        Inquire or Join Department <span aria-hidden="true">→</span>
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Ministries & Programs */}
            {(activeTab === "all" || activeTab === "ministries") && hasMinistries && (
              <div style={{ marginBottom: "56px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "0 0 6px" }}>
                    Ministries & Outreaches
                  </h3>
                  <p style={{ color: "var(--church-text-muted)", fontSize: "14px", margin: 0 }}>
                    Focused fellowship circles and community-oriented programs for all age groups and walks of life.
                  </p>
                </div>
                <div className="ch-grid-3">
                  {site.ministries.map((ministry, index) => (
                    <article className="ch-info-card" key={`${ministry.title}-${index}`}>
                      {ministry.audience && <span className="ch-eyebrow">{ministry.audience}</span>}
                      <h3>{ministry.title}</h3>
                      <p>{ministry.description}</p>
                      <a
                        href="/contact"
                        style={{
                          display: "inline-flex",
                          marginTop: 18,
                          color: "var(--church-primary)",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        Ask about this ministry <span aria-hidden="true">→</span>
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Small Groups / Cell Circles */}
            {(activeTab === "all" || activeTab === "groups") && hasGroups && (
              <div style={{ marginBottom: "56px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "0 0 6px" }}>
                    Cell Groups & Discipleship Circles
                  </h3>
                  <p style={{ color: "var(--church-text-muted)", fontSize: "14px", margin: 0 }}>
                    Neighborhood prayer fellowships and life circles meeting weekly across towns and campuses.
                  </p>
                </div>
                <div className="ch-grid-4">
                  {(site.groups ?? []).map((group, index) => (
                    <article className="ch-group-card" key={`${group.name}-${index}`}>
                      <span className="ch-group-category">{group.category}</span>
                      <h4 className="ch-group-title">{group.name}</h4>
                      <p style={{ fontSize: 13, color: "var(--church-text-muted)", margin: "0 0 10px" }}>
                        {group.description}
                      </p>
                      {group.meetingSchedule && (
                        <div className="ch-group-info-item">
                          <span>🕒</span> <span>{group.meetingSchedule}</span>
                        </div>
                      )}
                      {group.locationOrVirtual && (
                        <div className="ch-group-info-item">
                          <span>📍</span> <span>{group.locationOrVirtual}</span>
                        </div>
                      )}
                      {group.leaderName && (
                        <div className="ch-group-info-item">
                          <span>👤</span> <span>{group.leaderName}</span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Volunteer Teams */}
            {(activeTab === "all" || activeTab === "volunteerTeams") && hasVolunteerTeams && (
              <div style={{ marginBottom: "56px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "0 0 6px" }}>
                    Volunteer Ministry Teams
                  </h3>
                  <p style={{ color: "var(--church-text-muted)", fontSize: "14px", margin: 0 }}>
                    Serve with your gifts on our Sunday service and outreach volunteer teams.
                  </p>
                </div>
                <div className="ch-grid-3">
                  {(site.volunteerTeams ?? []).map((team, index) => (
                    <article className="ch-card" key={`${team.title}-${index}`}>
                      <div className="ch-card-body">
                        {team.department && <span className="ch-eyebrow">{team.department}</span>}
                        <h4 style={{ fontSize: "18px", color: "var(--church-primary)", margin: "4px 0 8px" }}>
                          {team.title}
                        </h4>
                        <p style={{ fontSize: "14px", color: "var(--church-text-muted)", lineHeight: 1.6, margin: "0 0 14px" }}>
                          {team.description}
                        </p>
                        {(team.coordinatorName || team.requirements) && (
                          <div style={{ fontSize: "12px", borderTop: "1px solid var(--church-border)", paddingTop: "12px", color: "var(--church-text-muted)" }}>
                            {team.coordinatorName && <div><strong>Coordinator:</strong> {team.coordinatorName}</div>}
                            {team.requirements && <div style={{ color: "var(--church-accent)" }}><strong>Requirements:</strong> {team.requirements}</div>}
                          </div>
                        )}
                        <a
                          href="/contact"
                          className="ch-btn ch-btn-outline"
                          style={{ marginTop: "16px", padding: "8px 14px", fontSize: "13px" }}
                        >
                          Join This Team
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Campuses & Locations */}
            {(activeTab === "all" || activeTab === "locations") && hasLocations && (
              <div style={{ marginBottom: "56px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "0 0 6px" }}>
                    Campuses & Meeting Venues
                  </h3>
                  <p style={{ color: "var(--church-text-muted)", fontSize: "14px", margin: 0 }}>
                    Join us in person at any of our worship centres and mission grounds.
                  </p>
                </div>
                <div className="ch-grid ch-grid-3">
                  {site.locations.map((loc, index) => (
                    <article className="ch-card" key={`${loc.name}-${index}`}>
                      <div className="ch-card-body">
                        <span className="ch-eyebrow" style={{ color: "var(--church-accent)" }}>Campus</span>
                        <h4 style={{ fontSize: "18px", color: "var(--church-primary)", margin: "6px 0 8px" }}>
                          {loc.name}
                        </h4>
                        <p style={{ fontSize: "14px", color: "var(--church-text-muted)", lineHeight: 1.6, margin: "0 0 16px" }}>
                          📍 {loc.address}
                        </p>
                        {loc.mapUrl && (
                          <a
                            href={loc.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ch-btn ch-btn-outline"
                            style={{ padding: "6px 14px", fontSize: "13px" }}
                          >
                            View on Google Maps →
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {!hasDepartments && !hasMinistries && !hasGroups && (
              <div className="ch-info-card" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
                <h3>Ministry groups are being added</h3>
                <p>Contact the team to learn about current ways to connect and serve.</p>
                <a href="/contact" className="ch-btn ch-btn-primary" style={{ marginTop: 18 }}>
                  Explore ways to serve
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="ch-section ch-section-alt">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: 760 }}>
            <span className="ch-eyebrow">Take the next step</span>
            <h2 className="ch-title">There is a place for you.</h2>
            <p className="ch-subtitle">
              Join us for a service or send a message and we will help you find the right connection.
            </p>
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              <a href="/visit" className="ch-btn ch-btn-primary">
                Plan a visit
              </a>
              <a href="/contact" className="ch-btn ch-btn-outline">
                Contact our team
              </a>
            </div>
          </div>
        </section>
      </main>
      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
      />
    </>
  );
}
