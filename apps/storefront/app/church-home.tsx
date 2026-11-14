"use client";

import Link from "next/link";
import { SiteChrome } from "../components/gmfc/SiteChrome";
import { EventBanner } from "../components/gmfc/EventBanner";
import { Hero } from "../components/gmfc/Hero";
import { EventHighlights } from "../components/gmfc/EventHighlights";
import { useMinistrySite } from "../lib/use-ministry-site";

export default function ChurchHome() {
  const site = useMinistrySite();
  const hasMinistriesData =
    site.ministries.length > 0 ||
    (site.departments?.length ?? 0) > 0 ||
    (site.groups?.length ?? 0) > 0;
  const hasServiceTimes = site.serviceTimes.length > 0;
  const hasTestimonies = (site.testimonies?.length ?? 0) > 0;

  return (
    <SiteChrome currentPath="/">
      <main id="main-content">
        <EventBanner />
        <Hero />
        <EventHighlights />

        {/* Platform features layered on top when populated by the ministry admin */}
        {hasServiceTimes && (
          <section className="ch-section ch-section-alt">
            <div className="ch-container">
              <div className="ch-heading-wrap">
                <span className="ch-eyebrow">Gather With Us</span>
                <h2 className="ch-title">Service Times &amp; Worship</h2>
              </div>
              <div className="ch-grid-3">
                {site.serviceTimes.map((service, idx) => (
                  <article className="ch-info-card" key={`${service.label}-${idx}`}>
                    <span className="ch-eyebrow">{service.day}</span>
                    <h3>{service.label}</h3>
                    <p><strong>{service.time}</strong></p>
                    {service.note && <p style={{ marginTop: 8 }}>{service.note}</p>}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {hasMinistriesData && (
          <section className="ch-section">
            <div className="ch-container">
              <div className="ch-heading-wrap">
                <span className="ch-eyebrow">Connect &amp; Serve</span>
                <h2 className="ch-title">Departments, Ministries &amp; Groups</h2>
                <p className="ch-subtitle">Find your place in fellowship, outreach, and service teams.</p>
              </div>
              <div className="ch-grid-3">
                {(site.departments ?? []).slice(0, 3).map((dept, idx) => (
                  <article className="ch-dept-card" key={`${dept.name}-${idx}`}>
                    <span className="ch-dept-icon">{dept.icon || "🏛️"}</span>
                    <h3 className="ch-dept-title">{dept.name}</h3>
                    <p className="ch-dept-desc">{dept.description}</p>
                  </article>
                ))}
                {(site.departments?.length ?? 0) === 0 &&
                  site.ministries.slice(0, 3).map((ministry, idx) => (
                    <article className="ch-info-card" key={`${ministry.title}-${idx}`}>
                      {ministry.audience && <span className="ch-eyebrow">{ministry.audience}</span>}
                      <h3>{ministry.title}</h3>
                      <p>{ministry.description}</p>
                    </article>
                  ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <Link href="/ministries" className="gmfci-eh-cta-btn">
                  Explore Ministries &amp; Groups
                </Link>
              </div>
            </div>
          </section>
        )}

        {hasTestimonies && (
          <section className="ch-section ch-section-alt">
            <div className="ch-container">
              <div className="ch-heading-wrap">
                <span className="ch-eyebrow">God Is Faithful</span>
                <h2 className="ch-title">Ministry Testimonies</h2>
              </div>
              <div className="ch-grid-3">
                {(site.testimonies ?? []).slice(0, 3).map((t, idx) => (
                  <article className="ch-info-card" key={`${t.title}-${idx}`}>
                    <h3>{t.title}</h3>
                    <p>&ldquo;{t.story}&rdquo;</p>
                    <p style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>
                      — {t.authorName}{t.date ? ` (${t.date})` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </SiteChrome>
  );
}
