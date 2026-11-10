"use client";

import { ChurchFooter, ChurchNav, PageHero } from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function MinistriesPage() {
  const site = useMinistrySite();

  return <>
    <ChurchNav ministryName={site.ministryName} logoUrl={site.branding.logoUrl} links={site.navigation} currentPath="/ministries" giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null} />
    <main id="main-content">
      <PageHero
        eyebrow="FIND YOUR PLACE"
        title="Life is better"
        highlightedTitle="in community"
        subtitle="Explore the groups and teams that help people grow in faith, serve one another, and care for their community."
        bgImageUrl={site.branding.heroBgUrl}
      />
      <section className="ch-section">
        <div className="ch-container">
          <div className="ch-heading-wrap">
            <span className="ch-eyebrow">Connect and serve</span>
            <h2 className="ch-title">Ministry groups</h2>
            <p className="ch-subtitle">Choose a group to learn more, or contact the team if you are not sure where to begin.</p>
          </div>
          {site.ministries.length ? <div className="ch-grid-3">
            {site.ministries.map((ministry, index) => <article className="ch-info-card" key={`${ministry.title}-${index}`}>
              {ministry.audience && <span className="ch-eyebrow">{ministry.audience}</span>}
              <h3>{ministry.title}</h3>
              <p>{ministry.description}</p>
              <a href="/contact" style={{ display: "inline-flex", marginTop: 18, color: "var(--church-primary)", fontWeight: 700, textDecoration: "none" }}>Ask about this group <span aria-hidden="true">→</span></a>
            </article>)}
          </div> : <div className="ch-info-card" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <h3>Ministry groups are being added</h3>
            <p>Contact the team to learn about current ways to connect and serve.</p>
            <a href="/contact" className="ch-btn ch-btn-primary" style={{ marginTop: 18 }}>Explore ways to serve</a>
          </div>}
        </div>
      </section>
      <section className="ch-section ch-section-alt">
        <div className="ch-container" style={{ textAlign: "center", maxWidth: 760 }}>
          <span className="ch-eyebrow">Take the next step</span>
          <h2 className="ch-title">There is a place for you.</h2>
          <p className="ch-subtitle">Join us for a service or send a message and we will help you find the right connection.</p>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
            <a href="/visit" className="ch-btn ch-btn-primary">Plan a visit</a>
            <a href="/contact" className="ch-btn ch-btn-outline">Contact our team</a>
          </div>
        </div>
      </section>
    </main>
    <ChurchFooter ministryName={site.ministryName} tagline={site.tagline} phoneNumbers={site.contact.phones} email={site.contact.email} address={site.contact.address} />
  </>;
}
