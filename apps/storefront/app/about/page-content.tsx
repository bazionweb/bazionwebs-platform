"use client";

import { useState } from "react";
import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { PageHero } from "../../components/gmfc/PageHero";
import { useMinistrySite } from "../../lib/use-ministry-site";

const DEFAULT_DIRECTOR_MESSAGE =
  "At Global Mission for Christ International, our heartbeat is to see lives transformed by the power of Jesus Christ and revival spread to the nations of the world. We are committed to raising men and women grounded in prayer, rooted in the Word of God, empowered by the Holy Spirit, passionate for righteousness, and dedicated to impacting their generation for Christ. As a ministry, we continue to reach communities through the Gospel, prayer gatherings, revival meetings, and acts of compassion — supporting the needy through medical and community outreach programs. May this ministry continue to inspire faith, ignite passion for God, and draw many into a deeper relationship with Christ. Together, let us shine His light and carry the message of hope to the world.";

function cleanHandle(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  const match = url.match(/\/(@[^/?#]+|[^/?#]+)\/?$/);
  if (!match?.[1]) return fallback;
  return match[1].startsWith("@") ? match[1] : `@${match[1]}`;
}

function splitAboutHeroTitle(ministryName: string): { title: string; highlight: string } {
  const trimmed = ministryName.trim();
  if (!trimmed) {
    return { title: "About Our", highlight: "Ministry" };
  }
  if (/^global mission for christ international$/i.test(trimmed)) {
    return { title: "Global Mission For", highlight: "Christ International" };
  }
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return { title: "About", highlight: words[0] };
  }
  if (words.length <= 3) {
    return { title: words[0], highlight: words.slice(1).join(" ") };
  }
  return {
    title: words.slice(0, -2).join(" "),
    highlight: words.slice(-2).join(" "),
  };
}

export default function AboutPage() {
  const site = useMinistrySite();
  const [leadershipLayout, setLeadershipLayout] = useState<"portrait" | "compact">("portrait");

  const vmCards = [
    {
      icon: "🌍",
      title: site.vision.title || "Vision",
      body: site.vision.statement,
      bg: "V",
    },
    {
      icon: "⛪",
      title: site.mission.title || "Mission",
      body: site.mission.statement,
      bg: "M",
    },
    {
      icon: "🌱",
      title: site.outreach.title || "Outreach",
      body: site.outreach.statement,
      bg: "O",
    },
  ].filter((c) => c.body.trim().length > 0);

  const heroTitle = splitAboutHeroTitle(site.ministryName);
  const director = site.leadership[0];
  const directorName = director?.name || "";
  const directorDisplay = directorName
    ? /rev\.|pastor|bishop|apostle|dr\./i.test(directorName)
      ? directorName
      : `Rev. ${directorName}`
    : "";
  const directorImg = director?.photoUrl || "/images/anthony-githui.jpg";
  const directorBody =
    director?.bio?.trim() ||
    (site.tenantSlug === "global-mission-fc"
      ? DEFAULT_DIRECTOR_MESSAGE
      : site.mission.statement || site.vision.statement);
  const addressDisplay = site.contact.poBox || site.contact.address;
  const twitterHandle = cleanHandle(site.social.twitter, "");
  const youtubeHandle = cleanHandle(site.social.youtube, "");

  return (
    <SiteChrome currentPath="/about">
      <main id="main-content">
        <PageHero
          eyebrow="Our Story & Purpose"
          title={heroTitle.title}
          titleHighlight={heroTitle.highlight}
          subtitle={site.tagline || "Grounded in prayer, the Word of God, and community transformation."}
          subtitleSecondLine={
            site.tenantSlug === "global-mission-fc"
              ? "From Kenya to the ends of the earth — Christ for Every Nation."
              : undefined
          }
        />

        <div className="gmfci-about-wrap">
          {vmCards.length > 0 && (
            <div className="gmfci-vm-section">
              <p className="gmfci-section-label">What We Stand For</p>
              <h2 className="gmfci-section-title">Our Vision &amp; Mission</h2>
              <div className="gmfci-vm-grid">
                {vmCards.map((c) => (
                  <div key={c.title} className="gmfci-vm-card">
                    <span className="gmfci-vm-icon">{c.icon}</span>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                    <div className="vmcard-bg-text">{c.bg}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {site.coreValues.length > 0 && (
            <div className="gmfci-values-section">
              <div className="gmfci-values-inner">
                <p className="gmfci-section-label">What We Believe</p>
                <h2 className="gmfci-section-title">Our Core Values</h2>
                <div className="gmfci-values-list">
                  {site.coreValues.map((cv) => (
                    <div key={cv.title} className="gmfci-value-card">
                      <div className="icon">{cv.icon || "✝️"}</div>
                      <h3>{cv.title}</h3>
                      <p>{cv.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {director && (
            <div className="gmfci-director-section">
              <div className="gmfci-director-grid">
                <div className="gmfci-director-photo-wrap">
                  <div className="gmfci-director-photo-frame">
                    <img
                      src={directorImg}
                      alt={directorDisplay}
                      style={{
                        width: "300px",
                        height: "400px",
                        maxWidth: "100%",
                        objectFit: "cover",
                        borderRadius: "12px",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
                <div className="gmfci-director-content">
                  <div className="role-badge">✝ {director.role || "Director"}&apos;s Message</div>
                  <h2>{directorDisplay}</h2>
                  {directorBody && <p className="director-message">&ldquo;{directorBody}&rdquo;</p>}
                  <div className="director-sig">
                    Grace and Peace,
                    <br />
                    {directorDisplay}
                    <span>
                      {director.role || "Director"}, {site.ministryName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {site.leadership.length > 0 && (
            <section className="gmfci-leadership-section" aria-labelledby="leadership-heading">
              <div className="gmfci-leadership-inner">
                <div className="gmfci-leadership-header">
                  <p className="gmfci-section-label">Servant Leaders</p>
                  <h2 id="leadership-heading" className="gmfci-section-title" style={{ marginBottom: 14 }}>
                    Our Leadership Team
                  </h2>
                  <p className="gmfci-leadership-subtitle">
                    Dedicated men and women of God guiding {site.ministryName} in prayer, revival, and governance.
                  </p>
                  <div className="gmfci-layout-switcher" role="group" aria-label="Leadership layout style">
                    <button
                      type="button"
                      className={`gmfci-layout-btn${leadershipLayout === "portrait" ? " active" : ""}`}
                      aria-pressed={leadershipLayout === "portrait"}
                      onClick={() => setLeadershipLayout("portrait")}
                    >
                      Portrait Cards
                    </button>
                    <button
                      type="button"
                      className={`gmfci-layout-btn${leadershipLayout === "compact" ? " active" : ""}`}
                      aria-pressed={leadershipLayout === "compact"}
                      onClick={() => setLeadershipLayout("compact")}
                    >
                      Classic View
                    </button>
                  </div>
                </div>

                {leadershipLayout === "portrait" ? (
                  <div className="gmfci-leadership-grid">
                    {site.leadership.map((leader) => {
                      const isShadrach =
                        /shadrach/i.test(leader.name) ||
                        Boolean(leader.photoUrl?.includes("apostle-shadrach"));
                      return (
                        <article key={leader.id} className="gmfci-leader-card ch-card">
                          <div className="gmfci-leader-media">
                            <img
                              src={leader.photoUrl || "/images/anthony-githui.jpg"}
                              alt={leader.name}
                              loading="lazy"
                              style={isShadrach ? { objectPosition: "center 24%" } : undefined}
                            />
                            <span className="gmfci-leader-badge">{leader.role}</span>
                          </div>
                          <div className="gmfci-leader-body">
                            <span className="gmfci-leader-divider" aria-hidden="true" />
                            <h3 className="gmfci-leader-name">{leader.name}</h3>
                            <div className="gmfci-leader-role">{leader.role}</div>
                            <p className="gmfci-leader-ministry">{site.ministryName}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="gmfci-bishops-grid">
                    {site.leadership.map((leader) => {
                      const isShadrach =
                        /shadrach/i.test(leader.name) ||
                        Boolean(leader.photoUrl?.includes("apostle-shadrach"));
                      return (
                        <article key={leader.id} className="gmfci-bishop-card gmfci-bishop-card--elevated ch-card">
                          <div
                            className="gmfci-bishop-avatar gmfci-bishop-avatar--lg"
                            style={
                              leader.photoUrl
                                ? {
                                    backgroundImage: `url(${leader.photoUrl})`,
                                    ...(isShadrach ? { backgroundPosition: "center 24%" } : {}),
                                  }
                                : undefined
                            }
                          />
                          <h4>{leader.name}</h4>
                          <span className="gmfci-bishop-role-pill">{leader.role}</span>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Platform feature layered on top when statement of faith is configured */}
          {site.statementOfFaith.length > 0 && (
            <div className="gmfci-values-section">
              <div className="gmfci-values-inner">
                <p className="gmfci-section-label">Doctrine</p>
                <h2 className="gmfci-section-title">Statement of Faith</h2>
                <div className="gmfci-values-list">
                  {site.statementOfFaith.map((item) => (
                    <div key={item.topic} className="gmfci-value-card">
                      <h3>{item.topic}</h3>
                      <p>{item.belief}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="gmfci-about-contact">
            <div className="gmfci-about-contact-inner">
              {site.contact.phones.length > 0 && (
                <div className="gmfci-contact-item">
                  <div className="gmfci-contact-icon" aria-hidden="true">📞</div>
                  <div>
                    <h4>Phone</h4>
                    <p>
                      {site.contact.phones.map((phone, i) => (
                        <span key={phone}>
                          {i > 0 && <br />}
                          <a href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a>
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              )}

              {site.contact.email && (
                <div className="gmfci-contact-item">
                  <div className="gmfci-contact-icon" aria-hidden="true">📧</div>
                  <div>
                    <h4>Email</h4>
                    <p>
                      <a href={`mailto:${site.contact.email}`} className="gmfci-contact-link">
                        {site.contact.email}
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {addressDisplay && (
                <div className="gmfci-contact-item">
                  <div className="gmfci-contact-icon" aria-hidden="true">📮</div>
                  <div>
                    <h4>Postal Address</h4>
                    <p>{addressDisplay}</p>
                  </div>
                </div>
              )}

              {(site.social.twitter || site.social.youtube) && (
                <div className="gmfci-contact-item">
                  <div className="gmfci-contact-icon" aria-hidden="true">🐦</div>
                  <div>
                    <h4>Follow Us</h4>
                    <p>
                      {site.social.twitter && twitterHandle && (
                        <>
                          <a
                            href={site.social.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gmfci-contact-link"
                          >
                            {twitterHandle}
                          </a>
                          {site.social.youtube && youtubeHandle && <br />}
                        </>
                      )}
                      {site.social.youtube && youtubeHandle && (
                        <a
                          href={site.social.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gmfci-contact-link"
                        >
                          {youtubeHandle}
                        </a>
                      )}
                      {!twitterHandle && !youtubeHandle && <span>Connect via social links</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
