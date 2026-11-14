"use client";

import { PageHero } from "../../components/gmfc/PageHero";
import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function VisitPage() {
  const site = useMinistrySite();
  const hasVisitorDetails = Boolean(site.serviceTimes.length || site.locations.length || Object.values(site.visitorInfo).some((value) => value.trim()));

  return (
    <SiteChrome currentPath="/visit">
      <main id="main-content">
        <PageHero
          eyebrow="You Are Welcome Here"
          title="Plan your"
          titleHighlight="visit"
          subtitle="Find a gathering time, a location, and the details that help you feel at home."
        />

      <section className="ch-section">
        <div className="ch-container">
          <div className="ch-heading-wrap">
            <span className="ch-eyebrow">Gather with us</span>
            <h2 className="ch-title">Service times and locations</h2>
            <p className="ch-subtitle">Check the details below before travelling. Special gatherings may have different times or venues.</p>
          </div>

          {site.serviceTimes.length ? <div className="ch-grid-3">
            {site.serviceTimes.map((service, index) => <article className="ch-info-card" key={`${service.label}-${index}`}>
              <span className="ch-eyebrow">{service.day}</span>
              <h3>{service.label}</h3>
              <p><strong>{service.time}</strong></p>
              {service.note && <p style={{ marginTop: 8 }}>{service.note}</p>}
            </article>)}
          </div> : <div className="ch-info-card" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <h3>Service times are being updated</h3>
            <p>Contact the ministry before visiting so the team can share the latest gathering details.</p>
            <a href="/contact" className="ch-btn ch-btn-primary" style={{ marginTop: 18 }}>Contact the ministry</a>
          </div>}

          {site.locations.length > 0 && <div className="ch-grid-2" style={{ marginTop: 24 }}>
            {site.locations.map((location, index) => <article className="ch-info-card" key={`${location.name}-${index}`}>
              <h3>{location.name}</h3>
              <p>{location.address}</p>
              {location.mapUrl && <a className="ch-btn ch-btn-outline" href={location.mapUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}>Open map directions</a>}
            </article>)}
          </div>}
        </div>
      </section>

      {hasVisitorDetails && <section className="ch-section ch-section-alt">
        <div className="ch-container">
          <div className="ch-heading-wrap">
            <span className="ch-eyebrow">First time with us?</span>
            <h2 className="ch-title">A few helpful details</h2>
          </div>
          <div className="ch-grid-2">
            {[
              ["What to expect", site.visitorInfo.arrival],
              ["Children and families", site.visitorInfo.children],
              ["Accessibility", site.visitorInfo.accessibility],
              ["Parking and transport", site.visitorInfo.parking],
            ].filter(([, content]) => content.trim()).map(([title, content]) => <article className="ch-info-card" key={title}>
              <h3>{title}</h3><p>{content}</p>
            </article>)}
          </div>
        </div>
      </section>}

      {site.faqs.length > 0 && <section className="ch-section">
        <div className="ch-container" style={{ maxWidth: 920 }}>
          <div className="ch-heading-wrap">
            <span className="ch-eyebrow">Answers for your first visit</span>
            <h2 className="ch-title">Frequently asked questions</h2>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {site.faqs.map((faq, index) => <details className="ch-info-card" key={`${faq.question}-${index}`}>
              <summary style={{ cursor: "pointer", color: "var(--church-primary)", fontWeight: 700, lineHeight: 1.5 }}>{faq.question}</summary>
              <p style={{ marginTop: 12 }}>{faq.answer}</p>
            </details>)}
          </div>
        </div>
      </section>}

      <section className="ch-section ch-section-dark">
        <div className="ch-container" style={{ textAlign: "center", maxWidth: 760 }}>
          <span className="ch-eyebrow">Questions before you arrive?</span>
          <h2 className="ch-title">We would be glad to help.</h2>
          <p className="ch-subtitle">Reach the ministry team for current service details or accessibility needs.</p>
          <a href="/contact" className="ch-btn ch-btn-accent" style={{ marginTop: 24 }}>Get in touch</a>
        </div>
      </section>
      </main>
    </SiteChrome>
  );
}
